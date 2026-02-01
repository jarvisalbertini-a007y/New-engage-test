"""
AI Orchestration Router

The main entry point for AI-driven interactions in SalesFlow AI.
This router handles:
- Conversational AI chat (primary interface)
- Plan creation and approval workflow
- Task execution and monitoring
- Real-time agent activity streaming
- Knowledge base integration

Designed to work like Emergent/Replit/Bolt - chat-first with background agents.
"""

from fastapi import APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect
from datetime import datetime, timezone
from uuid import uuid4
from typing import Optional, List, Dict, Any
import os
import json
import re
import asyncio

from database import get_db
from routes.auth import get_current_user

# Import unified agent framework
import sys
sys.path.insert(0, '/app/backend')
from core.agent_framework import (
    AgentRegistry, AgentContext, ExecutionPlan, TaskExecutionEngine,
    get_all_agents_info, quick_agent_execute, TaskStatus
)

router = APIRouter()

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")


# ============== WEBSOCKET CONNECTIONS ==============

class ConnectionManager:
    """Manages WebSocket connections for real-time updates"""
    
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
    
    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections[user_id] = websocket
    
    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
    
    async def send_to_user(self, user_id: str, message: Dict):
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].send_json(message)
            except:
                self.disconnect(user_id)
    
    async def broadcast_activity(self, user_id: str, activity: Dict):
        """Send activity update to user"""
        await self.send_to_user(user_id, {
            "type": "activity",
            "data": activity,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })


manager = ConnectionManager()


# ============== CORE AI CHAT ==============

async def call_orchestrator_ai(prompt: str, context: Dict = None) -> str:
    """Call the main orchestrator AI"""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        session_id = f"orchestrator-{str(uuid4())[:8]}"
        
        system_prompt = """You are the AI Orchestrator for SalesFlow AI - an autonomous sales engagement platform.

Your role is to be like a senior Project Manager and Sales Expert:

1. UNDERSTAND - Deeply understand what the user wants before acting
2. CLARIFY - Ask smart clarifying questions when needed
3. PLAN - Create clear, actionable plans
4. CONFIRM - Always confirm plans before executing
5. EXECUTE - Coordinate agents to accomplish goals
6. LEARN - Improve from feedback

Communication Style:
- Be concise but thorough
- Ask clarifying questions upfront (like a good PM)
- Suggest actions proactively
- Explain what you're doing and why

When creating plans, ALWAYS respond with this JSON structure:
{
    "type": "plan" | "clarification" | "execution" | "suggestion" | "response",
    "message": "Human-readable message to display",
    "plan": {  // Only if type is "plan"
        "summary": "What we'll do",
        "steps": [
            {"id": "1", "agent": "research|outreach|optimization|intelligence|knowledge|workflow|qualification", "task": "Description", "estimatedTime": "30s"}
        ],
        "estimatedTotalTime": "2 minutes",
        "requiresApproval": true
    },
    "clarifyingQuestions": [],  // Questions to ask user
    "suggestedActions": [],  // Quick action buttons to show
    "agentActivity": []  // For showing what agents are doing
}

Remember: The user wants minimal clicks. Be proactive. Suggest next steps."""
        
        if context:
            system_prompt += f"\n\nUser Context:\n{json.dumps(context, indent=2)}"
        
        llm = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=session_id,
            system_message=system_prompt
        )
        
        response = await llm.send_message(UserMessage(text=prompt))
        return response
    except Exception as e:
        print(f"Orchestrator AI error: {e}")
        return None


def parse_ai_response(response: str) -> Dict:
    """Parse AI response into structured format"""
    if not response:
        return {
            "type": "response",
            "message": "I'm having trouble processing that. Could you try again?",
            "suggestedActions": ["Try again", "Get help"]
        }
    
    # Try to extract JSON
    try:
        json_match = re.search(r'\{.*\}', response, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group())
            if "type" in data:
                return data
    except:
        pass
    
    # Fallback - return as plain response
    return {
        "type": "response",
        "message": response,
        "suggestedActions": []
    }


# ============== MAIN CHAT ENDPOINT ==============

@router.post("/chat")
async def ai_chat(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    Main AI chat endpoint - the primary user interaction point.
    Handles natural language, creates plans, asks for approval, executes.
    """
    db = get_db()
    
    message = request.get("message", "")
    session_id = request.get("sessionId") or str(uuid4())
    approve_plan_id = request.get("approvePlanId")  # If user is approving a plan
    reject_plan_id = request.get("rejectPlanId")    # If user is rejecting a plan
    
    if not message and not approve_plan_id and not reject_plan_id:
        raise HTTPException(status_code=400, detail="Message required")
    
    # Handle plan approval
    if approve_plan_id:
        return await handle_plan_approval(approve_plan_id, current_user, db)
    
    # Handle plan rejection
    if reject_plan_id:
        return await handle_plan_rejection(reject_plan_id, current_user, db)
    
    # Get conversation history
    session = await db.ai_sessions.find_one(
        {"id": session_id, "userId": current_user["id"]},
        {"_id": 0}
    )
    
    history = session.get("messages", []) if session else []
    
    # Get user's knowledge context
    knowledge = await db.knowledge_base.find(
        {"userId": current_user["id"]},
        {"_id": 0, "content": 1, "type": 1}
    ).limit(5).to_list(5)
    
    # Get recent learnings
    learnings = await db.agent_learnings.find(
        {"userId": current_user["id"]},
        {"_id": 0}
    ).sort("createdAt", -1).limit(10).to_list(10)
    
    # Build context for AI
    context = {
        "userId": current_user["id"],
        "userName": f"{current_user.get('firstName', '')} {current_user.get('lastName', '')}",
        "company": current_user.get("companyName", ""),
        "conversationHistory": history[-10:],
        "knowledgeContext": knowledge,
        "recentLearnings": learnings,
        "availableAgents": get_all_agents_info()
    }
    
    # Call orchestrator AI
    ai_response = await call_orchestrator_ai(
        f"User message: {message}",
        context
    )
    
    # Parse response
    parsed = parse_ai_response(ai_response)
    
    # If it's a plan, save it for approval
    if parsed.get("type") == "plan" and parsed.get("plan"):
        plan_id = str(uuid4())
        plan_record = {
            "id": plan_id,
            "userId": current_user["id"],
            "sessionId": session_id,
            "plan": parsed["plan"],
            "status": "pending_approval",
            "originalMessage": message,
            "createdAt": datetime.now(timezone.utc).isoformat()
        }
        await db.pending_plans.insert_one(plan_record)
        parsed["planId"] = plan_id
    
    # Save to conversation history
    new_messages = history + [
        {"role": "user", "content": message, "timestamp": datetime.now(timezone.utc).isoformat()},
        {"role": "assistant", "content": parsed.get("message", ""), "parsed": parsed, "timestamp": datetime.now(timezone.utc).isoformat()}
    ]
    
    await db.ai_sessions.update_one(
        {"id": session_id, "userId": current_user["id"]},
        {
            "$set": {
                "messages": new_messages[-50:],  # Keep last 50
                "updatedAt": datetime.now(timezone.utc).isoformat()
            },
            "$setOnInsert": {"createdAt": datetime.now(timezone.utc).isoformat()}
        },
        upsert=True
    )
    
    return {
        "success": True,
        "sessionId": session_id,
        "response": parsed,
        "rawResponse": ai_response
    }


async def handle_plan_approval(plan_id: str, user: dict, db) -> Dict:
    """Handle user approving a plan"""
    
    # Get the pending plan
    plan_record = await db.pending_plans.find_one(
        {"id": plan_id, "userId": user["id"], "status": "pending_approval"},
        {"_id": 0}
    )
    
    if not plan_record:
        raise HTTPException(status_code=404, detail="Plan not found or already processed")
    
    # Mark as approved
    await db.pending_plans.update_one(
        {"id": plan_id},
        {"$set": {"status": "approved", "approvedAt": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Create execution context
    context = AgentContext(
        user_id=user["id"],
        session_id=plan_record.get("sessionId", str(uuid4())),
        original_goal=plan_record.get("originalMessage", "")
    )
    
    # Start execution in background
    asyncio.create_task(execute_approved_plan(plan_id, plan_record["plan"], context, user, db))
    
    return {
        "success": True,
        "message": "Plan approved! Execution started. You'll see progress in real-time.",
        "planId": plan_id,
        "status": "executing"
    }


async def handle_plan_rejection(plan_id: str, user: dict, db) -> Dict:
    """Handle user rejecting a plan"""
    
    result = await db.pending_plans.update_one(
        {"id": plan_id, "userId": user["id"], "status": "pending_approval"},
        {"$set": {"status": "rejected", "rejectedAt": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Plan not found or already processed")
    
    return {
        "success": True,
        "message": "Plan rejected. What would you like to do differently?",
        "planId": plan_id,
        "status": "rejected",
        "suggestedActions": ["Modify the plan", "Start over", "Ask for help"]
    }


async def execute_approved_plan(plan_id: str, plan: Dict, context: AgentContext, user: dict, db):
    """
    Execute an approved plan using the agent framework.
    
    INTEGRATED FEATURES:
    - Self-learning: Apply learned patterns to outreach steps
    - Email optimization: Use A/B test insights
    - Knowledge base: Inject relevant context
    - Activity tracking: Real-time updates via WebSocket
    """
    
    registry = AgentRegistry()
    registry.set_db_for_all(db)
    
    results = {}
    
    # Update plan status
    await db.pending_plans.update_one(
        {"id": plan_id},
        {"$set": {"status": "executing", "startedAt": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Send activity update
    await manager.broadcast_activity(user["id"], {
        "type": "plan_started",
        "planId": plan_id,
        "message": f"Starting execution: {plan.get('summary', 'Your task')}"
    })
    
    # ===== PRE-EXECUTION: Load learnings and knowledge =====
    
    # Get self-improvement rules for outreach optimization
    improvement_rules = await db.improvement_rules.find(
        {"userId": user["id"], "active": True},
        {"_id": 0}
    ).to_list(20)
    
    # Get relevant knowledge for context
    knowledge_items = await db.knowledge_base.find(
        {"userId": user["id"]},
        {"_id": 0, "content": 1, "category": 1, "extractedData": 1}
    ).limit(10).to_list(10)
    
    # Get winning phrases from learning sessions
    phrases_session = await db.learning_sessions.find_one(
        {"userId": user["id"], "type": "comprehensive_analysis"},
        {"_id": 0, "phrases": 1},
        sort=[("createdAt", -1)]
    )
    winning_phrases = phrases_session.get("phrases", {}) if phrases_session else {}
    
    # Inject into context
    context.learnings = [
        {"type": "rule", "data": rule} for rule in improvement_rules
    ]
    context.knowledge_context = knowledge_items
    context.metadata["winning_phrases"] = winning_phrases
    
    await manager.broadcast_activity(user["id"], {
        "type": "context_loaded",
        "planId": plan_id,
        "message": f"Loaded {len(improvement_rules)} learning rules, {len(knowledge_items)} knowledge items"
    })
    
    # ===== EXECUTE STEPS =====
    
    steps = plan.get("steps", [])
    
    for i, step in enumerate(steps):
        step_id = step.get("id", f"step_{i}")
        agent_id = step.get("agent", "orchestrator")
        task = step.get("task", "")
        
        # Send step start activity
        await manager.broadcast_activity(user["id"], {
            "type": "step_started",
            "planId": plan_id,
            "stepId": step_id,
            "agent": agent_id,
            "task": task,
            "progress": (i / len(steps)) * 100
        })
        
        # Get agent
        agent = registry.get_agent(agent_id)
        if not agent:
            agent = registry.get_agent("orchestrator")
        
        try:
            # Execute step
            step_result = await agent.execute(task, context)
            
            # ===== POST-STEP: Apply optimizations for outreach =====
            if agent_id == "outreach" and step_result.get("result"):
                result_data = step_result["result"]
                
                # Auto-apply self-improvement to generated emails
                if result_data.get("subject") and result_data.get("body") and improvement_rules:
                    await manager.broadcast_activity(user["id"], {
                        "type": "optimization_applied",
                        "planId": plan_id,
                        "stepId": step_id,
                        "message": "Applying learned patterns to email..."
                    })
                    
                    # Apply optimization via the self-improvement engine
                    from routes.self_improvement import call_ai as call_self_improve_ai
                    
                    optimize_prompt = f"""Optimize this email using these learned patterns:

EMAIL:
Subject: {result_data.get('subject', '')}
Body: {result_data.get('body', '')}

LEARNED RULES:
{json.dumps(improvement_rules[:5], indent=2)}

WINNING PHRASES:
{json.dumps(winning_phrases, indent=2) if winning_phrases else "None yet"}

Apply the rules and return JSON:
{{"subject": "optimized subject", "body": "optimized body", "optimizations_applied": ["list of changes"]}}"""
                    
                    try:
                        optimized = await call_self_improve_ai(optimize_prompt)
                        if optimized:
                            json_match = re.search(r'\{.*\}', optimized, re.DOTALL)
                            if json_match:
                                opt_data = json.loads(json_match.group())
                                result_data["subject"] = opt_data.get("subject", result_data["subject"])
                                result_data["body"] = opt_data.get("body", result_data["body"])
                                result_data["optimizations_applied"] = opt_data.get("optimizations_applied", [])
                                step_result["result"] = result_data
                    except Exception as e:
                        print(f"Optimization error: {e}")
            
            # ===== Store learnings from step =====
            if step_result.get("result"):
                await db.agent_learnings.insert_one({
                    "id": str(uuid4()),
                    "userId": user["id"],
                    "agentId": agent_id,
                    "planId": plan_id,
                    "stepId": step_id,
                    "task": task,
                    "resultSummary": str(step_result.get("result", {}))[:500],
                    "createdAt": datetime.now(timezone.utc).isoformat()
                })
            
            results[step_id] = step_result
            context.add_result(step_id, step_result)
            
            # Send step complete activity
            await manager.broadcast_activity(user["id"], {
                "type": "step_completed",
                "planId": plan_id,
                "stepId": step_id,
                "agent": agent_id,
                "result": step_result.get("result", {}),
                "progress": ((i + 1) / len(steps)) * 100
            })
            
        except Exception as e:
            results[step_id] = {"error": str(e), "status": "failed"}
            await manager.broadcast_activity(user["id"], {
                "type": "step_failed",
                "planId": plan_id,
                "stepId": step_id,
                "error": str(e)
            })
    
    # ===== POST-EXECUTION: Update knowledge base with learnings =====
    
    # Extract key insights from results and save to knowledge
    synthesis_prompt = f"""Analyze these execution results and extract key learnings:

PLAN: {plan.get('summary', '')}
RESULTS: {json.dumps(results, indent=2)[:2000]}

Extract:
1. What worked well
2. What could be improved
3. Key insights about prospects/companies
4. Patterns to remember

Return JSON:
{{"learnings": ["list of learnings"], "insights": ["key insights"], "improvements": ["suggestions"]}}"""
    
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        llm = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"synthesis-{str(uuid4())[:8]}",
            system_message="You are a learning extraction AI."
        )
        
        synthesis = await llm.send_message(UserMessage(text=synthesis_prompt))
        if synthesis:
            json_match = re.search(r'\{.*\}', synthesis, re.DOTALL)
            if json_match:
                synthesis_data = json.loads(json_match.group())
                
                # Save to knowledge base as auto-generated learning
                await db.knowledge_base.insert_one({
                    "id": str(uuid4()),
                    "userId": user["id"],
                    "name": f"Plan Execution Learnings - {datetime.now().strftime('%Y-%m-%d %H:%M')}",
                    "category": "auto_learnings",
                    "content": json.dumps(synthesis_data),
                    "extractedData": synthesis_data,
                    "source": "plan_execution",
                    "planId": plan_id,
                    "fileType": "json",
                    "fileSize": 0,
                    "status": "processed",
                    "createdAt": datetime.now(timezone.utc).isoformat()
                })
                
                await manager.broadcast_activity(user["id"], {
                    "type": "knowledge_updated",
                    "planId": plan_id,
                    "message": f"Saved {len(synthesis_data.get('learnings', []))} learnings to knowledge base"
                })
    except Exception as e:
        print(f"Knowledge synthesis error: {e}")
    
    # Update plan as completed
    await db.pending_plans.update_one(
        {"id": plan_id},
        {
            "$set": {
                "status": "completed",
                "results": results,
                "completedAt": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Send completion activity
    await manager.broadcast_activity(user["id"], {
        "type": "plan_completed",
        "planId": plan_id,
        "message": "Execution complete!",
        "results": results
    })
    
    return results


# ============== SUPPORTING ENDPOINTS ==============

@router.get("/agents")
async def get_available_agents():
    """Get all available agents in the system"""
    return get_all_agents_info()


@router.get("/session/{session_id}")
async def get_session(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get conversation session"""
    db = get_db()
    
    session = await db.ai_sessions.find_one(
        {"id": session_id, "userId": current_user["id"]},
        {"_id": 0}
    )
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return session


@router.get("/sessions")
async def get_sessions(
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get user's conversation sessions"""
    db = get_db()
    
    sessions = await db.ai_sessions.find(
        {"userId": current_user["id"]},
        {"_id": 0, "id": 1, "updatedAt": 1, "messages": {"$slice": -1}}
    ).sort("updatedAt", -1).limit(limit).to_list(limit)
    
    return sessions


@router.get("/plans/pending")
async def get_pending_plans(
    current_user: dict = Depends(get_current_user)
):
    """Get plans awaiting approval"""
    db = get_db()
    
    plans = await db.pending_plans.find(
        {"userId": current_user["id"], "status": "pending_approval"},
        {"_id": 0}
    ).sort("createdAt", -1).to_list(50)
    
    return plans


@router.get("/plans/active")
async def get_active_plans(
    current_user: dict = Depends(get_current_user)
):
    """Get currently executing plans"""
    db = get_db()
    
    plans = await db.pending_plans.find(
        {"userId": current_user["id"], "status": "executing"},
        {"_id": 0}
    ).to_list(20)
    
    return plans


@router.get("/plan/{plan_id}")
async def get_plan_status(
    plan_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get status of a specific plan"""
    db = get_db()
    
    plan = await db.pending_plans.find_one(
        {"id": plan_id, "userId": current_user["id"]},
        {"_id": 0}
    )
    
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    return plan


@router.post("/plan/{plan_id}/pause")
async def pause_plan(
    plan_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Pause an executing plan"""
    db = get_db()
    
    result = await db.pending_plans.update_one(
        {"id": plan_id, "userId": current_user["id"], "status": "executing"},
        {"$set": {"status": "paused", "pausedAt": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Plan not found or not executing")
    
    await manager.broadcast_activity(current_user["id"], {
        "type": "plan_paused",
        "planId": plan_id
    })
    
    return {"success": True, "message": "Plan paused", "planId": plan_id}


@router.post("/plan/{plan_id}/resume")
async def resume_plan(
    plan_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Resume a paused plan"""
    db = get_db()
    
    plan = await db.pending_plans.find_one(
        {"id": plan_id, "userId": current_user["id"], "status": "paused"},
        {"_id": 0}
    )
    
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found or not paused")
    
    # Resume execution
    await db.pending_plans.update_one(
        {"id": plan_id},
        {"$set": {"status": "executing", "resumedAt": datetime.now(timezone.utc).isoformat()}}
    )
    
    await manager.broadcast_activity(current_user["id"], {
        "type": "plan_resumed",
        "planId": plan_id
    })
    
    return {"success": True, "message": "Plan resumed", "planId": plan_id}


@router.post("/quick-action")
async def quick_action(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Execute a quick action with a single agent (no plan approval needed)"""
    db = get_db()
    
    agent_id = request.get("agentId", "orchestrator")
    task = request.get("task", "")
    
    if not task:
        raise HTTPException(status_code=400, detail="Task required")
    
    result = await quick_agent_execute(agent_id, task, current_user["id"], db)
    
    return {
        "success": True,
        "agentId": agent_id,
        "result": result
    }


@router.get("/activity/recent")
async def get_recent_activity(
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get recent agent activity"""
    db = get_db()
    
    activity = await db.agent_activity.find(
        {"userId": current_user["id"]},
        {"_id": 0}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    
    return activity


@router.post("/suggest")
async def get_suggestions(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Get AI-powered suggestions based on current state"""
    db = get_db()
    
    context_type = request.get("context", "general")  # general, prospect, workflow, etc.
    
    # Get relevant data based on context
    context_data = {}
    
    if context_type == "prospect":
        # Get recent prospects
        prospects = await db.prospects.find(
            {"userId": current_user["id"]},
            {"_id": 0}
        ).sort("createdAt", -1).limit(5).to_list(5)
        context_data["recentProspects"] = prospects
        
    elif context_type == "workflow":
        workflows = await db.workflows.find(
            {"userId": current_user["id"]},
            {"_id": 0}
        ).sort("updatedAt", -1).limit(5).to_list(5)
        context_data["recentWorkflows"] = workflows
    
    # Call AI for suggestions
    prompt = f"""Based on the user's current context, suggest 3-5 helpful actions they could take.

Context Type: {context_type}
Context Data: {json.dumps(context_data, indent=2)}

Respond with JSON:
{{
    "suggestions": [
        {{"text": "Action text", "action": "action_type", "priority": "high/medium/low"}}
    ]
}}"""
    
    response = await call_orchestrator_ai(prompt)
    
    suggestions = [
        {"text": "Find new prospects", "action": "find_prospects", "priority": "high"},
        {"text": "Create outreach sequence", "action": "create_workflow", "priority": "medium"},
        {"text": "Analyze performance", "action": "analyze", "priority": "low"}
    ]
    
    try:
        json_match = re.search(r'\{.*\}', response, re.DOTALL)
        if json_match:
            data = json.loads(json_match.group())
            suggestions = data.get("suggestions", suggestions)
    except:
        pass
    
    return {"suggestions": suggestions}


# ============== WEBSOCKET FOR REAL-TIME UPDATES ==============

@router.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    """WebSocket endpoint for real-time agent activity updates"""
    await manager.connect(websocket, user_id)
    
    try:
        while True:
            # Keep connection alive and handle incoming messages
            data = await websocket.receive_text()
            
            # Handle ping/pong for keep-alive
            if data == "ping":
                await websocket.send_text("pong")
            else:
                # Handle other messages if needed
                try:
                    message = json.loads(data)
                    if message.get("type") == "subscribe":
                        # Handle subscription requests
                        pass
                except:
                    pass
                    
    except WebSocketDisconnect:
        manager.disconnect(user_id)


# ============== KNOWLEDGE BASE INTEGRATION ==============

@router.post("/knowledge/auto-ingest")
async def auto_ingest_to_knowledge(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Auto-ingest data into knowledge base from agent activities"""
    db = get_db()
    
    content = request.get("content", "")
    category = request.get("category", "auto_learnings")
    source = request.get("source", "agent_activity")
    name = request.get("name", f"Auto-ingested {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    
    if not content:
        raise HTTPException(status_code=400, detail="Content required")
    
    # Process content with AI to extract key information
    extract_prompt = f"""Extract key information from this content for a sales knowledge base:

CONTENT:
{content[:3000]}

Extract and structure:
- Key facts and data points
- Actionable insights
- Patterns or trends
- Relevant contacts or companies
- Useful quotes or phrases

Return JSON:
{{
    "summary": "Brief summary",
    "keyFacts": ["fact1", "fact2"],
    "insights": ["insight1"],
    "entities": {{"companies": [], "people": [], "products": []}},
    "tags": ["tag1", "tag2"]
}}"""
    
    extracted_data = {}
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        llm = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"extract-{str(uuid4())[:8]}",
            system_message="You are a knowledge extraction AI."
        )
        
        extraction = await llm.send_message(UserMessage(text=extract_prompt))
        if extraction:
            json_match = re.search(r'\{.*\}', extraction, re.DOTALL)
            if json_match:
                extracted_data = json.loads(json_match.group())
    except Exception as e:
        print(f"Extraction error: {e}")
    
    # Save to knowledge base
    doc = {
        "id": str(uuid4()),
        "userId": current_user["id"],
        "name": name,
        "category": category,
        "content": content,
        "extractedData": extracted_data,
        "source": source,
        "fileType": "text",
        "fileSize": len(content),
        "status": "processed",
        "autoIngested": True,
        "createdAt": datetime.now(timezone.utc).isoformat()
    }
    
    await db.knowledge_base.insert_one(doc)
    
    return {
        "success": True,
        "documentId": doc["id"],
        "extractedData": extracted_data
    }


@router.get("/knowledge/search")
async def search_knowledge(
    query: str,
    limit: int = 5,
    current_user: dict = Depends(get_current_user)
):
    """Search knowledge base for relevant context"""
    db = get_db()
    
    # Simple text search (in production, use vector search)
    # For now, use regex matching
    regex_pattern = {"$regex": query, "$options": "i"}
    
    results = await db.knowledge_base.find(
        {
            "userId": current_user["id"],
            "$or": [
                {"name": regex_pattern},
                {"content": regex_pattern},
                {"extractedData.summary": regex_pattern},
                {"extractedData.keyFacts": regex_pattern}
            ]
        },
        {"_id": 0}
    ).limit(limit).to_list(limit)
    
    return results


@router.post("/knowledge/query-rag")
async def query_knowledge_rag(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """RAG query - find relevant knowledge and answer question"""
    db = get_db()
    
    query = request.get("query", "")
    categories = request.get("categories", [])
    
    if not query:
        raise HTTPException(status_code=400, detail="Query required")
    
    # Get relevant documents
    filter_query = {"userId": current_user["id"]}
    if categories:
        filter_query["category"] = {"$in": categories}
    
    docs = await db.knowledge_base.find(
        filter_query,
        {"_id": 0}
    ).limit(10).to_list(10)
    
    if not docs:
        return {
            "answer": "I don't have any relevant information in the knowledge base yet. Upload some documents or let me learn from your activities.",
            "sources": []
        }
    
    # Build context from documents
    context_parts = []
    for doc in docs:
        content = doc.get("content", "")
        extracted = doc.get("extractedData", {})
        
        if extracted.get("summary"):
            context_parts.append(f"Document '{doc['name']}': {extracted['summary']}")
        elif content:
            context_parts.append(f"Document '{doc['name']}': {content[:500]}")
    
    context_str = "\n\n".join(context_parts)
    
    # Query AI with context
    rag_prompt = f"""Answer this question using the provided knowledge base context.
If the answer isn't in the context, say so.

KNOWLEDGE BASE CONTEXT:
{context_str}

USER QUESTION: {query}

Provide a helpful, accurate answer based on the context. Cite which documents you used."""

    answer = ""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        llm = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"rag-{str(uuid4())[:8]}",
            system_message="You are a helpful sales knowledge assistant."
        )
        
        answer = await llm.send_message(UserMessage(text=rag_prompt))
    except Exception as e:
        answer = f"Error querying knowledge base: {e}"
    
    return {
        "answer": answer,
        "sources": [{"id": d["id"], "name": d["name"], "category": d["category"]} for d in docs],
        "documentsSearched": len(docs)
    }


# ============== CONVERSATION HISTORY ==============

@router.get("/sessions/list")
async def list_conversation_sessions(
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get list of conversation sessions with preview"""
    db = get_db()
    
    sessions = await db.ai_sessions.find(
        {"userId": current_user["id"]},
        {"_id": 0}
    ).sort("updatedAt", -1).limit(limit).to_list(limit)
    
    # Format for display
    formatted = []
    for session in sessions:
        messages = session.get("messages", [])
        
        # Get first user message as title
        first_user_msg = next(
            (m for m in messages if m.get("role") == "user"),
            {"content": "New conversation"}
        )
        
        # Get last message for preview
        last_msg = messages[-1] if messages else {"content": "", "role": "assistant"}
        
        formatted.append({
            "id": session.get("id"),
            "title": first_user_msg.get("content", "")[:50] + ("..." if len(first_user_msg.get("content", "")) > 50 else ""),
            "preview": last_msg.get("content", "")[:100],
            "messageCount": len(messages),
            "createdAt": session.get("createdAt"),
            "updatedAt": session.get("updatedAt")
        })
    
    return formatted


@router.get("/session/{session_id}/messages")
async def get_session_messages(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all messages from a session"""
    db = get_db()
    
    session = await db.ai_sessions.find_one(
        {"id": session_id, "userId": current_user["id"]},
        {"_id": 0}
    )
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return {
        "sessionId": session_id,
        "messages": session.get("messages", []),
        "createdAt": session.get("createdAt"),
        "updatedAt": session.get("updatedAt")
    }


@router.delete("/session/{session_id}")
async def delete_session(
    session_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a conversation session"""
    db = get_db()
    
    result = await db.ai_sessions.delete_one(
        {"id": session_id, "userId": current_user["id"]}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return {"success": True, "message": "Session deleted"}


@router.post("/session/new")
async def create_new_session(
    current_user: dict = Depends(get_current_user)
):
    """Create a new conversation session"""
    db = get_db()
    
    session_id = str(uuid4())
    session = {
        "id": session_id,
        "userId": current_user["id"],
        "messages": [],
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "updatedAt": datetime.now(timezone.utc).isoformat()
    }
    
    await db.ai_sessions.insert_one(session)
    
    return {"success": True, "sessionId": session_id}


# ============== WORKFLOW & APPROVAL INTEGRATION ==============

@router.post("/create-workflow")
async def ai_create_workflow(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """AI-powered workflow creation from natural language"""
    db = get_db()
    
    description = request.get("description", "")
    name = request.get("name", "")
    
    if not description:
        raise HTTPException(status_code=400, detail="Description required")
    
    # Use AI to generate workflow structure
    prompt = f"""Create a sales workflow based on this description:

DESCRIPTION: {description}

Design a workflow with:
- Appropriate trigger
- Logical sequence of steps
- Wait times where needed
- Approval points for important actions
- Branch conditions if applicable

Return JSON:
{{
    "name": "Workflow name",
    "description": "Brief description",
    "trigger": {{"type": "manual|schedule|event", "config": {{}}}},
    "nodes": [
        {{"id": "node_1", "type": "trigger|email|wait|approval|branch|action|end", "label": "Display label", "config": {{}}}}
    ],
    "edges": [
        {{"source": "node_1", "target": "node_2"}}
    ],
    "approvalPoints": ["node_ids that need approval"],
    "estimatedDuration": "X days"
}}"""
    
    workflow_data = None
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        llm = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"workflow-{str(uuid4())[:8]}",
            system_message="You are a sales workflow design expert."
        )
        
        response = await llm.send_message(UserMessage(text=prompt))
        if response:
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                workflow_data = json.loads(json_match.group())
    except Exception as e:
        print(f"Workflow generation error: {e}")
    
    if not workflow_data:
        workflow_data = {
            "name": name or "Generated Workflow",
            "description": description,
            "nodes": [
                {"id": "1", "type": "trigger", "label": "Start"},
                {"id": "2", "type": "action", "label": "Process"},
                {"id": "3", "type": "end", "label": "End"}
            ],
            "edges": [{"source": "1", "target": "2"}, {"source": "2", "target": "3"}]
        }
    
    # Save workflow
    workflow = {
        "id": str(uuid4()),
        "userId": current_user["id"],
        "name": workflow_data.get("name", name or "AI Generated Workflow"),
        "description": workflow_data.get("description", description),
        "nodes": workflow_data.get("nodes", []),
        "edges": workflow_data.get("edges", []),
        "trigger": workflow_data.get("trigger", {"type": "manual"}),
        "approvalPoints": workflow_data.get("approvalPoints", []),
        "category": "ai_generated",
        "status": "draft",
        "aiGenerated": True,
        "createdAt": datetime.now(timezone.utc).isoformat()
    }
    
    await db.workflows.insert_one(workflow)
    
    return {
        "success": True,
        "workflow": {k: v for k, v in workflow.items() if k != "_id"},
        "message": f"Workflow '{workflow['name']}' created with {len(workflow['nodes'])} steps"
    }


@router.get("/pending-approvals-unified")
async def get_unified_pending_approvals(
    current_user: dict = Depends(get_current_user)
):
    """Get all pending approvals from various sources (plans, workflows, emails)"""
    db = get_db()
    
    # Get pending plans
    pending_plans = await db.pending_plans.find(
        {"userId": current_user["id"], "status": "pending_approval"},
        {"_id": 0}
    ).to_list(50)
    
    # Get pending workflow approvals
    pending_workflows = await db.approvals.find(
        {"userId": current_user["id"], "status": "pending"},
        {"_id": 0}
    ).to_list(50)
    
    # Get pending email drafts
    pending_emails = await db.email_drafts.find(
        {"userId": current_user["id"], "status": "pending_approval"},
        {"_id": 0}
    ).to_list(50)
    
    # Combine and format
    all_approvals = []
    
    for plan in pending_plans:
        all_approvals.append({
            "id": plan["id"],
            "type": "plan",
            "title": f"Plan: {plan.get('plan', {}).get('summary', 'Execution Plan')[:50]}",
            "description": plan.get("originalMessage", "")[:100],
            "content": plan.get("plan"),
            "createdAt": plan.get("createdAt"),
            "source": "ai_orchestration"
        })
    
    for approval in pending_workflows:
        all_approvals.append({
            "id": approval["id"],
            "type": approval.get("type", "workflow"),
            "title": approval.get("title", "Workflow Approval"),
            "description": approval.get("description", ""),
            "content": approval.get("content"),
            "context": approval.get("context"),
            "createdAt": approval.get("createdAt"),
            "source": "workflow"
        })
    
    for email in pending_emails:
        all_approvals.append({
            "id": email["id"],
            "type": "email",
            "title": f"Email: {email.get('subject', 'Draft')[:40]}",
            "description": f"To: {email.get('recipientEmail', 'Unknown')}",
            "content": {"subject": email.get("subject"), "body": email.get("body")},
            "createdAt": email.get("createdAt"),
            "source": "email_draft"
        })
    
    # Sort by creation date
    all_approvals.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
    
    return all_approvals


@router.post("/approve-item/{item_id}")
async def approve_unified_item(
    item_id: str,
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Approve any pending item (plan, workflow, email)"""
    db = get_db()
    
    item_type = request.get("type", "plan")
    action = request.get("action", "approve")  # approve or reject
    comment = request.get("comment", "")
    
    if item_type == "plan":
        if action == "approve":
            return await handle_plan_approval(item_id, current_user, db)
        else:
            return await handle_plan_rejection(item_id, current_user, db)
    
    elif item_type == "workflow" or item_type == "action" or item_type == "content":
        result = await db.approvals.update_one(
            {"id": item_id, "userId": current_user["id"]},
            {
                "$set": {
                    "status": "approved" if action == "approve" else "rejected",
                    "respondedAt": datetime.now(timezone.utc).isoformat(),
                    "comment": comment
                }
            }
        )
        return {"success": result.modified_count > 0, "action": action}
    
    elif item_type == "email":
        new_status = "approved" if action == "approve" else "rejected"
        result = await db.email_drafts.update_one(
            {"id": item_id, "userId": current_user["id"]},
            {
                "$set": {
                    "status": new_status,
                    "approvedAt" if action == "approve" else "rejectedAt": datetime.now(timezone.utc).isoformat(),
                    "approvalComment": comment
                }
            }
        )
        return {"success": result.modified_count > 0, "action": action}
    
    raise HTTPException(status_code=400, detail=f"Unknown item type: {item_type}")


# ============== DOCUMENT UPLOAD FOR KNOWLEDGE BASE ==============

@router.post("/knowledge/upload")
async def upload_knowledge_document(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Upload and process document for knowledge base (base64 encoded)"""
    db = get_db()
    
    content = request.get("content", "")  # Base64 or plain text
    filename = request.get("filename", "document.txt")
    name = request.get("name", filename)
    category = request.get("category", "general")
    description = request.get("description", "")
    content_type = request.get("contentType", "text/plain")
    
    if not content:
        raise HTTPException(status_code=400, detail="Content required")
    
    # Decode base64 if needed
    text_content = content
    file_size = len(content)
    file_ext = filename.split(".")[-1].lower() if "." in filename else "txt"
    
    if content_type != "text/plain" and "base64," in content:
        import base64
        try:
            # Extract base64 data
            base64_data = content.split("base64,")[1] if "base64," in content else content
            decoded = base64.b64decode(base64_data)
            file_size = len(decoded)
            
            # Handle different file types
            if file_ext == "pdf":
                # Parse PDF
                text_content = await parse_pdf_content(decoded)
            else:
                text_content = decoded.decode('utf-8', errors='ignore')
        except Exception as e:
            print(f"Decode error: {e}")
            text_content = content
    elif file_ext == "pdf" and not content.startswith("data:"):
        # Raw base64 PDF without data URI prefix
        import base64
        try:
            decoded = base64.b64decode(content)
            file_size = len(decoded)
            text_content = await parse_pdf_content(decoded)
        except:
            text_content = content
    
    # Use AI to extract key information
    extract_prompt = f"""Extract key information from this document for a sales knowledge base:

DOCUMENT: {filename}
CONTENT:
{text_content[:5000]}

Extract:
- Summary
- Key facts and data points
- Companies, people, products mentioned
- Actionable insights
- Tags for categorization

Return JSON:
{{
    "summary": "Brief summary",
    "keyFacts": ["fact1", "fact2"],
    "entities": {{"companies": [], "people": [], "products": []}},
    "insights": ["insight1"],
    "tags": ["tag1", "tag2"]
}}"""
    
    extracted_data = {}
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        llm = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"extract-{str(uuid4())[:8]}",
            system_message="You are a document analysis expert."
        )
        
        response = await llm.send_message(UserMessage(text=extract_prompt))
        if response:
            json_match = re.search(r'\{.*\}', response, re.DOTALL)
            if json_match:
                extracted_data = json.loads(json_match.group())
    except Exception as e:
        print(f"Extraction error: {e}")
    
    # Save document
    doc = {
        "id": str(uuid4()),
        "userId": current_user["id"],
        "name": name,
        "filename": filename,
        "fileType": file_ext,
        "fileSize": file_size,
        "category": category,
        "description": description,
        "content": text_content[:50000],  # Limit stored content
        "extractedData": extracted_data,
        "status": "processed",
        "createdAt": datetime.now(timezone.utc).isoformat()
    }
    
    await db.knowledge_base.insert_one(doc)
    
    return {
        "success": True,
        "documentId": doc["id"],
        "name": name,
        "fileType": file_ext,
        "extractedData": extracted_data,
        "message": f"Document '{name}' processed and added to knowledge base"
    }


async def parse_pdf_content(pdf_bytes: bytes) -> str:
    """Parse PDF content and extract text"""
    try:
        import io
        
        # Try PyPDF2 first
        try:
            from PyPDF2 import PdfReader
            
            pdf_file = io.BytesIO(pdf_bytes)
            reader = PdfReader(pdf_file)
            
            text_parts = []
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
            
            return "\n\n".join(text_parts)
        except ImportError:
            pass
        
        # Fallback: try pdfplumber
        try:
            import pdfplumber
            
            pdf_file = io.BytesIO(pdf_bytes)
            text_parts = []
            
            with pdfplumber.open(pdf_file) as pdf:
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text_parts.append(page_text)
            
            return "\n\n".join(text_parts)
        except ImportError:
            pass
        
        # If no PDF library available, return message
        return "[PDF content - install PyPDF2 or pdfplumber for text extraction]"
        
    except Exception as e:
        print(f"PDF parsing error: {e}")
        return f"[PDF parsing error: {e}]"


# ============== VOICE INPUT TRANSCRIPTION ==============

@router.post("/voice/transcribe")
async def transcribe_voice_input(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    Transcribe voice input to text using OpenAI Whisper.
    Accepts base64 encoded audio data.
    """
    db = get_db()
    
    audio_data = request.get("audio", "")  # Base64 encoded audio
    audio_format = request.get("format", "webm")  # webm, wav, mp3, etc.
    
    if not audio_data:
        raise HTTPException(status_code=400, detail="Audio data required")
    
    try:
        import base64
        import tempfile
        from emergentintegrations.llm.openai import OpenAISpeechToText
        
        # Decode base64 audio
        if "base64," in audio_data:
            audio_data = audio_data.split("base64,")[1]
        
        audio_bytes = base64.b64decode(audio_data)
        
        # Check file size (25MB limit)
        if len(audio_bytes) > 25 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Audio file too large (max 25MB)")
        
        # Create temporary file for the audio
        with tempfile.NamedTemporaryFile(suffix=f".{audio_format}", delete=False) as temp_file:
            temp_file.write(audio_bytes)
            temp_path = temp_file.name
        
        try:
            # Initialize Whisper STT
            stt = OpenAISpeechToText(api_key=EMERGENT_LLM_KEY)
            
            # Transcribe
            with open(temp_path, "rb") as audio_file:
                response = await stt.transcribe(
                    file=audio_file,
                    model="whisper-1",
                    response_format="json",
                    language="en"
                )
            
            transcription = response.text if hasattr(response, 'text') else str(response)
            
            # Log transcription
            await db.voice_transcriptions.insert_one({
                "id": str(uuid4()),
                "userId": current_user["id"],
                "transcription": transcription,
                "audioFormat": audio_format,
                "audioSize": len(audio_bytes),
                "createdAt": datetime.now(timezone.utc).isoformat()
            })
            
            return {
                "success": True,
                "transcription": transcription,
                "format": audio_format
            }
            
        finally:
            # Clean up temp file
            import os as os_module
            if os_module.path.exists(temp_path):
                os_module.unlink(temp_path)
                
    except ImportError:
        return {
            "success": False,
            "transcription": "",
            "message": "Speech-to-text integration not available. Install emergentintegrations.",
            "placeholder": True
        }
    except Exception as e:
        print(f"Transcription error: {e}")
        return {
            "success": False,
            "transcription": "",
            "error": str(e)
        }


@router.get("/stats")
async def get_ai_stats(
    current_user: dict = Depends(get_current_user)
):
    """Get AI usage statistics for the user"""
    db = get_db()
    
    # Count various metrics
    sessions_count = await db.ai_sessions.count_documents({"userId": current_user["id"]})
    plans_count = await db.pending_plans.count_documents({"userId": current_user["id"]})
    completed_plans = await db.pending_plans.count_documents({"userId": current_user["id"], "status": "completed"})
    knowledge_docs = await db.knowledge_base.count_documents({"userId": current_user["id"]})
    learnings_count = await db.agent_learnings.count_documents({"userId": current_user["id"]})
    
    return {
        "sessions": sessions_count,
        "totalPlans": plans_count,
        "completedPlans": completed_plans,
        "knowledgeDocuments": knowledge_docs,
        "agentLearnings": learnings_count,
        "successRate": round((completed_plans / plans_count * 100) if plans_count > 0 else 0, 1)
    }

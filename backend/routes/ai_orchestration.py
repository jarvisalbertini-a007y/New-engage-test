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
    """Execute an approved plan using the agent framework"""
    
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
        
        # Get and execute agent
        agent = registry.get_agent(agent_id)
        if not agent:
            agent = registry.get_agent("orchestrator")
        
        try:
            step_result = await agent.execute(task, context)
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

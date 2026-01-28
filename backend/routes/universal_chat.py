"""Universal Chat - NLP-first command center with agent orchestration"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from datetime import datetime, timezone
from uuid import uuid4
from typing import Optional, List, Dict, Any
import os
import json
import httpx

from database import get_db
from routes.auth import get_current_user

router = APIRouter()

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

async def call_gemini(prompt: str, system_instruction: str = None) -> str:
    """Call Gemini API via Emergent integrations"""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        session_id = f"chat-{str(uuid4())[:8]}"
        system_msg = system_instruction or "You are a helpful AI sales assistant."
        
        llm = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=session_id,
            system_message=system_msg
        )
        response = await llm.send_message(UserMessage(text=prompt))
        return response
    except Exception as e:
        print(f"Gemini API error: {e}")
        return None

# Intent classification for NLP commands
INTENT_PATTERNS = {
    "prospect_search": ["find", "search", "prospect", "leads", "companies", "contacts"],
    "create_agent": ["create agent", "build agent", "make agent", "new agent"],
    "execute_agent": ["run", "execute", "start", "launch", "deploy"],
    "create_workflow": ["create workflow", "build workflow", "automate", "sequence"],
    "generate_content": ["write", "draft", "compose", "email", "message", "script"],
    "research": ["research", "analyze", "investigate", "learn about"],
    "configure": ["update", "change", "modify", "configure", "set"],
    "status": ["status", "show", "list", "what", "how many"],
    "approve": ["approve", "confirm", "yes", "go ahead", "proceed"],
    "reject": ["reject", "no", "cancel", "stop", "deny"]
}

def classify_intent(message: str) -> tuple:
    """Classify user intent from natural language"""
    message_lower = message.lower()
    for intent, keywords in INTENT_PATTERNS.items():
        for keyword in keywords:
            if keyword in message_lower:
                return intent, keyword
    return "general", None

@router.post("/message")
async def process_message(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Process natural language message and execute actions"""
    message = request.get("message", "")
    context = request.get("context", {})
    session_id = request.get("sessionId", str(uuid4()))
    
    if not message:
        raise HTTPException(status_code=400, detail="Message is required")
    
    db = get_db()
    
    # Classify intent
    intent, trigger_keyword = classify_intent(message)
    
    # Build context-aware prompt for Gemini
    system_prompt = """You are an AI sales assistant for SalesFlow AI, an autonomous sales engagement platform.
You help users with:
- Finding and qualifying prospects
- Creating and deploying AI agents
- Building automated workflows
- Generating personalized content
- Researching companies and contacts

Respond concisely and actionably. When the user wants to take an action, provide structured JSON in your response.
Always be proactive - suggest next steps and related actions.

For actions, include a JSON block like:
```json
{"action": "action_type", "params": {...}}
```
"""
    
    # Add user context
    user_context = f"""User: {current_user.get('firstName', '')} {current_user.get('lastName', '')}
Company: {current_user.get('companyName', 'Unknown')}
Current intent: {intent}
"""
    
    # Call Gemini for intelligent response
    ai_response = await call_gemini(
        prompt=f"{user_context}\n\nUser message: {message}",
        system_instruction=system_prompt
    )
    
    # Fallback if Gemini fails
    if not ai_response:
        ai_response = generate_fallback_response(intent, message, context)
    
    # Parse any actions from response
    actions = parse_actions(ai_response)
    
    # Execute immediate actions if any - NOW ACTUALLY DOES THINGS
    executed_actions = []
    for action in actions:
        result = await execute_action(action, current_user, db)
        if result:
            executed_actions.append(result)
    
    # If no explicit actions but intent requires execution, execute based on intent
    if not executed_actions and intent in ["prospect_search", "research", "generate_content"]:
        auto_action = await auto_execute_intent(intent, message, current_user, db)
        if auto_action:
            executed_actions.append(auto_action)
    
    # Generate suggestions based on context
    suggestions = generate_suggestions(intent, context)
    
    # Save conversation to session
    conversation_entry = {
        "id": str(uuid4()),
        "sessionId": session_id,
        "userId": current_user["id"],
        "userMessage": message,
        "intent": intent,
        "aiResponse": ai_response,
        "actions": executed_actions,
        "createdAt": datetime.now(timezone.utc).isoformat()
    }
    await db.chat_sessions.insert_one(conversation_entry)
    
    return {
        "response": ai_response,
        "intent": intent,
        "actions": executed_actions,
        "suggestions": suggestions,
        "sessionId": session_id,
        "agentThinking": len(actions) > 0
    }

def generate_fallback_response(intent: str, message: str, context: dict) -> str:
    """Generate fallback response when LLM is unavailable"""
    responses = {
        "prospect_search": "I'll search for prospects matching your criteria. Let me analyze your request and find the best matches from our database.",
        "create_agent": "I'll help you create a new AI agent. What specific task should this agent handle? (e.g., lead qualification, email outreach, company research)",
        "execute_agent": "I'm initiating the agent execution. You'll see real-time progress in the activity feed.",
        "create_workflow": "Let's build an automated workflow. Describe the sequence of steps you want to automate.",
        "generate_content": "I'll draft that content for you. Give me a moment to personalize it based on your ICP and messaging guidelines.",
        "research": "I'll research that for you. I'll analyze company data, recent news, tech stack, and relevant signals.",
        "configure": "I'll update those settings. What specific changes would you like to make?",
        "status": "Here's your current status. I'll pull the latest metrics and active campaigns.",
        "approve": "Approved! I'm executing the action now.",
        "reject": "Understood, I've cancelled that action. What would you like to do instead?",
        "general": "I understand. How can I help you with your sales engagement today?"
    }
    return responses.get(intent, responses["general"])

def parse_actions(response: str) -> List[dict]:
    """Parse action blocks from AI response"""
    actions = []
    try:
        # Look for JSON blocks in response
        import re
        json_matches = re.findall(r'```json\s*({.*?})\s*```', response, re.DOTALL)
        for match in json_matches:
            try:
                action = json.loads(match)
                if "action" in action:
                    actions.append(action)
            except:
                pass
    except:
        pass
    return actions

async def execute_action(action: dict, user: dict, db) -> dict:
    """Execute a parsed action - NOW USES REAL EXECUTION ENGINE"""
    action_type = action.get("action")
    params = action.get("params", {})
    
    result = {
        "action": action_type,
        "status": "executed",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    # Import execution engine functions
    from routes.execution_engine import (
        action_find_prospects, action_research_company, 
        action_draft_email, action_score_prospect,
        action_create_sequence, action_send_email
    )
    
    try:
        if action_type == "find_prospects":
            exec_result = await action_find_prospects(params, user, db)
            result["data"] = exec_result
            result["message"] = f"Found {exec_result.get('prospectsFound', 0)} prospects"
            
        elif action_type == "research_company":
            exec_result = await action_research_company(params, user, db)
            result["data"] = exec_result
            result["message"] = f"Researched {params.get('company', 'company')}"
            
        elif action_type == "draft_email":
            exec_result = await action_draft_email(params, user, db)
            result["data"] = exec_result
            result["message"] = f"Drafted email: {exec_result.get('subject', 'Email drafted')}"
            
        elif action_type == "score_prospect":
            exec_result = await action_score_prospect(params, user, db)
            result["data"] = exec_result
            result["message"] = f"Scored prospect: {exec_result.get('score', 0)}/100"
            
        elif action_type == "create_sequence":
            exec_result = await action_create_sequence(params, user, db)
            result["data"] = exec_result
            result["message"] = f"Created sequence: {exec_result.get('name', 'New sequence')}"
            
        elif action_type == "send_email":
            exec_result = await action_send_email(params, user, db)
            result["data"] = exec_result
            result["message"] = "Email sent successfully"
            
        elif action_type == "create_agent":
            agent = {
                "id": str(uuid4()),
                "userId": user["id"],
                "name": params.get("name", "New Agent"),
                "category": params.get("category", "general"),
                "description": params.get("description", ""),
                "status": "active",
                "createdAt": datetime.now(timezone.utc).isoformat()
            }
            await db.agents.insert_one(agent)
            result["agentId"] = agent["id"]
            result["message"] = f"Created agent: {agent['name']}"
            
        elif action_type == "create_workflow":
            workflow = {
                "id": str(uuid4()),
                "userId": user["id"],
                "name": params.get("name", "New Workflow"),
                "status": "draft",
                "nodes": params.get("nodes", []),
                "edges": params.get("edges", []),
                "createdAt": datetime.now(timezone.utc).isoformat()
            }
            await db.workflows.insert_one(workflow)
            result["workflowId"] = workflow["id"]
            result["message"] = f"Created workflow: {workflow['name']}"
            
        else:
            result["message"] = f"Action '{action_type}' acknowledged"
            
    except Exception as e:
        result["status"] = "error"
        result["message"] = str(e)
        
    return result


async def auto_execute_intent(intent: str, message: str, user: dict, db) -> dict:
    """Automatically execute based on detected intent"""
    from routes.execution_engine import (
        action_find_prospects, action_research_company, action_draft_email
    )
    
    result = None
    
    try:
        if intent == "prospect_search":
            # Extract count and criteria from message
            import re
            count_match = re.search(r'(\d+)', message)
            count = int(count_match.group(1)) if count_match else 10
            
            exec_result = await action_find_prospects(
                {"criteria": message, "count": min(count, 50)},
                user, db
            )
            result = {
                "action": "find_prospects",
                "status": "executed",
                "message": f"✅ Found {exec_result.get('prospectsFound', 0)} prospects matching your criteria",
                "data": exec_result,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            
        elif intent == "research":
            # Extract company name from message
            import re
            company_match = re.search(r'(?:research|about|analyze)\\s+([A-Z][\\w\\s]+?)(?:\\s+before|\\s+for|$)', message, re.I)
            company = company_match.group(1).strip() if company_match else message.split()[-1]
            
            exec_result = await action_research_company(
                {"company": company},
                user, db
            )
            result = {
                "action": "research_company",
                "status": "executed",
                "message": f"✅ Researched {company}",
                "data": exec_result,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            
        elif intent == "generate_content":
            # Get recent prospect for personalization
            prospect = await db.prospects.find_one(
                {"userId": user["id"]},
                {"_id": 0}
            )
            
            exec_result = await action_draft_email(
                {"prospect": prospect or {}, "type": "cold_intro"},
                user, db
            )
            result = {
                "action": "draft_email",
                "status": "executed",
                "message": f"✅ Drafted email: {exec_result.get('subject', 'New email')}",
                "data": exec_result,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            
    except Exception as e:
        result = {
            "action": intent,
            "status": "error",
            "message": str(e),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    
    return result

def generate_suggestions(intent: str, context: dict) -> List[dict]:
    """Generate contextual suggestions"""
    suggestions_map = {
        "prospect_search": [
            {"text": "Add these to a sequence", "action": "create_workflow"},
            {"text": "Research top 5 companies", "action": "research"},
            {"text": "Score against ICP", "action": "execute_agent"}
        ],
        "create_agent": [
            {"text": "Test agent with sample data", "action": "execute_agent"},
            {"text": "Add to workflow", "action": "create_workflow"},
            {"text": "Configure triggers", "action": "configure"}
        ],
        "generate_content": [
            {"text": "A/B test this version", "action": "create_workflow"},
            {"text": "Generate LinkedIn version", "action": "generate_content"},
            {"text": "Schedule send", "action": "execute_agent"}
        ],
        "general": [
            {"text": "Find new prospects", "action": "prospect_search"},
            {"text": "Create outreach sequence", "action": "create_workflow"},
            {"text": "Check pipeline status", "action": "status"}
        ]
    }
    return suggestions_map.get(intent, suggestions_map["general"])

@router.get("/sessions")
async def get_chat_sessions(
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get user's chat sessions"""
    db = get_db()
    sessions = await db.chat_sessions.find(
        {"userId": current_user["id"]},
        {"_id": 0}
    ).sort("createdAt", -1).limit(limit).to_list(limit)
    return sessions

@router.post("/agents/select")
async def select_agent_from_chat(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Select and configure an agent directly from chat"""
    agent_type = request.get("agentType")
    task_description = request.get("task", "")
    
    db = get_db()
    
    # Find matching agent template
    template = await db.agent_templates.find_one(
        {"$or": [
            {"slug": {"$regex": agent_type, "$options": "i"}},
            {"name": {"$regex": agent_type, "$options": "i"}},
            {"tags": {"$regex": agent_type, "$options": "i"}}
        ]},
        {"_id": 0}
    )
    
    if not template:
        # Use AI to suggest best agent
        suggestion = await call_gemini(
            f"Based on this task: '{task_description}', suggest the best agent type from: prospecting, research, outreach, qualification, content, analysis",
            "Respond with just the agent category name."
        )
        return {
            "found": False,
            "suggestion": suggestion,
            "message": f"No exact match found. Suggested category: {suggestion}"
        }
    
    return {
        "found": True,
        "agent": template,
        "message": f"Found agent: {template['name']}"
    }

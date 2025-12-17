from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from uuid import uuid4
from typing import Optional
import os

from database import get_db
from routes.auth import get_current_user

router = APIRouter()

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

@router.post("/execute")
async def execute_command(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Execute a natural language command"""
    command = request.get("command", "")
    context = request.get("context", {})
    
    if not command:
        raise HTTPException(status_code=400, detail="Command is required")
    
    # TODO: Use Gemini to parse and execute command
    # For now, return mock response based on command patterns
    
    command_lower = command.lower()
    
    if "prospect" in command_lower or "find" in command_lower:
        response = {
            "action": "prospect_search",
            "message": "I'll search for prospects matching your criteria.",
            "suggestedAgents": ["linkedin-lead-finder", "icp-matcher"],
            "parameters": {
                "query": command
            }
        }
    elif "email" in command_lower or "write" in command_lower:
        response = {
            "action": "content_generation",
            "message": "I'll generate personalized email content.",
            "suggestedAgents": ["email-composer", "personalization-engine"],
            "parameters": {
                "type": "email",
                "context": command
            }
        }
    elif "workflow" in command_lower or "automate" in command_lower:
        response = {
            "action": "workflow_creation",
            "message": "I'll create a workflow based on your description.",
            "suggestedAgents": ["workflow-generator"],
            "parameters": {
                "description": command
            }
        }
    elif "research" in command_lower or "company" in command_lower:
        response = {
            "action": "company_research",
            "message": "I'll research the company and gather intelligence.",
            "suggestedAgents": ["company-research-agent", "technology-stack-analyzer"],
            "parameters": {
                "query": command
            }
        }
    elif "report" in command_lower or "analytics" in command_lower:
        response = {
            "action": "report_generation",
            "message": "I'll generate a report based on your data.",
            "suggestedAgents": ["analytics-agent", "performance-reporter"],
            "parameters": {
                "type": "performance"
            }
        }
    else:
        response = {
            "action": "general_assistance",
            "message": "I understand. Let me help you with that.",
            "suggestedAgents": [],
            "parameters": {
                "query": command
            }
        }
    
    # Log command
    db = get_db()
    await db.commands.insert_one({
        "id": str(uuid4()),
        "userId": current_user["id"],
        "command": command,
        "response": response,
        "createdAt": datetime.now(timezone.utc).isoformat()
    })
    
    return response

@router.get("/suggestions")
async def get_command_suggestions(current_user: dict = Depends(get_current_user)):
    """Get suggested commands based on user's context"""
    
    suggestions = [
        {
            "command": "Find 50 prospects in the tech industry",
            "description": "Search for new leads matching your ICP",
            "category": "prospecting"
        },
        {
            "command": "Write a follow-up email for cold leads",
            "description": "Generate personalized follow-up content",
            "category": "content"
        },
        {
            "command": "Create a 5-step outreach sequence",
            "description": "Build an automated outreach workflow",
            "category": "workflow"
        },
        {
            "command": "Research Acme Corp before my call",
            "description": "Get company intelligence and talking points",
            "category": "research"
        },
        {
            "command": "Show my pipeline performance this week",
            "description": "View analytics and metrics",
            "category": "analytics"
        }
    ]
    
    return suggestions

@router.get("/history")
async def get_command_history(
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get user's command history"""
    db = get_db()
    
    history = await db.commands.find(
        {"userId": current_user["id"]},
        {"_id": 0}
    ).sort("createdAt", -1).limit(limit).to_list(limit)
    
    return history

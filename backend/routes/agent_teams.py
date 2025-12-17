"""Agent Teams - Multi-agent orchestration with handoffs"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from uuid import uuid4
from typing import Optional, List
import os

from database import get_db
from routes.auth import get_current_user

router = APIRouter()

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

# Team templates for quick setup
TEAM_TEMPLATES = [
    {
        "id": "outbound-team",
        "name": "Outbound Sales Team",
        "description": "Full-stack outbound team with research, personalization, and outreach",
        "agents": [
            {"role": "Lead Researcher", "agentType": "research", "priority": 1},
            {"role": "ICP Scorer", "agentType": "qualification", "priority": 2},
            {"role": "Email Writer", "agentType": "content", "priority": 3},
            {"role": "Sequence Manager", "agentType": "outreach", "priority": 4}
        ]
    },
    {
        "id": "inbound-team",
        "name": "Inbound Response Team",
        "description": "Rapid response team for inbound leads",
        "agents": [
            {"role": "Intent Classifier", "agentType": "analysis", "priority": 1},
            {"role": "Lead Qualifier", "agentType": "qualification", "priority": 2},
            {"role": "Meeting Booker", "agentType": "scheduling", "priority": 3}
        ]
    },
    {
        "id": "nurture-team",
        "name": "Nurture Campaign Team",
        "description": "Long-term nurture with personalized content",
        "agents": [
            {"role": "Engagement Tracker", "agentType": "analysis", "priority": 1},
            {"role": "Content Recommender", "agentType": "content", "priority": 2},
            {"role": "Timing Optimizer", "agentType": "scheduling", "priority": 3}
        ]
    }
]

@router.get("/templates")
async def get_team_templates():
    """Get available team templates"""
    return TEAM_TEMPLATES

@router.get("")
async def get_agent_teams(
    status: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get user's agent teams"""
    db = get_db()
    
    query = {"userId": current_user["id"]}
    if status:
        query["status"] = status
    
    teams = await db.agent_teams.find(
        query,
        {"_id": 0}
    ).sort("createdAt", -1).to_list(50)
    
    return teams

@router.get("/{team_id}")
async def get_agent_team(
    team_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific agent team"""
    db = get_db()
    
    team = await db.agent_teams.find_one(
        {"id": team_id, "userId": current_user["id"]},
        {"_id": 0}
    )
    
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    return team

@router.post("")
async def create_agent_team(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Create a new agent team"""
    db = get_db()
    now = datetime.now(timezone.utc)
    
    # If creating from template
    template_id = request.get("templateId")
    if template_id:
        template = next((t for t in TEAM_TEMPLATES if t["id"] == template_id), None)
        if template:
            request["agents"] = [
                {
                    "id": str(uuid4()),
                    **agent,
                    "name": f"{request.get('name', template['name'])} - {agent['role']}"
                }
                for agent in template["agents"]
            ]
    
    team = {
        "id": str(uuid4()),
        "userId": current_user["id"],
        "name": request.get("name", "New Team"),
        "description": request.get("description", ""),
        "agents": request.get("agents", []),
        "handoffRules": request.get("handoffRules", []),
        "status": "draft",
        "metrics": {
            "totalExecutions": 0,
            "successfulHandoffs": 0,
            "avgExecutionTime": 0
        },
        "createdAt": now.isoformat(),
        "updatedAt": now.isoformat()
    }
    
    # Generate default handoff rules if not provided
    if not team["handoffRules"] and len(team["agents"]) > 1:
        rules = []
        sorted_agents = sorted(team["agents"], key=lambda a: a.get("priority", 0))
        for i in range(len(sorted_agents) - 1):
            rules.append({
                "id": str(uuid4()),
                "fromAgent": sorted_agents[i]["id"],
                "toAgent": sorted_agents[i + 1]["id"],
                "trigger": "completion",
                "condition": "success"
            })
        team["handoffRules"] = rules
    
    await db.agent_teams.insert_one(team)
    team.pop("_id", None)
    
    return team

@router.put("/{team_id}")
async def update_agent_team(
    team_id: str,
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Update an agent team"""
    db = get_db()
    
    updates = {k: v for k, v in request.items() 
               if k in ["name", "description", "agents", "handoffRules", "status"]}
    updates["updatedAt"] = datetime.now(timezone.utc).isoformat()
    
    result = await db.agent_teams.update_one(
        {"id": team_id, "userId": current_user["id"]},
        {"$set": updates}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Team not found")
    
    return {"success": True, "message": "Team updated"}

@router.delete("/{team_id}")
async def delete_agent_team(
    team_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete an agent team"""
    db = get_db()
    
    result = await db.agent_teams.delete_one(
        {"id": team_id, "userId": current_user["id"]}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Team not found")
    
    return {"success": True, "message": "Team deleted"}

@router.post("/{team_id}/activate")
async def activate_agent_team(
    team_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Activate an agent team"""
    db = get_db()
    
    await db.agent_teams.update_one(
        {"id": team_id, "userId": current_user["id"]},
        {"$set": {
            "status": "active",
            "updatedAt": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"success": True, "message": "Team activated"}

@router.post("/{team_id}/pause")
async def pause_agent_team(
    team_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Pause an agent team"""
    db = get_db()
    
    await db.agent_teams.update_one(
        {"id": team_id, "userId": current_user["id"]},
        {"$set": {
            "status": "paused",
            "updatedAt": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"success": True, "message": "Team paused"}

@router.post("/{team_id}/execute")
async def execute_agent_team(
    team_id: str,
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Execute an agent team with provided input"""
    db = get_db()
    
    team = await db.agent_teams.find_one(
        {"id": team_id, "userId": current_user["id"]}
    )
    
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    if team["status"] != "active":
        raise HTTPException(status_code=400, detail="Team is not active")
    
    # Create execution record
    execution = {
        "id": str(uuid4()),
        "teamId": team_id,
        "userId": current_user["id"],
        "input": request.get("input", {}),
        "status": "running",
        "currentAgent": team["agents"][0]["id"] if team["agents"] else None,
        "results": [],
        "startedAt": datetime.now(timezone.utc).isoformat(),
        "completedAt": None
    }
    
    await db.team_executions.insert_one(execution)
    execution.pop("_id", None)
    
    # In production, this would trigger async execution
    # For now, return the execution ID for tracking
    
    return {
        "success": True,
        "executionId": execution["id"],
        "message": "Team execution started",
        "team": team["name"]
    }

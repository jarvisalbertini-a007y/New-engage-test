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


@router.get("/{team_id}/executions")
async def get_team_executions(
    team_id: str,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get executions for a specific team"""
    db = get_db()
    
    executions = await db.team_executions.find(
        {"teamId": team_id, "userId": current_user["id"]},
        {"_id": 0}
    ).sort("startedAt", -1).limit(limit).to_list(limit)
    
    return executions


@router.get("/executions/all")
async def get_all_executions(
    status: Optional[str] = None,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    """Get all team executions"""
    db = get_db()
    
    query = {"userId": current_user["id"]}
    if status:
        query["status"] = status
    
    executions = await db.team_executions.find(
        query,
        {"_id": 0}
    ).sort("startedAt", -1).limit(limit).to_list(limit)
    
    return executions


@router.post("/{team_id}/execute-parallel")
async def execute_team_parallel(
    team_id: str,
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Execute all team agents in parallel"""
    db = get_db()
    import asyncio
    from core.agent_framework import AgentRegistry, AgentContext
    
    team = await db.agent_teams.find_one(
        {"id": team_id, "userId": current_user["id"]},
        {"_id": 0}
    )
    
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    task = request.get("task", "")
    prospect_ids = request.get("prospectIds", [])
    context = request.get("context", {})
    
    if not task:
        raise HTTPException(status_code=400, detail="Task is required")
    
    execution_id = str(uuid4())
    
    # Create execution record
    execution = {
        "id": execution_id,
        "teamId": team_id,
        "teamName": team["name"],
        "userId": current_user["id"],
        "task": task,
        "prospectIds": prospect_ids,
        "context": context,
        "executionMode": "parallel",
        "status": "running",
        "agentStatuses": {},
        "results": {},
        "startedAt": datetime.now(timezone.utc).isoformat()
    }
    
    # Get agent types from team
    agent_types = []
    for agent in team.get("agents", []):
        agent_type = agent.get("agentType", agent.get("type"))
        if agent_type:
            agent_types.append(agent_type)
            execution["agentStatuses"][agent_type] = "pending"
    
    await db.team_executions.insert_one(execution)
    
    # Execute agents in parallel
    registry = AgentRegistry()
    registry.set_db_for_all(db)
    
    agent_context = AgentContext(
        user_id=current_user["id"],
        session_id=f"team-{execution_id}",
        original_goal=task
    )
    
    async def run_agent(agent_type: str):
        try:
            await db.team_executions.update_one(
                {"id": execution_id},
                {"$set": {f"agentStatuses.{agent_type}": "running"}}
            )
            
            agent = registry.get_agent(agent_type)
            result = await agent.execute(task, agent_context)
            
            await db.team_executions.update_one(
                {"id": execution_id},
                {
                    "$set": {
                        f"agentStatuses.{agent_type}": "completed",
                        f"results.{agent_type}": result.get("result", {})
                    }
                }
            )
            
            return {"agent": agent_type, "result": result.get("result", {})}
        except Exception as e:
            await db.team_executions.update_one(
                {"id": execution_id},
                {
                    "$set": {
                        f"agentStatuses.{agent_type}": "failed",
                        f"results.{agent_type}": {"error": str(e)}
                    }
                }
            )
            return {"agent": agent_type, "error": str(e)}
    
    # Run all agents in parallel
    tasks = [run_agent(agent_type) for agent_type in agent_types]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Compile results
    final_results = {}
    for result in results:
        if isinstance(result, Exception):
            continue
        if isinstance(result, dict):
            agent = result.get("agent")
            if agent:
                final_results[agent] = result.get("result") or result.get("error")
    
    # Update execution as completed
    await db.team_executions.update_one(
        {"id": execution_id},
        {
            "$set": {
                "status": "completed",
                "results": final_results,
                "completedAt": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Update team metrics
    await db.agent_teams.update_one(
        {"id": team_id},
        {"$inc": {"metrics.totalExecutions": 1}}
    )
    
    return {
        "success": True,
        "executionId": execution_id,
        "teamId": team_id,
        "executionMode": "parallel",
        "agentsExecuted": agent_types,
        "results": final_results
    }


@router.get("/analytics/summary")
async def get_teams_analytics(
    current_user: dict = Depends(get_current_user)
):
    """Get team analytics summary"""
    db = get_db()
    
    total_teams = await db.agent_teams.count_documents({"userId": current_user["id"]})
    active_teams = await db.agent_teams.count_documents({
        "userId": current_user["id"],
        "status": "active"
    })
    total_executions = await db.team_executions.count_documents({"userId": current_user["id"]})
    completed_executions = await db.team_executions.count_documents({
        "userId": current_user["id"],
        "status": "completed"
    })
    
    # Top performing teams
    pipeline = [
        {"$match": {"userId": current_user["id"], "status": "completed"}},
        {"$group": {
            "_id": "$teamId",
            "teamName": {"$first": "$teamName"},
            "executions": {"$sum": 1}
        }},
        {"$sort": {"executions": -1}},
        {"$limit": 5}
    ]
    
    top_teams = await db.team_executions.aggregate(pipeline).to_list(5)
    
    return {
        "totalTeams": total_teams,
        "activeTeams": active_teams,
        "totalExecutions": total_executions,
        "completedExecutions": completed_executions,
        "successRate": round((completed_executions / max(total_executions, 1)) * 100, 1),
        "topTeams": [
            {"teamId": t["_id"], "teamName": t.get("teamName", "Unknown"), "executions": t["executions"]}
            for t in top_teams
        ]
    }


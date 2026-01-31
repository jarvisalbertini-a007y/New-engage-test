"""
Multi-Agent Architecture

This module implements a team of specialized AI agents that collaborate on complex sales tasks.
Each agent has specific expertise and can communicate with other agents.

Agent Types:
- Research Agent: Deep company and prospect research
- Outreach Agent: Email generation and personalization
- Optimization Agent: A/B testing and email optimization
- Intelligence Agent: Competitor analysis and market insights
- Coordinator Agent: Orchestrates multi-agent workflows

Inspired by AutoGPT (task decomposition) and MoltBot (multi-agent coordination).
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from typing import Optional, List, Dict, Any
import os
import json
import re
import asyncio

from database import get_db
from routes.auth import get_current_user

router = APIRouter()

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")


# ============== AGENT DEFINITIONS ==============

AGENT_TYPES = {
    "research": {
        "name": "Research Agent",
        "description": "Specializes in deep company research, prospect profiling, and data enrichment",
        "capabilities": [
            "company_research",
            "prospect_profiling", 
            "industry_analysis",
            "tech_stack_detection",
            "funding_tracking",
            "news_monitoring"
        ],
        "systemPrompt": """You are a specialized B2B Research Agent. Your expertise is in:
- Deep company research and analysis
- Prospect profiling and persona development
- Industry trends and competitive landscape
- Technology stack detection
- Finding buying signals and triggers

Always provide structured, actionable insights.""",
        "icon": "search",
        "color": "#3B82F6"
    },
    "outreach": {
        "name": "Outreach Agent",
        "description": "Expert in personalized email generation, follow-up sequences, and engagement",
        "capabilities": [
            "email_generation",
            "personalization",
            "sequence_creation",
            "follow_up_timing",
            "cta_optimization"
        ],
        "systemPrompt": """You are a specialized B2B Outreach Agent. Your expertise is in:
- Crafting highly personalized cold emails
- Creating effective follow-up sequences
- Timing optimization for maximum engagement
- Strong call-to-action development
- A/B test copywriting

Always write concise, value-driven emails.""",
        "icon": "mail",
        "color": "#10B981"
    },
    "optimization": {
        "name": "Optimization Agent",
        "description": "Focuses on email performance optimization, A/B testing, and conversion improvement",
        "capabilities": [
            "email_analysis",
            "ab_testing",
            "performance_tracking",
            "conversion_optimization",
            "subject_line_testing"
        ],
        "systemPrompt": """You are a specialized Email Optimization Agent. Your expertise is in:
- Analyzing email performance metrics
- Designing effective A/B tests
- Identifying patterns in successful emails
- Optimizing subject lines and CTAs
- Improving open and reply rates

Always base recommendations on data.""",
        "icon": "trending-up",
        "color": "#F59E0B"
    },
    "intelligence": {
        "name": "Intelligence Agent",
        "description": "Gathers competitive intelligence, market insights, and strategic recommendations",
        "capabilities": [
            "competitor_analysis",
            "market_research",
            "trend_detection",
            "strategic_planning",
            "opportunity_identification"
        ],
        "systemPrompt": """You are a specialized Market Intelligence Agent. Your expertise is in:
- Competitive analysis and positioning
- Market trend identification
- Strategic opportunity discovery
- Industry benchmarking
- Sales strategy recommendations

Always provide actionable intelligence.""",
        "icon": "brain",
        "color": "#8B5CF6"
    },
    "coordinator": {
        "name": "Coordinator Agent",
        "description": "Orchestrates multi-agent workflows and ensures seamless collaboration",
        "capabilities": [
            "task_delegation",
            "workflow_management",
            "result_synthesis",
            "quality_control",
            "priority_management"
        ],
        "systemPrompt": """You are the Coordinator Agent responsible for orchestrating complex sales tasks.
Your role is to:
- Break down complex goals into subtasks
- Delegate tasks to appropriate specialist agents
- Synthesize results from multiple agents
- Ensure quality and consistency
- Manage priorities and timelines

Always think strategically about task delegation.""",
        "icon": "users",
        "color": "#EC4899"
    }
}


# ============== AI HELPER ==============

async def call_agent_ai(agent_type: str, prompt: str, context: Dict = None) -> str:
    """Call AI with agent-specific system prompt"""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        agent = AGENT_TYPES.get(agent_type, AGENT_TYPES["coordinator"])
        session_id = f"agent-{agent_type}-{str(uuid4())[:8]}"
        
        # Add context to system prompt
        system_msg = agent["systemPrompt"]
        if context:
            system_msg += f"\n\nContext:\n{json.dumps(context, indent=2)}"
        
        llm = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=session_id,
            system_message=system_msg
        )
        
        response = await llm.send_message(UserMessage(text=prompt))
        return response
    except Exception as e:
        print(f"Agent AI call error: {e}")
        return None


# ============== MULTI-AGENT TASK EXECUTION ==============

class MultiAgentTask:
    """Represents a task that requires multiple agent collaboration"""
    
    def __init__(self, task_id: str, goal: str, user_id: str, db):
        self.task_id = task_id
        self.goal = goal
        self.user_id = user_id
        self.db = db
        self.subtasks = []
        self.results = {}
        self.status = "pending"
    
    async def decompose(self) -> List[Dict]:
        """Break down the goal into agent-specific subtasks"""
        
        prompt = f"""Decompose this sales goal into subtasks for specialized agents.

GOAL: {self.goal}

AVAILABLE AGENTS:
{json.dumps({k: {"name": v["name"], "capabilities": v["capabilities"]} for k, v in AGENT_TYPES.items()}, indent=2)}

Break this goal into 2-5 specific subtasks. For each subtask, specify:
1. Which agent should handle it
2. What exactly they need to do
3. What inputs they need
4. What outputs they should produce
5. Dependencies on other subtasks (if any)

Return JSON with:
- subtasks: Array of {{
    id: unique subtask ID,
    agentType: one of the agent types,
    description: what to do,
    inputs: what the agent needs,
    expectedOutputs: what to produce,
    dependencies: array of subtask IDs this depends on,
    priority: 1-5 (1 is highest)
}}"""

        result = await call_agent_ai("coordinator", prompt)
        
        if result:
            try:
                json_match = re.search(r'\{.*\}', result, re.DOTALL)
                if json_match:
                    data = json.loads(json_match.group())
                    self.subtasks = data.get("subtasks", [])
                    return self.subtasks
            except (json.JSONDecodeError, ValueError):
                pass
        
        return []
    
    async def execute_subtask(self, subtask: Dict) -> Dict:
        """Execute a single subtask with the appropriate agent"""
        
        agent_type = subtask.get("agentType", "coordinator")
        description = subtask.get("description", "")
        inputs = subtask.get("inputs", {})
        
        # Gather inputs from dependent tasks
        for dep_id in subtask.get("dependencies", []):
            if dep_id in self.results:
                inputs[f"from_{dep_id}"] = self.results[dep_id]
        
        prompt = f"""Execute this subtask:

TASK: {description}

INPUTS:
{json.dumps(inputs, indent=2)}

EXPECTED OUTPUTS:
{json.dumps(subtask.get("expectedOutputs", []), indent=2)}

Complete this task and return structured results."""

        result = await call_agent_ai(agent_type, prompt)
        
        subtask_result = {
            "subtaskId": subtask.get("id"),
            "agentType": agent_type,
            "status": "complete" if result else "failed",
            "output": result,
            "completedAt": datetime.now(timezone.utc).isoformat()
        }
        
        # Try to parse structured output
        if result:
            try:
                json_match = re.search(r'\{.*\}', result, re.DOTALL)
                if json_match:
                    subtask_result["structuredOutput"] = json.loads(json_match.group())
            except (json.JSONDecodeError, ValueError):
                subtask_result["structuredOutput"] = {"rawOutput": result}
        
        return subtask_result
    
    async def execute_all(self) -> Dict:
        """Execute all subtasks in dependency order"""
        
        self.status = "running"
        completed = set()
        execution_order = []
        
        # Sort by priority and dependencies
        remaining = list(self.subtasks)
        while remaining:
            # Find tasks with satisfied dependencies
            ready = [
                t for t in remaining
                if all(dep in completed for dep in t.get("dependencies", []))
            ]
            
            if not ready:
                # No tasks ready, break potential deadlock
                ready = [remaining[0]]
            
            # Sort ready tasks by priority
            ready.sort(key=lambda x: x.get("priority", 3))
            
            # Execute highest priority ready task
            task = ready[0]
            remaining.remove(task)
            
            result = await self.execute_subtask(task)
            self.results[task["id"]] = result
            completed.add(task["id"])
            execution_order.append(task["id"])
        
        self.status = "complete"
        return {
            "taskId": self.task_id,
            "status": self.status,
            "executionOrder": execution_order,
            "results": self.results
        }
    
    async def synthesize_results(self) -> Dict:
        """Combine results from all subtasks into final output"""
        
        prompt = f"""Synthesize these results from multiple agents into a coherent final output.

ORIGINAL GOAL: {self.goal}

AGENT RESULTS:
{json.dumps(self.results, indent=2)}

Create a comprehensive summary that:
1. Addresses the original goal
2. Incorporates insights from all agents
3. Provides actionable recommendations
4. Highlights key findings

Return JSON with:
- summary: Overall summary
- keyFindings: Array of key findings
- recommendations: Array of actionable recommendations
- nextSteps: Suggested next steps
- confidence: 0-100 confidence score"""

        result = await call_agent_ai("coordinator", prompt)
        
        if result:
            try:
                json_match = re.search(r'\{.*\}', result, re.DOTALL)
                if json_match:
                    return json.loads(json_match.group())
            except (json.JSONDecodeError, ValueError):
                return {"summary": result}
        
        return {"summary": "Synthesis failed"}


# ============== API ENDPOINTS ==============

@router.get("/types")
async def get_agent_types():
    """Get all available agent types"""
    return [
        {"id": key, **{k: v for k, v in value.items() if k != "systemPrompt"}}
        for key, value in AGENT_TYPES.items()
    ]


@router.post("/execute-single")
async def execute_single_agent(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Execute a task with a single agent"""
    db = get_db()
    
    agent_type = request.get("agentType", "coordinator")
    task = request.get("task", "")
    context = request.get("context", {})
    
    if not task:
        raise HTTPException(status_code=400, detail="Task description required")
    
    if agent_type not in AGENT_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid agent type: {agent_type}")
    
    # Execute with agent
    result = await call_agent_ai(agent_type, task, context)
    
    # Log execution
    execution = {
        "id": str(uuid4()),
        "userId": current_user["id"],
        "agentType": agent_type,
        "task": task,
        "context": context,
        "result": result,
        "createdAt": datetime.now(timezone.utc).isoformat()
    }
    await db.agent_executions.insert_one(execution)
    
    # Try to parse structured result
    structured = None
    if result:
        try:
            json_match = re.search(r'\{.*\}', result, re.DOTALL)
            if json_match:
                structured = json.loads(json_match.group())
        except (json.JSONDecodeError, ValueError):
            pass
    
    return {
        "success": True,
        "executionId": execution["id"],
        "agentType": agent_type,
        "agentName": AGENT_TYPES[agent_type]["name"],
        "result": result,
        "structuredResult": structured
    }


@router.post("/execute-multi")
async def execute_multi_agent_task(
    request: dict,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Execute a complex task using multiple collaborating agents"""
    db = get_db()
    
    goal = request.get("goal", "")
    run_async = request.get("async", True)
    
    if not goal:
        raise HTTPException(status_code=400, detail="Goal description required")
    
    task_id = str(uuid4())
    
    # Create task record
    task_record = {
        "id": task_id,
        "userId": current_user["id"],
        "goal": goal,
        "status": "pending",
        "subtasks": [],
        "results": {},
        "synthesis": None,
        "createdAt": datetime.now(timezone.utc).isoformat()
    }
    await db.multi_agent_tasks.insert_one(task_record)
    
    async def run_multi_agent():
        """Background task runner"""
        task = MultiAgentTask(task_id, goal, current_user["id"], db)
        
        # Update status
        await db.multi_agent_tasks.update_one(
            {"id": task_id},
            {"$set": {"status": "decomposing"}}
        )
        
        # Decompose goal
        subtasks = await task.decompose()
        await db.multi_agent_tasks.update_one(
            {"id": task_id},
            {"$set": {"subtasks": subtasks, "status": "executing"}}
        )
        
        # Execute subtasks
        execution_result = await task.execute_all()
        await db.multi_agent_tasks.update_one(
            {"id": task_id},
            {"$set": {"results": execution_result["results"], "status": "synthesizing"}}
        )
        
        # Synthesize results
        synthesis = await task.synthesize_results()
        await db.multi_agent_tasks.update_one(
            {"id": task_id},
            {"$set": {
                "synthesis": synthesis,
                "status": "complete",
                "completedAt": datetime.now(timezone.utc).isoformat()
            }}
        )
    
    if run_async:
        background_tasks.add_task(run_multi_agent)
        return {
            "success": True,
            "taskId": task_id,
            "status": "pending",
            "message": "Multi-agent task started. Check status for progress."
        }
    else:
        await run_multi_agent()
        # Fetch updated record
        result = await db.multi_agent_tasks.find_one(
            {"id": task_id},
            {"_id": 0}
        )
        return {
            "success": True,
            "taskId": task_id,
            "task": result
        }


@router.get("/task/{task_id}")
async def get_multi_agent_task(
    task_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get multi-agent task status and results"""
    db = get_db()
    
    task = await db.multi_agent_tasks.find_one(
        {"id": task_id, "userId": current_user["id"]},
        {"_id": 0}
    )
    
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return task


@router.get("/tasks")
async def list_multi_agent_tasks(
    status: str = None,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """List multi-agent tasks"""
    db = get_db()
    
    query = {"userId": current_user["id"]}
    if status:
        query["status"] = status
    
    tasks = await db.multi_agent_tasks.find(
        query,
        {"_id": 0}
    ).sort("createdAt", -1).limit(limit).to_list(limit)
    
    return tasks


@router.post("/team/create")
async def create_agent_team(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Create a custom agent team for recurring workflows"""
    db = get_db()
    
    name = request.get("name", "")
    description = request.get("description", "")
    agents = request.get("agents", [])  # List of agent types
    workflow = request.get("workflow", [])  # Ordered list of task templates
    
    if not name or not agents:
        raise HTTPException(status_code=400, detail="Name and agents required")
    
    # Validate agent types
    for agent in agents:
        if agent not in AGENT_TYPES:
            raise HTTPException(status_code=400, detail=f"Invalid agent type: {agent}")
    
    team = {
        "id": str(uuid4()),
        "userId": current_user["id"],
        "name": name,
        "description": description,
        "agents": agents,
        "workflow": workflow,
        "executionCount": 0,
        "avgDuration": 0,
        "createdAt": datetime.now(timezone.utc).isoformat()
    }
    
    await db.agent_teams_custom.insert_one(team)
    team.pop("_id", None)
    
    return {"success": True, "team": team}


@router.get("/teams")
async def list_agent_teams(
    current_user: dict = Depends(get_current_user)
):
    """List custom agent teams"""
    db = get_db()
    
    teams = await db.agent_teams_custom.find(
        {"userId": current_user["id"]},
        {"_id": 0}
    ).sort("createdAt", -1).to_list(50)
    
    return teams


@router.post("/team/{team_id}/execute")
async def execute_agent_team(
    team_id: str,
    request: dict,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Execute a saved agent team workflow"""
    db = get_db()
    
    team = await db.agent_teams_custom.find_one(
        {"id": team_id, "userId": current_user["id"]},
        {"_id": 0}
    )
    
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    goal = request.get("goal", "")
    inputs = request.get("inputs", {})
    
    if not goal:
        raise HTTPException(status_code=400, detail="Goal required")
    
    # Create multi-agent task with team context
    enriched_goal = f"""Execute this goal using the '{team['name']}' agent team.

Goal: {goal}

Team Agents: {', '.join([AGENT_TYPES[a]['name'] for a in team['agents']])}

Additional Inputs: {json.dumps(inputs)}

Follow the team's workflow and leverage each agent's specialty."""

    # Use multi-agent execution
    task_result = await execute_multi_agent_task(
        {"goal": enriched_goal, "async": True},
        background_tasks,
        current_user
    )
    
    # Update team stats
    await db.agent_teams_custom.update_one(
        {"id": team_id},
        {"$inc": {"executionCount": 1}}
    )
    
    return {
        "success": True,
        "teamId": team_id,
        "teamName": team["name"],
        **task_result
    }


@router.get("/history")
async def get_agent_execution_history(
    agent_type: str = None,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """Get agent execution history"""
    db = get_db()
    
    query = {"userId": current_user["id"]}
    if agent_type:
        query["agentType"] = agent_type
    
    executions = await db.agent_executions.find(
        query,
        {"_id": 0}
    ).sort("createdAt", -1).limit(limit).to_list(limit)
    
    return executions


@router.post("/chat")
async def agent_chat(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Interactive chat with a specific agent"""
    db = get_db()
    
    agent_type = request.get("agentType", "coordinator")
    message = request.get("message", "")
    session_id = request.get("sessionId")
    
    if not message:
        raise HTTPException(status_code=400, detail="Message required")
    
    if agent_type not in AGENT_TYPES:
        raise HTTPException(status_code=400, detail=f"Invalid agent type: {agent_type}")
    
    # Get or create session
    if not session_id:
        session_id = str(uuid4())
    
    # Get previous messages in session
    session = await db.agent_chat_sessions.find_one(
        {"id": session_id, "userId": current_user["id"]},
        {"_id": 0}
    )
    
    history = session.get("messages", []) if session else []
    
    # Build context from history
    context = {"conversationHistory": history[-5:]} if history else {}
    
    # Call agent
    response = await call_agent_ai(agent_type, message, context)
    
    # Save to session
    new_messages = history + [
        {"role": "user", "content": message, "timestamp": datetime.now(timezone.utc).isoformat()},
        {"role": "agent", "content": response, "timestamp": datetime.now(timezone.utc).isoformat()}
    ]
    
    await db.agent_chat_sessions.update_one(
        {"id": session_id, "userId": current_user["id"]},
        {
            "$set": {
                "agentType": agent_type,
                "messages": new_messages[-20:],  # Keep last 20 messages
                "updatedAt": datetime.now(timezone.utc).isoformat()
            },
            "$setOnInsert": {
                "createdAt": datetime.now(timezone.utc).isoformat()
            }
        },
        upsert=True
    )
    
    return {
        "success": True,
        "sessionId": session_id,
        "agentType": agent_type,
        "agentName": AGENT_TYPES[agent_type]["name"],
        "response": response
    }

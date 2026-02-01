"""
Autonomous Jobs Router

Background job queue system for autonomous agent execution.
Enables agents to work independently in the background while users monitor progress.

Features:
- Job queue management (create, start, pause, cancel)
- Background execution with asyncio
- Real-time status updates via WebSocket
- Autonomy level configuration per user/task type
- Job history and analytics
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from datetime import datetime, timezone
from uuid import uuid4
from typing import Optional, List, Dict, Any
from enum import Enum
import os
import json
import asyncio

from database import get_db
from routes.auth import get_current_user

# Import agent framework
import sys
sys.path.insert(0, '/app/backend')
from core.agent_framework import (
    AgentRegistry, AgentContext, TaskStatus,
    get_all_agents_info, quick_agent_execute
)

router = APIRouter()

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")


# ============== ENUMS & DATA CLASSES ==============

class AutonomyLevel(str, Enum):
    """User's autonomy preference for agent tasks"""
    FULL_AUTO = "full_auto"           # Agent executes without asking
    APPROVAL_REQUIRED = "approval"    # Agent creates plan, waits for approval
    NOTIFY_ONLY = "notify"            # Agent executes but notifies user
    MANUAL = "manual"                 # User must trigger each action


class JobPriority(str, Enum):
    """Job priority levels"""
    URGENT = "urgent"
    HIGH = "high"
    NORMAL = "normal"
    LOW = "low"


class JobType(str, Enum):
    """Types of autonomous jobs"""
    RESEARCH = "research"             # Research prospects/companies
    OUTREACH = "outreach"             # Send emails/messages
    FOLLOW_UP = "follow_up"           # Follow up on leads
    LEAD_MONITORING = "lead_monitor"  # Monitor lead activity
    MEETING_BOOKING = "meeting_book"  # Schedule meetings
    DATA_ENRICHMENT = "data_enrich"   # Enrich prospect data
    WORKFLOW_EXECUTION = "workflow"   # Execute saved workflows
    CUSTOM = "custom"                 # Custom agent task


# ============== ACTIVE JOBS MANAGER ==============

class JobsManager:
    """Manages background job execution"""
    
    def __init__(self):
        self.active_jobs: Dict[str, asyncio.Task] = {}
        self.job_progress: Dict[str, Dict] = {}
    
    def register_job(self, job_id: str, task: asyncio.Task):
        self.active_jobs[job_id] = task
        self.job_progress[job_id] = {
            "status": "running",
            "progress": 0,
            "current_step": "",
            "started_at": datetime.now(timezone.utc).isoformat()
        }
    
    def update_progress(self, job_id: str, progress: int, step: str = ""):
        if job_id in self.job_progress:
            self.job_progress[job_id]["progress"] = progress
            self.job_progress[job_id]["current_step"] = step
    
    def get_progress(self, job_id: str) -> Dict:
        return self.job_progress.get(job_id, {})
    
    def cancel_job(self, job_id: str) -> bool:
        if job_id in self.active_jobs:
            self.active_jobs[job_id].cancel()
            del self.active_jobs[job_id]
            if job_id in self.job_progress:
                self.job_progress[job_id]["status"] = "cancelled"
            return True
        return False
    
    def complete_job(self, job_id: str):
        if job_id in self.active_jobs:
            del self.active_jobs[job_id]
        if job_id in self.job_progress:
            self.job_progress[job_id]["status"] = "completed"
            self.job_progress[job_id]["progress"] = 100


jobs_manager = JobsManager()


# ============== WEBSOCKET BROADCAST ==============

async def broadcast_job_update(db, user_id: str, job_id: str, update: Dict):
    """Broadcast job update to user's WebSocket connections"""
    # Import from ai_orchestration to use the existing WebSocket manager
    try:
        from routes.ai_orchestration import manager
        await manager.send_to_user(user_id, {
            "type": "job_update",
            "jobId": job_id,
            "data": update,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
    except Exception as e:
        print(f"Broadcast error: {e}")


# ============== JOB EXECUTION ENGINE ==============

async def execute_autonomous_job(
    job_id: str,
    user_id: str,
    job_type: str,
    config: Dict,
    autonomy_level: str,
    db
):
    """
    Main job execution function that runs in the background.
    Executes agent tasks based on job type and autonomy level.
    """
    try:
        # Update job status to running
        await db.autonomous_jobs.update_one(
            {"id": job_id},
            {
                "$set": {
                    "status": "running",
                    "startedAt": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        # Broadcast job started
        await broadcast_job_update(db, user_id, job_id, {
            "type": "job_started",
            "message": f"Starting {job_type} job..."
        })
        
        registry = AgentRegistry()
        registry.set_db_for_all(db)
        
        # Create execution context
        context = AgentContext(
            user_id=user_id,
            session_id=f"job-{job_id}",
            original_goal=config.get("goal", f"Execute {job_type} task")
        )
        
        results = {}
        steps_completed = 0
        total_steps = len(config.get("steps", [1]))  # Default 1 step
        
        # Execute based on job type
        if job_type == JobType.RESEARCH.value:
            results = await execute_research_job(registry, context, config, job_id, user_id, db)
            
        elif job_type == JobType.OUTREACH.value:
            results = await execute_outreach_job(registry, context, config, job_id, user_id, db, autonomy_level)
            
        elif job_type == JobType.FOLLOW_UP.value:
            results = await execute_followup_job(registry, context, config, job_id, user_id, db, autonomy_level)
            
        elif job_type == JobType.LEAD_MONITORING.value:
            results = await execute_monitoring_job(registry, context, config, job_id, user_id, db)
            
        elif job_type == JobType.DATA_ENRICHMENT.value:
            results = await execute_enrichment_job(registry, context, config, job_id, user_id, db)
            
        elif job_type == JobType.WORKFLOW_EXECUTION.value:
            results = await execute_workflow_job(registry, context, config, job_id, user_id, db, autonomy_level)
            
        else:
            # Custom job - use orchestrator
            results = await execute_custom_job(registry, context, config, job_id, user_id, db, autonomy_level)
        
        # Mark job as completed
        await db.autonomous_jobs.update_one(
            {"id": job_id},
            {
                "$set": {
                    "status": "completed",
                    "results": results,
                    "completedAt": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        
        jobs_manager.complete_job(job_id)
        
        # Broadcast completion
        await broadcast_job_update(db, user_id, job_id, {
            "type": "job_completed",
            "message": f"{job_type} job completed successfully",
            "results": results
        })
        
        return results
        
    except asyncio.CancelledError:
        # Job was cancelled
        await db.autonomous_jobs.update_one(
            {"id": job_id},
            {
                "$set": {
                    "status": "cancelled",
                    "cancelledAt": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        await broadcast_job_update(db, user_id, job_id, {
            "type": "job_cancelled",
            "message": "Job was cancelled"
        })
        
    except Exception as e:
        # Job failed
        await db.autonomous_jobs.update_one(
            {"id": job_id},
            {
                "$set": {
                    "status": "failed",
                    "error": str(e),
                    "failedAt": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        await broadcast_job_update(db, user_id, job_id, {
            "type": "job_failed",
            "message": f"Job failed: {str(e)}",
            "error": str(e)
        })


# ============== JOB TYPE EXECUTORS ==============

async def execute_research_job(registry, context, config, job_id, user_id, db):
    """Execute research job - company/prospect research"""
    agent = registry.get_agent("research")
    
    targets = config.get("targets", [])
    results = {"researched": [], "errors": []}
    
    for i, target in enumerate(targets):
        progress = int((i / max(len(targets), 1)) * 100)
        jobs_manager.update_progress(job_id, progress, f"Researching {target.get('name', 'target')}")
        
        await broadcast_job_update(db, user_id, job_id, {
            "type": "step_progress",
            "progress": progress,
            "step": f"Researching {target.get('name', target.get('domain', 'target'))}"
        })
        
        try:
            task = f"Research: {json.dumps(target)}"
            result = await agent.execute(task, context)
            results["researched"].append({
                "target": target,
                "result": result.get("result", {})
            })
        except Exception as e:
            results["errors"].append({"target": target, "error": str(e)})
    
    return results


async def execute_outreach_job(registry, context, config, job_id, user_id, db, autonomy_level):
    """Execute outreach job - generate and optionally send emails"""
    agent = registry.get_agent("outreach")
    
    prospects = config.get("prospects", [])
    template_id = config.get("templateId")
    results = {"drafts": [], "sent": [], "errors": []}
    
    for i, prospect in enumerate(prospects):
        progress = int((i / max(len(prospects), 1)) * 100)
        jobs_manager.update_progress(job_id, progress, f"Creating outreach for {prospect.get('name', 'prospect')}")
        
        await broadcast_job_update(db, user_id, job_id, {
            "type": "step_progress",
            "progress": progress,
            "step": f"Creating outreach for {prospect.get('name', prospect.get('email', 'prospect'))}"
        })
        
        try:
            task = f"Create personalized email for prospect: {json.dumps(prospect)}"
            if template_id:
                task += f" using template {template_id}"
            
            result = await agent.execute(task, context)
            draft = result.get("result", {})
            
            # If full auto, send immediately
            if autonomy_level == AutonomyLevel.FULL_AUTO.value and draft.get("subject"):
                # Would send email here with SendGrid
                results["sent"].append({"prospect": prospect, "draft": draft})
            else:
                # Save as draft for approval
                draft_doc = {
                    "id": str(uuid4()),
                    "userId": user_id,
                    "jobId": job_id,
                    "prospectId": prospect.get("id"),
                    "prospectEmail": prospect.get("email"),
                    "subject": draft.get("subject", ""),
                    "body": draft.get("body", ""),
                    "status": "pending_approval",
                    "createdAt": datetime.now(timezone.utc).isoformat()
                }
                await db.email_drafts.insert_one(draft_doc)
                results["drafts"].append(draft_doc)
                
        except Exception as e:
            results["errors"].append({"prospect": prospect, "error": str(e)})
    
    return results


async def execute_followup_job(registry, context, config, job_id, user_id, db, autonomy_level):
    """Execute follow-up job - check and send follow-ups"""
    results = {"followed_up": [], "skipped": [], "errors": []}
    
    # Get prospects that need follow-up
    days_since_contact = config.get("daysSinceContact", 3)
    cutoff_date = datetime.now(timezone.utc).isoformat()
    
    # Find prospects with no recent activity
    prospects = await db.prospects.find({
        "userId": user_id,
        "status": {"$in": ["contacted", "interested"]},
    }).limit(config.get("maxProspects", 10)).to_list(100)
    
    agent = registry.get_agent("outreach")
    
    for i, prospect in enumerate(prospects):
        progress = int((i / max(len(prospects), 1)) * 100)
        jobs_manager.update_progress(job_id, progress, f"Following up with {prospect.get('firstName', 'prospect')}")
        
        await broadcast_job_update(db, user_id, job_id, {
            "type": "step_progress",
            "progress": progress,
            "step": f"Following up with {prospect.get('firstName', prospect.get('email', 'prospect'))}"
        })
        
        try:
            task = f"Create follow-up email for prospect who was contacted {days_since_contact} days ago: {json.dumps(prospect)}"
            result = await agent.execute(task, context)
            
            draft = result.get("result", {})
            if draft.get("subject"):
                draft_doc = {
                    "id": str(uuid4()),
                    "userId": user_id,
                    "jobId": job_id,
                    "prospectId": str(prospect.get("id")),
                    "prospectEmail": prospect.get("email"),
                    "subject": draft.get("subject", ""),
                    "body": draft.get("body", ""),
                    "type": "follow_up",
                    "status": "pending_approval" if autonomy_level != AutonomyLevel.FULL_AUTO.value else "sent",
                    "createdAt": datetime.now(timezone.utc).isoformat()
                }
                await db.email_drafts.insert_one(draft_doc)
                results["followed_up"].append(draft_doc)
            else:
                results["skipped"].append({"prospect": prospect.get("email"), "reason": "No draft generated"})
                
        except Exception as e:
            results["errors"].append({"prospect": prospect.get("email"), "error": str(e)})
    
    return results


async def execute_monitoring_job(registry, context, config, job_id, user_id, db):
    """Execute lead monitoring job - check for hot leads"""
    results = {"hot_leads": [], "updates": [], "alerts": []}
    
    # This would integrate with email tracking, CRM, etc.
    # For now, analyze recent prospect activity
    
    agent = registry.get_agent("qualification")
    
    prospects = await db.prospects.find({
        "userId": user_id,
        "status": {"$nin": ["closed_won", "closed_lost"]}
    }).limit(50).to_list(100)
    
    for i, prospect in enumerate(prospects):
        progress = int((i / max(len(prospects), 1)) * 100)
        jobs_manager.update_progress(job_id, progress, f"Analyzing {prospect.get('firstName', 'prospect')}")
        
        # Check for recent engagement (would integrate with email tracking)
        engagement_score = prospect.get("engagementScore", 0)
        
        if engagement_score > 70:
            results["hot_leads"].append({
                "prospect": prospect.get("email"),
                "score": engagement_score,
                "recommendation": "Prioritize immediate follow-up"
            })
            results["alerts"].append({
                "type": "hot_lead",
                "message": f"Hot lead detected: {prospect.get('firstName')} {prospect.get('lastName')}",
                "prospectId": str(prospect.get("id"))
            })
    
    await broadcast_job_update(db, user_id, job_id, {
        "type": "monitoring_complete",
        "hotLeads": len(results["hot_leads"]),
        "alerts": len(results["alerts"])
    })
    
    return results


async def execute_enrichment_job(registry, context, config, job_id, user_id, db):
    """Execute data enrichment job - enrich prospect/company data"""
    results = {"enriched": [], "errors": []}
    
    agent = registry.get_agent("research")
    
    # Get prospects needing enrichment
    prospects = await db.prospects.find({
        "userId": user_id,
        "$or": [
            {"company": {"$exists": False}},
            {"title": {"$exists": False}},
            {"linkedinUrl": {"$exists": False}}
        ]
    }).limit(config.get("maxProspects", 20)).to_list(100)
    
    for i, prospect in enumerate(prospects):
        progress = int((i / max(len(prospects), 1)) * 100)
        jobs_manager.update_progress(job_id, progress, f"Enriching {prospect.get('email', 'prospect')}")
        
        await broadcast_job_update(db, user_id, job_id, {
            "type": "step_progress",
            "progress": progress,
            "step": f"Enriching data for {prospect.get('email', 'prospect')}"
        })
        
        try:
            task = f"Find additional information about this person: {prospect.get('email')} at {prospect.get('company', 'unknown company')}"
            result = await agent.execute(task, context)
            
            enriched_data = result.get("result", {})
            
            # Update prospect with enriched data
            update_fields = {}
            if enriched_data.get("title"):
                update_fields["title"] = enriched_data["title"]
            if enriched_data.get("company"):
                update_fields["company"] = enriched_data["company"]
            if enriched_data.get("linkedinUrl"):
                update_fields["linkedinUrl"] = enriched_data["linkedinUrl"]
            
            if update_fields:
                await db.prospects.update_one(
                    {"id": prospect.get("id")},
                    {"$set": update_fields}
                )
                results["enriched"].append({
                    "prospect": prospect.get("email"),
                    "enrichedFields": list(update_fields.keys())
                })
                
        except Exception as e:
            results["errors"].append({"prospect": prospect.get("email"), "error": str(e)})
    
    return results


async def execute_workflow_job(registry, context, config, job_id, user_id, db, autonomy_level):
    """Execute a saved workflow"""
    workflow_id = config.get("workflowId")
    
    if not workflow_id:
        return {"error": "No workflow ID provided"}
    
    workflow = await db.workflows.find_one(
        {"id": workflow_id, "userId": user_id},
        {"_id": 0}
    )
    
    if not workflow:
        return {"error": "Workflow not found"}
    
    results = {"steps_completed": [], "steps_pending": [], "errors": []}
    
    nodes = workflow.get("nodes", [])
    
    for i, node in enumerate(nodes):
        progress = int((i / max(len(nodes), 1)) * 100)
        jobs_manager.update_progress(job_id, progress, f"Executing {node.get('label', 'step')}")
        
        await broadcast_job_update(db, user_id, job_id, {
            "type": "step_progress",
            "progress": progress,
            "step": f"Executing: {node.get('label', node.get('type', 'step'))}"
        })
        
        node_type = node.get("type")
        
        if node_type == "wait":
            # Skip wait nodes in background execution
            results["steps_completed"].append({"node": node.get("id"), "type": "wait", "skipped": True})
            
        elif node_type == "approval" and autonomy_level != AutonomyLevel.FULL_AUTO.value:
            # Create approval request
            results["steps_pending"].append({
                "node": node.get("id"),
                "type": "approval",
                "requires_user_action": True
            })
            break  # Stop execution until approval
            
        elif node_type in ["email", "action"]:
            # Execute action
            try:
                agent = registry.get_agent("outreach" if node_type == "email" else "orchestrator")
                task = f"Execute workflow step: {node.get('label', '')} with config: {json.dumps(node.get('config', {}))}"
                result = await agent.execute(task, context)
                results["steps_completed"].append({
                    "node": node.get("id"),
                    "type": node_type,
                    "result": result.get("result", {})
                })
            except Exception as e:
                results["errors"].append({"node": node.get("id"), "error": str(e)})
        else:
            results["steps_completed"].append({"node": node.get("id"), "type": node_type})
    
    return results


async def execute_custom_job(registry, context, config, job_id, user_id, db, autonomy_level):
    """Execute custom job using orchestrator"""
    agent = registry.get_agent("orchestrator")
    
    goal = config.get("goal", "Execute custom task")
    
    jobs_manager.update_progress(job_id, 10, "Planning execution...")
    await broadcast_job_update(db, user_id, job_id, {
        "type": "step_progress",
        "progress": 10,
        "step": "Planning execution..."
    })
    
    # Use orchestrator to plan and execute
    task = f"Execute this goal autonomously: {goal}"
    result = await agent.execute(task, context)
    
    jobs_manager.update_progress(job_id, 100, "Completed")
    
    return result.get("result", {})


# ============== API ENDPOINTS ==============

@router.post("/jobs/create")
async def create_job(
    request: dict,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Create and optionally start a new autonomous job"""
    db = get_db()
    
    job_type = request.get("jobType", JobType.CUSTOM.value)
    config = request.get("config", {})
    priority = request.get("priority", JobPriority.NORMAL.value)
    auto_start = request.get("autoStart", True)
    scheduled_time = request.get("scheduledTime")  # ISO string for future execution
    
    # Get user's autonomy preference for this job type
    autonomy_prefs = await db.user_autonomy_preferences.find_one(
        {"userId": current_user["id"]},
        {"_id": 0}
    )
    autonomy_level = AutonomyLevel.APPROVAL_REQUIRED.value  # Default
    if autonomy_prefs:
        autonomy_level = autonomy_prefs.get("preferences", {}).get(
            job_type, 
            autonomy_prefs.get("default", AutonomyLevel.APPROVAL_REQUIRED.value)
        )
    
    job_id = str(uuid4())
    job = {
        "id": job_id,
        "userId": current_user["id"],
        "jobType": job_type,
        "config": config,
        "priority": priority,
        "autonomyLevel": autonomy_level,
        "status": "pending" if scheduled_time else ("running" if auto_start else "pending"),
        "scheduledTime": scheduled_time,
        "createdAt": datetime.now(timezone.utc).isoformat()
    }
    
    await db.autonomous_jobs.insert_one(job)
    
    # Start job if auto_start and not scheduled
    if auto_start and not scheduled_time:
        task = asyncio.create_task(
            execute_autonomous_job(
                job_id, current_user["id"], job_type, config, autonomy_level, db
            )
        )
        jobs_manager.register_job(job_id, task)
    
    return {
        "success": True,
        "jobId": job_id,
        "status": job["status"],
        "autonomyLevel": autonomy_level,
        "message": f"Job created and {'started' if auto_start else 'queued'}"
    }


@router.get("/jobs")
async def list_jobs(
    status: Optional[str] = None,
    job_type: Optional[str] = None,
    limit: int = 20,
    current_user: dict = Depends(get_current_user)
):
    """List user's autonomous jobs"""
    db = get_db()
    
    query = {"userId": current_user["id"]}
    if status:
        query["status"] = status
    if job_type:
        query["jobType"] = job_type
    
    jobs = await db.autonomous_jobs.find(
        query,
        {"_id": 0}
    ).sort("createdAt", -1).limit(limit).to_list(limit)
    
    # Add real-time progress for running jobs
    for job in jobs:
        if job["status"] == "running":
            progress = jobs_manager.get_progress(job["id"])
            job["progress"] = progress.get("progress", 0)
            job["currentStep"] = progress.get("current_step", "")
    
    return jobs


@router.get("/jobs/{job_id}")
async def get_job(
    job_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get details of a specific job"""
    db = get_db()
    
    job = await db.autonomous_jobs.find_one(
        {"id": job_id, "userId": current_user["id"]},
        {"_id": 0}
    )
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Add real-time progress if running
    if job["status"] == "running":
        progress = jobs_manager.get_progress(job_id)
        job["progress"] = progress.get("progress", 0)
        job["currentStep"] = progress.get("current_step", "")
    
    return job


@router.post("/jobs/{job_id}/start")
async def start_job(
    job_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Start a pending job"""
    db = get_db()
    
    job = await db.autonomous_jobs.find_one(
        {"id": job_id, "userId": current_user["id"], "status": "pending"},
        {"_id": 0}
    )
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or not in pending status")
    
    task = asyncio.create_task(
        execute_autonomous_job(
            job_id, current_user["id"], job["jobType"], job["config"], job["autonomyLevel"], db
        )
    )
    jobs_manager.register_job(job_id, task)
    
    return {"success": True, "message": "Job started", "jobId": job_id}


@router.post("/jobs/{job_id}/pause")
async def pause_job(
    job_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Pause a running job"""
    db = get_db()
    
    if jobs_manager.cancel_job(job_id):
        await db.autonomous_jobs.update_one(
            {"id": job_id, "userId": current_user["id"]},
            {
                "$set": {
                    "status": "paused",
                    "pausedAt": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        return {"success": True, "message": "Job paused"}
    
    raise HTTPException(status_code=404, detail="Job not found or not running")


@router.post("/jobs/{job_id}/cancel")
async def cancel_job(
    job_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Cancel a job"""
    db = get_db()
    
    jobs_manager.cancel_job(job_id)
    
    result = await db.autonomous_jobs.update_one(
        {"id": job_id, "userId": current_user["id"], "status": {"$in": ["pending", "running", "paused"]}},
        {
            "$set": {
                "status": "cancelled",
                "cancelledAt": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Job not found or cannot be cancelled")
    
    return {"success": True, "message": "Job cancelled"}


@router.get("/jobs/running/count")
async def get_running_jobs_count(
    current_user: dict = Depends(get_current_user)
):
    """Get count of currently running jobs"""
    db = get_db()
    
    count = await db.autonomous_jobs.count_documents({
        "userId": current_user["id"],
        "status": "running"
    })
    
    return {"runningJobs": count}


# ============== AUTONOMY PREFERENCES ==============

@router.get("/autonomy/preferences")
async def get_autonomy_preferences(
    current_user: dict = Depends(get_current_user)
):
    """Get user's autonomy preferences"""
    db = get_db()
    
    prefs = await db.user_autonomy_preferences.find_one(
        {"userId": current_user["id"]},
        {"_id": 0}
    )
    
    if not prefs:
        # Return defaults
        return {
            "userId": current_user["id"],
            "default": AutonomyLevel.APPROVAL_REQUIRED.value,
            "preferences": {
                JobType.RESEARCH.value: AutonomyLevel.FULL_AUTO.value,
                JobType.OUTREACH.value: AutonomyLevel.APPROVAL_REQUIRED.value,
                JobType.FOLLOW_UP.value: AutonomyLevel.APPROVAL_REQUIRED.value,
                JobType.LEAD_MONITORING.value: AutonomyLevel.FULL_AUTO.value,
                JobType.DATA_ENRICHMENT.value: AutonomyLevel.FULL_AUTO.value,
                JobType.WORKFLOW_EXECUTION.value: AutonomyLevel.APPROVAL_REQUIRED.value,
                JobType.CUSTOM.value: AutonomyLevel.APPROVAL_REQUIRED.value
            },
            "notifications": {
                "inApp": True,
                "email": False
            }
        }
    
    return prefs


@router.put("/autonomy/preferences")
async def update_autonomy_preferences(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Update user's autonomy preferences"""
    db = get_db()
    
    prefs = {
        "userId": current_user["id"],
        "default": request.get("default", AutonomyLevel.APPROVAL_REQUIRED.value),
        "preferences": request.get("preferences", {}),
        "notifications": request.get("notifications", {"inApp": True, "email": False}),
        "updatedAt": datetime.now(timezone.utc).isoformat()
    }
    
    await db.user_autonomy_preferences.update_one(
        {"userId": current_user["id"]},
        {"$set": prefs},
        upsert=True
    )
    
    return {"success": True, "message": "Preferences updated", "preferences": prefs}


@router.post("/autonomy/ask-preference")
async def ask_autonomy_preference(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """AI endpoint to ask user about autonomy level for a task"""
    db = get_db()
    
    job_type = request.get("jobType", JobType.CUSTOM.value)
    task_description = request.get("taskDescription", "")
    
    # Get current preference
    prefs = await db.user_autonomy_preferences.find_one(
        {"userId": current_user["id"]},
        {"_id": 0}
    )
    
    current_level = AutonomyLevel.APPROVAL_REQUIRED.value
    if prefs:
        current_level = prefs.get("preferences", {}).get(
            job_type, 
            prefs.get("default", AutonomyLevel.APPROVAL_REQUIRED.value)
        )
    
    return {
        "jobType": job_type,
        "taskDescription": task_description,
        "currentPreference": current_level,
        "options": [
            {
                "level": AutonomyLevel.FULL_AUTO.value,
                "label": "Full Auto",
                "description": "Execute immediately without asking"
            },
            {
                "level": AutonomyLevel.APPROVAL_REQUIRED.value,
                "label": "Approval Required",
                "description": "Show me the plan and wait for my approval"
            },
            {
                "level": AutonomyLevel.NOTIFY_ONLY.value,
                "label": "Notify Only",
                "description": "Execute but notify me when done"
            },
            {
                "level": AutonomyLevel.MANUAL.value,
                "label": "Manual",
                "description": "Don't do anything automatically"
            }
        ],
        "suggestion": {
            "level": current_level,
            "reason": f"Based on your previous preferences for {job_type} tasks"
        }
    }


# ============== QUICK ACTIONS ==============

@router.post("/quick-start/research")
async def quick_start_research(
    request: dict,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Quick start a research job"""
    return await create_job(
        {
            "jobType": JobType.RESEARCH.value,
            "config": {
                "targets": request.get("targets", []),
                "depth": request.get("depth", "standard")
            },
            "autoStart": True
        },
        background_tasks,
        current_user
    )


@router.post("/quick-start/outreach")
async def quick_start_outreach(
    request: dict,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Quick start an outreach job"""
    return await create_job(
        {
            "jobType": JobType.OUTREACH.value,
            "config": {
                "prospects": request.get("prospects", []),
                "templateId": request.get("templateId"),
                "goal": request.get("goal", "Create personalized outreach emails")
            },
            "autoStart": True
        },
        background_tasks,
        current_user
    )


@router.post("/quick-start/follow-up")
async def quick_start_followup(
    request: dict,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Quick start a follow-up job"""
    return await create_job(
        {
            "jobType": JobType.FOLLOW_UP.value,
            "config": {
                "daysSinceContact": request.get("daysSinceContact", 3),
                "maxProspects": request.get("maxProspects", 10)
            },
            "autoStart": True
        },
        background_tasks,
        current_user
    )


# ============== JOB ANALYTICS ==============

@router.get("/analytics/summary")
async def get_job_analytics(
    current_user: dict = Depends(get_current_user)
):
    """Get summary analytics for user's jobs"""
    db = get_db()
    
    # Count by status
    total = await db.autonomous_jobs.count_documents({"userId": current_user["id"]})
    completed = await db.autonomous_jobs.count_documents({"userId": current_user["id"], "status": "completed"})
    failed = await db.autonomous_jobs.count_documents({"userId": current_user["id"], "status": "failed"})
    running = await db.autonomous_jobs.count_documents({"userId": current_user["id"], "status": "running"})
    pending = await db.autonomous_jobs.count_documents({"userId": current_user["id"], "status": "pending"})
    
    # Count by type
    type_counts = {}
    for job_type in JobType:
        count = await db.autonomous_jobs.count_documents({
            "userId": current_user["id"],
            "jobType": job_type.value
        })
        type_counts[job_type.value] = count
    
    return {
        "total": total,
        "byStatus": {
            "completed": completed,
            "failed": failed,
            "running": running,
            "pending": pending
        },
        "byType": type_counts,
        "successRate": round((completed / max(total, 1)) * 100, 1)
    }

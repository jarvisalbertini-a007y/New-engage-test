"""Workflow Templates - Prebuilt workflows with human-in-the-loop approvals"""
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from uuid import uuid4
from typing import Optional, List
import os

from database import get_db
from routes.auth import get_current_user

router = APIRouter()

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

# Prebuilt workflow templates
WORKFLOW_TEMPLATES = [
    {
        "id": "outbound-sequence-basic",
        "name": "Basic Outbound Sequence",
        "description": "3-step email sequence for cold outreach",
        "category": "outreach",
        "complexity": "simple",
        "estimatedTime": "7 days",
        "nodes": [
            {"id": "n1", "type": "trigger", "label": "Start", "config": {"triggerType": "manual"}},
            {"id": "n2", "type": "email", "label": "Initial Outreach", "config": {"template": "cold_intro", "delay": 0}},
            {"id": "n3", "type": "wait", "label": "Wait 3 Days", "config": {"days": 3}},
            {"id": "n4", "type": "email", "label": "Follow-up 1", "config": {"template": "followup_value", "delay": 0}},
            {"id": "n5", "type": "wait", "label": "Wait 4 Days", "config": {"days": 4}},
            {"id": "n6", "type": "email", "label": "Break-up Email", "config": {"template": "breakup", "delay": 0}},
            {"id": "n7", "type": "end", "label": "End", "config": {}}
        ],
        "edges": [
            {"id": "e1", "source": "n1", "target": "n2"},
            {"id": "e2", "source": "n2", "target": "n3"},
            {"id": "e3", "source": "n3", "target": "n4"},
            {"id": "e4", "source": "n4", "target": "n5"},
            {"id": "e5", "source": "n5", "target": "n6"},
            {"id": "e6", "source": "n6", "target": "n7"}
        ],
        "approvalPoints": ["n2", "n4", "n6"],
        "tags": ["email", "outreach", "beginner"]
    },
    {
        "id": "multi-channel-enterprise",
        "name": "Enterprise Multi-Channel Sequence",
        "description": "5-touch multi-channel sequence with LinkedIn, email, and calls",
        "category": "outreach",
        "complexity": "advanced",
        "estimatedTime": "14 days",
        "nodes": [
            {"id": "n1", "type": "trigger", "label": "Start", "config": {"triggerType": "signal", "signal": "icp_match"}},
            {"id": "n2", "type": "research", "label": "Research Company", "config": {"agent": "company-research-agent"}},
            {"id": "n3", "type": "approval", "label": "Approve Research", "config": {"approver": "owner", "timeout": 24}},
            {"id": "n4", "type": "linkedin", "label": "LinkedIn Connect", "config": {"action": "connect", "message": True}},
            {"id": "n5", "type": "wait", "label": "Wait 2 Days", "config": {"days": 2}},
            {"id": "n6", "type": "email", "label": "Personalized Email", "config": {"template": "personalized_intro"}},
            {"id": "n7", "type": "wait", "label": "Wait 3 Days", "config": {"days": 3}},
            {"id": "n8", "type": "call", "label": "Discovery Call", "config": {"script": "discovery"}},
            {"id": "n9", "type": "branch", "label": "Response Check", "config": {}},
            {"id": "n10", "type": "email", "label": "Meeting Request", "config": {"template": "meeting_request"}},
            {"id": "n11", "type": "email", "label": "Nurture Email", "config": {"template": "nurture"}},
            {"id": "n12", "type": "end", "label": "End", "config": {}}
        ],
        "edges": [
            {"id": "e1", "source": "n1", "target": "n2"},
            {"id": "e2", "source": "n2", "target": "n3"},
            {"id": "e3", "source": "n3", "target": "n4", "condition": "approved"},
            {"id": "e4", "source": "n4", "target": "n5"},
            {"id": "e5", "source": "n5", "target": "n6"},
            {"id": "e6", "source": "n6", "target": "n7"},
            {"id": "e7", "source": "n7", "target": "n8"},
            {"id": "e8", "source": "n8", "target": "n9"},
            {"id": "e9", "source": "n9", "target": "n10", "condition": "positive_response"},
            {"id": "e10", "source": "n9", "target": "n11", "condition": "no_response"},
            {"id": "e11", "source": "n10", "target": "n12"},
            {"id": "e12", "source": "n11", "target": "n12"}
        ],
        "approvalPoints": ["n3", "n6", "n8"],
        "tags": ["multi-channel", "enterprise", "advanced"]
    },
    {
        "id": "lead-qualification-auto",
        "name": "Automated Lead Qualification",
        "description": "AI-powered lead scoring and routing",
        "category": "qualification",
        "complexity": "medium",
        "estimatedTime": "instant",
        "nodes": [
            {"id": "n1", "type": "trigger", "label": "New Lead", "config": {"triggerType": "webhook"}},
            {"id": "n2", "type": "agent", "label": "Enrich Data", "config": {"agent": "data-enrichment-agent"}},
            {"id": "n3", "type": "agent", "label": "Score ICP Match", "config": {"agent": "icp-scorer"}},
            {"id": "n4", "type": "branch", "label": "Score Check", "config": {"field": "score"}},
            {"id": "n5", "type": "action", "label": "Route to SDR", "config": {"action": "assign_owner", "criteria": "round_robin"}},
            {"id": "n6", "type": "action", "label": "Add to Nurture", "config": {"action": "add_to_sequence", "sequence": "nurture"}},
            {"id": "n7", "type": "action", "label": "Mark Unqualified", "config": {"action": "update_status", "status": "unqualified"}},
            {"id": "n8", "type": "end", "label": "End", "config": {}}
        ],
        "edges": [
            {"id": "e1", "source": "n1", "target": "n2"},
            {"id": "e2", "source": "n2", "target": "n3"},
            {"id": "e3", "source": "n3", "target": "n4"},
            {"id": "e4", "source": "n4", "target": "n5", "condition": "score >= 80"},
            {"id": "e5", "source": "n4", "target": "n6", "condition": "score >= 50"},
            {"id": "e6", "source": "n4", "target": "n7", "condition": "score < 50"},
            {"id": "e7", "source": "n5", "target": "n8"},
            {"id": "e8", "source": "n6", "target": "n8"},
            {"id": "e9", "source": "n7", "target": "n8"}
        ],
        "approvalPoints": [],
        "tags": ["qualification", "automation", "routing"]
    },
    {
        "id": "webinar-followup",
        "name": "Webinar Follow-up Sequence",
        "description": "Automated follow-up for webinar attendees and no-shows",
        "category": "nurture",
        "complexity": "medium",
        "estimatedTime": "10 days",
        "nodes": [
            {"id": "n1", "type": "trigger", "label": "Webinar Ends", "config": {"triggerType": "event", "event": "webinar_end"}},
            {"id": "n2", "type": "branch", "label": "Attendance Check", "config": {"field": "attended"}},
            {"id": "n3", "type": "email", "label": "Thank You + Recording", "config": {"template": "webinar_attended"}},
            {"id": "n4", "type": "email", "label": "Sorry We Missed You", "config": {"template": "webinar_missed"}},
            {"id": "n5", "type": "wait", "label": "Wait 2 Days", "config": {"days": 2}},
            {"id": "n6", "type": "email", "label": "Case Study", "config": {"template": "case_study_share"}},
            {"id": "n7", "type": "approval", "label": "Review Engagement", "config": {"approver": "owner"}},
            {"id": "n8", "type": "email", "label": "Demo Offer", "config": {"template": "demo_offer"}},
            {"id": "n9", "type": "end", "label": "End", "config": {}}
        ],
        "edges": [
            {"id": "e1", "source": "n1", "target": "n2"},
            {"id": "e2", "source": "n2", "target": "n3", "condition": "attended"},
            {"id": "e3", "source": "n2", "target": "n4", "condition": "not_attended"},
            {"id": "e4", "source": "n3", "target": "n5"},
            {"id": "e5", "source": "n4", "target": "n5"},
            {"id": "e6", "source": "n5", "target": "n6"},
            {"id": "e7", "source": "n6", "target": "n7"},
            {"id": "e8", "source": "n7", "target": "n8", "condition": "approved"},
            {"id": "e9", "source": "n8", "target": "n9"}
        ],
        "approvalPoints": ["n7"],
        "tags": ["webinar", "nurture", "event"]
    },
    {
        "id": "inbound-response",
        "name": "Inbound Lead Response",
        "description": "Immediate response workflow for inbound leads with AI qualification",
        "category": "inbound",
        "complexity": "simple",
        "estimatedTime": "5 minutes",
        "nodes": [
            {"id": "n1", "type": "trigger", "label": "Form Submit", "config": {"triggerType": "form"}},
            {"id": "n2", "type": "agent", "label": "AI Qualify", "config": {"agent": "intent-classifier"}},
            {"id": "n3", "type": "branch", "label": "Intent Check", "config": {}},
            {"id": "n4", "type": "email", "label": "Hot Lead Email", "config": {"template": "hot_lead_response", "immediate": true}},
            {"id": "n5", "type": "notification", "label": "Alert Sales", "config": {"channel": "slack", "urgent": true}},
            {"id": "n6", "type": "email", "label": "Standard Response", "config": {"template": "inbound_response"}},
            {"id": "n7", "type": "end", "label": "End", "config": {}}
        ],
        "edges": [
            {"id": "e1", "source": "n1", "target": "n2"},
            {"id": "e2", "source": "n2", "target": "n3"},
            {"id": "e3", "source": "n3", "target": "n4", "condition": "high_intent"},
            {"id": "e4", "source": "n4", "target": "n5"},
            {"id": "e5", "source": "n3", "target": "n6", "condition": "default"},
            {"id": "e6", "source": "n5", "target": "n7"},
            {"id": "e7", "source": "n6", "target": "n7"}
        ],
        "approvalPoints": [],
        "tags": ["inbound", "speed-to-lead", "automation"]
    }
]

@router.get("/templates")
async def get_workflow_templates(
    category: Optional[str] = None,
    complexity: Optional[str] = None
):
    """Get prebuilt workflow templates"""
    templates = WORKFLOW_TEMPLATES
    
    if category:
        templates = [t for t in templates if t["category"] == category]
    if complexity:
        templates = [t for t in templates if t["complexity"] == complexity]
    
    return templates

@router.get("/templates/{template_id}")
async def get_workflow_template(template_id: str):
    """Get a specific workflow template"""
    template = next((t for t in WORKFLOW_TEMPLATES if t["id"] == template_id), None)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template

@router.post("/templates/{template_id}/clone")
async def clone_workflow_template(
    template_id: str,
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Clone a workflow template to user's workflows"""
    template = next((t for t in WORKFLOW_TEMPLATES if t["id"] == template_id), None)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    db = get_db()
    now = datetime.now(timezone.utc)
    
    workflow = {
        "id": str(uuid4()),
        "userId": current_user["id"],
        "name": request.get("name", f"Copy of {template['name']}"),
        "description": template["description"],
        "templateId": template_id,
        "category": template["category"],
        "status": "draft",
        "nodes": template["nodes"],
        "edges": template["edges"],
        "approvalPoints": template["approvalPoints"],
        "settings": request.get("settings", {}),
        "createdAt": now.isoformat(),
        "updatedAt": now.isoformat()
    }
    
    await db.workflows.insert_one(workflow)
    workflow.pop("_id", None)
    
    return workflow

# Human-in-the-loop approval endpoints
@router.get("/approvals")
async def get_pending_approvals(
    current_user: dict = Depends(get_current_user)
):
    """Get pending approval requests"""
    db = get_db()
    
    approvals = await db.workflow_approvals.find(
        {
            "approverId": current_user["id"],
            "status": "pending"
        },
        {"_id": 0}
    ).sort("createdAt", -1).to_list(50)
    
    return approvals

@router.post("/approvals")
async def create_approval_request(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Create a new approval request (called by workflow engine)"""
    db = get_db()
    
    approval = {
        "id": str(uuid4()),
        "workflowId": request.get("workflowId"),
        "workflowExecutionId": request.get("executionId"),
        "nodeId": request.get("nodeId"),
        "approverId": request.get("approverId", current_user["id"]),
        "type": request.get("type", "content"),  # content, action, send
        "title": request.get("title", "Approval Required"),
        "description": request.get("description", ""),
        "content": request.get("content", {}),  # The content to approve
        "context": request.get("context", {}),  # Additional context
        "status": "pending",
        "timeoutHours": request.get("timeoutHours", 24),
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "expiresAt": None,
        "respondedAt": None,
        "response": None
    }
    
    await db.workflow_approvals.insert_one(approval)
    approval.pop("_id", None)
    
    return approval

@router.post("/approvals/{approval_id}/respond")
async def respond_to_approval(
    approval_id: str,
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Approve or reject an approval request"""
    db = get_db()
    
    approval = await db.workflow_approvals.find_one(
        {"id": approval_id, "approverId": current_user["id"]}
    )
    
    if not approval:
        raise HTTPException(status_code=404, detail="Approval not found")
    
    if approval["status"] != "pending":
        raise HTTPException(status_code=400, detail="Approval already responded")
    
    action = request.get("action")  # approve, reject, modify
    if action not in ["approve", "reject", "modify"]:
        raise HTTPException(status_code=400, detail="Invalid action")
    
    update = {
        "status": "approved" if action == "approve" else ("rejected" if action == "reject" else "modified"),
        "respondedAt": datetime.now(timezone.utc).isoformat(),
        "response": {
            "action": action,
            "comment": request.get("comment", ""),
            "modifications": request.get("modifications", {})
        }
    }
    
    await db.workflow_approvals.update_one(
        {"id": approval_id},
        {"$set": update}
    )
    
    # Signal workflow engine to continue (would be async in production)
    # await workflow_engine.continue_execution(approval["workflowExecutionId"], update)
    
    return {"success": True, "status": update["status"]}

@router.post("/generate-from-nlp")
async def generate_workflow_from_nlp(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Generate a workflow from natural language description"""
    description = request.get("description", "")
    
    if not description:
        raise HTTPException(status_code=400, detail="Description is required")
    
    try:
        from emergentintegrations.llm.chat import chat, Message, ModelType
        
        prompt = f"""Create a sales workflow based on this description:
"{description}"

Return a JSON object with:
- name: workflow name
- description: brief description
- category: one of (outreach, qualification, nurture, inbound)
- nodes: array of nodes with id, type (trigger, email, wait, branch, agent, approval, action, end), label, config
- edges: array of edges with id, source, target, optional condition
- approvalPoints: array of node IDs that require human approval

Node types:
- trigger: start point (config: triggerType)
- email: send email (config: template, delay)
- wait: pause (config: days/hours)
- branch: conditional split (config: field)
- agent: run AI agent (config: agent name)
- approval: human review (config: approver, timeout)
- action: CRM action (config: action type)
- end: workflow end

Return ONLY valid JSON."""
        
        response = await chat(
            emergent_api_key=EMERGENT_LLM_KEY,
            model=ModelType.GEMINI_2_0_FLASH,
            messages=[Message(role="user", content=prompt)]
        )
        
        # Parse JSON from response
        import json
        import re
        
        content = response.message.content
        json_match = re.search(r'```json\s*({.*?})\s*```', content, re.DOTALL)
        if json_match:
            workflow_data = json.loads(json_match.group(1))
        else:
            # Try parsing entire response as JSON
            workflow_data = json.loads(content)
        
        return {
            "success": True,
            "workflow": workflow_data,
            "message": "Workflow generated successfully. Review and save when ready."
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "message": "Could not generate workflow. Try being more specific."
        }

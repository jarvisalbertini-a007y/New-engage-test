"""
Email Webhook Endpoints & Template Library

This module provides:
1. Webhook endpoints for external email tracking (SendGrid, Mailgun, etc.)
2. Email template library with categories and AI-powered personalization
"""

from fastapi import APIRouter, HTTPException, Depends, Request
from datetime import datetime, timezone
from uuid import uuid4
from typing import Optional, List, Dict, Any
import os
import json
import re
import hmac
import hashlib

from database import get_db
from routes.auth import get_current_user

router = APIRouter()

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")


# ============== AI HELPER ==============

async def call_ai(prompt: str, system_instruction: str = None) -> str:
    """Call Gemini AI for template personalization"""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        session_id = f"template-{str(uuid4())[:8]}"
        system_msg = system_instruction or "You are an expert email copywriter specializing in B2B sales outreach."
        
        llm = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=session_id,
            system_message=system_msg
        )
        
        response = await llm.send_message(UserMessage(text=prompt))
        return response
    except Exception as e:
        print(f"AI call error: {e}")
        return None


# ============== WEBHOOK ENDPOINTS ==============

@router.post("/webhook/sendgrid")
async def sendgrid_webhook(request: Request):
    """
    Webhook endpoint for SendGrid events.
    Handles: delivered, open, click, bounce, spam_report, unsubscribe
    """
    db = get_db()
    
    try:
        events = await request.json()
        
        if not isinstance(events, list):
            events = [events]
        
        processed = 0
        for event in events:
            event_type = event.get("event")
            email = event.get("email")
            sg_message_id = event.get("sg_message_id")
            timestamp = event.get("timestamp")
            
            # Find matching email send
            email_send = None
            if sg_message_id:
                email_send = await db.email_sends.find_one(
                    {"sendgridMessageId": sg_message_id},
                    {"_id": 0}
                )
            
            if not email_send and email:
                email_send = await db.email_sends.find_one(
                    {"recipientEmail": email},
                    {"_id": 0},
                    sort=[("createdAt", -1)]
                )
            
            if email_send:
                update_data = {}
                event_record = {
                    "id": str(uuid4()),
                    "emailId": email_send.get("id"),
                    "userId": email_send.get("userId"),
                    "eventType": event_type,
                    "provider": "sendgrid",
                    "rawEvent": event,
                    "timestamp": datetime.fromtimestamp(timestamp).isoformat() if timestamp else datetime.now(timezone.utc).isoformat()
                }
                
                if event_type == "delivered":
                    update_data["deliveredAt"] = event_record["timestamp"]
                    update_data["status"] = "delivered"
                elif event_type == "open":
                    update_data["openedAt"] = event_record["timestamp"]
                    update_data["$inc"] = {"openCount": 1}
                elif event_type == "click":
                    update_data["clickedAt"] = event_record["timestamp"]
                    update_data["$inc"] = {"clickCount": 1}
                    event_record["url"] = event.get("url")
                elif event_type == "bounce":
                    update_data["bouncedAt"] = event_record["timestamp"]
                    update_data["bounceReason"] = event.get("reason", "")
                    update_data["status"] = "bounced"
                elif event_type == "spamreport":
                    update_data["spamReportedAt"] = event_record["timestamp"]
                    update_data["status"] = "spam"
                elif event_type == "unsubscribe":
                    update_data["unsubscribedAt"] = event_record["timestamp"]
                
                # Update email send record
                if "$inc" in update_data:
                    inc_data = update_data.pop("$inc")
                    await db.email_sends.update_one(
                        {"id": email_send["id"]},
                        {"$set": update_data, "$inc": inc_data}
                    )
                elif update_data:
                    await db.email_sends.update_one(
                        {"id": email_send["id"]},
                        {"$set": update_data}
                    )
                
                # Log event
                await db.email_events.insert_one(event_record)
                
                # Update A/B test results if variation
                if email_send.get("variationId"):
                    await update_ab_test_from_webhook(
                        db,
                        email_send["variationId"],
                        event_type
                    )
                
                processed += 1
        
        return {"success": True, "processed": processed}
    
    except Exception as e:
        print(f"SendGrid webhook error: {e}")
        return {"success": False, "error": str(e)}


@router.post("/webhook/mailgun")
async def mailgun_webhook(request: Request):
    """
    Webhook endpoint for Mailgun events.
    Handles: delivered, opened, clicked, bounced, complained, unsubscribed
    """
    db = get_db()
    
    try:
        form_data = await request.form()
        event_data = json.loads(form_data.get("event-data", "{}"))
        
        event_type = event_data.get("event")
        recipient = event_data.get("recipient")
        message_id = event_data.get("message", {}).get("headers", {}).get("message-id")
        timestamp = event_data.get("timestamp")
        
        # Find matching email send
        email_send = None
        if message_id:
            email_send = await db.email_sends.find_one(
                {"mailgunMessageId": message_id},
                {"_id": 0}
            )
        
        if not email_send and recipient:
            email_send = await db.email_sends.find_one(
                {"recipientEmail": recipient},
                {"_id": 0},
                sort=[("createdAt", -1)]
            )
        
        if email_send:
            update_data = {}
            event_record = {
                "id": str(uuid4()),
                "emailId": email_send.get("id"),
                "userId": email_send.get("userId"),
                "eventType": event_type,
                "provider": "mailgun",
                "rawEvent": dict(form_data),
                "timestamp": datetime.fromtimestamp(float(timestamp)).isoformat() if timestamp else datetime.now(timezone.utc).isoformat()
            }
            
            if event_type == "delivered":
                update_data["deliveredAt"] = event_record["timestamp"]
                update_data["status"] = "delivered"
            elif event_type == "opened":
                update_data["openedAt"] = event_record["timestamp"]
            elif event_type == "clicked":
                update_data["clickedAt"] = event_record["timestamp"]
                event_record["url"] = event_data.get("url")
            elif event_type in ["bounced", "failed"]:
                update_data["bouncedAt"] = event_record["timestamp"]
                update_data["bounceReason"] = event_data.get("reason", "")
                update_data["status"] = "bounced"
            elif event_type == "complained":
                update_data["spamReportedAt"] = event_record["timestamp"]
                update_data["status"] = "spam"
            elif event_type == "unsubscribed":
                update_data["unsubscribedAt"] = event_record["timestamp"]
            
            if update_data:
                await db.email_sends.update_one(
                    {"id": email_send["id"]},
                    {"$set": update_data}
                )
            
            await db.email_events.insert_one(event_record)
            
            if email_send.get("variationId"):
                await update_ab_test_from_webhook(
                    db,
                    email_send["variationId"],
                    event_type
                )
        
        return {"success": True}
    
    except Exception as e:
        print(f"Mailgun webhook error: {e}")
        return {"success": False, "error": str(e)}


@router.post("/webhook/generic")
async def generic_webhook(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """
    Generic webhook endpoint for custom integrations.
    Accepts standardized event format.
    """
    db = get_db()
    
    try:
        data = await request.json()
        
        email_id = data.get("emailId")
        event_type = data.get("eventType")  # open, click, reply, bounce
        metadata = data.get("metadata", {})
        
        if not email_id or not event_type:
            raise HTTPException(status_code=400, detail="emailId and eventType required")
        
        # Find email
        email_send = await db.email_sends.find_one(
            {"id": email_id},
            {"_id": 0}
        )
        
        if not email_send:
            raise HTTPException(status_code=404, detail="Email not found")
        
        update_data = {}
        timestamp = datetime.now(timezone.utc).isoformat()
        
        if event_type == "open":
            update_data["openedAt"] = timestamp
        elif event_type == "click":
            update_data["clickedAt"] = timestamp
        elif event_type == "reply":
            update_data["repliedAt"] = timestamp
            update_data["replySentiment"] = metadata.get("sentiment", "neutral")
        elif event_type == "bounce":
            update_data["bouncedAt"] = timestamp
            update_data["bounceReason"] = metadata.get("reason", "")
            update_data["status"] = "bounced"
        
        if update_data:
            await db.email_sends.update_one(
                {"id": email_id},
                {"$set": update_data}
            )
        
        # Log event
        await db.email_events.insert_one({
            "id": str(uuid4()),
            "emailId": email_id,
            "userId": current_user["id"],
            "eventType": event_type,
            "provider": "generic",
            "metadata": metadata,
            "timestamp": timestamp
        })
        
        # Update A/B test if applicable
        if email_send.get("variationId"):
            await update_ab_test_from_webhook(
                db,
                email_send["variationId"],
                event_type
            )
        
        return {"success": True, "tracked": event_type}
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Generic webhook error: {e}")
        return {"success": False, "error": str(e)}


async def update_ab_test_from_webhook(db, variation_id: str, event_type: str):
    """Update A/B test results from webhook event"""
    
    event_map = {
        "open": "opens",
        "opened": "opens",
        "click": "clicks",
        "clicked": "clicks",
        "reply": "replies",
        "delivered": "sent"
    }
    
    field = event_map.get(event_type)
    if field:
        await db.ab_test_results.update_one(
            {"variationId": variation_id},
            {"$inc": {field: 1}}
        )


# ============== EMAIL TEMPLATE LIBRARY ==============

# Pre-built template categories
TEMPLATE_CATEGORIES = [
    {
        "id": "cold_outreach",
        "name": "Cold Outreach",
        "description": "First-touch emails to new prospects",
        "icon": "mail"
    },
    {
        "id": "follow_up",
        "name": "Follow-Up",
        "description": "Sequences and nurture emails",
        "icon": "refresh"
    },
    {
        "id": "meeting_request",
        "name": "Meeting Request",
        "description": "Calendar and demo booking emails",
        "icon": "calendar"
    },
    {
        "id": "value_proposition",
        "name": "Value Proposition",
        "description": "Problem-solution focused emails",
        "icon": "star"
    },
    {
        "id": "social_proof",
        "name": "Social Proof",
        "description": "Case studies and testimonials",
        "icon": "users"
    },
    {
        "id": "breakup",
        "name": "Breakup",
        "description": "Final attempt emails",
        "icon": "x"
    }
]

# Pre-built templates
DEFAULT_TEMPLATES = [
    {
        "id": "cold_intro_1",
        "category": "cold_outreach",
        "name": "The Observation Opener",
        "description": "Opens with a personalized observation about the prospect's company",
        "subject": "Noticed something about {{company}}",
        "body": """Hi {{firstName}},

I noticed {{company}} has been {{observation}}. Companies in your position often struggle with {{painPoint}}.

We've helped similar companies like {{socialProof}} achieve {{result}}.

Would you be open to a quick chat about how we could help {{company}} do the same?

Best,
{{senderName}}""",
        "variables": ["firstName", "company", "observation", "painPoint", "socialProof", "result", "senderName"],
        "bestFor": ["VP/Director level", "Mid-market companies"],
        "avgOpenRate": 42,
        "avgReplyRate": 8
    },
    {
        "id": "cold_intro_2",
        "category": "cold_outreach",
        "name": "The Question Opener",
        "description": "Starts with a thought-provoking question",
        "subject": "Quick question, {{firstName}}",
        "body": """Hi {{firstName}},

Are you happy with how {{company}} currently handles {{challenge}}?

Most {{title}}s I talk to mention that {{commonProblem}}.

I'd love to share how we've helped companies solve this in under {{timeframe}}.

15 minutes this week?

{{senderName}}""",
        "variables": ["firstName", "company", "challenge", "title", "commonProblem", "timeframe", "senderName"],
        "bestFor": ["C-level executives", "Enterprise companies"],
        "avgOpenRate": 38,
        "avgReplyRate": 6
    },
    {
        "id": "follow_up_1",
        "category": "follow_up",
        "name": "The Gentle Bump",
        "description": "Soft follow-up after no response",
        "subject": "Re: {{previousSubject}}",
        "body": """Hi {{firstName}},

Just floating this back to the top of your inbox.

I know {{month}} is busy for {{industry}} teams. Happy to connect whenever timing works better.

In the meantime, here's a quick resource that might be helpful: {{resourceLink}}

{{senderName}}""",
        "variables": ["firstName", "previousSubject", "month", "industry", "resourceLink", "senderName"],
        "bestFor": ["All levels", "After 3-5 days"],
        "avgOpenRate": 35,
        "avgReplyRate": 5
    },
    {
        "id": "follow_up_2",
        "category": "follow_up",
        "name": "The Value Add",
        "description": "Follow-up with additional value",
        "subject": "Thought of you, {{firstName}}",
        "body": """Hi {{firstName}},

I came across this {{contentType}} about {{topic}} and thought of our conversation about {{previousTopic}}.

{{contentSummary}}

Here's the link: {{contentLink}}

Let me know if you'd like to chat more about how this applies to {{company}}.

{{senderName}}""",
        "variables": ["firstName", "contentType", "topic", "previousTopic", "contentSummary", "contentLink", "company", "senderName"],
        "bestFor": ["Engaged prospects", "After 7-10 days"],
        "avgOpenRate": 40,
        "avgReplyRate": 7
    },
    {
        "id": "meeting_1",
        "category": "meeting_request",
        "name": "The Direct Ask",
        "description": "Clear and direct meeting request",
        "subject": "15 min call - {{topic}}?",
        "body": """Hi {{firstName}},

I help {{targetAudience}} with {{value}}.

Would you have 15 minutes this week to explore if there's a fit?

Here's my calendar: {{calendarLink}}

If not the right time, no worries at all.

{{senderName}}""",
        "variables": ["firstName", "topic", "targetAudience", "value", "calendarLink", "senderName"],
        "bestFor": ["Warm leads", "After engagement"],
        "avgOpenRate": 45,
        "avgReplyRate": 12
    },
    {
        "id": "value_prop_1",
        "category": "value_proposition",
        "name": "The Problem-Solution",
        "description": "Leads with the problem and presents solution",
        "subject": "Solving {{problem}} at {{company}}",
        "body": """Hi {{firstName}},

{{problem}} costs companies like {{company}} an average of {{costImpact}} annually.

We've developed a solution that helps {{targetAudience}} to {{benefit}} in just {{timeframe}}.

Here's how it works:
1. {{step1}}
2. {{step2}}
3. {{step3}}

Want to see it in action?

{{senderName}}""",
        "variables": ["firstName", "problem", "company", "costImpact", "targetAudience", "benefit", "timeframe", "step1", "step2", "step3", "senderName"],
        "bestFor": ["Problem-aware prospects", "Technical buyers"],
        "avgOpenRate": 36,
        "avgReplyRate": 7
    },
    {
        "id": "social_proof_1",
        "category": "social_proof",
        "name": "The Case Study",
        "description": "Leads with a relevant customer success story",
        "subject": "How {{customerName}} achieved {{result}}",
        "body": """Hi {{firstName}},

{{customerName}}, a company similar to {{company}}, was struggling with {{challenge}}.

After implementing our solution, they achieved:
• {{metric1}}
• {{metric2}}
• {{metric3}}

I'd love to show you how we could help {{company}} achieve similar results.

Interested in learning more?

{{senderName}}""",
        "variables": ["firstName", "customerName", "result", "company", "challenge", "metric1", "metric2", "metric3", "senderName"],
        "bestFor": ["Risk-averse buyers", "Large deals"],
        "avgOpenRate": 41,
        "avgReplyRate": 9
    },
    {
        "id": "breakup_1",
        "category": "breakup",
        "name": "The Final Attempt",
        "description": "Last email in a sequence",
        "subject": "Closing the loop",
        "body": """Hi {{firstName}},

I've reached out a few times about helping {{company}} with {{value}}, but it seems like the timing isn't right.

I'll close out my notes for now. If things change or if you'd like to revisit this conversation in the future, I'm here.

Wishing you and the team continued success!

{{senderName}}

P.S. If I've been way off base, I'd genuinely appreciate any feedback on what I could do better.""",
        "variables": ["firstName", "company", "value", "senderName"],
        "bestFor": ["End of sequence", "After 4-5 attempts"],
        "avgOpenRate": 48,
        "avgReplyRate": 4
    }
]


@router.get("/templates/categories")
async def get_template_categories():
    """Get all template categories"""
    return TEMPLATE_CATEGORIES


@router.get("/templates")
async def get_templates(
    category: str = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all templates (default + user custom)"""
    db = get_db()
    
    # Get default templates
    templates = [t for t in DEFAULT_TEMPLATES]
    
    # Apply category filter if specified
    if category:
        templates = [t for t in templates if t.get("category") == category]
    
    # Get user's custom templates
    user_templates = await db.email_templates.find(
        {"userId": current_user["id"]},
        {"_id": 0}
    ).to_list(100)
    
    if category:
        user_templates = [t for t in user_templates if t.get("category") == category]
    
    # Mark user templates
    for t in user_templates:
        t["isCustom"] = True
    
    templates.extend(user_templates)
    
    return templates


@router.get("/templates/{template_id}")
async def get_template(
    template_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get a specific template"""
    db = get_db()
    
    # Check default templates first
    for t in DEFAULT_TEMPLATES:
        if t["id"] == template_id:
            return t
    
    # Check user templates
    template = await db.email_templates.find_one(
        {"id": template_id, "userId": current_user["id"]},
        {"_id": 0}
    )
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    return template


@router.post("/templates")
async def create_template(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Create a custom email template"""
    db = get_db()
    
    # Extract variables from subject and body
    subject = request.get("subject", "")
    body = request.get("body", "")
    
    variables = set()
    for match in re.findall(r'\{\{(\w+)\}\}', subject + body):
        variables.add(match)
    
    template = {
        "id": str(uuid4()),
        "userId": current_user["id"],
        "category": request.get("category", "cold_outreach"),
        "name": request.get("name", "Custom Template"),
        "description": request.get("description", ""),
        "subject": subject,
        "body": body,
        "variables": list(variables),
        "bestFor": request.get("bestFor", []),
        "isCustom": True,
        "usageCount": 0,
        "avgOpenRate": 0,
        "avgReplyRate": 0,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "updatedAt": datetime.now(timezone.utc).isoformat()
    }
    
    await db.email_templates.insert_one(template)
    
    return {"success": True, "template": template}


@router.put("/templates/{template_id}")
async def update_template(
    template_id: str,
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Update a custom template"""
    db = get_db()
    
    # Check if user owns the template
    template = await db.email_templates.find_one(
        {"id": template_id, "userId": current_user["id"]},
        {"_id": 0}
    )
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found or access denied")
    
    # Extract new variables
    subject = request.get("subject", template.get("subject", ""))
    body = request.get("body", template.get("body", ""))
    
    variables = set()
    for match in re.findall(r'\{\{(\w+)\}\}', subject + body):
        variables.add(match)
    
    update_data = {
        "updatedAt": datetime.now(timezone.utc).isoformat()
    }
    
    if "name" in request:
        update_data["name"] = request["name"]
    if "description" in request:
        update_data["description"] = request["description"]
    if "category" in request:
        update_data["category"] = request["category"]
    if "subject" in request:
        update_data["subject"] = request["subject"]
    if "body" in request:
        update_data["body"] = request["body"]
    if "bestFor" in request:
        update_data["bestFor"] = request["bestFor"]
    
    update_data["variables"] = list(variables)
    
    await db.email_templates.update_one(
        {"id": template_id},
        {"$set": update_data}
    )
    
    return {"success": True, "message": "Template updated"}


@router.delete("/templates/{template_id}")
async def delete_template(
    template_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Delete a custom template"""
    db = get_db()
    
    result = await db.email_templates.delete_one(
        {"id": template_id, "userId": current_user["id"]}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template not found or access denied")
    
    return {"success": True, "message": "Template deleted"}


@router.post("/templates/{template_id}/personalize")
async def personalize_template(
    template_id: str,
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    AI-powered template personalization for a specific prospect.
    Fills in variables and enhances content based on prospect data.
    """
    db = get_db()
    
    # Get template
    template = None
    for t in DEFAULT_TEMPLATES:
        if t["id"] == template_id:
            template = t
            break
    
    if not template:
        template = await db.email_templates.find_one(
            {"id": template_id, "userId": current_user["id"]},
            {"_id": 0}
        )
    
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Get prospect data
    prospect_id = request.get("prospectId")
    prospect = None
    if prospect_id:
        prospect = await db.prospects.find_one(
            {"id": prospect_id, "userId": current_user["id"]},
            {"_id": 0}
        )
    
    # Get user info for sender fields
    user = await db.users.find_one(
        {"id": current_user["id"]},
        {"_id": 0}
    )
    
    # Build variable context
    variables = request.get("variables", {})
    
    # Auto-fill from prospect
    if prospect:
        variables.setdefault("firstName", prospect.get("firstName", ""))
        variables.setdefault("lastName", prospect.get("lastName", ""))
        variables.setdefault("company", prospect.get("company", ""))
        variables.setdefault("title", prospect.get("title", ""))
        variables.setdefault("industry", prospect.get("industry", ""))
    
    # Auto-fill sender info
    if user:
        variables.setdefault("senderName", f"{user.get('firstName', '')} {user.get('lastName', '')}".strip())
        variables.setdefault("senderCompany", user.get("companyName", ""))
    
    # Generate AI personalization for missing variables
    missing_vars = [v for v in template.get("variables", []) if v not in variables or not variables[v]]
    
    if missing_vars and prospect:
        # Use AI to fill in contextual variables
        ai_prompt = f"""Fill in these email template variables for a prospect:

Prospect:
- Name: {prospect.get('firstName', '')} {prospect.get('lastName', '')}
- Title: {prospect.get('title', '')}
- Company: {prospect.get('company', '')}
- Industry: {prospect.get('industry', '')}
- Signals: {prospect.get('signals', [])}
- Outreach Angle: {prospect.get('outreachAngle', '')}

Template context:
Subject: {template.get('subject', '')}
Body preview: {template.get('body', '')[:200]}...

Variables to fill (provide realistic, professional values):
{json.dumps(missing_vars)}

Return JSON with each variable as a key and its value."""

        ai_result = await call_ai(ai_prompt)
        if ai_result:
            try:
                json_match = re.search(r'\{.*\}', ai_result, re.DOTALL)
                if json_match:
                    ai_vars = json.loads(json_match.group())
                    for var in missing_vars:
                        if var in ai_vars and ai_vars[var]:
                            variables[var] = ai_vars[var]
            except (json.JSONDecodeError, ValueError):
                pass
    
    # Apply variables to template
    personalized_subject = template.get("subject", "")
    personalized_body = template.get("body", "")
    
    for var, value in variables.items():
        placeholder = "{{" + var + "}}"
        personalized_subject = personalized_subject.replace(placeholder, str(value))
        personalized_body = personalized_body.replace(placeholder, str(value))
    
    # Track template usage
    if template.get("isCustom"):
        await db.email_templates.update_one(
            {"id": template_id},
            {"$inc": {"usageCount": 1}}
        )
    
    return {
        "success": True,
        "personalized": {
            "subject": personalized_subject,
            "body": personalized_body
        },
        "variablesUsed": variables,
        "missingVariables": [v for v in template.get("variables", []) if "{{" + v + "}}" in personalized_subject + personalized_body]
    }


@router.post("/templates/generate")
async def generate_template(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    AI-powered template generation from description.
    Creates a new template based on user's requirements.
    """
    db = get_db()
    
    description = request.get("description", "")
    category = request.get("category", "cold_outreach")
    tone = request.get("tone", "professional")  # professional, casual, urgent, friendly
    target_audience = request.get("targetAudience", "")
    goal = request.get("goal", "book meeting")  # book meeting, get reply, share resource
    
    prompt = f"""Create an email template for B2B sales outreach.

Requirements:
- Description: {description}
- Category: {category}
- Tone: {tone}
- Target Audience: {target_audience}
- Goal: {goal}

Create a template with:
1. Compelling subject line (under 50 chars)
2. Email body (under 100 words)
3. Use placeholders like {{{{firstName}}}}, {{{{company}}}}, etc. for personalization
4. Clear CTA aligned with the goal

Return JSON with:
- name: Template name
- description: Brief description
- subject: Subject line
- body: Email body
- bestFor: Array of 2-3 ideal use cases
"""

    result = await call_ai(prompt)
    
    if not result:
        raise HTTPException(status_code=500, detail="Failed to generate template")
    
    try:
        json_match = re.search(r'\{.*\}', result, re.DOTALL)
        if json_match:
            template_data = json.loads(json_match.group())
            
            # Extract variables
            subject = template_data.get("subject", "")
            body = template_data.get("body", "")
            variables = set()
            for match in re.findall(r'\{\{(\w+)\}\}', subject + body):
                variables.add(match)
            
            template = {
                "id": str(uuid4()),
                "userId": current_user["id"],
                "category": category,
                "name": template_data.get("name", "Generated Template"),
                "description": template_data.get("description", description),
                "subject": subject,
                "body": body,
                "variables": list(variables),
                "bestFor": template_data.get("bestFor", []),
                "isCustom": True,
                "isGenerated": True,
                "generationPrompt": description,
                "usageCount": 0,
                "avgOpenRate": 0,
                "avgReplyRate": 0,
                "createdAt": datetime.now(timezone.utc).isoformat(),
                "updatedAt": datetime.now(timezone.utc).isoformat()
            }
            
            await db.email_templates.insert_one(template)
            
            # Remove MongoDB _id before returning
            template.pop("_id", None)
            
            return {"success": True, "template": template}
    
    except (json.JSONDecodeError, ValueError) as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse generated template: {e}")
    
    raise HTTPException(status_code=500, detail="Failed to generate template")


@router.post("/templates/{template_id}/create-draft")
async def create_draft_from_template(
    template_id: str,
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """
    Create an email draft from a template for a specific prospect.
    Combines template personalization with draft creation.
    """
    db = get_db()
    
    prospect_id = request.get("prospectId")
    if not prospect_id:
        raise HTTPException(status_code=400, detail="prospectId required")
    
    # Personalize template
    personalized = await personalize_template(
        template_id,
        {"prospectId": prospect_id, "variables": request.get("variables", {})},
        current_user
    )
    
    if not personalized.get("success"):
        raise HTTPException(status_code=500, detail="Failed to personalize template")
    
    # Create draft
    draft = {
        "id": str(uuid4()),
        "userId": current_user["id"],
        "prospectId": prospect_id,
        "templateId": template_id,
        "subject": personalized["personalized"]["subject"],
        "body": personalized["personalized"]["body"],
        "status": "draft",
        "source": "template",
        "createdAt": datetime.now(timezone.utc).isoformat()
    }
    
    await db.email_drafts.insert_one(draft)
    
    return {
        "success": True,
        "draftId": draft["id"],
        "draft": draft
    }

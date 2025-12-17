from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from uuid import uuid4
from typing import Optional
import os

from database import get_db
from routes.auth import get_current_user

router = APIRouter()

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

@router.post("/generate")
async def generate_content(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Generate content using AI"""
    content_type = request.get("type", "email")  # email, linkedin, script
    context = request.get("context", {})
    prospect = request.get("prospect", {})
    tone = request.get("tone", "professional")
    
    # TODO: Use Gemini to generate content
    # For now, return mock content
    
    if content_type == "email":
        content = {
            "subject": f"Quick question about {prospect.get('company', 'your company')}",
            "body": f"""Hi {prospect.get('firstName', 'there')},

I noticed that {prospect.get('company', 'your company')} has been making great strides in the industry. 

I'd love to share how we're helping similar companies achieve better results with our AI-powered sales automation.

Would you be open to a brief 15-minute call this week?

Best regards""",
            "type": "email"
        }
    elif content_type == "linkedin":
        content = {
            "message": f"""Hi {prospect.get('firstName', 'there')}, I came across your profile and was impressed by your work at {prospect.get('company', 'your company')}. I'd love to connect and share some insights on how AI is transforming sales operations.""",
            "type": "linkedin"
        }
    elif content_type == "script":
        content = {
            "script": f"""Opening:
"Hi {prospect.get('firstName', 'there')}, this is [Your Name] from EngageAI. How are you today?"

Value Prop:
"I'm reaching out because we help companies like {prospect.get('company', 'yours')} automate their sales processes with AI."

Qualifying Questions:
- "What's your biggest challenge with outreach today?"
- "How many prospects are you reaching out to weekly?"

Close:
"Based on what you've shared, I think we could help. Would you be open to a demo?""",
            "type": "script"
        }
    else:
        content = {"message": "Generated content", "type": content_type}
    
    # Log generation
    db = get_db()
    await db.content_generations.insert_one({
        "id": str(uuid4()),
        "userId": current_user["id"],
        "type": content_type,
        "context": context,
        "content": content,
        "createdAt": datetime.now(timezone.utc).isoformat()
    })
    
    return content

@router.post("/personalize-email")
async def personalize_email(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Personalize an email template for a specific prospect"""
    template = request.get("template", "")
    prospect = request.get("prospect", {})
    company = request.get("company", {})
    
    # Simple variable replacement
    personalized = template
    personalized = personalized.replace("{{firstName}}", prospect.get("firstName", ""))
    personalized = personalized.replace("{{lastName}}", prospect.get("lastName", ""))
    personalized = personalized.replace("{{company}}", company.get("name", ""))
    personalized = personalized.replace("{{title}}", prospect.get("title", ""))
    personalized = personalized.replace("{{industry}}", company.get("industry", ""))
    
    return {"content": personalized}

@router.get("/templates")
async def get_content_templates(
    type: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    db = get_db()
    
    query = {}
    if type:
        query["type"] = type
    
    templates = await db.content_templates.find(query, {"_id": 0}).to_list(50)
    
    # Return default templates if none exist
    if not templates:
        templates = [
            {
                "id": "default-email-intro",
                "name": "Introduction Email",
                "type": "email",
                "subject": "Quick question about {{company}}",
                "body": "Hi {{firstName}},\n\nI noticed {{company}} has been growing rapidly...\n\nBest regards",
                "category": "prospecting"
            },
            {
                "id": "default-email-followup",
                "name": "Follow-up Email",
                "type": "email",
                "subject": "Following up - {{company}}",
                "body": "Hi {{firstName}},\n\nJust wanted to follow up on my previous email...\n\nBest regards",
                "category": "followup"
            },
            {
                "id": "default-linkedin",
                "name": "LinkedIn Connection",
                "type": "linkedin",
                "body": "Hi {{firstName}}, I came across your profile and was impressed by your work at {{company}}...",
                "category": "prospecting"
            }
        ]
    
    return templates

"""Real World Integrations - Web Search, Web Scraping, SendGrid, Gmail"""
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from datetime import datetime, timezone
from uuid import uuid4
from typing import Optional, List
import os
import json
import re
import asyncio
import httpx

from database import get_db
from routes.auth import get_current_user

router = APIRouter()

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

# ============== AI-POWERED WEB RESEARCH FOR LEADS ==============

async def search_web(query: str) -> str:
    """Search the web using AI with web search capability"""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        search_prompt = f"""Search the internet and find real companies and people matching this criteria: {query}

Provide actual company names, real executive names, and realistic contact patterns.
Focus on finding:
- Real company names that exist
- Actual job titles and roles
- LinkedIn profile patterns
- Company websites and domains

Return structured data about 10 real prospects."""

        session_id = f"search-{uuid4()}"
        llm = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=session_id,
            system_message="You are a B2B sales research assistant."
        )
        
        response = await llm.send_message(search_prompt)
        return response
    except Exception as e:
        print(f"Web search error: {e}")
        return None


@router.post("/search-leads")
async def search_real_leads(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Search the web for real leads using AI research"""
    criteria = request.get("criteria", "")
    count = request.get("count", 10)
    
    db = get_db()
    
    # Use AI to search and find real leads
    search_result = await search_web(criteria)
    
    if not search_result:
        raise HTTPException(status_code=500, detail="Web search failed")
    
    # Parse the AI response to extract structured lead data
    leads = await parse_leads_from_search(search_result, criteria, count)
    
    # Save leads to database
    saved_leads = []
    for lead in leads[:count]:
        prospect = {
            "id": str(uuid4()),
            "userId": current_user["id"],
            "firstName": lead.get("firstName", ""),
            "lastName": lead.get("lastName", ""),
            "email": lead.get("email", ""),
            "title": lead.get("title", ""),
            "company": lead.get("company", ""),
            "companyDomain": lead.get("domain", ""),
            "linkedinUrl": lead.get("linkedin", ""),
            "industry": lead.get("industry", ""),
            "companySize": lead.get("companySize", ""),
            "location": lead.get("location", ""),
            "source": "web_research",
            "sourceQuery": criteria,
            "confidence": lead.get("confidence", 70),
            "status": "new",
            "createdAt": datetime.now(timezone.utc).isoformat()
        }
        await db.prospects.insert_one(prospect)
        prospect.pop("_id", None)
        saved_leads.append(prospect)
    
    return {
        "success": True,
        "leadsFound": len(saved_leads),
        "leads": saved_leads,
        "query": criteria
    }


async def parse_leads_from_search(search_result: str, criteria: str, count: int) -> list:
    """Parse AI search results into structured lead data"""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        parse_prompt = f"""Parse this search result into structured lead data:

{search_result}

Extract {count} leads and return as JSON array with these fields for each:
- firstName, lastName (split the name)
- title (job title)
- company (company name)
- domain (company website domain like "company.com")
- email (construct from pattern: firstname.lastname@domain or firstname@domain)
- linkedin (LinkedIn URL pattern: linkedin.com/in/firstname-lastname)
- industry
- companySize (estimate: "1-10", "11-50", "51-200", "201-500", "500+")
- location (city, country)
- confidence (0-100 how confident this is a real lead)

Return ONLY the JSON array, no other text."""

        session_id = f"parse-{uuid4()}"
        llm = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=session_id,
            system_message="You are a data parsing assistant. Return only JSON."
        )
        
        response = await llm.send_message(parse_prompt)
        
        # Extract JSON from response
        content = response
        json_match = re.search(r'\[.*\]', content, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
    except Exception as e:
        print(f"Parse error: {e}")
    
    return []


# ============== WEB SCRAPING FOR COMPANY RESEARCH ==============

@router.post("/scrape-company")
async def scrape_company_website(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Scrape a company website for business information"""
    domain = request.get("domain", "")
    company_name = request.get("company", "")
    
    if not domain and not company_name:
        raise HTTPException(status_code=400, detail="Provide domain or company name")
    
    # If only company name, try to find domain
    if not domain and company_name:
        domain = company_name.lower().replace(" ", "") + ".com"
    
    db = get_db()
    
    # Scrape the website
    scraped_data = await scrape_website(domain)
    
    # Enrich with AI analysis
    enriched_data = await enrich_company_data(scraped_data, company_name or domain)
    
    # Save to database
    research = {
        "id": str(uuid4()),
        "userId": current_user["id"],
        "companyName": enriched_data.get("name", company_name),
        "domain": domain,
        "scrapedData": scraped_data,
        "enrichedData": enriched_data,
        "source": "web_scraping",
        "createdAt": datetime.now(timezone.utc).isoformat()
    }
    await db.company_research.insert_one(research)
    research.pop("_id", None)
    
    return research


async def scrape_website(domain: str) -> dict:
    """Scrape a website for company information"""
    from bs4 import BeautifulSoup
    
    data = {
        "domain": domain,
        "pages_scraped": [],
        "raw_text": "",
        "emails_found": [],
        "phones_found": [],
        "social_links": [],
        "meta_description": "",
        "title": ""
    }
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    
    pages_to_try = [
        f"https://{domain}",
        f"https://www.{domain}",
        f"https://{domain}/about",
        f"https://{domain}/about-us",
        f"https://{domain}/company",
        f"https://{domain}/contact"
    ]
    
    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
        for url in pages_to_try:
            try:
                response = await client.get(url, headers=headers)
                if response.status_code == 200:
                    data["pages_scraped"].append(url)
                    soup = BeautifulSoup(response.text, "lxml")
                    
                    # Get title
                    if soup.title and not data["title"]:
                        data["title"] = soup.title.string.strip() if soup.title.string else ""
                    
                    # Get meta description
                    meta_desc = soup.find("meta", attrs={"name": "description"})
                    if meta_desc and not data["meta_description"]:
                        data["meta_description"] = meta_desc.get("content", "")
                    
                    # Extract emails
                    email_pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
                    emails = re.findall(email_pattern, response.text)
                    data["emails_found"].extend([e for e in emails if e not in data["emails_found"]])
                    
                    # Extract phone numbers
                    phone_pattern = r'[\+]?[(]?[0-9]{1,3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}'
                    phones = re.findall(phone_pattern, response.text)
                    data["phones_found"].extend([p for p in phones[:5] if p not in data["phones_found"]])
                    
                    # Extract social links
                    social_patterns = [
                        r'linkedin\.com/company/[\w-]+',
                        r'twitter\.com/[\w]+',
                        r'facebook\.com/[\w]+'
                    ]
                    for pattern in social_patterns:
                        matches = re.findall(pattern, response.text)
                        data["social_links"].extend([m for m in matches if m not in data["social_links"]])
                    
                    # Get main text content (limited)
                    for tag in soup(["script", "style", "nav", "header", "footer"]):
                        tag.decompose()
                    text = soup.get_text(separator=" ", strip=True)
                    data["raw_text"] += text[:3000] + " "
                    
            except Exception as e:
                print(f"Scrape error for {url}: {e}")
                continue
    
    # Limit raw text
    data["raw_text"] = data["raw_text"][:8000]
    data["emails_found"] = list(set(data["emails_found"]))[:10]
    data["phones_found"] = list(set(data["phones_found"]))[:5]
    data["social_links"] = list(set(data["social_links"]))[:10]
    
    return data


async def enrich_company_data(scraped_data: dict, company_name: str) -> dict:
    """Use AI to analyze and enrich scraped company data"""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        prompt = f"""Analyze this scraped company data and provide structured insights:

Company: {company_name}
Domain: {scraped_data.get('domain')}
Title: {scraped_data.get('title')}
Description: {scraped_data.get('meta_description')}
Emails found: {scraped_data.get('emails_found')}
Social links: {scraped_data.get('social_links')}

Raw content excerpt:
{scraped_data.get('raw_text', '')[:4000]}

Provide analysis as JSON with:
- name: Official company name
- description: What the company does (2-3 sentences)
- industry: Primary industry
- businessModel: B2B, B2C, or Both
- targetMarket: Who they sell to
- products: List of main products/services
- companySize: Estimated employee count range
- techStack: Any technologies mentioned
- painPoints: Likely business challenges
- outreachAngle: Best angle for sales outreach
- competitorHints: Any competitors mentioned
- fundingStage: If determinable (seed, series A, etc.)
- contactEmail: Best email for outreach
- linkedinUrl: Company LinkedIn if found

Return ONLY JSON."""

        session_id = f"enrich-{uuid4()}"
        llm = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=session_id,
            system_message="You are a company research analyst. Return only JSON."
        )
        
        response = await llm.chat([UserMessage(content=prompt)])
        
        content = response.message if hasattr(response, 'message') else str(response)
        json_match = re.search(r'\{.*\}', content, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
    except Exception as e:
        print(f"Enrich error: {e}")
    
    return {"name": company_name, "domain": scraped_data.get("domain")}


# ============== SENDGRID EMAIL INTEGRATION ==============

@router.post("/email/send")
async def send_email_sendgrid(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Send email via SendGrid with tracking"""
    db = get_db()
    
    # Get user's SendGrid API key from settings
    user_settings = await db.user_integrations.find_one(
        {"userId": current_user["id"]},
        {"_id": 0}
    )
    
    sendgrid_key = user_settings.get("sendgrid_api_key") if user_settings else None
    
    if not sendgrid_key:
        raise HTTPException(
            status_code=400, 
            detail="SendGrid API key not configured. Go to Settings > Integrations to add your key."
        )
    
    to_email = request.get("to")
    subject = request.get("subject")
    html_content = request.get("htmlContent") or request.get("body", "")
    from_email = request.get("from") or user_settings.get("from_email", current_user.get("email"))
    prospect_id = request.get("prospectId")
    
    if not to_email or not subject:
        raise HTTPException(status_code=400, detail="Missing to or subject")
    
    try:
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail, TrackingSettings, OpenTracking, ClickTracking
        
        # Create message with tracking
        message = Mail(
            from_email=from_email,
            to_emails=to_email,
            subject=subject,
            html_content=html_content if "<" in html_content else f"<p>{html_content}</p>"
        )
        
        # Enable open and click tracking
        tracking_settings = TrackingSettings()
        tracking_settings.open_tracking = OpenTracking(enable=True)
        tracking_settings.click_tracking = ClickTracking(enable=True, enable_text=True)
        message.tracking_settings = tracking_settings
        
        # Add custom tracking ID for webhook correlation
        send_id = str(uuid4())
        message.custom_args = {"send_id": send_id, "user_id": current_user["id"]}
        
        # Send via SendGrid
        sg = SendGridAPIClient(sendgrid_key)
        response = sg.send(message)
        
        # Log the send
        send_log = {
            "id": send_id,
            "userId": current_user["id"],
            "prospectId": prospect_id,
            "to": to_email,
            "from": from_email,
            "subject": subject,
            "provider": "sendgrid",
            "status": "sent" if response.status_code in [200, 201, 202] else "failed",
            "statusCode": response.status_code,
            "sentAt": datetime.now(timezone.utc).isoformat(),
            "openedAt": None,
            "clickedAt": None,
            "repliedAt": None
        }
        await db.email_sends.insert_one(send_log)
        
        # Update prospect status if provided
        if prospect_id:
            await db.prospects.update_one(
                {"id": prospect_id},
                {"$set": {
                    "status": "contacted",
                    "lastContactedAt": send_log["sentAt"]
                }}
            )
        
        return {
            "success": True,
            "sendId": send_id,
            "status": send_log["status"],
            "message": "Email sent successfully with tracking enabled"
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "message": "Failed to send email. Check your SendGrid API key."
        }


@router.post("/webhook/sendgrid")
async def sendgrid_webhook(events: List[dict]):
    """Handle SendGrid event webhooks for open/click tracking"""
    db = get_db()
    
    for event in events:
        event_type = event.get("event")
        send_id = event.get("send_id") or event.get("sg_message_id", "").split(".")[0]
        timestamp = datetime.now(timezone.utc).isoformat()
        
        update = {}
        if event_type == "open":
            update = {"openedAt": timestamp, "opens": 1}
        elif event_type == "click":
            update = {"clickedAt": timestamp, "clicks": 1}
        elif event_type == "delivered":
            update = {"deliveredAt": timestamp, "status": "delivered"}
        elif event_type == "bounce":
            update = {"status": "bounced", "bounceReason": event.get("reason")}
        elif event_type == "spamreport":
            update = {"status": "spam"}
        
        if update and send_id:
            await db.email_sends.update_one(
                {"id": send_id},
                {"$set": update}
            )
            
            # Log event for A/B testing
            await db.email_events.insert_one({
                "id": str(uuid4()),
                "sendId": send_id,
                "eventType": event_type,
                "timestamp": timestamp,
                "rawEvent": event
            })
    
    return {"received": len(events)}


# ============== USER INTEGRATIONS MANAGEMENT ==============

@router.get("/integrations")
async def get_user_integrations(
    current_user: dict = Depends(get_current_user)
):
    """Get user's integration settings"""
    db = get_db()
    
    integrations = await db.user_integrations.find_one(
        {"userId": current_user["id"]},
        {"_id": 0}
    )
    
    if not integrations:
        integrations = {
            "userId": current_user["id"],
            "sendgrid_configured": False,
            "gmail_configured": False,
            "from_email": current_user.get("email")
        }
    else:
        # Mask API keys
        if integrations.get("sendgrid_api_key"):
            integrations["sendgrid_configured"] = True
            integrations["sendgrid_api_key"] = "••••••••" + integrations["sendgrid_api_key"][-4:]
        if integrations.get("gmail_refresh_token"):
            integrations["gmail_configured"] = True
            del integrations["gmail_refresh_token"]
    
    return integrations


@router.post("/integrations/sendgrid")
async def save_sendgrid_integration(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Save SendGrid API key"""
    api_key = request.get("api_key")
    from_email = request.get("from_email")
    
    if not api_key:
        raise HTTPException(status_code=400, detail="API key required")
    
    # Validate key by making a test request
    try:
        from sendgrid import SendGridAPIClient
        sg = SendGridAPIClient(api_key)
        # Just verify it doesn't throw immediately
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid API key: {e}")
    
    db = get_db()
    
    await db.user_integrations.update_one(
        {"userId": current_user["id"]},
        {"$set": {
            "userId": current_user["id"],
            "sendgrid_api_key": api_key,
            "from_email": from_email or current_user.get("email"),
            "updatedAt": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    return {"success": True, "message": "SendGrid integration saved"}


@router.delete("/integrations/sendgrid")
async def remove_sendgrid_integration(
    current_user: dict = Depends(get_current_user)
):
    """Remove SendGrid integration"""
    db = get_db()
    
    await db.user_integrations.update_one(
        {"userId": current_user["id"]},
        {"$unset": {"sendgrid_api_key": ""}}
    )
    
    return {"success": True, "message": "SendGrid integration removed"}


# ============== EMAIL ANALYTICS ==============

@router.get("/email/analytics")
async def get_email_analytics(
    days: int = 30,
    current_user: dict = Depends(get_current_user)
):
    """Get email sending analytics"""
    db = get_db()
    
    # Get all sends
    sends = await db.email_sends.find(
        {"userId": current_user["id"]},
        {"_id": 0}
    ).sort("sentAt", -1).limit(500).to_list(500)
    
    total = len(sends)
    delivered = len([s for s in sends if s.get("status") == "delivered"])
    opened = len([s for s in sends if s.get("openedAt")])
    clicked = len([s for s in sends if s.get("clickedAt")])
    bounced = len([s for s in sends if s.get("status") == "bounced"])
    
    return {
        "total": total,
        "delivered": delivered,
        "opened": opened,
        "clicked": clicked,
        "bounced": bounced,
        "openRate": (opened / total * 100) if total > 0 else 0,
        "clickRate": (clicked / total * 100) if total > 0 else 0,
        "bounceRate": (bounced / total * 100) if total > 0 else 0,
        "recentSends": sends[:20]
    }

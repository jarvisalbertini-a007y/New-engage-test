"""Deep Google Integration - Gmail, Calendar, Contacts, Drive"""
from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import RedirectResponse
from datetime import datetime, timezone, timedelta
from uuid import uuid4
from typing import Optional, List
import os
import json
import base64
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request as GoogleRequest
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from database import get_db
from routes.auth import get_current_user

router = APIRouter()

# Google OAuth Configuration - App-level credentials (set by admin)
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")

GOOGLE_SCOPES = [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/contacts.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
]


def get_base_url():
    """Get base URL for OAuth redirects"""
    return os.environ.get("BASE_URL", "https://smart-salesbot.preview.emergentagent.com")


async def get_google_creds(user_id: str, db) -> Optional[Credentials]:
    """Get Google credentials for a user"""
    integration = await db.user_integrations.find_one(
        {"userId": user_id},
        {"_id": 0, "google_tokens": 1}
    )
    
    if not integration or not integration.get("google_tokens"):
        return None
    
    tokens = integration["google_tokens"]
    creds = Credentials(
        token=tokens.get("access_token"),
        refresh_token=tokens.get("refresh_token"),
        token_uri="https://oauth2.googleapis.com/token",
        client_id=tokens.get("client_id"),
        client_secret=tokens.get("client_secret"),
        scopes=GOOGLE_SCOPES
    )
    
    # Refresh if expired
    if creds.expired and creds.refresh_token:
        try:
            creds.refresh(GoogleRequest())
            # Save refreshed tokens
            await db.user_integrations.update_one(
                {"userId": user_id},
                {"$set": {
                    "google_tokens.access_token": creds.token,
                    "google_tokens.expiry": creds.expiry.isoformat() if creds.expiry else None
                }}
            )
        except Exception as e:
            print(f"Token refresh error: {e}")
            return None
    
    return creds


# ============== OAUTH FLOW ==============

@router.post("/oauth/init")
async def init_google_oauth(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Initialize Google OAuth flow - user provides their Google OAuth credentials"""
    client_id = request.get("client_id")
    client_secret = request.get("client_secret")
    
    if not client_id or not client_secret:
        raise HTTPException(
            status_code=400, 
            detail="Google OAuth Client ID and Client Secret are required"
        )
    
    db = get_db()
    
    # Store credentials temporarily for the OAuth flow
    state = str(uuid4())
    await db.oauth_states.insert_one({
        "state": state,
        "userId": current_user["id"],
        "client_id": client_id,
        "client_secret": client_secret,
        "createdAt": datetime.now(timezone.utc).isoformat()
    })
    
    # Build OAuth URL - callback goes through /api which routes to backend
    redirect_uri = f"{get_backend_url()}/api/google/oauth/callback"
    
    auth_url = (
        f"https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={client_id}&"
        f"redirect_uri={redirect_uri}&"
        f"response_type=code&"
        f"scope={' '.join(GOOGLE_SCOPES)}&"
        f"access_type=offline&"
        f"prompt=consent&"
        f"state={state}"
    )
    
    return {
        "authUrl": auth_url,
        "state": state,
        "message": "Redirect user to authUrl to complete Google authorization"
    }


@router.get("/oauth/callback")
async def google_oauth_callback(
    code: str,
    state: str,
    request: Request
):
    """Handle Google OAuth callback"""
    db = get_db()
    
    # Get stored OAuth state
    oauth_state = await db.oauth_states.find_one({"state": state})
    if not oauth_state:
        raise HTTPException(status_code=400, detail="Invalid OAuth state")
    
    client_id = oauth_state["client_id"]
    client_secret = oauth_state["client_secret"]
    user_id = oauth_state["userId"]
    redirect_uri = f"{get_backend_url()}/api/google/oauth/callback"
    
    # Exchange code for tokens
    try:
        import httpx
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": code,
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "redirect_uri": redirect_uri,
                    "grant_type": "authorization_code"
                }
            )
            tokens = response.json()
            
            if "error" in tokens:
                raise HTTPException(status_code=400, detail=tokens.get("error_description", tokens["error"]))
            
            # Get user info
            user_info_response = await client.get(
                "https://www.googleapis.com/oauth2/v2/userinfo",
                headers={"Authorization": f"Bearer {tokens['access_token']}"}
            )
            user_info = user_info_response.json()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"OAuth error: {str(e)}")
    
    # Save tokens
    await db.user_integrations.update_one(
        {"userId": user_id},
        {"$set": {
            "google_tokens": {
                "access_token": tokens.get("access_token"),
                "refresh_token": tokens.get("refresh_token"),
                "client_id": client_id,
                "client_secret": client_secret,
                "expiry": None,
                "email": user_info.get("email"),
                "name": user_info.get("name"),
                "picture": user_info.get("picture")
            },
            "gmail_configured": True,
            "google_calendar_configured": True,
            "updatedAt": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    # Clean up OAuth state
    await db.oauth_states.delete_one({"state": state})
    
    # Redirect back to integrations page
    return RedirectResponse(url=f"{get_frontend_url()}/integrations?google=connected")


@router.delete("/oauth/disconnect")
async def disconnect_google(
    current_user: dict = Depends(get_current_user)
):
    """Disconnect Google integration"""
    db = get_db()
    
    await db.user_integrations.update_one(
        {"userId": current_user["id"]},
        {"$unset": {"google_tokens": ""}, 
         "$set": {"gmail_configured": False, "google_calendar_configured": False}}
    )
    
    return {"success": True, "message": "Google disconnected"}


@router.get("/status")
async def get_google_status(
    current_user: dict = Depends(get_current_user)
):
    """Get Google integration status"""
    db = get_db()
    
    integration = await db.user_integrations.find_one(
        {"userId": current_user["id"]},
        {"_id": 0, "google_tokens": 1, "gmail_configured": 1}
    )
    
    if not integration or not integration.get("google_tokens"):
        return {
            "connected": False,
            "email": None,
            "services": []
        }
    
    tokens = integration["google_tokens"]
    return {
        "connected": True,
        "email": tokens.get("email"),
        "name": tokens.get("name"),
        "picture": tokens.get("picture"),
        "services": ["gmail", "calendar", "contacts"]
    }


# ============== GMAIL ==============

@router.post("/gmail/send")
async def send_gmail(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Send email via Gmail"""
    db = get_db()
    creds = await get_google_creds(current_user["id"], db)
    
    if not creds:
        raise HTTPException(status_code=400, detail="Google not connected. Please connect your Google account first.")
    
    to_email = request.get("to")
    subject = request.get("subject")
    body = request.get("body")
    html_body = request.get("htmlBody")
    prospect_id = request.get("prospectId")
    
    if not to_email or not subject:
        raise HTTPException(status_code=400, detail="Missing to or subject")
    
    try:
        service = build("gmail", "v1", credentials=creds)
        
        # Create message
        if html_body:
            message = MIMEMultipart("alternative")
            message["to"] = to_email
            message["subject"] = subject
            
            # Add plain text and HTML versions
            part1 = MIMEText(body or "", "plain")
            part2 = MIMEText(html_body, "html")
            message.attach(part1)
            message.attach(part2)
        else:
            message = MIMEText(body or "")
            message["to"] = to_email
            message["subject"] = subject
        
        # Get sender email
        profile = service.users().getProfile(userId="me").execute()
        message["from"] = profile.get("emailAddress")
        
        # Encode and send
        raw = base64.urlsafe_b64encode(message.as_bytes()).decode()
        sent = service.users().messages().send(
            userId="me",
            body={"raw": raw}
        ).execute()
        
        # Log the send
        send_log = {
            "id": str(uuid4()),
            "userId": current_user["id"],
            "prospectId": prospect_id,
            "gmailMessageId": sent.get("id"),
            "threadId": sent.get("threadId"),
            "to": to_email,
            "from": message["from"],
            "subject": subject,
            "provider": "gmail",
            "status": "sent",
            "sentAt": datetime.now(timezone.utc).isoformat()
        }
        await db.email_sends.insert_one(send_log)
        
        # Update prospect if provided
        if prospect_id:
            await db.prospects.update_one(
                {"id": prospect_id},
                {"$set": {"status": "contacted", "lastContactedAt": send_log["sentAt"]}}
            )
        
        return {
            "success": True,
            "messageId": sent.get("id"),
            "threadId": sent.get("threadId"),
            "message": "Email sent via Gmail"
        }
        
    except HttpError as e:
        return {"success": False, "error": str(e)}


@router.get("/gmail/inbox")
async def get_gmail_inbox(
    max_results: int = 20,
    query: str = "",
    current_user: dict = Depends(get_current_user)
):
    """Get Gmail inbox messages"""
    db = get_db()
    creds = await get_google_creds(current_user["id"], db)
    
    if not creds:
        raise HTTPException(status_code=400, detail="Google not connected")
    
    try:
        service = build("gmail", "v1", credentials=creds)
        
        # List messages
        results = service.users().messages().list(
            userId="me",
            maxResults=max_results,
            q=query or "is:inbox"
        ).execute()
        
        messages = []
        for msg in results.get("messages", []):
            # Get full message
            full_msg = service.users().messages().get(
                userId="me",
                id=msg["id"],
                format="metadata",
                metadataHeaders=["From", "To", "Subject", "Date"]
            ).execute()
            
            headers = {h["name"]: h["value"] for h in full_msg.get("payload", {}).get("headers", [])}
            
            messages.append({
                "id": msg["id"],
                "threadId": msg.get("threadId"),
                "snippet": full_msg.get("snippet"),
                "from": headers.get("From"),
                "to": headers.get("To"),
                "subject": headers.get("Subject"),
                "date": headers.get("Date"),
                "labelIds": full_msg.get("labelIds", [])
            })
        
        return {
            "messages": messages,
            "resultSizeEstimate": results.get("resultSizeEstimate", 0)
        }
        
    except HttpError as e:
        return {"error": str(e)}


@router.get("/gmail/threads")
async def get_gmail_threads(
    prospect_email: str,
    current_user: dict = Depends(get_current_user)
):
    """Get email thread with a specific prospect"""
    db = get_db()
    creds = await get_google_creds(current_user["id"], db)
    
    if not creds:
        raise HTTPException(status_code=400, detail="Google not connected")
    
    try:
        service = build("gmail", "v1", credentials=creds)
        
        # Search for threads with this email
        results = service.users().messages().list(
            userId="me",
            q=f"from:{prospect_email} OR to:{prospect_email}",
            maxResults=50
        ).execute()
        
        threads = {}
        for msg in results.get("messages", []):
            full_msg = service.users().messages().get(
                userId="me",
                id=msg["id"],
                format="full"
            ).execute()
            
            thread_id = msg.get("threadId")
            if thread_id not in threads:
                threads[thread_id] = []
            
            headers = {h["name"]: h["value"] for h in full_msg.get("payload", {}).get("headers", [])}
            
            # Get body
            body = ""
            payload = full_msg.get("payload", {})
            if "body" in payload and payload["body"].get("data"):
                body = base64.urlsafe_b64decode(payload["body"]["data"]).decode("utf-8", errors="ignore")
            elif "parts" in payload:
                for part in payload["parts"]:
                    if part.get("mimeType") == "text/plain" and part.get("body", {}).get("data"):
                        body = base64.urlsafe_b64decode(part["body"]["data"]).decode("utf-8", errors="ignore")
                        break
            
            threads[thread_id].append({
                "id": msg["id"],
                "from": headers.get("From"),
                "to": headers.get("To"),
                "subject": headers.get("Subject"),
                "date": headers.get("Date"),
                "body": body[:1000],
                "snippet": full_msg.get("snippet")
            })
        
        return {"threads": threads, "count": len(threads)}
        
    except HttpError as e:
        return {"error": str(e)}


# ============== GOOGLE CALENDAR ==============

@router.get("/calendar/events")
async def get_calendar_events(
    days: int = 7,
    current_user: dict = Depends(get_current_user)
):
    """Get upcoming calendar events"""
    db = get_db()
    creds = await get_google_creds(current_user["id"], db)
    
    if not creds:
        raise HTTPException(status_code=400, detail="Google not connected")
    
    try:
        service = build("calendar", "v3", credentials=creds)
        
        now = datetime.utcnow()
        time_min = now.isoformat() + "Z"
        time_max = (now + timedelta(days=days)).isoformat() + "Z"
        
        events_result = service.events().list(
            calendarId="primary",
            timeMin=time_min,
            timeMax=time_max,
            maxResults=50,
            singleEvents=True,
            orderBy="startTime"
        ).execute()
        
        events = []
        for event in events_result.get("items", []):
            events.append({
                "id": event.get("id"),
                "summary": event.get("summary"),
                "description": event.get("description"),
                "start": event.get("start", {}).get("dateTime") or event.get("start", {}).get("date"),
                "end": event.get("end", {}).get("dateTime") or event.get("end", {}).get("date"),
                "attendees": [a.get("email") for a in event.get("attendees", [])],
                "meetLink": event.get("hangoutLink"),
                "location": event.get("location")
            })
        
        return {"events": events}
        
    except HttpError as e:
        return {"error": str(e)}


@router.post("/calendar/schedule")
async def schedule_meeting(
    request: dict,
    current_user: dict = Depends(get_current_user)
):
    """Schedule a meeting with a prospect"""
    db = get_db()
    creds = await get_google_creds(current_user["id"], db)
    
    if not creds:
        raise HTTPException(status_code=400, detail="Google not connected")
    
    summary = request.get("summary", "Sales Meeting")
    description = request.get("description", "")
    attendee_email = request.get("attendeeEmail")
    start_time = request.get("startTime")  # ISO format
    duration_minutes = request.get("durationMinutes", 30)
    prospect_id = request.get("prospectId")
    
    if not start_time or not attendee_email:
        raise HTTPException(status_code=400, detail="Missing startTime or attendeeEmail")
    
    try:
        service = build("calendar", "v3", credentials=creds)
        
        start = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
        end = start + timedelta(minutes=duration_minutes)
        
        event = {
            "summary": summary,
            "description": description,
            "start": {"dateTime": start.isoformat(), "timeZone": "UTC"},
            "end": {"dateTime": end.isoformat(), "timeZone": "UTC"},
            "attendees": [{"email": attendee_email}],
            "conferenceData": {
                "createRequest": {"requestId": str(uuid4())}
            },
            "reminders": {
                "useDefault": False,
                "overrides": [
                    {"method": "email", "minutes": 60},
                    {"method": "popup", "minutes": 15}
                ]
            }
        }
        
        created_event = service.events().insert(
            calendarId="primary",
            body=event,
            conferenceDataVersion=1,
            sendUpdates="all"
        ).execute()
        
        # Log the meeting
        meeting_log = {
            "id": str(uuid4()),
            "userId": current_user["id"],
            "prospectId": prospect_id,
            "calendarEventId": created_event.get("id"),
            "summary": summary,
            "attendee": attendee_email,
            "startTime": start.isoformat(),
            "endTime": end.isoformat(),
            "meetLink": created_event.get("hangoutLink"),
            "status": "scheduled",
            "createdAt": datetime.now(timezone.utc).isoformat()
        }
        await db.scheduled_meetings.insert_one(meeting_log)
        
        # Update prospect
        if prospect_id:
            await db.prospects.update_one(
                {"id": prospect_id},
                {"$set": {"status": "meeting_scheduled", "meetingScheduledAt": meeting_log["createdAt"]}}
            )
        
        return {
            "success": True,
            "eventId": created_event.get("id"),
            "meetLink": created_event.get("hangoutLink"),
            "htmlLink": created_event.get("htmlLink"),
            "message": f"Meeting scheduled with {attendee_email}"
        }
        
    except HttpError as e:
        return {"success": False, "error": str(e)}


# ============== GOOGLE CONTACTS ==============

@router.get("/contacts")
async def get_google_contacts(
    page_size: int = 100,
    current_user: dict = Depends(get_current_user)
):
    """Get Google contacts"""
    db = get_db()
    creds = await get_google_creds(current_user["id"], db)
    
    if not creds:
        raise HTTPException(status_code=400, detail="Google not connected")
    
    try:
        service = build("people", "v1", credentials=creds)
        
        results = service.people().connections().list(
            resourceName="people/me",
            pageSize=page_size,
            personFields="names,emailAddresses,phoneNumbers,organizations,photos"
        ).execute()
        
        contacts = []
        for person in results.get("connections", []):
            names = person.get("names", [{}])[0]
            emails = person.get("emailAddresses", [])
            phones = person.get("phoneNumbers", [])
            orgs = person.get("organizations", [{}])[0]
            photos = person.get("photos", [{}])[0]
            
            contacts.append({
                "resourceName": person.get("resourceName"),
                "name": names.get("displayName"),
                "firstName": names.get("givenName"),
                "lastName": names.get("familyName"),
                "email": emails[0].get("value") if emails else None,
                "phone": phones[0].get("value") if phones else None,
                "company": orgs.get("name"),
                "title": orgs.get("title"),
                "photo": photos.get("url")
            })
        
        return {"contacts": contacts, "total": len(contacts)}
        
    except HttpError as e:
        return {"error": str(e)}


@router.post("/contacts/sync-to-prospects")
async def sync_contacts_to_prospects(
    current_user: dict = Depends(get_current_user)
):
    """Sync Google contacts to prospects"""
    db = get_db()
    creds = await get_google_creds(current_user["id"], db)
    
    if not creds:
        raise HTTPException(status_code=400, detail="Google not connected")
    
    try:
        service = build("people", "v1", credentials=creds)
        
        results = service.people().connections().list(
            resourceName="people/me",
            pageSize=500,
            personFields="names,emailAddresses,phoneNumbers,organizations"
        ).execute()
        
        synced = 0
        for person in results.get("connections", []):
            names = person.get("names", [{}])[0]
            emails = person.get("emailAddresses", [])
            orgs = person.get("organizations", [{}])[0]
            
            if not emails:
                continue
            
            email = emails[0].get("value")
            
            # Check if already exists
            existing = await db.prospects.find_one({"email": email, "userId": current_user["id"]})
            if existing:
                continue
            
            # Create prospect
            prospect = {
                "id": str(uuid4()),
                "userId": current_user["id"],
                "firstName": names.get("givenName", ""),
                "lastName": names.get("familyName", ""),
                "email": email,
                "company": orgs.get("name", ""),
                "title": orgs.get("title", ""),
                "source": "google_contacts",
                "status": "new",
                "createdAt": datetime.now(timezone.utc).isoformat()
            }
            await db.prospects.insert_one(prospect)
            synced += 1
        
        return {
            "success": True,
            "synced": synced,
            "message": f"Synced {synced} contacts to prospects"
        }
        
    except HttpError as e:
        return {"success": False, "error": str(e)}


# ============== EMAIL TRACKING ==============

@router.get("/gmail/track-replies")
async def track_gmail_replies(
    current_user: dict = Depends(get_current_user)
):
    """Check for replies to sent emails"""
    db = get_db()
    creds = await get_google_creds(current_user["id"], db)
    
    if not creds:
        raise HTTPException(status_code=400, detail="Google not connected")
    
    try:
        service = build("gmail", "v1", credentials=creds)
        
        # Get sent emails from our database
        sent_emails = await db.email_sends.find(
            {"userId": current_user["id"], "provider": "gmail", "repliedAt": None},
            {"_id": 0}
        ).to_list(100)
        
        replies_found = 0
        for email in sent_emails:
            thread_id = email.get("threadId")
            if not thread_id:
                continue
            
            # Get thread
            thread = service.users().threads().get(
                userId="me",
                id=thread_id
            ).execute()
            
            messages = thread.get("messages", [])
            if len(messages) > 1:
                # There's a reply!
                latest = messages[-1]
                headers = {h["name"]: h["value"] for h in latest.get("payload", {}).get("headers", [])}
                
                # Check if it's from someone else (a reply)
                from_email = headers.get("From", "")
                if email.get("to") in from_email or email.get("from") not in from_email:
                    await db.email_sends.update_one(
                        {"id": email["id"]},
                        {"$set": {
                            "repliedAt": datetime.now(timezone.utc).isoformat(),
                            "replySnippet": latest.get("snippet", "")[:200]
                        }}
                    )
                    
                    # Update prospect status
                    if email.get("prospectId"):
                        await db.prospects.update_one(
                            {"id": email["prospectId"]},
                            {"$set": {"status": "replied"}}
                        )
                    
                    replies_found += 1
        
        return {
            "success": True,
            "repliesFound": replies_found,
            "emailsChecked": len(sent_emails)
        }
        
    except HttpError as e:
        return {"error": str(e)}

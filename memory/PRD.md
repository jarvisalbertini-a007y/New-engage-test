# SalesFlow AI - Product Requirements Document

## Original Problem Statement
Build a **fully autonomous sales engine** with an AI-first, NLP-driven platform that minimizes user clicks and maximizes automation.

## Core Requirements
1. **AI/NLP First Interface:** Conversational command center as primary interaction method
2. **Smart Onboarding:** Auto-research company from user's email to propose ICP and initial sales strategy
3. **Agentic Architecture:** Specialized micro-agents with RAG on knowledge base
4. **Autonomous Workflows:** Pre-built, editable workflow templates with human-in-the-loop approvals
5. **Self-Improvement:** AI autonomously runs, prospects, and optimizes performance
6. **Real-World Integration:** Connect to real data sources and action platforms (email, calendar)

## Tech Stack
- **Backend:** Python, FastAPI, Motor (async MongoDB)
- **Frontend:** React, TypeScript, Vite, TailwindCSS, shadcn/ui, TanStack Query
- **Database:** MongoDB
- **AI Integration:** Gemini API via `emergentintegrations` library (Emergent LLM Key)
- **External Integrations:** Google OAuth 2.0 (Gmail, Calendar, Contacts), SendGrid

## Architecture
```
/app/
├── backend/
│   ├── routes/
│   │   ├── auth.py, agents.py, prospects.py, ...
│   │   ├── universal_chat.py      # NLP command center
│   │   ├── execution_engine.py    # Autonomous actions
│   │   ├── real_integrations.py   # Web search/scraping + SendGrid
│   │   ├── google_integration.py  # Gmail/Calendar APIs
│   │   ├── smart_onboarding.py    # AI-powered onboarding
│   │   ├── knowledge.py           # RAG knowledge base
│   │   ├── micro_agents.py        # Specialized agents
│   │   └── workflow_templates.py  # Workflow generation (NLP)
│   └── server.py
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── Dashboard.tsx, UniversalChat.tsx, ...
    │   │   ├── Prospects.tsx (Gmail/SendGrid email + Calendar buttons)
    │   │   ├── Meetings.tsx (NEW - Calendar view)
    │   │   ├── Integrations.tsx (Google + SendGrid)
    │   │   └── ActivityDashboard.tsx
    │   └── lib/api.ts
    └── App.tsx
```

## Key API Endpoints
- `POST /api/auth/register, /api/auth/login` - Authentication
- `POST /api/chat/message` - AI Command Center
- `POST /api/execute/execute-action` - Autonomous execution
- `GET/POST /api/google/oauth/*` - Google OAuth flow
- `POST /api/google/gmail/send` - Send emails via Gmail
- `POST /api/google/calendar/schedule` - Schedule meetings
- `GET /api/google/calendar/events` - View calendar events
- `POST /api/integrations/email/send` - Send via SendGrid
- `POST /api/integrations/search-leads` - AI-powered lead search
- `POST /api/knowledge/query` - RAG queries
- `POST /api/workflow-templates/generate-from-nlp` - NLP workflow generation

## Database Collections
- `users` - User accounts with Google credentials
- `prospects` - Lead database with ICP scores
- `actions` - Autonomous action logs
- `email_sends` - Email tracking (Gmail + SendGrid)
- `scheduled_meetings` - Calendar events
- `user_integrations` - SendGrid API keys, Google tokens

---

## What's Been Implemented

### Session: January 28, 2026 (Part 1)

**P0 - LLM API Migration (COMPLETE)**
- ✅ Updated all 5 files using old `emergentintegrations` API to new pattern
- Files updated: `smart_onboarding.py`, `knowledge.py`, `universal_chat.py`, `workflow_templates.py`, `micro_agents.py`

**P0 - Google Integration (VERIFIED WORKING)**
- ✅ Google OAuth one-click flow fully functional
- ✅ Gmail send endpoint: `POST /api/google/gmail/send`
- ✅ Calendar schedule endpoint: `POST /api/google/calendar/schedule`

### Session: January 28, 2026 (Part 2)

**P1 - Full SendGrid Email Integration (COMPLETE)**
- ✅ SendGrid email send with tracking: `POST /api/integrations/email/send`
- ✅ Prospects page now supports both Gmail and SendGrid providers
- ✅ Users can choose email provider when composing emails
- ✅ "Connect Email" button when no provider configured

**P2 - Dedicated Meetings/Calendar Page (COMPLETE)**
- ✅ New `/meetings` route with Meetings.tsx page
- ✅ View upcoming calendar events grouped by date
- ✅ Schedule new meetings with Google Meet link generation
- ✅ Stats cards: upcoming meetings, today's meetings, meetings with Meet links
- ✅ "Connect Google Calendar" prompt when not connected
- ✅ Navigation link added to sidebar

**P2 - NLP Workflow Generation (VERIFIED WORKING)**
- ✅ `POST /api/workflow-templates/generate-from-nlp` endpoint works correctly
- ✅ Generates complete workflow JSON from natural language description

**Testing Results:**
- Iteration 1: Backend 19/19 (100%), Frontend 100%
- Iteration 2: Backend 12/12 (100%), Frontend 100%
- Test reports: `/app/test_reports/iteration_1.json`, `/app/test_reports/iteration_2.json`

---

## Backlog

### P1 - Upcoming
- [ ] Full end-to-end SendGrid email flow testing (with real API key)
- [ ] Email tracking webhooks for opens/clicks

### P2 - Enhancements
- [ ] Email templates library for AI personalization
- [ ] Meeting reminder notifications
- [ ] Calendar sync with external calendars

### P3 - Data Integrations (ON HOLD per user request)
- [ ] Apollo.io integration (UI placeholder exists)
- [ ] Clearbit integration (UI placeholder exists)
- [ ] Crunchbase integration (UI placeholder exists)

### P3 - Advanced Features
- [ ] Fully autonomous "self-driving" prospecting mode
- [ ] Multi-agent team orchestration
- [ ] Self-improvement/A/B testing optimization loop

---

## Test Credentials
- Email: `test@salesflow.com`
- Password: `test123`
- API Base: `https://salesflow-ai-3.preview.emergentagent.com`

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
- **External Integrations:** Google OAuth 2.0 (Gmail, Calendar, Contacts), SendGrid (setup started)

## Architecture
```
/app/
├── backend/
│   ├── routes/
│   │   ├── auth.py, agents.py, prospects.py, ...
│   │   ├── universal_chat.py      # NLP command center
│   │   ├── execution_engine.py    # Autonomous actions
│   │   ├── real_integrations.py   # Web search/scraping
│   │   ├── google_integration.py  # Gmail/Calendar APIs
│   │   ├── smart_onboarding.py    # AI-powered onboarding
│   │   ├── knowledge.py           # RAG knowledge base
│   │   ├── micro_agents.py        # Specialized agents
│   │   └── workflow_templates.py  # Workflow generation
│   └── server.py
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── Dashboard.tsx, UniversalChat.tsx, ...
    │   │   ├── Prospects.tsx (Gmail/Calendar buttons)
    │   │   ├── Integrations.tsx (Google Connect)
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
- `POST /api/integrations/search-leads` - AI-powered lead search
- `POST /api/knowledge/query` - RAG queries

## Database Collections
- `users` - User accounts with Google credentials
- `prospects` - Lead database with ICP scores
- `actions` - Autonomous action logs
- `email_sends` - Email tracking
- `scheduled_meetings` - Calendar events

---

## What's Been Implemented

### Session: January 28, 2026

**P0 - LLM API Migration (COMPLETE)**
- ✅ Updated all 5 files using old `emergentintegrations` API to new pattern
- Files updated: `smart_onboarding.py`, `knowledge.py`, `universal_chat.py`, `workflow_templates.py`, `micro_agents.py`
- Old pattern: `chat(emergent_api_key=..., model=ModelType.GEMINI_2_0_FLASH, messages=[Message(...)])`
- New pattern: `LlmChat(api_key=..., session_id=..., system_message=...).send_message(UserMessage(text=...))`

**P1 - Linting Fixes (COMPLETE)**
- ✅ Fixed all bare `except:` clauses across 6 files
- ✅ Fixed unused variable warnings

**P0 - Google Integration (VERIFIED WORKING)**
- ✅ Google OAuth one-click flow fully functional
- ✅ Gmail send endpoint: `POST /api/google/gmail/send`
- ✅ Calendar schedule endpoint: `POST /api/google/calendar/schedule`
- ✅ Frontend UI with email/calendar modals on Prospects page
- ✅ Credentials stored in backend/.env

**Testing Results:**
- Backend: 19/19 tests passed (100%)
- Frontend: All pages functional (100%)
- Test report: `/app/test_reports/iteration_1.json`

---

## Backlog

### P1 - Upcoming
- [ ] Full SendGrid Integration (email sending/tracking for non-Gmail users)
- [ ] Dedicated Calendar/Meetings page
- [ ] Debug NLP workflow generation endpoint

### P2 - Data Integrations
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
- API Base: `https://salesai-flow.preview.emergentagent.com`

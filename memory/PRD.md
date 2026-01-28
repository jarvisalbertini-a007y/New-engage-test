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
│   │   ├── universal_chat.py            # NLP command center
│   │   ├── execution_engine.py          # Autonomous actions
│   │   ├── autonomous_prospecting.py    # NEW: Meta-cognitive prospecting
│   │   ├── real_integrations.py         # Web search/scraping + SendGrid
│   │   ├── google_integration.py        # Gmail/Calendar APIs
│   │   ├── smart_onboarding.py          # AI-powered onboarding
│   │   ├── knowledge.py                 # RAG knowledge base
│   │   ├── micro_agents.py              # Specialized agents
│   │   └── workflow_templates.py        # Workflow generation (NLP)
│   └── server.py
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── Dashboard.tsx, UniversalChat.tsx, ...
    │   │   ├── AutonomousProspecting.tsx  # NEW: Autonomous AI page
    │   │   ├── Prospects.tsx
    │   │   ├── Meetings.tsx
    │   │   └── ...
    │   └── lib/api.ts
    └── App.tsx
```

## Key API Endpoints

### Autonomous Prospecting (NEW)
- `GET /api/autonomous/competitor-sources` - List competitor platforms for learning
- `POST /api/autonomous/loops/discovery` - Find new prospects (meta-cognitive)
- `POST /api/autonomous/loops/research` - Deep research on companies
- `POST /api/autonomous/loops/outreach` - Generate personalized emails
- `POST /api/autonomous/loops/learning` - Learn from competitor platforms
- `POST /api/autonomous/start` - Start full autonomous engine
- `POST /api/autonomous/stop` - Stop autonomous engine
- `GET /api/autonomous/status` - Current status and activity
- `GET /api/autonomous/learnings` - Accumulated learnings

### Existing Endpoints
- `POST /api/auth/register, /api/auth/login` - Authentication
- `POST /api/chat/message` - AI Command Center
- `POST /api/execute/execute-action` - Autonomous execution
- `GET/POST /api/google/oauth/*` - Google OAuth flow
- `POST /api/google/gmail/send` - Send emails via Gmail
- `POST /api/google/calendar/schedule` - Schedule meetings
- `POST /api/integrations/email/send` - Send via SendGrid
- `POST /api/knowledge/query` - RAG queries

## Database Collections
- `users` - User accounts with Google credentials
- `prospects` - Lead database with ICP scores
- `autonomous_sessions` - Autonomous engine sessions
- `autonomous_activity` - Activity logs from autonomous cycles
- `autonomous_learnings` - Accumulated learnings from competitor analysis
- `company_research` - Deep company research profiles
- `email_drafts` - AI-generated email drafts
- `email_sends` - Email tracking (Gmail + SendGrid)

---

## What's Been Implemented

### Session: January 28, 2026 (Part 3) - AUTONOMOUS PROSPECTING

**P0 - Autonomous Prospecting Mode (COMPLETE)**
- ✅ Meta-Cognitive Framework: DECOMPOSE → SOLVE → VERIFY → SYNTHESIZE → REFLECT
- ✅ 4 Independent Automation Loops:
  - **Discovery Loop:** Find new prospects using AI research
  - **Research Loop:** Deep company/prospect analysis
  - **Outreach Loop:** Generate personalized email drafts
  - **Learning Loop:** Analyze competitor platforms for techniques
- ✅ Competitor Intelligence Sources: Gong, Outreach, ZoomInfo, SalesLoft, Apollo.io, Regie.ai
- ✅ Full Autonomous Engine: Combines all loops in continuous cycle
- ✅ New Frontend Page: `/autonomous` with configuration, loop controls, activity feed, learning sources

**Testing Results (Iteration 3):**
- Backend: 100% (9/9 endpoints working)
- Frontend: 100% (all components render correctly)
- Test report: `/app/test_reports/iteration_3.json`

### Previous Sessions

**P0 - LLM API Migration (COMPLETE)**
- ✅ Updated 5 files to new `emergentintegrations` API

**P0 - Google Integration (VERIFIED WORKING)**
- ✅ Gmail send, Calendar schedule

**P1 - SendGrid Integration (COMPLETE)**
- ✅ Email send with tracking

**P2 - Meetings Page (COMPLETE)**
- ✅ Calendar view, meeting scheduling

---

## Backlog

### P1 - Upcoming
- [ ] Full end-to-end SendGrid email flow testing
- [ ] Email tracking webhooks for opens/clicks

### P2 - Enhancements
- [ ] Email templates library for AI personalization
- [ ] Meeting reminder notifications
- [ ] A/B testing optimization in autonomous mode

### P3 - Data Integrations (ON HOLD)
- [ ] Apollo.io direct integration
- [ ] Clearbit integration
- [ ] Crunchbase integration

### P3 - Advanced Features (Future)
- [ ] Multi-agent team orchestration
- [ ] Advanced self-improvement loop

---

## Test Credentials
- Email: `test@salesflow.com`
- Password: `test123`

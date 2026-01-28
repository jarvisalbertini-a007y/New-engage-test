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
│   │   ├── autonomous_prospecting.py    # Meta-cognitive prospecting + Schedules + Approvals
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
    │   │   ├── AutonomousProspecting.tsx  # Full autonomous AI page with tabs
    │   │   ├── Prospects.tsx
    │   │   ├── Meetings.tsx
    │   │   └── ...
    │   └── lib/api.ts
    └── App.tsx
```

## Key API Endpoints

### Autonomous Prospecting
- `GET /api/autonomous/competitor-sources` - List competitor platforms for learning
- `POST /api/autonomous/loops/discovery` - Find new prospects (meta-cognitive)
- `POST /api/autonomous/loops/research` - Deep research on companies
- `POST /api/autonomous/loops/outreach` - Generate personalized emails
- `POST /api/autonomous/loops/learning` - Learn from competitor platforms
- `POST /api/autonomous/start` - Start full autonomous engine
- `POST /api/autonomous/stop` - Stop autonomous engine
- `GET /api/autonomous/status` - Current status and activity
- `GET /api/autonomous/learnings` - Accumulated learnings

### Scheduled Runs (NEW)
- `POST /api/autonomous/schedule` - Create a scheduled run
- `GET /api/autonomous/schedules` - List all schedules
- `PUT /api/autonomous/schedule/{id}` - Update a schedule
- `DELETE /api/autonomous/schedule/{id}` - Delete a schedule
- `POST /api/autonomous/schedule/{id}/run-now` - Trigger schedule manually
- `GET /api/autonomous/history` - Get run history

### Approval Workflow (NEW)
- `GET /api/autonomous/pending-approvals` - Get email drafts pending approval
- `POST /api/autonomous/approve/{id}` - Approve/reject/edit email draft
- `POST /api/autonomous/send-approved/{id}` - Send approved email
- `POST /api/autonomous/bulk-approve` - Bulk approve emails

### Existing Endpoints
- `POST /api/auth/register, /api/auth/login` - Authentication
- `POST /api/chat/message` - AI Command Center
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
- `scheduled_runs` - Scheduled prospecting runs
- `company_research` - Deep company research profiles
- `email_drafts` - AI-generated email drafts with approval status
- `email_sends` - Email tracking (Gmail + SendGrid)
- `workflow_approvals` - Approval records

---

## What's Been Implemented

### Session: January 28, 2026 (Part 4) - SCHEDULED RUNS & APPROVAL WORKFLOW

**Scheduled Autonomous Runs (COMPLETE)**
- ✅ Create schedules with name, frequency (daily/weekly/hourly), time, and day-of-week selection
- ✅ Automatic next run calculation
- ✅ Manual "Run Now" trigger for any schedule
- ✅ Schedule management (update, pause, delete)
- ✅ Stats tracking (total runs, prospects found)

**Approval Workflow (COMPLETE)**
- ✅ View all pending email drafts in dedicated tab
- ✅ Quality scores displayed for each draft
- ✅ Approve, Edit, or Reject individual emails
- ✅ Bulk approve multiple emails at once
- ✅ Send approved emails via Gmail or SendGrid
- ✅ Prospect context (name, company, title, email) shown with each draft

**Run History (COMPLETE)**
- ✅ View history of all autonomous runs
- ✅ Status indicators (running, complete, stopped)
- ✅ Stats per run (prospects, researched, drafts, cycles)

**Enhanced Frontend (COMPLETE)**
- ✅ Tab-based navigation: Engine | Schedules | Approvals (with count badge) | History
- ✅ Schedule creation form with frequency selection
- ✅ Email approval cards with action buttons
- ✅ Real-time activity feed

**Testing Results (Iteration 4):**
- Backend: 100% (10/10 new endpoints)
- Frontend: 100% (all tabs, forms, buttons)
- Test report: `/app/test_reports/iteration_4.json`

### Previous Sessions

**Part 3 - Autonomous Prospecting Mode (COMPLETE)**
- ✅ Meta-Cognitive Framework: DECOMPOSE → SOLVE → VERIFY → SYNTHESIZE → REFLECT
- ✅ 4 Independent Automation Loops: Discovery, Research, Outreach, Learning
- ✅ Competitor Intelligence: Gong, Outreach, ZoomInfo, SalesLoft, Apollo.io, Regie.ai

**Part 1-2 (COMPLETE)**
- ✅ LLM API Migration, Google Integration, SendGrid, Meetings Page

---

## Backlog

### P1 - Upcoming
- [ ] Notification system when autonomous cycle completes
- [ ] Email open/click tracking webhooks

### P2 - Enhancements
- [ ] Email templates library for AI personalization
- [ ] A/B testing in autonomous mode (test subject lines, body variations)
- [ ] Advanced schedule options (timezone, blackout dates)

### P3 - Data Integrations (ON HOLD)
- [ ] Apollo.io direct integration
- [ ] Clearbit integration
- [ ] Crunchbase integration

### P3 - Advanced Features (Future)
- [ ] Multi-agent team orchestration
- [ ] Campaign analytics dashboard

---

## Test Credentials
- Email: `test@salesflow.com`
- Password: `test123`

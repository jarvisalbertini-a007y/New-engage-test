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
│   │   ├── email_optimization.py        # NEW: AI email optimization + A/B testing
│   │   ├── real_integrations.py         # Web search/scraping + SendGrid
│   │   ├── google_integration.py        # Gmail/Calendar APIs
│   │   └── ...
│   └── server.py
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── Dashboard.tsx, UniversalChat.tsx, ...
    │   │   ├── AutonomousProspecting.tsx  # Autonomous AI page
    │   │   ├── EmailOptimization.tsx      # NEW: Email optimization page
    │   │   └── ...
    │   └── lib/api.ts
    └── App.tsx
```

## Key API Endpoints

### Email Optimization & A/B Testing (NEW)
- `POST /api/email-optimization/optimize` - AI-powered email optimization
- `POST /api/email-optimization/ab-test/create` - Create A/B test with AI variations
- `GET /api/email-optimization/ab-test/{id}` - Get test details with results
- `GET /api/email-optimization/ab-tests` - List all A/B tests
- `POST /api/email-optimization/ab-test/{id}/select-winner` - Select winner
- `GET /api/email-optimization/insights` - Get optimization insights & recommendations
- `POST /api/email-optimization/track/open` - Track email open
- `POST /api/email-optimization/track/click` - Track email click
- `POST /api/email-optimization/track/reply` - Track email reply
- `POST /api/email-optimization/auto-optimize-draft` - Auto-optimize draft (autonomous)
- `GET /api/email-optimization/optimization-history` - Get optimization history

### Autonomous Prospecting
- `POST /api/autonomous/loops/discovery` - Find new prospects
- `POST /api/autonomous/loops/research` - Deep research on companies
- `POST /api/autonomous/loops/outreach` - Generate personalized emails (with auto-optimization)
- `POST /api/autonomous/loops/learning` - Learn from competitor platforms
- `POST /api/autonomous/start` - Start full autonomous engine
- `POST /api/autonomous/schedule` - Create scheduled run
- `GET /api/autonomous/pending-approvals` - Get drafts for approval
- `POST /api/autonomous/approve/{id}` - Approve/reject email

## Database Collections
- `users`, `prospects`, `autonomous_sessions`, `autonomous_activity`
- `email_drafts` - AI-generated email drafts
- `email_sends` - Email tracking (opens, clicks, replies)
- `email_events` - Detailed event tracking for A/B tests
- `ab_tests` - A/B test configurations
- `ab_test_results` - Per-variation results
- `optimization_history` - Past email optimizations
- `scheduled_runs` - Scheduled prospecting runs

---

## What's Been Implemented

### Session: January 28, 2026 (Part 5) - EMAIL OPTIMIZATION & A/B TESTING

**AI-Powered Email Optimization (COMPLETE)**
- ✅ Analyze historical performance data (open rates, click rates, reply rates)
- ✅ Identify patterns from successful emails (opening styles, length, CTAs)
- ✅ AI optimization with confidence score and predicted improvement percentage
- ✅ List of specific changes made and reasoning
- ✅ Integration with autonomous outreach loop (auto-optimization)

**A/B Testing Framework (COMPLETE)**
- ✅ Create A/B tests with AI-generated variations:
  - Subject line tests (different psychological angles)
  - Body tests (shorter, story-based, data-driven approaches)
  - CTA tests (calendar, question, resource sharing approaches)
  - Full email tests (completely different approaches)
- ✅ Track performance per variation (opens, clicks, replies, rates)
- ✅ Auto-select winner based on criteria (replies, clicks, opens)
- ✅ Manual winner selection option

**Performance Tracking (COMPLETE)**
- ✅ Track email opens, clicks, and replies
- ✅ Attribution to A/B test variations
- ✅ Sentiment tracking for replies (positive, negative, neutral)

**Insights & Recommendations (COMPLETE)**
- ✅ Performance summary (total sent, open/click/reply rates)
- ✅ Successful pattern analysis (opening styles, optimal lengths)
- ✅ AI-powered recommendations with priority levels
- ✅ A/B test learnings aggregation

**Reusable Component Design (COMPLETE)**
- ✅ Manual use: `/email-optimization` page with all features
- ✅ Autonomous use: `auto-optimize-draft` and `auto-create-test` endpoints
- ✅ Integrated into autonomous outreach loop

**Testing Results (Iteration 5):**
- Backend: 100% (22/22 tests passed)
- Frontend: 100% (all tabs, forms, optimization display)
- Test report: `/app/test_reports/iteration_5.json`

### Previous Sessions

**Part 4 - Scheduled Runs & Approval Workflow (COMPLETE)**
- ✅ Scheduled autonomous runs
- ✅ Email approval workflow
- ✅ Run history

**Part 3 - Autonomous Prospecting Mode (COMPLETE)**
- ✅ Meta-Cognitive Framework with 4 loops
- ✅ Competitor intelligence from 6 platforms

---

## Backlog

### P1 - Upcoming
- [ ] Webhook endpoints for external email tracking (Mailgun, SendGrid)
- [ ] Email template library with categories

### P2 - Enhancements
- [ ] Campaign-level A/B testing (test across multiple prospects)
- [ ] Time-based send optimization (best time to send)
- [ ] Advanced analytics dashboard

### P3 - Advanced Features (Future)
- [ ] Multi-agent team orchestration
- [ ] Predictive lead scoring with ML
- [ ] Campaign ROI tracking

---

## Test Credentials
- Email: `test@salesflow.com`
- Password: `test123`

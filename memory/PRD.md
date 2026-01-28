# SalesFlow AI - Product Requirements Document

## Original Problem Statement
Build a **fully autonomous sales engine** with an AI-first, NLP-driven platform that minimizes user clicks and maximizes automation.

## Tech Stack
- **Backend:** Python, FastAPI, Motor (async MongoDB)
- **Frontend:** React, TypeScript, Vite, TailwindCSS, shadcn/ui, TanStack Query
- **Database:** MongoDB
- **AI Integration:** Gemini API via `emergentintegrations` (Emergent LLM Key)
- **External Integrations:** Google OAuth 2.0, SendGrid, Mailgun

## Architecture
```
/app/
├── backend/routes/
│   ├── autonomous_prospecting.py    # Meta-cognitive prospecting + Schedules + Approvals
│   ├── email_optimization.py        # AI email optimization + A/B testing
│   ├── email_webhooks_templates.py  # Webhooks + Template library
│   ├── universal_chat.py            # NLP command center
│   ├── google_integration.py        # Gmail/Calendar APIs
│   └── ...
└── frontend/src/pages/
    ├── AutonomousProspecting.tsx    # Autonomous AI page
    ├── EmailOptimization.tsx        # Email optimization page
    ├── EmailTemplates.tsx           # Template library page
    └── ...
```

---

## What's Been Implemented

### Session: January 28, 2026

#### Part 6 - EMAIL WEBHOOKS & TEMPLATE LIBRARY (COMPLETE)

**Webhook Endpoints for External Email Tracking**
- ✅ **SendGrid Webhook**: `/api/email-templates/webhook/sendgrid`
  - Events: delivered, open, click, bounce, spamreport, unsubscribe
  - Batch event support
- ✅ **Mailgun Webhook**: `/api/email-templates/webhook/mailgun`
  - Events: delivered, opened, clicked, bounced, complained, unsubscribed
  - Form data format support
- ✅ **Generic Webhook**: `/api/email-templates/webhook/generic`
  - Requires authentication
  - Standardized event format
- ✅ Automatic A/B test result updates from webhook events

**Email Template Library**
- ✅ **6 Categories**: Cold Outreach, Follow-Up, Meeting Request, Value Proposition, Social Proof, Breakup
- ✅ **8 Pre-built Templates** with variable placeholders:
  - The Observation Opener (42% open, 8% reply)
  - The Question Opener (38% open, 6% reply)
  - The Gentle Bump, The Value Add (follow-ups)
  - The Direct Ask (meeting request)
  - The Problem-Solution (value prop)
  - The Case Study (social proof)
  - The Final Attempt (breakup)
- ✅ **Template CRUD**: Create, read, update, delete custom templates
- ✅ **Auto-extract variables** from `{{variable}}` syntax
- ✅ **AI Template Generation**: Generate new templates from description
  - Tone options: professional, casual, friendly, urgent
  - Goal options: book meeting, get reply, share resource
- ✅ **AI Template Personalization**: Fill variables using prospect data
- ✅ **Draft Creation**: Create email draft from template for specific prospect

**Frontend Template Library UI**
- ✅ 3-column layout: Categories | Templates | Preview
- ✅ Category filtering with template counts
- ✅ Template cards with open rate, reply rate, variable count
- ✅ Live variable substitution in preview
- ✅ AI Generate form with tone/category/goal options
- ✅ Create Template form

**Testing Results (Iteration 6):**
- Backend: 100% (32/32 tests passed)
- Frontend: 100% (all components working)
- Test report: `/app/test_reports/iteration_6.json`

#### Part 5 - EMAIL OPTIMIZATION & A/B TESTING (COMPLETE)
- ✅ AI-powered email optimization based on historical performance
- ✅ A/B testing with AI-generated variations
- ✅ Performance tracking (opens, clicks, replies)
- ✅ Insights and recommendations

#### Part 4 - SCHEDULED RUNS & APPROVAL WORKFLOW (COMPLETE)
- ✅ Scheduled autonomous runs (daily/weekly/hourly)
- ✅ Email approval workflow (approve/reject/edit)
- ✅ Run history

#### Part 3 - AUTONOMOUS PROSPECTING MODE (COMPLETE)
- ✅ Meta-Cognitive Framework: DECOMPOSE → SOLVE → VERIFY → SYNTHESIZE → REFLECT
- ✅ 4 Automation Loops: Discovery, Research, Outreach, Learning
- ✅ Competitor Intelligence from 6 platforms

---

## Key API Endpoints

### Email Templates
- `POST /api/email-templates/webhook/sendgrid` - SendGrid webhook
- `POST /api/email-templates/webhook/mailgun` - Mailgun webhook
- `POST /api/email-templates/webhook/generic` - Generic webhook (auth required)
- `GET /api/email-templates/templates/categories` - List categories
- `GET /api/email-templates/templates` - List templates
- `POST /api/email-templates/templates` - Create custom template
- `POST /api/email-templates/templates/{id}/personalize` - AI personalize
- `POST /api/email-templates/templates/generate` - AI generate template
- `POST /api/email-templates/templates/{id}/create-draft` - Create draft

### Email Optimization
- `POST /api/email-optimization/optimize` - AI optimize email
- `POST /api/email-optimization/ab-test/create` - Create A/B test
- `GET /api/email-optimization/insights` - Get insights

### Autonomous Prospecting
- `POST /api/autonomous/loops/discovery` - Find prospects
- `POST /api/autonomous/loops/research` - Research companies
- `POST /api/autonomous/loops/outreach` - Generate emails
- `POST /api/autonomous/loops/learning` - Learn from competitors
- `POST /api/autonomous/schedule` - Create scheduled run
- `GET /api/autonomous/pending-approvals` - Get drafts for approval

---

## Backlog

### P1 - Upcoming
- [ ] Campaign-level A/B testing across multiple prospects
- [ ] Time-based send optimization (best time to send)

### P2 - Enhancements
- [ ] Advanced analytics dashboard
- [ ] Template performance tracking by industry/title

### P3 - Future
- [ ] Multi-agent team orchestration
- [ ] Predictive lead scoring with ML
- [ ] Campaign ROI tracking

---

## Test Credentials
- Email: `test@salesflow.com`
- Password: `test123`

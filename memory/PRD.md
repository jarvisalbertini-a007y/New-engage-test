# SalesFlow AI - Product Requirements Document

## Original Problem Statement
Build a **fully autonomous sales engine** with an AI-first, NLP-driven platform that minimizes user clicks and maximizes automation. User operates primarily from a chat window while agents work autonomously in the background (like Emergent/Replit/Bolt for Sales).

**Enhanced Vision (Feb 2026):** The platform should be like **Figma/Replit for Sales AI**:
- **Split-view Interface**: Chat window + Agent status panel (like Replit's console)
- **Configurable Autonomy**: Agents ask users their preferred autonomy level per task type (full auto, approval-based, configurable)
- **NLP Agent Customization**: Users can modify agents via natural language, see learning history
- **Background Autonomous Work**: Research, outreach, follow-ups, lead monitoring, meeting booking
- **Dual Notifications**: In-app + email (customizable in settings)

## Tech Stack
- **Backend:** Python, FastAPI, Motor (async MongoDB)
- **Frontend:** React, TypeScript, Vite, TailwindCSS, shadcn/ui, TanStack Query
- **Database:** MongoDB
- **AI Integration:** Gemini API via `emergentintegrations` (Emergent LLM Key)
- **External Integrations:** Google OAuth 2.0, SendGrid, Mailgun

## Architecture
```
/app/
├── backend/
│   ├── core/
│   │   ├── __init__.py              # Core module exports
│   │   └── agent_framework.py       # Unified Agent Framework (8 agents)
│   ├── routes/
│   │   ├── ai_orchestration.py      # Primary AI + Knowledge + History
│   │   ├── autonomous_jobs.py       # NEW: Background Job Queue System
│   │   ├── autonomous_prospecting.py
│   │   ├── email_optimization.py
│   │   ├── email_webhooks_templates.py
│   │   ├── self_improvement.py
│   │   ├── multi_agent.py
│   │   └── ...
│   └── server.py
└── frontend/src/pages/
    ├── AICommandCenter.tsx          # Primary full-screen chat + Agent Console
    └── ...
```

---

## What's Been Implemented

### Session: February 1, 2026 (Current)

#### P0: Background Agent Job Queue System (COMPLETE - Iteration 12)

**Backend: /app/backend/routes/autonomous_jobs.py**
- ✅ `POST /api/jobs/jobs/create` - Create and auto-start background jobs
- ✅ `GET /api/jobs/jobs` - List user's jobs with status/type filters
- ✅ `GET /api/jobs/jobs/{id}` - Get job details with real-time progress
- ✅ `POST /api/jobs/jobs/{id}/start|pause|cancel` - Job control
- ✅ `GET /api/jobs/autonomy/preferences` - Get user autonomy settings
- ✅ `PUT /api/jobs/autonomy/preferences` - Update autonomy per task type
- ✅ `GET /api/jobs/analytics/summary` - Job statistics
- ✅ Quick-start endpoints: `/quick-start/research|outreach|follow-up`

**Job Types Supported:**
- Research (prospect/company research)
- Outreach (email generation)
- Follow Up (automated follow-ups)
- Lead Monitor (hot lead detection)
- Data Enrich (prospect enrichment)
- Workflow (execute saved workflows)
- Custom (any user goal)

**Frontend: Agent Console Panel**
- ✅ Split-view UI with collapsible Agent Console (Replit-style)
- ✅ **Jobs Tab**: Running jobs with progress, Recent jobs with status indicators
- ✅ **Autonomy Tab**: Default level dropdown, Per task type settings
- ✅ **Learning Tab**: NLP customization, Agent learnings, Current agent settings
- ✅ **Analytics Tab**: Total jobs, Running, Completed, Success Rate, By Type
- ✅ Quick Start buttons (Research, Follow Up)

**Testing Results (Iteration 12):**
- Backend: 100% (22/22 tests passed)
- Frontend: 100% (all UI features working)
- Test report: `/app/test_reports/iteration_12.json`

#### P1: Agent Learning & NLP Customization (COMPLETE - Iteration 13)

**Backend: Learning Visibility**
- ✅ `GET /api/jobs/learning/summary` - Learning statistics by agent and type
- ✅ `GET /api/jobs/learning/history` - Full learning history with filters
- ✅ `POST /api/jobs/learning/record` - Record new agent learnings
- ✅ `GET /api/jobs/learning/agent/{type}` - Agent-specific learnings with metrics
- ✅ `PUT /api/jobs/learning/{id}/feedback` - User feedback on learnings

**Backend: NLP Agent Customization**
- ✅ `GET /api/jobs/agents/customization` - Get agent settings
- ✅ `PUT /api/jobs/agents/customization` - Update settings
- ✅ `POST /api/jobs/agents/customize-nlp` - Natural language customization
- ✅ Keyword parsing: casual, formal, concise, detailed, aggressive, subtle
- ✅ `GET /api/jobs/agents/customization-history` - NLP request history

**Frontend: Enhanced Agent Console**
- ✅ **Learning Tab** with NLP customization textarea
- ✅ "Apply Changes" button for NLP instructions
- ✅ Agent Learnings summary (Total, High Impact)
- ✅ Learnings by Agent breakdown
- ✅ Current Agent Settings display

**Testing Results (Iteration 13):**
- Backend: 100% (16/16 tests passed)
- Frontend: 100% (all UI features working)
- Test report: `/app/test_reports/iteration_13.json`

#### P1: Enhanced Visual Workflow Builder (COMPLETE - Iteration 13)

**Drag-Drop Canvas**
- ✅ 10 Node types: Trigger, Email, Wait, Approval, Branch, Condition, Action, Notification, Task, End
- ✅ Drag from palette to canvas
- ✅ Node connection handles (input/output)
- ✅ Edge creation by dragging between handles
- ✅ Curved SVG edge paths with arrows

**Canvas Controls**
- ✅ Zoom in/out (0.5x to 2x)
- ✅ Reset view button
- ✅ Undo/Redo with keyboard shortcuts (⌘Z/⌘⇧Z)
- ✅ Delete nodes/edges (Del key)
- ✅ Duplicate nodes (⌘D)
- ✅ Alt+Drag to pan

**Node Configuration Panel**
- ✅ Step Name editing
- ✅ Trigger Type selector (Manual, New Prospect, Email Opened, etc.)
- ✅ Wait Duration with unit selector
- ✅ Email Template and Subject Line
- ✅ Condition selector for Branch nodes
- ✅ Action Type selector
- ✅ Connections info, Duplicate, Delete buttons

#### Voice Input & PDF Upload (COMPLETE - Iteration 11)

**Voice Transcription**
- ✅ `POST /api/ai/voice/transcribe` - OpenAI Whisper integration via emergentintegrations
- ✅ Real audio recording with Web Audio API in frontend
- ✅ Base64 audio encoding and transmission
- ✅ Proper error handling for invalid/empty audio

**PDF Document Parsing**
- ✅ PyPDF2 integration for PDF text extraction
- ✅ Base64 PDF upload support
- ✅ AI-powered content extraction (summary, key facts, entities, insights)
- ✅ Document categorization and tagging

**Visual Workflow Builder**
- ✅ `/visual-workflow` route with drag-drop canvas
- ✅ Node palette: Trigger, Send Email, Wait, Approval, Branch, Action, End
- ✅ AI workflow generation from natural language
- ✅ Workflow save and test run functionality

**Testing Results (Iteration 11):**
- Backend: 100% (20/20 tests passed)
- Frontend: 100% (all UI features working)
- Test report: `/app/test_reports/iteration_11.json`

#### Phase 4 - LIVING KNOWLEDGE BASE (COMPLETE)

**Knowledge Integration in Plan Execution**
- ✅ Auto-injects relevant knowledge into agent context before execution
- ✅ Extracts learnings from completed plans and saves to knowledge base
- ✅ AI synthesis of execution results into structured learnings

**Knowledge API Endpoints**
- ✅ `POST /api/ai/knowledge/auto-ingest` - Auto-ingest content with AI extraction
- ✅ `GET /api/ai/knowledge/search` - Search knowledge base (regex)
- ✅ `POST /api/ai/knowledge/query-rag` - RAG query with sources

**Conversation History** (Fully Functional)
- ✅ `GET /api/ai/sessions/list` - List sessions with title, preview, messageCount
- ✅ `GET /api/ai/session/{id}/messages` - Get full session messages
- ✅ `DELETE /api/ai/session/{id}` - Delete a session
- ✅ `POST /api/ai/session/new` - Create new session
- ✅ Frontend History tab with load, delete, new session

**Testing Results (Iteration 9):**
- Backend: 100% (68/68 tests passed)
- Frontend: 100% (all history features working)
- Test report: `/app/test_reports/iteration_9.json`

#### Phase 3 - AUTONOMOUS ORCHESTRATOR (COMPLETE)

**Integrated Plan Execution** (`execute_approved_plan`)
- ✅ **Pre-execution**: Loads self-improvement rules, knowledge context, winning phrases
- ✅ **During execution**: Applies email optimization to outreach agent outputs
- ✅ **Post-execution**: Extracts learnings and saves to knowledge base
- ✅ **Real-time updates**: WebSocket broadcasts activity to sidebar

**Integration Points**
- ✅ Self-improvement rules → Outreach email optimization
- ✅ Knowledge base → Agent context injection
- ✅ Plan results → Knowledge base learnings

#### Phase 1 - UNIFIED AGENT FRAMEWORK (COMPLETE)

**Core Framework** (`/app/backend/core/agent_framework.py`)
- ✅ **BaseAgent class**: Standardized interface for all agents (think, execute, learn)
- ✅ **AgentRegistry**: Singleton registry for agent discovery and management
- ✅ **AgentContext**: Shared context passed between agents
- ✅ **ExecutionPlan**: Plan data structure with steps, agents, approval
- ✅ **TaskExecutionEngine**: Executes plans, manages approvals, coordinates agents

**8 Specialized Agents** (All using unified framework)
1. ✅ **Orchestrator Agent**: Creates plans, delegates tasks, synthesizes results
2. ✅ **Research Agent**: Company research, prospect profiling, industry analysis
3. ✅ **Outreach Agent**: Email generation, personalization (requires approval)
4. ✅ **Optimization Agent**: A/B testing, performance analysis
5. ✅ **Intelligence Agent**: Competitor analysis, market research
6. ✅ **Knowledge Agent**: Knowledge base management, RAG retrieval
7. ✅ **Workflow Agent**: Workflow creation (requires approval)
8. ✅ **Qualification Agent**: Lead scoring, ICP matching

#### Phase 2 - AI COMMAND CENTER (COMPLETE)

**Backend** (`/app/backend/routes/ai_orchestration.py`)
- ✅ `POST /api/ai/chat` - Main chat endpoint with plan creation/approval
- ✅ `GET /api/ai/agents` - Get all 8 agents
- ✅ `GET /api/ai/plans/pending` - Plans awaiting approval
- ✅ `GET /api/ai/plans/active` - Currently executing plans
- ✅ `POST /api/ai/quick-action` - Single agent execution (no approval)
- ✅ `POST /api/ai/suggest` - Context-aware suggestions
- ✅ `WebSocket /api/ai/ws/{user_id}` - Real-time activity updates

**Additional Features (Iteration 10)**
- ✅ `POST /api/ai/create-workflow` - AI workflow creation from natural language
- ✅ `GET /api/ai/pending-approvals-unified` - Unified approvals (plans, workflows, emails)
- ✅ `POST /api/ai/approve-item/{id}` - Approve/reject any pending item
- ✅ `POST /api/ai/knowledge/upload` - Document upload with AI extraction
- ✅ `POST /api/ai/voice/transcribe` - Voice input (placeholder for STT integration)
- ✅ `GET /api/ai/stats` - AI usage statistics

**Frontend** (`/app/frontend/src/pages/AICommandCenter.tsx`)
- ✅ Full-screen chat as primary interface (like Emergent)
- ✅ AI asks clarifying questions before creating plans
- ✅ Plan display with approve/reject buttons
- ✅ Suggested action quick buttons
- ✅ Split-screen sidebar with 4 tabs: Activity, Approvals, History, Settings
- ✅ Real-time agent activity feed via WebSocket
- ✅ Voice input button (mic icon)
- ✅ Document upload button with file picker
- ✅ Unified approvals tab with approve/reject per item
- ✅ Conversation history with load/delete/new session
- ✅ AI stats display (plans completed, docs)

**Testing Results (Iteration 10):**
- Backend: 100% (20/20 new tests passed)
- Frontend: 100% (all features working)
- Test report: `/app/test_reports/iteration_10.json`

### Session: January 31, 2026

#### Part 8 - MULTI-AGENT ARCHITECTURE (COMPLETE)

**Specialized Agent Types**
- ✅ **Research Agent**: Deep company research, prospect profiling, industry analysis
- ✅ **Outreach Agent**: Email generation, personalization, sequence creation
- ✅ **Optimization Agent**: Email analysis, A/B testing, conversion optimization
- ✅ **Intelligence Agent**: Competitor analysis, market research, trend detection
- ✅ **Coordinator Agent**: Task delegation, workflow management, result synthesis

**Multi-Agent Task Execution**
- ✅ **Single Agent Execution**: Direct task execution with specific agent
- ✅ **Multi-Agent Collaboration**: Complex tasks decomposed and distributed
  - DECOMPOSE: Break goal into subtasks for each agent
  - EXECUTE: Run subtasks in dependency order
  - SYNTHESIZE: Combine results into actionable output
- ✅ **Agent Teams**: Create custom teams for recurring workflows
- ✅ **Agent Chat**: Interactive conversations with specialists
- ✅ **Execution History**: Track all agent interactions

**Frontend Multi-Agent UI** (`/multi-agent`)
- ✅ 5 agent type cards with capabilities
- ✅ 4 tabs: Execute Task, Agent Teams, Chat with Agent, History
- ✅ Multi-agent task form with progress tracking
- ✅ Team creation with agent selection
- ✅ Chat interface with session management

#### Part 7 - ADVANCED SELF-IMPROVEMENT LOOP (COMPLETE)

**Performance Learning Engine**
- ✅ **Email Performance Analysis**: Categorize emails by outcome (replies, opens, no engagement)
- ✅ **Pattern Extraction**: Subject patterns, opening styles, personalization usage
- ✅ **Winning Phrases**: AI extracts effective phrases from successful emails
- ✅ **Rule Generation**: Automatic rules from performance data (length, style, personalization)
- ✅ **Apply to Draft**: AI applies learned patterns to improve email drafts
- ✅ **Feedback Loop**: Reinforce rules based on outcomes

**Frontend Self-Improvement UI** (`/self-improvement`)
- ✅ Stats cards: Emails Analyzed, Patterns Found, Active Rules, Improvements Applied
- ✅ 4 tabs: Overview, Rules, Winning Phrases, Apply to Email
- ✅ Run Analysis button triggers comprehensive learning
- ✅ Rule toggle on/off
- ✅ Email improvement with before/after view

**Testing Results (Iteration 7):**
- Backend: 100% (37/37 tests passed)
- Frontend: 100% (all components working)
- Test report: `/app/test_reports/iteration_7.json`

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

### Self-Improvement
- `GET /api/self-improvement/status` - Get learning status & metrics
- `POST /api/self-improvement/analyze` - Run comprehensive analysis
- `GET /api/self-improvement/rules` - Get improvement rules
- `PUT /api/self-improvement/rules/{id}` - Update rule (toggle active)
- `POST /api/self-improvement/apply-to-draft` - Apply learnings to email
- `GET /api/self-improvement/phrases` - Get winning phrases
- `GET /api/self-improvement/improvement-history` - Get improvement history
- `POST /api/self-improvement/feedback` - Submit outcome feedback

### Multi-Agent
- `GET /api/multi-agent/types` - Get 5 agent types
- `POST /api/multi-agent/execute-single` - Execute with single agent
- `POST /api/multi-agent/execute-multi` - Execute with multiple agents
- `GET /api/multi-agent/task/{id}` - Get task status/results
- `GET /api/multi-agent/tasks` - List multi-agent tasks
- `POST /api/multi-agent/team/create` - Create custom team
- `GET /api/multi-agent/teams` - List custom teams
- `POST /api/multi-agent/team/{id}/execute` - Execute team workflow
- `POST /api/multi-agent/chat` - Chat with agent
- `GET /api/multi-agent/history` - Get execution history

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

### P0 - Immediate (Completed ✅)
- [x] ~~**Background Agent Job Queue**~~: Implemented job queue with async background execution ✅
- [x] ~~**Split-View Agent Console**~~: Replit-style panel with Jobs/Autonomy/Analytics tabs ✅
- [x] ~~**Autonomy Level Configuration**~~: Per task type settings (full_auto, approval, notify, manual) ✅
- [ ] SendGrid API integration for actual email sending

### P1 - Upcoming (Enhanced Autonomy)
- [ ] **Visual Workflow Builder Enhancement**: Make drag-drop fully interactive with node connections
- [ ] **Agent Learning Visibility**: Show users what agents have learned and how they've improved
- [ ] **NLP Agent Customization**: Allow users to modify agent behavior via natural language
- [ ] Real data source integrations (Apollo.io, Clearbit, Crunchbase)
- [ ] Campaign-level A/B testing across multiple prospects
- [ ] Time-based send optimization (best time to send)

### P2 - Future Enhancements
- [ ] **Email Notifications**: Configurable email alerts for agent completions
- [ ] **Agent Teams Management**: Custom team creation and workflow execution
- [ ] Predictive lead scoring with ML
- [ ] Campaign ROI tracking
- [ ] Deprecate old standalone pages (/multi-agent, /self-improvement)

### Completed
- [x] ~~Background Agent Job Queue~~ ✅ (Iteration 12)
- [x] ~~Split-View Agent Console~~ ✅ (Iteration 12)
- [x] ~~Autonomy Level Configuration~~ ✅ (Iteration 12)
- [x] ~~Voice Input with Whisper~~ ✅ (Iteration 11)
- [x] ~~PDF Document Parsing~~ ✅ (Iteration 11)
- [x] ~~Visual Workflow Builder~~ ✅ (Iteration 11)
- [x] ~~Advanced Self-Improvement Loop~~ ✅
- [x] ~~Multi-Agent Architecture~~ ✅

---

## Test Credentials
- Email: `test@salesflow.com`
- Password: `test123`

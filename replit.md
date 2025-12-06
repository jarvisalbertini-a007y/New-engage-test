# AI Sales Engagement Platform

## Overview
A comprehensive AI-first sales engagement platform designed to outperform competitors by integrating advanced AI capabilities, autonomous teams, and enterprise-grade features. The platform provides a complete suite of tools for sales engagement, including lead management, multi-channel outreach, AI-powered content generation, and detailed analytics, all backed by PostgreSQL for data persistence.

## User Preferences
I want iterative development. I prefer detailed explanations. Ask before making major changes.

## System Architecture
The platform is built with a modern web stack:
- **Frontend**: React, Vite, TailwindCSS, and shadcn/ui for a modern dark-themed user interface. State management is handled by TanStack Query v5, and client-side navigation uses Wouter.
- **Backend**: Express.js with TypeScript for robust API services.
- **Database**: PostgreSQL, managed with Drizzle ORM, hosted on Neon.
- **AI**: Integrated with OpenAI's GPT-4, with a fallback mechanism for users without an API key.
- **Authentication**: Utilizes Replit Auth (OpenID Connect) for secure session management.
- **Key Features**:
    - **Lead Database**: Companies, contacts, and enrichment with advanced filtering.
    - **Multi-Channel Sequences**: Automation for email, calls, and LinkedIn.
    - **AI Email Coach**: Real-time email analysis and improvement suggestions.
    - **Content Studio**: AI-powered template generation and personalization.
    - **Unified Inbox**: Aggregates messages from multiple channels with AI categorization.
    - **Insights Engine**: AI-powered opportunity detection and recommendations.
    - **Email Deliverability**: Domain health monitoring, email warming, and authentication.
    - **Analytics Dashboard**: Performance metrics, conversion funnels, and team insights.
    - **AI Agents**: Autonomous prospecting with CRUD operations and real metrics, featuring an AI Agent Marketplace for community-driven sharing.
    - **Digital Twin Prospects**: AI models for hyper-personalization and behavior prediction.
    - **Autonomous SDR Teams**: AI personas (Researcher, Writer, Qualifier, Scheduler, Manager) collaborating on deals.
    - **Predictive Deal Intelligence**: Intent signals, micro-timing optimization, and buying stage prediction.
    - **Revenue Operations Command Center**: Deal forensics AI, pipeline health monitoring, and coaching insights.
    - **Native Multi-Channel Orchestration**: Seamless coordination across various communication channels, including voice AI integration for automated calls.
    - **Workflow Automation**: NLP-first workflow creation with a visual drag-and-drop editor, specialized AI agents, smart triggers, and human-in-the-loop controls.
- **AI-First Onboarding**: 7-step guided flow where users provide minimal input (website URL) and AI researches company, generates ICP suggestions, creates personas, and designs sequences automatically.
    - **Universal Chat Interface**: Permission-aware floating chat accessible from anywhere in the app with context-aware quick actions and AI assistance.
    - **RBAC (Role-Based Access Control)**: Multi-tenancy support with 5 roles (Owner, Admin, Manager, SDR, ReadOnly), organization-scoped data isolation, and visibility scopes (personal/team/org).
- **Security**: Comprehensive security measures including Helmet.js, rate limiting, payload size limits, secure session management, RBAC enforcement on all data routes, and robust file access protection, addressing OWASP Top 10 vulnerabilities. All API endpoints are protected with global authentication middleware.
- **Project Structure**: Organized into `server/`, `client/`, and `shared/` directories, with clear separation of concerns for database, API routes, services, UI components, and shared schemas.

## External Dependencies
- **PostgreSQL (Neon)**: Primary database for all persistent data.
- **OpenAI GPT-4**: For various AI functionalities, including content generation, email analysis, and autonomous agents.
- **Replit Auth (OpenID Connect)**: For user authentication and session management.
- **Helmet.js**: For enhancing API security with various HTTP headers.
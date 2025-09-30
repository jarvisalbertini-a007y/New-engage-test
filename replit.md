# AI Sales Engagement Platform

## Overview
A comprehensive AI-first sales engagement platform with visitor tracking, email coaching, prospecting, multi-channel sequences, and analytics.

## Recent Changes (Latest Session)

### ✅ Completed: PostgreSQL Database Migration
- **Created database connection** using Drizzle ORM with Neon serverless driver
- **Migrated from in-memory to persistent storage** - All data now stored in PostgreSQL
- **Implemented DbStorage class** with full CRUD operations for all entities
- **Added cleanPartial helper** to safely handle partial updates without violating NOT NULL constraints
- **Successfully seeded database** with sample companies, visitor sessions, and insights
- **Verified database connectivity** and schema alignment

### Database Schema
- **Users** - Authentication and user management
- **Companies** - Firmographic data with technology stack tracking
- **Contacts** - Contact information with verification status
- **Visitor Sessions** - Website visitor tracking with intent scoring
- **Sequences** - Multi-channel outreach campaign definitions
- **Emails** - Email tracking with AI scoring and suggestions
- **Insights** - Company triggers (funding, hiring, leadership changes)
- **Personas** - Target audience definitions with value propositions
- **Tasks** - Task management and follow-ups
- **Campaigns** - Campaign orchestration and metrics

## Project Structure
```
server/
  ├── db.ts              # Database connection (Drizzle + Neon)
  ├── storage.ts         # DbStorage implementation (PostgreSQL)
  ├── seed.ts            # Database seeding script
  ├── routes.ts          # API routes
  ├── services/          # AI and business logic services
  └── index.ts           # Express server setup

client/
  └── src/
      ├── pages/         # Frontend pages (Dashboard, Email Coach, etc.)
      ├── components/    # Reusable UI components
      └── lib/           # API client and utilities

shared/
  └── schema.ts          # Drizzle schema and Zod validators
```

## Environment Variables
- `DATABASE_URL` - PostgreSQL connection string (configured)
- `SESSION_SECRET` - Session encryption key (configured)
- `OPENAI_API_KEY` - OpenAI API key for AI features (optional, user needs to add)

## Running the Application
1. Click the **Run** button in Replit to start the development server
2. The server runs on port 5000 (configured in .replit)
3. Backend and frontend are served together on the same port

## Next Steps (Planned Features)
1. ✅ PostgreSQL database setup - **COMPLETED**
2. Fix critical TypeScript errors in frontend
3. Test core MVP workflows end-to-end
4. Implement visitor de-anonymization with IP intelligence APIs
5. Build cloud dialer integration
6. Add LinkedIn and SMS channels
7. Create AI auto-pilot mode
8. Integrate contact enrichment providers
9. Implement email account rotation
10. Build A/Z multivariate testing
11. Add CRM integrations (Salesforce, HubSpot, Pipedrive)
12. Create REST/GraphQL API for third-party integrations

## Architecture Notes
- **Frontend**: React + Vite + TailwindCSS + shadcn/ui
- **Backend**: Express + TypeScript
- **Database**: PostgreSQL (Neon) + Drizzle ORM
- **AI**: OpenAI GPT-4 for email analysis and content generation
- **Routing**: Wouter for client-side routing
- **State**: TanStack Query for server state management

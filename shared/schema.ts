import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, jsonb, decimal, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: text("role").notNull().default("Sales Rep"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const companies = pgTable("companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  domain: text("domain"),
  industry: text("industry"),
  size: text("size"), // "1-10", "11-50", "51-200", etc.
  location: text("location"),
  revenue: text("revenue"),
  technologies: text("technologies").array(),
  description: text("description"),
  linkedinUrl: text("linkedin_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const contacts = pgTable("contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id),
  email: text("email").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  title: text("title"),
  linkedinUrl: text("linkedin_url"),
  phoneNumber: text("phone_number"),
  isVerified: boolean("is_verified").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const visitorSessions = pgTable("visitor_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id),
  ipAddress: text("ip_address").notNull(),
  userAgent: text("user_agent"),
  pagesViewed: text("pages_viewed").array(),
  timeOnSite: integer("time_on_site"), // seconds
  intentScore: integer("intent_score").default(0),
  isActive: boolean("is_active").default(true),
  lastActivity: timestamp("last_activity").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sequences = pgTable("sequences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("draft"), // draft, active, paused, completed
  steps: jsonb("steps").notNull(), // Array of sequence steps
  targets: jsonb("targets"), // Target criteria
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sequenceExecutions = pgTable("sequence_executions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sequenceId: varchar("sequence_id").references(() => sequences.id),
  contactId: varchar("contact_id").references(() => contacts.id),
  currentStep: integer("current_step").default(0),
  status: text("status").notNull().default("active"), // active, paused, completed, bounced
  lastExecuted: timestamp("last_executed"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const emails = pgTable("emails", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sequenceExecutionId: varchar("sequence_execution_id").references(() => sequenceExecutions.id),
  contactId: varchar("contact_id").references(() => contacts.id),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  status: text("status").notNull().default("draft"), // draft, sent, delivered, opened, replied, bounced
  sentAt: timestamp("sent_at"),
  openedAt: timestamp("opened_at"),
  repliedAt: timestamp("replied_at"),
  aiScore: integer("ai_score"), // AI analysis score
  aiSuggestions: jsonb("ai_suggestions"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insights = pgTable("insights", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").references(() => companies.id),
  type: text("type").notNull(), // funding, hiring, product_launch, leadership_change, etc.
  title: text("title").notNull(),
  description: text("description").notNull(),
  source: text("source"), // SEC filings, LinkedIn, news, etc.
  confidence: decimal("confidence", { precision: 3, scale: 2 }), // 0.00 to 1.00
  relevanceScore: integer("relevance_score"), // 1-100
  actionable: boolean("actionable").default(true),
  data: jsonb("data"), // Additional structured data
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Workflows and AI Agents
export const workflows = pgTable("workflows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  nlpDescription: text("nlp_description"), // Natural language description used to generate workflow
  status: text("status").notNull().default("draft"), // draft, active, paused, archived
  triggerType: text("trigger_type").notNull(), // manual, schedule, webhook, event, form
  triggerConfig: jsonb("trigger_config"), // Configuration for the trigger
  nodes: jsonb("nodes").notNull(), // Array of workflow nodes
  edges: jsonb("edges").notNull(), // Array of connections between nodes
  settings: jsonb("settings"), // Workflow settings (approval requirements, etc.)
  category: text("category"), // sales, marketing, support, operations
  isTemplate: boolean("is_template").default(false),
  createdBy: varchar("created_by").references(() => users.id),
  updatedBy: varchar("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const workflowExecutions = pgTable("workflow_executions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  workflowId: varchar("workflow_id").references(() => workflows.id),
  status: text("status").notNull().default("running"), // running, paused, completed, failed, cancelled
  currentNodeId: text("current_node_id"),
  context: jsonb("context"), // Execution context and variables
  logs: jsonb("logs"), // Execution logs for each step
  error: text("error"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  executionTime: integer("execution_time"), // milliseconds
});

export const agentTypes = pgTable("agent_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  category: text("category").notNull(), // research, writing, analysis, communication, data
  capabilities: jsonb("capabilities"), // List of specific capabilities
  inputs: jsonb("inputs"), // Required input schema
  outputs: jsonb("outputs"), // Expected output schema
  modelPreference: text("model_preference"), // gpt-4, claude-3, etc.
  maxTokens: integer("max_tokens").default(2000),
  temperature: decimal("temperature", { precision: 2, scale: 1 }).default(0.7),
  systemPrompt: text("system_prompt"),
  examples: jsonb("examples"), // Few-shot examples
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const workflowTemplates = pgTable("workflow_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(), // sales, marketing, support, operations
  useCase: text("use_case"),
  difficulty: text("difficulty"), // beginner, intermediate, advanced
  estimatedTime: text("estimated_time"), // "5 mins", "30 mins", etc.
  thumbnail: text("thumbnail"), // URL or icon name
  workflowDefinition: jsonb("workflow_definition").notNull(), // Full workflow JSON
  requiredIntegrations: text("required_integrations").array(),
  tags: text("tags").array(),
  usageCount: integer("usage_count").default(0),
  rating: decimal("rating", { precision: 2, scale: 1 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const humanApprovals = pgTable("human_approvals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  executionId: varchar("execution_id").references(() => workflowExecutions.id),
  nodeId: text("node_id").notNull(),
  status: text("status").notNull().default("pending"), // pending, approved, rejected, timeout
  requestData: jsonb("request_data"), // Data to be approved
  approverNotes: text("approver_notes"),
  approvedBy: varchar("approved_by").references(() => users.id),
  requestedAt: timestamp("requested_at").defaultNow().notNull(),
  respondedAt: timestamp("responded_at"),
  timeoutAt: timestamp("timeout_at"),
});

// Marketplace Tables
export const marketplaceAgents = pgTable("marketplace_agents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(), // same categories as agentTypes: research, writing, analysis, communication, data
  agentTypeId: varchar("agent_type_id").references(() => agentTypes.id),
  author: varchar("author").references(() => users.id).notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull().default("0"), // 0 for free agents
  downloads: integer("downloads").notNull().default(0),
  rating: decimal("rating", { precision: 2, scale: 1 }), // Average rating 1.0-5.0
  isPublic: boolean("is_public").notNull().default(true),
  tags: text("tags").array(),
  configTemplate: jsonb("config_template"), // Default configuration for the agent
  systemPrompt: text("system_prompt"),
  inputSchema: jsonb("input_schema"), // Expected input structure
  outputSchema: jsonb("output_schema"), // Expected output structure
  version: text("version").notNull().default("1.0.0"),
  changeLog: jsonb("change_log"), // Array of version changes
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const agentRatings = pgTable("agent_ratings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").references(() => marketplaceAgents.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  rating: integer("rating").notNull(), // 1-5
  review: text("review"),
  helpfulCount: integer("helpful_count").notNull().default(0),
  unhelpfulCount: integer("unhelpful_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const agentDownloads = pgTable("agent_downloads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").references(() => marketplaceAgents.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  downloadedAt: timestamp("downloaded_at").defaultNow().notNull(),
  version: text("version").notNull(),
});

export const agentPurchases = pgTable("agent_purchases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agentId: varchar("agent_id").references(() => marketplaceAgents.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  purchasedAt: timestamp("purchased_at").defaultNow().notNull(),
  transactionId: text("transaction_id").notNull(),
});

export const personas = pgTable("personas", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  targetTitles: text("target_titles").array(),
  industries: text("industries").array(),
  companySizes: text("company_sizes").array(),
  valuePropositions: jsonb("value_propositions"),
  toneGuidelines: jsonb("tone_guidelines"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const campaigns = pgTable("campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("active"),
  sequenceIds: text("sequence_ids").array(),
  metrics: jsonb("metrics"), // Performance metrics
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type").notNull(), // follow_up, review_email, call, etc.
  priority: text("priority").notNull().default("medium"), // low, medium, high
  status: text("status").notNull().default("pending"), // pending, completed, cancelled
  contactId: varchar("contact_id").references(() => contacts.id),
  companyId: varchar("company_id").references(() => companies.id),
  assignedTo: varchar("assigned_to").references(() => users.id),
  dueDate: timestamp("due_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const phoneCalls = pgTable("phone_calls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contactId: varchar("contact_id").references(() => contacts.id),
  userId: varchar("user_id").references(() => users.id),
  phoneNumber: text("phone_number").notNull(),
  direction: text("direction").notNull(), // inbound, outbound
  status: text("status").notNull(), // initiated, ringing, connected, completed, failed, voicemail
  duration: integer("duration"), // seconds
  recordingUrl: text("recording_url"),
  transcription: text("transcription"),
  sentiment: text("sentiment"), // positive, neutral, negative
  talkTrackId: varchar("talk_track_id"),
  notes: text("notes"),
  scheduledAt: timestamp("scheduled_at"),
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const callScripts = pgTable("call_scripts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull(), // cold_call, follow_up, demo_booking, objection_handling
  personaId: varchar("persona_id").references(() => personas.id),
  opening: text("opening").notNull(),
  valueProps: text("value_props").array(),
  questions: text("questions").array(),
  objectionHandlers: jsonb("objection_handlers"), // { objection: response } mapping
  closing: text("closing"),
  aiGenerated: boolean("ai_generated").default(false),
  successRate: decimal("success_rate", { precision: 5, scale: 2 }),
  usageCount: integer("usage_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const voicemails = pgTable("voicemails", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  callId: varchar("call_id").references(() => phoneCalls.id),
  contactId: varchar("contact_id").references(() => contacts.id),
  scriptId: varchar("script_id").references(() => callScripts.id),
  audioUrl: text("audio_url"),
  transcription: text("transcription"),
  duration: integer("duration"), // seconds
  isListened: boolean("is_listened").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const aiAgents = pgTable("ai_agents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull(), // prospecting, engagement, booking
  description: text("description"),
  status: text("status").notNull().default("active"), // active, paused
  persona: text("persona"),
  targetsPerDay: integer("targets_per_day").notNull().default(50),
  currentProgress: integer("current_progress").notNull().default(0),
  successRate: decimal("success_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  totalContacted: integer("total_contacted").notNull().default(0),
  totalQualified: integer("total_qualified").notNull().default(0),
  totalResponded: integer("total_responded").notNull().default(0),
  totalBooked: integer("total_booked").notNull().default(0),
  totalAttended: integer("total_attended").notNull().default(0),
  settings: jsonb("settings").notNull().default('{}'),
  lastRun: timestamp("last_run"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Platform Configuration for Magic Setup
export const platformConfigs = pgTable("platform_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  // LinkedIn Import Data
  linkedinProfile: jsonb("linkedin_profile"), // Parsed LinkedIn data
  linkedinUrl: text("linkedin_url"),
  
  // Auto-configured Settings
  industryPlaybook: text("industry_playbook"), // SaaS, Enterprise, Ecommerce, etc.
  emailTemplates: jsonb("email_templates"), // Auto-generated templates
  sequences: jsonb("sequences"), // Pre-configured sequences
  
  // Domain & Email Settings  
  emailDomain: text("email_domain"),
  dailySendLimit: integer("daily_send_limit").default(50),
  warmupEnabled: boolean("warmup_enabled").default(true),
  
  // Automation Settings
  autopilotEnabled: boolean("autopilot_enabled").default(false),
  autoFollowUp: boolean("auto_follow_up").default(true),
  smartScheduling: boolean("smart_scheduling").default(true),
  
  // Lead Scoring Configuration
  leadScoringRules: jsonb("lead_scoring_rules"),
  qualificationCriteria: jsonb("qualification_criteria"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Workflow Automation Rules
export const workflowTriggers = pgTable("workflow_triggers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  triggerType: text("trigger_type").notNull(), // email_opened, page_visit, form_submission, time_based, lead_score
  triggerConditions: jsonb("trigger_conditions").notNull(),
  actions: jsonb("actions").notNull(), // Array of actions to take
  isActive: boolean("is_active").default(true),
  executionCount: integer("execution_count").default(0),
  lastExecuted: timestamp("last_executed"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Lead Scoring Models table
export const leadScoringModels = pgTable("lead_scoring_models", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  modelType: text("model_type").notNull(), // predictive, behavioral, demographic, firmographic
  scoringFactors: jsonb("scoring_factors").notNull(), // Factors and weights
  thresholds: jsonb("thresholds").notNull(), // Score thresholds for hot/warm/cold
  isActive: boolean("is_active").default(true),
  accuracy: integer("accuracy"), // Model accuracy percentage
  lastTrained: timestamp("last_trained"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Lead Scores table (individual lead scores)
export const leadScores = pgTable("lead_scores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contactId: varchar("contact_id").notNull().references(() => contacts.id),
  modelId: varchar("model_id").notNull().references(() => leadScoringModels.id),
  score: integer("score").notNull(), // 0-100
  category: text("category").notNull(), // hot, warm, cold
  factors: jsonb("factors").notNull(), // Individual factor contributions
  predictedConversionRate: integer("predicted_conversion_rate"), // Percentage
  daysToConvert: integer("days_to_convert"), // Predicted days to conversion
  nextBestAction: text("next_best_action"), // Recommended action
  calculatedAt: timestamp("calculated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Industry Playbooks
export const autopilotCampaigns = pgTable("autopilot_campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  status: text("status").notNull().default("paused"), // active, paused, completed
  targetPersona: varchar("target_persona").references(() => personas.id),
  sequence: varchar("sequence_id").references(() => sequences.id),
  
  // Configuration
  dailyTargetLeads: integer("daily_target_leads").default(50),
  dailySendLimit: integer("daily_send_limit").default(100),
  workingHours: jsonb("working_hours"), // { start: "09:00", end: "17:00", timezone: "UTC" }
  workingDays: jsonb("working_days"), // ["Monday", "Tuesday", ...]
  
  // Autonomous behaviors
  autoProspect: boolean("auto_prospect").default(true),
  autoFollowUp: boolean("auto_follow_up").default(true),
  autoQualify: boolean("auto_qualify").default(false),
  autoBookMeetings: boolean("auto_book_meetings").default(false),
  
  // AI Configuration
  creativityLevel: integer("creativity_level").default(5), // 1-10
  personalizationDepth: text("personalization_depth").default("moderate"), // light, moderate, deep
  toneOfVoice: text("tone_of_voice").default("professional"), // professional, casual, direct
  
  // Metrics
  totalLeadsProcessed: integer("total_leads_processed").default(0),
  totalEmailsSent: integer("total_emails_sent").default(0),
  totalReplies: integer("total_replies").default(0),
  totalMeetingsBooked: integer("total_meetings_booked").default(0),
  
  // Dates
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  lastRunAt: timestamp("last_run_at"),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const autopilotRuns = pgTable("autopilot_runs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").references(() => autopilotCampaigns.id).notNull(),
  status: text("status").notNull().default("running"), // running, completed, failed
  runType: text("run_type").notNull(), // prospecting, follow_up, qualification
  
  // Run Details
  leadsProcessed: integer("leads_processed").default(0),
  emailsSent: integer("emails_sent").default(0),
  emailsSkipped: integer("emails_skipped").default(0),
  errors: jsonb("errors"), // Array of error messages
  
  // AI Decisions
  decisions: jsonb("decisions"), // Array of AI decisions made
  qualificationResults: jsonb("qualification_results"),
  
  // Timing
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  duration: integer("duration"), // in seconds
});

export const playbooks = pgTable("playbooks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  industry: text("industry").notNull(),
  description: text("description"),
  targetAudience: jsonb("target_audience"), // ICP definition
  sequences: jsonb("sequences"), // Pre-built sequences
  emailTemplates: jsonb("email_templates"),
  callScripts: jsonb("call_scripts"),
  objectionHandling: jsonb("objection_handling"),
  successMetrics: jsonb("success_metrics"),
  isTemplate: boolean("is_template").default(true),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// SDR Teams Tables
export const sdrTeams = pgTable("sdr_teams", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  teamType: text("team_type").notNull().default("hybrid"), // hunter, farmer, hybrid
  memberRoles: jsonb("member_roles").notNull(), // Array of roles: researcher, writer, qualifier, scheduler, manager
  strategy: jsonb("strategy"), // Team strategy configuration
  performanceMetrics: jsonb("performance_metrics"), // Team performance data
  isActive: boolean("is_active").default(true),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const sdrTeamMembers = pgTable("sdr_team_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id").notNull().references(() => sdrTeams.id),
  role: text("role").notNull(), // researcher, writer, qualifier, scheduler, manager
  agentTypeId: varchar("agent_type_id").references(() => agentTypes.id),
  personalityProfile: jsonb("personality_profile"), // AI persona configuration
  skills: text("skills").array(), // Specialized skills for this team member
  currentLoad: integer("current_load").default(0), // Number of active tasks
  performance: jsonb("performance"), // Individual performance metrics
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const teamCollaborations = pgTable("team_collaborations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id").notNull().references(() => sdrTeams.id),
  dealId: varchar("deal_id"), // Reference to deal/opportunity
  contactId: varchar("contact_id").references(() => contacts.id),
  companyId: varchar("company_id").references(() => companies.id),
  collaborationType: text("collaboration_type").notNull(), // research, outreach, qualification, scheduling, review
  participantRoles: text("participant_roles").array(), // Array of participating member roles
  decisions: jsonb("decisions"), // AI decisions made during collaboration
  outcome: text("outcome"), // success, failed, pending
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  duration: integer("duration"), // Duration in seconds
});

export const teamPerformance = pgTable("team_performance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  teamId: varchar("team_id").notNull().references(() => sdrTeams.id),
  period: text("period").notNull(), // daily, weekly, monthly
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  metrics: jsonb("metrics").notNull(), // Detailed performance metrics
  wins: integer("wins").default(0),
  losses: integer("losses").default(0),
  conversionRate: decimal("conversion_rate", { precision: 5, scale: 2 }), // Percentage
  avgDealSize: decimal("avg_deal_size", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const onboardingProfiles = pgTable("onboarding_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").unique(),  // Removed foreign key for demo purposes
  companyName: text("company_name"),
  companyWebsite: text("company_website"),
  industry: text("industry"),
  companySize: text("company_size"),
  targetMarket: text("target_market"), // B2B, B2C, Enterprise, SMB
  salesCycle: text("sales_cycle"), // short (< 30 days), medium (30-90), long (> 90)
  primaryGoal: text("primary_goal"), // lead_gen, closing, nurturing, all
  currentCRM: text("current_crm"),
  teamSize: integer("team_size"),
  monthlyLeadTarget: integer("monthly_lead_target"),
  avgDealSize: integer("avg_deal_size"),
  onboardingStep: integer("onboarding_step").notNull().default(1),
  isComplete: boolean("is_complete").notNull().default(false),
  aiSuggestions: jsonb("ai_suggestions"), // AI-generated suggestions
  autoConfigured: jsonb("auto_configured"), // What was auto-setup
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

// Digital Twin Prospects - AI-powered prospect modeling
export const digitalTwins = pgTable("digital_twins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contactId: varchar("contact_id").notNull().references(() => contacts.id),
  companyId: varchar("company_id").references(() => companies.id),
  
  // Communication preferences
  communicationStyle: text("communication_style"), // formal, casual, technical, friendly
  preferredChannels: text("preferred_channels").array(), // email, linkedin, phone
  bestEngagementTime: text("best_engagement_time"), // morning, afternoon, evening
  
  // Personality insights
  personalityTraits: jsonb("personality_traits"), // decision_style, risk_tolerance, etc.
  interests: text("interests").array(),
  values: text("values").array(),
  painPoints: text("pain_points").array(),
  
  // Content preferences
  contentPreferences: text("content_preferences").array(), // case_studies, whitepapers, videos, demos
  
  // Buying journey indicators
  buyingStageIndicators: jsonb("buying_stage_indicators"),
  objectionsHistory: jsonb("objections_history"),
  
  // Model metadata
  modelConfidence: integer("model_confidence").default(50), // 0-100
  lastModelUpdate: timestamp("last_model_update").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Track all interactions for twin learning
export const twinInteractions = pgTable("twin_interactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  twinId: varchar("twin_id").notNull().references(() => digitalTwins.id),
  
  // Interaction details
  interactionType: text("interaction_type").notNull(), // email_open, email_click, email_reply, meeting, call
  channel: text("channel").notNull(), // email, linkedin, phone, meeting
  content: text("content"), // Message content or description
  response: text("response"), // Prospect's response
  
  // Analysis
  sentiment: text("sentiment"), // positive, neutral, negative
  engagementScore: integer("engagement_score"), // 0-100
  outcome: text("outcome"), // interested, not_interested, deferred, meeting_booked
  
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

// AI predictions about prospects
export const twinPredictions = pgTable("twin_predictions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  twinId: varchar("twin_id").notNull().references(() => digitalTwins.id),
  
  predictionType: text("prediction_type").notNull(), // next_action, buying_stage, conversion_probability
  prediction: text("prediction").notNull(),
  confidence: integer("confidence").notNull(), // 0-100
  
  validatedAt: timestamp("validated_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Deal Intelligence Tables
export const intentSignals = pgTable("intent_signals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contactId: varchar("contact_id").references(() => contacts.id),
  companyId: varchar("company_id").references(() => companies.id),
  signalType: text("signal_type").notNull(), // website_visit, content_download, email_open, price_check, competitor_research
  signalStrength: integer("signal_strength").notNull().default(5), // 1-10
  source: text("source"), // web, email, social, search, etc.
  metadata: jsonb("metadata"), // Additional signal-specific data
  detectedAt: timestamp("detected_at").defaultNow().notNull(),
});

export const dealIntelligence = pgTable("deal_intelligence", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id),
  intentScore: integer("intent_score").notNull().default(0), // 0-100
  buyingStage: text("buying_stage"), // awareness, consideration, decision, purchase
  competitorMentions: jsonb("competitor_mentions"), // Track competitor research
  budgetIndicators: jsonb("budget_indicators"), // Budget signals and indicators
  timelineSignals: jsonb("timeline_signals"), // Timing and urgency signals
  decisionMakers: jsonb("decision_makers"), // Key decision makers identified
  blockers: jsonb("blockers"), // Potential deal blockers
  champions: jsonb("champions"), // Internal champions identified
  predictedCloseDate: timestamp("predicted_close_date"),
  predictedDealSize: decimal("predicted_deal_size", { precision: 12, scale: 2 }),
  winProbability: integer("win_probability"), // 0-100
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
});

export const timingOptimization = pgTable("timing_optimization", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contactId: varchar("contact_id").notNull().references(() => contacts.id),
  bestCallTime: text("best_call_time"), // e.g., "Monday 10:00 AM"
  bestEmailTime: text("best_email_time"), // e.g., "Tuesday 2:00 PM"
  bestLinkedInTime: text("best_linkedin_time"), // e.g., "Wednesday 3:00 PM"
  responsePatterns: jsonb("response_patterns"), // Historical response patterns
  timezone: text("timezone"), // Contact's timezone
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const predictiveModels = pgTable("predictive_models", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  modelType: text("model_type").notNull(), // intent_scoring, deal_forecast, timing_prediction, etc.
  predictions: jsonb("predictions").notNull(), // Model predictions and outputs
  accuracy: decimal("accuracy", { precision: 5, scale: 2 }), // Model accuracy percentage
  trainedAt: timestamp("trained_at").defaultNow().notNull(),
});

// Revenue Operations Tables
export const pipelineHealth = pgTable("pipeline_health", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  snapshotDate: timestamp("snapshot_date").defaultNow().notNull(),
  totalDeals: integer("total_deals").notNull().default(0),
  totalValue: decimal("total_value", { precision: 12, scale: 2 }).notNull().default(0),
  byStage: jsonb("by_stage").notNull(), // Stage-wise breakdown of deals
  velocity: jsonb("velocity").notNull(), // Deal velocity metrics
  conversion: jsonb("conversion").notNull(), // Conversion rates between stages
  riskIndicators: jsonb("risk_indicators").notNull(), // Array of risk indicators
  healthScore: integer("health_score").notNull().default(50), // 0-100 health score
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const dealForensics = pgTable("deal_forensics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id").notNull(), // Reference to specific deal
  analysisType: text("analysis_type").notNull(), // won, lost, stuck
  rootCauses: jsonb("root_causes").notNull(), // Array of root causes
  criticalMoments: jsonb("critical_moments").notNull(), // Array of critical moments in the deal
  missedOpportunities: jsonb("missed_opportunities"), // What could have been done better
  recommendations: jsonb("recommendations").notNull(), // AI-generated recommendations
  competitorFactors: jsonb("competitor_factors"), // Competitor involvement and impact
  analyzedAt: timestamp("analyzed_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const revenueForecasts = pgTable("revenue_forecasts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  forecastPeriod: text("forecast_period").notNull(), // e.g., "Q1 2025", "2025"
  predictedRevenue: decimal("predicted_revenue", { precision: 12, scale: 2 }).notNull(),
  confidenceLevel: decimal("confidence_level", { precision: 5, scale: 2 }).notNull(), // 0.00 to 1.00
  assumptions: jsonb("assumptions").notNull(), // Array of assumptions made
  scenarios: jsonb("scenarios").notNull(), // Best case, worst case, most likely scenarios
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const coachingInsights = pgTable("coaching_insights", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  insightType: text("insight_type").notNull(), // performance, behavior, skills, opportunity
  insight: text("insight").notNull(), // The actual insight text
  actionItems: jsonb("action_items").notNull(), // Array of specific actions to take
  priority: text("priority").notNull().default("medium"), // high, medium, low
  status: text("status").notNull().default("pending"), // pending, acknowledged, completed
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Multi-Channel Orchestration Tables
export const channelConfigs = pgTable("channel_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  channel: text("channel").notNull(), // email, linkedin, sms, phone, physical_mail
  credentials: jsonb("credentials"), // Encrypted channel-specific credentials
  settings: jsonb("settings"), // Channel-specific settings
  isActive: boolean("is_active").notNull().default(true),
  dailyLimits: jsonb("daily_limits"), // Daily send limits per channel
  currentUsage: jsonb("current_usage"), // Current usage stats
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const multiChannelCampaigns = pgTable("multi_channel_campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  channels: text("channels").array().notNull(), // Array of channels to use
  sequenceSteps: jsonb("sequence_steps").notNull(), // Steps with channel info
  audience: jsonb("audience"), // Target audience criteria
  status: text("status").notNull().default("draft"), // draft, active, paused, completed
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  metrics: jsonb("metrics"), // Campaign performance metrics
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const channelMessages = pgTable("channel_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").references(() => multiChannelCampaigns.id),
  channel: text("channel").notNull(), // email, linkedin, sms, phone, physical_mail
  recipientId: varchar("recipient_id").references(() => contacts.id),
  content: jsonb("content").notNull(), // Channel-specific content structure
  scheduledAt: timestamp("scheduled_at"),
  sentAt: timestamp("sent_at"),
  status: text("status").notNull().default("pending"), // pending, sent, delivered, failed, bounced
  response: jsonb("response"), // Channel-specific response data
  engagement: jsonb("engagement"), // Opens, clicks, replies, etc.
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Unified Inbox Messages
export const inboxMessages = pgTable("inbox_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  contactId: varchar("contact_id").references(() => contacts.id),
  companyId: varchar("company_id").references(() => companies.id),
  channel: text("channel").notNull().default("email"), // email, linkedin, sms, phone
  direction: text("direction").notNull().default("inbound"), // inbound, outbound
  fromEmail: text("from_email"),
  fromName: text("from_name"),
  toEmail: text("to_email"),
  subject: text("subject"),
  content: text("content").notNull(),
  preview: text("preview"),
  category: text("category"), // interested, follow_up, objection, unsubscribe, out_of_office
  aiScore: integer("ai_score"), // AI confidence score for categorization (0-100)
  sentiment: text("sentiment"), // positive, neutral, negative
  urgency: text("urgency"), // high, medium, low
  isRead: boolean("is_read").notNull().default(false),
  isStarred: boolean("is_starred").notNull().default(false),
  isArchived: boolean("is_archived").notNull().default(false),
  threadId: varchar("thread_id"), // For conversation threading
  metadata: jsonb("metadata"), // Additional channel-specific metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const channelOrchestration = pgTable("channel_orchestration", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").notNull().references(() => multiChannelCampaigns.id),
  rules: jsonb("rules").notNull(), // Orchestration rules and conditions
  priorityOrder: text("priority_order").array().notNull(), // Channel priority order
  switchConditions: jsonb("switch_conditions"), // Conditions for switching channels
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Browser Extension Tables
export const extensionUsers = pgTable("extension_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  extensionId: text("extension_id").notNull(),
  installedAt: timestamp("installed_at").defaultNow().notNull(),
  lastActiveAt: timestamp("last_active_at").defaultNow().notNull(),
  settings: jsonb("settings").notNull().default('{}'),
  isActive: boolean("is_active").notNull().default(true),
});

export const enrichmentCache = pgTable("enrichment_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  domain: text("domain").notNull(),
  companyData: jsonb("company_data"),
  contactData: jsonb("contact_data"),
  technologies: jsonb("technologies"),
  socialProfiles: jsonb("social_profiles"),
  cachedAt: timestamp("cached_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});

export const extensionActivities = pgTable("extension_activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  activityType: text("activity_type").notNull(), // view, enrich, save
  url: text("url"),
  domain: text("domain"),
  enrichedData: jsonb("enriched_data"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const quickActions = pgTable("quick_actions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  actionType: text("action_type").notNull(), // add_to_sequence, send_email, save_lead
  targetData: jsonb("target_data").notNull(),
  executedAt: timestamp("executed_at").defaultNow().notNull(),
  result: jsonb("result"),
});

// Voice AI Tables
export const voiceCampaigns = pgTable("voice_campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  script: text("script"),
  targetList: jsonb("target_list"), // Array of contact IDs or criteria
  callSchedule: jsonb("call_schedule"), // Schedule configuration
  status: text("status").notNull().default("draft"), // draft, active, paused, completed
  voiceSettings: jsonb("voice_settings"), // { voiceType: string, speed: number, pitch: number }
  complianceSettings: jsonb("compliance_settings"), // Do-not-call list, consent requirements
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const voiceCalls = pgTable("voice_calls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  campaignId: varchar("campaign_id").references(() => voiceCampaigns.id),
  contactId: varchar("contact_id").references(() => contacts.id),
  phoneNumber: text("phone_number").notNull(),
  callStatus: text("call_status").notNull().default("initiated"), // initiated, ringing, answered, voicemail, failed
  duration: integer("duration"), // Duration in seconds
  startTime: timestamp("start_time"),
  endTime: timestamp("end_time"),
  recordingUrl: text("recording_url"),
  transcript: text("transcript"),
  sentiment: jsonb("sentiment"), // Sentiment analysis results
  outcome: text("outcome"), // interested, not_interested, callback_scheduled, voicemail_left
  consentObtained: boolean("consent_obtained").default(false),
  doNotCallStatus: boolean("do_not_call_status").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const voiceScripts = pgTable("voice_scripts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  scriptType: text("script_type").notNull(), // cold_call, follow_up, demo_booking
  introduction: text("introduction").notNull(),
  mainContent: text("main_content").notNull(),
  objectionHandlers: jsonb("objection_handlers"), // Map of objections to responses
  closingStatement: text("closing_statement"),
  fallbackResponses: jsonb("fallback_responses"), // Default responses for unexpected inputs
  variables: jsonb("variables"), // Placeholders that can be personalized
  performanceMetrics: jsonb("performance_metrics"), // Success rate, avg duration, etc.
  isActive: boolean("is_active").default(true),
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const callAnalytics = pgTable("call_analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  callId: varchar("call_id").references(() => voiceCalls.id),
  keyMoments: jsonb("key_moments"), // Array of important moments in the conversation
  speakingRatio: decimal("speaking_ratio", { precision: 3, scale: 2 }), // Prospect vs AI speaking ratio
  interruptionCount: integer("interruption_count").default(0),
  talkSpeed: integer("talk_speed"), // Words per minute
  emotionalTone: jsonb("emotional_tone"), // Detected emotions throughout the call
  conversionPoints: jsonb("conversion_points"), // Moments where prospect showed interest
  objectionCount: integer("objection_count").default(0),
  positiveSignals: integer("positive_signals").default(0),
  negativeSignals: integer("negative_signals").default(0),
  nextBestAction: text("next_best_action"), // Recommended follow-up action
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Crowd Intelligence Tables
export const sharedIntel = pgTable("shared_intel", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  category: text("category").notNull(), // email_templates, objection_handlers, sequences, tactics
  content: jsonb("content").notNull(), // The actual content being shared
  effectiveness: decimal("effectiveness", { precision: 5, scale: 2 }), // 0-100
  industry: text("industry"),
  companySize: text("company_size"), // "1-10", "11-50", etc.
  useCount: integer("use_count").default(0),
  successRate: decimal("success_rate", { precision: 5, scale: 2 }),
  tags: text("tags").array(),
  contributorCount: integer("contributor_count").default(1),
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const intelContributions = pgTable("intel_contributions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  intelId: varchar("intel_id").references(() => sharedIntel.id).notNull(),
  userId: text("user_id").notNull(), // Hashed for privacy
  contributionType: text("contribution_type").notNull(), // created, improved, validated
  performanceData: jsonb("performance_data"), // Anonymous performance metrics
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const intelRatings = pgTable("intel_ratings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  intelId: varchar("intel_id").references(() => sharedIntel.id).notNull(),
  userId: text("user_id").notNull(), // Hashed for privacy
  rating: integer("rating").notNull(), // 1-5
  feedback: text("feedback"),
  usefulnessScore: integer("usefulness_score"), // 0-100
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const benchmarkData = pgTable("benchmark_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  metric: text("metric").notNull(), // open_rate, reply_rate, conversion_rate
  industry: text("industry"),
  companySize: text("company_size"),
  channel: text("channel"), // email, phone, linkedin, etc.
  value: decimal("value", { precision: 10, scale: 4 }).notNull(),
  sampleSize: integer("sample_size").notNull(),
  lastCalculated: timestamp("last_calculated").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertCompanySchema = createInsertSchema(companies).omit({
  id: true,
  createdAt: true,
});

export const insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  createdAt: true,
});

export const insertVisitorSessionSchema = createInsertSchema(visitorSessions).omit({
  id: true,
  createdAt: true,
  lastActivity: true,
});

export const insertSequenceSchema = createInsertSchema(sequences).omit({
  id: true,
  createdAt: true,
});

export const insertEmailSchema = createInsertSchema(emails).omit({
  id: true,
  createdAt: true,
});

export const insertInsightSchema = createInsertSchema(insights).omit({
  id: true,
  createdAt: true,
});

export const insertPersonaSchema = createInsertSchema(personas).omit({
  id: true,
  createdAt: true,
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
});

export const insertPhoneCallSchema = createInsertSchema(phoneCalls).omit({
  id: true,
  createdAt: true,
});

export const insertCallScriptSchema = createInsertSchema(callScripts).omit({
  id: true,
  createdAt: true,
});

export const insertVoicemailSchema = createInsertSchema(voicemails).omit({
  id: true,
  createdAt: true,
});

export const insertAiAgentSchema = createInsertSchema(aiAgents).omit({
  id: true,
  createdAt: true,
  lastRun: true,
});

export const insertOnboardingProfileSchema = createInsertSchema(onboardingProfiles).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export const insertDigitalTwinSchema = createInsertSchema(digitalTwins).omit({
  id: true,
  createdAt: true,
  lastModelUpdate: true,
});

export const insertTwinInteractionSchema = createInsertSchema(twinInteractions).omit({
  id: true,
  timestamp: true,
});

export const insertTwinPredictionSchema = createInsertSchema(twinPredictions).omit({
  id: true,
  createdAt: true,
});

export const insertPlatformConfigSchema = createInsertSchema(platformConfigs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWorkflowTriggerSchema = createInsertSchema(workflowTriggers).omit({
  id: true,
  createdAt: true,
  lastExecuted: true,
});

export const insertPlaybookSchema = createInsertSchema(playbooks).omit({
  id: true,
  createdAt: true,
});

// SDR Teams insert schemas
export const insertSdrTeamSchema = createInsertSchema(sdrTeams).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSdrTeamMemberSchema = createInsertSchema(sdrTeamMembers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTeamCollaborationSchema = createInsertSchema(teamCollaborations).omit({
  id: true,
  timestamp: true,
});

export const insertTeamPerformanceSchema = createInsertSchema(teamPerformance).omit({
  id: true,
  createdAt: true,
});

export const insertAutopilotCampaignSchema = createInsertSchema(autopilotCampaigns).omit({
  id: true,
  createdAt: true,
  lastRunAt: true,
  totalLeadsProcessed: true,
  totalEmailsSent: true,
  totalReplies: true,
  totalMeetingsBooked: true,
});

export const insertAutopilotRunSchema = createInsertSchema(autopilotRuns).omit({
  id: true,
  startedAt: true,
  completedAt: true,
  duration: true,
});

export const insertLeadScoringModelSchema = createInsertSchema(leadScoringModels).omit({
  id: true,
  lastTrained: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLeadScoreSchema = createInsertSchema(leadScores).omit({
  id: true,
  calculatedAt: true,
  createdAt: true,
});

export const insertWorkflowSchema = createInsertSchema(workflows).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertWorkflowExecutionSchema = createInsertSchema(workflowExecutions).omit({
  id: true,
  startedAt: true,
  completedAt: true,
  executionTime: true,
});

export const insertAgentTypeSchema = createInsertSchema(agentTypes).omit({
  id: true,
  createdAt: true,
});

export const insertWorkflowTemplateSchema = createInsertSchema(workflowTemplates).omit({
  id: true,
  createdAt: true,
  usageCount: true,
});

export const insertHumanApprovalSchema = createInsertSchema(humanApprovals).omit({
  id: true,
  requestedAt: true,
  respondedAt: true,
});

export const insertMarketplaceAgentSchema = createInsertSchema(marketplaceAgents).omit({
  id: true,
  downloads: true,
  rating: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAgentRatingSchema = createInsertSchema(agentRatings).omit({
  id: true,
  helpfulCount: true,
  unhelpfulCount: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAgentDownloadSchema = createInsertSchema(agentDownloads).omit({
  id: true,
  downloadedAt: true,
});

export const insertAgentPurchaseSchema = createInsertSchema(agentPurchases).omit({
  id: true,
  purchasedAt: true,
});

// Deal Intelligence insert schemas
export const insertIntentSignalSchema = createInsertSchema(intentSignals).omit({
  id: true,
  detectedAt: true,
});

export const insertDealIntelligenceSchema = createInsertSchema(dealIntelligence).omit({
  id: true,
  lastUpdated: true,
});

export const insertTimingOptimizationSchema = createInsertSchema(timingOptimization).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPredictiveModelSchema = createInsertSchema(predictiveModels).omit({
  id: true,
  trainedAt: true,
});

// Revenue Operations Insert Schemas
export const insertPipelineHealthSchema = createInsertSchema(pipelineHealth).omit({
  id: true,
  snapshotDate: true,
  createdAt: true,
});

export const insertDealForensicsSchema = createInsertSchema(dealForensics).omit({
  id: true,
  analyzedAt: true,
  createdAt: true,
});

export const insertRevenueForecastSchema = createInsertSchema(revenueForecasts).omit({
  id: true,
  createdAt: true,
});

export const insertCoachingInsightSchema = createInsertSchema(coachingInsights).omit({
  id: true,
  createdAt: true,
});

// Multi-Channel Insert Schemas
export const insertChannelConfigSchema = createInsertSchema(channelConfigs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  currentUsage: true,
});

export const insertMultiChannelCampaignSchema = createInsertSchema(multiChannelCampaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  metrics: true,
});

export const insertChannelMessageSchema = createInsertSchema(channelMessages).omit({
  id: true,
  createdAt: true,
  sentAt: true,
  response: true,
  engagement: true,
});

export const insertInboxMessageSchema = createInsertSchema(inboxMessages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertChannelOrchestrationSchema = createInsertSchema(channelOrchestration).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Browser Extension Insert Schemas
export const insertExtensionUserSchema = createInsertSchema(extensionUsers).omit({
  id: true,
  installedAt: true,
  lastActiveAt: true,
});

export const insertEnrichmentCacheSchema = createInsertSchema(enrichmentCache).omit({
  id: true,
  cachedAt: true,
});

export const insertExtensionActivitySchema = createInsertSchema(extensionActivities).omit({
  id: true,
  timestamp: true,
});

export const insertQuickActionSchema = createInsertSchema(quickActions).omit({
  id: true,
  executedAt: true,
});

// Voice AI Insert Schemas
export const insertVoiceCampaignSchema = createInsertSchema(voiceCampaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVoiceCallSchema = createInsertSchema(voiceCalls).omit({
  id: true,
  createdAt: true,
  startTime: true,
  endTime: true,
});

export const insertVoiceScriptSchema = createInsertSchema(voiceScripts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCallAnalyticsSchema = createInsertSchema(callAnalytics).omit({
  id: true,
  createdAt: true,
});

// Crowd Intelligence Insert Schemas
export const insertSharedIntelSchema = createInsertSchema(sharedIntel).omit({
  id: true,
  createdAt: true,
  lastUpdated: true,
  useCount: true,
  contributorCount: true,
});

export const insertIntelContributionSchema = createInsertSchema(intelContributions).omit({
  id: true,
  timestamp: true,
});

export const insertIntelRatingSchema = createInsertSchema(intelRatings).omit({
  id: true,
  createdAt: true,
});

export const insertBenchmarkDataSchema = createInsertSchema(benchmarkData).omit({
  id: true,
  createdAt: true,
  lastCalculated: true,
});

// Enterprise Tables
export const whiteLabels = pgTable("white_labels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().unique(),
  brandName: text("brand_name").notNull(),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color").notNull().default("#0066FF"),
  secondaryColor: text("secondary_color").notNull().default("#00D4FF"),
  customDomain: text("custom_domain"),
  customCSS: text("custom_css"),
  features: jsonb("features").notNull().default('{}'), // Features enabled for this white-label
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const enterpriseSecurity = pgTable("enterprise_security", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull().unique(),
  ssoEnabled: boolean("sso_enabled").notNull().default(false),
  ssoProvider: text("sso_provider"), // saml, oauth2, okta, azure-ad, google, etc
  ssoConfig: jsonb("sso_config"), // SSO configuration details (encrypted)
  ipWhitelist: text("ip_whitelist").array(),
  mfaRequired: boolean("mfa_required").notNull().default(false),
  mfaMethod: text("mfa_method"), // totp, sms, email
  dataResidency: text("data_residency").notNull().default("us"), // us, eu, asia, custom
  encryptionKey: text("encryption_key"), // Encrypted key for sensitive data
  auditLogRetention: integer("audit_log_retention").notNull().default(90), // Days
  complianceMode: text("compliance_mode"), // soc2, gdpr, ccpa, hipaa, none
  passwordPolicy: jsonb("password_policy"), // Min length, complexity, expiry, etc
  sessionTimeout: integer("session_timeout").notNull().default(1440), // Minutes
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const auditLogs = pgTable("audit_logs", 
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").references(() => users.id),
    organizationId: varchar("organization_id"),
    action: text("action").notNull(), // create, read, update, delete, login, logout, export, etc
    resource: text("resource").notNull(), // contact, sequence, email, report, settings, etc
    resourceId: text("resource_id"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    timestamp: timestamp("timestamp").defaultNow().notNull(),
    metadata: jsonb("metadata"), // Additional context about the action
    severity: text("severity").notNull().default("info"), // info, warning, error, critical
    outcome: text("outcome").notNull().default("success"), // success, failure
  },
  (table) => [index("IDX_audit_logs_user").on(table.userId),
              index("IDX_audit_logs_timestamp").on(table.timestamp),
              index("IDX_audit_logs_resource").on(table.resource)]
);

export const accessControls = pgTable("access_controls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id").notNull(),
  roleName: text("role_name").notNull(),
  description: text("description"),
  permissions: jsonb("permissions").notNull().default('[]'), // Array of permission strings
  userIds: text("user_ids").array(), // Array of user IDs with this role
  isSystemRole: boolean("is_system_role").notNull().default(false), // Can't be deleted
  priority: integer("priority").notNull().default(0), // Higher priority overrides lower
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Enterprise Insert Schemas
export const insertWhiteLabelSchema = createInsertSchema(whiteLabels).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEnterpriseSecuritySchema = createInsertSchema(enterpriseSecurity).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  timestamp: true,
});

export const insertAccessControlSchema = createInsertSchema(accessControls).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Company = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;

export type Contact = typeof contacts.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;

export type VisitorSession = typeof visitorSessions.$inferSelect;
export type InsertVisitorSession = z.infer<typeof insertVisitorSessionSchema>;

export type Sequence = typeof sequences.$inferSelect;
export type InsertSequence = z.infer<typeof insertSequenceSchema>;

export type Email = typeof emails.$inferSelect;
export type InsertEmail = z.infer<typeof insertEmailSchema>;

export type Insight = typeof insights.$inferSelect;
export type InsertInsight = z.infer<typeof insertInsightSchema>;

export type Persona = typeof personas.$inferSelect;
export type InsertPersona = z.infer<typeof insertPersonaSchema>;

export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;

export type PhoneCall = typeof phoneCalls.$inferSelect;
export type InsertPhoneCall = z.infer<typeof insertPhoneCallSchema>;

export type CallScript = typeof callScripts.$inferSelect;
export type InsertCallScript = z.infer<typeof insertCallScriptSchema>;

export type Voicemail = typeof voicemails.$inferSelect;
export type InsertVoicemail = z.infer<typeof insertVoicemailSchema>;

export type AiAgent = typeof aiAgents.$inferSelect;
export type InsertAiAgent = z.infer<typeof insertAiAgentSchema>;

export type OnboardingProfile = typeof onboardingProfiles.$inferSelect;
export type InsertOnboardingProfile = z.infer<typeof insertOnboardingProfileSchema>;

export type DigitalTwin = typeof digitalTwins.$inferSelect;
export type InsertDigitalTwin = z.infer<typeof insertDigitalTwinSchema>;

export type TwinInteraction = typeof twinInteractions.$inferSelect;
export type InsertTwinInteraction = z.infer<typeof insertTwinInteractionSchema>;

export type TwinPrediction = typeof twinPredictions.$inferSelect;
export type InsertTwinPrediction = z.infer<typeof insertTwinPredictionSchema>;

export type PlatformConfig = typeof platformConfigs.$inferSelect;
export type InsertPlatformConfig = z.infer<typeof insertPlatformConfigSchema>;

export type WorkflowTrigger = typeof workflowTriggers.$inferSelect;
export type InsertWorkflowTrigger = z.infer<typeof insertWorkflowTriggerSchema>;

export type Playbook = typeof playbooks.$inferSelect;
export type InsertPlaybook = z.infer<typeof insertPlaybookSchema>;

// SDR Teams types
export type SdrTeam = typeof sdrTeams.$inferSelect;
export type InsertSdrTeam = z.infer<typeof insertSdrTeamSchema>;

export type SdrTeamMember = typeof sdrTeamMembers.$inferSelect;
export type InsertSdrTeamMember = z.infer<typeof insertSdrTeamMemberSchema>;

export type TeamCollaboration = typeof teamCollaborations.$inferSelect;
export type InsertTeamCollaboration = z.infer<typeof insertTeamCollaborationSchema>;

export type TeamPerformance = typeof teamPerformance.$inferSelect;
export type InsertTeamPerformance = z.infer<typeof insertTeamPerformanceSchema>;

export type AutopilotCampaign = typeof autopilotCampaigns.$inferSelect;
export type InsertAutopilotCampaign = z.infer<typeof insertAutopilotCampaignSchema>;

export type AutopilotRun = typeof autopilotRuns.$inferSelect;
export type InsertAutopilotRun = z.infer<typeof insertAutopilotRunSchema>;

export type LeadScoringModel = typeof leadScoringModels.$inferSelect;
export type InsertLeadScoringModel = z.infer<typeof insertLeadScoringModelSchema>;

export type LeadScore = typeof leadScores.$inferSelect;
export type InsertLeadScore = z.infer<typeof insertLeadScoreSchema>;

export type Workflow = typeof workflows.$inferSelect;
export type InsertWorkflow = z.infer<typeof insertWorkflowSchema>;

export type WorkflowExecution = typeof workflowExecutions.$inferSelect;
export type InsertWorkflowExecution = z.infer<typeof insertWorkflowExecutionSchema>;

export type AgentType = typeof agentTypes.$inferSelect;
export type InsertAgentType = z.infer<typeof insertAgentTypeSchema>;

export type WorkflowTemplate = typeof workflowTemplates.$inferSelect;
export type InsertWorkflowTemplate = z.infer<typeof insertWorkflowTemplateSchema>;

export type HumanApproval = typeof humanApprovals.$inferSelect;
export type InsertHumanApproval = z.infer<typeof insertHumanApprovalSchema>;

export type MarketplaceAgent = typeof marketplaceAgents.$inferSelect;
export type InsertMarketplaceAgent = z.infer<typeof insertMarketplaceAgentSchema>;

export type AgentRating = typeof agentRatings.$inferSelect;
export type InsertAgentRating = z.infer<typeof insertAgentRatingSchema>;

export type AgentDownload = typeof agentDownloads.$inferSelect;
export type InsertAgentDownload = z.infer<typeof insertAgentDownloadSchema>;

export type AgentPurchase = typeof agentPurchases.$inferSelect;
export type InsertAgentPurchase = z.infer<typeof insertAgentPurchaseSchema>;

// Deal Intelligence types
export type IntentSignal = typeof intentSignals.$inferSelect;
export type InsertIntentSignal = z.infer<typeof insertIntentSignalSchema>;

export type DealIntelligence = typeof dealIntelligence.$inferSelect;
export type InsertDealIntelligence = z.infer<typeof insertDealIntelligenceSchema>;

export type TimingOptimization = typeof timingOptimization.$inferSelect;
export type InsertTimingOptimization = z.infer<typeof insertTimingOptimizationSchema>;

export type PredictiveModel = typeof predictiveModels.$inferSelect;
export type InsertPredictiveModel = z.infer<typeof insertPredictiveModelSchema>;

// Revenue Operations Types
export type PipelineHealth = typeof pipelineHealth.$inferSelect;
export type InsertPipelineHealth = z.infer<typeof insertPipelineHealthSchema>;

export type DealForensics = typeof dealForensics.$inferSelect;
export type InsertDealForensics = z.infer<typeof insertDealForensicsSchema>;

export type RevenueForecast = typeof revenueForecasts.$inferSelect;
export type InsertRevenueForecast = z.infer<typeof insertRevenueForecastSchema>;

export type CoachingInsight = typeof coachingInsights.$inferSelect;
export type InsertCoachingInsight = z.infer<typeof insertCoachingInsightSchema>;

// Multi-Channel Types
export type ChannelConfig = typeof channelConfigs.$inferSelect;
export type InsertChannelConfig = z.infer<typeof insertChannelConfigSchema>;

export type MultiChannelCampaign = typeof multiChannelCampaigns.$inferSelect;
export type InsertMultiChannelCampaign = z.infer<typeof insertMultiChannelCampaignSchema>;

export type ChannelMessage = typeof channelMessages.$inferSelect;
export type InsertChannelMessage = z.infer<typeof insertChannelMessageSchema>;

export type InboxMessage = typeof inboxMessages.$inferSelect;
export type InsertInboxMessage = z.infer<typeof insertInboxMessageSchema>;

export type ChannelOrchestration = typeof channelOrchestration.$inferSelect;
export type InsertChannelOrchestration = z.infer<typeof insertChannelOrchestrationSchema>;

// Voice AI Types
export type VoiceCampaign = typeof voiceCampaigns.$inferSelect;
export type InsertVoiceCampaign = z.infer<typeof insertVoiceCampaignSchema>;

export type VoiceCall = typeof voiceCalls.$inferSelect;
export type InsertVoiceCall = z.infer<typeof insertVoiceCallSchema>;

export type VoiceScript = typeof voiceScripts.$inferSelect;
export type InsertVoiceScript = z.infer<typeof insertVoiceScriptSchema>;

export type CallAnalytics = typeof callAnalytics.$inferSelect;
export type InsertCallAnalytics = z.infer<typeof insertCallAnalyticsSchema>;

// Browser Extension Types
export type ExtensionUser = typeof extensionUsers.$inferSelect;
export type InsertExtensionUser = z.infer<typeof insertExtensionUserSchema>;

export type EnrichmentCache = typeof enrichmentCache.$inferSelect;
export type InsertEnrichmentCache = z.infer<typeof insertEnrichmentCacheSchema>;

export type ExtensionActivity = typeof extensionActivities.$inferSelect;
export type InsertExtensionActivity = z.infer<typeof insertExtensionActivitySchema>;

export type QuickAction = typeof quickActions.$inferSelect;
export type InsertQuickAction = z.infer<typeof insertQuickActionSchema>;

// Crowd Intelligence Types
export type SharedIntel = typeof sharedIntel.$inferSelect;
export type InsertSharedIntel = z.infer<typeof insertSharedIntelSchema>;

export type IntelContribution = typeof intelContributions.$inferSelect;
export type InsertIntelContribution = z.infer<typeof insertIntelContributionSchema>;

export type IntelRating = typeof intelRatings.$inferSelect;
export type InsertIntelRating = z.infer<typeof insertIntelRatingSchema>;

export type BenchmarkData = typeof benchmarkData.$inferSelect;
export type InsertBenchmarkData = z.infer<typeof insertBenchmarkDataSchema>;

// User types for Replit Auth
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Enterprise Types
export type WhiteLabel = typeof whiteLabels.$inferSelect;
export type InsertWhiteLabel = z.infer<typeof insertWhiteLabelSchema>;

export type EnterpriseSecurity = typeof enterpriseSecurity.$inferSelect;
export type InsertEnterpriseSecurity = z.infer<typeof insertEnterpriseSecuritySchema>;

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

export type AccessControl = typeof accessControls.$inferSelect;
export type InsertAccessControl = z.infer<typeof insertAccessControlSchema>;

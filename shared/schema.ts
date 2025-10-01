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

export type PlatformConfig = typeof platformConfigs.$inferSelect;
export type InsertPlatformConfig = z.infer<typeof insertPlatformConfigSchema>;

export type WorkflowTrigger = typeof workflowTriggers.$inferSelect;
export type InsertWorkflowTrigger = z.infer<typeof insertWorkflowTriggerSchema>;

export type Playbook = typeof playbooks.$inferSelect;
export type InsertPlaybook = z.infer<typeof insertPlaybookSchema>;

export type AutopilotCampaign = typeof autopilotCampaigns.$inferSelect;
export type InsertAutopilotCampaign = z.infer<typeof insertAutopilotCampaignSchema>;

export type AutopilotRun = typeof autopilotRuns.$inferSelect;
export type InsertAutopilotRun = z.infer<typeof insertAutopilotRunSchema>;

export type LeadScoringModel = typeof leadScoringModels.$inferSelect;
export type InsertLeadScoringModel = z.infer<typeof insertLeadScoringModelSchema>;

export type LeadScore = typeof leadScores.$inferSelect;
export type InsertLeadScore = z.infer<typeof insertLeadScoreSchema>;

// User types for Replit Auth
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

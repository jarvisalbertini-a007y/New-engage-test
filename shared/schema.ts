import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, jsonb, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: text("role").notNull().default("Sales Rep"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
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

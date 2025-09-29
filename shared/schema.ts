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

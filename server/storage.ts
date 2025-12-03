import { 
  type User, type InsertUser, type UpsertUser,
  type Company, type InsertCompany,
  type Contact, type InsertContact,
  type VisitorSession, type InsertVisitorSession,
  type Sequence, type InsertSequence,
  type Email, type InsertEmail,
  type Insight, type InsertInsight,
  type Persona, type InsertPersona,
  type Task, type InsertTask,
  type PhoneCall, type InsertPhoneCall,
  type CallScript, type InsertCallScript,
  type Voicemail, type InsertVoicemail,
  type AiAgent, type InsertAiAgent,
  type AgentExecution, type InsertAgentExecution,
  type AgentMetric, type InsertAgentMetric,
  type OnboardingProfile, type InsertOnboardingProfile,
  type PlatformConfig, type InsertPlatformConfig,
  type WorkflowTrigger, type InsertWorkflowTrigger,
  type Playbook, type InsertPlaybook,
  type AutopilotCampaign, type InsertAutopilotCampaign,
  type AutopilotRun, type InsertAutopilotRun,
  type LeadScoringModel, type InsertLeadScoringModel,
  type LeadScore, type InsertLeadScore,
  type Workflow, type InsertWorkflow,
  type WorkflowExecution, type InsertWorkflowExecution,
  type AgentType, type InsertAgentType,
  type WorkflowTemplate, type InsertWorkflowTemplate,
  type HumanApproval, type InsertHumanApproval,
  type MarketplaceAgent, type InsertMarketplaceAgent,
  type AgentRating, type InsertAgentRating,
  type AgentDownload, type InsertAgentDownload,
  type AgentPurchase, type InsertAgentPurchase,
  type DigitalTwin, type InsertDigitalTwin,
  type TwinInteraction, type InsertTwinInteraction,
  type TwinPrediction, type InsertTwinPrediction,
  type SdrTeam, type InsertSdrTeam,
  type SdrTeamMember, type InsertSdrTeamMember,
  type TeamCollaboration, type InsertTeamCollaboration,
  type TeamPerformance, type InsertTeamPerformance,
  type IntentSignal, type InsertIntentSignal,
  type DealIntelligence, type InsertDealIntelligence,
  type TimingOptimization, type InsertTimingOptimization,
  type PredictiveModel, type InsertPredictiveModel,
  type PipelineHealth, type InsertPipelineHealth,
  type DealForensics, type InsertDealForensics,
  type RevenueForecast, type InsertRevenueForecast,
  type CoachingInsight, type InsertCoachingInsight,
  type ChannelConfig, type InsertChannelConfig,
  type MultiChannelCampaign, type InsertMultiChannelCampaign,
  type ChannelMessage, type InsertChannelMessage,
  type ChannelOrchestration, type InsertChannelOrchestration,
  type VoiceCampaign, type InsertVoiceCampaign,
  type VoiceCall, type InsertVoiceCall,
  type VoiceScript, type InsertVoiceScript,
  type CallAnalytics, type InsertCallAnalytics,
  type ExtensionUser, type InsertExtensionUser,
  type EnrichmentCache, type InsertEnrichmentCache,
  type ExtensionActivity, type InsertExtensionActivity,
  type QuickAction, type InsertQuickAction,
  type SharedIntel, type InsertSharedIntel,
  type IntelContribution, type InsertIntelContribution,
  type IntelRating, type InsertIntelRating,
  type BenchmarkData, type InsertBenchmarkData,
  type WhiteLabel, type InsertWhiteLabel,
  type EnterpriseSecurity, type InsertEnterpriseSecurity,
  type AuditLog, type InsertAuditLog,
  type AccessControl, type InsertAccessControl,
  type ContentTemplate, type InsertContentTemplate,
  type TemplateVersion, type InsertTemplateVersion,
  type AudienceSegment, type InsertAudienceSegment,
  type TemplateMetrics, type InsertTemplateMetrics,
  type InboxMessage, type InsertInboxMessage,
  users, companies, contacts, visitorSessions, sequences, emails, insights, personas, tasks, phoneCalls, callScripts, voicemails, aiAgents, agentExecutions, agentMetrics, onboardingProfiles, platformConfigs, workflowTriggers, playbooks, autopilotCampaigns, autopilotRuns, leadScoringModels, leadScores, workflows, workflowExecutions, agentTypes, workflowTemplates, humanApprovals, marketplaceAgents, agentRatings, agentDownloads, agentPurchases, digitalTwins, twinInteractions, twinPredictions, sdrTeams, sdrTeamMembers, teamCollaborations, teamPerformance, intentSignals, dealIntelligence, timingOptimization, predictiveModels, pipelineHealth, dealForensics, revenueForecasts, coachingInsights, channelConfigs, multiChannelCampaigns, channelMessages, channelOrchestration, inboxMessages, voiceCampaigns, voiceCalls, voiceScripts, callAnalytics, extensionUsers, enrichmentCache, extensionActivities, quickActions, sharedIntel, intelContributions, intelRatings, benchmarkData, contentTemplates, templateVersions, audienceSegments, contentTemplateSegments, templateMetrics, whiteLabels, enterpriseSecurity, auditLogs, accessControls
} from "@shared/schema";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, and, sql, desc } from "drizzle-orm";

// Helper to filter out undefined values from partial updates
function cleanPartial<T extends Record<string, any>>(obj: Partial<T>): Partial<T> {
  const cleaned: any = {};
  for (const key in obj) {
    if (obj[key] !== undefined) {
      cleaned[key] = obj[key];
    }
  }
  return cleaned;
}

export interface IStorage {
  // Users - Required for Replit Auth
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Companies
  getCompany(id: string): Promise<Company | undefined>;
  getCompanies(filters?: { userId?: string; limit?: number }): Promise<Company[]>;
  getCompaniesByDomain(domain: string): Promise<Company[]>;
  createCompany(company: InsertCompany): Promise<Company>;
  updateCompany(id: string, updates: Partial<Company>): Promise<Company | undefined>;
  deleteCompany(id: string): Promise<boolean>;

  // Contacts
  getContact(id: string): Promise<Contact | undefined>;
  getContacts(filters?: { userId?: string; companyId?: string; limit?: number }): Promise<Contact[]>;
  createContact(contact: InsertContact): Promise<Contact>;
  updateContact(id: string, updates: Partial<Contact>): Promise<Contact | undefined>;
  deleteContact(id: string): Promise<boolean>;

  // Visitor Sessions
  getVisitorSession(id: string): Promise<VisitorSession | undefined>;
  getActiveVisitorSessions(): Promise<VisitorSession[]>;
  getVisitorSessionsByCompany(companyId: string): Promise<VisitorSession[]>;
  createVisitorSession(session: InsertVisitorSession): Promise<VisitorSession>;
  updateVisitorSession(id: string, updates: Partial<VisitorSession>): Promise<VisitorSession | undefined>;

  // Sequences
  getSequence(id: string): Promise<Sequence | undefined>;
  getSequences(filters?: { createdBy?: string; status?: string }): Promise<Sequence[]>;
  createSequence(sequence: InsertSequence): Promise<Sequence>;
  updateSequence(id: string, updates: Partial<Sequence>): Promise<Sequence | undefined>;
  deleteSequence(id: string): Promise<boolean>;

  // Emails
  getEmail(id: string): Promise<Email | undefined>;
  getEmails(filters?: { contactId?: string; status?: string; limit?: number }): Promise<Email[]>;
  createEmail(email: InsertEmail): Promise<Email>;
  updateEmail(id: string, updates: Partial<Email>): Promise<Email | undefined>;

  // Insights
  getInsight(id: string): Promise<Insight | undefined>;
  getInsights(filters?: { companyId?: string; type?: string; limit?: number }): Promise<Insight[]>;
  createInsight(insight: InsertInsight): Promise<Insight>;

  // Personas
  getPersona(id: string): Promise<Persona | undefined>;
  getPersonas(createdBy?: string): Promise<Persona[]>;
  createPersona(persona: InsertPersona): Promise<Persona>;
  updatePersona(id: string, updates: Partial<Persona>): Promise<Persona | undefined>;
  deletePersona(id: string): Promise<boolean>;

  // Tasks
  getTask(id: string): Promise<Task | undefined>;
  getTasks(filters?: { assignedTo?: string; status?: string; priority?: string }): Promise<Task[]>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, updates: Partial<Task>): Promise<Task | undefined>;

  // Phone Calls
  getPhoneCall(id: string): Promise<PhoneCall | undefined>;
  getPhoneCalls(filters?: { contactId?: string; userId?: string; status?: string }): Promise<PhoneCall[]>;
  createPhoneCall(call: InsertPhoneCall): Promise<PhoneCall>;
  updatePhoneCall(id: string, updates: Partial<PhoneCall>): Promise<PhoneCall | undefined>;

  // Call Scripts
  getCallScript(id: string): Promise<CallScript | undefined>;
  getCallScripts(filters?: { type?: string; personaId?: string }): Promise<CallScript[]>;
  createCallScript(script: InsertCallScript): Promise<CallScript>;
  updateCallScript(id: string, updates: Partial<CallScript>): Promise<CallScript | undefined>;

  // Voicemails
  getVoicemail(id: string): Promise<Voicemail | undefined>;
  getVoicemails(filters?: { contactId?: string; isListened?: boolean }): Promise<Voicemail[]>;
  createVoicemail(voicemail: InsertVoicemail): Promise<Voicemail>;
  updateVoicemail(id: string, updates: Partial<Voicemail>): Promise<Voicemail | undefined>;

  // AI Agents
  getAiAgent(id: string): Promise<AiAgent | undefined>;
  getAiAgents(filters?: { status?: string; type?: string; createdBy?: string }): Promise<AiAgent[]>;
  createAiAgent(agent: InsertAiAgent): Promise<AiAgent>;
  updateAiAgent(id: string, updates: Partial<AiAgent>): Promise<AiAgent | undefined>;
  deleteAiAgent(id: string): Promise<boolean>;
  
  // Agent Executions
  getAgentExecution(id: string): Promise<AgentExecution | undefined>;
  getAgentExecutions(filters?: { agentId?: string; status?: string; taskType?: string }): Promise<AgentExecution[]>;
  createAgentExecution(execution: InsertAgentExecution): Promise<AgentExecution>;
  updateAgentExecution(id: string, updates: Partial<AgentExecution>): Promise<AgentExecution | undefined>;
  
  // Agent Metrics
  getAgentMetrics(agentId: string, date?: string): Promise<AgentMetric | undefined>;
  getAgentMetricsRange(agentId: string, startDate: string, endDate: string): Promise<AgentMetric[]>;
  createAgentMetric(metric: InsertAgentMetric): Promise<AgentMetric>;
  updateAgentMetric(id: string, updates: Partial<AgentMetric>): Promise<AgentMetric | undefined>;
  
  // Onboarding
  getOnboardingProfile(userId: string): Promise<OnboardingProfile | undefined>;
  createOnboardingProfile(profile: InsertOnboardingProfile): Promise<OnboardingProfile>;
  updateOnboardingProfile(userId: string, updates: Partial<OnboardingProfile>): Promise<OnboardingProfile | undefined>;
  
  // Platform Config
  getPlatformConfig(userId: string): Promise<PlatformConfig | undefined>;
  createPlatformConfig(config: InsertPlatformConfig): Promise<PlatformConfig>;
  updatePlatformConfig(userId: string, updates: Partial<PlatformConfig>): Promise<PlatformConfig | undefined>;
  
  // Workflow Triggers
  getWorkflowTrigger(id: string): Promise<WorkflowTrigger | undefined>;
  getWorkflowTriggers(filters?: { isActive?: boolean; triggerType?: string }): Promise<WorkflowTrigger[]>;
  createWorkflowTrigger(trigger: InsertWorkflowTrigger): Promise<WorkflowTrigger>;
  updateWorkflowTrigger(id: string, updates: Partial<WorkflowTrigger>): Promise<WorkflowTrigger | undefined>;
  deleteWorkflowTrigger(id: string): Promise<boolean>;
  
  // Playbooks
  getPlaybook(id: string): Promise<Playbook | undefined>;
  getPlaybooks(filters?: { industry?: string; isTemplate?: boolean; createdBy?: string }): Promise<Playbook[]>;
  createPlaybook(playbook: InsertPlaybook): Promise<Playbook>;
  updatePlaybook(id: string, updates: Partial<Playbook>): Promise<Playbook | undefined>;

  // Autopilot Campaigns
  getAutopilotCampaign(id: string): Promise<AutopilotCampaign | undefined>;
  getAutopilotCampaigns(filters?: { status?: string; createdBy?: string }): Promise<AutopilotCampaign[]>;
  createAutopilotCampaign(campaign: InsertAutopilotCampaign): Promise<AutopilotCampaign>;
  updateAutopilotCampaign(id: string, updates: Partial<AutopilotCampaign>): Promise<AutopilotCampaign | undefined>;

  // Autopilot Runs
  getAutopilotRun(id: string): Promise<AutopilotRun | undefined>;
  getAutopilotRunsByCampaign(campaignId: string): Promise<AutopilotRun[]>;
  createAutopilotRun(run: InsertAutopilotRun): Promise<AutopilotRun>;
  updateAutopilotRun(id: string, updates: Partial<AutopilotRun>): Promise<AutopilotRun | undefined>;

  // Lead Scoring Model methods
  getLeadScoringModels(): Promise<LeadScoringModel[]>;
  getLeadScoringModelById(id: string): Promise<LeadScoringModel | undefined>;
  createLeadScoringModel(model: InsertLeadScoringModel): Promise<LeadScoringModel>;
  updateLeadScoringModel(id: string, model: Partial<InsertLeadScoringModel>): Promise<LeadScoringModel>;
  deleteLeadScoringModel(id: string): Promise<void>;

  // Lead Score methods
  getLeadScores(contactId?: string, modelId?: string): Promise<LeadScore[]>;
  getLeadScoreById(id: string): Promise<LeadScore | undefined>;
  createLeadScore(score: InsertLeadScore): Promise<LeadScore>;
  updateLeadScore(id: string, score: Partial<InsertLeadScore>): Promise<LeadScore>;
  deleteLeadScore(id: string): Promise<void>;

  // Workflows
  getWorkflow(id: string): Promise<Workflow | undefined>;
  getWorkflows(filters?: { status?: string; category?: string; isTemplate?: boolean; createdBy?: string }): Promise<Workflow[]>;
  createWorkflow(workflow: InsertWorkflow): Promise<Workflow>;
  updateWorkflow(id: string, updates: Partial<Workflow>): Promise<Workflow | undefined>;
  deleteWorkflow(id: string): Promise<boolean>;
  
  // Workflow Executions
  getWorkflowExecution(id: string): Promise<WorkflowExecution | undefined>;
  getWorkflowExecutions(filters?: { workflowId?: string; status?: string }): Promise<WorkflowExecution[]>;
  createWorkflowExecution(execution: InsertWorkflowExecution): Promise<WorkflowExecution>;
  updateWorkflowExecution(id: string, updates: Partial<WorkflowExecution>): Promise<WorkflowExecution | undefined>;
  
  // Agent Types
  getAgentType(id: string): Promise<AgentType | undefined>;
  getAgentTypes(filters?: { category?: string }): Promise<AgentType[]>;
  createAgentType(agentType: InsertAgentType): Promise<AgentType>;
  updateAgentType(id: string, updates: Partial<AgentType>): Promise<AgentType | undefined>;
  
  // Workflow Templates
  getWorkflowTemplate(id: string): Promise<WorkflowTemplate | undefined>;
  getWorkflowTemplates(filters?: { category?: string; difficulty?: string }): Promise<WorkflowTemplate[]>;
  createWorkflowTemplate(template: InsertWorkflowTemplate): Promise<WorkflowTemplate>;
  updateWorkflowTemplate(id: string, updates: Partial<WorkflowTemplate>): Promise<WorkflowTemplate | undefined>;
  
  // Human Approvals
  getHumanApproval(id: string): Promise<HumanApproval | undefined>;
  getHumanApprovals(filters?: { executionId?: string; status?: string }): Promise<HumanApproval[]>;
  createHumanApproval(approval: InsertHumanApproval): Promise<HumanApproval>;
  updateHumanApproval(id: string, updates: Partial<HumanApproval>): Promise<HumanApproval | undefined>;
  
  // Marketplace Agents
  getMarketplaceAgent(id: string): Promise<MarketplaceAgent | undefined>;
  getMarketplaceAgents(filters?: { category?: string; author?: string; minRating?: number; maxPrice?: number; tags?: string[] }): Promise<MarketplaceAgent[]>;
  getMarketplaceAgentsByUser(userId: string): Promise<MarketplaceAgent[]>;
  createMarketplaceAgent(agent: InsertMarketplaceAgent): Promise<MarketplaceAgent>;
  updateMarketplaceAgent(id: string, updates: Partial<MarketplaceAgent>): Promise<MarketplaceAgent | undefined>;
  deleteMarketplaceAgent(id: string): Promise<boolean>;
  incrementAgentDownloads(id: string): Promise<void>;
  
  // Agent Ratings
  getAgentRating(id: string): Promise<AgentRating | undefined>;
  getAgentRatings(agentId: string): Promise<AgentRating[]>;
  getUserAgentRating(agentId: string, userId: string): Promise<AgentRating | undefined>;
  createAgentRating(rating: InsertAgentRating): Promise<AgentRating>;
  updateAgentRating(id: string, updates: Partial<AgentRating>): Promise<AgentRating | undefined>;
  updateAgentAverageRating(agentId: string): Promise<void>;
  
  // Agent Downloads
  getAgentDownload(id: string): Promise<AgentDownload | undefined>;
  getAgentDownloads(filters?: { agentId?: string; userId?: string }): Promise<AgentDownload[]>;
  createAgentDownload(download: InsertAgentDownload): Promise<AgentDownload>;
  hasUserDownloadedAgent(agentId: string, userId: string): Promise<boolean>;
  
  // Agent Purchases
  getAgentPurchase(id: string): Promise<AgentPurchase | undefined>;
  getAgentPurchases(filters?: { agentId?: string; userId?: string }): Promise<AgentPurchase[]>;
  createAgentPurchase(purchase: InsertAgentPurchase): Promise<AgentPurchase>;
  hasUserPurchasedAgent(agentId: string, userId: string): Promise<boolean>;

  // Digital Twins
  getDigitalTwin(id: string): Promise<DigitalTwin | undefined>;
  getDigitalTwinByContact(contactId: string): Promise<DigitalTwin | undefined>;
  getDigitalTwins(filters?: { companyId?: string; limit?: number }): Promise<DigitalTwin[]>;
  createDigitalTwin(twin: InsertDigitalTwin): Promise<DigitalTwin>;
  updateDigitalTwin(id: string, updates: Partial<DigitalTwin>): Promise<DigitalTwin | undefined>;
  deleteDigitalTwin(id: string): Promise<boolean>;
  
  // Twin Interactions
  getTwinInteraction(id: string): Promise<TwinInteraction | undefined>;
  getTwinInteractions(twinId: string, limit?: number): Promise<TwinInteraction[]>;
  createTwinInteraction(interaction: InsertTwinInteraction): Promise<TwinInteraction>;
  
  // Twin Predictions
  getTwinPrediction(id: string): Promise<TwinPrediction | undefined>;
  getTwinPredictions(twinId: string, type?: string): Promise<TwinPrediction[]>;
  createTwinPrediction(prediction: InsertTwinPrediction): Promise<TwinPrediction>;
  updateTwinPrediction(id: string, updates: Partial<TwinPrediction>): Promise<TwinPrediction | undefined>;
  
  // SDR Teams
  getSdrTeam(id: string): Promise<SdrTeam | undefined>;
  getSdrTeams(filters?: { teamType?: string; isActive?: boolean; createdBy?: string }): Promise<SdrTeam[]>;
  createSdrTeam(team: InsertSdrTeam): Promise<SdrTeam>;
  updateSdrTeam(id: string, updates: Partial<SdrTeam>): Promise<SdrTeam | undefined>;
  deleteSdrTeam(id: string): Promise<boolean>;
  
  // SDR Team Members
  getSdrTeamMember(id: string): Promise<SdrTeamMember | undefined>;
  getSdrTeamMembersByTeam(teamId: string): Promise<SdrTeamMember[]>;
  getSdrTeamMembersByRole(role: string): Promise<SdrTeamMember[]>;
  createSdrTeamMember(member: InsertSdrTeamMember): Promise<SdrTeamMember>;
  updateSdrTeamMember(id: string, updates: Partial<SdrTeamMember>): Promise<SdrTeamMember | undefined>;
  deleteSdrTeamMember(id: string): Promise<boolean>;
  
  // Team Collaborations
  getTeamCollaboration(id: string): Promise<TeamCollaboration | undefined>;
  getTeamCollaborations(filters?: { teamId?: string; dealId?: string; contactId?: string; outcome?: string }): Promise<TeamCollaboration[]>;
  createTeamCollaboration(collaboration: InsertTeamCollaboration): Promise<TeamCollaboration>;
  updateTeamCollaboration(id: string, updates: Partial<TeamCollaboration>): Promise<TeamCollaboration | undefined>;
  
  // Team Performance
  getTeamPerformance(id: string): Promise<TeamPerformance | undefined>;
  getTeamPerformanceByTeam(teamId: string, period?: string): Promise<TeamPerformance[]>;
  createTeamPerformance(performance: InsertTeamPerformance): Promise<TeamPerformance>;
  updateTeamPerformance(id: string, updates: Partial<TeamPerformance>): Promise<TeamPerformance | undefined>;
  
  // Intent Signals
  getIntentSignal(id: string): Promise<IntentSignal | undefined>;
  getIntentSignals(filters?: { contactId?: string; companyId?: string; signalType?: string; limit?: number }): Promise<IntentSignal[]>;
  createIntentSignal(signal: InsertIntentSignal): Promise<IntentSignal>;
  updateIntentSignal(id: string, updates: Partial<IntentSignal>): Promise<IntentSignal | undefined>;
  
  // Deal Intelligence
  getDealIntelligence(id: string): Promise<DealIntelligence | undefined>;
  getDealIntelligenceByCompany(companyId: string): Promise<DealIntelligence | undefined>;
  createDealIntelligence(intelligence: InsertDealIntelligence): Promise<DealIntelligence>;
  updateDealIntelligence(id: string, updates: Partial<DealIntelligence>): Promise<DealIntelligence | undefined>;
  
  // Timing Optimization
  getTimingOptimization(id: string): Promise<TimingOptimization | undefined>;
  getTimingOptimizationByContact(contactId: string): Promise<TimingOptimization | undefined>;
  createTimingOptimization(timing: InsertTimingOptimization): Promise<TimingOptimization>;
  updateTimingOptimization(id: string, updates: Partial<TimingOptimization>): Promise<TimingOptimization | undefined>;
  
  // Predictive Models
  getPredictiveModel(id: string): Promise<PredictiveModel | undefined>;
  getPredictiveModels(modelType?: string): Promise<PredictiveModel[]>;
  createPredictiveModel(model: InsertPredictiveModel): Promise<PredictiveModel>;
  updatePredictiveModel(id: string, updates: Partial<PredictiveModel>): Promise<PredictiveModel | undefined>;
  
  // Revenue Operations - Pipeline Health
  getPipelineHealth(id: string): Promise<PipelineHealth | undefined>;
  getLatestPipelineHealth(): Promise<PipelineHealth | undefined>;
  getPipelineHealthHistory(limit?: number): Promise<PipelineHealth[]>;
  createPipelineHealth(health: InsertPipelineHealth): Promise<PipelineHealth>;
  
  // Deal Forensics
  getDealForensics(id: string): Promise<DealForensics | undefined>;
  getDealForensicsByDealId(dealId: string): Promise<DealForensics[]>;
  getDealForensicsByType(analysisType: string): Promise<DealForensics[]>;
  createDealForensics(forensics: InsertDealForensics): Promise<DealForensics>;
  
  // Revenue Forecasts
  getRevenueForecast(id: string): Promise<RevenueForecast | undefined>;
  getRevenueForecasts(period?: string): Promise<RevenueForecast[]>;
  getLatestForecast(): Promise<RevenueForecast | undefined>;
  createRevenueForecast(forecast: InsertRevenueForecast): Promise<RevenueForecast>;
  
  // Coaching Insights
  getCoachingInsight(id: string): Promise<CoachingInsight | undefined>;
  getCoachingInsights(filters?: { userId?: string; insightType?: string; priority?: string; status?: string }): Promise<CoachingInsight[]>;
  createCoachingInsight(insight: InsertCoachingInsight): Promise<CoachingInsight>;
  updateCoachingInsight(id: string, updates: Partial<CoachingInsight>): Promise<CoachingInsight | undefined>;
  
  // Multi-Channel Orchestration
  // Channel Configs
  getChannelConfig(id: string): Promise<ChannelConfig | undefined>;
  getChannelConfigs(userId: string): Promise<ChannelConfig[]>;
  getChannelConfigByUserAndChannel(userId: string, channel: string): Promise<ChannelConfig | undefined>;
  createChannelConfig(config: InsertChannelConfig): Promise<ChannelConfig>;
  updateChannelConfig(id: string, updates: Partial<ChannelConfig>): Promise<ChannelConfig | undefined>;
  deleteChannelConfig(id: string): Promise<boolean>;
  
  // Multi-Channel Campaigns
  getMultiChannelCampaign(id: string): Promise<MultiChannelCampaign | undefined>;
  getMultiChannelCampaigns(filters?: { status?: string; createdBy?: string }): Promise<MultiChannelCampaign[]>;
  createMultiChannelCampaign(campaign: InsertMultiChannelCampaign): Promise<MultiChannelCampaign>;
  updateMultiChannelCampaign(id: string, updates: Partial<MultiChannelCampaign>): Promise<MultiChannelCampaign | undefined>;
  deleteMultiChannelCampaign(id: string): Promise<boolean>;
  
  // Channel Messages
  getChannelMessage(id: string): Promise<ChannelMessage | undefined>;
  getChannelMessages(filters?: { campaignId?: string; channel?: string; recipientId?: string; status?: string }): Promise<ChannelMessage[]>;
  createChannelMessage(message: InsertChannelMessage): Promise<ChannelMessage>;
  updateChannelMessage(id: string, updates: Partial<ChannelMessage>): Promise<ChannelMessage | undefined>;
  
  // Channel Orchestration
  getChannelOrchestration(id: string): Promise<ChannelOrchestration | undefined>;
  getChannelOrchestrationByCampaign(campaignId: string): Promise<ChannelOrchestration | undefined>;
  createChannelOrchestration(orchestration: InsertChannelOrchestration): Promise<ChannelOrchestration>;
  updateChannelOrchestration(id: string, updates: Partial<ChannelOrchestration>): Promise<ChannelOrchestration | undefined>;
  
  // Inbox Messages
  getInboxMessage(id: string): Promise<InboxMessage | undefined>;
  getInboxMessages(filters?: { userId?: string; channel?: string; category?: string; isRead?: boolean; isArchived?: boolean }): Promise<InboxMessage[]>;
  createInboxMessage(message: InsertInboxMessage): Promise<InboxMessage>;
  updateInboxMessage(id: string, updates: Partial<InboxMessage>): Promise<InboxMessage | undefined>;
  markInboxMessageAsRead(id: string): Promise<InboxMessage | undefined>;
  toggleInboxMessageStar(id: string): Promise<InboxMessage | undefined>;
  archiveInboxMessage(id: string): Promise<InboxMessage | undefined>;
  
  // Voice AI
  // Voice Campaigns
  getVoiceCampaign(id: string): Promise<VoiceCampaign | undefined>;
  getVoiceCampaigns(filters?: { status?: string; createdBy?: string }): Promise<VoiceCampaign[]>;
  createVoiceCampaign(campaign: InsertVoiceCampaign): Promise<VoiceCampaign>;
  updateVoiceCampaign(id: string, updates: Partial<VoiceCampaign>): Promise<VoiceCampaign | undefined>;
  deleteVoiceCampaign(id: string): Promise<boolean>;
  
  // Voice Calls
  getVoiceCall(id: string): Promise<VoiceCall | undefined>;
  getVoiceCalls(filters?: { campaignId?: string; contactId?: string; callStatus?: string }): Promise<VoiceCall[]>;
  createVoiceCall(call: InsertVoiceCall): Promise<VoiceCall>;
  updateVoiceCall(id: string, updates: Partial<VoiceCall>): Promise<VoiceCall | undefined>;
  
  // Voice Scripts
  getVoiceScript(id: string): Promise<VoiceScript | undefined>;
  getVoiceScripts(filters?: { scriptType?: string; isActive?: boolean; createdBy?: string }): Promise<VoiceScript[]>;
  createVoiceScript(script: InsertVoiceScript): Promise<VoiceScript>;
  updateVoiceScript(id: string, updates: Partial<VoiceScript>): Promise<VoiceScript | undefined>;
  deleteVoiceScript(id: string): Promise<boolean>;
  
  // Call Analytics
  getCallAnalytics(callId: string): Promise<CallAnalytics | undefined>;
  getCallAnalyticsByCampaign(campaignId: string): Promise<CallAnalytics[]>;
  createCallAnalytics(analytics: InsertCallAnalytics): Promise<CallAnalytics>;
  updateCallAnalytics(id: string, updates: Partial<CallAnalytics>): Promise<CallAnalytics | undefined>;
  
  // Browser Extension
  // Extension Users
  getExtensionUser(id: string): Promise<ExtensionUser | undefined>;
  getExtensionUserByUserId(userId: string): Promise<ExtensionUser | undefined>;
  createExtensionUser(user: InsertExtensionUser): Promise<ExtensionUser>;
  updateExtensionUser(id: string, updates: Partial<ExtensionUser>): Promise<ExtensionUser | undefined>;
  
  // Enrichment Cache
  getEnrichmentCache(id: string): Promise<EnrichmentCache | undefined>;
  getEnrichmentCacheByDomain(domain: string): Promise<EnrichmentCache | undefined>;
  createEnrichmentCache(cache: InsertEnrichmentCache): Promise<EnrichmentCache>;
  updateEnrichmentCache(id: string, updates: Partial<EnrichmentCache>): Promise<EnrichmentCache | undefined>;
  
  // Extension Activities
  getExtensionActivity(id: string): Promise<ExtensionActivity | undefined>;
  getExtensionActivities(filters?: { userId?: string; activityType?: string; limit?: number }): Promise<ExtensionActivity[]>;
  createExtensionActivity(activity: InsertExtensionActivity): Promise<ExtensionActivity>;
  
  // Quick Actions
  getQuickAction(id: string): Promise<QuickAction | undefined>;
  getQuickActions(filters?: { userId?: string; actionType?: string; limit?: number }): Promise<QuickAction[]>;
  createQuickAction(action: InsertQuickAction): Promise<QuickAction>;
  
  // Crowd Intelligence
  // Shared Intel
  getSharedIntel(id: string): Promise<SharedIntel | undefined>;
  getSharedIntelList(filters?: { category?: string; industry?: string; companySize?: string; tags?: string[]; limit?: number }): Promise<SharedIntel[]>;
  createSharedIntel(intel: InsertSharedIntel): Promise<SharedIntel>;
  updateSharedIntel(id: string, updates: Partial<SharedIntel>): Promise<SharedIntel | undefined>;
  
  // Intel Contributions
  getIntelContribution(id: string): Promise<IntelContribution | undefined>;
  getIntelContributions(filters?: { intelId?: string; userId?: string; contributionType?: string; limit?: number }): Promise<IntelContribution[]>;
  createIntelContribution(contribution: InsertIntelContribution): Promise<IntelContribution>;
  
  // Intel Ratings
  getIntelRating(id: string): Promise<IntelRating | undefined>;
  getIntelRatings(filters?: { intelId?: string; userId?: string; minRating?: number; limit?: number }): Promise<IntelRating[]>;
  createIntelRating(rating: InsertIntelRating): Promise<IntelRating>;
  updateIntelRating(id: string, updates: Partial<IntelRating>): Promise<IntelRating | undefined>;
  
  // Benchmark Data
  getBenchmarkData(id: string): Promise<BenchmarkData | undefined>;
  getBenchmarkDataList(filters?: { metric?: string; industry?: string; companySize?: string; channel?: string; limit?: number }): Promise<BenchmarkData[]>;
  createBenchmarkData(benchmark: InsertBenchmarkData): Promise<BenchmarkData>;
  updateBenchmarkData(id: string, updates: Partial<BenchmarkData>): Promise<BenchmarkData | undefined>;

  // Enterprise - White Labels
  getWhiteLabel(organizationId: string): Promise<WhiteLabel | undefined>;
  getWhiteLabels(): Promise<WhiteLabel[]>;
  createWhiteLabel(whiteLabel: InsertWhiteLabel): Promise<WhiteLabel>;
  updateWhiteLabel(organizationId: string, updates: Partial<WhiteLabel>): Promise<WhiteLabel | undefined>;
  deleteWhiteLabel(organizationId: string): Promise<boolean>;

  // Enterprise - Security Settings
  getEnterpriseSecurity(organizationId: string): Promise<EnterpriseSecurity | undefined>;
  getEnterpriseSecuritySettings(): Promise<EnterpriseSecurity[]>;
  createEnterpriseSecurity(security: InsertEnterpriseSecurity): Promise<EnterpriseSecurity>;
  updateEnterpriseSecurity(organizationId: string, updates: Partial<EnterpriseSecurity>): Promise<EnterpriseSecurity | undefined>;
  deleteEnterpriseSecurity(organizationId: string): Promise<boolean>;

  // Enterprise - Audit Logs
  getAuditLog(id: string): Promise<AuditLog | undefined>;
  getAuditLogs(filters?: { organizationId?: string; userId?: string; resource?: string; action?: string; startDate?: Date; endDate?: Date; limit?: number }): Promise<AuditLog[]>;
  createAuditLog(auditLog: InsertAuditLog): Promise<AuditLog>;
  deleteOldAuditLogs(retentionDays: number): Promise<number>;

  // Enterprise - Access Controls
  getAccessControl(id: string): Promise<AccessControl | undefined>;
  getAccessControls(organizationId: string): Promise<AccessControl[]>;
  getAccessControlByRole(organizationId: string, roleName: string): Promise<AccessControl | undefined>;
  getUserAccessControls(organizationId: string, userId: string): Promise<AccessControl[]>;
  createAccessControl(accessControl: InsertAccessControl): Promise<AccessControl>;
  updateAccessControl(id: string, updates: Partial<AccessControl>): Promise<AccessControl | undefined>;
  deleteAccessControl(id: string): Promise<boolean>;

  // Content Templates
  listTemplates(params?: {status?: string; personaId?: string; includeArchived?: boolean}): Promise<ContentTemplate[]>;
  getTemplateWithRelations(id: string): Promise<{ template: ContentTemplate; versions: TemplateVersion[]; segments: AudienceSegment[]; metrics?: TemplateMetrics[] } | undefined>;
  createTemplate(input: InsertContentTemplate & { segmentIds?: string[] }): Promise<ContentTemplate>;
  updateTemplate(id: string, updates: Partial<ContentTemplate>): Promise<ContentTemplate | undefined>;
  archiveTemplate(id: string): Promise<boolean>;
  attachSegments(templateId: string, segmentIds: string[]): Promise<void>;
  detachSegment(templateId: string, segmentId: string): Promise<boolean>;

  // Template Versions
  createTemplateVersion(input: InsertTemplateVersion & { segmentSnapshotIds?: string[] }): Promise<TemplateVersion>;
  listTemplateVersions(templateId: string, opts?: { includeDrafts?: boolean }): Promise<TemplateVersion[]>;
  getTemplateVersion(versionId: string): Promise<TemplateVersion | undefined>;
  publishTemplateVersion(templateId: string, versionId: string): Promise<TemplateVersion | undefined>;

  // Audience Segments
  listAudienceSegments(filter?: { createdBy?: string; q?: string; includeGlobal?: boolean }): Promise<AudienceSegment[]>;
  getAudienceSegment(id: string): Promise<AudienceSegment | undefined>;
  createAudienceSegment(input: InsertAudienceSegment): Promise<AudienceSegment>;
  updateAudienceSegment(id: string, updates: Partial<AudienceSegment>): Promise<AudienceSegment | undefined>;
  deleteAudienceSegment(id: string): Promise<boolean>;

  // Template Metrics
  recordTemplateMetricEvent(event: { templateVersionId: string; channel: string; eventType: string; value?: number; occurredAt?: Date }): Promise<void>;
  upsertTemplateMetricsWindow(metrics: InsertTemplateMetrics): Promise<TemplateMetrics>;
  getTemplateMetrics(templateId: string, startDate?: string, endDate?: string): Promise<TemplateMetrics[]>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private companies: Map<string, Company> = new Map();
  private contacts: Map<string, Contact> = new Map();
  private visitorSessions: Map<string, VisitorSession> = new Map();
  private sequences: Map<string, Sequence> = new Map();
  private emails: Map<string, Email> = new Map();
  private insights: Map<string, Insight> = new Map();
  private personas: Map<string, Persona> = new Map();
  private tasks: Map<string, Task> = new Map();
  private digitalTwins: Map<string, DigitalTwin> = new Map();
  private twinInteractions: Map<string, TwinInteraction> = new Map();
  private twinPredictions: Map<string, TwinPrediction> = new Map();
  private sdrTeams: Map<string, SdrTeam> = new Map();
  private sdrTeamMembers: Map<string, SdrTeamMember> = new Map();
  private teamCollaborations: Map<string, TeamCollaboration> = new Map();
  private teamPerformances: Map<string, TeamPerformance> = new Map();
  private intentSignals: Map<string, IntentSignal> = new Map();
  private dealIntelligenceMap: Map<string, DealIntelligence> = new Map();
  private timingOptimizations: Map<string, TimingOptimization> = new Map();
  private predictiveModels: Map<string, PredictiveModel> = new Map();
  private pipelineHealthSnapshots: Map<string, PipelineHealth> = new Map();
  private dealForensicsRecords: Map<string, DealForensics> = new Map();
  private revenueForecasts: Map<string, RevenueForecast> = new Map();
  private coachingInsights: Map<string, CoachingInsight> = new Map();
  private channelConfigs: Map<string, ChannelConfig> = new Map();
  private multiChannelCampaigns: Map<string, MultiChannelCampaign> = new Map();
  private channelMessagesMap: Map<string, ChannelMessage> = new Map();
  private channelOrchestrations: Map<string, ChannelOrchestration> = new Map();
  private voiceCampaigns: Map<string, VoiceCampaign> = new Map();
  private voiceCalls: Map<string, VoiceCall> = new Map();
  private voiceScripts: Map<string, VoiceScript> = new Map();
  private callAnalyticsMap: Map<string, CallAnalytics> = new Map();
  private extensionUsers: Map<string, ExtensionUser> = new Map();
  private enrichmentCaches: Map<string, EnrichmentCache> = new Map();
  private extensionActivities: Map<string, ExtensionActivity> = new Map();
  private quickActions: Map<string, QuickAction> = new Map();
  private sharedIntel: Map<string, SharedIntel> = new Map();
  private intelContributions: Map<string, IntelContribution> = new Map();
  private intelRatings: Map<string, IntelRating> = new Map();
  private benchmarkDataMap: Map<string, BenchmarkData> = new Map();
  private whiteLabels: Map<string, WhiteLabel> = new Map();
  private enterpriseSecurity: Map<string, EnterpriseSecurity> = new Map();
  private auditLogs: Map<string, AuditLog> = new Map();
  private accessControls: Map<string, AccessControl> = new Map();
  // Marketplace-related maps (missing before)
  private marketplaceAgents: Map<string, MarketplaceAgent> = new Map();
  private agentRatings: Map<string, AgentRating> = new Map();
  private agentPurchases: Map<string, AgentPurchase> = new Map();
  private agentDownloads: Map<string, AgentDownload> = new Map();
  // Inbox messages
  private inboxMessages: Map<string, InboxMessage> = new Map();
  // Content Templates
  private contentTemplates: Map<string, ContentTemplate> = new Map();
  private templateVersions: Map<string, TemplateVersion> = new Map();
  private audienceSegments: Map<string, AudienceSegment> = new Map();
  private templateMetrics: Map<string, TemplateMetrics> = new Map();
  private templateSegmentAssociations: Map<string, Set<string>> = new Map(); // templateId -> Set<segmentId>

  constructor() {
    // No mock data - user explicitly requested NO mock data without permission
  }

  // User methods - Required for Replit Auth
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const id = userData.id || randomUUID();
    const existingUser = this.users.get(id);
    const user = existingUser 
      ? { ...existingUser, ...userData, updatedAt: new Date() } as User
      : { ...userData, id, createdAt: new Date(), updatedAt: new Date(), role: userData.role || "Sales Rep" } as User;
    this.users.set(id, user);
    return user;
  }

  // Company methods
  async getCompany(id: string): Promise<Company | undefined> {
    return this.companies.get(id);
  }

  async getCompanies(filters?: { userId?: string; limit?: number }): Promise<Company[]> {
    let companies = Array.from(this.companies.values());
    
    if (filters?.userId) {
      companies = companies.filter(c => c.userId === filters.userId);
    }
    
    return companies.slice(0, filters?.limit || 50);
  }

  async getCompaniesByDomain(domain: string): Promise<Company[]> {
    return Array.from(this.companies.values()).filter(c => c.domain === domain);
  }

  async createCompany(insertCompany: InsertCompany): Promise<Company> {
    const id = randomUUID();
    const company: Company = { 
      id, 
      createdAt: new Date(),
      userId: insertCompany.userId ?? null,
      name: insertCompany.name,
      domain: insertCompany.domain ?? null,
      industry: insertCompany.industry ?? null,
      size: insertCompany.size ?? null,
      location: insertCompany.location ?? null,
      revenue: insertCompany.revenue ?? null,
      technologies: insertCompany.technologies ?? null,
      description: insertCompany.description ?? null,
      linkedinUrl: insertCompany.linkedinUrl ?? null
    };
    this.companies.set(id, company);
    return company;
  }

  async updateCompany(id: string, updates: Partial<Company>): Promise<Company | undefined> {
    const company = this.companies.get(id);
    if (!company) return undefined;
    const updated = { ...company, ...updates };
    this.companies.set(id, updated);
    return updated;
  }

  async deleteCompany(id: string): Promise<boolean> {
    return this.companies.delete(id);
  }

  // Contact methods
  async getContact(id: string): Promise<Contact | undefined> {
    return this.contacts.get(id);
  }

  async getContacts(filters?: { userId?: string; companyId?: string; limit?: number }): Promise<Contact[]> {
    let contacts = Array.from(this.contacts.values());
    
    if (filters?.userId) {
      contacts = contacts.filter(c => c.userId === filters.userId);
    }
    
    if (filters?.companyId) {
      contacts = contacts.filter(c => c.companyId === filters.companyId);
    }
    
    return contacts.slice(0, filters?.limit || 50);
  }

  async createContact(insertContact: InsertContact): Promise<Contact> {
    const id = randomUUID();
    const contact: Contact = { 
      id,
      createdAt: new Date(),
      userId: insertContact.userId ?? null,
      email: insertContact.email,
      firstName: insertContact.firstName,
      lastName: insertContact.lastName,
      companyId: insertContact.companyId ?? null,
      title: insertContact.title ?? null,
      linkedinUrl: insertContact.linkedinUrl ?? null,
      phoneNumber: insertContact.phoneNumber ?? null,
      isVerified: insertContact.isVerified ?? null
    };
    this.contacts.set(id, contact);
    return contact;
  }

  async updateContact(id: string, updates: Partial<Contact>): Promise<Contact | undefined> {
    const contact = this.contacts.get(id);
    if (!contact) return undefined;
    const updated = { ...contact, ...updates };
    this.contacts.set(id, updated);
    return updated;
  }

  async deleteContact(id: string): Promise<boolean> {
    return this.contacts.delete(id);
  }

  // Visitor session methods
  async getVisitorSession(id: string): Promise<VisitorSession | undefined> {
    return this.visitorSessions.get(id);
  }

  async getActiveVisitorSessions(): Promise<VisitorSession[]> {
    return Array.from(this.visitorSessions.values()).filter(s => s.isActive);
  }

  async getVisitorSessionsByCompany(companyId: string): Promise<VisitorSession[]> {
    return Array.from(this.visitorSessions.values()).filter(s => s.companyId === companyId);
  }

  async createVisitorSession(insertSession: InsertVisitorSession): Promise<VisitorSession> {
    const id = randomUUID();
    const session: VisitorSession = { 
      id,
      createdAt: new Date(),
      lastActivity: new Date(),
      ipAddress: insertSession.ipAddress,
      companyId: insertSession.companyId ?? null,
      userAgent: insertSession.userAgent ?? null,
      pagesViewed: insertSession.pagesViewed ?? null,
      timeOnSite: insertSession.timeOnSite ?? null,
      intentScore: insertSession.intentScore ?? null,
      isActive: insertSession.isActive ?? null
    };
    this.visitorSessions.set(id, session);
    return session;
  }

  async updateVisitorSession(id: string, updates: Partial<VisitorSession>): Promise<VisitorSession | undefined> {
    const session = this.visitorSessions.get(id);
    if (!session) return undefined;
    const updated = { ...session, ...updates };
    this.visitorSessions.set(id, updated);
    return updated;
  }

  // Sequence methods
  async getSequence(id: string): Promise<Sequence | undefined> {
    return this.sequences.get(id);
  }

  async getSequences(filters?: { createdBy?: string; status?: string }): Promise<Sequence[]> {
    let sequences = Array.from(this.sequences.values());
    
    if (filters?.createdBy) {
      sequences = sequences.filter(s => s.createdBy === filters.createdBy);
    }
    
    if (filters?.status) {
      sequences = sequences.filter(s => s.status === filters.status);
    }
    
    return sequences;
  }

  async createSequence(insertSequence: InsertSequence): Promise<Sequence> {
    const id = randomUUID();
    const sequence: Sequence = { 
      id,
      createdAt: new Date(),
      name: insertSequence.name,
      steps: insertSequence.steps,
      description: insertSequence.description ?? null,
      status: insertSequence.status ?? "draft",
      targets: insertSequence.targets ?? null,
      createdBy: insertSequence.createdBy ?? null
    };
    this.sequences.set(id, sequence);
    return sequence;
  }

  async updateSequence(id: string, updates: Partial<Sequence>): Promise<Sequence | undefined> {
    const sequence = this.sequences.get(id);
    if (!sequence) return undefined;
    const updated = { ...sequence, ...updates };
    this.sequences.set(id, updated);
    return updated;
  }

  async deleteSequence(id: string): Promise<boolean> {
    return this.sequences.delete(id);
  }

  // Email methods
  async getEmail(id: string): Promise<Email | undefined> {
    return this.emails.get(id);
  }

  async getEmails(filters?: { contactId?: string; status?: string; limit?: number }): Promise<Email[]> {
    let emails = Array.from(this.emails.values());
    
    if (filters?.contactId) {
      emails = emails.filter(e => e.contactId === filters.contactId);
    }
    
    if (filters?.status) {
      emails = emails.filter(e => e.status === filters.status);
    }
    
    return emails.slice(0, filters?.limit || 50);
  }

  async createEmail(insertEmail: InsertEmail): Promise<Email> {
    const id = randomUUID();
    const email: Email = { 
      id,
      createdAt: new Date(),
      subject: insertEmail.subject,
      body: insertEmail.body,
      status: insertEmail.status ?? "draft",
      contactId: insertEmail.contactId ?? null,
      sequenceExecutionId: insertEmail.sequenceExecutionId ?? null,
      sentAt: insertEmail.sentAt ?? null,
      openedAt: insertEmail.openedAt ?? null,
      repliedAt: insertEmail.repliedAt ?? null,
      aiScore: insertEmail.aiScore ?? null,
      aiSuggestions: insertEmail.aiSuggestions ?? null
    };
    this.emails.set(id, email);
    return email;
  }

  async updateEmail(id: string, updates: Partial<Email>): Promise<Email | undefined> {
    const email = this.emails.get(id);
    if (!email) return undefined;
    const updated = { ...email, ...updates };
    this.emails.set(id, updated);
    return updated;
  }

  // Insight methods
  async getInsight(id: string): Promise<Insight | undefined> {
    return this.insights.get(id);
  }

  async getInsights(filters?: { companyId?: string; type?: string; limit?: number }): Promise<Insight[]> {
    let insights = Array.from(this.insights.values());
    
    if (filters?.companyId) {
      insights = insights.filter(i => i.companyId === filters.companyId);
    }
    
    if (filters?.type) {
      insights = insights.filter(i => i.type === filters.type);
    }
    
    return insights.slice(0, filters?.limit || 20);
  }

  async createInsight(insertInsight: InsertInsight): Promise<Insight> {
    const id = randomUUID();
    const insight: Insight = { 
      id,
      createdAt: new Date(),
      type: insertInsight.type,
      title: insertInsight.title,
      description: insertInsight.description,
      data: insertInsight.data ?? null,
      source: insertInsight.source ?? null,
      companyId: insertInsight.companyId ?? null,
      confidence: insertInsight.confidence ?? null,
      relevanceScore: insertInsight.relevanceScore ?? null,
      actionable: insertInsight.actionable ?? null
    };
    this.insights.set(id, insight);
    return insight;
  }

  // Persona methods
  async getPersona(id: string): Promise<Persona | undefined> {
    return this.personas.get(id);
  }

  async getPersonas(createdBy?: string): Promise<Persona[]> {
    let personas = Array.from(this.personas.values());
    
    if (createdBy) {
      personas = personas.filter(p => p.createdBy === createdBy);
    }
    
    return personas;
  }

  async createPersona(insertPersona: InsertPersona): Promise<Persona> {
    const id = randomUUID();
    const persona: Persona = { 
      id,
      createdAt: new Date(),
      name: insertPersona.name,
      description: insertPersona.description ?? null,
      createdBy: insertPersona.createdBy ?? null,
      targetTitles: insertPersona.targetTitles ?? null,
      industries: insertPersona.industries ?? null,
      companySizes: insertPersona.companySizes ?? null,
      valuePropositions: insertPersona.valuePropositions ?? null,
      toneGuidelines: insertPersona.toneGuidelines ?? null
    };
    this.personas.set(id, persona);
    return persona;
  }

  async updatePersona(id: string, updates: Partial<Persona>): Promise<Persona | undefined> {
    const persona = this.personas.get(id);
    if (!persona) return undefined;
    const updated = { ...persona, ...updates };
    this.personas.set(id, updated);
    return updated;
  }
  
  async deletePersona(id: string): Promise<boolean> {
    return this.personas.delete(id);
  }

  // Task methods
  async getTask(id: string): Promise<Task | undefined> {
    return this.tasks.get(id);
  }

  async getTasks(filters?: { assignedTo?: string; status?: string; priority?: string }): Promise<Task[]> {
    let tasks = Array.from(this.tasks.values());
    
    if (filters?.assignedTo) {
      tasks = tasks.filter(t => t.assignedTo === filters.assignedTo);
    }
    
    if (filters?.status) {
      tasks = tasks.filter(t => t.status === filters.status);
    }
    
    if (filters?.priority) {
      tasks = tasks.filter(t => t.priority === filters.priority);
    }
    
    return tasks;
  }

  async createTask(insertTask: InsertTask): Promise<Task> {
    const id = randomUUID();
    const task: Task = { 
      id,
      createdAt: new Date(),
      title: insertTask.title,
      type: insertTask.type,
      description: insertTask.description ?? null,
      status: insertTask.status ?? "pending",
      companyId: insertTask.companyId ?? null,
      contactId: insertTask.contactId ?? null,
      assignedTo: insertTask.assignedTo ?? null,
      priority: insertTask.priority ?? "medium",
      dueDate: insertTask.dueDate ?? null
    };
    this.tasks.set(id, task);
    return task;
  }

  async updateTask(id: string, updates: Partial<Task>): Promise<Task | undefined> {
    const task = this.tasks.get(id);
    if (!task) return undefined;
    const updated = { ...task, ...updates };
    this.tasks.set(id, updated);
    return updated;
  }

  // Phone Calls implementation
  private phoneCalls: Map<string, PhoneCall> = new Map();
  
  async getPhoneCall(id: string): Promise<PhoneCall | undefined> {
    return this.phoneCalls.get(id);
  }

  async getPhoneCalls(filters?: { contactId?: string; userId?: string; status?: string }): Promise<PhoneCall[]> {
    let calls = Array.from(this.phoneCalls.values());
    
    if (filters?.contactId) {
      calls = calls.filter(c => c.contactId === filters.contactId);
    }
    if (filters?.userId) {
      calls = calls.filter(c => c.userId === filters.userId);
    }
    if (filters?.status) {
      calls = calls.filter(c => c.status === filters.status);
    }
    
    return calls;
  }

  async createPhoneCall(call: InsertPhoneCall): Promise<PhoneCall> {
    const id = randomUUID();
    const newCall: PhoneCall = { 
      id,
      contactId: call.contactId || null,
      userId: call.userId || null,
      phoneNumber: call.phoneNumber,
      direction: call.direction,
      status: call.status,
      duration: call.duration || null,
      recordingUrl: call.recordingUrl || null,
      transcription: call.transcription || null,
      sentiment: call.sentiment || null,
      talkTrackId: call.talkTrackId || null,
      notes: call.notes || null,
      scheduledAt: call.scheduledAt || null,
      startedAt: call.startedAt || null,
      endedAt: call.endedAt || null,
      createdAt: new Date()
    };
    this.phoneCalls.set(id, newCall);
    return newCall;
  }

  async updatePhoneCall(id: string, updates: Partial<PhoneCall>): Promise<PhoneCall | undefined> {
    const call = this.phoneCalls.get(id);
    if (!call) return undefined;
    
    const updated = { ...call, ...updates };
    this.phoneCalls.set(id, updated);
    return updated;
  }

  // Call Scripts implementation
  private callScripts: Map<string, CallScript> = new Map();
  
  async getCallScript(id: string): Promise<CallScript | undefined> {
    return this.callScripts.get(id);
  }

  async getCallScripts(filters?: { type?: string; personaId?: string }): Promise<CallScript[]> {
    let scripts = Array.from(this.callScripts.values());
    
    if (filters?.type) {
      scripts = scripts.filter(s => s.type === filters.type);
    }
    if (filters?.personaId) {
      scripts = scripts.filter(s => s.personaId === filters.personaId);
    }
    
    return scripts;
  }

  async createCallScript(script: InsertCallScript): Promise<CallScript> {
    const id = randomUUID();
    const newScript: CallScript = {
      id,
      name: script.name,
      type: script.type,
      personaId: script.personaId || null,
      opening: script.opening,
      valueProps: script.valueProps || null,
      questions: script.questions || null,
      objectionHandlers: script.objectionHandlers || null,
      closing: script.closing || null,
      aiGenerated: script.aiGenerated || false,
      successRate: script.successRate || null,
      usageCount: script.usageCount || 0,
      createdAt: new Date()
    };
    this.callScripts.set(id, newScript);
    return newScript;
  }

  async updateCallScript(id: string, updates: Partial<CallScript>): Promise<CallScript | undefined> {
    const script = this.callScripts.get(id);
    if (!script) return undefined;
    
    const updated = { ...script, ...updates };
    this.callScripts.set(id, updated);
    return updated;
  }

  // Voicemails implementation
  private voicemails: Map<string, Voicemail> = new Map();
  
  async getVoicemail(id: string): Promise<Voicemail | undefined> {
    return this.voicemails.get(id);
  }

  async getVoicemails(filters?: { contactId?: string; isListened?: boolean }): Promise<Voicemail[]> {
    let vms = Array.from(this.voicemails.values());
    
    if (filters?.contactId) {
      vms = vms.filter(v => v.contactId === filters.contactId);
    }
    if (filters?.isListened !== undefined) {
      vms = vms.filter(v => v.isListened === filters.isListened);
    }
    
    return vms;
  }

  async createVoicemail(voicemail: InsertVoicemail): Promise<Voicemail> {
    const id = randomUUID();
    const newVoicemail: Voicemail = {
      id,
      callId: voicemail.callId || null,
      contactId: voicemail.contactId || null,
      scriptId: voicemail.scriptId || null,
      audioUrl: voicemail.audioUrl || null,
      transcription: voicemail.transcription || null,
      duration: voicemail.duration || null,
      isListened: voicemail.isListened || false,
      createdAt: new Date()
    };
    this.voicemails.set(id, newVoicemail);
    return newVoicemail;
  }

  async updateVoicemail(id: string, updates: Partial<Voicemail>): Promise<Voicemail | undefined> {
    const vm = this.voicemails.get(id);
    if (!vm) return undefined;
    
    const updated = { ...vm, ...updates };
    this.voicemails.set(id, updated);
    return updated;
  }

  // AI Agents implementation
  private aiAgents: Map<string, AiAgent> = new Map();
  private agentExecutions: Map<string, AgentExecution> = new Map();
  private agentMetrics: Map<string, AgentMetric> = new Map();

  async getAiAgent(id: string): Promise<AiAgent | undefined> {
    return this.aiAgents.get(id);
  }

  async getAiAgents(filters?: { status?: string; type?: string; createdBy?: string }): Promise<AiAgent[]> {
    let agents = Array.from(this.aiAgents.values());
    
    if (filters?.status) {
      agents = agents.filter(a => a.status === filters.status);
    }
    if (filters?.type) {
      agents = agents.filter(a => a.type === filters.type);
    }
    if (filters?.createdBy) {
      agents = agents.filter(a => a.createdBy === filters.createdBy);
    }
    
    return agents;
  }

  async createAiAgent(agent: InsertAiAgent): Promise<AiAgent> {
    const id = randomUUID();
    const newAgent: AiAgent = { 
      id,
      name: agent.name,
      type: agent.type || 'prospecting',
      description: agent.description || null,
      status: agent.status || 'active',
      persona: agent.persona || null,
      targetsPerDay: agent.targetsPerDay || 50,
      currentProgress: agent.currentProgress || 0,
      successRate: agent.successRate || '0',
      totalContacted: agent.totalContacted || 0,
      totalQualified: agent.totalQualified || 0,
      totalResponded: agent.totalResponded || 0,
      totalBooked: agent.totalBooked || 0,
      totalAttended: agent.totalAttended || 0,
      settings: agent.settings || {},
      lastRun: null, // lastRun is not part of InsertAiAgent
      createdBy: agent.createdBy || null,
      createdAt: new Date() 
    };
    this.aiAgents.set(id, newAgent);
    return newAgent;
  }

  async updateAiAgent(id: string, updates: Partial<AiAgent>): Promise<AiAgent | undefined> {
    const agent = this.aiAgents.get(id);
    if (!agent) return undefined;
    
    const updated = { ...agent, ...updates };
    this.aiAgents.set(id, updated);
    return updated;
  }

  async deleteAiAgent(id: string): Promise<boolean> {
    return this.aiAgents.delete(id);
  }
  
  // Agent Execution implementations
  async getAgentExecution(id: string): Promise<AgentExecution | undefined> {
    return this.agentExecutions.get(id);
  }

  async getAgentExecutions(filters?: { agentId?: string; status?: string; taskType?: string }): Promise<AgentExecution[]> {
    let executions = Array.from(this.agentExecutions.values());
    
    if (filters?.agentId) {
      executions = executions.filter(e => e.agentId === filters.agentId);
    }
    if (filters?.status) {
      executions = executions.filter(e => e.status === filters.status);
    }
    if (filters?.taskType) {
      executions = executions.filter(e => e.taskType === filters.taskType);
    }
    
    return executions;
  }

  async createAgentExecution(execution: InsertAgentExecution): Promise<AgentExecution> {
    const id = randomUUID();
    const newExecution: AgentExecution = {
      id,
      agentId: execution.agentId,
      taskType: execution.taskType,
      targetId: execution.targetId || null,
      context: execution.context || {},
      status: execution.status || 'pending',
      result: execution.result || null,
      error: execution.error || null,
      executionTimeMs: execution.executionTimeMs || null,
      createdAt: new Date(),
      startedAt: null, // startedAt is set when execution starts
      completedAt: null, // completedAt is set when execution finishes
      createdBy: execution.createdBy
    };
    this.agentExecutions.set(id, newExecution);
    return newExecution;
  }

  async updateAgentExecution(id: string, updates: Partial<AgentExecution>): Promise<AgentExecution | undefined> {
    const execution = this.agentExecutions.get(id);
    if (!execution) return undefined;
    
    const updated = { ...execution, ...updates };
    this.agentExecutions.set(id, updated);
    return updated;
  }

  // Agent Metrics implementations
  async getAgentMetrics(agentId: string, date?: string): Promise<AgentMetric | undefined> {
    const metrics = Array.from(this.agentMetrics.values());
    return metrics.find(m => m.agentId === agentId && (!date || m.date === date));
  }

  async getAgentMetricsRange(agentId: string, startDate: string, endDate: string): Promise<AgentMetric[]> {
    const metrics = Array.from(this.agentMetrics.values());
    return metrics.filter(m => 
      m.agentId === agentId && 
      m.date >= startDate && 
      m.date <= endDate
    );
  }

  async createAgentMetric(metric: InsertAgentMetric): Promise<AgentMetric> {
    const id = randomUUID();
    const newMetric: AgentMetric = {
      id,
      agentId: metric.agentId,
      date: metric.date,
      tasksCompleted: metric.tasksCompleted || 0,
      tasksFailed: metric.tasksFailed || 0,
      avgExecutionTime: metric.avgExecutionTime || 0,
      successRate: metric.successRate || 0,
      leadsGenerated: metric.leadsGenerated || null,
      emailsComposed: metric.emailsComposed || null,
      dataEnriched: metric.dataEnriched || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.agentMetrics.set(id, newMetric);
    return newMetric;
  }

  async updateAgentMetric(id: string, updates: Partial<AgentMetric>): Promise<AgentMetric | undefined> {
    const metric = this.agentMetrics.get(id);
    if (!metric) return undefined;
    
    const updated = { ...metric, ...updates, updatedAt: new Date() };
    this.agentMetrics.set(id, updated);
    return updated;
  }

  // Marketplace Agent methods (critical missing methods)
  async getMarketplaceAgent(id: string): Promise<MarketplaceAgent | undefined> {
    return this.marketplaceAgents.get(id);
  }

  async getMarketplaceAgents(filters?: { category?: string; author?: string; minRating?: number; maxPrice?: number; tags?: string[] }): Promise<MarketplaceAgent[]> {
    let agents = Array.from(this.marketplaceAgents.values());
    
    if (filters?.category) {
      agents = agents.filter(a => a.category === filters.category);
    }
    if (filters?.author) {
      agents = agents.filter(a => a.author === filters.author);
    }
    if (filters?.minRating !== undefined) {
      const minRating = filters.minRating;
      agents = agents.filter(a => 
        a.rating ? parseFloat(a.rating) >= minRating : false
      );
    }
    if (filters?.maxPrice !== undefined) {
      const maxPrice = filters.maxPrice;
      agents = agents.filter(a => 
        parseFloat(a.price) <= maxPrice
      );
    }
    if (filters?.tags && filters.tags.length > 0) {
      agents = agents.filter(a => 
        a.tags?.some(tag => filters.tags?.includes(tag))
      );
    }
    
    return agents;
  }

  async getMarketplaceAgentsByUser(userId: string): Promise<MarketplaceAgent[]> {
    return Array.from(this.marketplaceAgents.values()).filter(a => a.author === userId);
  }

  async createMarketplaceAgent(agent: InsertMarketplaceAgent): Promise<MarketplaceAgent> {
    const id = randomUUID();
    const newAgent: MarketplaceAgent = {
      id,
      name: agent.name,
      description: agent.description,
      category: agent.category,
      agentTypeId: agent.agentTypeId || null,
      author: agent.author,
      price: agent.price || "0",
      downloads: 0,
      rating: null,
      isPublic: agent.isPublic !== false,
      tags: agent.tags || null,
      configTemplate: agent.configTemplate || null,
      systemPrompt: agent.systemPrompt || null,
      inputSchema: agent.inputSchema || null,
      outputSchema: agent.outputSchema || null,
      version: agent.version || "1.0.0",
      changeLog: agent.changeLog || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.marketplaceAgents.set(id, newAgent);
    return newAgent;
  }

  async updateMarketplaceAgent(id: string, updates: Partial<MarketplaceAgent>): Promise<MarketplaceAgent | undefined> {
    const agent = this.marketplaceAgents.get(id);
    if (!agent) return undefined;
    
    const updated = { ...agent, ...updates, updatedAt: new Date() };
    this.marketplaceAgents.set(id, updated);
    return updated;
  }

  async deleteMarketplaceAgent(id: string): Promise<boolean> {
    return this.marketplaceAgents.delete(id);
  }

  async incrementAgentDownloads(id: string): Promise<void> {
    const agent = this.marketplaceAgents.get(id);
    if (agent) {
      agent.downloads = (agent.downloads || 0) + 1;
      this.marketplaceAgents.set(id, agent);
    }
  }

  // Agent Rating methods (critical missing methods)
  async getAgentRating(id: string): Promise<AgentRating | undefined> {
    return this.agentRatings.get(id);
  }

  async getAgentRatings(agentId: string): Promise<AgentRating[]> {
    return Array.from(this.agentRatings.values()).filter(r => r.agentId === agentId);
  }

  async getUserAgentRating(agentId: string, userId: string): Promise<AgentRating | undefined> {
    return Array.from(this.agentRatings.values()).find(r => 
      r.agentId === agentId && r.userId === userId
    );
  }

  async createAgentRating(rating: InsertAgentRating): Promise<AgentRating> {
    const id = randomUUID();
    const newRating: AgentRating = {
      id,
      agentId: rating.agentId,
      userId: rating.userId,
      rating: rating.rating,
      review: rating.review || null,
      helpfulCount: 0,
      unhelpfulCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.agentRatings.set(id, newRating);
    
    // Update average rating for the agent
    await this.updateAgentAverageRating(rating.agentId);
    
    return newRating;
  }

  async updateAgentRating(id: string, updates: Partial<AgentRating>): Promise<AgentRating | undefined> {
    const rating = this.agentRatings.get(id);
    if (!rating) return undefined;
    
    const updated = { ...rating, ...updates, updatedAt: new Date() };
    this.agentRatings.set(id, updated);
    
    // Update average rating for the agent
    await this.updateAgentAverageRating(rating.agentId);
    
    return updated;
  }

  async updateAgentAverageRating(agentId: string): Promise<void> {
    const ratings = await this.getAgentRatings(agentId);
    const agent = await this.getMarketplaceAgent(agentId);
    
    if (agent && ratings.length > 0) {
      const avgRating = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
      agent.rating = avgRating.toFixed(1);
      this.marketplaceAgents.set(agentId, agent);
    }
  }

  // Agent Purchase methods (critical missing methods)
  async getAgentPurchase(id: string): Promise<AgentPurchase | undefined> {
    return this.agentPurchases.get(id);
  }

  async getAgentPurchases(filters?: { agentId?: string; userId?: string }): Promise<AgentPurchase[]> {
    let purchases = Array.from(this.agentPurchases.values());
    
    if (filters?.agentId) {
      purchases = purchases.filter(p => p.agentId === filters.agentId);
    }
    if (filters?.userId) {
      purchases = purchases.filter(p => p.userId === filters.userId);
    }
    
    return purchases;
  }

  async createAgentPurchase(purchase: InsertAgentPurchase): Promise<AgentPurchase> {
    const id = randomUUID();
    const newPurchase: AgentPurchase = {
      id,
      ...purchase,
      purchasedAt: new Date()
    };
    this.agentPurchases.set(id, newPurchase);
    return newPurchase;
  }

  async hasUserPurchasedAgent(agentId: string, userId: string): Promise<boolean> {
    return Array.from(this.agentPurchases.values()).some(p => 
      p.agentId === agentId && p.userId === userId
    );
  }

  // Agent Download methods
  async getAgentDownload(id: string): Promise<AgentDownload | undefined> {
    return this.agentDownloads.get(id);
  }

  async getAgentDownloads(filters?: { agentId?: string; userId?: string }): Promise<AgentDownload[]> {
    let downloads = Array.from(this.agentDownloads.values());
    
    if (filters?.agentId) {
      downloads = downloads.filter(d => d.agentId === filters.agentId);
    }
    if (filters?.userId) {
      downloads = downloads.filter(d => d.userId === filters.userId);
    }
    
    return downloads;
  }

  async createAgentDownload(download: InsertAgentDownload): Promise<AgentDownload> {
    const id = randomUUID();
    const newDownload: AgentDownload = {
      id,
      agentId: download.agentId,
      userId: download.userId,
      version: download.version || "1.0.0",
      downloadedAt: new Date()
    };
    this.agentDownloads.set(id, newDownload);
    
    // Increment download count
    await this.incrementAgentDownloads(download.agentId);
    
    return newDownload;
  }

  async hasUserDownloadedAgent(agentId: string, userId: string): Promise<boolean> {
    return Array.from(this.agentDownloads.values()).some(d => 
      d.agentId === agentId && d.userId === userId
    );
  }
  
  // Onboarding (stub implementations)
  async getOnboardingProfile(userId: string): Promise<OnboardingProfile | undefined> {
    return undefined;
  }
  
  async createOnboardingProfile(profile: InsertOnboardingProfile): Promise<OnboardingProfile> {
    return { ...profile, id: randomUUID(), createdAt: new Date(), isComplete: false, onboardingStep: 1 } as OnboardingProfile;
  }
  
  async updateOnboardingProfile(userId: string, updates: Partial<OnboardingProfile>): Promise<OnboardingProfile | undefined> {
    return undefined;
  }
  
  // Platform Config stubs
  async getPlatformConfig(userId: string): Promise<PlatformConfig | undefined> {
    return undefined;
  }

  async createPlatformConfig(config: InsertPlatformConfig): Promise<PlatformConfig> {
    return { ...config, id: randomUUID(), createdAt: new Date(), updatedAt: new Date() } as PlatformConfig;
  }

  async updatePlatformConfig(userId: string, updates: Partial<PlatformConfig>): Promise<PlatformConfig | undefined> {
    return undefined;
  }
  
  // Workflow Trigger stubs
  async getWorkflowTrigger(id: string): Promise<WorkflowTrigger | undefined> {
    return undefined;
  }

  async getWorkflowTriggers(filters?: { isActive?: boolean; triggerType?: string }): Promise<WorkflowTrigger[]> {
    return [];
  }

  async createWorkflowTrigger(trigger: InsertWorkflowTrigger): Promise<WorkflowTrigger> {
    return { ...trigger, id: randomUUID(), createdAt: new Date(), executionCount: 0, lastExecuted: null } as WorkflowTrigger;
  }

  async updateWorkflowTrigger(id: string, updates: Partial<WorkflowTrigger>): Promise<WorkflowTrigger | undefined> {
    return undefined;
  }

  async deleteWorkflowTrigger(id: string): Promise<boolean> {
    return false;
  }
  
  // Playbook stubs  
  async getPlaybook(id: string): Promise<Playbook | undefined> {
    return undefined;
  }

  async getPlaybooks(filters?: { industry?: string; isTemplate?: boolean; createdBy?: string }): Promise<Playbook[]> {
    return [];
  }

  async createPlaybook(playbook: InsertPlaybook): Promise<Playbook> {
    return { ...playbook, id: randomUUID(), createdAt: new Date() } as Playbook;
  }

  async updatePlaybook(id: string, updates: Partial<Playbook>): Promise<Playbook | undefined> {
    return undefined;
  }

  // Autopilot - Proper implementations following schema
  autopilotCampaigns = new Map<string, AutopilotCampaign>();
  autopilotRuns = new Map<string, AutopilotRun>();
  
  async getAutopilotCampaign(id: string): Promise<AutopilotCampaign | undefined> {
    return this.autopilotCampaigns.get(id);
  }

  async getAutopilotCampaigns(filters?: { status?: string; createdBy?: string }): Promise<AutopilotCampaign[]> {
    let campaigns = Array.from(this.autopilotCampaigns.values());
    
    if (filters?.status) {
      campaigns = campaigns.filter(c => c.status === filters.status);
    }
    if (filters?.createdBy) {
      campaigns = campaigns.filter(c => c.createdBy === filters.createdBy);
    }
    
    return campaigns;
  }

  async createAutopilotCampaign(campaign: InsertAutopilotCampaign): Promise<AutopilotCampaign> {
    const id = randomUUID();
    const newCampaign: AutopilotCampaign = { 
      id,
      name: campaign.name,
      status: campaign.status || 'paused',
      targetPersona: campaign.targetPersona || null,
      sequence: campaign.sequence || null,
      dailyTargetLeads: campaign.dailyTargetLeads ?? 50,
      dailySendLimit: campaign.dailySendLimit ?? 100,
      workingHours: campaign.workingHours || null,
      workingDays: campaign.workingDays || null,
      autoProspect: campaign.autoProspect !== false,
      autoFollowUp: campaign.autoFollowUp !== false,
      autoQualify: campaign.autoQualify || false,
      autoBookMeetings: campaign.autoBookMeetings || false,
      creativityLevel: campaign.creativityLevel ?? 5,
      personalizationDepth: campaign.personalizationDepth || 'moderate',
      toneOfVoice: campaign.toneOfVoice || 'professional',
      totalLeadsProcessed: 0,
      totalEmailsSent: 0,
      totalReplies: 0,
      totalMeetingsBooked: 0,
      startDate: campaign.startDate || null,
      endDate: campaign.endDate || null,
      lastRunAt: null,
      createdBy: campaign.createdBy || null,
      createdAt: new Date()
    };
    
    this.autopilotCampaigns.set(id, newCampaign);
    return newCampaign;
  }

  async updateAutopilotCampaign(id: string, updates: Partial<AutopilotCampaign>): Promise<AutopilotCampaign | undefined> {
    const campaign = this.autopilotCampaigns.get(id);
    if (!campaign) return undefined;
    
    const updated = { ...campaign, ...updates };
    this.autopilotCampaigns.set(id, updated);
    return updated;
  }

  async getAutopilotRun(id: string): Promise<AutopilotRun | undefined> {
    return this.autopilotRuns.get(id);
  }

  async getAutopilotRunsByCampaign(campaignId: string): Promise<AutopilotRun[]> {
    return Array.from(this.autopilotRuns.values())
      .filter(run => run.campaignId === campaignId)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }

  async createAutopilotRun(run: InsertAutopilotRun): Promise<AutopilotRun> {
    const id = randomUUID();
    const newRun: AutopilotRun = { 
      id,
      campaignId: run.campaignId,
      status: run.status || 'running',
      runType: run.runType,
      leadsProcessed: run.leadsProcessed || 0,
      emailsSent: run.emailsSent || 0,
      emailsSkipped: run.emailsSkipped || 0,
      errors: run.errors || null,
      decisions: run.decisions || null,
      qualificationResults: run.qualificationResults || null,
      startedAt: new Date(),
      completedAt: null, // Will be set when run completes
      duration: null // Will be calculated when run completes
    };
    
    this.autopilotRuns.set(id, newRun);
    return newRun;
  }

  async updateAutopilotRun(id: string, updates: Partial<AutopilotRun>): Promise<AutopilotRun | undefined> {
    const run = this.autopilotRuns.get(id);
    if (!run) return undefined;
    
    const updated = { ...run, ...updates };
    this.autopilotRuns.set(id, updated);
    return updated;
  }

  // Voice Campaign implementations (Maps already declared above)
  
  async getVoiceCampaign(id: string): Promise<VoiceCampaign | undefined> {
    return this.voiceCampaigns.get(id);
  }
  
  async getVoiceCampaigns(filters?: { status?: string; createdBy?: string }): Promise<VoiceCampaign[]> {
    let campaigns = Array.from(this.voiceCampaigns.values());
    
    if (filters?.status) {
      campaigns = campaigns.filter(c => c.status === filters.status);
    }
    if (filters?.createdBy) {
      campaigns = campaigns.filter(c => c.createdBy === filters.createdBy);
    }
    
    return campaigns;
  }
  
  async createVoiceCampaign(campaign: InsertVoiceCampaign): Promise<VoiceCampaign> {
    const id = randomUUID();
    const newCampaign: VoiceCampaign = {
      id,
      name: campaign.name,
      status: campaign.status || 'draft',
      description: campaign.description || null,
      script: campaign.script || null,
      targetList: campaign.targetList || null,
      voiceSettings: campaign.voiceSettings || null,
      callSchedule: campaign.callSchedule || null,
      complianceSettings: campaign.complianceSettings || null,
      createdBy: campaign.createdBy || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.voiceCampaigns.set(id, newCampaign);
    return newCampaign;
  }
  
  async updateVoiceCampaign(id: string, updates: Partial<VoiceCampaign>): Promise<VoiceCampaign | undefined> {
    const campaign = this.voiceCampaigns.get(id);
    if (!campaign) return undefined;
    
    const updated = { ...campaign, ...updates, updatedAt: new Date() };
    this.voiceCampaigns.set(id, updated);
    return updated;
  }
  
  async deleteVoiceCampaign(id: string): Promise<boolean> {
    return this.voiceCampaigns.delete(id);
  }
  
  // Voice Call methods
  async getVoiceCall(id: string): Promise<VoiceCall | undefined> {
    return this.voiceCalls.get(id);
  }
  
  async getVoiceCalls(filters?: { campaignId?: string; contactId?: string; callStatus?: string }): Promise<VoiceCall[]> {
    let calls = Array.from(this.voiceCalls.values());
    
    if (filters?.campaignId) {
      calls = calls.filter(c => c.campaignId === filters.campaignId);
    }
    if (filters?.contactId) {
      calls = calls.filter(c => c.contactId === filters.contactId);
    }
    if (filters?.callStatus) {
      calls = calls.filter(c => c.callStatus === filters.callStatus);
    }
    
    return calls;
  }
  
  async createVoiceCall(call: InsertVoiceCall): Promise<VoiceCall> {
    const id = randomUUID();
    const newCall: VoiceCall = {
      id,
      campaignId: call.campaignId || null,
      contactId: call.contactId || null,
      phoneNumber: call.phoneNumber,
      callStatus: call.callStatus || 'initiated',
      duration: call.duration || null,
      startTime: null,
      endTime: null,
      recordingUrl: call.recordingUrl || null,
      transcript: call.transcript || null,
      sentiment: call.sentiment || null,
      outcome: call.outcome || null,
      consentObtained: call.consentObtained ?? false,
      doNotCallStatus: call.doNotCallStatus ?? false,
      createdAt: new Date()
    };
    
    this.voiceCalls.set(id, newCall);
    return newCall;
  }
  
  async updateVoiceCall(id: string, updates: Partial<VoiceCall>): Promise<VoiceCall | undefined> {
    const call = this.voiceCalls.get(id);
    if (!call) return undefined;
    
    const updated = { ...call, ...updates };
    this.voiceCalls.set(id, updated);
    return updated;
  }
  
  // Voice Script methods
  async getVoiceScript(id: string): Promise<VoiceScript | undefined> {
    return this.voiceScripts.get(id);
  }
  
  async getVoiceScripts(filters?: { scriptType?: string; isActive?: boolean; createdBy?: string }): Promise<VoiceScript[]> {
    let scripts = Array.from(this.voiceScripts.values());
    
    if (filters?.scriptType) {
      scripts = scripts.filter(s => s.scriptType === filters.scriptType);
    }
    if (filters?.isActive !== undefined) {
      scripts = scripts.filter(s => s.isActive === filters.isActive);
    }
    if (filters?.createdBy) {
      scripts = scripts.filter(s => s.createdBy === filters.createdBy);
    }
    
    return scripts;
  }
  
  async createVoiceScript(script: InsertVoiceScript): Promise<VoiceScript> {
    const id = randomUUID();
    const newScript: VoiceScript = {
      id,
      name: script.name,
      scriptType: script.scriptType,
      introduction: script.introduction,
      mainContent: script.mainContent,
      closingStatement: script.closingStatement || null,
      variables: script.variables || null,
      objectionHandlers: script.objectionHandlers || null,
      performanceMetrics: script.performanceMetrics || null,
      fallbackResponses: script.fallbackResponses || null,
      isActive: script.isActive !== false,
      createdBy: script.createdBy || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.voiceScripts.set(id, newScript);
    return newScript;
  }
  
  async updateVoiceScript(id: string, updates: Partial<VoiceScript>): Promise<VoiceScript | undefined> {
    const script = this.voiceScripts.get(id);
    if (!script) return undefined;
    
    const updated = { ...script, ...updates, updatedAt: new Date() };
    this.voiceScripts.set(id, updated);
    return updated;
  }
  
  async deleteVoiceScript(id: string): Promise<boolean> {
    return this.voiceScripts.delete(id);
  }
  
  // Call Analytics methods
  async getCallAnalytics(callId: string): Promise<CallAnalytics | undefined> {
    return Array.from(this.callAnalyticsMap.values()).find(a => a.callId === callId);
  }
  
  async getCallAnalyticsByCampaign(campaignId: string): Promise<CallAnalytics[]> {
    return [];
  }
  
  async createCallAnalytics(analytics: InsertCallAnalytics): Promise<CallAnalytics> {
    const id = randomUUID();
    const newAnalytics: CallAnalytics = {
      id,
      callId: analytics.callId || null,
      keyMoments: analytics.keyMoments || null,
      speakingRatio: analytics.speakingRatio || null,
      interruptionCount: analytics.interruptionCount ?? 0,
      talkSpeed: analytics.talkSpeed || null,
      emotionalTone: analytics.emotionalTone || null,
      conversionPoints: analytics.conversionPoints || null,
      objectionCount: analytics.objectionCount ?? 0,
      positiveSignals: analytics.positiveSignals ?? 0,
      negativeSignals: analytics.negativeSignals ?? 0,
      nextBestAction: analytics.nextBestAction || null,
      createdAt: new Date()
    };
    
    this.callAnalyticsMap.set(id, newAnalytics);
    return newAnalytics;
  }
  
  async updateCallAnalytics(id: string, updates: Partial<CallAnalytics>): Promise<CallAnalytics | undefined> {
    const analytics = this.callAnalyticsMap.get(id);
    if (!analytics) return undefined;
    
    const updated = { ...analytics, ...updates };
    this.callAnalyticsMap.set(id, updated);
    return updated;
  }

  // Channel Config stub methods
  async getChannelConfig(id: string): Promise<ChannelConfig | undefined> {
    return this.channelConfigs.get(id);
  }

  async getChannelConfigs(userId: string): Promise<ChannelConfig[]> {
    return Array.from(this.channelConfigs.values()).filter(c => c.userId === userId);
  }

  async getChannelConfigByUserAndChannel(userId: string, channel: string): Promise<ChannelConfig | undefined> {
    return Array.from(this.channelConfigs.values()).find(c => c.userId === userId && c.channel === channel);
  }

  async createChannelConfig(config: InsertChannelConfig): Promise<ChannelConfig> {
    const id = randomUUID();
    const newConfig: ChannelConfig = {
      id,
      userId: config.userId,
      channel: config.channel,
      credentials: config.credentials || null,
      settings: config.settings || null,
      isActive: config.isActive !== false,
      dailyLimits: config.dailyLimits || null,
      currentUsage: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.channelConfigs.set(id, newConfig);
    return newConfig;
  }

  async updateChannelConfig(id: string, updates: Partial<ChannelConfig>): Promise<ChannelConfig | undefined> {
    const config = this.channelConfigs.get(id);
    if (!config) return undefined;
    const updated = { ...config, ...cleanPartial(updates), updatedAt: new Date() };
    this.channelConfigs.set(id, updated);
    return updated;
  }

  async deleteChannelConfig(id: string): Promise<boolean> {
    return this.channelConfigs.delete(id);
  }

  // Multi-Channel Campaign stub methods
  async getMultiChannelCampaign(id: string): Promise<MultiChannelCampaign | undefined> {
    return this.multiChannelCampaigns.get(id);
  }

  async getMultiChannelCampaigns(filters?: { status?: string; createdBy?: string }): Promise<MultiChannelCampaign[]> {
    let campaigns = Array.from(this.multiChannelCampaigns.values());
    if (filters?.status) campaigns = campaigns.filter(c => c.status === filters.status);
    if (filters?.createdBy) campaigns = campaigns.filter(c => c.createdBy === filters.createdBy);
    return campaigns;
  }

  async createMultiChannelCampaign(campaign: InsertMultiChannelCampaign): Promise<MultiChannelCampaign> {
    const id = randomUUID();
    const newCampaign: MultiChannelCampaign = {
      id,
      name: campaign.name,
      description: campaign.description || null,
      status: campaign.status || "draft",
      channels: campaign.channels,
      sequenceSteps: campaign.sequenceSteps,
      audience: campaign.audience || null,
      startDate: campaign.startDate || null,
      endDate: campaign.endDate || null,
      metrics: null,
      createdBy: campaign.createdBy || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.multiChannelCampaigns.set(id, newCampaign);
    return newCampaign;
  }

  async updateMultiChannelCampaign(id: string, updates: Partial<MultiChannelCampaign>): Promise<MultiChannelCampaign | undefined> {
    const campaign = this.multiChannelCampaigns.get(id);
    if (!campaign) return undefined;
    const updated = { ...campaign, ...cleanPartial(updates), updatedAt: new Date() };
    this.multiChannelCampaigns.set(id, updated);
    return updated;
  }

  async deleteMultiChannelCampaign(id: string): Promise<boolean> {
    return this.multiChannelCampaigns.delete(id);
  }

  // Channel Message stub methods
  async getChannelMessage(id: string): Promise<ChannelMessage | undefined> {
    return this.channelMessagesMap.get(id);
  }

  async getChannelMessages(filters?: { campaignId?: string; channel?: string; recipientId?: string; status?: string }): Promise<ChannelMessage[]> {
    let messages = Array.from(this.channelMessagesMap.values());
    if (filters?.campaignId) messages = messages.filter(m => m.campaignId === filters.campaignId);
    if (filters?.channel) messages = messages.filter(m => m.channel === filters.channel);
    if (filters?.recipientId) messages = messages.filter(m => m.recipientId === filters.recipientId);
    if (filters?.status) messages = messages.filter(m => m.status === filters.status);
    return messages;
  }

  async createChannelMessage(message: InsertChannelMessage): Promise<ChannelMessage> {
    const id = randomUUID();
    const newMessage: ChannelMessage = {
      id,
      campaignId: message.campaignId || null,
      channel: message.channel,
      recipientId: message.recipientId || null,
      content: message.content,
      scheduledAt: message.scheduledAt || null,
      sentAt: null,
      status: message.status || "pending",
      response: null,
      engagement: null,
      createdAt: new Date()
    };
    this.channelMessagesMap.set(id, newMessage);
    return newMessage;
  }

  async updateChannelMessage(id: string, updates: Partial<ChannelMessage>): Promise<ChannelMessage | undefined> {
    const message = this.channelMessagesMap.get(id);
    if (!message) return undefined;
    const updated = { ...message, ...cleanPartial(updates) };
    this.channelMessagesMap.set(id, updated);
    return updated;
  }

  // Channel Orchestration stub methods
  async getChannelOrchestration(id: string): Promise<ChannelOrchestration | undefined> {
    return this.channelOrchestrations.get(id);
  }

  async getChannelOrchestrationByCampaign(campaignId: string): Promise<ChannelOrchestration | undefined> {
    return Array.from(this.channelOrchestrations.values()).find(o => o.campaignId === campaignId);
  }

  async createChannelOrchestration(orchestration: InsertChannelOrchestration): Promise<ChannelOrchestration> {
    const id = randomUUID();
    const newOrchestration: ChannelOrchestration = {
      id,
      campaignId: orchestration.campaignId,
      rules: orchestration.rules,
      priorityOrder: orchestration.priorityOrder,
      switchConditions: orchestration.switchConditions || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.channelOrchestrations.set(id, newOrchestration);
    return newOrchestration;
  }

  async updateChannelOrchestration(id: string, updates: Partial<ChannelOrchestration>): Promise<ChannelOrchestration | undefined> {
    const orchestration = this.channelOrchestrations.get(id);
    if (!orchestration) return undefined;
    const updated = { ...orchestration, ...cleanPartial(updates), updatedAt: new Date() };
    this.channelOrchestrations.set(id, updated);
    return updated;
  }

  // Lead Scoring Model stub methods
  async getLeadScoringModels(): Promise<LeadScoringModel[]> {
    return [];
  }

  async getLeadScoringModelById(id: string): Promise<LeadScoringModel | undefined> {
    return undefined;
  }

  async createLeadScoringModel(model: InsertLeadScoringModel): Promise<LeadScoringModel> {
    return { id: randomUUID(), ...model, createdAt: new Date(), updatedAt: new Date() } as LeadScoringModel;
  }

  async updateLeadScoringModel(id: string, model: Partial<InsertLeadScoringModel>): Promise<LeadScoringModel> {
    return { id, ...model, createdAt: new Date(), updatedAt: new Date() } as LeadScoringModel;
  }

  async deleteLeadScoringModel(id: string): Promise<void> {
    // Stub implementation
  }

  // Lead Score stub methods
  async getLeadScores(contactId?: string, modelId?: string): Promise<LeadScore[]> {
    return [];
  }

  async getLeadScoreById(id: string): Promise<LeadScore | undefined> {
    return undefined;
  }

  async createLeadScore(score: InsertLeadScore): Promise<LeadScore> {
    return { id: randomUUID(), ...score, calculatedAt: new Date(), createdAt: new Date() } as LeadScore;
  }

  async updateLeadScore(id: string, score: Partial<InsertLeadScore>): Promise<LeadScore> {
    return { id, ...score, calculatedAt: new Date(), createdAt: new Date() } as LeadScore;
  }

  async deleteLeadScore(id: string): Promise<void> {
    // Stub implementation
  }

  // Workflow stub methods
  async getWorkflow(id: string): Promise<Workflow | undefined> {
    return undefined;
  }

  async getWorkflows(filters?: { status?: string; category?: string; isTemplate?: boolean; createdBy?: string }): Promise<Workflow[]> {
    return [];
  }

  async createWorkflow(workflow: InsertWorkflow): Promise<Workflow> {
    return { 
      id: randomUUID(), 
      ...workflow, 
      nodes: workflow.nodes || [], 
      edges: workflow.edges || [],
      createdAt: new Date(), 
      updatedAt: new Date() 
    } as Workflow;
  }

  async updateWorkflow(id: string, updates: Partial<Workflow>): Promise<Workflow | undefined> {
    return { id, ...updates, createdAt: new Date(), updatedAt: new Date() } as Workflow;
  }

  async deleteWorkflow(id: string): Promise<boolean> {
    return true;
  }

  // Workflow Execution stub methods
  async getWorkflowExecution(id: string): Promise<WorkflowExecution | undefined> {
    return undefined;
  }

  async getWorkflowExecutions(filters?: { workflowId?: string; status?: string }): Promise<WorkflowExecution[]> {
    return [];
  }

  async createWorkflowExecution(execution: InsertWorkflowExecution): Promise<WorkflowExecution> {
    return { 
      id: randomUUID(), 
      ...execution, 
      startedAt: new Date() 
    } as WorkflowExecution;
  }

  async updateWorkflowExecution(id: string, updates: Partial<WorkflowExecution>): Promise<WorkflowExecution | undefined> {
    return { id, ...updates, startedAt: new Date() } as WorkflowExecution;
  }

  // Agent Type stub methods
  async getAgentType(id: string): Promise<AgentType | undefined> {
    return undefined;
  }

  async getAgentTypes(filters?: { category?: string }): Promise<AgentType[]> {
    return [];
  }

  async createAgentType(agentType: InsertAgentType): Promise<AgentType> {
    return { 
      id: randomUUID(), 
      ...agentType, 
      temperature: agentType.temperature || 0.7,
      maxTokens: agentType.maxTokens || 2000,
      createdAt: new Date() 
    } as AgentType;
  }

  async updateAgentType(id: string, updates: Partial<AgentType>): Promise<AgentType | undefined> {
    return { id, ...updates, createdAt: new Date() } as AgentType;
  }

  // Workflow Template stub methods
  async getWorkflowTemplate(id: string): Promise<WorkflowTemplate | undefined> {
    return undefined;
  }

  async getWorkflowTemplates(filters?: { category?: string; difficulty?: string }): Promise<WorkflowTemplate[]> {
    return [];
  }

  async createWorkflowTemplate(template: InsertWorkflowTemplate): Promise<WorkflowTemplate> {
    return { 
      id: randomUUID(), 
      ...template,
      usageCount: 0, 
      createdAt: new Date() 
    } as WorkflowTemplate;
  }

  async updateWorkflowTemplate(id: string, updates: Partial<WorkflowTemplate>): Promise<WorkflowTemplate | undefined> {
    return { id, ...updates, createdAt: new Date() } as WorkflowTemplate;
  }

  // Human Approval stub methods
  async getHumanApproval(id: string): Promise<HumanApproval | undefined> {
    return undefined;
  }

  async getHumanApprovals(filters?: { executionId?: string; status?: string }): Promise<HumanApproval[]> {
    return [];
  }

  async createHumanApproval(approval: InsertHumanApproval): Promise<HumanApproval> {
    return { 
      id: randomUUID(), 
      ...approval, 
      requestedAt: new Date() 
    } as HumanApproval;
  }

  async updateHumanApproval(id: string, updates: Partial<HumanApproval>): Promise<HumanApproval | undefined> {
    return { id, ...updates, requestedAt: new Date() } as HumanApproval;
  }

  // Digital Twin methods
  async getDigitalTwin(id: string): Promise<DigitalTwin | undefined> {
    return this.digitalTwins.get(id);
  }

  async getDigitalTwinByContact(contactId: string): Promise<DigitalTwin | undefined> {
    return Array.from(this.digitalTwins.values()).find(twin => twin.contactId === contactId);
  }

  async getDigitalTwins(filters?: { companyId?: string; limit?: number }): Promise<DigitalTwin[]> {
    let twins = Array.from(this.digitalTwins.values());
    
    if (filters?.companyId) {
      twins = twins.filter(t => t.companyId === filters.companyId);
    }
    
    if (filters?.limit) {
      twins = twins.slice(0, filters.limit);
    }
    
    return twins;
  }

  async createDigitalTwin(twin: InsertDigitalTwin): Promise<DigitalTwin> {
    const id = randomUUID();
    const newTwin: DigitalTwin = {
      id,
      contactId: twin.contactId,
      companyId: twin.companyId || null,
      communicationStyle: twin.communicationStyle || null,
      personalityTraits: twin.personalityTraits || {},
      interests: twin.interests || [],
      values: twin.values || null,
      painPoints: twin.painPoints || [],
      preferredChannels: twin.preferredChannels || null,
      bestEngagementTime: twin.bestEngagementTime || null,
      contentPreferences: twin.contentPreferences || [],
      buyingStageIndicators: twin.buyingStageIndicators || {},
      objectionsHistory: twin.objectionsHistory || {},
      lastModelUpdate: new Date(),
      modelConfidence: twin.modelConfidence || 50,
      createdAt: new Date()
    };
    this.digitalTwins.set(id, newTwin);
    return newTwin;
  }

  async updateDigitalTwin(id: string, updates: Partial<DigitalTwin>): Promise<DigitalTwin | undefined> {
    const twin = this.digitalTwins.get(id);
    if (!twin) return undefined;
    
    const updated = { ...twin, ...cleanPartial(updates), lastModelUpdate: new Date() };
    this.digitalTwins.set(id, updated);
    return updated;
  }
  
  async deleteDigitalTwin(id: string): Promise<boolean> {
    return this.digitalTwins.delete(id);
  }

  // Twin Interaction methods
  async getTwinInteraction(id: string): Promise<TwinInteraction | undefined> {
    return this.twinInteractions.get(id);
  }

  async getTwinInteractions(twinId: string, limit?: number): Promise<TwinInteraction[]> {
    let interactions = Array.from(this.twinInteractions.values())
      .filter(i => i.twinId === twinId)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    if (limit) {
      interactions = interactions.slice(0, limit);
    }
    
    return interactions;
  }

  async createTwinInteraction(interaction: InsertTwinInteraction): Promise<TwinInteraction> {
    const id = randomUUID();
    const newInteraction: TwinInteraction = {
      id,
      twinId: interaction.twinId,
      interactionType: interaction.interactionType,
      channel: interaction.channel,
      content: interaction.content || null,
      response: interaction.response || null,
      sentiment: interaction.sentiment || null,
      engagementScore: interaction.engagementScore || null,
      outcome: interaction.outcome || null,
      timestamp: new Date()
    };
    this.twinInteractions.set(id, newInteraction);
    return newInteraction;
  }

  // Twin Prediction methods
  async getTwinPrediction(id: string): Promise<TwinPrediction | undefined> {
    return this.twinPredictions.get(id);
  }

  async getTwinPredictions(twinId: string, type?: string): Promise<TwinPrediction[]> {
    let predictions = Array.from(this.twinPredictions.values())
      .filter(p => p.twinId === twinId);
    
    if (type) {
      predictions = predictions.filter(p => p.predictionType === type);
    }
    
    return predictions;
  }

  async createTwinPrediction(prediction: InsertTwinPrediction): Promise<TwinPrediction> {
    const id = randomUUID();
    const newPrediction: TwinPrediction = {
      id,
      twinId: prediction.twinId,
      predictionType: prediction.predictionType,
      prediction: prediction.prediction,
      confidence: prediction.confidence,
      validatedAt: prediction.validatedAt || null,
      createdAt: new Date()
    };
    this.twinPredictions.set(id, newPrediction);
    return newPrediction;
  }

  async updateTwinPrediction(id: string, updates: Partial<TwinPrediction>): Promise<TwinPrediction | undefined> {
    const prediction = this.twinPredictions.get(id);
    if (!prediction) return undefined;
    
    const updated = { ...prediction, ...cleanPartial(updates) };
    this.twinPredictions.set(id, updated);
    return updated;
  }
  
  // SDR Teams methods
  async getSdrTeam(id: string): Promise<SdrTeam | undefined> {
    return this.sdrTeams.get(id);
  }
  
  async getSdrTeams(filters?: { teamType?: string; isActive?: boolean; createdBy?: string }): Promise<SdrTeam[]> {
    let teams = Array.from(this.sdrTeams.values());
    
    if (filters?.teamType) {
      teams = teams.filter(t => t.teamType === filters.teamType);
    }
    if (filters?.isActive !== undefined) {
      teams = teams.filter(t => t.isActive === filters.isActive);
    }
    if (filters?.createdBy) {
      teams = teams.filter(t => t.createdBy === filters.createdBy);
    }
    
    return teams;
  }
  
  async createSdrTeam(team: InsertSdrTeam): Promise<SdrTeam> {
    const id = randomUUID();
    const now = new Date();
    const newTeam: SdrTeam = {
      id,
      name: team.name,
      description: team.description || null,
      teamType: team.teamType || 'hybrid',
      memberRoles: team.memberRoles,
      strategy: team.strategy || null,
      performanceMetrics: team.performanceMetrics || null,
      isActive: team.isActive !== undefined ? team.isActive : true,
      createdBy: team.createdBy || null,
      createdAt: now,
      updatedAt: now
    };
    this.sdrTeams.set(id, newTeam);
    return newTeam;
  }
  
  async updateSdrTeam(id: string, updates: Partial<SdrTeam>): Promise<SdrTeam | undefined> {
    const team = this.sdrTeams.get(id);
    if (!team) return undefined;
    
    const updated = { ...team, ...cleanPartial(updates), updatedAt: new Date() };
    this.sdrTeams.set(id, updated);
    return updated;
  }
  
  async deleteSdrTeam(id: string): Promise<boolean> {
    return this.sdrTeams.delete(id);
  }
  
  // SDR Team Members methods
  async getSdrTeamMember(id: string): Promise<SdrTeamMember | undefined> {
    return this.sdrTeamMembers.get(id);
  }
  
  async getSdrTeamMembersByTeam(teamId: string): Promise<SdrTeamMember[]> {
    return Array.from(this.sdrTeamMembers.values())
      .filter(m => m.teamId === teamId);
  }
  
  async getSdrTeamMembersByRole(role: string): Promise<SdrTeamMember[]> {
    return Array.from(this.sdrTeamMembers.values())
      .filter(m => m.role === role);
  }
  
  async createSdrTeamMember(member: InsertSdrTeamMember): Promise<SdrTeamMember> {
    const id = randomUUID();
    const now = new Date();
    const newMember: SdrTeamMember = {
      id,
      teamId: member.teamId,
      role: member.role,
      agentTypeId: member.agentTypeId || null,
      personalityProfile: member.personalityProfile || null,
      skills: member.skills || null,
      currentLoad: member.currentLoad || 0,
      performance: member.performance || null,
      isActive: member.isActive !== undefined ? member.isActive : true,
      createdAt: now,
      updatedAt: now
    };
    this.sdrTeamMembers.set(id, newMember);
    return newMember;
  }
  
  async updateSdrTeamMember(id: string, updates: Partial<SdrTeamMember>): Promise<SdrTeamMember | undefined> {
    const member = this.sdrTeamMembers.get(id);
    if (!member) return undefined;
    
    const updated = { ...member, ...cleanPartial(updates), updatedAt: new Date() };
    this.sdrTeamMembers.set(id, updated);
    return updated;
  }
  
  async deleteSdrTeamMember(id: string): Promise<boolean> {
    return this.sdrTeamMembers.delete(id);
  }
  
  // Team Collaborations methods
  async getTeamCollaboration(id: string): Promise<TeamCollaboration | undefined> {
    return this.teamCollaborations.get(id);
  }
  
  async getTeamCollaborations(filters?: { teamId?: string; dealId?: string; contactId?: string; outcome?: string }): Promise<TeamCollaboration[]> {
    let collaborations = Array.from(this.teamCollaborations.values());
    
    if (filters?.teamId) {
      collaborations = collaborations.filter(c => c.teamId === filters.teamId);
    }
    if (filters?.dealId) {
      collaborations = collaborations.filter(c => c.dealId === filters.dealId);
    }
    if (filters?.contactId) {
      collaborations = collaborations.filter(c => c.contactId === filters.contactId);
    }
    if (filters?.outcome) {
      collaborations = collaborations.filter(c => c.outcome === filters.outcome);
    }
    
    return collaborations;
  }
  
  async createTeamCollaboration(collaboration: InsertTeamCollaboration): Promise<TeamCollaboration> {
    const id = randomUUID();
    const newCollaboration: TeamCollaboration = {
      id,
      teamId: collaboration.teamId,
      dealId: collaboration.dealId || null,
      contactId: collaboration.contactId || null,
      companyId: collaboration.companyId || null,
      collaborationType: collaboration.collaborationType,
      participantRoles: collaboration.participantRoles || null,
      decisions: collaboration.decisions || null,
      outcome: collaboration.outcome || null,
      timestamp: new Date(),
      duration: collaboration.duration || null
    };
    this.teamCollaborations.set(id, newCollaboration);
    return newCollaboration;
  }
  
  async updateTeamCollaboration(id: string, updates: Partial<TeamCollaboration>): Promise<TeamCollaboration | undefined> {
    const collaboration = this.teamCollaborations.get(id);
    if (!collaboration) return undefined;
    
    const updated = { ...collaboration, ...cleanPartial(updates) };
    this.teamCollaborations.set(id, updated);
    return updated;
  }
  
  // Team Performance methods
  async getTeamPerformance(id: string): Promise<TeamPerformance | undefined> {
    return this.teamPerformances.get(id);
  }
  
  async getTeamPerformanceByTeam(teamId: string, period?: string): Promise<TeamPerformance[]> {
    let performances = Array.from(this.teamPerformances.values())
      .filter(p => p.teamId === teamId);
    
    if (period) {
      performances = performances.filter(p => p.period === period);
    }
    
    return performances;
  }
  
  async createTeamPerformance(performance: InsertTeamPerformance): Promise<TeamPerformance> {
    const id = randomUUID();
    const newPerformance: TeamPerformance = {
      id,
      teamId: performance.teamId,
      period: performance.period,
      startDate: performance.startDate,
      endDate: performance.endDate,
      metrics: performance.metrics,
      wins: performance.wins || 0,
      losses: performance.losses || 0,
      conversionRate: performance.conversionRate || null,
      avgDealSize: performance.avgDealSize || null,
      createdAt: new Date()
    };
    this.teamPerformances.set(id, newPerformance);
    return newPerformance;
  }
  
  async updateTeamPerformance(id: string, updates: Partial<TeamPerformance>): Promise<TeamPerformance | undefined> {
    const performance = this.teamPerformances.get(id);
    if (!performance) return undefined;
    
    const updated = { ...performance, ...cleanPartial(updates) };
    this.teamPerformances.set(id, updated);
    return updated;
  }

  // Intent Signals methods
  async getIntentSignal(id: string): Promise<IntentSignal | undefined> {
    return this.intentSignals.get(id);
  }

  async getIntentSignals(filters?: { contactId?: string; companyId?: string; signalType?: string; limit?: number }): Promise<IntentSignal[]> {
    let signals = Array.from(this.intentSignals.values());
    
    if (filters?.contactId) {
      signals = signals.filter(s => s.contactId === filters.contactId);
    }
    
    if (filters?.companyId) {
      signals = signals.filter(s => s.companyId === filters.companyId);
    }
    
    if (filters?.signalType) {
      signals = signals.filter(s => s.signalType === filters.signalType);
    }
    
    // Sort by detectedAt descending
    signals.sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime());
    
    if (filters?.limit) {
      signals = signals.slice(0, filters.limit);
    }
    
    return signals;
  }

  async createIntentSignal(signal: InsertIntentSignal): Promise<IntentSignal> {
    const id = randomUUID();
    const intentSignal: IntentSignal = {
      id,
      detectedAt: new Date(),
      contactId: signal.contactId ?? null,
      companyId: signal.companyId ?? null,
      signalType: signal.signalType,
      signalStrength: signal.signalStrength ?? 0,
      source: signal.source ?? null,
      metadata: signal.metadata ?? null
    };
    this.intentSignals.set(id, intentSignal);
    return intentSignal;
  }

  async updateIntentSignal(id: string, updates: Partial<IntentSignal>): Promise<IntentSignal | undefined> {
    const signal = this.intentSignals.get(id);
    if (!signal) return undefined;
    const updated = { ...signal, ...cleanPartial(updates) };
    this.intentSignals.set(id, updated);
    return updated;
  }

  // Deal Intelligence methods
  async getDealIntelligence(id: string): Promise<DealIntelligence | undefined> {
    return this.dealIntelligenceMap.get(id);
  }

  async getDealIntelligenceByCompany(companyId: string): Promise<DealIntelligence | undefined> {
    return Array.from(this.dealIntelligenceMap.values())
      .find(di => di.companyId === companyId);
  }

  async createDealIntelligence(intelligence: InsertDealIntelligence): Promise<DealIntelligence> {
    const id = randomUUID();
    const dealIntel: DealIntelligence = {
      id,
      lastUpdated: new Date(),
      companyId: intelligence.companyId,
      intentScore: intelligence.intentScore ?? 0,
      buyingStage: intelligence.buyingStage ?? null,
      competitorMentions: intelligence.competitorMentions ?? null,
      budgetIndicators: intelligence.budgetIndicators ?? null,
      timelineSignals: intelligence.timelineSignals ?? null,
      decisionMakers: intelligence.decisionMakers ?? null,
      blockers: intelligence.blockers ?? null,
      champions: intelligence.champions ?? null,
      predictedCloseDate: intelligence.predictedCloseDate ?? null,
      predictedDealSize: intelligence.predictedDealSize ?? null,
      winProbability: intelligence.winProbability ?? null
    };
    this.dealIntelligenceMap.set(id, dealIntel);
    return dealIntel;
  }

  async updateDealIntelligence(id: string, updates: Partial<DealIntelligence>): Promise<DealIntelligence | undefined> {
    const intelligence = this.dealIntelligenceMap.get(id);
    if (!intelligence) return undefined;
    const updated = { ...intelligence, ...cleanPartial(updates), lastUpdated: new Date() };
    this.dealIntelligenceMap.set(id, updated);
    return updated;
  }

  // Timing Optimization methods
  async getTimingOptimization(id: string): Promise<TimingOptimization | undefined> {
    return this.timingOptimizations.get(id);
  }

  async getTimingOptimizationByContact(contactId: string): Promise<TimingOptimization | undefined> {
    return Array.from(this.timingOptimizations.values())
      .find(to => to.contactId === contactId);
  }

  async createTimingOptimization(timing: InsertTimingOptimization): Promise<TimingOptimization> {
    const id = randomUUID();
    const timingOpt: TimingOptimization = {
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
      contactId: timing.contactId,
      bestCallTime: timing.bestCallTime ?? null,
      bestEmailTime: timing.bestEmailTime ?? null,
      bestLinkedInTime: timing.bestLinkedInTime ?? null,
      responsePatterns: timing.responsePatterns ?? null,
      timezone: timing.timezone ?? null
    };
    this.timingOptimizations.set(id, timingOpt);
    return timingOpt;
  }

  async updateTimingOptimization(id: string, updates: Partial<TimingOptimization>): Promise<TimingOptimization | undefined> {
    const timing = this.timingOptimizations.get(id);
    if (!timing) return undefined;
    const updated = { ...timing, ...cleanPartial(updates), updatedAt: new Date() };
    this.timingOptimizations.set(id, updated);
    return updated;
  }

  // Predictive Models methods
  async getPredictiveModel(id: string): Promise<PredictiveModel | undefined> {
    return this.predictiveModels.get(id);
  }

  async getPredictiveModels(modelType?: string): Promise<PredictiveModel[]> {
    let models = Array.from(this.predictiveModels.values());
    
    if (modelType) {
      models = models.filter(m => m.modelType === modelType);
    }
    
    // Sort by trainedAt descending
    models.sort((a, b) => new Date(b.trainedAt).getTime() - new Date(a.trainedAt).getTime());
    
    return models;
  }

  async createPredictiveModel(model: InsertPredictiveModel): Promise<PredictiveModel> {
    const id = randomUUID();
    const predictiveModel: PredictiveModel = {
      id,
      trainedAt: new Date(),
      modelType: model.modelType,
      predictions: model.predictions,
      accuracy: model.accuracy ?? null
    };
    this.predictiveModels.set(id, predictiveModel);
    return predictiveModel;
  }

  async updatePredictiveModel(id: string, updates: Partial<PredictiveModel>): Promise<PredictiveModel | undefined> {
    const model = this.predictiveModels.get(id);
    if (!model) return undefined;
    const updated = { ...model, ...cleanPartial(updates) };
    this.predictiveModels.set(id, updated);
    return updated;
  }

  // Revenue Operations - Pipeline Health methods
  async getPipelineHealth(id: string): Promise<PipelineHealth | undefined> {
    return this.pipelineHealthSnapshots.get(id);
  }

  async getLatestPipelineHealth(): Promise<PipelineHealth | undefined> {
    const snapshots = Array.from(this.pipelineHealthSnapshots.values());
    if (snapshots.length === 0) return undefined;
    
    // Sort by createdAt descending and return the latest
    snapshots.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return snapshots[0];
  }

  async getPipelineHealthHistory(limit: number = 10): Promise<PipelineHealth[]> {
    const snapshots = Array.from(this.pipelineHealthSnapshots.values());
    
    // Sort by createdAt descending
    snapshots.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    return snapshots.slice(0, limit);
  }

  async createPipelineHealth(health: InsertPipelineHealth): Promise<PipelineHealth> {
    const id = randomUUID();
    const pipelineHealth: PipelineHealth = {
      id,
      snapshotDate: new Date(),
      totalDeals: health.totalDeals ?? 0,
      totalValue: (health.totalValue ?? 0).toString(),
      byStage: health.byStage,
      velocity: health.velocity,
      conversion: health.conversion,
      riskIndicators: health.riskIndicators,
      healthScore: health.healthScore ?? 0,
      createdAt: new Date()
    };
    this.pipelineHealthSnapshots.set(id, pipelineHealth);
    return pipelineHealth;
  }

  // Deal Forensics methods
  async getDealForensics(id: string): Promise<DealForensics | undefined> {
    return this.dealForensicsRecords.get(id);
  }

  async getDealForensicsByDealId(dealId: string): Promise<DealForensics[]> {
    return Array.from(this.dealForensicsRecords.values())
      .filter(f => f.dealId === dealId)
      .sort((a, b) => new Date(b.analyzedAt).getTime() - new Date(a.analyzedAt).getTime());
  }

  async getDealForensicsByType(analysisType: string): Promise<DealForensics[]> {
    return Array.from(this.dealForensicsRecords.values())
      .filter(f => f.analysisType === analysisType)
      .sort((a, b) => new Date(b.analyzedAt).getTime() - new Date(a.analyzedAt).getTime());
  }

  async createDealForensics(forensics: InsertDealForensics): Promise<DealForensics> {
    const id = randomUUID();
    const dealForensics: DealForensics = {
      id,
      dealId: forensics.dealId,
      analysisType: forensics.analysisType,
      rootCauses: forensics.rootCauses,
      criticalMoments: forensics.criticalMoments,
      missedOpportunities: forensics.missedOpportunities || null,
      recommendations: forensics.recommendations,
      competitorFactors: forensics.competitorFactors || null,
      analyzedAt: new Date(),
      createdAt: new Date()
    };
    this.dealForensicsRecords.set(id, dealForensics);
    return dealForensics;
  }

  // Revenue Forecasts methods
  async getRevenueForecast(id: string): Promise<RevenueForecast | undefined> {
    return this.revenueForecasts.get(id);
  }

  async getRevenueForecasts(period?: string): Promise<RevenueForecast[]> {
    let forecasts = Array.from(this.revenueForecasts.values());
    
    if (period) {
      forecasts = forecasts.filter(f => f.forecastPeriod === period);
    }
    
    // Sort by createdAt descending
    forecasts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    return forecasts;
  }

  async getLatestForecast(): Promise<RevenueForecast | undefined> {
    const forecasts = Array.from(this.revenueForecasts.values());
    if (forecasts.length === 0) return undefined;
    
    // Sort by createdAt descending and return the latest
    forecasts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return forecasts[0];
  }

  async createRevenueForecast(forecast: InsertRevenueForecast): Promise<RevenueForecast> {
    const id = randomUUID();
    const revenueForecast: RevenueForecast = {
      id,
      forecastPeriod: forecast.forecastPeriod,
      predictedRevenue: forecast.predictedRevenue.toString(),
      confidenceLevel: forecast.confidenceLevel.toString(),
      assumptions: forecast.assumptions,
      scenarios: forecast.scenarios,
      createdAt: new Date()
    };
    this.revenueForecasts.set(id, revenueForecast);
    return revenueForecast;
  }

  // Coaching Insights methods
  async getCoachingInsight(id: string): Promise<CoachingInsight | undefined> {
    return this.coachingInsights.get(id);
  }

  async getCoachingInsights(filters?: { userId?: string; insightType?: string; priority?: string; status?: string }): Promise<CoachingInsight[]> {
    let insights = Array.from(this.coachingInsights.values());
    
    if (filters?.userId) {
      insights = insights.filter(i => i.userId === filters.userId);
    }
    if (filters?.insightType) {
      insights = insights.filter(i => i.insightType === filters.insightType);
    }
    if (filters?.priority) {
      insights = insights.filter(i => i.priority === filters.priority);
    }
    if (filters?.status) {
      insights = insights.filter(i => i.status === filters.status);
    }
    
    // Sort by priority (high first) and then by createdAt descending
    insights.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const priorityCompare = (priorityOrder[a.priority as keyof typeof priorityOrder] || 1) - 
                              (priorityOrder[b.priority as keyof typeof priorityOrder] || 1);
      if (priorityCompare !== 0) return priorityCompare;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    
    return insights;
  }

  async createCoachingInsight(insight: InsertCoachingInsight): Promise<CoachingInsight> {
    const id = randomUUID();
    const coachingInsight: CoachingInsight = {
      id,
      userId: insight.userId || null,
      insightType: insight.insightType,
      insight: insight.insight,
      actionItems: insight.actionItems,
      priority: insight.priority || 'medium',
      status: insight.status || 'pending',
      createdAt: new Date()
    };
    this.coachingInsights.set(id, coachingInsight);
    return coachingInsight;
  }

  async updateCoachingInsight(id: string, updates: Partial<CoachingInsight>): Promise<CoachingInsight | undefined> {
    const insight = this.coachingInsights.get(id);
    if (!insight) return undefined;
    
    const updated = { ...insight, ...cleanPartial(updates) };
    this.coachingInsights.set(id, updated);
    return updated;
  }
  
  // Browser Extension methods
  async getExtensionUser(id: string): Promise<ExtensionUser | undefined> {
    return this.extensionUsers.get(id);
  }

  async getExtensionUserByUserId(userId: string): Promise<ExtensionUser | undefined> {
    return Array.from(this.extensionUsers.values()).find(eu => eu.userId === userId);
  }

  async createExtensionUser(user: InsertExtensionUser): Promise<ExtensionUser> {
    const id = randomUUID();
    const extensionUser: ExtensionUser = {
      id,
      userId: user.userId,
      extensionId: user.extensionId,
      installedAt: new Date(),
      lastActiveAt: new Date(),
      settings: user.settings || {},
      isActive: user.isActive ?? true
    };
    this.extensionUsers.set(id, extensionUser);
    return extensionUser;
  }

  async updateExtensionUser(id: string, updates: Partial<ExtensionUser>): Promise<ExtensionUser | undefined> {
    const user = this.extensionUsers.get(id);
    if (!user) return undefined;
    
    const updated = { ...user, ...cleanPartial(updates), lastActiveAt: new Date() };
    this.extensionUsers.set(id, updated);
    return updated;
  }

  async getEnrichmentCache(id: string): Promise<EnrichmentCache | undefined> {
    return this.enrichmentCaches.get(id);
  }

  async getEnrichmentCacheByDomain(domain: string): Promise<EnrichmentCache | undefined> {
    const now = new Date();
    return Array.from(this.enrichmentCaches.values()).find(cache => 
      cache.domain === domain && new Date(cache.expiresAt) > now
    );
  }

  async createEnrichmentCache(cache: InsertEnrichmentCache): Promise<EnrichmentCache> {
    const id = randomUUID();
    const enrichmentCache: EnrichmentCache = {
      id,
      domain: cache.domain,
      companyData: cache.companyData || null,
      contactData: cache.contactData || null,
      technologies: cache.technologies || null,
      socialProfiles: cache.socialProfiles || null,
      cachedAt: new Date(),
      expiresAt: cache.expiresAt
    };
    this.enrichmentCaches.set(id, enrichmentCache);
    return enrichmentCache;
  }

  async updateEnrichmentCache(id: string, updates: Partial<EnrichmentCache>): Promise<EnrichmentCache | undefined> {
    const cache = this.enrichmentCaches.get(id);
    if (!cache) return undefined;
    
    const updated = { ...cache, ...cleanPartial(updates) };
    this.enrichmentCaches.set(id, updated);
    return updated;
  }

  async getExtensionActivity(id: string): Promise<ExtensionActivity | undefined> {
    return this.extensionActivities.get(id);
  }

  async getExtensionActivities(filters?: { userId?: string; activityType?: string; limit?: number }): Promise<ExtensionActivity[]> {
    let activities = Array.from(this.extensionActivities.values());
    
    if (filters?.userId) {
      activities = activities.filter(a => a.userId === filters.userId);
    }
    
    if (filters?.activityType) {
      activities = activities.filter(a => a.activityType === filters.activityType);
    }
    
    // Sort by timestamp descending
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    if (filters?.limit) {
      activities = activities.slice(0, filters.limit);
    }
    
    return activities;
  }

  async createExtensionActivity(activity: InsertExtensionActivity): Promise<ExtensionActivity> {
    const id = randomUUID();
    const extensionActivity: ExtensionActivity = {
      id,
      userId: activity.userId,
      activityType: activity.activityType,
      url: activity.url || null,
      domain: activity.domain || null,
      enrichedData: activity.enrichedData || null,
      timestamp: new Date()
    };
    this.extensionActivities.set(id, extensionActivity);
    return extensionActivity;
  }

  async getQuickAction(id: string): Promise<QuickAction | undefined> {
    return this.quickActions.get(id);
  }

  async getQuickActions(filters?: { userId?: string; actionType?: string; limit?: number }): Promise<QuickAction[]> {
    let actions = Array.from(this.quickActions.values());
    
    if (filters?.userId) {
      actions = actions.filter(a => a.userId === filters.userId);
    }
    
    if (filters?.actionType) {
      actions = actions.filter(a => a.actionType === filters.actionType);
    }
    
    // Sort by executedAt descending
    actions.sort((a, b) => new Date(b.executedAt).getTime() - new Date(a.executedAt).getTime());
    
    if (filters?.limit) {
      actions = actions.slice(0, filters.limit);
    }
    
    return actions;
  }

  async createQuickAction(action: InsertQuickAction): Promise<QuickAction> {
    const id = randomUUID();
    const quickAction: QuickAction = {
      id,
      userId: action.userId,
      actionType: action.actionType,
      targetData: action.targetData,
      executedAt: new Date(),
      result: action.result || null
    };
    this.quickActions.set(id, quickAction);
    return quickAction;
  }

  // Inbox Messages
  async getInboxMessage(id: string): Promise<InboxMessage | undefined> {
    return this.inboxMessages.get(id);
  }

  async getInboxMessages(filters?: { userId?: string; channel?: string; category?: string; isRead?: boolean; isArchived?: boolean }): Promise<InboxMessage[]> {
    let messages = Array.from(this.inboxMessages.values());
    if (filters?.userId) messages = messages.filter(m => m.userId === filters.userId);
    if (filters?.channel) messages = messages.filter(m => m.channel === filters.channel);
    if (filters?.category) messages = messages.filter(m => m.category === filters.category);
    if (filters?.isRead !== undefined) messages = messages.filter(m => m.isRead === filters.isRead);
    if (filters?.isArchived !== undefined) messages = messages.filter(m => m.isArchived === filters.isArchived);
    return messages;
  }

  async createInboxMessage(message: InsertInboxMessage): Promise<InboxMessage> {
    const id = randomUUID();
    const inboxMessage: InboxMessage = {
      id,
      userId: message.userId || null,
      contactId: message.contactId || null,
      companyId: message.companyId || null,
      channel: message.channel || 'email',
      direction: message.direction || 'inbound',
      fromEmail: message.fromEmail || null,
      fromName: message.fromName || null,
      toEmail: message.toEmail || null,
      subject: message.subject || null,
      content: message.content,
      preview: message.preview || null,
      category: message.category || null,
      aiScore: message.aiScore ?? null,
      sentiment: message.sentiment || null,
      urgency: message.urgency || null,
      isRead: message.isRead ?? false,
      isStarred: message.isStarred ?? false,
      isArchived: message.isArchived ?? false,
      threadId: message.threadId || null,
      metadata: message.metadata || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.inboxMessages.set(id, inboxMessage);
    return inboxMessage;
  }

  async updateInboxMessage(id: string, updates: Partial<InboxMessage>): Promise<InboxMessage | undefined> {
    const message = this.inboxMessages.get(id);
    if (!message) return undefined;
    const updated = { ...message, ...cleanPartial(updates) };
    this.inboxMessages.set(id, updated);
    return updated;
  }

  async markInboxMessageAsRead(id: string): Promise<InboxMessage | undefined> {
    return this.updateInboxMessage(id, { isRead: true });
  }

  async toggleInboxMessageStar(id: string): Promise<InboxMessage | undefined> {
    const message = await this.getInboxMessage(id);
    if (!message) return undefined;
    return this.updateInboxMessage(id, { isStarred: !message.isStarred });
  }

  async archiveInboxMessage(id: string): Promise<InboxMessage | undefined> {
    return this.updateInboxMessage(id, { isArchived: true });
  }

  // Shared Intel
  async getSharedIntel(id: string): Promise<SharedIntel | undefined> {
    return this.sharedIntel.get(id);
  }

  async getSharedIntelList(filters?: { category?: string; industry?: string; companySize?: string; tags?: string[]; limit?: number }): Promise<SharedIntel[]> {
    let intel = Array.from(this.sharedIntel.values());
    if (filters?.category) intel = intel.filter(i => i.category === filters.category);
    if (filters?.industry) intel = intel.filter(i => i.industry === filters.industry);
    if (filters?.limit) intel = intel.slice(0, filters.limit);
    return intel;
  }

  async createSharedIntel(intel: InsertSharedIntel): Promise<SharedIntel> {
    const id = randomUUID();
    const newIntel: SharedIntel = {
      id,
      category: intel.category,
      content: intel.content,
      effectiveness: intel.effectiveness || null,
      industry: intel.industry || null,
      companySize: intel.companySize || null,
      useCount: 0,
      successRate: intel.successRate || null,
      tags: intel.tags || null,
      contributorCount: 1,
      lastUpdated: new Date(),
      createdAt: new Date()
    };
    this.sharedIntel.set(id, newIntel);
    return newIntel;
  }

  async updateSharedIntel(id: string, updates: Partial<SharedIntel>): Promise<SharedIntel | undefined> {
    const intel = this.sharedIntel.get(id);
    if (!intel) return undefined;
    const updated = { ...intel, ...cleanPartial(updates), updatedAt: new Date() };
    this.sharedIntel.set(id, updated);
    return updated;
  }

  // Intel Contributions
  async getIntelContribution(id: string): Promise<IntelContribution | undefined> {
    return this.intelContributions.get(id);
  }

  async getIntelContributions(filters?: { intelId?: string; userId?: string; contributionType?: string; limit?: number }): Promise<IntelContribution[]> {
    let contributions = Array.from(this.intelContributions.values());
    if (filters?.intelId) contributions = contributions.filter(c => c.intelId === filters.intelId);
    if (filters?.userId) contributions = contributions.filter(c => c.userId === filters.userId);
    if (filters?.contributionType) contributions = contributions.filter(c => c.contributionType === filters.contributionType);
    if (filters?.limit) contributions = contributions.slice(0, filters.limit);
    return contributions;
  }

  async createIntelContribution(contribution: InsertIntelContribution): Promise<IntelContribution> {
    const id = randomUUID();
    const newContribution: IntelContribution = {
      id,
      intelId: contribution.intelId,
      userId: contribution.userId,
      contributionType: contribution.contributionType,
      performanceData: contribution.performanceData || null,
      timestamp: new Date()
    };
    this.intelContributions.set(id, newContribution);
    return newContribution;
  }

  // Intel Ratings
  async getIntelRating(id: string): Promise<IntelRating | undefined> {
    return this.intelRatings.get(id);
  }

  async getIntelRatings(filters?: { intelId?: string; userId?: string; minRating?: number; limit?: number }): Promise<IntelRating[]> {
    let ratings = Array.from(this.intelRatings.values());
    if (filters?.intelId) ratings = ratings.filter(r => r.intelId === filters.intelId);
    if (filters?.userId) ratings = ratings.filter(r => r.userId === filters.userId);
    if (filters?.limit) ratings = ratings.slice(0, filters.limit);
    return ratings;
  }

  async createIntelRating(rating: InsertIntelRating): Promise<IntelRating> {
    const id = randomUUID();
    const newRating: IntelRating = {
      id,
      intelId: rating.intelId,
      userId: rating.userId,
      rating: rating.rating,
      feedback: rating.feedback || null,
      usefulnessScore: rating.usefulnessScore ?? null,
      createdAt: new Date()
    };
    this.intelRatings.set(id, newRating);
    return newRating;
  }

  async updateIntelRating(id: string, updates: Partial<IntelRating>): Promise<IntelRating | undefined> {
    const rating = this.intelRatings.get(id);
    if (!rating) return undefined;
    const updated = { ...rating, ...cleanPartial(updates) };
    this.intelRatings.set(id, updated);
    return updated;
  }

  // Benchmark Data
  async getBenchmarkData(id: string): Promise<BenchmarkData | undefined> {
    return this.benchmarkDataMap.get(id);
  }

  async getBenchmarkDataList(filters?: { metric?: string; industry?: string; companySize?: string; channel?: string; limit?: number }): Promise<BenchmarkData[]> {
    let data = Array.from(this.benchmarkDataMap.values());
    if (filters?.metric) data = data.filter(d => d.metric === filters.metric);
    if (filters?.industry) data = data.filter(d => d.industry === filters.industry);
    if (filters?.limit) data = data.slice(0, filters.limit);
    return data;
  }

  async createBenchmarkData(benchmark: InsertBenchmarkData): Promise<BenchmarkData> {
    const id = randomUUID();
    const newBenchmark: BenchmarkData = {
      id,
      metric: benchmark.metric,
      industry: benchmark.industry || null,
      companySize: benchmark.companySize || null,
      channel: benchmark.channel || null,
      value: benchmark.value,
      sampleSize: benchmark.sampleSize,
      lastCalculated: new Date(),
      createdAt: new Date()
    };
    this.benchmarkDataMap.set(id, newBenchmark);
    return newBenchmark;
  }

  async updateBenchmarkData(id: string, updates: Partial<BenchmarkData>): Promise<BenchmarkData | undefined> {
    const data = this.benchmarkDataMap.get(id);
    if (!data) return undefined;
    const updated = { ...data, ...cleanPartial(updates) };
    this.benchmarkDataMap.set(id, updated);
    return updated;
  }

  // White Labels
  async getWhiteLabel(organizationId: string): Promise<WhiteLabel | undefined> {
    return Array.from(this.whiteLabels.values()).find(w => w.organizationId === organizationId);
  }

  async getWhiteLabels(): Promise<WhiteLabel[]> {
    return Array.from(this.whiteLabels.values());
  }

  async createWhiteLabel(whiteLabel: InsertWhiteLabel): Promise<WhiteLabel> {
    const id = randomUUID();
    const newWhiteLabel: WhiteLabel = {
      id,
      organizationId: whiteLabel.organizationId,
      brandName: whiteLabel.brandName,
      logoUrl: whiteLabel.logoUrl || null,
      primaryColor: whiteLabel.primaryColor || '#0066FF',
      secondaryColor: whiteLabel.secondaryColor || '#00D4FF',
      customDomain: whiteLabel.customDomain || null,
      customCSS: whiteLabel.customCSS || null,
      features: whiteLabel.features || {},
      isActive: whiteLabel.isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.whiteLabels.set(id, newWhiteLabel);
    return newWhiteLabel;
  }

  async updateWhiteLabel(organizationId: string, updates: Partial<WhiteLabel>): Promise<WhiteLabel | undefined> {
    const whiteLabel = await this.getWhiteLabel(organizationId);
    if (!whiteLabel) return undefined;
    const updated = { ...whiteLabel, ...cleanPartial(updates), updatedAt: new Date() };
    this.whiteLabels.set(whiteLabel.id, updated);
    return updated;
  }

  async deleteWhiteLabel(organizationId: string): Promise<boolean> {
    const whiteLabel = await this.getWhiteLabel(organizationId);
    if (!whiteLabel) return false;
    return this.whiteLabels.delete(whiteLabel.id);
  }

  // Enterprise Security
  async getEnterpriseSecurity(organizationId: string): Promise<EnterpriseSecurity | undefined> {
    return Array.from(this.enterpriseSecurity.values()).find(e => e.organizationId === organizationId);
  }

  async getEnterpriseSecuritySettings(): Promise<EnterpriseSecurity[]> {
    return Array.from(this.enterpriseSecurity.values());
  }

  async createEnterpriseSecurity(security: InsertEnterpriseSecurity): Promise<EnterpriseSecurity> {
    const id = randomUUID();
    const newSecurity: EnterpriseSecurity = {
      id,
      organizationId: security.organizationId,
      ssoEnabled: security.ssoEnabled ?? false,
      ssoProvider: security.ssoProvider || null,
      ssoConfig: security.ssoConfig || null,
      ipWhitelist: security.ipWhitelist || null,
      mfaRequired: security.mfaRequired ?? false,
      mfaMethod: security.mfaMethod || null,
      dataResidency: security.dataResidency || 'us',
      encryptionKey: security.encryptionKey || null,
      auditLogRetention: security.auditLogRetention ?? 90,
      complianceMode: security.complianceMode || null,
      passwordPolicy: security.passwordPolicy || null,
      sessionTimeout: security.sessionTimeout ?? 1440,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.enterpriseSecurity.set(id, newSecurity);
    return newSecurity;
  }

  async updateEnterpriseSecurity(organizationId: string, updates: Partial<EnterpriseSecurity>): Promise<EnterpriseSecurity | undefined> {
    const security = await this.getEnterpriseSecurity(organizationId);
    if (!security) return undefined;
    const updated = { ...security, ...cleanPartial(updates), updatedAt: new Date() };
    this.enterpriseSecurity.set(security.id, updated);
    return updated;
  }

  async deleteEnterpriseSecurity(organizationId: string): Promise<boolean> {
    const security = await this.getEnterpriseSecurity(organizationId);
    if (!security) return false;
    return this.enterpriseSecurity.delete(security.id);
  }

  // Audit Logs
  async getAuditLog(id: string): Promise<AuditLog | undefined> {
    return this.auditLogs.get(id);
  }

  async getAuditLogs(filters?: { organizationId?: string; userId?: string; resource?: string; action?: string; startDate?: Date; endDate?: Date; limit?: number }): Promise<AuditLog[]> {
    let logs = Array.from(this.auditLogs.values());
    if (filters?.organizationId) logs = logs.filter(l => l.organizationId === filters.organizationId);
    if (filters?.userId) logs = logs.filter(l => l.userId === filters.userId);
    if (filters?.resource) logs = logs.filter(l => l.resource === filters.resource);
    if (filters?.action) logs = logs.filter(l => l.action === filters.action);
    if (filters?.limit) logs = logs.slice(0, filters.limit);
    return logs;
  }

  async createAuditLog(auditLog: InsertAuditLog): Promise<AuditLog> {
    const id = randomUUID();
    const newLog: AuditLog = {
      id,
      userId: auditLog.userId || null,
      organizationId: auditLog.organizationId || null,
      action: auditLog.action,
      resource: auditLog.resource,
      resourceId: auditLog.resourceId || null,
      ipAddress: auditLog.ipAddress || null,
      userAgent: auditLog.userAgent || null,
      timestamp: new Date(),
      metadata: auditLog.metadata || null,
      severity: auditLog.severity || 'info',
      outcome: auditLog.outcome || 'success'
    };
    this.auditLogs.set(id, newLog);
    return newLog;
  }

  async deleteOldAuditLogs(retentionDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    let deleted = 0;
    const entries = Array.from(this.auditLogs.entries());
    for (const [id, log] of entries) {
      if (log.timestamp < cutoffDate) {
        this.auditLogs.delete(id);
        deleted++;
      }
    }
    return deleted;
  }

  // Access Controls
  async getAccessControl(id: string): Promise<AccessControl | undefined> {
    return this.accessControls.get(id);
  }

  async getAccessControls(organizationId: string): Promise<AccessControl[]> {
    return Array.from(this.accessControls.values()).filter(a => a.organizationId === organizationId);
  }

  async getAccessControlByRole(organizationId: string, roleName: string): Promise<AccessControl | undefined> {
    return Array.from(this.accessControls.values()).find(a => a.organizationId === organizationId && a.roleName === roleName);
  }

  async getUserAccessControls(organizationId: string, userId: string): Promise<AccessControl[]> {
    return Array.from(this.accessControls.values()).filter(a => a.organizationId === organizationId);
  }

  async createAccessControl(accessControl: InsertAccessControl): Promise<AccessControl> {
    const id = randomUUID();
    const newAccessControl: AccessControl = {
      id,
      organizationId: accessControl.organizationId,
      roleName: accessControl.roleName,
      description: accessControl.description || null,
      permissions: accessControl.permissions || [],
      userIds: accessControl.userIds || null,
      isSystemRole: accessControl.isSystemRole ?? false,
      priority: accessControl.priority ?? 0,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.accessControls.set(id, newAccessControl);
    return newAccessControl;
  }

  async updateAccessControl(id: string, updates: Partial<AccessControl>): Promise<AccessControl | undefined> {
    const accessControl = this.accessControls.get(id);
    if (!accessControl) return undefined;
    const updated = { ...accessControl, ...cleanPartial(updates), updatedAt: new Date() };
    this.accessControls.set(id, updated);
    return updated;
  }

  async deleteAccessControl(id: string): Promise<boolean> {
    return this.accessControls.delete(id);
  }

  // Content Templates
  async listTemplates(params?: { status?: string; personaId?: string; includeArchived?: boolean }): Promise<ContentTemplate[]> {
    let templates = Array.from(this.contentTemplates.values());
    if (params?.status) templates = templates.filter(t => t.status === params.status);
    if (params?.personaId) templates = templates.filter(t => t.personaId === params.personaId);
    if (!params?.includeArchived) templates = templates.filter(t => t.status !== 'archived');
    return templates;
  }

  async getTemplateWithRelations(id: string): Promise<{ template: ContentTemplate; versions: TemplateVersion[]; segments: AudienceSegment[]; metrics?: TemplateMetrics[] } | undefined> {
    const template = this.contentTemplates.get(id);
    if (!template) return undefined;
    const versions = Array.from(this.templateVersions.values()).filter(v => v.templateId === id);
    const segmentIds = this.templateSegmentAssociations.get(id) || new Set();
    const segments = Array.from(this.audienceSegments.values()).filter(s => segmentIds.has(s.id));
    const metrics = Array.from(this.templateMetrics.values()).filter(m => versions.some(v => v.id === m.templateVersionId));
    return { template, versions, segments, metrics };
  }

  async createTemplate(input: InsertContentTemplate & { segmentIds?: string[] }): Promise<ContentTemplate> {
    const id = randomUUID();
    const template: ContentTemplate = {
      id,
      name: input.name,
      description: input.description || null,
      contentType: input.contentType,
      status: input.status || 'draft',
      personaId: input.personaId || null,
      defaultTone: input.defaultTone || 'professional',
      tags: input.tags || [],
      createdBy: input.createdBy || null,
      currentVersionId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      archivedAt: null
    };
    this.contentTemplates.set(id, template);
    if (input.segmentIds && input.segmentIds.length > 0) {
      this.templateSegmentAssociations.set(id, new Set(input.segmentIds));
    }
    return template;
  }

  async updateTemplate(id: string, updates: Partial<ContentTemplate>): Promise<ContentTemplate | undefined> {
    const template = this.contentTemplates.get(id);
    if (!template) return undefined;
    const updated = { ...template, ...cleanPartial(updates), updatedAt: new Date() };
    this.contentTemplates.set(id, updated);
    return updated;
  }

  async archiveTemplate(id: string): Promise<boolean> {
    const template = this.contentTemplates.get(id);
    if (!template) return false;
    template.status = 'archived';
    template.updatedAt = new Date();
    this.contentTemplates.set(id, template);
    return true;
  }

  async attachSegments(templateId: string, segmentIds: string[]): Promise<void> {
    const existing = this.templateSegmentAssociations.get(templateId) || new Set();
    segmentIds.forEach(id => existing.add(id));
    this.templateSegmentAssociations.set(templateId, existing);
  }

  async detachSegment(templateId: string, segmentId: string): Promise<boolean> {
    const existing = this.templateSegmentAssociations.get(templateId);
    if (!existing) return false;
    return existing.delete(segmentId);
  }

  // Template Versions
  async createTemplateVersion(input: InsertTemplateVersion & { segmentSnapshotIds?: string[] }): Promise<TemplateVersion> {
    const id = randomUUID();
    const version: TemplateVersion = {
      id,
      templateId: input.templateId,
      versionNumber: input.versionNumber,
      subject: input.subject || null,
      body: input.body,
      content: input.content || null,
      tone: input.tone || null,
      lengthHint: input.lengthHint || null,
      authorId: input.authorId || null,
      source: input.source,
      aiModel: input.aiModel || null,
      personaSnapshot: input.personaSnapshot || null,
      audienceSnapshot: input.audienceSnapshot || null,
      promptContext: input.promptContext || null,
      createdAt: new Date(),
      publishedAt: null
    };
    this.templateVersions.set(id, version);
    return version;
  }

  async listTemplateVersions(templateId: string, opts?: { includeDrafts?: boolean }): Promise<TemplateVersion[]> {
    let versions = Array.from(this.templateVersions.values()).filter(v => v.templateId === templateId);
    if (!opts?.includeDrafts) versions = versions.filter(v => v.publishedAt !== null);
    return versions.sort((a, b) => b.versionNumber - a.versionNumber);
  }

  async getTemplateVersion(versionId: string): Promise<TemplateVersion | undefined> {
    return this.templateVersions.get(versionId);
  }

  async publishTemplateVersion(templateId: string, versionId: string): Promise<TemplateVersion | undefined> {
    const version = this.templateVersions.get(versionId);
    if (!version || version.templateId !== templateId) return undefined;
    version.publishedAt = new Date();
    this.templateVersions.set(versionId, version);
    return version;
  }

  // Audience Segments
  async listAudienceSegments(filter?: { createdBy?: string; q?: string; includeGlobal?: boolean }): Promise<AudienceSegment[]> {
    let segments = Array.from(this.audienceSegments.values());
    if (filter?.createdBy) segments = segments.filter(s => s.createdBy === filter.createdBy);
    if (filter?.q) segments = segments.filter(s => s.name.toLowerCase().includes(filter.q!.toLowerCase()));
    return segments;
  }

  async getAudienceSegment(id: string): Promise<AudienceSegment | undefined> {
    return this.audienceSegments.get(id);
  }

  async createAudienceSegment(input: InsertAudienceSegment): Promise<AudienceSegment> {
    const id = randomUUID();
    const segment: AudienceSegment = {
      id,
      name: input.name,
      description: input.description || null,
      industries: input.industries || [],
      titles: input.titles || [],
      companySizes: input.companySizes || [],
      locations: input.locations || [],
      rules: input.rules || null,
      createdBy: input.createdBy || null,
      isGlobal: input.isGlobal ?? false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.audienceSegments.set(id, segment);
    return segment;
  }

  async updateAudienceSegment(id: string, updates: Partial<AudienceSegment>): Promise<AudienceSegment | undefined> {
    const segment = this.audienceSegments.get(id);
    if (!segment) return undefined;
    const updated = { ...segment, ...cleanPartial(updates), updatedAt: new Date() };
    this.audienceSegments.set(id, updated);
    return updated;
  }

  async deleteAudienceSegment(id: string): Promise<boolean> {
    return this.audienceSegments.delete(id);
  }

  // Template Metrics
  async recordTemplateMetricEvent(event: { templateVersionId: string; channel: string; eventType: string; value?: number; occurredAt?: Date }): Promise<void> {
    const version = this.templateVersions.get(event.templateVersionId);
    if (!version) return;
    const today = new Date().toISOString().split('T')[0];
    const key = `${event.templateVersionId}-${event.channel}-${today}`;
    let metrics = this.templateMetrics.get(key);
    if (!metrics) {
      metrics = {
        id: randomUUID(),
        templateVersionId: event.templateVersionId,
        channel: event.channel,
        windowStart: today,
        windowEnd: today,
        sends: 0,
        deliveries: 0,
        opens: 0,
        clicks: 0,
        replies: 0,
        meetings: 0,
        revenue: null,
        lastUpdated: new Date()
      };
    }
    if (event.eventType === 'send') metrics.sends++;
    else if (event.eventType === 'delivery') metrics.deliveries++;
    else if (event.eventType === 'open') metrics.opens++;
    else if (event.eventType === 'click') metrics.clicks++;
    else if (event.eventType === 'reply') metrics.replies++;
    else if (event.eventType === 'meeting') metrics.meetings++;
    metrics.lastUpdated = new Date();
    this.templateMetrics.set(key, metrics);
  }

  async upsertTemplateMetricsWindow(metrics: InsertTemplateMetrics): Promise<TemplateMetrics> {
    const key = `${metrics.templateVersionId}-${metrics.channel}-${metrics.windowStart}`;
    const existing = this.templateMetrics.get(key);
    const newMetrics: TemplateMetrics = {
      id: existing?.id || randomUUID(),
      templateVersionId: metrics.templateVersionId,
      channel: metrics.channel,
      windowStart: metrics.windowStart,
      windowEnd: metrics.windowEnd,
      sends: metrics.sends ?? existing?.sends ?? 0,
      deliveries: metrics.deliveries ?? existing?.deliveries ?? 0,
      opens: metrics.opens ?? existing?.opens ?? 0,
      clicks: metrics.clicks ?? existing?.clicks ?? 0,
      replies: metrics.replies ?? existing?.replies ?? 0,
      meetings: metrics.meetings ?? existing?.meetings ?? 0,
      revenue: metrics.revenue ?? existing?.revenue ?? null,
      lastUpdated: new Date()
    };
    this.templateMetrics.set(key, newMetrics);
    return newMetrics;
  }

  async getTemplateMetrics(templateId: string, startDate?: string, endDate?: string): Promise<TemplateMetrics[]> {
    const versions = Array.from(this.templateVersions.values()).filter(v => v.templateId === templateId);
    const versionIds = new Set(versions.map(v => v.id));
    let metrics = Array.from(this.templateMetrics.values()).filter(m => versionIds.has(m.templateVersionId));
    if (startDate) {
      metrics = metrics.filter(m => m.windowStart >= startDate);
    }
    if (endDate) {
      metrics = metrics.filter(m => m.windowEnd <= endDate);
    }
    return metrics;
  }
}

export class DbStorage implements IStorage {
  // User methods - Required for Replit Auth
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const result = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return result[0];
  }

  // Company methods
  async getCompany(id: string): Promise<Company | undefined> {
    const result = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
    return result[0];
  }

  async getCompanies(filters?: { userId?: string; limit?: number }): Promise<Company[]> {
    let query = db.select().from(companies);
    
    if (filters?.userId) {
      query = query.where(eq(companies.userId, filters.userId)) as any;
    }
    
    return await query.limit(filters?.limit || 50);
  }

  async getCompaniesByDomain(domain: string): Promise<Company[]> {
    return await db.select().from(companies).where(eq(companies.domain, domain));
  }

  async createCompany(insertCompany: InsertCompany): Promise<Company> {
    const result = await db.insert(companies).values(insertCompany).returning();
    return result[0];
  }

  async updateCompany(id: string, updates: Partial<Company>): Promise<Company | undefined> {
    const cleaned = cleanPartial(updates);
    if (Object.keys(cleaned).length === 0) return this.getCompany(id);
    const result = await db.update(companies).set(cleaned).where(eq(companies.id, id)).returning();
    return result[0];
  }

  async deleteCompany(id: string): Promise<boolean> {
    const result = await db.delete(companies).where(eq(companies.id, id)).returning();
    return result.length > 0;
  }

  // Contact methods
  async getContact(id: string): Promise<Contact | undefined> {
    const result = await db.select().from(contacts).where(eq(contacts.id, id)).limit(1);
    return result[0];
  }

  async getContacts(filters?: { userId?: string; companyId?: string; limit?: number }): Promise<Contact[]> {
    let query = db.select().from(contacts);
    const conditions = [];
    
    if (filters?.userId) {
      conditions.push(eq(contacts.userId, filters.userId));
    }
    
    if (filters?.companyId) {
      conditions.push(eq(contacts.companyId, filters.companyId));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return await query.limit(filters?.limit || 50);
  }

  async createContact(insertContact: InsertContact): Promise<Contact> {
    const result = await db.insert(contacts).values(insertContact).returning();
    return result[0];
  }

  async updateContact(id: string, updates: Partial<Contact>): Promise<Contact | undefined> {
    const cleaned = cleanPartial(updates);
    if (Object.keys(cleaned).length === 0) return this.getContact(id);
    const result = await db.update(contacts).set(cleaned).where(eq(contacts.id, id)).returning();
    return result[0];
  }

  async deleteContact(id: string): Promise<boolean> {
    const result = await db.delete(contacts).where(eq(contacts.id, id)).returning();
    return result.length > 0;
  }

  // Visitor session methods
  async getVisitorSession(id: string): Promise<VisitorSession | undefined> {
    const result = await db.select().from(visitorSessions).where(eq(visitorSessions.id, id)).limit(1);
    return result[0];
  }

  async getActiveVisitorSessions(): Promise<VisitorSession[]> {
    return await db.select().from(visitorSessions).where(eq(visitorSessions.isActive, true));
  }

  async getVisitorSessionsByCompany(companyId: string): Promise<VisitorSession[]> {
    return await db.select().from(visitorSessions).where(eq(visitorSessions.companyId, companyId));
  }

  async createVisitorSession(insertSession: InsertVisitorSession): Promise<VisitorSession> {
    const result = await db.insert(visitorSessions).values(insertSession).returning();
    return result[0];
  }

  async updateVisitorSession(id: string, updates: Partial<VisitorSession>): Promise<VisitorSession | undefined> {
    const cleaned = cleanPartial(updates);
    if (Object.keys(cleaned).length === 0) return this.getVisitorSession(id);
    const result = await db.update(visitorSessions).set(cleaned).where(eq(visitorSessions.id, id)).returning();
    return result[0];
  }

  // Sequence methods
  async getSequence(id: string): Promise<Sequence | undefined> {
    const result = await db.select().from(sequences).where(eq(sequences.id, id)).limit(1);
    return result[0];
  }

  async getSequences(filters?: { createdBy?: string; status?: string }): Promise<Sequence[]> {
    let query = db.select().from(sequences);
    const conditions = [];
    
    if (filters?.createdBy) {
      conditions.push(eq(sequences.createdBy, filters.createdBy));
    }
    
    if (filters?.status) {
      conditions.push(eq(sequences.status, filters.status));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return await query;
  }

  async createSequence(insertSequence: InsertSequence): Promise<Sequence> {
    const result = await db.insert(sequences).values(insertSequence).returning();
    return result[0];
  }

  async updateSequence(id: string, updates: Partial<Sequence>): Promise<Sequence | undefined> {
    const cleaned = cleanPartial(updates);
    if (Object.keys(cleaned).length === 0) return this.getSequence(id);
    const result = await db.update(sequences).set(cleaned).where(eq(sequences.id, id)).returning();
    return result[0];
  }

  async deleteSequence(id: string): Promise<boolean> {
    const result = await db.delete(sequences).where(eq(sequences.id, id)).returning();
    return result.length > 0;
  }

  // Email methods
  async getEmail(id: string): Promise<Email | undefined> {
    const result = await db.select().from(emails).where(eq(emails.id, id)).limit(1);
    return result[0];
  }

  async getEmails(filters?: { contactId?: string; status?: string; limit?: number }): Promise<Email[]> {
    let query = db.select().from(emails);
    const conditions = [];
    
    if (filters?.contactId) {
      conditions.push(eq(emails.contactId, filters.contactId));
    }
    
    if (filters?.status) {
      conditions.push(eq(emails.status, filters.status));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return await query.limit(filters?.limit || 50);
  }

  async createEmail(insertEmail: InsertEmail): Promise<Email> {
    const result = await db.insert(emails).values(insertEmail).returning();
    return result[0];
  }

  async updateEmail(id: string, updates: Partial<Email>): Promise<Email | undefined> {
    const cleaned = cleanPartial(updates);
    if (Object.keys(cleaned).length === 0) return this.getEmail(id);
    const result = await db.update(emails).set(cleaned).where(eq(emails.id, id)).returning();
    return result[0];
  }

  // Insight methods
  async getInsight(id: string): Promise<Insight | undefined> {
    const result = await db.select().from(insights).where(eq(insights.id, id)).limit(1);
    return result[0];
  }

  async getInsights(filters?: { companyId?: string; type?: string; limit?: number }): Promise<Insight[]> {
    // Seed sample insights if none exist
    await this.ensureSampleInsights();
    
    let query = db.select().from(insights);
    const conditions = [];
    
    if (filters?.companyId) {
      conditions.push(eq(insights.companyId, filters.companyId));
    }
    
    if (filters?.type) {
      conditions.push(eq(insights.type, filters.type));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return await query.limit(filters?.limit || 20);
  }

  async ensureSampleInsights(): Promise<void> {
    // Check if insights already exist
    const existing = await db.select().from(insights).limit(1);
    if (existing.length > 0) return;

    // Get or create sample companies first
    const companiesExist = await db.select().from(companies).limit(1);
    if (companiesExist.length === 0) {
      await this.ensureSampleCompanies();
    }

    const sampleCompanies = await db.select().from(companies).limit(5);
    if (sampleCompanies.length === 0) return;

    const insightTypes = ['funding', 'hiring', 'product_launch', 'expansion', 'partnership', 'leadership_change'];
    const sampleInsights = [];

    for (const company of sampleCompanies) {
      // Generate 2-3 insights per company
      const numInsights = Math.floor(Math.random() * 2) + 2;
      for (let i = 0; i < numInsights; i++) {
        const type = insightTypes[Math.floor(Math.random() * insightTypes.length)];
        const insight = {
          companyId: company.id,
          type,
          title: this.getInsightTitle(type, company.name),
          description: this.getInsightDescription(type, company.name),
          importance: ['high', 'medium', 'low'][Math.floor(Math.random() * 3)] as 'high' | 'medium' | 'low',
          source: ['news', 'press_release', 'social_media', 'company_website'][Math.floor(Math.random() * 4)],
          sourceUrl: `https://example.com/insight/${company.id}/${type}`,
          detectedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Random date within last 30 days
          metadata: {
            confidence: Math.floor(Math.random() * 20) + 80, // 80-100
            keywords: [type, company.industry || 'tech', 'opportunity']
          }
        };
        sampleInsights.push(insight);
      }
    }

    for (const insight of sampleInsights) {
      await db.insert(insights).values(insight as any).onConflictDoNothing();
    }
  }

  private getInsightTitle(type: string, companyName: string): string {
    const titles: Record<string, string> = {
      funding: `${companyName} Raises New Funding Round`,
      hiring: `${companyName} Expanding Team - Multiple Openings`,
      product_launch: `${companyName} Launches New Product Line`,
      expansion: `${companyName} Expands to New Markets`,
      partnership: `${companyName} Announces Strategic Partnership`,
      leadership_change: `New Leadership at ${companyName}`
    };
    return titles[type] || `${companyName} Business Update`;
  }

  private getInsightDescription(type: string, companyName: string): string {
    const descriptions: Record<string, string> = {
      funding: `${companyName} has secured a new round of funding, signaling growth and potential need for new solutions to scale operations.`,
      hiring: `${companyName} is actively hiring across multiple departments, indicating expansion and potential pain points around scaling.`,
      product_launch: `${companyName} recently launched a new product offering, presenting opportunities for complementary solutions.`,
      expansion: `${companyName} is expanding operations to new geographic markets, creating needs for localized support and infrastructure.`,
      partnership: `${companyName} has formed a strategic partnership, potentially changing their technology requirements.`,
      leadership_change: `${companyName} has new leadership in place, often a catalyst for evaluating new vendors and solutions.`
    };
    return descriptions[type] || `Important business development at ${companyName} creating potential sales opportunity.`;
  }

  async ensureSampleCompanies(): Promise<void> {
    const sampleCompanies = [
      {
        name: 'TechCorp Solutions',
        domain: 'techcorp.com',
        industry: 'SaaS',
        employeeCount: 250,
        description: 'Leading provider of enterprise software solutions',
        website: 'https://techcorp.com',
        linkedin: 'https://linkedin.com/company/techcorp'
      },
      {
        name: 'DataFlow Analytics',
        domain: 'dataflow.io',
        industry: 'Data Analytics',
        employeeCount: 150,
        description: 'Advanced data analytics and business intelligence platform',
        website: 'https://dataflow.io',
        linkedin: 'https://linkedin.com/company/dataflow'
      },
      {
        name: 'CloudScale Systems',
        domain: 'cloudscale.com',
        industry: 'Cloud Infrastructure',
        employeeCount: 500,
        description: 'Cloud infrastructure and DevOps automation tools',
        website: 'https://cloudscale.com',
        linkedin: 'https://linkedin.com/company/cloudscale'
      },
      {
        name: 'SecureNet Pro',
        domain: 'securenet.pro',
        industry: 'Cybersecurity',
        employeeCount: 300,
        description: 'Enterprise cybersecurity and threat detection platform',
        website: 'https://securenet.pro',
        linkedin: 'https://linkedin.com/company/securenet'
      },
      {
        name: 'AI Innovations',
        domain: 'ai-innovations.com',
        industry: 'Artificial Intelligence',
        employeeCount: 100,
        description: 'AI-powered automation and machine learning solutions',
        website: 'https://ai-innovations.com',
        linkedin: 'https://linkedin.com/company/ai-innovations'
      }
    ];

    for (const company of sampleCompanies) {
      await db.insert(companies).values(company as any).onConflictDoNothing();
    }
  }

  async createInsight(insertInsight: InsertInsight): Promise<Insight> {
    const result = await db.insert(insights).values(insertInsight).returning();
    return result[0];
  }

  // Persona methods
  async getPersona(id: string): Promise<Persona | undefined> {
    const result = await db.select().from(personas).where(eq(personas.id, id)).limit(1);
    return result[0];
  }

  async getPersonas(createdBy?: string): Promise<Persona[]> {
    let query = db.select().from(personas);
    
    if (createdBy) {
      query = query.where(eq(personas.createdBy, createdBy)) as any;
    }
    
    return await query;
  }

  async createPersona(insertPersona: InsertPersona): Promise<Persona> {
    const result = await db.insert(personas).values(insertPersona).returning();
    return result[0];
  }

  async updatePersona(id: string, updates: Partial<Persona>): Promise<Persona | undefined> {
    const cleaned = cleanPartial(updates);
    if (Object.keys(cleaned).length === 0) return this.getPersona(id);
    const result = await db.update(personas).set(cleaned).where(eq(personas.id, id)).returning();
    return result[0];
  }
  
  async deletePersona(id: string): Promise<boolean> {
    const result = await db.delete(personas).where(eq(personas.id, id)).returning();
    return result.length > 0;
  }

  // Task methods
  async getTask(id: string): Promise<Task | undefined> {
    const result = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
    return result[0];
  }

  async getTasks(filters?: { assignedTo?: string; status?: string; priority?: string }): Promise<Task[]> {
    let query = db.select().from(tasks);
    const conditions = [];
    
    if (filters?.assignedTo) {
      conditions.push(eq(tasks.assignedTo, filters.assignedTo));
    }
    
    if (filters?.status) {
      conditions.push(eq(tasks.status, filters.status));
    }
    
    if (filters?.priority) {
      conditions.push(eq(tasks.priority, filters.priority));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }
    
    return await query;
  }

  async createTask(insertTask: InsertTask): Promise<Task> {
    const result = await db.insert(tasks).values(insertTask).returning();
    return result[0];
  }

  async updateTask(id: string, updates: Partial<Task>): Promise<Task | undefined> {
    const cleaned = cleanPartial(updates);
    if (Object.keys(cleaned).length === 0) return this.getTask(id);
    const result = await db.update(tasks).set(cleaned).where(eq(tasks.id, id)).returning();
    return result[0];
  }

  // Phone Call methods
  async getPhoneCall(id: string): Promise<PhoneCall | undefined> {
    const result = await db.select().from(phoneCalls).where(eq(phoneCalls.id, id)).limit(1);
    return result[0];
  }

  async getPhoneCalls(filters?: { contactId?: string; userId?: string; status?: string }): Promise<PhoneCall[]> {
    let query = db.select().from(phoneCalls);
    
    const conditions: any[] = [];
    if (filters?.contactId) conditions.push(eq(phoneCalls.contactId, filters.contactId));
    if (filters?.userId) conditions.push(eq(phoneCalls.userId, filters.userId));
    if (filters?.status) conditions.push(eq(phoneCalls.status, filters.status));
    
    if (conditions.length > 0) {
      return await query.where(and(...conditions));
    }
    
    return await query;
  }

  async createPhoneCall(call: InsertPhoneCall): Promise<PhoneCall> {
    const result = await db.insert(phoneCalls).values(call).returning();
    return result[0];
  }

  async updatePhoneCall(id: string, updates: Partial<PhoneCall>): Promise<PhoneCall | undefined> {
    const cleaned = cleanPartial(updates);
    if (Object.keys(cleaned).length === 0) return this.getPhoneCall(id);
    const result = await db.update(phoneCalls).set(cleaned).where(eq(phoneCalls.id, id)).returning();
    return result[0];
  }

  // Call Script methods
  async getCallScript(id: string): Promise<CallScript | undefined> {
    const result = await db.select().from(callScripts).where(eq(callScripts.id, id)).limit(1);
    return result[0];
  }

  async getCallScripts(filters?: { type?: string; personaId?: string }): Promise<CallScript[]> {
    let query = db.select().from(callScripts);
    
    const conditions: any[] = [];
    if (filters?.type) conditions.push(eq(callScripts.type, filters.type));
    if (filters?.personaId) conditions.push(eq(callScripts.personaId, filters.personaId));
    
    if (conditions.length > 0) {
      return await query.where(and(...conditions));
    }
    
    return await query;
  }

  async createCallScript(script: InsertCallScript): Promise<CallScript> {
    const result = await db.insert(callScripts).values(script).returning();
    return result[0];
  }

  async updateCallScript(id: string, updates: Partial<CallScript>): Promise<CallScript | undefined> {
    const cleaned = cleanPartial(updates);
    if (Object.keys(cleaned).length === 0) return this.getCallScript(id);
    const result = await db.update(callScripts).set(cleaned).where(eq(callScripts.id, id)).returning();
    return result[0];
  }

  // Voicemail methods
  async getVoicemail(id: string): Promise<Voicemail | undefined> {
    const result = await db.select().from(voicemails).where(eq(voicemails.id, id)).limit(1);
    return result[0];
  }

  async getVoicemails(filters?: { contactId?: string; isListened?: boolean }): Promise<Voicemail[]> {
    let query = db.select().from(voicemails);
    
    const conditions: any[] = [];
    if (filters?.contactId) conditions.push(eq(voicemails.contactId, filters.contactId));
    if (filters?.isListened !== undefined) conditions.push(eq(voicemails.isListened, filters.isListened));
    
    if (conditions.length > 0) {
      return await query.where(and(...conditions));
    }
    
    return await query;
  }

  async createVoicemail(voicemail: InsertVoicemail): Promise<Voicemail> {
    const result = await db.insert(voicemails).values(voicemail).returning();
    return result[0];
  }

  async updateVoicemail(id: string, updates: Partial<Voicemail>): Promise<Voicemail | undefined> {
    const cleaned = cleanPartial(updates);
    if (Object.keys(cleaned).length === 0) return this.getVoicemail(id);
    const result = await db.update(voicemails).set(cleaned).where(eq(voicemails.id, id)).returning();
    return result[0];
  }

  // AI Agent methods
  async getAiAgent(id: string): Promise<AiAgent | undefined> {
    const result = await db.select().from(aiAgents).where(eq(aiAgents.id, id)).limit(1);
    return result[0];
  }

  async getAiAgents(filters?: { status?: string; type?: string; createdBy?: string }): Promise<AiAgent[]> {
    let query = db.select().from(aiAgents);
    
    const conditions: any[] = [];
    if (filters?.status) conditions.push(eq(aiAgents.status, filters.status));
    if (filters?.type) conditions.push(eq(aiAgents.type, filters.type));
    if (filters?.createdBy) conditions.push(eq(aiAgents.createdBy, filters.createdBy));
    
    if (conditions.length > 0) {
      return await query.where(and(...conditions));
    }
    
    return await query;
  }

  async createAiAgent(agent: InsertAiAgent): Promise<AiAgent> {
    const result = await db.insert(aiAgents).values(agent).returning();
    return result[0];
  }

  async updateAiAgent(id: string, updates: Partial<AiAgent>): Promise<AiAgent | undefined> {
    const cleaned = cleanPartial(updates);
    if (Object.keys(cleaned).length === 0) return this.getAiAgent(id);
    const result = await db.update(aiAgents).set(cleaned).where(eq(aiAgents.id, id)).returning();
    return result[0];
  }

  async deleteAiAgent(id: string): Promise<boolean> {
    const result = await db.delete(aiAgents).where(eq(aiAgents.id, id)).returning();
    return result.length > 0;
  }

  // Agent Execution methods
  async getAgentExecution(id: string): Promise<AgentExecution | undefined> {
    const result = await db.select().from(agentExecutions).where(eq(agentExecutions.id, id)).limit(1);
    return result[0];
  }

  async getAgentExecutions(filters?: { agentId?: string; status?: string; taskType?: string }): Promise<AgentExecution[]> {
    let query = db.select().from(agentExecutions);
    
    const conditions: any[] = [];
    if (filters?.agentId) conditions.push(eq(agentExecutions.agentId, filters.agentId));
    if (filters?.status) conditions.push(eq(agentExecutions.status, filters.status));
    if (filters?.taskType) conditions.push(eq(agentExecutions.taskType, filters.taskType));
    
    if (conditions.length > 0) {
      return await query.where(and(...conditions));
    }
    
    return await query;
  }

  async createAgentExecution(execution: InsertAgentExecution): Promise<AgentExecution> {
    const result = await db.insert(agentExecutions).values(execution).returning();
    return result[0];
  }

  async updateAgentExecution(id: string, updates: Partial<AgentExecution>): Promise<AgentExecution | undefined> {
    const cleaned = cleanPartial(updates);
    if (Object.keys(cleaned).length === 0) return this.getAgentExecution(id);
    const result = await db.update(agentExecutions).set(cleaned).where(eq(agentExecutions.id, id)).returning();
    return result[0];
  }

  // Agent Metrics methods
  async getAgentMetrics(agentId: string, date?: string): Promise<AgentMetric | undefined> {
    if (date) {
      const results = await db.select().from(agentMetrics)
        .where(and(
          eq(agentMetrics.agentId, agentId),
          eq(agentMetrics.date, date)
        ))
        .limit(1);
      return results[0];
    }
    
    // Get most recent metric if no date specified
    const results = await db.select().from(agentMetrics)
      .where(eq(agentMetrics.agentId, agentId))
      .limit(1);
    return results[0];
  }

  async getAgentMetricsRange(agentId: string, startDate: string, endDate: string): Promise<AgentMetric[]> {
    return await db.select()
      .from(agentMetrics)
      .where(and(
        eq(agentMetrics.agentId, agentId),
        // Date range comparison would need proper SQL operators
        // For now, returning all metrics for the agent
        // In production, would use: gte(agentMetrics.date, startDate), lte(agentMetrics.date, endDate)
      ));
  }

  async createAgentMetric(metric: InsertAgentMetric): Promise<AgentMetric> {
    const result = await db.insert(agentMetrics).values(metric).returning();
    return result[0];
  }

  async updateAgentMetric(id: string, updates: Partial<AgentMetric>): Promise<AgentMetric | undefined> {
    const cleaned = cleanPartial(updates);
    if (Object.keys(cleaned).length === 0) {
      const result = await db.select().from(agentMetrics).where(eq(agentMetrics.id, id)).limit(1);
      return result[0];
    }
    const result = await db.update(agentMetrics).set(cleaned).where(eq(agentMetrics.id, id)).returning();
    return result[0];
  }

  // Onboarding methods
  async getOnboardingProfile(userId: string): Promise<OnboardingProfile | undefined> {
    const result = await db.select().from(onboardingProfiles).where(eq(onboardingProfiles.userId, userId)).limit(1);
    return result[0];
  }

  async createOnboardingProfile(profile: InsertOnboardingProfile): Promise<OnboardingProfile> {
    const result = await db.insert(onboardingProfiles).values(profile).returning();
    return result[0];
  }

  async updateOnboardingProfile(userId: string, updates: Partial<OnboardingProfile>): Promise<OnboardingProfile | undefined> {
    const cleaned = cleanPartial(updates);
    if (Object.keys(cleaned).length === 0) return this.getOnboardingProfile(userId);
    const result = await db.update(onboardingProfiles).set(cleaned).where(eq(onboardingProfiles.userId, userId)).returning();
    return result[0];
  }
  
  // Platform Config methods
  async getPlatformConfig(userId: string): Promise<PlatformConfig | undefined> {
    const result = await db.select().from(platformConfigs).where(eq(platformConfigs.userId, userId)).limit(1);
    return result[0];
  }

  async createPlatformConfig(config: InsertPlatformConfig): Promise<PlatformConfig> {
    const result = await db.insert(platformConfigs).values(config).returning();
    return result[0];
  }

  async updatePlatformConfig(userId: string, updates: Partial<PlatformConfig>): Promise<PlatformConfig | undefined> {
    const cleaned = cleanPartial(updates);
    if (Object.keys(cleaned).length === 0) return this.getPlatformConfig(userId);
    const result = await db.update(platformConfigs).set(cleaned).where(eq(platformConfigs.userId, userId)).returning();
    return result[0];
  }
  
  // Workflow Trigger methods
  async getWorkflowTrigger(id: string): Promise<WorkflowTrigger | undefined> {
    const result = await db.select().from(workflowTriggers).where(eq(workflowTriggers.id, id)).limit(1);
    return result[0];
  }

  async getWorkflowTriggers(filters?: { isActive?: boolean; triggerType?: string }): Promise<WorkflowTrigger[]> {
    let query = db.select().from(workflowTriggers);
    
    const conditions: any[] = [];
    if (filters?.isActive !== undefined) conditions.push(eq(workflowTriggers.isActive, filters.isActive));
    if (filters?.triggerType) conditions.push(eq(workflowTriggers.triggerType, filters.triggerType));
    
    if (conditions.length > 0) {
      return await query.where(and(...conditions));
    }
    
    return await query;
  }

  async createWorkflowTrigger(trigger: InsertWorkflowTrigger): Promise<WorkflowTrigger> {
    const result = await db.insert(workflowTriggers).values(trigger).returning();
    return result[0];
  }

  async updateWorkflowTrigger(id: string, updates: Partial<WorkflowTrigger>): Promise<WorkflowTrigger | undefined> {
    const cleaned = cleanPartial(updates);
    if (Object.keys(cleaned).length === 0) return this.getWorkflowTrigger(id);
    const result = await db.update(workflowTriggers).set(cleaned).where(eq(workflowTriggers.id, id)).returning();
    return result[0];
  }

  async deleteWorkflowTrigger(id: string): Promise<boolean> {
    const result = await db.delete(workflowTriggers).where(eq(workflowTriggers.id, id)).returning();
    return result.length > 0;
  }
  
  // Playbook methods  
  async getPlaybook(id: string): Promise<Playbook | undefined> {
    const result = await db.select().from(playbooks).where(eq(playbooks.id, id)).limit(1);
    return result[0];
  }

  async getPlaybooks(filters?: { industry?: string; isTemplate?: boolean; createdBy?: string }): Promise<Playbook[]> {
    // Seed template playbooks if none exist
    if (filters?.isTemplate === true) {
      await this.ensureTemplatePlaybooks();
    }
    
    let query = db.select().from(playbooks);
    
    const conditions: any[] = [];
    if (filters?.industry) conditions.push(eq(playbooks.industry, filters.industry));
    if (filters?.isTemplate !== undefined) conditions.push(eq(playbooks.isTemplate, filters.isTemplate));
    if (filters?.createdBy) conditions.push(eq(playbooks.createdBy, filters.createdBy));
    
    if (conditions.length > 0) {
      return await query.where(and(...conditions));
    }
    
    return await query;
  }

  async ensureTemplatePlaybooks(): Promise<void> {
    // Check if template playbooks already exist
    const existing = await db.select().from(playbooks).where(eq(playbooks.isTemplate, true)).limit(1);
    if (existing.length > 0) return;

    // Create template playbooks
    const templates = [
      {
        name: "SaaS Sales Acceleration",
        description: "Complete outreach playbook for B2B SaaS companies targeting mid-market",
        industry: "SaaS",
        targetICP: "VP Sales, CRO at 50-500 employee companies",
        sequences: [
          { name: "Initial Outreach", channels: ["email", "linkedin"], duration: "14 days", steps: 5 },
          { name: "Follow-up Nurture", channels: ["email"], duration: "30 days", steps: 3 }
        ],
        emailTemplates: [
          { subject: "Quick question about [Company]'s sales process", type: "initial" },
          { subject: "Following up - sales efficiency", type: "followup" }
        ],
        bestPractices: ["Personalize first line", "Reference recent company news", "Keep emails under 150 words"],
        expectedResults: { replyRate: 15, meetingRate: 5 },
        isTemplate: true,
        createdBy: "system"
      },
      {
        name: "Enterprise Account Penetration",
        description: "Multi-threaded approach for enterprise accounts with long sales cycles",
        industry: "Enterprise",
        targetICP: "Director/VP at Fortune 500 companies",
        sequences: [
          { name: "Executive Outreach", channels: ["email", "phone"], duration: "45 days", steps: 7 },
          { name: "Champion Building", channels: ["email", "linkedin"], duration: "60 days", steps: 10 }
        ],
        emailTemplates: [
          { subject: "Strategic initiative alignment", type: "executive" },
          { subject: "Quick win opportunity for Q[X]", type: "champion" }
        ],
        bestPractices: ["Multi-thread across departments", "Lead with ROI", "Leverage mutual connections"],
        expectedResults: { replyRate: 8, meetingRate: 3 },
        isTemplate: true,
        createdBy: "system"
      },
      {
        name: "Startup Fast Track",
        description: "Rapid outreach for startups and fast-growing companies",
        industry: "Startup",
        targetICP: "Founders, CEO at seed to Series B startups",
        sequences: [
          { name: "Founder Direct", channels: ["email", "linkedin"], duration: "7 days", steps: 3 },
          { name: "Growth Team", channels: ["email"], duration: "14 days", steps: 4 }
        ],
        emailTemplates: [
          { subject: "Congrats on [recent milestone]", type: "initial" },
          { subject: "How [competitor] achieved [result]", type: "case_study" }
        ],
        bestPractices: ["Reference recent funding", "Keep it informal", "Focus on growth metrics"],
        expectedResults: { replyRate: 20, meetingRate: 8 },
        isTemplate: true,
        createdBy: "system"
      }
    ];

    for (const template of templates) {
      await db.insert(playbooks).values(template as any).onConflictDoNothing();
    }
  }

  async createPlaybook(playbook: InsertPlaybook): Promise<Playbook> {
    const result = await db.insert(playbooks).values(playbook as any).returning();
    return result[0];
  }

  async updatePlaybook(id: string, updates: Partial<Playbook>): Promise<Playbook | undefined> {
    const cleaned = cleanPartial(updates);
    if (Object.keys(cleaned).length === 0) return this.getPlaybook(id);
    const result = await db.update(playbooks).set(cleaned).where(eq(playbooks.id, id)).returning();
    return result[0];
  }

  // Autopilot Campaign methods
  async getAutopilotCampaign(id: string): Promise<AutopilotCampaign | undefined> {
    const result = await db.select().from(autopilotCampaigns).where(eq(autopilotCampaigns.id, id)).limit(1);
    return result[0];
  }

  async getAutopilotCampaigns(filters?: { status?: string; createdBy?: string }): Promise<AutopilotCampaign[]> {
    let query = db.select().from(autopilotCampaigns);
    
    const conditions: any[] = [];
    if (filters?.status) conditions.push(eq(autopilotCampaigns.status, filters.status));
    if (filters?.createdBy) conditions.push(eq(autopilotCampaigns.createdBy, filters.createdBy));
    
    if (conditions.length > 0) {
      return await query.where(and(...conditions));
    }
    
    return await query;
  }

  async createAutopilotCampaign(campaign: InsertAutopilotCampaign): Promise<AutopilotCampaign> {
    const result = await db.insert(autopilotCampaigns).values(campaign).returning();
    return result[0];
  }

  async updateAutopilotCampaign(id: string, updates: Partial<AutopilotCampaign>): Promise<AutopilotCampaign | undefined> {
    const cleaned = cleanPartial(updates);
    if (Object.keys(cleaned).length === 0) return this.getAutopilotCampaign(id);
    const result = await db.update(autopilotCampaigns).set(cleaned).where(eq(autopilotCampaigns.id, id)).returning();
    return result[0];
  }

  // Autopilot Run methods
  async getAutopilotRun(id: string): Promise<AutopilotRun | undefined> {
    const result = await db.select().from(autopilotRuns).where(eq(autopilotRuns.id, id)).limit(1);
    return result[0];
  }

  async getAutopilotRunsByCampaign(campaignId: string): Promise<AutopilotRun[]> {
    return await db.select().from(autopilotRuns)
      .where(eq(autopilotRuns.campaignId, campaignId))
      .orderBy(autopilotRuns.startedAt);
  }

  async createAutopilotRun(run: InsertAutopilotRun): Promise<AutopilotRun> {
    const result = await db.insert(autopilotRuns).values(run).returning();
    return result[0];
  }

  async updateAutopilotRun(id: string, updates: Partial<AutopilotRun>): Promise<AutopilotRun | undefined> {
    const cleaned = cleanPartial(updates);
    if (Object.keys(cleaned).length === 0) return this.getAutopilotRun(id);
    const result = await db.update(autopilotRuns).set(cleaned).where(eq(autopilotRuns.id, id)).returning();
    return result[0];
  }

  // Lead Scoring Model methods
  async getLeadScoringModels(): Promise<LeadScoringModel[]> {
    return await db.select().from(leadScoringModels);
  }

  async getLeadScoringModelById(id: string): Promise<LeadScoringModel | undefined> {
    const result = await db.select().from(leadScoringModels).where(eq(leadScoringModels.id, id)).limit(1);
    return result[0];
  }

  async createLeadScoringModel(model: InsertLeadScoringModel): Promise<LeadScoringModel> {
    const result = await db.insert(leadScoringModels).values(model).returning();
    return result[0];
  }

  async updateLeadScoringModel(id: string, model: Partial<InsertLeadScoringModel>): Promise<LeadScoringModel> {
    const cleaned = cleanPartial(model);
    if (Object.keys(cleaned).length === 0) {
      const existing = await this.getLeadScoringModelById(id);
      if (!existing) throw new Error('Lead scoring model not found');
      return existing;
    }
    const result = await db.update(leadScoringModels).set(cleaned).where(eq(leadScoringModels.id, id)).returning();
    if (!result[0]) throw new Error('Lead scoring model not found');
    return result[0];
  }

  async deleteLeadScoringModel(id: string): Promise<void> {
    await db.delete(leadScoringModels).where(eq(leadScoringModels.id, id));
  }

  // Lead Score methods
  async getLeadScores(contactId?: string, modelId?: string): Promise<LeadScore[]> {
    let query = db.select().from(leadScores);
    const conditions = [];
    if (contactId) conditions.push(eq(leadScores.contactId, contactId));
    if (modelId) conditions.push(eq(leadScores.modelId, modelId));
    
    if (conditions.length === 1) {
      return await query.where(conditions[0]);
    } else if (conditions.length > 1) {
      return await query.where(and(...conditions));
    }
    return await query;
  }

  async getLeadScoreById(id: string): Promise<LeadScore | undefined> {
    const result = await db.select().from(leadScores).where(eq(leadScores.id, id)).limit(1);
    return result[0];
  }

  async createLeadScore(score: InsertLeadScore): Promise<LeadScore> {
    const result = await db.insert(leadScores).values(score).returning();
    return result[0];
  }

  async updateLeadScore(id: string, score: Partial<InsertLeadScore>): Promise<LeadScore> {
    const cleaned = cleanPartial(score);
    if (Object.keys(cleaned).length === 0) {
      const existing = await this.getLeadScoreById(id);
      if (!existing) throw new Error('Lead score not found');
      return existing;
    }
    const result = await db.update(leadScores).set(cleaned).where(eq(leadScores.id, id)).returning();
    if (!result[0]) throw new Error('Lead score not found');
    return result[0];
  }

  async deleteLeadScore(id: string): Promise<void> {
    await db.delete(leadScores).where(eq(leadScores.id, id));
  }

  // Workflow methods
  async getWorkflow(id: string): Promise<Workflow | undefined> {
    const result = await db.select().from(workflows).where(eq(workflows.id, id)).limit(1);
    return result[0];
  }

  async getWorkflows(filters?: { status?: string; category?: string; isTemplate?: boolean; createdBy?: string }): Promise<Workflow[]> {
    let query = db.select().from(workflows);
    const conditions: any[] = [];

    if (filters?.status) {
      conditions.push(eq(workflows.status, filters.status));
    }
    if (filters?.category) {
      conditions.push(eq(workflows.category, filters.category));
    }
    if (filters?.isTemplate !== undefined) {
      conditions.push(eq(workflows.isTemplate, filters.isTemplate));
    }
    if (filters?.createdBy) {
      conditions.push(eq(workflows.createdBy, filters.createdBy));
    }

    if (conditions.length === 1) {
      return await query.where(conditions[0]);
    } else if (conditions.length > 1) {
      return await query.where(and(...conditions));
    }
    return await query;
  }

  async createWorkflow(workflow: InsertWorkflow): Promise<Workflow> {
    const result = await db.insert(workflows).values(workflow).returning();
    return result[0];
  }

  async updateWorkflow(id: string, updates: Partial<Workflow>): Promise<Workflow | undefined> {
    const cleaned = cleanPartial(updates);
    if (Object.keys(cleaned).length === 0) return this.getWorkflow(id);
    const result = await db.update(workflows).set({
      ...cleaned,
      updatedAt: new Date()
    }).where(eq(workflows.id, id)).returning();
    return result[0];
  }

  async deleteWorkflow(id: string): Promise<boolean> {
    const result = await db.delete(workflows).where(eq(workflows.id, id)).returning();
    return result.length > 0;
  }

  // Workflow Execution methods
  async getWorkflowExecution(id: string): Promise<WorkflowExecution | undefined> {
    const result = await db.select().from(workflowExecutions).where(eq(workflowExecutions.id, id)).limit(1);
    return result[0];
  }

  async getWorkflowExecutions(filters?: { workflowId?: string; status?: string }): Promise<WorkflowExecution[]> {
    let query = db.select().from(workflowExecutions);
    const conditions: any[] = [];

    if (filters?.workflowId) {
      conditions.push(eq(workflowExecutions.workflowId, filters.workflowId));
    }
    if (filters?.status) {
      conditions.push(eq(workflowExecutions.status, filters.status));
    }

    if (conditions.length === 1) {
      return await query.where(conditions[0]);
    } else if (conditions.length > 1) {
      return await query.where(and(...conditions));
    }
    return await query;
  }

  async createWorkflowExecution(execution: InsertWorkflowExecution): Promise<WorkflowExecution> {
    const result = await db.insert(workflowExecutions).values(execution).returning();
    return result[0];
  }

  async updateWorkflowExecution(id: string, updates: Partial<WorkflowExecution>): Promise<WorkflowExecution | undefined> {
    const cleaned = cleanPartial(updates);
    if (Object.keys(cleaned).length === 0) return this.getWorkflowExecution(id);
    const result = await db.update(workflowExecutions).set(cleaned).where(eq(workflowExecutions.id, id)).returning();
    return result[0];
  }

  // Agent Type methods
  async getAgentType(id: string): Promise<AgentType | undefined> {
    const result = await db.select().from(agentTypes).where(eq(agentTypes.id, id)).limit(1);
    return result[0];
  }

  async getAgentTypes(filters?: { category?: string }): Promise<AgentType[]> {
    if (filters?.category) {
      return await db.select().from(agentTypes).where(eq(agentTypes.category, filters.category));
    }
    return await db.select().from(agentTypes);
  }

  async createAgentType(agentType: InsertAgentType): Promise<AgentType> {
    const result = await db.insert(agentTypes).values(agentType).returning();
    return result[0];
  }

  async updateAgentType(id: string, updates: Partial<AgentType>): Promise<AgentType | undefined> {
    const cleaned = cleanPartial(updates);
    if (Object.keys(cleaned).length === 0) return this.getAgentType(id);
    const result = await db.update(agentTypes).set(cleaned).where(eq(agentTypes.id, id)).returning();
    return result[0];
  }

  // Workflow Template methods
  async getWorkflowTemplate(id: string): Promise<WorkflowTemplate | undefined> {
    const result = await db.select().from(workflowTemplates).where(eq(workflowTemplates.id, id)).limit(1);
    return result[0];
  }

  async getWorkflowTemplates(filters?: { category?: string; difficulty?: string }): Promise<WorkflowTemplate[]> {
    let query = db.select().from(workflowTemplates);
    const conditions: any[] = [];

    if (filters?.category) {
      conditions.push(eq(workflowTemplates.category, filters.category));
    }
    if (filters?.difficulty) {
      conditions.push(eq(workflowTemplates.difficulty, filters.difficulty));
    }

    if (conditions.length === 1) {
      return await query.where(conditions[0]);
    } else if (conditions.length > 1) {
      return await query.where(and(...conditions));
    }
    return await query;
  }

  async createWorkflowTemplate(template: InsertWorkflowTemplate): Promise<WorkflowTemplate> {
    const result = await db.insert(workflowTemplates).values(template).returning();
    return result[0];
  }

  async updateWorkflowTemplate(id: string, updates: Partial<WorkflowTemplate>): Promise<WorkflowTemplate | undefined> {
    const cleaned = cleanPartial(updates);
    if (Object.keys(cleaned).length === 0) return this.getWorkflowTemplate(id);
    const result = await db.update(workflowTemplates).set(cleaned).where(eq(workflowTemplates.id, id)).returning();
    return result[0];
  }

  // Human Approval methods
  async getHumanApproval(id: string): Promise<HumanApproval | undefined> {
    const result = await db.select().from(humanApprovals).where(eq(humanApprovals.id, id)).limit(1);
    return result[0];
  }

  async getHumanApprovals(filters?: { executionId?: string; status?: string }): Promise<HumanApproval[]> {
    let query = db.select().from(humanApprovals);
    const conditions: any[] = [];

    if (filters?.executionId) {
      conditions.push(eq(humanApprovals.executionId, filters.executionId));
    }
    if (filters?.status) {
      conditions.push(eq(humanApprovals.status, filters.status));
    }

    if (conditions.length === 1) {
      return await query.where(conditions[0]);
    } else if (conditions.length > 1) {
      return await query.where(and(...conditions));
    }
    return await query;
  }

  async createHumanApproval(approval: InsertHumanApproval): Promise<HumanApproval> {
    const result = await db.insert(humanApprovals).values(approval).returning();
    return result[0];
  }

  async updateHumanApproval(id: string, updates: Partial<HumanApproval>): Promise<HumanApproval | undefined> {
    const cleaned = cleanPartial(updates);
    if (Object.keys(cleaned).length === 0) return this.getHumanApproval(id);
    const result = await db.update(humanApprovals).set(cleaned).where(eq(humanApprovals.id, id)).returning();
    return result[0];
  }

  // Marketplace Agent methods
  async getMarketplaceAgent(id: string): Promise<MarketplaceAgent | undefined> {
    const result = await db.select().from(marketplaceAgents).where(eq(marketplaceAgents.id, id)).limit(1);
    return result[0];
  }

  async getMarketplaceAgents(filters?: { category?: string; author?: string; minRating?: number; maxPrice?: number; tags?: string[] }): Promise<MarketplaceAgent[]> {
    // Seed sample marketplace agents if none exist
    await this.ensureSampleMarketplaceAgents();
    
    let query = db.select().from(marketplaceAgents);
    const conditions: any[] = [];

    if (filters?.category) {
      conditions.push(eq(marketplaceAgents.category, filters.category));
    }
    if (filters?.author) {
      conditions.push(eq(marketplaceAgents.author, filters.author));
    }
    
    // For complex filters like minRating, maxPrice, and tags, we'll handle them in code
    let result = await (conditions.length === 1 
      ? query.where(conditions[0])
      : conditions.length > 1 
        ? query.where(and(...conditions))
        : query);
    
    if (filters?.minRating !== undefined) {
      const minRating = filters.minRating;
      result = result.filter(agent => 
        agent.rating ? parseFloat(agent.rating) >= minRating : false
      );
    }
    if (filters?.maxPrice !== undefined) {
      const maxPrice = filters.maxPrice;
      result = result.filter(agent => 
        parseFloat(agent.price) <= maxPrice
      );
    }
    if (filters?.tags && filters.tags.length > 0) {
      result = result.filter(agent => 
        agent.tags?.some(tag => filters.tags?.includes(tag))
      );
    }
    
    return result;
  }

  async ensureSampleMarketplaceAgents(): Promise<void> {
    // Check if marketplace agents already exist
    const existing = await db.select().from(marketplaceAgents).limit(1);
    if (existing.length > 0) return;

    // Create sample marketplace agents
    const sampleAgents = [
      {
        name: "Email Outreach Optimizer",
        description: "AI agent that automatically optimizes cold email campaigns for maximum response rates.",
        category: "outreach",
        author: "marketplace-system",
        price: "29.99",
        currency: "USD",
        systemPrompt: "You are an expert email outreach specialist...",
        configTemplate: { emailProvider: "gmail", dailyLimit: 50 },
        inputSchema: { type: "object", properties: { targetAudience: { type: "string" } } },
        outputSchema: { type: "object", properties: { optimizedSubjects: { type: "array" } } },
        tags: ["email", "outreach", "optimization"],
        version: "1.2.0",
        downloads: 1250,
        rating: "4.8",
        isPublic: true,
        isFeatured: true,
        documentation: "## How to use\n\nThis agent helps optimize cold email campaigns.",
        changeLog: { "1.2.0": "Added sentiment analysis", "1.0.0": "Initial release" }
      },
      {
        name: "Lead Qualification Bot",
        description: "Automatically qualifies leads using BANT and MEDDIC frameworks.",
        category: "qualification",
        author: "marketplace-system",
        price: "0",
        currency: "USD",
        systemPrompt: "You are an expert sales qualifier...",
        configTemplate: { frameworks: ["BANT", "MEDDIC"] },
        inputSchema: { type: "object", properties: { leadData: { type: "object" } } },
        outputSchema: { type: "object", properties: { score: { type: "number" } } },
        tags: ["qualification", "BANT", "MEDDIC", "free"],
        version: "2.0.1",
        downloads: 3420,
        rating: "4.9",
        isPublic: true,
        isFeatured: true,
        documentation: "## Overview\n\nLead qualification using multiple frameworks.",
        changeLog: { "2.0.0": "Added MEDDIC", "1.0.0": "Initial BANT release" }
      },
      {
        name: "LinkedIn Engagement Assistant",
        description: "Automates LinkedIn outreach with personalized messages.",
        category: "social",
        author: "marketplace-system",
        price: "49.99",
        currency: "USD",
        systemPrompt: "You are a LinkedIn specialist...",
        configTemplate: { connectionsPerDay: 20, personalizationLevel: "high" },
        inputSchema: { type: "object", properties: { profile: { type: "object" } } },
        outputSchema: { type: "object", properties: { message: { type: "string" } } },
        tags: ["linkedin", "social", "automation"],
        version: "1.5.2",
        downloads: 890,
        rating: "4.6",
        isPublic: true,
        isFeatured: false,
        documentation: "## Setup\n\nConfigure LinkedIn credentials...",
        changeLog: { "1.5.0": "Added multi-language", "1.0.0": "Initial release" }
      }
    ];

    for (const agent of sampleAgents) {
      await db.insert(marketplaceAgents).values(agent as any).onConflictDoNothing();
    }
  }

  async getMarketplaceAgentsByUser(userId: string): Promise<MarketplaceAgent[]> {
    return await db.select().from(marketplaceAgents).where(eq(marketplaceAgents.author, userId));
  }

  async createMarketplaceAgent(agent: InsertMarketplaceAgent): Promise<MarketplaceAgent> {
    const result = await db.insert(marketplaceAgents).values(agent).returning();
    return result[0];
  }

  async updateMarketplaceAgent(id: string, updates: Partial<MarketplaceAgent>): Promise<MarketplaceAgent | undefined> {
    const cleaned = cleanPartial(updates);
    if (Object.keys(cleaned).length === 0) return this.getMarketplaceAgent(id);
    const result = await db.update(marketplaceAgents).set({
      ...cleaned,
      updatedAt: new Date()
    }).where(eq(marketplaceAgents.id, id)).returning();
    return result[0];
  }

  async deleteMarketplaceAgent(id: string): Promise<boolean> {
    const result = await db.delete(marketplaceAgents).where(eq(marketplaceAgents.id, id)).returning();
    return result.length > 0;
  }

  async incrementAgentDownloads(id: string): Promise<void> {
    const agent = await this.getMarketplaceAgent(id);
    if (agent) {
      await db.update(marketplaceAgents)
        .set({ downloads: agent.downloads + 1 })
        .where(eq(marketplaceAgents.id, id));
    }
  }

  // Agent Rating methods
  async getAgentRating(id: string): Promise<AgentRating | undefined> {
    const result = await db.select().from(agentRatings).where(eq(agentRatings.id, id)).limit(1);
    return result[0];
  }

  async getAgentRatings(agentId: string): Promise<AgentRating[]> {
    return await db.select().from(agentRatings).where(eq(agentRatings.agentId, agentId));
  }

  async getUserAgentRating(agentId: string, userId: string): Promise<AgentRating | undefined> {
    const result = await db.select().from(agentRatings)
      .where(and(
        eq(agentRatings.agentId, agentId),
        eq(agentRatings.userId, userId)
      ))
      .limit(1);
    return result[0];
  }

  async createAgentRating(rating: InsertAgentRating): Promise<AgentRating> {
    const result = await db.insert(agentRatings).values(rating).returning();
    
    // Update average rating
    await this.updateAgentAverageRating(rating.agentId);
    
    return result[0];
  }

  async updateAgentRating(id: string, updates: Partial<AgentRating>): Promise<AgentRating | undefined> {
    const cleaned = cleanPartial(updates);
    if (Object.keys(cleaned).length === 0) return this.getAgentRating(id);
    const result = await db.update(agentRatings).set({
      ...cleaned,
      updatedAt: new Date()
    }).where(eq(agentRatings.id, id)).returning();
    
    // Update average rating if rating was changed
    if (result[0] && updates.rating) {
      await this.updateAgentAverageRating(result[0].agentId);
    }
    
    return result[0];
  }

  async updateAgentAverageRating(agentId: string): Promise<void> {
    const ratings = await this.getAgentRatings(agentId);
    if (ratings.length > 0) {
      const average = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
      await db.update(marketplaceAgents)
        .set({ rating: average.toFixed(1) })
        .where(eq(marketplaceAgents.id, agentId));
    }
  }

  // Agent Download methods
  async getAgentDownload(id: string): Promise<AgentDownload | undefined> {
    const result = await db.select().from(agentDownloads).where(eq(agentDownloads.id, id)).limit(1);
    return result[0];
  }

  async getAgentDownloads(filters?: { agentId?: string; userId?: string }): Promise<AgentDownload[]> {
    let query = db.select().from(agentDownloads);
    const conditions: any[] = [];

    if (filters?.agentId) {
      conditions.push(eq(agentDownloads.agentId, filters.agentId));
    }
    if (filters?.userId) {
      conditions.push(eq(agentDownloads.userId, filters.userId));
    }

    if (conditions.length === 1) {
      return await query.where(conditions[0]);
    } else if (conditions.length > 1) {
      return await query.where(and(...conditions));
    }
    return await query;
  }

  async createAgentDownload(download: InsertAgentDownload): Promise<AgentDownload> {
    const result = await db.insert(agentDownloads).values(download).returning();
    
    // Increment download count
    await this.incrementAgentDownloads(download.agentId);
    
    return result[0];
  }

  async hasUserDownloadedAgent(agentId: string, userId: string): Promise<boolean> {
    const result = await db.select().from(agentDownloads)
      .where(and(
        eq(agentDownloads.agentId, agentId),
        eq(agentDownloads.userId, userId)
      ))
      .limit(1);
    return result.length > 0;
  }

  // Agent Purchase methods
  async getAgentPurchase(id: string): Promise<AgentPurchase | undefined> {
    const result = await db.select().from(agentPurchases).where(eq(agentPurchases.id, id)).limit(1);
    return result[0];
  }

  async getAgentPurchases(filters?: { agentId?: string; userId?: string }): Promise<AgentPurchase[]> {
    let query = db.select().from(agentPurchases);
    const conditions: any[] = [];

    if (filters?.agentId) {
      conditions.push(eq(agentPurchases.agentId, filters.agentId));
    }
    if (filters?.userId) {
      conditions.push(eq(agentPurchases.userId, filters.userId));
    }

    if (conditions.length === 1) {
      return await query.where(conditions[0]);
    } else if (conditions.length > 1) {
      return await query.where(and(...conditions));
    }
    return await query;
  }

  async createAgentPurchase(purchase: InsertAgentPurchase): Promise<AgentPurchase> {
    const result = await db.insert(agentPurchases).values(purchase).returning();
    return result[0];
  }

  async hasUserPurchasedAgent(agentId: string, userId: string): Promise<boolean> {
    const result = await db.select().from(agentPurchases)
      .where(and(
        eq(agentPurchases.agentId, agentId),
        eq(agentPurchases.userId, userId)
      ))
      .limit(1);
    return result.length > 0;
  }

  // Digital Twin methods
  async getDigitalTwin(id: string): Promise<DigitalTwin | undefined> {
    const result = await db.select().from(digitalTwins).where(eq(digitalTwins.id, id)).limit(1);
    return result[0];
  }

  async getDigitalTwinByContact(contactId: string): Promise<DigitalTwin | undefined> {
    const result = await db.select().from(digitalTwins)
      .where(eq(digitalTwins.contactId, contactId))
      .limit(1);
    return result[0];
  }

  async getDigitalTwins(filters?: { companyId?: string; limit?: number }): Promise<DigitalTwin[]> {
    if (filters?.companyId) {
      const result = filters?.limit 
        ? await db.select().from(digitalTwins).where(eq(digitalTwins.companyId, filters.companyId)).limit(filters.limit)
        : await db.select().from(digitalTwins).where(eq(digitalTwins.companyId, filters.companyId));
      return result;
    }
    
    const result = filters?.limit
      ? await db.select().from(digitalTwins).limit(filters.limit)
      : await db.select().from(digitalTwins);
    return result;
  }

  async createDigitalTwin(twin: InsertDigitalTwin): Promise<DigitalTwin> {
    const result = await db.insert(digitalTwins).values(twin).returning();
    return result[0];
  }

  async updateDigitalTwin(id: string, updates: Partial<DigitalTwin>): Promise<DigitalTwin | undefined> {
    const result = await db
      .update(digitalTwins)
      .set({ ...cleanPartial(updates), lastModelUpdate: new Date() })
      .where(eq(digitalTwins.id, id))
      .returning();
    return result[0];
  }
  
  async deleteDigitalTwin(id: string): Promise<boolean> {
    const result = await db.delete(digitalTwins).where(eq(digitalTwins.id, id)).returning();
    return result.length > 0;
  }

  // Twin Interaction methods
  async getTwinInteraction(id: string): Promise<TwinInteraction | undefined> {
    const result = await db.select().from(twinInteractions).where(eq(twinInteractions.id, id)).limit(1);
    return result[0];
  }

  async getTwinInteractions(twinId: string, limit?: number): Promise<TwinInteraction[]> {
    if (limit) {
      return await db.select().from(twinInteractions)
        .where(eq(twinInteractions.twinId, twinId))
        .orderBy(twinInteractions.timestamp)
        .limit(limit);
    }
    return await db.select().from(twinInteractions)
      .where(eq(twinInteractions.twinId, twinId))
      .orderBy(twinInteractions.timestamp);
  }

  async createTwinInteraction(interaction: InsertTwinInteraction): Promise<TwinInteraction> {
    const result = await db.insert(twinInteractions).values(interaction).returning();
    return result[0];
  }

  // Twin Prediction methods
  async getTwinPrediction(id: string): Promise<TwinPrediction | undefined> {
    const result = await db.select().from(twinPredictions).where(eq(twinPredictions.id, id)).limit(1);
    return result[0];
  }

  async getTwinPredictions(twinId: string, type?: string): Promise<TwinPrediction[]> {
    if (type) {
      return await db.select().from(twinPredictions)
        .where(and(
          eq(twinPredictions.twinId, twinId),
          eq(twinPredictions.predictionType, type)
        ));
    }
    return await db.select().from(twinPredictions)
      .where(eq(twinPredictions.twinId, twinId));
  }

  async createTwinPrediction(prediction: InsertTwinPrediction): Promise<TwinPrediction> {
    const result = await db.insert(twinPredictions).values(prediction).returning();
    return result[0];
  }

  async updateTwinPrediction(id: string, updates: Partial<TwinPrediction>): Promise<TwinPrediction | undefined> {
    const result = await db
      .update(twinPredictions)
      .set(cleanPartial(updates))
      .where(eq(twinPredictions.id, id))
      .returning();
    return result[0];
  }

  // SDR Team methods
  async getSdrTeam(id: string): Promise<SdrTeam | undefined> {
    const result = await db.select().from(sdrTeams).where(eq(sdrTeams.id, id)).limit(1);
    return result[0];
  }

  async getSdrTeams(filters?: { teamType?: string; isActive?: boolean; createdBy?: string }): Promise<SdrTeam[]> {
    let query = db.select().from(sdrTeams);
    const conditions: any[] = [];
    
    if (filters?.teamType) conditions.push(eq(sdrTeams.teamType, filters.teamType));
    if (filters?.isActive !== undefined) conditions.push(eq(sdrTeams.isActive, filters.isActive));
    if (filters?.createdBy) conditions.push(eq(sdrTeams.createdBy, filters.createdBy));
    
    if (conditions.length > 0) {
      return await query.where(and(...conditions));
    }
    return await query;
  }

  async createSdrTeam(team: InsertSdrTeam): Promise<SdrTeam> {
    const result = await db.insert(sdrTeams).values(team).returning();
    return result[0];
  }

  async updateSdrTeam(id: string, updates: Partial<SdrTeam>): Promise<SdrTeam | undefined> {
    const cleaned = cleanPartial(updates);
    if (Object.keys(cleaned).length === 0) return this.getSdrTeam(id);
    const result = await db.update(sdrTeams).set({ ...cleaned, updatedAt: new Date() }).where(eq(sdrTeams.id, id)).returning();
    return result[0];
  }

  async deleteSdrTeam(id: string): Promise<boolean> {
    const result = await db.delete(sdrTeams).where(eq(sdrTeams.id, id)).returning();
    return result.length > 0;
  }

  // SDR Team Member methods
  async getSdrTeamMember(id: string): Promise<SdrTeamMember | undefined> {
    const result = await db.select().from(sdrTeamMembers).where(eq(sdrTeamMembers.id, id)).limit(1);
    return result[0];
  }

  async getSdrTeamMembersByTeam(teamId: string): Promise<SdrTeamMember[]> {
    return await db.select().from(sdrTeamMembers).where(eq(sdrTeamMembers.teamId, teamId));
  }

  async getSdrTeamMembersByRole(role: string): Promise<SdrTeamMember[]> {
    return await db.select().from(sdrTeamMembers).where(eq(sdrTeamMembers.role, role));
  }

  async createSdrTeamMember(member: InsertSdrTeamMember): Promise<SdrTeamMember> {
    const result = await db.insert(sdrTeamMembers).values(member).returning();
    return result[0];
  }

  async updateSdrTeamMember(id: string, updates: Partial<SdrTeamMember>): Promise<SdrTeamMember | undefined> {
    const cleaned = cleanPartial(updates);
    if (Object.keys(cleaned).length === 0) return this.getSdrTeamMember(id);
    const result = await db.update(sdrTeamMembers).set({ ...cleaned, updatedAt: new Date() }).where(eq(sdrTeamMembers.id, id)).returning();
    return result[0];
  }

  async deleteSdrTeamMember(id: string): Promise<boolean> {
    const result = await db.delete(sdrTeamMembers).where(eq(sdrTeamMembers.id, id)).returning();
    return result.length > 0;
  }

  // Team Collaboration methods
  async getTeamCollaboration(id: string): Promise<TeamCollaboration | undefined> {
    const result = await db.select().from(teamCollaborations).where(eq(teamCollaborations.id, id)).limit(1);
    return result[0];
  }

  async getTeamCollaborations(filters?: { teamId?: string; dealId?: string; contactId?: string; outcome?: string }): Promise<TeamCollaboration[]> {
    let query = db.select().from(teamCollaborations);
    const conditions: any[] = [];
    
    if (filters?.teamId) conditions.push(eq(teamCollaborations.teamId, filters.teamId));
    if (filters?.dealId) conditions.push(eq(teamCollaborations.dealId, filters.dealId));
    if (filters?.contactId) conditions.push(eq(teamCollaborations.contactId, filters.contactId));
    if (filters?.outcome) conditions.push(eq(teamCollaborations.outcome, filters.outcome));
    
    if (conditions.length > 0) {
      return await query.where(and(...conditions));
    }
    return await query;
  }

  async createTeamCollaboration(collaboration: InsertTeamCollaboration): Promise<TeamCollaboration> {
    const result = await db.insert(teamCollaborations).values(collaboration).returning();
    return result[0];
  }

  async updateTeamCollaboration(id: string, updates: Partial<TeamCollaboration>): Promise<TeamCollaboration | undefined> {
    const cleaned = cleanPartial(updates);
    if (Object.keys(cleaned).length === 0) return this.getTeamCollaboration(id);
    const result = await db.update(teamCollaborations).set(cleaned).where(eq(teamCollaborations.id, id)).returning();
    return result[0];
  }

  // Team Performance methods
  async getTeamPerformance(id: string): Promise<TeamPerformance | undefined> {
    const result = await db.select().from(teamPerformance).where(eq(teamPerformance.id, id)).limit(1);
    return result[0];
  }

  async getTeamPerformanceByTeam(teamId: string, period?: string): Promise<TeamPerformance[]> {
    if (period) {
      return await db.select().from(teamPerformance)
        .where(and(eq(teamPerformance.teamId, teamId), eq(teamPerformance.period, period)));
    }
    return await db.select().from(teamPerformance).where(eq(teamPerformance.teamId, teamId));
  }

  async createTeamPerformance(performance: InsertTeamPerformance): Promise<TeamPerformance> {
    const result = await db.insert(teamPerformance).values(performance).returning();
    return result[0];
  }

  async updateTeamPerformance(id: string, updates: Partial<TeamPerformance>): Promise<TeamPerformance | undefined> {
    const cleaned = cleanPartial(updates);
    if (Object.keys(cleaned).length === 0) return this.getTeamPerformance(id);
    const result = await db.update(teamPerformance).set(cleaned).where(eq(teamPerformance.id, id)).returning();
    return result[0];
  }

  // Inbox Message methods
  async getInboxMessage(id: string): Promise<InboxMessage | undefined> {
    const result = await db.select().from(inboxMessages).where(eq(inboxMessages.id, id)).limit(1);
    return result[0];
  }

  async getInboxMessages(filters?: { userId?: string; channel?: string; category?: string; isRead?: boolean; isArchived?: boolean }): Promise<InboxMessage[]> {
    // Seed sample messages if none exist
    await this.ensureSampleInboxMessages(filters?.userId);
    
    let query = db.select().from(inboxMessages);
    const conditions: any[] = [];
    
    if (filters?.userId) conditions.push(eq(inboxMessages.userId, filters.userId));
    if (filters?.channel) conditions.push(eq(inboxMessages.channel, filters.channel));
    if (filters?.category) conditions.push(eq(inboxMessages.category, filters.category));
    if (filters?.isRead !== undefined) conditions.push(eq(inboxMessages.isRead, filters.isRead));
    if (filters?.isArchived !== undefined) conditions.push(eq(inboxMessages.isArchived, filters.isArchived));
    
    if (conditions.length > 0) {
      return await query.where(and(...conditions)).orderBy(desc(inboxMessages.createdAt));
    }
    
    return await query.orderBy(desc(inboxMessages.createdAt));
  }

  async ensureSampleInboxMessages(userId?: string): Promise<void> {
    if (!userId) return;
    
    // Check if user has any messages
    const existing = await db.select().from(inboxMessages)
      .where(eq(inboxMessages.userId, userId))
      .limit(1);
    if (existing.length > 0) return;

    // Get or create sample companies and contacts
    const companiesExist = await db.select().from(companies).limit(3);
    if (companiesExist.length === 0) {
      await this.ensureSampleCompanies();
    }
    
    const sampleCompanies = await db.select().from(companies).limit(3);
    if (sampleCompanies.length === 0) return;
    
    // Create sample inbox messages
    const sampleMessages = [
      {
        userId,
        companyId: sampleCompanies[0].id,
        channel: 'email',
        direction: 'inbound',
        fromEmail: 'john.doe@techcorp.com',
        fromName: 'John Doe',
        toEmail: 'you@company.com',
        subject: 'Interested in your sales platform',
        content: `Hi there,

I came across your AI sales platform and I'm very interested in learning more. We're currently evaluating solutions to improve our sales team's efficiency.

Could we schedule a quick demo next week? Our team of 50 sales reps is struggling with manual outreach and we need a better solution.

Best regards,
John Doe
VP of Sales, TechCorp`,
        category: 'interested',
        isRead: false,
        isStarred: true,
        isArchived: false,
        threadId: null,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
      },
      {
        userId,
        companyId: sampleCompanies[1].id,
        channel: 'email',
        direction: 'inbound',
        fromEmail: 'sarah.smith@dataflow.io',
        fromName: 'Sarah Smith',
        toEmail: 'you@company.com',
        subject: 'Re: Follow-up on our conversation',
        content: `Thanks for reaching out!

I've reviewed your proposal and shared it with our team. We have a few questions about the integration with our existing CRM system.

Can you provide more details about your API capabilities and data sync features?

Sarah`,
        category: 'follow_up',
        isRead: true,
        isStarred: false,
        isArchived: false,
        threadId: null,
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day ago
      },
      {
        userId,
        companyId: sampleCompanies[2].id,
        channel: 'email',
        direction: 'inbound',
        fromEmail: 'mike.johnson@cloudscale.com',
        fromName: 'Mike Johnson',
        toEmail: 'you@company.com',
        subject: 'Pricing concerns',
        content: `Hello,

We're interested in your platform but the pricing seems higher than competitors. We're currently using Apollo.io and paying significantly less.

What additional value does your platform provide to justify the price difference?

Mike`,
        category: 'objection',
        isRead: false,
        isStarred: false,
        isArchived: false,
        threadId: null,
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) // 3 days ago
      }
    ];

    for (const message of sampleMessages) {
      await db.insert(inboxMessages).values(message as any).onConflictDoNothing();
    }
  }

  async createInboxMessage(message: InsertInboxMessage): Promise<InboxMessage> {
    const result = await db.insert(inboxMessages).values(message).returning();
    return result[0];
  }

  async updateInboxMessage(id: string, updates: Partial<InboxMessage>): Promise<InboxMessage | undefined> {
    const cleaned = cleanPartial(updates);
    if (Object.keys(cleaned).length === 0) return this.getInboxMessage(id);
    const result = await db.update(inboxMessages).set(cleaned).where(eq(inboxMessages.id, id)).returning();
    return result[0];
  }

  async markInboxMessageAsRead(id: string): Promise<InboxMessage | undefined> {
    return this.updateInboxMessage(id, { isRead: true });
  }

  async toggleInboxMessageStar(id: string): Promise<InboxMessage | undefined> {
    const message = await this.getInboxMessage(id);
    if (!message) return undefined;
    return this.updateInboxMessage(id, { isStarred: !message.isStarred });
  }

  async archiveInboxMessage(id: string): Promise<InboxMessage | undefined> {
    return this.updateInboxMessage(id, { isArchived: true });
  }

  // Voice AI methods
  // Voice Campaign methods
  async getVoiceCampaign(id: string): Promise<VoiceCampaign | undefined> {
    const result = await db.select().from(voiceCampaigns).where(eq(voiceCampaigns.id, id)).limit(1);
    return result[0];
  }

  async getVoiceCampaigns(filters?: { status?: string; createdBy?: string }): Promise<VoiceCampaign[]> {
    let query = db.select().from(voiceCampaigns);
    const conditions: any[] = [];

    if (filters?.status) {
      conditions.push(eq(voiceCampaigns.status, filters.status));
    }
    if (filters?.createdBy) {
      conditions.push(eq(voiceCampaigns.createdBy, filters.createdBy));
    }

    if (conditions.length === 1) {
      return await query.where(conditions[0]);
    } else if (conditions.length > 1) {
      return await query.where(and(...conditions));
    }
    return await query;
  }

  async createVoiceCampaign(campaign: InsertVoiceCampaign): Promise<VoiceCampaign> {
    const result = await db.insert(voiceCampaigns).values(campaign).returning();
    return result[0];
  }

  async updateVoiceCampaign(id: string, updates: Partial<VoiceCampaign>): Promise<VoiceCampaign | undefined> {
    const result = await db
      .update(voiceCampaigns)
      .set({ ...cleanPartial(updates), updatedAt: new Date() })
      .where(eq(voiceCampaigns.id, id))
      .returning();
    return result[0];
  }

  async deleteVoiceCampaign(id: string): Promise<boolean> {
    const result = await db.delete(voiceCampaigns).where(eq(voiceCampaigns.id, id)).returning();
    return result.length > 0;
  }

  // Voice Call methods
  async getVoiceCall(id: string): Promise<VoiceCall | undefined> {
    const result = await db.select().from(voiceCalls).where(eq(voiceCalls.id, id)).limit(1);
    return result[0];
  }

  async getVoiceCalls(filters?: { campaignId?: string; contactId?: string; callStatus?: string }): Promise<VoiceCall[]> {
    let query = db.select().from(voiceCalls);
    const conditions: any[] = [];

    if (filters?.campaignId) {
      conditions.push(eq(voiceCalls.campaignId, filters.campaignId));
    }
    if (filters?.contactId) {
      conditions.push(eq(voiceCalls.contactId, filters.contactId));
    }
    if (filters?.callStatus) {
      conditions.push(eq(voiceCalls.callStatus, filters.callStatus));
    }

    if (conditions.length === 1) {
      return await query.where(conditions[0]);
    } else if (conditions.length > 1) {
      return await query.where(and(...conditions));
    }
    return await query;
  }

  async createVoiceCall(call: InsertVoiceCall): Promise<VoiceCall> {
    const result = await db.insert(voiceCalls).values(call).returning();
    return result[0];
  }

  async updateVoiceCall(id: string, updates: Partial<VoiceCall>): Promise<VoiceCall | undefined> {
    const result = await db
      .update(voiceCalls)
      .set(cleanPartial(updates))
      .where(eq(voiceCalls.id, id))
      .returning();
    return result[0];
  }

  // Voice Script methods
  async getVoiceScript(id: string): Promise<VoiceScript | undefined> {
    const result = await db.select().from(voiceScripts).where(eq(voiceScripts.id, id)).limit(1);
    return result[0];
  }

  async getVoiceScripts(filters?: { scriptType?: string; isActive?: boolean; createdBy?: string }): Promise<VoiceScript[]> {
    let query = db.select().from(voiceScripts);
    const conditions: any[] = [];

    if (filters?.scriptType) {
      conditions.push(eq(voiceScripts.scriptType, filters.scriptType));
    }
    if (filters?.isActive !== undefined) {
      conditions.push(eq(voiceScripts.isActive, filters.isActive));
    }
    if (filters?.createdBy) {
      conditions.push(eq(voiceScripts.createdBy, filters.createdBy));
    }

    if (conditions.length === 1) {
      return await query.where(conditions[0]);
    } else if (conditions.length > 1) {
      return await query.where(and(...conditions));
    }
    return await query;
  }

  async createVoiceScript(script: InsertVoiceScript): Promise<VoiceScript> {
    const result = await db.insert(voiceScripts).values(script).returning();
    return result[0];
  }

  async updateVoiceScript(id: string, updates: Partial<VoiceScript>): Promise<VoiceScript | undefined> {
    const result = await db
      .update(voiceScripts)
      .set({ ...cleanPartial(updates), updatedAt: new Date() })
      .where(eq(voiceScripts.id, id))
      .returning();
    return result[0];
  }

  async deleteVoiceScript(id: string): Promise<boolean> {
    const result = await db.delete(voiceScripts).where(eq(voiceScripts.id, id)).returning();
    return result.length > 0;
  }

  // Call Analytics methods
  async getCallAnalytics(callId: string): Promise<CallAnalytics | undefined> {
    const result = await db.select().from(callAnalytics).where(eq(callAnalytics.callId, callId)).limit(1);
    return result[0];
  }

  async getCallAnalyticsByCampaign(campaignId: string): Promise<CallAnalytics[]> {
    // First get all calls for the campaign
    const calls = await this.getVoiceCalls({ campaignId });
    const callIds = calls.map(call => call.id);
    
    if (callIds.length === 0) return [];
    
    // Then get analytics for those calls
    const results = await db.select().from(callAnalytics)
      .where(eq(callAnalytics.callId, callIds[0])); // Would need in() operator for multiple
    
    return results;
  }

  async createCallAnalytics(analytics: InsertCallAnalytics): Promise<CallAnalytics> {
    const result = await db.insert(callAnalytics).values(analytics).returning();
    return result[0];
  }

  async updateCallAnalytics(id: string, updates: Partial<CallAnalytics>): Promise<CallAnalytics | undefined> {
    const result = await db
      .update(callAnalytics)
      .set(cleanPartial(updates))
      .where(eq(callAnalytics.id, id))
      .returning();
    return result[0];
  }
  
  // Browser Extension methods
  async getExtensionUser(id: string): Promise<ExtensionUser | undefined> {
    const result = await db.select().from(extensionUsers).where(eq(extensionUsers.id, id)).limit(1);
    return result[0];
  }

  async getExtensionUserByUserId(userId: string): Promise<ExtensionUser | undefined> {
    const result = await db.select().from(extensionUsers).where(eq(extensionUsers.userId, userId)).limit(1);
    return result[0];
  }

  async createExtensionUser(user: InsertExtensionUser): Promise<ExtensionUser> {
    const result = await db.insert(extensionUsers).values(user).returning();
    return result[0];
  }

  async updateExtensionUser(id: string, updates: Partial<ExtensionUser>): Promise<ExtensionUser | undefined> {
    const result = await db
      .update(extensionUsers)
      .set({...cleanPartial(updates), lastActiveAt: new Date()})
      .where(eq(extensionUsers.id, id))
      .returning();
    return result[0];
  }

  async getEnrichmentCache(id: string): Promise<EnrichmentCache | undefined> {
    const result = await db.select().from(enrichmentCache).where(eq(enrichmentCache.id, id)).limit(1);
    return result[0];
  }

  async getEnrichmentCacheByDomain(domain: string): Promise<EnrichmentCache | undefined> {
    const now = new Date();
    const result = await db.select().from(enrichmentCache)
      .where(and(
        eq(enrichmentCache.domain, domain),
        // Add expiry check here if needed
      ))
      .limit(1);
    return result[0];
  }

  async createEnrichmentCache(cache: InsertEnrichmentCache): Promise<EnrichmentCache> {
    const result = await db.insert(enrichmentCache).values(cache).returning();
    return result[0];
  }

  async updateEnrichmentCache(id: string, updates: Partial<EnrichmentCache>): Promise<EnrichmentCache | undefined> {
    const result = await db
      .update(enrichmentCache)
      .set(cleanPartial(updates))
      .where(eq(enrichmentCache.id, id))
      .returning();
    return result[0];
  }

  async getExtensionActivity(id: string): Promise<ExtensionActivity | undefined> {
    const result = await db.select().from(extensionActivities).where(eq(extensionActivities.id, id)).limit(1);
    return result[0];
  }

  async getExtensionActivities(filters?: { userId?: string; activityType?: string; limit?: number }): Promise<ExtensionActivity[]> {
    let query = db.select().from(extensionActivities);
    
    if (filters?.userId) {
      query = query.where(eq(extensionActivities.userId, filters.userId)) as any;
    }
    
    if (filters?.activityType) {
      query = query.where(eq(extensionActivities.activityType, filters.activityType)) as any;
    }
    
    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }
    
    return await query;
  }

  async createExtensionActivity(activity: InsertExtensionActivity): Promise<ExtensionActivity> {
    const result = await db.insert(extensionActivities).values(activity).returning();
    return result[0];
  }

  async getQuickAction(id: string): Promise<QuickAction | undefined> {
    const result = await db.select().from(quickActions).where(eq(quickActions.id, id)).limit(1);
    return result[0];
  }

  async getQuickActions(filters?: { userId?: string; actionType?: string; limit?: number }): Promise<QuickAction[]> {
    let query = db.select().from(quickActions);
    
    if (filters?.userId) {
      query = query.where(eq(quickActions.userId, filters.userId)) as any;
    }
    
    if (filters?.actionType) {
      query = query.where(eq(quickActions.actionType, filters.actionType)) as any;
    }
    
    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }
    
    return await query;
  }

  async createQuickAction(action: InsertQuickAction): Promise<QuickAction> {
    const result = await db.insert(quickActions).values(action).returning();
    return result[0];
  }
  
  // Crowd Intelligence methods
  async getSharedIntel(id: string): Promise<SharedIntel | undefined> {
    const result = await db.select().from(sharedIntel).where(eq(sharedIntel.id, id)).limit(1);
    return result[0];
  }

  async getSharedIntelList(filters?: { category?: string; industry?: string; companySize?: string; tags?: string[]; limit?: number }): Promise<SharedIntel[]> {
    let query = db.select().from(sharedIntel);
    
    if (filters?.category) {
      query = query.where(eq(sharedIntel.category, filters.category)) as any;
    }
    
    if (filters?.industry) {
      query = query.where(eq(sharedIntel.industry, filters.industry)) as any;
    }
    
    if (filters?.companySize) {
      query = query.where(eq(sharedIntel.companySize, filters.companySize)) as any;
    }
    
    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }
    
    return await query;
  }

  async createSharedIntel(intel: InsertSharedIntel): Promise<SharedIntel> {
    const result = await db.insert(sharedIntel).values(intel).returning();
    return result[0];
  }

  async updateSharedIntel(id: string, updates: Partial<SharedIntel>): Promise<SharedIntel | undefined> {
    const result = await db
      .update(sharedIntel)
      .set({...cleanPartial(updates), lastUpdated: new Date()})
      .where(eq(sharedIntel.id, id))
      .returning();
    return result[0];
  }

  async getIntelContribution(id: string): Promise<IntelContribution | undefined> {
    const result = await db.select().from(intelContributions).where(eq(intelContributions.id, id)).limit(1);
    return result[0];
  }

  async getIntelContributions(filters?: { intelId?: string; userId?: string; contributionType?: string; limit?: number }): Promise<IntelContribution[]> {
    let query = db.select().from(intelContributions);
    
    if (filters?.intelId) {
      query = query.where(eq(intelContributions.intelId, filters.intelId)) as any;
    }
    
    if (filters?.userId) {
      query = query.where(eq(intelContributions.userId, filters.userId)) as any;
    }
    
    if (filters?.contributionType) {
      query = query.where(eq(intelContributions.contributionType, filters.contributionType)) as any;
    }
    
    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }
    
    return await query;
  }

  async createIntelContribution(contribution: InsertIntelContribution): Promise<IntelContribution> {
    const result = await db.insert(intelContributions).values(contribution).returning();
    return result[0];
  }

  async getIntelRating(id: string): Promise<IntelRating | undefined> {
    const result = await db.select().from(intelRatings).where(eq(intelRatings.id, id)).limit(1);
    return result[0];
  }

  async getIntelRatings(filters?: { intelId?: string; userId?: string; minRating?: number; limit?: number }): Promise<IntelRating[]> {
    let query = db.select().from(intelRatings);
    
    if (filters?.intelId) {
      query = query.where(eq(intelRatings.intelId, filters.intelId)) as any;
    }
    
    if (filters?.userId) {
      query = query.where(eq(intelRatings.userId, filters.userId)) as any;
    }
    
    // Note: For minRating filter, would need gte operator which isn't imported here
    
    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }
    
    return await query;
  }

  async createIntelRating(rating: InsertIntelRating): Promise<IntelRating> {
    const result = await db.insert(intelRatings).values(rating).returning();
    return result[0];
  }

  async updateIntelRating(id: string, updates: Partial<IntelRating>): Promise<IntelRating | undefined> {
    const result = await db
      .update(intelRatings)
      .set(cleanPartial(updates))
      .where(eq(intelRatings.id, id))
      .returning();
    return result[0];
  }

  async getBenchmarkData(id: string): Promise<BenchmarkData | undefined> {
    const result = await db.select().from(benchmarkData).where(eq(benchmarkData.id, id)).limit(1);
    return result[0];
  }

  async getBenchmarkDataList(filters?: { metric?: string; industry?: string; companySize?: string; channel?: string; limit?: number }): Promise<BenchmarkData[]> {
    let query = db.select().from(benchmarkData);
    
    if (filters?.metric) {
      query = query.where(eq(benchmarkData.metric, filters.metric)) as any;
    }
    
    if (filters?.industry) {
      query = query.where(eq(benchmarkData.industry, filters.industry)) as any;
    }
    
    if (filters?.companySize) {
      query = query.where(eq(benchmarkData.companySize, filters.companySize)) as any;
    }
    
    if (filters?.channel) {
      query = query.where(eq(benchmarkData.channel, filters.channel)) as any;
    }
    
    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }
    
    return await query;
  }

  async createBenchmarkData(benchmark: InsertBenchmarkData): Promise<BenchmarkData> {
    const result = await db.insert(benchmarkData).values(benchmark).returning();
    return result[0];
  }

  async updateBenchmarkData(id: string, updates: Partial<BenchmarkData>): Promise<BenchmarkData | undefined> {
    const result = await db
      .update(benchmarkData)
      .set({...cleanPartial(updates), lastCalculated: new Date()})
      .where(eq(benchmarkData.id, id))
      .returning();
    return result[0];
  }
  
  // Intent Signals methods (missing implementations)
  async getIntentSignal(id: string): Promise<IntentSignal | undefined> {
    const result = await db.select().from(intentSignals).where(eq(intentSignals.id, id)).limit(1);
    return result[0];
  }
  
  async getIntentSignals(filters?: { contactId?: string; companyId?: string; signalType?: string; limit?: number }): Promise<IntentSignal[]> {
    let query = db.select().from(intentSignals);
    
    if (filters?.contactId) {
      query = query.where(eq(intentSignals.contactId, filters.contactId)) as any;
    }
    
    if (filters?.companyId) {
      query = query.where(eq(intentSignals.companyId, filters.companyId)) as any;
    }
    
    if (filters?.signalType) {
      query = query.where(eq(intentSignals.signalType, filters.signalType)) as any;
    }
    
    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }
    
    return await query;
  }
  
  async createIntentSignal(signal: InsertIntentSignal): Promise<IntentSignal> {
    const result = await db.insert(intentSignals).values(signal).returning();
    return result[0];
  }
  
  async updateIntentSignal(id: string, updates: Partial<IntentSignal>): Promise<IntentSignal | undefined> {
    const result = await db
      .update(intentSignals)
      .set(cleanPartial(updates))
      .where(eq(intentSignals.id, id))
      .returning();
    return result[0];
  }
  
  // Deal Intelligence methods (missing implementations)
  async getDealIntelligence(id: string): Promise<DealIntelligence | undefined> {
    const result = await db.select().from(dealIntelligence).where(eq(dealIntelligence.id, id)).limit(1);
    return result[0];
  }
  
  async getDealIntelligenceByCompany(companyId: string): Promise<DealIntelligence | undefined> {
    const result = await db.select().from(dealIntelligence).where(eq(dealIntelligence.companyId, companyId)).limit(1);
    return result[0];
  }
  
  async createDealIntelligence(intelligence: InsertDealIntelligence): Promise<DealIntelligence> {
    const result = await db.insert(dealIntelligence).values(intelligence).returning();
    return result[0];
  }
  
  async updateDealIntelligence(id: string, updates: Partial<DealIntelligence>): Promise<DealIntelligence | undefined> {
    const result = await db
      .update(dealIntelligence)
      .set(cleanPartial(updates))
      .where(eq(dealIntelligence.id, id))
      .returning();
    return result[0];
  }
  
  // Channel Configs methods (missing implementations)
  async getChannelConfig(id: string): Promise<ChannelConfig | undefined> {
    const result = await db.select().from(channelConfigs).where(eq(channelConfigs.id, id)).limit(1);
    return result[0];
  }
  
  async getChannelConfigs(userId: string): Promise<ChannelConfig[]> {
    return await db.select().from(channelConfigs).where(eq(channelConfigs.userId, userId));
  }
  
  async getChannelConfigByUserAndChannel(userId: string, channel: string): Promise<ChannelConfig | undefined> {
    const result = await db.select()
      .from(channelConfigs)
      .where(and(eq(channelConfigs.userId, userId), eq(channelConfigs.channel, channel)))
      .limit(1);
    return result[0];
  }
  
  async createChannelConfig(config: InsertChannelConfig): Promise<ChannelConfig> {
    const result = await db.insert(channelConfigs).values(config).returning();
    return result[0];
  }
  
  async updateChannelConfig(id: string, updates: Partial<ChannelConfig>): Promise<ChannelConfig | undefined> {
    const result = await db
      .update(channelConfigs)
      .set(cleanPartial(updates))
      .where(eq(channelConfigs.id, id))
      .returning();
    return result[0];
  }
  
  async deleteChannelConfig(id: string): Promise<boolean> {
    const result = await db.delete(channelConfigs).where(eq(channelConfigs.id, id)).returning();
    return result.length > 0;
  }
  
  // Multi-Channel Campaigns methods (missing implementations)
  async getMultiChannelCampaign(id: string): Promise<MultiChannelCampaign | undefined> {
    const result = await db.select().from(multiChannelCampaigns).where(eq(multiChannelCampaigns.id, id)).limit(1);
    return result[0];
  }
  
  async getMultiChannelCampaigns(filters?: { status?: string; createdBy?: string }): Promise<MultiChannelCampaign[]> {
    let query = db.select().from(multiChannelCampaigns);
    
    if (filters?.status) {
      query = query.where(eq(multiChannelCampaigns.status, filters.status)) as any;
    }
    
    if (filters?.createdBy) {
      query = query.where(eq(multiChannelCampaigns.createdBy, filters.createdBy)) as any;
    }
    
    return await query;
  }
  
  async createMultiChannelCampaign(campaign: InsertMultiChannelCampaign): Promise<MultiChannelCampaign> {
    const result = await db.insert(multiChannelCampaigns).values(campaign).returning();
    return result[0];
  }
  
  async updateMultiChannelCampaign(id: string, updates: Partial<MultiChannelCampaign>): Promise<MultiChannelCampaign | undefined> {
    const result = await db
      .update(multiChannelCampaigns)
      .set(cleanPartial(updates))
      .where(eq(multiChannelCampaigns.id, id))
      .returning();
    return result[0];
  }
  
  async deleteMultiChannelCampaign(id: string): Promise<boolean> {
    const result = await db.delete(multiChannelCampaigns).where(eq(multiChannelCampaigns.id, id)).returning();
    return result.length > 0;
  }
  
  // Channel Messages methods
  async getChannelMessage(id: string): Promise<ChannelMessage | undefined> {
    const result = await db.select().from(channelMessages).where(eq(channelMessages.id, id)).limit(1);
    return result[0];
  }
  
  async getChannelMessages(filters?: { campaignId?: string; channel?: string; recipientId?: string; status?: string }): Promise<ChannelMessage[]> {
    let query = db.select().from(channelMessages);
    
    if (filters?.campaignId) {
      query = query.where(eq(channelMessages.campaignId, filters.campaignId)) as any;
    }
    
    if (filters?.channel) {
      query = query.where(eq(channelMessages.channel, filters.channel)) as any;
    }
    
    if (filters?.recipientId) {
      query = query.where(eq(channelMessages.recipientId, filters.recipientId)) as any;
    }
    
    if (filters?.status) {
      query = query.where(eq(channelMessages.status, filters.status)) as any;
    }
    
    return await query;
  }
  
  async createChannelMessage(message: InsertChannelMessage): Promise<ChannelMessage> {
    const result = await db.insert(channelMessages).values(message).returning();
    return result[0];
  }
  
  async updateChannelMessage(id: string, updates: Partial<ChannelMessage>): Promise<ChannelMessage | undefined> {
    const result = await db
      .update(channelMessages)
      .set(cleanPartial(updates))
      .where(eq(channelMessages.id, id))
      .returning();
    return result[0];
  }
  
  // Channel Orchestration methods
  async getChannelOrchestration(id: string): Promise<ChannelOrchestration | undefined> {
    const result = await db.select().from(channelOrchestration).where(eq(channelOrchestration.id, id)).limit(1);
    return result[0];
  }
  
  async getChannelOrchestrationByCampaign(campaignId: string): Promise<ChannelOrchestration | undefined> {
    const result = await db.select().from(channelOrchestration).where(eq(channelOrchestration.campaignId, campaignId)).limit(1);
    return result[0];
  }
  
  async createChannelOrchestration(orchestration: InsertChannelOrchestration): Promise<ChannelOrchestration> {
    const result = await db.insert(channelOrchestration).values(orchestration).returning();
    return result[0];
  }
  
  async updateChannelOrchestration(id: string, updates: Partial<ChannelOrchestration>): Promise<ChannelOrchestration | undefined> {
    const result = await db
      .update(channelOrchestration)
      .set(cleanPartial(updates))
      .where(eq(channelOrchestration.id, id))
      .returning();
    return result[0];
  }
  
  // White Label methods
  async getWhiteLabel(organizationId: string): Promise<WhiteLabel | undefined> {
    const result = await db.select().from(whiteLabels).where(eq(whiteLabels.organizationId, organizationId)).limit(1);
    return result[0];
  }
  
  async getWhiteLabels(): Promise<WhiteLabel[]> {
    return await db.select().from(whiteLabels);
  }
  
  async createWhiteLabel(whiteLabel: InsertWhiteLabel): Promise<WhiteLabel> {
    const result = await db.insert(whiteLabels).values(whiteLabel).returning();
    return result[0];
  }
  
  async updateWhiteLabel(organizationId: string, updates: Partial<WhiteLabel>): Promise<WhiteLabel | undefined> {
    const result = await db
      .update(whiteLabels)
      .set(cleanPartial(updates))
      .where(eq(whiteLabels.organizationId, organizationId))
      .returning();
    return result[0];
  }
  
  async deleteWhiteLabel(organizationId: string): Promise<boolean> {
    const result = await db.delete(whiteLabels).where(eq(whiteLabels.organizationId, organizationId)).returning();
    return result.length > 0;
  }
  
  // Enterprise Security methods
  async getEnterpriseSecurity(organizationId: string): Promise<EnterpriseSecurity | undefined> {
    const result = await db.select().from(enterpriseSecurity).where(eq(enterpriseSecurity.organizationId, organizationId)).limit(1);
    return result[0];
  }
  
  async getEnterpriseSecuritySettings(): Promise<EnterpriseSecurity[]> {
    return await db.select().from(enterpriseSecurity);
  }
  
  async createEnterpriseSecurity(security: InsertEnterpriseSecurity): Promise<EnterpriseSecurity> {
    const result = await db.insert(enterpriseSecurity).values(security).returning();
    return result[0];
  }
  
  async updateEnterpriseSecurity(organizationId: string, updates: Partial<EnterpriseSecurity>): Promise<EnterpriseSecurity | undefined> {
    const result = await db
      .update(enterpriseSecurity)
      .set(cleanPartial(updates))
      .where(eq(enterpriseSecurity.organizationId, organizationId))
      .returning();
    return result[0];
  }
  
  async deleteEnterpriseSecurity(organizationId: string): Promise<boolean> {
    const result = await db.delete(enterpriseSecurity).where(eq(enterpriseSecurity.organizationId, organizationId)).returning();
    return result.length > 0;
  }
  
  // Audit Logs methods
  async getAuditLog(id: string): Promise<AuditLog | undefined> {
    const result = await db.select().from(auditLogs).where(eq(auditLogs.id, id)).limit(1);
    return result[0];
  }
  
  async getAuditLogs(filters?: { organizationId?: string; userId?: string; resource?: string; action?: string; startDate?: Date; endDate?: Date; limit?: number }): Promise<AuditLog[]> {
    let query = db.select().from(auditLogs);
    
    if (filters?.organizationId) {
      query = query.where(eq(auditLogs.organizationId, filters.organizationId)) as any;
    }
    
    if (filters?.userId) {
      query = query.where(eq(auditLogs.userId, filters.userId)) as any;
    }
    
    if (filters?.resource) {
      query = query.where(eq(auditLogs.resource, filters.resource)) as any;
    }
    
    if (filters?.action) {
      query = query.where(eq(auditLogs.action, filters.action)) as any;
    }
    
    // Note: Date filtering would need gte/lte operators
    
    if (filters?.limit) {
      query = query.limit(filters.limit) as any;
    }
    
    return await query;
  }
  
  async createAuditLog(auditLog: InsertAuditLog): Promise<AuditLog> {
    const result = await db.insert(auditLogs).values(auditLog).returning();
    return result[0];
  }
  
  async deleteOldAuditLogs(retentionDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    // This would need lt operator imported
    // For now, return 0 as a placeholder
    return 0;
  }
  
  // Access Control methods
  async getAccessControl(id: string): Promise<AccessControl | undefined> {
    const result = await db.select().from(accessControls).where(eq(accessControls.id, id)).limit(1);
    return result[0];
  }
  
  async getAccessControls(organizationId: string): Promise<AccessControl[]> {
    return await db.select().from(accessControls).where(eq(accessControls.organizationId, organizationId));
  }
  
  async getAccessControlByRole(organizationId: string, roleName: string): Promise<AccessControl | undefined> {
    const result = await db.select()
      .from(accessControls)
      .where(and(eq(accessControls.organizationId, organizationId), eq(accessControls.roleName, roleName)))
      .limit(1);
    return result[0];
  }
  
  async getUserAccessControls(organizationId: string, userId: string): Promise<AccessControl[]> {
    // This would need a join or more complex logic
    // For now, return empty array as placeholder
    return [];
  }
  
  async createAccessControl(accessControl: InsertAccessControl): Promise<AccessControl> {
    const result = await db.insert(accessControls).values(accessControl).returning();
    return result[0];
  }
  
  async updateAccessControl(id: string, updates: Partial<AccessControl>): Promise<AccessControl | undefined> {
    const result = await db
      .update(accessControls)
      .set(cleanPartial(updates))
      .where(eq(accessControls.id, id))
      .returning();
    return result[0];
  }
  
  async deleteAccessControl(id: string): Promise<boolean> {
    const result = await db.delete(accessControls).where(eq(accessControls.id, id)).returning();
    return result.length > 0;
  }

  // Content Template Methods
  async listTemplates(params?: {status?: string; personaId?: string; includeArchived?: boolean}): Promise<ContentTemplate[]> {
    let query = db.select().from(contentTemplates);
    const conditions: any[] = [];
    
    if (params?.status) {
      conditions.push(eq(contentTemplates.status, params.status));
    }
    if (params?.personaId) {
      conditions.push(eq(contentTemplates.personaId, params.personaId));
    }
    if (!params?.includeArchived) {
      conditions.push(sql`${contentTemplates.archivedAt} IS NULL`);
    }
    
    if (conditions.length > 0) {
      return await query.where(and(...conditions));
    }
    return await query;
  }

  async getTemplateWithRelations(id: string): Promise<{ template: ContentTemplate; versions: TemplateVersion[]; segments: AudienceSegment[]; metrics?: TemplateMetrics[] } | undefined> {
    const template = await db.select().from(contentTemplates).where(eq(contentTemplates.id, id)).limit(1);
    if (!template[0]) return undefined;
    
    const versions = await db.select().from(templateVersions).where(eq(templateVersions.templateId, id));
    
    const segmentJoins = await db.select()
      .from(contentTemplateSegments)
      .innerJoin(audienceSegments, eq(contentTemplateSegments.segmentId, audienceSegments.id))
      .where(eq(contentTemplateSegments.templateId, id));
    
    const segments = segmentJoins.map(j => j.audience_segments);
    
    const metrics = await db.select()
      .from(templateMetrics)
      .where(sql`${templateMetrics.templateVersionId} IN (SELECT id FROM ${templateVersions} WHERE template_id = ${id})`);
    
    return {
      template: template[0],
      versions,
      segments,
      metrics
    };
  }

  async createTemplate(input: InsertContentTemplate & { segmentIds?: string[] }): Promise<ContentTemplate> {
    const { segmentIds, ...templateData } = input;
    
    const result = await db.insert(contentTemplates).values(templateData).returning();
    const template = result[0];
    
    if (segmentIds && segmentIds.length > 0) {
      await this.attachSegments(template.id, segmentIds);
    }
    
    return template;
  }

  async updateTemplate(id: string, updates: Partial<ContentTemplate>): Promise<ContentTemplate | undefined> {
    const cleaned = cleanPartial(updates);
    if (Object.keys(cleaned).length === 0) {
      const result = await db.select().from(contentTemplates).where(eq(contentTemplates.id, id)).limit(1);
      return result[0];
    }
    
    cleaned.updatedAt = new Date();
    const result = await db.update(contentTemplates).set(cleaned).where(eq(contentTemplates.id, id)).returning();
    return result[0];
  }

  async archiveTemplate(id: string): Promise<boolean> {
    const result = await db.update(contentTemplates)
      .set({ archivedAt: new Date(), status: 'archived' })
      .where(eq(contentTemplates.id, id))
      .returning();
    return result.length > 0;
  }

  async attachSegments(templateId: string, segmentIds: string[]): Promise<void> {
    const values = segmentIds.map(segmentId => ({ templateId, segmentId }));
    
    // Use onConflictDoNothing to avoid duplicate errors
    await db.insert(contentTemplateSegments)
      .values(values)
      .onConflictDoNothing();
  }

  async detachSegment(templateId: string, segmentId: string): Promise<boolean> {
    const result = await db.delete(contentTemplateSegments)
      .where(and(
        eq(contentTemplateSegments.templateId, templateId),
        eq(contentTemplateSegments.segmentId, segmentId)
      ))
      .returning();
    return result.length > 0;
  }

  // Template Version Methods
  async createTemplateVersion(input: InsertTemplateVersion & { segmentSnapshotIds?: string[] }): Promise<TemplateVersion> {
    const { segmentSnapshotIds, ...versionData } = input;
    
    // Calculate version number
    const existing = await db.select({ maxVersion: sql<number>`COALESCE(MAX(${templateVersions.versionNumber}), 0)` })
      .from(templateVersions)
      .where(eq(templateVersions.templateId, versionData.templateId));
    
    versionData.versionNumber = (existing[0]?.maxVersion ?? 0) + 1;
    
    // Capture audience snapshot if segment IDs provided
    if (segmentSnapshotIds && segmentSnapshotIds.length > 0) {
      const segments = await db.select()
        .from(audienceSegments)
        .where(sql`${audienceSegments.id} = ANY(${segmentSnapshotIds})`);
      versionData.audienceSnapshot = segments;
    }
    
    // Capture persona snapshot if provided
    if (versionData.templateId) {
      const template = await db.select().from(contentTemplates).where(eq(contentTemplates.id, versionData.templateId)).limit(1);
      if (template[0]?.personaId) {
        const persona = await db.select().from(personas).where(eq(personas.id, template[0].personaId)).limit(1);
        if (persona[0]) {
          versionData.personaSnapshot = persona[0];
        }
      }
    }
    
    const result = await db.insert(templateVersions).values(versionData).returning();
    return result[0];
  }

  async listTemplateVersions(templateId: string, opts?: { includeDrafts?: boolean }): Promise<TemplateVersion[]> {
    if (!opts?.includeDrafts) {
      return await db.select().from(templateVersions)
        .where(and(
          eq(templateVersions.templateId, templateId),
          sql`${templateVersions.publishedAt} IS NOT NULL`
        ));
    }
    return await db.select().from(templateVersions)
      .where(eq(templateVersions.templateId, templateId));
  }

  async getTemplateVersion(versionId: string): Promise<TemplateVersion | undefined> {
    const result = await db.select().from(templateVersions).where(eq(templateVersions.id, versionId)).limit(1);
    return result[0];
  }

  async publishTemplateVersion(templateId: string, versionId: string): Promise<TemplateVersion | undefined> {
    // Set published date on version
    const version = await db.update(templateVersions)
      .set({ publishedAt: new Date() })
      .where(eq(templateVersions.id, versionId))
      .returning();
    
    if (version.length === 0) return undefined;
    
    // Update template's current version
    await db.update(contentTemplates)
      .set({ currentVersionId: versionId, updatedAt: new Date() })
      .where(eq(contentTemplates.id, templateId));
    
    return version[0];
  }

  // Audience Segment Methods
  async listAudienceSegments(filter?: { createdBy?: string; q?: string; includeGlobal?: boolean }): Promise<AudienceSegment[]> {
    let query = db.select().from(audienceSegments);
    const conditions: any[] = [];
    
    if (filter?.createdBy) {
      conditions.push(eq(audienceSegments.createdBy, filter.createdBy));
    }
    if (filter?.q) {
      conditions.push(sql`${audienceSegments.name} ILIKE ${'%' + filter.q + '%'} OR ${audienceSegments.description} ILIKE ${'%' + filter.q + '%'}`);
    }
    if (!filter?.includeGlobal) {
      conditions.push(eq(audienceSegments.isGlobal, false));
    }
    
    if (conditions.length > 0) {
      return await query.where(and(...conditions));
    }
    return await query;
  }

  async getAudienceSegment(id: string): Promise<AudienceSegment | undefined> {
    const result = await db.select().from(audienceSegments).where(eq(audienceSegments.id, id)).limit(1);
    return result[0];
  }

  async createAudienceSegment(input: InsertAudienceSegment): Promise<AudienceSegment> {
    const result = await db.insert(audienceSegments).values(input).returning();
    return result[0];
  }

  async updateAudienceSegment(id: string, updates: Partial<AudienceSegment>): Promise<AudienceSegment | undefined> {
    const cleaned = cleanPartial(updates);
    if (Object.keys(cleaned).length === 0) {
      const result = await db.select().from(audienceSegments).where(eq(audienceSegments.id, id)).limit(1);
      return result[0];
    }
    
    cleaned.updatedAt = new Date();
    const result = await db.update(audienceSegments).set(cleaned).where(eq(audienceSegments.id, id)).returning();
    return result[0];
  }

  async deleteAudienceSegment(id: string): Promise<boolean> {
    // Check if segment is global (protected)
    const segment = await this.getAudienceSegment(id);
    if (segment?.isGlobal) {
      throw new Error("Cannot delete global audience segments");
    }
    
    const result = await db.delete(audienceSegments).where(eq(audienceSegments.id, id)).returning();
    return result.length > 0;
  }

  // Template Metrics Methods
  async recordTemplateMetricEvent(event: { templateVersionId: string; channel: string; eventType: string; value?: number; occurredAt?: Date }): Promise<void> {
    const occurredAt = event.occurredAt || new Date();
    const windowStart = new Date(occurredAt.toISOString().split('T')[0]); // Start of day
    const windowEnd = new Date(windowStart);
    windowEnd.setDate(windowEnd.getDate() + 1); // Next day
    
    const metrics: InsertTemplateMetrics = {
      templateVersionId: event.templateVersionId,
      windowStart: windowStart.toISOString().split('T')[0],
      windowEnd: windowEnd.toISOString().split('T')[0],
      channel: event.channel,
      sends: event.eventType === 'send' ? 1 : 0,
      deliveries: event.eventType === 'delivery' ? 1 : 0,
      opens: event.eventType === 'open' ? 1 : 0,
      clicks: event.eventType === 'click' ? 1 : 0,
      replies: event.eventType === 'reply' ? 1 : 0,
      meetings: event.eventType === 'meeting' ? 1 : 0,
      revenue: event.value || 0
    };
    
    await this.upsertTemplateMetricsWindow(metrics);
  }

  async upsertTemplateMetricsWindow(metrics: InsertTemplateMetrics): Promise<TemplateMetrics> {
    // Try to find existing metrics for this window
    const existing = await db.select()
      .from(templateMetrics)
      .where(and(
        eq(templateMetrics.templateVersionId, metrics.templateVersionId),
        eq(templateMetrics.windowStart, metrics.windowStart as string),
        eq(templateMetrics.channel, metrics.channel)
      ))
      .limit(1);
    
    if (existing[0]) {
      // Update existing metrics (increment counters)
      const updated = {
        sends: (existing[0].sends || 0) + (metrics.sends || 0),
        deliveries: (existing[0].deliveries || 0) + (metrics.deliveries || 0),
        opens: (existing[0].opens || 0) + (metrics.opens || 0),
        clicks: (existing[0].clicks || 0) + (metrics.clicks || 0),
        replies: (existing[0].replies || 0) + (metrics.replies || 0),
        meetings: (existing[0].meetings || 0) + (metrics.meetings || 0),
        revenue: (existing[0].revenue || 0) + (metrics.revenue || 0),
        lastUpdated: new Date()
      };
      
      const result = await db.update(templateMetrics)
        .set(updated)
        .where(eq(templateMetrics.id, existing[0].id))
        .returning();
      return result[0];
    } else {
      // Create new metrics window
      const result = await db.insert(templateMetrics).values(metrics).returning();
      return result[0];
    }
  }

  async getTemplateMetrics(templateId: string, startDate?: string, endDate?: string): Promise<TemplateMetrics[]> {
    const versionIds = await db.select({ id: templateVersions.id })
      .from(templateVersions)
      .where(eq(templateVersions.templateId, templateId));
    
    if (versionIds.length === 0) return [];
    
    const conditions: any[] = [
      sql`${templateMetrics.templateVersionId} = ANY(${versionIds.map(v => v.id)})`
    ];
    
    if (startDate) {
      conditions.push(sql`${templateMetrics.windowStart} >= ${startDate}`);
    }
    if (endDate) {
      conditions.push(sql`${templateMetrics.windowEnd} <= ${endDate}`);
    }
    
    return await db.select()
      .from(templateMetrics)
      .where(and(...conditions));
  }

  // Timing Optimization
  async getTimingOptimization(id: string): Promise<TimingOptimization | undefined> {
    const result = await db.select().from(timingOptimization).where(eq(timingOptimization.id, id)).limit(1);
    return result[0];
  }

  async getTimingOptimizationByContact(contactId: string): Promise<TimingOptimization | undefined> {
    const result = await db.select().from(timingOptimization).where(eq(timingOptimization.contactId, contactId)).limit(1);
    return result[0];
  }

  async createTimingOptimization(timing: InsertTimingOptimization): Promise<TimingOptimization> {
    const result = await db.insert(timingOptimization).values(timing).returning();
    return result[0];
  }

  async updateTimingOptimization(id: string, updates: Partial<TimingOptimization>): Promise<TimingOptimization | undefined> {
    const cleaned = cleanPartial(updates);
    if (Object.keys(cleaned).length === 0) return this.getTimingOptimization(id);
    const result = await db.update(timingOptimization).set({ ...cleaned, updatedAt: new Date() }).where(eq(timingOptimization.id, id)).returning();
    return result[0];
  }

  // Predictive Models
  async getPredictiveModel(id: string): Promise<PredictiveModel | undefined> {
    const result = await db.select().from(predictiveModels).where(eq(predictiveModels.id, id)).limit(1);
    return result[0];
  }

  async getPredictiveModels(modelType?: string): Promise<PredictiveModel[]> {
    if (modelType) {
      return await db.select().from(predictiveModels).where(eq(predictiveModels.modelType, modelType));
    }
    return await db.select().from(predictiveModels);
  }

  async createPredictiveModel(model: InsertPredictiveModel): Promise<PredictiveModel> {
    const result = await db.insert(predictiveModels).values(model).returning();
    return result[0];
  }

  async updatePredictiveModel(id: string, updates: Partial<PredictiveModel>): Promise<PredictiveModel | undefined> {
    const cleaned = cleanPartial(updates);
    if (Object.keys(cleaned).length === 0) return this.getPredictiveModel(id);
    const result = await db.update(predictiveModels).set(cleaned).where(eq(predictiveModels.id, id)).returning();
    return result[0];
  }

  // Pipeline Health
  async getPipelineHealth(id: string): Promise<PipelineHealth | undefined> {
    const result = await db.select().from(pipelineHealth).where(eq(pipelineHealth.id, id)).limit(1);
    return result[0];
  }

  async getLatestPipelineHealth(): Promise<PipelineHealth | undefined> {
    const result = await db.select().from(pipelineHealth).orderBy(desc(pipelineHealth.snapshotDate)).limit(1);
    return result[0];
  }

  async getPipelineHealthHistory(limit: number = 10): Promise<PipelineHealth[]> {
    return await db.select().from(pipelineHealth).orderBy(desc(pipelineHealth.snapshotDate)).limit(limit);
  }

  async createPipelineHealth(health: InsertPipelineHealth): Promise<PipelineHealth> {
    const result = await db.insert(pipelineHealth).values(health).returning();
    return result[0];
  }

  // Deal Forensics
  async getDealForensics(id: string): Promise<DealForensics | undefined> {
    const result = await db.select().from(dealForensics).where(eq(dealForensics.id, id)).limit(1);
    return result[0];
  }

  async getDealForensicsByDealId(dealId: string): Promise<DealForensics[]> {
    return await db.select().from(dealForensics).where(eq(dealForensics.dealId, dealId));
  }

  async getDealForensicsByType(analysisType: string): Promise<DealForensics[]> {
    return await db.select().from(dealForensics).where(eq(dealForensics.analysisType, analysisType));
  }

  async createDealForensics(forensics: InsertDealForensics): Promise<DealForensics> {
    const result = await db.insert(dealForensics).values(forensics).returning();
    return result[0];
  }

  // Revenue Forecasts
  async getRevenueForecast(id: string): Promise<RevenueForecast | undefined> {
    const result = await db.select().from(revenueForecasts).where(eq(revenueForecasts.id, id)).limit(1);
    return result[0];
  }

  async getRevenueForecasts(period?: string): Promise<RevenueForecast[]> {
    if (period) {
      return await db.select().from(revenueForecasts).where(eq(revenueForecasts.forecastPeriod, period)).orderBy(desc(revenueForecasts.createdAt));
    }
    return await db.select().from(revenueForecasts).orderBy(desc(revenueForecasts.createdAt));
  }

  async getLatestForecast(): Promise<RevenueForecast | undefined> {
    const result = await db.select().from(revenueForecasts).orderBy(desc(revenueForecasts.createdAt)).limit(1);
    return result[0];
  }

  async createRevenueForecast(forecast: InsertRevenueForecast): Promise<RevenueForecast> {
    const result = await db.insert(revenueForecasts).values(forecast).returning();
    return result[0];
  }

  // Coaching Insights
  async getCoachingInsight(id: string): Promise<CoachingInsight | undefined> {
    const result = await db.select().from(coachingInsights).where(eq(coachingInsights.id, id)).limit(1);
    return result[0];
  }

  async getCoachingInsights(filters?: { userId?: string; insightType?: string; priority?: string; status?: string }): Promise<CoachingInsight[]> {
    const conditions: any[] = [];
    if (filters?.userId) conditions.push(eq(coachingInsights.userId, filters.userId));
    if (filters?.insightType) conditions.push(eq(coachingInsights.insightType, filters.insightType));
    if (filters?.priority) conditions.push(eq(coachingInsights.priority, filters.priority));
    if (filters?.status) conditions.push(eq(coachingInsights.status, filters.status));
    
    if (conditions.length > 0) {
      return await db.select().from(coachingInsights).where(and(...conditions));
    }
    return await db.select().from(coachingInsights);
  }

  async createCoachingInsight(insight: InsertCoachingInsight): Promise<CoachingInsight> {
    const result = await db.insert(coachingInsights).values(insight).returning();
    return result[0];
  }

  async updateCoachingInsight(id: string, updates: Partial<CoachingInsight>): Promise<CoachingInsight | undefined> {
    const cleaned = cleanPartial(updates);
    if (Object.keys(cleaned).length === 0) return this.getCoachingInsight(id);
    const result = await db.update(coachingInsights).set(cleaned).where(eq(coachingInsights.id, id)).returning();
    return result[0];
  }
}

// Use MemStorage for testing to avoid foreign key constraints
// Otherwise use DbStorage for production
const useMemStorage = process.env.AUTH_TEST_BYPASS === 'true';
export const storage: IStorage = useMemStorage ? new MemStorage() : new DbStorage();

import { apiRequest } from "./queryClient";
import { api as apiHelpers } from "./apiHelpers";

export const api = {
  // Dashboard
  getDashboardStats: () => fetch("/api/dashboard/stats").then(res => res.json()),
  
  // Visitor Intelligence
  getActiveVisitors: () => fetch("/api/visitors/active").then(res => res.json()),
  trackVisitor: async (data: { ipAddress: string; userAgent: string; page: string }) => {
    const response = await apiRequest("POST", "/api/visitors/track", data);
    return response.json();
  },
  
  // Companies
  getCompanies: (limit?: number) => 
    fetch(`/api/companies${limit ? `?limit=${limit}` : ""}`).then(res => res.json()),
  getCompany: (id: string) => fetch(`/api/companies/${id}`).then(res => res.json()),
  createCompany: async (data: any) => {
    const response = await apiRequest("POST", "/api/companies", data);
    return response.json();
  },
  
  // Contacts
  getContacts: (filters?: { companyId?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (filters?.companyId) params.append("companyId", filters.companyId);
    if (filters?.limit) params.append("limit", filters.limit.toString());
    return fetch(`/api/contacts?${params}`).then(res => res.json());
  },
  createContact: async (data: any) => {
    const response = await apiRequest("POST", "/api/contacts", data);
    return response.json();
  },
  
  // Email Analysis
  analyzeEmail: async (emailContent: string) => {
    const response = await apiRequest("POST", "/api/emails/analyze", { emailContent });
    return response.json();
  },
  improveEmail: async (emailContent: string) => {
    const response = await apiRequest("POST", "/api/emails/improve", { emailContent });
    return response.json();
  },
  checkSpam: async (emailContent: string) => {
    const response = await apiRequest("POST", "/api/emails/spam-check", { emailContent });
    return response.json();
  },
  optimizeSubject: async (subject: string) => {
    const response = await apiRequest("POST", "/api/emails/optimize-subject", { subject });
    return response.json();
  },
  categorizeEmail: async (emailContent: string) => {
    const response = await apiRequest("POST", "/api/emails/categorize", { emailContent });
    return response.json();
  },
  
  // Content Generation
  generateContent: async (request: any) => {
    const response = await apiRequest("POST", "/api/content-generation/generate", request);
    return response.json();
  },
  generatePersonalizedEmail: async (context: any) => {
    const response = await apiRequest("POST", "/api/content/personalized-email", context);
    return response.json();
  },
  
  // Sequences
  getSequences: (filters?: { createdBy?: string; status?: string }) => {
    const params = new URLSearchParams();
    if (filters?.createdBy) params.append("createdBy", filters.createdBy);
    if (filters?.status) params.append("status", filters.status);
    return fetch(`/api/sequences?${params}`).then(res => res.json());
  },
  createSequence: async (data: any) => {
    const response = await apiRequest("POST", "/api/sequences", data);
    return response.json();
  },
  generateSequenceSteps: async (data: { personaId: string; sequenceType: string; stepCount?: number }) => {
    const response = await apiRequest("POST", "/api/sequences/generate-steps", data);
    return response.json();
  },
  
  // Insights
  getInsights: (filters?: { companyId?: string; type?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (filters?.companyId) params.append("companyId", filters.companyId);
    if (filters?.type) params.append("type", filters.type);
    if (filters?.limit) params.append("limit", filters.limit.toString());
    return fetch(`/api/insights?${params}`).then(res => res.json());
  },
  discoverInsights: async () => {
    const response = await apiRequest("POST", "/api/insights/discover", {});
    return response.json();
  },
  getInsightRecommendations: (insightId: string) =>
    fetch(`/api/insights/${insightId}/recommendations`).then(res => res.json()),
  
  // Personas
  getPersonas: (createdBy?: string) => {
    const params = createdBy ? `?createdBy=${createdBy}` : "";
    return fetch(`/api/personas${params}`).then(res => res.json());
  },
  createPersona: async (data: any) => {
    const response = await apiRequest("POST", "/api/personas", data);
    return response.json();
  },
  updatePersona: async (id: string, data: any) => {
    const response = await apiRequest("PUT", `/api/personas/${id}`, data);
    return response.json();
  },
  deletePersona: async (id: string) => {
    const response = await apiRequest("DELETE", `/api/personas/${id}`, {});
    return response.json();
  },
  
  // Tasks
  getTasks: (filters?: { assignedTo?: string; status?: string; priority?: string }) => {
    const params = new URLSearchParams();
    if (filters?.assignedTo) params.append("assignedTo", filters.assignedTo);
    if (filters?.status) params.append("status", filters.status);
    if (filters?.priority) params.append("priority", filters.priority);
    return fetch(`/api/tasks?${params}`).then(res => res.json());
  },
  createTask: async (data: any) => {
    const response = await apiRequest("POST", "/api/tasks", data);
    return response.json();
  },
  updateTask: async (id: string, data: any) => {
    const response = await apiRequest("PATCH", `/api/tasks/${id}`, data);
    return response.json();
  },
  
  // Phone Calls
  initiateCall: async (data: { contactId: string; userId: string; scriptType: string }) => {
    return apiHelpers.post("/api/calls/initiate", data);
  },
  startCallCampaign: async (data: { contactIds: string[]; userId: string; scriptType: string }) => {
    return apiHelpers.post("/api/calls/campaign", data);
  },
  getCallAnalytics: (userId?: string) => {
    const params = userId ? `?userId=${userId}` : "";
    return fetch(`/api/calls/analytics${params}`).then(res => res.json());
  },
  getPhoneCalls: (filters?: { contactId?: string; userId?: string; status?: string }) => {
    const params = new URLSearchParams();
    if (filters?.contactId) params.append("contactId", filters.contactId);
    if (filters?.userId) params.append("userId", filters.userId);
    if (filters?.status) params.append("status", filters.status);
    return fetch(`/api/calls?${params}`).then(res => res.json());
  },
  getPhoneCall: (id: string) => fetch(`/api/calls/${id}`).then(res => res.json()),
  getCallScripts: (filters?: { type?: string; personaId?: string }) => {
    const params = new URLSearchParams();
    if (filters?.type) params.append("type", filters.type);
    if (filters?.personaId) params.append("personaId", filters.personaId);
    return fetch(`/api/call-scripts?${params}`).then(res => res.json());
  },
  generateCallScript: async (data: { type: string; contactId?: string }) => {
    return apiHelpers.post("/api/call-scripts/generate", data);
  },
  getVoicemails: (filters?: { contactId?: string; isListened?: boolean }) => {
    const params = new URLSearchParams();
    if (filters?.contactId) params.append("contactId", filters.contactId);
    if (filters?.isListened !== undefined) params.append("isListened", String(filters.isListened));
    return fetch(`/api/voicemails?${params}`).then(res => res.json());
  },
  
  // Deliverability APIs
  getDomainHealth: (domain: string) =>
    fetch(`/api/deliverability/domain-health/${domain}`).then(res => res.json()),
  getWarmingStatus: (domain: string) =>
    fetch(`/api/deliverability/warming-status/${domain}`).then(res => res.json()),
  getInboxPlacement: () =>
    fetch("/api/deliverability/inbox-placement").then(res => res.json()),
  updateWarmingSettings: async (settings: { enabled: boolean; speed: string }) => {
    const response = await apiRequest("POST", "/api/deliverability/warming-settings", settings);
    return response.json();
  },
  verifyDomain: async (domain: string) => {
    const response = await apiRequest("POST", "/api/deliverability/verify-domain", { domain });
    return response.json();
  },
  
  // AI Agents APIs
  getAgentMetrics: () =>
    fetch("/api/agents/metrics").then(res => res.json()),
  getAgents: () =>
    fetch("/api/agents").then(res => res.json()),
  createAgent: async (data: any) => {
    const response = await apiRequest("POST", "/api/agents", data);
    return response.json();
  },
  updateAgent: async (id: string, data: any) => {
    const response = await apiRequest("PATCH", `/api/agents/${id}`, data);
    return response.json();
  },
  deleteAgent: async (id: string) => {
    const response = await apiRequest("DELETE", `/api/agents/${id}`, {});
    return response.json();
  },
    
  // Onboarding APIs
  getOnboardingProfile: () =>
    fetch("/api/onboarding/profile").then(res => res.json()),
  createOnboardingProfile: async (data: any) => {
    const response = await apiRequest("POST", "/api/onboarding/profile", data);
    return response.json();
  },
  updateOnboardingProfile: async (data: any) => {
    const response = await apiRequest("PATCH", "/api/onboarding/profile", data);
    return response.json();
  },
  autoConfigureOnboarding: async (data: any) => {
    const response = await apiRequest("POST", "/api/onboarding/auto-configure", data);
    return response.json();
  },
  applyOnboardingConfig: async (data: any) => {
    const response = await apiRequest("POST", "/api/onboarding/apply-config", data);
    return response.json();
  },
};

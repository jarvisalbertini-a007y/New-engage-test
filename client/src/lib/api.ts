import { apiRequest } from "./queryClient";

export const api = {
  // Dashboard
  getDashboardStats: () => fetch("/api/dashboard/stats").then(res => res.json()),
  
  // Visitor Intelligence
  getActiveVisitors: () => fetch("/api/visitors/active").then(res => res.json()),
  trackVisitor: (data: { ipAddress: string; userAgent: string; page: string }) =>
    apiRequest("POST", "/api/visitors/track", data),
  
  // Companies
  getCompanies: (limit?: number) => 
    fetch(`/api/companies${limit ? `?limit=${limit}` : ""}`).then(res => res.json()),
  getCompany: (id: string) => fetch(`/api/companies/${id}`).then(res => res.json()),
  createCompany: (data: any) => apiRequest("POST", "/api/companies", data),
  
  // Contacts
  getContacts: (filters?: { companyId?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (filters?.companyId) params.append("companyId", filters.companyId);
    if (filters?.limit) params.append("limit", filters.limit.toString());
    return fetch(`/api/contacts?${params}`).then(res => res.json());
  },
  createContact: (data: any) => apiRequest("POST", "/api/contacts", data),
  
  // Email Analysis
  analyzeEmail: (emailContent: string) =>
    apiRequest("POST", "/api/emails/analyze", { emailContent }),
  improveEmail: (emailContent: string) =>
    apiRequest("POST", "/api/emails/improve", { emailContent }),
  checkSpam: (emailContent: string) =>
    apiRequest("POST", "/api/emails/spam-check", { emailContent }),
  optimizeSubject: (subject: string) =>
    apiRequest("POST", "/api/emails/optimize-subject", { subject }),
  categorizeEmail: (emailContent: string) =>
    apiRequest("POST", "/api/emails/categorize", { emailContent }),
  
  // Content Generation
  generateContent: (request: any) =>
    apiRequest("POST", "/api/content/generate", request),
  generatePersonalizedEmail: (context: any) =>
    apiRequest("POST", "/api/content/personalized-email", context),
  
  // Sequences
  getSequences: (filters?: { createdBy?: string; status?: string }) => {
    const params = new URLSearchParams();
    if (filters?.createdBy) params.append("createdBy", filters.createdBy);
    if (filters?.status) params.append("status", filters.status);
    return fetch(`/api/sequences?${params}`).then(res => res.json());
  },
  createSequence: (data: any) => apiRequest("POST", "/api/sequences", data),
  generateSequenceSteps: (data: { personaId: string; sequenceType: string; stepCount?: number }) =>
    apiRequest("POST", "/api/sequences/generate-steps", data),
  
  // Insights
  getInsights: (filters?: { companyId?: string; type?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (filters?.companyId) params.append("companyId", filters.companyId);
    if (filters?.type) params.append("type", filters.type);
    if (filters?.limit) params.append("limit", filters.limit.toString());
    return fetch(`/api/insights?${params}`).then(res => res.json());
  },
  discoverInsights: () => apiRequest("POST", "/api/insights/discover", {}),
  getInsightRecommendations: (insightId: string) =>
    fetch(`/api/insights/${insightId}/recommendations`).then(res => res.json()),
  
  // Personas
  getPersonas: (createdBy?: string) => {
    const params = createdBy ? `?createdBy=${createdBy}` : "";
    return fetch(`/api/personas${params}`).then(res => res.json());
  },
  createPersona: (data: any) => apiRequest("POST", "/api/personas", data),
  
  // Tasks
  getTasks: (filters?: { assignedTo?: string; status?: string; priority?: string }) => {
    const params = new URLSearchParams();
    if (filters?.assignedTo) params.append("assignedTo", filters.assignedTo);
    if (filters?.status) params.append("status", filters.status);
    if (filters?.priority) params.append("priority", filters.priority);
    return fetch(`/api/tasks?${params}`).then(res => res.json());
  },
  createTask: (data: any) => apiRequest("POST", "/api/tasks", data),
  updateTask: (id: string, data: any) => apiRequest("PATCH", `/api/tasks/${id}`, data),
};

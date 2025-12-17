const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

function getToken(): string | null {
  return localStorage.getItem('token');
}

async function apiRequest(method: string, endpoint: string, data?: any) {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || error.message || 'Request failed');
  }

  return response.json();
}

export const api = {
  // Auth
  login: (email: string, password: string) => 
    apiRequest('POST', '/api/auth/login', { email, password }),
  register: (data: { email: string; password: string; firstName?: string; lastName?: string; companyName?: string }) => 
    apiRequest('POST', '/api/auth/register', data),
  getMe: () => apiRequest('GET', '/api/auth/me'),
  updateMe: (data: any) => apiRequest('PUT', '/api/auth/me', data),

  // Onboarding
  getOnboardingProfile: () => apiRequest('GET', '/api/onboarding/profile'),
  updateOnboardingProfile: (data: any) => apiRequest('PUT', '/api/onboarding/profile', data),
  researchCompany: (data: { domain?: string; companyName?: string }) => 
    apiRequest('POST', '/api/onboarding/research-company', data),
  approveIcp: (icp: any) => apiRequest('POST', '/api/onboarding/approve-icp', icp),
  approveStrategy: (strategy: any) => apiRequest('POST', '/api/onboarding/approve-strategy', strategy),
  completeOnboarding: () => apiRequest('POST', '/api/onboarding/complete', {}),

  // Agents
  getAgentCategories: () => apiRequest('GET', '/api/agents/categories'),
  getAgentTemplates: (filters?: { category?: string; tier?: string; search?: string }) => {
    const params = new URLSearchParams();
    if (filters?.category) params.append('category', filters.category);
    if (filters?.tier) params.append('tier', filters.tier);
    if (filters?.search) params.append('search', filters.search);
    return apiRequest('GET', `/api/agents/templates?${params}`);
  },
  getAgents: (filters?: { status?: string; category?: string }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.category) params.append('category', filters.category);
    return apiRequest('GET', `/api/agents?${params}`);
  },
  createAgent: (data: any) => apiRequest('POST', '/api/agents', data),
  updateAgent: (id: string, data: any) => apiRequest('PUT', `/api/agents/${id}`, data),
  deleteAgent: (id: string) => apiRequest('DELETE', `/api/agents/${id}`),
  executeAgent: (id: string, input: any) => apiRequest('POST', `/api/agents/${id}/execute`, input),
  getAgentMetrics: () => apiRequest('GET', '/api/agents/metrics/summary'),

  // Workflows
  getWorkflows: (filters?: { status?: string; category?: string }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.category) params.append('category', filters.category);
    return apiRequest('GET', `/api/workflows?${params}`);
  },
  createWorkflow: (data: any) => apiRequest('POST', '/api/workflows', data),
  updateWorkflow: (id: string, data: any) => apiRequest('PUT', `/api/workflows/${id}`, data),
  deleteWorkflow: (id: string) => apiRequest('DELETE', `/api/workflows/${id}`),
  executeWorkflow: (id: string, context?: any) => apiRequest('POST', `/api/workflows/${id}/execute`, context || {}),
  generateWorkflow: (description: string) => apiRequest('POST', '/api/workflows/generate', { description }),

  // Prospects
  getProspects: (filters?: { status?: string; companyId?: string; search?: string }) => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.companyId) params.append('companyId', filters.companyId);
    if (filters?.search) params.append('search', filters.search);
    return apiRequest('GET', `/api/prospects?${params}`);
  },
  createProspect: (data: any) => apiRequest('POST', '/api/prospects', data),
  updateProspect: (id: string, data: any) => apiRequest('PUT', `/api/prospects/${id}`, data),
  deleteProspect: (id: string) => apiRequest('DELETE', `/api/prospects/${id}`),
  getCompanies: () => apiRequest('GET', '/api/prospects/companies'),
  createCompany: (data: any) => apiRequest('POST', '/api/prospects/companies', data),

  // Content
  generateContent: (data: { type: string; context?: any; prospect?: any; tone?: string }) => 
    apiRequest('POST', '/api/content/generate', data),
  getContentTemplates: (type?: string) => {
    const params = type ? `?type=${type}` : '';
    return apiRequest('GET', `/api/content/templates${params}`);
  },

  // Command Center
  executeCommand: (command: string, context?: any) => 
    apiRequest('POST', '/api/command/execute', { command, context }),
  getCommandSuggestions: () => apiRequest('GET', '/api/command/suggestions'),
  getCommandHistory: (limit?: number) => 
    apiRequest('GET', `/api/command/history${limit ? `?limit=${limit}` : ''}`),

  // Health
  healthCheck: () => apiRequest('GET', '/api/health'),

  // Universal Chat
  sendChatMessage: (data: { message: string; sessionId: string; context?: any }) =>
    apiRequest('POST', '/api/chat/message', data),
  getChatSessions: () => apiRequest('GET', '/api/chat/sessions'),
  selectAgentFromChat: (data: { agentType: string; task?: string }) =>
    apiRequest('POST', '/api/chat/agents/select', data),

  // Micro Agents
  getMicroAgentTypes: () => apiRequest('GET', '/api/micro-agents/types'),
  executeMicroAgent: (data: { type: string; input: any; model?: string }) =>
    apiRequest('POST', '/api/micro-agents/execute', data),
  executeMicroAgentChain: (data: { chain: any[]; input: any }) =>
    apiRequest('POST', '/api/micro-agents/chain', data),
  getMicroAgentStats: () => apiRequest('GET', '/api/micro-agents/stats'),

  // Knowledge Base
  uploadKnowledge: (formData: FormData) => {
    const token = localStorage.getItem('token');
    return fetch(`${API_BASE}/api/knowledge/upload`, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: formData
    }).then(r => r.json());
  },
  listKnowledge: (category?: string) => {
    const params = category ? `?category=${category}` : '';
    return apiRequest('GET', `/api/knowledge${params}`);
  },
  queryKnowledge: (query: string, categories?: string[]) =>
    apiRequest('POST', '/api/knowledge/query', { query, categories }),
  createCustomInstruction: (data: any) =>
    apiRequest('POST', '/api/knowledge/instructions', data),
  listCustomInstructions: () => apiRequest('GET', '/api/knowledge/instructions'),

  // Workflow Templates
  getWorkflowTemplates: (category?: string, complexity?: string) => {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (complexity) params.append('complexity', complexity);
    return apiRequest('GET', `/api/workflow-templates/templates?${params}`);
  },
  cloneWorkflowTemplate: (templateId: string, data: { name: string; settings?: any }) =>
    apiRequest('POST', `/api/workflow-templates/templates/${templateId}/clone`, data),
  getPendingApprovals: () => apiRequest('GET', '/api/workflow-templates/approvals'),
  respondToApproval: (approvalId: string, data: { action: string; comment?: string }) =>
    apiRequest('POST', `/api/workflow-templates/approvals/${approvalId}/respond`, data),
  generateWorkflowFromNlp: (description: string) =>
    apiRequest('POST', '/api/workflow-templates/generate-from-nlp', { description }),

  // Smart Onboarding
  startSmartOnboarding: (data?: { email?: string }) =>
    apiRequest('POST', '/api/smart-onboarding/start', data || {}),
  getSmartOnboardingSession: () => apiRequest('GET', '/api/smart-onboarding/session'),
  approveSmartOnboarding: (data: any) =>
    apiRequest('POST', '/api/smart-onboarding/approve', data),
  refreshSmartOnboardingResearch: () =>
    apiRequest('POST', '/api/smart-onboarding/refresh-research', {}),

  // Knowledge Base - Additional methods
  deleteKnowledge: (id: string) => apiRequest('DELETE', `/api/knowledge/${id}`),
  getKnowledgeDocument: (id: string) => apiRequest('GET', `/api/knowledge/${id}`),

  // Settings
  getSettings: () => apiRequest('GET', '/api/settings'),
  updateSettings: (section: string, data: any) => 
    apiRequest('PUT', `/api/settings/${section}`, data),

  // Agent Teams
  getAgentTeams: () => apiRequest('GET', '/api/agent-teams'),
  createAgentTeam: (data: any) => apiRequest('POST', '/api/agent-teams', data),
  updateAgentTeam: (id: string, data: any) => apiRequest('PUT', `/api/agent-teams/${id}`, data),
  deleteAgentTeam: (id: string) => apiRequest('DELETE', `/api/agent-teams/${id}`),

  // Autonomous Mode
  getAutonomousStatus: () => apiRequest('GET', '/api/settings/autonomous/status'),
  setAutonomousMode: (enabled: boolean) => 
    apiRequest('POST', '/api/settings/autonomous/toggle', { enabled }),
  getAutonomousActivity: () => apiRequest('GET', '/api/settings/autonomous/activity'),

  // Execution Engine
  executeAction: (action: string, params: any) =>
    apiRequest('POST', '/api/execute/execute-action', { action, params }),
  startAutonomous: () => apiRequest('POST', '/api/execute/autonomous/start', {}),
  stopAutonomous: () => apiRequest('POST', '/api/execute/autonomous/stop', {}),
  getExecutionActivity: () => apiRequest('GET', '/api/execute/autonomous/activity'),

  // A/B Testing
  createAbTest: (data: any) => apiRequest('POST', '/api/execute/ab-test/create', data),
  getAbTests: () => apiRequest('GET', '/api/execute/ab-tests'),
  getOptimizationLog: () => apiRequest('GET', '/api/execute/optimization-log'),

  // Real Integrations
  getIntegrations: () => apiRequest('GET', '/api/integrations/integrations'),
  saveSendgridIntegration: (data: { api_key: string; from_email: string }) =>
    apiRequest('POST', '/api/integrations/integrations/sendgrid', data),
  removeSendgridIntegration: () => apiRequest('DELETE', '/api/integrations/integrations/sendgrid'),
  
  // Real Lead Search
  searchRealLeads: (criteria: string, count?: number) =>
    apiRequest('POST', '/api/integrations/search-leads', { criteria, count }),
  
  // Company Scraping
  scrapeCompany: (domain: string, company?: string) =>
    apiRequest('POST', '/api/integrations/scrape-company', { domain, company }),
  
  // Send Email
  sendEmail: (data: { to: string; subject: string; body: string; prospectId?: string }) =>
    apiRequest('POST', '/api/integrations/email/send', data),
  
  // Email Analytics
  getEmailAnalytics: () => apiRequest('GET', '/api/integrations/email/analytics'),
};

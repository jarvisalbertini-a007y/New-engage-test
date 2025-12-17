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
};

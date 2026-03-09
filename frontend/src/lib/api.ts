const API_BASE = process.env.REACT_APP_BACKEND_URL || '';

function getToken(): string | null {
  return localStorage.getItem('token');
}

function buildRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `req-${crypto.randomUUID()}`;
  }
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function apiRequest(method: string, endpoint: string, data?: any) {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Request-Id': buildRequestId(),
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
    const errorPayload = await response.json().catch(() => ({ detail: 'Request failed' }));
    const detail = errorPayload?.detail;
    const detailObject = detail && typeof detail === 'object' ? detail : null;

    const message =
      (typeof detail === 'string' && detail) ||
      (typeof detailObject?.message === 'string' && detailObject.message) ||
      (typeof detailObject?.error === 'string' && detailObject.error) ||
      (typeof errorPayload?.message === 'string' && errorPayload.message) ||
      'Request failed';

    const apiError: any = new Error(message);
    apiError.status = response.status;
    apiError.payload = errorPayload;
    if (typeof detailObject?.errorCode === 'string') {
      apiError.errorCode = detailObject.errorCode;
    }
    const parseFiniteNumber = (value: unknown): number | undefined => {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) {
        return undefined;
      }
      return parsed;
    };
    const validationField =
      typeof detailObject?.field === 'string' && detailObject.field.trim()
        ? detailObject.field.trim()
        : undefined;
    const validationReason =
      typeof detailObject?.reason === 'string' && detailObject.reason.trim()
        ? detailObject.reason.trim()
        : undefined;
    const validationMinimum = parseFiniteNumber(
      detailObject?.minimum ?? detailObject?.min
    );
    const validationMaximum = parseFiniteNumber(
      detailObject?.maximum ?? detailObject?.max
    );
    const hasValidationReceived =
      !!detailObject && typeof detailObject === 'object' && 'received' in detailObject;
    const validationReceived = hasValidationReceived
      ? (detailObject as Record<string, unknown>).received
      : undefined;
    if (validationField) {
      apiError.field = validationField;
    }
    if (validationReason) {
      apiError.reason = validationReason;
    }
    if (validationMinimum !== undefined) {
      apiError.minimum = validationMinimum;
      apiError.min = validationMinimum;
    }
    if (validationMaximum !== undefined) {
      apiError.maximum = validationMaximum;
      apiError.max = validationMaximum;
    }
    if (hasValidationReceived) {
      apiError.received = validationReceived;
    }
    const validationDetail: Record<string, unknown> = {};
    if (validationField) {
      validationDetail.field = validationField;
    }
    if (validationReason) {
      validationDetail.reason = validationReason;
    }
    if (validationMinimum !== undefined) {
      validationDetail.minimum = validationMinimum;
    }
    if (validationMaximum !== undefined) {
      validationDetail.maximum = validationMaximum;
    }
    if (hasValidationReceived) {
      validationDetail.received = validationReceived;
    }
    if (Object.keys(validationDetail).length > 0) {
      apiError.validation = validationDetail;
    }
    const detailRateLimit =
      detailObject?.rateLimit && typeof detailObject.rateLimit === 'object'
        ? { ...detailObject.rateLimit }
        : undefined;

    const retryFromDetail = Number(detailObject?.retryAfterSeconds);
    const parseHeaderNumber = (headerName: string): number => {
      const rawValue = response.headers?.get?.(headerName);
      if (rawValue == null || String(rawValue).trim() === '') {
        return Number.NaN;
      }
      const parsed = Number(rawValue);
      return Number.isFinite(parsed) ? parsed : Number.NaN;
    };
    const headerLimit = parseHeaderNumber('X-RateLimit-Limit');
    const headerRemaining = parseHeaderNumber('X-RateLimit-Remaining');
    const headerWindowSeconds = parseHeaderNumber('X-RateLimit-Window-Seconds');
    const headerResetInSeconds = parseHeaderNumber('X-RateLimit-Reset-In-Seconds');
    const headerResetAt = response.headers?.get?.('X-RateLimit-Reset-At');
    if (detailRateLimit) {
      apiError.rateLimit = detailRateLimit;
    }
    if (
      Number.isFinite(headerLimit) ||
      Number.isFinite(headerRemaining) ||
      Number.isFinite(headerWindowSeconds) ||
      Number.isFinite(headerResetInSeconds) ||
      headerResetAt
    ) {
      apiError.rateLimit = {
        ...(apiError.rateLimit || {}),
      };
      if (Number.isFinite(headerLimit)) {
        apiError.rateLimit.limit = Math.round(headerLimit);
      }
      if (Number.isFinite(headerRemaining)) {
        apiError.rateLimit.remaining = Math.max(0, Math.round(headerRemaining));
      }
      if (Number.isFinite(headerWindowSeconds)) {
        apiError.rateLimit.windowSeconds = Math.max(1, Math.round(headerWindowSeconds));
      }
      if (Number.isFinite(headerResetInSeconds)) {
        apiError.rateLimit.resetInSeconds = Math.max(0, Math.round(headerResetInSeconds));
      }
      if (typeof headerResetAt === 'string' && headerResetAt.trim()) {
        apiError.rateLimit.resetAt = headerResetAt.trim();
      }
    }
    if (Number.isFinite(retryFromDetail) && retryFromDetail > 0) {
      apiError.retryAfterSeconds = Math.round(retryFromDetail);
    } else {
      const retryAfterHeader = response.headers?.get?.('Retry-After');
      const retryFromHeader = Number(retryAfterHeader);
      if (Number.isFinite(retryFromHeader) && retryFromHeader > 0) {
        apiError.retryAfterSeconds = Math.round(retryFromHeader);
      } else if (Number.isFinite(headerResetInSeconds) && headerResetInSeconds > 0) {
        apiError.retryAfterSeconds = Math.round(headerResetInSeconds);
      }
    }
    throw apiError;
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

  // Sales Intelligence
  getPhraseAnalytics: (params?: { windowDays?: number; minExposure?: number; limit?: number; query?: string }) => {
    const query = new URLSearchParams();
    if (params?.windowDays) query.append('window_days', String(params.windowDays));
    if (params?.minExposure) query.append('min_exposure', String(params.minExposure));
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.query) query.append('query', params.query);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return apiRequest('GET', `/api/sales-intelligence/analytics/phrases${suffix}`);
  },
  getPhraseChannelSummary: (params?: {
    windowDays?: number;
    minExposure?: number;
    limit?: number;
    channels?: string[];
  }) => {
    const query = new URLSearchParams();
    if (params?.windowDays) query.append('window_days', String(params.windowDays));
    if (params?.minExposure) query.append('min_exposure', String(params.minExposure));
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.channels?.length) query.append('channels', params.channels.join(','));
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return apiRequest('GET', `/api/sales-intelligence/analytics/phrases/channel-summary${suffix}`);
  },
  predictResponse: (data: {
    message: string;
    channel?: string;
    sendTime?: string;
    prospect?: any;
  }) => apiRequest('POST', '/api/sales-intelligence/prediction/response', data),
  recordPredictionFeedback: (data: {
    predictionId?: string;
    predictedProbability: number;
    outcome: string;
    channel?: string;
    responseLatencyHours?: number;
  }) => apiRequest('POST', '/api/sales-intelligence/prediction/feedback', data),
  getPredictionPerformance: (params?: { windowDays?: number }) => {
    const query = new URLSearchParams();
    if (params?.windowDays) query.append('window_days', String(params.windowDays));
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return apiRequest('GET', `/api/sales-intelligence/prediction/performance${suffix}`);
  },
  getPredictionPerformanceReport: (params?: { windowDays?: number }) => {
    const query = new URLSearchParams();
    if (params?.windowDays) query.append('window_days', String(params.windowDays));
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return apiRequest('GET', `/api/sales-intelligence/prediction/performance/report${suffix}`);
  },
  getPredictionFeedbackHistory: (params?: { windowDays?: number; limit?: number }) => {
    const query = new URLSearchParams();
    if (params?.windowDays) query.append('window_days', String(params.windowDays));
    if (params?.limit) query.append('limit', String(params.limit));
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return apiRequest('GET', `/api/sales-intelligence/prediction/feedback/history${suffix}`);
  },

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
  getIntegrationsHealth: () => apiRequest('GET', '/api/integrations/integrations/health'),
  getIntegrationsTelemetrySummary: (
    days?: number,
    limit?: number,
    packetOnlyRecentEvents?: boolean,
    statusFilters?: {
      governanceStatus?: string | null;
      packetValidationStatus?: string | null;
    }
  ) => {
    const query = new URLSearchParams();
    query.append('days', String(days || 7));
    query.append('limit', String(limit || 1000));
    if (typeof packetOnlyRecentEvents === 'boolean') {
      query.append(
        'packet_only_recent_events',
        packetOnlyRecentEvents ? 'true' : 'false'
      );
    }
    if (typeof statusFilters?.governanceStatus === 'string' && statusFilters.governanceStatus.trim()) {
      query.append('governance_status', statusFilters.governanceStatus.trim());
    }
    if (
      typeof statusFilters?.packetValidationStatus === 'string'
      && statusFilters.packetValidationStatus.trim()
    ) {
      query.append(
        'packet_validation_status',
        statusFilters.packetValidationStatus.trim()
      );
    }
    return apiRequest(
      'GET',
      `/api/integrations/integrations/telemetry/summary?${query.toString()}`
    );
  },
  getIntegrationsTelemetrySnapshotGovernance: (retentionDays?: number) =>
    apiRequest(
      'GET',
      `/api/integrations/integrations/telemetry/snapshot-governance?retention_days=${retentionDays || 30}`
    ),
  getIntegrationsBaselineGovernance: () =>
    apiRequest(
      'GET',
      '/api/integrations/integrations/telemetry/baseline-governance'
    ),
  getIntegrationsGovernanceReport: (days?: number, limit?: number) =>
    apiRequest(
      'GET',
      `/api/integrations/integrations/telemetry/governance-report?days=${days || 7}&limit=${limit || 1000}`
    ),
  getIntegrationsGovernanceReportExport: (days?: number, limit?: number) =>
    apiRequest(
      'GET',
      `/api/integrations/integrations/telemetry/governance-report/export?days=${days || 7}&limit=${limit || 1000}`
    ),
  getIntegrationsGovernanceReportHistory: (retentionDays?: number, limit?: number) =>
    apiRequest(
      'GET',
      `/api/integrations/integrations/telemetry/governance-report/history?retention_days=${retentionDays || 30}&limit=${limit || 50}`
    ),
  getIntegrationsGovernanceSchema: () =>
    apiRequest(
      'GET',
      '/api/integrations/integrations/telemetry/governance-schema'
    ),
  getIntegrationsSloGates: (params?: {
    days?: number;
    limit?: number;
    maxErrorRatePct?: number;
    minSchemaV2Pct?: number;
    minSchemaV2SampleCount?: number;
    maxOrchestrationAttemptErrorCount?: number;
    maxOrchestrationAttemptSkippedCount?: number;
  }) => {
    const query = new URLSearchParams();
    query.append('days', String(params?.days || 7));
    query.append('limit', String(params?.limit || 2000));
    if (params?.maxErrorRatePct !== undefined) {
      query.append('max_error_rate_pct', String(params.maxErrorRatePct));
    }
    if (params?.minSchemaV2Pct !== undefined) {
      query.append('min_schema_v2_pct', String(params.minSchemaV2Pct));
    }
    if (params?.minSchemaV2SampleCount !== undefined) {
      query.append('min_schema_v2_sample_count', String(params.minSchemaV2SampleCount));
    }
    if (params?.maxOrchestrationAttemptErrorCount !== undefined) {
      query.append(
        'max_orchestration_attempt_error_count',
        String(params.maxOrchestrationAttemptErrorCount)
      );
    }
    if (params?.maxOrchestrationAttemptSkippedCount !== undefined) {
      query.append(
        'max_orchestration_attempt_skipped_count',
        String(params.maxOrchestrationAttemptSkippedCount)
      );
    }
    return apiRequest('GET', `/api/integrations/integrations/telemetry/slo-gates?${query.toString()}`);
  },
  saveSendgridIntegration: (data: { api_key: string; from_email: string }) =>
    apiRequest('POST', '/api/integrations/integrations/sendgrid', data),
  saveApolloIntegration: (data: { api_key: string }) =>
    apiRequest('POST', '/api/integrations/integrations/apollo', data),
  saveClearbitIntegration: (data: { api_key: string }) =>
    apiRequest('POST', '/api/integrations/integrations/clearbit', data),
  saveCrunchbaseIntegration: (data: { api_key: string }) =>
    apiRequest('POST', '/api/integrations/integrations/crunchbase', data),
  removeSendgridIntegration: () => apiRequest('DELETE', '/api/integrations/integrations/sendgrid'),
  removeApolloIntegration: () => apiRequest('DELETE', '/api/integrations/integrations/apollo'),
  removeClearbitIntegration: () => apiRequest('DELETE', '/api/integrations/integrations/clearbit'),
  removeCrunchbaseIntegration: () => apiRequest('DELETE', '/api/integrations/integrations/crunchbase'),
  apolloSearchProspects: (data: {
    query?: string;
    title?: string;
    domain?: string;
    limit?: number;
    page?: number;
    saveResults?: boolean;
  }) => apiRequest('POST', '/api/integrations/providers/apollo/search', data),
  apolloEnrichCompany: (data: {
    domain?: string;
    companyName?: string;
    limit?: number;
    saveResearch?: boolean;
  }) => apiRequest('POST', '/api/integrations/providers/apollo/company', data),
  clearbitEnrichCompany: (data: {
    domain: string;
    saveResearch?: boolean;
  }) => apiRequest('POST', '/api/integrations/providers/clearbit/company', data),
  crunchbaseEnrichCompany: (data: {
    domain?: string;
    companyName?: string;
    limit?: number;
    saveResearch?: boolean;
  }) => apiRequest('POST', '/api/integrations/providers/crunchbase/company', data),
  orchestrateCompanyEnrichment: (data: {
    domain?: string;
    companyName?: string;
    limit?: number;
    saveResearch?: boolean;
    stopOnFirstMatch?: boolean;
    providerOrder?: string[];
  }) => apiRequest('POST', '/api/integrations/providers/company-enrichment', data),
  
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

  // Google Integration
  getGoogleStatus: () => apiRequest('GET', '/api/google/status'),
  initGoogleOAuth: () => apiRequest('POST', '/api/google/oauth/init', {}),
  disconnectGoogle: () => apiRequest('DELETE', '/api/google/oauth/disconnect'),
  
  // Gmail
  sendGmail: (data: { to: string; subject: string; body: string; htmlBody?: string; prospectId?: string }) =>
    apiRequest('POST', '/api/google/gmail/send', data),
  getGmailInbox: (maxResults?: number, query?: string) =>
    apiRequest('GET', `/api/google/gmail/inbox?max_results=${maxResults || 20}&query=${query || ''}`),
  getGmailThreads: (prospectEmail: string) =>
    apiRequest('GET', `/api/google/gmail/threads?prospect_email=${prospectEmail}`),
  trackGmailReplies: () => apiRequest('GET', '/api/google/gmail/track-replies'),
  
  // Google Calendar
  getCalendarEvents: (days?: number) =>
    apiRequest('GET', `/api/google/calendar/events?days=${days || 7}`),
  scheduleMeeting: (data: { 
    summary: string; 
    attendeeEmail: string; 
    startTime: string; 
    durationMinutes?: number;
    description?: string;
    prospectId?: string;
  }) => apiRequest('POST', '/api/google/calendar/schedule', data),
  
  // Google Contacts
  getGoogleContacts: () => apiRequest('GET', '/api/google/contacts'),
  syncContactsToProspects: () => apiRequest('POST', '/api/google/contacts/sync-to-prospects'),

  // Autonomous Prospecting
  startAutonomousProspecting: (config?: { 
    prospectsPerCycle?: number; 
    learningEnabled?: boolean;
    autoApprove?: boolean;
    maxCyclesPerDay?: number;
  }) => apiRequest('POST', '/api/autonomous/start', config || {}),
  stopAutonomousProspecting: () => apiRequest('POST', '/api/autonomous/stop', {}),
  getAutonomousProspectingStatus: () => apiRequest('GET', '/api/autonomous/status'),
  getLearnings: (limit?: number) => 
    apiRequest('GET', `/api/autonomous/learnings?limit=${limit || 20}`),
  getCompetitorSources: () => apiRequest('GET', '/api/autonomous/competitor-sources'),
  getRunHistory: (limit?: number) =>
    apiRequest('GET', `/api/autonomous/history?limit=${limit || 20}`),
  
  // Individual Loops
  runDiscoveryLoop: (params: { count?: number; context?: string }) =>
    apiRequest('POST', '/api/autonomous/loops/discovery', params),
  runResearchLoop: (params: { prospectIds?: string[]; count?: number }) =>
    apiRequest('POST', '/api/autonomous/loops/research', params),
  runOutreachLoop: (params: { prospectIds?: string[]; count?: number }) =>
    apiRequest('POST', '/api/autonomous/loops/outreach', params),
  runLearningLoop: (params?: any) =>
    apiRequest('POST', '/api/autonomous/loops/learning', params || {}),

  // Scheduled Runs
  createScheduledRun: (data: {
    name?: string;
    scheduleType?: string;
    runTime?: string;
    daysOfWeek?: number[];
    timezone?: string;
    config?: any;
  }) => apiRequest('POST', '/api/autonomous/schedule', data),
  getScheduledRuns: () => apiRequest('GET', '/api/autonomous/schedules'),
  updateScheduledRun: (scheduleId: string, data: any) =>
    apiRequest('PUT', `/api/autonomous/schedule/${scheduleId}`, data),
  deleteScheduledRun: (scheduleId: string) =>
    apiRequest('DELETE', `/api/autonomous/schedule/${scheduleId}`),
  runScheduleNow: (scheduleId: string) =>
    apiRequest('POST', `/api/autonomous/schedule/${scheduleId}/run-now`, {}),

  // Approval Workflow
  getAutonomousApprovals: () => apiRequest('GET', '/api/autonomous/pending-approvals'),
  approveEmailDraft: (draftId: string, data: { action: string; reason?: string; editedContent?: any }) =>
    apiRequest('POST', `/api/autonomous/approve/${draftId}`, data),
  sendApprovedEmail: (draftId: string, data: { provider: string }) =>
    apiRequest('POST', `/api/autonomous/send-approved/${draftId}`, data),
  bulkApproveEmails: (data: { draftIds: string[]; action: string }) =>
    apiRequest('POST', '/api/autonomous/bulk-approve', data),

  // Email Optimization & A/B Testing
  trackEmailOpen: (data: { emailId: string; draftId?: string; variationId?: string }) =>
    apiRequest('POST', '/api/email-optimization/track/open', data),
  trackEmailClick: (data: { emailId: string; draftId?: string; variationId?: string; linkUrl?: string }) =>
    apiRequest('POST', '/api/email-optimization/track/click', data),
  trackEmailReply: (data: { emailId: string; draftId?: string; variationId?: string; sentiment?: string }) =>
    apiRequest('POST', '/api/email-optimization/track/reply', data),
  
  // A/B Testing
  createABTest: (data: {
    name?: string;
    testType: string;
    draftId?: string;
    subject?: string;
    body?: string;
    variationCount?: number;
    autoSelectWinner?: boolean;
    winnerCriteria?: string;
  }) => apiRequest('POST', '/api/email-optimization/ab-test/create', data),
  getABTest: (testId: string) => apiRequest('GET', `/api/email-optimization/ab-test/${testId}`),
  listABTests: (status?: string) => 
    apiRequest('GET', `/api/email-optimization/ab-tests${status ? `?status=${status}` : ''}`),
  selectABTestWinner: (testId: string, winnerId?: string) =>
    apiRequest('POST', `/api/email-optimization/ab-test/${testId}/select-winner`, { winnerId }),
  
  // Email Optimization
  optimizeEmail: (data: {
    subject: string;
    body: string;
    industry?: string;
    title?: string;
    focus?: string;
  }) => apiRequest('POST', '/api/email-optimization/optimize', data),
  getOptimizationInsights: () => apiRequest('GET', '/api/email-optimization/insights'),
  autoOptimizeDraft: (draftId: string, applyChanges?: boolean) =>
    apiRequest('POST', '/api/email-optimization/auto-optimize-draft', { draftId, applyChanges }),
  autoCreateABTest: (draftId: string, testType?: string) =>
    apiRequest('POST', '/api/email-optimization/auto-create-test', { draftId, testType }),
  getOptimizationHistory: (limit?: number) =>
    apiRequest('GET', `/api/email-optimization/optimization-history?limit=${limit || 20}`),

  // Email Templates
  getTemplateCategories: () => apiRequest('GET', '/api/email-templates/templates/categories'),
  getTemplates: (category?: string) => 
    apiRequest('GET', `/api/email-templates/templates${category ? `?category=${category}` : ''}`),
  getTemplate: (templateId: string) => 
    apiRequest('GET', `/api/email-templates/templates/${templateId}`),
  createTemplate: (data: {
    name: string;
    description?: string;
    category: string;
    subject: string;
    body: string;
    bestFor?: string[];
  }) => apiRequest('POST', '/api/email-templates/templates', data),
  updateTemplate: (templateId: string, data: any) =>
    apiRequest('PUT', `/api/email-templates/templates/${templateId}`, data),
  deleteTemplate: (templateId: string) =>
    apiRequest('DELETE', `/api/email-templates/templates/${templateId}`),
  personalizeTemplate: (templateId: string, data: { prospectId?: string; variables?: any }) =>
    apiRequest('POST', `/api/email-templates/templates/${templateId}/personalize`, data),
  generateTemplate: (data: {
    description: string;
    category?: string;
    tone?: string;
    targetAudience?: string;
    goal?: string;
  }) => apiRequest('POST', '/api/email-templates/templates/generate', data),
  createDraftFromTemplate: (templateId: string, data: { prospectId: string; variables?: any }) =>
    apiRequest('POST', `/api/email-templates/templates/${templateId}/create-draft`, data),

  // Self-Improvement
  getSelfImprovementStatus: () => apiRequest('GET', '/api/self-improvement/status'),
  runPerformanceAnalysis: () => apiRequest('POST', '/api/self-improvement/analyze', {}),
  applyLearningsToEmail: (data: { subject: string; body: string; draftId?: string }) =>
    apiRequest('POST', '/api/self-improvement/apply-to-draft', data),
  getImprovementRules: (activeOnly?: boolean) =>
    apiRequest('GET', `/api/self-improvement/rules?active_only=${activeOnly !== false}`),
  updateImprovementRule: (ruleId: string, data: { active?: boolean; priority?: string; target?: number }) =>
    apiRequest('PUT', `/api/self-improvement/rules/${ruleId}`, data),
  getWinningPhrases: () => apiRequest('GET', '/api/self-improvement/phrases'),
  getImprovementHistory: (limit?: number) =>
    apiRequest('GET', `/api/self-improvement/improvement-history?limit=${limit || 20}`),
  submitImprovementFeedback: (data: { draftId: string; outcome: string; gotReply?: boolean; notes?: string }) =>
    apiRequest('POST', '/api/self-improvement/feedback', data),

  // Multi-Agent
  getAgentTypes: () => apiRequest('GET', '/api/multi-agent/types'),
  executeSingleAgent: (data: { agentType: string; task: string; context?: any }) =>
    apiRequest('POST', '/api/multi-agent/execute-single', data),
  executeMultiAgentTask: (data: { goal: string; async?: boolean }) =>
    apiRequest('POST', '/api/multi-agent/execute-multi', data),
  getMultiAgentTask: (taskId: string) => apiRequest('GET', `/api/multi-agent/task/${taskId}`),
  listMultiAgentTasks: (status?: string) =>
    apiRequest('GET', `/api/multi-agent/tasks${status ? `?status=${status}` : ''}`),
  createCustomAgentTeam: (data: { name: string; description?: string; agents: string[] }) =>
    apiRequest('POST', '/api/multi-agent/team/create', data),
  getCustomTeams: () => apiRequest('GET', '/api/multi-agent/teams'),
  executeAgentTeam: (teamId: string, data: { goal: string; inputs?: any }) =>
    apiRequest('POST', `/api/multi-agent/team/${teamId}/execute`, data),
  getAgentExecutionHistory: (agentType?: string, limit?: number) =>
    apiRequest('GET', `/api/multi-agent/history?${agentType ? `agent_type=${agentType}&` : ''}limit=${limit || 20}`),
  agentChat: (data: { agentType: string; message: string; sessionId?: string }) =>
    apiRequest('POST', '/api/multi-agent/chat', data),

  // AI Orchestration (New Primary Interface)
  aiChat: (data: { message?: string; sessionId?: string; approvePlanId?: string; rejectPlanId?: string }) =>
    apiRequest('POST', '/api/ai/chat', data),
  getAIAgents: () => apiRequest('GET', '/api/ai/agents'),
  getAISession: (sessionId: string) => apiRequest('GET', `/api/ai/session/${sessionId}`),
  getAISessions: () => apiRequest('GET', '/api/ai/sessions'),
  getPendingPlans: () => apiRequest('GET', '/api/ai/plans/pending'),
  getActivePlans: () => apiRequest('GET', '/api/ai/plans/active'),
  getPlanStatus: (planId: string) => apiRequest('GET', `/api/ai/plan/${planId}`),
  pausePlan: (planId: string) => apiRequest('POST', `/api/ai/plan/${planId}/pause`, {}),
  resumePlan: (planId: string) => apiRequest('POST', `/api/ai/plan/${planId}/resume`, {}),
  quickAction: (data: { agentId: string; task: string }) =>
    apiRequest('POST', '/api/ai/quick-action', data),
  getRecentActivity: (limit?: number) =>
    apiRequest('GET', `/api/ai/activity/recent?limit=${limit || 20}`),
  getSuggestions: (context?: string) =>
    apiRequest('POST', '/api/ai/suggest', { context }),
  
  // Knowledge Base Integration
  autoIngestKnowledge: (data: { content: string; category?: string; source?: string; name?: string }) =>
    apiRequest('POST', '/api/ai/knowledge/auto-ingest', data),
  searchKnowledge: (query: string, limit?: number) =>
    apiRequest('GET', `/api/ai/knowledge/search?query=${encodeURIComponent(query)}&limit=${limit || 5}`),
  queryKnowledgeRAG: (data: { query: string; categories?: string[] }) =>
    apiRequest('POST', '/api/ai/knowledge/query-rag', data),
  
  // Conversation History
  listConversationSessions: (limit?: number) =>
    apiRequest('GET', `/api/ai/sessions/list?limit=${limit || 20}`),
  getSessionMessages: (sessionId: string) =>
    apiRequest('GET', `/api/ai/session/${sessionId}/messages`),
  deleteSession: (sessionId: string) =>
    apiRequest('DELETE', `/api/ai/session/${sessionId}`),
  createNewSession: () =>
    apiRequest('POST', '/api/ai/session/new', {}),
  
  // AI Workflow & Approval Integration
  aiCreateWorkflow: (data: { description: string; name?: string }) =>
    apiRequest('POST', '/api/ai/create-workflow', data),
  getUnifiedApprovals: () =>
    apiRequest('GET', '/api/ai/pending-approvals-unified'),
  approveUnifiedItem: (itemId: string, data: { type: string; action: string; comment?: string }) =>
    apiRequest('POST', `/api/ai/approve-item/${itemId}`, data),
  
  // Document Upload for Knowledge Base
  uploadKnowledgeDocument: (data: { content: string; filename: string; name?: string; category?: string; description?: string; contentType?: string }) =>
    apiRequest('POST', '/api/ai/knowledge/upload', data),
  
  // Voice Input (placeholder)
  transcribeVoice: (data: { audio: string }) =>
    apiRequest('POST', '/api/ai/voice/transcribe', data),
  
  // AI Stats
  getAIStats: () =>
    apiRequest('GET', '/api/ai/stats'),

  // ============== AUTONOMOUS JOBS ==============
  
  // Job Management
  createJob: (data: { jobType: string; config: any; priority?: string; autoStart?: boolean; scheduledTime?: string }) =>
    apiRequest('POST', '/api/jobs/jobs/create', data),
  getJobs: (status?: string, jobType?: string, limit?: number) => {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (jobType) params.append('job_type', jobType);
    if (limit) params.append('limit', limit.toString());
    return apiRequest('GET', `/api/jobs/jobs?${params}`);
  },
  getJob: (jobId: string) =>
    apiRequest('GET', `/api/jobs/jobs/${jobId}`),
  startJob: (jobId: string) =>
    apiRequest('POST', `/api/jobs/jobs/${jobId}/start`, {}),
  pauseJob: (jobId: string) =>
    apiRequest('POST', `/api/jobs/jobs/${jobId}/pause`, {}),
  cancelJob: (jobId: string) =>
    apiRequest('POST', `/api/jobs/jobs/${jobId}/cancel`, {}),
  getRunningJobsCount: () =>
    apiRequest('GET', '/api/jobs/jobs/running/count'),
  
  // Autonomy Preferences
  getAutonomyPreferences: () =>
    apiRequest('GET', '/api/jobs/autonomy/preferences'),
  updateAutonomyPreferences: (data: { default?: string; preferences?: Record<string, string>; notifications?: { inApp?: boolean; email?: boolean } }) =>
    apiRequest('PUT', '/api/jobs/autonomy/preferences', data),
  askAutonomyPreference: (data: { jobType: string; taskDescription?: string }) =>
    apiRequest('POST', '/api/jobs/autonomy/ask-preference', data),
  
  // Quick Start Actions
  quickStartResearch: (data: { targets: any[]; depth?: string }) =>
    apiRequest('POST', '/api/jobs/quick-start/research', data),
  quickStartOutreach: (data: { prospects: any[]; templateId?: string; goal?: string }) =>
    apiRequest('POST', '/api/jobs/quick-start/outreach', data),
  quickStartFollowUp: (data: { daysSinceContact?: number; maxProspects?: number }) =>
    apiRequest('POST', '/api/jobs/quick-start/follow-up', data),
  
  // Job Analytics
  getJobAnalytics: () =>
    apiRequest('GET', '/api/jobs/analytics/summary'),

  // ============== AGENT LEARNING ==============
  
  // Learning History
  getLearningHistory: (agentType?: string, limit?: number) => {
    const params = new URLSearchParams();
    if (agentType) params.append('agent_type', agentType);
    if (limit) params.append('limit', limit.toString());
    return apiRequest('GET', `/api/jobs/learning/history?${params}`);
  },
  recordLearning: (data: { agentType: string; learningType: string; category: string; summary: string; details?: any; impact?: string }) =>
    apiRequest('POST', '/api/jobs/learning/record', data),
  getLearningSummary: () =>
    apiRequest('GET', '/api/jobs/learning/summary'),
  getAgentLearnings: (agentType: string) =>
    apiRequest('GET', `/api/jobs/learning/agent/${agentType}`),
  addLearningFeedback: (learningId: string, data: { feedback?: string; rating?: string }) =>
    apiRequest('PUT', `/api/jobs/learning/${learningId}/feedback`, data),

  // Agent Customization
  getAgentCustomization: () =>
    apiRequest('GET', '/api/jobs/agents/customization'),
  updateAgentCustomization: (data: { agents?: Record<string, any>; globalSettings?: any }) =>
    apiRequest('PUT', '/api/jobs/agents/customization', data),
  customizeAgentNLP: (data: { instruction: string; agentType?: string }) =>
    apiRequest('POST', '/api/jobs/agents/customize-nlp', data),
  getCustomizationHistory: () =>
    apiRequest('GET', '/api/jobs/agents/customization-history'),

  // ============== AGENT TEAMS ==============
  
  getTeamTemplates: () =>
    apiRequest('GET', '/api/agent-teams/templates'),
  getTeams: (status?: string) => {
    const params = status ? `?status=${status}` : '';
    return apiRequest('GET', `/api/agent-teams${params}`);
  },
  getTeam: (teamId: string) =>
    apiRequest('GET', `/api/agent-teams/${teamId}`),
  createTeam: (data: { name: string; description?: string; agents?: any[]; templateId?: string }) =>
    apiRequest('POST', '/api/agent-teams', data),
  updateTeam: (teamId: string, data: any) =>
    apiRequest('PUT', `/api/agent-teams/${teamId}`, data),
  deleteTeam: (teamId: string) =>
    apiRequest('DELETE', `/api/agent-teams/${teamId}`),
  activateTeam: (teamId: string) =>
    apiRequest('POST', `/api/agent-teams/${teamId}/activate`, {}),
  pauseTeam: (teamId: string) =>
    apiRequest('POST', `/api/agent-teams/${teamId}/pause`, {}),
  executeTeam: (teamId: string, data: { task: string; prospectIds?: string[]; context?: any }) =>
    apiRequest('POST', `/api/agent-teams/${teamId}/execute`, data),
  executeTeamParallel: (teamId: string, data: { task: string; prospectIds?: string[]; context?: any }) =>
    apiRequest('POST', `/api/agent-teams/${teamId}/execute-parallel`, data),
  getTeamExecutions: (teamId: string) =>
    apiRequest('GET', `/api/agent-teams/${teamId}/executions`),
  getAllExecutions: (status?: string, limit?: number) => {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (limit) params.append('limit', limit.toString());
    return apiRequest('GET', `/api/agent-teams/executions/all?${params}`);
  },
  getTeamsAnalytics: () =>
    apiRequest('GET', '/api/agent-teams/analytics/summary'),

  // ============== LEAD SCORING ==============
  
  scoreProspect: (data: { prospectId?: string; prospect?: any }) =>
    apiRequest('POST', '/api/lead-scoring/score', data),
  scoreProspectsBatch: (data: { prospectIds?: string[] }) =>
    apiRequest('POST', '/api/lead-scoring/score-batch', data),
  getScoringConfig: () =>
    apiRequest('GET', '/api/lead-scoring/config'),
  updateScoringConfig: (data: any) =>
    apiRequest('PUT', '/api/lead-scoring/config', data),
  updateFactorWeight: (factor: string, weight: number) =>
    apiRequest('PUT', `/api/lead-scoring/config/factor/${factor}`, { weight }),
  getTopLeads: (limit?: number, minScore?: number) => {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (minScore) params.append('min_score', minScore.toString());
    return apiRequest('GET', `/api/lead-scoring/top-leads?${params}`);
  },
  getScoreDistribution: () =>
    apiRequest('GET', '/api/lead-scoring/distribution'),
  recordOutcome: (data: { prospectId: string; outcome: string; dealValue?: number; notes?: string }) =>
    apiRequest('POST', '/api/lead-scoring/learn', data),
  getModelAccuracy: () =>
    apiRequest('GET', '/api/lead-scoring/model-accuracy'),
  getScoringRecommendations: () =>
    apiRequest('GET', '/api/lead-scoring/recommendations'),

  // ============== A/B TESTING ==============
  
  createSalesABTest: (data: any) =>
    apiRequest('POST', '/api/ab-testing/tests', data),
  getABTests: (status?: string, testType?: string, limit?: number) => {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (testType) params.append('test_type', testType);
    if (limit) params.append('limit', limit.toString());
    return apiRequest('GET', `/api/ab-testing/tests?${params}`);
  },
  getSalesABTest: (testId: string) =>
    apiRequest('GET', `/api/ab-testing/tests/${testId}`),
  startABTest: (testId: string) =>
    apiRequest('POST', `/api/ab-testing/tests/${testId}/start`, {}),
  pauseABTest: (testId: string) =>
    apiRequest('POST', `/api/ab-testing/tests/${testId}/pause`, {}),
  resumeABTest: (testId: string) =>
    apiRequest('POST', `/api/ab-testing/tests/${testId}/resume`, {}),
  completeABTest: (testId: string) =>
    apiRequest('POST', `/api/ab-testing/tests/${testId}/complete`, {}),
  recordABTestEvent: (testId: string, data: { variant: string; eventType: string; prospectId?: string }) =>
    apiRequest('POST', `/api/ab-testing/tests/${testId}/record-event`, data),
  deleteABTest: (testId: string) =>
    apiRequest('DELETE', `/api/ab-testing/tests/${testId}`),
  getABTestingAnalytics: () =>
    apiRequest('GET', '/api/ab-testing/analytics/summary'),
  getABLearnings: (testType?: string, limit?: number) => {
    const params = new URLSearchParams();
    if (testType) params.append('test_type', testType);
    if (limit) params.append('limit', limit.toString());
    return apiRequest('GET', `/api/ab-testing/learnings?${params}`);
  },
  suggestABTest: (data: { goal?: string }) =>
    apiRequest('POST', '/api/ab-testing/suggest-test', data),
  quickCreateABTest: (data: { suggestionType: string; prospectIds?: string[]; autoApplyWinner?: boolean }) =>
    apiRequest('POST', '/api/ab-testing/quick-create', data),

  // ============== SALES INTELLIGENCE ==============
  getPipelineForecast: (windowDays?: number) =>
    apiRequest('GET', `/api/sales-intelligence/forecast/pipeline${windowDays ? `?window_days=${windowDays}` : ''}`),
  getConversationIntelligence: (options?: { limit?: number; windowDays?: number }) => {
    const params = new URLSearchParams();
    if (options?.windowDays) params.append('window_days', options.windowDays.toString());
    if (options?.limit) params.append('limit', options.limit.toString());
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return apiRequest('GET', `/api/sales-intelligence/conversation/intelligence${suffix}`);
  },
  getMultiChannelEngagement: (
    options?: { windowDays?: number; campaignLimit?: number; abTestLimit?: number; prospectLimit?: number }
  ) => {
    const params = new URLSearchParams();
    if (options?.windowDays) params.append('window_days', options.windowDays.toString());
    if (options?.campaignLimit) params.append('campaign_limit', options.campaignLimit.toString());
    if (options?.abTestLimit) params.append('ab_test_limit', options.abTestLimit.toString());
    if (options?.prospectLimit) params.append('prospect_limit', options.prospectLimit.toString());
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return apiRequest('GET', `/api/sales-intelligence/engagement/multi-channel${suffix}`);
  },
  getRelationshipMap: (options?: { windowDays?: number; limit?: number }) => {
    const params = new URLSearchParams();
    if (options?.windowDays) params.append('window_days', options.windowDays.toString());
    if (options?.limit) params.append('limit', options.limit.toString());
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return apiRequest('GET', `/api/sales-intelligence/relationships/map${suffix}`);
  },
  getSalesCampaigns: (status?: string) =>
    apiRequest('GET', `/api/sales-intelligence/campaigns${status ? `?status=${status}` : ''}`),
  getSalesCampaign: (campaignId: string) =>
    apiRequest('GET', `/api/sales-intelligence/campaigns/${campaignId}`),
  getSalesCampaignPerformance: (
    campaignId: string,
    options?: { channelLimit?: number }
  ) => {
    const params = new URLSearchParams();
    if (options?.channelLimit) params.append('channel_limit', options.channelLimit.toString());
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return apiRequest('GET', `/api/sales-intelligence/campaigns/${campaignId}/performance${suffix}`);
  },
  getSalesCampaignPortfolio: (options?: { windowDays?: number; status?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (options?.windowDays) params.append('window_days', options.windowDays.toString());
    if (options?.status) params.append('status', options.status);
    if (options?.limit) params.append('limit', options.limit.toString());
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return apiRequest('GET', `/api/sales-intelligence/campaigns/performance/portfolio${suffix}`);
  },
  createSalesCampaign: (data: { name: string; objective?: string; targetSegment?: string; channels: string[] }) =>
    apiRequest('POST', '/api/sales-intelligence/campaigns', data),
  activateSalesCampaign: (campaignId: string) =>
    apiRequest('POST', `/api/sales-intelligence/campaigns/${campaignId}/activate`, {}),
  recordSalesCampaignMetrics: (campaignId: string, data: { channel: string; sent?: number; opened?: number; replied?: number }) =>
    apiRequest('POST', `/api/sales-intelligence/campaigns/${campaignId}/metrics`, data),
};

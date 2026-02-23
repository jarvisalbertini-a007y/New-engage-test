import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { api } from '../lib/api';

interface CampaignSummary {
  campaignId: string;
  name: string;
  status: string;
  totals: { sent: number; opened: number; replied: number };
  overall: { openRate: number; replyRate: number; qualityTier: string };
}

interface CampaignPortfolioResponse {
  campaignCount: number;
  activeCampaignCount: number;
  portfolioTotals: { sent: number; opened: number; replied: number };
  averageReplyRate: number;
  rankedCampaigns: CampaignSummary[];
}

interface CampaignPerformanceResponse {
  campaignId: string;
  name: string;
  status: string;
  totals: { sent: number; opened: number; replied: number };
  overall: { openRate: number; replyRate: number; replyToOpenRate: number; qualityTier: string };
  byChannel: Array<{ channel: string; sent: number; opened: number; replied: number; openRate: number; replyRate: number }>;
  recommendations: string[];
}

interface IntegrationTelemetrySummaryResponse {
  generatedAt?: string;
  windowDays?: number;
  eventCount: number;
  errorEventCount: number;
  byProvider: Record<string, number>;
  bySchemaVersion?: Record<string, number>;
  trendByDay?: Array<{
    date: string;
    events: number;
    errors: number;
    salesIntelligenceEvents: number;
  }>;
  salesIntelligence?: {
    eventCount: number;
    byEventFamily: Record<string, number>;
    bySchemaVersion?: Record<string, number>;
    trendByDay?: Array<Record<string, any>>;
  };
  traceabilityAudit?: {
    eventCount: number;
    decisionCounts?: Record<string, number>;
    readyCount?: number;
    notReadyCount?: number;
    latestEvaluatedAt?: string | null;
  };
  recentEvents?: Array<{
    eventType?: string;
    provider?: string;
    createdAt?: string;
    schemaVersion?: number | string | null;
    requestId?: string | null;
    traceabilityDecision?: string | null;
    traceabilityReady?: boolean | null;
  }>;
}

interface IntegrationTelemetrySnapshotGovernanceResponse {
  generatedAt: string;
  retentionDays: number;
  status: 'READY' | 'ACTION_REQUIRED' | string;
  snapshot: {
    directory: string;
    prefix: string;
    fileCount: number;
    latestFile?: string | null;
    latestGeneratedAt?: string | null;
    ageDays?: number | null;
    withinRetention: boolean;
    staleCount: number;
  };
  releaseGateFixtures: {
    allProfilesAvailable: boolean;
    missingProfiles: string[];
  };
  alerts: string[];
}

interface IntegrationBaselineGovernanceResponse {
  generatedAt: string;
  artifactGeneratedAt?: string | null;
  artifactPath: string;
  overallStatus?: string;
  status: 'PASS' | 'FAIL' | string;
  releaseGateFixturePolicy: {
    passed: boolean;
    requiredProfiles: string[];
    missingProfiles: string[];
    message?: string | null;
  };
  releaseGateFixtures: {
    allProfilesAvailable: boolean;
    availableProfileCount?: number;
    profileCount?: number;
  };
}

interface IntegrationSloProviderResult {
  thresholdP95Ms: number;
  observedP95Ms: number | null;
  sampleCount: number;
  passed: boolean;
}

interface IntegrationSloGateResponse {
  generatedAt: string;
  windowDays: number;
  eventCount: number;
  decision: 'PROCEED' | 'HOLD' | string;
  gates: {
    overallPassed: boolean;
    errorRatePassed: boolean;
    latencyPassed: boolean;
    schemaCoveragePassed?: boolean;
    schemaSampleSizePassed?: boolean;
  };
  errorRate: {
    thresholdPct: number;
    observedPct: number;
    errorEvents: number;
  };
  schemaCoverage?: {
    thresholdPct: number;
    observedPct: number;
    sampleCount: number;
    minSampleCount?: number;
    schemaV2Count: number;
  };
  providerLatency: Record<string, IntegrationSloProviderResult>;
  alerts: Array<{
    gate: string;
    severity: string;
    provider?: string;
    message: string;
  }>;
  rolloutActions: Array<{
    priority: string;
    ownerRole: string;
    action: string;
    trigger: string;
  }>;
  signoff: {
    status: string;
    requiredEvidence?: string[];
    requiredApprovals?: Array<{ role: string; required: boolean }>;
  };
}

type ConnectorProvider = 'apollo' | 'clearbit' | 'crunchbase';
type ConnectorLookupProvider = 'orchestration' | ConnectorProvider;

interface IntegrationHealthProvider {
  provider: string;
  healthy: boolean;
  statusCode: number | null;
  latencyMs: number | null;
  error: string | null;
}

interface IntegrationHealthResponse {
  generatedAt: string;
  providers: IntegrationHealthProvider[];
}

interface ConnectorLookupResult {
  provider?: string;
  selectedProvider?: string;
  resultCount?: number;
  found?: boolean;
  savedCount?: number;
  attempts?: Array<{ provider: string; status: string; reason?: string; resultCount?: number }>;
  companies?: Array<Record<string, any>>;
  company?: Record<string, any> | null;
}

interface ApolloProspectLookupResult {
  provider?: string;
  resultCount?: number;
  savedCount?: number;
  prospects?: Array<Record<string, any>>;
}

type UiNoticeTone = 'success' | 'error' | 'info';
interface UiNotice {
  tone: UiNoticeTone;
  message: string;
}

function getErrorMessage(error: unknown): string {
  if (!error) return '';
  if (error instanceof Error) return error.message;
  return String(error);
}

function isFeatureDisabledError(error: unknown): boolean {
  return getErrorMessage(error).toLowerCase().includes('disabled by feature flag');
}

function formatTimestamp(value?: string): string {
  if (!value) return 'n/a';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

export default function Integrations() {
  const [sendgridKey, setSendgridKey] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [showSendgridForm, setShowSendgridForm] = useState(false);
  const [activeConnectorForm, setActiveConnectorForm] = useState<ConnectorProvider | null>(null);
  const [connectorApiKey, setConnectorApiKey] = useState('');
  const [lookupProvider, setLookupProvider] = useState<ConnectorLookupProvider>('orchestration');
  const [lookupDomain, setLookupDomain] = useState('');
  const [lookupCompanyName, setLookupCompanyName] = useState('');
  const [lookupLimit, setLookupLimit] = useState(10);
  const [saveLookupResearch, setSaveLookupResearch] = useState(false);
  const [companyLookupResult, setCompanyLookupResult] = useState<ConnectorLookupResult | null>(null);
  const [companyLookupError, setCompanyLookupError] = useState('');
  const [apolloQuery, setApolloQuery] = useState('');
  const [apolloTitle, setApolloTitle] = useState('');
  const [apolloDomain, setApolloDomain] = useState('');
  const [apolloLimit, setApolloLimit] = useState(25);
  const [saveApolloProspects, setSaveApolloProspects] = useState(false);
  const [apolloLookupResult, setApolloLookupResult] = useState<ApolloProspectLookupResult | null>(null);
  const [apolloLookupError, setApolloLookupError] = useState('');
  const [telemetryDaysInput, setTelemetryDaysInput] = useState(7);
  const [telemetryLimitInput, setTelemetryLimitInput] = useState(500);
  const [telemetryParams, setTelemetryParams] = useState({ days: 7, limit: 500 });
  const [snapshotRetentionDaysInput, setSnapshotRetentionDaysInput] = useState(30);
  const [snapshotRetentionDays, setSnapshotRetentionDays] = useState(30);
  const [sloDaysInput, setSloDaysInput] = useState(7);
  const [sloErrorThresholdInput, setSloErrorThresholdInput] = useState(5);
  const [sloSchemaThresholdInput, setSloSchemaThresholdInput] = useState(95);
  const [sloSchemaSampleCountInput, setSloSchemaSampleCountInput] = useState(25);
  const [sloParams, setSloParams] = useState({
    days: 7,
    maxErrorRatePct: 5,
    minSchemaV2Pct: 95,
    minSchemaV2SampleCount: 25
  });
  const [uiNotice, setUiNotice] = useState<UiNotice | null>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const queryClient = useQueryClient();

  const { data: integrations, isLoading } = useQuery({
    queryKey: ['integrations'],
    queryFn: () => api.getIntegrations()
  });

  const { data: googleStatus } = useQuery({
    queryKey: ['googleStatus'],
    queryFn: () => api.getGoogleStatus()
  });

  const {
    data: integrationsHealth,
  } = useQuery({
    queryKey: ['integrations-health'],
    queryFn: () => api.getIntegrationsHealth() as Promise<IntegrationHealthResponse>,
    retry: false
  });

  const {
    data: campaignPortfolio,
    isLoading: isCampaignPortfolioLoading,
    error: campaignPortfolioError
  } = useQuery({
    queryKey: ['sales-campaign-portfolio', 90, 'active', 10],
    queryFn: () => api.getSalesCampaignPortfolio({ windowDays: 90, status: 'active', limit: 10 }) as Promise<CampaignPortfolioResponse>,
    retry: false
  });

  const {
    data: campaignPerformance,
    isLoading: isCampaignPerformanceLoading,
    error: campaignPerformanceError
  } = useQuery({
    queryKey: ['sales-campaign-performance', selectedCampaignId],
    queryFn: () => api.getSalesCampaignPerformance(selectedCampaignId) as Promise<CampaignPerformanceResponse>,
    enabled: !!selectedCampaignId,
    retry: false
  });

  const {
    data: telemetrySummary,
    isLoading: isTelemetryLoading,
    error: telemetryError
  } = useQuery({
    queryKey: ['integrations-telemetry-summary', telemetryParams.days, telemetryParams.limit],
    queryFn: () =>
      api.getIntegrationsTelemetrySummary(
        telemetryParams.days,
        telemetryParams.limit
      ) as Promise<IntegrationTelemetrySummaryResponse>,
    retry: false
  });

  const {
    data: snapshotGovernance,
    isLoading: isSnapshotGovernanceLoading,
    error: snapshotGovernanceError,
  } = useQuery({
    queryKey: ['integrations-telemetry-governance', snapshotRetentionDays],
    queryFn: () =>
      api.getIntegrationsTelemetrySnapshotGovernance(
        snapshotRetentionDays
      ) as Promise<IntegrationTelemetrySnapshotGovernanceResponse>,
    retry: false,
  });

  const {
    data: baselineGovernance,
    isLoading: isBaselineGovernanceLoading,
    error: baselineGovernanceError,
  } = useQuery({
    queryKey: ['integrations-baseline-governance'],
    queryFn: () =>
      api.getIntegrationsBaselineGovernance() as Promise<IntegrationBaselineGovernanceResponse>,
    retry: false,
  });

  const {
    data: sloGates,
    isLoading: isSloGatesLoading,
    error: sloGatesError,
  } = useQuery({
    queryKey: [
      'integrations-slo-gates',
      sloParams.days,
      sloParams.maxErrorRatePct,
      sloParams.minSchemaV2Pct,
      sloParams.minSchemaV2SampleCount
    ],
    queryFn: () =>
      api.getIntegrationsSloGates({
        days: sloParams.days,
        limit: 2000,
        maxErrorRatePct: sloParams.maxErrorRatePct,
        minSchemaV2Pct: sloParams.minSchemaV2Pct,
        minSchemaV2SampleCount: sloParams.minSchemaV2SampleCount,
      }) as Promise<IntegrationSloGateResponse>,
    retry: false,
  });

  const signoffRequiredApprovals = sloGates?.signoff?.requiredApprovals || [];
  const signoffRequiredEvidence = sloGates?.signoff?.requiredEvidence || [];
  const hasSchemaCoverageGate = sloGates?.gates?.schemaCoveragePassed != null;
  const hasSchemaSampleGate = sloGates?.gates?.schemaSampleSizePassed != null;
  const hasSignoffStatus = Boolean(sloGates?.signoff?.status);
  const isSignoffTraceabilityReady =
    Boolean(sloGates?.gates?.schemaCoveragePassed) &&
    Boolean(sloGates?.gates?.schemaSampleSizePassed) &&
    sloGates?.signoff?.status === 'READY_FOR_APPROVAL' &&
    signoffRequiredApprovals.length > 0 &&
    signoffRequiredEvidence.length > 0;
  const signoffTraceabilityStatus =
    !hasSignoffStatus || !hasSchemaCoverageGate || !hasSchemaSampleGate
      ? 'UNKNOWN'
      : isSignoffTraceabilityReady
      ? 'READY'
      : 'NOT READY';
  const signoffTraceabilityRemediationItems =
    signoffTraceabilityStatus !== 'NOT READY'
      ? []
      : [
          !sloGates?.gates?.schemaCoveragePassed
            ? 'Resolve schema coverage gate failures before rollout.'
            : null,
          !sloGates?.gates?.schemaSampleSizePassed
            ? 'Collect additional schema-v2 events to satisfy the minimum sample requirement.'
            : null,
          sloGates?.signoff?.status !== 'READY_FOR_APPROVAL'
            ? `Advance signoff status to READY_FOR_APPROVAL (current: ${sloGates?.signoff?.status || 'UNKNOWN'}).`
            : null,
          signoffRequiredApprovals.length === 0
            ? 'Populate required approval roles in the SLO signoff payload.'
            : null,
          signoffRequiredEvidence.length === 0
            ? 'Populate required evidence artifacts in the SLO signoff payload.'
            : null,
        ].filter((item): item is string => Boolean(item));

  useEffect(() => {
    if (!selectedCampaignId && campaignPortfolio?.rankedCampaigns?.length) {
      setSelectedCampaignId(campaignPortfolio.rankedCampaigns[0].campaignId);
    }
  }, [campaignPortfolio, selectedCampaignId]);

  useEffect(() => {
    if (!uiNotice) return;
    const timer = window.setTimeout(() => setUiNotice(null), 6000);
    return () => window.clearTimeout(timer);
  }, [uiNotice]);

  const saveSendgridMutation = useMutation({
    mutationFn: (data: { api_key: string; from_email: string }) =>
      api.saveSendgridIntegration(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      setShowSendgridForm(false);
      setSendgridKey('');
      setUiNotice({ tone: 'success', message: 'SendGrid integration saved.' });
    },
    onError: (error) => {
      setUiNotice({ tone: 'error', message: `SendGrid save failed: ${getErrorMessage(error)}` });
    }
  });

  const removeSendgridMutation = useMutation({
    mutationFn: () => api.removeSendgridIntegration(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      setUiNotice({ tone: 'success', message: 'SendGrid integration removed.' });
    },
    onError: (error) => {
      setUiNotice({ tone: 'error', message: `SendGrid removal failed: ${getErrorMessage(error)}` });
    }
  });

  const saveConnectorMutation = useMutation({
    mutationFn: (data: { provider: ConnectorProvider; api_key: string }) => {
      if (data.provider === 'apollo') {
        return api.saveApolloIntegration({ api_key: data.api_key });
      }
      if (data.provider === 'clearbit') {
        return api.saveClearbitIntegration({ api_key: data.api_key });
      }
      return api.saveCrunchbaseIntegration({ api_key: data.api_key });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      queryClient.invalidateQueries({ queryKey: ['integrations-health'] });
      setActiveConnectorForm(null);
      setConnectorApiKey('');
      setUiNotice({ tone: 'success', message: 'Connector credentials saved.' });
    },
    onError: (error) => {
      setUiNotice({ tone: 'error', message: `Connector save failed: ${getErrorMessage(error)}` });
    }
  });

  const removeConnectorMutation = useMutation({
    mutationFn: (provider: ConnectorProvider) => {
      if (provider === 'apollo') {
        return api.removeApolloIntegration();
      }
      if (provider === 'clearbit') {
        return api.removeClearbitIntegration();
      }
      return api.removeCrunchbaseIntegration();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      queryClient.invalidateQueries({ queryKey: ['integrations-health'] });
      setUiNotice({ tone: 'success', message: 'Connector removed.' });
    },
    onError: (error) => {
      setUiNotice({ tone: 'error', message: `Connector removal failed: ${getErrorMessage(error)}` });
    }
  });

  const companyLookupMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        domain: lookupDomain.trim() || undefined,
        companyName: lookupCompanyName.trim() || undefined,
        limit: Math.min(Math.max(Number(lookupLimit) || 10, 1), 25),
        saveResearch: saveLookupResearch,
      };
      if (!payload.domain && !payload.companyName) {
        throw new Error('Enter a domain or company name.');
      }
      if (lookupProvider === 'apollo') {
        return api.apolloEnrichCompany(payload);
      }
      if (lookupProvider === 'clearbit') {
        if (!payload.domain) {
          throw new Error('Domain is required for Clearbit enrichment.');
        }
        return api.clearbitEnrichCompany({ domain: payload.domain, saveResearch: payload.saveResearch });
      }
      if (lookupProvider === 'crunchbase') {
        return api.crunchbaseEnrichCompany(payload);
      }
      return api.orchestrateCompanyEnrichment({
        ...payload,
        stopOnFirstMatch: true,
      });
    },
    onSuccess: (result) => {
      setCompanyLookupResult((result || {}) as ConnectorLookupResult);
      setCompanyLookupError('');
      setUiNotice({ tone: 'success', message: 'Company enrichment lookup completed.' });
    },
    onError: (error) => {
      setCompanyLookupResult(null);
      setCompanyLookupError(getErrorMessage(error));
      setUiNotice({ tone: 'error', message: `Company lookup failed: ${getErrorMessage(error)}` });
    },
  });

  const apolloProspectMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        query: apolloQuery.trim() || undefined,
        title: apolloTitle.trim() || undefined,
        domain: apolloDomain.trim() || undefined,
        limit: Math.min(Math.max(Number(apolloLimit) || 25, 1), 100),
        page: 1,
        saveResults: saveApolloProspects,
      };
      if (!payload.query && !payload.title && !payload.domain) {
        throw new Error('Provide at least one Apollo search criterion.');
      }
      return api.apolloSearchProspects(payload);
    },
    onSuccess: (result) => {
      setApolloLookupResult((result || {}) as ApolloProspectLookupResult);
      setApolloLookupError('');
      setUiNotice({ tone: 'success', message: 'Apollo prospect lookup completed.' });
    },
    onError: (error) => {
      setApolloLookupResult(null);
      setApolloLookupError(getErrorMessage(error));
      setUiNotice({ tone: 'error', message: `Apollo lookup failed: ${getErrorMessage(error)}` });
    },
  });

  const initGoogleOAuthMutation = useMutation({
    mutationFn: () => api.initGoogleOAuth(),
    onSuccess: (data) => {
      // Redirect to Google OAuth
      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    }
  });

  const disconnectGoogleMutation = useMutation({
    mutationFn: () => api.disconnectGoogle(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['googleStatus'] });
    }
  });

  const healthByProvider = Object.fromEntries(
    (integrationsHealth?.providers || []).map((provider) => [provider.provider, provider])
  ) as Record<string, IntegrationHealthProvider>;

  const integrationsList = [
    {
      id: 'sendgrid',
      name: 'SendGrid',
      description: 'Send emails with open and click tracking',
      icon: '📧',
      configured: integrations?.sendgrid_configured,
      category: 'Email'
    },
    {
      id: 'google',
      name: 'Google Workspace',
      description: 'Gmail, Calendar, and Contacts integration',
      icon: '🔷',
      configured: googleStatus?.connected,
      category: 'Email',
      comingSoon: false
    },
    {
      id: 'apollo',
      name: 'Apollo.io',
      description: 'Access millions of verified B2B contacts',
      icon: '🚀',
      configured: integrations?.apollo_configured,
      category: 'Data',
      comingSoon: false,
      enabled: integrations?.apollo_enabled,
      maskedKey: integrations?.apollo_api_key,
      health: healthByProvider.apollo
    },
    {
      id: 'clearbit',
      name: 'Clearbit',
      description: 'Company and contact data enrichment',
      icon: '🔍',
      configured: integrations?.clearbit_configured,
      category: 'Data',
      comingSoon: false,
      enabled: integrations?.clearbit_enabled,
      maskedKey: integrations?.clearbit_api_key,
      health: healthByProvider.clearbit
    },
    {
      id: 'crunchbase',
      name: 'Crunchbase',
      description: 'Funding and company intelligence',
      icon: '💰',
      configured: integrations?.crunchbase_configured,
      category: 'Data',
      comingSoon: false,
      enabled: integrations?.crunchbase_enabled,
      maskedKey: integrations?.crunchbase_api_key,
      health: healthByProvider.crunchbase
    },
    {
      id: 'linkedin',
      name: 'LinkedIn Sales Navigator',
      description: 'Advanced lead discovery and outreach',
      icon: '💼',
      configured: false,
      category: 'Social',
      comingSoon: true
    },
    {
      id: 'slack',
      name: 'Slack',
      description: 'Get notifications and alerts in Slack',
      icon: '💬',
      configured: false,
      category: 'Notifications',
      comingSoon: true
    }
  ];

  const categories = Array.from(new Set(integrationsList.map(i => i.category)));
  const companyResultRows = companyLookupResult?.companies
    || (companyLookupResult?.company ? [companyLookupResult.company] : []);
  const telemetryTrendRows = telemetrySummary?.trendByDay || [];
  const telemetrySchemaRows = Object.entries(telemetrySummary?.bySchemaVersion || {}).sort(([a], [b]) => a.localeCompare(b));
  const salesSchemaRows = Object.entries(telemetrySummary?.salesIntelligence?.bySchemaVersion || {}).sort(([a], [b]) => a.localeCompare(b));
  const traceabilityDecisionRows = Object.entries(telemetrySummary?.traceabilityAudit?.decisionCounts || {}).sort(([a], [b]) => a.localeCompare(b));
  const recentTelemetryRows = telemetrySummary?.recentEvents || [];
  const salesSchemaSampleCount = salesSchemaRows.reduce((acc, [, count]) => acc + Number(count || 0), 0);
  const salesSchemaV2Count = Number((telemetrySummary?.salesIntelligence?.bySchemaVersion || {})['2'] || 0);
  const salesSchemaCoveragePct = salesSchemaSampleCount > 0
    ? (salesSchemaV2Count / salesSchemaSampleCount) * 100
    : 100;
  const hasActiveIntegrations =
    integrations?.sendgrid_configured ||
    googleStatus?.connected ||
    integrations?.apollo_configured ||
    integrations?.clearbit_configured ||
    integrations?.crunchbase_configured;

  const refreshTelemetrySummary = () => {
    const normalizedDays = Math.min(Math.max(Number(telemetryDaysInput) || 7, 1), 30);
    const normalizedLimit = Math.min(Math.max(Number(telemetryLimitInput) || 500, 50), 5000);
    setTelemetryParams({ days: normalizedDays, limit: normalizedLimit });
    if (normalizedDays !== telemetryDaysInput || normalizedLimit !== telemetryLimitInput) {
      setUiNotice({ tone: 'info', message: 'Telemetry filter values were normalized to allowed bounds.' });
    }
  };

  const refreshSnapshotGovernance = () => {
    const normalizedRetentionDays = Math.min(
      Math.max(Number(snapshotRetentionDaysInput) || 30, 1),
      365
    );
    setSnapshotRetentionDays(normalizedRetentionDays);
    if (normalizedRetentionDays !== snapshotRetentionDaysInput) {
      setUiNotice({
        tone: 'info',
        message:
          'Snapshot retention days were normalized to allowed bounds.',
      });
    }
  };

  const refreshSloGates = () => {
    const normalizedDays = Math.min(Math.max(Number(sloDaysInput) || 7, 1), 30);
    const normalizedErrorRate = Math.min(Math.max(Number(sloErrorThresholdInput) || 5, 0), 100);
    const normalizedSchemaRate = Math.min(Math.max(Number(sloSchemaThresholdInput) || 95, 0), 100);
    const normalizedSchemaSampleCount = Math.min(
      Math.max(Number(sloSchemaSampleCountInput) || 25, 1),
      5000
    );
    setSloParams({
      days: normalizedDays,
      maxErrorRatePct: normalizedErrorRate,
      minSchemaV2Pct: normalizedSchemaRate,
      minSchemaV2SampleCount: normalizedSchemaSampleCount,
    });
    if (
      normalizedDays !== sloDaysInput
      || normalizedErrorRate !== sloErrorThresholdInput
      || normalizedSchemaRate !== sloSchemaThresholdInput
      || normalizedSchemaSampleCount !== sloSchemaSampleCountInput
    ) {
      setUiNotice({ tone: 'info', message: 'SLO filter values were normalized to allowed bounds.' });
    }
  };

  const downloadJsonSnapshot = (filePrefix: string, payload: unknown) => {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${filePrefix}-${timestamp}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      setUiNotice({ tone: 'success', message: `${filePrefix} exported.` });
    } catch (error) {
      setUiNotice({ tone: 'error', message: `Export failed: ${getErrorMessage(error)}` });
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Integrations</h1>
        <p className="text-gray-500 mt-1">
          Connect your tools to power real-world sales execution
        </p>
      </div>

      {uiNotice && (
        <div
          role="status"
          aria-live="polite"
          className={`mb-4 rounded-md border p-3 text-sm ${
            uiNotice.tone === 'success'
              ? 'border-green-200 bg-green-50 text-green-800'
              : uiNotice.tone === 'error'
                ? 'border-red-200 bg-red-50 text-red-800'
                : 'border-blue-200 bg-blue-50 text-blue-800'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <span>{uiNotice.message}</span>
            <button
              type="button"
              onClick={() => setUiNotice(null)}
              className="text-xs underline"
            >
              Dismiss notice
            </button>
          </div>
        </div>
      )}

      {/* SendGrid Setup Modal */}
      {showSendgridForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Connect SendGrid</CardTitle>
              <CardDescription>
                Enter your SendGrid API key to enable email sending with tracking
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">API Key</label>
                <Input
                  type="password"
                  value={sendgridKey}
                  onChange={(e) => setSendgridKey(e.target.value)}
                  placeholder="SG.xxxxxxxxxxxxxxxx"
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Get your API key from{' '}
                  <a
                    href="https://app.sendgrid.com/settings/api_keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    SendGrid Settings
                  </a>
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">From Email</label>
                <Input
                  type="email"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Must be a verified sender in SendGrid
                </p>
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setShowSendgridForm(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => saveSendgridMutation.mutate({
                    api_key: sendgridKey,
                    from_email: fromEmail
                  })}
                  disabled={!sendgridKey || saveSendgridMutation.isPending}
                  className="flex-1"
                >
                  {saveSendgridMutation.isPending ? 'Connecting...' : 'Connect'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Data Connector Setup Modal */}
      {activeConnectorForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>
                Connect {activeConnectorForm === 'apollo' ? 'Apollo.io' : activeConnectorForm === 'clearbit' ? 'Clearbit' : 'Crunchbase'}
              </CardTitle>
              <CardDescription>
                Store an API key for sales-only enrichment workflows. Provider use remains controlled by feature flags.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">API Key</label>
                <Input
                  type="password"
                  value={connectorApiKey}
                  onChange={(e) => setConnectorApiKey(e.target.value)}
                  placeholder="Enter provider API key"
                  className="mt-1"
                />
              </div>
              <div className="rounded-md border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800">
                Keys are masked after save and scoped to your user account.
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setActiveConnectorForm(null);
                    setConnectorApiKey('');
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() =>
                    saveConnectorMutation.mutate({
                      provider: activeConnectorForm,
                      api_key: connectorApiKey,
                    })
                  }
                  disabled={!connectorApiKey || saveConnectorMutation.isPending}
                  className="flex-1"
                >
                  {saveConnectorMutation.isPending ? 'Saving...' : 'Save Key'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Active Integrations */}
      {hasActiveIntegrations && (
        <Card className="mb-8 border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <span>✅</span> Active Integrations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Google Integration */}
            {googleStatus?.connected && (
              <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                <div className="flex items-center gap-3">
                  {googleStatus.picture && (
                    <img src={googleStatus.picture} alt="" className="w-8 h-8 rounded-full" />
                  )}
                  <div>
                    <h4 className="font-medium">Google Workspace</h4>
                    <p className="text-sm text-gray-500">
                      {googleStatus.email} • Gmail, Calendar, Contacts
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => disconnectGoogleMutation.mutate()}
                >
                  Disconnect
                </Button>
              </div>
            )}
            
            {/* SendGrid Integration */}
            {integrations?.sendgrid_configured && (
              <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📧</span>
                  <div>
                    <h4 className="font-medium">SendGrid</h4>
                    <p className="text-sm text-gray-500">
                      API Key: {integrations.sendgrid_api_key}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => removeSendgridMutation.mutate()}
                >
                  Disconnect
                </Button>
              </div>
            )}

            {integrations?.apollo_configured && (
              <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🚀</span>
                  <div>
                    <h4 className="font-medium">Apollo.io</h4>
                    <p className="text-sm text-gray-500">
                      API Key: {integrations.apollo_api_key || 'Configured'}
                    </p>
                    <p className="text-xs text-gray-500">
                      Status: {healthByProvider.apollo?.healthy ? 'Healthy' : healthByProvider.apollo?.error || 'Not configured'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => removeConnectorMutation.mutate('apollo')}
                  disabled={removeConnectorMutation.isPending}
                >
                  Disconnect
                </Button>
              </div>
            )}

            {integrations?.clearbit_configured && (
              <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🔍</span>
                  <div>
                    <h4 className="font-medium">Clearbit</h4>
                    <p className="text-sm text-gray-500">
                      API Key: {integrations.clearbit_api_key || 'Configured'}
                    </p>
                    <p className="text-xs text-gray-500">
                      Status: {healthByProvider.clearbit?.healthy ? 'Healthy' : healthByProvider.clearbit?.error || 'Not configured'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => removeConnectorMutation.mutate('clearbit')}
                  disabled={removeConnectorMutation.isPending}
                >
                  Disconnect
                </Button>
              </div>
            )}

            {integrations?.crunchbase_configured && (
              <div className="flex items-center justify-between p-3 bg-white rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">💰</span>
                  <div>
                    <h4 className="font-medium">Crunchbase</h4>
                    <p className="text-sm text-gray-500">
                      API Key: {integrations.crunchbase_api_key || 'Configured'}
                    </p>
                    <p className="text-xs text-gray-500">
                      Status: {healthByProvider.crunchbase?.healthy ? 'Healthy' : healthByProvider.crunchbase?.error || 'Not configured'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => removeConnectorMutation.mutate('crunchbase')}
                  disabled={removeConnectorMutation.isPending}
                >
                  Disconnect
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Connector Lookup Sandbox */}
      <Card className="mb-8 border-blue-200">
        <CardHeader>
          <CardTitle className="text-lg">Connector Enrichment Sandbox</CardTitle>
          <CardDescription>
            Sales-only lookup tests for Apollo, Clearbit, Crunchbase, and orchestrated fallback.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-md border p-4 space-y-3">
            <div className="text-sm font-medium">Company Enrichment</div>
            <div className="grid md:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-gray-500">Provider</label>
                <select
                  value={lookupProvider}
                  onChange={(e) => setLookupProvider(e.target.value as ConnectorLookupProvider)}
                  className="w-full rounded-md border px-3 py-2 text-sm mt-1"
                >
                  <option value="orchestration">Orchestrated Fallback</option>
                  <option value="apollo">Apollo</option>
                  <option value="clearbit">Clearbit</option>
                  <option value="crunchbase">Crunchbase</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500">Domain</label>
                <Input
                  value={lookupDomain}
                  onChange={(e) => setLookupDomain(e.target.value)}
                  placeholder="example.com"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">Company Name</label>
                <Input
                  value={lookupCompanyName}
                  onChange={(e) => setLookupCompanyName(e.target.value)}
                  placeholder="Example Inc"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">Limit</label>
                <Input
                  type="number"
                  min={1}
                  max={25}
                  value={lookupLimit}
                  onChange={(e) => setLookupLimit(Number(e.target.value) || 10)}
                  className="mt-1"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={saveLookupResearch}
                onChange={(e) => setSaveLookupResearch(e.target.checked)}
              />
              Save enrichment records to company research
            </label>
            <div className="flex items-center gap-3">
              <Button onClick={() => companyLookupMutation.mutate()} disabled={companyLookupMutation.isPending}>
                {companyLookupMutation.isPending ? 'Running Lookup...' : 'Run Company Lookup'}
              </Button>
              <span className="text-xs text-gray-500">
                Feature flags still control provider availability.
              </span>
            </div>

            {companyLookupError && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {companyLookupError}
              </div>
            )}

            {companyLookupResult && (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 space-y-1">
                <div>
                  Provider: {companyLookupResult.selectedProvider || companyLookupResult.provider || 'none'}
                </div>
                <div>
                  Results: {companyLookupResult.resultCount || companyResultRows.length || 0}
                  {typeof companyLookupResult.savedCount === 'number' ? ` • Saved: ${companyLookupResult.savedCount}` : ''}
                </div>
                {!!companyLookupResult.attempts?.length && (
                  <div>Attempts: {companyLookupResult.attempts.length}</div>
                )}
                {companyResultRows.length > 0 && (
                  <div>
                    Top Company: {companyResultRows[0]?.name || companyResultRows[0]?.companyName || companyResultRows[0]?.domain || 'n/a'}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="rounded-md border p-4 space-y-3">
            <div className="text-sm font-medium">Apollo Prospect Lookup</div>
            <div className="grid md:grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-gray-500">Query</label>
                <Input
                  value={apolloQuery}
                  onChange={(e) => setApolloQuery(e.target.value)}
                  placeholder="revops"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">Title</label>
                <Input
                  value={apolloTitle}
                  onChange={(e) => setApolloTitle(e.target.value)}
                  placeholder="VP Sales"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">Domain</label>
                <Input
                  value={apolloDomain}
                  onChange={(e) => setApolloDomain(e.target.value)}
                  placeholder="example.com"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">Limit</label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={apolloLimit}
                  onChange={(e) => setApolloLimit(Number(e.target.value) || 25)}
                  className="mt-1"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={saveApolloProspects}
                onChange={(e) => setSaveApolloProspects(e.target.checked)}
              />
              Save prospects to pipeline records
            </label>
            <div className="flex items-center gap-3">
              <Button onClick={() => apolloProspectMutation.mutate()} disabled={apolloProspectMutation.isPending}>
                {apolloProspectMutation.isPending ? 'Searching...' : 'Run Apollo Lookup'}
              </Button>
              <span className="text-xs text-gray-500">
                Requires Apollo key and ENABLE_APOLLO_CONNECTOR.
              </span>
            </div>

            {apolloLookupError && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {apolloLookupError}
              </div>
            )}

            {apolloLookupResult && (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 space-y-1">
                <div>Provider: {apolloLookupResult.provider || 'apollo'}</div>
                <div>
                  Results: {apolloLookupResult.resultCount || 0}
                  {typeof apolloLookupResult.savedCount === 'number' ? ` • Saved: ${apolloLookupResult.savedCount}` : ''}
                </div>
                {!!apolloLookupResult.prospects?.length && (
                  <div>
                    Top Prospect: {apolloLookupResult.prospects[0]?.fullName || apolloLookupResult.prospects[0]?.email || 'n/a'}
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sales Campaign Analytics */}
      <Card className="mb-8 border-indigo-200">
        <CardHeader>
          <CardTitle className="text-lg">Campaign Performance Snapshot</CardTitle>
          <CardDescription>
            Sales-only campaign portfolio and per-campaign quality metrics.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(isFeatureDisabledError(campaignPortfolioError) || isFeatureDisabledError(campaignPerformanceError)) && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Campaign analytics is currently disabled by feature flag.
            </div>
          )}

          {!isFeatureDisabledError(campaignPortfolioError) && campaignPortfolioError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              Failed to load campaign portfolio: {getErrorMessage(campaignPortfolioError)}
            </div>
          )}

          {isCampaignPortfolioLoading ? (
            <div className="text-sm text-gray-500">Loading campaign analytics...</div>
          ) : campaignPortfolio?.campaignCount ? (
            <>
              <div className="grid md:grid-cols-4 gap-3">
                <div className="rounded-md border p-3">
                  <div className="text-xs text-gray-500">Active Campaigns</div>
                  <div className="text-xl font-semibold">{campaignPortfolio.activeCampaignCount}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-gray-500">Total Sent</div>
                  <div className="text-xl font-semibold">{campaignPortfolio.portfolioTotals.sent}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-gray-500">Total Replies</div>
                  <div className="text-xl font-semibold">{campaignPortfolio.portfolioTotals.replied}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-gray-500">Avg Reply Rate</div>
                  <div className="text-xl font-semibold">{(campaignPortfolio.averageReplyRate * 100).toFixed(1)}%</div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Select Campaign</label>
                <select
                  value={selectedCampaignId}
                  onChange={(e) => setSelectedCampaignId(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                >
                  {campaignPortfolio.rankedCampaigns.map((campaign) => (
                    <option key={campaign.campaignId} value={campaign.campaignId}>
                      {campaign.name} ({(campaign.overall.replyRate * 100).toFixed(1)}% reply)
                    </option>
                  ))}
                </select>
              </div>

              {isCampaignPerformanceLoading && (
                <div className="text-sm text-gray-500">Loading campaign details...</div>
              )}

              {!isFeatureDisabledError(campaignPerformanceError) && campaignPerformanceError && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  Failed to load campaign details: {getErrorMessage(campaignPerformanceError)}
                </div>
              )}

              {campaignPerformance && (
                <div className="rounded-md border p-3 space-y-2">
                  <div className="font-medium">{campaignPerformance.name}</div>
                  <div className="text-sm text-gray-600">
                    Status: {campaignPerformance.status} • Quality: {campaignPerformance.overall.qualityTier}
                  </div>
                  <div className="text-sm text-gray-600">
                    Open rate {(campaignPerformance.overall.openRate * 100).toFixed(1)}% • Reply rate {(campaignPerformance.overall.replyRate * 100).toFixed(1)}%
                  </div>
                  {campaignPerformance.recommendations?.length > 0 && (
                    <div className="text-sm text-gray-700">
                      Recommendation: {campaignPerformance.recommendations[0]}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="text-sm text-gray-500">No active campaign analytics available yet.</div>
          )}
        </CardContent>
      </Card>

      {/* Integration Telemetry Summary */}
      <Card className="mb-8 border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg">Telemetry Summary ({telemetryParams.days} Days)</CardTitle>
          <CardDescription>
            Connector reliability signals and sales-intelligence event distribution.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid md:grid-cols-5 gap-3">
            <div>
              <label className="text-xs text-gray-500">Window Days</label>
              <Input
                type="number"
                min={1}
                max={30}
                value={telemetryDaysInput}
                onChange={(e) => setTelemetryDaysInput(Number(e.target.value) || 7)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Event Limit</label>
              <Input
                type="number"
                min={50}
                max={5000}
                value={telemetryLimitInput}
                onChange={(e) => setTelemetryLimitInput(Number(e.target.value) || 500)}
                className="mt-1"
              />
            </div>
            <div className="md:col-span-2 flex items-end gap-2">
              <Button
                onClick={refreshTelemetrySummary}
                disabled={isTelemetryLoading}
              >
                {isTelemetryLoading ? 'Refreshing...' : 'Refresh Telemetry'}
              </Button>
              <Button
                variant="outline"
                onClick={() => downloadJsonSnapshot('connector-telemetry-summary', telemetrySummary || {})}
                disabled={!telemetrySummary}
              >
                Export Telemetry JSON
              </Button>
            </div>
          </div>

          {isTelemetryLoading && <div className="text-sm text-gray-500">Loading telemetry summary...</div>}
          {telemetryError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              Failed to load telemetry summary: {getErrorMessage(telemetryError)}
            </div>
          )}
          {telemetrySummary && (
            <>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                Generated: {formatTimestamp(telemetrySummary.generatedAt)} • Window: {telemetrySummary.windowDays || telemetryParams.days} days • Schema v2 coverage {salesSchemaCoveragePct.toFixed(1)}%
              </div>
              <div className="grid md:grid-cols-4 gap-3">
                <div className="rounded-md border p-3">
                  <div className="text-xs text-gray-500">Total Events</div>
                  <div className="text-xl font-semibold">{telemetrySummary.eventCount}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-gray-500">Error Events</div>
                  <div className="text-xl font-semibold">{telemetrySummary.errorEventCount}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-gray-500">Sales Intelligence Events</div>
                  <div className="text-xl font-semibold">{telemetrySummary.salesIntelligence?.eventCount || 0}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    v2 {salesSchemaV2Count}/{salesSchemaSampleCount || 0}
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-gray-500">Traceability Audits</div>
                  <div className="text-xl font-semibold">{telemetrySummary.traceabilityAudit?.eventCount || 0}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    ready {telemetrySummary.traceabilityAudit?.readyCount || 0} • not ready {telemetrySummary.traceabilityAudit?.notReadyCount || 0}
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <div className="rounded-md border p-3">
                  <div className="text-xs font-medium text-gray-500 mb-2">By Provider</div>
                  <div className="space-y-1 text-sm text-gray-700">
                    {Object.entries(telemetrySummary.byProvider || {}).map(([provider, count]) => (
                      <div key={provider} className="flex items-center justify-between">
                        <span>{provider}</span>
                        <span>{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs font-medium text-gray-500 mb-2">Schema Version Adoption</div>
                  <div className="space-y-1 text-sm text-gray-700">
                    {telemetrySchemaRows.length === 0 && (
                      <div className="text-gray-500">No schema-version metadata captured in current window.</div>
                    )}
                    {telemetrySchemaRows.map(([schemaVersion, count]) => (
                      <div key={`schema-${schemaVersion}`} className="flex items-center justify-between">
                        <span>v{schemaVersion}</span>
                        <span>{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <div className="rounded-md border p-3">
                  <div className="text-xs font-medium text-gray-500 mb-2">Sales Event Families</div>
                  <div className="space-y-1 text-sm text-gray-700">
                    {Object.entries(telemetrySummary.salesIntelligence?.byEventFamily || {}).length === 0 && (
                      <div className="text-gray-500">No sales-intelligence events in current window.</div>
                    )}
                    {Object.entries(telemetrySummary.salesIntelligence?.byEventFamily || {}).map(([family, count]) => (
                      <div key={family} className="flex items-center justify-between">
                        <span>{family}</span>
                        <span>{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs font-medium text-gray-500 mb-2">Sales Schema Versions</div>
                  <div className="space-y-1 text-sm text-gray-700">
                    {salesSchemaRows.length === 0 && (
                      <div className="text-gray-500">No sales schema metadata captured in current window.</div>
                    )}
                    {salesSchemaRows.map(([schemaVersion, count]) => (
                      <div key={`sales-schema-${schemaVersion}`} className="flex items-center justify-between">
                        <span>v{schemaVersion}</span>
                        <span>{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-md border p-3">
                <div className="text-xs font-medium text-gray-500 mb-2">Traceability Audit Decisions</div>
                <div className="text-xs text-gray-500 mb-2">
                  Latest evaluation: {formatTimestamp(telemetrySummary.traceabilityAudit?.latestEvaluatedAt || undefined)}
                </div>
                <div className="space-y-1 text-sm text-gray-700">
                  {traceabilityDecisionRows.length === 0 && (
                    <div className="text-gray-500">No traceability audit decisions in current window.</div>
                  )}
                  {traceabilityDecisionRows.map(([decision, count]) => (
                    <div key={`traceability-${decision}`} className="flex items-center justify-between">
                      <span>{decision}</span>
                      <span>{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-md border p-3">
                <div className="text-xs font-medium text-gray-500 mb-2">Telemetry Daily Trend</div>
                {telemetryTrendRows.length === 0 && (
                  <div className="text-sm text-gray-500">No trend data in current window.</div>
                )}
                {telemetryTrendRows.length > 0 && (
                  <div className="space-y-1 text-sm text-gray-700">
                    {telemetryTrendRows.slice(-7).map((row) => (
                      <div key={row.date} className="grid grid-cols-4 gap-2 rounded border border-slate-100 px-2 py-1">
                        <span>{row.date}</span>
                        <span>events {row.events}</span>
                        <span>errors {row.errors}</span>
                        <span>sales {row.salesIntelligenceEvents}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-md border p-3">
                <div className="text-xs font-medium text-gray-500 mb-2">Recent Correlated Events</div>
                {recentTelemetryRows.length === 0 && (
                  <div className="text-sm text-gray-500">No recent telemetry events in current window.</div>
                )}
                {recentTelemetryRows.length > 0 && (
                  <div className="space-y-1 text-sm text-gray-700">
                    {recentTelemetryRows.slice(0, 5).map((row, idx) => (
                      <div key={`${row.eventType || 'event'}-${idx}`} className="grid grid-cols-5 gap-2 rounded border border-slate-100 px-2 py-1">
                        <span>{row.provider || 'unknown'}</span>
                        <span>{row.eventType || 'unknown'}</span>
                        <span>{row.requestId || 'request n/a'}</span>
                        <span>schema v{row.schemaVersion ?? 'unknown'}</span>
                        <span>{row.traceabilityDecision ? `traceability ${row.traceabilityDecision}` : 'traceability n/a'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-md border p-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-medium text-gray-500">
                      Traceability Snapshot Governance
                    </div>
                    <div className="text-xs text-gray-500">
                      Snapshot artifact retention and release-fixture availability.
                    </div>
                  </div>
                  <div className="flex items-end gap-2">
                    <div>
                      <label className="text-xs text-gray-500">Retention Days</label>
                      <Input
                        type="number"
                        min={1}
                        max={365}
                        value={snapshotRetentionDaysInput}
                        onChange={(e) => setSnapshotRetentionDaysInput(Number(e.target.value) || 30)}
                        className="mt-1 w-28"
                      />
                    </div>
                    <Button
                      variant="outline"
                      onClick={refreshSnapshotGovernance}
                      disabled={isSnapshotGovernanceLoading}
                    >
                      {isSnapshotGovernanceLoading ? 'Refreshing...' : 'Refresh Snapshot Governance'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        downloadJsonSnapshot(
                          'connector-snapshot-governance',
                          snapshotGovernance || {}
                        )
                      }
                      disabled={!snapshotGovernance}
                    >
                      Export Snapshot Governance JSON
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        downloadJsonSnapshot(
                          'connector-baseline-governance',
                          baselineGovernance || {}
                        )
                      }
                      disabled={!baselineGovernance}
                    >
                      Export Baseline Governance JSON
                    </Button>
                  </div>
                </div>

                {isSnapshotGovernanceLoading && (
                  <div className="text-sm text-gray-500">Loading snapshot governance...</div>
                )}
                {snapshotGovernanceError && (
                  <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    Failed to load snapshot governance: {getErrorMessage(snapshotGovernanceError)}
                  </div>
                )}
                {snapshotGovernance && (
                  <div className="space-y-2 text-sm text-gray-700">
                    <div className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-2 py-1">
                      <span>Status</span>
                      <span className={snapshotGovernance.status === 'READY' ? 'text-green-700 font-medium' : 'text-amber-700 font-medium'}>
                        {snapshotGovernance.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>Latest snapshot: {formatTimestamp(snapshotGovernance.snapshot.latestGeneratedAt || undefined)}</div>
                      <div>
                        Age (days):{' '}
                        {snapshotGovernance.snapshot.ageDays != null
                          ? snapshotGovernance.snapshot.ageDays
                          : 'n/a'}
                      </div>
                      <div>Snapshot files: {snapshotGovernance.snapshot.fileCount}</div>
                      <div>Stale snapshots: {snapshotGovernance.snapshot.staleCount}</div>
                      <div>
                        Within retention: {snapshotGovernance.snapshot.withinRetention ? 'yes' : 'no'}
                      </div>
                      <div>
                        Release fixtures ready:{' '}
                        {snapshotGovernance.releaseGateFixtures.allProfilesAvailable ? 'yes' : 'no'}
                      </div>
                    </div>
                    {snapshotGovernance.releaseGateFixtures.missingProfiles?.length > 0 && (
                      <div>
                        Missing fixture profiles:{' '}
                        {snapshotGovernance.releaseGateFixtures.missingProfiles.join(', ')}
                      </div>
                    )}
                    {snapshotGovernance.alerts?.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-gray-500">Governance Alerts</div>
                        {snapshotGovernance.alerts.map((alert, idx) => (
                          <div key={`${alert}-${idx}`} className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-amber-800">
                            {alert}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="rounded-md border p-3 space-y-2">
                  <div className="text-xs font-medium text-gray-500">
                    Baseline Fixture Governance
                  </div>
                  {isBaselineGovernanceLoading && (
                    <div className="text-sm text-gray-500">Loading baseline governance...</div>
                  )}
                  {baselineGovernanceError && (
                    <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                      Failed to load baseline governance: {getErrorMessage(baselineGovernanceError)}
                    </div>
                  )}
                  {baselineGovernance && (
                    <div className="space-y-2 text-sm text-gray-700">
                      <div className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-2 py-1">
                        <span>Status</span>
                        <span className={baselineGovernance.status === 'PASS' ? 'text-green-700 font-medium' : 'text-amber-700 font-medium'}>
                          {baselineGovernance.status}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          Artifact generated:{' '}
                          {formatTimestamp(baselineGovernance.artifactGeneratedAt || undefined)}
                        </div>
                        <div>
                          Overall baseline status:{' '}
                          {baselineGovernance.overallStatus || 'unknown'}
                        </div>
                        <div>
                          Profiles available:{' '}
                          {baselineGovernance.releaseGateFixtures.availableProfileCount ?? 0}
                          /
                          {baselineGovernance.releaseGateFixtures.profileCount ?? 0}
                        </div>
                        <div>
                          All profiles available:{' '}
                          {baselineGovernance.releaseGateFixtures.allProfilesAvailable ? 'yes' : 'no'}
                        </div>
                      </div>
                      <div>
                        Fixture policy: {baselineGovernance.releaseGateFixturePolicy.passed ? 'pass' : 'fail'}
                      </div>
                      {baselineGovernance.releaseGateFixturePolicy.message && (
                        <div>{baselineGovernance.releaseGateFixturePolicy.message}</div>
                      )}
                      {baselineGovernance.releaseGateFixturePolicy.missingProfiles?.length > 0 && (
                        <div>
                          Missing fixture profiles:{' '}
                          {baselineGovernance.releaseGateFixturePolicy.missingProfiles.join(', ')}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Connector SLO Gate Evaluation */}
      <Card className="mb-8 border-emerald-200">
        <CardHeader>
          <CardTitle className="text-lg">Connector Rollout SLO Gate</CardTitle>
          <CardDescription>
            Telemetry-derived proceed/hold decision for connector rollout expansion.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-5 gap-3">
            <div>
              <label className="text-xs text-gray-500">Window Days</label>
              <Input
                type="number"
                min={1}
                max={30}
                value={sloDaysInput}
                onChange={(e) => setSloDaysInput(Number(e.target.value) || 7)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Max Error Rate (%)</label>
              <Input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={sloErrorThresholdInput}
                onChange={(e) => setSloErrorThresholdInput(Number(e.target.value) || 5)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Min Schema v2 (%)</label>
              <Input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={sloSchemaThresholdInput}
                onChange={(e) => setSloSchemaThresholdInput(Number(e.target.value) || 95)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Min Schema Sample Count</label>
              <Input
                type="number"
                min={1}
                max={5000}
                step={1}
                value={sloSchemaSampleCountInput}
                onChange={(e) => setSloSchemaSampleCountInput(Number(e.target.value) || 25)}
                className="mt-1"
              />
            </div>
            <div className="md:col-span-2 flex items-end">
              <div className="flex gap-2">
                <Button
                  onClick={refreshSloGates}
                  disabled={isSloGatesLoading}
                >
                  {isSloGatesLoading ? 'Evaluating...' : 'Refresh SLO Gates'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => downloadJsonSnapshot('connector-slo-gates', sloGates || {})}
                  disabled={!sloGates}
                >
                  Export SLO JSON
                </Button>
              </div>
            </div>
          </div>

          {sloGatesError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              Failed to load SLO gate summary: {getErrorMessage(sloGatesError)}
            </div>
          )}

          {sloGates && (
            <>
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                Generated: {formatTimestamp(sloGates.generatedAt)} • Window: {sloGates.windowDays || sloParams.days} days • Overall Gate: {sloGates.gates?.overallPassed == null ? 'UNKNOWN' : sloGates.gates.overallPassed ? 'PASS' : 'FAIL'} • Schema Sample Gate: {sloGates.gates?.schemaSampleSizePassed == null ? 'UNKNOWN' : sloGates.gates.schemaSampleSizePassed ? 'PASS' : 'FAIL'}
              </div>
              <div className="grid md:grid-cols-7 gap-3">
                <div className="rounded-md border p-3">
                  <div className="text-xs text-gray-500">Decision</div>
                  <div className={`text-xl font-semibold ${sloGates.decision === 'PROCEED' ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {sloGates.decision}
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-gray-500">Event Count</div>
                  <div className="text-xl font-semibold">{sloGates.eventCount}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-gray-500">Error Rate</div>
                  <div className="text-xl font-semibold">
                    {(sloGates.errorRate.observedPct || 0).toFixed(2)}%
                  </div>
                  <div className="text-xs text-gray-500">
                    Threshold {(sloGates.errorRate.thresholdPct || 0).toFixed(2)}%
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-gray-500">Schema v2 Coverage</div>
                  <div className="text-xl font-semibold">
                    {Number(sloGates.schemaCoverage?.observedPct || 0).toFixed(2)}%
                  </div>
                  <div className="text-xs text-gray-500">
                    Threshold {(sloGates.schemaCoverage?.thresholdPct || 0).toFixed(2)}%
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-gray-500">Schema Sample Size</div>
                  <div className="text-xl font-semibold">
                    {Number(sloGates.schemaCoverage?.sampleCount || 0)} / {Number(sloGates.schemaCoverage?.minSampleCount || 0)}
                  </div>
                  <div className="text-xs text-gray-500">
                    Gate {sloGates.gates?.schemaSampleSizePassed == null ? 'unknown' : sloGates.gates.schemaSampleSizePassed ? 'pass' : 'fail'}
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-gray-500">Signoff Status</div>
                  <div className="text-lg font-semibold">{sloGates.signoff?.status || 'Unknown'}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-gray-500">Traceability Readiness</div>
                  <div
                    className={`text-lg font-semibold ${
                      signoffTraceabilityStatus === 'READY'
                        ? 'text-emerald-700'
                        : signoffTraceabilityStatus === 'NOT READY'
                        ? 'text-amber-700'
                        : 'text-gray-700'
                    }`}
                  >
                    {signoffTraceabilityStatus}
                  </div>
                  <div className="text-xs text-gray-500">
                    Approvals {signoffRequiredApprovals.length} • Evidence {signoffRequiredEvidence.length}
                  </div>
                  {signoffTraceabilityStatus === 'NOT READY' && (
                    <div className="mt-2 text-xs text-amber-700">
                      <div className="font-medium">Remediation Checklist</div>
                      {signoffTraceabilityRemediationItems.map((item) => (
                        <div key={item}>- {item}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <div className="rounded-md border p-3">
                  <div className="text-xs font-medium text-gray-500 mb-2">Provider P95 Latency Gates</div>
                  <div className="space-y-1 text-sm text-gray-700">
                    {Object.entries(sloGates.providerLatency || {}).map(([provider, metrics]) => (
                      <div key={provider} className="flex items-center justify-between">
                        <span>{provider}</span>
                        <span>
                          {metrics.observedP95Ms == null ? 'n/a' : `${metrics.observedP95Ms.toFixed(1)}ms`} / {metrics.thresholdP95Ms}ms
                          {' • '}
                          {metrics.passed ? 'pass' : 'fail'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs font-medium text-gray-500 mb-2">Rollout Actions</div>
                  <div className="space-y-2 text-sm text-gray-700">
                    {(sloGates.rolloutActions || []).map((action, idx) => (
                      <div key={`${action.ownerRole}-${idx}`} className="rounded border border-slate-200 bg-slate-50 p-2">
                        <div className="font-medium">
                          {action.priority} • {action.ownerRole}
                        </div>
                        <div>{action.action}</div>
                        <div className="text-xs text-gray-500 mt-1">Trigger: {action.trigger}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-md border p-3">
                <div className="text-xs font-medium text-gray-500 mb-2">Signoff Requirements</div>
                <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-700">
                  <div>
                    <div className="font-medium mb-1">Required Approvals</div>
                    {signoffRequiredApprovals.length === 0 && (
                      <div className="text-gray-500">No explicit approval roles returned.</div>
                    )}
                    {signoffRequiredApprovals.map((approval) => (
                      <div key={approval.role}>
                        {approval.role} {approval.required ? '(required)' : ''}
                      </div>
                    ))}
                  </div>
                  <div>
                    <div className="font-medium mb-1">Required Evidence</div>
                    {signoffRequiredEvidence.length === 0 && (
                      <div className="text-gray-500">No explicit evidence artifacts returned.</div>
                    )}
                    {signoffRequiredEvidence.map((artifact) => (
                      <div key={artifact}>{artifact}</div>
                    ))}
                  </div>
                </div>
              </div>

              {!!sloGates.alerts?.length && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <div className="font-medium">Active Alerts</div>
                  {(sloGates.alerts || []).map((alert, idx) => (
                    <div key={`${alert.gate}-${idx}`} className="mt-1">
                      [{alert.severity}] {alert.message}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Available Integrations by Category */}
      {categories.map(category => (
        <div key={category} className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">{category}</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {integrationsList
              .filter(i => i.category === category)
              .map(integration => (
                <Card
                  key={integration.id}
                  className={integration.comingSoon ? 'opacity-60' : ''}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <span className="text-3xl">{integration.icon}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{integration.name}</h3>
                          {integration.configured && (
                            <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded">
                              Connected
                            </span>
                          )}
                          {integration.comingSoon && (
                            <span className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                              Coming Soon
                            </span>
                          )}
                          {!integration.comingSoon && integration.enabled === false && (
                            <span className="px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded">
                              Flag Off
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          {integration.description}
                        </p>
                        {!integration.comingSoon && integration.configured && integration.maskedKey && (
                          <p className="text-xs text-gray-500 mt-2">
                            Key: {integration.maskedKey}
                          </p>
                        )}
                        {!integration.comingSoon && integration.id !== 'sendgrid' && integration.id !== 'google' && integration.health && (
                          <p className="text-xs text-gray-500 mt-1">
                            Health: {integration.health.healthy ? 'Healthy' : integration.health.error || 'Unavailable'}
                          </p>
                        )}
                        {!integration.comingSoon && !integration.configured && (
                          <Button
                            size="sm"
                            className="mt-3"
                            onClick={() => {
                              if (integration.id === 'sendgrid') {
                                setShowSendgridForm(true);
                              } else if (integration.id === 'google') {
                                // Direct OAuth - just click and go
                                initGoogleOAuthMutation.mutate();
                              } else if (integration.id === 'apollo' || integration.id === 'clearbit' || integration.id === 'crunchbase') {
                                setActiveConnectorForm(integration.id as ConnectorProvider);
                              }
                            }}
                            disabled={
                              (integration.id === 'google' && initGoogleOAuthMutation.isPending) ||
                              saveConnectorMutation.isPending
                            }
                          >
                            {integration.id === 'google' && initGoogleOAuthMutation.isPending
                              ? 'Connecting...'
                              : integration.id === 'google'
                                ? 'Connect with Google'
                                : 'Connect'}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </div>
      ))}

      {/* Web Scraping Info */}
      <Card className="mt-8 bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>🌐</span> Built-in Web Research
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700">
            SalesFlow AI includes built-in web scraping and AI research capabilities:
          </p>
          <ul className="mt-3 space-y-2 text-sm text-gray-600">
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              AI-powered lead discovery from the web
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              Company website scraping for research
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              Automatic email pattern detection
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              Social profile discovery
            </li>
          </ul>
          <p className="mt-3 text-sm text-blue-700">
            No additional setup required - just use the AI Chat to find leads!
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

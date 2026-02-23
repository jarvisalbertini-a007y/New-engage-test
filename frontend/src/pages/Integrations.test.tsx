/// <reference types="jest" />
import React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import Integrations from './Integrations';

type QueryResult = {
  data?: any;
  isLoading?: boolean;
  error?: any;
};

const mockUseQuery = jest.fn();
const mockUseMutation = jest.fn();
const mockUseQueryClient = jest.fn();

jest.mock('@tanstack/react-query', () => ({
  useQuery: (options: any) => mockUseQuery(options),
  useMutation: () => mockUseMutation(),
  useQueryClient: () => mockUseQueryClient(),
}));

jest.mock('../lib/api', () => ({
  api: {
    getIntegrations: jest.fn(),
    getGoogleStatus: jest.fn(),
    saveSendgridIntegration: jest.fn(),
    removeSendgridIntegration: jest.fn(),
    saveApolloIntegration: jest.fn(),
    saveClearbitIntegration: jest.fn(),
    saveCrunchbaseIntegration: jest.fn(),
    removeApolloIntegration: jest.fn(),
    removeClearbitIntegration: jest.fn(),
    removeCrunchbaseIntegration: jest.fn(),
    apolloSearchProspects: jest.fn(),
    apolloEnrichCompany: jest.fn(),
    clearbitEnrichCompany: jest.fn(),
    crunchbaseEnrichCompany: jest.fn(),
    orchestrateCompanyEnrichment: jest.fn(),
    initGoogleOAuth: jest.fn(),
    disconnectGoogle: jest.fn(),
    getIntegrationsHealth: jest.fn(),
    getIntegrationsSloGates: jest.fn(),
    getSalesCampaignPortfolio: jest.fn(),
    getSalesCampaignPerformance: jest.fn(),
    getIntegrationsTelemetrySummary: jest.fn(),
    getIntegrationsTelemetrySnapshotGovernance: jest.fn(),
    getIntegrationsBaselineGovernance: jest.fn(),
  },
}));

function setupQueryMocks(map: Record<string, QueryResult>) {
  mockUseQuery.mockImplementation(({ queryKey, enabled = true }: any) => {
    if (!enabled) {
      return { data: undefined, isLoading: false, error: null };
    }
    const key = Array.isArray(queryKey) ? queryKey[0] : queryKey;
    const result = map[key] || {};
    return {
      data: result.data,
      isLoading: result.isLoading || false,
      error: result.error || null,
    };
  });
}

function findButton(container: HTMLDivElement, label: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll('button')).find((element) =>
    (element.textContent || '').includes(label)
  ) as HTMLButtonElement | undefined;
  if (!button) {
    throw new Error(`Button not found: ${label}`);
  }
  return button;
}

function findInputByLabel(container: HTMLDivElement, label: string, occurrence = 0): HTMLInputElement {
  const labels = Array.from(container.querySelectorAll('label')).filter((element) =>
    (element.textContent || '').includes(label)
  );
  const targetLabel = labels[occurrence];
  if (!targetLabel) {
    throw new Error(`Label not found: ${label} (${occurrence})`);
  }
  const input = targetLabel.parentElement?.querySelector('input') as HTMLInputElement | null;
  if (!input) {
    throw new Error(`Input not found for label: ${label} (${occurrence})`);
  }
  return input;
}

function setInputValue(input: HTMLInputElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (!valueSetter) {
    throw new Error('Input value setter is unavailable');
  }
  valueSetter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('Integrations page analytics panels', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    if (!URL.createObjectURL) {
      (URL as any).createObjectURL = () => 'blob:mock-url';
    }
    if (!URL.revokeObjectURL) {
      (URL as any).revokeObjectURL = () => {};
    }
    jest.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    jest.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    mockUseMutation.mockReturnValue({ mutate: jest.fn(), isPending: false });
    mockUseQueryClient.mockReturnValue({ invalidateQueries: jest.fn() });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('renders campaign and telemetry summaries when data is available', async () => {
    setupQueryMocks({
      integrations: { data: { sendgrid_configured: true, sendgrid_api_key: '••••••••1234' } },
      googleStatus: { data: { connected: false } },
      'integrations-health': {
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
          providers: [{ provider: 'apollo', healthy: true, statusCode: null, latencyMs: null, error: null }],
        },
      },
      'sales-campaign-portfolio': {
        data: {
          campaignCount: 1,
          activeCampaignCount: 1,
          portfolioTotals: { sent: 140, opened: 56, replied: 16 },
          averageReplyRate: 0.1143,
          rankedCampaigns: [
            {
              campaignId: 'c1',
              name: 'Q2 Outbound',
              status: 'active',
              totals: { sent: 140, opened: 56, replied: 16 },
              overall: { openRate: 0.4, replyRate: 0.1143, qualityTier: 'watch' },
            },
          ],
        },
      },
      'sales-campaign-performance': {
        data: {
          campaignId: 'c1',
          name: 'Q2 Outbound',
          status: 'active',
          totals: { sent: 140, opened: 56, replied: 16 },
          overall: { openRate: 0.4, replyRate: 0.1143, replyToOpenRate: 0.2857, qualityTier: 'watch' },
          byChannel: [],
          recommendations: ['Improve call-to-action clarity'],
        },
      },
      'integrations-telemetry-summary': {
        data: {
          eventCount: 22,
          errorEventCount: 1,
          byProvider: { sendgrid: 8, sales_intelligence: 14 },
          bySchemaVersion: { 1: 8, 2: 14 },
          trendByDay: [{ date: '2026-02-21', events: 10, errors: 1, salesIntelligenceEvents: 6 }],
          salesIntelligence: {
            eventCount: 14,
            byEventFamily: { campaigns: 9, prediction: 5 },
            bySchemaVersion: { 2: 14 },
          },
          traceabilityAudit: {
            eventCount: 3,
            decisionCounts: { HOLD: 2, PROCEED: 1 },
            readyCount: 1,
            notReadyCount: 2,
            latestEvaluatedAt: '2026-02-22T00:00:00Z',
          },
          recentEvents: [
            {
              provider: 'integrations',
              eventType: 'integrations_traceability_status_evaluated',
              requestId: 'req-traceability-1',
              schemaVersion: 'unknown',
              traceabilityDecision: 'HOLD',
              traceabilityReady: false,
            },
            {
              provider: 'sales_intelligence',
              eventType: 'sales_pipeline_forecast_generated',
              requestId: 'req-sales-1',
              schemaVersion: 2,
            },
          ],
        },
      },
      'integrations-slo-gates': {
        data: {
          decision: 'PROCEED',
          eventCount: 22,
          gates: { overallPassed: true, errorRatePassed: true, latencyPassed: true, schemaCoveragePassed: true, schemaSampleSizePassed: true },
          errorRate: { observedPct: 1.2, thresholdPct: 5, errorEvents: 1 },
          schemaCoverage: { observedPct: 100, thresholdPct: 95, sampleCount: 14, minSampleCount: 25, schemaV2Count: 14 },
          providerLatency: {},
          alerts: [],
          rolloutActions: [],
          signoff: { status: 'READY_FOR_APPROVAL', requiredApprovals: [], requiredEvidence: [] },
        },
      },
      'integrations-telemetry-governance': {
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
          retentionDays: 30,
          status: 'ACTION_REQUIRED',
          snapshot: {
            directory: '/tmp',
            prefix: 'connector-telemetry-summary',
            fileCount: 2,
            latestGeneratedAt: '2026-02-20T00:00:00Z',
            ageDays: 2,
            withinRetention: true,
            staleCount: 1,
          },
          releaseGateFixtures: {
            allProfilesAvailable: false,
            missingProfiles: ['validation-fail'],
          },
          alerts: ['Release-gate fixture profile(s) missing: validation-fail'],
        },
      },
      'integrations-baseline-governance': {
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
          artifactGeneratedAt: '2026-02-22T00:00:00Z',
          artifactPath: '/tmp/baseline_metrics.json',
          overallStatus: 'pass',
          status: 'PASS',
          releaseGateFixturePolicy: {
            passed: true,
            requiredProfiles: ['pass', 'hold', 'validation-fail'],
            missingProfiles: [],
            message: 'All required release-gate fixture profiles are present.',
          },
          releaseGateFixtures: {
            allProfilesAvailable: true,
            availableProfileCount: 3,
            profileCount: 3,
          },
        },
      },
    });

    await act(async () => {
      root.render(<Integrations />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Campaign Performance Snapshot');
    expect(container.textContent).toContain('Avg Reply Rate');
    expect(container.textContent).toContain('Q2 Outbound');
    expect(container.textContent).toContain('Telemetry Summary (7 Days)');
    expect(container.textContent).toContain('Refresh Telemetry');
    expect(container.textContent).toContain('Export Telemetry JSON');
    expect(container.textContent).toContain('Telemetry Daily Trend');
    expect(container.textContent).toContain('events 10');
    expect(container.textContent).toContain('Sales Event Families');
    expect(container.textContent).toContain('campaigns');
    expect(container.textContent).toContain('prediction');
    expect(container.textContent).toContain('Schema Version Adoption');
    expect(container.textContent).toContain('Sales Schema Versions');
    expect(container.textContent).toContain('Traceability Audits');
    expect(container.textContent).toContain('Traceability Audit Decisions');
    expect(container.textContent).toContain('Traceability Snapshot Governance');
    expect(container.textContent).toContain('Baseline Fixture Governance');
    expect(container.textContent).toContain('ACTION_REQUIRED');
    expect(container.textContent).toContain('All required release-gate fixture profiles are present.');
    expect(container.textContent).toContain('Missing fixture profiles: validation-fail');
    expect(container.textContent).toContain('HOLD');
    expect(container.textContent).toContain('PROCEED');
    expect(container.textContent).toContain('Recent Correlated Events');
    expect(container.textContent).toContain('traceability HOLD');
    expect(container.textContent).toContain('req-sales-1');
    expect(container.textContent).toContain('Schema Sample Size');
    expect(container.textContent).toContain('14 / 25');
  });

  it('renders feature-disabled message when campaign analytics is disabled', async () => {
    setupQueryMocks({
      integrations: { data: { sendgrid_configured: false } },
      googleStatus: { data: { connected: false } },
      'integrations-health': { data: { generatedAt: '2026-02-22T00:00:00Z', providers: [] } },
      'sales-campaign-portfolio': {
        error: new Error('Sales campaigns are disabled by feature flag.'),
      },
      'sales-campaign-performance': { data: undefined },
      'integrations-telemetry-summary': {
        data: { eventCount: 0, errorEventCount: 0, byProvider: {}, salesIntelligence: { eventCount: 0, byEventFamily: {} } },
      },
      'integrations-slo-gates': {
        data: {
          decision: 'PROCEED',
          eventCount: 0,
          errorRate: { observedPct: 0, thresholdPct: 5, errorEvents: 0 },
          providerLatency: {},
          alerts: [],
          rolloutActions: [],
          signoff: { status: 'READY_FOR_APPROVAL', requiredApprovals: [], requiredEvidence: [] },
        },
      },
      'integrations-telemetry-governance': {
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
          retentionDays: 30,
          status: 'READY',
          snapshot: {
            directory: '/tmp',
            prefix: 'connector-telemetry-summary',
            fileCount: 2,
            latestGeneratedAt: '2026-02-22T00:00:00Z',
            ageDays: 0,
            withinRetention: true,
            staleCount: 0,
          },
          releaseGateFixtures: {
            allProfilesAvailable: true,
            missingProfiles: [],
          },
          alerts: [],
        },
      },
      'integrations-baseline-governance': {
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
          artifactGeneratedAt: '2026-02-22T00:00:00Z',
          artifactPath: '/tmp/baseline_metrics.json',
          overallStatus: 'pass',
          status: 'PASS',
          releaseGateFixturePolicy: {
            passed: true,
            requiredProfiles: ['pass', 'hold', 'validation-fail'],
            missingProfiles: [],
            message: 'All required release-gate fixture profiles are present.',
          },
          releaseGateFixtures: {
            allProfilesAvailable: true,
            availableProfileCount: 3,
            profileCount: 3,
          },
        },
      },
    });

    await act(async () => {
      root.render(<Integrations />);
    });

    expect(container.textContent).toContain('Campaign analytics is currently disabled by feature flag.');
  });

  it('shows configured connector rows with health status', async () => {
    setupQueryMocks({
      integrations: {
        data: {
          sendgrid_configured: false,
          apollo_configured: true,
          apollo_api_key: '••••••••abcd',
          clearbit_configured: true,
          clearbit_api_key: '••••••••efgh',
          crunchbase_configured: false,
          apollo_enabled: true,
          clearbit_enabled: false,
          crunchbase_enabled: false,
        },
      },
      googleStatus: { data: { connected: false } },
      'integrations-health': {
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
          providers: [
            { provider: 'apollo', healthy: true, statusCode: null, latencyMs: null, error: null },
            { provider: 'clearbit', healthy: false, statusCode: null, latencyMs: null, error: 'Configured but connector disabled by feature flag' },
          ],
        },
      },
      'sales-campaign-portfolio': {
        data: {
          campaignCount: 0,
          activeCampaignCount: 0,
          portfolioTotals: { sent: 0, opened: 0, replied: 0 },
          averageReplyRate: 0,
          rankedCampaigns: [],
        },
      },
      'sales-campaign-performance': { data: undefined },
      'integrations-telemetry-summary': {
        data: { eventCount: 0, errorEventCount: 0, byProvider: {}, salesIntelligence: { eventCount: 0, byEventFamily: {} } },
      },
      'integrations-slo-gates': {
        data: {
          decision: 'HOLD',
          eventCount: 12,
          errorRate: { observedPct: 8, thresholdPct: 5, errorEvents: 1 },
          providerLatency: {},
          alerts: [{ gate: 'error_rate', severity: 'high', message: 'Error rate exceeded threshold' }],
          rolloutActions: [{ priority: 'P1', ownerRole: 'On-call Engineer', action: 'Pause rollout', trigger: 'Error rate exceeded' }],
          signoff: { status: 'HOLD_REMEDIATION_REQUIRED', requiredApprovals: [], requiredEvidence: [] },
        },
      },
    });

    await act(async () => {
      root.render(<Integrations />);
    });

    expect(container.textContent).toContain('Apollo.io');
    expect(container.textContent).toContain('Clearbit');
    expect(container.textContent).toContain('Status: Healthy');
    expect(container.textContent).toContain('Configured but connector disabled by feature flag');
    expect(container.textContent).toContain('Flag Off');
  });

  it('renders connector lookup sandbox controls', async () => {
    setupQueryMocks({
      integrations: { data: { sendgrid_configured: false, apollo_enabled: true, clearbit_enabled: true, crunchbase_enabled: true } },
      googleStatus: { data: { connected: false } },
      'integrations-health': { data: { generatedAt: '2026-02-22T00:00:00Z', providers: [] } },
      'sales-campaign-portfolio': {
        data: {
          campaignCount: 0,
          activeCampaignCount: 0,
          portfolioTotals: { sent: 0, opened: 0, replied: 0 },
          averageReplyRate: 0,
          rankedCampaigns: [],
        },
      },
      'sales-campaign-performance': { data: undefined },
      'integrations-telemetry-summary': {
        data: { eventCount: 0, errorEventCount: 0, byProvider: {}, salesIntelligence: { eventCount: 0, byEventFamily: {} } },
      },
      'integrations-slo-gates': {
        data: {
          decision: 'PROCEED',
          eventCount: 0,
          errorRate: { observedPct: 0, thresholdPct: 5, errorEvents: 0 },
          providerLatency: {},
          alerts: [],
          rolloutActions: [],
          signoff: { status: 'READY_FOR_APPROVAL', requiredApprovals: [], requiredEvidence: [] },
        },
      },
      'integrations-telemetry-governance': {
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
          retentionDays: 30,
          status: 'READY',
          snapshot: {
            directory: '/tmp',
            prefix: 'connector-telemetry-summary',
            fileCount: 2,
            latestGeneratedAt: '2026-02-22T00:00:00Z',
            ageDays: 0,
            withinRetention: true,
            staleCount: 0,
          },
          releaseGateFixtures: {
            allProfilesAvailable: true,
            missingProfiles: [],
          },
          alerts: [],
        },
      },
      'integrations-baseline-governance': {
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
          artifactGeneratedAt: '2026-02-22T00:00:00Z',
          artifactPath: '/tmp/baseline_metrics.json',
          overallStatus: 'pass',
          status: 'PASS',
          releaseGateFixturePolicy: {
            passed: true,
            requiredProfiles: ['pass', 'hold', 'validation-fail'],
            missingProfiles: [],
            message: 'All required release-gate fixture profiles are present.',
          },
          releaseGateFixtures: {
            allProfilesAvailable: true,
            availableProfileCount: 3,
            profileCount: 3,
          },
        },
      },
    });

    await act(async () => {
      root.render(<Integrations />);
    });

    expect(container.textContent).toContain('Connector Enrichment Sandbox');
    expect(container.textContent).toContain('Company Enrichment');
    expect(container.textContent).toContain('Orchestrated Fallback');
    expect(container.textContent).toContain('Run Company Lookup');
    expect(container.textContent).toContain('Apollo Prospect Lookup');
    expect(container.textContent).toContain('Run Apollo Lookup');
  });

  it('renders connector SLO gate panel with decision and actions', async () => {
    setupQueryMocks({
      integrations: { data: { sendgrid_configured: false, apollo_enabled: true, clearbit_enabled: true, crunchbase_enabled: true } },
      googleStatus: { data: { connected: false } },
      'integrations-health': { data: { generatedAt: '2026-02-22T00:00:00Z', providers: [] } },
      'sales-campaign-portfolio': {
        data: {
          campaignCount: 0,
          activeCampaignCount: 0,
          portfolioTotals: { sent: 0, opened: 0, replied: 0 },
          averageReplyRate: 0,
          rankedCampaigns: [],
        },
      },
      'sales-campaign-performance': { data: undefined },
      'integrations-telemetry-summary': {
        data: { eventCount: 0, errorEventCount: 0, byProvider: {}, salesIntelligence: { eventCount: 0, byEventFamily: {} } },
      },
      'integrations-slo-gates': {
        data: {
          decision: 'HOLD',
          eventCount: 42,
          errorRate: { observedPct: 8.2, thresholdPct: 5, errorEvents: 3 },
          schemaCoverage: { observedPct: 72, thresholdPct: 95, sampleCount: 25, schemaV2Count: 18 },
          providerLatency: {
            apollo: { thresholdP95Ms: 4000, observedP95Ms: 5200, sampleCount: 10, passed: false },
          },
          alerts: [{ gate: 'provider_latency', severity: 'medium', provider: 'apollo', message: 'P95 latency exceeded threshold' }],
          rolloutActions: [{ priority: 'P2', ownerRole: 'Integrations Engineer', action: 'Disable apollo connector', trigger: 'P95 latency exceeded threshold' }],
          signoff: {
            status: 'HOLD_REMEDIATION_REQUIRED',
            requiredApprovals: [{ role: 'Release Manager', required: true }],
            requiredEvidence: ['connector_canary_evidence.json'],
          },
        },
      },
    });

    await act(async () => {
      root.render(<Integrations />);
    });

    expect(container.textContent).toContain('Connector Rollout SLO Gate');
    expect(container.textContent).toContain('HOLD');
    expect(container.textContent).toContain('8.20%');
    expect(container.textContent).toContain('Schema v2 Coverage');
    expect(container.textContent).toContain('72.00%');
    expect(container.textContent).toContain('Export SLO JSON');
    expect(container.textContent).toContain('Rollout Actions');
    expect(container.textContent).toContain('Integrations Engineer');
    expect(container.textContent).toContain('Signoff Requirements');
    expect(container.textContent).toContain('connector_canary_evidence.json');
    expect(container.textContent).toContain('Active Alerts');
  });

  it('renders signoff traceability readiness state when schema gates and signoff requirements are satisfied', async () => {
    setupQueryMocks({
      integrations: { data: { sendgrid_configured: false, apollo_enabled: true, clearbit_enabled: true, crunchbase_enabled: true } },
      googleStatus: { data: { connected: false } },
      'integrations-health': { data: { generatedAt: '2026-02-22T00:00:00Z', providers: [] } },
      'sales-campaign-portfolio': {
        data: {
          campaignCount: 0,
          activeCampaignCount: 0,
          portfolioTotals: { sent: 0, opened: 0, replied: 0 },
          averageReplyRate: 0,
          rankedCampaigns: [],
        },
      },
      'sales-campaign-performance': { data: undefined },
      'integrations-telemetry-summary': {
        data: { eventCount: 0, errorEventCount: 0, byProvider: {}, salesIntelligence: { eventCount: 0, byEventFamily: {} } },
      },
      'integrations-slo-gates': {
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
          windowDays: 7,
          decision: 'PROCEED',
          eventCount: 12,
          gates: {
            overallPassed: true,
            errorRatePassed: true,
            latencyPassed: true,
            schemaCoveragePassed: true,
            schemaSampleSizePassed: true,
          },
          errorRate: { observedPct: 0.8, thresholdPct: 5, errorEvents: 1 },
          schemaCoverage: { observedPct: 100, thresholdPct: 95, sampleCount: 30, minSampleCount: 25, schemaV2Count: 30 },
          providerLatency: {},
          alerts: [],
          rolloutActions: [],
          signoff: {
            status: 'READY_FOR_APPROVAL',
            requiredApprovals: [
              { role: 'Release Manager', required: true },
              { role: 'Sales Ops Lead', required: true },
            ],
            requiredEvidence: ['connector_canary_evidence.json', 'telemetry_slo_gates_snapshot.json'],
          },
        },
      },
    });

    await act(async () => {
      root.render(<Integrations />);
    });

    expect(container.textContent).toContain('Traceability Readiness');
    expect(container.textContent).toContain('READY');
    expect(container.textContent).toContain('Approvals 2');
    expect(container.textContent).toContain('Evidence 2');
  });

  it('renders remediation guidance when traceability readiness is not ready', async () => {
    setupQueryMocks({
      integrations: { data: { sendgrid_configured: false, apollo_enabled: true, clearbit_enabled: true, crunchbase_enabled: true } },
      googleStatus: { data: { connected: false } },
      'integrations-health': { data: { generatedAt: '2026-02-22T00:00:00Z', providers: [] } },
      'sales-campaign-portfolio': {
        data: {
          campaignCount: 0,
          activeCampaignCount: 0,
          portfolioTotals: { sent: 0, opened: 0, replied: 0 },
          averageReplyRate: 0,
          rankedCampaigns: [],
        },
      },
      'sales-campaign-performance': { data: undefined },
      'integrations-telemetry-summary': {
        data: { eventCount: 0, errorEventCount: 0, byProvider: {}, salesIntelligence: { eventCount: 0, byEventFamily: {} } },
      },
      'integrations-slo-gates': {
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
          windowDays: 7,
          decision: 'HOLD',
          eventCount: 6,
          gates: {
            overallPassed: false,
            errorRatePassed: true,
            latencyPassed: true,
            schemaCoveragePassed: false,
            schemaSampleSizePassed: false,
          },
          errorRate: { observedPct: 3.5, thresholdPct: 5, errorEvents: 1 },
          schemaCoverage: { observedPct: 82, thresholdPct: 95, sampleCount: 8, minSampleCount: 25, schemaV2Count: 7 },
          providerLatency: {},
          alerts: [],
          rolloutActions: [],
          signoff: {
            status: 'HOLD_REMEDIATION_REQUIRED',
            requiredApprovals: [],
            requiredEvidence: [],
          },
        },
      },
    });

    await act(async () => {
      root.render(<Integrations />);
    });

    expect(container.textContent).toContain('Traceability Readiness');
    expect(container.textContent).toContain('NOT READY');
    expect(container.textContent).toContain('Remediation Checklist');
    expect(container.textContent).toContain('Resolve schema coverage gate failures before rollout.');
    expect(container.textContent).toContain('Collect additional schema-v2 events to satisfy the minimum sample requirement.');
    expect(container.textContent).toContain('Advance signoff status to READY_FOR_APPROVAL');
    expect(container.textContent).toContain('Populate required approval roles in the SLO signoff payload.');
    expect(container.textContent).toContain('Populate required evidence artifacts in the SLO signoff payload.');
  });

  it('re-issues telemetry query when refresh is clicked', async () => {
    setupQueryMocks({
      integrations: { data: { sendgrid_configured: false, apollo_enabled: true, clearbit_enabled: true, crunchbase_enabled: true } },
      googleStatus: { data: { connected: false } },
      'integrations-health': { data: { generatedAt: '2026-02-22T00:00:00Z', providers: [] } },
      'sales-campaign-portfolio': {
        data: {
          campaignCount: 0,
          activeCampaignCount: 0,
          portfolioTotals: { sent: 0, opened: 0, replied: 0 },
          averageReplyRate: 0,
          rankedCampaigns: [],
        },
      },
      'sales-campaign-performance': { data: undefined },
      'integrations-telemetry-summary': {
        data: { eventCount: 1, errorEventCount: 0, byProvider: { sendgrid: 1 }, trendByDay: [], salesIntelligence: { eventCount: 0, byEventFamily: {} } },
      },
      'integrations-slo-gates': {
        data: {
          decision: 'PROCEED',
          eventCount: 1,
          errorRate: { observedPct: 0, thresholdPct: 5, errorEvents: 0 },
          providerLatency: {},
          alerts: [],
          rolloutActions: [],
          signoff: { status: 'READY_FOR_APPROVAL', requiredApprovals: [], requiredEvidence: [] },
        },
      },
      'integrations-telemetry-governance': {
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
          retentionDays: 30,
          status: 'READY',
          snapshot: {
            directory: '/tmp',
            prefix: 'connector-telemetry-summary',
            fileCount: 2,
            latestGeneratedAt: '2026-02-22T00:00:00Z',
            ageDays: 0,
            withinRetention: true,
            staleCount: 0,
          },
          releaseGateFixtures: {
            allProfilesAvailable: true,
            missingProfiles: [],
          },
          alerts: [],
        },
      },
      'integrations-baseline-governance': {
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
          artifactGeneratedAt: '2026-02-22T00:00:00Z',
          artifactPath: '/tmp/baseline_metrics.json',
          overallStatus: 'pass',
          status: 'PASS',
          releaseGateFixturePolicy: {
            passed: true,
            requiredProfiles: ['pass', 'hold', 'validation-fail'],
            missingProfiles: [],
            message: 'All required release-gate fixture profiles are present.',
          },
          releaseGateFixtures: {
            allProfilesAvailable: true,
            availableProfileCount: 3,
            profileCount: 3,
          },
        },
      },
    });

    await act(async () => {
      root.render(<Integrations />);
    });

    mockUseQuery.mockClear();

    await act(async () => {
      findButton(container, 'Refresh Telemetry').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const telemetryCalls = mockUseQuery.mock.calls
      .map((args) => args[0])
      .filter((options) => Array.isArray(options?.queryKey) && options.queryKey[0] === 'integrations-telemetry-summary');
    expect(
      telemetryCalls.some((options) => options.queryKey[1] === 7 && options.queryKey[2] === 500)
    ).toBe(true);
  });

  it('re-issues SLO gate query when refresh is clicked', async () => {
    setupQueryMocks({
      integrations: { data: { sendgrid_configured: false, apollo_enabled: true, clearbit_enabled: true, crunchbase_enabled: true } },
      googleStatus: { data: { connected: false } },
      'integrations-health': { data: { generatedAt: '2026-02-22T00:00:00Z', providers: [] } },
      'sales-campaign-portfolio': {
        data: {
          campaignCount: 0,
          activeCampaignCount: 0,
          portfolioTotals: { sent: 0, opened: 0, replied: 0 },
          averageReplyRate: 0,
          rankedCampaigns: [],
        },
      },
      'sales-campaign-performance': { data: undefined },
      'integrations-telemetry-summary': {
        data: { eventCount: 1, errorEventCount: 0, byProvider: { sendgrid: 1 }, trendByDay: [], salesIntelligence: { eventCount: 0, byEventFamily: {} } },
      },
      'integrations-slo-gates': {
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
          windowDays: 7,
          decision: 'PROCEED',
          eventCount: 1,
          gates: { overallPassed: true, errorRatePassed: true, latencyPassed: true },
          errorRate: { observedPct: 0, thresholdPct: 5, errorEvents: 0 },
          providerLatency: {},
          alerts: [],
          rolloutActions: [],
          signoff: { status: 'READY_FOR_APPROVAL', requiredApprovals: [], requiredEvidence: [] },
        },
      },
      'integrations-telemetry-governance': {
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
          retentionDays: 30,
          status: 'READY',
          snapshot: {
            directory: '/tmp',
            prefix: 'connector-telemetry-summary',
            fileCount: 2,
            latestGeneratedAt: '2026-02-22T00:00:00Z',
            ageDays: 0,
            withinRetention: true,
            staleCount: 0,
          },
          releaseGateFixtures: {
            allProfilesAvailable: true,
            missingProfiles: [],
          },
          alerts: [],
        },
      },
      'integrations-baseline-governance': {
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
          artifactGeneratedAt: '2026-02-22T00:00:00Z',
          artifactPath: '/tmp/baseline_metrics.json',
          overallStatus: 'pass',
          status: 'PASS',
          releaseGateFixturePolicy: {
            passed: true,
            requiredProfiles: ['pass', 'hold', 'validation-fail'],
            missingProfiles: [],
            message: 'All required release-gate fixture profiles are present.',
          },
          releaseGateFixtures: {
            allProfilesAvailable: true,
            availableProfileCount: 3,
            profileCount: 3,
          },
        },
      },
    });

    await act(async () => {
      root.render(<Integrations />);
    });

    mockUseQuery.mockClear();

    await act(async () => {
      findButton(container, 'Refresh SLO Gates').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const sloCalls = mockUseQuery.mock.calls
      .map((args) => args[0])
      .filter((options) => Array.isArray(options?.queryKey) && options.queryKey[0] === 'integrations-slo-gates');
    expect(
      sloCalls.some((options) => options.queryKey[1] === 7 && options.queryKey[2] === 5 && options.queryKey[3] === 95 && options.queryKey[4] === 25)
    ).toBe(true);
  });

  it('exports telemetry and SLO snapshots through UI actions', async () => {
    setupQueryMocks({
      integrations: { data: { sendgrid_configured: false, apollo_enabled: true, clearbit_enabled: true, crunchbase_enabled: true } },
      googleStatus: { data: { connected: false } },
      'integrations-health': { data: { generatedAt: '2026-02-22T00:00:00Z', providers: [] } },
      'sales-campaign-portfolio': {
        data: {
          campaignCount: 0,
          activeCampaignCount: 0,
          portfolioTotals: { sent: 0, opened: 0, replied: 0 },
          averageReplyRate: 0,
          rankedCampaigns: [],
        },
      },
      'sales-campaign-performance': { data: undefined },
      'integrations-telemetry-summary': {
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
          windowDays: 7,
          eventCount: 4,
          errorEventCount: 0,
          byProvider: { sendgrid: 4 },
          trendByDay: [{ date: '2026-02-21', events: 4, errors: 0, salesIntelligenceEvents: 0 }],
          salesIntelligence: { eventCount: 0, byEventFamily: {} },
          traceabilityAudit: {
            eventCount: 1,
            decisionCounts: { HOLD: 1 },
            readyCount: 0,
            notReadyCount: 1,
            latestEvaluatedAt: '2026-02-22T00:00:00Z',
          },
          recentEvents: [
            {
              eventType: 'integrations_traceability_status_evaluated',
              provider: 'integrations',
              requestId: 'req-traceability-export',
              schemaVersion: 'unknown',
              traceabilityDecision: 'HOLD',
              traceabilityReady: false,
            },
          ],
        },
      },
      'integrations-slo-gates': {
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
          windowDays: 7,
          decision: 'PROCEED',
          eventCount: 4,
          gates: { overallPassed: true, errorRatePassed: true, latencyPassed: true },
          errorRate: { observedPct: 0, thresholdPct: 5, errorEvents: 0 },
          providerLatency: {},
          alerts: [],
          rolloutActions: [],
          signoff: { status: 'READY_FOR_APPROVAL', requiredApprovals: [], requiredEvidence: [] },
        },
      },
      'integrations-telemetry-governance': {
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
          retentionDays: 30,
          status: 'READY',
          snapshot: {
            directory: '/tmp',
            prefix: 'connector-telemetry-summary',
            fileCount: 2,
            latestGeneratedAt: '2026-02-22T00:00:00Z',
            ageDays: 0,
            withinRetention: true,
            staleCount: 0,
          },
          releaseGateFixtures: {
            allProfilesAvailable: true,
            missingProfiles: [],
          },
          alerts: [],
        },
      },
      'integrations-baseline-governance': {
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
          artifactGeneratedAt: '2026-02-22T00:00:00Z',
          artifactPath: '/tmp/baseline_metrics.json',
          overallStatus: 'pass',
          status: 'PASS',
          releaseGateFixturePolicy: {
            passed: true,
            requiredProfiles: ['pass', 'hold', 'validation-fail'],
            missingProfiles: [],
            message: 'All required release-gate fixture profiles are present.',
          },
          releaseGateFixtures: {
            allProfilesAvailable: true,
            availableProfileCount: 3,
            profileCount: 3,
          },
        },
      },
    });

    await act(async () => {
      root.render(<Integrations />);
    });

    const createObjectURLMock = URL.createObjectURL as jest.Mock;
    const revokeObjectURLMock = URL.revokeObjectURL as jest.Mock;

    await act(async () => {
      findButton(container, 'Export Telemetry JSON').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    const telemetryBlob = createObjectURLMock.mock.calls[0][0] as Blob;
    const telemetryPayload = JSON.parse(await new Response(telemetryBlob).text());
    expect(telemetryPayload.traceabilityAudit.decisionCounts.HOLD).toBe(1);
    expect(telemetryPayload.recentEvents[0].traceabilityDecision).toBe('HOLD');
    expect(container.textContent).toContain('connector-telemetry-summary exported.');

    await act(async () => {
      findButton(container, 'Dismiss notice').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.textContent).not.toContain('connector-telemetry-summary exported.');

    await act(async () => {
      findButton(container, 'Export Snapshot Governance JSON').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(createObjectURLMock).toHaveBeenCalledTimes(2);
    const snapshotGovernanceBlob = createObjectURLMock.mock.calls[1][0] as Blob;
    const snapshotGovernancePayload = JSON.parse(await new Response(snapshotGovernanceBlob).text());
    expect(snapshotGovernancePayload.status).toBe('READY');
    expect(container.textContent).toContain('connector-snapshot-governance exported.');

    await act(async () => {
      findButton(container, 'Export Baseline Governance JSON').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(createObjectURLMock).toHaveBeenCalledTimes(3);
    const baselineGovernanceBlob = createObjectURLMock.mock.calls[2][0] as Blob;
    const baselineGovernancePayload = JSON.parse(await new Response(baselineGovernanceBlob).text());
    expect(baselineGovernancePayload.status).toBe('PASS');
    expect(container.textContent).toContain('connector-baseline-governance exported.');

    await act(async () => {
      findButton(container, 'Export SLO JSON').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(createObjectURLMock).toHaveBeenCalledTimes(4);
    expect(revokeObjectURLMock).toHaveBeenCalledTimes(4);
    expect(container.textContent).toContain('connector-slo-gates exported.');
  });

  it('auto-clears operation notice after timeout', async () => {
    jest.useFakeTimers();
    setupQueryMocks({
      integrations: { data: { sendgrid_configured: false, apollo_enabled: true, clearbit_enabled: true, crunchbase_enabled: true } },
      googleStatus: { data: { connected: false } },
      'integrations-health': { data: { generatedAt: '2026-02-22T00:00:00Z', providers: [] } },
      'sales-campaign-portfolio': {
        data: {
          campaignCount: 0,
          activeCampaignCount: 0,
          portfolioTotals: { sent: 0, opened: 0, replied: 0 },
          averageReplyRate: 0,
          rankedCampaigns: [],
        },
      },
      'sales-campaign-performance': { data: undefined },
      'integrations-telemetry-summary': {
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
          windowDays: 7,
          eventCount: 2,
          errorEventCount: 0,
          byProvider: { sendgrid: 2 },
          trendByDay: [{ date: '2026-02-21', events: 2, errors: 0, salesIntelligenceEvents: 0 }],
          salesIntelligence: { eventCount: 0, byEventFamily: {} },
        },
      },
      'integrations-slo-gates': {
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
          windowDays: 7,
          decision: 'PROCEED',
          eventCount: 2,
          gates: { overallPassed: true, errorRatePassed: true, latencyPassed: true },
          errorRate: { observedPct: 0, thresholdPct: 5, errorEvents: 0 },
          providerLatency: {},
          alerts: [],
          rolloutActions: [],
          signoff: { status: 'READY_FOR_APPROVAL', requiredApprovals: [], requiredEvidence: [] },
        },
      },
    });

    await act(async () => {
      root.render(<Integrations />);
    });

    await act(async () => {
      findButton(container, 'Export Telemetry JSON').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.textContent).toContain('connector-telemetry-summary exported.');

    await act(async () => {
      jest.advanceTimersByTime(6100);
    });
    expect(container.textContent).not.toContain('connector-telemetry-summary exported.');
    jest.useRealTimers();
  });

  it('normalizes telemetry and SLO filter bounds on refresh', async () => {
    setupQueryMocks({
      integrations: { data: { sendgrid_configured: false, apollo_enabled: true, clearbit_enabled: true, crunchbase_enabled: true } },
      googleStatus: { data: { connected: false } },
      'integrations-health': { data: { generatedAt: '2026-02-22T00:00:00Z', providers: [] } },
      'sales-campaign-portfolio': {
        data: {
          campaignCount: 0,
          activeCampaignCount: 0,
          portfolioTotals: { sent: 0, opened: 0, replied: 0 },
          averageReplyRate: 0,
          rankedCampaigns: [],
        },
      },
      'sales-campaign-performance': { data: undefined },
      'integrations-telemetry-summary': {
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
          windowDays: 7,
          eventCount: 3,
          errorEventCount: 1,
          byProvider: { sendgrid: 3 },
          trendByDay: [],
          salesIntelligence: { eventCount: 0, byEventFamily: {} },
        },
      },
      'integrations-slo-gates': {
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
          windowDays: 7,
          decision: 'PROCEED',
          eventCount: 3,
          gates: { overallPassed: true, errorRatePassed: true, latencyPassed: true },
          errorRate: { observedPct: 0, thresholdPct: 5, errorEvents: 0 },
          providerLatency: {},
          alerts: [],
          rolloutActions: [],
          signoff: { status: 'READY_FOR_APPROVAL', requiredApprovals: [], requiredEvidence: [] },
        },
      },
    });

    await act(async () => {
      root.render(<Integrations />);
    });

    const telemetryDaysInput = findInputByLabel(container, 'Window Days', 0);
    const telemetryLimitInput = findInputByLabel(container, 'Event Limit', 0);

    await act(async () => {
      setInputValue(telemetryDaysInput, '999');
      setInputValue(telemetryLimitInput, '1');
    });

    mockUseQuery.mockClear();
    await act(async () => {
      findButton(container, 'Refresh Telemetry').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const telemetryCalls = mockUseQuery.mock.calls
      .map((args) => args[0])
      .filter((options) => Array.isArray(options?.queryKey) && options.queryKey[0] === 'integrations-telemetry-summary');
    expect(telemetryCalls.some((options) => options.queryKey[1] === 30 && options.queryKey[2] === 50)).toBe(true);
    expect(container.textContent).toContain('Telemetry filter values were normalized to allowed bounds.');

    const sloDaysInput = findInputByLabel(container, 'Window Days', 1);
    const maxErrorInput = findInputByLabel(container, 'Max Error Rate (%)', 0);
    const minSchemaInput = findInputByLabel(container, 'Min Schema v2 (%)', 0);
    const minSchemaSampleInput = findInputByLabel(container, 'Min Schema Sample Count', 0);

    await act(async () => {
      setInputValue(sloDaysInput, '-5');
      setInputValue(maxErrorInput, '999');
      setInputValue(minSchemaInput, '999');
      setInputValue(minSchemaSampleInput, '99999');
    });

    mockUseQuery.mockClear();
    await act(async () => {
      findButton(container, 'Refresh SLO Gates').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const sloCalls = mockUseQuery.mock.calls
      .map((args) => args[0])
      .filter((options) => Array.isArray(options?.queryKey) && options.queryKey[0] === 'integrations-slo-gates');
    expect(
      sloCalls.some((options) => options.queryKey[1] === 1 && options.queryKey[2] === 100 && options.queryKey[3] === 100 && options.queryKey[4] === 5000)
    ).toBe(true);
    expect(container.textContent).toContain('SLO filter values were normalized to allowed bounds.');
  });

  it('falls back metadata window and overall gate values when omitted', async () => {
    setupQueryMocks({
      integrations: { data: { sendgrid_configured: false, apollo_enabled: true, clearbit_enabled: true, crunchbase_enabled: true } },
      googleStatus: { data: { connected: false } },
      'integrations-health': { data: { generatedAt: '2026-02-22T00:00:00Z', providers: [] } },
      'sales-campaign-portfolio': {
        data: {
          campaignCount: 0,
          activeCampaignCount: 0,
          portfolioTotals: { sent: 0, opened: 0, replied: 0 },
          averageReplyRate: 0,
          rankedCampaigns: [],
        },
      },
      'sales-campaign-performance': { data: undefined },
      'integrations-telemetry-summary': {
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
          eventCount: 5,
          errorEventCount: 0,
          byProvider: { sendgrid: 5 },
          trendByDay: [],
          salesIntelligence: { eventCount: 0, byEventFamily: {} },
        },
      },
      'integrations-slo-gates': {
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
          decision: 'PROCEED',
          eventCount: 5,
          errorRate: { observedPct: 0, thresholdPct: 5, errorEvents: 0 },
          providerLatency: {},
          alerts: [],
          rolloutActions: [],
          signoff: { status: 'READY_FOR_APPROVAL', requiredApprovals: [], requiredEvidence: [] },
        },
      },
    });

    await act(async () => {
      root.render(<Integrations />);
    });

    expect(container.textContent).toContain('Telemetry Summary (7 Days)');
    expect(container.textContent).toContain('Window: 7 days');
    expect(container.textContent).toContain('Overall Gate: UNKNOWN');
  });
});

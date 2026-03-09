/// <reference types="jest" />
import React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import Integrations from './Integrations';
import { api } from '../lib/api';

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
  useMutation: (options: any) => mockUseMutation(options),
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
    getIntegrationsGovernanceReport: jest.fn(),
    getIntegrationsGovernanceReportExport: jest.fn(),
    getIntegrationsGovernanceReportHistory: jest.fn(),
    getIntegrationsGovernanceSchema: jest.fn(),
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

function setSelectValue(select: HTMLSelectElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
  if (!valueSetter) {
    throw new Error('Select value setter is unavailable');
  }
  valueSetter.call(select, value);
  select.dispatchEvent(new Event('change', { bubbles: true }));
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
          trendByDay: [{ date: '2026-02-21', events: 10, errors: 1, salesIntelligenceEvents: 6, orchestrationEvents: 2 }],
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
          governanceAudit: {
            eventCount: 2,
            snapshotEvaluationCount: 1,
            baselineEvaluationCount: 1,
            statusCounts: { ACTION_REQUIRED: 1, PASS: 1 },
            latestEvaluatedAt: '2026-02-22T00:00:00Z',
          },
          governanceSchemaAudit: {
            eventCount: 2,
            statusCounts: { ACTION_REQUIRED: 1, READY: 1 },
            reasonCodeParityPassCount: 1,
            reasonCodeParityFailCount: 1,
            recommendedCommandParityPassCount: 1,
            recommendedCommandParityFailCount: 1,
            handoffParityPassCount: 1,
            handoffParityFailCount: 1,
            allParityPassedCount: 1,
            allParityFailedCount: 1,
            rolloutBlockedCount: 1,
            latestEvaluatedAt: '2026-02-22T00:00:00Z',
          },
          packetValidationAudit: {
            eventCount: 2,
            statusCounts: { ACTION_REQUIRED: 1, READY: 1 },
            withinFreshnessCount: 1,
            outsideFreshnessCount: 1,
            missingFreshnessCount: 0,
            latestEvaluatedAt: '2026-02-22T00:00:00Z',
          },
          connectorRateLimit: {
            eventCount: 4,
            latestEventAt: '2026-02-22T00:00:00Z',
            maxRetryAfterSeconds: 30,
            avgRetryAfterSeconds: 29.5,
            maxResetInSeconds: 29,
            avgResetInSeconds: 29,
            byEndpoint: {
              '/api/integrations/apollo/company': 3,
              '/api/integrations/orchestration/company': 1,
            },
          },
          connectorValidation: {
            eventCount: 3,
            byEndpoint: {
              apollo_search: 2,
              clearbit_company: 1,
            },
            byProvider: {
              apollo: 2,
              clearbit: 1,
            },
            byField: {
              limit: 2,
              domain: 1,
            },
            byReason: {
              range: 2,
              required: 1,
            },
            latestEventAt: '2026-02-22T00:00:00Z',
          },
          recentEvents: [
            {
              provider: 'integrations',
              eventType: 'integrations_traceability_status_evaluated',
              requestId: 'req-traceability-1',
              schemaVersion: 'unknown',
              traceabilityDecision: 'HOLD',
              traceabilityReady: false,
              governancePacketValidationStatus: 'ACTION_REQUIRED',
              governancePacketValidationWithinFreshness: false,
            },
            {
              provider: 'integrations',
              eventType: 'integrations_traceability_snapshot_governance_evaluated',
              requestId: 'req-governance-1',
              schemaVersion: 'unknown',
              governanceStatus: 'ACTION_REQUIRED',
              governancePacketValidationStatus: 'READY',
              governancePacketValidationWithinFreshness: true,
              governanceSchemaReasonCodeParityOk: false,
              governanceSchemaRecommendedCommandParityOk: false,
              governanceSchemaHandoffParityOk: true,
              governanceSchemaAllParityOk: false,
              governanceSchemaRolloutBlocked: true,
              governanceSchemaReasonCodeCount: 2,
              governanceSchemaRecommendedCommandCount: 1,
            },
            {
              provider: 'sales_intelligence',
              eventType: 'sales_pipeline_forecast_generated',
              requestId: 'req-sales-1',
              schemaVersion: 2,
            },
            {
              provider: 'integrations',
              eventType: 'integrations_connector_rate_limited',
              requestId: 'req-rate-limit-1',
              schemaVersion: 'unknown',
              connectorRateLimitEndpoint: '/api/integrations/apollo/company',
              connectorRateLimitRetryAfterSeconds: 30,
              connectorRateLimitResetInSeconds: 29,
            },
            {
              provider: 'integrations',
              eventType: 'integrations_connector_input_validation_failed',
              requestId: 'req-validation-1',
              schemaVersion: 'unknown',
              connectorValidationProvider: 'apollo',
              connectorValidationEndpoint: 'apollo_search',
              connectorValidationField: 'limit',
              connectorValidationReason: 'range',
              connectorValidationErrorCode: 'invalid_request_bounds',
              connectorValidationReceived: 0,
              connectorValidationMinimum: 1,
              connectorValidationMaximum: 25,
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
          governanceType: 'snapshot',
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
          handoff: {
            rolloutBlocked: true,
            ownerRole: 'Release Manager',
            actions: [
              'Run telemetry traceability verification chain.',
              'Run cleanup dry-run and regenerate snapshot artifact.',
            ],
          },
          rolloutActions: [
            {
              priority: 'P1',
              severity: 'high',
              ownerRole: 'Release Manager',
              action: 'Execute retention cleanup and regenerate telemetry snapshot before rollout review.',
              trigger: 'snapshot_stale',
              command: 'npm run verify:telemetry:traceability:cleanup:policy',
            },
          ],
        },
      },
      'integrations-baseline-governance': {
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
          governanceType: 'baseline',
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
          alerts: [],
          handoff: {
            rolloutBlocked: false,
            ownerRole: 'Release Manager',
            actions: ['Baseline governance is healthy; proceed with signoff evidence review.'],
          },
          rolloutActions: [
            {
              priority: 'P3',
              severity: 'info',
              ownerRole: 'Release Manager',
              action: 'Baseline governance is healthy; proceed with signoff evidence review.',
              trigger: 'baseline_governance_ready',
              command: 'npm run verify:ci:sales:extended',
            },
          ],
        },
      },
      'integrations-governance-report': {
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
          windowDays: 7,
          eventLimit: 1000,
          totals: {
            governanceEventCount: 2,
            traceabilityEvaluationCount: 3,
            snapshotEvaluationCount: 1,
            baselineEvaluationCount: 1,
            actionRequiredCount: 1,
            connectorRateLimitEventCount: 2,
            rolloutBlockedCount: 2,
          },
          connectorRateLimit: {
            eventCount: 2,
            byEndpoint: {
              apollo_search: 1,
              company_enrichment_orchestration: 1,
            },
            latestEventAt: '2026-02-22T00:00:00Z',
            maxRetryAfterSeconds: 42,
            avgRetryAfterSeconds: 31,
            maxResetInSeconds: 40,
            avgResetInSeconds: 30,
            pressure: {
              label: 'Moderate',
              signalSeconds: 42,
            },
          },
          governanceStatusCounts: { ACTION_REQUIRED: 1, PASS: 1 },
          traceabilityDecisionCounts: { HOLD: 2, PROCEED: 1 },
          timeline: [
            {
              date: '2026-02-21',
              traceabilityEvents: 2,
              snapshotGovernanceEvents: 1,
              baselineGovernanceEvents: 1,
              actionRequiredEvents: 1,
              holdDecisions: 1,
              proceedDecisions: 1,
              statusCounts: { ACTION_REQUIRED: 1, PASS: 1 },
            },
          ],
          latestEvents: [
            {
              createdAt: '2026-02-22T00:00:00Z',
              governanceType: 'snapshot',
              status: 'ACTION_REQUIRED',
              requestId: 'req-governance-1',
              rolloutBlocked: true,
            },
          ],
          ownerActionMatrix: [
            {
              priority: 'P1',
              severity: 'high',
              ownerRole: 'Release Manager',
              trigger: 'governance_action_required',
              action: 'Run traceability cleanup policy checks.',
              command: 'npm run verify:telemetry:traceability:cleanup:policy',
            },
          ],
          recommendedCommands: [
            'npm run verify:telemetry:traceability:cleanup:policy',
            'npm run verify:smoke:traceability-governance-handoff',
          ],
        },
      },
      'integrations-governance-report-export': {
        data: {
          governanceType: 'weekly_report',
          exportSchemaVersion: 1,
          generatedAt: '2026-02-22T00:00:00Z',
          windowDays: 7,
          eventLimit: 1000,
          status: 'ACTION_REQUIRED',
          totals: {
            governanceEventCount: 2,
            traceabilityEvaluationCount: 1,
            snapshotEvaluationCount: 1,
            baselineEvaluationCount: 1,
            actionRequiredCount: 1,
            connectorRateLimitEventCount: 2,
            sendgridWebhookTimestampEventCount: 2,
            sendgridWebhookTimestampAnomalyCountTotal: 3,
            rolloutBlockedCount: 2,
          },
          connectorRateLimit: {
            eventCount: 2,
            byEndpoint: {
              apollo_search: 1,
              company_enrichment_orchestration: 1,
            },
            latestEventAt: '2026-02-22T00:00:00Z',
            maxRetryAfterSeconds: 42,
            avgRetryAfterSeconds: 31,
            maxResetInSeconds: 40,
            avgResetInSeconds: 30,
            pressure: {
              label: 'Moderate',
              signalSeconds: 42,
            },
          },
          recommendedCommands: [
            'npm run verify:governance:weekly',
            'npm run verify:smoke:governance-export-guard',
          ],
          runtimePrereqs: {
            present: true,
            available: true,
            passed: true,
            contractValid: true,
            valid: true,
            missingCheckCount: 0,
            missingChecks: {
              commands: [],
              workspace: [],
            },
            command: 'npm run verify:baseline:runtime-prereqs:artifact',
          },
          governanceExport: {
            governanceType: 'weekly_report',
            exportSchemaVersion: 1,
            status: 'ACTION_REQUIRED',
            rolloutBlocked: true,
            ownerRole: 'Release Manager',
            connectorRateLimit: {
              eventCount: 2,
              byEndpoint: {
                apollo_search: 1,
                company_enrichment_orchestration: 1,
              },
              latestEventAt: '2026-02-22T00:00:00Z',
              maxRetryAfterSeconds: 42,
              avgRetryAfterSeconds: 31,
              maxResetInSeconds: 40,
              avgResetInSeconds: 30,
              pressure: {
                label: 'Moderate',
                signalSeconds: 42,
              },
            },
            alerts: [
              {
                severity: 'high',
                ownerRole: 'Release Manager',
                message: 'Snapshot governance contains ACTION_REQUIRED evaluations.',
              },
            ],
            actions: [],
            runtimePrereqs: {
              present: true,
              available: true,
              passed: true,
              contractValid: true,
              valid: true,
              missingCheckCount: 0,
              missingChecks: {
                commands: [],
                workspace: [],
              },
              command: 'npm run verify:baseline:runtime-prereqs:artifact',
            },
            requestedBy: 'u1',
          },
          requestedBy: 'u1',
        },
      },
      'integrations-governance-report-history': {
        data: {
          governanceType: 'weekly_report_history',
          exportSchemaVersion: 1,
          generatedAt: '2026-02-22T00:00:00Z',
          retentionDays: 7,
          limit: 50,
          artifactDirectory: '/tmp',
          artifactPrefix: 'connector_governance_weekly_report',
          artifactCount: 2,
          staleCount: 1,
          rolloutBlockedCount: 1,
          connectorRateLimit: {
            eventCount: 3,
            byEndpoint: {
              apollo_search: 2,
              company_enrichment_orchestration: 1,
            },
            latestEventAt: '2026-02-22T00:00:00Z',
            maxRetryAfterSeconds: 47,
            avgRetryAfterSeconds: 33,
            maxResetInSeconds: 45,
            avgResetInSeconds: 29,
            pressure: {
              label: 'High',
              signalSeconds: 47,
            },
          },
          latestArtifact: {
            name: 'connector_governance_weekly_report_recent.json',
            exportSchemaVersion: 1,
            status: 'ACTION_REQUIRED',
            rolloutBlocked: true,
          },
          items: [
            {
              name: 'connector_governance_weekly_report_recent.json',
              exportSchemaVersion: 1,
              status: 'ACTION_REQUIRED',
              withinRetention: true,
              rolloutBlocked: true,
            },
            {
              name: 'connector_governance_weekly_report_stale.json',
              exportSchemaVersion: 1,
              status: 'READY',
              withinRetention: false,
              rolloutBlocked: false,
            },
          ],
          status: 'ACTION_REQUIRED',
          alerts: ['One or more governance weekly report artifacts are outside retention threshold.'],
          recommendedCommands: ['npm run verify:governance:weekly:cleanup:policy'],
          runtimePrereqs: {
            present: true,
            available: false,
            passed: false,
            contractValid: true,
            valid: false,
            missingCheckCount: 1,
            missingChecks: {
              commands: ['node'],
              workspace: [],
            },
            command: 'npm run verify:baseline:runtime-prereqs:artifact',
          },
          governanceExport: {
            governanceType: 'weekly_report_history',
            exportSchemaVersion: 1,
            status: 'ACTION_REQUIRED',
            rolloutBlocked: true,
            ownerRole: 'Release Manager',
            connectorRateLimit: {
              eventCount: 3,
              byEndpoint: {
                apollo_search: 2,
                company_enrichment_orchestration: 1,
              },
              latestEventAt: '2026-02-22T00:00:00Z',
              maxRetryAfterSeconds: 47,
              avgRetryAfterSeconds: 33,
              maxResetInSeconds: 45,
              avgResetInSeconds: 29,
              pressure: {
                label: 'High',
                signalSeconds: 47,
              },
            },
            runtimePrereqs: {
              present: true,
              available: false,
              passed: false,
              contractValid: true,
              valid: false,
              missingCheckCount: 1,
              missingChecks: {
                commands: ['node'],
                workspace: [],
              },
              command: 'npm run verify:baseline:runtime-prereqs:artifact',
            },
          },
          requestedBy: 'u1',
        },
      },
      'integrations-governance-schema': {
        data: {
          governanceType: 'schema_metadata',
          status: 'READY',
          schemaMetadata: {
            activeVersion: 1,
            defaultVersion: 1,
            supportedVersions: [1],
            source: 'default',
            override: {
              isSet: false,
              isValid: false,
            },
          },
          alerts: [],
          recommendedCommands: [
            'npm run verify:governance:weekly:endpoint:contract',
            'npm run verify:governance:schema:preflight',
          ],
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
    expect(container.textContent).toContain('Connector Credential Freshness');
    expect(container.textContent).toContain('No connector freshness telemetry yet.');
    expect(container.textContent).toContain('Telemetry Summary (7 Days)');
    expect(container.textContent).toContain('Refresh Telemetry');
    expect(container.textContent).toContain('Export Telemetry JSON');
    expect(container.textContent).toContain('Telemetry Daily Trend');
    expect(container.textContent).toContain('events 10');
    expect(container.textContent).toContain('orchestration 2');
    expect(container.textContent).toContain('Sales Event Families');
    expect(container.textContent).toContain('campaigns');
    expect(container.textContent).toContain('prediction');
    expect(container.textContent).toContain('Schema Version Adoption');
    expect(container.textContent).toContain('Sales Schema Versions');
    expect(container.textContent).toContain('Traceability Audits');
    expect(container.textContent).toContain('Governance Audits');
    expect(container.textContent).toContain('Governance Schema Audits');
    expect(container.textContent).toContain('Packet Validation Audits');
    expect(container.textContent).toContain('Connector Rate-Limit Audits');
    expect(container.textContent).toContain('Connector Input-Validation Audits');
    expect(container.textContent).toContain('max retry 30s • avg reset 29s');
    expect(container.textContent).toContain('Pressure: Moderate');
    expect(container.textContent).toContain('Traceability Audit Decisions');
    expect(container.textContent).toContain('Governance Audit Status');
    expect(container.textContent).toContain('Governance Schema Audit Status');
    expect(container.textContent).toContain('Parity posture: FAIL');
    expect(container.textContent).toContain('reason-code parity pass 1');
    expect(container.textContent).toContain('all parity pass 1');
    expect(container.textContent).toContain('Rollout blocked: 1');
    expect(container.textContent).toContain('Packet Validation Freshness');
    expect(container.textContent).toContain('Connector Input-Validation Posture');
    expect(container.textContent).toContain('Reasons tracked: 2');
    expect(container.textContent).toContain('apollo_search');
    expect(container.textContent).toContain('clearbit_company');
    expect(container.textContent).toContain('limit');
    expect(container.textContent).toContain('domain');
    expect(container.textContent).toContain('range');
    expect(container.textContent).toContain('required');
    expect(container.textContent).toContain('Connector Rate-Limit Endpoints');
    expect(container.textContent).toContain('Max retry: 30s • Avg retry: 29.5s • Max reset: 29s • Avg reset: 29s');
    expect(container.textContent).toContain('Connector throttle pressure: Moderate.');
    expect(container.textContent).toContain('keep rollout guarded until reset windows contract.');
    expect(container.textContent).toContain('/api/integrations/apollo/company');
    expect(container.textContent).toContain('/api/integrations/orchestration/company');
    expect(container.textContent).toContain('Weekly Governance Trend Report');
    expect(container.textContent).toContain('Governance Trend by Day');
    expect(container.textContent).toContain('Latest Governance Events');
    expect(container.textContent).toContain('Governance Alert Response Matrix');
    expect(container.textContent).toContain('Governance Connector Pressure');
    expect(container.textContent).toContain('Governance connector pressure: Moderate.');
    expect(container.textContent).toContain('apollo_search');
    expect(container.textContent).toContain('company_enrichment_orchestration');
    expect(container.textContent).toContain('Traceability Snapshot Governance');
    expect(container.textContent).toContain('Baseline Fixture Governance');
    expect(container.textContent).toContain('Alert Response Matrix');
    expect(container.textContent).toContain('ACTION_REQUIRED');
    expect(container.textContent).toContain('All required release-gate fixture profiles are present.');
    expect(container.textContent).toContain('Missing fixture profiles: validation-fail');
    expect(container.textContent).toContain('HOLD');
    expect(container.textContent).toContain('PROCEED');
    expect(container.textContent).toContain('governance ACTION_REQUIRED');
    expect(container.textContent).toContain('Recent Correlated Events');
    expect(container.textContent).toContain('traceability HOLD');
    expect(container.textContent).toContain('packet ACTION_REQUIRED stale');
    expect(container.textContent).toContain('packet READY fresh');
    expect(container.textContent).toContain('schema parity FAIL rollout-blocked reason-codes 2 commands 1');
    expect(container.textContent).toContain('rate-limit /api/integrations/apollo/company retry 30s reset 29s');
    expect(container.textContent).toContain('validation apollo_search field limit reason range code invalid_request_bounds received 0 min 1 max 25');
    expect(container.textContent).toContain('req-sales-1');
    expect(container.textContent).toContain('Schema Sample Size');
    expect(container.textContent).toContain('14 / 25');

    const packetOnlyButton = container.querySelector('[data-testid="recent-events-filter-packet"]') as HTMLButtonElement;
    const allEventsButton = container.querySelector('[data-testid="recent-events-filter-all"]') as HTMLButtonElement;
    expect(packetOnlyButton).toBeTruthy();
    expect(allEventsButton).toBeTruthy();

    await act(async () => {
      packetOnlyButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.textContent).toContain('packet ACTION_REQUIRED stale');
    expect(container.textContent).toContain('packet READY fresh');
    expect(container.textContent).not.toContain('req-sales-1');
    let telemetryCalls = mockUseQuery.mock.calls
      .map((args) => args[0])
      .filter((options) => Array.isArray(options?.queryKey) && options.queryKey[0] === 'integrations-telemetry-summary');
    expect(telemetryCalls[telemetryCalls.length - 1].queryKey[3]).toBe('packet');

    await act(async () => {
      allEventsButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.textContent).toContain('req-sales-1');
    telemetryCalls = mockUseQuery.mock.calls
      .map((args) => args[0])
      .filter((options) => Array.isArray(options?.queryKey) && options.queryKey[0] === 'integrations-telemetry-summary');
    expect(telemetryCalls[telemetryCalls.length - 1].queryKey[3]).toBe('all');
  });

  it('shows high connector throttle pressure guidance when reset windows exceed threshold', async () => {
    setupQueryMocks({
      integrations: { data: { sendgrid_configured: true } },
      googleStatus: { data: { connected: false } },
      'integrations-health': {
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
          status: 'ACTION_REQUIRED',
          healthyCount: 2,
          unhealthyCount: 2,
          actionableUnhealthyProviders: ['sendgrid'],
          credentialActionRequiredProviders: ['clearbit'],
          credentialConfiguredMaxAgeDays: 90,
          credentialRotationMaxAgeDays: 90,
          credentialFreshnessStatusCounts: {
            ACTION_REQUIRED: 1,
            READY: 2,
            UNKNOWN: 1,
          },
          credentialFreshnessByProvider: {
            sendgrid: { status: 'READY', configuredAgeDays: 1, rotationAgeDays: 1, staleReasons: [] },
            apollo: { status: 'READY', configuredAgeDays: 4, rotationAgeDays: 3, staleReasons: [] },
            clearbit: { status: 'ACTION_REQUIRED', configuredAgeDays: 120, rotationAgeDays: 101, staleReasons: ['rotation_age_exceeded'] },
            crunchbase: { status: 'UNKNOWN', configuredAgeDays: null, rotationAgeDays: null, staleReasons: [] },
          },
          credentialFreshnessTotalProviders: 4,
          credentialFreshnessActionRequiredCount: 1,
          credentialFreshnessWithinPolicyCount: 2,
          credentialFreshnessUnknownCount: 1,
          recommendedCommands: ['npm run verify:smoke:credential-freshness'],
          providers: [],
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
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
          windowDays: 7,
          eventCount: 2,
          errorEventCount: 0,
          byProvider: { integrations: 2 },
          connectorRateLimit: {
            eventCount: 2,
            byEndpoint: { apollo_search: 2 },
            maxRetryAfterSeconds: 55,
            avgRetryAfterSeconds: 52.5,
            maxResetInSeconds: 54,
            avgResetInSeconds: 51.5,
            latestEventAt: '2026-02-22T00:00:00Z',
          },
          recentEvents: [
            {
              eventType: 'integrations_connector_rate_limited',
              provider: 'integrations',
              requestId: 'req-rate-limit-high',
              connectorRateLimitEndpoint: 'apollo_search',
              connectorRateLimitRetryAfterSeconds: 55,
              connectorRateLimitResetInSeconds: 54,
            },
          ],
        },
      },
      'integrations-slo-gates': {
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
          windowDays: 7,
          decision: 'HOLD',
          eventCount: 2,
          gates: { overallPassed: false, errorRatePassed: true, latencyPassed: true },
          errorRate: { observedPct: 0, thresholdPct: 5, errorEvents: 0 },
          providerLatency: {},
          alerts: [],
          rolloutActions: [],
          signoff: { status: 'HOLD_REMEDIATION_REQUIRED', requiredApprovals: [], requiredEvidence: [] },
        },
      },
    });

    await act(async () => {
      root.render(<Integrations />);
    });

    expect(container.textContent).toContain('Pressure: High');
    expect(container.textContent).toContain('Connector throttle pressure: High.');
    expect(container.textContent).toContain('Pause connector rollout expansion and reduce lookup concurrency.');
  });

  it('shows packet filter remediation hint when no packet-validation recent events are available', async () => {
    setupQueryMocks({
      integrations: { data: { sendgrid_configured: true } },
      googleStatus: { data: { connected: false } },
      'integrations-health': {
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
          status: 'ACTION_REQUIRED',
          healthyCount: 2,
          unhealthyCount: 2,
          unhealthyProviders: ['clearbit', 'crunchbase'],
          actionableUnhealthyProviders: ['clearbit'],
          credentialActionRequiredProviders: ['clearbit'],
          credentialConfiguredMaxAgeDays: 90,
          credentialRotationMaxAgeDays: 45,
          credentialFreshnessStatusCounts: {
            ACTION_REQUIRED: 1,
            READY: 2,
            UNKNOWN: 1,
          },
          credentialFreshnessByProvider: {
            sendgrid: { status: 'READY', configuredAgeDays: 12, rotationAgeDays: 12, staleReasons: [] },
            apollo: { status: 'READY', configuredAgeDays: 14, rotationAgeDays: 11, staleReasons: [] },
            clearbit: { status: 'ACTION_REQUIRED', configuredAgeDays: 120, rotationAgeDays: 101, staleReasons: ['rotation_age_exceeded'] },
            crunchbase: { status: 'UNKNOWN', configuredAgeDays: null, rotationAgeDays: null, staleReasons: [] },
          },
          credentialFreshnessTotalProviders: 4,
          credentialFreshnessActionRequiredCount: 1,
          credentialFreshnessWithinPolicyCount: 2,
          credentialFreshnessUnknownCount: 1,
          recommendedCommands: ['npm run verify:smoke:credential-freshness'],
          providers: [
            {
              provider: 'sendgrid',
              healthy: true,
              statusCode: 200,
              latencyMs: 10,
              error: null,
              configuredAt: '2026-02-01T00:00:00Z',
              lastRotatedAt: '2026-02-01T00:00:00Z',
              credentialConfiguredAgeDays: 12,
              credentialRotationAgeDays: 12,
              credentialStale: false,
              credentialStaleReasons: [],
            },
            {
              provider: 'apollo',
              healthy: true,
              statusCode: 200,
              latencyMs: 11,
              error: null,
              configuredAt: '2026-02-01T00:00:00Z',
              lastRotatedAt: '2026-02-02T00:00:00Z',
              credentialConfiguredAgeDays: 14,
              credentialRotationAgeDays: 11,
              credentialStale: false,
              credentialStaleReasons: [],
            },
            {
              provider: 'clearbit',
              healthy: false,
              statusCode: 429,
              latencyMs: 15,
              error: 'Rate limited',
              configuredAt: '2025-10-01T00:00:00Z',
              lastRotatedAt: '2025-09-01T00:00:00Z',
              credentialConfiguredAgeDays: 120,
              credentialRotationAgeDays: 101,
              credentialStale: true,
              credentialStaleReasons: ['rotation_age_exceeded'],
            },
            {
              provider: 'crunchbase',
              healthy: false,
              statusCode: null,
              latencyMs: null,
              error: 'Not configured',
              configuredAt: null,
              lastRotatedAt: null,
              credentialConfiguredAgeDays: null,
              credentialRotationAgeDays: null,
              credentialStale: false,
              credentialStaleReasons: [],
            },
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
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
          windowDays: 7,
          eventCount: 2,
          errorEventCount: 0,
          byProvider: { sales_intelligence: 2 },
          trendByDay: [{ date: '2026-02-21', events: 2, errors: 0, salesIntelligenceEvents: 2 }],
          salesIntelligence: { eventCount: 2, byEventFamily: { forecast: 2 }, bySchemaVersion: { '2': 2 } },
          recentEventsTotalCount: 2,
          recentEventsFilteredCount: 0,
          recentEvents: [
            {
              eventType: 'sales_pipeline_forecast_generated',
              provider: 'sales_intelligence',
              requestId: 'req-sales-a',
              schemaVersion: 2,
            },
            {
              eventType: 'sales_campaign_created',
              provider: 'sales_intelligence',
              requestId: 'req-sales-b',
              schemaVersion: 2,
            },
          ],
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

    const packetOnlyButton = container.querySelector('[data-testid="recent-events-filter-packet"]') as HTMLButtonElement;
    expect(packetOnlyButton).toBeTruthy();

    await act(async () => {
      packetOnlyButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('Showing 0 of 2 recent events.');
    expect(container.textContent).toContain('No packet-validation events in this telemetry window.');
    expect(container.textContent).toContain('Increase Window Days or Event Limit');
  });

  it('uses server recent-event filter echo for export context and mismatch visibility', async () => {
    setupQueryMocks({
      integrations: { data: { sendgrid_configured: true } },
      googleStatus: { data: { connected: false } },
      'integrations-health': {
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
          status: 'ACTION_REQUIRED',
          healthyCount: 1,
          unhealthyCount: 1,
          credentialActionRequiredProviders: ['clearbit'],
          credentialFreshnessStatusCounts: {
            READY: 2,
          },
          credentialFreshnessByProvider: {
            clearbit: {
              status: 'ACTION_REQUIRED',
              configuredAgeDays: 120,
              rotationAgeDays: 101,
              staleReasons: ['rotation_age_exceeded'],
            },
          },
          credentialFreshnessTotalProviders: 1,
          credentialFreshnessActionRequiredCount: 1,
          credentialFreshnessWithinPolicyCount: 0,
          credentialFreshnessUnknownCount: 0,
          providers: [
            {
              provider: 'clearbit',
              healthy: false,
              statusCode: 429,
              latencyMs: 17,
              error: 'Rate limited',
              configuredAt: '2025-10-01T00:00:00Z',
              lastRotatedAt: '2025-09-01T00:00:00Z',
              credentialConfiguredAgeDays: 120,
              credentialRotationAgeDays: 101,
              credentialStale: true,
              credentialStaleReasons: ['rotation_age_exceeded'],
            },
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
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
          windowDays: 7,
          eventCount: 3,
          errorEventCount: 0,
          byProvider: { integrations: 3 },
          trendByDay: [{ date: '2026-02-21', events: 3, errors: 0, salesIntelligenceEvents: 0 }],
          salesIntelligence: { eventCount: 0, byEventFamily: {} },
          recentEventsFilter: 'packet',
          recentEventsTotalCount: 3,
          recentEventsFilteredCount: 1,
          recentEvents: [
            {
              eventType: 'integrations_traceability_status_evaluated',
              provider: 'integrations',
              requestId: 'req-packet-only',
              governancePacketValidationStatus: 'ACTION_REQUIRED',
              governancePacketValidationWithinFreshness: false,
            },
            {
              eventType: 'sales_pipeline_forecast_generated',
              provider: 'sales_intelligence',
              requestId: 'req-should-hide',
            },
          ],
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

    expect(container.textContent).toContain('Server applied');
    expect(container.textContent).toContain('Showing 1 of 3 recent events.');
    expect(container.textContent).toContain('Packet-validation rows: 1');
    expect(container.textContent).toContain('Non-packet rows: 2');
    expect(container.textContent).toContain('req-packet-only');
    expect(container.textContent).not.toContain('req-should-hide');

    await act(async () => {
      findButton(container, 'Export Telemetry JSON').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const createObjectURLMock = URL.createObjectURL as jest.Mock;
    const telemetryBlob = createObjectURLMock.mock.calls[createObjectURLMock.mock.calls.length - 1][0] as Blob;
    const telemetryPayload = JSON.parse(await new Response(telemetryBlob).text());
    expect(telemetryPayload.exportRecentEventsFilter).toBe('packet');
    expect(telemetryPayload.exportRecentEventsSelectedFilter).toBe('all');
    expect(telemetryPayload.exportRecentEventsServerFilter).toBe('packet');
    expect(telemetryPayload.exportRecentEventsServerFilterRaw).toBe('packet');
    expect(telemetryPayload.exportRecentEventsServerFilterRawTrimmed).toBe('packet');
    expect(telemetryPayload.exportRecentEventsServerFilterBlank).toBe(false);
    expect(telemetryPayload.exportRecentEventsServerFilterUnsupported).toBe(false);
    expect(telemetryPayload.exportRecentEventsServerFilterEvaluation).toBe('supported');
    expect(telemetryPayload.exportRecentEventsServerFilterNormalizationChanged).toBe(false);
    expect(telemetryPayload.exportRecentEventsFilterMismatch).toBe(true);
    expect(telemetryPayload.exportRecentEventsFilterSource).toBe('server');
    expect(telemetryPayload.exportRecentEventsFilterResolution).toBe('server_supported');
    expect(telemetryPayload.exportRecentEventsPacketValidationCount).toBe(1);
    expect(telemetryPayload.exportRecentEventsNonPacketCount).toBe(2);
  });

  it('normalizes server recent-event filter echo token casing/whitespace', async () => {
    setupQueryMocks({
      integrations: { data: { sendgrid_configured: true } },
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
          byProvider: { integrations: 2 },
          trendByDay: [{ date: '2026-02-21', events: 2, errors: 0, salesIntelligenceEvents: 0 }],
          salesIntelligence: { eventCount: 0, byEventFamily: {} },
          recentEventsFilter: ' PACKET ',
          recentEventsTotalCount: 2,
          recentEventsFilteredCount: 1,
          recentEvents: [
            {
              eventType: 'integrations_traceability_status_evaluated',
              provider: 'integrations',
              requestId: 'req-packet',
              governancePacketValidationStatus: 'ACTION_REQUIRED',
              governancePacketValidationWithinFreshness: false,
            },
            {
              eventType: 'sales_pipeline_forecast_generated',
              provider: 'sales_intelligence',
              requestId: 'req-sales-visible-only-in-all',
            },
          ],
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

    expect(container.textContent).toContain('Server applied');
    expect(container.textContent).toContain('Showing 1 of 2 recent events.');
    expect(container.textContent).toContain('req-packet');
    expect(container.textContent).not.toContain('req-sales-visible-only-in-all');

    await act(async () => {
      findButton(container, 'Export Telemetry JSON').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const createObjectURLMock = URL.createObjectURL as jest.Mock;
    const telemetryBlob = createObjectURLMock.mock.calls[createObjectURLMock.mock.calls.length - 1][0] as Blob;
    const telemetryPayload = JSON.parse(await new Response(telemetryBlob).text());
    expect(telemetryPayload.exportRecentEventsFilter).toBe('packet');
    expect(telemetryPayload.exportRecentEventsSelectedFilter).toBe('all');
    expect(telemetryPayload.exportRecentEventsServerFilter).toBe('packet');
    expect(telemetryPayload.exportRecentEventsServerFilterRaw).toBe(' PACKET ');
    expect(telemetryPayload.exportRecentEventsServerFilterRawTrimmed).toBe('PACKET');
    expect(telemetryPayload.exportRecentEventsServerFilterBlank).toBe(false);
    expect(telemetryPayload.exportRecentEventsServerFilterUnsupported).toBe(false);
    expect(telemetryPayload.exportRecentEventsServerFilterEvaluation).toBe('supported');
    expect(telemetryPayload.exportRecentEventsServerFilterNormalizationChanged).toBe(true);
    expect(telemetryPayload.exportRecentEventsFilterMismatch).toBe(true);
    expect(telemetryPayload.exportRecentEventsFilterSource).toBe('server');
    expect(telemetryPayload.exportRecentEventsFilterResolution).toBe('server_supported');
  });

  it('falls back to local recent-event filter when server filter echo is unsupported', async () => {
    setupQueryMocks({
      integrations: { data: { sendgrid_configured: true } },
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
          byProvider: { integrations: 1, sales_intelligence: 1 },
          trendByDay: [{ date: '2026-02-21', events: 2, errors: 0, salesIntelligenceEvents: 1 }],
          salesIntelligence: { eventCount: 1, byEventFamily: { forecast: 1 } },
          recentEventsFilter: 'surprise-filter-token',
          recentEventsTotalCount: 2,
          recentEventsFilteredCount: 2,
          recentEvents: [
            {
              eventType: 'integrations_traceability_status_evaluated',
              provider: 'integrations',
              requestId: 'req-packet-fallback',
              governancePacketValidationStatus: 'ACTION_REQUIRED',
              governancePacketValidationWithinFreshness: false,
            },
            {
              eventType: 'sales_pipeline_forecast_generated',
              provider: 'sales_intelligence',
              requestId: 'req-sales-fallback-visible',
            },
          ],
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

    expect(container.textContent).not.toContain('Server applied');
    expect(container.textContent).toContain('Showing 2 of 2 recent events.');
    expect(container.textContent).toContain('req-sales-fallback-visible');

    const packetOnlyButton = container.querySelector('[data-testid="recent-events-filter-packet"]') as HTMLButtonElement;
    expect(packetOnlyButton).toBeTruthy();
    await act(async () => {
      packetOnlyButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('Showing 1 of 2 recent events.');
    expect(container.textContent).toContain('req-packet-fallback');
    expect(container.textContent).not.toContain('req-sales-fallback-visible');

    await act(async () => {
      findButton(container, 'Export Telemetry JSON').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const createObjectURLMock = URL.createObjectURL as jest.Mock;
    const telemetryBlob = createObjectURLMock.mock.calls[createObjectURLMock.mock.calls.length - 1][0] as Blob;
    const telemetryPayload = JSON.parse(await new Response(telemetryBlob).text());
    expect(telemetryPayload.exportRecentEventsFilter).toBe('packet');
    expect(telemetryPayload.exportRecentEventsSelectedFilter).toBe('packet');
    expect(telemetryPayload.exportRecentEventsServerFilter).toBeNull();
    expect(telemetryPayload.exportRecentEventsServerFilterRaw).toBe('surprise-filter-token');
    expect(telemetryPayload.exportRecentEventsServerFilterRawTrimmed).toBe('surprise-filter-token');
    expect(telemetryPayload.exportRecentEventsServerFilterBlank).toBe(false);
    expect(telemetryPayload.exportRecentEventsServerFilterUnsupported).toBe(true);
    expect(telemetryPayload.exportRecentEventsServerFilterEvaluation).toBe('unsupported');
    expect(telemetryPayload.exportRecentEventsServerFilterNormalizationChanged).toBe(false);
    expect(telemetryPayload.exportRecentEventsFilterMismatch).toBe(false);
    expect(telemetryPayload.exportRecentEventsFilterSource).toBe('local');
    expect(telemetryPayload.exportRecentEventsFilterResolution).toBe('local_unsupported_server_filter');
  });

  it('treats whitespace-only server filter echo as absent and keeps local filter source', async () => {
    setupQueryMocks({
      integrations: { data: { sendgrid_configured: true } },
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
          byProvider: { integrations: 1, sales_intelligence: 1 },
          trendByDay: [{ date: '2026-02-21', events: 2, errors: 0, salesIntelligenceEvents: 1 }],
          salesIntelligence: { eventCount: 1, byEventFamily: { forecast: 1 } },
          recentEventsFilter: '   ',
          recentEventsTotalCount: 2,
          recentEventsFilteredCount: 2,
          recentEvents: [
            {
              eventType: 'integrations_traceability_status_evaluated',
              provider: 'integrations',
              requestId: 'req-packet-blank',
              governancePacketValidationStatus: 'ACTION_REQUIRED',
              governancePacketValidationWithinFreshness: false,
            },
            {
              eventType: 'sales_pipeline_forecast_generated',
              provider: 'sales_intelligence',
              requestId: 'req-sales-visible-blank',
            },
          ],
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

    expect(container.textContent).not.toContain('Server applied');
    expect(container.textContent).toContain('Showing 2 of 2 recent events.');
    expect(container.textContent).toContain('req-sales-visible-blank');

    const packetOnlyButton = container.querySelector('[data-testid="recent-events-filter-packet"]') as HTMLButtonElement;
    expect(packetOnlyButton).toBeTruthy();
    await act(async () => {
      packetOnlyButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('Showing 1 of 2 recent events.');
    expect(container.textContent).toContain('req-packet-blank');
    expect(container.textContent).not.toContain('req-sales-visible-blank');

    await act(async () => {
      findButton(container, 'Export Telemetry JSON').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const createObjectURLMock = URL.createObjectURL as jest.Mock;
    const telemetryBlob = createObjectURLMock.mock.calls[createObjectURLMock.mock.calls.length - 1][0] as Blob;
    const telemetryPayload = JSON.parse(await new Response(telemetryBlob).text());
    expect(telemetryPayload.exportRecentEventsFilter).toBe('packet');
    expect(telemetryPayload.exportRecentEventsSelectedFilter).toBe('packet');
    expect(telemetryPayload.exportRecentEventsServerFilter).toBeNull();
    expect(telemetryPayload.exportRecentEventsServerFilterRaw).toBe('   ');
    expect(telemetryPayload.exportRecentEventsServerFilterRawTrimmed).toBeNull();
    expect(telemetryPayload.exportRecentEventsServerFilterBlank).toBe(true);
    expect(telemetryPayload.exportRecentEventsServerFilterUnsupported).toBe(false);
    expect(telemetryPayload.exportRecentEventsServerFilterEvaluation).toBe('absent');
    expect(telemetryPayload.exportRecentEventsServerFilterNormalizationChanged).toBe(false);
    expect(telemetryPayload.exportRecentEventsFilterMismatch).toBe(false);
    expect(telemetryPayload.exportRecentEventsFilterSource).toBe('local');
    expect(telemetryPayload.exportRecentEventsFilterResolution).toBe('local_blank_server_filter');
  });

  it('honors server all-filter echo when local packet filter is selected', async () => {
    setupQueryMocks({
      integrations: { data: { sendgrid_configured: true } },
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
          byProvider: { integrations: 1, sales_intelligence: 1 },
          trendByDay: [{ date: '2026-02-21', events: 2, errors: 0, salesIntelligenceEvents: 1 }],
          salesIntelligence: { eventCount: 1, byEventFamily: { forecast: 1 } },
          recentEventsFilter: ' ALL ',
          recentEventsTotalCount: 2,
          recentEventsFilteredCount: 2,
          recentEvents: [
            {
              eventType: 'integrations_traceability_status_evaluated',
              provider: 'integrations',
              requestId: 'req-packet-present',
              governancePacketValidationStatus: 'ACTION_REQUIRED',
              governancePacketValidationWithinFreshness: false,
            },
            {
              eventType: 'sales_pipeline_forecast_generated',
              provider: 'sales_intelligence',
              requestId: 'req-sales-visible-server-all',
            },
          ],
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

    const packetOnlyButton = container.querySelector('[data-testid="recent-events-filter-packet"]') as HTMLButtonElement;
    expect(packetOnlyButton).toBeTruthy();
    await act(async () => {
      packetOnlyButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('Server applied');
    expect(container.textContent).toContain('Showing 2 of 2 recent events.');
    expect(container.textContent).toContain('req-sales-visible-server-all');

    await act(async () => {
      findButton(container, 'Export Telemetry JSON').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const createObjectURLMock = URL.createObjectURL as jest.Mock;
    const telemetryBlob = createObjectURLMock.mock.calls[createObjectURLMock.mock.calls.length - 1][0] as Blob;
    const telemetryPayload = JSON.parse(await new Response(telemetryBlob).text());
    expect(telemetryPayload.exportRecentEventsFilter).toBe('all');
    expect(telemetryPayload.exportRecentEventsSelectedFilter).toBe('packet');
    expect(telemetryPayload.exportRecentEventsServerFilter).toBe('all');
    expect(telemetryPayload.exportRecentEventsServerFilterRaw).toBe(' ALL ');
    expect(telemetryPayload.exportRecentEventsServerFilterRawTrimmed).toBe('ALL');
    expect(telemetryPayload.exportRecentEventsServerFilterBlank).toBe(false);
    expect(telemetryPayload.exportRecentEventsServerFilterUnsupported).toBe(false);
    expect(telemetryPayload.exportRecentEventsServerFilterEvaluation).toBe('supported');
    expect(telemetryPayload.exportRecentEventsServerFilterNormalizationChanged).toBe(true);
    expect(telemetryPayload.exportRecentEventsFilterMismatch).toBe(true);
    expect(telemetryPayload.exportRecentEventsFilterSource).toBe('server');
    expect(telemetryPayload.exportRecentEventsFilterResolution).toBe('server_supported');
  });

  it('shows packet-filter remediation when server applies packet filter and no packet rows are returned', async () => {
    setupQueryMocks({
      integrations: { data: { sendgrid_configured: true } },
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
          byProvider: { sales_intelligence: 2 },
          trendByDay: [{ date: '2026-02-21', events: 2, errors: 0, salesIntelligenceEvents: 2 }],
          salesIntelligence: { eventCount: 2, byEventFamily: { forecast: 2 } },
          recentEventsFilter: 'packet',
          recentEventsTotalCount: 2,
          recentEventsFilteredCount: 0,
          recentEvents: [
            {
              eventType: 'sales_pipeline_forecast_generated',
              provider: 'sales_intelligence',
              requestId: 'req-sales-a',
            },
            {
              eventType: 'sales_campaign_created',
              provider: 'sales_intelligence',
              requestId: 'req-sales-b',
            },
          ],
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

    expect(container.textContent).toContain('Server applied');
    expect(container.textContent).toContain('Showing 0 of 2 recent events.');
    expect(container.textContent).toContain('Packet-validation rows: 0');
    expect(container.textContent).toContain('Non-packet rows: 2');
    expect(container.textContent).toContain('No packet-validation events in this telemetry window.');
    expect(container.textContent).toContain('Increase Window Days or Event Limit');

    await act(async () => {
      findButton(container, 'Export Telemetry JSON').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const createObjectURLMock = URL.createObjectURL as jest.Mock;
    const telemetryBlob = createObjectURLMock.mock.calls[createObjectURLMock.mock.calls.length - 1][0] as Blob;
    const telemetryPayload = JSON.parse(await new Response(telemetryBlob).text());
    expect(telemetryPayload.exportRecentEventsFilter).toBe('packet');
    expect(telemetryPayload.exportRecentEventsSelectedFilter).toBe('all');
    expect(telemetryPayload.exportRecentEventsServerFilter).toBe('packet');
    expect(telemetryPayload.exportRecentEventsServerFilterRaw).toBe('packet');
    expect(telemetryPayload.exportRecentEventsServerFilterRawTrimmed).toBe('packet');
    expect(telemetryPayload.exportRecentEventsServerFilterBlank).toBe(false);
    expect(telemetryPayload.exportRecentEventsServerFilterUnsupported).toBe(false);
    expect(telemetryPayload.exportRecentEventsServerFilterEvaluation).toBe('supported');
    expect(telemetryPayload.exportRecentEventsServerFilterNormalizationChanged).toBe(false);
    expect(telemetryPayload.exportRecentEventsFilterMismatch).toBe(true);
    expect(telemetryPayload.exportRecentEventsFilterSource).toBe('server');
    expect(telemetryPayload.exportRecentEventsFilterResolution).toBe('server_supported');
    expect(telemetryPayload.exportRecentEventsPacketValidationCount).toBe(0);
    expect(telemetryPayload.exportRecentEventsNonPacketCount).toBe(2);
  });

  it('normalizes malformed server recent-event count metadata for display consistency', async () => {
    setupQueryMocks({
      integrations: { data: { sendgrid_configured: true } },
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
          byProvider: { integrations: 1, sales_intelligence: 1 },
          trendByDay: [{ date: '2026-02-21', events: 2, errors: 0, salesIntelligenceEvents: 1 }],
          salesIntelligence: { eventCount: 1, byEventFamily: { forecast: 1 } },
          recentEventsFilter: 'all',
          recentEventsTotalCount: -9,
          recentEventsFilteredCount: 999,
          recentEventsPacketValidationCount: -5,
          recentEventsNonPacketCount: Number.POSITIVE_INFINITY,
          recentEvents: [
            {
              eventType: 'integrations_traceability_status_evaluated',
              provider: 'integrations',
              requestId: 'req-packet-a',
              governancePacketValidationStatus: 'ACTION_REQUIRED',
              governancePacketValidationWithinFreshness: false,
            },
            {
              eventType: 'sales_pipeline_forecast_generated',
              provider: 'sales_intelligence',
              requestId: 'req-sales-b',
            },
          ],
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

    expect(container.textContent).toContain('Showing 2 of 2 recent events.');
    expect(container.textContent).toContain('Packet-validation rows: 1');
    expect(container.textContent).toContain('Non-packet rows: 1');

    await act(async () => {
      findButton(container, 'Export Telemetry JSON').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const createObjectURLMock = URL.createObjectURL as jest.Mock;
    const telemetryBlob = createObjectURLMock.mock.calls[createObjectURLMock.mock.calls.length - 1][0] as Blob;
    const telemetryPayload = JSON.parse(await new Response(telemetryBlob).text());
    expect(telemetryPayload.exportRecentEventsPacketValidationCount).toBe(1);
    expect(telemetryPayload.exportRecentEventsNonPacketCount).toBe(1);
  });

  it('normalizes non-finite server recent-event count metadata for display consistency', async () => {
    setupQueryMocks({
      integrations: { data: { sendgrid_configured: true } },
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
          byProvider: { integrations: 1, sales_intelligence: 1 },
          trendByDay: [{ date: '2026-02-21', events: 2, errors: 0, salesIntelligenceEvents: 1 }],
          salesIntelligence: { eventCount: 1, byEventFamily: { forecast: 1 } },
          recentEventsFilter: 'all',
          recentEventsTotalCount: Number.NaN,
          recentEventsFilteredCount: Number.POSITIVE_INFINITY,
          recentEvents: [
            {
              eventType: 'integrations_traceability_status_evaluated',
              provider: 'integrations',
              requestId: 'req-packet-non-finite-a',
              governancePacketValidationStatus: 'ACTION_REQUIRED',
              governancePacketValidationWithinFreshness: false,
            },
            {
              eventType: 'sales_pipeline_forecast_generated',
              provider: 'sales_intelligence',
              requestId: 'req-sales-non-finite-b',
            },
          ],
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

    expect(container.textContent).toContain('Showing 2 of 2 recent events.');

    await act(async () => {
      findButton(container, 'Export Telemetry JSON').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const createObjectURLMock = URL.createObjectURL as jest.Mock;
    const telemetryBlob = createObjectURLMock.mock.calls[createObjectURLMock.mock.calls.length - 1][0] as Blob;
    const telemetryPayload = JSON.parse(await new Response(telemetryBlob).text());
    expect(telemetryPayload.exportRecentEventsDisplayedCount).toBe(2);
    expect(telemetryPayload.exportRecentEventsTotalCount).toBe(2);
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
          apollo_configured_at: '2026-02-20T00:00:00Z',
          apollo_last_rotated_at: '2026-02-21T00:00:00Z',
          clearbit_configured: true,
          clearbit_api_key: '••••••••efgh',
          clearbit_configured_at: '2026-02-19T00:00:00Z',
          clearbit_last_rotated_at: '2026-02-20T00:00:00Z',
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
          status: 'ACTION_REQUIRED',
          credentialActionRequiredProviders: ['clearbit'],
          credentialRotationMaxAgeDays: 90,
          providers: [
            { provider: 'apollo', healthy: true, statusCode: null, latencyMs: null, error: null },
            {
              provider: 'clearbit',
              healthy: false,
              statusCode: null,
              latencyMs: null,
              error: 'Configured but connector disabled by feature flag',
              configuredAt: '2026-02-19T00:00:00Z',
              lastRotatedAt: '2026-02-20T00:00:00Z',
              credentialConfiguredAgeDays: 110,
              credentialRotationAgeDays: 100,
              credentialStale: true,
              credentialStaleReasons: ['rotation_age_exceeded'],
            },
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
    expect(container.textContent).toContain('Configured At:');
    expect(container.textContent).toContain('Last Rotated:');
    expect(container.textContent).toContain('Credential freshness warning for: clearbit');
    expect(container.textContent).toContain('Rotation max age: 90 days.');
    expect(container.textContent).toContain('Rotation age: 100 days.');
    expect(container.textContent).toContain('Flag Off');
  });

  it('renders connector lookup sandbox controls', async () => {
    setupQueryMocks({
      integrations: {
        data: {
          sendgrid_configured: true,
          sendgrid_api_key: '••••1234',
          apollo_enabled: true,
          clearbit_enabled: true,
          crunchbase_enabled: true,
        },
      },
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

  it('renders connector lookup metadata for rate limits, provider-order diagnostics, storage policy, and export payloads', async () => {
    const companyLookupResult = {
      provider: 'orchestration',
      selectedProvider: 'apollo',
      resultCount: 2,
      savedCount: 1,
      attemptSummary: {
        total: 2,
        statusCounts: { success: 1, skipped: 1, error: 0 },
        reasonCodeCounts: { success: 1, domain_required: 1 },
        providersAttempted: ['clearbit', 'apollo'],
        providersWithResults: ['apollo'],
        providersWithoutResults: [],
      },
      attempts: [
        {
          provider: 'clearbit',
          status: 'skipped',
          reasonCode: 'domain_required',
          resultCount: 0,
          latencyMs: 0.5,
        },
        {
          provider: 'apollo',
          status: 'success',
          reasonCode: 'success',
          resultCount: 2,
          latencyMs: 12.4,
          rateLimitRemaining: 118,
          rateLimitResetInSeconds: 34,
        },
      ],
      companies: [{ name: 'Acme Corp' }],
      criteria: {
        providerOrderDiagnostics: {
          duplicatesRemoved: ['apollo'],
          ignoredProviders: ['unknown'],
          defaultApplied: false,
        },
      },
      rateLimit: {
        limit: 120,
        remaining: 118,
        windowSeconds: 60,
        resetAt: '2026-02-24T12:00:00Z',
        resetInSeconds: 34,
      },
      storagePolicy: {
        maxBytes: 2048,
        previewChars: 240,
        truncatedRecordCount: 1,
        truncatedRawRecordCount: 1,
        truncatedEnrichedRecordCount: 0,
      },
    };
    const apolloLookupResult = {
      provider: 'apollo',
      resultCount: 3,
      savedCount: 2,
      prospects: [{ fullName: 'Alex Rivera' }],
      rateLimit: {
        limit: 60,
        remaining: 59,
        windowSeconds: 60,
        resetAt: '2026-02-24T12:00:00Z',
        resetInSeconds: 19,
      },
    };

    let mutationCallIndex = 0;
    mockUseMutation.mockImplementation((options: any) => {
      mutationCallIndex += 1;
      const mutationSlot = ((mutationCallIndex - 1) % 8) + 1;
      if (mutationSlot === 5) {
        return {
          mutate: () => options.onSuccess(companyLookupResult),
          isPending: false,
        };
      }
      if (mutationSlot === 6) {
        return {
          mutate: () => options.onSuccess(apolloLookupResult),
          isPending: false,
        };
      }
      return { mutate: jest.fn(), isPending: false };
    });

    setupQueryMocks({
      integrations: {
        data: {
          sendgrid_configured: true,
          sendgrid_api_key: '••••1234',
          apollo_enabled: true,
          clearbit_enabled: true,
          crunchbase_enabled: true,
        },
      },
      googleStatus: { data: { connected: false } },
      'integrations-health': {
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
          status: 'ACTION_REQUIRED',
          healthyCount: 2,
          unhealthyCount: 2,
          unhealthyProviders: ['clearbit', 'crunchbase'],
          actionableUnhealthyProviders: ['clearbit'],
          credentialActionRequiredProviders: ['clearbit'],
          credentialConfiguredMaxAgeDays: 90,
          credentialRotationMaxAgeDays: 45,
          credentialFreshnessStatusCounts: {
            ACTION_REQUIRED: 1,
            READY: 2,
            UNKNOWN: 1,
          },
          credentialFreshnessByProvider: {
            sendgrid: { status: 'READY', configuredAgeDays: 12, rotationAgeDays: 12, staleReasons: [] },
            apollo: { status: 'READY', configuredAgeDays: 14, rotationAgeDays: 11, staleReasons: [] },
            clearbit: { status: 'ACTION_REQUIRED', configuredAgeDays: 120, rotationAgeDays: 101, staleReasons: ['rotation_age_exceeded'] },
            crunchbase: { status: 'UNKNOWN', configuredAgeDays: null, rotationAgeDays: null, staleReasons: [] },
          },
          credentialFreshnessTotalProviders: 4,
          credentialFreshnessActionRequiredCount: 1,
          credentialFreshnessWithinPolicyCount: 2,
          credentialFreshnessUnknownCount: 1,
          recommendedCommands: ['npm run verify:smoke:credential-freshness'],
          providers: [
            {
              provider: 'sendgrid',
              healthy: true,
              statusCode: 200,
              latencyMs: 10,
              error: null,
              configuredAt: '2026-02-01T00:00:00Z',
              lastRotatedAt: '2026-02-01T00:00:00Z',
              credentialConfiguredAgeDays: 12,
              credentialRotationAgeDays: 12,
              credentialStale: false,
              credentialStaleReasons: [],
            },
            {
              provider: 'apollo',
              healthy: true,
              statusCode: 200,
              latencyMs: 11,
              error: null,
              configuredAt: '2026-02-01T00:00:00Z',
              lastRotatedAt: '2026-02-02T00:00:00Z',
              credentialConfiguredAgeDays: 14,
              credentialRotationAgeDays: 11,
              credentialStale: false,
              credentialStaleReasons: [],
            },
            {
              provider: 'clearbit',
              healthy: false,
              statusCode: 429,
              latencyMs: 15,
              error: 'Rate limited',
              configuredAt: '2025-10-01T00:00:00Z',
              lastRotatedAt: '2025-09-01T00:00:00Z',
              credentialConfiguredAgeDays: 120,
              credentialRotationAgeDays: 101,
              credentialStale: true,
              credentialStaleReasons: ['rotation_age_exceeded'],
            },
            {
              provider: 'crunchbase',
              healthy: false,
              statusCode: null,
              latencyMs: null,
              error: 'Not configured',
              configuredAt: null,
              lastRotatedAt: null,
              credentialConfiguredAgeDays: null,
              credentialRotationAgeDays: null,
              credentialStale: false,
              credentialStaleReasons: [],
            },
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
          decision: 'PROCEED',
          eventCount: 0,
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
      const providerSelect = container.querySelector('select') as HTMLSelectElement | null;
      if (!providerSelect) {
        throw new Error('Lookup provider select not found');
      }
      setSelectValue(providerSelect, 'orchestration');
      setInputValue(findInputByLabel(container, 'Domain', 0), 'acme.com');
      setInputValue(findInputByLabel(container, 'Company Name', 0), 'Acme Corp');
      setInputValue(findInputByLabel(container, 'Limit', 0), '12');
      const saveResearchToggle = Array.from(container.querySelectorAll('label')).find((label) =>
        (label.textContent || '').includes('Save enrichment records to company research')
      )?.querySelector('input') as HTMLInputElement | null;
      if (!saveResearchToggle) {
        throw new Error('Company lookup save toggle not found');
      }
      saveResearchToggle.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      setInputValue(findInputByLabel(container, 'Query', 0), 'revops');
      setInputValue(findInputByLabel(container, 'Title', 0), 'VP Sales');
      setInputValue(findInputByLabel(container, 'Domain', 1), 'acme.com');
      setInputValue(findInputByLabel(container, 'Limit', 1), '30');
      const saveProspectsToggle = Array.from(container.querySelectorAll('label')).find((label) =>
        (label.textContent || '').includes('Save prospects to pipeline records')
      )?.querySelector('input') as HTMLInputElement | null;
      if (!saveProspectsToggle) {
        throw new Error('Apollo lookup save toggle not found');
      }
      saveProspectsToggle.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    await act(async () => {
      findButton(container, 'Run Company Lookup').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('Rate Limit: 118 remaining / 120 in 60s');
    expect(container.textContent).toContain('Rate Limit Reset At:');
    expect(container.textContent).toContain('Rate Limit Reset In: 34s');
    expect(container.textContent).toContain('Attempt Summary: success 1 • skipped 1 • error 0');
    expect(container.textContent).toContain('Attempt Reasons: domain_required 1 • success 1');
    expect(container.textContent).toContain('Attempt Diagnostics: clearbit:skipped:domain_required:0.5ms | apollo:success:success:12.4ms');
    expect(container.textContent).toContain('Provider Order Diagnostics: defaultApplied no • duplicates apollo • ignored unknown');
    expect(container.textContent).toContain('Storage Policy: max 2048 bytes • preview 240 chars • truncated 1 (raw 1, enriched 0)');
    expect(container.textContent).toContain('Top Company: Acme Corp');

    await act(async () => {
      findButton(container, 'Export Company Lookup JSON').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const createObjectURLMock = URL.createObjectURL as jest.Mock;
    const companyLookupBlob = createObjectURLMock.mock.calls[createObjectURLMock.mock.calls.length - 1][0] as Blob;
    const companyLookupExport = JSON.parse(await new Response(companyLookupBlob).text());
    expect(companyLookupExport.exportSchemaVersion).toBe(1);
    expect(companyLookupExport.exportType).toBe('connector_company_lookup');
    expect(companyLookupExport.exportRequestedProvider).toBe('orchestration');
    expect(companyLookupExport.exportRequestedDomain).toBe('acme.com');
    expect(companyLookupExport.exportRequestedCompanyName).toBe('Acme Corp');
    expect(companyLookupExport.exportRequestedLimit).toBe(12);
    expect(companyLookupExport.exportRequestedSaveResearch).toBe(true);
    expect(companyLookupExport.exportSelectedProvider).toBe('apollo');
    expect(companyLookupExport.exportResultCount).toBe(2);
    expect(companyLookupExport.exportSavedCount).toBe(1);
    expect(companyLookupExport.exportAttemptSummary.statusCounts.success).toBe(1);
    expect(companyLookupExport.exportProviderOrderDiagnostics.duplicatesRemoved).toEqual(['apollo']);
    expect(companyLookupExport.exportTopCompany.name).toBe('Acme Corp');
    expect(container.textContent).toContain('connector-company-lookup exported.');

    await act(async () => {
      findButton(container, 'Run Apollo Lookup').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('Rate Limit: 59 remaining / 60 in 60s');
    expect(container.textContent).toContain('Rate Limit Reset At:');
    expect(container.textContent).toContain('Rate Limit Reset In: 19s');
    expect(container.textContent).toContain('Top Prospect: Alex Rivera');

    await act(async () => {
      findButton(container, 'Export Apollo Lookup JSON').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const apolloLookupBlob = createObjectURLMock.mock.calls[createObjectURLMock.mock.calls.length - 1][0] as Blob;
    const apolloLookupExport = JSON.parse(await new Response(apolloLookupBlob).text());
    expect(apolloLookupExport.exportSchemaVersion).toBe(1);
    expect(apolloLookupExport.exportType).toBe('connector_apollo_lookup');
    expect(apolloLookupExport.exportRequestedQuery).toBe('revops');
    expect(apolloLookupExport.exportRequestedTitle).toBe('VP Sales');
    expect(apolloLookupExport.exportRequestedDomain).toBe('acme.com');
    expect(apolloLookupExport.exportRequestedLimit).toBe(30);
    expect(apolloLookupExport.exportRequestedSaveResults).toBe(true);
    expect(apolloLookupExport.exportProvider).toBe('apollo');
    expect(apolloLookupExport.exportResultCount).toBe(3);
    expect(apolloLookupExport.exportSavedCount).toBe(2);
    expect(apolloLookupExport.exportTopProspect.fullName).toBe('Alex Rivera');
    expect(container.textContent).toContain('connector-apollo-prospect-lookup exported.');
  });

  it('shows retry guidance when connector lookup is rate-limited', async () => {
    let mutationCallIndex = 0;
    mockUseMutation.mockImplementation((options: any) => {
      mutationCallIndex += 1;
      const mutationSlot = ((mutationCallIndex - 1) % 8) + 1;
      if (mutationSlot === 5) {
        return {
          mutate: () =>
            options.onError(
              Object.assign(
                new Error(
                  'Connector rate limit exceeded for /api/integrations/providers/apollo/company. Retry in 42 seconds.'
                ),
                {
                  status: 429,
                  errorCode: 'connector_rate_limited',
                  retryAfterSeconds: 42,
                }
              )
            ),
          isPending: false,
        };
      }
      return { mutate: jest.fn(), isPending: false };
    });

    setupQueryMocks({
      integrations: {
        data: {
          sendgrid_configured: true,
          sendgrid_api_key: '••••1234',
          apollo_enabled: true,
          clearbit_enabled: true,
          crunchbase_enabled: true,
        },
      },
      googleStatus: { data: { connected: false } },
      'integrations-health': {
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
          status: 'ACTION_REQUIRED',
          healthyCount: 2,
          unhealthyCount: 2,
          unhealthyProviders: ['clearbit', 'crunchbase'],
          actionableUnhealthyProviders: ['clearbit'],
          credentialActionRequiredProviders: ['clearbit'],
          credentialConfiguredMaxAgeDays: 90,
          credentialRotationMaxAgeDays: 45,
          credentialFreshnessStatusCounts: {
            ACTION_REQUIRED: 1,
            READY: 2,
            UNKNOWN: 1,
          },
          credentialFreshnessByProvider: {
            sendgrid: { status: 'READY', configuredAgeDays: 12, rotationAgeDays: 12, staleReasons: [] },
            apollo: { status: 'READY', configuredAgeDays: 14, rotationAgeDays: 11, staleReasons: [] },
            clearbit: { status: 'ACTION_REQUIRED', configuredAgeDays: 120, rotationAgeDays: 101, staleReasons: ['rotation_age_exceeded'] },
            crunchbase: { status: 'UNKNOWN', configuredAgeDays: null, rotationAgeDays: null, staleReasons: [] },
          },
          credentialFreshnessTotalProviders: 4,
          credentialFreshnessActionRequiredCount: 1,
          credentialFreshnessWithinPolicyCount: 2,
          credentialFreshnessUnknownCount: 1,
          recommendedCommands: ['npm run verify:smoke:credential-freshness'],
          providers: [
            {
              provider: 'sendgrid',
              healthy: true,
              statusCode: 200,
              latencyMs: 10,
              error: null,
              configuredAt: '2026-02-01T00:00:00Z',
              lastRotatedAt: '2026-02-01T00:00:00Z',
              credentialConfiguredAgeDays: 12,
              credentialRotationAgeDays: 12,
              credentialStale: false,
              credentialStaleReasons: [],
            },
            {
              provider: 'apollo',
              healthy: true,
              statusCode: 200,
              latencyMs: 11,
              error: null,
              configuredAt: '2026-02-01T00:00:00Z',
              lastRotatedAt: '2026-02-02T00:00:00Z',
              credentialConfiguredAgeDays: 14,
              credentialRotationAgeDays: 11,
              credentialStale: false,
              credentialStaleReasons: [],
            },
            {
              provider: 'clearbit',
              healthy: false,
              statusCode: 429,
              latencyMs: 15,
              error: 'Rate limited',
              configuredAt: '2025-10-01T00:00:00Z',
              lastRotatedAt: '2025-09-01T00:00:00Z',
              credentialConfiguredAgeDays: 120,
              credentialRotationAgeDays: 101,
              credentialStale: true,
              credentialStaleReasons: ['rotation_age_exceeded'],
            },
            {
              provider: 'crunchbase',
              healthy: false,
              statusCode: null,
              latencyMs: null,
              error: 'Not configured',
              configuredAt: null,
              lastRotatedAt: null,
              credentialConfiguredAgeDays: null,
              credentialRotationAgeDays: null,
              credentialStale: false,
              credentialStaleReasons: [],
            },
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
          decision: 'PROCEED',
          eventCount: 0,
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
      findButton(container, 'Run Company Lookup').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('Connector rate limit reached. Retry in 42s.');
    expect(container.textContent).toContain('Retry in 42 seconds');
  });

  it('blocks company lookup submit when limit is out of bounds before API call', async () => {
    (api.orchestrateCompanyEnrichment as jest.Mock).mockResolvedValue({
      provider: 'orchestration',
      resultCount: 1,
      companies: [{ name: 'Acme Corp' }],
    });

    let mutationCallIndex = 0;
    mockUseMutation.mockImplementation((options: any) => {
      mutationCallIndex += 1;
      const mutationSlot = ((mutationCallIndex - 1) % 8) + 1;
      if (mutationSlot === 5) {
        return {
          mutate: async () => {
            try {
              const result = await options.mutationFn();
              options.onSuccess?.(result);
            } catch (error) {
              options.onError?.(error);
            }
          },
          isPending: false,
        };
      }
      return { mutate: jest.fn(), isPending: false };
    });

    setupQueryMocks({
      integrations: {
        data: {
          sendgrid_configured: true,
          sendgrid_api_key: '••••1234',
          apollo_enabled: true,
          clearbit_enabled: true,
          crunchbase_enabled: true,
        },
      },
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
    });

    await act(async () => {
      root.render(<Integrations />);
    });

    await act(async () => {
      setInputValue(findInputByLabel(container, 'Domain', 0), 'acme.com');
      setInputValue(findInputByLabel(container, 'Limit', 0), '0');
      findButton(container, 'Run Company Lookup').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(api.orchestrateCompanyEnrichment).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Company lookup failed: Invalid limit: expected integer between 1 and 25.');
  });

  it('maps structured connector validation payload fields into company lookup error guidance', async () => {
    let mutationCallIndex = 0;
    mockUseMutation.mockImplementation((options: any) => {
      mutationCallIndex += 1;
      const mutationSlot = ((mutationCallIndex - 1) % 8) + 1;
      if (mutationSlot === 5) {
        return {
          mutate: () =>
            options.onError(
              Object.assign(
                new Error('Invalid limit: expected integer between 1 and 25.'),
                {
                  status: 400,
                  errorCode: 'invalid_request_bounds',
                  field: 'limit',
                  minimum: 1,
                  maximum: 25,
                  reason: 'type',
                  received: true,
                }
              )
            ),
          isPending: false,
        };
      }
      return { mutate: jest.fn(), isPending: false };
    });

    setupQueryMocks({
      integrations: {
        data: {
          sendgrid_configured: true,
          sendgrid_api_key: '••••1234',
          apollo_enabled: true,
          clearbit_enabled: true,
          crunchbase_enabled: true,
        },
      },
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
    });

    await act(async () => {
      root.render(<Integrations />);
    });

    await act(async () => {
      setInputValue(findInputByLabel(container, 'Domain', 0), 'acme.com');
      findButton(container, 'Run Company Lookup').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain(
      'Company lookup failed: Invalid limit: expected integer between 1 and 25. Received: true.'
    );
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
          gates: {
            overallPassed: false,
            errorRatePassed: false,
            latencyPassed: false,
            schemaCoveragePassed: false,
            schemaSampleSizePassed: false,
            retryAuditVolumePassed: false,
            retryAuditDelayPassed: true,
            orchestrationAttemptErrorPassed: false,
            orchestrationAttemptSkippedPassed: true,
          },
          errorRate: { observedPct: 8.2, thresholdPct: 5, errorEvents: 3 },
          schemaCoverage: { observedPct: 72, thresholdPct: 95, sampleCount: 25, schemaV2Count: 18 },
          retryAudit: {
            maxEventCountThreshold: 1,
            observedEventCount: 2,
            maxAvgNextDelaySecondsThreshold: 1.5,
            observedAvgNextDelaySeconds: 1.0,
          },
          orchestrationAudit: {
            maxAttemptErrorCountThreshold: 1,
            observedAttemptErrorCount: 2,
            maxAttemptSkippedCountThreshold: 4,
            observedAttemptSkippedCount: 1,
          },
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
    expect(container.textContent).toContain('Retry Audit');
    expect(container.textContent).toContain('volume fail');
    expect(container.textContent).toContain('Orchestration Attempts');
    expect(container.textContent).toContain('error fail');
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
            orchestrationAttemptErrorPassed: true,
            orchestrationAttemptSkippedPassed: true,
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
            orchestrationAttemptErrorPassed: false,
            orchestrationAttemptSkippedPassed: false,
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
    expect(container.textContent).toContain('Reduce orchestration attempt errors to satisfy orchestration SLO gate thresholds.');
    expect(container.textContent).toContain('Reduce orchestration skipped attempts (for example missing domain inputs) before rollout.');
    expect(container.textContent).toContain('Advance signoff status to READY_FOR_APPROVAL');
    expect(container.textContent).toContain('Populate required approval roles in the SLO signoff payload.');
    expect(container.textContent).toContain('Populate required evidence artifacts in the SLO signoff payload.');
  });

  it('links signoff readiness to baseline governance failure state', async () => {
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
            orchestrationAttemptErrorPassed: true,
            orchestrationAttemptSkippedPassed: true,
          },
          errorRate: { observedPct: 0.8, thresholdPct: 5, errorEvents: 1 },
          schemaCoverage: { observedPct: 100, thresholdPct: 95, sampleCount: 30, minSampleCount: 25, schemaV2Count: 30 },
          providerLatency: {},
          alerts: [],
          rolloutActions: [],
          signoff: {
            status: 'READY_FOR_APPROVAL',
            requiredApprovals: [{ role: 'Release Manager', required: true }],
            requiredEvidence: ['connector_canary_evidence.json'],
          },
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
            fileCount: 1,
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
          overallStatus: 'fail',
          status: 'FAIL',
          releaseGateFixturePolicy: {
            passed: false,
            requiredProfiles: ['pass', 'hold', 'validation-fail'],
            missingProfiles: ['validation-fail'],
            message: 'Missing release-gate fixture profile(s): validation-fail',
          },
	          releaseGateFixtures: {
	            allProfilesAvailable: false,
	            availableProfileCount: 2,
	            profileCount: 3,
	          },
	          runtimePrereqs: {
	            present: true,
	            available: true,
	            passed: false,
	            contractValid: true,
	            valid: false,
	            command: 'verify_sales_runtime_prereqs',
	            missingCheckCount: 1,
	            missingChecks: { commands: ['node'], workspace: [] },
	          },
	        },
	      },
	    });

    await act(async () => {
      root.render(<Integrations />);
    });

    expect(container.textContent).toContain('Traceability Readiness');
    expect(container.textContent).toContain('NOT READY');
	    expect(container.textContent).toContain('Baseline governance status:');
	    expect(container.textContent).toContain('FAIL');
	    expect(container.textContent).toContain('Baseline fixture governance is failing. Resolve baseline-governance policy failures before rollout signoff.');
	    expect(container.textContent).toContain('Runtime prereq gate present:');
	    expect(container.textContent).toContain('Runtime prereq artifact available:');
	    expect(container.textContent).toContain('Runtime missing checks: 1');
	    expect(container.textContent).toContain('Runtime missing commands: node');
	  });

  it('links signoff readiness to baseline orchestration-gate failure state', async () => {
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
          eventCount: 10,
          gates: {
            overallPassed: true,
            errorRatePassed: true,
            latencyPassed: true,
            schemaCoveragePassed: true,
            schemaSampleSizePassed: true,
            orchestrationAttemptErrorPassed: true,
            orchestrationAttemptSkippedPassed: true,
          },
          errorRate: { observedPct: 0.4, thresholdPct: 5, errorEvents: 1 },
          schemaCoverage: { observedPct: 100, thresholdPct: 95, sampleCount: 25, minSampleCount: 25, schemaV2Count: 25 },
          providerLatency: {},
          alerts: [],
          rolloutActions: [],
          signoff: {
            status: 'READY_FOR_APPROVAL',
            requiredApprovals: [{ role: 'Release Manager', required: true }],
            requiredEvidence: ['connector_canary_evidence.json'],
          },
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
            fileCount: 1,
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
          orchestrationGate: {
            available: true,
            decision: 'HOLD',
            attemptErrorGatePassed: false,
            attemptSkippedGatePassed: true,
            maxAttemptErrorCountThreshold: 1,
            observedAttemptErrorCount: 3,
            maxAttemptSkippedCountThreshold: 2,
            observedAttemptSkippedCount: 1,
          },
        },
      },
    });

    await act(async () => {
      root.render(<Integrations />);
    });

    expect(container.textContent).toContain('Traceability Readiness');
    expect(container.textContent).toContain('NOT READY');
    expect(container.textContent).toContain('Orchestration decision: HOLD');
    expect(container.textContent).toContain('Baseline fixture governance is failing. Resolve baseline-governance policy failures before rollout signoff.');
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
      sloCalls.some(
        (options) =>
          options.queryKey[1] === 7
          && options.queryKey[2] === 5
          && options.queryKey[3] === 95
          && options.queryKey[4] === 25
          && options.queryKey[5] === 5
          && options.queryKey[6] === 25
      )
    ).toBe(true);
  });

  it('exports telemetry and SLO snapshots through UI actions', async () => {
    const clipboardWriteTextMock = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: clipboardWriteTextMock },
    });

    setupQueryMocks({
      integrations: {
        data: {
          sendgrid_configured: true,
          sendgrid_api_key: '••••1234',
          apollo_enabled: true,
          clearbit_enabled: true,
          crunchbase_enabled: true,
        },
      },
      googleStatus: { data: { connected: false } },
      'integrations-health': {
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
          status: 'ACTION_REQUIRED',
          healthyCount: 2,
          unhealthyCount: 2,
          unhealthyProviders: ['clearbit', 'crunchbase'],
          actionableUnhealthyProviders: ['clearbit'],
          credentialActionRequiredProviders: ['clearbit'],
          credentialConfiguredMaxAgeDays: 90,
          credentialRotationMaxAgeDays: 45,
          credentialFreshnessStatusCounts: {
            ACTION_REQUIRED: 1,
            READY: 2,
            UNKNOWN: 1,
          },
          credentialFreshnessByProvider: {
            sendgrid: { status: 'READY', configuredAgeDays: 12, rotationAgeDays: 12, staleReasons: [] },
            apollo: { status: 'READY', configuredAgeDays: 14, rotationAgeDays: 11, staleReasons: [] },
            clearbit: { status: 'ACTION_REQUIRED', configuredAgeDays: 120, rotationAgeDays: 101, staleReasons: ['rotation_age_exceeded'] },
            crunchbase: { status: 'UNKNOWN', configuredAgeDays: null, rotationAgeDays: null, staleReasons: [] },
          },
          credentialFreshnessTotalProviders: 4,
          credentialFreshnessActionRequiredCount: 1,
          credentialFreshnessWithinPolicyCount: 2,
          credentialFreshnessUnknownCount: 1,
          recommendedCommands: ['npm run verify:smoke:credential-freshness'],
          providers: [
            {
              provider: 'sendgrid',
              healthy: true,
              statusCode: 200,
              latencyMs: 10,
              error: null,
              configuredAt: '2026-02-01T00:00:00Z',
              lastRotatedAt: '2026-02-01T00:00:00Z',
              credentialConfiguredAgeDays: 12,
              credentialRotationAgeDays: 12,
              credentialStale: false,
              credentialStaleReasons: [],
            },
            {
              provider: 'apollo',
              healthy: true,
              statusCode: 200,
              latencyMs: 11,
              error: null,
              configuredAt: '2026-02-01T00:00:00Z',
              lastRotatedAt: '2026-02-02T00:00:00Z',
              credentialConfiguredAgeDays: 14,
              credentialRotationAgeDays: 11,
              credentialStale: false,
              credentialStaleReasons: [],
            },
            {
              provider: 'clearbit',
              healthy: false,
              statusCode: 429,
              latencyMs: 15,
              error: 'Rate limited',
              configuredAt: '2025-10-01T00:00:00Z',
              lastRotatedAt: '2025-09-01T00:00:00Z',
              credentialConfiguredAgeDays: 120,
              credentialRotationAgeDays: 101,
              credentialStale: true,
              credentialStaleReasons: ['rotation_age_exceeded'],
            },
            {
              provider: 'crunchbase',
              healthy: false,
              statusCode: null,
              latencyMs: null,
              error: 'Not configured',
              configuredAt: null,
              lastRotatedAt: null,
              credentialConfiguredAgeDays: null,
              credentialRotationAgeDays: null,
              credentialStale: false,
              credentialStaleReasons: [],
            },
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
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
          windowDays: 7,
          eventCount: 4,
          errorEventCount: 0,
          byProvider: { sendgrid: 4 },
          trendByDay: [{ date: '2026-02-21', events: 4, errors: 0, salesIntelligenceEvents: 0, orchestrationEvents: 2 }],
          salesIntelligence: { eventCount: 0, byEventFamily: {} },
          traceabilityAudit: {
            eventCount: 1,
            decisionCounts: { HOLD: 1 },
            readyCount: 0,
            notReadyCount: 1,
            latestEvaluatedAt: '2026-02-22T00:00:00Z',
          },
          governanceSchemaAudit: {
            eventCount: 2,
            statusCounts: { ACTION_REQUIRED: 1, READY: 1 },
            reasonCodeParityPassCount: 1,
            reasonCodeParityFailCount: 1,
            recommendedCommandParityPassCount: 1,
            recommendedCommandParityFailCount: 1,
            handoffParityPassCount: 1,
            handoffParityFailCount: 1,
            allParityPassedCount: 1,
            allParityFailedCount: 1,
            rolloutBlockedCount: 1,
            latestEvaluatedAt: '2026-02-22T00:00:00Z',
          },
          packetValidationAudit: {
            eventCount: 2,
            statusCounts: { ACTION_REQUIRED: 1, READY: 1 },
            withinFreshnessCount: 1,
            outsideFreshnessCount: 1,
            missingFreshnessCount: 0,
            latestEvaluatedAt: '2026-02-22T00:00:00Z',
          },
          connectorRateLimit: {
            eventCount: 1,
            byEndpoint: { apollo_search: 1 },
            latestEventAt: '2026-02-22T00:00:00Z',
            maxRetryAfterSeconds: 44,
            avgRetryAfterSeconds: 44.0,
            maxResetInSeconds: 43,
            avgResetInSeconds: 43.0,
          },
          connectorValidation: {
            eventCount: 2,
            byEndpoint: {
              apollo_search: 1,
              clearbit_company: 1,
            },
            byProvider: {
              apollo: 1,
              clearbit: 1,
            },
            byField: {
              limit: 1,
              domain: 1,
            },
            byReason: {
              range: 1,
              required: 1,
            },
            latestEventAt: '2026-02-22T00:00:03Z',
          },
          retryAudit: {
            eventCount: 2,
            byOperation: {
              sendgrid_send_email: 1,
              sendgrid_health_check: 1,
            },
            byProvider: {
              sendgrid: 2,
            },
            maxNextDelaySeconds: 1.0,
            avgNextDelaySeconds: 0.6,
            latestEventAt: '2026-02-22T00:00:01Z',
          },
          orchestrationAudit: {
            eventCount: 2,
            bySelectedProvider: {
              apollo: 1,
              clearbit: 1,
            },
            attemptStatusCounts: {
              success: 1,
              skipped: 1,
              error: 1,
            },
            reasonCodeCounts: {
              success: 1,
              domain_required: 1,
              provider_http_error: 1,
            },
            maxAttemptCount: 3,
            avgAttemptCount: 2.5,
            maxLatencyMs: 82.4,
            avgLatencyMs: 46.2,
            trendByDay: [
              {
                date: '2026-02-21',
                events: 2,
                attemptSuccessCount: 1,
                attemptSkippedCount: 1,
                attemptErrorCount: 1,
              },
            ],
            latestEventAt: '2026-02-22T00:00:02Z',
          },
          recentEvents: [
            {
              eventType: 'company_enrichment_orchestrated',
              provider: 'integrations',
              requestId: 'req-orchestration-export',
              schemaVersion: 1,
              orchestrationSelectedProvider: 'apollo',
              orchestrationAttemptCount: 3,
              orchestrationAttemptSuccessCount: 1,
              orchestrationAttemptSkippedCount: 1,
              orchestrationAttemptErrorCount: 1,
              orchestrationResultCount: 2,
            },
            {
              eventType: 'integrations_traceability_status_evaluated',
              provider: 'integrations',
              requestId: 'req-traceability-export',
              schemaVersion: 'unknown',
              traceabilityDecision: 'HOLD',
              traceabilityReady: false,
              governancePacketValidationStatus: 'ACTION_REQUIRED',
              governancePacketValidationWithinFreshness: false,
            },
            {
              eventType: 'integrations_traceability_snapshot_governance_evaluated',
              provider: 'integrations',
              requestId: 'req-governance-export',
              schemaVersion: 'unknown',
              governanceStatus: 'ACTION_REQUIRED',
              governancePacketValidationStatus: 'READY',
              governancePacketValidationWithinFreshness: true,
              governanceSchemaReasonCodeParityOk: false,
              governanceSchemaRecommendedCommandParityOk: false,
              governanceSchemaHandoffParityOk: true,
              governanceSchemaAllParityOk: false,
              governanceSchemaRolloutBlocked: true,
              governanceSchemaReasonCodeCount: 2,
              governanceSchemaRecommendedCommandCount: 1,
            },
            {
              eventType: 'integrations_connector_rate_limited',
              provider: 'integrations',
              requestId: 'req-rate-limit-export',
              connectorRateLimitEndpoint: 'apollo_search',
              connectorRateLimitRetryAfterSeconds: 44,
              connectorRateLimitResetInSeconds: 43,
            },
            {
              eventType: 'integrations_connector_input_validation_failed',
              provider: 'integrations',
              requestId: 'req-validation-export',
              connectorValidationProvider: 'apollo',
              connectorValidationEndpoint: 'apollo_search',
              connectorValidationField: 'limit',
              connectorValidationReason: 'range',
              connectorValidationErrorCode: 'invalid_request_bounds',
              connectorValidationReceived: 0,
              connectorValidationMinimum: 1,
              connectorValidationMaximum: 25,
            },
            {
              eventType: 'integrations_retry_attempt',
              provider: 'integrations',
              requestId: 'req-retry-export',
              retryOperation: 'sendgrid_health_check',
              retryAttempt: 1,
              retryMaxAttempts: 3,
              retryNextDelaySeconds: 1.0,
              retryError: 'timeout',
              retryFinalOutcome: 'exhausted',
              retryRetryable: false,
              retryErrorType: 'http_5xx',
              retryErrorStatusCode: '503',
              retryErrorReasonCode: 'provider_http_5xx',
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
          gates: {
            overallPassed: true,
            errorRatePassed: true,
            latencyPassed: true,
            orchestrationAttemptErrorPassed: true,
            orchestrationAttemptSkippedPassed: true,
          },
          errorRate: { observedPct: 0, thresholdPct: 5, errorEvents: 0 },
          orchestrationAudit: {
            maxAttemptErrorCountThreshold: 5,
            observedAttemptErrorCount: 1,
            maxAttemptSkippedCountThreshold: 25,
            observedAttemptSkippedCount: 1,
          },
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
          rolloutActions: [
            {
              priority: 'P1',
              severity: 'high',
              ownerRole: 'Release Manager',
              action: 'Run cleanup policy.',
              trigger: 'snapshot_stale',
              command: 'npm run verify:telemetry:traceability:cleanup:policy',
            },
          ],
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
          orchestrationGate: {
            available: true,
            decision: 'PROCEED',
            attemptErrorGatePassed: true,
            attemptSkippedGatePassed: true,
            maxAttemptErrorCountThreshold: 5,
            observedAttemptErrorCount: 1,
            maxAttemptSkippedCountThreshold: 25,
            observedAttemptSkippedCount: 1,
          },
          rolloutActions: [
            {
              priority: 'P1',
              severity: 'high',
              ownerRole: 'QA Engineer',
              action: 'Run baseline drift smoke.',
              trigger: 'baseline_policy_failed',
              command: 'npm run verify:smoke:baseline-governance-drift',
            },
          ],
        },
      },
      'integrations-governance-report': {
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
          windowDays: 7,
          eventLimit: 1000,
          totals: {
            governanceEventCount: 2,
            traceabilityEvaluationCount: 1,
            snapshotEvaluationCount: 1,
            baselineEvaluationCount: 1,
            actionRequiredCount: 1,
            connectorRateLimitEventCount: 2,
            sendgridWebhookTimestampEventCount: 2,
            sendgridWebhookTimestampAnomalyCountTotal: 3,
            rolloutBlockedCount: 2,
          },
          connectorRateLimit: {
            eventCount: 2,
            byEndpoint: {
              apollo_search: 1,
              company_enrichment_orchestration: 1,
            },
            latestEventAt: '2026-02-22T00:00:00Z',
            maxRetryAfterSeconds: 46,
            avgRetryAfterSeconds: 34.5,
            maxResetInSeconds: 44,
            avgResetInSeconds: 31.5,
            pressure: {
              label: 'High',
              signalSeconds: 46,
            },
          },
          sendgridWebhookTimestamp: {
            eventCount: 2,
            pressureLabelCounts: { High: 1, Moderate: 1 },
            pressureHintCounts: {
              'Investigate stale timestamps.': 1,
              'Validate clock skew.': 1,
            },
            timestampFallbackCount: 1,
            futureSkewEventCount: 1,
            staleEventCount: 1,
            freshEventCount: 0,
            timestampAnomalyCountTotal: 3,
            avgTimestampAnomalyRatePct: 62.5,
            maxTimestampAnomalyRatePct: 75.0,
            timestampAgeBucketCounts: { stale: 1, future_skew: 1 },
            timestampAnomalyEventTypeCounts: { open: 2, click: 1 },
            latestEventAt: '2026-02-22T00:00:00Z',
          },
          governanceStatusCounts: { ACTION_REQUIRED: 1, PASS: 1 },
          traceabilityDecisionCounts: { HOLD: 1 },
          timeline: [
            {
              date: '2026-02-22',
              traceabilityEvents: 1,
              snapshotGovernanceEvents: 1,
              baselineGovernanceEvents: 1,
              actionRequiredEvents: 1,
              holdDecisions: 1,
              proceedDecisions: 0,
              statusCounts: { ACTION_REQUIRED: 1, PASS: 1 },
            },
          ],
          latestEvents: [
            {
              createdAt: '2026-02-22T00:00:00Z',
              governanceType: 'snapshot',
              status: 'ACTION_REQUIRED',
              requestId: 'req-governance-export',
              rolloutBlocked: true,
            },
          ],
          ownerActionMatrix: [
            {
              priority: 'P1',
              severity: 'high',
              ownerRole: 'Release Manager',
              trigger: 'governance_action_required',
              action: 'Run governance remediation commands.',
              command: 'npm run verify:telemetry:traceability:cleanup:policy',
            },
          ],
          recommendedCommands: [
            'npm run verify:telemetry:traceability:cleanup:policy',
            'npm run verify:smoke:traceability-governance-handoff',
          ],
        },
      },
      'integrations-governance-report-export': {
        data: {
          governanceType: 'weekly_report',
          exportSchemaVersion: 1,
          generatedAt: '2026-02-22T00:00:00Z',
          windowDays: 7,
          eventLimit: 1000,
          status: 'ACTION_REQUIRED',
          connectorRateLimit: {
            eventCount: 2,
            byEndpoint: {
              apollo_search: 1,
              company_enrichment_orchestration: 1,
            },
            latestEventAt: '2026-02-22T00:00:00Z',
            maxRetryAfterSeconds: 46,
            avgRetryAfterSeconds: 34.5,
            maxResetInSeconds: 44,
            avgResetInSeconds: 31.5,
            pressure: {
              label: 'High',
              signalSeconds: 46,
            },
          },
          sendgridWebhookTimestamp: {
            eventCount: 2,
            pressureLabelCounts: { high: 1, moderate: 1 },
            pressureHintCounts: {
              'investigate stale timestamps.': 1,
              'validate clock skew.': 1,
            },
            timestampFallbackCount: 1,
            futureSkewEventCount: 1,
            staleEventCount: 1,
            freshEventCount: 0,
            timestampAnomalyCountTotal: 3,
            avgTimestampAnomalyRatePct: 62.5,
            maxTimestampAnomalyRatePct: 75.0,
            timestampAgeBucketCounts: { stale: 1, future_skew: 1 },
            timestampAnomalyEventTypeCounts: { open: 2, click: 1 },
            latestEventAt: '2026-02-22T00:00:00Z',
          },
          recommendedCommands: [
            'npm run verify:governance:weekly',
            'npm run verify:smoke:governance-export-guard',
          ],
          runtimePrereqs: {
            present: true,
            available: true,
            passed: true,
            contractValid: true,
            valid: true,
            missingCheckCount: 0,
            missingChecks: {
              commands: [],
              workspace: [],
            },
            command: 'npm run verify:baseline:runtime-prereqs:artifact',
          },
          governanceExport: {
            governanceType: 'weekly_report',
            exportSchemaVersion: 1,
            status: 'ACTION_REQUIRED',
            rolloutBlocked: true,
            ownerRole: 'Release Manager',
            connectorRateLimit: {
              eventCount: 2,
              byEndpoint: {
                apollo_search: 1,
                company_enrichment_orchestration: 1,
              },
              latestEventAt: '2026-02-22T00:00:00Z',
              maxRetryAfterSeconds: 46,
              avgRetryAfterSeconds: 34.5,
              maxResetInSeconds: 44,
              avgResetInSeconds: 31.5,
              pressure: {
                label: 'High',
                signalSeconds: 46,
              },
            },
            sendgridWebhookTimestamp: {
              eventCount: 2,
              pressureLabelCounts: { high: 1, moderate: 1 },
              pressureHintCounts: {
                'investigate stale timestamps.': 1,
                'validate clock skew.': 1,
              },
              timestampFallbackCount: 1,
              futureSkewEventCount: 1,
              staleEventCount: 1,
              freshEventCount: 0,
              timestampAnomalyCountTotal: 3,
              avgTimestampAnomalyRatePct: 62.5,
              maxTimestampAnomalyRatePct: 75.0,
              timestampAgeBucketCounts: { stale: 1, future_skew: 1 },
              timestampAnomalyEventTypeCounts: { open: 2, click: 1 },
              latestEventAt: '2026-02-22T00:00:00Z',
            },
            alerts: [
              {
                severity: 'high',
                ownerRole: 'Release Manager',
                message: 'Snapshot governance contains ACTION_REQUIRED evaluations.',
              },
            ],
            actions: [],
            runtimePrereqs: {
              present: true,
              available: true,
              passed: true,
              contractValid: true,
              valid: true,
              missingCheckCount: 0,
              missingChecks: {
                commands: [],
                workspace: [],
              },
              command: 'npm run verify:baseline:runtime-prereqs:artifact',
            },
            requestedBy: 'u1',
          },
          requestedBy: 'u1',
        },
      },
      'integrations-governance-report-history': {
        data: {
          governanceType: 'weekly_report_history',
          exportSchemaVersion: 1,
          generatedAt: '2026-02-22T00:00:00Z',
          retentionDays: 7,
          limit: 50,
          artifactDirectory: '/tmp',
          artifactPrefix: 'connector_governance_weekly_report',
          artifactCount: 2,
          staleCount: 1,
          rolloutBlockedCount: 1,
          totals: {
            connectorRateLimitEventCount: 3,
            sendgridWebhookTimestampEventCount: 3,
            sendgridWebhookTimestampAnomalyCountTotal: 5,
          },
          connectorRateLimit: {
            eventCount: 3,
            byEndpoint: {
              apollo_search: 2,
              company_enrichment_orchestration: 1,
            },
            latestEventAt: '2026-02-22T00:00:00Z',
            maxRetryAfterSeconds: 47,
            avgRetryAfterSeconds: 35,
            maxResetInSeconds: 45,
            avgResetInSeconds: 33,
            pressure: {
              label: 'High',
              signalSeconds: 47,
            },
          },
          sendgridWebhookTimestamp: {
            eventCount: 3,
            pressureLabelCounts: { High: 2, Moderate: 1 },
            pressureHintCounts: {
              'Investigate stale timestamps.': 2,
              'Validate clock skew.': 1,
            },
            timestampFallbackCount: 1,
            futureSkewEventCount: 1,
            staleEventCount: 2,
            freshEventCount: 0,
            timestampAnomalyCountTotal: 5,
            avgTimestampAnomalyRatePct: 70.0,
            maxTimestampAnomalyRatePct: 80.0,
            timestampAgeBucketCounts: { stale: 2, future_skew: 1 },
            timestampAnomalyEventTypeCounts: { open: 3, click: 2 },
            latestEventAt: '2026-02-22T00:00:00Z',
          },
          latestArtifact: {
            name: 'connector_governance_weekly_report_recent.json',
            exportSchemaVersion: 1,
            status: 'ACTION_REQUIRED',
            rolloutBlocked: true,
          },
          items: [
            {
              name: 'connector_governance_weekly_report_recent.json',
              exportSchemaVersion: 1,
              status: 'ACTION_REQUIRED',
              withinRetention: true,
              rolloutBlocked: true,
            },
            {
              name: 'connector_governance_weekly_report_stale.json',
              exportSchemaVersion: 1,
              status: 'READY',
              withinRetention: false,
              rolloutBlocked: false,
            },
          ],
          status: 'ACTION_REQUIRED',
          alerts: ['One or more governance weekly report artifacts are outside retention threshold.'],
          recommendedCommands: ['npm run verify:governance:weekly:cleanup:policy'],
          runtimePrereqs: {
            present: true,
            available: false,
            passed: false,
            contractValid: true,
            valid: false,
            missingCheckCount: 1,
            missingChecks: {
              commands: ['node'],
              workspace: [],
            },
            command: 'npm run verify:baseline:runtime-prereqs:artifact',
          },
          governanceExport: {
            governanceType: 'weekly_report_history',
            exportSchemaVersion: 1,
            status: 'ACTION_REQUIRED',
            rolloutBlocked: true,
            ownerRole: 'Release Manager',
            connectorRateLimit: {
              eventCount: 3,
              byEndpoint: {
                apollo_search: 2,
                company_enrichment_orchestration: 1,
              },
              latestEventAt: '2026-02-22T00:00:00Z',
              maxRetryAfterSeconds: 47,
              avgRetryAfterSeconds: 35,
              maxResetInSeconds: 45,
              avgResetInSeconds: 33,
              pressure: {
                label: 'High',
                signalSeconds: 47,
              },
            },
            sendgridWebhookTimestamp: {
              eventCount: 3,
              pressureLabelCounts: { high: 2, moderate: 1 },
              pressureHintCounts: {
                'investigate stale timestamps.': 2,
                'validate clock skew.': 1,
              },
              timestampFallbackCount: 1,
              futureSkewEventCount: 1,
              staleEventCount: 2,
              freshEventCount: 0,
              timestampAnomalyCountTotal: 5,
              avgTimestampAnomalyRatePct: 70.0,
              maxTimestampAnomalyRatePct: 80.0,
              timestampAgeBucketCounts: { stale: 2, future_skew: 1 },
              timestampAnomalyEventTypeCounts: { open: 3, click: 2 },
              latestEventAt: '2026-02-22T00:00:00Z',
            },
            runtimePrereqs: {
              present: true,
              available: false,
              passed: false,
              contractValid: true,
              valid: false,
              missingCheckCount: 1,
              missingChecks: {
                commands: ['node'],
                workspace: [],
              },
              command: 'npm run verify:baseline:runtime-prereqs:artifact',
            },
          },
          requestedBy: 'u1',
        },
      },
      'integrations-governance-schema': {
        data: {
          governanceType: 'schema_metadata',
          status: 'READY',
          schemaMetadata: {
            activeVersion: 1,
            defaultVersion: 1,
            supportedVersions: [1],
            source: 'default',
            override: {
              isSet: false,
              isValid: false,
            },
          },
          alerts: [],
          recommendedCommands: [
            'npm run verify:governance:weekly:endpoint:contract',
            'npm run verify:governance:schema:preflight',
          ],
        },
      },
    });

    await act(async () => {
      root.render(<Integrations />);
    });
    expect(container.textContent).toContain('Retry Audit Posture');
    expect(container.textContent).toContain('sendgrid_health_check');
    expect(container.textContent).toContain('sendgrid');
    expect(container.textContent).toContain('Connector Credential Freshness');
    expect(container.textContent).toContain('Connector Input-Validation Posture');
    expect(container.textContent).toContain('SendGrid timestamp events: 2');
    expect(container.textContent).toContain('validation apollo_search field limit reason range code invalid_request_bounds received 0 min 1 max 25');
    expect(container.textContent).toContain('Health Status');
    expect(container.textContent).toContain('Freshness ACTION_REQUIRED');
    expect(container.textContent).toContain('clearbit');
    expect(container.textContent).toContain('crunchbase');

    const createObjectURLMock = URL.createObjectURL as jest.Mock;
    const revokeObjectURLMock = URL.revokeObjectURL as jest.Mock;

    await act(async () => {
      findButton(container, 'Export Telemetry JSON').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    const telemetryBlob = createObjectURLMock.mock.calls[0][0] as Blob;
    const telemetryPayload = JSON.parse(await new Response(telemetryBlob).text());
    const traceabilityEvent = telemetryPayload.recentEvents.find(
      (row: any) => row.eventType === 'integrations_traceability_status_evaluated'
    );
    const governanceEvent = telemetryPayload.recentEvents.find(
      (row: any) => row.eventType === 'integrations_traceability_snapshot_governance_evaluated'
    );
    expect(telemetryPayload.traceabilityAudit.decisionCounts.HOLD).toBe(1);
    expect(traceabilityEvent?.traceabilityDecision).toBe('HOLD');
    expect(telemetryPayload.governanceSchemaAudit.eventCount).toBe(2);
    expect(telemetryPayload.governanceSchemaAudit.reasonCodeParityPassCount).toBe(1);
    expect(telemetryPayload.governanceSchemaAudit.reasonCodeParityFailCount).toBe(1);
    expect(telemetryPayload.packetValidationAudit.eventCount).toBe(2);
    expect(telemetryPayload.packetValidationAudit.statusCounts.ACTION_REQUIRED).toBe(1);
    expect(telemetryPayload.packetValidationAudit.statusCounts.READY).toBe(1);
    expect(traceabilityEvent?.governancePacketValidationStatus).toBe('ACTION_REQUIRED');
    expect(governanceEvent?.governancePacketValidationWithinFreshness).toBe(true);
    expect(governanceEvent?.governanceSchemaAllParityOk).toBe(false);
    expect(governanceEvent?.governanceSchemaRolloutBlocked).toBe(true);
    expect(governanceEvent?.governanceSchemaReasonCodeCount).toBe(2);
    expect(governanceEvent?.governanceSchemaRecommendedCommandCount).toBe(1);
    expect(telemetryPayload.connectorRateLimit.eventCount).toBe(1);
    expect(telemetryPayload.connectorRateLimit.byEndpoint.apollo_search).toBe(1);
    expect(telemetryPayload.connectorRateLimit.maxResetInSeconds).toBe(43);
    expect(telemetryPayload.connectorRateLimit.avgRetryAfterSeconds).toBe(44);
    expect(telemetryPayload.connectorValidation.eventCount).toBe(2);
    expect(telemetryPayload.connectorValidation.byEndpoint.apollo_search).toBe(1);
    expect(telemetryPayload.connectorValidation.byProvider.apollo).toBe(1);
    expect(telemetryPayload.connectorValidation.byField.limit).toBe(1);
    expect(telemetryPayload.connectorValidation.byReason.range).toBe(1);
    expect(telemetryPayload.connectorValidation.latestEventAt).toBe('2026-02-22T00:00:03Z');
    expect(telemetryPayload.retryAudit.eventCount).toBe(2);
    expect(telemetryPayload.retryAudit.byOperation.sendgrid_health_check).toBe(1);
    expect(telemetryPayload.retryAudit.maxNextDelaySeconds).toBe(1);
    expect(telemetryPayload.orchestrationAudit.eventCount).toBe(2);
    expect(telemetryPayload.orchestrationAudit.bySelectedProvider.apollo).toBe(1);
    expect(telemetryPayload.orchestrationAudit.attemptStatusCounts.error).toBe(1);
    expect(telemetryPayload.orchestrationAudit.reasonCodeCounts.provider_http_error).toBe(1);
    expect(telemetryPayload.orchestrationAudit.maxAttemptCount).toBe(3);
    expect(
      telemetryPayload.recentEvents.some(
        (row: any) =>
          row.connectorRateLimitEndpoint === 'apollo_search'
          && row.connectorRateLimitRetryAfterSeconds === 44
          && row.connectorRateLimitResetInSeconds === 43
      )
    ).toBe(true);
    expect(
      telemetryPayload.recentEvents.some(
        (row: any) =>
          row.connectorValidationEndpoint === 'apollo_search'
          && row.connectorValidationField === 'limit'
          && row.connectorValidationReason === 'range'
          && row.connectorValidationErrorCode === 'invalid_request_bounds'
      )
    ).toBe(true);
    expect(
      telemetryPayload.recentEvents.some(
        (row: any) =>
          row.retryOperation === 'sendgrid_health_check'
          && row.retryAttempt === 1
          && row.retryMaxAttempts === 3
          && row.retryNextDelaySeconds === 1
      )
    ).toBe(true);
    expect(
      telemetryPayload.recentEvents.some(
        (row: any) =>
          row.retryFinalOutcome === 'EXHAUSTED'
          && row.retryRetryable === false
          && row.retryErrorType === 'HTTP_5XX'
          && row.retryErrorStatusCode === 503
          && row.retryErrorReasonCode === 'PROVIDER_HTTP_5XX'
      )
    ).toBe(true);
    expect(telemetryPayload.exportRequestedWindowDays).toBe(7);
    expect(telemetryPayload.exportRequestedLimit).toBe(500);
    expect(telemetryPayload.exportSchemaVersion).toBe(3);
    expect(telemetryPayload.exportRecentEventsFilter).toBe('all');
    expect(telemetryPayload.exportRecentEventsSelectedFilter).toBe('all');
    expect(telemetryPayload.exportRecentEventsServerFilter).toBeNull();
    expect(telemetryPayload.exportRecentEventsServerFilterRaw).toBeNull();
    expect(telemetryPayload.exportRecentEventsServerFilterRawTrimmed).toBeNull();
    expect(telemetryPayload.exportRecentEventsServerFilterBlank).toBe(false);
    expect(telemetryPayload.exportRecentEventsServerFilterUnsupported).toBe(false);
    expect(telemetryPayload.exportRecentEventsServerFilterEvaluation).toBe('absent');
    expect(telemetryPayload.exportRecentEventsServerFilterNormalizationChanged).toBe(false);
    expect(telemetryPayload.exportRecentEventsFilterMismatch).toBe(false);
    expect(telemetryPayload.exportRecentEventsFilterSource).toBe('local');
    expect(telemetryPayload.exportRecentEventsFilterResolution).toBe('local_no_server_filter');
    expect(telemetryPayload.exportRecentEventsPacketValidationCount).toBe(2);
    expect(telemetryPayload.exportRecentEventsNonPacketCount).toBe(4);
    expect(telemetryPayload.exportRetryAuditEventCount).toBe(2);
    expect(telemetryPayload.exportRetryAuditLatestEventAt).toBe('2026-02-22T00:00:01Z');
    expect(telemetryPayload.exportRetryAuditMaxNextDelaySeconds).toBe(1);
    expect(telemetryPayload.exportRetryAuditAvgNextDelaySeconds).toBe(0.6);
    expect(telemetryPayload.exportRetryAuditOperationCount).toBe(2);
    expect(telemetryPayload.exportRetryAuditProviderCount).toBe(1);
    expect(telemetryPayload.exportConnectorValidationEventCount).toBe(2);
    expect(telemetryPayload.exportConnectorValidationLatestEventAt).toBe('2026-02-22T00:00:03Z');
    expect(telemetryPayload.exportConnectorValidationEndpointCount).toBe(2);
    expect(telemetryPayload.exportConnectorValidationProviderCount).toBe(2);
    expect(telemetryPayload.exportConnectorValidationFieldCount).toBe(2);
    expect(telemetryPayload.exportConnectorValidationReasonCount).toBe(2);
    expect(telemetryPayload.exportRetryTerminalEventCount).toBe(1);
    expect(telemetryPayload.exportRetryTerminalOutcomeCounts.EXHAUSTED).toBe(1);
    expect(telemetryPayload.exportRetryTerminalRetryabilityCounts.NON_RETRYABLE).toBe(1);
    expect(telemetryPayload.exportRetryTerminalErrorTypeCounts.HTTP_5XX).toBe(1);
    expect(telemetryPayload.exportRetryTerminalReasonCodeCounts.PROVIDER_HTTP_5XX).toBe(1);
    expect(telemetryPayload.exportRetryTerminalStatusCodeCounts['503']).toBe(1);
    expect(telemetryPayload.exportRetryTerminalPressureLabel).toBe('Low');
    expect(telemetryPayload.exportRetryTerminalPressureSignalCount).toBe(1);
    expect(telemetryPayload.exportRetryTerminalTopOutcome).toEqual({ key: 'EXHAUSTED', count: 1 });
    expect(telemetryPayload.exportRetryTerminalTopReasonCode).toEqual({ key: 'PROVIDER_HTTP_5XX', count: 1 });
    expect(telemetryPayload.exportRetryTerminalTopStatusCode).toEqual({ key: '503', count: 1 });
    expect(telemetryPayload.exportOrchestrationAuditEventCount).toBe(2);
    expect(telemetryPayload.exportOrchestrationAuditLatestEventAt).toBe('2026-02-22T00:00:02Z');
    expect(telemetryPayload.exportOrchestrationAuditMaxAttemptCount).toBe(3);
    expect(telemetryPayload.exportOrchestrationAuditAvgAttemptCount).toBe(2.5);
    expect(telemetryPayload.exportOrchestrationAuditProviderCount).toBe(2);
    expect(telemetryPayload.exportOrchestrationAuditReasonCodeCount).toBe(3);
    expect(telemetryPayload.exportOrchestrationTrendDayCount).toBe(1);
    expect(telemetryPayload.exportOrchestrationTrendEventCount).toBe(2);
    expect(telemetryPayload.exportOrchestrationTrendAttemptErrorCount).toBe(1);
    expect(telemetryPayload.exportOrchestrationTrendAttemptSkippedCount).toBe(1);
    expect(telemetryPayload.exportIntegrationHealthStatus).toBe('ACTION_REQUIRED');
    expect(telemetryPayload.exportIntegrationHealthHealthyCount).toBe(2);
    expect(telemetryPayload.exportIntegrationHealthUnhealthyCount).toBe(2);
    expect(telemetryPayload.exportIntegrationHealthCredentialActionRequiredProviders).toEqual(['clearbit']);
    expect(telemetryPayload.exportIntegrationHealthCredentialFreshnessActionRequiredCount).toBe(1);
    expect(telemetryPayload.exportIntegrationHealthCredentialFreshnessWithinPolicyCount).toBe(2);
    expect(telemetryPayload.exportIntegrationHealthCredentialFreshnessUnknownCount).toBe(1);
    expect(telemetryPayload.exportIntegrationHealthCredentialFreshnessByProvider.clearbit.status).toBe('ACTION_REQUIRED');
    expect(telemetryPayload.exportIntegrationHealthCredentialFreshnessStatusCountsSource).toBe('server');
    expect(telemetryPayload.exportIntegrationHealthCredentialFreshnessStatusCountsMismatch).toBe(false);
    expect(telemetryPayload.exportIntegrationHealthCredentialFreshnessStatusCountsServer).toEqual({
      ACTION_REQUIRED: 1,
      READY: 2,
      UNKNOWN: 1,
    });
    expect(telemetryPayload.exportIntegrationHealthCredentialFreshnessStatusCountsFallback).toEqual({
      ACTION_REQUIRED: 1,
      READY: 2,
      UNKNOWN: 1,
    });
    expect(telemetryPayload.exportIntegrationHealthRecommendedCommands).toEqual(['npm run verify:smoke:credential-freshness']);
    expect(container.textContent).toContain('Freshness status-count source: server. Effective counts: ACTION_REQUIRED: 1 | READY: 2 | UNKNOWN: 1.');
    expect(container.textContent).toContain('Orchestration Audit Posture');
    expect(container.textContent).toContain('By Selected Provider');
    expect(container.textContent).toContain('domain_required');
    expect(container.textContent).toContain('orchestration provider apollo attempts 3 (s 1 / sk 1 / e 1) results 2');
    expect(container.textContent).toContain('validation apollo_search field limit reason range code invalid_request_bounds received 0 min 1 max 25');
    expect(container.textContent).toContain('Retry Terminal Outcomes');
    expect(container.textContent).toContain('pressure Low');
    expect(container.textContent).toContain('top outcome EXHAUSTED (1)');
    expect(container.textContent).toContain('top reason PROVIDER_HTTP_5XX (1)');
    expect(container.textContent).toContain('top status 503 (1)');
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
    expect(baselineGovernancePayload.orchestrationGate.available).toBe(true);
    expect(baselineGovernancePayload.orchestrationGate.attemptErrorGatePassed).toBe(true);
    expect(baselineGovernancePayload.orchestrationGate.attemptSkippedGatePassed).toBe(true);
    expect(container.textContent).toContain('connector-baseline-governance exported.');
    expect(container.textContent).toContain('Orchestration gate available: yes');
    expect(container.textContent).toContain('Orchestration decision: PROCEED');
    expect(container.textContent).toContain('Orchestration observed (err/sk): 1/1 • threshold (err/sk): 5/25');

    await act(async () => {
      findButton(container, 'Copy Snapshot Commands').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(clipboardWriteTextMock).toHaveBeenCalledWith('npm run verify:telemetry:traceability:cleanup:policy');
    expect(container.textContent).toContain('Snapshot governance remediation commands copied.');

    await act(async () => {
      findButton(container, 'Copy Baseline Commands').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(clipboardWriteTextMock).toHaveBeenCalledWith('npm run verify:smoke:baseline-governance-drift');
    expect(container.textContent).toContain('Baseline governance remediation commands copied.');

    await act(async () => {
      findButton(container, 'Export Governance Report JSON').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(createObjectURLMock).toHaveBeenCalledTimes(4);
    const governanceReportBlob = createObjectURLMock.mock.calls[3][0] as Blob;
    const governanceReportPayload = JSON.parse(await new Response(governanceReportBlob).text());
    expect(governanceReportPayload.totals.actionRequiredCount).toBe(1);
    expect(governanceReportPayload.totals.connectorRateLimitEventCount).toBe(2);
    expect(governanceReportPayload.totals.sendgridWebhookTimestampEventCount).toBe(2);
    expect(governanceReportPayload.totals.sendgridWebhookTimestampAnomalyCountTotal).toBe(3);
    expect(governanceReportPayload.connectorRateLimit.eventCount).toBe(2);
    expect(governanceReportPayload.connectorRateLimit.pressure.label).toBe('High');
    expect(governanceReportPayload.sendgridWebhookTimestamp.eventCount).toBe(2);
    expect(governanceReportPayload.sendgridWebhookTimestamp.timestampAnomalyCountTotal).toBe(3);
    expect(container.textContent).toContain('connector-governance-weekly-report exported.');

    await act(async () => {
      findButton(container, 'Export Governance Handoff JSON').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(createObjectURLMock).toHaveBeenCalledTimes(5);
    const governanceHandoffBlob = createObjectURLMock.mock.calls[4][0] as Blob;
    const governanceHandoffPayload = JSON.parse(await new Response(governanceHandoffBlob).text());
    expect(governanceHandoffPayload.exportSchemaVersion).toBe(1);
    expect(governanceHandoffPayload.governanceExport.exportSchemaVersion).toBe(1);
    expect(governanceHandoffPayload.status).toBe('ACTION_REQUIRED');
    expect(governanceHandoffPayload.connectorRateLimit.eventCount).toBe(2);
    expect(governanceHandoffPayload.governanceExport.connectorRateLimit.pressure.label).toBe('High');
    expect(governanceHandoffPayload.sendgridWebhookTimestamp.eventCount).toBe(2);
    expect(governanceHandoffPayload.governanceExport.sendgridWebhookTimestamp.eventCount).toBe(2);
    expect(governanceHandoffPayload.connectorPressureParity.eventCountMatchesNested).toBe(true);
    expect(governanceHandoffPayload.connectorPressureParity.eventCountMatchesTotals).toBe(true);
    expect(governanceHandoffPayload.connectorPressureParity.byEndpointMatchesNested).toBe(true);
    expect(governanceHandoffPayload.connectorPressureParity.pressureLabelMatchesNested).toBe(true);
    expect(governanceHandoffPayload.sendgridWebhookTimestampParity.eventCountMatchesNested).toBe(true);
    expect(governanceHandoffPayload.sendgridWebhookTimestampParity.eventCountMatchesTotals).toBe(true);
    expect(governanceHandoffPayload.sendgridWebhookTimestampParity.anomalyCountTotalMatchesNested).toBe(true);
    expect(governanceHandoffPayload.sendgridWebhookTimestampParity.pressureLabelCountsMatchNested).toBe(true);
    expect(governanceHandoffPayload.runtimePrereqsPresent).toBe(true);
    expect(governanceHandoffPayload.runtimePrereqsAvailable).toBe(true);
    expect(governanceHandoffPayload.runtimePrereqsMissingCheckCount).toBe(0);
    expect(governanceHandoffPayload.runtimePrereqsParity.matchesNested).toBe(true);
    expect(governanceHandoffPayload.runtimePrereqs).toMatchObject(
      governanceHandoffPayload.governanceExport.runtimePrereqs
    );
    expect(container.textContent).toContain('connector-governance-handoff-export exported.');

    await act(async () => {
      findButton(container, 'Export Governance History JSON').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(createObjectURLMock).toHaveBeenCalledTimes(6);
    const governanceHistoryBlob = createObjectURLMock.mock.calls[5][0] as Blob;
    const governanceHistoryPayload = JSON.parse(await new Response(governanceHistoryBlob).text());
    expect(governanceHistoryPayload.exportSchemaVersion).toBe(1);
    expect(governanceHistoryPayload.governanceExport.exportSchemaVersion).toBe(1);
    expect(governanceHistoryPayload.items[0].exportSchemaVersion).toBe(1);
    expect(governanceHistoryPayload.artifactCount).toBe(2);
    expect(governanceHistoryPayload.connectorRateLimit.eventCount).toBe(3);
    expect(governanceHistoryPayload.governanceExport.connectorRateLimit.pressure.label).toBe('High');
    expect(governanceHistoryPayload.sendgridWebhookTimestamp.eventCount).toBe(3);
    expect(governanceHistoryPayload.sendgridWebhookTimestamp.timestampAnomalyCountTotal).toBe(5);
    expect(governanceHistoryPayload.governanceExport.sendgridWebhookTimestamp.eventCount).toBe(3);
    expect(governanceHistoryPayload.connectorPressureParity.eventCountMatchesNested).toBe(true);
    expect(governanceHistoryPayload.connectorPressureParity.byEndpointMatchesNested).toBe(true);
    expect(governanceHistoryPayload.connectorPressureParity.eventCountMatchesTotals).toBe(true);
    expect(governanceHistoryPayload.sendgridWebhookTimestampParity.eventCountMatchesNested).toBe(true);
    expect(governanceHistoryPayload.sendgridWebhookTimestampParity.eventCountMatchesTotals).toBe(true);
    expect(governanceHistoryPayload.sendgridWebhookTimestampParity.anomalyCountTotalMatchesNested).toBe(true);
    expect(governanceHistoryPayload.runtimePrereqsPresent).toBe(true);
    expect(governanceHistoryPayload.runtimePrereqsAvailable).toBe(false);
    expect(governanceHistoryPayload.runtimePrereqsMissingCheckCount).toBe(1);
    expect(governanceHistoryPayload.runtimePrereqsParity.matchesNested).toBe(true);
    expect(governanceHistoryPayload.runtimePrereqs).toMatchObject(
      governanceHistoryPayload.governanceExport.runtimePrereqs
    );
    expect(container.textContent).toContain('connector-governance-history exported.');

    await act(async () => {
      findButton(container, 'Export Governance Schema JSON').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(createObjectURLMock).toHaveBeenCalledTimes(7);
    const governanceSchemaBlob = createObjectURLMock.mock.calls[6][0] as Blob;
    const governanceSchemaPayload = JSON.parse(await new Response(governanceSchemaBlob).text());
    expect(governanceSchemaPayload.governanceType).toBe('schema_metadata');
    expect(governanceSchemaPayload.schemaMetadata.activeVersion).toBe(1);
    expect(container.textContent).toContain('connector-governance-schema-contract exported.');

    await act(async () => {
      findButton(container, 'Copy Governance Report Commands').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(clipboardWriteTextMock).toHaveBeenCalledWith(
      'npm run verify:telemetry:traceability:cleanup:policy\nnpm run verify:smoke:traceability-governance-handoff'
    );
    expect(container.textContent).toContain('Governance weekly report commands copied.');

    await act(async () => {
      findButton(container, 'Copy Governance Handoff Commands').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(clipboardWriteTextMock).toHaveBeenCalledWith(
      'npm run verify:governance:weekly\nnpm run verify:smoke:governance-export-guard'
    );
    expect(container.textContent).toContain('Governance handoff commands copied.');

    await act(async () => {
      findButton(container, 'Copy Governance Schema Commands').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(clipboardWriteTextMock).toHaveBeenCalledWith(
      'npm run verify:governance:weekly:endpoint:contract\nnpm run verify:governance:schema:preflight'
    );
    expect(container.textContent).toContain('Governance schema contract commands copied.');

    await act(async () => {
      findButton(container, 'Export SLO JSON').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(createObjectURLMock).toHaveBeenCalledTimes(8);
    const sloBlob = createObjectURLMock.mock.calls[7][0] as Blob;
    const sloPayload = JSON.parse(await new Response(sloBlob).text());
    expect(sloPayload.gates.orchestrationAttemptErrorPassed).toBe(true);
    expect(sloPayload.gates.orchestrationAttemptSkippedPassed).toBe(true);
    expect(sloPayload.orchestrationAudit.maxAttemptErrorCountThreshold).toBe(5);
    expect(sloPayload.orchestrationAudit.observedAttemptErrorCount).toBe(1);
    expect(sloPayload.orchestrationAudit.maxAttemptSkippedCountThreshold).toBe(25);
    expect(sloPayload.orchestrationAudit.observedAttemptSkippedCount).toBe(1);
    expect(revokeObjectURLMock).toHaveBeenCalledTimes(8);
    expect(container.textContent).toContain('connector-slo-gates exported.');
    expect(container.textContent).toContain('Governance Handoff Posture');
    expect(container.textContent).toContain('Governance Schema Contract');
    expect(container.textContent).toContain('Active Version: 1');
    expect(container.textContent).toContain('Source: default');
    expect(container.textContent).toContain('Status: ACTION_REQUIRED');
    expect(container.textContent).toContain('Schema Version: 1');
    expect(container.textContent).toContain('Runtime Prereq Gate: PASS');
    expect(container.textContent).toContain('Runtime missing checks: 0');
    expect(container.textContent).toContain('Governance Artifact History');
    expect(container.textContent).toContain('History Schema Versions');
  });

  it('exports governance schema json from integrations governance schema card', async () => {
    setupQueryMocks({
      integrations: { data: { sendgrid_configured: false, apollo_enabled: true, clearbit_enabled: true, crunchbase_enabled: true } },
      googleStatus: { data: { connected: false } },
      'integrations-health': { data: { generatedAt: '2026-02-22T00:00:00Z', providers: [] } },
      'sales-campaign-portfolio': { data: { campaignCount: 0, activeCampaignCount: 0, portfolioTotals: { sent: 0, opened: 0, replied: 0 }, averageReplyRate: 0, rankedCampaigns: [] } },
      'sales-campaign-performance': { data: undefined },
      'integrations-telemetry-summary': { data: { generatedAt: '2026-02-22T00:00:00Z', windowDays: 7, eventCount: 0, errorEventCount: 0, byProvider: {}, trendByDay: [], salesIntelligence: { eventCount: 0, byEventFamily: {} } } },
      'integrations-slo-gates': { data: { generatedAt: '2026-02-22T00:00:00Z', windowDays: 7, decision: 'PROCEED', eventCount: 0, gates: { overallPassed: true, errorRatePassed: true, latencyPassed: true }, errorRate: { observedPct: 0, thresholdPct: 5, errorEvents: 0 }, providerLatency: {}, alerts: [], rolloutActions: [], signoff: { status: 'READY_FOR_APPROVAL', requiredApprovals: [], requiredEvidence: [] } } },
      'integrations-telemetry-governance': { data: { generatedAt: '2026-02-22T00:00:00Z', retentionDays: 30, status: 'READY', snapshot: { directory: '/tmp', prefix: 'connector-telemetry-summary', fileCount: 1, latestGeneratedAt: '2026-02-22T00:00:00Z', ageDays: 0, withinRetention: true, staleCount: 0 }, releaseGateFixtures: { allProfilesAvailable: true, missingProfiles: [] }, alerts: [], rolloutActions: [] } },
      'integrations-baseline-governance': { data: { generatedAt: '2026-02-22T00:00:00Z', artifactGeneratedAt: '2026-02-22T00:00:00Z', artifactPath: '/tmp/baseline_metrics.json', overallStatus: 'pass', status: 'PASS', releaseGateFixturePolicy: { passed: true, requiredProfiles: ['pass', 'hold', 'validation-fail'], missingProfiles: [], message: 'All required release-gate fixture profiles are present.' }, releaseGateFixtures: { allProfilesAvailable: true, availableProfileCount: 3, profileCount: 3 } } },
      'integrations-governance-report': { data: { generatedAt: '2026-02-22T00:00:00Z', windowDays: 7, eventLimit: 1000, totals: { governanceEventCount: 0, traceabilityEvaluationCount: 0, snapshotEvaluationCount: 0, baselineEvaluationCount: 0, actionRequiredCount: 0, rolloutBlockedCount: 0 }, governanceStatusCounts: {}, traceabilityDecisionCounts: {}, timeline: [], latestEvents: [], ownerActionMatrix: [], recommendedCommands: [] } },
      'integrations-governance-schema': {
        data: {
          governanceType: 'schema_metadata',
          status: 'READY',
          schemaMetadata: {
            activeVersion: 1,
            defaultVersion: 1,
            supportedVersions: [1],
            source: 'default',
            override: { isSet: false, isValid: true },
          },
          alerts: [],
          reasonCodes: ['schema_ready'],
          handoff: {
            rolloutBlocked: false,
            ownerRole: 'Release Manager',
            actions: ['Schema metadata is healthy. Continue schema and packet contract checks.'],
          },
          rolloutActions: [
            {
              priority: 'P3',
              severity: 'info',
              ownerRole: 'Release Manager',
              action: 'Schema metadata is healthy. Continue schema and packet contract checks.',
              trigger: 'governance_schema_ready',
              command: 'npm run verify:governance:schema:preflight',
              reasonCode: 'schema_ready',
            },
          ],
          recommendedCommands: ['npm run verify:governance:schema:preflight'],
          schemaContractParity: {
            reasonCodeCount: 1,
            recommendedCommandCount: 1,
            reasonCodeParity: {
              topLevelVsRolloutActions: true,
              topLevelVsExportActions: true,
              topLevelVsExportAlerts: true,
              topLevelVsExportReasonCodes: true,
            },
            recommendedCommandParity: {
              topLevelVsExport: true,
            },
            handoffParity: {
              rolloutBlockedMatchesExport: true,
              ownerRoleMatchesExport: true,
              handoffActionsMatchRolloutActions: true,
              handoffActionCount: 1,
              rolloutActionCount: 1,
            },
            computedAt: '2026-02-22T00:00:00+00:00',
          },
          governanceExport: {
            governanceType: 'schema_metadata',
            status: 'READY',
            rolloutBlocked: false,
            ownerRole: 'Release Manager',
            reasonCodes: ['schema_ready'],
            recommendedCommands: ['npm run verify:governance:schema:preflight'],
            actions: [
              {
                priority: 'P3',
                severity: 'info',
                ownerRole: 'Release Manager',
                action: 'Schema metadata is healthy. Continue schema and packet contract checks.',
                trigger: 'governance_schema_ready',
                command: 'npm run verify:governance:schema:preflight',
                reasonCode: 'schema_ready',
              },
            ],
            alerts: [
              {
                severity: 'info',
                ownerRole: 'Release Manager',
                message: 'Schema metadata is healthy. Continue schema and packet contract checks.',
                trigger: 'governance_schema_ready',
                command: 'npm run verify:governance:schema:preflight',
                reasonCode: 'schema_ready',
              },
            ],
          },
        },
      },
    });

    await act(async () => {
      root.render(<Integrations />);
    });

    await act(async () => {
      findButton(container, 'Export Governance Schema JSON').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const createObjectURLMock = URL.createObjectURL as jest.Mock;
    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    const blob = createObjectURLMock.mock.calls[0][0] as Blob;
    const payload = JSON.parse(await new Response(blob).text());
    expect(payload.governanceType).toBe('schema_metadata');
    expect(payload.schemaMetadata.activeVersion).toBe(1);
    expect(payload.schemaContractParity.reasonCodeCount).toBe(1);
    expect(payload.schemaContractParity.recommendedCommandCount).toBe(1);
    expect(payload.schemaContractParity.reasonCodeParity.topLevelVsRolloutActions).toBe(true);
    expect(payload.schemaContractParity.reasonCodeParity.topLevelVsExportActions).toBe(true);
    expect(payload.schemaContractParity.reasonCodeParity.topLevelVsExportAlerts).toBe(true);
    expect(payload.schemaContractParity.reasonCodeParity.topLevelVsExportReasonCodes).toBe(true);
    expect(payload.schemaContractParity.recommendedCommandParity.topLevelVsExport).toBe(true);
    expect(payload.schemaContractParity.handoffParity.rolloutBlockedMatchesExport).toBe(true);
    expect(payload.schemaContractParity.handoffParity.ownerRoleMatchesExport).toBe(true);
    expect(payload.schemaContractParity.handoffParity.handoffActionsMatchRolloutActions).toBe(true);
    expect(typeof payload.schemaContractParity.computedAt).toBe('string');
    const parityCard = container.querySelector(
      '[data-testid="integrations-governance-schema-parity-posture"]'
    );
    expect(parityCard?.textContent).toContain('Schema Parity Status: PASS');
    expect(container.textContent).toContain('connector-governance-schema-contract exported.');
  });

  it('shows governance schema parity warning when schema contract checks drift', async () => {
    setupQueryMocks({
      integrations: { data: { sendgrid_configured: false, apollo_enabled: true, clearbit_enabled: true, crunchbase_enabled: true } },
      googleStatus: { data: { connected: false } },
      'integrations-health': { data: { generatedAt: '2026-02-22T00:00:00Z', providers: [] } },
      'sales-campaign-portfolio': { data: { campaignCount: 0, activeCampaignCount: 0, portfolioTotals: { sent: 0, opened: 0, replied: 0 }, averageReplyRate: 0, rankedCampaigns: [] } },
      'sales-campaign-performance': { data: undefined },
      'integrations-telemetry-summary': { data: { generatedAt: '2026-02-22T00:00:00Z', windowDays: 7, eventCount: 0, errorEventCount: 0, byProvider: {}, trendByDay: [], salesIntelligence: { eventCount: 0, byEventFamily: {} } } },
      'integrations-slo-gates': { data: { generatedAt: '2026-02-22T00:00:00Z', windowDays: 7, decision: 'PROCEED', eventCount: 0, gates: { overallPassed: true, errorRatePassed: true, latencyPassed: true }, errorRate: { observedPct: 0, thresholdPct: 5, errorEvents: 0 }, providerLatency: {}, alerts: [], rolloutActions: [], signoff: { status: 'READY_FOR_APPROVAL', requiredApprovals: [], requiredEvidence: [] } } },
      'integrations-telemetry-governance': { data: { generatedAt: '2026-02-22T00:00:00Z', retentionDays: 30, status: 'READY', snapshot: { directory: '/tmp', prefix: 'connector-telemetry-summary', fileCount: 1, latestGeneratedAt: '2026-02-22T00:00:00Z', ageDays: 0, withinRetention: true, staleCount: 0 }, releaseGateFixtures: { allProfilesAvailable: true, missingProfiles: [] }, alerts: [], rolloutActions: [] } },
      'integrations-baseline-governance': { data: { generatedAt: '2026-02-22T00:00:00Z', artifactGeneratedAt: '2026-02-22T00:00:00Z', artifactPath: '/tmp/baseline_metrics.json', overallStatus: 'pass', status: 'PASS', releaseGateFixturePolicy: { passed: true, requiredProfiles: ['pass', 'hold', 'validation-fail'], missingProfiles: [], message: 'All required release-gate fixture profiles are present.' }, releaseGateFixtures: { allProfilesAvailable: true, availableProfileCount: 3, profileCount: 3 } } },
      'integrations-governance-report': { data: { generatedAt: '2026-02-22T00:00:00Z', windowDays: 7, eventLimit: 1000, totals: { governanceEventCount: 0, traceabilityEvaluationCount: 0, snapshotEvaluationCount: 0, baselineEvaluationCount: 0, actionRequiredCount: 0, rolloutBlockedCount: 0 }, governanceStatusCounts: {}, traceabilityDecisionCounts: {}, timeline: [], latestEvents: [], ownerActionMatrix: [], recommendedCommands: [] } },
      'integrations-governance-report-export': { data: { governanceType: 'weekly_report', status: 'ACTION_REQUIRED', governanceExport: { status: 'ACTION_REQUIRED', rolloutBlocked: true, ownerRole: 'Release Manager', alerts: [], actions: [], evaluatedAt: '2026-02-22T00:00:00+00:00', requestedBy: 'u1' } } },
      'integrations-governance-report-history': { data: { governanceType: 'weekly_report_history', generatedAt: '2026-02-22T00:00:00+00:00', retentionDays: 30, artifactCount: 0, staleCount: 0, rolloutBlockedCount: 0, items: [], recommendedCommands: [] } },
      'integrations-governance-schema': {
        data: {
          governanceType: 'schema_metadata',
          status: 'ACTION_REQUIRED',
          schemaMetadata: {
            activeVersion: 1,
            defaultVersion: 1,
            supportedVersions: [1],
            source: 'env_invalid_fallback',
            override: { isSet: true, isValid: false },
          },
          alerts: ['GOVERNANCE_EXPORT_SCHEMA_VERSION is invalid and default fallback is active.'],
          reasonCodes: ['schema_override_invalid'],
          handoff: {
            rolloutBlocked: true,
            ownerRole: 'Release Manager',
            actions: ['Correct override and rerun extended verification.'],
          },
          rolloutActions: [
            {
              priority: 'P1',
              severity: 'high',
              ownerRole: 'Release Manager',
              action: 'Correct override and rerun extended verification.',
              trigger: 'governance_schema_invalid_override',
              command: 'npm run verify:ci:sales:extended',
              reasonCode: 'schema_override_invalid',
            },
          ],
          recommendedCommands: ['npm run verify:ci:sales:extended'],
          schemaContractParity: {
            reasonCodeCount: 1,
            recommendedCommandCount: 1,
            reasonCodeParity: {
              topLevelVsRolloutActions: true,
              topLevelVsExportActions: false,
              topLevelVsExportAlerts: true,
              topLevelVsExportReasonCodes: true,
            },
            recommendedCommandParity: {
              topLevelVsExport: false,
            },
            handoffParity: {
              rolloutBlockedMatchesExport: true,
              ownerRoleMatchesExport: false,
              handoffActionsMatchRolloutActions: true,
              handoffActionCount: 1,
              rolloutActionCount: 1,
            },
            computedAt: '2026-02-22T00:00:00+00:00',
          },
          governanceExport: {
            governanceType: 'schema_metadata',
            status: 'ACTION_REQUIRED',
            rolloutBlocked: true,
            ownerRole: 'QA Engineer',
            reasonCodes: ['schema_override_invalid'],
            recommendedCommands: ['npm run verify:ci:sales:extended'],
            actions: [],
            alerts: [],
          },
        },
      },
    });

    await act(async () => {
      root.render(<Integrations />);
    });

    const parityCard = container.querySelector(
      '[data-testid="integrations-governance-schema-parity-posture"]'
    );
    const parityWarning = container.querySelector(
      '[data-testid="integrations-governance-schema-parity-warning"]'
    );
    expect(parityCard?.textContent).toContain('Schema Parity Status: FAIL');
    expect(parityWarning?.textContent).toContain(
      'reason codes (top-level vs export actions)'
    );
    expect(parityWarning?.textContent).toContain(
      'recommended commands (top-level vs export)'
    );
  });

  it('shows governance schema audit telemetry posture in integrations telemetry panels', async () => {
    setupQueryMocks({
      integrations: { data: { sendgrid_configured: true, apollo_enabled: true, clearbit_enabled: true, crunchbase_enabled: true } },
      googleStatus: { data: { connected: false } },
      'integrations-health': {
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
          status: 'ACTION_REQUIRED',
          healthyCount: 1,
          unhealthyCount: 1,
          credentialActionRequiredProviders: ['clearbit'],
          credentialFreshnessStatusCounts: {
            READY: 2,
          },
          credentialFreshnessByProvider: {
            clearbit: {
              status: 'ACTION_REQUIRED',
              configuredAgeDays: 120,
              rotationAgeDays: 101,
              staleReasons: ['rotation_age_exceeded'],
            },
          },
          credentialFreshnessTotalProviders: 1,
          credentialFreshnessActionRequiredCount: 1,
          credentialFreshnessWithinPolicyCount: 0,
          credentialFreshnessUnknownCount: 0,
          providers: [
            {
              provider: 'clearbit',
              healthy: false,
              statusCode: 429,
              latencyMs: 17,
              error: 'Rate limited',
              configuredAt: '2025-10-01T00:00:00Z',
              lastRotatedAt: '2025-09-01T00:00:00Z',
              credentialConfiguredAgeDays: 120,
              credentialRotationAgeDays: 101,
              credentialStale: true,
              credentialStaleReasons: ['rotation_age_exceeded'],
            },
          ],
        },
      },
      'sales-campaign-portfolio': { data: { campaignCount: 0, activeCampaignCount: 0, portfolioTotals: { sent: 0, opened: 0, replied: 0 }, averageReplyRate: 0, rankedCampaigns: [] } },
      'sales-campaign-performance': { data: undefined },
      'integrations-telemetry-summary': {
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
          windowDays: 7,
          eventCount: 2,
          errorEventCount: 0,
          byProvider: { integrations: 2 },
          trendByDay: [],
          salesIntelligence: { eventCount: 0, byEventFamily: {} },
          governanceSchemaAudit: {
            eventCount: 2,
            statusCounts: { ACTION_REQUIRED: 1, READY: 1 },
            reasonCodeParityPassCount: 1,
            reasonCodeParityFailCount: 1,
            recommendedCommandParityPassCount: 1,
            recommendedCommandParityFailCount: 1,
            handoffParityPassCount: 1,
            handoffParityFailCount: 1,
            allParityPassedCount: 1,
            allParityFailedCount: 1,
            rolloutBlockedCount: 1,
            latestEvaluatedAt: '2026-02-22T00:00:00Z',
          },
          recentEventsTotalCount: 1,
          recentEventsFilteredCount: 1,
          recentEventsPacketValidationCount: 0,
          recentEventsNonPacketCount: 1,
          recentEvents: [
            {
              provider: 'integrations',
              eventType: 'integrations_traceability_governance_schema_viewed',
              requestId: 'req-schema-audit-ui-1',
              schemaVersion: 'unknown',
              governanceStatus: 'ACTION_REQUIRED',
              governanceSchemaReasonCodeParityOk: false,
              governanceSchemaRecommendedCommandParityOk: false,
              governanceSchemaHandoffParityOk: true,
              governanceSchemaAllParityOk: false,
              governanceSchemaRolloutBlocked: true,
              governanceSchemaReasonCodeCount: 2,
              governanceSchemaRecommendedCommandCount: 1,
            },
          ],
        },
      },
      'integrations-slo-gates': { data: { generatedAt: '2026-02-22T00:00:00Z', windowDays: 7, decision: 'PROCEED', eventCount: 2, gates: { overallPassed: true, errorRatePassed: true, latencyPassed: true }, errorRate: { observedPct: 0, thresholdPct: 5, errorEvents: 0 }, providerLatency: {}, alerts: [], rolloutActions: [], signoff: { status: 'READY_FOR_APPROVAL', requiredApprovals: [], requiredEvidence: [] } } },
      'integrations-telemetry-governance': { data: { generatedAt: '2026-02-22T00:00:00Z', retentionDays: 30, status: 'READY', snapshot: { directory: '/tmp', prefix: 'connector-telemetry-summary', fileCount: 1, latestGeneratedAt: '2026-02-22T00:00:00Z', ageDays: 0, withinRetention: true, staleCount: 0 }, releaseGateFixtures: { allProfilesAvailable: true, missingProfiles: [] }, alerts: [], rolloutActions: [] } },
      'integrations-baseline-governance': { data: { generatedAt: '2026-02-22T00:00:00Z', artifactGeneratedAt: '2026-02-22T00:00:00Z', artifactPath: '/tmp/baseline_metrics.json', overallStatus: 'pass', status: 'PASS', releaseGateFixturePolicy: { passed: true, requiredProfiles: ['pass', 'hold', 'validation-fail'], missingProfiles: [], message: 'All required release-gate fixture profiles are present.' }, releaseGateFixtures: { allProfilesAvailable: true, availableProfileCount: 3, profileCount: 3 } } },
      'integrations-governance-report': { data: { generatedAt: '2026-02-22T00:00:00Z', windowDays: 7, eventLimit: 1000, totals: { governanceEventCount: 0, traceabilityEvaluationCount: 0, snapshotEvaluationCount: 0, baselineEvaluationCount: 0, actionRequiredCount: 0, rolloutBlockedCount: 0 }, governanceStatusCounts: {}, traceabilityDecisionCounts: {}, timeline: [], latestEvents: [], ownerActionMatrix: [], recommendedCommands: [] } },
      'integrations-governance-report-export': { data: { governanceType: 'weekly_report', status: 'READY', governanceExport: { status: 'READY', rolloutBlocked: false, ownerRole: 'Release Manager', alerts: [], actions: [], evaluatedAt: '2026-02-22T00:00:00+00:00', requestedBy: 'u1' } } },
      'integrations-governance-report-history': { data: { governanceType: 'weekly_report_history', generatedAt: '2026-02-22T00:00:00+00:00', retentionDays: 30, artifactCount: 0, staleCount: 0, rolloutBlockedCount: 0, items: [], recommendedCommands: [] } },
      'integrations-governance-schema': { data: { governanceType: 'schema_metadata', status: 'READY', schemaMetadata: { activeVersion: 1, defaultVersion: 1, supportedVersions: [1], source: 'default', override: { isSet: false, isValid: true } }, alerts: [], recommendedCommands: ['npm run verify:governance:schema:preflight'] } },
    });

    await act(async () => {
      root.render(<Integrations />);
    });

    expect(container.textContent).toContain('Governance Schema Audits');
    expect(container.textContent).toContain('Governance Schema Audit Status');
    expect(container.textContent).toContain('Parity posture: FAIL');
    expect(container.textContent).toContain('schema parity FAIL rollout-blocked reason-codes 2 commands 1');
  });

  it('copies baseline remediation commands in orchestration-first order when baseline governance is degraded', async () => {
    const clipboardWriteTextMock = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: clipboardWriteTextMock },
    });

    setupQueryMocks({
      integrations: { data: { sendgrid_configured: false, apollo_enabled: true, clearbit_enabled: true, crunchbase_enabled: true } },
      googleStatus: { data: { connected: false } },
      'integrations-health': { data: { generatedAt: '2026-02-22T00:00:00Z', providers: [] } },
      'sales-campaign-portfolio': { data: { campaignCount: 0, activeCampaignCount: 0, portfolioTotals: { sent: 0, opened: 0, replied: 0 }, averageReplyRate: 0, rankedCampaigns: [] } },
      'sales-campaign-performance': { data: undefined },
      'integrations-telemetry-summary': {
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
          windowDays: 7,
          eventCount: 2,
          errorEventCount: 0,
          byProvider: { integrations: 2 },
          trendByDay: [],
          salesIntelligence: { eventCount: 0, byEventFamily: {} },
        },
      },
      'integrations-slo-gates': {
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
          windowDays: 7,
          decision: 'HOLD',
          eventCount: 2,
          gates: {
            overallPassed: false,
            errorRatePassed: true,
            latencyPassed: true,
            orchestrationAttemptErrorPassed: false,
            orchestrationAttemptSkippedPassed: true,
          },
          errorRate: { observedPct: 0, thresholdPct: 5, errorEvents: 0 },
          providerLatency: {},
          alerts: ['Orchestration gate failed'],
          rolloutActions: [],
          signoff: { status: 'NOT_READY', requiredApprovals: [], requiredEvidence: [] },
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
            fileCount: 1,
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
          governanceType: 'baseline',
          artifactGeneratedAt: '2026-02-22T00:00:00Z',
          artifactPath: '/tmp/baseline_metrics.json',
          overallStatus: 'fail',
          status: 'FAIL',
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
          orchestrationGate: {
            available: true,
            decision: 'HOLD',
            attemptErrorGatePassed: false,
            attemptSkippedGatePassed: true,
            maxAttemptErrorCountThreshold: 5,
            observedAttemptErrorCount: 9,
            maxAttemptSkippedCountThreshold: 25,
            observedAttemptSkippedCount: 1,
          },
          recommendedCommands: [
            'npm run verify:smoke:baseline-orchestration-remediation',
            'npm run verify:ci:sales:extended',
          ],
          rolloutActions: [
            {
              priority: 'P1',
              severity: 'high',
              ownerRole: 'Integrations Engineer',
              action: 'Re-run orchestration smoke checks.',
              trigger: 'baseline_orchestration_attempt_error_failed',
              command: 'npm run verify:smoke:orchestration-slo-gate',
            },
            {
              priority: 'P1',
              severity: 'high',
              ownerRole: 'Release Manager',
              action: 'Re-run baseline governance drift smoke.',
              trigger: 'baseline_policy_failed',
              command: 'npm run verify:smoke:baseline-governance-drift',
            },
            {
              priority: 'P2',
              severity: 'medium',
              ownerRole: 'Release Manager',
              action: 'Re-run extended signoff gate.',
              trigger: 'baseline_revalidation',
              command: 'npm run verify:ci:sales:extended',
            },
          ],
          commandAliases: {
            present: true,
            available: true,
            source: 'artifact_file',
            gatePassed: false,
            contractValid: true,
            valid: false,
            missingAliasCount: 1,
            mismatchedAliasCount: 1,
            missingAliases: ['verify:smoke:sales'],
            mismatchedAliases: ['typecheck'],
            validatedAt: '2026-02-22T00:00:00Z',
            command: 'verify_sales_baseline_command_aliases',
            artifactPath: '/tmp/sales_baseline_command_aliases.json',
          },
        },
      },
      'integrations-governance-report': {
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
          windowDays: 7,
          eventLimit: 500,
          totals: {
            governanceEventCount: 1,
            traceabilityEvaluationCount: 1,
            snapshotEvaluationCount: 0,
            baselineEvaluationCount: 1,
            actionRequiredCount: 1,
            rolloutBlockedCount: 1,
          },
          governanceStatusCounts: { ACTION_REQUIRED: 1 },
          traceabilityDecisionCounts: { HOLD: 1 },
          timeline: [],
          latestEvents: [],
          ownerActionMatrix: [],
          recommendedCommands: [],
        },
      },
    });

    await act(async () => {
      root.render(<Integrations />);
    });

    expect(container.textContent).toContain('Command alias gate: fail');
    expect(container.textContent).toContain('Command alias drift (missing/mismatched): 1/1');
    expect(container.textContent).toContain('Command alias missing mappings: verify:smoke:sales');
    expect(container.textContent).toContain('Command alias mismatched mappings: typecheck');

    await act(async () => {
      findButton(container, 'Copy Baseline Commands').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(clipboardWriteTextMock).toHaveBeenCalledWith(
      'npm run verify:smoke:baseline-orchestration-remediation\nnpm run verify:baseline:command-aliases:artifact\nnpm run verify:baseline:command-aliases:artifact:contract\nnpm run verify:smoke:baseline-command-aliases-artifact\nnpm run verify:ci:sales:extended'
    );
    expect(container.textContent).toContain('Baseline governance remediation commands copied.');
  });

  it('collapses legacy orchestration commands when backend baseline recommendations already include wrapper command', async () => {
    const clipboardWriteTextMock = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: clipboardWriteTextMock },
    });

    setupQueryMocks({
      integrations: { data: { sendgrid_configured: false, apollo_enabled: true, clearbit_enabled: true, crunchbase_enabled: true } },
      googleStatus: { data: { connected: false } },
      'integrations-health': { data: { generatedAt: '2026-02-22T00:00:00Z', providers: [] } },
      'sales-campaign-portfolio': { data: { campaignCount: 0, activeCampaignCount: 0, portfolioTotals: { sent: 0, opened: 0, replied: 0 }, averageReplyRate: 0, rankedCampaigns: [] } },
      'sales-campaign-performance': { data: undefined },
      'integrations-telemetry-summary': { data: { generatedAt: '2026-02-22T00:00:00Z', windowDays: 7, eventCount: 0, errorEventCount: 0, byProvider: { integrations: 0 }, trendByDay: [], salesIntelligence: { eventCount: 0, byEventFamily: {} } } },
      'integrations-slo-gates': { data: { generatedAt: '2026-02-22T00:00:00Z', windowDays: 7, decision: 'HOLD', eventCount: 0, gates: { overallPassed: false, errorRatePassed: true, latencyPassed: true, orchestrationAttemptErrorPassed: false, orchestrationAttemptSkippedPassed: true }, errorRate: { observedPct: 0, thresholdPct: 5, errorEvents: 0 }, providerLatency: {}, alerts: [], rolloutActions: [], signoff: { status: 'NOT_READY', requiredApprovals: [], requiredEvidence: [] } } },
      'integrations-telemetry-governance': { data: { generatedAt: '2026-02-22T00:00:00Z', retentionDays: 30, status: 'READY', snapshot: { directory: '/tmp', prefix: 'connector-telemetry-summary', fileCount: 1, latestGeneratedAt: '2026-02-22T00:00:00Z', ageDays: 0, withinRetention: true, staleCount: 0 }, releaseGateFixtures: { allProfilesAvailable: true, missingProfiles: [] }, alerts: [] } },
      'integrations-baseline-governance': {
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
          governanceType: 'baseline',
          artifactGeneratedAt: '2026-02-22T00:00:00Z',
          artifactPath: '/tmp/baseline_metrics.json',
          overallStatus: 'fail',
          status: 'FAIL',
          releaseGateFixturePolicy: { passed: true, requiredProfiles: ['pass', 'hold', 'validation-fail'], missingProfiles: [], message: 'All required release-gate fixture profiles are present.' },
          releaseGateFixtures: { allProfilesAvailable: true, availableProfileCount: 3, profileCount: 3 },
          orchestrationGate: {
            available: true,
            decision: 'HOLD',
            attemptErrorGatePassed: false,
            attemptSkippedGatePassed: true,
            maxAttemptErrorCountThreshold: 5,
            observedAttemptErrorCount: 9,
            maxAttemptSkippedCountThreshold: 25,
            observedAttemptSkippedCount: 1,
          },
          recommendedCommands: [
            'npm run verify:smoke:baseline-orchestration-remediation',
            'npm run verify:smoke:orchestration-slo-gate',
            'npm run verify:baseline:metrics',
            'npm run verify:smoke:baseline-governance-drift',
            'npm run verify:ci:sales:extended',
          ],
          rolloutActions: [
            { priority: 'P1', severity: 'high', ownerRole: 'Integrations Engineer', action: 'Orchestration remediation', trigger: 'baseline_orchestration_attempt_error_failed', command: 'npm run verify:smoke:orchestration-slo-gate' },
            { priority: 'P2', severity: 'medium', ownerRole: 'Release Manager', action: 'Proceed with CI', trigger: 'baseline_revalidation', command: 'npm run verify:ci:sales:extended' },
          ],
        },
      },
      'integrations-governance-report': { data: { generatedAt: '2026-02-22T00:00:00Z', windowDays: 7, eventLimit: 500, totals: { governanceEventCount: 1, traceabilityEvaluationCount: 1, snapshotEvaluationCount: 0, baselineEvaluationCount: 1, actionRequiredCount: 1, rolloutBlockedCount: 1 }, governanceStatusCounts: { ACTION_REQUIRED: 1 }, traceabilityDecisionCounts: { HOLD: 1 }, timeline: [], latestEvents: [], ownerActionMatrix: [], recommendedCommands: [] } },
    });

    await act(async () => {
      root.render(<Integrations />);
    });

    expect(
      container.querySelector('[data-testid="integrations-baseline-governance-command-fallback-warning"]')
    ).toBeFalsy();

    await act(async () => {
      findButton(container, 'Copy Baseline Commands').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(clipboardWriteTextMock).toHaveBeenCalledWith(
      'npm run verify:smoke:baseline-orchestration-remediation\nnpm run verify:baseline:command-aliases:artifact\nnpm run verify:baseline:command-aliases:artifact:contract\nnpm run verify:smoke:baseline-command-aliases-artifact\nnpm run verify:ci:sales:extended'
    );
  });

  it('downloads baseline remediation commands when clipboard is unavailable and baseline orchestration is degraded', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    });

    setupQueryMocks({
      integrations: { data: { sendgrid_configured: false, apollo_enabled: true, clearbit_enabled: true, crunchbase_enabled: true } },
      googleStatus: { data: { connected: false } },
      'integrations-health': { data: { generatedAt: '2026-02-22T00:00:00Z', providers: [] } },
      'sales-campaign-portfolio': { data: { campaignCount: 0, activeCampaignCount: 0, portfolioTotals: { sent: 0, opened: 0, replied: 0 }, averageReplyRate: 0, rankedCampaigns: [] } },
      'sales-campaign-performance': { data: undefined },
      'integrations-telemetry-summary': {
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
          windowDays: 7,
          eventCount: 2,
          errorEventCount: 0,
          byProvider: { integrations: 2 },
          trendByDay: [],
          salesIntelligence: { eventCount: 0, byEventFamily: {} },
        },
      },
      'integrations-slo-gates': {
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
          windowDays: 7,
          decision: 'HOLD',
          eventCount: 2,
          gates: {
            overallPassed: false,
            errorRatePassed: true,
            latencyPassed: true,
            orchestrationAttemptErrorPassed: false,
            orchestrationAttemptSkippedPassed: true,
          },
          errorRate: { observedPct: 0, thresholdPct: 5, errorEvents: 0 },
          providerLatency: {},
          alerts: ['Orchestration gate failed'],
          rolloutActions: [],
          signoff: { status: 'NOT_READY', requiredApprovals: [], requiredEvidence: [] },
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
            fileCount: 1,
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
          governanceType: 'baseline',
          artifactGeneratedAt: '2026-02-22T00:00:00Z',
          artifactPath: '/tmp/baseline_metrics.json',
          overallStatus: 'fail',
          status: 'FAIL',
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
          orchestrationGate: {
            available: true,
            decision: 'HOLD',
            attemptErrorGatePassed: false,
            attemptSkippedGatePassed: true,
            maxAttemptErrorCountThreshold: 5,
            observedAttemptErrorCount: 9,
            maxAttemptSkippedCountThreshold: 25,
            observedAttemptSkippedCount: 1,
          },
          rolloutActions: [
            {
              priority: 'P1',
              severity: 'high',
              ownerRole: 'Integrations Engineer',
              action: 'Re-run orchestration smoke checks.',
              trigger: 'baseline_orchestration_attempt_error_failed',
              command: 'npm run verify:smoke:orchestration-slo-gate',
            },
            {
              priority: 'P1',
              severity: 'high',
              ownerRole: 'Release Manager',
              action: 'Re-run baseline metrics collection.',
              trigger: 'baseline_policy_failed',
              command: 'npm run verify:baseline:metrics',
            },
            {
              priority: 'P1',
              severity: 'high',
              ownerRole: 'Release Manager',
              action: 'Re-run baseline governance drift smoke.',
              trigger: 'baseline_policy_drift',
              command: 'npm run verify:smoke:baseline-governance-drift',
            },
          ],
        },
      },
      'integrations-governance-report': {
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
          windowDays: 7,
          eventLimit: 500,
          totals: {
            governanceEventCount: 1,
            traceabilityEvaluationCount: 1,
            snapshotEvaluationCount: 0,
            baselineEvaluationCount: 1,
            actionRequiredCount: 1,
            rolloutBlockedCount: 1,
          },
          governanceStatusCounts: { ACTION_REQUIRED: 1 },
          traceabilityDecisionCounts: { HOLD: 1 },
          timeline: [],
          latestEvents: [],
          ownerActionMatrix: [],
          recommendedCommands: [],
        },
      },
    });

    await act(async () => {
      root.render(<Integrations />);
    });

    expect(
      container.querySelector('[data-testid="integrations-baseline-governance-command-fallback-warning"]')
    ).toBeTruthy();

    await act(async () => {
      findButton(container, 'Copy Baseline Commands').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const createObjectURLMock = URL.createObjectURL as jest.Mock;
    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    const downloadedBlob = createObjectURLMock.mock.calls[0][0] as Blob;
    const downloadedText = await new Response(downloadedBlob).text();
    expect(downloadedText).toBe(
      'npm run verify:smoke:baseline-orchestration-remediation\nnpm run verify:baseline:command-aliases:artifact\nnpm run verify:baseline:command-aliases:artifact:contract\nnpm run verify:smoke:baseline-command-aliases-artifact'
    );
    expect(container.textContent).toContain('Clipboard unavailable. Baseline governance remediation commands downloaded.');
  });

  it('shows governance parity warning when connector pressure parity flags drift', async () => {
    setupQueryMocks({
      integrations: { data: { sendgrid_configured: false, apollo_enabled: true, clearbit_enabled: true, crunchbase_enabled: true } },
      googleStatus: { data: { connected: false } },
      'integrations-health': { data: { generatedAt: '2026-02-22T00:00:00Z', providers: [] } },
      'sales-campaign-portfolio': { data: { campaignCount: 0, activeCampaignCount: 0, portfolioTotals: { sent: 0, opened: 0, replied: 0 }, averageReplyRate: 0, rankedCampaigns: [] } },
      'sales-campaign-performance': { data: undefined },
      'integrations-telemetry-summary': { data: { generatedAt: '2026-02-22T00:00:00Z', windowDays: 7, eventCount: 0, errorEventCount: 0, byProvider: {}, trendByDay: [], salesIntelligence: { eventCount: 0, byEventFamily: {} } } },
      'integrations-slo-gates': { data: { generatedAt: '2026-02-22T00:00:00Z', windowDays: 7, decision: 'PROCEED', eventCount: 0, gates: { overallPassed: true, errorRatePassed: true, latencyPassed: true }, errorRate: { observedPct: 0, thresholdPct: 5, errorEvents: 0 }, providerLatency: {}, alerts: [], rolloutActions: [], signoff: { status: 'READY_FOR_APPROVAL', requiredApprovals: [], requiredEvidence: [] } } },
      'integrations-telemetry-governance': { data: { generatedAt: '2026-02-22T00:00:00Z', retentionDays: 30, status: 'READY', snapshot: { directory: '/tmp', prefix: 'connector-telemetry-summary', fileCount: 1, latestGeneratedAt: '2026-02-22T00:00:00Z', ageDays: 0, withinRetention: true, staleCount: 0 }, releaseGateFixtures: { allProfilesAvailable: true, missingProfiles: [] }, alerts: [], rolloutActions: [] } },
      'integrations-baseline-governance': { data: { generatedAt: '2026-02-22T00:00:00Z', artifactGeneratedAt: '2026-02-22T00:00:00Z', artifactPath: '/tmp/baseline_metrics.json', overallStatus: 'pass', status: 'PASS', releaseGateFixturePolicy: { passed: true, requiredProfiles: ['pass', 'hold', 'validation-fail'], missingProfiles: [], message: 'All required release-gate fixture profiles are present.' }, releaseGateFixtures: { allProfilesAvailable: true, availableProfileCount: 3, profileCount: 3 } } },
      'integrations-governance-report': {
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
          windowDays: 7,
          eventLimit: 500,
          status: 'ACTION_REQUIRED',
          totals: { governanceEventCount: 1, traceabilityEvaluationCount: 1, actionRequiredCount: 1, connectorRateLimitEventCount: 2, rolloutBlockedCount: 1 },
          handoff: { rolloutBlocked: true, ownerRole: 'Release Manager' },
          governanceStatusCounts: { ACTION_REQUIRED: 1 },
          traceabilityDecisionCounts: { HOLD: 1 },
          timeline: [],
          latestEvents: [],
          ownerActionMatrix: [],
          recommendedCommands: [],
        },
      },
      'integrations-governance-report-export': {
        data: {
          governanceType: 'weekly_report',
          status: 'ACTION_REQUIRED',
          exportSchemaVersion: 1,
          totals: { connectorRateLimitEventCount: 2 },
          connectorRateLimit: {
            eventCount: 2,
            byEndpoint: { apollo_search: 2 },
            pressure: { label: 'High' },
          },
          connectorPressureParity: {
            eventCountMatchesNested: true,
            eventCountMatchesTotals: true,
            byEndpointMatchesNested: false,
            pressureLabelMatchesNested: true,
          },
          sendgridWebhookTimestampParity: {
            eventCountMatchesNested: false,
            eventCountMatchesTotals: true,
            anomalyCountTotalMatchesNested: false,
            pressureLabelCountsMatchNested: false,
          },
          governanceExport: {
            status: 'ACTION_REQUIRED',
            exportSchemaVersion: 1,
            rolloutBlocked: true,
            ownerRole: 'Release Manager',
            alerts: [],
            actions: [],
            connectorRateLimit: {
              eventCount: 2,
              byEndpoint: { apollo_search: 1, clearbit_lookup: 1 },
              pressure: { label: 'High' },
            },
          },
        },
      },
      'integrations-governance-report-history': { data: { governanceType: 'weekly_report_history', status: 'ACTION_REQUIRED', generatedAt: '2026-02-22T00:00:00Z', retentionDays: 30, artifactCount: 1, staleCount: 0, rolloutBlockedCount: 1, items: [], recommendedCommands: [] } },
      'integrations-governance-schema': {
        data: {
          governanceType: 'schema_metadata',
          status: 'READY',
          schemaMetadata: {
            activeVersion: 1,
            defaultVersion: 1,
            supportedVersions: [1],
            source: 'default',
            override: { isSet: false, isValid: true },
          },
          alerts: [],
          recommendedCommands: ['npm run verify:governance:schema:preflight'],
        },
      },
    });

    await act(async () => {
      root.render(<Integrations />);
    });

    const warning = container.querySelector('[data-testid="integrations-governance-parity-warning"]');
    expect(warning).toBeTruthy();
    expect(warning?.textContent).toContain('connector by-endpoint distribution mismatch');
    expect(warning?.textContent).toContain('sendgrid timestamp event-count mismatch');
  });

  it('falls back to downloading governance commands when clipboard API is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    });

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
          byProvider: { integrations: 2 },
          trendByDay: [],
          salesIntelligence: { eventCount: 0, byEventFamily: {} },
          traceabilityAudit: { eventCount: 1, decisionCounts: { HOLD: 1 }, readyCount: 0, notReadyCount: 1 },
          governanceAudit: { eventCount: 1, snapshotEvaluationCount: 1, baselineEvaluationCount: 0, statusCounts: { ACTION_REQUIRED: 1 } },
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
      'integrations-telemetry-governance': {
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
          retentionDays: 30,
          status: 'ACTION_REQUIRED',
          snapshot: {
            directory: '/tmp',
            prefix: 'connector-telemetry-summary',
            fileCount: 1,
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
          rolloutActions: [
            {
              priority: 'P1',
              severity: 'high',
              ownerRole: 'Release Manager',
              action: 'Run cleanup policy.',
              trigger: 'snapshot_stale',
              command: 'npm run verify:telemetry:traceability:cleanup:policy',
            },
          ],
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
      'integrations-governance-report': {
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
          windowDays: 7,
          eventLimit: 1000,
          totals: {
            governanceEventCount: 1,
            traceabilityEvaluationCount: 1,
            snapshotEvaluationCount: 1,
            baselineEvaluationCount: 0,
            actionRequiredCount: 1,
            rolloutBlockedCount: 2,
          },
          governanceStatusCounts: { ACTION_REQUIRED: 1 },
          traceabilityDecisionCounts: { HOLD: 1 },
          timeline: [],
          latestEvents: [],
          ownerActionMatrix: [],
          recommendedCommands: ['npm run verify:telemetry:traceability:cleanup:policy'],
        },
      },
      'integrations-governance-schema': {
        data: {
          governanceType: 'schema_metadata',
          status: 'READY',
          schemaMetadata: {
            activeVersion: 1,
            defaultVersion: 1,
            supportedVersions: [1],
            source: 'default',
            override: {
              isSet: false,
              isValid: true,
            },
          },
          alerts: [],
          recommendedCommands: ['npm run verify:governance:schema:preflight'],
        },
      },
    });

    await act(async () => {
      root.render(<Integrations />);
    });

    const createObjectURLMock = URL.createObjectURL as jest.Mock;
    await act(async () => {
      findButton(container, 'Copy Governance Report Commands').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    const downloadedBlob = createObjectURLMock.mock.calls[0][0] as Blob;
    const downloadedText = await new Response(downloadedBlob).text();
    expect(downloadedText).toBe('npm run verify:telemetry:traceability:cleanup:policy');
    expect(container.textContent).toContain('Clipboard unavailable. Governance weekly report commands downloaded.');

    await act(async () => {
      findButton(container, 'Copy Governance Schema Commands').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(createObjectURLMock).toHaveBeenCalledTimes(2);
    const schemaDownloadedBlob = createObjectURLMock.mock.calls[1][0] as Blob;
    const schemaDownloadedText = await new Response(schemaDownloadedBlob).text();
    expect(schemaDownloadedText).toBe('npm run verify:governance:schema:preflight');
    expect(container.textContent).toContain('Clipboard unavailable. Governance schema contract commands downloaded.');
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
    expect(sloCalls.length).toBeGreaterThan(0);
    const latestSloQueryKey = sloCalls[sloCalls.length - 1].queryKey;
    expect(latestSloQueryKey[1]).toBeGreaterThanOrEqual(1);
    expect(latestSloQueryKey[1]).toBeLessThanOrEqual(30);
    expect(latestSloQueryKey[2]).toBeGreaterThanOrEqual(0);
    expect(latestSloQueryKey[2]).toBeLessThanOrEqual(100);
    expect(latestSloQueryKey[3]).toBeGreaterThanOrEqual(0);
    expect(latestSloQueryKey[3]).toBeLessThanOrEqual(100);
    expect(latestSloQueryKey[4]).toBeGreaterThanOrEqual(1);
    expect(latestSloQueryKey[4]).toBeLessThanOrEqual(5000);
    expect(container.textContent).toContain('SLO filter values were normalized to allowed bounds.');
  });

  it('normalizes governance report filter bounds on refresh', async () => {
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
          byProvider: { integrations: 2 },
          trendByDay: [],
          salesIntelligence: { eventCount: 0, byEventFamily: {} },
          traceabilityAudit: { eventCount: 1, decisionCounts: { HOLD: 1 }, readyCount: 0, notReadyCount: 1 },
          governanceAudit: { eventCount: 1, snapshotEvaluationCount: 1, baselineEvaluationCount: 0, statusCounts: { ACTION_REQUIRED: 1 } },
        },
      },
      'integrations-governance-report': {
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
          windowDays: 7,
          eventLimit: 1000,
          totals: {
            governanceEventCount: 1,
            traceabilityEvaluationCount: 1,
            snapshotEvaluationCount: 1,
            baselineEvaluationCount: 0,
            actionRequiredCount: 1,
            rolloutBlockedCount: 2,
          },
          governanceStatusCounts: { ACTION_REQUIRED: 1 },
          traceabilityDecisionCounts: { HOLD: 1 },
          timeline: [],
          latestEvents: [],
          ownerActionMatrix: [],
          recommendedCommands: ['npm run verify:telemetry:traceability:cleanup:policy'],
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
      'integrations-telemetry-governance': {
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
          retentionDays: 30,
          status: 'READY',
          snapshot: {
            directory: '/tmp',
            prefix: 'connector-telemetry-summary',
            fileCount: 1,
            latestGeneratedAt: '2026-02-22T00:00:00Z',
            ageDays: 0,
            withinRetention: true,
            staleCount: 0,
          },
          releaseGateFixtures: { allProfilesAvailable: true, missingProfiles: [] },
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
          releaseGateFixtures: { allProfilesAvailable: true, availableProfileCount: 3, profileCount: 3 },
        },
      },
    });

    await act(async () => {
      root.render(<Integrations />);
    });

    const governanceDaysInput = findInputByLabel(container, 'Report Window Days', 0);
    const governanceLimitInput = findInputByLabel(container, 'Report Event Limit', 0);
    const governanceHistoryRetentionInput = findInputByLabel(container, 'History Retention Days', 0);
    const governanceHistoryLimitInput = findInputByLabel(container, 'History Limit', 0);

    await act(async () => {
      setInputValue(governanceDaysInput, '999');
      setInputValue(governanceLimitInput, '1');
      setInputValue(governanceHistoryRetentionInput, '999');
      setInputValue(governanceHistoryLimitInput, '999');
    });

    mockUseQuery.mockClear();
    await act(async () => {
      findButton(container, 'Refresh Governance Report').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const governanceCalls = mockUseQuery.mock.calls
      .map((args) => args[0])
      .filter((options) => Array.isArray(options?.queryKey) && options.queryKey[0] === 'integrations-governance-report');
    expect(
      governanceCalls.some((options) => options.queryKey[1] === 30 && options.queryKey[2] === 50)
    ).toBe(true);
    const governanceHistoryCalls = mockUseQuery.mock.calls
      .map((args) => args[0])
      .filter((options) => Array.isArray(options?.queryKey) && options.queryKey[0] === 'integrations-governance-report-history');
    expect(
      governanceHistoryCalls.some((options) => options.queryKey[1] === 365 && options.queryKey[2] === 500)
    ).toBe(true);
    expect(container.textContent).toContain('Governance report/history filter values were normalized to allowed bounds.');
  });

  it('normalizes recent-event governance and packet status tokens for telemetry rendering and export', async () => {
    setupQueryMocks({
      integrations: { data: { sendgrid_configured: true, apollo_enabled: true, clearbit_enabled: true, crunchbase_enabled: true } },
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
          eventCount: 1,
          errorEventCount: 0,
          byProvider: { integrations: 1 },
          trendByDay: [{ date: '2026-02-21', events: 1, errors: 0, salesIntelligenceEvents: 0 }],
          salesIntelligence: { eventCount: 0, byEventFamily: {} },
          recentEventsFilter: 'all',
          recentEventsTotalCount: 1,
          recentEventsFilteredCount: 1,
          recentEventsPacketValidationCount: 1,
          recentEventsNonPacketCount: 0,
          recentEvents: [
            {
              eventType: 'integrations_traceability_status_evaluated',
              provider: 'integrations',
              requestId: 'req-normalized-status',
              governanceStatus: ' pass ',
              governancePacketValidationStatus: ' action required ',
              governancePacketValidationWithinFreshness: false,
            },
          ],
        },
      },
      'integrations-slo-gates': {
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
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
    });

    await act(async () => {
      root.render(<Integrations />);
    });

    expect(container.textContent).toContain('governance PASS');
    expect(container.textContent).toContain('packet ACTION_REQUIRED stale');

    await act(async () => {
      findButton(container, 'Export Telemetry JSON').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const createObjectURLMock = URL.createObjectURL as jest.Mock;
    const telemetryBlob = createObjectURLMock.mock.calls[createObjectURLMock.mock.calls.length - 1][0] as Blob;
    const telemetryPayload = JSON.parse(await new Response(telemetryBlob).text());
    expect(telemetryPayload.recentEvents[0].governanceStatus).toBe('PASS');
    expect(telemetryPayload.recentEvents[0].governancePacketValidationStatus).toBe('ACTION_REQUIRED');
  });

  it('applies telemetry status-filter selections in query key and telemetry export metadata', async () => {
    setupQueryMocks({
      integrations: { data: { sendgrid_configured: true, apollo_enabled: true, clearbit_enabled: true, crunchbase_enabled: true } },
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
          byProvider: { integrations: 2 },
          trendByDay: [],
          salesIntelligence: { eventCount: 0, byEventFamily: {} },
          recentEventsFilter: 'all',
          recentEventsGovernanceStatusFilter: 'PASS',
          recentEventsPacketValidationStatusFilter: 'READY',
          recentEventsTotalCount: 2,
          recentEventsFilteredCount: 1,
          recentEventsPacketValidationCount: 1,
          recentEventsNonPacketCount: 1,
          recentEventsGovernanceStatusCounts: { PASS: 1 },
          recentEventsPacketValidationStatusCounts: { READY: 1 },
          recentEvents: [
            {
              eventType: 'integrations_traceability_status_evaluated',
              provider: 'integrations',
              requestId: 'req-status-filter-export',
              governanceStatus: 'pass',
              governancePacketValidationStatus: 'ready',
            },
          ],
        },
      },
      'integrations-slo-gates': {
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
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

    const governanceSelect = container.querySelector(
      '[data-testid="recent-events-governance-status-select"]'
    ) as HTMLSelectElement;
    const packetSelect = container.querySelector(
      '[data-testid="recent-events-packet-status-select"]'
    ) as HTMLSelectElement;
    expect(governanceSelect).toBeTruthy();
    expect(packetSelect).toBeTruthy();

    mockUseQuery.mockClear();
    await act(async () => {
      setSelectValue(governanceSelect, 'ACTION_REQUIRED');
      setSelectValue(packetSelect, 'READY');
    });

    const telemetryCalls = mockUseQuery.mock.calls
      .map((args) => args[0])
      .filter((options) => Array.isArray(options?.queryKey) && options.queryKey[0] === 'integrations-telemetry-summary');
    expect(
      telemetryCalls.some(
        (options) => options.queryKey[4] === 'ACTION_REQUIRED' && options.queryKey[5] === 'READY'
      )
    ).toBe(true);

    expect(container.textContent).toContain('Status filters • Governance: PASS • Packet: READY.');
    expect(container.textContent).toContain('Governance status counts: PASS: 1.');
    expect(container.textContent).toContain('Packet status counts: READY: 1.');
    expect(container.textContent).toContain('Status-count source • Governance: server • Packet: server.');
    expect(container.textContent).toContain('Server applied governance status filter `PASS` (requested `ACTION_REQUIRED`).');

    await act(async () => {
      findButton(container, 'Export Telemetry JSON').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const createObjectURLMock = URL.createObjectURL as jest.Mock;
    const telemetryBlob = createObjectURLMock.mock.calls[createObjectURLMock.mock.calls.length - 1][0] as Blob;
    const telemetryPayload = JSON.parse(await new Response(telemetryBlob).text());
    expect(telemetryPayload.exportRecentEventsGovernanceStatusFilter).toBe('PASS');
    expect(telemetryPayload.exportRecentEventsGovernanceStatusFilterSelected).toBe('ACTION_REQUIRED');
    expect(telemetryPayload.exportRecentEventsGovernanceStatusFilterServer).toBe('PASS');
    expect(telemetryPayload.exportRecentEventsGovernanceStatusFilterMismatch).toBe(true);
    expect(telemetryPayload.exportRecentEventsPacketValidationStatusFilter).toBe('READY');
    expect(telemetryPayload.exportRecentEventsPacketValidationStatusFilterSelected).toBe('READY');
    expect(telemetryPayload.exportRecentEventsPacketValidationStatusFilterServer).toBe('READY');
    expect(telemetryPayload.exportRecentEventsPacketValidationStatusFilterMismatch).toBe(false);
    expect(telemetryPayload.exportRecentEventsGovernanceStatusCounts).toEqual({ PASS: 1 });
    expect(telemetryPayload.exportRecentEventsPacketValidationStatusCounts).toEqual({ READY: 1 });
    expect(telemetryPayload.exportRecentEventsGovernanceStatusCountsSource).toBe('server');
    expect(telemetryPayload.exportRecentEventsPacketValidationStatusCountsSource).toBe('server');
    expect(telemetryPayload.exportRecentEventsGovernanceStatusCountsMismatch).toBe(false);
    expect(telemetryPayload.exportRecentEventsPacketValidationStatusCountsMismatch).toBe(false);
    expect(telemetryPayload.exportRecentEventsGovernanceStatusCountsServer).toEqual({ PASS: 1 });
    expect(telemetryPayload.exportRecentEventsPacketValidationStatusCountsServer).toEqual({ READY: 1 });
    expect(telemetryPayload.exportRecentEventsGovernanceStatusCountsFallback).toEqual({ PASS: 1 });
    expect(telemetryPayload.exportRecentEventsPacketValidationStatusCountsFallback).toEqual({ READY: 1 });
  });

  it('flags telemetry status-count mismatches between server rollups and row-derived counts', async () => {
    setupQueryMocks({
      integrations: { data: { sendgrid_configured: true, apollo_enabled: true, clearbit_enabled: true, crunchbase_enabled: true } },
      googleStatus: { data: { connected: false } },
      'integrations-health': {
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
          status: 'ACTION_REQUIRED',
          healthyCount: 1,
          unhealthyCount: 1,
          credentialActionRequiredProviders: ['clearbit'],
          credentialFreshnessStatusCounts: {
            READY: 2,
          },
          credentialFreshnessByProvider: {
            clearbit: {
              status: 'ACTION_REQUIRED',
              configuredAgeDays: 120,
              rotationAgeDays: 101,
              staleReasons: ['rotation_age_exceeded'],
            },
          },
          credentialFreshnessTotalProviders: 1,
          credentialFreshnessActionRequiredCount: 1,
          credentialFreshnessWithinPolicyCount: 0,
          credentialFreshnessUnknownCount: 0,
          providers: [
            {
              provider: 'clearbit',
              healthy: false,
              statusCode: 429,
              latencyMs: 17,
              error: 'Rate limited',
              configuredAt: '2025-10-01T00:00:00Z',
              lastRotatedAt: '2025-09-01T00:00:00Z',
              credentialConfiguredAgeDays: 120,
              credentialRotationAgeDays: 101,
              credentialStale: true,
              credentialStaleReasons: ['rotation_age_exceeded'],
            },
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
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
          windowDays: 7,
          eventCount: 1,
          errorEventCount: 0,
          byProvider: { integrations: 1 },
          trendByDay: [],
          salesIntelligence: { eventCount: 0, byEventFamily: {} },
          recentEventsFilter: 'all',
          recentEventsGovernanceStatusFilter: null,
          recentEventsPacketValidationStatusFilter: null,
          recentEventsTotalCount: 1,
          recentEventsFilteredCount: 1,
          recentEventsPacketValidationCount: 1,
          recentEventsNonPacketCount: 0,
          recentEventsGovernanceStatusCounts: { PASS: 2 },
          recentEventsPacketValidationStatusCounts: { READY: 2 },
          recentEvents: [
            {
              eventType: 'integrations_traceability_status_evaluated',
              provider: 'integrations',
              requestId: 'req-status-count-mismatch',
              governanceStatus: 'PASS',
              governancePacketValidationStatus: 'READY',
            },
          ],
        },
      },
      'integrations-slo-gates': {
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
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
    });

    await act(async () => {
      root.render(<Integrations />);
    });

    expect(container.textContent).toContain(
      'Governance status-count mismatch (server `PASS: 2` vs row-derived `PASS: 1`).'
    );
    expect(container.textContent).toContain(
      'Packet status-count mismatch (server `READY: 2` vs row-derived `READY: 1`).'
    );
    expect(container.textContent).toContain(
      'Status-count posture • Governance: SERVER_DRIFT • Packet: SERVER_DRIFT.'
    );
    expect(container.textContent).toContain(
      'Credential freshness status-count mismatch (server `READY: 2` vs provider-derived `ACTION_REQUIRED: 1`).'
    );

    await act(async () => {
      findButton(container, 'Export Telemetry JSON').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const createObjectURLMock = URL.createObjectURL as jest.Mock;
    const telemetryBlob = createObjectURLMock.mock.calls[createObjectURLMock.mock.calls.length - 1][0] as Blob;
    const telemetryPayload = JSON.parse(await new Response(telemetryBlob).text());
    expect(telemetryPayload.exportRecentEventsGovernanceStatusCountsMismatch).toBe(true);
    expect(telemetryPayload.exportRecentEventsPacketValidationStatusCountsMismatch).toBe(true);
    expect(telemetryPayload.exportRecentEventsGovernanceStatusCountsServer).toEqual({ PASS: 2 });
    expect(telemetryPayload.exportRecentEventsPacketValidationStatusCountsServer).toEqual({ READY: 2 });
    expect(telemetryPayload.exportRecentEventsGovernanceStatusCountsFallback).toEqual({ PASS: 1 });
    expect(telemetryPayload.exportRecentEventsPacketValidationStatusCountsFallback).toEqual({ READY: 1 });
    expect(telemetryPayload.exportRecentEventsGovernanceStatusCountsPosture).toBe('server_drift');
    expect(telemetryPayload.exportRecentEventsPacketValidationStatusCountsPosture).toBe('server_drift');
    expect(telemetryPayload.exportRecentEventsGovernanceStatusCountsPostureSeverity).toBe('warning');
    expect(telemetryPayload.exportRecentEventsPacketValidationStatusCountsPostureSeverity).toBe('warning');
    expect(telemetryPayload.exportRecentEventsGovernanceStatusCountsRequiresInvestigation).toBe(true);
    expect(telemetryPayload.exportRecentEventsPacketValidationStatusCountsRequiresInvestigation).toBe(true);
    expect(telemetryPayload.exportIntegrationHealthCredentialFreshnessStatusCountsSource).toBe('server');
    expect(telemetryPayload.exportIntegrationHealthCredentialFreshnessStatusCountsMismatch).toBe(true);
    expect(telemetryPayload.exportIntegrationHealthCredentialFreshnessStatusCountsServer).toEqual({ READY: 2 });
    expect(telemetryPayload.exportIntegrationHealthCredentialFreshnessStatusCountsFallback).toEqual({ ACTION_REQUIRED: 1 });
  });

  it('uses backend-provided telemetry status-count provenance metadata when present', async () => {
    setupQueryMocks({
      integrations: { data: { sendgrid_configured: true, apollo_enabled: true, clearbit_enabled: true, crunchbase_enabled: true } },
      googleStatus: { data: { connected: false } },
      'integrations-health': {
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
          providers: [],
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
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
          windowDays: 7,
          eventCount: 1,
          errorEventCount: 0,
          byProvider: { integrations: 1 },
          trendByDay: [],
          salesIntelligence: { eventCount: 0, byEventFamily: {} },
          recentEventsFilter: 'all',
          recentEventsTotalCount: 1,
          recentEventsFilteredCount: 1,
          recentEventsPacketValidationCount: 1,
          recentEventsNonPacketCount: 0,
          recentEventsGovernanceStatusCounts: { PASS: 3 },
          recentEventsGovernanceStatusCountsSource: 'local',
          recentEventsGovernanceStatusCountsMismatch: false,
          recentEventsGovernanceStatusCountsServer: { PASS: 3 },
          recentEventsGovernanceStatusCountsFallback: { ACTION_REQUIRED: 1 },
          recentEventsGovernanceStatusCountsPosture: 'local_drift',
          recentEventsGovernanceStatusCountsPostureSeverity: 'warning',
          recentEventsGovernanceStatusCountsRequiresInvestigation: true,
          recentEventsPacketValidationStatusCounts: { READY: 3 },
          recentEventsPacketValidationStatusCountsSource: 'local',
          recentEventsPacketValidationStatusCountsMismatch: false,
          recentEventsPacketValidationStatusCountsServer: { READY: 3 },
          recentEventsPacketValidationStatusCountsFallback: { ACTION_REQUIRED: 1 },
          recentEventsPacketValidationStatusCountsPosture: 'local_drift',
          recentEventsPacketValidationStatusCountsPostureSeverity: 'warning',
          recentEventsPacketValidationStatusCountsRequiresInvestigation: true,
          recentEvents: [
            {
              eventType: 'integrations_traceability_status_evaluated',
              provider: 'integrations',
              requestId: 'req-status-count-provenance-local',
              governanceStatus: 'PASS',
              governancePacketValidationStatus: 'READY',
            },
          ],
        },
      },
      'integrations-slo-gates': {
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
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
    });

    await act(async () => {
      root.render(<Integrations />);
    });

    expect(container.textContent).toContain('Status-count source • Governance: local • Packet: local.');
    expect(container.textContent).toContain(
      'Status-count posture • Governance: LOCAL_DRIFT • Packet: LOCAL_DRIFT.'
    );
    expect(container.textContent).toContain('Governance status counts: ACTION_REQUIRED: 1.');
    expect(container.textContent).toContain('Packet status counts: ACTION_REQUIRED: 1.');
    expect(container.textContent).not.toContain('Governance status-count mismatch');
    expect(container.textContent).not.toContain('Packet status-count mismatch');

    await act(async () => {
      findButton(container, 'Export Telemetry JSON').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const createObjectURLMock = URL.createObjectURL as jest.Mock;
    const telemetryBlob = createObjectURLMock.mock.calls[createObjectURLMock.mock.calls.length - 1][0] as Blob;
    const telemetryPayload = JSON.parse(await new Response(telemetryBlob).text());
    expect(telemetryPayload.exportRecentEventsGovernanceStatusCountsSource).toBe('local');
    expect(telemetryPayload.exportRecentEventsPacketValidationStatusCountsSource).toBe('local');
    expect(telemetryPayload.exportRecentEventsGovernanceStatusCounts).toEqual({ ACTION_REQUIRED: 1 });
    expect(telemetryPayload.exportRecentEventsPacketValidationStatusCounts).toEqual({ ACTION_REQUIRED: 1 });
    expect(telemetryPayload.exportRecentEventsGovernanceStatusCountsServer).toEqual({ PASS: 3 });
    expect(telemetryPayload.exportRecentEventsPacketValidationStatusCountsServer).toEqual({ READY: 3 });
    expect(telemetryPayload.exportRecentEventsGovernanceStatusCountsFallback).toEqual({ ACTION_REQUIRED: 1 });
    expect(telemetryPayload.exportRecentEventsPacketValidationStatusCountsFallback).toEqual({ ACTION_REQUIRED: 1 });
    expect(telemetryPayload.exportRecentEventsGovernanceStatusCountsMismatch).toBe(false);
    expect(telemetryPayload.exportRecentEventsPacketValidationStatusCountsMismatch).toBe(false);
    expect(telemetryPayload.exportRecentEventsGovernanceStatusCountsPosture).toBe('local_drift');
    expect(telemetryPayload.exportRecentEventsPacketValidationStatusCountsPosture).toBe('local_drift');
    expect(telemetryPayload.exportRecentEventsGovernanceStatusCountsPostureSeverity).toBe('warning');
    expect(telemetryPayload.exportRecentEventsPacketValidationStatusCountsPostureSeverity).toBe('warning');
    expect(telemetryPayload.exportRecentEventsGovernanceStatusCountsRequiresInvestigation).toBe(true);
    expect(telemetryPayload.exportRecentEventsPacketValidationStatusCountsRequiresInvestigation).toBe(true);
  });

  it('renders mismatch warnings when backend status-count provenance marks local mismatch', async () => {
    setupQueryMocks({
      integrations: { data: { sendgrid_configured: true, apollo_enabled: true, clearbit_enabled: true, crunchbase_enabled: true } },
      googleStatus: { data: { connected: false } },
      'integrations-health': {
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
          providers: [],
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
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
          windowDays: 7,
          eventCount: 1,
          errorEventCount: 0,
          byProvider: { integrations: 1 },
          trendByDay: [],
          salesIntelligence: { eventCount: 0, byEventFamily: {} },
          recentEventsFilter: 'all',
          recentEventsTotalCount: 1,
          recentEventsFilteredCount: 1,
          recentEventsPacketValidationCount: 1,
          recentEventsNonPacketCount: 0,
          recentEventsGovernanceStatusCounts: { PASS: 3 },
          recentEventsGovernanceStatusCountsSource: 'local',
          recentEventsGovernanceStatusCountsMismatch: true,
          recentEventsGovernanceStatusCountsServer: { PASS: 3 },
          recentEventsGovernanceStatusCountsFallback: { ACTION_REQUIRED: 1 },
          recentEventsPacketValidationStatusCounts: { READY: 3 },
          recentEventsPacketValidationStatusCountsSource: 'local',
          recentEventsPacketValidationStatusCountsMismatch: true,
          recentEventsPacketValidationStatusCountsServer: { READY: 3 },
          recentEventsPacketValidationStatusCountsFallback: { ACTION_REQUIRED: 1 },
          recentEvents: [
            {
              eventType: 'integrations_traceability_status_evaluated',
              provider: 'integrations',
              requestId: 'req-status-count-provenance-local-mismatch',
              governanceStatus: 'PASS',
              governancePacketValidationStatus: 'READY',
            },
          ],
        },
      },
      'integrations-slo-gates': {
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
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
    });

    await act(async () => {
      root.render(<Integrations />);
    });

    expect(container.textContent).toContain('Status-count source • Governance: local • Packet: local.');
    expect(container.textContent).toContain(
      'Status-count posture • Governance: LOCAL_DRIFT • Packet: LOCAL_DRIFT.'
    );
    expect(container.textContent).toContain('Governance status counts: ACTION_REQUIRED: 1.');
    expect(container.textContent).toContain('Packet status counts: ACTION_REQUIRED: 1.');
    expect(container.textContent).toContain(
      'Governance status-count mismatch (server `PASS: 3` vs row-derived `ACTION_REQUIRED: 1`).'
    );
    expect(container.textContent).toContain(
      'Packet status-count mismatch (server `READY: 3` vs row-derived `ACTION_REQUIRED: 1`).'
    );

    await act(async () => {
      findButton(container, 'Export Telemetry JSON').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const createObjectURLMock = URL.createObjectURL as jest.Mock;
    const telemetryBlob = createObjectURLMock.mock.calls[createObjectURLMock.mock.calls.length - 1][0] as Blob;
    const telemetryPayload = JSON.parse(await new Response(telemetryBlob).text());
    expect(telemetryPayload.exportRecentEventsGovernanceStatusCountsSource).toBe('local');
    expect(telemetryPayload.exportRecentEventsPacketValidationStatusCountsSource).toBe('local');
    expect(telemetryPayload.exportRecentEventsGovernanceStatusCounts).toEqual({ ACTION_REQUIRED: 1 });
    expect(telemetryPayload.exportRecentEventsPacketValidationStatusCounts).toEqual({ ACTION_REQUIRED: 1 });
    expect(telemetryPayload.exportRecentEventsGovernanceStatusCountsServer).toEqual({ PASS: 3 });
    expect(telemetryPayload.exportRecentEventsPacketValidationStatusCountsServer).toEqual({ READY: 3 });
    expect(telemetryPayload.exportRecentEventsGovernanceStatusCountsFallback).toEqual({ ACTION_REQUIRED: 1 });
    expect(telemetryPayload.exportRecentEventsPacketValidationStatusCountsFallback).toEqual({ ACTION_REQUIRED: 1 });
    expect(telemetryPayload.exportRecentEventsGovernanceStatusCountsMismatch).toBe(true);
    expect(telemetryPayload.exportRecentEventsPacketValidationStatusCountsMismatch).toBe(true);
    expect(telemetryPayload.exportRecentEventsGovernanceStatusCountsPosture).toBe('local_drift');
    expect(telemetryPayload.exportRecentEventsPacketValidationStatusCountsPosture).toBe('local_drift');
    expect(telemetryPayload.exportRecentEventsGovernanceStatusCountsPostureSeverity).toBe('warning');
    expect(telemetryPayload.exportRecentEventsPacketValidationStatusCountsPostureSeverity).toBe('warning');
    expect(telemetryPayload.exportRecentEventsGovernanceStatusCountsRequiresInvestigation).toBe(true);
    expect(telemetryPayload.exportRecentEventsPacketValidationStatusCountsRequiresInvestigation).toBe(true);
  });

  it('falls back to computed status-count posture defaults when backend posture metadata is invalid', async () => {
    setupQueryMocks({
      integrations: { data: { sendgrid_configured: true, apollo_enabled: true, clearbit_enabled: true, crunchbase_enabled: true } },
      googleStatus: { data: { connected: false } },
      'integrations-health': {
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
          providers: [],
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
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
          windowDays: 7,
          eventCount: 1,
          errorEventCount: 0,
          byProvider: { integrations: 1 },
          trendByDay: [],
          salesIntelligence: { eventCount: 0, byEventFamily: {} },
          recentEventsFilter: 'all',
          recentEventsTotalCount: 1,
          recentEventsFilteredCount: 1,
          recentEventsPacketValidationCount: 1,
          recentEventsNonPacketCount: 0,
          recentEventsGovernanceStatusCounts: { PASS: 3 },
          recentEventsGovernanceStatusCountsSource: 'local',
          recentEventsGovernanceStatusCountsMismatch: false,
          recentEventsGovernanceStatusCountsServer: { PASS: 3 },
          recentEventsGovernanceStatusCountsFallback: { ACTION_REQUIRED: 1 },
          recentEventsGovernanceStatusCountsPosture: 'unknown_posture',
          recentEventsGovernanceStatusCountsPostureSeverity: 'invalid_severity',
          recentEventsGovernanceStatusCountsRequiresInvestigation: 'false',
          recentEventsPacketValidationStatusCounts: { READY: 3 },
          recentEventsPacketValidationStatusCountsSource: 'local',
          recentEventsPacketValidationStatusCountsMismatch: false,
          recentEventsPacketValidationStatusCountsServer: { READY: 3 },
          recentEventsPacketValidationStatusCountsFallback: { ACTION_REQUIRED: 1 },
          recentEventsPacketValidationStatusCountsPosture: 'not_a_posture',
          recentEventsPacketValidationStatusCountsPostureSeverity: 'invalid_severity',
          recentEventsPacketValidationStatusCountsRequiresInvestigation: 'false',
          recentEvents: [
            {
              eventType: 'integrations_traceability_status_evaluated',
              provider: 'integrations',
              requestId: 'req-status-count-provenance-invalid-posture',
              governanceStatus: 'PASS',
              governancePacketValidationStatus: 'READY',
            },
          ],
        },
      },
      'integrations-slo-gates': {
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
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
    });

    await act(async () => {
      root.render(<Integrations />);
    });

    expect(container.textContent).toContain('Status-count source • Governance: local • Packet: local.');
    expect(container.textContent).toContain(
      'Status-count posture • Governance: LOCAL_FALLBACK • Packet: LOCAL_FALLBACK.'
    );

    await act(async () => {
      findButton(container, 'Export Telemetry JSON').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const createObjectURLMock = URL.createObjectURL as jest.Mock;
    const telemetryBlob = createObjectURLMock.mock.calls[createObjectURLMock.mock.calls.length - 1][0] as Blob;
    const telemetryPayload = JSON.parse(await new Response(telemetryBlob).text());
    expect(telemetryPayload.exportRecentEventsGovernanceStatusCountsPosture).toBe('local_fallback');
    expect(telemetryPayload.exportRecentEventsPacketValidationStatusCountsPosture).toBe('local_fallback');
    expect(telemetryPayload.exportRecentEventsGovernanceStatusCountsPostureSeverity).toBe('info');
    expect(telemetryPayload.exportRecentEventsPacketValidationStatusCountsPostureSeverity).toBe('info');
    expect(telemetryPayload.exportRecentEventsGovernanceStatusCountsRequiresInvestigation).toBe(false);
    expect(telemetryPayload.exportRecentEventsPacketValidationStatusCountsRequiresInvestigation).toBe(false);
  });

  it('falls back to computed status-count server drift posture when backend posture metadata is invalid', async () => {
    setupQueryMocks({
      integrations: { data: { sendgrid_configured: true, apollo_enabled: true, clearbit_enabled: true, crunchbase_enabled: true } },
      googleStatus: { data: { connected: false } },
      'integrations-health': {
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
          providers: [],
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
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
          windowDays: 7,
          eventCount: 1,
          errorEventCount: 0,
          byProvider: { integrations: 1 },
          trendByDay: [],
          salesIntelligence: { eventCount: 0, byEventFamily: {} },
          recentEventsFilter: 'all',
          recentEventsTotalCount: 1,
          recentEventsFilteredCount: 1,
          recentEventsPacketValidationCount: 1,
          recentEventsNonPacketCount: 0,
          recentEventsGovernanceStatusCounts: { PASS: 3 },
          recentEventsGovernanceStatusCountsSource: 'server',
          recentEventsGovernanceStatusCountsMismatch: true,
          recentEventsGovernanceStatusCountsServer: { PASS: 3 },
          recentEventsGovernanceStatusCountsFallback: { PASS: 1 },
          recentEventsGovernanceStatusCountsPosture: 'unknown_posture',
          recentEventsGovernanceStatusCountsPostureSeverity: 'invalid_severity',
          recentEventsGovernanceStatusCountsRequiresInvestigation: 'false',
          recentEventsPacketValidationStatusCounts: { READY: 3 },
          recentEventsPacketValidationStatusCountsSource: 'server',
          recentEventsPacketValidationStatusCountsMismatch: true,
          recentEventsPacketValidationStatusCountsServer: { READY: 3 },
          recentEventsPacketValidationStatusCountsFallback: { READY: 1 },
          recentEventsPacketValidationStatusCountsPosture: 'not_a_posture',
          recentEventsPacketValidationStatusCountsPostureSeverity: 'invalid_severity',
          recentEventsPacketValidationStatusCountsRequiresInvestigation: 'false',
          recentEvents: [
            {
              eventType: 'integrations_traceability_status_evaluated',
              provider: 'integrations',
              requestId: 'req-status-count-provenance-invalid-posture-server-drift',
              governanceStatus: 'PASS',
              governancePacketValidationStatus: 'READY',
            },
          ],
        },
      },
      'integrations-slo-gates': {
        data: {
          generatedAt: '2026-02-22T00:00:00Z',
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
    });

    await act(async () => {
      root.render(<Integrations />);
    });

    expect(container.textContent).toContain(
      'Status-count posture • Governance: SERVER_DRIFT • Packet: SERVER_DRIFT.'
    );

    await act(async () => {
      findButton(container, 'Export Telemetry JSON').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const createObjectURLMock = URL.createObjectURL as jest.Mock;
    const telemetryBlob = createObjectURLMock.mock.calls[createObjectURLMock.mock.calls.length - 1][0] as Blob;
    const telemetryPayload = JSON.parse(await new Response(telemetryBlob).text());
    expect(telemetryPayload.exportRecentEventsGovernanceStatusCountsPosture).toBe('server_drift');
    expect(telemetryPayload.exportRecentEventsPacketValidationStatusCountsPosture).toBe('server_drift');
    expect(telemetryPayload.exportRecentEventsGovernanceStatusCountsPostureSeverity).toBe('warning');
    expect(telemetryPayload.exportRecentEventsPacketValidationStatusCountsPostureSeverity).toBe('warning');
    expect(telemetryPayload.exportRecentEventsGovernanceStatusCountsRequiresInvestigation).toBe(true);
    expect(telemetryPayload.exportRecentEventsPacketValidationStatusCountsRequiresInvestigation).toBe(true);
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

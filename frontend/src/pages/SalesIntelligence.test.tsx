/// <reference types="jest" />
import React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import SalesIntelligence from './SalesIntelligence';

type QueryResult = {
  data?: any;
  isLoading?: boolean;
  error?: any;
};

const mockUseQuery = jest.fn();

jest.mock('@tanstack/react-query', () => ({
  useQuery: (options: any) => mockUseQuery(options),
}));

jest.mock('../lib/api', () => ({
  api: {
    getSalesCampaignPortfolio: jest.fn(),
    getSalesCampaignPerformance: jest.fn(),
    getPipelineForecast: jest.fn(),
    getConversationIntelligence: jest.fn(),
    getMultiChannelEngagement: jest.fn(),
    getRelationshipMap: jest.fn(),
    getPhraseAnalytics: jest.fn(),
    getPhraseChannelSummary: jest.fn(),
    getPredictionPerformance: jest.fn(),
    getPredictionFeedbackHistory: jest.fn(),
    getPredictionPerformanceReport: jest.fn(),
    getIntegrationsTelemetrySummary: jest.fn(),
    getIntegrationsHealth: jest.fn(),
    getIntegrationsGovernanceReport: jest.fn(),
    getIntegrationsGovernanceReportExport: jest.fn(),
    getIntegrationsGovernanceReportHistory: jest.fn(),
    getIntegrationsGovernanceSchema: jest.fn(),
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

function setNumberInputValue(input: HTMLInputElement, value: string) {
  const nativeValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value'
  )?.set;
  nativeValueSetter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function setSelectValue(select: HTMLSelectElement, value: string) {
  const nativeValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLSelectElement.prototype,
    'value'
  )?.set;
  nativeValueSetter?.call(select, value);
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

function readBlobAsText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Failed to read blob'));
    reader.readAsText(blob);
  });
}

describe('SalesIntelligence page', () => {
  let container: HTMLDivElement;
  let root: Root;
  let consoleWarnSpy: jest.SpyInstance;
  let anchorClickSpy: jest.SpyInstance;

  beforeEach(() => {
    const originalWarn = console.warn;
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation((...args) => {
      const [firstArg] = args;
      const message = typeof firstArg === 'string' ? firstArg : String(firstArg || '');
      if (message.includes('The width(0) and height(0) of chart should be greater than 0')) {
        return;
      }
      originalWarn(...args);
    });
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    (globalThis as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    anchorClickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    jest.useRealTimers();
    anchorClickSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('renders campaign and prediction summaries when data is available', async () => {
    setupQueryMocks({
      'sales-intelligence-page-portfolio': {
        data: {
          campaignCount: 2,
          activeCampaignCount: 2,
          portfolioTotals: { sent: 220, opened: 70, replied: 22 },
          averageReplyRate: 0.1,
          rankedCampaigns: [
            {
              campaignId: 'c1',
              name: 'Enterprise Outbound',
              status: 'active',
              totals: { sent: 120, opened: 45, replied: 14 },
              overall: { openRate: 0.375, replyRate: 0.1167, qualityTier: 'watch' },
            },
          ],
        },
      },
      'sales-intelligence-page-campaign': {
        data: {
          campaignId: 'c1',
          name: 'Enterprise Outbound',
          status: 'active',
          totals: { sent: 120, opened: 45, replied: 14 },
          overall: { openRate: 0.375, replyRate: 0.1167, replyToOpenRate: 0.3111, qualityTier: 'watch' },
          byChannel: [
            { channel: 'email', sent: 80, opened: 28, replied: 10, openRate: 0.35, replyRate: 0.125 },
            { channel: 'linkedin', sent: 40, opened: 17, replied: 4, openRate: 0.425, replyRate: 0.1 },
          ],
          recommendations: ['Increase follow-up frequency'],
        },
      },
      'sales-intelligence-page-prediction-report': {
        data: {
          qualityTier: 'good',
          rolloutDecision: 'proceed',
          sampleSize: 120,
          meanAbsoluteCalibrationError: 0.11,
          recommendations: [],
        },
      },
      'sales-intelligence-page-pipeline-forecast': {
        data: {
          openPipelineValue: 520000,
          weightedPipelineValue: 286000,
          projectedWonValue: 182000,
          historicalWinRate: 43.5,
          confidenceInterval: {
            low: 145600,
            high: 218400,
            confidenceLevel: 95,
          },
          confidenceIntervalWidth: 72800,
          confidenceIntervalWidthPct: 40.0,
          forecastReliabilityTier: 'medium',
          forecastRecommendation: 'Hold current rollout scope and monitor interval width before expansion.',
          sampleSize: {
            openProspects: 14,
            closedOutcomes: 22,
          },
          windowDays: 90,
          generatedAt: '2026-02-22T10:00:00+00:00',
        },
      },
      'sales-intelligence-page-conversation-intelligence': {
        data: {
          totals: {
            records: 12,
            channels: {
              chat: 3,
              email: 7,
              linkedin: 2,
            },
          },
          sentiment: {
            positive: 6,
            neutral: 4,
            negative: 2,
          },
          topObjections: [
            { type: 'budget', count: 2 },
            { type: 'timing', count: 1 },
          ],
          relationshipHealth: 'watch',
          generatedAt: '2026-02-22T10:00:00+00:00',
          sources: {
            chatSessions: 3,
            emailEvents: 9,
          },
        },
      },
      'sales-intelligence-page-multi-channel-engagement': {
        data: {
          activeChannels: ['email', 'linkedin', 'phone'],
          coverageScore: 75,
          channelUsage: {
            email: 8,
            linkedin: 3,
            phone: 2,
            sms: 0,
          },
          recommendations: ['Use SMS only for late-stage follow-ups with consent.'],
          generatedAt: '2026-02-22T10:00:00+00:00',
        },
      },
      'sales-intelligence-page-relationship-map': {
        data: {
          generatedAt: '2026-02-22T10:00:00+00:00',
          nodes: [
            { id: 'p1', type: 'prospect', label: 'Alex Ng', score: 81 },
            { id: 'c1', type: 'company', label: 'Acme Inc' },
          ],
          edges: [
            { source: 'p1', target: 'c1', type: 'works_at', relationshipStrength: 74.2 },
          ],
          stats: {
            prospects: 1,
            companies: 1,
            connections: 1,
            averageRelationshipStrength: 74.2,
          },
        },
      },
      'sales-intelligence-page-phrase-analytics': {
        data: {
          phrases: [
            {
              phrase: 'quick demo',
              exposureCount: 8,
              openRate: 0.5,
              replyRate: 0.25,
              effectivenessScore: 0.31,
              confidence: 0.8,
              channels: { email: 6, linkedin: 2 },
            },
            {
              phrase: 'roi case study',
              exposureCount: 5,
              openRate: 0.4,
              replyRate: 0.2,
              effectivenessScore: 0.24,
              confidence: 0.74,
              channels: { email: 5 },
            },
          ],
          summary: {
            trackedPhrases: 12,
            candidatePhraseCount: 28,
            minExposure: 2,
            topK: 8,
            query: null,
          },
          windowDays: 90,
          totalRecords: 21,
          generatedAt: '2026-02-22T10:00:00+00:00',
        },
      },
      'sales-intelligence-page-phrase-channel-summary': {
        data: {
          channels: [
            {
              channel: 'email',
              totalRecords: 15,
              trackedPhrases: 8,
              topPhrases: [{ phrase: 'quick demo', effectivenessScore: 0.31, exposureCount: 6 }],
            },
            {
              channel: 'linkedin',
              totalRecords: 6,
              trackedPhrases: 4,
              topPhrases: [{ phrase: 'roi case study', effectivenessScore: 0.24, exposureCount: 2 }],
            },
          ],
          channelCount: 2,
          totalRecords: 21,
          windowDays: 90,
          generatedAt: '2026-02-22T10:00:00+00:00',
        },
      },
      'sales-intelligence-page-prediction-performance': {
        data: {
          sampleSize: 18,
          positiveRate: 0.5,
          averagePredictedProbability: 0.58,
          meanAbsoluteCalibrationError: 0.16,
          byChannel: {
            email: {
              sampleSize: 12,
              positiveRate: 0.5,
              avgPredictedProbability: 0.57,
              meanAbsoluteCalibrationError: 0.15,
            },
            linkedin: {
              sampleSize: 6,
              positiveRate: 0.5,
              avgPredictedProbability: 0.6,
              meanAbsoluteCalibrationError: 0.17,
            },
          },
          windowDays: 90,
          generatedAt: '2026-02-22T10:00:00+00:00',
        },
      },
      'sales-intelligence-page-prediction-feedback-history': {
        data: {
          records: [
            {
              id: 'fb1',
              predictionId: 'pred-1',
              predictedProbability: 0.64,
              outcome: 'positive',
              actualLabel: 1,
              channel: 'email',
              responseLatencyHours: 6,
              createdAt: '2026-02-21T10:00:00+00:00',
              updatedAt: '2026-02-21T10:00:00+00:00',
            },
            {
              id: 'fb2',
              predictionId: 'pred-2',
              predictedProbability: 0.31,
              outcome: 'negative',
              actualLabel: 0,
              channel: 'linkedin',
              responseLatencyHours: 20,
              createdAt: '2026-02-20T10:00:00+00:00',
              updatedAt: '2026-02-20T10:00:00+00:00',
            },
          ],
          count: 2,
          windowDays: 90,
          generatedAt: '2026-02-22T10:00:00+00:00',
        },
      },
      'sales-intelligence-page-telemetry': {
        data: {
          generatedAt: '2026-02-22T10:00:00+00:00',
          windowDays: 7,
          eventCount: 40,
          errorEventCount: 2,
          bySchemaVersion: { 1: 15, 2: 25 },
          trendByDay: [
            { date: '2026-02-20', events: 10, errors: 1, salesIntelligenceEvents: 6 },
            { date: '2026-02-21', events: 15, errors: 0, salesIntelligenceEvents: 9 },
          ],
          salesIntelligence: {
            eventCount: 25,
            byEventFamily: { campaigns: 12, prediction: 9, phrases: 4 },
            bySchemaVersion: { 2: 25 },
          },
          packetValidationAudit: {
            eventCount: 2,
            statusCounts: { ACTION_REQUIRED: 1, READY: 1 },
            withinFreshnessCount: 1,
            outsideFreshnessCount: 1,
            missingFreshnessCount: 0,
            latestEvaluatedAt: '2026-02-22T09:55:00+00:00',
          },
        },
      },
      'sales-intelligence-page-governance-report': {
        data: {
          generatedAt: '2026-02-22T10:00:00+00:00',
          windowDays: 7,
          eventLimit: 500,
          totals: {
            governanceEventCount: 3,
            traceabilityEvaluationCount: 2,
            snapshotEvaluationCount: 2,
            baselineEvaluationCount: 1,
            actionRequiredCount: 1,
            rolloutBlockedCount: 2,
            connectorRateLimitEventCount: 3,
          },
          connectorRateLimit: {
            eventCount: 3,
            byEndpoint: {
              apollo_search: 2,
              company_enrichment_orchestration: 1,
            },
            latestEventAt: '2026-02-22T09:58:00+00:00',
            maxRetryAfterSeconds: 46,
            avgRetryAfterSeconds: 32,
            maxResetInSeconds: 45,
            avgResetInSeconds: 24,
            pressure: {
              label: 'High',
            },
          },
          governanceStatusCounts: { ACTION_REQUIRED: 1, PASS: 2 },
          traceabilityDecisionCounts: { HOLD: 1, PROCEED: 1 },
          timeline: [
            {
              date: '2026-02-21',
              snapshotGovernanceEvents: 1,
              baselineGovernanceEvents: 1,
              traceabilityEvents: 1,
              actionRequiredEvents: 1,
            },
          ],
          recommendedCommands: ['npm run verify:governance:weekly'],
        },
      },
      'sales-intelligence-page-governance-report-export': {
        data: {
          governanceType: 'weekly_report',
          exportSchemaVersion: 1,
          generatedAt: '2026-02-22T10:00:00+00:00',
          windowDays: 7,
          eventLimit: 500,
          status: 'ACTION_REQUIRED',
          totals: { governanceEventCount: 3, rolloutBlockedCount: 2, connectorRateLimitEventCount: 3 },
          connectorRateLimit: {
            eventCount: 3,
            byEndpoint: {
              apollo_search: 2,
              company_enrichment_orchestration: 1,
            },
            latestEventAt: '2026-02-22T09:58:00+00:00',
            maxRetryAfterSeconds: 46,
            avgRetryAfterSeconds: 32,
            maxResetInSeconds: 45,
            avgResetInSeconds: 24,
            pressure: {
              label: 'High',
            },
          },
          runtimePrereqs: {
            present: true,
            available: true,
            passed: false,
            contractValid: true,
            valid: false,
            missingCheckCount: 1,
            missingChecks: {
              commands: ['git'],
              workspace: [],
            },
            command: 'npm run verify:smoke:runtime-prereqs-artifact',
          },
          recommendedCommands: ['npm run verify:governance:weekly'],
          governanceExport: {
            governanceType: 'weekly_report',
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
              latestEventAt: '2026-02-22T09:58:00+00:00',
              maxRetryAfterSeconds: 46,
              avgRetryAfterSeconds: 32,
              maxResetInSeconds: 45,
              avgResetInSeconds: 24,
              pressure: {
                label: 'High',
              },
            },
            runtimePrereqs: {
              present: true,
              available: true,
              passed: false,
              contractValid: true,
              valid: false,
              missingCheckCount: 1,
              missingChecks: {
                commands: ['git'],
                workspace: [],
              },
              command: 'npm run verify:smoke:runtime-prereqs-artifact',
            },
            alerts: [{ severity: 'high', ownerRole: 'Release Manager', message: 'Snapshot governance contains ACTION_REQUIRED evaluations.' }],
            actions: [],
            evaluatedAt: '2026-02-22T10:00:00+00:00',
            requestedBy: 'u1',
          },
        },
      },
      'sales-intelligence-page-governance-report-history': {
        data: {
          governanceType: 'weekly_report_history',
          exportSchemaVersion: 1,
          generatedAt: '2026-02-22T10:00:00+00:00',
          retentionDays: 7,
          artifactCount: 2,
          staleCount: 1,
          rolloutBlockedCount: 1,
          connectorRateLimit: {
            eventCount: 3,
            byEndpoint: {
              apollo_search: 2,
              company_enrichment_orchestration: 1,
            },
            latestEventAt: '2026-02-22T09:58:00+00:00',
            maxRetryAfterSeconds: 46,
            avgRetryAfterSeconds: 32,
            maxResetInSeconds: 45,
            avgResetInSeconds: 24,
            pressure: {
              label: 'High',
            },
          },
          governanceExport: {
            status: 'ACTION_REQUIRED',
            rolloutBlocked: true,
            connectorRateLimit: {
              eventCount: 3,
              byEndpoint: {
                apollo_search: 2,
                company_enrichment_orchestration: 1,
              },
              latestEventAt: '2026-02-22T09:58:00+00:00',
              maxRetryAfterSeconds: 46,
              avgRetryAfterSeconds: 32,
              maxResetInSeconds: 45,
              avgResetInSeconds: 24,
              pressure: {
                label: 'High',
              },
            },
          },
          latestArtifact: {
            name: 'connector_governance_weekly_report_recent.json',
            exportSchemaVersion: 1,
            generatedAt: '2026-02-22T10:00:00+00:00',
            status: 'READY',
            rolloutBlocked: false,
          },
          items: [
            {
              name: 'connector_governance_weekly_report_recent.json',
              exportSchemaVersion: 1,
              generatedAt: '2026-02-22T10:00:00+00:00',
              withinRetention: true,
              status: 'READY',
              rolloutBlocked: false,
            },
            {
              name: 'connector_governance_weekly_report_stale.json',
              generatedAt: '2026-01-01T10:00:00+00:00',
              withinRetention: false,
              status: 'ACTION_REQUIRED',
              rolloutBlocked: true,
            },
          ],
        },
      },
      'sales-intelligence-page-governance-schema': {
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
          recommendedCommands: ['npm run verify:governance:weekly:endpoint:contract'],
        },
      },
    });

    const createObjectUrlMock = jest.fn(() => 'blob:sales-governance-schema-contract');
    const revokeObjectUrlMock = jest.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectUrlMock,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectUrlMock,
    });

    await act(async () => {
      root.render(<SalesIntelligence />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Sales Intelligence');
    expect(container.textContent).toContain('Campaign Channel Performance');
    expect(container.textContent).toContain('Pipeline Forecast');
    expect(container.textContent).toContain('Prediction Quality');
    expect(container.textContent).toContain('Conversation Intelligence');
    expect(container.textContent).toContain('Multi-Channel Health');
    expect(container.textContent).toContain('Relationship Map Summary');
    expect(container.textContent).toContain('Phrase Effectiveness');
    expect(container.textContent).toContain('Phrase Channel Summary');
    expect(container.textContent).toContain('Prediction Feedback Performance');
    expect(container.textContent).toContain('Prediction Feedback History');
    expect(container.textContent).toContain('Enterprise Outbound');
    expect(container.textContent).toContain('good');
    expect(container.textContent).toContain('$520,000');
    expect(container.textContent).toContain('MEDIUM');
    expect(container.textContent).toContain('WATCH');
    expect(container.textContent).toContain('75.0%');
    expect(container.textContent).toContain('74.2');
    expect(container.textContent).toContain('quick demo');
    expect(container.textContent).toContain('12');
    expect(container.textContent).toContain('18');
    expect(container.textContent).toContain('POSITIVE');
    expect(container.textContent).toContain('Open / Closed Samples');
    expect(container.textContent).toContain('Rollout Playbook');
    expect(container.textContent).toContain('Release Manager');
    expect(container.textContent).toContain('Telemetry Trend (Daily)');
    expect(container.textContent).toContain('Governance Packet Validation Posture');
    expect(container.textContent).toContain('Sales Event Family Distribution');
    expect(container.textContent).toContain('Governance Weekly Rollup');
    expect(container.textContent).toContain('Governance Connector Pressure');
    expect(container.textContent).toContain('Governance connector pressure: High.');
    expect(container.textContent).toContain('apollo_search');
    expect(container.textContent).toContain('Weekly Governance Posture');
    expect(container.textContent).toContain('Governance Schema Contract');
    expect(container.textContent).toContain('Active Version: 1');
    expect(container.textContent).toContain('Source: default');
    expect(container.textContent).toContain('Posture: ACTION_REQUIRED');
    expect(container.textContent).toContain('Owner: Release Manager');
    expect(container.textContent).toContain('Schema Version: 1');
    expect(container.textContent).toContain('Runtime Prereq Gate: FAIL');
    expect(container.textContent).toContain('Runtime missing checks: 1');
    expect(container.textContent).toContain('Runtime command: npm run verify:smoke:runtime-prereqs-artifact');
    expect(container.textContent).toContain('Recommended Commands');
    expect(container.textContent).toContain('Governance Artifact History');
    expect(container.textContent).toContain('History Schema Versions');
    expect(container.textContent).toContain('Artifacts: 2');
    expect(container.textContent).toContain('campaigns');
    expect(container.textContent).toContain('Window: 7 days');
    expect(container.textContent).toContain('Limit: 500');
    expect(container.textContent).toContain('Schema v2 coverage: 100.0%');
    expect(container.textContent).toContain('Sales Schema Versions');
    expect(container.textContent).toContain('v2');
  });

  it('renders disabled warning when feature flags disable modules', async () => {
    setupQueryMocks({
      'sales-intelligence-page-portfolio': {
        error: new Error('Sales campaigns are disabled by feature flag.'),
      },
      'sales-intelligence-page-campaign': { data: undefined },
      'sales-intelligence-page-prediction-report': {
        error: new Error('Response prediction is disabled by feature flag.'),
      },
      'sales-intelligence-page-telemetry': {
        data: { eventCount: 0, errorEventCount: 0, trendByDay: [], salesIntelligence: { eventCount: 0, byEventFamily: {}, trendByDay: [] } },
      },
    });

    const createObjectUrlMock = jest.fn(() => 'blob:sales-governance-schema-contract');
    const revokeObjectUrlMock = jest.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectUrlMock,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectUrlMock,
    });

    await act(async () => {
      root.render(<SalesIntelligence />);
    });

    expect(container.textContent).toContain('currently disabled by feature flag');
  });

  it('renders fallback messaging when telemetry trend and family data are empty', async () => {
    setupQueryMocks({
      'sales-intelligence-page-portfolio': {
        data: {
          campaignCount: 1,
          activeCampaignCount: 1,
          portfolioTotals: { sent: 50, opened: 20, replied: 4 },
          averageReplyRate: 0.08,
          rankedCampaigns: [
            {
              campaignId: 'c1',
              name: 'SMB Outbound',
              status: 'active',
              totals: { sent: 50, opened: 20, replied: 4 },
              overall: { openRate: 0.4, replyRate: 0.08, qualityTier: 'watch' },
            },
          ],
        },
      },
      'sales-intelligence-page-campaign': {
        data: {
          campaignId: 'c1',
          name: 'SMB Outbound',
          status: 'active',
          totals: { sent: 50, opened: 20, replied: 4 },
          overall: { openRate: 0.4, replyRate: 0.08, replyToOpenRate: 0.2, qualityTier: 'watch' },
          byChannel: [],
          recommendations: [],
        },
      },
      'sales-intelligence-page-prediction-report': {
        data: {
          qualityTier: 'watch',
          rolloutDecision: 'hold',
          sampleSize: 40,
          meanAbsoluteCalibrationError: 0.19,
          recommendations: [],
        },
      },
      'sales-intelligence-page-telemetry': {
        data: {
          eventCount: 0,
          errorEventCount: 0,
          trendByDay: [],
          salesIntelligence: { eventCount: 0, byEventFamily: {} },
        },
      },
    });

    await act(async () => {
      root.render(<SalesIntelligence />);
    });

    expect(container.textContent).toContain('No telemetry trend data available in this window.');
    expect(container.textContent).toContain('No telemetry events captured in this window.');
  });

  it('renders telemetry metadata fallback when generated timestamp is unavailable', async () => {
    setupQueryMocks({
      'sales-intelligence-page-portfolio': {
        data: {
          campaignCount: 1,
          activeCampaignCount: 1,
          portfolioTotals: { sent: 50, opened: 20, replied: 4 },
          averageReplyRate: 0.08,
          rankedCampaigns: [
            {
              campaignId: 'c1',
              name: 'SMB Outbound',
              status: 'active',
              totals: { sent: 50, opened: 20, replied: 4 },
              overall: { openRate: 0.4, replyRate: 0.08, qualityTier: 'watch' },
            },
          ],
        },
      },
      'sales-intelligence-page-campaign': {
        data: {
          campaignId: 'c1',
          name: 'SMB Outbound',
          status: 'active',
          totals: { sent: 50, opened: 20, replied: 4 },
          overall: { openRate: 0.4, replyRate: 0.08, replyToOpenRate: 0.2, qualityTier: 'watch' },
          byChannel: [],
          recommendations: [],
        },
      },
      'sales-intelligence-page-prediction-report': {
        data: {
          qualityTier: 'watch',
          rolloutDecision: 'hold',
          sampleSize: 40,
          meanAbsoluteCalibrationError: 0.19,
          recommendations: [],
        },
      },
      'sales-intelligence-page-telemetry': {
        data: {
          eventCount: 0,
          errorEventCount: 0,
          trendByDay: [],
          salesIntelligence: { eventCount: 0, byEventFamily: {} },
        },
      },
    });

    await act(async () => {
      root.render(<SalesIntelligence />);
    });

    expect(container.textContent).toContain('Generated: n/a');
    expect(container.textContent).toContain('Window: 7 days');
    expect(container.textContent).toContain('Limit: 500');
  });

  it('renders rollback rollout playbook guidance for prediction decision rollback', async () => {
    setupQueryMocks({
      'sales-intelligence-page-portfolio': {
        data: {
          campaignCount: 1,
          activeCampaignCount: 1,
          portfolioTotals: { sent: 80, opened: 30, replied: 6 },
          averageReplyRate: 0.075,
          rankedCampaigns: [
            {
              campaignId: 'c2',
              name: 'Enterprise Reactivation',
              status: 'active',
              totals: { sent: 80, opened: 30, replied: 6 },
              overall: { openRate: 0.375, replyRate: 0.075, qualityTier: 'watch' },
            },
          ],
        },
      },
      'sales-intelligence-page-campaign': {
        data: {
          campaignId: 'c2',
          name: 'Enterprise Reactivation',
          status: 'active',
          totals: { sent: 80, opened: 30, replied: 6 },
          overall: { openRate: 0.375, replyRate: 0.075, replyToOpenRate: 0.2, qualityTier: 'watch' },
          byChannel: [],
          recommendations: [],
        },
      },
      'sales-intelligence-page-prediction-report': {
        data: {
          qualityTier: 'poor',
          rolloutDecision: 'rollback',
          sampleSize: 35,
          meanAbsoluteCalibrationError: 0.28,
          recommendations: ['Disable prediction-assisted guidance'],
        },
      },
      'sales-intelligence-page-telemetry': {
        data: {
          eventCount: 10,
          errorEventCount: 2,
          trendByDay: [{ date: '2026-02-21', events: 10, errors: 2, salesIntelligenceEvents: 7 }],
          salesIntelligence: { eventCount: 7, byEventFamily: { prediction: 7 } },
        },
      },
    });

    await act(async () => {
      root.render(<SalesIntelligence />);
    });

    expect(container.textContent).toContain('On-call Engineer');
    expect(container.textContent).toContain('Rollback prediction-assisted guidance and route to manual review.');
    expect(container.textContent).toContain('Disable prediction-dependent prompts for impacted users.');
  });

  it('normalizes telemetry filters and reissues telemetry query with bounded values', async () => {
    setupQueryMocks({
      'sales-intelligence-page-portfolio': {
        data: {
          campaignCount: 1,
          activeCampaignCount: 1,
          portfolioTotals: { sent: 80, opened: 30, replied: 6 },
          averageReplyRate: 0.075,
          rankedCampaigns: [
            {
              campaignId: 'c2',
              name: 'Enterprise Reactivation',
              status: 'active',
              totals: { sent: 80, opened: 30, replied: 6 },
              overall: { openRate: 0.375, replyRate: 0.075, qualityTier: 'watch' },
            },
          ],
        },
      },
      'sales-intelligence-page-campaign': {
        data: {
          campaignId: 'c2',
          name: 'Enterprise Reactivation',
          status: 'active',
          totals: { sent: 80, opened: 30, replied: 6 },
          overall: { openRate: 0.375, replyRate: 0.075, replyToOpenRate: 0.2, qualityTier: 'watch' },
          byChannel: [],
          recommendations: [],
        },
      },
      'sales-intelligence-page-prediction-report': {
        data: {
          qualityTier: 'watch',
          rolloutDecision: 'hold',
          sampleSize: 35,
          meanAbsoluteCalibrationError: 0.28,
          recommendations: [],
        },
      },
      'sales-intelligence-page-telemetry': {
        data: {
          generatedAt: '2026-02-22T10:00:00+00:00',
          windowDays: 7,
          eventCount: 10,
          errorEventCount: 2,
          trendByDay: [{ date: '2026-02-21', events: 10, errors: 2, salesIntelligenceEvents: 7 }],
          salesIntelligence: { eventCount: 7, byEventFamily: { prediction: 7 } },
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
            latestEvaluatedAt: '2026-02-22T09:58:00+00:00',
          },
          packetValidationAudit: {
            eventCount: 1,
            statusCounts: { ACTION_REQUIRED: 1 },
            withinFreshnessCount: 0,
            outsideFreshnessCount: 1,
            missingFreshnessCount: 0,
            latestEvaluatedAt: '2026-02-22T09:59:00+00:00',
          },
          recentEventsTotalCount: 1,
          recentEventsFilteredCount: 1,
          recentEventsPacketValidationCount: 0,
          recentEventsNonPacketCount: 1,
          recentEvents: [
            {
              eventType: 'integrations_traceability_governance_schema_viewed',
              provider: 'integrations',
              requestId: 'req-sales-telemetry-governance-schema-export',
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
    });

    await act(async () => {
      root.render(<SalesIntelligence />);
    });

    const daysInput = container.querySelector('[data-testid="sales-telemetry-days-input"]') as HTMLInputElement;
    const limitInput = container.querySelector('[data-testid="sales-telemetry-limit-input"]') as HTMLInputElement;
    const refreshButton = container.querySelector('[data-testid="sales-telemetry-refresh-btn"]') as HTMLButtonElement;

    expect(daysInput).toBeTruthy();
    expect(limitInput).toBeTruthy();
    expect(refreshButton).toBeTruthy();

    await act(async () => {
      setNumberInputValue(daysInput, '999');
      setNumberInputValue(limitInput, '9');
    });
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      refreshButton.click();
    });

    const telemetryCalls = mockUseQuery.mock.calls
      .map((entry) => entry[0])
      .filter((options) => Array.isArray(options?.queryKey) && options.queryKey[0] === 'sales-intelligence-page-telemetry');
    const latestTelemetryKey = telemetryCalls[telemetryCalls.length - 1].queryKey;

    expect(latestTelemetryKey[1]).toBe(30);
    expect(latestTelemetryKey[2]).toBe(50);
    expect(daysInput.value).toBe('30');
    expect(limitInput.value).toBe('50');
    expect(container.textContent).toContain('Telemetry filter values were normalized to allowed bounds.');
  });

  it('normalizes phrase and prediction feedback filters and reissues analytics query keys with bounded values', async () => {
    setupQueryMocks({
      'sales-intelligence-page-portfolio': {
        data: {
          campaignCount: 1,
          activeCampaignCount: 1,
          portfolioTotals: { sent: 100, opened: 32, replied: 7 },
          averageReplyRate: 0.07,
          rankedCampaigns: [
            {
              campaignId: 'c1',
              name: 'Enterprise Outbound',
              status: 'active',
              totals: { sent: 100, opened: 32, replied: 7 },
              overall: { openRate: 0.32, replyRate: 0.07, qualityTier: 'watch' },
            },
          ],
        },
      },
      'sales-intelligence-page-campaign': {
        data: {
          campaignId: 'c1',
          name: 'Enterprise Outbound',
          status: 'active',
          totals: { sent: 100, opened: 32, replied: 7 },
          overall: { openRate: 0.32, replyRate: 0.07, replyToOpenRate: 0.2188, qualityTier: 'watch' },
          byChannel: [],
          recommendations: [],
        },
      },
      'sales-intelligence-page-prediction-report': {
        data: {
          qualityTier: 'watch',
          rolloutDecision: 'hold',
          sampleSize: 42,
          meanAbsoluteCalibrationError: 0.2,
          recommendations: [],
        },
      },
      'sales-intelligence-page-phrase-analytics': {
        data: {
          phrases: [{ phrase: 'quick intro', exposureCount: 3, effectivenessScore: 0.2 }],
          summary: { trackedPhrases: 1, candidatePhraseCount: 4, minExposure: 2, topK: 8 },
          totalRecords: 8,
          windowDays: 90,
          generatedAt: '2026-02-22T10:00:00+00:00',
        },
      },
      'sales-intelligence-page-phrase-channel-summary': {
        data: {
          channels: [{ channel: 'email', totalRecords: 8, trackedPhrases: 1 }],
          channelCount: 1,
          totalRecords: 8,
          windowDays: 90,
          generatedAt: '2026-02-22T10:00:00+00:00',
        },
      },
      'sales-intelligence-page-prediction-performance': {
        data: {
          sampleSize: 6,
          positiveRate: 0.5,
          averagePredictedProbability: 0.52,
          meanAbsoluteCalibrationError: 0.16,
          byChannel: {
            email: { sampleSize: 6, positiveRate: 0.5, avgPredictedProbability: 0.52, meanAbsoluteCalibrationError: 0.16 },
          },
          windowDays: 90,
          generatedAt: '2026-02-22T10:00:00+00:00',
        },
      },
      'sales-intelligence-page-prediction-feedback-history': {
        data: {
          records: [{ id: 'fb-1', outcome: 'positive', channel: 'email' }],
          count: 1,
          windowDays: 90,
          generatedAt: '2026-02-22T10:00:00+00:00',
        },
      },
      'sales-intelligence-page-telemetry': {
        data: {
          generatedAt: '2026-02-22T10:00:00+00:00',
          windowDays: 7,
          eventCount: 10,
          errorEventCount: 0,
          trendByDay: [{ date: '2026-02-21', events: 10, errors: 0, salesIntelligenceEvents: 7 }],
          salesIntelligence: { eventCount: 7, byEventFamily: { prediction: 3, phrases: 4 } },
        },
      },
    });

    await act(async () => {
      root.render(<SalesIntelligence />);
    });

    const phraseDaysInput = container.querySelector('[data-testid="sales-phrase-window-days-input"]') as HTMLInputElement;
    const phraseMinExposureInput = container.querySelector('[data-testid="sales-phrase-min-exposure-input"]') as HTMLInputElement;
    const phraseLimitInput = container.querySelector('[data-testid="sales-phrase-limit-input"]') as HTMLInputElement;
    const phraseChannelLimitInput = container.querySelector('[data-testid="sales-phrase-channel-limit-input"]') as HTMLInputElement;
    const phraseRefreshButton = container.querySelector('[data-testid="sales-phrase-refresh-btn"]') as HTMLButtonElement;
    const predictionWindowDaysInput = container.querySelector(
      '[data-testid="sales-prediction-feedback-window-days-input"]'
    ) as HTMLInputElement;
    const predictionLimitInput = container.querySelector('[data-testid="sales-prediction-feedback-limit-input"]') as HTMLInputElement;
    const predictionRefreshButton = container.querySelector(
      '[data-testid="sales-prediction-feedback-refresh-btn"]'
    ) as HTMLButtonElement;

    await act(async () => {
      setNumberInputValue(phraseDaysInput, '9999');
      setNumberInputValue(phraseMinExposureInput, '0');
      setNumberInputValue(phraseLimitInput, '300');
      setNumberInputValue(phraseChannelLimitInput, '1');
      setNumberInputValue(predictionWindowDaysInput, '1');
      setNumberInputValue(predictionLimitInput, '9999');
    });
    await act(async () => {
      phraseRefreshButton.click();
      predictionRefreshButton.click();
    });

    expect(phraseDaysInput.value).toBe('365');
    expect(phraseMinExposureInput.value).toBe('1');
    expect(phraseLimitInput.value).toBe('100');
    expect(phraseChannelLimitInput.value).toBe('3');
    expect(predictionWindowDaysInput.value).toBe('14');
    expect(predictionLimitInput.value).toBe('500');
    expect(container.textContent).toContain('Prediction feedback filters were normalized to allowed bounds.');

    const phraseAnalyticsCall = mockUseQuery.mock.calls
      .map((entry) => entry[0])
      .filter((options) => Array.isArray(options?.queryKey) && options.queryKey[0] === 'sales-intelligence-page-phrase-analytics')
      .slice(-1)[0];
    const phraseChannelCall = mockUseQuery.mock.calls
      .map((entry) => entry[0])
      .filter((options) => Array.isArray(options?.queryKey) && options.queryKey[0] === 'sales-intelligence-page-phrase-channel-summary')
      .slice(-1)[0];
    const predictionPerformanceCall = mockUseQuery.mock.calls
      .map((entry) => entry[0])
      .filter((options) => Array.isArray(options?.queryKey) && options.queryKey[0] === 'sales-intelligence-page-prediction-performance')
      .slice(-1)[0];
    const predictionHistoryCall = mockUseQuery.mock.calls
      .map((entry) => entry[0])
      .filter((options) => Array.isArray(options?.queryKey) && options.queryKey[0] === 'sales-intelligence-page-prediction-feedback-history')
      .slice(-1)[0];

    expect(phraseAnalyticsCall.queryKey).toEqual(['sales-intelligence-page-phrase-analytics', 365, 1, 100]);
    expect(phraseChannelCall.queryKey).toEqual(['sales-intelligence-page-phrase-channel-summary', 365, 1, 3]);
    expect(predictionPerformanceCall.queryKey).toEqual(['sales-intelligence-page-prediction-performance', 14]);
    expect(predictionHistoryCall.queryKey).toEqual(['sales-intelligence-page-prediction-feedback-history', 14, 500]);
  });

  it('normalizes conversation and relationship controls and reissues query keys with bounded values', async () => {
    setupQueryMocks({
      'sales-intelligence-page-portfolio': {
        data: {
          campaignCount: 1,
          activeCampaignCount: 1,
          portfolioTotals: { sent: 100, opened: 32, replied: 7 },
          averageReplyRate: 0.07,
          rankedCampaigns: [
            {
              campaignId: 'c1',
              name: 'Enterprise Outbound',
              status: 'active',
              totals: { sent: 100, opened: 32, replied: 7 },
              overall: { openRate: 0.32, replyRate: 0.07, qualityTier: 'watch' },
            },
          ],
        },
      },
      'sales-intelligence-page-campaign': {
        data: {
          campaignId: 'c1',
          name: 'Enterprise Outbound',
          status: 'active',
          totals: { sent: 100, opened: 32, replied: 7 },
          overall: { openRate: 0.32, replyRate: 0.07, replyToOpenRate: 0.2188, qualityTier: 'watch' },
          byChannel: [],
          recommendations: [],
        },
      },
      'sales-intelligence-page-prediction-report': {
        data: {
          qualityTier: 'watch',
          rolloutDecision: 'hold',
          sampleSize: 42,
          meanAbsoluteCalibrationError: 0.2,
          recommendations: [],
        },
      },
      'sales-intelligence-page-conversation-intelligence': {
        data: {
          totals: { records: 8, channels: { chat: 2, email: 6 } },
          sentiment: { positive: 4, neutral: 3, negative: 1 },
          topObjections: [{ type: 'budget', count: 1 }],
          relationshipHealth: 'healthy',
          generatedAt: '2026-02-22T10:00:00+00:00',
          sources: { chatSessions: 2, emailEvents: 6 },
        },
      },
      'sales-intelligence-page-relationship-map': {
        data: {
          generatedAt: '2026-02-22T10:00:00+00:00',
          windowDays: 90,
          sourceCounts: { prospects: 1, companies: 1 },
          nodes: [{ id: 'p1', type: 'prospect', label: 'Alex Ng', score: 80 }],
          edges: [{ source: 'p1', target: 'c1', type: 'works_at', relationshipStrength: 80 }],
          stats: { prospects: 1, companies: 1, connections: 1, averageRelationshipStrength: 80 },
        },
      },
      'sales-intelligence-page-telemetry': {
        data: {
          generatedAt: '2026-02-22T10:00:00+00:00',
          windowDays: 7,
          eventCount: 10,
          errorEventCount: 0,
          trendByDay: [{ date: '2026-02-21', events: 10, errors: 0, salesIntelligenceEvents: 7 }],
          salesIntelligence: { eventCount: 7, byEventFamily: { prediction: 3, phrases: 4 } },
        },
      },
    });

    await act(async () => {
      root.render(<SalesIntelligence />);
    });

    const conversationWindowInput = container.querySelector(
      '[data-testid="sales-conversation-window-days-input"]'
    ) as HTMLInputElement;
    const conversationLimitInput = container.querySelector('[data-testid="sales-conversation-limit-input"]') as HTMLInputElement;
    const conversationRefreshButton = container.querySelector('[data-testid="sales-conversation-refresh-btn"]') as HTMLButtonElement;
    const relationshipWindowInput = container.querySelector(
      '[data-testid="sales-relationship-window-days-input"]'
    ) as HTMLInputElement;
    const relationshipLimitInput = container.querySelector('[data-testid="sales-relationship-limit-input"]') as HTMLInputElement;
    const relationshipRefreshButton = container.querySelector('[data-testid="sales-relationship-refresh-btn"]') as HTMLButtonElement;

    await act(async () => {
      setNumberInputValue(conversationWindowInput, '1000');
      setNumberInputValue(conversationLimitInput, '20000');
      setNumberInputValue(relationshipWindowInput, '1000');
      setNumberInputValue(relationshipLimitInput, '1');
    });
    await act(async () => {
      conversationRefreshButton.click();
      relationshipRefreshButton.click();
    });

    expect(conversationWindowInput.value).toBe('365');
    expect(conversationLimitInput.value).toBe('1000');
    expect(relationshipWindowInput.value).toBe('365');
    expect(relationshipLimitInput.value).toBe('50');
    expect(container.textContent).toContain('Relationship map controls were normalized to allowed bounds.');

    const conversationCall = mockUseQuery.mock.calls
      .map((entry) => entry[0])
      .filter((options) => Array.isArray(options?.queryKey) && options.queryKey[0] === 'sales-intelligence-page-conversation-intelligence')
      .slice(-1)[0];
    const relationshipCall = mockUseQuery.mock.calls
      .map((entry) => entry[0])
      .filter((options) => Array.isArray(options?.queryKey) && options.queryKey[0] === 'sales-intelligence-page-relationship-map')
      .slice(-1)[0];

    expect(conversationCall.queryKey).toEqual(['sales-intelligence-page-conversation-intelligence', 365, 1000]);
    expect(relationshipCall.queryKey).toEqual(['sales-intelligence-page-relationship-map', 365, 50]);
  });

  it('normalizes multi-channel limits and reissues query key with bounded values', async () => {
    setupQueryMocks({
      'sales-intelligence-page-portfolio': {
        data: {
          campaignCount: 1,
          activeCampaignCount: 1,
          portfolioTotals: { sent: 100, opened: 32, replied: 7 },
          averageReplyRate: 0.07,
          rankedCampaigns: [
            {
              campaignId: 'c1',
              name: 'Enterprise Outbound',
              status: 'active',
              totals: { sent: 100, opened: 32, replied: 7 },
              overall: { openRate: 0.32, replyRate: 0.07, qualityTier: 'watch' },
            },
          ],
        },
      },
      'sales-intelligence-page-campaign': {
        data: {
          campaignId: 'c1',
          name: 'Enterprise Outbound',
          status: 'active',
          totals: { sent: 100, opened: 32, replied: 7 },
          overall: { openRate: 0.32, replyRate: 0.07, replyToOpenRate: 0.2188, qualityTier: 'watch' },
          byChannel: [],
          recommendations: [],
        },
      },
      'sales-intelligence-page-multi-channel-engagement': {
        data: {
          activeChannels: ['email', 'linkedin'],
          coverageScore: 50,
          coverageReliabilityTier: 'medium',
          coverageRecommendation: 'Coverage is moderate. Add one additional high-intent channel before expansion.',
          windowDays: 75,
          channelUsage: { email: 6, linkedin: 2, phone: 0, sms: 0 },
          recommendations: [],
          sourceCounts: { campaigns: 1, abTests: 1, prospects: 2 },
          appliedLimits: { windowDays: 75, campaigns: 333, abTests: 444, prospects: 555 },
          generatedAt: '2026-02-22T10:00:00+00:00',
        },
      },
      'sales-intelligence-page-telemetry': {
        data: {
          generatedAt: '2026-02-22T10:00:00+00:00',
          windowDays: 7,
          eventCount: 10,
          errorEventCount: 0,
          trendByDay: [{ date: '2026-02-21', events: 10, errors: 0, salesIntelligenceEvents: 7 }],
          salesIntelligence: { eventCount: 7, byEventFamily: { channels: 3 } },
        },
      },
    });

    await act(async () => {
      root.render(<SalesIntelligence />);
    });

    const windowDaysInput = container.querySelector(
      '[data-testid="sales-multi-channel-window-days-input"]'
    ) as HTMLInputElement;
    const campaignLimitInput = container.querySelector(
      '[data-testid="sales-multi-channel-campaign-limit-input"]'
    ) as HTMLInputElement;
    const abTestLimitInput = container.querySelector(
      '[data-testid="sales-multi-channel-ab-test-limit-input"]'
    ) as HTMLInputElement;
    const prospectLimitInput = container.querySelector(
      '[data-testid="sales-multi-channel-prospect-limit-input"]'
    ) as HTMLInputElement;
    const refreshButton = container.querySelector('[data-testid="sales-multi-channel-refresh-btn"]') as HTMLButtonElement;

    await act(async () => {
      setNumberInputValue(windowDaysInput, '1');
      setNumberInputValue(campaignLimitInput, '1');
      setNumberInputValue(abTestLimitInput, '20000');
      setNumberInputValue(prospectLimitInput, '1');
    });
    await act(async () => {
      refreshButton.click();
    });

    expect(windowDaysInput.value).toBe('14');
    expect(campaignLimitInput.value).toBe('10');
    expect(abTestLimitInput.value).toBe('10000');
    expect(prospectLimitInput.value).toBe('50');
    expect(container.textContent).toContain('Multi-channel controls were normalized to allowed bounds.');

    const multiChannelCall = mockUseQuery.mock.calls
      .map((entry) => entry[0])
      .filter((options) => Array.isArray(options?.queryKey) && options.queryKey[0] === 'sales-intelligence-page-multi-channel-engagement')
      .slice(-1)[0];
    expect(multiChannelCall.queryKey).toEqual(['sales-intelligence-page-multi-channel-engagement', 14, 10, 10000, 50]);
  });

  it('normalizes campaign portfolio controls and reissues query key with bounded values', async () => {
    setupQueryMocks({
      'sales-intelligence-page-portfolio': {
        data: {
          campaignCount: 2,
          activeCampaignCount: 1,
          portfolioTotals: { sent: 150, opened: 48, replied: 12 },
          averageReplyRate: 0.08,
          statusFilter: 'all',
          rankedCampaigns: [
            {
              campaignId: 'c2',
              name: 'Enterprise Reactivation',
              status: 'active',
              totals: { sent: 80, opened: 30, replied: 6 },
              overall: { openRate: 0.375, replyRate: 0.075, qualityTier: 'watch' },
            },
          ],
        },
      },
      'sales-intelligence-page-campaign': {
        data: {
          campaignId: 'c2',
          name: 'Enterprise Reactivation',
          status: 'active',
          totals: { sent: 80, opened: 30, replied: 6 },
          overall: { openRate: 0.375, replyRate: 0.075, replyToOpenRate: 0.2, qualityTier: 'watch' },
          byChannel: [],
          recommendations: [],
        },
      },
      'sales-intelligence-page-telemetry': {
        data: {
          generatedAt: '2026-02-22T10:00:00+00:00',
          windowDays: 7,
          eventCount: 10,
          errorEventCount: 0,
          trendByDay: [{ date: '2026-02-21', events: 10, errors: 0, salesIntelligenceEvents: 7 }],
          salesIntelligence: { eventCount: 7, byEventFamily: { campaigns: 4 } },
        },
      },
    });

    await act(async () => {
      root.render(<SalesIntelligence />);
    });

    const portfolioWindowInput = container.querySelector('[data-testid="sales-portfolio-window-days-input"]') as HTMLInputElement;
    const portfolioLimitInput = container.querySelector('[data-testid="sales-portfolio-limit-input"]') as HTMLInputElement;
    const portfolioStatusSelect = container.querySelector('[data-testid="sales-portfolio-status-select"]') as HTMLSelectElement;
    const portfolioRefreshButton = container.querySelector('[data-testid="sales-portfolio-refresh-btn"]') as HTMLButtonElement;

    await act(async () => {
      setNumberInputValue(portfolioWindowInput, '9999');
      setNumberInputValue(portfolioLimitInput, '1');
      setSelectValue(portfolioStatusSelect, 'completed');
    });
    await act(async () => {
      portfolioRefreshButton.click();
    });

    expect(portfolioWindowInput.value).toBe('365');
    expect(portfolioLimitInput.value).toBe('5');
    expect(portfolioStatusSelect.value).toBe('completed');
    expect(container.textContent).toContain('Campaign portfolio filters were normalized to allowed bounds.');

    const portfolioCall = mockUseQuery.mock.calls
      .map((entry) => entry[0])
      .filter((options) => Array.isArray(options?.queryKey) && options.queryKey[0] === 'sales-intelligence-page-portfolio')
      .slice(-1)[0];

    expect(portfolioCall.queryKey).toEqual(['sales-intelligence-page-portfolio', 365, 'completed', 5]);
  });

  it('normalizes campaign performance channel limit and reissues query key with bounded values', async () => {
    setupQueryMocks({
      'sales-intelligence-page-portfolio': {
        data: {
          campaignCount: 2,
          activeCampaignCount: 1,
          portfolioTotals: { sent: 150, opened: 48, replied: 12 },
          averageReplyRate: 0.08,
          statusFilter: 'all',
          rankedCampaigns: [
            {
              campaignId: 'c2',
              name: 'Enterprise Reactivation',
              status: 'active',
              totals: { sent: 80, opened: 30, replied: 6 },
              overall: { openRate: 0.375, replyRate: 0.075, qualityTier: 'watch' },
            },
          ],
        },
      },
      'sales-intelligence-page-campaign': {
        data: {
          campaignId: 'c2',
          name: 'Enterprise Reactivation',
          status: 'active',
          totals: { sent: 80, opened: 30, replied: 6 },
          overall: { openRate: 0.375, replyRate: 0.075, replyToOpenRate: 0.2, qualityTier: 'watch' },
          byChannel: [
            { channel: 'email', sent: 60, opened: 20, replied: 5, openRate: 0.333, replyRate: 0.083 },
            { channel: 'linkedin', sent: 20, opened: 10, replied: 1, openRate: 0.5, replyRate: 0.05 },
          ],
          channelCount: 2,
          displayedChannelCount: 2,
          appliedChannelLimit: 10,
          channelsTruncated: false,
          recommendations: [],
        },
      },
      'sales-intelligence-page-telemetry': {
        data: {
          generatedAt: '2026-02-22T10:00:00+00:00',
          windowDays: 7,
          eventCount: 10,
          errorEventCount: 0,
          trendByDay: [{ date: '2026-02-21', events: 10, errors: 0, salesIntelligenceEvents: 7 }],
          salesIntelligence: { eventCount: 7, byEventFamily: { campaigns: 4 } },
        },
      },
    });

    await act(async () => {
      root.render(<SalesIntelligence />);
    });

    const campaignChannelLimitInput = container.querySelector(
      '[data-testid="sales-campaign-performance-channel-limit-input"]'
    ) as HTMLInputElement;
    const campaignPerformanceRefreshButton = container.querySelector(
      '[data-testid="sales-campaign-performance-refresh-btn"]'
    ) as HTMLButtonElement;

    await act(async () => {
      setNumberInputValue(campaignChannelLimitInput, '999');
      campaignPerformanceRefreshButton.click();
    });

    expect(campaignChannelLimitInput.value).toBe('20');
    expect(container.textContent).toContain('Campaign performance channel limit was normalized to allowed bounds.');

    const campaignPerformanceCall = mockUseQuery.mock.calls
      .map((entry) => entry[0])
      .filter((options) => Array.isArray(options?.queryKey) && options.queryKey[0] === 'sales-intelligence-page-campaign')
      .slice(-1)[0];

    expect(campaignPerformanceCall.queryKey).toEqual(['sales-intelligence-page-campaign', 'c2', 20]);
  });

  it('normalizes forecast and prediction windows and reissues query keys with bounded values', async () => {
    setupQueryMocks({
      'sales-intelligence-page-portfolio': {
        data: {
          campaignCount: 1,
          activeCampaignCount: 1,
          portfolioTotals: { sent: 100, opened: 32, replied: 7 },
          averageReplyRate: 0.07,
          rankedCampaigns: [
            {
              campaignId: 'c1',
              name: 'Enterprise Outbound',
              status: 'active',
              totals: { sent: 100, opened: 32, replied: 7 },
              overall: { openRate: 0.32, replyRate: 0.07, qualityTier: 'watch' },
            },
          ],
        },
      },
      'sales-intelligence-page-campaign': {
        data: {
          campaignId: 'c1',
          name: 'Enterprise Outbound',
          status: 'active',
          totals: { sent: 100, opened: 32, replied: 7 },
          overall: { openRate: 0.32, replyRate: 0.07, replyToOpenRate: 0.2188, qualityTier: 'watch' },
          byChannel: [],
          recommendations: [],
        },
      },
      'sales-intelligence-page-pipeline-forecast': {
        data: {
          openPipelineValue: 500000,
          weightedPipelineValue: 280000,
          projectedWonValue: 170000,
          historicalWinRate: 40.5,
          confidenceInterval: { low: 140000, high: 200000, confidenceLevel: 95 },
          confidenceIntervalWidth: 60000,
          confidenceIntervalWidthPct: 35.3,
          forecastReliabilityTier: 'high',
          forecastRecommendation: 'Proceed with current rollout.',
          sampleSize: { openProspects: 12, closedOutcomes: 20 },
          windowDays: 90,
          generatedAt: '2026-02-22T10:00:00+00:00',
        },
      },
      'sales-intelligence-page-prediction-report': {
        data: {
          qualityTier: 'watch',
          rolloutDecision: 'hold',
          sampleSize: 42,
          meanAbsoluteCalibrationError: 0.2,
          recommendations: [],
        },
      },
      'sales-intelligence-page-telemetry': {
        data: {
          generatedAt: '2026-02-22T10:00:00+00:00',
          windowDays: 7,
          eventCount: 10,
          errorEventCount: 0,
          trendByDay: [{ date: '2026-02-21', events: 10, errors: 0, salesIntelligenceEvents: 7 }],
          salesIntelligence: { eventCount: 7, byEventFamily: { prediction: 3, phrases: 4 } },
        },
      },
    });

    await act(async () => {
      root.render(<SalesIntelligence />);
    });

    const forecastWindowInput = container.querySelector('[data-testid="sales-forecast-window-days-input"]') as HTMLInputElement;
    const forecastRefreshButton = container.querySelector('[data-testid="sales-forecast-refresh-btn"]') as HTMLButtonElement;
    const predictionWindowInput = container.querySelector('[data-testid="sales-prediction-window-days-input"]') as HTMLInputElement;
    const predictionRefreshButton = container.querySelector('[data-testid="sales-prediction-refresh-btn"]') as HTMLButtonElement;

    await act(async () => {
      setNumberInputValue(forecastWindowInput, '1');
      setNumberInputValue(predictionWindowInput, '9999');
    });
    await act(async () => {
      forecastRefreshButton.click();
      predictionRefreshButton.click();
    });

    expect(forecastWindowInput.value).toBe('30');
    expect(predictionWindowInput.value).toBe('365');
    expect(container.textContent).toContain('Prediction report window was normalized to allowed bounds.');

    const forecastCall = mockUseQuery.mock.calls
      .map((entry) => entry[0])
      .filter((options) => Array.isArray(options?.queryKey) && options.queryKey[0] === 'sales-intelligence-page-pipeline-forecast')
      .slice(-1)[0];
    const predictionCall = mockUseQuery.mock.calls
      .map((entry) => entry[0])
      .filter((options) => Array.isArray(options?.queryKey) && options.queryKey[0] === 'sales-intelligence-page-prediction-report')
      .slice(-1)[0];

    expect(forecastCall.queryKey).toEqual(['sales-intelligence-page-pipeline-forecast', 30]);
    expect(predictionCall.queryKey).toEqual(['sales-intelligence-page-prediction-report', 365]);
  });

  it('exports telemetry snapshot with non-default window metadata and supports notice dismissal', async () => {
    setupQueryMocks({
      'sales-intelligence-page-portfolio': {
        data: {
          campaignCount: 1,
          activeCampaignCount: 1,
          portfolioTotals: { sent: 80, opened: 30, replied: 6 },
          averageReplyRate: 0.075,
          rankedCampaigns: [
            {
              campaignId: 'c2',
              name: 'Enterprise Reactivation',
              status: 'active',
              totals: { sent: 80, opened: 30, replied: 6 },
              overall: { openRate: 0.375, replyRate: 0.075, qualityTier: 'watch' },
            },
          ],
        },
      },
      'sales-intelligence-page-campaign': {
        data: {
          campaignId: 'c2',
          name: 'Enterprise Reactivation',
          status: 'active',
          totals: { sent: 80, opened: 30, replied: 6 },
          overall: { openRate: 0.375, replyRate: 0.075, replyToOpenRate: 0.2, qualityTier: 'watch' },
          byChannel: [],
          recommendations: [],
        },
      },
      'sales-intelligence-page-prediction-report': {
        data: {
          qualityTier: 'watch',
          rolloutDecision: 'hold',
          sampleSize: 35,
          meanAbsoluteCalibrationError: 0.28,
          recommendations: [],
        },
      },
      'sales-intelligence-page-telemetry': {
        data: {
          generatedAt: '2026-02-22T10:00:00+00:00',
          windowDays: 7,
          eventCount: 10,
          errorEventCount: 2,
          trendByDay: [{ date: '2026-02-21', events: 10, errors: 2, salesIntelligenceEvents: 7 }],
          salesIntelligence: { eventCount: 7, byEventFamily: { prediction: 7 } },
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
            latestEvaluatedAt: '2026-02-22T09:58:00+00:00',
          },
          packetValidationAudit: {
            eventCount: 1,
            statusCounts: { ACTION_REQUIRED: 1 },
            withinFreshnessCount: 0,
            outsideFreshnessCount: 1,
            missingFreshnessCount: 0,
            latestEvaluatedAt: '2026-02-22T09:59:00+00:00',
          },
          recentEventsTotalCount: 1,
          recentEventsFilteredCount: 1,
          recentEventsPacketValidationCount: 0,
          recentEventsNonPacketCount: 1,
          recentEvents: [
            {
              eventType: 'integrations_traceability_governance_schema_viewed',
              provider: 'integrations',
              requestId: 'req-sales-telemetry-governance-schema-export',
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
    });

    const originalCreateElement = document.createElement.bind(document);
    const anchorClick = jest.fn();
    const createElementSpy = jest
      .spyOn(document, 'createElement')
      .mockImplementation((tagName: any, options?: any) => {
        const element = originalCreateElement(tagName, options);
        if (String(tagName).toLowerCase() === 'a') {
          Object.defineProperty(element, 'click', {
            configurable: true,
            value: anchorClick,
          });
        }
        return element;
      });
    const createObjectUrlMock = jest.fn(() => 'blob:sales-test');
    const revokeObjectUrlMock = jest.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectUrlMock,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectUrlMock,
    });

    await act(async () => {
      root.render(<SalesIntelligence />);
    });

    const telemetryDaysInput = container.querySelector('[data-testid="sales-telemetry-days-input"]') as HTMLInputElement;
    const telemetryLimitInput = container.querySelector('[data-testid="sales-telemetry-limit-input"]') as HTMLInputElement;
    const telemetryRefreshButton = container.querySelector('[data-testid="sales-telemetry-refresh-btn"]') as HTMLButtonElement;
    expect(telemetryDaysInput).toBeTruthy();
    expect(telemetryLimitInput).toBeTruthy();
    expect(telemetryRefreshButton).toBeTruthy();

    await act(async () => {
      setNumberInputValue(telemetryDaysInput, '21');
      setNumberInputValue(telemetryLimitInput, '1200');
    });
    await act(async () => {
      telemetryRefreshButton.click();
    });

    const telemetryCalls = mockUseQuery.mock.calls
      .map((entry) => entry[0])
      .filter((options) => Array.isArray(options?.queryKey) && options.queryKey[0] === 'sales-intelligence-page-telemetry');
    const latestTelemetryQuery = telemetryCalls[telemetryCalls.length - 1];
    expect(latestTelemetryQuery.queryKey[1]).toBe(21);
    expect(latestTelemetryQuery.queryKey[2]).toBe(1200);

    const exportButton = container.querySelector('[data-testid="sales-telemetry-export-btn"]') as HTMLButtonElement;
    expect(exportButton).toBeTruthy();

    await act(async () => {
      exportButton.click();
    });

    expect(createObjectUrlMock).toHaveBeenCalled();
    const telemetryBlob = createObjectUrlMock.mock.calls[createObjectUrlMock.mock.calls.length - 1][0] as Blob;
    const telemetryPayload = JSON.parse(await readBlobAsText(telemetryBlob));
    expect(telemetryPayload.packetValidationAudit.eventCount).toBe(1);
    expect(telemetryPayload.packetValidationAudit.statusCounts.ACTION_REQUIRED).toBe(1);
    expect(telemetryPayload.governanceSchemaAudit.eventCount).toBe(2);
    expect(telemetryPayload.governanceSchemaAudit.reasonCodeParityPassCount).toBe(1);
    expect(telemetryPayload.governanceSchemaAudit.reasonCodeParityFailCount).toBe(1);
    expect(telemetryPayload.recentEvents[0].governanceSchemaAllParityOk).toBe(false);
    expect(telemetryPayload.recentEvents[0].governanceSchemaRolloutBlocked).toBe(true);
    expect(telemetryPayload.recentEvents[0].governanceSchemaReasonCodeCount).toBe(2);
    expect(telemetryPayload.recentEvents[0].governanceSchemaRecommendedCommandCount).toBe(1);
    expect(telemetryPayload.exportRequestedWindowDays).toBe(21);
    expect(telemetryPayload.exportRequestedLimit).toBe(1200);
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
    expect(telemetryPayload.exportRecentEventsPacketValidationCount).toBe(0);
    expect(telemetryPayload.exportRecentEventsNonPacketCount).toBe(1);
    expect(telemetryPayload.exportConnectorRateLimitPressureLabel).toBe('Unknown');
    expect(telemetryPayload.exportConnectorRateLimitPressureSignalSeconds).toBe(0);
    expect(telemetryPayload.exportConnectorRateLimitEventCount).toBe(0);
    expect(telemetryPayload.exportConnectorRateLimitLatestEventAt).toBeNull();
    expect(telemetryPayload.exportConnectorValidationEventCount).toBe(0);
    expect(telemetryPayload.exportConnectorValidationLatestEventAt).toBeNull();
    expect(telemetryPayload.exportConnectorValidationEndpointCount).toBe(0);
    expect(telemetryPayload.exportConnectorValidationProviderCount).toBe(0);
    expect(telemetryPayload.exportConnectorValidationFieldCount).toBe(0);
    expect(telemetryPayload.exportConnectorValidationReasonCount).toBe(0);
    expect(telemetryPayload.exportRetryAuditEventCount).toBe(0);
    expect(telemetryPayload.exportRetryAuditLatestEventAt).toBeNull();
    expect(telemetryPayload.exportRetryAuditMaxNextDelaySeconds).toBeNull();
    expect(telemetryPayload.exportRetryAuditAvgNextDelaySeconds).toBeNull();
    expect(telemetryPayload.exportRetryAuditOperationCount).toBe(0);
    expect(telemetryPayload.exportRetryAuditProviderCount).toBe(0);
    expect(telemetryPayload.exportOrchestrationAuditEventCount).toBe(0);
    expect(telemetryPayload.exportOrchestrationAuditLatestEventAt).toBeNull();
    expect(telemetryPayload.exportOrchestrationAuditMaxAttemptCount).toBeNull();
    expect(telemetryPayload.exportOrchestrationAuditAvgAttemptCount).toBeNull();
    expect(telemetryPayload.exportOrchestrationAuditProviderCount).toBe(0);
    expect(telemetryPayload.exportOrchestrationAuditReasonCodeCount).toBe(0);
    expect(revokeObjectUrlMock).toHaveBeenCalled();
    expect(anchorClick).toHaveBeenCalled();
    expect(container.textContent).toContain('sales-telemetry-summary exported.');

    const dismissButton = container.querySelector('[data-testid="sales-operation-notice-dismiss"]') as HTMLButtonElement;
    expect(dismissButton).toBeTruthy();
    await act(async () => {
      dismissButton.click();
    });
    expect(container.querySelector('[data-testid="sales-operation-notice"]')).toBeNull();

    createElementSpy.mockRestore();
  });

  it('renders high connector throttle pressure and exports connector pressure metadata', async () => {
    setupQueryMocks({
      'sales-intelligence-page-portfolio': {
        data: {
          campaignCount: 1,
          activeCampaignCount: 1,
          portfolioTotals: { sent: 10, opened: 4, replied: 1 },
          averageReplyRate: 0.1,
          rankedCampaigns: [
            {
              campaignId: 'c-high-pressure',
              name: 'Connector Pressure High',
              status: 'active',
              totals: { sent: 10, opened: 4, replied: 1 },
              overall: { openRate: 0.4, replyRate: 0.1, qualityTier: 'watch' },
            },
          ],
        },
      },
      'sales-intelligence-page-campaign': {
        data: {
          campaignId: 'c-high-pressure',
          name: 'Connector Pressure High',
          status: 'active',
          totals: { sent: 10, opened: 4, replied: 1 },
          overall: { openRate: 0.4, replyRate: 0.1, replyToOpenRate: 0.25, qualityTier: 'watch' },
          byChannel: [],
          recommendations: [],
        },
      },
      'sales-intelligence-page-prediction-report': {
        data: {
          qualityTier: 'watch',
          rolloutDecision: 'hold',
          sampleSize: 10,
          meanAbsoluteCalibrationError: 0.25,
          recommendations: [],
        },
      },
      'sales-intelligence-page-telemetry': {
        data: {
          generatedAt: '2026-02-22T10:00:00+00:00',
          windowDays: 7,
          eventCount: 5,
          errorEventCount: 0,
          trendByDay: [{ date: '2026-02-21', events: 5, errors: 0, salesIntelligenceEvents: 3, orchestrationEvents: 2 }],
          salesIntelligence: { eventCount: 3, byEventFamily: { prediction: 3 } },
          connectorRateLimit: {
            eventCount: 3,
            byEndpoint: {
              apollo_search: 2,
              company_enrichment_orchestration: 1,
            },
            latestEventAt: '2026-02-22T09:58:00+00:00',
            maxRetryAfterSeconds: 46,
            avgRetryAfterSeconds: 32.5,
            maxResetInSeconds: 44,
            avgResetInSeconds: 22.1,
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
            latestEventAt: '2026-02-22T09:58:30+00:00',
          },
          retryAudit: {
            eventCount: 3,
            byOperation: {
              sendgrid_send_email: 2,
              sendgrid_health_check: 1,
            },
            byProvider: {
              sendgrid: 3,
            },
            maxNextDelaySeconds: 1,
            avgNextDelaySeconds: 0.55,
            latestEventAt: '2026-02-22T09:59:00+00:00',
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
            latestEventAt: '2026-02-22T09:59:30+00:00',
          },
          recentEvents: [
            {
              provider: 'integrations',
              eventType: 'company_enrichment_orchestrated',
              requestId: 'req-pressure-orchestration',
              orchestrationSelectedProvider: 'apollo',
              orchestrationAttemptCount: 3,
              orchestrationAttemptSuccessCount: 1,
              orchestrationAttemptSkippedCount: 1,
              orchestrationAttemptErrorCount: 1,
              orchestrationResultCount: 2,
            },
            {
              provider: 'integrations',
              eventType: 'integrations_connector_rate_limited',
              requestId: 'req-pressure-high',
              connectorRateLimitEndpoint: 'apollo_search',
              connectorRateLimitRetryAfterSeconds: 46,
              connectorRateLimitResetInSeconds: 44,
            },
            {
              provider: 'integrations',
              eventType: 'integrations_connector_input_validation_failed',
              requestId: 'req-pressure-validation',
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
              provider: 'integrations',
              eventType: 'integrations_retry_attempt',
              requestId: 'req-pressure-retry',
              retryOperation: 'sendgrid_send_email',
              retryAttempt: 2,
              retryMaxAttempts: 3,
              retryNextDelaySeconds: 1,
              retryError: '503 temporarily unavailable',
              retryFinalOutcome: 'fail-fast',
              retryRetryable: false,
              retryErrorType: 'provider_auth_error',
              retryErrorStatusCode: 401,
              retryErrorReasonCode: 'provider_auth_error',
            },
          ],
          packetValidationAudit: {
            eventCount: 0,
            statusCounts: {},
            withinFreshnessCount: 0,
            outsideFreshnessCount: 0,
            missingFreshnessCount: 0,
            latestEvaluatedAt: null,
          },
        },
      },
      'sales-intelligence-page-integrations-health': {
        data: {
          generatedAt: '2026-02-22T10:00:00+00:00',
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
          alerts: [],
          recommendedCommands: ['npm run verify:smoke:credential-freshness'],
          providers: [],
        },
      },
    });

    const createObjectUrlMock = jest.fn(() => 'blob:sales-pressure-high');
    const revokeObjectUrlMock = jest.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectUrlMock,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectUrlMock,
    });

    await act(async () => {
      root.render(<SalesIntelligence />);
    });

    expect(container.textContent).toContain('Connector throttle pressure: High.');
    expect(container.textContent).toContain('Connector Input-Validation Posture');
    expect(container.textContent).toContain('Retry Audit');
    expect(container.textContent).toContain('Orchestration Audit');
    expect(container.textContent).toContain('Connector Credential Freshness');
    expect(container.textContent).toContain('Credential freshness warning for: clearbit.');
    expect(container.textContent).toContain('Orchestration trend events: 2');
    expect(container.textContent).toContain('sendgrid_send_email');
    expect(container.textContent).toContain('domain_required');
    expect(container.textContent).toContain('retry sendgrid_send_email attempt 2/3 next 1s error 503 temporarily unavailable');
    expect(container.textContent).toContain('Retry Terminal Outcomes');
    expect(container.textContent).toContain('pressure Moderate');
    expect(container.textContent).toContain('top outcome FAIL_FAST (1)');
    expect(container.textContent).toContain('top reason PROVIDER_AUTH_ERROR (1)');
    expect(container.textContent).toContain('top status 401 (1)');
    expect(container.textContent).toContain('retry terminal outcome FAIL_FAST non-retryable type PROVIDER_AUTH_ERROR status 401 reason PROVIDER_AUTH_ERROR');
    expect(container.textContent).toContain('orchestration provider apollo attempts 3 (s 1 / sk 1 / e 1) results 2');
    expect(container.textContent).toContain('apollo_search');
    expect(container.textContent).toContain('connector apollo_search reset 44s retry 46s');
    expect(container.textContent).toContain('validation apollo_search field limit reason range code invalid_request_bounds received 0 min 1 max 25');

    const exportButton = container.querySelector('[data-testid="sales-telemetry-export-btn"]') as HTMLButtonElement;
    expect(exportButton).toBeTruthy();
    await act(async () => {
      exportButton.click();
    });

    const telemetryBlob = createObjectUrlMock.mock.calls[createObjectUrlMock.mock.calls.length - 1][0] as Blob;
    const telemetryPayload = JSON.parse(await readBlobAsText(telemetryBlob));
    expect(telemetryPayload.exportConnectorRateLimitPressureLabel).toBe('High');
    expect(telemetryPayload.exportConnectorRateLimitPressureSignalSeconds).toBe(46);
    expect(telemetryPayload.exportConnectorRateLimitEventCount).toBe(3);
    expect(telemetryPayload.exportConnectorRateLimitLatestEventAt).toBe('2026-02-22T09:58:00+00:00');
    expect(telemetryPayload.exportConnectorValidationEventCount).toBe(3);
    expect(telemetryPayload.exportConnectorValidationLatestEventAt).toBe('2026-02-22T09:58:30+00:00');
    expect(telemetryPayload.exportConnectorValidationEndpointCount).toBe(2);
    expect(telemetryPayload.exportConnectorValidationProviderCount).toBe(2);
    expect(telemetryPayload.exportConnectorValidationFieldCount).toBe(2);
    expect(telemetryPayload.exportConnectorValidationReasonCount).toBe(2);
    expect(telemetryPayload.exportRetryAuditEventCount).toBe(3);
    expect(telemetryPayload.exportRetryAuditLatestEventAt).toBe('2026-02-22T09:59:00+00:00');
    expect(telemetryPayload.exportRetryAuditMaxNextDelaySeconds).toBe(1);
    expect(telemetryPayload.exportRetryAuditAvgNextDelaySeconds).toBe(0.55);
    expect(telemetryPayload.exportRetryAuditOperationCount).toBe(2);
    expect(telemetryPayload.exportRetryAuditProviderCount).toBe(1);
    expect(telemetryPayload.exportRetryTerminalEventCount).toBe(1);
    expect(telemetryPayload.exportRetryTerminalOutcomeCounts.FAIL_FAST).toBe(1);
    expect(telemetryPayload.exportRetryTerminalRetryabilityCounts.NON_RETRYABLE).toBe(1);
    expect(telemetryPayload.exportRetryTerminalErrorTypeCounts.PROVIDER_AUTH_ERROR).toBe(1);
    expect(telemetryPayload.exportRetryTerminalReasonCodeCounts.PROVIDER_AUTH_ERROR).toBe(1);
    expect(telemetryPayload.exportRetryTerminalStatusCodeCounts['401']).toBe(1);
    expect(telemetryPayload.exportRetryTerminalPressureLabel).toBe('Moderate');
    expect(telemetryPayload.exportRetryTerminalPressureSignalCount).toBe(1);
    expect(telemetryPayload.exportRetryTerminalTopOutcome).toEqual({ key: 'FAIL_FAST', count: 1 });
    expect(telemetryPayload.exportRetryTerminalTopReasonCode).toEqual({ key: 'PROVIDER_AUTH_ERROR', count: 1 });
    expect(telemetryPayload.exportRetryTerminalTopStatusCode).toEqual({ key: '401', count: 1 });
    expect(telemetryPayload.exportOrchestrationAuditEventCount).toBe(2);
    expect(telemetryPayload.exportOrchestrationAuditLatestEventAt).toBe('2026-02-22T09:59:30+00:00');
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
    expect(telemetryPayload.exportIntegrationHealthCredentialFreshnessActionRequiredCount).toBe(1);
    expect(telemetryPayload.exportIntegrationHealthCredentialFreshnessWithinPolicyCount).toBe(2);
    expect(telemetryPayload.exportIntegrationHealthCredentialFreshnessUnknownCount).toBe(1);
    expect(telemetryPayload.exportIntegrationHealthCredentialActionRequiredProviders).toEqual(['clearbit']);
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
    expect(revokeObjectUrlMock).toHaveBeenCalled();
  });

  it('classifies connector throttle pressure as moderate at threshold and exports threshold state', async () => {
    setupQueryMocks({
      'sales-intelligence-page-portfolio': {
        data: {
          campaignCount: 1,
          activeCampaignCount: 1,
          portfolioTotals: { sent: 8, opened: 3, replied: 1 },
          averageReplyRate: 0.125,
          rankedCampaigns: [
            {
              campaignId: 'c-moderate-pressure',
              name: 'Connector Pressure Moderate',
              status: 'active',
              totals: { sent: 8, opened: 3, replied: 1 },
              overall: { openRate: 0.375, replyRate: 0.125, qualityTier: 'watch' },
            },
          ],
        },
      },
      'sales-intelligence-page-campaign': {
        data: {
          campaignId: 'c-moderate-pressure',
          name: 'Connector Pressure Moderate',
          status: 'active',
          totals: { sent: 8, opened: 3, replied: 1 },
          overall: { openRate: 0.375, replyRate: 0.125, replyToOpenRate: 0.333, qualityTier: 'watch' },
          byChannel: [],
          recommendations: [],
        },
      },
      'sales-intelligence-page-prediction-report': {
        data: {
          qualityTier: 'watch',
          rolloutDecision: 'hold',
          sampleSize: 8,
          meanAbsoluteCalibrationError: 0.3,
          recommendations: [],
        },
      },
      'sales-intelligence-page-telemetry': {
        data: {
          generatedAt: '2026-02-22T10:00:00+00:00',
          windowDays: 7,
          eventCount: 2,
          errorEventCount: 0,
          trendByDay: [{ date: '2026-02-21', events: 2, errors: 0, salesIntelligenceEvents: 1 }],
          salesIntelligence: { eventCount: 1, byEventFamily: { prediction: 1 } },
          connectorRateLimit: {
            eventCount: 1,
            byEndpoint: { apollo_search: 1 },
            latestEventAt: '2026-02-22T09:57:00+00:00',
            maxRetryAfterSeconds: 20,
            avgRetryAfterSeconds: 20,
            maxResetInSeconds: 19,
            avgResetInSeconds: 19,
          },
          packetValidationAudit: {
            eventCount: 0,
            statusCounts: {},
            withinFreshnessCount: 0,
            outsideFreshnessCount: 0,
            missingFreshnessCount: 0,
            latestEvaluatedAt: null,
          },
        },
      },
    });

    const createObjectUrlMock = jest.fn(() => 'blob:sales-pressure-moderate');
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectUrlMock,
    });

    await act(async () => {
      root.render(<SalesIntelligence />);
    });

    expect(container.textContent).toContain('Connector throttle pressure: Moderate.');

    const exportButton = container.querySelector('[data-testid="sales-telemetry-export-btn"]') as HTMLButtonElement;
    expect(exportButton).toBeTruthy();
    await act(async () => {
      exportButton.click();
    });

    const telemetryBlob = createObjectUrlMock.mock.calls[createObjectUrlMock.mock.calls.length - 1][0] as Blob;
    const telemetryPayload = JSON.parse(await readBlobAsText(telemetryBlob));
    expect(telemetryPayload.exportConnectorRateLimitPressureLabel).toBe('Moderate');
    expect(telemetryPayload.exportConnectorRateLimitPressureSignalSeconds).toBe(20);
    expect(telemetryPayload.exportConnectorValidationEventCount).toBe(0);
    expect(telemetryPayload.exportConnectorValidationEndpointCount).toBe(0);
    expect(telemetryPayload.exportConnectorValidationReasonCount).toBe(0);
  });

  it('filters sales recent correlated events to packet-validation rows and reissues telemetry query key', async () => {
    setupQueryMocks({
      'sales-intelligence-page-portfolio': {
        data: {
          campaignCount: 1,
          activeCampaignCount: 1,
          portfolioTotals: { sent: 80, opened: 30, replied: 6 },
          averageReplyRate: 0.075,
          rankedCampaigns: [
            {
              campaignId: 'c2',
              name: 'Enterprise Reactivation',
              status: 'active',
              totals: { sent: 80, opened: 30, replied: 6 },
              overall: { openRate: 0.375, replyRate: 0.075, qualityTier: 'watch' },
            },
          ],
        },
      },
      'sales-intelligence-page-campaign': {
        data: {
          campaignId: 'c2',
          name: 'Enterprise Reactivation',
          status: 'active',
          totals: { sent: 80, opened: 30, replied: 6 },
          overall: { openRate: 0.375, replyRate: 0.075, replyToOpenRate: 0.2, qualityTier: 'watch' },
          byChannel: [],
          recommendations: [],
        },
      },
      'sales-intelligence-page-prediction-report': {
        data: {
          qualityTier: 'watch',
          rolloutDecision: 'hold',
          sampleSize: 35,
          meanAbsoluteCalibrationError: 0.28,
          recommendations: [],
        },
      },
      'sales-intelligence-page-telemetry': {
        data: {
          generatedAt: '2026-02-22T10:00:00+00:00',
          windowDays: 7,
          eventCount: 10,
          errorEventCount: 2,
          bySchemaVersion: { '2': 7 },
          trendByDay: [{ date: '2026-02-21', events: 10, errors: 2, salesIntelligenceEvents: 7 }],
          salesIntelligence: { eventCount: 7, byEventFamily: { prediction: 7 }, bySchemaVersion: { '2': 7 } },
          packetValidationAudit: {
            eventCount: 2,
            statusCounts: { ACTION_REQUIRED: 1, READY: 1 },
            withinFreshnessCount: 1,
            outsideFreshnessCount: 1,
            missingFreshnessCount: 0,
            latestEvaluatedAt: '2026-02-22T09:59:00+00:00',
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
            latestEvaluatedAt: '2026-02-22T09:58:00+00:00',
          },
          recentEventsTotalCount: 3,
          recentEvents: [
            {
              eventType: 'sales_pipeline_forecast_generated',
              provider: 'sales_intelligence',
              requestId: 'req-sales-plain',
              schemaVersion: 2,
            },
            {
              eventType: 'integrations_traceability_status_evaluated',
              provider: 'integrations',
              requestId: 'req-packet-action',
              schemaVersion: 'unknown',
              traceabilityDecision: 'HOLD',
              governancePacketValidationStatus: 'ACTION_REQUIRED',
              governancePacketValidationWithinFreshness: false,
            },
            {
              eventType: 'integrations_traceability_snapshot_governance_evaluated',
              provider: 'integrations',
              requestId: 'req-packet-ready',
              schemaVersion: 'unknown',
              governanceStatus: 'READY',
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
          ],
        },
      },
      'sales-intelligence-page-governance-schema': {
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
      root.render(<SalesIntelligence />);
    });

    expect(container.textContent).toContain('Recent Correlated Events');
    expect(container.textContent).toContain('Governance Schema Audit Posture');
    expect(container.textContent).toContain('Parity posture: FAIL');
    expect(container.textContent).toContain('reason-code parity pass 1');
    expect(container.textContent).toContain('req-sales-plain');
    expect(container.textContent).toContain('packet ACTION_REQUIRED stale');
    expect(container.textContent).toContain('packet READY fresh');
    expect(container.textContent).toContain('schema parity FAIL rollout-blocked reason-codes 2 commands 1');

    const packetOnlyButton = container.querySelector('[data-testid="sales-recent-events-filter-packet"]') as HTMLButtonElement;
    const allEventsButton = container.querySelector('[data-testid="sales-recent-events-filter-all"]') as HTMLButtonElement;
    expect(packetOnlyButton).toBeTruthy();
    expect(allEventsButton).toBeTruthy();

    await act(async () => {
      packetOnlyButton.click();
    });

    expect(container.textContent).not.toContain('req-sales-plain');
    expect(container.textContent).toContain('req-packet-action');
    expect(container.textContent).toContain('req-packet-ready');
    expect(container.textContent).toContain('Showing 2 of 3 recent events.');
    let telemetryCalls = mockUseQuery.mock.calls
      .map((entry) => entry[0])
      .filter((options) => Array.isArray(options?.queryKey) && options.queryKey[0] === 'sales-intelligence-page-telemetry');
    expect(telemetryCalls[telemetryCalls.length - 1].queryKey[3]).toBe('packet');

    await act(async () => {
      allEventsButton.click();
    });

    expect(container.textContent).toContain('req-sales-plain');
    expect(container.textContent).toContain('Showing 3 of 3 recent events.');
    telemetryCalls = mockUseQuery.mock.calls
      .map((entry) => entry[0])
      .filter((options) => Array.isArray(options?.queryKey) && options.queryKey[0] === 'sales-intelligence-page-telemetry');
    expect(telemetryCalls[telemetryCalls.length - 1].queryKey[3]).toBe('all');
  });

  it('uses server recent-event filter echo for sales telemetry display and export context', async () => {
    setupQueryMocks({
      'sales-intelligence-page-portfolio': {
        data: {
          campaignCount: 0,
          activeCampaignCount: 0,
          portfolioTotals: { sent: 0, opened: 0, replied: 0 },
          averageReplyRate: 0,
          rankedCampaigns: [],
        },
      },
      'sales-intelligence-page-campaign': { data: undefined },
      'sales-intelligence-page-prediction-report': {
        data: {
          qualityTier: 'watch',
          rolloutDecision: 'hold',
          sampleSize: 0,
          meanAbsoluteCalibrationError: 0.3,
          recommendations: [],
        },
      },
      'sales-intelligence-page-telemetry': {
        data: {
          generatedAt: '2026-02-22T10:00:00+00:00',
          windowDays: 7,
          eventCount: 3,
          errorEventCount: 0,
          trendByDay: [{ date: '2026-02-21', events: 3, errors: 0, salesIntelligenceEvents: 1 }],
          salesIntelligence: { eventCount: 1, byEventFamily: { forecast: 1 } },
          recentEventsFilter: ' PACKET ',
          recentEventsTotalCount: 3,
          recentEventsFilteredCount: 1,
          recentEvents: [
            {
              eventType: 'integrations_traceability_status_evaluated',
              provider: 'integrations',
              requestId: 'req-packet-only-sales',
              schemaVersion: 'unknown',
              governancePacketValidationStatus: 'ACTION_REQUIRED',
              governancePacketValidationWithinFreshness: false,
            },
            {
              eventType: 'sales_pipeline_forecast_generated',
              provider: 'sales_intelligence',
              requestId: 'req-sales-hidden-by-server-echo',
              schemaVersion: 2,
            },
          ],
        },
      },
      'sales-intelligence-page-governance-schema': {
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

    const createObjectUrlMock = jest.fn(() => 'blob:mock');
    const revokeObjectUrlMock = jest.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectUrlMock,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectUrlMock,
    });

    await act(async () => {
      root.render(<SalesIntelligence />);
    });

    expect(container.textContent).toContain('Server applied');
    expect(container.textContent).toContain('Showing 1 of 3 recent events.');
    expect(container.textContent).toContain('Packet-validation rows: 1');
    expect(container.textContent).toContain('Non-packet rows: 2');
    expect(container.textContent).toContain('req-packet-only-sales');
    expect(container.textContent).not.toContain('req-sales-hidden-by-server-echo');

    const exportButton = container.querySelector('[data-testid="sales-telemetry-export-btn"]') as HTMLButtonElement;
    expect(exportButton).toBeTruthy();
    await act(async () => {
      exportButton.click();
    });

    const telemetryBlob = createObjectUrlMock.mock.calls[createObjectUrlMock.mock.calls.length - 1][0] as Blob;
    const telemetryPayload = JSON.parse(await readBlobAsText(telemetryBlob));
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
    expect(telemetryPayload.exportRecentEventsPacketValidationCount).toBe(1);
    expect(telemetryPayload.exportRecentEventsNonPacketCount).toBe(2);
    expect(revokeObjectUrlMock).toHaveBeenCalled();
  });

  it('falls back to local sales recent-event filter when server echo token is unsupported', async () => {
    setupQueryMocks({
      'sales-intelligence-page-portfolio': {
        data: {
          campaignCount: 0,
          activeCampaignCount: 0,
          portfolioTotals: { sent: 0, opened: 0, replied: 0 },
          averageReplyRate: 0,
          rankedCampaigns: [],
        },
      },
      'sales-intelligence-page-campaign': { data: undefined },
      'sales-intelligence-page-prediction-report': {
        data: {
          qualityTier: 'watch',
          rolloutDecision: 'hold',
          sampleSize: 0,
          meanAbsoluteCalibrationError: 0.3,
          recommendations: [],
        },
      },
      'sales-intelligence-page-telemetry': {
        data: {
          generatedAt: '2026-02-22T10:00:00+00:00',
          windowDays: 7,
          eventCount: 2,
          errorEventCount: 0,
          trendByDay: [{ date: '2026-02-21', events: 2, errors: 0, salesIntelligenceEvents: 1 }],
          salesIntelligence: { eventCount: 1, byEventFamily: { forecast: 1 } },
          recentEventsFilter: 'unsupported-server-filter',
          recentEventsTotalCount: 2,
          recentEventsFilteredCount: 2,
          recentEvents: [
            {
              eventType: 'integrations_traceability_status_evaluated',
              provider: 'integrations',
              requestId: 'req-packet-fallback-sales',
              schemaVersion: 'unknown',
              governancePacketValidationStatus: 'ACTION_REQUIRED',
              governancePacketValidationWithinFreshness: false,
            },
            {
              eventType: 'sales_pipeline_forecast_generated',
              provider: 'sales_intelligence',
              requestId: 'req-sales-fallback-visible',
              schemaVersion: 2,
            },
          ],
        },
      },
      'sales-intelligence-page-governance-schema': {
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
      root.render(<SalesIntelligence />);
    });

    expect(container.textContent).not.toContain('Server applied');
    expect(container.textContent).toContain('Showing 2 of 2 recent events.');
    expect(container.textContent).toContain('req-sales-fallback-visible');

    const packetOnlyButton = container.querySelector('[data-testid="sales-recent-events-filter-packet"]') as HTMLButtonElement;
    expect(packetOnlyButton).toBeTruthy();
    await act(async () => {
      packetOnlyButton.click();
    });

    expect(container.textContent).toContain('Showing 1 of 2 recent events.');
    expect(container.textContent).toContain('req-packet-fallback-sales');
    expect(container.textContent).not.toContain('req-sales-fallback-visible');

    const createObjectUrlMock = jest.fn(() => 'blob:mock');
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectUrlMock,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: jest.fn(),
    });

    const exportButton = container.querySelector('[data-testid="sales-telemetry-export-btn"]') as HTMLButtonElement;
    expect(exportButton).toBeTruthy();
    await act(async () => {
      exportButton.click();
    });
    const telemetryBlob = createObjectUrlMock.mock.calls[createObjectUrlMock.mock.calls.length - 1][0] as Blob;
    const telemetryPayload = JSON.parse(await readBlobAsText(telemetryBlob));
    expect(telemetryPayload.exportRecentEventsFilter).toBe('packet');
    expect(telemetryPayload.exportRecentEventsSelectedFilter).toBe('packet');
    expect(telemetryPayload.exportRecentEventsServerFilter).toBeNull();
    expect(telemetryPayload.exportRecentEventsServerFilterRaw).toBe('unsupported-server-filter');
    expect(telemetryPayload.exportRecentEventsServerFilterRawTrimmed).toBe('unsupported-server-filter');
    expect(telemetryPayload.exportRecentEventsServerFilterBlank).toBe(false);
    expect(telemetryPayload.exportRecentEventsServerFilterUnsupported).toBe(true);
    expect(telemetryPayload.exportRecentEventsServerFilterEvaluation).toBe('unsupported');
    expect(telemetryPayload.exportRecentEventsServerFilterNormalizationChanged).toBe(false);
    expect(telemetryPayload.exportRecentEventsFilterMismatch).toBe(false);
    expect(telemetryPayload.exportRecentEventsFilterSource).toBe('local');
    expect(telemetryPayload.exportRecentEventsFilterResolution).toBe('local_unsupported_server_filter');
  });

  it('treats whitespace-only server recent-event filter as absent and keeps local source', async () => {
    setupQueryMocks({
      'sales-intelligence-page-portfolio': {
        data: {
          campaignCount: 0,
          activeCampaignCount: 0,
          portfolioTotals: { sent: 0, opened: 0, replied: 0 },
          averageReplyRate: 0,
          rankedCampaigns: [],
        },
      },
      'sales-intelligence-page-campaign': { data: undefined },
      'sales-intelligence-page-prediction-report': {
        data: {
          qualityTier: 'watch',
          rolloutDecision: 'hold',
          sampleSize: 0,
          meanAbsoluteCalibrationError: 0.3,
          recommendations: [],
        },
      },
      'sales-intelligence-page-telemetry': {
        data: {
          generatedAt: '2026-02-22T10:00:00+00:00',
          windowDays: 7,
          eventCount: 2,
          errorEventCount: 0,
          trendByDay: [{ date: '2026-02-21', events: 2, errors: 0, salesIntelligenceEvents: 1 }],
          salesIntelligence: { eventCount: 1, byEventFamily: { forecast: 1 } },
          recentEventsFilter: '   ',
          recentEventsTotalCount: 2,
          recentEventsFilteredCount: 2,
          recentEvents: [
            {
              eventType: 'integrations_traceability_status_evaluated',
              provider: 'integrations',
              requestId: 'req-packet-fallback-sales-blank',
              schemaVersion: 'unknown',
              governancePacketValidationStatus: 'ACTION_REQUIRED',
              governancePacketValidationWithinFreshness: false,
            },
            {
              eventType: 'sales_pipeline_forecast_generated',
              provider: 'sales_intelligence',
              requestId: 'req-sales-fallback-visible-blank',
              schemaVersion: 2,
            },
          ],
        },
      },
    });

    await act(async () => {
      root.render(<SalesIntelligence />);
    });

    expect(container.textContent).not.toContain('Server applied');
    expect(container.textContent).toContain('Showing 2 of 2 recent events.');
    expect(container.textContent).toContain('req-sales-fallback-visible-blank');

    const packetOnlyButton = container.querySelector('[data-testid="sales-recent-events-filter-packet"]') as HTMLButtonElement;
    expect(packetOnlyButton).toBeTruthy();
    await act(async () => {
      packetOnlyButton.click();
    });

    expect(container.textContent).toContain('Showing 1 of 2 recent events.');
    expect(container.textContent).toContain('req-packet-fallback-sales-blank');
    expect(container.textContent).not.toContain('req-sales-fallback-visible-blank');

    const createObjectUrlMock = jest.fn(() => 'blob:mock');
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectUrlMock,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: jest.fn(),
    });

    const exportButton = container.querySelector('[data-testid="sales-telemetry-export-btn"]') as HTMLButtonElement;
    expect(exportButton).toBeTruthy();
    await act(async () => {
      exportButton.click();
    });
    const telemetryBlob = createObjectUrlMock.mock.calls[createObjectUrlMock.mock.calls.length - 1][0] as Blob;
    const telemetryPayload = JSON.parse(await readBlobAsText(telemetryBlob));
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
      'sales-intelligence-page-portfolio': {
        data: {
          campaignCount: 0,
          activeCampaignCount: 0,
          portfolioTotals: { sent: 0, opened: 0, replied: 0 },
          averageReplyRate: 0,
          rankedCampaigns: [],
        },
      },
      'sales-intelligence-page-campaign': { data: undefined },
      'sales-intelligence-page-prediction-report': {
        data: {
          qualityTier: 'watch',
          rolloutDecision: 'hold',
          sampleSize: 0,
          meanAbsoluteCalibrationError: 0.3,
          recommendations: [],
        },
      },
      'sales-intelligence-page-telemetry': {
        data: {
          generatedAt: '2026-02-22T10:00:00+00:00',
          windowDays: 7,
          eventCount: 2,
          errorEventCount: 0,
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
              schemaVersion: 2,
            },
          ],
        },
      },
    });

    const createObjectUrlMock = jest.fn(() => 'blob:mock');
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectUrlMock,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: jest.fn(),
    });

    await act(async () => {
      root.render(<SalesIntelligence />);
    });

    const packetOnlyButton = container.querySelector('[data-testid="sales-recent-events-filter-packet"]') as HTMLButtonElement;
    expect(packetOnlyButton).toBeTruthy();
    await act(async () => {
      packetOnlyButton.click();
    });

    expect(container.textContent).toContain('Server applied');
    expect(container.textContent).toContain('Showing 2 of 2 recent events.');
    expect(container.textContent).toContain('req-sales-visible-server-all');

    const exportButton = container.querySelector('[data-testid="sales-telemetry-export-btn"]') as HTMLButtonElement;
    expect(exportButton).toBeTruthy();
    await act(async () => {
      exportButton.click();
    });
    const telemetryBlob = createObjectUrlMock.mock.calls[createObjectUrlMock.mock.calls.length - 1][0] as Blob;
    const telemetryPayload = JSON.parse(await readBlobAsText(telemetryBlob));
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

  it('normalizes malformed server recent-event count metadata for display consistency', async () => {
    setupQueryMocks({
      'sales-intelligence-page-portfolio': {
        data: {
          campaignCount: 0,
          activeCampaignCount: 0,
          portfolioTotals: { sent: 0, opened: 0, replied: 0 },
          averageReplyRate: 0,
          rankedCampaigns: [],
        },
      },
      'sales-intelligence-page-campaign': { data: undefined },
      'sales-intelligence-page-prediction-report': {
        data: {
          qualityTier: 'watch',
          rolloutDecision: 'hold',
          sampleSize: 0,
          meanAbsoluteCalibrationError: 0.3,
          recommendations: [],
        },
      },
      'sales-intelligence-page-telemetry': {
        data: {
          generatedAt: '2026-02-22T10:00:00+00:00',
          windowDays: 7,
          eventCount: 2,
          errorEventCount: 0,
          trendByDay: [{ date: '2026-02-21', events: 2, errors: 0, salesIntelligenceEvents: 1 }],
          salesIntelligence: { eventCount: 1, byEventFamily: { forecast: 1 } },
          recentEventsFilter: 'all',
          recentEventsTotalCount: -7,
          recentEventsFilteredCount: Number.POSITIVE_INFINITY,
          recentEventsPacketValidationCount: -3,
          recentEventsNonPacketCount: Number.POSITIVE_INFINITY,
          recentEvents: [
            {
              eventType: 'integrations_traceability_status_evaluated',
              provider: 'integrations',
              requestId: 'req-packet-count-a',
              governancePacketValidationStatus: 'ACTION_REQUIRED',
              governancePacketValidationWithinFreshness: false,
            },
            {
              eventType: 'sales_pipeline_forecast_generated',
              provider: 'sales_intelligence',
              requestId: 'req-sales-count-b',
              schemaVersion: 2,
            },
          ],
        },
      },
    });

    await act(async () => {
      root.render(<SalesIntelligence />);
    });

    expect(container.textContent).toContain('Showing 2 of 2 recent events.');
    expect(container.textContent).toContain('Packet-validation rows: 1');
    expect(container.textContent).toContain('Non-packet rows: 1');

    const createObjectUrlMock = jest.fn(() => 'blob:mock');
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectUrlMock,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: jest.fn(),
    });

    const exportButton = container.querySelector('[data-testid="sales-telemetry-export-btn"]') as HTMLButtonElement;
    expect(exportButton).toBeTruthy();
    await act(async () => {
      exportButton.click();
    });
    const telemetryBlob = createObjectUrlMock.mock.calls[createObjectUrlMock.mock.calls.length - 1][0] as Blob;
    const telemetryPayload = JSON.parse(await readBlobAsText(telemetryBlob));
    expect(telemetryPayload.exportRecentEventsDisplayedCount).toBe(2);
    expect(telemetryPayload.exportRecentEventsTotalCount).toBe(2);
    expect(telemetryPayload.exportRecentEventsPacketValidationCount).toBe(1);
    expect(telemetryPayload.exportRecentEventsNonPacketCount).toBe(1);
  });

  it('shows packet-filter remediation hint when local packet mode has no packet-validation events', async () => {
    setupQueryMocks({
      'sales-intelligence-page-portfolio': {
        data: {
          campaignCount: 0,
          activeCampaignCount: 0,
          portfolioTotals: { sent: 0, opened: 0, replied: 0 },
          averageReplyRate: 0,
          rankedCampaigns: [],
        },
      },
      'sales-intelligence-page-campaign': { data: undefined },
      'sales-intelligence-page-prediction-report': {
        data: {
          qualityTier: 'watch',
          rolloutDecision: 'hold',
          sampleSize: 0,
          meanAbsoluteCalibrationError: 0.3,
          recommendations: [],
        },
      },
      'sales-intelligence-page-telemetry': {
        data: {
          generatedAt: '2026-02-22T10:00:00+00:00',
          windowDays: 7,
          eventCount: 2,
          errorEventCount: 0,
          trendByDay: [{ date: '2026-02-21', events: 2, errors: 0, salesIntelligenceEvents: 2 }],
          salesIntelligence: { eventCount: 2, byEventFamily: { forecast: 2 } },
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
    });

    await act(async () => {
      root.render(<SalesIntelligence />);
    });

    const packetOnlyButton = container.querySelector('[data-testid="sales-recent-events-filter-packet"]') as HTMLButtonElement;
    expect(packetOnlyButton).toBeTruthy();
    await act(async () => {
      packetOnlyButton.click();
    });

    expect(container.textContent).toContain('Showing 0 of 2 recent events.');
    expect(container.textContent).toContain('No packet-validation events in this telemetry window.');
    expect(container.textContent).toContain('Increase Window Days or Event Limit');
  });

  it('shows server-packet mismatch remediation hint when server applies packet filter with zero packet rows', async () => {
    setupQueryMocks({
      'sales-intelligence-page-portfolio': {
        data: {
          campaignCount: 0,
          activeCampaignCount: 0,
          portfolioTotals: { sent: 0, opened: 0, replied: 0 },
          averageReplyRate: 0,
          rankedCampaigns: [],
        },
      },
      'sales-intelligence-page-campaign': { data: undefined },
      'sales-intelligence-page-prediction-report': {
        data: {
          qualityTier: 'watch',
          rolloutDecision: 'hold',
          sampleSize: 0,
          meanAbsoluteCalibrationError: 0.3,
          recommendations: [],
        },
      },
      'sales-intelligence-page-telemetry': {
        data: {
          generatedAt: '2026-02-22T10:00:00+00:00',
          windowDays: 7,
          eventCount: 2,
          errorEventCount: 0,
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
    });

    const createObjectUrlMock = jest.fn(() => 'blob:mock');
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectUrlMock,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: jest.fn(),
    });

    await act(async () => {
      root.render(<SalesIntelligence />);
    });

    expect(container.textContent).toContain('Server applied');
    expect(container.textContent).toContain('Showing 0 of 2 recent events.');
    expect(container.textContent).toContain('Packet-validation rows: 0');
    expect(container.textContent).toContain('Non-packet rows: 2');
    expect(container.textContent).toContain('No packet-validation events in this telemetry window.');

    const exportButton = container.querySelector('[data-testid="sales-telemetry-export-btn"]') as HTMLButtonElement;
    expect(exportButton).toBeTruthy();
    await act(async () => {
      exportButton.click();
    });
    const telemetryBlob = createObjectUrlMock.mock.calls[createObjectUrlMock.mock.calls.length - 1][0] as Blob;
    const telemetryPayload = JSON.parse(await readBlobAsText(telemetryBlob));
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

  it('renders governance rollup and exports governance snapshot', async () => {
    setupQueryMocks({
      'sales-intelligence-page-portfolio': {
        data: {
          campaignCount: 1,
          activeCampaignCount: 1,
          portfolioTotals: { sent: 80, opened: 30, replied: 6 },
          averageReplyRate: 0.075,
          rankedCampaigns: [
            {
              campaignId: 'c2',
              name: 'Enterprise Reactivation',
              status: 'active',
              totals: { sent: 80, opened: 30, replied: 6 },
              overall: { openRate: 0.375, replyRate: 0.075, qualityTier: 'watch' },
            },
          ],
        },
      },
      'sales-intelligence-page-campaign': {
        data: {
          campaignId: 'c2',
          name: 'Enterprise Reactivation',
          status: 'active',
          totals: { sent: 80, opened: 30, replied: 6 },
          overall: { openRate: 0.375, replyRate: 0.075, replyToOpenRate: 0.2, qualityTier: 'watch' },
          byChannel: [],
          recommendations: [],
        },
      },
      'sales-intelligence-page-prediction-report': {
        data: {
          qualityTier: 'watch',
          rolloutDecision: 'hold',
          sampleSize: 35,
          meanAbsoluteCalibrationError: 0.28,
          recommendations: [],
        },
      },
      'sales-intelligence-page-telemetry': {
        data: {
          generatedAt: '2026-02-22T10:00:00+00:00',
          windowDays: 7,
          eventCount: 10,
          errorEventCount: 2,
          trendByDay: [{ date: '2026-02-21', events: 10, errors: 2, salesIntelligenceEvents: 7 }],
          salesIntelligence: { eventCount: 7, byEventFamily: { prediction: 7 } },
        },
      },
      'sales-intelligence-page-governance-report': {
        data: {
          generatedAt: '2026-02-22T10:00:00+00:00',
          windowDays: 7,
          eventLimit: 500,
          totals: {
            governanceEventCount: 3,
            traceabilityEvaluationCount: 2,
            snapshotEvaluationCount: 2,
            baselineEvaluationCount: 1,
            actionRequiredCount: 1,
            connectorRateLimitEventCount: 3,
            sendgridWebhookTimestampEventCount: 3,
            sendgridWebhookTimestampAnomalyCountTotal: 4,
            rolloutBlockedCount: 2,
          },
          connectorRateLimit: {
            eventCount: 3,
            byEndpoint: {
              apollo_search: 2,
              company_enrichment_orchestration: 1,
            },
            latestEventAt: '2026-02-22T09:58:00+00:00',
            maxRetryAfterSeconds: 46,
            avgRetryAfterSeconds: 32,
            maxResetInSeconds: 45,
            avgResetInSeconds: 24,
            pressure: { label: 'High' },
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
            timestampAnomalyCountTotal: 4,
            avgTimestampAnomalyRatePct: 66.67,
            maxTimestampAnomalyRatePct: 80,
            timestampAgeBucketCounts: { stale: 2, future_skew: 1 },
            timestampAnomalyEventTypeCounts: { open: 2, click: 2 },
            latestEventAt: '2026-02-22T09:58:00+00:00',
          },
          governanceStatusCounts: { ACTION_REQUIRED: 1, PASS: 2 },
          traceabilityDecisionCounts: { HOLD: 1, PROCEED: 1 },
          timeline: [
            {
              date: '2026-02-21',
              snapshotGovernanceEvents: 1,
              baselineGovernanceEvents: 1,
              traceabilityEvents: 1,
              actionRequiredEvents: 1,
            },
          ],
          recommendedCommands: ['npm run verify:governance:weekly'],
        },
      },
      'sales-intelligence-page-governance-report-export': {
        data: {
          governanceType: 'weekly_report',
          exportSchemaVersion: 1,
          generatedAt: '2026-02-22T10:00:00+00:00',
          windowDays: 7,
          eventLimit: 500,
          status: 'ACTION_REQUIRED',
          totals: {
            governanceEventCount: 3,
            rolloutBlockedCount: 2,
            connectorRateLimitEventCount: 3,
            sendgridWebhookTimestampEventCount: 3,
            sendgridWebhookTimestampAnomalyCountTotal: 4,
          },
          connectorRateLimit: {
            eventCount: 3,
            byEndpoint: {
              apollo_search: 2,
              company_enrichment_orchestration: 1,
            },
            latestEventAt: '2026-02-22T09:58:00+00:00',
            maxRetryAfterSeconds: 46,
            avgRetryAfterSeconds: 32,
            maxResetInSeconds: 45,
            avgResetInSeconds: 24,
            pressure: { label: 'High' },
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
            timestampAnomalyCountTotal: 4,
            avgTimestampAnomalyRatePct: 66.67,
            maxTimestampAnomalyRatePct: 80,
            timestampAgeBucketCounts: { stale: 2, future_skew: 1 },
            timestampAnomalyEventTypeCounts: { open: 2, click: 2 },
            latestEventAt: '2026-02-22T09:58:00+00:00',
          },
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
          recommendedCommands: ['npm run verify:governance:weekly'],
          governanceExport: {
            governanceType: 'weekly_report',
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
              latestEventAt: '2026-02-22T09:58:00+00:00',
              maxRetryAfterSeconds: 46,
              avgRetryAfterSeconds: 32,
              maxResetInSeconds: 45,
              avgResetInSeconds: 24,
              pressure: { label: 'High' },
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
              timestampAnomalyCountTotal: 4,
              avgTimestampAnomalyRatePct: 66.67,
              maxTimestampAnomalyRatePct: 80,
              timestampAgeBucketCounts: { stale: 2, future_skew: 1 },
              timestampAnomalyEventTypeCounts: { open: 2, click: 2 },
              latestEventAt: '2026-02-22T09:58:00+00:00',
            },
            alerts: [{ severity: 'high', ownerRole: 'Release Manager', message: 'Snapshot governance contains ACTION_REQUIRED evaluations.' }],
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
            evaluatedAt: '2026-02-22T10:00:00+00:00',
            requestedBy: 'u1',
          },
          requestedBy: 'u1',
        },
      },
      'sales-intelligence-page-governance-report-history': {
        data: {
          governanceType: 'weekly_report_history',
          exportSchemaVersion: 1,
          generatedAt: '2026-02-22T10:00:00+00:00',
          retentionDays: 7,
          artifactCount: 2,
          staleCount: 1,
          rolloutBlockedCount: 1,
          totals: {
            connectorRateLimitEventCount: 3,
            sendgridWebhookTimestampEventCount: 3,
            sendgridWebhookTimestampAnomalyCountTotal: 4,
          },
          connectorRateLimit: {
            eventCount: 3,
            byEndpoint: {
              apollo_search: 2,
              company_enrichment_orchestration: 1,
            },
            latestEventAt: '2026-02-22T09:58:00+00:00',
            maxRetryAfterSeconds: 46,
            avgRetryAfterSeconds: 32,
            maxResetInSeconds: 45,
            avgResetInSeconds: 24,
            pressure: { label: 'High' },
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
            timestampAnomalyCountTotal: 4,
            avgTimestampAnomalyRatePct: 66.67,
            maxTimestampAnomalyRatePct: 80,
            timestampAgeBucketCounts: { stale: 2, future_skew: 1 },
            timestampAnomalyEventTypeCounts: { open: 2, click: 2 },
            latestEventAt: '2026-02-22T09:58:00+00:00',
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
          governanceExport: {
            status: 'ACTION_REQUIRED',
            rolloutBlocked: true,
            connectorRateLimit: {
              eventCount: 3,
              byEndpoint: {
                apollo_search: 2,
                company_enrichment_orchestration: 1,
              },
              latestEventAt: '2026-02-22T09:58:00+00:00',
              maxRetryAfterSeconds: 46,
              avgRetryAfterSeconds: 32,
              maxResetInSeconds: 45,
              avgResetInSeconds: 24,
              pressure: { label: 'High' },
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
              timestampAnomalyCountTotal: 4,
              avgTimestampAnomalyRatePct: 66.67,
              maxTimestampAnomalyRatePct: 80,
              timestampAgeBucketCounts: { stale: 2, future_skew: 1 },
              timestampAnomalyEventTypeCounts: { open: 2, click: 2 },
              latestEventAt: '2026-02-22T09:58:00+00:00',
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
          latestArtifact: {
            name: 'connector_governance_weekly_report_recent.json',
            exportSchemaVersion: 1,
            generatedAt: '2026-02-22T10:00:00+00:00',
            status: 'READY',
            rolloutBlocked: false,
          },
          items: [
            {
              name: 'connector_governance_weekly_report_recent.json',
              exportSchemaVersion: 1,
              generatedAt: '2026-02-22T10:00:00+00:00',
              withinRetention: true,
              status: 'READY',
              rolloutBlocked: false,
            },
          ],
        },
      },
    });

    const originalCreateElement = document.createElement.bind(document);
    const anchorClick = jest.fn();
    const createElementSpy = jest
      .spyOn(document, 'createElement')
      .mockImplementation((tagName: any, options?: any) => {
        const element = originalCreateElement(tagName, options);
        if (String(tagName).toLowerCase() === 'a') {
          Object.defineProperty(element, 'click', {
            configurable: true,
            value: anchorClick,
          });
        }
        return element;
      });
    const createObjectUrlMock = jest.fn(() => 'blob:sales-governance-test');
    const revokeObjectUrlMock = jest.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectUrlMock,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectUrlMock,
    });

    await act(async () => {
      root.render(<SalesIntelligence />);
    });

    expect(container.textContent).toContain('Governance Weekly Rollup');
    expect(container.textContent).toContain('Governance Events');
    expect(container.textContent).toContain('ACTION_REQUIRED');
    expect(container.textContent).toContain('Recommended Commands');
    expect(container.textContent).toContain('History Schema Versions');
    expect(container.textContent).toContain('SendGrid timestamp events: 3');

    const exportButton = container.querySelector('[data-testid="sales-governance-export-btn"]') as HTMLButtonElement;
    expect(exportButton).toBeTruthy();
    await act(async () => {
      exportButton.click();
    });

    const exportHandoffButton = container.querySelector('[data-testid="sales-governance-handoff-export-btn"]') as HTMLButtonElement;
    expect(exportHandoffButton).toBeTruthy();
    await act(async () => {
      exportHandoffButton.click();
    });

    const exportHistoryButton = container.querySelector('[data-testid="sales-governance-history-export-btn"]') as HTMLButtonElement;
    expect(exportHistoryButton).toBeTruthy();
    await act(async () => {
      exportHistoryButton.click();
    });

    const exportSchemaButton = container.querySelector('[data-testid="sales-governance-schema-export-btn"]') as HTMLButtonElement;
    expect(exportSchemaButton).toBeTruthy();
    const callCountBeforeSchemaExport = createObjectUrlMock.mock.calls.length;
    await act(async () => {
      exportSchemaButton.click();
    });
    expect(createObjectUrlMock.mock.calls.length).toBe(callCountBeforeSchemaExport + 1);

    const handoffBlob = createObjectUrlMock.mock.calls[1][0] as Blob;
    const handoffPayload = JSON.parse(await new Response(handoffBlob).text());
    expect(handoffPayload.exportSchemaVersion).toBe(1);
    expect(handoffPayload.governanceExport.exportSchemaVersion).toBe(1);
    expect(handoffPayload.connectorPressureParity.eventCountMatchesNested).toBe(true);
    expect(handoffPayload.connectorPressureParity.eventCountMatchesTotals).toBe(true);
    expect(handoffPayload.connectorPressureParity.byEndpointMatchesNested).toBe(true);
    expect(handoffPayload.connectorPressureParity.pressureLabelMatchesNested).toBe(true);
    expect(handoffPayload.sendgridWebhookTimestamp.eventCount).toBe(3);
    expect(handoffPayload.governanceExport.sendgridWebhookTimestamp.eventCount).toBe(3);
    expect(handoffPayload.sendgridWebhookTimestampParity.eventCountMatchesNested).toBe(true);
    expect(handoffPayload.sendgridWebhookTimestampParity.eventCountMatchesTotals).toBe(true);
    expect(handoffPayload.sendgridWebhookTimestampParity.anomalyCountTotalMatchesNested).toBe(true);
    expect(handoffPayload.runtimePrereqsPresent).toBe(true);
    expect(handoffPayload.runtimePrereqsAvailable).toBe(true);
    expect(handoffPayload.runtimePrereqsMissingCheckCount).toBe(0);
    expect(handoffPayload.runtimePrereqsParity.matchesNested).toBe(true);
    expect(handoffPayload.runtimePrereqs).toMatchObject(
      handoffPayload.governanceExport.runtimePrereqs
    );
    const historyBlob = createObjectUrlMock.mock.calls[2][0] as Blob;
    const historyPayload = JSON.parse(await new Response(historyBlob).text());
    expect(historyPayload.exportSchemaVersion).toBe(1);
    expect(historyPayload.items[0].exportSchemaVersion).toBe(1);
    expect(historyPayload.connectorPressureParity.eventCountMatchesNested).toBe(true);
    expect(historyPayload.connectorPressureParity.byEndpointMatchesNested).toBe(true);
    expect(historyPayload.connectorPressureParity.eventCountMatchesTotals).toBe(true);
    expect(historyPayload.sendgridWebhookTimestamp.eventCount).toBe(3);
    expect(historyPayload.sendgridWebhookTimestamp.timestampAnomalyCountTotal).toBe(4);
    expect(historyPayload.sendgridWebhookTimestampParity.eventCountMatchesNested).toBe(true);
    expect(historyPayload.sendgridWebhookTimestampParity.eventCountMatchesTotals).toBe(true);
    expect(historyPayload.sendgridWebhookTimestampParity.anomalyCountTotalMatchesNested).toBe(true);
    expect(historyPayload.runtimePrereqsPresent).toBe(true);
    expect(historyPayload.runtimePrereqsAvailable).toBe(false);
    expect(historyPayload.runtimePrereqsMissingCheckCount).toBe(1);
    expect(historyPayload.runtimePrereqsParity.matchesNested).toBe(true);
    expect(historyPayload.runtimePrereqs).toMatchObject(
      historyPayload.governanceExport.runtimePrereqs
    );
    const schemaBlob = createObjectUrlMock.mock.calls[createObjectUrlMock.mock.calls.length - 1][0] as Blob;
    const schemaPayload = JSON.parse(await new Response(schemaBlob).text());
    if (schemaPayload.governanceType === 'schema_metadata') {
      expect(schemaPayload.schemaMetadata.activeVersion).toBe(1);
    } else {
      expect(schemaPayload.message).toBe('No governance schema contract loaded');
    }

    expect(createObjectUrlMock).toHaveBeenCalled();
    expect(revokeObjectUrlMock).toHaveBeenCalled();
    expect(anchorClick).toHaveBeenCalled();
    expect(container.textContent).toContain('sales-governance-schema-contract exported.');

    createElementSpy.mockRestore();
  });

  it('exports governance schema json from sales intelligence governance panel', async () => {
    setupQueryMocks({
      'sales-intelligence-page-portfolio': { data: { campaignCount: 0, activeCampaignCount: 0, portfolioTotals: { sent: 0, opened: 0, replied: 0 }, averageReplyRate: 0, rankedCampaigns: [] } },
      'sales-intelligence-page-campaign': { data: undefined },
      'sales-intelligence-page-prediction-report': { data: { qualityTier: 'watch', rolloutDecision: 'hold', sampleSize: 1, meanAbsoluteCalibrationError: 0.2, recommendations: [] } },
      'sales-intelligence-page-telemetry': { data: { eventCount: 0, errorEventCount: 0, trendByDay: [], salesIntelligence: { eventCount: 0, byEventFamily: {} } } },
      'sales-intelligence-page-governance-report': { data: { totals: { governanceEventCount: 0, traceabilityEvaluationCount: 0, actionRequiredCount: 0 }, governanceStatusCounts: {}, traceabilityDecisionCounts: {}, timeline: [], recommendedCommands: [] } },
      'sales-intelligence-page-governance-report-export': { data: { governanceType: 'weekly_report', status: 'READY', governanceExport: { status: 'READY', rolloutBlocked: false, ownerRole: 'Release Manager', alerts: [], actions: [], evaluatedAt: '2026-02-22T10:00:00+00:00', requestedBy: 'u1' } } },
      'sales-intelligence-page-governance-report-history': { data: { governanceType: 'weekly_report_history', generatedAt: '2026-02-22T10:00:00+00:00', retentionDays: 30, artifactCount: 0, staleCount: 0, rolloutBlockedCount: 0, items: [], recommendedCommands: [] } },
      'sales-intelligence-page-governance-schema': {
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
            computedAt: '2026-02-22T10:00:00+00:00',
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

    const createObjectUrlMock = jest.fn(() => 'blob:sales-governance-schema-contract');
    const revokeObjectUrlMock = jest.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectUrlMock,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectUrlMock,
    });

    await act(async () => {
      root.render(<SalesIntelligence />);
    });

    const exportSchemaButton = container.querySelector('[data-testid="sales-governance-schema-export-btn"]') as HTMLButtonElement;
    expect(exportSchemaButton).toBeTruthy();
    await act(async () => {
      exportSchemaButton.click();
    });

    expect(createObjectUrlMock).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrlMock).toHaveBeenCalledTimes(1);
    const schemaBlob = createObjectUrlMock.mock.calls[0][0] as Blob;
    const schemaPayload = JSON.parse(await new Response(schemaBlob).text());
    expect(schemaPayload.governanceType).toBe('schema_metadata');
    expect(schemaPayload.schemaMetadata.activeVersion).toBe(1);
    expect(schemaPayload.schemaContractParity.reasonCodeCount).toBe(1);
    expect(schemaPayload.schemaContractParity.recommendedCommandCount).toBe(1);
    expect(schemaPayload.schemaContractParity.reasonCodeParity.topLevelVsRolloutActions).toBe(true);
    expect(schemaPayload.schemaContractParity.reasonCodeParity.topLevelVsExportActions).toBe(true);
    expect(schemaPayload.schemaContractParity.reasonCodeParity.topLevelVsExportAlerts).toBe(true);
    expect(schemaPayload.schemaContractParity.reasonCodeParity.topLevelVsExportReasonCodes).toBe(true);
    expect(schemaPayload.schemaContractParity.recommendedCommandParity.topLevelVsExport).toBe(true);
    expect(schemaPayload.schemaContractParity.handoffParity.rolloutBlockedMatchesExport).toBe(true);
    expect(schemaPayload.schemaContractParity.handoffParity.ownerRoleMatchesExport).toBe(true);
    expect(schemaPayload.schemaContractParity.handoffParity.handoffActionsMatchRolloutActions).toBe(true);
    expect(typeof schemaPayload.schemaContractParity.computedAt).toBe('string');
    const parityCard = container.querySelector(
      '[data-testid="sales-governance-schema-parity-posture"]'
    );
    expect(parityCard?.textContent).toContain('Schema Parity Status: PASS');
    expect(container.textContent).toContain('sales-governance-schema-contract exported.');
  });

  it('shows governance schema parity warning in sales intelligence when schema checks drift', async () => {
    setupQueryMocks({
      'sales-intelligence-page-portfolio': { data: { campaignCount: 0, activeCampaignCount: 0, portfolioTotals: { sent: 0, opened: 0, replied: 0 }, averageReplyRate: 0, rankedCampaigns: [] } },
      'sales-intelligence-page-campaign': { data: undefined },
      'sales-intelligence-page-prediction-report': { data: { qualityTier: 'watch', rolloutDecision: 'hold', sampleSize: 1, meanAbsoluteCalibrationError: 0.2, recommendations: [] } },
      'sales-intelligence-page-telemetry': { data: { eventCount: 0, errorEventCount: 0, trendByDay: [], salesIntelligence: { eventCount: 0, byEventFamily: {} } } },
      'sales-intelligence-page-governance-report': { data: { totals: { governanceEventCount: 0, traceabilityEvaluationCount: 0, actionRequiredCount: 0 }, governanceStatusCounts: {}, traceabilityDecisionCounts: {}, timeline: [], recommendedCommands: [] } },
      'sales-intelligence-page-governance-report-export': { data: { governanceType: 'weekly_report', status: 'ACTION_REQUIRED', governanceExport: { status: 'ACTION_REQUIRED', rolloutBlocked: true, ownerRole: 'Release Manager', alerts: [], actions: [], evaluatedAt: '2026-02-22T10:00:00+00:00', requestedBy: 'u1' } } },
      'sales-intelligence-page-governance-report-history': { data: { governanceType: 'weekly_report_history', generatedAt: '2026-02-22T10:00:00+00:00', retentionDays: 30, artifactCount: 0, staleCount: 0, rolloutBlockedCount: 0, items: [], recommendedCommands: [] } },
      'sales-intelligence-page-governance-schema': {
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
            computedAt: '2026-02-22T10:00:00+00:00',
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
      root.render(<SalesIntelligence />);
    });

    const parityCard = container.querySelector(
      '[data-testid="sales-governance-schema-parity-posture"]'
    );
    const parityWarning = container.querySelector(
      '[data-testid="sales-governance-schema-parity-warning"]'
    );
    expect(parityCard?.textContent).toContain('Schema Parity Status: FAIL');
    expect(parityWarning?.textContent).toContain(
      'reason codes (top-level vs export actions)'
    );
    expect(parityWarning?.textContent).toContain(
      'recommended commands (top-level vs export)'
    );
  });

  it('shows governance schema audit telemetry posture in sales intelligence telemetry panels', async () => {
    setupQueryMocks({
      'sales-intelligence-page-portfolio': { data: { campaignCount: 0, activeCampaignCount: 0, portfolioTotals: { sent: 0, opened: 0, replied: 0 }, averageReplyRate: 0, rankedCampaigns: [] } },
      'sales-intelligence-page-campaign': { data: undefined },
      'sales-intelligence-page-prediction-report': { data: { qualityTier: 'watch', rolloutDecision: 'hold', sampleSize: 1, meanAbsoluteCalibrationError: 0.2, recommendations: [] } },
      'sales-intelligence-page-telemetry': {
        data: {
          generatedAt: '2026-02-22T10:00:00+00:00',
          windowDays: 7,
          eventCount: 2,
          errorEventCount: 0,
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
            latestEvaluatedAt: '2026-02-22T10:00:00+00:00',
          },
          recentEventsTotalCount: 1,
          recentEventsFilteredCount: 1,
          recentEventsPacketValidationCount: 0,
          recentEventsNonPacketCount: 1,
          recentEvents: [
            {
              eventType: 'integrations_traceability_governance_schema_viewed',
              provider: 'integrations',
              requestId: 'req-sales-governance-schema-audit-ui',
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
      'sales-intelligence-page-integrations-health': {
        data: {
          generatedAt: '2026-02-22T10:00:00+00:00',
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
      'sales-intelligence-page-integrations-health': {
        data: {
          generatedAt: '2026-02-22T10:00:00+00:00',
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
      'sales-intelligence-page-integrations-health': {
        data: {
          generatedAt: '2026-02-22T10:00:00+00:00',
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
      'sales-intelligence-page-integrations-health': {
        data: {
          generatedAt: '2026-02-22T10:00:00+00:00',
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
      'sales-intelligence-page-integrations-health': {
        data: {
          generatedAt: '2026-02-22T10:00:00+00:00',
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
      'sales-intelligence-page-governance-report': { data: { totals: { governanceEventCount: 0, traceabilityEvaluationCount: 0, actionRequiredCount: 0 }, governanceStatusCounts: {}, traceabilityDecisionCounts: {}, timeline: [], recommendedCommands: [] } },
      'sales-intelligence-page-governance-report-export': { data: { governanceType: 'weekly_report', status: 'READY', governanceExport: { status: 'READY', rolloutBlocked: false, ownerRole: 'Release Manager', alerts: [], actions: [], evaluatedAt: '2026-02-22T10:00:00+00:00', requestedBy: 'u1' } } },
      'sales-intelligence-page-governance-report-history': { data: { governanceType: 'weekly_report_history', generatedAt: '2026-02-22T10:00:00+00:00', retentionDays: 30, artifactCount: 0, staleCount: 0, rolloutBlockedCount: 0, items: [], recommendedCommands: [] } },
      'sales-intelligence-page-governance-schema': { data: { governanceType: 'schema_metadata', status: 'READY', schemaMetadata: { activeVersion: 1, defaultVersion: 1, supportedVersions: [1], source: 'default', override: { isSet: false, isValid: true } }, alerts: [], recommendedCommands: ['npm run verify:governance:schema:preflight'] } },
      'sales-intelligence-page-baseline-governance': {
        data: {
          generatedAt: '2026-02-22T10:00:00+00:00',
          status: 'PASS',
          runtimePrereqs: {
            present: true,
            available: true,
            passed: false,
            contractValid: true,
            valid: false,
            missingCheckCount: 1,
            missingChecks: { commands: ['node'], workspace: [] },
          },
          releaseGateFixturePolicy: { passed: true, requiredProfiles: ['pass', 'hold', 'validation-fail'], missingProfiles: [] },
          releaseGateFixtures: { allProfilesAvailable: true, availableProfileCount: 3, profileCount: 3 },
        },
      },
    });

    await act(async () => {
      root.render(<SalesIntelligence />);
    });

    expect(container.textContent).toContain('Governance Schema Audit Posture');
    expect(container.textContent).toContain('Parity posture: FAIL');
    expect(container.textContent).toContain('schema parity FAIL rollout-blocked reason-codes 2 commands 1');
    expect(container.textContent).toContain('Baseline Runtime Prereq Gate: FAIL');
  });

  it('shows governance parity warning when connector pressure parity flags drift', async () => {
    setupQueryMocks({
      'sales-intelligence-page-portfolio': { data: { campaignCount: 0, activeCampaignCount: 0, portfolioTotals: { sent: 0, opened: 0, replied: 0 }, averageReplyRate: 0, rankedCampaigns: [] } },
      'sales-intelligence-page-campaign': { data: undefined },
      'sales-intelligence-page-prediction-report': { data: { qualityTier: 'watch', rolloutDecision: 'hold', sampleSize: 1, meanAbsoluteCalibrationError: 0.2, recommendations: [] } },
      'sales-intelligence-page-telemetry': { data: { eventCount: 0, errorEventCount: 0, trendByDay: [], salesIntelligence: { eventCount: 0, byEventFamily: {} } } },
      'sales-intelligence-page-governance-report': {
        data: {
          generatedAt: '2026-02-22T10:00:00+00:00',
          windowDays: 7,
          eventLimit: 500,
          status: 'ACTION_REQUIRED',
          totals: {
            governanceEventCount: 1,
            traceabilityEvaluationCount: 1,
            actionRequiredCount: 1,
            connectorRateLimitEventCount: 2,
            rolloutBlockedCount: 1,
          },
          handoff: { rolloutBlocked: true, ownerRole: 'Release Manager' },
          governanceStatusCounts: { ACTION_REQUIRED: 1 },
          traceabilityDecisionCounts: { HOLD: 1 },
          timeline: [],
          latestEvents: [],
          ownerActionMatrix: [],
          recommendedCommands: [],
        },
      },
      'sales-intelligence-page-governance-report-export': {
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
      'sales-intelligence-page-governance-report-history': { data: { governanceType: 'weekly_report_history', generatedAt: '2026-02-22T10:00:00+00:00', status: 'ACTION_REQUIRED', retentionDays: 30, artifactCount: 1, staleCount: 0, rolloutBlockedCount: 1, items: [], recommendedCommands: [] } },
      'sales-intelligence-page-governance-schema': {
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
      root.render(<SalesIntelligence />);
    });

    const warning = container.querySelector('[data-testid="sales-governance-parity-warning"]');
    expect(warning).toBeTruthy();
    expect(warning?.textContent).toContain('connector by-endpoint distribution mismatch');
    expect(warning?.textContent).toContain('sendgrid timestamp event-count mismatch');
  });

  it('normalizes governance history filters and reissues history query with bounded values', async () => {
    setupQueryMocks({
      'sales-intelligence-page-portfolio': {
        data: {
          campaignCount: 1,
          activeCampaignCount: 1,
          portfolioTotals: { sent: 80, opened: 30, replied: 6 },
          averageReplyRate: 0.075,
          rankedCampaigns: [
            {
              campaignId: 'c2',
              name: 'Enterprise Reactivation',
              status: 'active',
              totals: { sent: 80, opened: 30, replied: 6 },
              overall: { openRate: 0.375, replyRate: 0.075, qualityTier: 'watch' },
            },
          ],
        },
      },
      'sales-intelligence-page-campaign': {
        data: {
          campaignId: 'c2',
          name: 'Enterprise Reactivation',
          status: 'active',
          totals: { sent: 80, opened: 30, replied: 6 },
          overall: { openRate: 0.375, replyRate: 0.075, replyToOpenRate: 0.2, qualityTier: 'watch' },
          byChannel: [],
          recommendations: [],
        },
      },
      'sales-intelligence-page-prediction-report': {
        data: {
          qualityTier: 'watch',
          rolloutDecision: 'hold',
          sampleSize: 35,
          meanAbsoluteCalibrationError: 0.28,
          recommendations: [],
        },
      },
      'sales-intelligence-page-telemetry': {
        data: {
          generatedAt: '2026-02-22T10:00:00+00:00',
          windowDays: 7,
          eventCount: 10,
          errorEventCount: 2,
          trendByDay: [{ date: '2026-02-21', events: 10, errors: 2, salesIntelligenceEvents: 7 }],
          salesIntelligence: { eventCount: 7, byEventFamily: { prediction: 7 } },
        },
      },
      'sales-intelligence-page-governance-report': {
        data: {
          generatedAt: '2026-02-22T10:00:00+00:00',
          windowDays: 7,
          eventLimit: 500,
          totals: {
            governanceEventCount: 3,
            traceabilityEvaluationCount: 2,
            snapshotEvaluationCount: 2,
            baselineEvaluationCount: 1,
            actionRequiredCount: 1,
            rolloutBlockedCount: 2,
          },
          governanceStatusCounts: { ACTION_REQUIRED: 1, PASS: 2 },
          traceabilityDecisionCounts: { HOLD: 1, PROCEED: 1 },
          timeline: [],
          recommendedCommands: ['npm run verify:governance:weekly'],
        },
      },
      'sales-intelligence-page-governance-report-export': {
        data: {
          governanceType: 'weekly_report',
          generatedAt: '2026-02-22T10:00:00+00:00',
          windowDays: 7,
          eventLimit: 500,
          status: 'ACTION_REQUIRED',
          governanceExport: {
            governanceType: 'weekly_report',
            status: 'ACTION_REQUIRED',
            rolloutBlocked: true,
            ownerRole: 'Release Manager',
            alerts: [],
            actions: [],
            evaluatedAt: '2026-02-22T10:00:00+00:00',
            requestedBy: 'u1',
          },
        },
      },
      'sales-intelligence-page-governance-report-history': {
        data: {
          governanceType: 'weekly_report_history',
          generatedAt: '2026-02-22T10:00:00+00:00',
          retentionDays: 30,
          artifactCount: 1,
          staleCount: 0,
          rolloutBlockedCount: 0,
          items: [],
          recommendedCommands: ['npm run verify:smoke:governance-history-retention'],
        },
      },
    });

    await act(async () => {
      root.render(<SalesIntelligence />);
    });

    const daysInput = container.querySelector('[data-testid="sales-governance-history-days-input"]') as HTMLInputElement;
    const limitInput = container.querySelector('[data-testid="sales-governance-history-limit-input"]') as HTMLInputElement;
    const refreshButton = container.querySelector('[data-testid="sales-governance-history-refresh-btn"]') as HTMLButtonElement;

    expect(daysInput).toBeTruthy();
    expect(limitInput).toBeTruthy();
    expect(refreshButton).toBeTruthy();

    await act(async () => {
      setNumberInputValue(daysInput, '999');
      setNumberInputValue(limitInput, '0');
    });
    await act(async () => {
      refreshButton.click();
    });

    const historyCalls = mockUseQuery.mock.calls
      .map((entry) => entry[0])
      .filter((options) => Array.isArray(options?.queryKey) && options.queryKey[0] === 'sales-intelligence-page-governance-report-history');
    const latestHistoryKey = historyCalls[historyCalls.length - 1].queryKey;

    expect(latestHistoryKey[1]).toBe(365);
    expect(latestHistoryKey[2]).toBe(1);
    expect(daysInput.value).toBe('365');
    expect(limitInput.value).toBe('1');
    expect(container.textContent).toContain('Governance history filter values were normalized to allowed bounds.');
  });

  it('copies governance history commands when clipboard is available', async () => {
    setupQueryMocks({
      'sales-intelligence-page-portfolio': { data: { campaignCount: 0, activeCampaignCount: 0, portfolioTotals: { sent: 0, opened: 0, replied: 0 }, averageReplyRate: 0, rankedCampaigns: [] } },
      'sales-intelligence-page-campaign': { data: undefined },
      'sales-intelligence-page-prediction-report': { data: { qualityTier: 'watch', rolloutDecision: 'hold', sampleSize: 1, meanAbsoluteCalibrationError: 0.2, recommendations: [] } },
      'sales-intelligence-page-telemetry': { data: { eventCount: 0, errorEventCount: 0, trendByDay: [], salesIntelligence: { eventCount: 0, byEventFamily: {} } } },
      'sales-intelligence-page-governance-report': { data: { totals: { governanceEventCount: 0, traceabilityEvaluationCount: 0, actionRequiredCount: 0 }, governanceStatusCounts: {}, traceabilityDecisionCounts: {}, timeline: [], recommendedCommands: [] } },
      'sales-intelligence-page-governance-report-export': { data: { status: 'READY', governanceExport: { governanceType: 'weekly_report', status: 'READY', rolloutBlocked: false, ownerRole: 'Release Manager', alerts: [], actions: [], evaluatedAt: '2026-02-22T10:00:00+00:00', requestedBy: 'u1' } } },
      'sales-intelligence-page-governance-report-history': {
        data: {
          governanceType: 'weekly_report_history',
          generatedAt: '2026-02-22T10:00:00+00:00',
          retentionDays: 30,
          artifactCount: 1,
          staleCount: 0,
          rolloutBlockedCount: 0,
          items: [],
          recommendedCommands: ['npm run verify:governance:weekly', 'npm run verify:smoke:governance-history-retention'],
        },
      },
    });

    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    await act(async () => {
      root.render(<SalesIntelligence />);
    });

    const copyButton = container.querySelector('[data-testid="sales-governance-history-commands-copy-btn"]') as HTMLButtonElement;
    expect(copyButton).toBeTruthy();
    await act(async () => {
      copyButton.click();
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledWith(
      'npm run verify:governance:weekly\nnpm run verify:smoke:governance-history-retention'
    );
    expect(container.textContent).toContain('Governance history commands copied.');
  });

  it('downloads governance history commands when clipboard is unavailable', async () => {
    setupQueryMocks({
      'sales-intelligence-page-portfolio': { data: { campaignCount: 0, activeCampaignCount: 0, portfolioTotals: { sent: 0, opened: 0, replied: 0 }, averageReplyRate: 0, rankedCampaigns: [] } },
      'sales-intelligence-page-campaign': { data: undefined },
      'sales-intelligence-page-prediction-report': { data: { qualityTier: 'watch', rolloutDecision: 'hold', sampleSize: 1, meanAbsoluteCalibrationError: 0.2, recommendations: [] } },
      'sales-intelligence-page-telemetry': { data: { eventCount: 0, errorEventCount: 0, trendByDay: [], salesIntelligence: { eventCount: 0, byEventFamily: {} } } },
      'sales-intelligence-page-governance-report': { data: { totals: { governanceEventCount: 0, traceabilityEvaluationCount: 0, actionRequiredCount: 0 }, governanceStatusCounts: {}, traceabilityDecisionCounts: {}, timeline: [], recommendedCommands: [] } },
      'sales-intelligence-page-governance-report-export': { data: { status: 'READY', governanceExport: { governanceType: 'weekly_report', status: 'READY', rolloutBlocked: false, ownerRole: 'Release Manager', alerts: [], actions: [], evaluatedAt: '2026-02-22T10:00:00+00:00', requestedBy: 'u1' } } },
      'sales-intelligence-page-governance-report-history': {
        data: {
          governanceType: 'weekly_report_history',
          generatedAt: '2026-02-22T10:00:00+00:00',
          retentionDays: 30,
          artifactCount: 1,
          staleCount: 0,
          rolloutBlockedCount: 0,
          items: [],
          recommendedCommands: ['npm run verify:governance:weekly'],
        },
      },
    });

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    });
    const originalCreateElement = document.createElement.bind(document);
    const anchorClick = jest.fn();
    const createElementSpy = jest
      .spyOn(document, 'createElement')
      .mockImplementation((tagName: any, options?: any) => {
        const element = originalCreateElement(tagName, options);
        if (String(tagName).toLowerCase() === 'a') {
          Object.defineProperty(element, 'click', {
            configurable: true,
            value: anchorClick,
          });
        }
        return element;
      });
    const createObjectUrlMock = jest.fn(() => 'blob:sales-governance-history-commands');
    const revokeObjectUrlMock = jest.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectUrlMock,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectUrlMock,
    });

    await act(async () => {
      root.render(<SalesIntelligence />);
    });

    const copyButton = container.querySelector('[data-testid="sales-governance-history-commands-copy-btn"]') as HTMLButtonElement;
    expect(copyButton).toBeTruthy();
    await act(async () => {
      copyButton.click();
    });

    expect(createObjectUrlMock).toHaveBeenCalled();
    expect(revokeObjectUrlMock).toHaveBeenCalled();
    expect(anchorClick).toHaveBeenCalled();
    expect(container.textContent).toContain('Clipboard unavailable. Governance history commands downloaded.');

    createElementSpy.mockRestore();
  });

  it('copies baseline governance commands from backend recommended chain', async () => {
    setupQueryMocks({
      'sales-intelligence-page-portfolio': { data: { campaignCount: 0, activeCampaignCount: 0, portfolioTotals: { sent: 0, opened: 0, replied: 0 }, averageReplyRate: 0, rankedCampaigns: [] } },
      'sales-intelligence-page-campaign': { data: undefined },
      'sales-intelligence-page-prediction-report': { data: { qualityTier: 'watch', rolloutDecision: 'hold', sampleSize: 1, meanAbsoluteCalibrationError: 0.2, recommendations: [] } },
      'sales-intelligence-page-telemetry': { data: { eventCount: 0, errorEventCount: 0, trendByDay: [], salesIntelligence: { eventCount: 0, byEventFamily: {} } } },
      'sales-intelligence-page-governance-report': { data: { totals: { governanceEventCount: 0, traceabilityEvaluationCount: 0, actionRequiredCount: 0 }, governanceStatusCounts: {}, traceabilityDecisionCounts: {}, timeline: [], recommendedCommands: [] } },
      'sales-intelligence-page-governance-report-export': { data: { status: 'READY', governanceExport: { governanceType: 'weekly_report', status: 'READY', rolloutBlocked: false, ownerRole: 'Release Manager', alerts: [], actions: [], evaluatedAt: '2026-02-22T10:00:00+00:00', requestedBy: 'u1' } } },
      'sales-intelligence-page-governance-report-history': { data: { governanceType: 'weekly_report_history', generatedAt: '2026-02-22T10:00:00+00:00', retentionDays: 30, artifactCount: 0, staleCount: 0, rolloutBlockedCount: 0, items: [], recommendedCommands: [] } },
      'sales-intelligence-page-baseline-governance': {
        data: {
          governanceType: 'baseline',
          status: 'FAIL',
          recommendedCommands: [
            'npm run verify:smoke:baseline-orchestration-remediation',
            'npm run verify:ci:sales:extended',
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
            validatedAt: '2026-02-22T10:00:00+00:00',
            command: 'verify_sales_baseline_command_aliases',
          },
          rolloutActions: [],
        },
      },
    });

    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    await act(async () => {
      root.render(<SalesIntelligence />);
    });

    expect(container.textContent).toContain('Baseline Command Alias Gate: FAIL');
    expect(container.textContent).toContain('Baseline Command Alias Drift (missing/mismatched): 1/1');
    expect(container.textContent).toContain('Command alias command: verify_sales_baseline_command_aliases');

    const copyButton = container.querySelector('[data-testid="sales-baseline-governance-commands-copy-btn"]') as HTMLButtonElement;
    expect(copyButton).toBeTruthy();
    await act(async () => {
      copyButton.click();
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledWith(
      'npm run verify:smoke:baseline-orchestration-remediation\nnpm run verify:baseline:command-aliases:artifact\nnpm run verify:baseline:command-aliases:artifact:contract\nnpm run verify:smoke:baseline-command-aliases-artifact\nnpm run verify:ci:sales:extended'
    );
    expect(container.textContent).toContain('Baseline governance commands copied.');
  });

  it('collapses legacy orchestration entries when baseline recommended commands include wrapper command', async () => {
    setupQueryMocks({
      'sales-intelligence-page-portfolio': { data: { campaignCount: 0, activeCampaignCount: 0, portfolioTotals: { sent: 0, opened: 0, replied: 0 }, averageReplyRate: 0, rankedCampaigns: [] } },
      'sales-intelligence-page-campaign': { data: undefined },
      'sales-intelligence-page-prediction-report': { data: { qualityTier: 'watch', rolloutDecision: 'hold', sampleSize: 1, meanAbsoluteCalibrationError: 0.2, recommendations: [] } },
      'sales-intelligence-page-telemetry': { data: { eventCount: 0, errorEventCount: 0, trendByDay: [], salesIntelligence: { eventCount: 0, byEventFamily: {} } } },
      'sales-intelligence-page-governance-report': { data: { totals: { governanceEventCount: 0, traceabilityEvaluationCount: 0, actionRequiredCount: 0 }, governanceStatusCounts: {}, traceabilityDecisionCounts: {}, timeline: [], recommendedCommands: [] } },
      'sales-intelligence-page-governance-report-export': { data: { status: 'ACTION_REQUIRED', governanceExport: { governanceType: 'weekly_report', status: 'ACTION_REQUIRED', rolloutBlocked: true, ownerRole: 'Release Manager', alerts: [], actions: [], evaluatedAt: '2026-02-22T10:00:00+00:00', requestedBy: 'u1' } } },
      'sales-intelligence-page-governance-report-history': { data: { governanceType: 'weekly_report_history', generatedAt: '2026-02-22T10:00:00+00:00', retentionDays: 30, artifactCount: 0, staleCount: 0, rolloutBlockedCount: 1, items: [], recommendedCommands: [] } },
      'sales-intelligence-page-baseline-governance': {
        data: {
          governanceType: 'baseline',
          status: 'FAIL',
          recommendedCommands: [
            'npm run verify:smoke:baseline-orchestration-remediation',
            'npm run verify:smoke:orchestration-slo-gate',
            'npm run verify:baseline:metrics',
            'npm run verify:smoke:baseline-governance-drift',
            'npm run verify:ci:sales:extended',
          ],
          rolloutActions: [
            { command: 'npm run verify:smoke:orchestration-slo-gate' },
            { command: 'npm run verify:baseline:metrics' },
            { command: 'npm run verify:ci:sales:extended' },
          ],
        },
      },
    });

    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    await act(async () => {
      root.render(<SalesIntelligence />);
    });

    expect(container.querySelector('[data-testid="sales-baseline-governance-command-fallback-warning"]')).toBeFalsy();

    const copyButton = container.querySelector('[data-testid="sales-baseline-governance-commands-copy-btn"]') as HTMLButtonElement;
    expect(copyButton).toBeTruthy();
    await act(async () => {
      copyButton.click();
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledWith(
      'npm run verify:smoke:baseline-orchestration-remediation\nnpm run verify:baseline:command-aliases:artifact\nnpm run verify:baseline:command-aliases:artifact:contract\nnpm run verify:smoke:baseline-command-aliases-artifact\nnpm run verify:ci:sales:extended'
    );
  });

  it('shows baseline fallback warning and local fallback command chain when recommended commands are missing', async () => {
    setupQueryMocks({
      'sales-intelligence-page-portfolio': { data: { campaignCount: 0, activeCampaignCount: 0, portfolioTotals: { sent: 0, opened: 0, replied: 0 }, averageReplyRate: 0, rankedCampaigns: [] } },
      'sales-intelligence-page-campaign': { data: undefined },
      'sales-intelligence-page-prediction-report': { data: { qualityTier: 'watch', rolloutDecision: 'hold', sampleSize: 1, meanAbsoluteCalibrationError: 0.2, recommendations: [] } },
      'sales-intelligence-page-telemetry': { data: { eventCount: 0, errorEventCount: 0, trendByDay: [], salesIntelligence: { eventCount: 0, byEventFamily: {} } } },
      'sales-intelligence-page-governance-report': { data: { totals: { governanceEventCount: 0, traceabilityEvaluationCount: 0, actionRequiredCount: 0 }, governanceStatusCounts: {}, traceabilityDecisionCounts: {}, timeline: [], recommendedCommands: [] } },
      'sales-intelligence-page-governance-report-export': { data: { status: 'ACTION_REQUIRED', governanceExport: { governanceType: 'weekly_report', status: 'ACTION_REQUIRED', rolloutBlocked: true, ownerRole: 'Release Manager', alerts: [], actions: [], evaluatedAt: '2026-02-22T10:00:00+00:00', requestedBy: 'u1' } } },
      'sales-intelligence-page-governance-report-history': { data: { governanceType: 'weekly_report_history', generatedAt: '2026-02-22T10:00:00+00:00', retentionDays: 30, artifactCount: 0, staleCount: 0, rolloutBlockedCount: 1, items: [], recommendedCommands: [] } },
      'sales-intelligence-page-baseline-governance': {
        data: {
          governanceType: 'baseline',
          status: 'FAIL',
          orchestrationGate: {
            available: false,
            attemptErrorGatePassed: null,
            attemptSkippedGatePassed: null,
          },
          rolloutActions: [
            { command: 'npm run verify:smoke:orchestration-slo-gate' },
            { command: 'npm run verify:baseline:metrics' },
            { command: 'npm run verify:smoke:baseline-governance-drift' },
            { command: 'npm run verify:ci:sales:extended' },
          ],
        },
      },
    });

    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    await act(async () => {
      root.render(<SalesIntelligence />);
    });

    expect(container.querySelector('[data-testid="sales-baseline-governance-command-fallback-warning"]')).toBeTruthy();

    const copyButton = container.querySelector('[data-testid="sales-baseline-governance-commands-copy-btn"]') as HTMLButtonElement;
    expect(copyButton).toBeTruthy();
    await act(async () => {
      copyButton.click();
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledWith(
      'npm run verify:smoke:baseline-orchestration-remediation\nnpm run verify:baseline:command-aliases:artifact\nnpm run verify:baseline:command-aliases:artifact:contract\nnpm run verify:smoke:baseline-command-aliases-artifact\nnpm run verify:ci:sales:extended'
    );
    expect(container.textContent).toContain('Baseline governance commands copied.');
  });

  it('downloads baseline fallback command chain when clipboard is unavailable', async () => {
    setupQueryMocks({
      'sales-intelligence-page-portfolio': { data: { campaignCount: 0, activeCampaignCount: 0, portfolioTotals: { sent: 0, opened: 0, replied: 0 }, averageReplyRate: 0, rankedCampaigns: [] } },
      'sales-intelligence-page-campaign': { data: undefined },
      'sales-intelligence-page-prediction-report': { data: { qualityTier: 'watch', rolloutDecision: 'hold', sampleSize: 1, meanAbsoluteCalibrationError: 0.2, recommendations: [] } },
      'sales-intelligence-page-telemetry': { data: { eventCount: 0, errorEventCount: 0, trendByDay: [], salesIntelligence: { eventCount: 0, byEventFamily: {} } } },
      'sales-intelligence-page-governance-report': { data: { totals: { governanceEventCount: 0, traceabilityEvaluationCount: 0, actionRequiredCount: 0 }, governanceStatusCounts: {}, traceabilityDecisionCounts: {}, timeline: [], recommendedCommands: [] } },
      'sales-intelligence-page-governance-report-export': { data: { status: 'ACTION_REQUIRED', governanceExport: { governanceType: 'weekly_report', status: 'ACTION_REQUIRED', rolloutBlocked: true, ownerRole: 'Release Manager', alerts: [], actions: [], evaluatedAt: '2026-02-22T10:00:00+00:00', requestedBy: 'u1' } } },
      'sales-intelligence-page-governance-report-history': { data: { governanceType: 'weekly_report_history', generatedAt: '2026-02-22T10:00:00+00:00', retentionDays: 30, artifactCount: 0, staleCount: 0, rolloutBlockedCount: 1, items: [], recommendedCommands: [] } },
      'sales-intelligence-page-baseline-governance': {
        data: {
          governanceType: 'baseline',
          status: 'FAIL',
          orchestrationGate: {
            available: false,
            attemptErrorGatePassed: null,
            attemptSkippedGatePassed: null,
          },
          rolloutActions: [
            { command: 'npm run verify:smoke:orchestration-slo-gate' },
            { command: 'npm run verify:baseline:metrics' },
            { command: 'npm run verify:smoke:baseline-governance-drift' },
            { command: 'npm run verify:ci:sales:extended' },
          ],
        },
      },
    });

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    });

    const createObjectUrlMock = jest.fn(() => 'blob:sales-baseline-governance-commands');
    const revokeObjectUrlMock = jest.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectUrlMock,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectUrlMock,
    });

    await act(async () => {
      root.render(<SalesIntelligence />);
    });

    expect(container.querySelector('[data-testid="sales-baseline-governance-command-fallback-warning"]')).toBeTruthy();

    const copyButton = container.querySelector('[data-testid="sales-baseline-governance-commands-copy-btn"]') as HTMLButtonElement;
    expect(copyButton).toBeTruthy();
    await act(async () => {
      copyButton.click();
    });

    expect(createObjectUrlMock).toHaveBeenCalledTimes(1);
    const downloadedBlob = createObjectUrlMock.mock.calls[0][0] as Blob;
    const downloadedText = await readBlobAsText(downloadedBlob);
    expect(downloadedText).toBe(
      'npm run verify:smoke:baseline-orchestration-remediation\nnpm run verify:baseline:command-aliases:artifact\nnpm run verify:baseline:command-aliases:artifact:contract\nnpm run verify:smoke:baseline-command-aliases-artifact\nnpm run verify:ci:sales:extended'
    );
    expect(revokeObjectUrlMock).toHaveBeenCalled();
    expect(anchorClickSpy).toHaveBeenCalled();
    expect(container.textContent).toContain('Clipboard unavailable. Baseline governance commands downloaded.');
  });

  it('copies governance schema commands when clipboard is available', async () => {
    setupQueryMocks({
      'sales-intelligence-page-portfolio': { data: { campaignCount: 0, activeCampaignCount: 0, portfolioTotals: { sent: 0, opened: 0, replied: 0 }, averageReplyRate: 0, rankedCampaigns: [] } },
      'sales-intelligence-page-campaign': { data: undefined },
      'sales-intelligence-page-prediction-report': { data: { qualityTier: 'watch', rolloutDecision: 'hold', sampleSize: 1, meanAbsoluteCalibrationError: 0.2, recommendations: [] } },
      'sales-intelligence-page-telemetry': { data: { eventCount: 0, errorEventCount: 0, trendByDay: [], salesIntelligence: { eventCount: 0, byEventFamily: {} } } },
      'sales-intelligence-page-governance-report': { data: { totals: { governanceEventCount: 0, traceabilityEvaluationCount: 0, actionRequiredCount: 0 }, governanceStatusCounts: {}, traceabilityDecisionCounts: {}, timeline: [], recommendedCommands: [] } },
      'sales-intelligence-page-governance-report-export': { data: { status: 'READY', governanceExport: { governanceType: 'weekly_report', status: 'READY', rolloutBlocked: false, ownerRole: 'Release Manager', alerts: [], actions: [], evaluatedAt: '2026-02-22T10:00:00+00:00', requestedBy: 'u1' } } },
      'sales-intelligence-page-governance-report-history': {
        data: {
          governanceType: 'weekly_report_history',
          generatedAt: '2026-02-22T10:00:00+00:00',
          retentionDays: 30,
          artifactCount: 1,
          staleCount: 0,
          rolloutBlockedCount: 0,
          items: [],
          recommendedCommands: [],
        },
      },
      'sales-intelligence-page-governance-schema': {
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
          recommendedCommands: [
            'npm run verify:governance:schema:preflight',
            'npm run verify:governance:weekly:endpoint:contract',
          ],
        },
      },
    });

    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    await act(async () => {
      root.render(<SalesIntelligence />);
    });

    const copyButton = container.querySelector('[data-testid="sales-governance-schema-commands-copy-btn"]') as HTMLButtonElement;
    expect(copyButton).toBeTruthy();
    await act(async () => {
      copyButton.click();
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledWith(
      'npm run verify:governance:schema:preflight\nnpm run verify:governance:weekly:endpoint:contract'
    );
    expect(container.textContent).toContain('Governance schema commands copied.');
  });

  it('downloads governance schema commands when clipboard is unavailable', async () => {
    setupQueryMocks({
      'sales-intelligence-page-portfolio': { data: { campaignCount: 0, activeCampaignCount: 0, portfolioTotals: { sent: 0, opened: 0, replied: 0 }, averageReplyRate: 0, rankedCampaigns: [] } },
      'sales-intelligence-page-campaign': { data: undefined },
      'sales-intelligence-page-prediction-report': { data: { qualityTier: 'watch', rolloutDecision: 'hold', sampleSize: 1, meanAbsoluteCalibrationError: 0.2, recommendations: [] } },
      'sales-intelligence-page-telemetry': { data: { eventCount: 0, errorEventCount: 0, trendByDay: [], salesIntelligence: { eventCount: 0, byEventFamily: {} } } },
      'sales-intelligence-page-governance-report': { data: { totals: { governanceEventCount: 0, traceabilityEvaluationCount: 0, actionRequiredCount: 0 }, governanceStatusCounts: {}, traceabilityDecisionCounts: {}, timeline: [], recommendedCommands: [] } },
      'sales-intelligence-page-governance-report-export': { data: { status: 'READY', governanceExport: { governanceType: 'weekly_report', status: 'READY', rolloutBlocked: false, ownerRole: 'Release Manager', alerts: [], actions: [], evaluatedAt: '2026-02-22T10:00:00+00:00', requestedBy: 'u1' } } },
      'sales-intelligence-page-governance-report-history': {
        data: {
          governanceType: 'weekly_report_history',
          generatedAt: '2026-02-22T10:00:00+00:00',
          retentionDays: 30,
          artifactCount: 1,
          staleCount: 0,
          rolloutBlockedCount: 0,
          items: [],
          recommendedCommands: [],
        },
      },
      'sales-intelligence-page-governance-schema': {
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

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    });
    const originalCreateElement = document.createElement.bind(document);
    const anchorClick = jest.fn();
    const createElementSpy = jest
      .spyOn(document, 'createElement')
      .mockImplementation((tagName: any, options?: any) => {
        const element = originalCreateElement(tagName, options);
        if (String(tagName).toLowerCase() === 'a') {
          Object.defineProperty(element, 'click', {
            configurable: true,
            value: anchorClick,
          });
        }
        return element;
      });
    const createObjectUrlMock = jest.fn(() => 'blob:sales-governance-schema-commands');
    const revokeObjectUrlMock = jest.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectUrlMock,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectUrlMock,
    });

    await act(async () => {
      root.render(<SalesIntelligence />);
    });

    const copyButton = container.querySelector('[data-testid="sales-governance-schema-commands-copy-btn"]') as HTMLButtonElement;
    expect(copyButton).toBeTruthy();
    await act(async () => {
      copyButton.click();
    });

    expect(createObjectUrlMock).toHaveBeenCalled();
    expect(revokeObjectUrlMock).toHaveBeenCalled();
    expect(anchorClick).toHaveBeenCalled();
    expect(container.textContent).toContain('Clipboard unavailable. Governance schema commands downloaded.');

    createElementSpy.mockRestore();
  });

  it('normalizes recent-event governance and packet status tokens for telemetry rendering and export', async () => {
    setupQueryMocks({
      'sales-intelligence-page-portfolio': {
        data: {
          campaignCount: 0,
          activeCampaignCount: 0,
          portfolioTotals: { sent: 0, opened: 0, replied: 0 },
          averageReplyRate: 0,
          rankedCampaigns: [],
        },
      },
      'sales-intelligence-page-campaign': { data: undefined },
      'sales-intelligence-page-prediction-report': {
        data: {
          qualityTier: 'watch',
          rolloutDecision: 'hold',
          sampleSize: 1,
          meanAbsoluteCalibrationError: 0.2,
          recommendations: [],
        },
      },
      'sales-intelligence-page-telemetry': {
        data: {
          generatedAt: '2026-02-22T10:00:00+00:00',
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
              requestId: 'req-sales-normalized-status',
              governanceStatus: ' pass ',
              governancePacketValidationStatus: ' action required ',
              governancePacketValidationWithinFreshness: false,
            },
          ],
        },
      },
      'sales-intelligence-page-governance-report': { data: { totals: { governanceEventCount: 0, traceabilityEvaluationCount: 0, actionRequiredCount: 0 }, governanceStatusCounts: {}, traceabilityDecisionCounts: {}, timeline: [], recommendedCommands: [] } },
      'sales-intelligence-page-governance-report-export': { data: { status: 'READY', governanceExport: { governanceType: 'weekly_report', status: 'READY', rolloutBlocked: false, ownerRole: 'Release Manager', alerts: [], actions: [], evaluatedAt: '2026-02-22T10:00:00+00:00', requestedBy: 'u1' } } },
      'sales-intelligence-page-governance-report-history': { data: { governanceType: 'weekly_report_history', generatedAt: '2026-02-22T10:00:00+00:00', retentionDays: 30, artifactCount: 0, staleCount: 0, rolloutBlockedCount: 0, items: [], recommendedCommands: [] } },
      'sales-intelligence-page-governance-schema': { data: { governanceType: 'schema_metadata', status: 'READY', schemaMetadata: { activeVersion: 1, defaultVersion: 1, supportedVersions: [1], source: 'default', override: { isSet: false, isValid: true } }, alerts: [], recommendedCommands: [] } },
    });

    const originalCreateElement = document.createElement.bind(document);
    const anchorClick = jest.fn();
    const createElementSpy = jest
      .spyOn(document, 'createElement')
      .mockImplementation((tagName: any, options?: any) => {
        const element = originalCreateElement(tagName, options);
        if (String(tagName).toLowerCase() === 'a') {
          Object.defineProperty(element, 'click', {
            configurable: true,
            value: anchorClick,
          });
        }
        return element;
      });
    const createObjectUrlMock = jest.fn(() => 'blob:sales-normalized-status');
    const revokeObjectUrlMock = jest.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectUrlMock,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectUrlMock,
    });

    await act(async () => {
      root.render(<SalesIntelligence />);
    });

    expect(container.textContent).toContain('governance PASS');
    expect(container.textContent).toContain('packet ACTION_REQUIRED stale');

    const exportButton = container.querySelector('[data-testid="sales-telemetry-export-btn"]') as HTMLButtonElement;
    expect(exportButton).toBeTruthy();

    await act(async () => {
      exportButton.click();
    });

    const telemetryBlob = createObjectUrlMock.mock.calls[createObjectUrlMock.mock.calls.length - 1][0] as Blob;
    const telemetryPayload = JSON.parse(await readBlobAsText(telemetryBlob));
    expect(telemetryPayload.recentEvents[0].governanceStatus).toBe('PASS');
    expect(telemetryPayload.recentEvents[0].governancePacketValidationStatus).toBe('ACTION_REQUIRED');
    expect(revokeObjectUrlMock).toHaveBeenCalled();
    expect(anchorClick).toHaveBeenCalled();

    createElementSpy.mockRestore();
  });

  it('applies telemetry status-filter selections in query key and telemetry export metadata', async () => {
    setupQueryMocks({
      'sales-intelligence-page-portfolio': {
        data: {
          campaignCount: 0,
          activeCampaignCount: 0,
          portfolioTotals: { sent: 0, opened: 0, replied: 0 },
          averageReplyRate: 0,
          rankedCampaigns: [],
        },
      },
      'sales-intelligence-page-campaign': { data: undefined },
      'sales-intelligence-page-prediction-report': {
        data: {
          qualityTier: 'watch',
          rolloutDecision: 'hold',
          sampleSize: 1,
          meanAbsoluteCalibrationError: 0.2,
          recommendations: [],
        },
      },
      'sales-intelligence-page-telemetry': {
        data: {
          generatedAt: '2026-02-22T10:00:00+00:00',
          windowDays: 7,
          eventCount: 2,
          errorEventCount: 0,
          byProvider: { integrations: 2 },
          trendByDay: [{ date: '2026-02-21', events: 2, errors: 0, salesIntelligenceEvents: 0 }],
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
              requestId: 'req-sales-status-filter-export',
              governanceStatus: 'pass',
              governancePacketValidationStatus: 'ready',
            },
          ],
        },
      },
      'sales-intelligence-page-governance-report': { data: { totals: { governanceEventCount: 0, traceabilityEvaluationCount: 0, actionRequiredCount: 0 }, governanceStatusCounts: {}, traceabilityDecisionCounts: {}, timeline: [], recommendedCommands: [] } },
      'sales-intelligence-page-governance-report-export': { data: { status: 'READY', governanceExport: { governanceType: 'weekly_report', status: 'READY', rolloutBlocked: false, ownerRole: 'Release Manager', alerts: [], actions: [], evaluatedAt: '2026-02-22T10:00:00+00:00', requestedBy: 'u1' } } },
      'sales-intelligence-page-governance-report-history': { data: { governanceType: 'weekly_report_history', generatedAt: '2026-02-22T10:00:00+00:00', retentionDays: 30, artifactCount: 0, staleCount: 0, rolloutBlockedCount: 0, items: [], recommendedCommands: [] } },
      'sales-intelligence-page-governance-schema': { data: { governanceType: 'schema_metadata', status: 'READY', schemaMetadata: { activeVersion: 1, defaultVersion: 1, supportedVersions: [1], source: 'default', override: { isSet: false, isValid: true } }, alerts: [], recommendedCommands: [] } },
    });

    const originalCreateElement = document.createElement.bind(document);
    const anchorClick = jest.fn();
    const createElementSpy = jest
      .spyOn(document, 'createElement')
      .mockImplementation((tagName: any, options?: any) => {
        const element = originalCreateElement(tagName, options);
        if (String(tagName).toLowerCase() === 'a') {
          Object.defineProperty(element, 'click', {
            configurable: true,
            value: anchorClick,
          });
        }
        return element;
      });
    const createObjectUrlMock = jest.fn(() => 'blob:sales-status-filter-export');
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectUrlMock,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: jest.fn(),
    });

    await act(async () => {
      root.render(<SalesIntelligence />);
    });

    const governanceSelect = container.querySelector(
      '[data-testid="sales-telemetry-governance-status-select"]'
    ) as HTMLSelectElement;
    const packetSelect = container.querySelector(
      '[data-testid="sales-telemetry-packet-status-select"]'
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
      .filter((options) => Array.isArray(options?.queryKey) && options.queryKey[0] === 'sales-intelligence-page-telemetry');
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

    const exportButton = container.querySelector('[data-testid="sales-telemetry-export-btn"]') as HTMLButtonElement;
    expect(exportButton).toBeTruthy();

    await act(async () => {
      exportButton.click();
    });

    const telemetryBlob = createObjectUrlMock.mock.calls[createObjectUrlMock.mock.calls.length - 1][0] as Blob;
    const telemetryPayload = JSON.parse(await readBlobAsText(telemetryBlob));
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
    expect(anchorClick).toHaveBeenCalled();

    createElementSpy.mockRestore();
  });

  it('flags telemetry status-count mismatches between server rollups and row-derived counts', async () => {
    setupQueryMocks({
      'sales-intelligence-page-portfolio': {
        data: {
          campaignCount: 0,
          activeCampaignCount: 0,
          portfolioTotals: { sent: 0, opened: 0, replied: 0 },
          averageReplyRate: 0,
          rankedCampaigns: [],
        },
      },
      'sales-intelligence-page-campaign': { data: undefined },
      'sales-intelligence-page-prediction-report': {
        data: {
          qualityTier: 'watch',
          rolloutDecision: 'hold',
          sampleSize: 1,
          meanAbsoluteCalibrationError: 0.2,
          recommendations: [],
        },
      },
      'sales-intelligence-page-telemetry': {
        data: {
          generatedAt: '2026-02-22T10:00:00+00:00',
          windowDays: 7,
          eventCount: 1,
          errorEventCount: 0,
          byProvider: { integrations: 1 },
          trendByDay: [{ date: '2026-02-21', events: 1, errors: 0, salesIntelligenceEvents: 0 }],
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
              requestId: 'req-sales-status-count-mismatch',
              governanceStatus: 'PASS',
              governancePacketValidationStatus: 'READY',
            },
          ],
        },
      },
      'sales-intelligence-page-integrations-health': {
        data: {
          generatedAt: '2026-02-22T10:00:00+00:00',
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
      'sales-intelligence-page-governance-report': { data: { totals: { governanceEventCount: 0, traceabilityEvaluationCount: 0, actionRequiredCount: 0 }, governanceStatusCounts: {}, traceabilityDecisionCounts: {}, timeline: [], recommendedCommands: [] } },
      'sales-intelligence-page-governance-report-export': { data: { status: 'READY', governanceExport: { governanceType: 'weekly_report', status: 'READY', rolloutBlocked: false, ownerRole: 'Release Manager', alerts: [], actions: [], evaluatedAt: '2026-02-22T10:00:00+00:00', requestedBy: 'u1' } } },
      'sales-intelligence-page-governance-report-history': { data: { governanceType: 'weekly_report_history', generatedAt: '2026-02-22T10:00:00+00:00', retentionDays: 30, artifactCount: 0, staleCount: 0, rolloutBlockedCount: 0, items: [], recommendedCommands: [] } },
      'sales-intelligence-page-governance-schema': { data: { governanceType: 'schema_metadata', status: 'READY', schemaMetadata: { activeVersion: 1, defaultVersion: 1, supportedVersions: [1], source: 'default', override: { isSet: false, isValid: true } }, alerts: [], recommendedCommands: [] } },
    });

    const originalCreateElement = document.createElement.bind(document);
    const anchorClick = jest.fn();
    const createElementSpy = jest
      .spyOn(document, 'createElement')
      .mockImplementation((tagName: any, options?: any) => {
        const element = originalCreateElement(tagName, options);
        if (String(tagName).toLowerCase() === 'a') {
          Object.defineProperty(element, 'click', {
            configurable: true,
            value: anchorClick,
          });
        }
        return element;
      });
    const createObjectUrlMock = jest.fn(() => 'blob:sales-status-count-mismatch-export');
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectUrlMock,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: jest.fn(),
    });

    await act(async () => {
      root.render(<SalesIntelligence />);
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

    const exportButton = container.querySelector('[data-testid="sales-telemetry-export-btn"]') as HTMLButtonElement;
    expect(exportButton).toBeTruthy();

    await act(async () => {
      exportButton.click();
    });

    const telemetryBlob = createObjectUrlMock.mock.calls[createObjectUrlMock.mock.calls.length - 1][0] as Blob;
    const telemetryPayload = JSON.parse(await readBlobAsText(telemetryBlob));
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
    expect(anchorClick).toHaveBeenCalled();

    createElementSpy.mockRestore();
  });

  it('uses backend-provided telemetry status-count provenance metadata when present', async () => {
    setupQueryMocks({
      'sales-intelligence-page-portfolio': {
        data: {
          campaignCount: 0,
          activeCampaignCount: 0,
          portfolioTotals: { sent: 0, opened: 0, replied: 0 },
          averageReplyRate: 0,
          rankedCampaigns: [],
        },
      },
      'sales-intelligence-page-campaign': { data: undefined },
      'sales-intelligence-page-prediction-report': {
        data: {
          qualityTier: 'watch',
          rolloutDecision: 'hold',
          sampleSize: 1,
          meanAbsoluteCalibrationError: 0.2,
          recommendations: [],
        },
      },
      'sales-intelligence-page-telemetry': {
        data: {
          generatedAt: '2026-02-22T10:00:00+00:00',
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
              requestId: 'req-sales-status-count-provenance-local',
              governanceStatus: 'PASS',
              governancePacketValidationStatus: 'READY',
            },
          ],
        },
      },
      'sales-intelligence-page-integrations-health': {
        data: {
          generatedAt: '2026-02-22T10:00:00+00:00',
          providers: [],
        },
      },
      'sales-intelligence-page-governance-report': { data: { totals: { governanceEventCount: 0, traceabilityEvaluationCount: 0, actionRequiredCount: 0 }, governanceStatusCounts: {}, traceabilityDecisionCounts: {}, timeline: [], recommendedCommands: [] } },
      'sales-intelligence-page-governance-report-export': { data: { status: 'READY', governanceExport: { governanceType: 'weekly_report', status: 'READY', rolloutBlocked: false, ownerRole: 'Release Manager', alerts: [], actions: [], evaluatedAt: '2026-02-22T10:00:00+00:00', requestedBy: 'u1' } } },
      'sales-intelligence-page-governance-report-history': { data: { governanceType: 'weekly_report_history', generatedAt: '2026-02-22T10:00:00+00:00', retentionDays: 30, artifactCount: 0, staleCount: 0, rolloutBlockedCount: 0, items: [], recommendedCommands: [] } },
      'sales-intelligence-page-governance-schema': { data: { governanceType: 'schema_metadata', status: 'READY', schemaMetadata: { activeVersion: 1, defaultVersion: 1, supportedVersions: [1], source: 'default', override: { isSet: false, isValid: true } }, alerts: [], recommendedCommands: [] } },
    });

    const originalCreateElement = document.createElement.bind(document);
    const anchorClick = jest.fn();
    const createElementSpy = jest
      .spyOn(document, 'createElement')
      .mockImplementation((tagName: any, options?: any) => {
        const element = originalCreateElement(tagName, options);
        if (String(tagName).toLowerCase() === 'a') {
          Object.defineProperty(element, 'click', {
            configurable: true,
            value: anchorClick,
          });
        }
        return element;
      });
    const createObjectUrlMock = jest.fn(() => 'blob:sales-status-count-provenance-export');
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectUrlMock,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: jest.fn(),
    });

    await act(async () => {
      root.render(<SalesIntelligence />);
    });

    expect(container.textContent).toContain('Status-count source • Governance: local • Packet: local.');
    expect(container.textContent).toContain(
      'Status-count posture • Governance: LOCAL_DRIFT • Packet: LOCAL_DRIFT.'
    );
    expect(container.textContent).toContain('Governance status counts: ACTION_REQUIRED: 1.');
    expect(container.textContent).toContain('Packet status counts: ACTION_REQUIRED: 1.');
    expect(container.textContent).not.toContain('Governance status-count mismatch');
    expect(container.textContent).not.toContain('Packet status-count mismatch');

    const exportButton = container.querySelector('[data-testid="sales-telemetry-export-btn"]') as HTMLButtonElement;
    expect(exportButton).toBeTruthy();

    await act(async () => {
      exportButton.click();
    });

    const telemetryBlob = createObjectUrlMock.mock.calls[createObjectUrlMock.mock.calls.length - 1][0] as Blob;
    const telemetryPayload = JSON.parse(await readBlobAsText(telemetryBlob));
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
    expect(anchorClick).toHaveBeenCalled();

    createElementSpy.mockRestore();
  });

  it('renders mismatch warnings when backend status-count provenance marks local mismatch', async () => {
    setupQueryMocks({
      'sales-intelligence-page-portfolio': {
        data: {
          campaignCount: 0,
          activeCampaignCount: 0,
          portfolioTotals: { sent: 0, opened: 0, replied: 0 },
          averageReplyRate: 0,
          rankedCampaigns: [],
        },
      },
      'sales-intelligence-page-campaign': { data: undefined },
      'sales-intelligence-page-prediction-report': {
        data: {
          qualityTier: 'watch',
          rolloutDecision: 'hold',
          sampleSize: 1,
          meanAbsoluteCalibrationError: 0.2,
          recommendations: [],
        },
      },
      'sales-intelligence-page-telemetry': {
        data: {
          generatedAt: '2026-02-22T10:00:00+00:00',
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
              requestId: 'req-sales-status-count-provenance-local-mismatch',
              governanceStatus: 'PASS',
              governancePacketValidationStatus: 'READY',
            },
          ],
        },
      },
      'sales-intelligence-page-integrations-health': {
        data: {
          generatedAt: '2026-02-22T10:00:00+00:00',
          providers: [],
        },
      },
      'sales-intelligence-page-governance-report': { data: { totals: { governanceEventCount: 0, traceabilityEvaluationCount: 0, actionRequiredCount: 0 }, governanceStatusCounts: {}, traceabilityDecisionCounts: {}, timeline: [], recommendedCommands: [] } },
      'sales-intelligence-page-governance-report-export': { data: { status: 'READY', governanceExport: { governanceType: 'weekly_report', status: 'READY', rolloutBlocked: false, ownerRole: 'Release Manager', alerts: [], actions: [], evaluatedAt: '2026-02-22T10:00:00+00:00', requestedBy: 'u1' } } },
      'sales-intelligence-page-governance-report-history': { data: { governanceType: 'weekly_report_history', generatedAt: '2026-02-22T10:00:00+00:00', retentionDays: 30, artifactCount: 0, staleCount: 0, rolloutBlockedCount: 0, items: [], recommendedCommands: [] } },
      'sales-intelligence-page-governance-schema': { data: { governanceType: 'schema_metadata', status: 'READY', schemaMetadata: { activeVersion: 1, defaultVersion: 1, supportedVersions: [1], source: 'default', override: { isSet: false, isValid: true } }, alerts: [], recommendedCommands: [] } },
    });

    const originalCreateElement = document.createElement.bind(document);
    const anchorClick = jest.fn();
    const createElementSpy = jest
      .spyOn(document, 'createElement')
      .mockImplementation((tagName: any, options?: any) => {
        const element = originalCreateElement(tagName, options);
        if (String(tagName).toLowerCase() === 'a') {
          Object.defineProperty(element, 'click', {
            configurable: true,
            value: anchorClick,
          });
        }
        return element;
      });
    const createObjectUrlMock = jest.fn(() => 'blob:sales-status-count-provenance-local-mismatch-export');
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectUrlMock,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: jest.fn(),
    });

    await act(async () => {
      root.render(<SalesIntelligence />);
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

    const exportButton = container.querySelector('[data-testid="sales-telemetry-export-btn"]') as HTMLButtonElement;
    expect(exportButton).toBeTruthy();

    await act(async () => {
      exportButton.click();
    });

    const telemetryBlob = createObjectUrlMock.mock.calls[createObjectUrlMock.mock.calls.length - 1][0] as Blob;
    const telemetryPayload = JSON.parse(await readBlobAsText(telemetryBlob));
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
    expect(anchorClick).toHaveBeenCalled();

    createElementSpy.mockRestore();
  });

  it('falls back to computed status-count posture defaults when backend posture metadata is invalid', async () => {
    setupQueryMocks({
      'sales-intelligence-page-portfolio': {
        data: {
          campaignCount: 0,
          activeCampaignCount: 0,
          portfolioTotals: { sent: 0, opened: 0, replied: 0 },
          averageReplyRate: 0,
          rankedCampaigns: [],
        },
      },
      'sales-intelligence-page-campaign': { data: undefined },
      'sales-intelligence-page-prediction-report': {
        data: {
          qualityTier: 'watch',
          rolloutDecision: 'hold',
          sampleSize: 1,
          meanAbsoluteCalibrationError: 0.2,
          recommendations: [],
        },
      },
      'sales-intelligence-page-telemetry': {
        data: {
          generatedAt: '2026-02-22T10:00:00+00:00',
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
              requestId: 'req-sales-status-count-provenance-invalid-posture',
              governanceStatus: 'PASS',
              governancePacketValidationStatus: 'READY',
            },
          ],
        },
      },
      'sales-intelligence-page-integrations-health': {
        data: {
          generatedAt: '2026-02-22T10:00:00+00:00',
          providers: [],
        },
      },
      'sales-intelligence-page-governance-report': { data: { totals: { governanceEventCount: 0, traceabilityEvaluationCount: 0, actionRequiredCount: 0 }, governanceStatusCounts: {}, traceabilityDecisionCounts: {}, timeline: [], recommendedCommands: [] } },
      'sales-intelligence-page-governance-report-export': { data: { status: 'READY', governanceExport: { governanceType: 'weekly_report', status: 'READY', rolloutBlocked: false, ownerRole: 'Release Manager', alerts: [], actions: [], evaluatedAt: '2026-02-22T10:00:00+00:00', requestedBy: 'u1' } } },
      'sales-intelligence-page-governance-report-history': { data: { governanceType: 'weekly_report_history', generatedAt: '2026-02-22T10:00:00+00:00', retentionDays: 30, artifactCount: 0, staleCount: 0, rolloutBlockedCount: 0, items: [], recommendedCommands: [] } },
      'sales-intelligence-page-governance-schema': { data: { governanceType: 'schema_metadata', status: 'READY', schemaMetadata: { activeVersion: 1, defaultVersion: 1, supportedVersions: [1], source: 'default', override: { isSet: false, isValid: true } }, alerts: [], recommendedCommands: [] } },
    });

    const originalCreateElement = document.createElement.bind(document);
    const anchorClick = jest.fn();
    const createElementSpy = jest
      .spyOn(document, 'createElement')
      .mockImplementation((tagName: any, options?: any) => {
        const element = originalCreateElement(tagName, options);
        if (String(tagName).toLowerCase() === 'a') {
          Object.defineProperty(element, 'click', {
            configurable: true,
            value: anchorClick,
          });
        }
        return element;
      });
    const createObjectUrlMock = jest.fn(() => 'blob:sales-status-count-provenance-invalid-posture-export');
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectUrlMock,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: jest.fn(),
    });

    await act(async () => {
      root.render(<SalesIntelligence />);
    });

    expect(container.textContent).toContain('Status-count source • Governance: local • Packet: local.');
    expect(container.textContent).toContain(
      'Status-count posture • Governance: LOCAL_FALLBACK • Packet: LOCAL_FALLBACK.'
    );

    const exportButton = container.querySelector('[data-testid="sales-telemetry-export-btn"]') as HTMLButtonElement;
    expect(exportButton).toBeTruthy();

    await act(async () => {
      exportButton.click();
    });

    const telemetryBlob = createObjectUrlMock.mock.calls[createObjectUrlMock.mock.calls.length - 1][0] as Blob;
    const telemetryPayload = JSON.parse(await readBlobAsText(telemetryBlob));
    expect(telemetryPayload.exportRecentEventsGovernanceStatusCountsPosture).toBe('local_fallback');
    expect(telemetryPayload.exportRecentEventsPacketValidationStatusCountsPosture).toBe('local_fallback');
    expect(telemetryPayload.exportRecentEventsGovernanceStatusCountsPostureSeverity).toBe('info');
    expect(telemetryPayload.exportRecentEventsPacketValidationStatusCountsPostureSeverity).toBe('info');
    expect(telemetryPayload.exportRecentEventsGovernanceStatusCountsRequiresInvestigation).toBe(false);
    expect(telemetryPayload.exportRecentEventsPacketValidationStatusCountsRequiresInvestigation).toBe(false);
    expect(anchorClick).toHaveBeenCalled();

    createElementSpy.mockRestore();
  });

  it('falls back to computed status-count server drift posture when backend posture metadata is invalid', async () => {
    setupQueryMocks({
      'sales-intelligence-page-portfolio': {
        data: {
          campaignCount: 0,
          activeCampaignCount: 0,
          portfolioTotals: { sent: 0, opened: 0, replied: 0 },
          averageReplyRate: 0,
          rankedCampaigns: [],
        },
      },
      'sales-intelligence-page-campaign': { data: undefined },
      'sales-intelligence-page-prediction-report': {
        data: {
          qualityTier: 'watch',
          rolloutDecision: 'hold',
          sampleSize: 1,
          meanAbsoluteCalibrationError: 0.2,
          recommendations: [],
        },
      },
      'sales-intelligence-page-telemetry': {
        data: {
          generatedAt: '2026-02-22T10:00:00+00:00',
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
              requestId: 'req-sales-status-count-provenance-invalid-posture-server-drift',
              governanceStatus: 'PASS',
              governancePacketValidationStatus: 'READY',
            },
          ],
        },
      },
      'sales-intelligence-page-integrations-health': {
        data: {
          generatedAt: '2026-02-22T10:00:00+00:00',
          providers: [],
        },
      },
      'sales-intelligence-page-governance-report': { data: { totals: { governanceEventCount: 0, traceabilityEvaluationCount: 0, actionRequiredCount: 0 }, governanceStatusCounts: {}, traceabilityDecisionCounts: {}, timeline: [], recommendedCommands: [] } },
      'sales-intelligence-page-governance-report-export': { data: { status: 'READY', governanceExport: { governanceType: 'weekly_report', status: 'READY', rolloutBlocked: false, ownerRole: 'Release Manager', alerts: [], actions: [], evaluatedAt: '2026-02-22T10:00:00+00:00', requestedBy: 'u1' } } },
      'sales-intelligence-page-governance-report-history': { data: { governanceType: 'weekly_report_history', generatedAt: '2026-02-22T10:00:00+00:00', retentionDays: 30, artifactCount: 0, staleCount: 0, rolloutBlockedCount: 0, items: [], recommendedCommands: [] } },
      'sales-intelligence-page-governance-schema': { data: { governanceType: 'schema_metadata', status: 'READY', schemaMetadata: { activeVersion: 1, defaultVersion: 1, supportedVersions: [1], source: 'default', override: { isSet: false, isValid: true } }, alerts: [], recommendedCommands: [] } },
    });

    const originalCreateElement = document.createElement.bind(document);
    const anchorClick = jest.fn();
    const createElementSpy = jest
      .spyOn(document, 'createElement')
      .mockImplementation((tagName: any, options?: any) => {
        const element = originalCreateElement(tagName, options);
        if (String(tagName).toLowerCase() === 'a') {
          Object.defineProperty(element, 'click', {
            configurable: true,
            value: anchorClick,
          });
        }
        return element;
      });
    const createObjectUrlMock = jest.fn(() => 'blob:sales-status-count-provenance-invalid-posture-server-drift-export');
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectUrlMock,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: jest.fn(),
    });

    await act(async () => {
      root.render(<SalesIntelligence />);
    });

    expect(container.textContent).toContain(
      'Status-count posture • Governance: SERVER_DRIFT • Packet: SERVER_DRIFT.'
    );

    const exportButton = container.querySelector('[data-testid="sales-telemetry-export-btn"]') as HTMLButtonElement;
    expect(exportButton).toBeTruthy();

    await act(async () => {
      exportButton.click();
    });

    const telemetryBlob = createObjectUrlMock.mock.calls[createObjectUrlMock.mock.calls.length - 1][0] as Blob;
    const telemetryPayload = JSON.parse(await readBlobAsText(telemetryBlob));
    expect(telemetryPayload.exportRecentEventsGovernanceStatusCountsPosture).toBe('server_drift');
    expect(telemetryPayload.exportRecentEventsPacketValidationStatusCountsPosture).toBe('server_drift');
    expect(telemetryPayload.exportRecentEventsGovernanceStatusCountsPostureSeverity).toBe('warning');
    expect(telemetryPayload.exportRecentEventsPacketValidationStatusCountsPostureSeverity).toBe('warning');
    expect(telemetryPayload.exportRecentEventsGovernanceStatusCountsRequiresInvestigation).toBe(true);
    expect(telemetryPayload.exportRecentEventsPacketValidationStatusCountsRequiresInvestigation).toBe(true);
    expect(anchorClick).toHaveBeenCalled();

    createElementSpy.mockRestore();
  });

  it('auto-clears operation notices after timeout', async () => {
    jest.useFakeTimers();
    setupQueryMocks({
      'sales-intelligence-page-portfolio': {
        data: {
          campaignCount: 1,
          activeCampaignCount: 1,
          portfolioTotals: { sent: 80, opened: 30, replied: 6 },
          averageReplyRate: 0.075,
          rankedCampaigns: [
            {
              campaignId: 'c2',
              name: 'Enterprise Reactivation',
              status: 'active',
              totals: { sent: 80, opened: 30, replied: 6 },
              overall: { openRate: 0.375, replyRate: 0.075, qualityTier: 'watch' },
            },
          ],
        },
      },
      'sales-intelligence-page-campaign': {
        data: {
          campaignId: 'c2',
          name: 'Enterprise Reactivation',
          status: 'active',
          totals: { sent: 80, opened: 30, replied: 6 },
          overall: { openRate: 0.375, replyRate: 0.075, replyToOpenRate: 0.2, qualityTier: 'watch' },
          byChannel: [],
          recommendations: [],
        },
      },
      'sales-intelligence-page-prediction-report': {
        data: {
          qualityTier: 'watch',
          rolloutDecision: 'hold',
          sampleSize: 35,
          meanAbsoluteCalibrationError: 0.28,
          recommendations: [],
        },
      },
      'sales-intelligence-page-telemetry': {
        data: {
          generatedAt: '2026-02-22T10:00:00+00:00',
          windowDays: 7,
          eventCount: 10,
          errorEventCount: 2,
          trendByDay: [{ date: '2026-02-21', events: 10, errors: 2, salesIntelligenceEvents: 7 }],
          salesIntelligence: { eventCount: 7, byEventFamily: { prediction: 7 } },
        },
      },
    });

    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = jest
      .spyOn(document, 'createElement')
      .mockImplementation((tagName: any, options?: any) => {
        const element = originalCreateElement(tagName, options);
        if (String(tagName).toLowerCase() === 'a') {
          Object.defineProperty(element, 'click', {
            configurable: true,
            value: jest.fn(),
          });
        }
        return element;
      });
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: jest.fn(() => 'blob:sales-test'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: jest.fn(),
    });

    await act(async () => {
      root.render(<SalesIntelligence />);
    });

    const exportPredictionButton = container.querySelector('[data-testid="sales-prediction-export-btn"]') as HTMLButtonElement;
    await act(async () => {
      exportPredictionButton.click();
    });
    expect(container.querySelector('[data-testid="sales-operation-notice"]')).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(5000);
    });
    expect(container.querySelector('[data-testid="sales-operation-notice"]')).toBeNull();

    createElementSpy.mockRestore();
  });

  it('exports pipeline forecast snapshot with reliability metadata', async () => {
    setupQueryMocks({
      'sales-intelligence-page-portfolio': {
        data: {
          campaignCount: 1,
          activeCampaignCount: 1,
          portfolioTotals: { sent: 80, opened: 30, replied: 6 },
          averageReplyRate: 0.075,
          rankedCampaigns: [
            {
              campaignId: 'c2',
              name: 'Enterprise Reactivation',
              status: 'active',
              totals: { sent: 80, opened: 30, replied: 6 },
              overall: { openRate: 0.375, replyRate: 0.075, qualityTier: 'watch' },
            },
          ],
        },
      },
      'sales-intelligence-page-campaign': {
        data: {
          campaignId: 'c2',
          name: 'Enterprise Reactivation',
          status: 'active',
          totals: { sent: 80, opened: 30, replied: 6 },
          overall: { openRate: 0.375, replyRate: 0.075, replyToOpenRate: 0.2, qualityTier: 'watch' },
          byChannel: [],
          recommendations: [],
        },
      },
      'sales-intelligence-page-prediction-report': {
        data: {
          qualityTier: 'watch',
          rolloutDecision: 'hold',
          sampleSize: 35,
          meanAbsoluteCalibrationError: 0.28,
          recommendations: [],
        },
      },
      'sales-intelligence-page-pipeline-forecast': {
        data: {
          openPipelineValue: 520000,
          weightedPipelineValue: 286000,
          projectedWonValue: 182000,
          historicalWinRate: 43.5,
          confidenceInterval: {
            low: 145600,
            high: 218400,
            confidenceLevel: 95,
          },
          confidenceIntervalWidth: 72800,
          confidenceIntervalWidthPct: 40,
          forecastReliabilityTier: 'medium',
          forecastRecommendation: 'Hold current rollout scope and monitor interval width before expansion.',
          sampleSize: {
            openProspects: 14,
            closedOutcomes: 22,
          },
          windowDays: 90,
          generatedAt: '2026-02-22T10:00:00+00:00',
        },
      },
      'sales-intelligence-page-telemetry': {
        data: {
          generatedAt: '2026-02-22T10:00:00+00:00',
          windowDays: 7,
          eventCount: 10,
          errorEventCount: 2,
          trendByDay: [{ date: '2026-02-21', events: 10, errors: 2, salesIntelligenceEvents: 7 }],
          salesIntelligence: { eventCount: 7, byEventFamily: { prediction: 7 } },
        },
      },
    });

    const createObjectUrlMock = jest.fn(() => 'blob:sales-forecast-test');
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectUrlMock,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: jest.fn(),
    });

    await act(async () => {
      root.render(<SalesIntelligence />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const exportButton = container.querySelector('[data-testid="sales-forecast-export-btn"]') as HTMLButtonElement;
    expect(exportButton).toBeTruthy();

    await act(async () => {
      exportButton.click();
    });

    const forecastBlob = createObjectUrlMock.mock.calls[createObjectUrlMock.mock.calls.length - 1][0] as Blob;
    const forecastPayload = JSON.parse(await readBlobAsText(forecastBlob));
    expect(forecastPayload.confidenceIntervalWidth).toBe(72800);
    expect(forecastPayload.confidenceIntervalWidthPct).toBe(40);
    expect(forecastPayload.forecastReliabilityTier).toBe('medium');
    expect(forecastPayload.forecastRecommendation).toContain('Hold current rollout scope');
    expect(forecastPayload.exportSchemaVersion).toBe(3);
    expect(forecastPayload.exportRequestedWindowDays).toBe(90);
  });

  it('exports prediction snapshot with requested window metadata', async () => {
    setupQueryMocks({
      'sales-intelligence-page-portfolio': {
        data: {
          campaignCount: 1,
          activeCampaignCount: 1,
          portfolioTotals: { sent: 80, opened: 30, replied: 6 },
          averageReplyRate: 0.075,
          rankedCampaigns: [
            {
              campaignId: 'c2',
              name: 'Enterprise Reactivation',
              status: 'active',
              totals: { sent: 80, opened: 30, replied: 6 },
              overall: { openRate: 0.375, replyRate: 0.075, qualityTier: 'watch' },
            },
          ],
        },
      },
      'sales-intelligence-page-campaign': {
        data: {
          campaignId: 'c2',
          name: 'Enterprise Reactivation',
          status: 'active',
          totals: { sent: 80, opened: 30, replied: 6 },
          overall: { openRate: 0.375, replyRate: 0.075, replyToOpenRate: 0.2, qualityTier: 'watch' },
          byChannel: [],
          recommendations: [],
        },
      },
      'sales-intelligence-page-prediction-report': {
        data: {
          qualityTier: 'watch',
          rolloutDecision: 'hold',
          sampleSize: 35,
          meanAbsoluteCalibrationError: 0.28,
          recommendations: ['Collect additional feedback samples.'],
        },
      },
      'sales-intelligence-page-pipeline-forecast': {
        data: {
          openPipelineValue: 520000,
          weightedPipelineValue: 286000,
          projectedWonValue: 182000,
          historicalWinRate: 43.5,
          confidenceInterval: {
            low: 145600,
            high: 218400,
            confidenceLevel: 95,
          },
          confidenceIntervalWidth: 72800,
          confidenceIntervalWidthPct: 40,
          forecastReliabilityTier: 'medium',
          forecastRecommendation: 'Hold current rollout scope and monitor interval width before expansion.',
          sampleSize: {
            openProspects: 14,
            closedOutcomes: 22,
          },
          windowDays: 90,
          generatedAt: '2026-02-22T10:00:00+00:00',
        },
      },
      'sales-intelligence-page-telemetry': {
        data: {
          generatedAt: '2026-02-22T10:00:00+00:00',
          windowDays: 7,
          eventCount: 10,
          errorEventCount: 2,
          trendByDay: [{ date: '2026-02-21', events: 10, errors: 2, salesIntelligenceEvents: 7 }],
          salesIntelligence: { eventCount: 7, byEventFamily: { prediction: 7 } },
        },
      },
    });

    const createObjectUrlMock = jest.fn(() => 'blob:sales-prediction-test');
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectUrlMock,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: jest.fn(),
    });

    await act(async () => {
      root.render(<SalesIntelligence />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const exportButton = container.querySelector('[data-testid="sales-prediction-export-btn"]') as HTMLButtonElement;
    expect(exportButton).toBeTruthy();

    await act(async () => {
      exportButton.click();
    });

    const predictionBlob = createObjectUrlMock.mock.calls[createObjectUrlMock.mock.calls.length - 1][0] as Blob;
    const predictionPayload = JSON.parse(await readBlobAsText(predictionBlob));
    expect(predictionPayload.rolloutDecision).toBe('hold');
    expect(predictionPayload.exportSchemaVersion).toBe(3);
    expect(predictionPayload.exportRequestedWindowDays).toBe(90);
  });

  it('exports campaign portfolio and campaign performance snapshots with requested filter metadata', async () => {
    setupQueryMocks({
      'sales-intelligence-page-portfolio': {
        data: {
          campaignCount: 2,
          activeCampaignCount: 1,
          portfolioTotals: { sent: 150, opened: 48, replied: 12 },
          averageReplyRate: 0.08,
          windowDays: 120,
          statusFilter: 'all',
          generatedAt: '2026-02-22T10:00:00+00:00',
          rankedCampaigns: [
            {
              campaignId: 'c2',
              name: 'Enterprise Reactivation',
              status: 'active',
              totals: { sent: 80, opened: 30, replied: 6 },
              overall: { openRate: 0.375, replyRate: 0.075, qualityTier: 'watch' },
            },
          ],
        },
      },
      'sales-intelligence-page-campaign': {
        data: {
          campaignId: 'c2',
          name: 'Enterprise Reactivation',
          status: 'active',
          totals: { sent: 80, opened: 30, replied: 6 },
          overall: { openRate: 0.375, replyRate: 0.075, replyToOpenRate: 0.2, qualityTier: 'watch' },
          byChannel: [{ channel: 'email', sent: 80, opened: 30, replied: 6, openRate: 0.375, replyRate: 0.075 }],
          channelCount: 3,
          displayedChannelCount: 1,
          appliedChannelLimit: 1,
          channelsTruncated: true,
          recommendations: [],
          generatedAt: '2026-02-22T10:00:00+00:00',
        },
      },
      'sales-intelligence-page-prediction-report': {
        data: {
          qualityTier: 'watch',
          rolloutDecision: 'hold',
          sampleSize: 35,
          meanAbsoluteCalibrationError: 0.28,
          recommendations: [],
        },
      },
      'sales-intelligence-page-telemetry': {
        data: {
          generatedAt: '2026-02-22T10:00:00+00:00',
          windowDays: 7,
          eventCount: 10,
          errorEventCount: 2,
          trendByDay: [{ date: '2026-02-21', events: 10, errors: 2, salesIntelligenceEvents: 7 }],
          salesIntelligence: { eventCount: 7, byEventFamily: { campaigns: 3 } },
        },
      },
    });

    const createObjectUrlMock = jest.fn(() => 'blob:sales-campaign-export-test');
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectUrlMock,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: jest.fn(),
    });

    await act(async () => {
      root.render(<SalesIntelligence />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const portfolioWindowInput = container.querySelector('[data-testid="sales-portfolio-window-days-input"]') as HTMLInputElement;
    const portfolioLimitInput = container.querySelector('[data-testid="sales-portfolio-limit-input"]') as HTMLInputElement;
    const portfolioStatusSelect = container.querySelector('[data-testid="sales-portfolio-status-select"]') as HTMLSelectElement;
    const portfolioRefreshButton = container.querySelector('[data-testid="sales-portfolio-refresh-btn"]') as HTMLButtonElement;
    const performanceChannelLimitInput = container.querySelector(
      '[data-testid="sales-campaign-performance-channel-limit-input"]'
    ) as HTMLInputElement;
    const performanceRefreshButton = container.querySelector(
      '[data-testid="sales-campaign-performance-refresh-btn"]'
    ) as HTMLButtonElement;
    const portfolioExportButton = container.querySelector('[data-testid="sales-campaign-portfolio-export-btn"]') as HTMLButtonElement;
    const performanceExportButton = container.querySelector('[data-testid="sales-campaign-performance-export-btn"]') as HTMLButtonElement;

    await act(async () => {
      setNumberInputValue(portfolioWindowInput, '120');
      setNumberInputValue(portfolioLimitInput, '25');
      setSelectValue(portfolioStatusSelect, 'all');
      portfolioRefreshButton.click();
      setNumberInputValue(performanceChannelLimitInput, '12');
      performanceRefreshButton.click();
    });

    await act(async () => {
      portfolioExportButton.click();
      performanceExportButton.click();
    });

    const [portfolioBlob, performanceBlob] = createObjectUrlMock.mock.calls.slice(-2).map((call) => call[0] as Blob);
    const portfolioPayload = JSON.parse(await readBlobAsText(portfolioBlob));
    const performancePayload = JSON.parse(await readBlobAsText(performanceBlob));

    expect(portfolioPayload.campaignCount).toBe(2);
    expect(portfolioPayload.exportSchemaVersion).toBe(3);
    expect(portfolioPayload.exportRequestedWindowDays).toBe(120);
    expect(portfolioPayload.exportRequestedStatus).toBe('all');
    expect(portfolioPayload.exportRequestedLimit).toBe(25);
    expect(portfolioPayload.exportServerStatusFilter).toBe('all');
    expect(performancePayload.campaignId).toBe('c2');
    expect(performancePayload.exportSchemaVersion).toBe(3);
    expect(performancePayload.exportRequestedWindowDays).toBe(120);
    expect(performancePayload.exportRequestedStatus).toBe('all');
    expect(performancePayload.exportRequestedLimit).toBe(25);
    expect(performancePayload.exportRequestedChannelLimit).toBe(12);
    expect(performancePayload.exportDisplayedChannelCount).toBe(1);
    expect(performancePayload.exportSelectedCampaignId).toBe('c2');
    expect(performancePayload.exportPortfolioServerStatusFilter).toBe('all');
  });

  it('exports conversation, multi-channel, relationship, phrase, and prediction feedback snapshots', async () => {
    setupQueryMocks({
      'sales-intelligence-page-portfolio': {
        data: {
          campaignCount: 1,
          activeCampaignCount: 1,
          portfolioTotals: { sent: 80, opened: 30, replied: 6 },
          averageReplyRate: 0.075,
          rankedCampaigns: [
            {
              campaignId: 'c2',
              name: 'Enterprise Reactivation',
              status: 'active',
              totals: { sent: 80, opened: 30, replied: 6 },
              overall: { openRate: 0.375, replyRate: 0.075, qualityTier: 'watch' },
            },
          ],
        },
      },
      'sales-intelligence-page-campaign': {
        data: {
          campaignId: 'c2',
          name: 'Enterprise Reactivation',
          status: 'active',
          totals: { sent: 80, opened: 30, replied: 6 },
          overall: { openRate: 0.375, replyRate: 0.075, replyToOpenRate: 0.2, qualityTier: 'watch' },
          byChannel: [],
          recommendations: [],
        },
      },
      'sales-intelligence-page-prediction-report': {
        data: {
          qualityTier: 'watch',
          rolloutDecision: 'hold',
          sampleSize: 35,
          meanAbsoluteCalibrationError: 0.28,
          recommendations: [],
        },
      },
      'sales-intelligence-page-pipeline-forecast': {
        data: {
          openPipelineValue: 520000,
          weightedPipelineValue: 286000,
          projectedWonValue: 182000,
          historicalWinRate: 43.5,
          confidenceInterval: {
            low: 145600,
            high: 218400,
            confidenceLevel: 95,
          },
          confidenceIntervalWidth: 72800,
          confidenceIntervalWidthPct: 40,
          forecastReliabilityTier: 'medium',
          forecastRecommendation: 'Hold current rollout scope and monitor interval width before expansion.',
          sampleSize: {
            openProspects: 14,
            closedOutcomes: 22,
          },
          windowDays: 90,
          generatedAt: '2026-02-22T10:00:00+00:00',
        },
      },
      'sales-intelligence-page-conversation-intelligence': {
        data: {
          totals: { records: 8, channels: { chat: 2, email: 6 } },
          sentiment: { positive: 4, neutral: 3, negative: 1 },
          topObjections: [{ type: 'budget', count: 1 }],
          relationshipHealth: 'healthy',
          generatedAt: '2026-02-22T10:00:00+00:00',
          sources: { chatSessions: 2, emailEvents: 6 },
        },
      },
      'sales-intelligence-page-multi-channel-engagement': {
        data: {
          activeChannels: ['email', 'linkedin'],
          coverageScore: 50,
          coverageReliabilityTier: 'medium',
          coverageRecommendation: 'Coverage is moderate. Add one additional high-intent channel before expansion.',
          windowDays: 111,
          channelUsage: { email: 6, linkedin: 2 },
          recommendations: ['Add phone follow-up stage for high-intent prospects.'],
          sourceCounts: { campaigns: 1, abTests: 1, prospects: 2 },
          appliedLimits: { windowDays: 111, campaigns: 333, abTests: 444, prospects: 555 },
          generatedAt: '2026-02-22T10:00:00+00:00',
        },
      },
      'sales-intelligence-page-relationship-map': {
        data: {
          generatedAt: '2026-02-22T10:00:00+00:00',
          windowDays: 45,
          sourceCounts: { prospects: 1, companies: 1 },
          nodes: [{ id: 'p1', type: 'prospect', label: 'Alex Ng', score: 80 }],
          edges: [{ source: 'p1', target: 'c1', type: 'works_at', relationshipStrength: 80 }],
          stats: { prospects: 1, companies: 1, connections: 1, averageRelationshipStrength: 80 },
        },
      },
      'sales-intelligence-page-phrase-analytics': {
        data: {
          phrases: [{ phrase: 'quick demo', exposureCount: 8, effectivenessScore: 0.31 }],
          summary: { trackedPhrases: 6, candidatePhraseCount: 12, minExposure: 2, topK: 8 },
          totalRecords: 14,
          windowDays: 90,
          generatedAt: '2026-02-22T10:00:00+00:00',
        },
      },
      'sales-intelligence-page-phrase-channel-summary': {
        data: {
          channels: [{ channel: 'email', totalRecords: 10, trackedPhrases: 4 }],
          channelCount: 1,
          totalRecords: 14,
          windowDays: 90,
          generatedAt: '2026-02-22T10:00:00+00:00',
        },
      },
      'sales-intelligence-page-prediction-performance': {
        data: {
          sampleSize: 9,
          positiveRate: 0.44,
          averagePredictedProbability: 0.51,
          meanAbsoluteCalibrationError: 0.19,
          byChannel: {
            email: {
              sampleSize: 9,
              positiveRate: 0.44,
              avgPredictedProbability: 0.51,
              meanAbsoluteCalibrationError: 0.19,
            },
          },
          windowDays: 90,
          generatedAt: '2026-02-22T10:00:00+00:00',
        },
      },
      'sales-intelligence-page-prediction-feedback-history': {
        data: {
          records: [
            {
              id: 'fb1',
              predictionId: 'pred-1',
              predictedProbability: 0.64,
              outcome: 'positive',
              actualLabel: 1,
              channel: 'email',
              responseLatencyHours: 6,
              createdAt: '2026-02-21T10:00:00+00:00',
            },
          ],
          count: 1,
          windowDays: 90,
          generatedAt: '2026-02-22T10:00:00+00:00',
        },
      },
      'sales-intelligence-page-telemetry': {
        data: {
          generatedAt: '2026-02-22T10:00:00+00:00',
          windowDays: 7,
          eventCount: 10,
          errorEventCount: 2,
          trendByDay: [{ date: '2026-02-21', events: 10, errors: 2, salesIntelligenceEvents: 7 }],
          salesIntelligence: { eventCount: 7, byEventFamily: { prediction: 7 } },
        },
      },
    });

    const createObjectUrlMock = jest.fn(() => 'blob:sales-conversation-test');
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectUrlMock,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: jest.fn(),
    });

    await act(async () => {
      root.render(<SalesIntelligence />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const conversationExportButton = container.querySelector('[data-testid="sales-conversation-export-btn"]') as HTMLButtonElement;
    const multiChannelExportButton = container.querySelector('[data-testid="sales-multi-channel-export-btn"]') as HTMLButtonElement;
    const relationshipExportButton = container.querySelector('[data-testid="sales-relationship-map-export-btn"]') as HTMLButtonElement;
    const phraseAnalyticsExportButton = container.querySelector(
      '[data-testid="sales-phrase-analytics-export-btn"]'
    ) as HTMLButtonElement;
    const phraseChannelSummaryExportButton = container.querySelector(
      '[data-testid="sales-phrase-channel-summary-export-btn"]'
    ) as HTMLButtonElement;
    const predictionPerformanceExportButton = container.querySelector(
      '[data-testid="sales-prediction-performance-export-btn"]'
    ) as HTMLButtonElement;
    const predictionFeedbackHistoryExportButton = container.querySelector(
      '[data-testid="sales-prediction-feedback-history-export-btn"]'
    ) as HTMLButtonElement;
    const multiChannelWindowDaysInput = container.querySelector(
      '[data-testid="sales-multi-channel-window-days-input"]'
    ) as HTMLInputElement;
    const multiChannelCampaignLimitInput = container.querySelector(
      '[data-testid="sales-multi-channel-campaign-limit-input"]'
    ) as HTMLInputElement;
    const multiChannelAbTestLimitInput = container.querySelector(
      '[data-testid="sales-multi-channel-ab-test-limit-input"]'
    ) as HTMLInputElement;
    const multiChannelProspectLimitInput = container.querySelector(
      '[data-testid="sales-multi-channel-prospect-limit-input"]'
    ) as HTMLInputElement;
    const multiChannelRefreshButton = container.querySelector(
      '[data-testid="sales-multi-channel-refresh-btn"]'
    ) as HTMLButtonElement;
    const relationshipWindowDaysInput = container.querySelector(
      '[data-testid="sales-relationship-window-days-input"]'
    ) as HTMLInputElement;
    const relationshipLimitInput = container.querySelector(
      '[data-testid="sales-relationship-limit-input"]'
    ) as HTMLInputElement;
    const relationshipRefreshButton = container.querySelector(
      '[data-testid="sales-relationship-refresh-btn"]'
    ) as HTMLButtonElement;

    await act(async () => {
      setNumberInputValue(multiChannelWindowDaysInput, '30');
      setNumberInputValue(multiChannelCampaignLimitInput, '120');
      setNumberInputValue(multiChannelAbTestLimitInput, '240');
      setNumberInputValue(multiChannelProspectLimitInput, '400');
      multiChannelRefreshButton.click();
      setNumberInputValue(relationshipWindowDaysInput, '60');
      setNumberInputValue(relationshipLimitInput, '300');
      relationshipRefreshButton.click();
    });
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      conversationExportButton.click();
      multiChannelExportButton.click();
      relationshipExportButton.click();
      phraseAnalyticsExportButton.click();
      phraseChannelSummaryExportButton.click();
      predictionPerformanceExportButton.click();
      predictionFeedbackHistoryExportButton.click();
    });

    const [
      conversationBlob,
      multiChannelBlob,
      relationshipBlob,
      phraseAnalyticsBlob,
      phraseChannelSummaryBlob,
      predictionPerformanceBlob,
      predictionFeedbackHistoryBlob,
    ] = createObjectUrlMock.mock.calls.slice(-7).map((call) => call[0] as Blob);
    const conversationPayload = JSON.parse(await readBlobAsText(conversationBlob));
    const multiChannelPayload = JSON.parse(await readBlobAsText(multiChannelBlob));
    const relationshipPayload = JSON.parse(await readBlobAsText(relationshipBlob));
    const phraseAnalyticsPayload = JSON.parse(await readBlobAsText(phraseAnalyticsBlob));
    const phraseChannelSummaryPayload = JSON.parse(await readBlobAsText(phraseChannelSummaryBlob));
    const predictionPerformancePayload = JSON.parse(await readBlobAsText(predictionPerformanceBlob));
    const predictionFeedbackHistoryPayload = JSON.parse(await readBlobAsText(predictionFeedbackHistoryBlob));

    expect(conversationPayload.totals.records).toBe(8);
    expect(conversationPayload.exportSchemaVersion).toBe(3);
    expect(conversationPayload.exportRequestedWindowDays).toBe(90);
    expect(conversationPayload.exportRequestedLimit).toBe(300);
    expect(multiChannelPayload.coverageScore).toBe(50);
    expect(multiChannelPayload.exportSchemaVersion).toBe(3);
    expect(multiChannelPayload.exportRequestedWindowDays).toBe(30);
    expect(multiChannelPayload.exportRequestedCampaignLimit).toBe(120);
    expect(multiChannelPayload.exportRequestedAbTestLimit).toBe(240);
    expect(multiChannelPayload.exportRequestedProspectLimit).toBe(400);
    expect(multiChannelPayload.exportAppliedWindowDays).toBe(111);
    expect(multiChannelPayload.exportAppliedCampaignLimit).toBe(333);
    expect(multiChannelPayload.exportAppliedAbTestLimit).toBe(444);
    expect(multiChannelPayload.exportAppliedProspectLimit).toBe(555);
    expect(relationshipPayload.stats.averageRelationshipStrength).toBe(80);
    expect(relationshipPayload.exportSchemaVersion).toBe(3);
    expect(relationshipPayload.exportRequestedWindowDays).toBe(60);
    expect(relationshipPayload.exportRequestedLimit).toBe(300);
    expect(relationshipPayload.exportAppliedWindowDays).toBe(45);
    expect(phraseAnalyticsPayload.summary.trackedPhrases).toBe(6);
    expect(phraseAnalyticsPayload.exportSchemaVersion).toBe(3);
    expect(phraseAnalyticsPayload.exportRequestedWindowDays).toBe(90);
    expect(phraseAnalyticsPayload.exportRequestedMinExposure).toBe(2);
    expect(phraseAnalyticsPayload.exportRequestedLimit).toBe(8);
    expect(phraseChannelSummaryPayload.channelCount).toBe(1);
    expect(phraseChannelSummaryPayload.exportSchemaVersion).toBe(3);
    expect(phraseChannelSummaryPayload.exportRequestedWindowDays).toBe(90);
    expect(phraseChannelSummaryPayload.exportRequestedMinExposure).toBe(2);
    expect(phraseChannelSummaryPayload.exportRequestedLimit).toBe(5);
    expect(predictionPerformancePayload.sampleSize).toBe(9);
    expect(predictionPerformancePayload.exportSchemaVersion).toBe(3);
    expect(predictionPerformancePayload.exportRequestedWindowDays).toBe(90);
    expect(predictionFeedbackHistoryPayload.count).toBe(1);
    expect(predictionFeedbackHistoryPayload.exportSchemaVersion).toBe(3);
    expect(predictionFeedbackHistoryPayload.exportRequestedWindowDays).toBe(90);
    expect(predictionFeedbackHistoryPayload.exportRequestedLimit).toBe(25);
  });
});

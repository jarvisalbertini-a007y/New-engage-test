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
    getPredictionPerformanceReport: jest.fn(),
    getIntegrationsTelemetrySummary: jest.fn(),
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

describe('SalesIntelligence page', () => {
  let container: HTMLDivElement;
  let root: Root;
  let consoleWarnSpy: jest.SpyInstance;

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
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    jest.useRealTimers();
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
        },
      },
    });

    await act(async () => {
      root.render(<SalesIntelligence />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Sales Intelligence');
    expect(container.textContent).toContain('Campaign Channel Performance');
    expect(container.textContent).toContain('Prediction Quality');
    expect(container.textContent).toContain('Enterprise Outbound');
    expect(container.textContent).toContain('good');
    expect(container.textContent).toContain('Rollout Playbook');
    expect(container.textContent).toContain('Release Manager');
    expect(container.textContent).toContain('Telemetry Trend (Daily)');
    expect(container.textContent).toContain('Sales Event Family Distribution');
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

  it('exports telemetry snapshot and supports notice dismissal', async () => {
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

    const exportButton = container.querySelector('[data-testid="sales-telemetry-export-btn"]') as HTMLButtonElement;
    expect(exportButton).toBeTruthy();

    await act(async () => {
      exportButton.click();
    });

    expect(createObjectUrlMock).toHaveBeenCalled();
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
});

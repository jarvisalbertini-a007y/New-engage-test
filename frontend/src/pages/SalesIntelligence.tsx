import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
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

interface PredictionReportResponse {
  qualityTier: string;
  rolloutDecision: string;
  sampleSize: number;
  meanAbsoluteCalibrationError: number;
  probabilityGap?: number;
  recommendations: string[];
}

interface IntegrationTelemetrySummaryResponse {
  generatedAt?: string;
  windowDays?: number;
  eventCount: number;
  errorEventCount: number;
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
}

interface UiNotice {
  tone: 'success' | 'error' | 'info';
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

const PIE_COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#6366f1', '#ef4444', '#14b8a6', '#8b5cf6'];

function buildRolloutPlaybook(decision: string): { owner: string; action: string; checklist: string[] } {
  const normalized = (decision || '').trim().toLowerCase();
  if (normalized === 'expand' || normalized === 'proceed') {
    return {
      owner: 'Release Manager',
      action: 'Expand prediction-enabled coverage to the next sales segment.',
      checklist: [
        'Increase exposure gradually over one release cycle.',
        'Monitor calibration and error-event trend daily.',
        'Validate hold/rollback path before broad rollout.',
      ],
    };
  }
  if (normalized === 'rollback') {
    return {
      owner: 'On-call Engineer',
      action: 'Rollback prediction-assisted guidance and route to manual review.',
      checklist: [
        'Disable prediction-dependent prompts for impacted users.',
        'Open incident and capture failing channels/segments.',
        'Re-enable only after calibration and error trends recover.',
      ],
    };
  }
  return {
    owner: 'Sales Ops Lead',
    action: 'Hold rollout at current scope and tune low-performing cohorts.',
    checklist: [
      'Review weakest channel-level reply-rate cohorts.',
      'Tune messaging/phrase strategy and run A/B checks.',
      'Re-evaluate rollout decision after next feedback window.',
    ],
  };
}

export default function SalesIntelligence() {
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [telemetryDaysInput, setTelemetryDaysInput] = useState(7);
  const [telemetryLimitInput, setTelemetryLimitInput] = useState(500);
  const [telemetryParams, setTelemetryParams] = useState({ days: 7, limit: 500 });
  const [uiNotice, setUiNotice] = useState<UiNotice | null>(null);

  const {
    data: campaignPortfolio,
    isLoading: isCampaignPortfolioLoading,
    error: campaignPortfolioError
  } = useQuery({
    queryKey: ['sales-intelligence-page-portfolio', 90, 'active', 10],
    queryFn: () => api.getSalesCampaignPortfolio({ windowDays: 90, status: 'active', limit: 10 }) as Promise<CampaignPortfolioResponse>,
    retry: false
  });

  const {
    data: campaignPerformance,
    isLoading: isCampaignPerformanceLoading,
    error: campaignPerformanceError
  } = useQuery({
    queryKey: ['sales-intelligence-page-campaign', selectedCampaignId],
    queryFn: () => api.getSalesCampaignPerformance(selectedCampaignId) as Promise<CampaignPerformanceResponse>,
    enabled: !!selectedCampaignId,
    retry: false
  });

  const {
    data: predictionReport,
    isLoading: isPredictionReportLoading,
    error: predictionReportError
  } = useQuery({
    queryKey: ['sales-intelligence-page-prediction-report', 90],
    queryFn: () => api.getPredictionPerformanceReport({ windowDays: 90 }) as Promise<PredictionReportResponse>,
    retry: false
  });

  const {
    data: telemetrySummary,
    isLoading: isTelemetryLoading,
    error: telemetryError
  } = useQuery({
    queryKey: ['sales-intelligence-page-telemetry', telemetryParams.days, telemetryParams.limit],
    queryFn: () => api.getIntegrationsTelemetrySummary(
      telemetryParams.days,
      telemetryParams.limit
    ) as Promise<IntegrationTelemetrySummaryResponse>,
    retry: false
  });

  useEffect(() => {
    if (!selectedCampaignId && campaignPortfolio?.rankedCampaigns?.length) {
      setSelectedCampaignId(campaignPortfolio.rankedCampaigns[0].campaignId);
    }
  }, [campaignPortfolio, selectedCampaignId]);

  useEffect(() => {
    if (!uiNotice) return;
    const timeoutId = window.setTimeout(() => setUiNotice(null), 5000);
    return () => window.clearTimeout(timeoutId);
  }, [uiNotice]);

  const channelChartData = useMemo(
    () =>
      (campaignPerformance?.byChannel || []).map((entry) => ({
        channel: entry.channel,
        openRatePct: Number((entry.openRate * 100).toFixed(1)),
        replyRatePct: Number((entry.replyRate * 100).toFixed(1)),
      })),
    [campaignPerformance]
  );

  const familyChartData = useMemo(
    () =>
      Object.entries(telemetrySummary?.salesIntelligence?.byEventFamily || {}).map(([name, value]) => ({
        name,
        value,
      })),
    [telemetrySummary]
  );

  const telemetryTrendData = useMemo(
    () =>
      (telemetrySummary?.trendByDay || []).map((entry) => ({
        date: entry.date,
        events: entry.events,
        errors: entry.errors,
        salesEvents: entry.salesIntelligenceEvents,
      })),
    [telemetrySummary]
  );
  const salesSchemaRows = useMemo(
    () => Object.entries(telemetrySummary?.salesIntelligence?.bySchemaVersion || {}).sort(([a], [b]) => a.localeCompare(b)),
    [telemetrySummary]
  );
  const salesSchemaSampleCount = useMemo(
    () => salesSchemaRows.reduce((acc, [, count]) => acc + Number(count || 0), 0),
    [salesSchemaRows]
  );
  const salesSchemaV2Count = Number((telemetrySummary?.salesIntelligence?.bySchemaVersion || {})['2'] || 0);
  const salesSchemaCoveragePct = salesSchemaSampleCount > 0
    ? (salesSchemaV2Count / salesSchemaSampleCount) * 100
    : 100;

  const campaignFeatureDisabled = isFeatureDisabledError(campaignPortfolioError) || isFeatureDisabledError(campaignPerformanceError);
  const predictionFeatureDisabled = isFeatureDisabledError(predictionReportError);
  const rolloutPlaybook = buildRolloutPlaybook(predictionReport?.rolloutDecision || '');

  const refreshTelemetry = () => {
    const normalizedDays = Math.min(Math.max(Number(telemetryDaysInput) || 7, 1), 30);
    const normalizedLimit = Math.min(Math.max(Number(telemetryLimitInput) || 500, 50), 5000);
    setTelemetryDaysInput(normalizedDays);
    setTelemetryLimitInput(normalizedLimit);
    setTelemetryParams({ days: normalizedDays, limit: normalizedLimit });
    if (normalizedDays !== telemetryDaysInput || normalizedLimit !== telemetryLimitInput) {
      setUiNotice({ tone: 'info', message: 'Telemetry filter values were normalized to allowed bounds.' });
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

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Sales Intelligence</h1>
        <p className="text-gray-500 mt-1">
          Campaign performance, prediction quality, and telemetry insights for sales-only execution.
        </p>
      </div>

      {uiNotice && (
        <div
          data-testid="sales-operation-notice"
          role="status"
          aria-live="polite"
          className={`rounded-md border p-3 text-sm ${
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
              data-testid="sales-operation-notice-dismiss"
              onClick={() => setUiNotice(null)}
              className="text-xs underline"
            >
              Dismiss notice
            </button>
          </div>
        </div>
      )}

      {(campaignFeatureDisabled || predictionFeatureDisabled) && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6 text-sm text-amber-800">
            One or more sales intelligence modules are currently disabled by feature flag.
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Active Campaigns</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{campaignPortfolio?.activeCampaignCount || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Portfolio Sent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{campaignPortfolio?.portfolioTotals?.sent || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Portfolio Replies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{campaignPortfolio?.portfolioTotals?.replied || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Avg Reply Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{((campaignPortfolio?.averageReplyRate || 0) * 100).toFixed(1)}%</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Campaign Channel Performance</CardTitle>
            <CardDescription>Open and reply rates by channel for the selected campaign.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!campaignFeatureDisabled && campaignPortfolio?.rankedCampaigns?.length ? (
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
            ) : null}

            {(isCampaignPortfolioLoading || isCampaignPerformanceLoading) && (
              <div className="text-sm text-gray-500">Loading campaign metrics...</div>
            )}

            {!campaignFeatureDisabled && campaignPortfolioError && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {getErrorMessage(campaignPortfolioError)}
              </div>
            )}

            {!campaignFeatureDisabled && campaignPerformanceError && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {getErrorMessage(campaignPerformanceError)}
              </div>
            )}

            {!campaignFeatureDisabled && channelChartData.length > 0 && (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={channelChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="channel" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="openRatePct" name="Open Rate (%)" fill="#0ea5e9" />
                    <Bar dataKey="replyRatePct" name="Reply Rate (%)" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Prediction Quality</CardTitle>
            <CardDescription>Current response prediction calibration posture.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {isPredictionReportLoading && <div className="text-gray-500">Loading prediction quality...</div>}
            {!predictionFeatureDisabled && predictionReportError && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-red-700">
                {getErrorMessage(predictionReportError)}
              </div>
            )}
            {predictionReport && (
              <>
                <div className="flex items-center justify-between">
                  <span>Quality Tier</span>
                  <span className="font-semibold">{predictionReport.qualityTier}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Rollout Decision</span>
                  <span className="font-semibold">{predictionReport.rolloutDecision}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Sample Size</span>
                  <span className="font-semibold">{predictionReport.sampleSize}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>MAE</span>
                  <span className="font-semibold">
                    {Number(predictionReport.meanAbsoluteCalibrationError || 0).toFixed(3)}
                  </span>
                </div>
                <div className="mt-3 rounded-md border p-3 bg-gray-50">
                  <div className="font-medium text-gray-900">Rollout Playbook</div>
                  <div className="text-gray-600 mt-1">
                    Owner: <span className="font-medium">{rolloutPlaybook.owner}</span>
                  </div>
                  <div className="text-gray-700 mt-1">{rolloutPlaybook.action}</div>
                  <ul className="mt-2 list-disc pl-5 text-gray-600">
                    {rolloutPlaybook.checklist.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </>
            )}
            <div className="pt-2">
              <button
                type="button"
                data-testid="sales-prediction-export-btn"
                onClick={() => downloadJsonSnapshot('sales-prediction-report', predictionReport || { message: 'No prediction report loaded' })}
                className="rounded-md border px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
              >
                Export Prediction JSON
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Telemetry Trend (Daily)</CardTitle>
          <CardDescription>Daily event, error, and sales-intelligence activity trends.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[140px_160px_auto_auto] md:items-end">
            <label className="text-xs text-gray-600" htmlFor="sales-telemetry-days-input">
              Window Days
              <input
                id="sales-telemetry-days-input"
                data-testid="sales-telemetry-days-input"
                type="number"
                min={1}
                max={30}
                value={telemetryDaysInput}
                onChange={(e) => setTelemetryDaysInput(Number(e.target.value))}
                className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
              />
            </label>
            <label className="text-xs text-gray-600" htmlFor="sales-telemetry-limit-input">
              Event Limit
              <input
                id="sales-telemetry-limit-input"
                data-testid="sales-telemetry-limit-input"
                type="number"
                min={50}
                max={5000}
                value={telemetryLimitInput}
                onChange={(e) => setTelemetryLimitInput(Number(e.target.value))}
                className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
              />
            </label>
            <button
              type="button"
              data-testid="sales-telemetry-refresh-btn"
              onClick={refreshTelemetry}
              className="rounded-md border px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
            >
              Refresh Telemetry
            </button>
            <button
              type="button"
              data-testid="sales-telemetry-export-btn"
              onClick={() => downloadJsonSnapshot('sales-telemetry-summary', telemetrySummary || { message: 'No telemetry summary loaded' })}
              className="rounded-md border px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
            >
              Export Telemetry JSON
            </button>
          </div>

          {telemetrySummary && (
            <div className="text-xs text-gray-500">
              Generated: {formatTimestamp(telemetrySummary.generatedAt)} • Window: {telemetrySummary.windowDays || telemetryParams.days} days • Limit: {telemetryParams.limit} • Schema v2 coverage: {salesSchemaCoveragePct.toFixed(1)}%
            </div>
          )}

          {isTelemetryLoading && <div className="text-sm text-gray-500">Loading telemetry trend...</div>}
          {telemetryError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {getErrorMessage(telemetryError)}
            </div>
          )}
          {telemetryTrendData.length === 0 && !isTelemetryLoading && !telemetryError && (
            <div className="text-sm text-gray-500">No telemetry trend data available in this window.</div>
          )}
          {telemetryTrendData.length > 0 && (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={telemetryTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="events" name="Events" stroke="#0ea5e9" strokeWidth={2} />
                  <Line type="monotone" dataKey="salesEvents" name="Sales Events" stroke="#10b981" strokeWidth={2} />
                  <Line type="monotone" dataKey="errors" name="Errors" stroke="#ef4444" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sales Event Family Distribution (7 Days)</CardTitle>
          <CardDescription>Telemetry families from the sales-intelligence pipeline.</CardDescription>
        </CardHeader>
        <CardContent>
          {isTelemetryLoading && <div className="text-sm text-gray-500">Loading telemetry distribution...</div>}
          {telemetryError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {getErrorMessage(telemetryError)}
            </div>
          )}
          {familyChartData.length === 0 && !isTelemetryLoading && !telemetryError && (
            <div className="text-sm text-gray-500">No telemetry events captured in this window.</div>
          )}
          {familyChartData.length > 0 && (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={familyChartData} dataKey="value" nameKey="name" outerRadius={100}>
                    {familyChartData.map((item, index) => (
                      <Cell key={`${item.name}-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 grid md:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
                {familyChartData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between rounded-md border px-2 py-1">
                    <span>{item.name}</span>
                    <span className="font-medium">{item.value}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-md border p-3">
                <div className="text-xs font-medium text-gray-500 mb-2">Sales Schema Versions</div>
                {salesSchemaRows.length === 0 && (
                  <div className="text-sm text-gray-500">No sales schema metadata captured in this window.</div>
                )}
                {salesSchemaRows.length > 0 && (
                  <div className="grid md:grid-cols-2 gap-2 text-sm">
                    {salesSchemaRows.map(([schemaVersion, count]) => (
                      <div key={`sales-schema-${schemaVersion}`} className="flex items-center justify-between rounded-md border px-2 py-1">
                        <span>v{schemaVersion}</span>
                        <span className="font-medium">{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

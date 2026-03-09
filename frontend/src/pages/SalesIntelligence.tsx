import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { api } from '../lib/api';
import {
  normalizeRecentEventCounts,
  normalizeRecentEventPacketBreakdown,
  resolveRecentEventFilterProvenance,
} from '../lib/recentEventCounts';
import {
  buildTelemetryStatusCountMap,
  formatTelemetryStatusCountMap,
  resolveTelemetryStatusCountPosture,
  resolveTelemetryStatusCountProvenanceWithMetadata,
  normalizeTelemetryStatusToken
} from '../lib/telemetryStatus';
import {
  buildRetryTerminalSummary,
  getRetryTerminalTopEntry,
  normalizeRetryTerminalErrorType,
  normalizeRetryTerminalOutcomeToken,
  normalizeRetryTerminalReasonCode,
  normalizeRetryTerminalStatusCode,
  resolveRetryTerminalPressure,
} from '../lib/retryTerminalOutcome';
import {
  buildIntegrationHealthExportMetadata,
  buildIntegrationHealthFreshnessRows,
} from '../lib/integrationHealth';
import {
  buildConnectorPressureParityMetadata,
  buildSendgridWebhookTimestampParityMetadata,
  type GovernanceConnectorRateLimitRollup,
  type GovernanceSendgridWebhookTimestampRollup,
} from '../lib/governanceConnectorParity';
import { buildGovernanceSchemaExportSnapshot } from '../lib/governanceSchemaExport';
import { buildGovernanceRuntimePrereqsMetadata } from '../lib/governanceRuntimePrereqs';

const TELEMETRY_EXPORT_SCHEMA_VERSION = 3;
const TELEMETRY_STATUS_FILTER_ALL = 'ALL';
const TELEMETRY_GOVERNANCE_STATUS_FILTER_OPTIONS = [
  TELEMETRY_STATUS_FILTER_ALL,
  'READY',
  'ACTION_REQUIRED',
  'PASS',
  'FAIL',
  'UNKNOWN',
] as const;
const TELEMETRY_PACKET_STATUS_FILTER_OPTIONS = [
  TELEMETRY_STATUS_FILTER_ALL,
  'READY',
  'ACTION_REQUIRED',
  'UNKNOWN',
] as const;
const CAMPAIGN_PORTFOLIO_STATUS_OPTIONS = ['all', 'active', 'draft', 'paused', 'completed'] as const;
type CampaignPortfolioStatus = (typeof CAMPAIGN_PORTFOLIO_STATUS_OPTIONS)[number];
const CURRENCY_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

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
  windowDays?: number;
  statusFilter?: string;
  generatedAt?: string;
}

interface CampaignPerformanceResponse {
  campaignId: string;
  name: string;
  status: string;
  totals: { sent: number; opened: number; replied: number };
  overall: { openRate: number; replyRate: number; replyToOpenRate: number; qualityTier: string };
  byChannel: Array<{ channel: string; sent: number; opened: number; replied: number; openRate: number; replyRate: number }>;
  recommendations: string[];
  channelCount?: number;
  displayedChannelCount?: number;
  appliedChannelLimit?: number;
  channelsTruncated?: boolean;
  generatedAt?: string;
}

interface PipelineForecastResponse {
  openPipelineValue: number;
  weightedPipelineValue: number;
  projectedWonValue: number;
  historicalWinRate: number;
  confidenceInterval: {
    low: number;
    high: number;
    confidenceLevel?: number;
  };
  confidenceIntervalWidth?: number;
  confidenceIntervalWidthPct?: number;
  forecastReliabilityTier?: string;
  forecastRecommendation?: string;
  sampleSize: {
    openProspects: number;
    closedOutcomes: number;
  };
  windowDays?: number;
  generatedAt?: string;
}

interface ConversationIntelligenceResponse {
  totals?: {
    records?: number;
    channels?: Record<string, number>;
  };
  sentiment?: Record<string, number>;
  topObjections?: Array<{
    type?: string;
    count?: number;
  }>;
  relationshipHealth?: string;
  generatedAt?: string;
  windowDays?: number;
  sources?: {
    chatSessions?: number;
    emailEvents?: number;
  };
}

interface MultiChannelEngagementResponse {
  activeChannels?: string[];
  coverageScore?: number;
  coverageReliabilityTier?: string;
  coverageRecommendation?: string;
  windowDays?: number;
  channelUsage?: Record<string, number>;
  recommendations?: string[];
  sourceCounts?: {
    campaigns?: number;
    abTests?: number;
    prospects?: number;
  };
  appliedLimits?: {
    windowDays?: number;
    campaigns?: number;
    abTests?: number;
    prospects?: number;
  };
  generatedAt?: string;
}

interface RelationshipMapResponse {
  generatedAt?: string;
  windowDays?: number;
  sourceCounts?: {
    prospects?: number;
    companies?: number;
  };
  nodes?: Array<{
    id?: string;
    type?: string;
    label?: string;
    score?: number;
  }>;
  edges?: Array<{
    source?: string;
    target?: string;
    type?: string;
    relationshipStrength?: number;
  }>;
  stats?: {
    prospects?: number;
    companies?: number;
    connections?: number;
    averageRelationshipStrength?: number;
  };
}

interface PhraseAnalyticsEntry {
  phrase?: string;
  exposureCount?: number;
  openRate?: number;
  replyRate?: number;
  effectivenessScore?: number;
  confidence?: number;
  channels?: Record<string, number>;
}

interface PhraseAnalyticsResponse {
  phrases?: PhraseAnalyticsEntry[];
  summary?: {
    trackedPhrases?: number;
    candidatePhraseCount?: number;
    minExposure?: number;
    topK?: number;
    query?: string | null;
  };
  windowDays?: number;
  generatedAt?: string;
  totalRecords?: number;
}

interface PhraseChannelSummaryResponse {
  channels?: Array<{
    channel?: string;
    totalRecords?: number;
    trackedPhrases?: number;
    topPhrases?: PhraseAnalyticsEntry[];
  }>;
  channelCount?: number;
  totalRecords?: number;
  windowDays?: number;
  generatedAt?: string;
}

interface PredictionReportResponse {
  qualityTier: string;
  rolloutDecision: string;
  sampleSize: number;
  meanAbsoluteCalibrationError: number;
  probabilityGap?: number;
  recommendations: string[];
}

interface PredictionPerformanceResponse {
  sampleSize?: number;
  positiveRate?: number;
  averagePredictedProbability?: number;
  meanAbsoluteCalibrationError?: number;
  byChannel?: Record<
    string,
    {
      sampleSize?: number;
      positiveRate?: number;
      avgPredictedProbability?: number;
      meanAbsoluteCalibrationError?: number;
    }
  >;
  windowDays?: number;
  generatedAt?: string;
}

interface PredictionFeedbackHistoryResponse {
  records?: Array<{
    id?: string;
    predictionId?: string;
    predictedProbability?: number;
    outcome?: string;
    actualLabel?: number;
    channel?: string;
    responseLatencyHours?: number | null;
    createdAt?: string;
    updatedAt?: string;
  }>;
  count?: number;
  windowDays?: number;
  generatedAt?: string;
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
    orchestrationEvents?: number;
  }>;
  salesIntelligence?: {
    eventCount: number;
    byEventFamily: Record<string, number>;
    bySchemaVersion?: Record<string, number>;
    trendByDay?: Array<Record<string, any>>;
  };
  packetValidationAudit?: {
    eventCount: number;
    statusCounts?: Record<string, number>;
    withinFreshnessCount?: number;
    outsideFreshnessCount?: number;
    missingFreshnessCount?: number;
    latestEvaluatedAt?: string | null;
  };
  connectorValidation?: {
    eventCount?: number;
    byEndpoint?: Record<string, number>;
    byProvider?: Record<string, number>;
    byField?: Record<string, number>;
    byReason?: Record<string, number>;
    latestEventAt?: string | null;
  };
  governanceSchemaAudit?: {
    eventCount?: number;
    statusCounts?: Record<string, number>;
    reasonCodeParityPassCount?: number;
    reasonCodeParityFailCount?: number;
    recommendedCommandParityPassCount?: number;
    recommendedCommandParityFailCount?: number;
    handoffParityPassCount?: number;
    handoffParityFailCount?: number;
    allParityPassedCount?: number;
    allParityFailedCount?: number;
    rolloutBlockedCount?: number;
    latestEvaluatedAt?: string | null;
  };
  retryAudit?: {
    eventCount?: number;
    byOperation?: Record<string, number>;
    byProvider?: Record<string, number>;
    maxNextDelaySeconds?: number | null;
    avgNextDelaySeconds?: number | null;
    latestEventAt?: string | null;
  };
  orchestrationAudit?: {
    eventCount?: number;
    bySelectedProvider?: Record<string, number>;
    attemptStatusCounts?: Record<string, number>;
    reasonCodeCounts?: Record<string, number>;
    maxAttemptCount?: number | null;
    avgAttemptCount?: number | null;
    maxLatencyMs?: number | null;
    avgLatencyMs?: number | null;
    trendByDay?: Array<{
      date: string;
      events: number;
      attemptSuccessCount?: number;
      attemptSkippedCount?: number;
      attemptErrorCount?: number;
    }>;
    latestEventAt?: string | null;
  };
  connectorRateLimit?: {
    eventCount?: number;
    byEndpoint?: Record<string, number>;
    latestEventAt?: string | null;
    maxRetryAfterSeconds?: number | null;
    avgRetryAfterSeconds?: number | null;
    maxResetInSeconds?: number | null;
    avgResetInSeconds?: number | null;
  };
  recentEventsFilter?: 'all' | 'packet' | string;
  recentEventsGovernanceStatusFilter?: string | null;
  recentEventsPacketValidationStatusFilter?: string | null;
  recentEventsTotalCount?: number;
  recentEventsFilteredCount?: number;
  recentEventsPacketValidationCount?: number;
  recentEventsNonPacketCount?: number;
  recentEventsGovernanceStatusCounts?: Record<string, number>;
  recentEventsGovernanceStatusCountsSource?: string;
  recentEventsGovernanceStatusCountsMismatch?: boolean;
  recentEventsGovernanceStatusCountsServer?: Record<string, number>;
  recentEventsGovernanceStatusCountsFallback?: Record<string, number>;
  recentEventsGovernanceStatusCountsPosture?: string;
  recentEventsGovernanceStatusCountsPostureSeverity?: string;
  recentEventsGovernanceStatusCountsRequiresInvestigation?: boolean;
  recentEventsPacketValidationStatusCounts?: Record<string, number>;
  recentEventsPacketValidationStatusCountsSource?: string;
  recentEventsPacketValidationStatusCountsMismatch?: boolean;
  recentEventsPacketValidationStatusCountsServer?: Record<string, number>;
  recentEventsPacketValidationStatusCountsFallback?: Record<string, number>;
  recentEventsPacketValidationStatusCountsPosture?: string;
  recentEventsPacketValidationStatusCountsPostureSeverity?: string;
  recentEventsPacketValidationStatusCountsRequiresInvestigation?: boolean;
  recentEvents?: Array<{
    eventType?: string;
    provider?: string;
    createdAt?: string;
    schemaVersion?: number | string | null;
    requestId?: string | null;
    traceabilityDecision?: string | null;
    traceabilityReady?: boolean | null;
    governanceStatus?: string | null;
    governancePacketValidationStatus?: string | null;
    governancePacketValidationWithinFreshness?: boolean | null;
    governanceSchemaReasonCodeParityOk?: boolean | null;
    governanceSchemaRecommendedCommandParityOk?: boolean | null;
    governanceSchemaHandoffParityOk?: boolean | null;
    governanceSchemaAllParityOk?: boolean | null;
    governanceSchemaRolloutBlocked?: boolean | null;
    governanceSchemaReasonCodeCount?: number | null;
    governanceSchemaRecommendedCommandCount?: number | null;
    connectorRateLimitEndpoint?: string | null;
    connectorRateLimitRetryAfterSeconds?: number | null;
    connectorRateLimitResetInSeconds?: number | null;
    connectorValidationProvider?: string | null;
    connectorValidationEndpoint?: string | null;
    connectorValidationField?: string | null;
    connectorValidationReason?: string | null;
    connectorValidationErrorCode?: string | null;
    connectorValidationReceived?: string | number | boolean | null;
    connectorValidationMinimum?: string | number | boolean | null;
    connectorValidationMaximum?: string | number | boolean | null;
    retryOperation?: string | null;
    retryAttempt?: number | null;
    retryMaxAttempts?: number | null;
    retryNextDelaySeconds?: number | null;
    retryError?: string | null;
    retryFinalOutcome?: string | null;
    retryRetryable?: boolean | null;
    retryErrorType?: string | null;
    retryErrorStatusCode?: number | null;
    retryErrorReasonCode?: string | null;
    orchestrationSelectedProvider?: string | null;
    orchestrationAttemptCount?: number | null;
    orchestrationAttemptSuccessCount?: number | null;
    orchestrationAttemptSkippedCount?: number | null;
    orchestrationAttemptErrorCount?: number | null;
    orchestrationAttemptReasonCodes?: Record<string, number> | null;
    orchestrationResultCount?: number | null;
  }>;
}

interface GovernanceExportAction {
  severity?: string;
  ownerRole?: string;
  message?: string;
  trigger?: string;
  command?: string;
  reasonCode?: string;
}

interface GovernanceSchemaMetadata {
  activeVersion?: number;
  defaultVersion?: number;
  source?: string;
}

interface GovernanceExportEnvelope {
  governanceType?: string;
  exportSchemaVersion?: number;
  schemaMetadata?: GovernanceSchemaMetadata;
  status?: string;
  rolloutBlocked?: boolean;
  ownerRole?: string;
  connectorRateLimit?: GovernanceConnectorRateLimitRollup;
  sendgridWebhookTimestamp?: GovernanceSendgridWebhookTimestampRollup;
  runtimePrereqs?: GovernanceRuntimePrereqsRollup;
  alerts?: GovernanceExportAction[];
  actions?: Array<Record<string, any>>;
  evaluatedAt?: string;
  requestedBy?: string;
}

interface GovernanceConnectorPressureParity {
  topLevelEventCount?: number | null;
  nestedEventCount?: number | null;
  totalsEventCount?: number | null;
  eventCountMatchesNested?: boolean | null;
  eventCountMatchesTotals?: boolean | null;
  byEndpointMatchesNested?: boolean | null;
  pressureLabelMatchesNested?: boolean | null;
  normalizedTopLevelByEndpoint?: Record<string, number>;
  normalizedNestedByEndpoint?: Record<string, number>;
  computedAt?: string;
}

interface GovernanceSendgridWebhookTimestampParity {
  topLevelEventCount?: number | null;
  nestedEventCount?: number | null;
  totalsEventCount?: number | null;
  topLevelAnomalyCountTotal?: number | null;
  nestedAnomalyCountTotal?: number | null;
  eventCountMatchesNested?: boolean | null;
  eventCountMatchesTotals?: boolean | null;
  anomalyCountTotalMatchesNested?: boolean | null;
  pressureLabelCountsMatchNested?: boolean | null;
  pressureHintCountsMatchNested?: boolean | null;
  ageBucketCountsMatchNested?: boolean | null;
  anomalyEventTypeCountsMatchNested?: boolean | null;
  latestEventAtMatchesNested?: boolean | null;
  normalizedTopLevelPressureLabelCounts?: Record<string, number>;
  normalizedNestedPressureLabelCounts?: Record<string, number>;
  normalizedTopLevelPressureHintCounts?: Record<string, number>;
  normalizedNestedPressureHintCounts?: Record<string, number>;
  normalizedTopLevelAgeBucketCounts?: Record<string, number>;
  normalizedNestedAgeBucketCounts?: Record<string, number>;
  normalizedTopLevelAnomalyEventTypeCounts?: Record<string, number>;
  normalizedNestedAnomalyEventTypeCounts?: Record<string, number>;
  normalizedLatestEventAtTopLevel?: string | null;
  normalizedLatestEventAtNested?: string | null;
  computedAt?: string;
}

interface GovernanceRuntimePrereqsRollup {
  present?: boolean;
  available?: boolean;
  passed?: boolean | null;
  contractValid?: boolean | null;
  valid?: boolean | null;
  missingCheckCount?: number | null;
  missingChecks?: {
    commands?: string[];
    workspace?: string[];
  };
  artifactPath?: string | null;
  generatedAt?: string | null;
  validatedAt?: string | null;
  command?: string | null;
  historyArtifactCount?: number;
  failingArtifactCount?: number;
}

interface IntegrationsGovernanceReportResponse {
  governanceType?: string;
  exportSchemaVersion?: number;
  schemaMetadata?: GovernanceSchemaMetadata;
  generatedAt?: string;
  windowDays?: number;
  eventLimit?: number;
  status?: string;
  alerts?: string[];
  handoff?: {
    rolloutBlocked?: boolean;
    ownerRole?: string;
    actions?: string[];
  };
  totals?: {
    governanceEventCount?: number;
    traceabilityEvaluationCount?: number;
    snapshotEvaluationCount?: number;
    baselineEvaluationCount?: number;
    actionRequiredCount?: number;
    rolloutBlockedCount?: number;
    connectorRateLimitEventCount?: number;
    sendgridWebhookTimestampEventCount?: number;
    sendgridWebhookTimestampAnomalyCountTotal?: number;
  };
  connectorRateLimit?: GovernanceConnectorRateLimitRollup;
  sendgridWebhookTimestamp?: GovernanceSendgridWebhookTimestampRollup;
  runtimePrereqs?: GovernanceRuntimePrereqsRollup;
  connectorPressureParity?: GovernanceConnectorPressureParity;
  sendgridWebhookTimestampParity?: GovernanceSendgridWebhookTimestampParity;
  governanceStatusCounts?: Record<string, number>;
  traceabilityDecisionCounts?: Record<string, number>;
  timeline?: Array<{
    date: string;
    snapshotGovernanceEvents: number;
    baselineGovernanceEvents: number;
    traceabilityEvents: number;
    actionRequiredEvents: number;
  }>;
  recommendedCommands?: string[];
  reasonCodes?: string[];
  governanceExport?: GovernanceExportEnvelope;
}

interface IntegrationsGovernanceReportExportResponse {
  governanceType?: string;
  exportSchemaVersion?: number;
  schemaMetadata?: GovernanceSchemaMetadata;
  generatedAt?: string;
  windowDays?: number;
  eventLimit?: number;
  status?: string;
  totals?: {
    governanceEventCount?: number;
    traceabilityEvaluationCount?: number;
    snapshotEvaluationCount?: number;
    baselineEvaluationCount?: number;
    actionRequiredCount?: number;
    rolloutBlockedCount?: number;
    connectorRateLimitEventCount?: number;
    sendgridWebhookTimestampEventCount?: number;
    sendgridWebhookTimestampAnomalyCountTotal?: number;
  };
  connectorRateLimit?: GovernanceConnectorRateLimitRollup;
  sendgridWebhookTimestamp?: GovernanceSendgridWebhookTimestampRollup;
  runtimePrereqs?: GovernanceRuntimePrereqsRollup;
  connectorPressureParity?: GovernanceConnectorPressureParity;
  sendgridWebhookTimestampParity?: GovernanceSendgridWebhookTimestampParity;
  recommendedCommands?: string[];
  reasonCodes?: string[];
  governanceExport?: GovernanceExportEnvelope;
  requestedBy?: string;
}

interface IntegrationsGovernanceReportHistoryResponse {
  governanceType?: string;
  exportSchemaVersion?: number;
  schemaMetadata?: GovernanceSchemaMetadata;
  generatedAt?: string;
  retentionDays?: number;
  artifactCount?: number;
  staleCount?: number;
  rolloutBlockedCount?: number;
  duplicateArtifactNames?: string[];
  schemaVersionCounts?: Record<string, number>;
  reasonCodes?: string[];
  totals?: {
    connectorRateLimitEventCount?: number;
    sendgridWebhookTimestampEventCount?: number;
    sendgridWebhookTimestampAnomalyCountTotal?: number;
  };
  connectorRateLimit?: GovernanceConnectorRateLimitRollup;
  sendgridWebhookTimestamp?: GovernanceSendgridWebhookTimestampRollup;
  runtimePrereqs?: GovernanceRuntimePrereqsRollup;
  connectorPressureParity?: GovernanceConnectorPressureParity;
  sendgridWebhookTimestampParity?: GovernanceSendgridWebhookTimestampParity;
  latestArtifact?: {
    name?: string;
    exportSchemaVersion?: number;
    generatedAt?: string;
    status?: string;
    rolloutBlocked?: boolean;
  };
  items?: Array<{
    name?: string;
    exportSchemaVersion?: number;
    generatedAt?: string;
    withinRetention?: boolean;
    status?: string;
    rolloutBlocked?: boolean;
  }>;
  recommendedCommands?: string[];
  governanceExport?: GovernanceExportEnvelope;
}

interface IntegrationsGovernanceSchemaResponse {
  generatedAt?: string;
  governanceType?: string;
  status?: string;
  schemaMetadata?: GovernanceSchemaMetadata & {
    supportedVersions?: number[];
    override?: {
      envVar?: string;
      rawValue?: string;
      isSet?: boolean;
      isValid?: boolean;
    };
  };
  alerts?: string[];
  reasonCodes?: string[];
  handoff?: {
    rolloutBlocked?: boolean;
    ownerRole?: string;
    actions?: string[];
  };
  rolloutActions?: Array<{
    priority?: string;
    severity?: string;
    ownerRole?: string;
    action?: string;
    trigger?: string;
    command?: string;
    reasonCode?: string;
  }>;
  recommendedCommands?: string[];
  schemaContractParity?: {
    reasonCodeCount?: number;
    recommendedCommandCount?: number;
    reasonCodeParity?: {
      topLevelVsRolloutActions?: boolean | null;
      topLevelVsExportActions?: boolean | null;
      topLevelVsExportAlerts?: boolean | null;
      topLevelVsExportReasonCodes?: boolean | null;
    };
    recommendedCommandParity?: {
      topLevelVsExport?: boolean | null;
    };
    handoffParity?: {
      rolloutBlockedMatchesExport?: boolean | null;
      ownerRoleMatchesExport?: boolean | null;
      handoffActionsMatchRolloutActions?: boolean | null;
      handoffActionCount?: number;
      rolloutActionCount?: number;
    };
    computedAt?: string;
  };
  governanceExport?: GovernanceExportEnvelope & {
    reasonCodes?: string[];
    recommendedCommands?: string[];
  };
  requestedBy?: string;
}

interface IntegrationsBaselineGovernanceResponse {
  generatedAt?: string;
  governanceType?: string;
  status?: string;
  reasonCodes?: string[];
  recommendedCommands?: string[];
  handoff?: {
    rolloutBlocked?: boolean;
    ownerRole?: string;
    actions?: string[];
  };
  rolloutActions?: Array<{
    priority?: string;
    severity?: string;
    ownerRole?: string;
    action?: string;
    trigger?: string;
    command?: string;
    reasonCode?: string;
  }>;
  orchestrationGate?: {
    available?: boolean;
    decision?: string | null;
    attemptErrorGatePassed?: boolean | null;
    attemptSkippedGatePassed?: boolean | null;
  };
  runtimePrereqs?: {
    present?: boolean;
    available?: boolean;
    passed?: boolean | null;
    contractValid?: boolean | null;
    valid?: boolean | null;
    missingCheckCount?: number | null;
    missingChecks?: {
      commands?: string[];
      workspace?: string[];
    };
    command?: string | null;
    generatedAt?: string | null;
    validatedAt?: string | null;
  };
  commandAliases?: {
    present?: boolean;
    available?: boolean;
    source?: string | null;
    artifactPath?: string | null;
    command?: string | null;
    validatedAt?: string | null;
    contractValid?: boolean | null;
    valid?: boolean | null;
    gatePassed?: boolean | null;
    missingAliases?: string[];
    missingAliasCount?: number | null;
    mismatchedAliases?: string[];
    mismatchedAliasCount?: number | null;
  };
  governanceExport?: GovernanceExportEnvelope & {
    recommendedCommands?: string[];
    commandAliases?: {
      present?: boolean;
      available?: boolean;
      source?: string | null;
      artifactPath?: string | null;
      command?: string | null;
      validatedAt?: string | null;
      contractValid?: boolean | null;
      valid?: boolean | null;
      gatePassed?: boolean | null;
      missingAliases?: string[];
      missingAliasCount?: number | null;
      mismatchedAliases?: string[];
      mismatchedAliasCount?: number | null;
    };
  };
}

interface IntegrationHealthProvider {
  provider: string;
  healthy: boolean;
  statusCode: number | null;
  latencyMs: number | null;
  error: string | null;
  configuredAt?: string | null;
  lastRotatedAt?: string | null;
  credentialConfiguredAgeDays?: number | null;
  credentialRotationAgeDays?: number | null;
  credentialStale?: boolean;
  credentialStaleReasons?: string[];
}

interface IntegrationHealthResponse {
  generatedAt: string;
  status?: 'READY' | 'ACTION_REQUIRED' | string;
  healthyCount?: number;
  unhealthyCount?: number;
  actionableUnhealthyProviders?: string[];
  credentialActionRequiredProviders?: string[];
  credentialConfiguredMaxAgeDays?: number;
  credentialRotationMaxAgeDays?: number;
  credentialFreshnessByProvider?: Record<
    string,
    {
      status?: 'READY' | 'ACTION_REQUIRED' | 'UNKNOWN' | string;
      configuredAgeDays?: number | null;
      rotationAgeDays?: number | null;
      staleReasons?: string[];
    }
  >;
  credentialFreshnessStatusCounts?: Record<string, number>;
  credentialFreshnessStatusCountsSource?: string;
  credentialFreshnessStatusCountsMismatch?: boolean;
  credentialFreshnessStatusCountsServer?: Record<string, number>;
  credentialFreshnessStatusCountsFallback?: Record<string, number>;
  credentialFreshnessTotalProviders?: number;
  credentialFreshnessActionRequiredCount?: number;
  credentialFreshnessWithinPolicyCount?: number;
  credentialFreshnessUnknownCount?: number;
  alerts?: string[];
  recommendedCommands?: string[];
  providers: IntegrationHealthProvider[];
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

function formatCurrency(value: number | undefined | null): string {
  const normalized = Number(value || 0);
  if (!Number.isFinite(normalized)) {
    return CURRENCY_FORMATTER.format(0);
  }
  return CURRENCY_FORMATTER.format(normalized);
}

function resolveConnectorRateLimitPressure(
  maxRetryAfterSeconds?: number | null,
  avgResetInSeconds?: number | null
): { label: string; hint: string; toneClass: string; signalSeconds: number } {
  const retrySeconds = Number(maxRetryAfterSeconds);
  const resetSeconds = Number(avgResetInSeconds);
  const signalSeconds = Math.max(
    Number.isFinite(retrySeconds) ? retrySeconds : 0,
    Number.isFinite(resetSeconds) ? resetSeconds : 0
  );
  if (signalSeconds >= 45) {
    return {
      label: 'High',
      hint: 'Sustained throttling risk. Pause connector rollout expansion and reduce lookup concurrency.',
      toneClass: 'text-rose-700',
      signalSeconds,
    };
  }
  if (signalSeconds >= 20) {
    return {
      label: 'Moderate',
      hint: 'Monitor connector traffic and keep rollout guarded until reset windows contract.',
      toneClass: 'text-amber-700',
      signalSeconds,
    };
  }
  if (signalSeconds > 0) {
    return {
      label: 'Low',
      hint: 'Current connector throttling pressure is within expected operating bounds.',
      toneClass: 'text-emerald-700',
      signalSeconds,
    };
  }
  return {
    label: 'Unknown',
    hint: 'Insufficient connector rate-limit data in current telemetry window.',
    toneClass: 'text-gray-600',
    signalSeconds,
  };
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
  const [campaignPortfolioWindowDaysInput, setCampaignPortfolioWindowDaysInput] = useState(90);
  const [campaignPortfolioStatusInput, setCampaignPortfolioStatusInput] = useState<CampaignPortfolioStatus>('active');
  const [campaignPortfolioLimitInput, setCampaignPortfolioLimitInput] = useState(10);
  const [campaignPortfolioParams, setCampaignPortfolioParams] = useState<{
    windowDays: number;
    status: CampaignPortfolioStatus;
    limit: number;
  }>({
    windowDays: 90,
    status: 'active',
    limit: 10,
  });
  const [campaignPerformanceChannelLimitInput, setCampaignPerformanceChannelLimitInput] = useState(10);
  const [campaignPerformanceChannelLimitParam, setCampaignPerformanceChannelLimitParam] = useState(10);
  const [forecastWindowDaysInput, setForecastWindowDaysInput] = useState(90);
  const [forecastWindowDaysParam, setForecastWindowDaysParam] = useState(90);
  const [predictionReportWindowDaysInput, setPredictionReportWindowDaysInput] = useState(90);
  const [predictionReportWindowDaysParam, setPredictionReportWindowDaysParam] = useState(90);
  const [conversationWindowDaysInput, setConversationWindowDaysInput] = useState(90);
  const [conversationWindowDaysParam, setConversationWindowDaysParam] = useState(90);
  const [conversationLimitInput, setConversationLimitInput] = useState(300);
  const [conversationLimitParam, setConversationLimitParam] = useState(300);
  const [multiChannelWindowDaysInput, setMultiChannelWindowDaysInput] = useState(90);
  const [multiChannelWindowDaysParam, setMultiChannelWindowDaysParam] = useState(90);
  const [multiChannelCampaignLimitInput, setMultiChannelCampaignLimitInput] = useState(1000);
  const [multiChannelCampaignLimitParam, setMultiChannelCampaignLimitParam] = useState(1000);
  const [multiChannelAbTestLimitInput, setMultiChannelAbTestLimitInput] = useState(2000);
  const [multiChannelAbTestLimitParam, setMultiChannelAbTestLimitParam] = useState(2000);
  const [multiChannelProspectLimitInput, setMultiChannelProspectLimitInput] = useState(5000);
  const [multiChannelProspectLimitParam, setMultiChannelProspectLimitParam] = useState(5000);
  const [relationshipWindowDaysInput, setRelationshipWindowDaysInput] = useState(90);
  const [relationshipWindowDaysParam, setRelationshipWindowDaysParam] = useState(90);
  const [relationshipLimitInput, setRelationshipLimitInput] = useState(250);
  const [relationshipLimitParam, setRelationshipLimitParam] = useState(250);
  const [phraseWindowDaysInput, setPhraseWindowDaysInput] = useState(90);
  const [phraseMinExposureInput, setPhraseMinExposureInput] = useState(2);
  const [phraseLimitInput, setPhraseLimitInput] = useState(8);
  const [phraseChannelLimitInput, setPhraseChannelLimitInput] = useState(5);
  const [phraseParams, setPhraseParams] = useState({
    windowDays: 90,
    minExposure: 2,
    limit: 8,
    channelLimit: 5,
  });
  const [predictionFeedbackWindowDaysInput, setPredictionFeedbackWindowDaysInput] = useState(90);
  const [predictionFeedbackLimitInput, setPredictionFeedbackLimitInput] = useState(25);
  const [predictionFeedbackParams, setPredictionFeedbackParams] = useState({
    windowDays: 90,
    historyLimit: 25,
  });
  const [telemetryDaysInput, setTelemetryDaysInput] = useState(7);
  const [telemetryLimitInput, setTelemetryLimitInput] = useState(500);
  const [telemetryParams, setTelemetryParams] = useState({ days: 7, limit: 500 });
  const [recentTelemetryFilter, setRecentTelemetryFilter] = useState<'all' | 'packet'>('all');
  const [recentTelemetryGovernanceStatusFilter, setRecentTelemetryGovernanceStatusFilter] = useState<
    (typeof TELEMETRY_GOVERNANCE_STATUS_FILTER_OPTIONS)[number]
  >(TELEMETRY_STATUS_FILTER_ALL);
  const [recentTelemetryPacketStatusFilter, setRecentTelemetryPacketStatusFilter] = useState<
    (typeof TELEMETRY_PACKET_STATUS_FILTER_OPTIONS)[number]
  >(TELEMETRY_STATUS_FILTER_ALL);
  const telemetryGovernanceStatusQueryFilter =
    recentTelemetryGovernanceStatusFilter === TELEMETRY_STATUS_FILTER_ALL
      ? null
      : recentTelemetryGovernanceStatusFilter;
  const telemetryPacketStatusQueryFilter =
    recentTelemetryPacketStatusFilter === TELEMETRY_STATUS_FILTER_ALL
      ? null
      : recentTelemetryPacketStatusFilter;
  const [governanceHistoryDaysInput, setGovernanceHistoryDaysInput] = useState(30);
  const [governanceHistoryLimitInput, setGovernanceHistoryLimitInput] = useState(20);
  const [governanceHistoryParams, setGovernanceHistoryParams] = useState({ retentionDays: 30, limit: 20 });
  const [uiNotice, setUiNotice] = useState<UiNotice | null>(null);

  const {
    data: campaignPortfolio,
    isLoading: isCampaignPortfolioLoading,
    error: campaignPortfolioError
  } = useQuery({
    queryKey: [
      'sales-intelligence-page-portfolio',
      campaignPortfolioParams.windowDays,
      campaignPortfolioParams.status,
      campaignPortfolioParams.limit,
    ],
    queryFn: () =>
      api.getSalesCampaignPortfolio({
        windowDays: campaignPortfolioParams.windowDays,
        status: campaignPortfolioParams.status === 'all' ? undefined : campaignPortfolioParams.status,
        limit: campaignPortfolioParams.limit,
      }) as Promise<CampaignPortfolioResponse>,
    retry: false
  });

  const {
    data: campaignPerformance,
    isLoading: isCampaignPerformanceLoading,
    error: campaignPerformanceError
  } = useQuery({
    queryKey: ['sales-intelligence-page-campaign', selectedCampaignId, campaignPerformanceChannelLimitParam],
    queryFn: () =>
      api.getSalesCampaignPerformance(selectedCampaignId, {
        channelLimit: campaignPerformanceChannelLimitParam,
      }) as Promise<CampaignPerformanceResponse>,
    enabled: !!selectedCampaignId,
    retry: false
  });

  const {
    data: predictionReport,
    isLoading: isPredictionReportLoading,
    error: predictionReportError
  } = useQuery({
    queryKey: ['sales-intelligence-page-prediction-report', predictionReportWindowDaysParam],
    queryFn: () =>
      api.getPredictionPerformanceReport({
        windowDays: predictionReportWindowDaysParam,
      }) as Promise<PredictionReportResponse>,
    retry: false
  });
  const {
    data: pipelineForecast,
    isLoading: isPipelineForecastLoading,
    error: pipelineForecastError,
  } = useQuery({
    queryKey: ['sales-intelligence-page-pipeline-forecast', forecastWindowDaysParam],
    queryFn: () => api.getPipelineForecast(forecastWindowDaysParam) as Promise<PipelineForecastResponse>,
    retry: false,
  });
  const {
    data: conversationIntelligence,
    isLoading: isConversationIntelligenceLoading,
    error: conversationIntelligenceError,
  } = useQuery({
    queryKey: ['sales-intelligence-page-conversation-intelligence', conversationWindowDaysParam, conversationLimitParam],
    queryFn: () =>
      api.getConversationIntelligence({
        windowDays: conversationWindowDaysParam,
        limit: conversationLimitParam,
      }) as Promise<ConversationIntelligenceResponse>,
    retry: false,
  });
  const {
    data: multiChannelEngagement,
    isLoading: isMultiChannelEngagementLoading,
    error: multiChannelEngagementError,
  } = useQuery({
    queryKey: [
      'sales-intelligence-page-multi-channel-engagement',
      multiChannelWindowDaysParam,
      multiChannelCampaignLimitParam,
      multiChannelAbTestLimitParam,
      multiChannelProspectLimitParam,
    ],
    queryFn: () =>
      api.getMultiChannelEngagement({
        windowDays: multiChannelWindowDaysParam,
        campaignLimit: multiChannelCampaignLimitParam,
        abTestLimit: multiChannelAbTestLimitParam,
        prospectLimit: multiChannelProspectLimitParam,
      }) as Promise<MultiChannelEngagementResponse>,
    retry: false,
  });
  const {
    data: relationshipMap,
    isLoading: isRelationshipMapLoading,
    error: relationshipMapError,
  } = useQuery({
    queryKey: ['sales-intelligence-page-relationship-map', relationshipWindowDaysParam, relationshipLimitParam],
    queryFn: () =>
      api.getRelationshipMap({
        windowDays: relationshipWindowDaysParam,
        limit: relationshipLimitParam,
      }) as Promise<RelationshipMapResponse>,
    retry: false,
  });
  const {
    data: phraseAnalytics,
    isLoading: isPhraseAnalyticsLoading,
    error: phraseAnalyticsError,
  } = useQuery({
    queryKey: [
      'sales-intelligence-page-phrase-analytics',
      phraseParams.windowDays,
      phraseParams.minExposure,
      phraseParams.limit,
    ],
    queryFn: () =>
      api.getPhraseAnalytics({
        windowDays: phraseParams.windowDays,
        minExposure: phraseParams.minExposure,
        limit: phraseParams.limit,
      }) as Promise<PhraseAnalyticsResponse>,
    retry: false,
  });
  const {
    data: phraseChannelSummary,
    isLoading: isPhraseChannelSummaryLoading,
    error: phraseChannelSummaryError,
  } = useQuery({
    queryKey: [
      'sales-intelligence-page-phrase-channel-summary',
      phraseParams.windowDays,
      phraseParams.minExposure,
      phraseParams.channelLimit,
    ],
    queryFn: () =>
      api.getPhraseChannelSummary({
        windowDays: phraseParams.windowDays,
        minExposure: phraseParams.minExposure,
        limit: phraseParams.channelLimit,
      }) as Promise<PhraseChannelSummaryResponse>,
    retry: false,
  });
  const {
    data: predictionPerformance,
    isLoading: isPredictionPerformanceLoading,
    error: predictionPerformanceError,
  } = useQuery({
    queryKey: ['sales-intelligence-page-prediction-performance', predictionFeedbackParams.windowDays],
    queryFn: () =>
      api.getPredictionPerformance({
        windowDays: predictionFeedbackParams.windowDays,
      }) as Promise<PredictionPerformanceResponse>,
    retry: false,
  });
  const {
    data: predictionFeedbackHistory,
    isLoading: isPredictionFeedbackHistoryLoading,
    error: predictionFeedbackHistoryError,
  } = useQuery({
    queryKey: [
      'sales-intelligence-page-prediction-feedback-history',
      predictionFeedbackParams.windowDays,
      predictionFeedbackParams.historyLimit,
    ],
    queryFn: () =>
      api.getPredictionFeedbackHistory({
        windowDays: predictionFeedbackParams.windowDays,
        limit: predictionFeedbackParams.historyLimit,
      }) as Promise<PredictionFeedbackHistoryResponse>,
    retry: false,
  });

  const {
    data: telemetrySummary,
    isLoading: isTelemetryLoading,
    error: telemetryError
  } = useQuery({
    queryKey: [
      'sales-intelligence-page-telemetry',
      telemetryParams.days,
      telemetryParams.limit,
      recentTelemetryFilter,
      telemetryGovernanceStatusQueryFilter || 'all',
      telemetryPacketStatusQueryFilter || 'all',
    ],
    queryFn: () => api.getIntegrationsTelemetrySummary(
      telemetryParams.days,
      telemetryParams.limit,
      recentTelemetryFilter === 'packet',
      {
        governanceStatus: telemetryGovernanceStatusQueryFilter,
        packetValidationStatus: telemetryPacketStatusQueryFilter,
      }
    ) as Promise<IntegrationTelemetrySummaryResponse>,
    retry: false
  });
  const {
    data: integrationsHealth,
    isLoading: isIntegrationsHealthLoading,
    error: integrationsHealthError,
  } = useQuery({
    queryKey: ['sales-intelligence-page-integrations-health'],
    queryFn: () => api.getIntegrationsHealth() as Promise<IntegrationHealthResponse>,
    retry: false,
  });

  const {
    data: governanceReport,
    isLoading: isGovernanceReportLoading,
    error: governanceReportError
  } = useQuery({
    queryKey: ['sales-intelligence-page-governance-report', telemetryParams.days, telemetryParams.limit],
    queryFn: () => api.getIntegrationsGovernanceReport(
      telemetryParams.days,
      telemetryParams.limit
    ) as Promise<IntegrationsGovernanceReportResponse>,
    retry: false
  });

  const {
    data: governanceReportExport,
    isLoading: isGovernanceReportExportLoading,
    error: governanceReportExportError
  } = useQuery({
    queryKey: ['sales-intelligence-page-governance-report-export', telemetryParams.days, telemetryParams.limit],
    queryFn: () => api.getIntegrationsGovernanceReportExport(
      telemetryParams.days,
      telemetryParams.limit
    ) as Promise<IntegrationsGovernanceReportExportResponse>,
    retry: false
  });
  const {
    data: governanceReportHistory,
    isLoading: isGovernanceReportHistoryLoading,
    error: governanceReportHistoryError
  } = useQuery({
    queryKey: ['sales-intelligence-page-governance-report-history', governanceHistoryParams.retentionDays, governanceHistoryParams.limit],
    queryFn: () => api.getIntegrationsGovernanceReportHistory(
      governanceHistoryParams.retentionDays,
      governanceHistoryParams.limit
    ) as Promise<IntegrationsGovernanceReportHistoryResponse>,
    retry: false
  });
  const {
    data: governanceSchema,
    isLoading: isGovernanceSchemaLoading,
    error: governanceSchemaError
  } = useQuery({
    queryKey: ['sales-intelligence-page-governance-schema'],
    queryFn: () => api.getIntegrationsGovernanceSchema() as Promise<IntegrationsGovernanceSchemaResponse>,
    retry: false
  });
  const {
    data: baselineGovernance,
    isLoading: isBaselineGovernanceLoading,
    error: baselineGovernanceError
  } = useQuery({
    queryKey: ['sales-intelligence-page-baseline-governance'],
    queryFn: () => api.getIntegrationsBaselineGovernance() as Promise<IntegrationsBaselineGovernanceResponse>,
    retry: false
  });

  useEffect(() => {
    const rankedCampaigns = campaignPortfolio?.rankedCampaigns || [];
    if (!rankedCampaigns.length) {
      if (selectedCampaignId) {
        setSelectedCampaignId('');
      }
      return;
    }
    const selectedExists = rankedCampaigns.some((campaign) => campaign.campaignId === selectedCampaignId);
    if (!selectedExists) {
      setSelectedCampaignId(rankedCampaigns[0].campaignId);
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
  const conversationSentimentRows = useMemo(
    () => Object.entries(conversationIntelligence?.sentiment || {}).sort(([a], [b]) => a.localeCompare(b)),
    [conversationIntelligence]
  );
  const conversationChannelRows = useMemo(
    () =>
      Object.entries(conversationIntelligence?.totals?.channels || {})
        .filter(([, count]) => Number(count || 0) > 0)
        .sort(([a], [b]) => a.localeCompare(b)),
    [conversationIntelligence]
  );
  const conversationTopObjections = useMemo(
    () => (conversationIntelligence?.topObjections || []).slice(0, 5),
    [conversationIntelligence]
  );
  const multiChannelUsageRows = useMemo(
    () =>
      Object.entries(multiChannelEngagement?.channelUsage || {})
        .filter(([, count]) => Number(count || 0) > 0)
        .sort(([a], [b]) => a.localeCompare(b)),
    [multiChannelEngagement]
  );
  const relationshipHealthLabel = String(conversationIntelligence?.relationshipHealth || 'unknown').toUpperCase();
  const relationshipHealthToneClass =
    relationshipHealthLabel === 'HEALTHY'
      ? 'text-emerald-700'
      : relationshipHealthLabel === 'WATCH'
        ? 'text-amber-700'
        : relationshipHealthLabel === 'AT_RISK'
          ? 'text-rose-700'
          : 'text-slate-600';
  const campaignPortfolioServerStatusFilter = String(
    campaignPortfolio?.statusFilter || campaignPortfolioParams.status || 'all'
  ).toLowerCase();
  const campaignPortfolioExportPayload = useMemo(
    () =>
      campaignPortfolio
        ? {
            ...campaignPortfolio,
            exportSchemaVersion: TELEMETRY_EXPORT_SCHEMA_VERSION,
            exportGeneratedAt: new Date().toISOString(),
            exportRequestedWindowDays: campaignPortfolioParams.windowDays,
            exportRequestedStatus: campaignPortfolioParams.status,
            exportRequestedLimit: campaignPortfolioParams.limit,
            exportServerStatusFilter: campaignPortfolioServerStatusFilter,
          }
        : { message: 'No campaign portfolio loaded' },
    [
      campaignPortfolio,
      campaignPortfolioParams.limit,
      campaignPortfolioParams.status,
      campaignPortfolioParams.windowDays,
      campaignPortfolioServerStatusFilter,
    ]
  );
  const campaignPerformanceExportPayload = useMemo(
    () =>
      campaignPerformance
        ? {
            ...campaignPerformance,
            exportSchemaVersion: TELEMETRY_EXPORT_SCHEMA_VERSION,
            exportGeneratedAt: new Date().toISOString(),
            exportRequestedWindowDays: campaignPortfolioParams.windowDays,
            exportRequestedStatus: campaignPortfolioParams.status,
            exportRequestedLimit: campaignPortfolioParams.limit,
            exportRequestedChannelLimit: campaignPerformanceChannelLimitParam,
            exportDisplayedChannelCount:
              Number.isFinite(Number(campaignPerformance.displayedChannelCount))
                ? Number(campaignPerformance.displayedChannelCount)
                : Array.isArray(campaignPerformance.byChannel)
                  ? campaignPerformance.byChannel.length
                  : 0,
            exportSelectedCampaignId: selectedCampaignId || null,
            exportPortfolioServerStatusFilter: campaignPortfolioServerStatusFilter,
          }
        : {
            message: 'No campaign performance loaded',
            exportSelectedCampaignId: selectedCampaignId || null,
          },
    [
      campaignPerformance,
      campaignPerformanceChannelLimitParam,
      campaignPortfolioParams.limit,
      campaignPortfolioParams.status,
      campaignPortfolioParams.windowDays,
      campaignPortfolioServerStatusFilter,
      selectedCampaignId,
    ]
  );
  const conversationExportPayload = useMemo(
    () =>
      conversationIntelligence
        ? {
            ...conversationIntelligence,
            exportSchemaVersion: TELEMETRY_EXPORT_SCHEMA_VERSION,
            exportGeneratedAt: new Date().toISOString(),
            exportRequestedWindowDays: conversationWindowDaysParam,
            exportRequestedLimit: conversationLimitParam,
          }
        : { message: 'No conversation intelligence loaded' },
    [conversationIntelligence, conversationLimitParam, conversationWindowDaysParam]
  );
  const multiChannelAppliedLimits = useMemo(
    () => ({
      windowDays:
        Number.isFinite(Number(multiChannelEngagement?.appliedLimits?.windowDays))
          ? Number(multiChannelEngagement?.appliedLimits?.windowDays)
          : multiChannelWindowDaysParam,
      campaigns:
        Number.isFinite(Number(multiChannelEngagement?.appliedLimits?.campaigns))
          ? Number(multiChannelEngagement?.appliedLimits?.campaigns)
          : multiChannelCampaignLimitParam,
      abTests:
        Number.isFinite(Number(multiChannelEngagement?.appliedLimits?.abTests))
          ? Number(multiChannelEngagement?.appliedLimits?.abTests)
          : multiChannelAbTestLimitParam,
      prospects:
        Number.isFinite(Number(multiChannelEngagement?.appliedLimits?.prospects))
          ? Number(multiChannelEngagement?.appliedLimits?.prospects)
          : multiChannelProspectLimitParam,
    }),
    [
      multiChannelAbTestLimitParam,
      multiChannelCampaignLimitParam,
      multiChannelEngagement?.appliedLimits?.abTests,
      multiChannelEngagement?.appliedLimits?.campaigns,
      multiChannelEngagement?.appliedLimits?.prospects,
      multiChannelEngagement?.appliedLimits?.windowDays,
      multiChannelProspectLimitParam,
      multiChannelWindowDaysParam,
    ]
  );
  const multiChannelExportPayload = useMemo(
    () =>
      multiChannelEngagement
        ? {
            ...multiChannelEngagement,
            exportSchemaVersion: TELEMETRY_EXPORT_SCHEMA_VERSION,
            exportGeneratedAt: new Date().toISOString(),
            exportRequestedWindowDays: multiChannelWindowDaysParam,
            exportRequestedCampaignLimit: multiChannelCampaignLimitParam,
            exportRequestedAbTestLimit: multiChannelAbTestLimitParam,
            exportRequestedProspectLimit: multiChannelProspectLimitParam,
            exportAppliedWindowDays: multiChannelAppliedLimits.windowDays,
            exportAppliedCampaignLimit: multiChannelAppliedLimits.campaigns,
            exportAppliedAbTestLimit: multiChannelAppliedLimits.abTests,
            exportAppliedProspectLimit: multiChannelAppliedLimits.prospects,
          }
        : { message: 'No multi-channel engagement loaded' },
    [
      multiChannelAppliedLimits.abTests,
      multiChannelAppliedLimits.campaigns,
      multiChannelAppliedLimits.prospects,
      multiChannelAppliedLimits.windowDays,
      multiChannelAbTestLimitParam,
      multiChannelCampaignLimitParam,
      multiChannelEngagement,
      multiChannelProspectLimitParam,
      multiChannelWindowDaysParam,
    ]
  );
  const relationshipAppliedWindowDays = Number.isFinite(Number(relationshipMap?.windowDays))
    ? Number(relationshipMap?.windowDays)
    : relationshipWindowDaysParam;
  const relationshipMapExportPayload = useMemo(
    () =>
      relationshipMap
        ? {
            ...relationshipMap,
            exportSchemaVersion: TELEMETRY_EXPORT_SCHEMA_VERSION,
            exportGeneratedAt: new Date().toISOString(),
            exportRequestedWindowDays: relationshipWindowDaysParam,
            exportRequestedLimit: relationshipLimitParam,
            exportAppliedWindowDays: relationshipAppliedWindowDays,
          }
        : { message: 'No relationship map loaded' },
    [relationshipAppliedWindowDays, relationshipLimitParam, relationshipMap, relationshipWindowDaysParam]
  );
  const phraseAnalyticsRows = useMemo(
    () => (phraseAnalytics?.phrases || []).slice(0, 5),
    [phraseAnalytics]
  );
  const phraseChannelRows = useMemo(
    () => (phraseChannelSummary?.channels || []).slice(0, 4),
    [phraseChannelSummary]
  );
  const predictionPerformanceChannelRows = useMemo(
    () =>
      Object.entries(predictionPerformance?.byChannel || {})
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(0, 4),
    [predictionPerformance]
  );
  const predictionFeedbackHistoryRows = useMemo(
    () => (predictionFeedbackHistory?.records || []).slice(0, 5),
    [predictionFeedbackHistory]
  );
  const phraseAnalyticsExportPayload = useMemo(
    () =>
      phraseAnalytics
        ? {
            ...phraseAnalytics,
            exportSchemaVersion: TELEMETRY_EXPORT_SCHEMA_VERSION,
            exportGeneratedAt: new Date().toISOString(),
            exportRequestedWindowDays: phraseParams.windowDays,
            exportRequestedMinExposure: phraseParams.minExposure,
            exportRequestedLimit: phraseParams.limit,
          }
        : { message: 'No phrase analytics loaded' },
    [phraseAnalytics, phraseParams.limit, phraseParams.minExposure, phraseParams.windowDays]
  );
  const phraseChannelSummaryExportPayload = useMemo(
    () =>
      phraseChannelSummary
        ? {
            ...phraseChannelSummary,
            exportSchemaVersion: TELEMETRY_EXPORT_SCHEMA_VERSION,
            exportGeneratedAt: new Date().toISOString(),
            exportRequestedWindowDays: phraseParams.windowDays,
            exportRequestedMinExposure: phraseParams.minExposure,
            exportRequestedLimit: phraseParams.channelLimit,
          }
        : { message: 'No phrase channel summary loaded' },
    [phraseChannelSummary, phraseParams.channelLimit, phraseParams.minExposure, phraseParams.windowDays]
  );
  const predictionPerformanceExportPayload = useMemo(
    () =>
      predictionPerformance
        ? {
            ...predictionPerformance,
            exportSchemaVersion: TELEMETRY_EXPORT_SCHEMA_VERSION,
            exportGeneratedAt: new Date().toISOString(),
            exportRequestedWindowDays: predictionFeedbackParams.windowDays,
          }
        : { message: 'No prediction performance loaded' },
    [predictionFeedbackParams.windowDays, predictionPerformance]
  );
  const predictionFeedbackHistoryExportPayload = useMemo(
    () =>
      predictionFeedbackHistory
        ? {
            ...predictionFeedbackHistory,
            exportSchemaVersion: TELEMETRY_EXPORT_SCHEMA_VERSION,
            exportGeneratedAt: new Date().toISOString(),
            exportRequestedWindowDays: predictionFeedbackParams.windowDays,
            exportRequestedLimit: predictionFeedbackParams.historyLimit,
          }
        : { message: 'No prediction feedback history loaded' },
    [
      predictionFeedbackHistory,
      predictionFeedbackParams.historyLimit,
      predictionFeedbackParams.windowDays,
    ]
  );

  const telemetryTrendData = useMemo(
    () =>
      (telemetrySummary?.trendByDay || []).map((entry) => ({
        date: entry.date,
        events: entry.events,
        errors: entry.errors,
        salesEvents: entry.salesIntelligenceEvents,
        orchestrationEvents: Number(entry.orchestrationEvents || 0),
      })),
    [telemetrySummary]
  );
  const orchestrationTrendTotal = useMemo(
    () =>
      telemetryTrendData.reduce(
        (acc, entry) => acc + Number(entry.orchestrationEvents || 0),
        0
      ),
    [telemetryTrendData]
  );
  const integrationHealthFreshnessRows = useMemo(
    () =>
      buildIntegrationHealthFreshnessRows(
        integrationsHealth?.credentialFreshnessByProvider || {}
      ),
    [integrationsHealth]
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
  const governanceStatusRows = useMemo(
    () => Object.entries(governanceReport?.governanceStatusCounts || {}).sort(([a], [b]) => a.localeCompare(b)),
    [governanceReport]
  );
  const governanceDecisionRows = useMemo(
    () => Object.entries(governanceReport?.traceabilityDecisionCounts || {}).sort(([a], [b]) => a.localeCompare(b)),
    [governanceReport]
  );
  const governanceTrendRows = useMemo(
    () => governanceReport?.timeline || [],
    [governanceReport]
  );
  const packetValidationStatusRows = useMemo(
    () => Object.entries(telemetrySummary?.packetValidationAudit?.statusCounts || {}).sort(([a], [b]) => a.localeCompare(b)),
    [telemetrySummary]
  );
  const governanceSchemaStatusRows = useMemo(
    () => Object.entries(telemetrySummary?.governanceSchemaAudit?.statusCounts || {}).sort(([a], [b]) => a.localeCompare(b)),
    [telemetrySummary]
  );
  const retryAuditOperationRows = useMemo(
    () => Object.entries(telemetrySummary?.retryAudit?.byOperation || {}).sort(([a], [b]) => a.localeCompare(b)),
    [telemetrySummary]
  );
  const retryAuditProviderRows = useMemo(
    () => Object.entries(telemetrySummary?.retryAudit?.byProvider || {}).sort(([a], [b]) => a.localeCompare(b)),
    [telemetrySummary]
  );
  const orchestrationAuditProviderRows = useMemo(
    () => Object.entries(telemetrySummary?.orchestrationAudit?.bySelectedProvider || {}).sort(([a], [b]) => a.localeCompare(b)),
    [telemetrySummary]
  );
  const orchestrationAuditReasonCodeRows = useMemo(
    () => Object.entries(telemetrySummary?.orchestrationAudit?.reasonCodeCounts || {}).sort(([a], [b]) => a.localeCompare(b)),
    [telemetrySummary]
  );
  const connectorRateLimitEndpointRows = useMemo(
    () => Object.entries(telemetrySummary?.connectorRateLimit?.byEndpoint || {}).sort(([a], [b]) => a.localeCompare(b)),
    [telemetrySummary]
  );
  const connectorValidationEndpointRows = useMemo(
    () => Object.entries(telemetrySummary?.connectorValidation?.byEndpoint || {}).sort(([a], [b]) => a.localeCompare(b)),
    [telemetrySummary]
  );
  const connectorValidationProviderRows = useMemo(
    () => Object.entries(telemetrySummary?.connectorValidation?.byProvider || {}).sort(([a], [b]) => a.localeCompare(b)),
    [telemetrySummary]
  );
  const connectorValidationFieldRows = useMemo(
    () => Object.entries(telemetrySummary?.connectorValidation?.byField || {}).sort(([a], [b]) => a.localeCompare(b)),
    [telemetrySummary]
  );
  const connectorValidationReasonRows = useMemo(
    () => Object.entries(telemetrySummary?.connectorValidation?.byReason || {}).sort(([a], [b]) => a.localeCompare(b)),
    [telemetrySummary]
  );
  const connectorRateLimitPressure = resolveConnectorRateLimitPressure(
    telemetrySummary?.connectorRateLimit?.maxRetryAfterSeconds,
    telemetrySummary?.connectorRateLimit?.avgResetInSeconds
  );
  const governanceSchemaAuditParityPassCount =
    telemetrySummary?.governanceSchemaAudit?.allParityPassedCount || 0;
  const governanceSchemaAuditParityFailCount =
    telemetrySummary?.governanceSchemaAudit?.allParityFailedCount || 0;
  const governanceSchemaAuditEventCount =
    telemetrySummary?.governanceSchemaAudit?.eventCount || 0;
  const governanceSchemaAuditParityUnknownEventCount = Math.max(
    governanceSchemaAuditEventCount
      - governanceSchemaAuditParityPassCount
      - governanceSchemaAuditParityFailCount,
    0
  );
  const governanceSchemaAuditParityStatus = governanceSchemaAuditParityFailCount > 0
    ? 'FAIL'
    : governanceSchemaAuditParityPassCount > 0
      ? 'PASS'
      : 'UNKNOWN';
  const governanceSchemaAuditParityToneClass =
    governanceSchemaAuditParityStatus === 'PASS'
      ? 'text-emerald-700'
      : governanceSchemaAuditParityStatus === 'FAIL'
        ? 'text-amber-700'
        : 'text-slate-600';
  const recentTelemetryRows = useMemo(
    () => (telemetrySummary?.recentEvents || []).map((row) => ({
      ...row,
      governanceStatus: normalizeTelemetryStatusToken(row.governanceStatus),
      governancePacketValidationStatus: normalizeTelemetryStatusToken(
        row.governancePacketValidationStatus
      ),
      retryFinalOutcome: normalizeRetryTerminalOutcomeToken(row.retryFinalOutcome),
      retryRetryable: typeof row.retryRetryable === 'boolean' ? row.retryRetryable : null,
      retryErrorType: normalizeRetryTerminalErrorType(row.retryErrorType),
      retryErrorStatusCode: normalizeRetryTerminalStatusCode(row.retryErrorStatusCode),
      retryErrorReasonCode: normalizeRetryTerminalReasonCode(row.retryErrorReasonCode),
    })),
    [telemetrySummary]
  );
  const telemetryRecentEventFilterProvenance = resolveRecentEventFilterProvenance({
    selectedFilter: recentTelemetryFilter,
    rawServerFilter: telemetrySummary?.recentEventsFilter,
  });
  const telemetryRecentEventsServerFilterRaw = telemetryRecentEventFilterProvenance.serverFilterRaw;
  const telemetryRecentEventsServerFilterRawTrimmed = telemetryRecentEventFilterProvenance.serverFilterRawTrimmed;
  const telemetryRecentEventsServerFilterBlank = telemetryRecentEventFilterProvenance.serverFilterBlank;
  const telemetryRecentEventsFilterEcho = telemetryRecentEventFilterProvenance.serverFilterEcho;
  const telemetryRecentEventsServerFilterUnsupported = telemetryRecentEventFilterProvenance.serverFilterUnsupported;
  const telemetryRecentEventsServerFilterEvaluation = telemetryRecentEventFilterProvenance.serverFilterEvaluation;
  const telemetryRecentEventsServerFilterNormalizationChanged =
    telemetryRecentEventFilterProvenance.serverFilterNormalizationChanged;
  const effectiveRecentTelemetryFilter = telemetryRecentEventFilterProvenance.effectiveFilter;
  const telemetryRecentEventsGovernanceStatusFilterEcho = normalizeTelemetryStatusToken(
    telemetrySummary?.recentEventsGovernanceStatusFilter
  );
  const telemetryRecentEventsPacketStatusFilterEcho = normalizeTelemetryStatusToken(
    telemetrySummary?.recentEventsPacketValidationStatusFilter
  );
  const selectedTelemetryGovernanceStatusFilterLabel =
    telemetryGovernanceStatusQueryFilter || TELEMETRY_STATUS_FILTER_ALL;
  const selectedTelemetryPacketStatusFilterLabel =
    telemetryPacketStatusQueryFilter || TELEMETRY_STATUS_FILTER_ALL;
  const serverTelemetryGovernanceStatusFilterLabel =
    telemetryRecentEventsGovernanceStatusFilterEcho || TELEMETRY_STATUS_FILTER_ALL;
  const serverTelemetryPacketStatusFilterLabel =
    telemetryRecentEventsPacketStatusFilterEcho || TELEMETRY_STATUS_FILTER_ALL;
  const effectiveRecentTelemetryGovernanceStatusFilter =
    telemetryRecentEventsGovernanceStatusFilterEcho || telemetryGovernanceStatusQueryFilter;
  const effectiveRecentTelemetryPacketStatusFilter =
    telemetryRecentEventsPacketStatusFilterEcho || telemetryPacketStatusQueryFilter;
  const telemetryRecentEventsGovernanceStatusFilterMismatch =
    telemetryRecentEventsGovernanceStatusFilterEcho !== telemetryGovernanceStatusQueryFilter;
  const telemetryRecentEventsPacketStatusFilterMismatch =
    telemetryRecentEventsPacketStatusFilterEcho !== telemetryPacketStatusQueryFilter;
  const filteredRecentTelemetryRows = useMemo(
    () => (
      effectiveRecentTelemetryFilter === 'packet'
        ? recentTelemetryRows.filter((row) => Boolean(row.governancePacketValidationStatus))
        : recentTelemetryRows
    ),
    [effectiveRecentTelemetryFilter, recentTelemetryRows]
  );
  const normalizedRecentTelemetryCounts = normalizeRecentEventCounts({
    totalCount: telemetrySummary?.recentEventsTotalCount,
    filteredCount: telemetrySummary?.recentEventsFilteredCount,
    rowCount: filteredRecentTelemetryRows.length,
    hasServerFilterEcho: Boolean(telemetryRecentEventsFilterEcho),
  });
  const recentTelemetryFilterSource = telemetryRecentEventFilterProvenance.filterSource;
  const recentTelemetryFilterMismatch = telemetryRecentEventFilterProvenance.filterMismatch;
  const recentTelemetryFilterResolution = telemetryRecentEventFilterProvenance.filterResolution;
  const recentTelemetryTotalCount = normalizedRecentTelemetryCounts.totalCount;
  const recentTelemetryFilteredCount = normalizedRecentTelemetryCounts.filteredCount;
  const fallbackPacketValidationCount = recentTelemetryRows.filter(
    (row) => Boolean(row.governancePacketValidationStatus)
      || typeof row.governancePacketValidationWithinFreshness === 'boolean'
  ).length;
  const normalizedRecentTelemetryPacketBreakdown = normalizeRecentEventPacketBreakdown({
    totalCount: recentTelemetryTotalCount,
    packetValidationCount: telemetrySummary?.recentEventsPacketValidationCount,
    nonPacketCount: telemetrySummary?.recentEventsNonPacketCount,
    fallbackPacketValidationCount,
  });
  const recentTelemetryPacketValidationCount =
    normalizedRecentTelemetryPacketBreakdown.packetValidationCount;
  const recentTelemetryNonPacketCount =
    normalizedRecentTelemetryPacketBreakdown.nonPacketCount;
  const recentTelemetryGovernanceStatusCountsFallback = buildTelemetryStatusCountMap(
    filteredRecentTelemetryRows.map((row) => row.governanceStatus)
  );
  const recentTelemetryPacketStatusCountsFallback = buildTelemetryStatusCountMap(
    filteredRecentTelemetryRows.map((row) => row.governancePacketValidationStatus)
  );
  const recentTelemetryGovernanceStatusCountsProvenance =
    resolveTelemetryStatusCountProvenanceWithMetadata(
      {
        statusCounts: telemetrySummary?.recentEventsGovernanceStatusCounts,
        statusCountsSource: telemetrySummary?.recentEventsGovernanceStatusCountsSource,
        statusCountsMismatch: telemetrySummary?.recentEventsGovernanceStatusCountsMismatch,
        statusCountsServer: telemetrySummary?.recentEventsGovernanceStatusCountsServer,
        statusCountsFallback: telemetrySummary?.recentEventsGovernanceStatusCountsFallback,
      },
      recentTelemetryGovernanceStatusCountsFallback
    );
  const recentTelemetryPacketStatusCountsProvenance =
    resolveTelemetryStatusCountProvenanceWithMetadata(
      {
        statusCounts: telemetrySummary?.recentEventsPacketValidationStatusCounts,
        statusCountsSource: telemetrySummary?.recentEventsPacketValidationStatusCountsSource,
        statusCountsMismatch: telemetrySummary?.recentEventsPacketValidationStatusCountsMismatch,
        statusCountsServer: telemetrySummary?.recentEventsPacketValidationStatusCountsServer,
        statusCountsFallback: telemetrySummary?.recentEventsPacketValidationStatusCountsFallback,
      },
      recentTelemetryPacketStatusCountsFallback
    );
  const recentTelemetryGovernanceStatusCounts =
    recentTelemetryGovernanceStatusCountsProvenance.effectiveCounts;
  const recentTelemetryPacketStatusCounts =
    recentTelemetryPacketStatusCountsProvenance.effectiveCounts;
  const recentTelemetryGovernanceStatusCountsSummary = formatTelemetryStatusCountMap(
    recentTelemetryGovernanceStatusCounts
  );
  const recentTelemetryPacketStatusCountsSummary = formatTelemetryStatusCountMap(
    recentTelemetryPacketStatusCounts
  );
  const recentTelemetryGovernanceStatusCountsServerSummary = formatTelemetryStatusCountMap(
    recentTelemetryGovernanceStatusCountsProvenance.serverCounts
  );
  const recentTelemetryGovernanceStatusCountsFallbackSummary = formatTelemetryStatusCountMap(
    recentTelemetryGovernanceStatusCountsProvenance.fallbackCounts
  );
  const recentTelemetryPacketStatusCountsServerSummary = formatTelemetryStatusCountMap(
    recentTelemetryPacketStatusCountsProvenance.serverCounts
  );
  const recentTelemetryPacketStatusCountsFallbackSummary = formatTelemetryStatusCountMap(
    recentTelemetryPacketStatusCountsProvenance.fallbackCounts
  );
  const recentTelemetryGovernanceStatusCountsPosture = resolveTelemetryStatusCountPosture(
    recentTelemetryGovernanceStatusCountsProvenance,
    {
      posture: telemetrySummary?.recentEventsGovernanceStatusCountsPosture,
      postureSeverity: telemetrySummary?.recentEventsGovernanceStatusCountsPostureSeverity,
      requiresInvestigation:
        telemetrySummary?.recentEventsGovernanceStatusCountsRequiresInvestigation,
    }
  );
  const recentTelemetryPacketStatusCountsPosture = resolveTelemetryStatusCountPosture(
    recentTelemetryPacketStatusCountsProvenance,
    {
      posture: telemetrySummary?.recentEventsPacketValidationStatusCountsPosture,
      postureSeverity:
        telemetrySummary?.recentEventsPacketValidationStatusCountsPostureSeverity,
      requiresInvestigation:
        telemetrySummary?.recentEventsPacketValidationStatusCountsRequiresInvestigation,
    }
  );
  const retryTerminalSummary = useMemo(
    () => buildRetryTerminalSummary(filteredRecentTelemetryRows),
    [filteredRecentTelemetryRows]
  );
  const retryTerminalOutcomeRows = useMemo(
    () => Object.entries(retryTerminalSummary.outcomeCounts).sort(([left], [right]) => left.localeCompare(right)),
    [retryTerminalSummary.outcomeCounts]
  );
  const retryTerminalReasonCodeRows = useMemo(
    () => Object.entries(retryTerminalSummary.reasonCodeCounts).sort(([left], [right]) => left.localeCompare(right)),
    [retryTerminalSummary.reasonCodeCounts]
  );
  const retryTerminalStatusCodeRows = useMemo(
    () => Object.entries(retryTerminalSummary.statusCodeCounts).sort(([left], [right]) => Number(left) - Number(right)),
    [retryTerminalSummary.statusCodeCounts]
  );
  const retryTerminalPressure = useMemo(
    () => resolveRetryTerminalPressure(retryTerminalSummary),
    [retryTerminalSummary]
  );
  const retryTerminalTopOutcome = useMemo(
    () => getRetryTerminalTopEntry(retryTerminalSummary.outcomeCounts),
    [retryTerminalSummary.outcomeCounts]
  );
  const retryTerminalTopReasonCode = useMemo(
    () => getRetryTerminalTopEntry(retryTerminalSummary.reasonCodeCounts),
    [retryTerminalSummary.reasonCodeCounts]
  );
  const retryTerminalTopStatusCode = useMemo(
    () => getRetryTerminalTopEntry(retryTerminalSummary.statusCodeCounts),
    [retryTerminalSummary.statusCodeCounts]
  );
  const governanceHistoryRows = useMemo(
    () => governanceReportHistory?.items || [],
    [governanceReportHistory]
  );
  const governanceHistorySchemaRows = useMemo(
    () => Object.entries(
      governanceReportHistory?.schemaVersionCounts
      || governanceHistoryRows.reduce<Record<string, number>>((acc, row) => {
        const key = String(row?.exportSchemaVersion ?? "unknown");
        acc[key] = Number(acc[key] || 0) + 1;
        return acc;
      }, {})
    ).sort(([a], [b]) => a.localeCompare(b)),
    [governanceHistoryRows, governanceReportHistory]
  );
  const governanceDuplicateArtifactNames = governanceReportHistory?.duplicateArtifactNames || [];
  const governanceSchemaSupportedVersions = governanceSchema?.schemaMetadata?.supportedVersions || [];
  const governanceSchemaAlerts = governanceSchema?.alerts || [];
  const governanceSchemaCommands = governanceSchema?.recommendedCommands || [];
  const governanceSchemaOverride = governanceSchema?.schemaMetadata?.override;
  const governanceSchemaContractParity = governanceSchema?.schemaContractParity;
  const governanceSchemaParityChecks = [
    {
      label: 'reason codes (top-level vs rollout actions)',
      value: governanceSchemaContractParity?.reasonCodeParity?.topLevelVsRolloutActions,
    },
    {
      label: 'reason codes (top-level vs export actions)',
      value: governanceSchemaContractParity?.reasonCodeParity?.topLevelVsExportActions,
    },
    {
      label: 'reason codes (top-level vs export alerts)',
      value: governanceSchemaContractParity?.reasonCodeParity?.topLevelVsExportAlerts,
    },
    {
      label: 'reason codes (top-level vs export reason codes)',
      value: governanceSchemaContractParity?.reasonCodeParity?.topLevelVsExportReasonCodes,
    },
    {
      label: 'recommended commands (top-level vs export)',
      value: governanceSchemaContractParity?.recommendedCommandParity?.topLevelVsExport,
    },
    {
      label: 'handoff rollout-blocked parity',
      value: governanceSchemaContractParity?.handoffParity?.rolloutBlockedMatchesExport,
    },
    {
      label: 'handoff owner-role parity',
      value: governanceSchemaContractParity?.handoffParity?.ownerRoleMatchesExport,
    },
    {
      label: 'handoff action parity',
      value: governanceSchemaContractParity?.handoffParity?.handoffActionsMatchRolloutActions,
    },
  ];
  const governanceSchemaParityFailedChecks = governanceSchemaParityChecks
    .filter((item) => item.value === false)
    .map((item) => item.label);
  const governanceSchemaParityUnknownCount = governanceSchemaParityChecks.filter(
    (item) => item.value == null
  ).length;
  const governanceSchemaParityAllPassed =
    governanceSchemaParityChecks.length > 0
    && governanceSchemaParityChecks.every((item) => item.value === true);
  const governanceSchemaParityStatus = governanceSchemaParityAllPassed
    ? 'PASS'
    : governanceSchemaParityFailedChecks.length > 0
      ? 'FAIL'
      : 'UNKNOWN';
  const governanceSchemaParityToneClass =
    governanceSchemaParityStatus === 'PASS'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : governanceSchemaParityStatus === 'FAIL'
        ? 'border-amber-200 bg-amber-50 text-amber-900'
        : 'border-slate-200 bg-slate-50 text-slate-700';
  const governancePostureStatus = governanceReportExport?.status || governanceReport?.status || 'UNKNOWN';
  const governancePostureSchemaVersion =
    governanceReportExport?.exportSchemaVersion
    ?? governanceReportExport?.governanceExport?.exportSchemaVersion
    ?? governanceReport?.exportSchemaVersion
    ?? governanceReport?.governanceExport?.exportSchemaVersion
    ?? governanceReportHistory?.exportSchemaVersion
    ?? governanceReportHistory?.governanceExport?.exportSchemaVersion
    ?? governanceReportHistory?.latestArtifact?.exportSchemaVersion
    ?? null;
  const governanceRolloutBlocked = Boolean(
    governanceReportExport?.governanceExport?.rolloutBlocked ?? governanceReport?.handoff?.rolloutBlocked ?? false
  );
  const governanceOwnerRole = governanceReportExport?.governanceExport?.ownerRole
    || governanceReport?.handoff?.ownerRole
    || 'Release Manager';
  const governancePostureAlert = governanceReportExport?.governanceExport?.alerts?.[0]?.message
    || governanceReport?.alerts?.[0]
    || '';
  const governanceConnectorRateLimit =
    governanceReportExport?.connectorRateLimit
    || governanceReportExport?.governanceExport?.connectorRateLimit
    || governanceReport?.connectorRateLimit
    || governanceReport?.governanceExport?.connectorRateLimit
    || governanceReportHistory?.connectorRateLimit
    || governanceReportHistory?.governanceExport?.connectorRateLimit
    || null;
  const governanceSendgridWebhookTimestamp =
    governanceReportExport?.sendgridWebhookTimestamp
    || governanceReportExport?.governanceExport?.sendgridWebhookTimestamp
    || governanceReport?.sendgridWebhookTimestamp
    || governanceReport?.governanceExport?.sendgridWebhookTimestamp
    || governanceReportHistory?.sendgridWebhookTimestamp
    || governanceReportHistory?.governanceExport?.sendgridWebhookTimestamp
    || null;
  const governanceRuntimePrereqs =
    governanceReportExport?.runtimePrereqs
    || governanceReportExport?.governanceExport?.runtimePrereqs
    || governanceReport?.runtimePrereqs
    || governanceReport?.governanceExport?.runtimePrereqs
    || governanceReportHistory?.runtimePrereqs
    || governanceReportHistory?.governanceExport?.runtimePrereqs
    || null;
  const governanceRuntimePrereqsGateLabel =
    governanceRuntimePrereqs?.passed == null
      ? 'n/a'
      : governanceRuntimePrereqs.passed
        ? 'PASS'
        : 'FAIL';
  const governanceRuntimePrereqsMissingCheckCount = Math.max(
    Number(governanceRuntimePrereqs?.missingCheckCount ?? 0),
    0
  );
  const governanceConnectorRateLimitRows = useMemo(
    () => Object.entries(governanceConnectorRateLimit?.byEndpoint || {}).sort(([a], [b]) => a.localeCompare(b)),
    [governanceConnectorRateLimit]
  );
  const governanceConnectorRateLimitPressure = resolveConnectorRateLimitPressure(
    governanceConnectorRateLimit?.maxRetryAfterSeconds,
    governanceConnectorRateLimit?.avgResetInSeconds
  );
  const governanceConnectorPressureParity =
    governanceReportExport?.connectorPressureParity
    || governanceReport?.connectorPressureParity
    || governanceReportHistory?.connectorPressureParity
    || null;
  const governanceSendgridWebhookTimestampParity =
    governanceReportExport?.sendgridWebhookTimestampParity
    || governanceReport?.sendgridWebhookTimestampParity
    || governanceReportHistory?.sendgridWebhookTimestampParity
    || null;
  const governanceParityWarnings: string[] = [];
  if (governanceConnectorPressureParity?.eventCountMatchesNested === false) {
    governanceParityWarnings.push('event-count mismatch between top-level and governance export connector rollups');
  }
  if (governanceConnectorPressureParity?.eventCountMatchesTotals === false) {
    governanceParityWarnings.push('connector totals mismatch between totals.connectorRateLimitEventCount and connectorRateLimit.eventCount');
  }
  if (governanceConnectorPressureParity?.byEndpointMatchesNested === false) {
    governanceParityWarnings.push('connector by-endpoint distribution mismatch between top-level and governance export payloads');
  }
  if (governanceConnectorPressureParity?.pressureLabelMatchesNested === false) {
    governanceParityWarnings.push('connector pressure label mismatch between top-level and governance export payloads');
  }
  if (governanceSendgridWebhookTimestampParity?.eventCountMatchesNested === false) {
    governanceParityWarnings.push('sendgrid timestamp event-count mismatch between top-level and governance export payloads');
  }
  if (governanceSendgridWebhookTimestampParity?.eventCountMatchesTotals === false) {
    governanceParityWarnings.push('sendgrid totals mismatch between totals.sendgridWebhookTimestampEventCount and sendgridWebhookTimestamp.eventCount');
  }
  if (governanceSendgridWebhookTimestampParity?.anomalyCountTotalMatchesNested === false) {
    governanceParityWarnings.push('sendgrid anomaly-count total mismatch between top-level and governance export payloads');
  }
  if (governanceSendgridWebhookTimestampParity?.pressureLabelCountsMatchNested === false) {
    governanceParityWarnings.push('sendgrid pressure-label distribution mismatch between top-level and governance export payloads');
  }
  if (governanceSendgridWebhookTimestampParity?.ageBucketCountsMatchNested === false) {
    governanceParityWarnings.push('sendgrid age-bucket distribution mismatch between top-level and governance export payloads');
  }
  const hasGovernanceParityWarning = governanceParityWarnings.length > 0;
  const governanceHandoffExportPayload = useMemo(() => {
    const sourcePayload = governanceReportExport || governanceReport?.governanceExport;
    if (!sourcePayload || typeof sourcePayload !== 'object') {
      return { message: 'No governance handoff export loaded' };
    }
    const topLevelConnector =
      governanceReportExport?.connectorRateLimit
      || governanceReport?.connectorRateLimit
      || governanceReportExport?.governanceExport?.connectorRateLimit
      || governanceReport?.governanceExport?.connectorRateLimit
      || null;
    const nestedConnector =
      governanceReportExport?.governanceExport?.connectorRateLimit
      || governanceReport?.governanceExport?.connectorRateLimit
      || null;
    const totalsConnectorRateLimitEventCount =
      governanceReportExport?.totals?.connectorRateLimitEventCount
      ?? governanceReport?.totals?.connectorRateLimitEventCount;
    const topLevelSendgridWebhookTimestamp =
      governanceReportExport?.sendgridWebhookTimestamp
      || governanceReport?.sendgridWebhookTimestamp
      || governanceReportExport?.governanceExport?.sendgridWebhookTimestamp
      || governanceReport?.governanceExport?.sendgridWebhookTimestamp
      || null;
    const nestedSendgridWebhookTimestamp =
      governanceReportExport?.governanceExport?.sendgridWebhookTimestamp
      || governanceReport?.governanceExport?.sendgridWebhookTimestamp
      || null;
    const totalsSendgridWebhookTimestampEventCount =
      governanceReportExport?.totals?.sendgridWebhookTimestampEventCount
      ?? governanceReport?.totals?.sendgridWebhookTimestampEventCount;
    const topLevelRuntimePrereqs =
      governanceReportExport?.runtimePrereqs
      || governanceReport?.runtimePrereqs
      || (sourcePayload as any)?.runtimePrereqs
      || null;
    const nestedRuntimePrereqs =
      governanceReportExport?.governanceExport?.runtimePrereqs
      || governanceReport?.governanceExport?.runtimePrereqs
      || (sourcePayload as any)?.governanceExport?.runtimePrereqs
      || null;
    const runtimePrereqsMetadata = buildGovernanceRuntimePrereqsMetadata(
      topLevelRuntimePrereqs,
      nestedRuntimePrereqs
    );
    return {
      ...(sourcePayload as Record<string, unknown>),
      ...runtimePrereqsMetadata,
      connectorPressureParity: buildConnectorPressureParityMetadata(
        topLevelConnector,
        nestedConnector,
        totalsConnectorRateLimitEventCount
      ),
      sendgridWebhookTimestampParity:
        (sourcePayload as any)?.sendgridWebhookTimestampParity
        || buildSendgridWebhookTimestampParityMetadata(
          topLevelSendgridWebhookTimestamp,
          nestedSendgridWebhookTimestamp,
          totalsSendgridWebhookTimestampEventCount
        ),
    };
  }, [governanceReport, governanceReportExport]);
  const governanceHistoryExportPayload = useMemo(() => {
    const sourcePayload = governanceReportHistory;
    if (!sourcePayload || typeof sourcePayload !== 'object') {
      return { message: 'No governance history loaded' };
    }
    const topLevelConnector =
      sourcePayload.connectorRateLimit
      || sourcePayload.governanceExport?.connectorRateLimit
      || null;
    const nestedConnector = sourcePayload.governanceExport?.connectorRateLimit || null;
    const totalsConnectorRateLimitEventCount =
      sourcePayload.totals?.connectorRateLimitEventCount;
    const topLevelSendgridWebhookTimestamp =
      sourcePayload.sendgridWebhookTimestamp
      || sourcePayload.governanceExport?.sendgridWebhookTimestamp
      || null;
    const nestedSendgridWebhookTimestamp =
      sourcePayload.governanceExport?.sendgridWebhookTimestamp || null;
    const totalsSendgridWebhookTimestampEventCount =
      sourcePayload.totals?.sendgridWebhookTimestampEventCount;
    const runtimePrereqsMetadata = buildGovernanceRuntimePrereqsMetadata(
      sourcePayload.runtimePrereqs || null,
      sourcePayload.governanceExport?.runtimePrereqs || null
    );
    return {
      ...(sourcePayload as Record<string, unknown>),
      ...runtimePrereqsMetadata,
      connectorPressureParity: buildConnectorPressureParityMetadata(
        topLevelConnector,
        nestedConnector,
        totalsConnectorRateLimitEventCount
      ),
      sendgridWebhookTimestampParity:
        (sourcePayload as any)?.sendgridWebhookTimestampParity
        || buildSendgridWebhookTimestampParityMetadata(
          topLevelSendgridWebhookTimestamp,
          nestedSendgridWebhookTimestamp,
          totalsSendgridWebhookTimestampEventCount
        ),
    };
  }, [governanceReportHistory]);

  const campaignFeatureDisabled = isFeatureDisabledError(campaignPortfolioError) || isFeatureDisabledError(campaignPerformanceError);
  const forecastFeatureDisabled = isFeatureDisabledError(pipelineForecastError);
  const predictionFeatureDisabled = isFeatureDisabledError(predictionReportError);
  const phraseFeatureDisabled =
    isFeatureDisabledError(phraseAnalyticsError) || isFeatureDisabledError(phraseChannelSummaryError);
  const predictionFeedbackFeatureDisabled =
    isFeatureDisabledError(predictionPerformanceError) || isFeatureDisabledError(predictionFeedbackHistoryError);
  const forecastConfidenceIntervalLow = Number(pipelineForecast?.confidenceInterval?.low || 0);
  const forecastConfidenceIntervalHigh = Number(pipelineForecast?.confidenceInterval?.high || 0);
  const forecastConfidenceIntervalWidth = Number.isFinite(Number(pipelineForecast?.confidenceIntervalWidth))
    ? Number(pipelineForecast?.confidenceIntervalWidth)
    : Math.max(forecastConfidenceIntervalHigh - forecastConfidenceIntervalLow, 0);
  const forecastConfidenceIntervalWidthPct = Number.isFinite(Number(pipelineForecast?.confidenceIntervalWidthPct))
    ? Number(pipelineForecast?.confidenceIntervalWidthPct)
    : Number(pipelineForecast?.projectedWonValue || 0) > 0
      ? (forecastConfidenceIntervalWidth / Number(pipelineForecast?.projectedWonValue || 1)) * 100
      : 0;
  const forecastReliabilityTier = String(
    pipelineForecast?.forecastReliabilityTier || (
      forecastConfidenceIntervalWidthPct >= 70
        ? 'low'
        : forecastConfidenceIntervalWidthPct >= 45
          ? 'medium'
          : 'high'
    )
  ).toUpperCase();
  const forecastExportPayload = useMemo(
    () => (
      pipelineForecast
        ? {
            ...pipelineForecast,
            confidenceIntervalWidth: Number(forecastConfidenceIntervalWidth.toFixed(2)),
            confidenceIntervalWidthPct: Number(forecastConfidenceIntervalWidthPct.toFixed(2)),
            forecastReliabilityTier: forecastReliabilityTier.toLowerCase(),
            exportSchemaVersion: TELEMETRY_EXPORT_SCHEMA_VERSION,
            exportGeneratedAt: new Date().toISOString(),
            exportRequestedWindowDays: forecastWindowDaysParam,
          }
        : { message: 'No pipeline forecast loaded' }
    ),
    [
      forecastWindowDaysParam,
      forecastConfidenceIntervalWidth,
      forecastConfidenceIntervalWidthPct,
      forecastReliabilityTier,
      pipelineForecast,
    ]
  );
  const predictionReportExportPayload = useMemo(
    () =>
      predictionReport
        ? {
            ...predictionReport,
            exportSchemaVersion: TELEMETRY_EXPORT_SCHEMA_VERSION,
            exportGeneratedAt: new Date().toISOString(),
            exportRequestedWindowDays: predictionReportWindowDaysParam,
          }
        : { message: 'No prediction report loaded' },
    [predictionReport, predictionReportWindowDaysParam]
  );
  const rolloutPlaybook = buildRolloutPlaybook(predictionReport?.rolloutDecision || '');

  const refreshCampaignPortfolio = () => {
    const parsedWindowDays = Number(campaignPortfolioWindowDaysInput);
    const parsedLimit = Number(campaignPortfolioLimitInput);
    const candidateWindowDays = Number.isFinite(parsedWindowDays) ? parsedWindowDays : 90;
    const candidateLimit = Number.isFinite(parsedLimit) ? parsedLimit : 10;
    const normalizedWindowDays = Math.min(Math.max(candidateWindowDays, 14), 365);
    const normalizedLimit = Math.min(Math.max(candidateLimit, 5), 100);
    const normalizedStatus = CAMPAIGN_PORTFOLIO_STATUS_OPTIONS.includes(campaignPortfolioStatusInput)
      ? campaignPortfolioStatusInput
      : 'all';
    setCampaignPortfolioWindowDaysInput(normalizedWindowDays);
    setCampaignPortfolioLimitInput(normalizedLimit);
    setCampaignPortfolioStatusInput(normalizedStatus);
    setCampaignPortfolioParams({
      windowDays: normalizedWindowDays,
      status: normalizedStatus,
      limit: normalizedLimit,
    });
    if (
      normalizedWindowDays !== campaignPortfolioWindowDaysInput
      || normalizedLimit !== campaignPortfolioLimitInput
      || normalizedStatus !== campaignPortfolioStatusInput
    ) {
      setUiNotice({ tone: 'info', message: 'Campaign portfolio filters were normalized to allowed bounds.' });
    }
  };

  const refreshCampaignPerformance = () => {
    const parsedChannelLimit = Number(campaignPerformanceChannelLimitInput);
    const candidateChannelLimit = Number.isFinite(parsedChannelLimit) ? parsedChannelLimit : 10;
    const normalizedChannelLimit = Math.min(Math.max(candidateChannelLimit, 1), 20);
    setCampaignPerformanceChannelLimitInput(normalizedChannelLimit);
    setCampaignPerformanceChannelLimitParam(normalizedChannelLimit);
    if (normalizedChannelLimit !== campaignPerformanceChannelLimitInput) {
      setUiNotice({ tone: 'info', message: 'Campaign performance channel limit was normalized to allowed bounds.' });
    }
  };

  const refreshForecastWindow = () => {
    const parsedWindowDays = Number(forecastWindowDaysInput);
    const candidateWindowDays = Number.isFinite(parsedWindowDays) ? parsedWindowDays : 90;
    const normalizedWindowDays = Math.min(Math.max(candidateWindowDays, 30), 365);
    setForecastWindowDaysInput(normalizedWindowDays);
    setForecastWindowDaysParam(normalizedWindowDays);
    if (normalizedWindowDays !== forecastWindowDaysInput) {
      setUiNotice({ tone: 'info', message: 'Forecast window was normalized to allowed bounds.' });
    }
  };

  const refreshPredictionReportWindow = () => {
    const parsedWindowDays = Number(predictionReportWindowDaysInput);
    const candidateWindowDays = Number.isFinite(parsedWindowDays) ? parsedWindowDays : 90;
    const normalizedWindowDays = Math.min(Math.max(candidateWindowDays, 14), 365);
    setPredictionReportWindowDaysInput(normalizedWindowDays);
    setPredictionReportWindowDaysParam(normalizedWindowDays);
    if (normalizedWindowDays !== predictionReportWindowDaysInput) {
      setUiNotice({ tone: 'info', message: 'Prediction report window was normalized to allowed bounds.' });
    }
  };

  const refreshConversationIntelligence = () => {
    const parsedWindowDays = Number(conversationWindowDaysInput);
    const parsedLimit = Number(conversationLimitInput);
    const candidateWindowDays = Number.isFinite(parsedWindowDays) ? parsedWindowDays : 90;
    const candidateLimit = Number.isFinite(parsedLimit) ? parsedLimit : 300;
    const normalizedWindowDays = Math.min(Math.max(candidateWindowDays, 14), 365);
    const normalizedLimit = Math.min(Math.max(candidateLimit, 20), 1000);
    setConversationWindowDaysInput(normalizedWindowDays);
    setConversationWindowDaysParam(normalizedWindowDays);
    setConversationLimitInput(normalizedLimit);
    setConversationLimitParam(normalizedLimit);
    if (normalizedWindowDays !== conversationWindowDaysInput || normalizedLimit !== conversationLimitInput) {
      setUiNotice({ tone: 'info', message: 'Conversation intelligence filters were normalized to allowed bounds.' });
    }
  };

  const refreshMultiChannelEngagement = () => {
    const parsedWindowDays = Number(multiChannelWindowDaysInput);
    const parsedCampaignLimit = Number(multiChannelCampaignLimitInput);
    const parsedAbTestLimit = Number(multiChannelAbTestLimitInput);
    const parsedProspectLimit = Number(multiChannelProspectLimitInput);
    const candidateWindowDays = Number.isFinite(parsedWindowDays) ? parsedWindowDays : 90;
    const candidateCampaignLimit = Number.isFinite(parsedCampaignLimit) ? parsedCampaignLimit : 1000;
    const candidateAbTestLimit = Number.isFinite(parsedAbTestLimit) ? parsedAbTestLimit : 2000;
    const candidateProspectLimit = Number.isFinite(parsedProspectLimit) ? parsedProspectLimit : 5000;
    const normalizedWindowDays = Math.min(Math.max(candidateWindowDays, 14), 365);
    const normalizedCampaignLimit = Math.min(Math.max(candidateCampaignLimit, 10), 5000);
    const normalizedAbTestLimit = Math.min(Math.max(candidateAbTestLimit, 10), 10000);
    const normalizedProspectLimit = Math.min(Math.max(candidateProspectLimit, 50), 20000);
    setMultiChannelWindowDaysInput(normalizedWindowDays);
    setMultiChannelWindowDaysParam(normalizedWindowDays);
    setMultiChannelCampaignLimitInput(normalizedCampaignLimit);
    setMultiChannelCampaignLimitParam(normalizedCampaignLimit);
    setMultiChannelAbTestLimitInput(normalizedAbTestLimit);
    setMultiChannelAbTestLimitParam(normalizedAbTestLimit);
    setMultiChannelProspectLimitInput(normalizedProspectLimit);
    setMultiChannelProspectLimitParam(normalizedProspectLimit);
    if (
      normalizedWindowDays !== multiChannelWindowDaysInput
      || normalizedCampaignLimit !== multiChannelCampaignLimitInput
      || normalizedAbTestLimit !== multiChannelAbTestLimitInput
      || normalizedProspectLimit !== multiChannelProspectLimitInput
    ) {
      setUiNotice({ tone: 'info', message: 'Multi-channel controls were normalized to allowed bounds.' });
    }
  };

  const refreshRelationshipMap = () => {
    const parsedWindowDays = Number(relationshipWindowDaysInput);
    const parsedLimit = Number(relationshipLimitInput);
    const candidateWindowDays = Number.isFinite(parsedWindowDays) ? parsedWindowDays : 90;
    const candidateLimit = Number.isFinite(parsedLimit) ? parsedLimit : 250;
    const normalizedWindowDays = Math.min(Math.max(candidateWindowDays, 14), 365);
    const normalizedLimit = Math.min(Math.max(candidateLimit, 50), 1000);
    setRelationshipWindowDaysInput(normalizedWindowDays);
    setRelationshipWindowDaysParam(normalizedWindowDays);
    setRelationshipLimitInput(normalizedLimit);
    setRelationshipLimitParam(normalizedLimit);
    if (normalizedWindowDays !== relationshipWindowDaysInput || normalizedLimit !== relationshipLimitInput) {
      setUiNotice({ tone: 'info', message: 'Relationship map controls were normalized to allowed bounds.' });
    }
  };

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

  const refreshPhraseIntelligence = () => {
    const parsedWindowDays = Number(phraseWindowDaysInput);
    const parsedMinExposure = Number(phraseMinExposureInput);
    const parsedLimit = Number(phraseLimitInput);
    const parsedChannelLimit = Number(phraseChannelLimitInput);
    const candidateWindowDays = Number.isFinite(parsedWindowDays) ? parsedWindowDays : 90;
    const candidateMinExposure = Number.isFinite(parsedMinExposure) ? parsedMinExposure : 2;
    const candidateLimit = Number.isFinite(parsedLimit) ? parsedLimit : 8;
    const candidateChannelLimit = Number.isFinite(parsedChannelLimit) ? parsedChannelLimit : 5;
    const normalizedWindowDays = Math.min(Math.max(candidateWindowDays, 14), 365);
    const normalizedMinExposure = Math.min(Math.max(candidateMinExposure, 1), 50);
    const normalizedLimit = Math.min(Math.max(candidateLimit, 5), 100);
    const normalizedChannelLimit = Math.min(Math.max(candidateChannelLimit, 3), 30);
    setPhraseWindowDaysInput(normalizedWindowDays);
    setPhraseMinExposureInput(normalizedMinExposure);
    setPhraseLimitInput(normalizedLimit);
    setPhraseChannelLimitInput(normalizedChannelLimit);
    setPhraseParams({
      windowDays: normalizedWindowDays,
      minExposure: normalizedMinExposure,
      limit: normalizedLimit,
      channelLimit: normalizedChannelLimit,
    });
    if (
      normalizedWindowDays !== phraseWindowDaysInput
      || normalizedMinExposure !== phraseMinExposureInput
      || normalizedLimit !== phraseLimitInput
      || normalizedChannelLimit !== phraseChannelLimitInput
    ) {
      setUiNotice({ tone: 'info', message: 'Phrase intelligence filters were normalized to allowed bounds.' });
    }
  };

  const refreshPredictionFeedback = () => {
    const parsedWindowDays = Number(predictionFeedbackWindowDaysInput);
    const parsedHistoryLimit = Number(predictionFeedbackLimitInput);
    const candidateWindowDays = Number.isFinite(parsedWindowDays) ? parsedWindowDays : 90;
    const candidateHistoryLimit = Number.isFinite(parsedHistoryLimit) ? parsedHistoryLimit : 25;
    const normalizedWindowDays = Math.min(Math.max(candidateWindowDays, 14), 365);
    const normalizedHistoryLimit = Math.min(Math.max(candidateHistoryLimit, 10), 500);
    setPredictionFeedbackWindowDaysInput(normalizedWindowDays);
    setPredictionFeedbackLimitInput(normalizedHistoryLimit);
    setPredictionFeedbackParams({
      windowDays: normalizedWindowDays,
      historyLimit: normalizedHistoryLimit,
    });
    if (
      normalizedWindowDays !== predictionFeedbackWindowDaysInput
      || normalizedHistoryLimit !== predictionFeedbackLimitInput
    ) {
      setUiNotice({ tone: 'info', message: 'Prediction feedback filters were normalized to allowed bounds.' });
    }
  };

  const refreshGovernanceHistory = () => {
    const parsedDays = Number(governanceHistoryDaysInput);
    const parsedLimit = Number(governanceHistoryLimitInput);
    const candidateDays = Number.isFinite(parsedDays) ? parsedDays : 30;
    const candidateLimit = Number.isFinite(parsedLimit) ? parsedLimit : 20;
    const normalizedDays = Math.min(Math.max(candidateDays, 1), 365);
    const normalizedLimit = Math.min(Math.max(candidateLimit, 1), 500);
    setGovernanceHistoryDaysInput(normalizedDays);
    setGovernanceHistoryLimitInput(normalizedLimit);
    setGovernanceHistoryParams({ retentionDays: normalizedDays, limit: normalizedLimit });
    if (normalizedDays !== governanceHistoryDaysInput || normalizedLimit !== governanceHistoryLimitInput) {
      setUiNotice({ tone: 'info', message: 'Governance history filter values were normalized to allowed bounds.' });
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

  const downloadTextSnapshot = (filePrefix: string, text: string) => {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${filePrefix}-${timestamp}.txt`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      return true;
    } catch (_error) {
      return false;
    }
  };

  const copyGovernanceHistoryCommands = async () => {
    const commands = (governanceReportHistory?.recommendedCommands || [])
      .filter((command) => typeof command === 'string' && command.trim().length > 0)
      .slice(0, 10);

    if (commands.length === 0) {
      setUiNotice({ tone: 'info', message: 'No governance history commands available to copy.' });
      return;
    }

    const payload = commands.join('\n');
    const clipboard = (navigator as Navigator & { clipboard?: { writeText?: (text: string) => Promise<void> } }).clipboard;
    if (clipboard?.writeText) {
      try {
        await clipboard.writeText(payload);
        setUiNotice({ tone: 'success', message: 'Governance history commands copied.' });
        return;
      } catch (_error) {
        // Fall through to download fallback.
      }
    }

    const downloaded = downloadTextSnapshot('sales-governance-history-commands', payload);
    if (downloaded) {
      setUiNotice({ tone: 'info', message: 'Clipboard unavailable. Governance history commands downloaded.' });
      return;
    }
    setUiNotice({ tone: 'error', message: 'Unable to copy governance history commands.' });
  };

  const copyGovernanceSchemaCommands = async () => {
    const commands = (governanceSchema?.recommendedCommands || [])
      .filter((command) => typeof command === 'string' && command.trim().length > 0)
      .slice(0, 10);

    if (commands.length === 0) {
      setUiNotice({ tone: 'info', message: 'No governance schema commands available to copy.' });
      return;
    }

    const payload = commands.join('\n');
    const clipboard = (navigator as Navigator & { clipboard?: { writeText?: (text: string) => Promise<void> } }).clipboard;
    if (clipboard?.writeText) {
      try {
        await clipboard.writeText(payload);
        setUiNotice({ tone: 'success', message: 'Governance schema commands copied.' });
        return;
      } catch (_error) {
        // Fall through to download fallback.
      }
    }

    const downloaded = downloadTextSnapshot('sales-governance-schema-commands', payload);
    if (downloaded) {
      setUiNotice({ tone: 'info', message: 'Clipboard unavailable. Governance schema commands downloaded.' });
      return;
    }
    setUiNotice({ tone: 'error', message: 'Unable to copy governance schema commands.' });
  };

  const collectBaselineGovernanceCommands = (
    payload: IntegrationsBaselineGovernanceResponse | undefined
  ): string[] => {
    const remediationWrapperCommand = 'npm run verify:smoke:baseline-orchestration-remediation';
    const baselineDriftCommand = 'npm run verify:smoke:baseline-governance-drift';
    const baselineAliasArtifactChain = [
      'npm run verify:baseline:command-aliases:artifact',
      'npm run verify:baseline:command-aliases:artifact:contract',
      'npm run verify:smoke:baseline-command-aliases-artifact',
    ];
    const legacyOrchestrationChain = new Set([
      'npm run verify:smoke:orchestration-slo-gate',
      'npm run verify:baseline:metrics',
      baselineDriftCommand,
    ]);
    const ordered: string[] = [];
    const addCommand = (value: unknown) => {
      const normalized = typeof value === 'string' ? value.trim() : '';
      if (!normalized || ordered.includes(normalized)) {
        return;
      }
      ordered.push(normalized);
    };
    const ensureAliasArtifactChainAfterWrapper = () => {
      if (!ordered.includes(remediationWrapperCommand)) {
        return;
      }
      const withoutAliasChain = ordered.filter(
        (command) => !baselineAliasArtifactChain.includes(command)
      );
      const wrapperIndex = withoutAliasChain.indexOf(remediationWrapperCommand);
      if (wrapperIndex < 0) {
        ordered.length = 0;
        ordered.push(...withoutAliasChain);
        return;
      }
      withoutAliasChain.splice(wrapperIndex + 1, 0, ...baselineAliasArtifactChain);
      ordered.length = 0;
      ordered.push(...withoutAliasChain);
    };

    for (const command of payload?.recommendedCommands || []) {
      addCommand(command);
    }
    if (ordered.includes(remediationWrapperCommand)) {
      const normalized = ordered.filter(
        (command) => command === remediationWrapperCommand || !legacyOrchestrationChain.has(command)
      );
      ordered.length = 0;
      ordered.push(...normalized);
      ensureAliasArtifactChainAfterWrapper();
    }

    const hasOrchestrationRemediation =
      !!payload?.orchestrationGate
      && (
        payload.orchestrationGate.available !== true
        || payload.orchestrationGate.attemptErrorGatePassed !== true
        || payload.orchestrationGate.attemptSkippedGatePassed !== true
      );
    if (!ordered.length && hasOrchestrationRemediation) {
      addCommand(remediationWrapperCommand);
      ensureAliasArtifactChainAfterWrapper();
    }
    if (!ordered.length && payload?.status && payload.status !== 'PASS') {
      addCommand(baselineDriftCommand);
    }

    const hasWrapper = ordered.includes(remediationWrapperCommand);
    for (const item of payload?.rolloutActions || []) {
      if (!item || typeof item !== 'object') continue;
      const candidate = typeof item.command === 'string' ? item.command.trim() : '';
      if (!candidate) continue;
      if (hasWrapper && legacyOrchestrationChain.has(candidate)) continue;
      addCommand(candidate);
    }

    if (!ordered.includes(remediationWrapperCommand)) {
      const hasFullLegacyChain = Array.from(legacyOrchestrationChain).every((command) =>
        ordered.includes(command)
      );
      if (hasFullLegacyChain) {
        const collapsed = ordered.filter((command) => !legacyOrchestrationChain.has(command));
        collapsed.unshift(remediationWrapperCommand);
        const wrapperIndex = collapsed.indexOf(remediationWrapperCommand);
        if (wrapperIndex >= 0) {
          collapsed.splice(wrapperIndex + 1, 0, ...baselineAliasArtifactChain);
        }
        return collapsed;
      }
    }

    ensureAliasArtifactChainAfterWrapper();
    return ordered;
  };

  const copyBaselineGovernanceCommands = async () => {
    const commands = collectBaselineGovernanceCommands(baselineGovernance).slice(0, 10);
    if (commands.length === 0) {
      setUiNotice({ tone: 'info', message: 'No baseline governance commands available to copy.' });
      return;
    }

    const payload = commands.join('\n');
    const clipboard = (navigator as Navigator & { clipboard?: { writeText?: (text: string) => Promise<void> } }).clipboard;
    if (clipboard?.writeText) {
      try {
        await clipboard.writeText(payload);
        setUiNotice({ tone: 'success', message: 'Baseline governance commands copied.' });
        return;
      } catch (_error) {
        // Fall through to download fallback.
      }
    }

    const downloaded = downloadTextSnapshot('sales-baseline-governance-commands', payload);
    if (downloaded) {
      setUiNotice({ tone: 'info', message: 'Clipboard unavailable. Baseline governance commands downloaded.' });
      return;
    }
    setUiNotice({ tone: 'error', message: 'Unable to copy baseline governance commands.' });
  };

  const baselineRecommendedCommands = (baselineGovernance?.recommendedCommands || []).filter(
    (command) => typeof command === 'string' && command.trim().length > 0
  );
  const baselineUsesFallbackCommandChain = Boolean(
    baselineGovernance
    && baselineGovernance.status !== 'PASS'
    && baselineRecommendedCommands.length === 0
  );
  const integrationHealthExportMetadata = useMemo(
    () => buildIntegrationHealthExportMetadata(integrationsHealth),
    [integrationsHealth]
  );
  const integrationHealthFreshnessStatusCountsSummary = formatTelemetryStatusCountMap(
    integrationHealthExportMetadata.exportIntegrationHealthCredentialFreshnessStatusCounts
  );
  const integrationHealthFreshnessStatusCountsServerSummary = formatTelemetryStatusCountMap(
    integrationHealthExportMetadata.exportIntegrationHealthCredentialFreshnessStatusCountsServer
  );
  const integrationHealthFreshnessStatusCountsFallbackSummary = formatTelemetryStatusCountMap(
    integrationHealthExportMetadata.exportIntegrationHealthCredentialFreshnessStatusCountsFallback
  );

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

      {(campaignFeatureDisabled || predictionFeatureDisabled || phraseFeatureDisabled || predictionFeedbackFeatureDisabled) && (
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
            <div className="grid gap-3 md:grid-cols-4 md:items-end">
              <label className="text-xs text-gray-600" htmlFor="sales-portfolio-window-days-input">
                Window Days
                <input
                  id="sales-portfolio-window-days-input"
                  data-testid="sales-portfolio-window-days-input"
                  type="number"
                  min={14}
                  max={365}
                  value={campaignPortfolioWindowDaysInput}
                  onChange={(e) => setCampaignPortfolioWindowDaysInput(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
                />
              </label>
              <label className="text-xs text-gray-600" htmlFor="sales-portfolio-status-select">
                Status
                <select
                  id="sales-portfolio-status-select"
                  data-testid="sales-portfolio-status-select"
                  value={campaignPortfolioStatusInput}
                  onChange={(e) => setCampaignPortfolioStatusInput(e.target.value as CampaignPortfolioStatus)}
                  className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
                >
                  {CAMPAIGN_PORTFOLIO_STATUS_OPTIONS.map((status) => (
                    <option key={`sales-portfolio-status-${status}`} value={status}>
                      {status.toUpperCase()}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-gray-600" htmlFor="sales-portfolio-limit-input">
                Campaign Limit
                <input
                  id="sales-portfolio-limit-input"
                  data-testid="sales-portfolio-limit-input"
                  type="number"
                  min={5}
                  max={100}
                  value={campaignPortfolioLimitInput}
                  onChange={(e) => setCampaignPortfolioLimitInput(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
                />
              </label>
              <button
                type="button"
                data-testid="sales-portfolio-refresh-btn"
                onClick={refreshCampaignPortfolio}
                className="rounded-md border px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
              >
                Refresh Portfolio
              </button>
            </div>
            <div className="text-xs text-gray-500">
              Applied portfolio filters: Window {campaignPortfolioParams.windowDays} days • Status {campaignPortfolioParams.status.toUpperCase()} • Limit {campaignPortfolioParams.limit} • Server status filter {campaignPortfolioServerStatusFilter.toUpperCase()}.
            </div>
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
            <div className="grid gap-3 md:grid-cols-[140px_auto] md:items-end">
              <label className="text-xs text-gray-600" htmlFor="sales-campaign-performance-channel-limit-input">
                Channel Limit
                <input
                  id="sales-campaign-performance-channel-limit-input"
                  data-testid="sales-campaign-performance-channel-limit-input"
                  type="number"
                  min={1}
                  max={20}
                  value={campaignPerformanceChannelLimitInput}
                  onChange={(e) => setCampaignPerformanceChannelLimitInput(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
                />
              </label>
              <button
                type="button"
                data-testid="sales-campaign-performance-refresh-btn"
                onClick={refreshCampaignPerformance}
                className="rounded-md border px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
              >
                Refresh Campaign Performance
              </button>
            </div>
            <div className="text-xs text-gray-500">
              Campaign channels: Showing {Number(campaignPerformance?.displayedChannelCount || channelChartData.length)} of {Number(campaignPerformance?.channelCount || channelChartData.length)} channels • Applied channel limit {campaignPerformanceChannelLimitParam}.
            </div>

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
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                data-testid="sales-campaign-portfolio-export-btn"
                onClick={() => downloadJsonSnapshot('sales-campaign-portfolio', campaignPortfolioExportPayload)}
                className="rounded-md border px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
              >
                Export Campaign Portfolio JSON
              </button>
              <button
                type="button"
                data-testid="sales-campaign-performance-export-btn"
                onClick={() => downloadJsonSnapshot('sales-campaign-performance', campaignPerformanceExportPayload)}
                className="rounded-md border px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
              >
                Export Campaign Performance JSON
              </button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Pipeline Forecast</CardTitle>
              <CardDescription>Projected pipeline outcomes with confidence-band reliability.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="grid gap-2 md:grid-cols-[140px_auto] md:items-end">
                <label className="text-xs text-gray-600" htmlFor="sales-forecast-window-days-input">
                  Window Days
                  <input
                    id="sales-forecast-window-days-input"
                    data-testid="sales-forecast-window-days-input"
                    type="number"
                    min={30}
                    max={365}
                    value={forecastWindowDaysInput}
                    onChange={(e) => setForecastWindowDaysInput(Number(e.target.value))}
                    className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
                  />
                </label>
                <button
                  type="button"
                  data-testid="sales-forecast-refresh-btn"
                  onClick={refreshForecastWindow}
                  className="rounded-md border px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
                >
                  Refresh Forecast
                </button>
              </div>
              {isPipelineForecastLoading && <div className="text-gray-500">Loading pipeline forecast...</div>}
              {!forecastFeatureDisabled && pipelineForecastError && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-red-700">
                  {getErrorMessage(pipelineForecastError)}
                </div>
              )}
              {pipelineForecast && (
                <>
                  <div className="flex items-center justify-between">
                    <span>Window</span>
                    <span className="font-semibold">{pipelineForecast.windowDays || 90} days</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Open Pipeline</span>
                    <span className="font-semibold">{formatCurrency(pipelineForecast.openPipelineValue)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Weighted Pipeline</span>
                    <span className="font-semibold">{formatCurrency(pipelineForecast.weightedPipelineValue)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Projected Won</span>
                    <span className="font-semibold">{formatCurrency(pipelineForecast.projectedWonValue)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Historical Win Rate</span>
                    <span className="font-semibold">{Number(pipelineForecast.historicalWinRate || 0).toFixed(1)}%</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>95% Confidence Band</span>
                    <span className="font-semibold">
                      {formatCurrency(forecastConfidenceIntervalLow)} - {formatCurrency(forecastConfidenceIntervalHigh)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Interval Width</span>
                    <span className="font-semibold">
                      {formatCurrency(forecastConfidenceIntervalWidth)} ({forecastConfidenceIntervalWidthPct.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Reliability Tier</span>
                    <span className="font-semibold">{forecastReliabilityTier}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Open / Closed Samples</span>
                    <span className="font-semibold">
                      {pipelineForecast.sampleSize?.openProspects || 0} / {pipelineForecast.sampleSize?.closedOutcomes || 0}
                    </span>
                  </div>
                  {pipelineForecast.forecastRecommendation && (
                    <div className="mt-2 rounded-md border bg-gray-50 p-3 text-gray-700">
                      {pipelineForecast.forecastRecommendation}
                    </div>
                  )}
                  <div className="text-xs text-gray-500">
                    Generated: {formatTimestamp(pipelineForecast.generatedAt)}
                  </div>
                  <div className="text-xs text-gray-500">
                    Applied Window: {forecastWindowDaysParam} days
                  </div>
                </>
              )}
              <div className="pt-2">
                <button
                  type="button"
                  data-testid="sales-forecast-export-btn"
                  onClick={() => downloadJsonSnapshot('sales-pipeline-forecast', forecastExportPayload)}
                  className="rounded-md border px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                >
                  Export Forecast JSON
                </button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Prediction Quality</CardTitle>
              <CardDescription>Current response prediction calibration posture.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="grid gap-2 md:grid-cols-[140px_auto] md:items-end">
                <label className="text-xs text-gray-600" htmlFor="sales-prediction-window-days-input">
                  Window Days
                  <input
                    id="sales-prediction-window-days-input"
                    data-testid="sales-prediction-window-days-input"
                    type="number"
                    min={14}
                    max={365}
                    value={predictionReportWindowDaysInput}
                    onChange={(e) => setPredictionReportWindowDaysInput(Number(e.target.value))}
                    className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
                  />
                </label>
                <button
                  type="button"
                  data-testid="sales-prediction-refresh-btn"
                  onClick={refreshPredictionReportWindow}
                  className="rounded-md border px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
                >
                  Refresh Prediction Quality
                </button>
              </div>
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
                  <div className="text-xs text-gray-500">
                    Applied Window: {predictionReportWindowDaysParam} days
                  </div>
                </>
              )}
              <div className="pt-2">
                <button
                  type="button"
                  data-testid="sales-prediction-export-btn"
                  onClick={() => downloadJsonSnapshot('sales-prediction-report', predictionReportExportPayload)}
                  className="rounded-md border px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                >
                  Export Prediction JSON
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Conversation Intelligence</CardTitle>
            <CardDescription>Sentiment, objection, and source health posture.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="grid gap-2 md:grid-cols-[140px_140px_auto] md:items-end">
              <label className="text-xs text-gray-600" htmlFor="sales-conversation-window-days-input">
                Window Days
                <input
                  id="sales-conversation-window-days-input"
                  data-testid="sales-conversation-window-days-input"
                  type="number"
                  min={14}
                  max={365}
                  value={conversationWindowDaysInput}
                  onChange={(e) => setConversationWindowDaysInput(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
                />
              </label>
              <label className="text-xs text-gray-600" htmlFor="sales-conversation-limit-input">
                Event Limit
                <input
                  id="sales-conversation-limit-input"
                  data-testid="sales-conversation-limit-input"
                  type="number"
                  min={20}
                  max={1000}
                  value={conversationLimitInput}
                  onChange={(e) => setConversationLimitInput(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
                />
              </label>
              <button
                type="button"
                data-testid="sales-conversation-refresh-btn"
                onClick={refreshConversationIntelligence}
                className="rounded-md border px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
              >
                Refresh Conversation
              </button>
            </div>
            {isConversationIntelligenceLoading && (
              <div className="text-gray-500">Loading conversation intelligence...</div>
            )}
            {conversationIntelligenceError && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-red-700">
                {getErrorMessage(conversationIntelligenceError)}
              </div>
            )}
            {conversationIntelligence && (
              <>
                <div className="flex items-center justify-between">
                  <span>Records</span>
                  <span className="font-semibold">{conversationIntelligence.totals?.records || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Relationship Health</span>
                  <span className={`font-semibold ${relationshipHealthToneClass}`}>{relationshipHealthLabel}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Chat / Email Sources</span>
                  <span className="font-semibold">
                    {conversationIntelligence.sources?.chatSessions || 0} / {conversationIntelligence.sources?.emailEvents || 0}
                  </span>
                </div>
                <div className="rounded-md border bg-gray-50 p-2">
                  <div className="text-xs font-medium text-gray-700">Sentiment</div>
                  {conversationSentimentRows.length > 0 ? (
                    <ul className="mt-1 space-y-1">
                      {conversationSentimentRows.map(([label, count]) => (
                        <li key={`sales-conversation-sentiment-${label}`} className="flex items-center justify-between text-xs text-gray-700">
                          <span>{label}</span>
                          <span>{count}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="mt-1 text-xs text-gray-500">No sentiment signals available.</div>
                  )}
                </div>
                <div className="rounded-md border bg-gray-50 p-2">
                  <div className="text-xs font-medium text-gray-700">Top Objections</div>
                  {conversationTopObjections.length > 0 ? (
                    <ul className="mt-1 space-y-1">
                      {conversationTopObjections.map((entry, index) => (
                        <li key={`sales-conversation-objection-${entry.type || 'unknown'}-${index}`} className="flex items-center justify-between text-xs text-gray-700">
                          <span>{entry.type || 'unknown'}</span>
                          <span>{entry.count || 0}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="mt-1 text-xs text-gray-500">No objection trends identified.</div>
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  Generated: {formatTimestamp(conversationIntelligence.generatedAt)}
                </div>
                <div className="text-xs text-gray-500">
                  Applied Window: {conversationWindowDaysParam} days • Limit: {conversationLimitParam}
                </div>
              </>
            )}
            <div className="pt-2">
              <button
                type="button"
                data-testid="sales-conversation-export-btn"
                onClick={() => downloadJsonSnapshot('sales-conversation-intelligence', conversationExportPayload)}
                className="rounded-md border px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
              >
                Export Conversation JSON
              </button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Multi-Channel Health</CardTitle>
            <CardDescription>Channel coverage and activation recommendations.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="grid gap-2 md:grid-cols-[120px_120px_120px_140px_auto] md:items-end">
              <label className="text-xs text-gray-600" htmlFor="sales-multi-channel-window-days-input">
                Window Days
                <input
                  id="sales-multi-channel-window-days-input"
                  data-testid="sales-multi-channel-window-days-input"
                  type="number"
                  min={14}
                  max={365}
                  value={multiChannelWindowDaysInput}
                  onChange={(e) => setMultiChannelWindowDaysInput(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
                />
              </label>
              <label className="text-xs text-gray-600" htmlFor="sales-multi-channel-campaign-limit-input">
                Campaign Limit
                <input
                  id="sales-multi-channel-campaign-limit-input"
                  data-testid="sales-multi-channel-campaign-limit-input"
                  type="number"
                  min={10}
                  max={5000}
                  value={multiChannelCampaignLimitInput}
                  onChange={(e) => setMultiChannelCampaignLimitInput(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
                />
              </label>
              <label className="text-xs text-gray-600" htmlFor="sales-multi-channel-ab-test-limit-input">
                A/B Test Limit
                <input
                  id="sales-multi-channel-ab-test-limit-input"
                  data-testid="sales-multi-channel-ab-test-limit-input"
                  type="number"
                  min={10}
                  max={10000}
                  value={multiChannelAbTestLimitInput}
                  onChange={(e) => setMultiChannelAbTestLimitInput(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
                />
              </label>
              <label className="text-xs text-gray-600" htmlFor="sales-multi-channel-prospect-limit-input">
                Prospect Limit
                <input
                  id="sales-multi-channel-prospect-limit-input"
                  data-testid="sales-multi-channel-prospect-limit-input"
                  type="number"
                  min={50}
                  max={20000}
                  value={multiChannelProspectLimitInput}
                  onChange={(e) => setMultiChannelProspectLimitInput(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
                />
              </label>
              <button
                type="button"
                data-testid="sales-multi-channel-refresh-btn"
                onClick={refreshMultiChannelEngagement}
                className="rounded-md border px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
              >
                Refresh Multi-Channel
              </button>
            </div>
            {isMultiChannelEngagementLoading && (
              <div className="text-gray-500">Loading multi-channel health...</div>
            )}
            {multiChannelEngagementError && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-red-700">
                {getErrorMessage(multiChannelEngagementError)}
              </div>
            )}
            {multiChannelEngagement && (
              <>
                <div className="flex items-center justify-between">
                  <span>Coverage Score</span>
                  <span className="font-semibold">{Number(multiChannelEngagement.coverageScore || 0).toFixed(1)}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Active Channels</span>
                  <span className="font-semibold">{(multiChannelEngagement.activeChannels || []).length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Coverage Tier</span>
                  <span className="font-semibold">
                    {String(multiChannelEngagement.coverageReliabilityTier || 'unknown').toUpperCase()}
                  </span>
                </div>
                <div className="rounded-md border bg-gray-50 p-2">
                  <div className="text-xs font-medium text-gray-700">Channel Usage</div>
                  {multiChannelUsageRows.length > 0 ? (
                    <ul className="mt-1 space-y-1">
                      {multiChannelUsageRows.map(([label, count]) => (
                        <li key={`sales-multi-channel-usage-${label}`} className="flex items-center justify-between text-xs text-gray-700">
                          <span>{label}</span>
                          <span>{count}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="mt-1 text-xs text-gray-500">No channel activity in current window.</div>
                  )}
                </div>
                <div className="rounded-md border bg-gray-50 p-2">
                  <div className="text-xs font-medium text-gray-700">Recommendations</div>
                  {(multiChannelEngagement.recommendations || []).length > 0 ? (
                    <ul className="mt-1 list-disc pl-4 text-xs text-gray-700">
                      {(multiChannelEngagement.recommendations || []).map((item) => (
                        <li key={`sales-multi-channel-rec-${item}`}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <div className="mt-1 text-xs text-gray-500">No recommendations.</div>
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  Generated: {formatTimestamp(multiChannelEngagement.generatedAt)}
                </div>
                <div className="text-xs text-gray-500">
                  Applied Window: {multiChannelAppliedLimits.windowDays} days • campaigns {multiChannelAppliedLimits.campaigns} • A/B tests {multiChannelAppliedLimits.abTests} • prospects {multiChannelAppliedLimits.prospects}
                </div>
                <div className="text-xs text-gray-500">
                  Source Counts: campaigns {multiChannelEngagement.sourceCounts?.campaigns ?? 0} • A/B tests {multiChannelEngagement.sourceCounts?.abTests ?? 0} • prospects {multiChannelEngagement.sourceCounts?.prospects ?? 0}
                </div>
                <div className="text-xs text-gray-500">
                  Coverage Recommendation: {multiChannelEngagement.coverageRecommendation || 'No recommendation provided.'}
                </div>
              </>
            )}
            <div className="pt-2">
              <button
                type="button"
                data-testid="sales-multi-channel-export-btn"
                onClick={() => downloadJsonSnapshot('sales-multi-channel-health', multiChannelExportPayload)}
                className="rounded-md border px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
              >
                Export Multi-Channel JSON
              </button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Relationship Map Summary</CardTitle>
            <CardDescription>Network coverage and relationship strength posture.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="grid gap-2 md:grid-cols-[120px_140px_auto] md:items-end">
              <label className="text-xs text-gray-600" htmlFor="sales-relationship-window-days-input">
                Window Days
                <input
                  id="sales-relationship-window-days-input"
                  data-testid="sales-relationship-window-days-input"
                  type="number"
                  min={14}
                  max={365}
                  value={relationshipWindowDaysInput}
                  onChange={(e) => setRelationshipWindowDaysInput(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
                />
              </label>
              <label className="text-xs text-gray-600" htmlFor="sales-relationship-limit-input">
                Entity Limit
                <input
                  id="sales-relationship-limit-input"
                  data-testid="sales-relationship-limit-input"
                  type="number"
                  min={50}
                  max={1000}
                  value={relationshipLimitInput}
                  onChange={(e) => setRelationshipLimitInput(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
                />
              </label>
              <button
                type="button"
                data-testid="sales-relationship-refresh-btn"
                onClick={refreshRelationshipMap}
                className="rounded-md border px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
              >
                Refresh Relationship Map
              </button>
            </div>
            {isRelationshipMapLoading && (
              <div className="text-gray-500">Loading relationship map...</div>
            )}
            {relationshipMapError && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-red-700">
                {getErrorMessage(relationshipMapError)}
              </div>
            )}
            {relationshipMap && (
              <>
                <div className="flex items-center justify-between">
                  <span>Prospects</span>
                  <span className="font-semibold">{relationshipMap.stats?.prospects || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Companies</span>
                  <span className="font-semibold">{relationshipMap.stats?.companies || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Connections</span>
                  <span className="font-semibold">{relationshipMap.stats?.connections || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Avg Relationship Strength</span>
                  <span className="font-semibold">{Number(relationshipMap.stats?.averageRelationshipStrength || 0).toFixed(1)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Node / Edge Count</span>
                  <span className="font-semibold">
                    {(relationshipMap.nodes || []).length} / {(relationshipMap.edges || []).length}
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  Generated: {formatTimestamp(relationshipMap.generatedAt)}
                </div>
                <div className="text-xs text-gray-500">
                  Applied Window: {relationshipAppliedWindowDays} days • Limit: {relationshipLimitParam}
                </div>
                <div className="text-xs text-gray-500">
                  Source Counts: prospects {relationshipMap.sourceCounts?.prospects ?? 0} • companies {relationshipMap.sourceCounts?.companies ?? 0}
                </div>
              </>
            )}
            <div className="pt-2">
              <button
                type="button"
                data-testid="sales-relationship-map-export-btn"
                onClick={() => downloadJsonSnapshot('sales-relationship-map', relationshipMapExportPayload)}
                className="rounded-md border px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
              >
                Export Relationship JSON
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Phrase Effectiveness</CardTitle>
            <CardDescription>Top-performing sales phrases for the current analytics window.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="grid gap-2 md:grid-cols-[130px_130px_130px_130px_auto] md:items-end">
              <label className="text-xs text-gray-600" htmlFor="sales-phrase-window-days-input">
                Window Days
                <input
                  id="sales-phrase-window-days-input"
                  data-testid="sales-phrase-window-days-input"
                  type="number"
                  min={14}
                  max={365}
                  value={phraseWindowDaysInput}
                  onChange={(e) => setPhraseWindowDaysInput(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
                />
              </label>
              <label className="text-xs text-gray-600" htmlFor="sales-phrase-min-exposure-input">
                Min Exposure
                <input
                  id="sales-phrase-min-exposure-input"
                  data-testid="sales-phrase-min-exposure-input"
                  type="number"
                  min={1}
                  max={50}
                  value={phraseMinExposureInput}
                  onChange={(e) => setPhraseMinExposureInput(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
                />
              </label>
              <label className="text-xs text-gray-600" htmlFor="sales-phrase-limit-input">
                Phrase Limit
                <input
                  id="sales-phrase-limit-input"
                  data-testid="sales-phrase-limit-input"
                  type="number"
                  min={5}
                  max={100}
                  value={phraseLimitInput}
                  onChange={(e) => setPhraseLimitInput(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
                />
              </label>
              <label className="text-xs text-gray-600" htmlFor="sales-phrase-channel-limit-input">
                Channel Limit
                <input
                  id="sales-phrase-channel-limit-input"
                  data-testid="sales-phrase-channel-limit-input"
                  type="number"
                  min={3}
                  max={30}
                  value={phraseChannelLimitInput}
                  onChange={(e) => setPhraseChannelLimitInput(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
                />
              </label>
              <button
                type="button"
                data-testid="sales-phrase-refresh-btn"
                onClick={refreshPhraseIntelligence}
                className="rounded-md border px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
              >
                Refresh Phrase Intelligence
              </button>
            </div>
            {isPhraseAnalyticsLoading && <div className="text-gray-500">Loading phrase effectiveness...</div>}
            {!phraseFeatureDisabled && phraseAnalyticsError && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-red-700">
                {getErrorMessage(phraseAnalyticsError)}
              </div>
            )}
            {phraseAnalytics && (
              <>
                <div className="flex items-center justify-between">
                  <span>Tracked Phrases</span>
                  <span className="font-semibold">{phraseAnalytics.summary?.trackedPhrases || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Candidate Phrases</span>
                  <span className="font-semibold">{phraseAnalytics.summary?.candidatePhraseCount || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Total Records</span>
                  <span className="font-semibold">{phraseAnalytics.totalRecords || 0}</span>
                </div>
                <div className="rounded-md border bg-gray-50 p-2">
                  <div className="text-xs font-medium text-gray-700">Top Phrases</div>
                  {phraseAnalyticsRows.length > 0 ? (
                    <ul className="mt-1 space-y-1">
                      {phraseAnalyticsRows.map((entry, index) => (
                        <li
                          key={`sales-phrase-effectiveness-${entry.phrase || 'unknown'}-${index}`}
                          className="text-xs text-gray-700"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate">{entry.phrase || 'unknown phrase'}</span>
                            <span>{Number(entry.effectivenessScore || 0).toFixed(2)}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="mt-1 text-xs text-gray-500">No phrase analytics data in current window.</div>
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  Generated: {formatTimestamp(phraseAnalytics.generatedAt)}
                </div>
                <div className="text-xs text-gray-500">
                  Window: {phraseParams.windowDays} days • Min Exposure: {phraseParams.minExposure} • Phrase Limit: {phraseParams.limit}
                </div>
              </>
            )}
            <div className="pt-2">
              <button
                type="button"
                data-testid="sales-phrase-analytics-export-btn"
                onClick={() => downloadJsonSnapshot('sales-phrase-analytics', phraseAnalyticsExportPayload)}
                className="rounded-md border px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
              >
                Export Phrase Analytics JSON
              </button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Phrase Channel Summary</CardTitle>
            <CardDescription>Channel-level phrase signal coverage and top phrase visibility.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {isPhraseChannelSummaryLoading && <div className="text-gray-500">Loading phrase channel summary...</div>}
            {!phraseFeatureDisabled && phraseChannelSummaryError && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-red-700">
                {getErrorMessage(phraseChannelSummaryError)}
              </div>
            )}
            {phraseChannelSummary && (
              <>
                <div className="flex items-center justify-between">
                  <span>Channels</span>
                  <span className="font-semibold">{phraseChannelSummary.channelCount || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Total Records</span>
                  <span className="font-semibold">{phraseChannelSummary.totalRecords || 0}</span>
                </div>
                <div className="rounded-md border bg-gray-50 p-2">
                  <div className="text-xs font-medium text-gray-700">Channel Highlights</div>
                  {phraseChannelRows.length > 0 ? (
                    <ul className="mt-1 space-y-1">
                      {phraseChannelRows.map((entry, index) => (
                        <li
                          key={`sales-phrase-channel-${entry.channel || 'unknown'}-${index}`}
                          className="flex items-center justify-between text-xs text-gray-700"
                        >
                          <span>{entry.channel || 'unknown'}</span>
                          <span>{entry.trackedPhrases || 0} tracked</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="mt-1 text-xs text-gray-500">No channel phrase summary available.</div>
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  Generated: {formatTimestamp(phraseChannelSummary.generatedAt)}
                </div>
                <div className="text-xs text-gray-500">
                  Window: {phraseParams.windowDays} days • Min Exposure: {phraseParams.minExposure} • Channel Limit: {phraseParams.channelLimit}
                </div>
              </>
            )}
            <div className="pt-2">
              <button
                type="button"
                data-testid="sales-phrase-channel-summary-export-btn"
                onClick={() => downloadJsonSnapshot('sales-phrase-channel-summary', phraseChannelSummaryExportPayload)}
                className="rounded-md border px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
              >
                Export Phrase Channel JSON
              </button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Prediction Feedback Performance</CardTitle>
            <CardDescription>Calibration and channel-level prediction feedback quality metrics.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="grid gap-2 md:grid-cols-[140px_140px_auto] md:items-end">
              <label className="text-xs text-gray-600" htmlFor="sales-prediction-feedback-window-days-input">
                Window Days
                <input
                  id="sales-prediction-feedback-window-days-input"
                  data-testid="sales-prediction-feedback-window-days-input"
                  type="number"
                  min={14}
                  max={365}
                  value={predictionFeedbackWindowDaysInput}
                  onChange={(e) => setPredictionFeedbackWindowDaysInput(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
                />
              </label>
              <label className="text-xs text-gray-600" htmlFor="sales-prediction-feedback-limit-input">
                History Limit
                <input
                  id="sales-prediction-feedback-limit-input"
                  data-testid="sales-prediction-feedback-limit-input"
                  type="number"
                  min={10}
                  max={500}
                  value={predictionFeedbackLimitInput}
                  onChange={(e) => setPredictionFeedbackLimitInput(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
                />
              </label>
              <button
                type="button"
                data-testid="sales-prediction-feedback-refresh-btn"
                onClick={refreshPredictionFeedback}
                className="rounded-md border px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
              >
                Refresh Prediction Feedback
              </button>
            </div>
            {isPredictionPerformanceLoading && <div className="text-gray-500">Loading prediction feedback performance...</div>}
            {!predictionFeedbackFeatureDisabled && predictionPerformanceError && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-red-700">
                {getErrorMessage(predictionPerformanceError)}
              </div>
            )}
            {predictionPerformance && (
              <>
                <div className="flex items-center justify-between">
                  <span>Sample Size</span>
                  <span className="font-semibold">{predictionPerformance.sampleSize || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Positive Rate</span>
                  <span className="font-semibold">
                    {(Number(predictionPerformance.positiveRate || 0) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Avg Predicted Probability</span>
                  <span className="font-semibold">
                    {(Number(predictionPerformance.averagePredictedProbability || 0) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>MAE</span>
                  <span className="font-semibold">
                    {Number(predictionPerformance.meanAbsoluteCalibrationError || 0).toFixed(3)}
                  </span>
                </div>
                <div className="rounded-md border bg-gray-50 p-2">
                  <div className="text-xs font-medium text-gray-700">By Channel</div>
                  {predictionPerformanceChannelRows.length > 0 ? (
                    <ul className="mt-1 space-y-1">
                      {predictionPerformanceChannelRows.map(([channel, metrics]) => (
                        <li
                          key={`sales-prediction-performance-channel-${channel}`}
                          className="flex items-center justify-between text-xs text-gray-700"
                        >
                          <span>{channel}</span>
                          <span>{metrics.sampleSize || 0} samples</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="mt-1 text-xs text-gray-500">No channel-level performance data available.</div>
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  Generated: {formatTimestamp(predictionPerformance.generatedAt)}
                </div>
                <div className="text-xs text-gray-500">
                  Window: {predictionFeedbackParams.windowDays} days
                </div>
              </>
            )}
            <div className="pt-2">
              <button
                type="button"
                data-testid="sales-prediction-performance-export-btn"
                onClick={() => downloadJsonSnapshot('sales-prediction-performance', predictionPerformanceExportPayload)}
                className="rounded-md border px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
              >
                Export Prediction Performance JSON
              </button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Prediction Feedback History</CardTitle>
            <CardDescription>Recent prediction outcomes captured for calibration auditing.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {isPredictionFeedbackHistoryLoading && <div className="text-gray-500">Loading prediction feedback history...</div>}
            {!predictionFeedbackFeatureDisabled && predictionFeedbackHistoryError && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-red-700">
                {getErrorMessage(predictionFeedbackHistoryError)}
              </div>
            )}
            {predictionFeedbackHistory && (
              <>
                <div className="flex items-center justify-between">
                  <span>Records</span>
                  <span className="font-semibold">{predictionFeedbackHistory.count || 0}</span>
                </div>
                <div className="rounded-md border bg-gray-50 p-2">
                  <div className="text-xs font-medium text-gray-700">Recent Outcomes</div>
                  {predictionFeedbackHistoryRows.length > 0 ? (
                    <ul className="mt-1 space-y-1">
                      {predictionFeedbackHistoryRows.map((entry, index) => (
                        <li
                          key={`sales-prediction-feedback-history-${entry.id || index}`}
                          className="text-xs text-gray-700"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span>{String(entry.outcome || 'unknown').toUpperCase()}</span>
                            <span>{entry.channel || 'email'}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="mt-1 text-xs text-gray-500">No prediction feedback history in current window.</div>
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  Generated: {formatTimestamp(predictionFeedbackHistory.generatedAt)}
                </div>
                <div className="text-xs text-gray-500">
                  Window: {predictionFeedbackParams.windowDays} days • Limit: {predictionFeedbackParams.historyLimit}
                </div>
              </>
            )}
            <div className="pt-2">
              <button
                type="button"
                data-testid="sales-prediction-feedback-history-export-btn"
                onClick={() =>
                  downloadJsonSnapshot('sales-prediction-feedback-history', predictionFeedbackHistoryExportPayload)
                }
                className="rounded-md border px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
              >
                Export Prediction Feedback History JSON
              </button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Telemetry Trend (Daily)</CardTitle>
          <CardDescription>Daily event, error, sales-intelligence, and orchestration activity trends.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[140px_160px_180px_180px_auto_auto] md:items-end">
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
            <label className="text-xs text-gray-600" htmlFor="sales-telemetry-governance-status-select">
              Governance Status
              <select
                id="sales-telemetry-governance-status-select"
                data-testid="sales-telemetry-governance-status-select"
                value={recentTelemetryGovernanceStatusFilter}
                onChange={(e) =>
                  setRecentTelemetryGovernanceStatusFilter(
                    e.target.value as (typeof TELEMETRY_GOVERNANCE_STATUS_FILTER_OPTIONS)[number]
                  )
                }
                className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
              >
                {TELEMETRY_GOVERNANCE_STATUS_FILTER_OPTIONS.map((option) => (
                  <option key={`sales-governance-status-${option}`} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-gray-600" htmlFor="sales-telemetry-packet-status-select">
              Packet Status
              <select
                id="sales-telemetry-packet-status-select"
                data-testid="sales-telemetry-packet-status-select"
                value={recentTelemetryPacketStatusFilter}
                onChange={(e) =>
                  setRecentTelemetryPacketStatusFilter(
                    e.target.value as (typeof TELEMETRY_PACKET_STATUS_FILTER_OPTIONS)[number]
                  )
                }
                className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
              >
                {TELEMETRY_PACKET_STATUS_FILTER_OPTIONS.map((option) => (
                  <option key={`sales-packet-status-${option}`} value={option}>
                    {option}
                  </option>
                ))}
              </select>
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
              onClick={() =>
                downloadJsonSnapshot(
                  'sales-telemetry-summary',
                  telemetrySummary
                    ? {
                        ...telemetrySummary,
                        recentEvents: recentTelemetryRows,
                        exportSchemaVersion: TELEMETRY_EXPORT_SCHEMA_VERSION,
                        exportRequestedWindowDays: telemetryParams.days,
                        exportRequestedLimit: telemetryParams.limit,
                        ...integrationHealthExportMetadata,
                        exportRecentEventsFilter: effectiveRecentTelemetryFilter,
                        exportRecentEventsSelectedFilter: recentTelemetryFilter,
                        exportRecentEventsServerFilter: telemetryRecentEventsFilterEcho,
                        exportRecentEventsServerFilterRaw: telemetryRecentEventsServerFilterRaw,
                        exportRecentEventsServerFilterRawTrimmed: telemetryRecentEventsServerFilterRawTrimmed,
                        exportRecentEventsServerFilterBlank: telemetryRecentEventsServerFilterBlank,
                        exportRecentEventsServerFilterUnsupported: telemetryRecentEventsServerFilterUnsupported,
                        exportRecentEventsServerFilterEvaluation: telemetryRecentEventsServerFilterEvaluation,
                        exportRecentEventsServerFilterNormalizationChanged: telemetryRecentEventsServerFilterNormalizationChanged,
                        exportRecentEventsFilterMismatch: recentTelemetryFilterMismatch,
                        exportRecentEventsFilterSource: recentTelemetryFilterSource,
                        exportRecentEventsFilterResolution: recentTelemetryFilterResolution,
                        exportRecentEventsGovernanceStatusFilter: effectiveRecentTelemetryGovernanceStatusFilter,
                        exportRecentEventsGovernanceStatusFilterSelected: selectedTelemetryGovernanceStatusFilterLabel,
                        exportRecentEventsGovernanceStatusFilterServer: telemetryRecentEventsGovernanceStatusFilterEcho,
                        exportRecentEventsGovernanceStatusFilterMismatch: telemetryRecentEventsGovernanceStatusFilterMismatch,
                        exportRecentEventsPacketValidationStatusFilter: effectiveRecentTelemetryPacketStatusFilter,
                        exportRecentEventsPacketValidationStatusFilterSelected: selectedTelemetryPacketStatusFilterLabel,
                        exportRecentEventsPacketValidationStatusFilterServer: telemetryRecentEventsPacketStatusFilterEcho,
                        exportRecentEventsPacketValidationStatusFilterMismatch: telemetryRecentEventsPacketStatusFilterMismatch,
                        exportRecentEventsDisplayedCount: recentTelemetryFilteredCount,
                        exportRecentEventsTotalCount: recentTelemetryTotalCount,
                        exportRecentEventsPacketValidationCount: recentTelemetryPacketValidationCount,
                        exportRecentEventsNonPacketCount: recentTelemetryNonPacketCount,
                        exportRecentEventsGovernanceStatusCounts: recentTelemetryGovernanceStatusCounts,
                        exportRecentEventsPacketValidationStatusCounts: recentTelemetryPacketStatusCounts,
                        exportRecentEventsGovernanceStatusCountsSource: recentTelemetryGovernanceStatusCountsProvenance.source,
                        exportRecentEventsPacketValidationStatusCountsSource: recentTelemetryPacketStatusCountsProvenance.source,
                        exportRecentEventsGovernanceStatusCountsMismatch: recentTelemetryGovernanceStatusCountsProvenance.mismatch,
                        exportRecentEventsPacketValidationStatusCountsMismatch: recentTelemetryPacketStatusCountsProvenance.mismatch,
                        exportRecentEventsGovernanceStatusCountsServer: recentTelemetryGovernanceStatusCountsProvenance.serverCounts,
                        exportRecentEventsPacketValidationStatusCountsServer: recentTelemetryPacketStatusCountsProvenance.serverCounts,
                        exportRecentEventsGovernanceStatusCountsFallback: recentTelemetryGovernanceStatusCountsProvenance.fallbackCounts,
                        exportRecentEventsPacketValidationStatusCountsFallback: recentTelemetryPacketStatusCountsProvenance.fallbackCounts,
                        exportRecentEventsGovernanceStatusCountsPosture: recentTelemetryGovernanceStatusCountsPosture.posture,
                        exportRecentEventsPacketValidationStatusCountsPosture: recentTelemetryPacketStatusCountsPosture.posture,
                        exportRecentEventsGovernanceStatusCountsPostureSeverity: recentTelemetryGovernanceStatusCountsPosture.severity,
                        exportRecentEventsPacketValidationStatusCountsPostureSeverity: recentTelemetryPacketStatusCountsPosture.severity,
                        exportRecentEventsGovernanceStatusCountsRequiresInvestigation: recentTelemetryGovernanceStatusCountsPosture.requiresInvestigation,
                        exportRecentEventsPacketValidationStatusCountsRequiresInvestigation: recentTelemetryPacketStatusCountsPosture.requiresInvestigation,
                        exportConnectorRateLimitPressureLabel: connectorRateLimitPressure.label,
                        exportConnectorRateLimitPressureHint: connectorRateLimitPressure.hint,
                        exportConnectorRateLimitPressureSignalSeconds: connectorRateLimitPressure.signalSeconds,
                        exportConnectorRateLimitEventCount: telemetrySummary.connectorRateLimit?.eventCount ?? 0,
                        exportConnectorRateLimitLatestEventAt: telemetrySummary.connectorRateLimit?.latestEventAt ?? null,
                        exportConnectorValidationEventCount: telemetrySummary.connectorValidation?.eventCount ?? 0,
                        exportConnectorValidationLatestEventAt: telemetrySummary.connectorValidation?.latestEventAt ?? null,
                        exportConnectorValidationEndpointCount: Object.keys(telemetrySummary.connectorValidation?.byEndpoint || {}).length,
                        exportConnectorValidationProviderCount: Object.keys(telemetrySummary.connectorValidation?.byProvider || {}).length,
                        exportConnectorValidationFieldCount: Object.keys(telemetrySummary.connectorValidation?.byField || {}).length,
                        exportConnectorValidationReasonCount: Object.keys(telemetrySummary.connectorValidation?.byReason || {}).length,
                        exportRetryAuditEventCount: telemetrySummary.retryAudit?.eventCount ?? 0,
                        exportRetryAuditLatestEventAt: telemetrySummary.retryAudit?.latestEventAt ?? null,
                        exportRetryAuditMaxNextDelaySeconds: telemetrySummary.retryAudit?.maxNextDelaySeconds ?? null,
                        exportRetryAuditAvgNextDelaySeconds: telemetrySummary.retryAudit?.avgNextDelaySeconds ?? null,
                        exportRetryAuditOperationCount: Object.keys(telemetrySummary.retryAudit?.byOperation || {}).length,
                        exportRetryAuditProviderCount: Object.keys(telemetrySummary.retryAudit?.byProvider || {}).length,
                        exportRetryTerminalEventCount: retryTerminalSummary.eventCount,
                        exportRetryTerminalOutcomeCounts: retryTerminalSummary.outcomeCounts,
                        exportRetryTerminalRetryabilityCounts: retryTerminalSummary.retryabilityCounts,
                        exportRetryTerminalErrorTypeCounts: retryTerminalSummary.errorTypeCounts,
                        exportRetryTerminalReasonCodeCounts: retryTerminalSummary.reasonCodeCounts,
                        exportRetryTerminalStatusCodeCounts: retryTerminalSummary.statusCodeCounts,
                        exportRetryTerminalPressureLabel: retryTerminalPressure.label,
                        exportRetryTerminalPressureHint: retryTerminalPressure.hint,
                        exportRetryTerminalPressureSignalCount: retryTerminalPressure.signalCount,
                        exportRetryTerminalTopOutcome: retryTerminalTopOutcome,
                        exportRetryTerminalTopReasonCode: retryTerminalTopReasonCode,
                        exportRetryTerminalTopStatusCode: retryTerminalTopStatusCode,
                        exportOrchestrationAuditEventCount: telemetrySummary.orchestrationAudit?.eventCount ?? 0,
                        exportOrchestrationAuditLatestEventAt: telemetrySummary.orchestrationAudit?.latestEventAt ?? null,
                        exportOrchestrationAuditMaxAttemptCount: telemetrySummary.orchestrationAudit?.maxAttemptCount ?? null,
                        exportOrchestrationAuditAvgAttemptCount: telemetrySummary.orchestrationAudit?.avgAttemptCount ?? null,
                        exportOrchestrationAuditProviderCount: Object.keys(telemetrySummary.orchestrationAudit?.bySelectedProvider || {}).length,
                        exportOrchestrationAuditReasonCodeCount: Object.keys(telemetrySummary.orchestrationAudit?.reasonCodeCounts || {}).length,
                        exportOrchestrationTrendDayCount: (telemetrySummary.orchestrationAudit?.trendByDay || []).length,
                        exportOrchestrationTrendEventCount: (telemetrySummary.orchestrationAudit?.trendByDay || []).reduce(
                          (acc, row) => acc + Number(row?.events || 0),
                          0
                        ),
                        exportOrchestrationTrendAttemptErrorCount: (telemetrySummary.orchestrationAudit?.trendByDay || []).reduce(
                          (acc, row) => acc + Number(row?.attemptErrorCount || 0),
                          0
                        ),
                        exportOrchestrationTrendAttemptSkippedCount: (telemetrySummary.orchestrationAudit?.trendByDay || []).reduce(
                          (acc, row) => acc + Number(row?.attemptSkippedCount || 0),
                          0
                        ),
                      }
                    : {
                        message: 'No telemetry summary loaded',
                        exportSchemaVersion: TELEMETRY_EXPORT_SCHEMA_VERSION,
                        exportRequestedWindowDays: telemetryParams.days,
                        exportRequestedLimit: telemetryParams.limit,
                        ...integrationHealthExportMetadata,
                        exportRecentEventsFilter: effectiveRecentTelemetryFilter,
                        exportRecentEventsSelectedFilter: recentTelemetryFilter,
                        exportRecentEventsServerFilter: telemetryRecentEventsFilterEcho,
                        exportRecentEventsServerFilterRaw: telemetryRecentEventsServerFilterRaw,
                        exportRecentEventsServerFilterRawTrimmed: telemetryRecentEventsServerFilterRawTrimmed,
                        exportRecentEventsServerFilterBlank: telemetryRecentEventsServerFilterBlank,
                        exportRecentEventsServerFilterUnsupported: telemetryRecentEventsServerFilterUnsupported,
                        exportRecentEventsServerFilterEvaluation: telemetryRecentEventsServerFilterEvaluation,
                        exportRecentEventsServerFilterNormalizationChanged: telemetryRecentEventsServerFilterNormalizationChanged,
                        exportRecentEventsFilterMismatch: recentTelemetryFilterMismatch,
                        exportRecentEventsFilterSource: recentTelemetryFilterSource,
                        exportRecentEventsFilterResolution: recentTelemetryFilterResolution,
                        exportRecentEventsGovernanceStatusFilter: effectiveRecentTelemetryGovernanceStatusFilter,
                        exportRecentEventsGovernanceStatusFilterSelected: selectedTelemetryGovernanceStatusFilterLabel,
                        exportRecentEventsGovernanceStatusFilterServer: telemetryRecentEventsGovernanceStatusFilterEcho,
                        exportRecentEventsGovernanceStatusFilterMismatch: telemetryRecentEventsGovernanceStatusFilterMismatch,
                        exportRecentEventsPacketValidationStatusFilter: effectiveRecentTelemetryPacketStatusFilter,
                        exportRecentEventsPacketValidationStatusFilterSelected: selectedTelemetryPacketStatusFilterLabel,
                        exportRecentEventsPacketValidationStatusFilterServer: telemetryRecentEventsPacketStatusFilterEcho,
                        exportRecentEventsPacketValidationStatusFilterMismatch: telemetryRecentEventsPacketStatusFilterMismatch,
                        exportRecentEventsDisplayedCount: recentTelemetryFilteredCount,
                        exportRecentEventsTotalCount: recentTelemetryTotalCount,
                        exportRecentEventsPacketValidationCount: recentTelemetryPacketValidationCount,
                        exportRecentEventsNonPacketCount: recentTelemetryNonPacketCount,
                        exportRecentEventsGovernanceStatusCounts: recentTelemetryGovernanceStatusCounts,
                        exportRecentEventsPacketValidationStatusCounts: recentTelemetryPacketStatusCounts,
                        exportRecentEventsGovernanceStatusCountsSource: recentTelemetryGovernanceStatusCountsProvenance.source,
                        exportRecentEventsPacketValidationStatusCountsSource: recentTelemetryPacketStatusCountsProvenance.source,
                        exportRecentEventsGovernanceStatusCountsMismatch: recentTelemetryGovernanceStatusCountsProvenance.mismatch,
                        exportRecentEventsPacketValidationStatusCountsMismatch: recentTelemetryPacketStatusCountsProvenance.mismatch,
                        exportRecentEventsGovernanceStatusCountsServer: recentTelemetryGovernanceStatusCountsProvenance.serverCounts,
                        exportRecentEventsPacketValidationStatusCountsServer: recentTelemetryPacketStatusCountsProvenance.serverCounts,
                        exportRecentEventsGovernanceStatusCountsFallback: recentTelemetryGovernanceStatusCountsProvenance.fallbackCounts,
                        exportRecentEventsPacketValidationStatusCountsFallback: recentTelemetryPacketStatusCountsProvenance.fallbackCounts,
                        exportRecentEventsGovernanceStatusCountsPosture: recentTelemetryGovernanceStatusCountsPosture.posture,
                        exportRecentEventsPacketValidationStatusCountsPosture: recentTelemetryPacketStatusCountsPosture.posture,
                        exportRecentEventsGovernanceStatusCountsPostureSeverity: recentTelemetryGovernanceStatusCountsPosture.severity,
                        exportRecentEventsPacketValidationStatusCountsPostureSeverity: recentTelemetryPacketStatusCountsPosture.severity,
                        exportRecentEventsGovernanceStatusCountsRequiresInvestigation: recentTelemetryGovernanceStatusCountsPosture.requiresInvestigation,
                        exportRecentEventsPacketValidationStatusCountsRequiresInvestigation: recentTelemetryPacketStatusCountsPosture.requiresInvestigation,
                        exportConnectorRateLimitPressureLabel: connectorRateLimitPressure.label,
                        exportConnectorRateLimitPressureHint: connectorRateLimitPressure.hint,
                        exportConnectorRateLimitPressureSignalSeconds: connectorRateLimitPressure.signalSeconds,
                        exportConnectorRateLimitEventCount: 0,
                        exportConnectorRateLimitLatestEventAt: null,
                        exportConnectorValidationEventCount: 0,
                        exportConnectorValidationLatestEventAt: null,
                        exportConnectorValidationEndpointCount: 0,
                        exportConnectorValidationProviderCount: 0,
                        exportConnectorValidationFieldCount: 0,
                        exportConnectorValidationReasonCount: 0,
                        exportRetryAuditEventCount: 0,
                        exportRetryAuditLatestEventAt: null,
                        exportRetryAuditMaxNextDelaySeconds: null,
                        exportRetryAuditAvgNextDelaySeconds: null,
                        exportRetryAuditOperationCount: 0,
                        exportRetryAuditProviderCount: 0,
                        exportRetryTerminalEventCount: retryTerminalSummary.eventCount,
                        exportRetryTerminalOutcomeCounts: retryTerminalSummary.outcomeCounts,
                        exportRetryTerminalRetryabilityCounts: retryTerminalSummary.retryabilityCounts,
                        exportRetryTerminalErrorTypeCounts: retryTerminalSummary.errorTypeCounts,
                        exportRetryTerminalReasonCodeCounts: retryTerminalSummary.reasonCodeCounts,
                        exportRetryTerminalStatusCodeCounts: retryTerminalSummary.statusCodeCounts,
                        exportRetryTerminalPressureLabel: retryTerminalPressure.label,
                        exportRetryTerminalPressureHint: retryTerminalPressure.hint,
                        exportRetryTerminalPressureSignalCount: retryTerminalPressure.signalCount,
                        exportRetryTerminalTopOutcome: retryTerminalTopOutcome,
                        exportRetryTerminalTopReasonCode: retryTerminalTopReasonCode,
                        exportRetryTerminalTopStatusCode: retryTerminalTopStatusCode,
                        exportOrchestrationAuditEventCount: 0,
                        exportOrchestrationAuditLatestEventAt: null,
                        exportOrchestrationAuditMaxAttemptCount: null,
                        exportOrchestrationAuditAvgAttemptCount: null,
                        exportOrchestrationAuditProviderCount: 0,
                        exportOrchestrationAuditReasonCodeCount: 0,
                        exportOrchestrationTrendDayCount: 0,
                        exportOrchestrationTrendEventCount: 0,
                        exportOrchestrationTrendAttemptErrorCount: 0,
                        exportOrchestrationTrendAttemptSkippedCount: 0,
                      }
                )
              }
              className="rounded-md border px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
            >
              Export Telemetry JSON
            </button>
          </div>

          {telemetrySummary && (
            <div className="text-xs text-gray-500">
              Generated: {formatTimestamp(telemetrySummary.generatedAt)} • Window: {telemetrySummary.windowDays || telemetryParams.days} days • Limit: {telemetryParams.limit} • Schema v2 coverage: {salesSchemaCoveragePct.toFixed(1)}% • Orchestration trend events: {orchestrationTrendTotal}
            </div>
          )}
          {isIntegrationsHealthLoading && (
            <div className="text-xs text-gray-500">Loading integrations health snapshot...</div>
          )}
          {integrationsHealthError && (
            <div className="text-xs text-red-600">
              Failed to load integrations health snapshot: {getErrorMessage(integrationsHealthError)}
            </div>
          )}
          {integrationsHealth && (
            <div
              data-testid="sales-integrations-health-card"
              className="rounded-md border p-3 text-sm"
            >
              <div className="text-xs font-medium text-gray-500 mb-2">Connector Credential Freshness</div>
              <div className="grid gap-2 md:grid-cols-4 text-xs">
                <div className="rounded-md border px-2 py-1">
                  <div className="text-gray-500">Health Status</div>
                  <div className="font-semibold">{integrationHealthExportMetadata.exportIntegrationHealthStatus}</div>
                </div>
                <div className="rounded-md border px-2 py-1">
                  <div className="text-gray-500">Healthy/Unhealthy</div>
                  <div className="font-semibold">
                    {integrationsHealth.healthyCount ?? 0}/{integrationsHealth.unhealthyCount ?? 0}
                  </div>
                </div>
                <div className="rounded-md border px-2 py-1">
                  <div className="text-gray-500">Freshness ACTION_REQUIRED</div>
                  <div className="font-semibold">
                    {integrationHealthExportMetadata.exportIntegrationHealthCredentialFreshnessActionRequiredCount}
                  </div>
                </div>
                <div className="rounded-md border px-2 py-1">
                  <div className="text-gray-500">Freshness READY/UNKNOWN</div>
                  <div className="font-semibold">
                    {integrationHealthExportMetadata.exportIntegrationHealthCredentialFreshnessWithinPolicyCount}
                    {' / '}
                    {integrationHealthExportMetadata.exportIntegrationHealthCredentialFreshnessUnknownCount}
                  </div>
                </div>
              </div>
              <div className="mt-2 text-[11px] text-gray-500">
                Freshness status-count source: {integrationHealthExportMetadata.exportIntegrationHealthCredentialFreshnessStatusCountsSource}.
                {' '}Effective counts: {integrationHealthFreshnessStatusCountsSummary}.
              </div>
              {integrationHealthExportMetadata.exportIntegrationHealthCredentialFreshnessStatusCountsMismatch && (
                <div className="mt-1 text-[11px] text-amber-700">
                  Credential freshness status-count mismatch (server `{integrationHealthFreshnessStatusCountsServerSummary}` vs provider-derived `{integrationHealthFreshnessStatusCountsFallbackSummary}`).
                </div>
              )}
              {!!integrationsHealth.credentialActionRequiredProviders?.length && (
                <div className="text-xs text-amber-700 mt-2">
                  Credential freshness warning for: {integrationsHealth.credentialActionRequiredProviders.join(', ')}.
                  {' '}Rotation max age: {integrationsHealth.credentialRotationMaxAgeDays ?? 'n/a'} days.
                </div>
              )}
              {integrationHealthFreshnessRows.length > 0 && (
                <div className="mt-2 grid gap-1 md:grid-cols-2 text-xs">
                  {integrationHealthFreshnessRows.slice(0, 6).map((row) => (
                    <div
                      key={`sales-integration-health-${row.provider}`}
                      className="flex items-center justify-between rounded border border-slate-100 px-2 py-1"
                    >
                      <span>{row.provider}</span>
                      <span>{row.status}</span>
                    </div>
                  ))}
                </div>
              )}
              {integrationHealthFreshnessRows.length === 0 && (
                <div className="text-xs text-gray-500 mt-2">
                  No connector freshness telemetry yet.
                </div>
              )}
            </div>
          )}

          {telemetrySummary && (
            <div
              data-testid="sales-connector-pressure-card"
              className="rounded-md border p-3 text-sm"
            >
              <div className="text-xs font-medium text-gray-500 mb-2">Connector Throttle Pressure</div>
              <div className="grid gap-2 md:grid-cols-4 text-xs">
                <div className="rounded-md border px-2 py-1">
                  <div className="text-gray-500">Rate-Limit Events</div>
                  <div className="font-semibold">{telemetrySummary.connectorRateLimit?.eventCount || 0}</div>
                </div>
                <div className="rounded-md border px-2 py-1">
                  <div className="text-gray-500">Max Retry (s)</div>
                  <div className="font-semibold">{telemetrySummary.connectorRateLimit?.maxRetryAfterSeconds ?? 'n/a'}</div>
                </div>
                <div className="rounded-md border px-2 py-1">
                  <div className="text-gray-500">Avg Reset (s)</div>
                  <div className="font-semibold">{telemetrySummary.connectorRateLimit?.avgResetInSeconds ?? 'n/a'}</div>
                </div>
                <div className="rounded-md border px-2 py-1">
                  <div className="text-gray-500">Latest Rate-Limit Event</div>
                  <div className="font-semibold">{formatTimestamp(telemetrySummary.connectorRateLimit?.latestEventAt || undefined)}</div>
                </div>
              </div>
              <div
                data-testid="sales-connector-pressure-status"
                className={`text-xs mt-2 ${connectorRateLimitPressure.toneClass}`}
              >
                Connector throttle pressure: {connectorRateLimitPressure.label}. {connectorRateLimitPressure.hint}
              </div>
              {connectorRateLimitEndpointRows.length > 0 && (
                <div className="mt-2 grid gap-1 md:grid-cols-2 text-xs">
                  {connectorRateLimitEndpointRows.slice(0, 6).map(([endpoint, count]) => (
                    <div
                      key={`sales-connector-rate-limit-endpoint-${endpoint}`}
                      className="flex items-center justify-between rounded border border-slate-100 px-2 py-1"
                    >
                      <span>{endpoint}</span>
                      <span>{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {telemetrySummary && (
            <div data-testid="sales-connector-validation-card" className="rounded-md border p-3 text-sm">
              <div className="text-xs font-medium text-gray-500 mb-2">Connector Input-Validation Posture</div>
              <div className="text-xs text-gray-500 mb-2">
                Latest validation event: {formatTimestamp(telemetrySummary.connectorValidation?.latestEventAt || undefined)}
              </div>
              <div className="grid gap-2 md:grid-cols-4 text-xs">
                <div className="rounded-md border px-2 py-1">
                  <div className="text-gray-500">Validation Events</div>
                  <div className="font-semibold">{telemetrySummary.connectorValidation?.eventCount ?? 0}</div>
                </div>
                <div className="rounded-md border px-2 py-1">
                  <div className="text-gray-500">Endpoints</div>
                  <div className="font-semibold">{connectorValidationEndpointRows.length}</div>
                </div>
                <div className="rounded-md border px-2 py-1">
                  <div className="text-gray-500">Providers</div>
                  <div className="font-semibold">{connectorValidationProviderRows.length}</div>
                </div>
                <div className="rounded-md border px-2 py-1">
                  <div className="text-gray-500">Fields</div>
                  <div className="font-semibold">{connectorValidationFieldRows.length}</div>
                </div>
              </div>
              <div className="text-xs text-gray-500 mt-2 mb-2">
                Reasons tracked: {connectorValidationReasonRows.length}
              </div>
              <div className="grid gap-2 md:grid-cols-2 text-xs">
                <div className="rounded-md border p-2">
                  <div className="text-gray-500 mb-1">By Endpoint</div>
                  {connectorValidationEndpointRows.length === 0 && (
                    <div className="text-gray-500">No connector input-validation endpoint telemetry in this window.</div>
                  )}
                  {connectorValidationEndpointRows.slice(0, 6).map(([endpoint, count]) => (
                    <div
                      key={`sales-connector-validation-endpoint-${endpoint}`}
                      className="flex items-center justify-between rounded border border-slate-100 px-2 py-1 mt-1"
                    >
                      <span>{endpoint}</span>
                      <span>{count}</span>
                    </div>
                  ))}
                </div>
                <div className="rounded-md border p-2">
                  <div className="text-gray-500 mb-1">By Field</div>
                  {connectorValidationFieldRows.length === 0 && (
                    <div className="text-gray-500">No connector input-validation field telemetry in this window.</div>
                  )}
                  {connectorValidationFieldRows.slice(0, 6).map(([field, count]) => (
                    <div
                      key={`sales-connector-validation-field-${field}`}
                      className="flex items-center justify-between rounded border border-slate-100 px-2 py-1 mt-1"
                    >
                      <span>{field}</span>
                      <span>{count}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid gap-2 md:grid-cols-2 text-xs mt-2">
                <div className="rounded-md border p-2">
                  <div className="text-gray-500 mb-1">By Provider</div>
                  {connectorValidationProviderRows.length === 0 && (
                    <div className="text-gray-500">No connector input-validation provider telemetry in this window.</div>
                  )}
                  {connectorValidationProviderRows.slice(0, 6).map(([provider, count]) => (
                    <div
                      key={`sales-connector-validation-provider-${provider}`}
                      className="flex items-center justify-between rounded border border-slate-100 px-2 py-1 mt-1"
                    >
                      <span>{provider}</span>
                      <span>{count}</span>
                    </div>
                  ))}
                </div>
                <div className="rounded-md border p-2">
                  <div className="text-gray-500 mb-1">By Reason</div>
                  {connectorValidationReasonRows.length === 0 && (
                    <div className="text-gray-500">No connector input-validation reason telemetry in this window.</div>
                  )}
                  {connectorValidationReasonRows.slice(0, 6).map(([reason, count]) => (
                    <div
                      key={`sales-connector-validation-reason-${reason}`}
                      className="flex items-center justify-between rounded border border-slate-100 px-2 py-1 mt-1"
                    >
                      <span>{reason}</span>
                      <span>{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {telemetrySummary && (
            <div data-testid="sales-retry-audit-card" className="rounded-md border p-3 text-sm">
              <div className="text-xs font-medium text-gray-500 mb-2">Retry Audit</div>
              <div className="text-xs text-gray-500 mb-2">
                Latest retry event: {formatTimestamp(telemetrySummary.retryAudit?.latestEventAt || undefined)}
              </div>
              <div className="grid gap-2 md:grid-cols-4 text-xs">
                <div className="rounded-md border px-2 py-1">
                  <div className="text-gray-500">Retry Events</div>
                  <div className="font-semibold">{telemetrySummary.retryAudit?.eventCount ?? 0}</div>
                </div>
                <div className="rounded-md border px-2 py-1">
                  <div className="text-gray-500">Max Next Delay (s)</div>
                  <div className="font-semibold">{telemetrySummary.retryAudit?.maxNextDelaySeconds ?? 'n/a'}</div>
                </div>
                <div className="rounded-md border px-2 py-1">
                  <div className="text-gray-500">Avg Next Delay (s)</div>
                  <div className="font-semibold">{telemetrySummary.retryAudit?.avgNextDelaySeconds ?? 'n/a'}</div>
                </div>
                <div className="rounded-md border px-2 py-1">
                  <div className="text-gray-500">Operations</div>
                  <div className="font-semibold">{retryAuditOperationRows.length}</div>
                </div>
              </div>
              <div className="grid gap-2 md:grid-cols-2 text-xs mt-2">
                <div className="rounded-md border p-2">
                  <div className="text-gray-500 mb-1">By Operation</div>
                  {retryAuditOperationRows.length === 0 && (
                    <div className="text-gray-500">No retry operations in this window.</div>
                  )}
                  {retryAuditOperationRows.slice(0, 6).map(([operation, count]) => (
                    <div
                      key={`sales-retry-operation-${operation}`}
                      className="flex items-center justify-between rounded border border-slate-100 px-2 py-1 mt-1"
                    >
                      <span>{operation}</span>
                      <span>{count}</span>
                    </div>
                  ))}
                </div>
                <div className="rounded-md border p-2">
                  <div className="text-gray-500 mb-1">By Provider</div>
                  {retryAuditProviderRows.length === 0 && (
                    <div className="text-gray-500">No retry providers in this window.</div>
                  )}
                  {retryAuditProviderRows.slice(0, 6).map(([provider, count]) => (
                    <div
                      key={`sales-retry-provider-${provider}`}
                      className="flex items-center justify-between rounded border border-slate-100 px-2 py-1 mt-1"
                    >
                      <span>{provider}</span>
                      <span>{count}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div data-testid="sales-retry-terminal-card" className="rounded-md border p-2 text-xs mt-2">
                <div className="text-gray-500 mb-1">Retry Terminal Outcomes</div>
                <div className="text-gray-500 mb-2">
                  terminal events {retryTerminalSummary.eventCount}
                  {' '}• retryable {retryTerminalSummary.retryabilityCounts.RETRYABLE || 0}
                  {' '}• non-retryable {retryTerminalSummary.retryabilityCounts.NON_RETRYABLE || 0}
                  {' '}• unknown {retryTerminalSummary.retryabilityCounts.UNKNOWN || 0}
                </div>
                <div className="text-gray-500 mb-2">
                  pressure {retryTerminalPressure.label}
                  {' '}• signal {retryTerminalPressure.signalCount}
                  {' '}• top outcome {retryTerminalTopOutcome ? `${retryTerminalTopOutcome.key} (${retryTerminalTopOutcome.count})` : 'none'}
                </div>
                <div className="text-gray-500 mb-2">
                  top reason {retryTerminalTopReasonCode ? `${retryTerminalTopReasonCode.key} (${retryTerminalTopReasonCode.count})` : 'none'}
                  {' '}• top status {retryTerminalTopStatusCode ? `${retryTerminalTopStatusCode.key} (${retryTerminalTopStatusCode.count})` : 'none'}
                </div>
                <div className="text-gray-500 mb-2">
                  {retryTerminalPressure.hint}
                </div>
                <div className="grid gap-2 md:grid-cols-3">
                  <div className="rounded-md border p-2">
                    <div className="text-gray-500 mb-1">By Outcome</div>
                    {retryTerminalOutcomeRows.length === 0 && (
                      <div className="text-gray-500">No terminal retry outcomes in this window.</div>
                    )}
                    {retryTerminalOutcomeRows.slice(0, 6).map(([outcome, count]) => (
                      <div
                        key={`sales-retry-terminal-outcome-${outcome}`}
                        className="flex items-center justify-between rounded border border-slate-100 px-2 py-1 mt-1"
                      >
                        <span>{outcome}</span>
                        <span>{count}</span>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-md border p-2">
                    <div className="text-gray-500 mb-1">By Reason Code</div>
                    {retryTerminalReasonCodeRows.length === 0 && (
                      <div className="text-gray-500">No terminal reason codes in this window.</div>
                    )}
                    {retryTerminalReasonCodeRows.slice(0, 6).map(([reasonCode, count]) => (
                      <div
                        key={`sales-retry-terminal-reason-${reasonCode}`}
                        className="flex items-center justify-between rounded border border-slate-100 px-2 py-1 mt-1"
                      >
                        <span>{reasonCode}</span>
                        <span>{count}</span>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-md border p-2">
                    <div className="text-gray-500 mb-1">By Status Code</div>
                    {retryTerminalStatusCodeRows.length === 0 && (
                      <div className="text-gray-500">No terminal status codes in this window.</div>
                    )}
                    {retryTerminalStatusCodeRows.slice(0, 6).map(([statusCode, count]) => (
                      <div
                        key={`sales-retry-terminal-status-${statusCode}`}
                        className="flex items-center justify-between rounded border border-slate-100 px-2 py-1 mt-1"
                      >
                        <span>{statusCode}</span>
                        <span>{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {telemetrySummary && (
            <div data-testid="sales-orchestration-audit-card" className="rounded-md border p-3 text-sm">
              <div className="text-xs font-medium text-gray-500 mb-2">Orchestration Audit</div>
              <div className="text-xs text-gray-500 mb-2">
                Latest orchestration event: {formatTimestamp(telemetrySummary.orchestrationAudit?.latestEventAt || undefined)}
              </div>
              <div className="grid gap-2 md:grid-cols-4 text-xs">
                <div className="rounded-md border px-2 py-1">
                  <div className="text-gray-500">Events</div>
                  <div className="font-semibold">{telemetrySummary.orchestrationAudit?.eventCount ?? 0}</div>
                </div>
                <div className="rounded-md border px-2 py-1">
                  <div className="text-gray-500">Max Attempts</div>
                  <div className="font-semibold">{telemetrySummary.orchestrationAudit?.maxAttemptCount ?? 'n/a'}</div>
                </div>
                <div className="rounded-md border px-2 py-1">
                  <div className="text-gray-500">Avg Attempts</div>
                  <div className="font-semibold">{telemetrySummary.orchestrationAudit?.avgAttemptCount ?? 'n/a'}</div>
                </div>
                <div className="rounded-md border px-2 py-1">
                  <div className="text-gray-500">Max Latency (ms)</div>
                  <div className="font-semibold">{telemetrySummary.orchestrationAudit?.maxLatencyMs ?? 'n/a'}</div>
                </div>
              </div>
              <div className="text-xs text-gray-500 mt-2">
                attempts success {telemetrySummary.orchestrationAudit?.attemptStatusCounts?.success || 0}
                {' '}• skipped {telemetrySummary.orchestrationAudit?.attemptStatusCounts?.skipped || 0}
                {' '}• error {telemetrySummary.orchestrationAudit?.attemptStatusCounts?.error || 0}
              </div>
              <div className="grid gap-2 md:grid-cols-2 text-xs mt-2">
                <div className="rounded-md border p-2">
                  <div className="text-gray-500 mb-1">By Selected Provider</div>
                  {orchestrationAuditProviderRows.length === 0 && (
                    <div className="text-gray-500">No orchestration provider selections in this window.</div>
                  )}
                  {orchestrationAuditProviderRows.slice(0, 6).map(([provider, count]) => (
                    <div
                      key={`sales-orchestration-provider-${provider}`}
                      className="flex items-center justify-between rounded border border-slate-100 px-2 py-1 mt-1"
                    >
                      <span>{provider}</span>
                      <span>{count}</span>
                    </div>
                  ))}
                </div>
                <div className="rounded-md border p-2">
                  <div className="text-gray-500 mb-1">Attempt Reason Codes</div>
                  {orchestrationAuditReasonCodeRows.length === 0 && (
                    <div className="text-gray-500">No orchestration reason codes in this window.</div>
                  )}
                  {orchestrationAuditReasonCodeRows.slice(0, 6).map(([reasonCode, count]) => (
                    <div
                      key={`sales-orchestration-reason-${reasonCode}`}
                      className="flex items-center justify-between rounded border border-slate-100 px-2 py-1 mt-1"
                    >
                      <span>{reasonCode}</span>
                      <span>{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {telemetrySummary && (
            <div className="rounded-md border p-3 text-sm">
              <div className="text-xs font-medium text-gray-500 mb-2">Governance Packet Validation Posture</div>
              <div className="text-xs text-gray-500 mb-2">
                Latest evaluation: {formatTimestamp(telemetrySummary.packetValidationAudit?.latestEvaluatedAt || undefined)}
              </div>
              <div className="grid gap-2 md:grid-cols-4 text-xs">
                <div className="rounded-md border px-2 py-1">
                  <div className="text-gray-500">Events</div>
                  <div className="font-semibold">{telemetrySummary.packetValidationAudit?.eventCount || 0}</div>
                </div>
                <div className="rounded-md border px-2 py-1">
                  <div className="text-gray-500">Within Freshness</div>
                  <div className="font-semibold">{telemetrySummary.packetValidationAudit?.withinFreshnessCount || 0}</div>
                </div>
                <div className="rounded-md border px-2 py-1">
                  <div className="text-gray-500">Outside Freshness</div>
                  <div className="font-semibold">{telemetrySummary.packetValidationAudit?.outsideFreshnessCount || 0}</div>
                </div>
                <div className="rounded-md border px-2 py-1">
                  <div className="text-gray-500">Missing Freshness</div>
                  <div className="font-semibold">{telemetrySummary.packetValidationAudit?.missingFreshnessCount || 0}</div>
                </div>
              </div>
              <div className="mt-3 space-y-1 text-xs text-gray-700">
                {packetValidationStatusRows.length === 0 && (
                  <div className="text-gray-500">No governance packet validation telemetry in this window.</div>
                )}
                {packetValidationStatusRows.map(([status, count]) => (
                  <div key={`sales-packet-validation-${status}`} className="flex items-center justify-between rounded border border-slate-100 px-2 py-1">
                    <span>{status}</span>
                    <span>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {telemetrySummary && (
            <div data-testid="sales-governance-schema-audit-card" className="rounded-md border p-3 text-sm">
              <div className="text-xs font-medium text-gray-500 mb-2">Governance Schema Audit Posture</div>
              <div className="text-xs text-gray-500 mb-2">
                Latest evaluation: {formatTimestamp(telemetrySummary.governanceSchemaAudit?.latestEvaluatedAt || undefined)}
              </div>
              <div className="grid gap-2 md:grid-cols-4 text-xs">
                <div className="rounded-md border px-2 py-1">
                  <div className="text-gray-500">Events</div>
                  <div className="font-semibold">{telemetrySummary.governanceSchemaAudit?.eventCount || 0}</div>
                </div>
                <div className="rounded-md border px-2 py-1">
                  <div className="text-gray-500">All Parity Pass</div>
                  <div className="font-semibold">{governanceSchemaAuditParityPassCount}</div>
                </div>
                <div className="rounded-md border px-2 py-1">
                  <div className="text-gray-500">All Parity Fail</div>
                  <div className="font-semibold">{governanceSchemaAuditParityFailCount}</div>
                </div>
                <div className="rounded-md border px-2 py-1">
                  <div className="text-gray-500">Rollout Blocked</div>
                  <div className="font-semibold">{telemetrySummary.governanceSchemaAudit?.rolloutBlockedCount || 0}</div>
                </div>
              </div>
              <div className={`text-xs mt-2 ${governanceSchemaAuditParityToneClass}`}>
                Parity posture: {governanceSchemaAuditParityStatus}
              </div>
              <div className="text-xs text-gray-500 mt-2">
                reason-code parity pass {telemetrySummary.governanceSchemaAudit?.reasonCodeParityPassCount || 0}
                {' '}• fail {telemetrySummary.governanceSchemaAudit?.reasonCodeParityFailCount || 0}
                {' '}• command parity pass {telemetrySummary.governanceSchemaAudit?.recommendedCommandParityPassCount || 0}
                {' '}• fail {telemetrySummary.governanceSchemaAudit?.recommendedCommandParityFailCount || 0}
                {' '}• handoff parity pass {telemetrySummary.governanceSchemaAudit?.handoffParityPassCount || 0}
                {' '}• fail {telemetrySummary.governanceSchemaAudit?.handoffParityFailCount || 0}
                {' '}• unknown {governanceSchemaAuditParityUnknownEventCount}
              </div>
              <div className="mt-3 space-y-1 text-xs text-gray-700">
                {governanceSchemaStatusRows.length === 0 && (
                  <div className="text-gray-500">No governance schema audit telemetry in this window.</div>
                )}
                {governanceSchemaStatusRows.map(([status, count]) => (
                  <div
                    key={`sales-governance-schema-status-${status}`}
                    className="flex items-center justify-between rounded border border-slate-100 px-2 py-1"
                  >
                    <span>{status}</span>
                    <span>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-md border p-3 text-sm">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-xs font-medium text-gray-500">Recent Correlated Events</div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  data-testid="sales-recent-events-filter-all"
                  onClick={() => setRecentTelemetryFilter('all')}
                  className={`rounded border px-2 py-0.5 text-xs ${
                    recentTelemetryFilter === 'all'
                      ? 'border-slate-400 bg-slate-100 text-slate-800'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  All Events
                </button>
                <button
                  type="button"
                  data-testid="sales-recent-events-filter-packet"
                  onClick={() => setRecentTelemetryFilter('packet')}
                  className={`rounded border px-2 py-0.5 text-xs ${
                    recentTelemetryFilter === 'packet'
                      ? 'border-slate-400 bg-slate-100 text-slate-800'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  Packet-Validation Events
                </button>
              </div>
            </div>
            <div className="mb-2 text-xs text-gray-500">
              Showing {recentTelemetryFilteredCount} of {recentTelemetryTotalCount} recent events.
            </div>
            <div className="mb-2 text-xs text-gray-500">
              Packet-validation rows: {recentTelemetryPacketValidationCount} • Non-packet rows: {recentTelemetryNonPacketCount}.
            </div>
            <div className="mb-2 text-xs text-gray-500">
              Status filters • Governance: {effectiveRecentTelemetryGovernanceStatusFilter || TELEMETRY_STATUS_FILTER_ALL} • Packet: {effectiveRecentTelemetryPacketStatusFilter || TELEMETRY_STATUS_FILTER_ALL}.
            </div>
            <div className="mb-2 text-xs text-gray-500">
              Governance status counts: {recentTelemetryGovernanceStatusCountsSummary}.
            </div>
            <div className="mb-2 text-xs text-gray-500">
              Packet status counts: {recentTelemetryPacketStatusCountsSummary}.
            </div>
            <div className="mb-2 text-xs text-gray-500">
              Status-count source • Governance: {recentTelemetryGovernanceStatusCountsProvenance.source} • Packet: {recentTelemetryPacketStatusCountsProvenance.source}.
            </div>
            <div className="mb-2 text-xs text-gray-500">
              Status-count posture • Governance: {recentTelemetryGovernanceStatusCountsPosture.label} • Packet: {recentTelemetryPacketStatusCountsPosture.label}.
            </div>
            {recentTelemetryGovernanceStatusCountsProvenance.mismatch && (
              <div className="mb-2 text-xs text-amber-700">
                Governance status-count mismatch (server `{recentTelemetryGovernanceStatusCountsServerSummary}` vs row-derived `{recentTelemetryGovernanceStatusCountsFallbackSummary}`).
              </div>
            )}
            {recentTelemetryPacketStatusCountsProvenance.mismatch && (
              <div className="mb-2 text-xs text-amber-700">
                Packet status-count mismatch (server `{recentTelemetryPacketStatusCountsServerSummary}` vs row-derived `{recentTelemetryPacketStatusCountsFallbackSummary}`).
              </div>
            )}
            {telemetryRecentEventsFilterEcho && telemetryRecentEventsFilterEcho !== recentTelemetryFilter && (
              <div className="mb-2 text-xs text-amber-700">
                Server applied `{telemetryRecentEventsFilterEcho}` filter for this response (requested `{recentTelemetryFilter}`).
              </div>
            )}
            {telemetryRecentEventsGovernanceStatusFilterMismatch && (
              <div className="mb-2 text-xs text-amber-700">
                Server applied governance status filter `{serverTelemetryGovernanceStatusFilterLabel}` (requested `{selectedTelemetryGovernanceStatusFilterLabel}`).
              </div>
            )}
            {telemetryRecentEventsPacketStatusFilterMismatch && (
              <div className="mb-2 text-xs text-amber-700">
                Server applied packet status filter `{serverTelemetryPacketStatusFilterLabel}` (requested `{selectedTelemetryPacketStatusFilterLabel}`).
              </div>
            )}
            {filteredRecentTelemetryRows.length === 0 && (
              <div className="text-xs text-gray-500">
                {effectiveRecentTelemetryFilter === 'packet'
                  ? `No packet-validation events in this telemetry window. Increase Window Days or Event Limit (currently ${telemetryParams.days} days / ${telemetryParams.limit} events), then refresh telemetry.`
                  : 'No recent telemetry events captured in this window.'}
              </div>
            )}
            {filteredRecentTelemetryRows.length > 0 && (
              <div className="space-y-1 text-xs text-gray-700">
                {filteredRecentTelemetryRows.slice(0, 5).map((row, idx) => (
                  <div
                    key={`sales-recent-event-${row.eventType || 'event'}-${idx}`}
                    className="grid grid-cols-5 gap-2 rounded border border-slate-100 px-2 py-1"
                  >
                    <span>{row.provider || 'unknown'}</span>
                    <span>{row.eventType || 'unknown'}</span>
                    <span>{row.requestId || 'request n/a'}</span>
                    <span>schema v{row.schemaVersion ?? 'unknown'}</span>
                    <span>
                      {[
                        row.governanceStatus
                          ? `governance ${row.governanceStatus}`
                          : row.traceabilityDecision
                            ? `traceability ${row.traceabilityDecision}`
                            : 'traceability n/a',
                        row.governancePacketValidationStatus
                          ? `packet ${row.governancePacketValidationStatus}${
                              row.governancePacketValidationWithinFreshness === true
                                ? ' fresh'
                                : row.governancePacketValidationWithinFreshness === false
                                  ? ' stale'
                                  : ''
                            }`
                          : null,
                        row.governanceSchemaAllParityOk != null
                          || row.governanceSchemaReasonCodeParityOk != null
                          || row.governanceSchemaRecommendedCommandParityOk != null
                          || row.governanceSchemaHandoffParityOk != null
                          || row.governanceSchemaRolloutBlocked != null
                          ? `schema parity ${
                              row.governanceSchemaAllParityOk === true
                                ? 'PASS'
                                : row.governanceSchemaAllParityOk === false
                                  ? 'FAIL'
                                  : 'UNKNOWN'
                            }${
                              row.governanceSchemaRolloutBlocked === true
                                ? ' rollout-blocked'
                                : row.governanceSchemaRolloutBlocked === false
                                  ? ' rollout-clear'
                                  : ''
                            }${
                              typeof row.governanceSchemaReasonCodeCount === 'number'
                                ? ` reason-codes ${row.governanceSchemaReasonCodeCount}`
                                : ''
                            }${
                              typeof row.governanceSchemaRecommendedCommandCount === 'number'
                                ? ` commands ${row.governanceSchemaRecommendedCommandCount}`
                                : ''
                            }`
                          : null,
                        row.connectorRateLimitEndpoint
                          ? `connector ${row.connectorRateLimitEndpoint}${
                              typeof row.connectorRateLimitResetInSeconds === 'number'
                                ? ` reset ${row.connectorRateLimitResetInSeconds}s`
                              : ''
                            }${
                              typeof row.connectorRateLimitRetryAfterSeconds === 'number'
                                ? ` retry ${row.connectorRateLimitRetryAfterSeconds}s`
                                : ''
                            }`
                          : null,
                        row.connectorValidationEndpoint
                          || row.connectorValidationField
                          || row.connectorValidationReason
                          || row.connectorValidationErrorCode
                          ? `validation ${row.connectorValidationEndpoint || 'endpoint n/a'}${
                              row.connectorValidationField ? ` field ${row.connectorValidationField}` : ''
                            }${
                              row.connectorValidationReason ? ` reason ${row.connectorValidationReason}` : ''
                            }${
                              row.connectorValidationErrorCode ? ` code ${row.connectorValidationErrorCode}` : ''
                            }${
                              row.connectorValidationReceived != null
                                ? ` received ${String(row.connectorValidationReceived)}`
                                : ''
                            }${
                              row.connectorValidationMinimum != null
                                ? ` min ${String(row.connectorValidationMinimum)}`
                                : ''
                            }${
                              row.connectorValidationMaximum != null
                                ? ` max ${String(row.connectorValidationMaximum)}`
                                : ''
                            }`
                          : null,
                        row.retryOperation
                          ? `retry ${row.retryOperation} attempt ${row.retryAttempt ?? 'n/a'}/${row.retryMaxAttempts ?? 'n/a'}${
                              typeof row.retryNextDelaySeconds === 'number'
                                ? ` next ${row.retryNextDelaySeconds}s`
                              : ''
                            }${
                              row.retryError ? ` error ${row.retryError}` : ''
                            }`
                          : null,
                        row.retryFinalOutcome
                          || row.retryRetryable != null
                          || row.retryErrorType
                          || typeof row.retryErrorStatusCode === 'number'
                          || row.retryErrorReasonCode
                          ? `retry terminal outcome ${row.retryFinalOutcome || 'UNKNOWN'}${
                              row.retryRetryable === true
                                ? ' retryable'
                                : row.retryRetryable === false
                                  ? ' non-retryable'
                                  : ''
                            }${
                              row.retryErrorType ? ` type ${row.retryErrorType}` : ''
                            }${
                              typeof row.retryErrorStatusCode === 'number'
                                ? ` status ${row.retryErrorStatusCode}`
                                : ''
                            }${
                              row.retryErrorReasonCode ? ` reason ${row.retryErrorReasonCode}` : ''
                            }`
                          : null,
                        row.orchestrationSelectedProvider || row.orchestrationAttemptCount != null
                          ? `orchestration provider ${row.orchestrationSelectedProvider || 'none'} attempts ${row.orchestrationAttemptCount ?? 'n/a'} (s ${row.orchestrationAttemptSuccessCount ?? 0} / sk ${row.orchestrationAttemptSkippedCount ?? 0} / e ${row.orchestrationAttemptErrorCount ?? 0})${
                              row.orchestrationResultCount != null ? ` results ${row.orchestrationResultCount}` : ''
                            }`
                          : null,
                      ]
                        .filter((value): value is string => Boolean(value))
                        .join(' • ')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

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
                  <Line type="monotone" dataKey="orchestrationEvents" name="Orchestration Events" stroke="#f59e0b" strokeWidth={2} />
                  <Line type="monotone" dataKey="errors" name="Errors" stroke="#ef4444" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Governance Weekly Rollup</CardTitle>
          <CardDescription>Traceability and governance posture for rollout readiness.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[160px_160px_auto] md:items-end">
            <label className="text-xs text-gray-600" htmlFor="sales-governance-history-days-input">
              History Retention Days
              <input
                id="sales-governance-history-days-input"
                data-testid="sales-governance-history-days-input"
                type="number"
                min={1}
                max={365}
                value={governanceHistoryDaysInput}
                onChange={(e) => setGovernanceHistoryDaysInput(Number(e.target.value))}
                className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
              />
            </label>
            <label className="text-xs text-gray-600" htmlFor="sales-governance-history-limit-input">
              History Limit
              <input
                id="sales-governance-history-limit-input"
                data-testid="sales-governance-history-limit-input"
                type="number"
                min={1}
                max={500}
                value={governanceHistoryLimitInput}
                onChange={(e) => setGovernanceHistoryLimitInput(Number(e.target.value))}
                className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
              />
            </label>
            <button
              type="button"
              data-testid="sales-governance-history-refresh-btn"
              onClick={refreshGovernanceHistory}
              className="rounded-md border px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
            >
              Refresh Governance History
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="sales-governance-export-btn"
              onClick={() => downloadJsonSnapshot('sales-governance-weekly-report', governanceReport || { message: 'No governance report loaded' })}
              className="rounded-md border px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
            >
              Export Governance JSON
            </button>
            <button
              type="button"
              data-testid="sales-governance-handoff-export-btn"
              onClick={() => downloadJsonSnapshot(
                'sales-governance-handoff',
                governanceHandoffExportPayload
              )}
              className="rounded-md border px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
            >
              Export Governance Handoff JSON
            </button>
            <button
              type="button"
              data-testid="sales-governance-history-export-btn"
              onClick={() => downloadJsonSnapshot(
                'sales-governance-history',
                governanceHistoryExportPayload
              )}
              className="rounded-md border px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
            >
              Export Governance History JSON
            </button>
            <button
              type="button"
              data-testid="sales-governance-history-commands-copy-btn"
              onClick={() => {
                void copyGovernanceHistoryCommands();
              }}
              className="rounded-md border px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
            >
              Copy Governance History Commands
            </button>
            <button
              type="button"
              data-testid="sales-baseline-governance-export-btn"
              onClick={() => downloadJsonSnapshot(
                'sales-baseline-governance',
                baselineGovernance || { message: 'No baseline governance loaded' }
              )}
              className="rounded-md border px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
            >
              Export Baseline Governance JSON
            </button>
            <button
              type="button"
              data-testid="sales-baseline-governance-commands-copy-btn"
              onClick={() => {
                void copyBaselineGovernanceCommands();
              }}
              className="rounded-md border px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
            >
              Copy Baseline Governance Commands
            </button>
            <button
              type="button"
              data-testid="sales-governance-schema-export-btn"
              onClick={() => downloadJsonSnapshot(
                'sales-governance-schema-contract',
                buildGovernanceSchemaExportSnapshot(governanceSchema)
              )}
              className="rounded-md border px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
            >
              Export Governance Schema JSON
            </button>
            <button
              type="button"
              data-testid="sales-governance-schema-commands-copy-btn"
              onClick={() => {
                void copyGovernanceSchemaCommands();
              }}
              className="rounded-md border px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
            >
              Copy Governance Schema Commands
            </button>
          </div>

          {governanceReport && (
            <div className="text-xs text-gray-500">
              Generated: {formatTimestamp(governanceReport.generatedAt)} • Window: {governanceReport.windowDays || telemetryParams.days} days • Limit: {governanceReport.eventLimit || telemetryParams.limit}
            </div>
          )}

          {(governanceReport || governanceReportExport) && (
            <div className={`rounded-md border p-3 text-sm ${governanceRolloutBlocked ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}>
              <div className="text-xs font-medium">Weekly Governance Posture</div>
              <div className="mt-1">Posture: {governancePostureStatus}</div>
              <div>Rollout Blocked: {governanceRolloutBlocked ? 'Yes' : 'No'}</div>
              <div>Owner: {governanceOwnerRole}</div>
              <div>Schema Version: {governancePostureSchemaVersion ?? 'n/a'}</div>
              <div>Runtime Prereq Gate: {governanceRuntimePrereqsGateLabel}</div>
              <div>Runtime missing checks: {governanceRuntimePrereqsMissingCheckCount}</div>
              <div>Baseline Governance Status: {baselineGovernance?.status || 'n/a'}</div>
              <div>
                Baseline Runtime Prereq Gate:{' '}
                {baselineGovernance?.runtimePrereqs?.passed == null
                  ? 'n/a'
                  : baselineGovernance.runtimePrereqs.passed
                  ? 'PASS'
                  : 'FAIL'}
              </div>
              <div>
                Baseline Command Alias Gate:{' '}
                {baselineGovernance?.commandAliases?.gatePassed == null
                  ? 'n/a'
                  : baselineGovernance.commandAliases.gatePassed
                  ? 'PASS'
                  : 'FAIL'}
              </div>
              <div>
                Baseline Command Alias Drift (missing/mismatched):{' '}
                {baselineGovernance?.commandAliases?.missingAliasCount ?? 0}
                /
                {baselineGovernance?.commandAliases?.mismatchedAliasCount ?? 0}
              </div>
              {baselineGovernance?.commandAliases?.command && (
                <div className="mt-1 text-xs">
                  Command alias command: {baselineGovernance.commandAliases.command}
                </div>
              )}
              {governancePostureAlert && (
                <div className="mt-1 text-xs">{governancePostureAlert}</div>
              )}
              {governanceRuntimePrereqs?.command && (
                <div className="mt-1 text-xs">
                  Runtime command: {governanceRuntimePrereqs.command}
                </div>
              )}
              {baselineUsesFallbackCommandChain && (
                <div
                  data-testid="sales-baseline-governance-command-fallback-warning"
                  className="mt-2 rounded border border-amber-300 bg-amber-100 px-2 py-1 text-xs text-amber-900"
                >
                  Baseline governance is failing and backend recommendedCommands are missing. Using local fallback remediation commands.
                </div>
              )}
              {hasGovernanceParityWarning && (
                <div
                  data-testid="sales-governance-parity-warning"
                  className="mt-2 rounded border border-amber-300 bg-amber-100 px-2 py-1 text-xs text-amber-900"
                >
                  Connector/sendgrid parity warning: {governanceParityWarnings.join(' | ')}
                </div>
              )}
            </div>
          )}

          {isGovernanceReportLoading && (
            <div className="text-sm text-gray-500">Loading governance weekly rollup...</div>
          )}
          {isGovernanceReportExportLoading && (
            <div className="text-xs text-gray-500">Loading governance handoff export...</div>
          )}
          {isGovernanceReportHistoryLoading && (
            <div className="text-xs text-gray-500">Loading governance artifact history...</div>
          )}
          {isBaselineGovernanceLoading && (
            <div className="text-xs text-gray-500">Loading baseline governance...</div>
          )}

          {governanceReportError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {getErrorMessage(governanceReportError)}
            </div>
          )}
          {governanceReportExportError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {getErrorMessage(governanceReportExportError)}
            </div>
          )}
          {governanceReportHistoryError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {getErrorMessage(governanceReportHistoryError)}
            </div>
          )}
          {baselineGovernanceError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {getErrorMessage(baselineGovernanceError)}
            </div>
          )}
          {governanceSchemaError && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {getErrorMessage(governanceSchemaError)}
            </div>
          )}
          {isGovernanceSchemaLoading && (
            <div className="text-sm text-gray-500">Loading governance schema contract...</div>
          )}

          {!isGovernanceReportLoading && !governanceReportError && !governanceReport && (
            <div className="text-sm text-gray-500">No governance weekly rollup data available in this window.</div>
          )}

          {governanceSchema && (
            <div
              className={`rounded-md border p-3 text-sm ${
                governanceSchema.status === 'ACTION_REQUIRED'
                  ? 'border-amber-200 bg-amber-50 text-amber-900'
                  : 'border-slate-200 bg-slate-50 text-slate-800'
              }`}
            >
              <div className="text-xs font-medium text-gray-500 mb-2">Governance Schema Contract</div>
              <div>Status: {governanceSchema.status || 'UNKNOWN'}</div>
              <div>Active Version: {governanceSchema.schemaMetadata?.activeVersion ?? 'n/a'}</div>
              <div>Default Version: {governanceSchema.schemaMetadata?.defaultVersion ?? 'n/a'}</div>
              <div>Source: {governanceSchema.schemaMetadata?.source || 'unknown'}</div>
              <div>
                Override Set: {governanceSchemaOverride?.isSet ? 'Yes' : 'No'}
                {' '}• Override Valid: {governanceSchemaOverride?.isValid ? 'Yes' : 'No'}
              </div>
              <div>
                Supported Versions: {governanceSchemaSupportedVersions.length
                  ? governanceSchemaSupportedVersions.join(', ')
                  : 'n/a'}
              </div>
              {governanceSchemaContractParity && (
                <div
                  data-testid="sales-governance-schema-parity-posture"
                  className={`mt-2 rounded border px-2 py-1 text-xs ${governanceSchemaParityToneClass}`}
                >
                  <div>Schema Parity Status: {governanceSchemaParityStatus}</div>
                  <div>
                    Reason-code count: {governanceSchemaContractParity.reasonCodeCount ?? 'n/a'}
                    {' '}• Command count: {governanceSchemaContractParity.recommendedCommandCount ?? 'n/a'}
                  </div>
                  <div>Computed At: {formatTimestamp(governanceSchemaContractParity.computedAt)}</div>
                  {governanceSchemaParityFailedChecks.length > 0 && (
                    <div data-testid="sales-governance-schema-parity-warning">
                      Failed checks: {governanceSchemaParityFailedChecks.join(' | ')}
                    </div>
                  )}
                  {governanceSchemaParityUnknownCount > 0 && (
                    <div>Unknown checks: {governanceSchemaParityUnknownCount}</div>
                  )}
                </div>
              )}
              {governanceSchemaAlerts.length > 0 && (
                <div className="text-xs mt-1">Alerts: {governanceSchemaAlerts.join(' | ')}</div>
              )}
              {governanceSchemaCommands.length > 0 && (
                <div className="text-xs mt-1">
                  Commands: {governanceSchemaCommands.slice(0, 3).join(' | ')}
                </div>
              )}
            </div>
          )}

          {governanceReport && (
            <>
              <div className="grid lg:grid-cols-3 gap-3 text-sm">
                <div className="rounded-md border p-3">
                  <div className="text-xs text-gray-500">Governance Events</div>
                  <div className="text-xl font-semibold">{governanceReport.totals?.governanceEventCount || 0}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-gray-500">Traceability Evals</div>
                  <div className="text-xl font-semibold">{governanceReport.totals?.traceabilityEvaluationCount || 0}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-gray-500">ACTION_REQUIRED</div>
                  <div className="text-xl font-semibold">{governanceReport.totals?.actionRequiredCount || 0}</div>
                </div>
              </div>

              <div
                data-testid="sales-governance-connector-pressure"
                className="rounded-md border p-3 text-sm"
              >
                <div className="text-xs font-medium text-gray-500 mb-2">Governance Connector Pressure</div>
                <div className="grid md:grid-cols-4 gap-2 text-xs">
                  <div className="rounded border border-slate-100 bg-slate-50 px-2 py-1">
                    Events: {governanceConnectorRateLimit?.eventCount ?? governanceReport.totals?.connectorRateLimitEventCount ?? 0}
                  </div>
                  <div className="rounded border border-slate-100 bg-slate-50 px-2 py-1">
                    Max retry: {governanceConnectorRateLimit?.maxRetryAfterSeconds ?? 'n/a'}s
                  </div>
                  <div className="rounded border border-slate-100 bg-slate-50 px-2 py-1">
                    Avg reset: {governanceConnectorRateLimit?.avgResetInSeconds ?? 'n/a'}s
                  </div>
                  <div className="rounded border border-slate-100 bg-slate-50 px-2 py-1">
                    Latest event: {formatTimestamp(governanceConnectorRateLimit?.latestEventAt || undefined)}
                  </div>
                </div>
                <div className="grid md:grid-cols-3 gap-2 text-xs mt-2">
                  <div className="rounded border border-slate-100 bg-slate-50 px-2 py-1">
                    SendGrid timestamp events: {governanceSendgridWebhookTimestamp?.eventCount
                      ?? governanceReport.totals?.sendgridWebhookTimestampEventCount
                      ?? 0}
                  </div>
                  <div className="rounded border border-slate-100 bg-slate-50 px-2 py-1">
                    SendGrid anomaly total: {governanceSendgridWebhookTimestamp?.timestampAnomalyCountTotal
                      ?? governanceReport.totals?.sendgridWebhookTimestampAnomalyCountTotal
                      ?? 0}
                  </div>
                  <div className="rounded border border-slate-100 bg-slate-50 px-2 py-1">
                    SendGrid latest timestamp event: {formatTimestamp(governanceSendgridWebhookTimestamp?.latestEventAt || undefined)}
                  </div>
                </div>
                <div className={`text-xs mt-2 ${governanceConnectorRateLimitPressure.toneClass}`}>
                  Governance connector pressure: {governanceConnectorRateLimitPressure.label}. {governanceConnectorRateLimitPressure.hint}
                </div>
                {governanceConnectorRateLimitRows.length > 0 && (
                  <div className="grid md:grid-cols-2 gap-1 text-xs mt-2">
                    {governanceConnectorRateLimitRows.slice(0, 6).map(([endpoint, count]) => (
                      <div key={`sales-governance-connector-endpoint-${endpoint}`} className="flex items-center justify-between rounded border border-slate-100 px-2 py-1">
                        <span>{endpoint}</span>
                        <span>{count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid lg:grid-cols-2 gap-3 text-sm">
                <div className="rounded-md border p-3">
                  <div className="text-xs font-medium text-gray-500 mb-2">Governance Status Counts</div>
                  {governanceStatusRows.length === 0 && (
                    <div className="text-gray-500">No governance status counts available.</div>
                  )}
                  {governanceStatusRows.map(([status, count]) => (
                    <div key={`sales-governance-status-${status}`} className="flex items-center justify-between">
                      <span>{status}</span>
                      <span>{count}</span>
                    </div>
                  ))}
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs font-medium text-gray-500 mb-2">Traceability Decision Counts</div>
                  {governanceDecisionRows.length === 0 && (
                    <div className="text-gray-500">No traceability decisions available.</div>
                  )}
                  {governanceDecisionRows.map(([decision, count]) => (
                    <div key={`sales-governance-decision-${decision}`} className="flex items-center justify-between">
                      <span>{decision}</span>
                      <span>{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-md border p-3 text-sm">
                <div className="text-xs font-medium text-gray-500 mb-2">Governance Trend Rows</div>
                {governanceTrendRows.length === 0 && (
                  <div className="text-gray-500">No governance trend rows available.</div>
                )}
                {governanceTrendRows.length > 0 && (
                  <div className="space-y-1">
                    {governanceTrendRows.slice(-5).map((row) => (
                      <div key={`sales-governance-trend-${row.date}`} className="grid grid-cols-5 gap-2 rounded border border-slate-100 px-2 py-1 text-xs">
                        <span>{row.date}</span>
                        <span>snapshot {row.snapshotGovernanceEvents}</span>
                        <span>baseline {row.baselineGovernanceEvents}</span>
                        <span>traceability {row.traceabilityEvents}</span>
                        <span>action-required {row.actionRequiredEvents}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-md border p-3 text-sm">
                <div className="text-xs font-medium text-gray-500 mb-2">Recommended Commands</div>
                {(governanceReport.recommendedCommands || []).length === 0 && (
                  <div className="text-gray-500">No governance commands recommended.</div>
                )}
                {(governanceReport.recommendedCommands || []).length > 0 && (
                  <div className="space-y-1">
                    {(governanceReport.recommendedCommands || []).slice(0, 5).map((command) => (
                      <div key={command} className="rounded border border-slate-100 bg-slate-50 px-2 py-1 font-mono text-xs text-gray-700">
                        {command}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-md border p-3 text-sm">
                <div className="text-xs font-medium text-gray-500 mb-2">Governance Artifact History</div>
                {!governanceReportHistory && !isGovernanceReportHistoryLoading && (
                  <div className="text-gray-500">No governance history data available.</div>
                )}
                {governanceReportHistory && (
                  <div className="space-y-2">
                    <div className="text-xs text-gray-600">
                      Artifacts: {governanceReportHistory.artifactCount || 0} • Stale: {governanceReportHistory.staleCount || 0} • Rollout blocked: {governanceReportHistory.rolloutBlockedCount || 0}
                    </div>
                    <div className="text-xs text-gray-500">
                      Retention window: {governanceReportHistory.retentionDays || governanceHistoryParams.retentionDays} days • Limit: {governanceHistoryParams.limit} • Generated: {formatTimestamp(governanceReportHistory.generatedAt)}
                    </div>
                    <div className="rounded border border-slate-100 bg-slate-50 p-2">
                      <div className="text-xs font-medium text-gray-500 mb-1">History Schema Versions</div>
                      {governanceHistorySchemaRows.length === 0 && (
                        <div className="text-xs text-gray-500">No schema-version metadata found in governance history.</div>
                      )}
                      {governanceHistorySchemaRows.length > 0 && (
                        <div className="grid md:grid-cols-3 gap-1 text-xs">
                          {governanceHistorySchemaRows.map(([schemaVersion, count]) => (
                            <div key={`sales-governance-history-schema-${schemaVersion}`} className="flex items-center justify-between rounded border border-slate-200 bg-white px-2 py-1">
                              <span>v{schemaVersion}</span>
                              <span>{count}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {governanceDuplicateArtifactNames.length > 0 && (
                      <div className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-900">
                        Duplicate artifact names detected: {governanceDuplicateArtifactNames.join(', ')}
                      </div>
                    )}
                    {governanceReportHistory.latestArtifact && (
                      <div className="text-xs text-gray-700">
                        Latest: {governanceReportHistory.latestArtifact.name || 'n/a'} ({governanceReportHistory.latestArtifact.status || 'UNKNOWN'})
                      </div>
                    )}
                    {governanceHistoryRows.length === 0 && (
                      <div className="text-gray-500">No governance history artifacts found.</div>
                    )}
                    {governanceHistoryRows.length > 0 && (
                      <div className="space-y-1">
                        {governanceHistoryRows.slice(0, 5).map((item, idx) => (
                          <div
                            key={`sales-governance-history-${item.name || idx}`}
                            className="grid grid-cols-4 gap-2 rounded border border-slate-100 px-2 py-1 text-xs"
                          >
                            <span>{item.name || 'artifact'}</span>
                            <span>{item.status || 'UNKNOWN'}</span>
                            <span>{item.withinRetention ? 'within retention' : 'stale'}</span>
                            <span>{item.rolloutBlocked ? 'rollout blocked' : 'rollout ready'}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
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

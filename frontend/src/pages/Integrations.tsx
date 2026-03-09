import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
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
} from '../lib/governanceConnectorParity';
import { buildGovernanceSchemaExportSnapshot } from '../lib/governanceSchemaExport';
import { buildGovernanceRuntimePrereqsMetadata } from '../lib/governanceRuntimePrereqs';

const TELEMETRY_EXPORT_SCHEMA_VERSION = 3;
const CONNECTOR_LOOKUP_EXPORT_SCHEMA_VERSION = 1;
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

interface GovernanceSendgridWebhookTimestampRollup {
  eventCount?: number | null;
  pressureLabelCounts?: Record<string, number> | null;
  pressureHintCounts?: Record<string, number> | null;
  timestampFallbackCount?: number | null;
  futureSkewEventCount?: number | null;
  staleEventCount?: number | null;
  freshEventCount?: number | null;
  timestampAnomalyCountTotal?: number | null;
  avgTimestampAnomalyCount?: number | null;
  avgTimestampAnomalyRatePct?: number | null;
  maxTimestampAnomalyRatePct?: number | null;
  timestampAgeBucketCounts?: Record<string, number> | null;
  timestampAnomalyEventTypeCounts?: Record<string, number> | null;
  timestampDominantAnomalyBucketCounts?: Record<string, number> | null;
  timestampDominantAnomalyEventTypeCounts?: Record<string, number> | null;
  timestampPressureHighAnomalyRatePct?: number | null;
  timestampPressureModerateAnomalyRatePct?: number | null;
  timestampPressureHighAnomalyCount?: number | null;
  timestampPressureModerateAnomalyCount?: number | null;
  latestEventAt?: string | null;
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
    orchestrationEvents?: number;
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
  governanceAudit?: {
    eventCount: number;
    snapshotEvaluationCount?: number;
    baselineEvaluationCount?: number;
    statusCounts?: Record<string, number>;
    latestEvaluatedAt?: string | null;
  };
  governanceSchemaAudit?: {
    eventCount: number;
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
  packetValidationAudit?: {
    eventCount: number;
    statusCounts?: Record<string, number>;
    withinFreshnessCount?: number;
    outsideFreshnessCount?: number;
    missingFreshnessCount?: number;
    latestEvaluatedAt?: string | null;
  };
  connectorValidation?: {
    eventCount: number;
    byEndpoint?: Record<string, number>;
    byProvider?: Record<string, number>;
    byField?: Record<string, number>;
    byReason?: Record<string, number>;
    latestEventAt?: string | null;
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
    eventCount: number;
    byEndpoint?: Record<string, number>;
    maxRetryAfterSeconds?: number | null;
    avgRetryAfterSeconds?: number | null;
    maxResetInSeconds?: number | null;
    avgResetInSeconds?: number | null;
    latestEventAt?: string | null;
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
    connectorRateLimitWindowSeconds?: number | null;
    connectorRateLimitMaxRequests?: number | null;
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

interface IntegrationTelemetrySnapshotGovernanceResponse {
  generatedAt: string;
  governanceType?: string;
  retentionDays: number;
  status: 'READY' | 'ACTION_REQUIRED' | string;
  sendgridWebhookTimestamp?: GovernanceSendgridWebhookTimestampRollup;
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
  handoff?: {
    rolloutBlocked: boolean;
    ownerRole: string;
    actions: string[];
  };
  rolloutActions?: Array<{
    priority: string;
    severity: string;
    ownerRole: string;
    action: string;
    trigger: string;
    command?: string;
  }>;
  governanceExport?: {
    governanceType: string;
    exportSchemaVersion?: number;
    status: string;
    rolloutBlocked: boolean;
    ownerRole: string;
    sendgridWebhookTimestamp?: GovernanceSendgridWebhookTimestampRollup;
    alerts: Array<{
      severity: string;
      ownerRole: string;
      message: string;
      trigger?: string;
      command?: string;
    }>;
    actions: Array<{
      priority: string;
      severity: string;
      ownerRole: string;
      action: string;
      trigger: string;
      command?: string;
    }>;
  };
}

interface IntegrationBaselineGovernanceResponse {
  generatedAt: string;
  governanceType?: string;
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
  orchestrationGate?: {
    available: boolean;
    decision?: string | null;
    attemptErrorGatePassed?: boolean | null;
    attemptSkippedGatePassed?: boolean | null;
    maxAttemptErrorCountThreshold?: number | null;
    observedAttemptErrorCount?: number | null;
    maxAttemptSkippedCountThreshold?: number | null;
    observedAttemptSkippedCount?: number | null;
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
    artifactPath?: string | null;
    generatedAt?: string | null;
    validatedAt?: string | null;
    command?: string | null;
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
  alerts?: string[];
  handoff?: {
    rolloutBlocked: boolean;
    ownerRole: string;
    actions: string[];
  };
  rolloutActions?: Array<{
    priority: string;
    severity: string;
    ownerRole: string;
    action: string;
    trigger: string;
    command?: string;
  }>;
  recommendedCommands?: string[];
  governanceExport?: {
    governanceType: string;
    exportSchemaVersion?: number;
    status: string;
    rolloutBlocked: boolean;
    ownerRole: string;
    alerts: Array<{
      severity: string;
      ownerRole: string;
      message: string;
      trigger?: string;
      command?: string;
    }>;
    actions: Array<{
      priority: string;
      severity: string;
      ownerRole: string;
      action: string;
      trigger: string;
      command?: string;
    }>;
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

interface IntegrationsGovernanceReportResponse {
  governanceType?: string;
  exportSchemaVersion?: number;
  generatedAt: string;
  windowDays: number;
  eventLimit: number;
  status?: string;
  alerts?: string[];
  handoff?: {
    rolloutBlocked?: boolean;
    ownerRole?: string;
    actions?: string[];
  };
  totals: {
    governanceEventCount: number;
    traceabilityEvaluationCount: number;
    snapshotEvaluationCount: number;
    baselineEvaluationCount: number;
    actionRequiredCount: number;
    connectorRateLimitEventCount?: number;
    sendgridWebhookTimestampEventCount?: number;
    sendgridWebhookTimestampAnomalyCountTotal?: number;
    rolloutBlockedCount: number;
  };
  connectorRateLimit?: {
    eventCount?: number;
    byEndpoint?: Record<string, number>;
    latestEventAt?: string | null;
    maxRetryAfterSeconds?: number | null;
    avgRetryAfterSeconds?: number | null;
    maxResetInSeconds?: number | null;
    avgResetInSeconds?: number | null;
    pressure?: {
      label?: string;
      signalSeconds?: number;
      };
    };
  runtimePrereqs?: GovernanceRuntimePrereqsRollup;
  connectorPressureParity?: GovernanceConnectorPressureParity;
  sendgridWebhookTimestamp?: GovernanceSendgridWebhookTimestampRollup;
  sendgridWebhookTimestampParity?: GovernanceSendgridWebhookTimestampParity;
  governanceStatusCounts?: Record<string, number>;
  traceabilityDecisionCounts?: Record<string, number>;
  timeline?: Array<{
    date: string;
    traceabilityEvents: number;
    snapshotGovernanceEvents: number;
    baselineGovernanceEvents: number;
    actionRequiredEvents: number;
    holdDecisions: number;
    proceedDecisions: number;
    statusCounts?: Record<string, number>;
  }>;
  latestEvents?: Array<{
    createdAt?: string;
    eventType?: string;
    governanceType?: string;
    status?: string | null;
    decision?: string | null;
    requestId?: string | null;
    rolloutBlocked?: boolean;
  }>;
  ownerActionMatrix?: Array<{
    priority: string;
    severity: string;
    ownerRole: string;
    trigger: string;
    action: string;
    command: string;
    reasonCode?: string;
  }>;
  recommendedCommands?: string[];
  schemaMetadata?: {
    activeVersion?: number;
    defaultVersion?: number;
    source?: string;
  };
  reasonCodes?: string[];
  governanceExport?: {
    governanceType: string;
    exportSchemaVersion?: number;
    schemaMetadata?: {
      activeVersion?: number;
      defaultVersion?: number;
      source?: string;
    };
    status: string;
    rolloutBlocked: boolean;
    ownerRole: string;
    connectorRateLimit?: {
      eventCount?: number;
      byEndpoint?: Record<string, number>;
      latestEventAt?: string | null;
      maxRetryAfterSeconds?: number | null;
      avgRetryAfterSeconds?: number | null;
      maxResetInSeconds?: number | null;
      avgResetInSeconds?: number | null;
      pressure?: {
        label?: string;
        signalSeconds?: number;
      };
    };
    sendgridWebhookTimestamp?: GovernanceSendgridWebhookTimestampRollup;
    runtimePrereqs?: GovernanceRuntimePrereqsRollup;
    alerts: Array<{
      severity: string;
      ownerRole: string;
      message: string;
      trigger?: string;
      command?: string;
      reasonCode?: string;
    }>;
    actions: Array<{
      priority: string;
      severity: string;
      ownerRole: string;
      action: string;
      trigger: string;
      command?: string;
      reasonCode?: string;
    }>;
    evaluatedAt?: string;
    requestedBy?: string;
  };
  requestedBy?: string;
}

interface IntegrationsGovernanceReportExportResponse {
  governanceType?: string;
  exportSchemaVersion?: number;
  generatedAt: string;
  windowDays: number;
  eventLimit: number;
  status?: string;
  totals?: {
    governanceEventCount?: number;
    traceabilityEvaluationCount?: number;
    snapshotEvaluationCount?: number;
    baselineEvaluationCount?: number;
    actionRequiredCount?: number;
    connectorRateLimitEventCount?: number;
    sendgridWebhookTimestampEventCount?: number;
    sendgridWebhookTimestampAnomalyCountTotal?: number;
    rolloutBlockedCount?: number;
  };
  connectorRateLimit?: {
    eventCount?: number;
    byEndpoint?: Record<string, number>;
    latestEventAt?: string | null;
    maxRetryAfterSeconds?: number | null;
    avgRetryAfterSeconds?: number | null;
    maxResetInSeconds?: number | null;
    avgResetInSeconds?: number | null;
    pressure?: {
      label?: string;
      signalSeconds?: number;
      };
    };
  runtimePrereqs?: GovernanceRuntimePrereqsRollup;
  connectorPressureParity?: GovernanceConnectorPressureParity;
  sendgridWebhookTimestamp?: GovernanceSendgridWebhookTimestampRollup;
  sendgridWebhookTimestampParity?: GovernanceSendgridWebhookTimestampParity;
  recommendedCommands?: string[];
  schemaMetadata?: {
    activeVersion?: number;
    defaultVersion?: number;
    source?: string;
  };
  reasonCodes?: string[];
  governanceExport?: {
    governanceType: string;
    exportSchemaVersion?: number;
    schemaMetadata?: {
      activeVersion?: number;
      defaultVersion?: number;
      source?: string;
    };
    status: string;
    rolloutBlocked: boolean;
    ownerRole: string;
    connectorRateLimit?: {
      eventCount?: number;
      byEndpoint?: Record<string, number>;
      latestEventAt?: string | null;
      maxRetryAfterSeconds?: number | null;
      avgRetryAfterSeconds?: number | null;
      maxResetInSeconds?: number | null;
      avgResetInSeconds?: number | null;
      pressure?: {
        label?: string;
        signalSeconds?: number;
      };
    };
    sendgridWebhookTimestamp?: GovernanceSendgridWebhookTimestampRollup;
    runtimePrereqs?: GovernanceRuntimePrereqsRollup;
    alerts: Array<{
      severity: string;
      ownerRole: string;
      message: string;
      trigger?: string;
      command?: string;
      reasonCode?: string;
    }>;
    actions: Array<{
      priority: string;
      severity: string;
      ownerRole: string;
      action: string;
      trigger: string;
      command?: string;
      reasonCode?: string;
    }>;
    evaluatedAt?: string;
    requestedBy?: string;
  };
  requestedBy?: string;
}

interface IntegrationsGovernanceReportHistoryResponse {
  governanceType?: string;
  exportSchemaVersion?: number;
  generatedAt: string;
  retentionDays: number;
  limit: number;
  artifactDirectory: string;
  artifactPrefix: string;
  artifactCount: number;
  staleCount: number;
  rolloutBlockedCount: number;
  totals?: {
    connectorRateLimitEventCount?: number;
    sendgridWebhookTimestampEventCount?: number;
    sendgridWebhookTimestampAnomalyCountTotal?: number;
  };
  connectorRateLimit?: {
    eventCount?: number;
    byEndpoint?: Record<string, number>;
    latestEventAt?: string | null;
    maxRetryAfterSeconds?: number | null;
    avgRetryAfterSeconds?: number | null;
    maxResetInSeconds?: number | null;
    avgResetInSeconds?: number | null;
    pressure?: {
      label?: string;
      signalSeconds?: number;
      };
    };
  runtimePrereqs?: GovernanceRuntimePrereqsRollup;
  connectorPressureParity?: GovernanceConnectorPressureParity;
  sendgridWebhookTimestamp?: GovernanceSendgridWebhookTimestampRollup;
  sendgridWebhookTimestampParity?: GovernanceSendgridWebhookTimestampParity;
  duplicateArtifactNames?: string[];
  schemaVersionCounts?: Record<string, number>;
  schemaMetadata?: {
    activeVersion?: number;
    defaultVersion?: number;
    source?: string;
  };
  reasonCodes?: string[];
  latestArtifact?: {
    name?: string;
    exportSchemaVersion?: number;
    generatedAt?: string | null;
    status?: string;
    rolloutBlocked?: boolean;
  } | null;
  items: Array<{
    name: string;
    exportSchemaVersion?: number;
    generatedAt?: string | null;
    withinRetention: boolean;
    status: string;
    rolloutBlocked: boolean;
  }>;
  status?: string;
  alerts?: string[];
  recommendedCommands?: string[];
  governanceExport?: {
    governanceType: string;
    exportSchemaVersion?: number;
    schemaMetadata?: {
      activeVersion?: number;
      defaultVersion?: number;
      source?: string;
    };
    status: string;
    rolloutBlocked: boolean;
    ownerRole: string;
    connectorRateLimit?: {
      eventCount?: number;
      byEndpoint?: Record<string, number>;
      latestEventAt?: string | null;
      maxRetryAfterSeconds?: number | null;
      avgRetryAfterSeconds?: number | null;
      maxResetInSeconds?: number | null;
      avgResetInSeconds?: number | null;
      pressure?: {
        label?: string;
        signalSeconds?: number;
      };
    };
    sendgridWebhookTimestamp?: GovernanceSendgridWebhookTimestampRollup;
    runtimePrereqs?: GovernanceRuntimePrereqsRollup;
  };
  requestedBy?: string;
}

interface IntegrationsGovernanceSchemaResponse {
  generatedAt: string;
  governanceType?: string;
  status?: string;
  schemaMetadata?: {
    activeVersion?: number;
    defaultVersion?: number;
    supportedVersions?: number[];
    source?: string;
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
  governanceExport?: {
    governanceType?: string;
    status?: string;
    rolloutBlocked?: boolean;
    ownerRole?: string;
    alerts?: Array<{
      severity?: string;
      ownerRole?: string;
      message?: string;
      trigger?: string;
      command?: string;
      reasonCode?: string;
    }>;
    actions?: Array<{
      priority?: string;
      severity?: string;
      ownerRole?: string;
      action?: string;
      trigger?: string;
      command?: string;
      reasonCode?: string;
    }>;
    reasonCodes?: string[];
    recommendedCommands?: string[];
    evaluatedAt?: string;
    requestedBy?: string;
  };
  requestedBy?: string;
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
    retryAuditVolumePassed?: boolean;
    retryAuditDelayPassed?: boolean;
    orchestrationAttemptErrorPassed?: boolean;
    orchestrationAttemptSkippedPassed?: boolean;
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
  retryAudit?: {
    maxEventCountThreshold?: number;
    observedEventCount?: number;
    maxAvgNextDelaySecondsThreshold?: number;
    observedAvgNextDelaySeconds?: number;
    observedMaxNextDelaySeconds?: number | null;
  };
  orchestrationAudit?: {
    maxAttemptErrorCountThreshold?: number;
    observedAttemptErrorCount?: number;
    maxAttemptSkippedCountThreshold?: number;
    observedAttemptSkippedCount?: number;
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

interface ConnectorLookupResult {
  provider?: string;
  selectedProvider?: string;
  resultCount?: number;
  found?: boolean;
  savedCount?: number;
  rateLimit?: {
    windowSeconds?: number;
    limit?: number;
    remaining?: number;
    resetAt?: string;
    resetInSeconds?: number;
  };
  storagePolicy?: {
    maxBytes?: number;
    previewChars?: number;
    truncatedRecordCount?: number;
    truncatedRawRecordCount?: number;
    truncatedEnrichedRecordCount?: number;
  };
  criteria?: {
    providerOrder?: string[];
    providerOrderDiagnostics?: {
      defaultApplied?: boolean;
      duplicatesRemoved?: string[];
      ignoredProviders?: string[];
    };
    [key: string]: any;
  };
  attemptSummary?: {
    total?: number;
    statusCounts?: Record<string, number>;
    reasonCodeCounts?: Record<string, number>;
    providersAttempted?: string[];
    providersWithResults?: string[];
    providersWithoutResults?: string[];
  };
  attempts?: Array<{
    provider: string;
    status: string;
    reasonCode?: string;
    reason?: string;
    statusCode?: number;
    resultCount?: number;
    latencyMs?: number;
    rateLimitRemaining?: number | null;
    rateLimitResetInSeconds?: number | null;
  }>;
  companies?: Array<Record<string, any>>;
  company?: Record<string, any> | null;
}

interface ApolloProspectLookupResult {
  provider?: string;
  resultCount?: number;
  savedCount?: number;
  rateLimit?: {
    windowSeconds?: number;
    limit?: number;
    remaining?: number;
    resetAt?: string;
    resetInSeconds?: number;
  };
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

function getRetryAfterSeconds(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null;
  const candidate = Number((error as any).retryAfterSeconds);
  if (Number.isFinite(candidate) && candidate > 0) {
    return Math.round(candidate);
  }
  return null;
}

function appendRetryHint(message: string, retryAfterSeconds: number | null): string {
  if (!retryAfterSeconds || !message) {
    return message;
  }
  if (message.toLowerCase().includes('retry in')) {
    return message;
  }
  return `${message} Retry in ${retryAfterSeconds}s.`;
}

function isRateLimitError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  return (error as any).status === 429 || (error as any).errorCode === 'connector_rate_limited';
}

function isFeatureDisabledError(error: unknown): boolean {
  return getErrorMessage(error).toLowerCase().includes('disabled by feature flag');
}

function formatConnectorValidationReceived(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return null;
}

function getConnectorValidationMessage(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const errorCode = typeof (error as any).errorCode === 'string'
    ? (error as any).errorCode
    : '';
  if (errorCode === 'invalid_request_required_field') {
    const requiredField =
      typeof (error as any).field === 'string' && (error as any).field.trim()
        ? (error as any).field.trim()
        : null;
    if (requiredField) {
      return `Invalid request: ${requiredField} is required.`;
    }
    return 'Invalid request: required field is missing.';
  }
  if (errorCode !== 'invalid_request_bounds') {
    return null;
  }
  const field =
    typeof (error as any).field === 'string' && (error as any).field.trim()
      ? (error as any).field.trim()
      : null;
  const minimum = Number((error as any).minimum ?? (error as any).min);
  const maximum = Number((error as any).maximum ?? (error as any).max);
  const hasBounds = Number.isFinite(minimum) && Number.isFinite(maximum);
  if (!field || !hasBounds) {
    return getErrorMessage(error);
  }
  const receivedValue = formatConnectorValidationReceived((error as any).received);
  const receivedSuffix = receivedValue ? ` Received: ${receivedValue}.` : '';
  return `Invalid ${field}: expected integer between ${Math.round(minimum)} and ${Math.round(maximum)}.${receivedSuffix}`;
}

function formatTimestamp(value?: string): string {
  if (!value) return 'n/a';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function resolveConnectorRateLimitPressure(
  maxRetryAfterSeconds?: number | null,
  avgResetInSeconds?: number | null
): { label: string; hint: string; toneClass: string } {
  const retrySeconds = Number(maxRetryAfterSeconds);
  const resetSeconds = Number(avgResetInSeconds);
  const signal = Math.max(
    Number.isFinite(retrySeconds) ? retrySeconds : 0,
    Number.isFinite(resetSeconds) ? resetSeconds : 0
  );
  if (signal >= 45) {
    return {
      label: 'High',
      hint: 'Sustained throttling risk. Pause connector rollout expansion and reduce lookup concurrency.',
      toneClass: 'text-rose-700',
    };
  }
  if (signal >= 20) {
    return {
      label: 'Moderate',
      hint: 'Monitor connector traffic and keep rollout guarded until reset windows contract.',
      toneClass: 'text-amber-700',
    };
  }
  if (signal > 0) {
    return {
      label: 'Low',
      hint: 'Current connector throttling pressure is within expected operating bounds.',
      toneClass: 'text-emerald-700',
    };
  }
  return {
    label: 'Unknown',
    hint: 'Insufficient connector rate-limit data in current telemetry window.',
    toneClass: 'text-gray-600',
  };
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
  const [governanceDaysInput, setGovernanceDaysInput] = useState(7);
  const [governanceLimitInput, setGovernanceLimitInput] = useState(1000);
  const [governanceParams, setGovernanceParams] = useState({ days: 7, limit: 1000 });
  const [governanceHistoryRetentionInput, setGovernanceHistoryRetentionInput] = useState(30);
  const [governanceHistoryLimitInput, setGovernanceHistoryLimitInput] = useState(50);
  const [governanceHistoryParams, setGovernanceHistoryParams] = useState({
    retentionDays: 30,
    limit: 50,
  });
  const [snapshotRetentionDaysInput, setSnapshotRetentionDaysInput] = useState(30);
  const [snapshotRetentionDays, setSnapshotRetentionDays] = useState(30);
  const [sloDaysInput, setSloDaysInput] = useState(7);
  const [sloErrorThresholdInput, setSloErrorThresholdInput] = useState(5);
  const [sloSchemaThresholdInput, setSloSchemaThresholdInput] = useState(95);
  const [sloSchemaSampleCountInput, setSloSchemaSampleCountInput] = useState(25);
  const [sloOrchestrationErrorCountInput, setSloOrchestrationErrorCountInput] = useState(5);
  const [sloOrchestrationSkippedCountInput, setSloOrchestrationSkippedCountInput] = useState(25);
  const [sloParams, setSloParams] = useState({
    days: 7,
    maxErrorRatePct: 5,
    minSchemaV2Pct: 95,
    minSchemaV2SampleCount: 25,
    maxOrchestrationAttemptErrorCount: 5,
    maxOrchestrationAttemptSkippedCount: 25,
  });
  const [uiNotice, setUiNotice] = useState<UiNotice | null>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
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
    queryKey: [
      'integrations-telemetry-summary',
      telemetryParams.days,
      telemetryParams.limit,
      recentTelemetryFilter,
      telemetryGovernanceStatusQueryFilter || 'all',
      telemetryPacketStatusQueryFilter || 'all',
    ],
    queryFn: () =>
      api.getIntegrationsTelemetrySummary(
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
    data: governanceReport,
    isLoading: isGovernanceReportLoading,
    error: governanceReportError,
  } = useQuery({
    queryKey: ['integrations-governance-report', governanceParams.days, governanceParams.limit],
    queryFn: () =>
      api.getIntegrationsGovernanceReport(
        governanceParams.days,
        governanceParams.limit
      ) as Promise<IntegrationsGovernanceReportResponse>,
    retry: false,
  });

  const {
    data: governanceReportExport,
    isLoading: isGovernanceReportExportLoading,
    error: governanceReportExportError,
  } = useQuery({
    queryKey: ['integrations-governance-report-export', governanceParams.days, governanceParams.limit],
    queryFn: () =>
      api.getIntegrationsGovernanceReportExport(
        governanceParams.days,
        governanceParams.limit
      ) as Promise<IntegrationsGovernanceReportExportResponse>,
    retry: false,
  });

  const {
    data: governanceReportHistory,
    isLoading: isGovernanceReportHistoryLoading,
    error: governanceReportHistoryError,
  } = useQuery({
    queryKey: [
      'integrations-governance-report-history',
      governanceHistoryParams.retentionDays,
      governanceHistoryParams.limit,
    ],
    queryFn: () =>
      api.getIntegrationsGovernanceReportHistory(
        governanceHistoryParams.retentionDays,
        governanceHistoryParams.limit
      ) as Promise<IntegrationsGovernanceReportHistoryResponse>,
    retry: false,
  });

  const {
    data: governanceSchema,
    isLoading: isGovernanceSchemaLoading,
    error: governanceSchemaError,
  } = useQuery({
    queryKey: ['integrations-governance-schema'],
    queryFn: () =>
      api.getIntegrationsGovernanceSchema() as Promise<IntegrationsGovernanceSchemaResponse>,
    retry: false,
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
      sloParams.minSchemaV2SampleCount,
      sloParams.maxOrchestrationAttemptErrorCount,
      sloParams.maxOrchestrationAttemptSkippedCount,
    ],
    queryFn: () =>
      api.getIntegrationsSloGates({
        days: sloParams.days,
        limit: 2000,
        maxErrorRatePct: sloParams.maxErrorRatePct,
        minSchemaV2Pct: sloParams.minSchemaV2Pct,
        minSchemaV2SampleCount: sloParams.minSchemaV2SampleCount,
        maxOrchestrationAttemptErrorCount: sloParams.maxOrchestrationAttemptErrorCount,
        maxOrchestrationAttemptSkippedCount: sloParams.maxOrchestrationAttemptSkippedCount,
      }) as Promise<IntegrationSloGateResponse>,
    retry: false,
  });

  const signoffRequiredApprovals = sloGates?.signoff?.requiredApprovals || [];
  const signoffRequiredEvidence = sloGates?.signoff?.requiredEvidence || [];
  const hasBaselineGovernance = Boolean(baselineGovernance);
  const baselineRecommendedCommandsCount = (baselineGovernance?.recommendedCommands || [])
    .filter((command) => typeof command === 'string' && command.trim().length > 0)
    .length;
  const baselineGovernanceFallbackCommandsInUse =
    baselineGovernance != null
    && baselineGovernance.status !== 'PASS'
    && baselineRecommendedCommandsCount === 0;
  const baselineOrchestrationGatePass =
    !baselineGovernance?.orchestrationGate
      ? true
      : baselineGovernance.orchestrationGate.available === true
      && baselineGovernance.orchestrationGate.attemptErrorGatePassed === true
      && baselineGovernance.orchestrationGate.attemptSkippedGatePassed === true;
  const baselineGovernancePass =
    !baselineGovernance
      ? true
      : baselineGovernance.status === 'PASS'
      && baselineGovernance.releaseGateFixturePolicy?.passed === true
      && baselineGovernance.releaseGateFixtures?.allProfilesAvailable === true
      && baselineOrchestrationGatePass;
  const hasSchemaCoverageGate = sloGates?.gates?.schemaCoveragePassed != null;
  const hasSchemaSampleGate = sloGates?.gates?.schemaSampleSizePassed != null;
  const hasOrchestrationErrorGate = sloGates?.gates?.orchestrationAttemptErrorPassed != null;
  const hasOrchestrationSkippedGate = sloGates?.gates?.orchestrationAttemptSkippedPassed != null;
  const hasSignoffStatus = Boolean(sloGates?.signoff?.status);
  const isSignoffTraceabilityReady =
    Boolean(sloGates?.gates?.schemaCoveragePassed) &&
    Boolean(sloGates?.gates?.schemaSampleSizePassed) &&
    Boolean(sloGates?.gates?.orchestrationAttemptErrorPassed) &&
    Boolean(sloGates?.gates?.orchestrationAttemptSkippedPassed) &&
    sloGates?.signoff?.status === 'READY_FOR_APPROVAL' &&
    signoffRequiredApprovals.length > 0 &&
    signoffRequiredEvidence.length > 0 &&
    baselineGovernancePass;
  const signoffTraceabilityStatus =
    !hasSignoffStatus
      || !hasSchemaCoverageGate
      || !hasSchemaSampleGate
      || !hasOrchestrationErrorGate
      || !hasOrchestrationSkippedGate
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
          !sloGates?.gates?.orchestrationAttemptErrorPassed
            ? 'Reduce orchestration attempt errors to satisfy orchestration SLO gate thresholds.'
            : null,
          !sloGates?.gates?.orchestrationAttemptSkippedPassed
            ? 'Reduce orchestration skipped attempts (for example missing domain inputs) before rollout.'
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
          hasBaselineGovernance && !baselineGovernancePass
            ? 'Baseline fixture governance is failing. Resolve baseline-governance policy failures before rollout signoff.'
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
      const parsedLimit = Number(lookupLimit);
      if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 25) {
        throw new Error('Invalid limit: expected integer between 1 and 25.');
      }
      const payload = {
        domain: lookupDomain.trim() || undefined,
        companyName: lookupCompanyName.trim() || undefined,
        limit: parsedLimit,
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
      const validationMessage = getConnectorValidationMessage(error);
      const retryAfterSeconds = getRetryAfterSeconds(error);
      const baseMessage = validationMessage || getErrorMessage(error);
      const message = appendRetryHint(baseMessage, retryAfterSeconds);
      setCompanyLookupResult(null);
      setCompanyLookupError(message);
      if (isRateLimitError(error) && retryAfterSeconds) {
        setUiNotice({ tone: 'info', message: `Connector rate limit reached. Retry in ${retryAfterSeconds}s.` });
      } else {
        setUiNotice({ tone: 'error', message: `Company lookup failed: ${message}` });
      }
    },
  });

  const apolloProspectMutation = useMutation({
    mutationFn: async () => {
      const parsedLimit = Number(apolloLimit);
      if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
        throw new Error('Invalid limit: expected integer between 1 and 100.');
      }
      const payload = {
        query: apolloQuery.trim() || undefined,
        title: apolloTitle.trim() || undefined,
        domain: apolloDomain.trim() || undefined,
        limit: parsedLimit,
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
      const validationMessage = getConnectorValidationMessage(error);
      const retryAfterSeconds = getRetryAfterSeconds(error);
      const baseMessage = validationMessage || getErrorMessage(error);
      const message = appendRetryHint(baseMessage, retryAfterSeconds);
      setApolloLookupResult(null);
      setApolloLookupError(message);
      if (isRateLimitError(error) && retryAfterSeconds) {
        setUiNotice({ tone: 'info', message: `Connector rate limit reached. Retry in ${retryAfterSeconds}s.` });
      } else {
        setUiNotice({ tone: 'error', message: `Apollo lookup failed: ${message}` });
      }
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
  const integrationHealthFreshnessRows = buildIntegrationHealthFreshnessRows(
    integrationsHealth?.credentialFreshnessByProvider || {}
  );
  const integrationHealthExportMetadata = buildIntegrationHealthExportMetadata(
    integrationsHealth
  );
  const integrationHealthStatus =
    integrationHealthExportMetadata.exportIntegrationHealthStatus;
  const integrationHealthFreshnessStatusCountsSummary = formatTelemetryStatusCountMap(
    integrationHealthExportMetadata.exportIntegrationHealthCredentialFreshnessStatusCounts
  );
  const integrationHealthFreshnessStatusCountsServerSummary = formatTelemetryStatusCountMap(
    integrationHealthExportMetadata.exportIntegrationHealthCredentialFreshnessStatusCountsServer
  );
  const integrationHealthFreshnessStatusCountsFallbackSummary = formatTelemetryStatusCountMap(
    integrationHealthExportMetadata.exportIntegrationHealthCredentialFreshnessStatusCountsFallback
  );

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
  const governanceStatusRows = Object.entries(telemetrySummary?.governanceAudit?.statusCounts || {}).sort(([a], [b]) => a.localeCompare(b));
  const governanceSchemaStatusRows = Object.entries(telemetrySummary?.governanceSchemaAudit?.statusCounts || {}).sort(([a], [b]) => a.localeCompare(b));
  const packetValidationStatusRows = Object.entries(telemetrySummary?.packetValidationAudit?.statusCounts || {}).sort(([a], [b]) => a.localeCompare(b));
  const retryAuditOperationRows = Object.entries(telemetrySummary?.retryAudit?.byOperation || {}).sort(([a], [b]) => a.localeCompare(b));
  const retryAuditProviderRows = Object.entries(telemetrySummary?.retryAudit?.byProvider || {}).sort(([a], [b]) => a.localeCompare(b));
  const orchestrationAuditProviderRows = Object.entries(
    telemetrySummary?.orchestrationAudit?.bySelectedProvider || {}
  ).sort(([a], [b]) => a.localeCompare(b));
  const orchestrationAuditReasonCodeRows = Object.entries(
    telemetrySummary?.orchestrationAudit?.reasonCodeCounts || {}
  ).sort(([a], [b]) => a.localeCompare(b));
  const orchestrationAuditTrendRows = (telemetrySummary?.orchestrationAudit?.trendByDay || []).slice(-7);
  const connectorRateLimitRows = Object.entries(telemetrySummary?.connectorRateLimit?.byEndpoint || {}).sort(([a], [b]) => a.localeCompare(b));
  const connectorValidationEndpointRows = Object.entries(
    telemetrySummary?.connectorValidation?.byEndpoint || {}
  ).sort(([a], [b]) => a.localeCompare(b));
  const connectorValidationProviderRows = Object.entries(
    telemetrySummary?.connectorValidation?.byProvider || {}
  ).sort(([a], [b]) => a.localeCompare(b));
  const connectorValidationFieldRows = Object.entries(
    telemetrySummary?.connectorValidation?.byField || {}
  ).sort(([a], [b]) => a.localeCompare(b));
  const connectorValidationReasonRows = Object.entries(
    telemetrySummary?.connectorValidation?.byReason || {}
  ).sort(([a], [b]) => a.localeCompare(b));
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
  const companyLookupDiagnostics = companyLookupResult?.criteria?.providerOrderDiagnostics;
  const companyLookupAttemptSummary = companyLookupResult?.attemptSummary;
  const companyLookupAttemptStatusRows = Object.entries(
    companyLookupAttemptSummary?.statusCounts || {}
  ).sort(([a], [b]) => a.localeCompare(b));
  const companyLookupAttemptReasonRows = Object.entries(
    companyLookupAttemptSummary?.reasonCodeCounts || {}
  ).sort(([a], [b]) => a.localeCompare(b));
  const companyLookupAttemptRows = (companyLookupResult?.attempts || []).slice(0, 5);
  const companyLookupDuplicateProviders = companyLookupDiagnostics?.duplicatesRemoved || [];
  const companyLookupIgnoredProviders = companyLookupDiagnostics?.ignoredProviders || [];
  const governanceReportStatusRows = Object.entries(governanceReport?.governanceStatusCounts || {}).sort(([a], [b]) => a.localeCompare(b));
  const governanceReportDecisionRows = Object.entries(governanceReport?.traceabilityDecisionCounts || {}).sort(([a], [b]) => a.localeCompare(b));
  const governanceTrendRows = governanceReport?.timeline || [];
  const governanceLatestRows = governanceReport?.latestEvents || [];
  const governanceHistoryRows = governanceReportHistory?.items || [];
  const governanceHistorySchemaRows = Object.entries(
    governanceReportHistory?.schemaVersionCounts
      || governanceHistoryRows.reduce<Record<string, number>>((acc, row) => {
        const key = String(row?.exportSchemaVersion ?? "unknown");
        acc[key] = Number(acc[key] || 0) + 1;
        return acc;
      }, {})
  ).sort(([a], [b]) => a.localeCompare(b));
  const governanceDuplicateArtifactNames = governanceReportHistory?.duplicateArtifactNames || [];
  const governanceSchemaSupportedVersions =
    governanceSchema?.schemaMetadata?.supportedVersions || [];
  const governanceSchemaCommands = governanceSchema?.recommendedCommands || [];
  const governanceSchemaAlerts = governanceSchema?.alerts || [];
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
  const governanceExportCommands = governanceReportExport?.recommendedCommands || [];
  const governanceExportStatus =
    governanceReportExport?.status
    || governanceReport?.status
    || governanceReportHistory?.status
    || 'UNKNOWN';
  const governanceExportSchemaVersion =
    governanceReportExport?.exportSchemaVersion
    ?? governanceReportExport?.governanceExport?.exportSchemaVersion
    ?? governanceReport?.exportSchemaVersion
    ?? governanceReport?.governanceExport?.exportSchemaVersion
    ?? governanceReportHistory?.exportSchemaVersion
    ?? governanceReportHistory?.governanceExport?.exportSchemaVersion
    ?? governanceReportHistory?.latestArtifact?.exportSchemaVersion
    ?? null;
  const governanceExportRolloutBlocked = Boolean(
    governanceReportExport?.governanceExport?.rolloutBlocked
    ?? governanceReport?.handoff?.rolloutBlocked
    ?? governanceReportHistory?.governanceExport?.rolloutBlocked
      ?? false
  );
  const governanceExportOwnerRole =
    governanceReportExport?.governanceExport?.ownerRole
    || governanceReport?.handoff?.ownerRole
    || governanceReportHistory?.governanceExport?.ownerRole
    || 'Release Manager';
  const governanceExportAlert =
    governanceReportExport?.governanceExport?.alerts?.[0]?.message
    || governanceReport?.alerts?.[0]
    || governanceReportHistory?.alerts?.[0]
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
  const governanceConnectorRateLimitRows = Object.entries(
    governanceConnectorRateLimit?.byEndpoint || {}
  ).sort(([a], [b]) => a.localeCompare(b));
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
  const governanceHandoffExportPayload = (() => {
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
  })();
  const governanceHistoryExportPayload = (() => {
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
      ...(sourcePayload as unknown as Record<string, unknown>),
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
  })();
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
  const recentTelemetryRows = (telemetrySummary?.recentEvents || []).map((row) => ({
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
  }));
  const filteredRecentTelemetryRows = effectiveRecentTelemetryFilter === 'packet'
    ? recentTelemetryRows.filter((row) => Boolean(row.governancePacketValidationStatus))
    : recentTelemetryRows;
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
  const retryTerminalSummary = buildRetryTerminalSummary(filteredRecentTelemetryRows);
  const retryTerminalOutcomeRows = Object.entries(retryTerminalSummary.outcomeCounts).sort(
    ([left], [right]) => left.localeCompare(right)
  );
  const retryTerminalReasonCodeRows = Object.entries(retryTerminalSummary.reasonCodeCounts).sort(
    ([left], [right]) => left.localeCompare(right)
  );
  const retryTerminalStatusCodeRows = Object.entries(retryTerminalSummary.statusCodeCounts).sort(
    ([left], [right]) => Number(left) - Number(right)
  );
  const retryTerminalPressure = resolveRetryTerminalPressure(retryTerminalSummary);
  const retryTerminalTopOutcome = getRetryTerminalTopEntry(retryTerminalSummary.outcomeCounts);
  const retryTerminalTopReasonCode = getRetryTerminalTopEntry(retryTerminalSummary.reasonCodeCounts);
  const retryTerminalTopStatusCode = getRetryTerminalTopEntry(retryTerminalSummary.statusCodeCounts);
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

  const refreshGovernanceReport = () => {
    const normalizedDays = Math.min(Math.max(Number(governanceDaysInput) || 7, 1), 30);
    const normalizedLimit = Math.min(Math.max(Number(governanceLimitInput) || 1000, 50), 5000);
    const normalizedHistoryRetentionDays = Math.min(
      Math.max(Number(governanceHistoryRetentionInput) || 30, 1),
      365
    );
    const normalizedHistoryLimit = Math.min(
      Math.max(Number(governanceHistoryLimitInput) || 50, 1),
      500
    );
    setGovernanceParams({ days: normalizedDays, limit: normalizedLimit });
    setGovernanceHistoryParams({
      retentionDays: normalizedHistoryRetentionDays,
      limit: normalizedHistoryLimit,
    });
    if (
      normalizedDays !== governanceDaysInput
      || normalizedLimit !== governanceLimitInput
      || normalizedHistoryRetentionDays !== governanceHistoryRetentionInput
      || normalizedHistoryLimit !== governanceHistoryLimitInput
    ) {
      setUiNotice({
        tone: 'info',
        message: 'Governance report/history filter values were normalized to allowed bounds.',
      });
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
    const normalizedOrchestrationErrorCount = Math.min(
      Math.max(Number(sloOrchestrationErrorCountInput) || 5, 0),
      5000
    );
    const normalizedOrchestrationSkippedCount = Math.min(
      Math.max(Number(sloOrchestrationSkippedCountInput) || 25, 0),
      5000
    );
    setSloParams({
      days: normalizedDays,
      maxErrorRatePct: normalizedErrorRate,
      minSchemaV2Pct: normalizedSchemaRate,
      minSchemaV2SampleCount: normalizedSchemaSampleCount,
      maxOrchestrationAttemptErrorCount: normalizedOrchestrationErrorCount,
      maxOrchestrationAttemptSkippedCount: normalizedOrchestrationSkippedCount,
    });
    if (
      normalizedDays !== sloDaysInput
      || normalizedErrorRate !== sloErrorThresholdInput
      || normalizedSchemaRate !== sloSchemaThresholdInput
      || normalizedSchemaSampleCount !== sloSchemaSampleCountInput
      || normalizedOrchestrationErrorCount !== sloOrchestrationErrorCountInput
      || normalizedOrchestrationSkippedCount !== sloOrchestrationSkippedCountInput
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

  const downloadTextSnapshot = (filePrefix: string, payload: string) => {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const blob = new Blob([payload], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${filePrefix}-${timestamp}.txt`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (error) {
      setUiNotice({ tone: 'error', message: `Command export failed: ${getErrorMessage(error)}` });
    }
  };

  const buildCompanyLookupExportPayload = () => {
    if (!companyLookupResult) {
      return null;
    }
    const normalizedDomain = lookupDomain.trim();
    const normalizedCompanyName = lookupCompanyName.trim();
    const normalizedLimit = Math.min(Math.max(Number(lookupLimit) || 10, 1), 25);
    const selectedProvider = companyLookupResult.selectedProvider || companyLookupResult.provider || null;
    const resultRows = companyLookupResult.companies
      || (companyLookupResult.company ? [companyLookupResult.company] : []);
    const topCompany = resultRows[0] || null;
    return {
      exportSchemaVersion: CONNECTOR_LOOKUP_EXPORT_SCHEMA_VERSION,
      exportGeneratedAt: new Date().toISOString(),
      exportType: 'connector_company_lookup',
      exportRequestedProvider: lookupProvider,
      exportRequestedDomain: normalizedDomain || null,
      exportRequestedCompanyName: normalizedCompanyName || null,
      exportRequestedLimit: normalizedLimit,
      exportRequestedSaveResearch: Boolean(saveLookupResearch),
      exportSelectedProvider: selectedProvider,
      exportResultCount: Number(companyLookupResult.resultCount || resultRows.length || 0),
      exportSavedCount:
        typeof companyLookupResult.savedCount === 'number'
          ? companyLookupResult.savedCount
          : null,
      exportRateLimit: companyLookupResult.rateLimit || null,
      exportStoragePolicy: companyLookupResult.storagePolicy || null,
      exportAttemptSummary: companyLookupResult.attemptSummary || null,
      exportAttemptRows: companyLookupResult.attempts || [],
      exportProviderOrderDiagnostics:
        companyLookupResult.criteria?.providerOrderDiagnostics || null,
      exportTopCompany: topCompany,
      exportCompanies: resultRows,
    };
  };

  const buildApolloLookupExportPayload = () => {
    if (!apolloLookupResult) {
      return null;
    }
    const normalizedQuery = apolloQuery.trim();
    const normalizedTitle = apolloTitle.trim();
    const normalizedDomain = apolloDomain.trim();
    const normalizedLimit = Math.min(Math.max(Number(apolloLimit) || 25, 1), 100);
    const topProspect = apolloLookupResult.prospects?.[0] || null;
    return {
      exportSchemaVersion: CONNECTOR_LOOKUP_EXPORT_SCHEMA_VERSION,
      exportGeneratedAt: new Date().toISOString(),
      exportType: 'connector_apollo_lookup',
      exportRequestedQuery: normalizedQuery || null,
      exportRequestedTitle: normalizedTitle || null,
      exportRequestedDomain: normalizedDomain || null,
      exportRequestedLimit: normalizedLimit,
      exportRequestedSaveResults: Boolean(saveApolloProspects),
      exportProvider: apolloLookupResult.provider || 'apollo',
      exportResultCount: Number(apolloLookupResult.resultCount || 0),
      exportSavedCount:
        typeof apolloLookupResult.savedCount === 'number'
          ? apolloLookupResult.savedCount
          : null,
      exportRateLimit: apolloLookupResult.rateLimit || null,
      exportTopProspect: topProspect,
      exportProspects: apolloLookupResult.prospects || [],
    };
  };

  const collectGovernanceCommands = (
    handoffActions: string[] | undefined,
    rolloutActions:
      | Array<{ command?: string; action?: string }>
      | undefined
  ): string[] => {
    const commandSet = new Set<string>();
    for (const item of rolloutActions || []) {
      const command = String(item.command || '').trim();
      if (command) {
        commandSet.add(command);
      }
    }
    if (commandSet.size === 0) {
      for (const action of handoffActions || []) {
        const normalized = String(action || '').trim();
        if (normalized) {
          commandSet.add(`# ${normalized}`);
        }
      }
    }
    return Array.from(commandSet);
  };

  const collectBaselineGovernanceCommands = (
    payload: IntegrationBaselineGovernanceResponse | undefined
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
    const addCommand = (value: string | undefined) => {
      const normalized = String(value || '').trim();
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
    const backendRecommendedCommands = Array.isArray(payload?.recommendedCommands)
      ? payload?.recommendedCommands || []
      : [];
    for (const command of backendRecommendedCommands) {
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

    const orchestrationGate = payload?.orchestrationGate;
    const hasOrchestrationRemediation =
      !!orchestrationGate
      && (
        orchestrationGate.available !== true
        || orchestrationGate.attemptErrorGatePassed !== true
        || orchestrationGate.attemptSkippedGatePassed !== true
      );

    if (!ordered.length && hasOrchestrationRemediation) {
      addCommand(remediationWrapperCommand);
      ensureAliasArtifactChainAfterWrapper();
    }
    if (!ordered.length && payload?.status && payload.status !== 'PASS') {
      addCommand(baselineDriftCommand);
    }

    const hasWrapper = ordered.includes(remediationWrapperCommand);
    for (const command of collectGovernanceCommands(payload?.handoff?.actions, payload?.rolloutActions)) {
      if (hasWrapper && legacyOrchestrationChain.has(command)) {
        continue;
      }
      addCommand(command);
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

  const copyGovernanceCommands = async (label: string, commands: string[]) => {
    if (!commands.length) {
      setUiNotice({ tone: 'info', message: `No ${label.toLowerCase()} commands available to copy.` });
      return;
    }
    const payload = commands.join('\n');
    const normalizedLabel = label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'governance';
    try {
      if (!navigator?.clipboard?.writeText) {
        downloadTextSnapshot(`${normalizedLabel}-commands`, payload);
        setUiNotice({
          tone: 'info',
          message: `Clipboard unavailable. ${label} commands downloaded.`,
        });
        return;
      }
      await navigator.clipboard.writeText(payload);
      setUiNotice({ tone: 'success', message: `${label} commands copied.` });
    } catch (error) {
      setUiNotice({ tone: 'error', message: `Copy failed: ${getErrorMessage(error)}` });
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
          {!!integrationsHealth?.credentialActionRequiredProviders?.length && (
            <div
              data-testid="integrations-credential-stale-warning"
              className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900"
            >
              Credential freshness warning for: {integrationsHealth.credentialActionRequiredProviders.join(', ')}.
              Rotation max age: {integrationsHealth.credentialRotationMaxAgeDays ?? 'n/a'} days.
            </div>
          )}
          {!!integrationsHealth && (
            <div
              data-testid="integrations-health-summary-card"
              className="rounded-md border bg-white px-3 py-3 text-xs"
            >
              <div className="font-medium text-gray-500 mb-2">
                Connector Credential Freshness
              </div>
              <div className="grid gap-2 md:grid-cols-4">
                <div className="rounded-md border px-2 py-1">
                  <div className="text-gray-500">Health Status</div>
                  <div className="font-semibold">{integrationHealthStatus}</div>
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
              {integrationHealthFreshnessRows.length > 0 ? (
                <div className="mt-2 grid gap-1 md:grid-cols-2">
                  {integrationHealthFreshnessRows.slice(0, 6).map((row) => (
                    <div
                      key={`integrations-health-freshness-${row.provider}`}
                      className="flex items-center justify-between rounded border border-slate-100 px-2 py-1"
                    >
                      <span>{row.provider}</span>
                      <span>{row.status}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-2 text-gray-500">
                  No connector freshness telemetry yet.
                </div>
              )}
            </div>
          )}
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
                    <p className="text-xs text-gray-500">
                      Configured At: {formatTimestamp(integrations.apollo_configured_at || healthByProvider.apollo?.configuredAt || undefined)}
                    </p>
                    <p className="text-xs text-gray-500">
                      Last Rotated: {formatTimestamp(integrations.apollo_last_rotated_at || healthByProvider.apollo?.lastRotatedAt || undefined)}
                    </p>
                    {healthByProvider.apollo?.credentialStale && (
                      <p
                        data-testid="integrations-credential-stale-apollo"
                        className="text-xs text-amber-700"
                      >
                        Credential freshness warning.
                        Rotation age: {healthByProvider.apollo?.credentialRotationAgeDays ?? 'n/a'} days.
                      </p>
                    )}
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
                    <p className="text-xs text-gray-500">
                      Configured At: {formatTimestamp(integrations.clearbit_configured_at || healthByProvider.clearbit?.configuredAt || undefined)}
                    </p>
                    <p className="text-xs text-gray-500">
                      Last Rotated: {formatTimestamp(integrations.clearbit_last_rotated_at || healthByProvider.clearbit?.lastRotatedAt || undefined)}
                    </p>
                    {healthByProvider.clearbit?.credentialStale && (
                      <p
                        data-testid="integrations-credential-stale-clearbit"
                        className="text-xs text-amber-700"
                      >
                        Credential freshness warning.
                        Rotation age: {healthByProvider.clearbit?.credentialRotationAgeDays ?? 'n/a'} days.
                      </p>
                    )}
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
                    <p className="text-xs text-gray-500">
                      Configured At: {formatTimestamp(integrations.crunchbase_configured_at || healthByProvider.crunchbase?.configuredAt || undefined)}
                    </p>
                    <p className="text-xs text-gray-500">
                      Last Rotated: {formatTimestamp(integrations.crunchbase_last_rotated_at || healthByProvider.crunchbase?.lastRotatedAt || undefined)}
                    </p>
                    {healthByProvider.crunchbase?.credentialStale && (
                      <p
                        data-testid="integrations-credential-stale-crunchbase"
                        className="text-xs text-amber-700"
                      >
                        Credential freshness warning.
                        Rotation age: {healthByProvider.crunchbase?.credentialRotationAgeDays ?? 'n/a'} days.
                      </p>
                    )}
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
                  onChange={(e) => setLookupLimit(e.target.value === '' ? 0 : Number(e.target.value))}
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
                {companyLookupResult.rateLimit && (
                  <div>
                    Rate Limit: {companyLookupResult.rateLimit.remaining ?? 'n/a'} remaining / {companyLookupResult.rateLimit.limit ?? 'n/a'} in {companyLookupResult.rateLimit.windowSeconds ?? 'n/a'}s
                  </div>
                )}
                {companyLookupResult.rateLimit?.resetAt && (
                  <div>
                    Rate Limit Reset At: {formatTimestamp(companyLookupResult.rateLimit.resetAt)}
                  </div>
                )}
                {typeof companyLookupResult.rateLimit?.resetInSeconds === 'number' && companyLookupResult.rateLimit.resetInSeconds > 0 && (
                  <div>
                    Rate Limit Reset In: {Math.round(companyLookupResult.rateLimit.resetInSeconds)}s
                  </div>
                )}
                {!!companyLookupResult.attempts?.length && (
                  <div className="space-y-1">
                    <div>Attempts: {companyLookupResult.attempts.length}</div>
                    {companyLookupAttemptSummary && (
                      <div>
                        Attempt Summary: success {companyLookupAttemptSummary.statusCounts?.success ?? 0} • skipped {companyLookupAttemptSummary.statusCounts?.skipped ?? 0} • error {companyLookupAttemptSummary.statusCounts?.error ?? 0}
                      </div>
                    )}
                    {companyLookupAttemptReasonRows.length > 0 && (
                      <div>
                        Attempt Reasons: {companyLookupAttemptReasonRows.map(([reasonCode, count]) => `${reasonCode} ${count}`).join(' • ')}
                      </div>
                    )}
                    {companyLookupAttemptRows.length > 0 && (
                      <div>
                        Attempt Diagnostics: {companyLookupAttemptRows.map((attempt) => {
                          const latency = typeof attempt.latencyMs === 'number' ? `${attempt.latencyMs.toFixed(1)}ms` : 'n/a';
                          const reasonCode = attempt.reasonCode || attempt.reason || 'unknown';
                          return `${attempt.provider}:${attempt.status}:${reasonCode}:${latency}`;
                        }).join(' | ')}
                      </div>
                    )}
                  </div>
                )}
                {companyLookupDiagnostics && (
                  <div>
                    Provider Order Diagnostics: defaultApplied {companyLookupDiagnostics.defaultApplied ? 'yes' : 'no'} • duplicates {companyLookupDuplicateProviders.length ? companyLookupDuplicateProviders.join(', ') : 'none'} • ignored {companyLookupIgnoredProviders.length ? companyLookupIgnoredProviders.join(', ') : 'none'}
                  </div>
                )}
                {companyLookupResult.storagePolicy && (
                  <div>
                    Storage Policy: max {companyLookupResult.storagePolicy.maxBytes ?? 'n/a'} bytes • preview {companyLookupResult.storagePolicy.previewChars ?? 'n/a'} chars • truncated {companyLookupResult.storagePolicy.truncatedRecordCount ?? 0} (raw {companyLookupResult.storagePolicy.truncatedRawRecordCount ?? 0}, enriched {companyLookupResult.storagePolicy.truncatedEnrichedRecordCount ?? 0})
                  </div>
                )}
                {companyResultRows.length > 0 && (
                  <div>
                    Top Company: {companyResultRows[0]?.name || companyResultRows[0]?.companyName || companyResultRows[0]?.domain || 'n/a'}
                  </div>
                )}
                <div className="pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const payload = buildCompanyLookupExportPayload();
                      if (!payload) {
                        setUiNotice({ tone: 'error', message: 'No company lookup result available to export.' });
                        return;
                      }
                      downloadJsonSnapshot('connector-company-lookup', payload);
                    }}
                  >
                    Export Company Lookup JSON
                  </Button>
                </div>
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
                  onChange={(e) => setApolloLimit(e.target.value === '' ? 0 : Number(e.target.value))}
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
                {apolloLookupResult.rateLimit && (
                  <div>
                    Rate Limit: {apolloLookupResult.rateLimit.remaining ?? 'n/a'} remaining / {apolloLookupResult.rateLimit.limit ?? 'n/a'} in {apolloLookupResult.rateLimit.windowSeconds ?? 'n/a'}s
                  </div>
                )}
                {apolloLookupResult.rateLimit?.resetAt && (
                  <div>
                    Rate Limit Reset At: {formatTimestamp(apolloLookupResult.rateLimit.resetAt)}
                  </div>
                )}
                {typeof apolloLookupResult.rateLimit?.resetInSeconds === 'number' && apolloLookupResult.rateLimit.resetInSeconds > 0 && (
                  <div>
                    Rate Limit Reset In: {Math.round(apolloLookupResult.rateLimit.resetInSeconds)}s
                  </div>
                )}
                {!!apolloLookupResult.prospects?.length && (
                  <div>
                    Top Prospect: {apolloLookupResult.prospects[0]?.fullName || apolloLookupResult.prospects[0]?.email || 'n/a'}
                  </div>
                )}
                <div className="pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const payload = buildApolloLookupExportPayload();
                      if (!payload) {
                        setUiNotice({ tone: 'error', message: 'No Apollo lookup result available to export.' });
                        return;
                      }
                      downloadJsonSnapshot('connector-apollo-prospect-lookup', payload);
                    }}
                  >
                    Export Apollo Lookup JSON
                  </Button>
                </div>
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
          <div className="grid md:grid-cols-10 gap-3">
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
            <div>
              <label className="text-xs text-gray-500">Governance Status</label>
              <select
                data-testid="recent-events-governance-status-select"
                value={recentTelemetryGovernanceStatusFilter}
                onChange={(e) =>
                  setRecentTelemetryGovernanceStatusFilter(
                    e.target.value as (typeof TELEMETRY_GOVERNANCE_STATUS_FILTER_OPTIONS)[number]
                  )
                }
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              >
                {TELEMETRY_GOVERNANCE_STATUS_FILTER_OPTIONS.map((option) => (
                  <option key={`integrations-governance-status-${option}`} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">Packet Status</label>
              <select
                data-testid="recent-events-packet-status-select"
                value={recentTelemetryPacketStatusFilter}
                onChange={(e) =>
                  setRecentTelemetryPacketStatusFilter(
                    e.target.value as (typeof TELEMETRY_PACKET_STATUS_FILTER_OPTIONS)[number]
                  )
                }
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              >
                {TELEMETRY_PACKET_STATUS_FILTER_OPTIONS.map((option) => (
                  <option key={`integrations-packet-status-${option}`} value={option}>
                    {option}
                  </option>
                ))}
              </select>
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
                onClick={() =>
                  downloadJsonSnapshot(
                    'connector-telemetry-summary',
                    telemetrySummary
                      ? {
                          ...telemetrySummary,
                          recentEvents: recentTelemetryRows,
                          exportSchemaVersion: TELEMETRY_EXPORT_SCHEMA_VERSION,
                          exportRequestedWindowDays: telemetryParams.days,
                          exportRequestedLimit: telemetryParams.limit,
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
                          ...integrationHealthExportMetadata,
                          exportRetryAuditEventCount: telemetrySummary.retryAudit?.eventCount ?? 0,
                          exportRetryAuditLatestEventAt: telemetrySummary.retryAudit?.latestEventAt ?? null,
                          exportRetryAuditMaxNextDelaySeconds: telemetrySummary.retryAudit?.maxNextDelaySeconds ?? null,
                          exportRetryAuditAvgNextDelaySeconds: telemetrySummary.retryAudit?.avgNextDelaySeconds ?? null,
                          exportRetryAuditOperationCount: Object.keys(telemetrySummary.retryAudit?.byOperation || {}).length,
                          exportRetryAuditProviderCount: Object.keys(telemetrySummary.retryAudit?.byProvider || {}).length,
                          exportConnectorValidationEventCount: telemetrySummary.connectorValidation?.eventCount ?? 0,
                          exportConnectorValidationLatestEventAt: telemetrySummary.connectorValidation?.latestEventAt ?? null,
                          exportConnectorValidationEndpointCount: Object.keys(telemetrySummary.connectorValidation?.byEndpoint || {}).length,
                          exportConnectorValidationProviderCount: Object.keys(telemetrySummary.connectorValidation?.byProvider || {}).length,
                          exportConnectorValidationFieldCount: Object.keys(telemetrySummary.connectorValidation?.byField || {}).length,
                          exportConnectorValidationReasonCount: Object.keys(telemetrySummary.connectorValidation?.byReason || {}).length,
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
                          exportSchemaVersion: TELEMETRY_EXPORT_SCHEMA_VERSION,
                          exportRequestedWindowDays: telemetryParams.days,
                          exportRequestedLimit: telemetryParams.limit,
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
                          ...integrationHealthExportMetadata,
                          exportRetryAuditEventCount: 0,
                          exportRetryAuditLatestEventAt: null,
                          exportRetryAuditMaxNextDelaySeconds: null,
                          exportRetryAuditAvgNextDelaySeconds: null,
                          exportRetryAuditOperationCount: 0,
                          exportRetryAuditProviderCount: 0,
                          exportConnectorValidationEventCount: 0,
                          exportConnectorValidationLatestEventAt: null,
                          exportConnectorValidationEndpointCount: 0,
                          exportConnectorValidationProviderCount: 0,
                          exportConnectorValidationFieldCount: 0,
                          exportConnectorValidationReasonCount: 0,
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
              <div className="grid md:grid-cols-11 gap-3">
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
                <div className="rounded-md border p-3">
                  <div className="text-xs text-gray-500">Governance Audits</div>
                  <div className="text-xl font-semibold">{telemetrySummary.governanceAudit?.eventCount || 0}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    snapshot {telemetrySummary.governanceAudit?.snapshotEvaluationCount || 0} • baseline {telemetrySummary.governanceAudit?.baselineEvaluationCount || 0}
                  </div>
                </div>
                <div data-testid="integrations-governance-schema-audit-card" className="rounded-md border p-3">
                  <div className="text-xs text-gray-500">Governance Schema Audits</div>
                  <div className="text-xl font-semibold">{telemetrySummary.governanceSchemaAudit?.eventCount || 0}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    ready {telemetrySummary.governanceSchemaAudit?.statusCounts?.READY || 0}
                    {' '}• action required {telemetrySummary.governanceSchemaAudit?.statusCounts?.ACTION_REQUIRED || 0}
                  </div>
                  <div className={`text-xs mt-1 ${governanceSchemaAuditParityToneClass}`}>
                    Parity posture: {governanceSchemaAuditParityStatus}
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-gray-500">Packet Validation Audits</div>
                  <div className="text-xl font-semibold">{telemetrySummary.packetValidationAudit?.eventCount || 0}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    within {telemetrySummary.packetValidationAudit?.withinFreshnessCount || 0} • outside {telemetrySummary.packetValidationAudit?.outsideFreshnessCount || 0}
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-gray-500">Connector Rate-Limit Audits</div>
                  <div className="text-xl font-semibold">{telemetrySummary.connectorRateLimit?.eventCount || 0}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    latest {formatTimestamp(telemetrySummary.connectorRateLimit?.latestEventAt || undefined)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    max retry {telemetrySummary.connectorRateLimit?.maxRetryAfterSeconds ?? 'n/a'}s • avg reset {telemetrySummary.connectorRateLimit?.avgResetInSeconds ?? 'n/a'}s
                  </div>
                  <div className={`text-xs mt-1 ${connectorRateLimitPressure.toneClass}`}>
                    Pressure: {connectorRateLimitPressure.label}
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-gray-500">Connector Input-Validation Audits</div>
                  <div className="text-xl font-semibold">{telemetrySummary.connectorValidation?.eventCount || 0}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    latest {formatTimestamp(telemetrySummary.connectorValidation?.latestEventAt || undefined)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    endpoints {connectorValidationEndpointRows.length} • fields {connectorValidationFieldRows.length}
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-gray-500">Retry Audits</div>
                  <div className="text-xl font-semibold">{telemetrySummary.retryAudit?.eventCount || 0}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    latest {formatTimestamp(telemetrySummary.retryAudit?.latestEventAt || undefined)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    max next delay {telemetrySummary.retryAudit?.maxNextDelaySeconds ?? 'n/a'}s • avg next delay {telemetrySummary.retryAudit?.avgNextDelaySeconds ?? 'n/a'}s
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-gray-500">Orchestration Audits</div>
                  <div className="text-xl font-semibold">{telemetrySummary.orchestrationAudit?.eventCount || 0}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    latest {formatTimestamp(telemetrySummary.orchestrationAudit?.latestEventAt || undefined)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    max attempts {telemetrySummary.orchestrationAudit?.maxAttemptCount ?? 'n/a'} • avg attempts {telemetrySummary.orchestrationAudit?.avgAttemptCount ?? 'n/a'}
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-3">
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
                <div className="text-xs font-medium text-gray-500 mb-2">Governance Audit Status</div>
                <div className="text-xs text-gray-500 mb-2">
                  Latest evaluation: {formatTimestamp(telemetrySummary.governanceAudit?.latestEvaluatedAt || undefined)}
                </div>
                <div className="space-y-1 text-sm text-gray-700">
                  {governanceStatusRows.length === 0 && (
                    <div className="text-gray-500">No governance audit events in current window.</div>
                  )}
                  {governanceStatusRows.map(([status, count]) => (
                    <div key={`governance-${status}`} className="flex items-center justify-between">
                      <span>{status}</span>
                      <span>{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div data-testid="integrations-governance-schema-audit-status" className="rounded-md border p-3">
                <div className="text-xs font-medium text-gray-500 mb-2">Governance Schema Audit Status</div>
                <div className="text-xs text-gray-500 mb-2">
                  Latest evaluation: {formatTimestamp(telemetrySummary.governanceSchemaAudit?.latestEvaluatedAt || undefined)}
                </div>
                <div className="text-xs text-gray-500 mb-2">
                  reason-code parity pass {telemetrySummary.governanceSchemaAudit?.reasonCodeParityPassCount || 0}
                  {' '}• fail {telemetrySummary.governanceSchemaAudit?.reasonCodeParityFailCount || 0}
                  {' '}• command parity pass {telemetrySummary.governanceSchemaAudit?.recommendedCommandParityPassCount || 0}
                  {' '}• fail {telemetrySummary.governanceSchemaAudit?.recommendedCommandParityFailCount || 0}
                </div>
                <div className="text-xs text-gray-500 mb-2">
                  handoff parity pass {telemetrySummary.governanceSchemaAudit?.handoffParityPassCount || 0}
                  {' '}• fail {telemetrySummary.governanceSchemaAudit?.handoffParityFailCount || 0}
                  {' '}• all parity pass {governanceSchemaAuditParityPassCount}
                  {' '}• fail {governanceSchemaAuditParityFailCount}
                  {' '}• unknown {governanceSchemaAuditParityUnknownEventCount}
                </div>
                <div className="text-xs text-gray-500 mb-2">
                  Rollout blocked: {telemetrySummary.governanceSchemaAudit?.rolloutBlockedCount || 0}
                </div>
                <div className="space-y-1 text-sm text-gray-700">
                  {governanceSchemaStatusRows.length === 0 && (
                    <div className="text-gray-500">No governance schema audit events in current window.</div>
                  )}
                  {governanceSchemaStatusRows.map(([status, count]) => (
                    <div key={`governance-schema-${status}`} className="flex items-center justify-between">
                      <span>{status}</span>
                      <span>{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-md border p-3">
                <div className="text-xs font-medium text-gray-500 mb-2">Retry Audit Posture</div>
                <div className="text-xs text-gray-500 mb-2">
                  Latest retry event: {formatTimestamp(telemetrySummary.retryAudit?.latestEventAt || undefined)}
                </div>
                <div className="grid md:grid-cols-2 gap-2 text-sm text-gray-700">
                  <div className="rounded border border-slate-100 p-2">
                    <div className="text-xs text-gray-500 mb-1">By Operation</div>
                    {retryAuditOperationRows.length === 0 && (
                      <div className="text-gray-500 text-xs">No retry operations captured in current window.</div>
                    )}
                    {retryAuditOperationRows.slice(0, 6).map(([operation, count]) => (
                      <div key={`retry-operation-${operation}`} className="flex items-center justify-between text-xs">
                        <span>{operation}</span>
                        <span>{count}</span>
                      </div>
                    ))}
                  </div>
                  <div className="rounded border border-slate-100 p-2">
                    <div className="text-xs text-gray-500 mb-1">By Provider</div>
                    {retryAuditProviderRows.length === 0 && (
                      <div className="text-gray-500 text-xs">No retry providers captured in current window.</div>
                    )}
                    {retryAuditProviderRows.slice(0, 6).map(([provider, count]) => (
                      <div key={`retry-provider-${provider}`} className="flex items-center justify-between text-xs">
                        <span>{provider}</span>
                        <span>{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div
                  data-testid="integrations-retry-terminal-card"
                  className="mt-2 rounded border border-slate-100 p-2"
                >
                  <div className="text-xs text-gray-500 mb-1">Retry Terminal Outcomes</div>
                  <div className="text-xs text-gray-500 mb-2">
                    terminal events {retryTerminalSummary.eventCount}
                    {' '}• retryable {retryTerminalSummary.retryabilityCounts.RETRYABLE || 0}
                    {' '}• non-retryable {retryTerminalSummary.retryabilityCounts.NON_RETRYABLE || 0}
                    {' '}• unknown {retryTerminalSummary.retryabilityCounts.UNKNOWN || 0}
                  </div>
                  <div className="text-xs text-gray-500 mb-2">
                    pressure {retryTerminalPressure.label}
                    {' '}• signal {retryTerminalPressure.signalCount}
                    {' '}• top outcome {retryTerminalTopOutcome ? `${retryTerminalTopOutcome.key} (${retryTerminalTopOutcome.count})` : 'none'}
                  </div>
                  <div className="text-xs text-gray-500 mb-2">
                    top reason {retryTerminalTopReasonCode ? `${retryTerminalTopReasonCode.key} (${retryTerminalTopReasonCode.count})` : 'none'}
                    {' '}• top status {retryTerminalTopStatusCode ? `${retryTerminalTopStatusCode.key} (${retryTerminalTopStatusCode.count})` : 'none'}
                  </div>
                  <div className="text-xs text-gray-500 mb-2">
                    {retryTerminalPressure.hint}
                  </div>
                  <div className="grid md:grid-cols-3 gap-2 text-xs">
                    <div className="rounded border border-slate-100 p-2">
                      <div className="text-gray-500 mb-1">By Outcome</div>
                      {retryTerminalOutcomeRows.length === 0 && (
                        <div className="text-gray-500">No terminal retry outcomes in this window.</div>
                      )}
                      {retryTerminalOutcomeRows.slice(0, 6).map(([outcome, count]) => (
                        <div key={`retry-terminal-outcome-${outcome}`} className="flex items-center justify-between">
                          <span>{outcome}</span>
                          <span>{count}</span>
                        </div>
                      ))}
                    </div>
                    <div className="rounded border border-slate-100 p-2">
                      <div className="text-gray-500 mb-1">By Reason Code</div>
                      {retryTerminalReasonCodeRows.length === 0 && (
                        <div className="text-gray-500">No terminal reason codes in this window.</div>
                      )}
                      {retryTerminalReasonCodeRows.slice(0, 6).map(([reasonCode, count]) => (
                        <div key={`retry-terminal-reason-${reasonCode}`} className="flex items-center justify-between">
                          <span>{reasonCode}</span>
                          <span>{count}</span>
                        </div>
                      ))}
                    </div>
                    <div className="rounded border border-slate-100 p-2">
                      <div className="text-gray-500 mb-1">By Status Code</div>
                      {retryTerminalStatusCodeRows.length === 0 && (
                        <div className="text-gray-500">No terminal status codes in this window.</div>
                      )}
                      {retryTerminalStatusCodeRows.slice(0, 6).map(([statusCode, count]) => (
                        <div key={`retry-terminal-status-${statusCode}`} className="flex items-center justify-between">
                          <span>{statusCode}</span>
                          <span>{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-2 rounded border border-slate-100 p-2">
                  <div className="text-xs text-gray-500 mb-1">Orchestration Daily Trend (Last 7)</div>
                  {orchestrationAuditTrendRows.length === 0 && (
                    <div className="text-gray-500 text-xs">No orchestration trend rows in current window.</div>
                  )}
                  {orchestrationAuditTrendRows.length > 0 && (
                    <div className="space-y-1 text-xs">
                      {orchestrationAuditTrendRows.map((row) => (
                        <div key={`orchestration-trend-${row.date}`} className="grid grid-cols-5 gap-2 rounded border border-slate-100 px-2 py-1">
                          <span>{row.date}</span>
                          <span>events {row.events}</span>
                          <span>s {row.attemptSuccessCount ?? 0}</span>
                          <span>sk {row.attemptSkippedCount ?? 0}</span>
                          <span>e {row.attemptErrorCount ?? 0}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-md border p-3">
                <div className="text-xs font-medium text-gray-500 mb-2">Orchestration Audit Posture</div>
                <div className="text-xs text-gray-500 mb-2">
                  Latest orchestration event: {formatTimestamp(telemetrySummary.orchestrationAudit?.latestEventAt || undefined)}
                </div>
                <div className="text-xs text-gray-500 mb-2">
                  attempts success {telemetrySummary.orchestrationAudit?.attemptStatusCounts?.success || 0}
                  {' '}• skipped {telemetrySummary.orchestrationAudit?.attemptStatusCounts?.skipped || 0}
                  {' '}• error {telemetrySummary.orchestrationAudit?.attemptStatusCounts?.error || 0}
                  {' '}• max latency {telemetrySummary.orchestrationAudit?.maxLatencyMs ?? 'n/a'}ms
                </div>
                <div className="grid md:grid-cols-2 gap-2 text-sm text-gray-700">
                  <div className="rounded border border-slate-100 p-2">
                    <div className="text-xs text-gray-500 mb-1">By Selected Provider</div>
                    {orchestrationAuditProviderRows.length === 0 && (
                      <div className="text-gray-500 text-xs">No orchestration provider selections in current window.</div>
                    )}
                    {orchestrationAuditProviderRows.slice(0, 6).map(([provider, count]) => (
                      <div key={`orchestration-provider-${provider}`} className="flex items-center justify-between text-xs">
                        <span>{provider}</span>
                        <span>{count}</span>
                      </div>
                    ))}
                  </div>
                  <div className="rounded border border-slate-100 p-2">
                    <div className="text-xs text-gray-500 mb-1">Attempt Reason Codes</div>
                    {orchestrationAuditReasonCodeRows.length === 0 && (
                      <div className="text-gray-500 text-xs">No orchestration reason codes captured in current window.</div>
                    )}
                    {orchestrationAuditReasonCodeRows.slice(0, 6).map(([reasonCode, count]) => (
                      <div key={`orchestration-reason-${reasonCode}`} className="flex items-center justify-between text-xs">
                        <span>{reasonCode}</span>
                        <span>{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-md border p-3">
                <div className="text-xs font-medium text-gray-500 mb-2">Packet Validation Freshness</div>
                <div className="text-xs text-gray-500 mb-2">
                  Latest evaluation: {formatTimestamp(telemetrySummary.packetValidationAudit?.latestEvaluatedAt || undefined)}
                </div>
                <div className="text-xs text-gray-500 mb-2">
                  within {telemetrySummary.packetValidationAudit?.withinFreshnessCount || 0} • outside {telemetrySummary.packetValidationAudit?.outsideFreshnessCount || 0} • missing freshness {telemetrySummary.packetValidationAudit?.missingFreshnessCount || 0}
                </div>
                <div className="space-y-1 text-sm text-gray-700">
                  {packetValidationStatusRows.length === 0 && (
                    <div className="text-gray-500">No governance packet validation telemetry in current window.</div>
                  )}
                  {packetValidationStatusRows.map(([status, count]) => (
                    <div key={`packet-validation-${status}`} className="flex items-center justify-between">
                      <span>{status}</span>
                      <span>{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-md border p-3">
                <div className="text-xs font-medium text-gray-500 mb-2">Connector Input-Validation Posture</div>
                <div className="text-xs text-gray-500 mb-2">
                  Latest validation event: {formatTimestamp(telemetrySummary.connectorValidation?.latestEventAt || undefined)}
                </div>
                <div className="grid md:grid-cols-4 gap-2 text-xs text-gray-700">
                  <div className="rounded border border-slate-100 bg-slate-50 px-2 py-1">
                    Events: {telemetrySummary.connectorValidation?.eventCount || 0}
                  </div>
                  <div className="rounded border border-slate-100 bg-slate-50 px-2 py-1">
                    Endpoints: {connectorValidationEndpointRows.length}
                  </div>
                  <div className="rounded border border-slate-100 bg-slate-50 px-2 py-1">
                    Providers: {connectorValidationProviderRows.length}
                  </div>
                  <div className="rounded border border-slate-100 bg-slate-50 px-2 py-1">
                    Fields: {connectorValidationFieldRows.length}
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-2 mb-2">
                  Reasons tracked: {connectorValidationReasonRows.length}
                </div>
                <div className="grid md:grid-cols-2 gap-2 text-xs text-gray-700">
                  <div className="rounded border border-slate-100 p-2">
                    <div className="text-gray-500 mb-1">By Endpoint</div>
                    {connectorValidationEndpointRows.length === 0 && (
                      <div className="text-gray-500">No connector input-validation endpoint telemetry in current window.</div>
                    )}
                    {connectorValidationEndpointRows.slice(0, 6).map(([endpoint, count]) => (
                      <div key={`connector-validation-endpoint-${endpoint}`} className="flex items-center justify-between">
                        <span>{endpoint}</span>
                        <span>{count}</span>
                      </div>
                    ))}
                  </div>
                  <div className="rounded border border-slate-100 p-2">
                    <div className="text-gray-500 mb-1">By Field</div>
                    {connectorValidationFieldRows.length === 0 && (
                      <div className="text-gray-500">No connector input-validation field telemetry in current window.</div>
                    )}
                    {connectorValidationFieldRows.slice(0, 6).map(([field, count]) => (
                      <div key={`connector-validation-field-${field}`} className="flex items-center justify-between">
                        <span>{field}</span>
                        <span>{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-2 text-xs text-gray-700 mt-2">
                  <div className="rounded border border-slate-100 p-2">
                    <div className="text-gray-500 mb-1">By Provider</div>
                    {connectorValidationProviderRows.length === 0 && (
                      <div className="text-gray-500">No connector input-validation provider telemetry in current window.</div>
                    )}
                    {connectorValidationProviderRows.slice(0, 6).map(([provider, count]) => (
                      <div key={`connector-validation-provider-${provider}`} className="flex items-center justify-between">
                        <span>{provider}</span>
                        <span>{count}</span>
                      </div>
                    ))}
                  </div>
                  <div className="rounded border border-slate-100 p-2">
                    <div className="text-gray-500 mb-1">By Reason</div>
                    {connectorValidationReasonRows.length === 0 && (
                      <div className="text-gray-500">No connector input-validation reason telemetry in current window.</div>
                    )}
                    {connectorValidationReasonRows.slice(0, 6).map(([reason, count]) => (
                      <div key={`connector-validation-reason-${reason}`} className="flex items-center justify-between">
                        <span>{reason}</span>
                        <span>{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-md border p-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-medium text-gray-500">Weekly Governance Trend Report</div>
                    <div className="text-xs text-gray-500">
                      Traceability/governance trend summary for rollout signoff packets.
                    </div>
                  </div>
                  <div className="flex items-end gap-2">
                    <div>
                      <label className="text-xs text-gray-500">Report Window Days</label>
                      <Input
                        type="number"
                        min={1}
                        max={30}
                        value={governanceDaysInput}
                        onChange={(e) => setGovernanceDaysInput(Number(e.target.value) || 7)}
                        className="mt-1 w-24"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Report Event Limit</label>
                      <Input
                        type="number"
                        min={50}
                        max={5000}
                        value={governanceLimitInput}
                        onChange={(e) => setGovernanceLimitInput(Number(e.target.value) || 1000)}
                        className="mt-1 w-24"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">History Retention Days</label>
                      <Input
                        type="number"
                        min={1}
                        max={365}
                        value={governanceHistoryRetentionInput}
                        onChange={(e) => setGovernanceHistoryRetentionInput(Number(e.target.value) || 30)}
                        className="mt-1 w-24"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">History Limit</label>
                      <Input
                        type="number"
                        min={1}
                        max={500}
                        value={governanceHistoryLimitInput}
                        onChange={(e) => setGovernanceHistoryLimitInput(Number(e.target.value) || 50)}
                        className="mt-1 w-24"
                      />
                    </div>
                    <Button
                      variant="outline"
                      onClick={refreshGovernanceReport}
                      disabled={isGovernanceReportLoading}
                    >
                      {isGovernanceReportLoading ? 'Refreshing...' : 'Refresh Governance Report'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        downloadJsonSnapshot(
                          'connector-governance-weekly-report',
                          governanceReport || {}
                        )
                      }
                      disabled={!governanceReport}
                    >
                      Export Governance Report JSON
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        downloadJsonSnapshot(
                          'connector-governance-handoff-export',
                          governanceHandoffExportPayload
                        )
                      }
                      disabled={!governanceReportExport && !governanceReport?.governanceExport}
                    >
                      Export Governance Handoff JSON
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        downloadJsonSnapshot(
                          'connector-governance-history',
                          governanceHistoryExportPayload
                        )
                      }
                      disabled={!governanceReportHistory}
                    >
                      Export Governance History JSON
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        void copyGovernanceCommands(
                          'Governance weekly report',
                          governanceReport?.recommendedCommands || []
                        )
                      }
                      disabled={!governanceReport}
                    >
                      Copy Governance Report Commands
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        void copyGovernanceCommands(
                          'Governance handoff',
                          governanceExportCommands
                        )
                      }
                      disabled={!governanceExportCommands.length}
                    >
                      Copy Governance Handoff Commands
                    </Button>
                  </div>
                </div>

                {isGovernanceReportLoading && (
                  <div className="text-sm text-gray-500">Loading governance trend report...</div>
                )}
                {isGovernanceReportExportLoading && (
                  <div className="text-sm text-gray-500">Loading governance handoff export...</div>
                )}
                {isGovernanceReportHistoryLoading && (
                  <div className="text-sm text-gray-500">Loading governance artifact history...</div>
                )}
                {isGovernanceSchemaLoading && (
                  <div className="text-sm text-gray-500">Loading governance schema contract...</div>
                )}
                {governanceReportError && (
                  <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    Failed to load governance trend report: {getErrorMessage(governanceReportError)}
                  </div>
                )}
                {governanceReportExportError && (
                  <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    Failed to load governance handoff export: {getErrorMessage(governanceReportExportError)}
                  </div>
                )}
                {governanceReportHistoryError && (
                  <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    Failed to load governance artifact history: {getErrorMessage(governanceReportHistoryError)}
                  </div>
                )}
                {governanceSchemaError && (
                  <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    Failed to load governance schema contract: {getErrorMessage(governanceSchemaError)}
                  </div>
                )}
                {(governanceReport || governanceReportExport || governanceReportHistory) && (
                  <div
                    className={`rounded-md border p-3 text-sm ${
                      governanceExportRolloutBlocked
                        ? 'border-amber-200 bg-amber-50 text-amber-900'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    }`}
                  >
                    <div className="text-xs font-medium mb-1">Governance Handoff Posture</div>
                    <div>Status: {governanceExportStatus}</div>
                    <div>Rollout Blocked: {governanceExportRolloutBlocked ? 'Yes' : 'No'}</div>
                    <div>Owner: {governanceExportOwnerRole}</div>
                    <div>Schema Version: {governanceExportSchemaVersion ?? 'n/a'}</div>
                    <div>Runtime Prereq Gate: {governanceRuntimePrereqsGateLabel}</div>
                    <div>Runtime missing checks: {governanceRuntimePrereqsMissingCheckCount}</div>
                    {governanceExportAlert && (
                      <div className="text-xs mt-1">{governanceExportAlert}</div>
                    )}
                    {governanceRuntimePrereqs?.command && (
                      <div className="text-xs mt-1">
                        Runtime command: {governanceRuntimePrereqs.command}
                      </div>
                    )}
                    {hasGovernanceParityWarning && (
                      <div
                        data-testid="integrations-governance-parity-warning"
                        className="mt-2 rounded border border-amber-300 bg-amber-100 px-2 py-1 text-xs text-amber-900"
                      >
                        Connector/sendgrid parity warning: {governanceParityWarnings.join(' | ')}
                      </div>
                    )}
                  </div>
                )}
                {governanceSchema && (
                  <div
                    className={`rounded-md border p-3 text-sm ${
                      governanceSchema.status === 'ACTION_REQUIRED'
                        ? 'border-amber-200 bg-amber-50 text-amber-900'
                        : 'border-slate-200 bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="text-xs font-medium mb-1">Governance Schema Contract</div>
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
                        data-testid="integrations-governance-schema-parity-posture"
                        className={`mt-2 rounded border px-2 py-1 text-xs ${governanceSchemaParityToneClass}`}
                      >
                        <div>Schema Parity Status: {governanceSchemaParityStatus}</div>
                        <div>
                          Reason-code count: {governanceSchemaContractParity.reasonCodeCount ?? 'n/a'}
                          {' '}• Command count: {governanceSchemaContractParity.recommendedCommandCount ?? 'n/a'}
                        </div>
                        <div>
                          Computed At: {formatTimestamp(governanceSchemaContractParity.computedAt)}
                        </div>
                        {governanceSchemaParityFailedChecks.length > 0 && (
                          <div data-testid="integrations-governance-schema-parity-warning">
                            Failed checks: {governanceSchemaParityFailedChecks.join(' | ')}
                          </div>
                        )}
                        {governanceSchemaParityUnknownCount > 0 && (
                          <div>Unknown checks: {governanceSchemaParityUnknownCount}</div>
                        )}
                      </div>
                    )}
                    {governanceSchemaAlerts.length > 0 && (
                      <div className="mt-1 text-xs">
                        Alerts: {governanceSchemaAlerts.join(' | ')}
                      </div>
                    )}
                    {governanceSchemaCommands.length > 0 && (
                      <div className="mt-1 text-xs">
                        Commands: {governanceSchemaCommands.slice(0, 3).join(' | ')}
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        onClick={() =>
                          downloadJsonSnapshot(
                            'connector-governance-schema-contract',
                            buildGovernanceSchemaExportSnapshot(governanceSchema)
                          )
                        }
                        disabled={!governanceSchema}
                      >
                        Export Governance Schema JSON
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() =>
                          void copyGovernanceCommands(
                            'Governance schema contract',
                            governanceSchemaCommands
                          )
                        }
                        disabled={!governanceSchemaCommands.length}
                      >
                        Copy Governance Schema Commands
                      </Button>
                    </div>
                  </div>
                )}
                {governanceReport && (
                  <div className="space-y-3 text-sm text-gray-700">
                    <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
                      Generated: {formatTimestamp(governanceReport.generatedAt)} • Window: {governanceReport.windowDays} days • Event limit: {governanceReport.eventLimit}
                    </div>
                    <div className="grid md:grid-cols-6 gap-2">
                      <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1">
                        Governance events: {governanceReport.totals.governanceEventCount}
                      </div>
                      <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1">
                        Traceability evals: {governanceReport.totals.traceabilityEvaluationCount}
                      </div>
                      <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1">
                        Snapshot evals: {governanceReport.totals.snapshotEvaluationCount}
                      </div>
                      <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1">
                        Baseline evals: {governanceReport.totals.baselineEvaluationCount}
                      </div>
                      <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1">
                        ACTION_REQUIRED: {governanceReport.totals.actionRequiredCount}
                      </div>
                      <div className="rounded border border-slate-200 bg-slate-50 px-2 py-1">
                        Rollout blocked: {governanceReport.totals.rolloutBlockedCount}
                      </div>
                    </div>

                    <div
                      data-testid="integrations-governance-connector-pressure"
                      className="rounded border border-slate-200 p-2"
                    >
                      <div className="text-xs font-medium text-gray-500 mb-1">
                        Governance Connector Pressure
                      </div>
                      <div className="grid md:grid-cols-4 gap-2 text-xs">
                        <div className="rounded border border-slate-100 bg-slate-50 px-2 py-1">
                          Events: {governanceConnectorRateLimit?.eventCount
                            ?? governanceReport.totals.connectorRateLimitEventCount
                            ?? 0}
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
                            ?? governanceReport.totals.sendgridWebhookTimestampEventCount
                            ?? 0}
                        </div>
                        <div className="rounded border border-slate-100 bg-slate-50 px-2 py-1">
                          SendGrid anomaly total: {governanceSendgridWebhookTimestamp?.timestampAnomalyCountTotal
                            ?? governanceReport.totals.sendgridWebhookTimestampAnomalyCountTotal
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
                            <div key={`governance-connector-endpoint-${endpoint}`} className="flex items-center justify-between rounded border border-slate-100 px-2 py-1">
                              <span>{endpoint}</span>
                              <span>{count}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="grid md:grid-cols-2 gap-3">
                      <div className="rounded border border-slate-200 p-2">
                        <div className="text-xs font-medium text-gray-500 mb-1">Governance Status Counts</div>
                        {governanceReportStatusRows.length === 0 && (
                          <div className="text-xs text-gray-500">No governance status data in selected window.</div>
                        )}
                        {governanceReportStatusRows.map(([status, count]) => (
                          <div key={`report-status-${status}`} className="flex items-center justify-between">
                            <span>{status}</span>
                            <span>{count}</span>
                          </div>
                        ))}
                      </div>
                      <div className="rounded border border-slate-200 p-2">
                        <div className="text-xs font-medium text-gray-500 mb-1">Traceability Decision Counts</div>
                        {governanceReportDecisionRows.length === 0 && (
                          <div className="text-xs text-gray-500">No traceability decision data in selected window.</div>
                        )}
                        {governanceReportDecisionRows.map(([decision, count]) => (
                          <div key={`report-decision-${decision}`} className="flex items-center justify-between">
                            <span>{decision}</span>
                            <span>{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded border border-slate-200 p-2">
                      <div className="text-xs font-medium text-gray-500 mb-1">Governance Trend by Day</div>
                      {governanceTrendRows.length === 0 && (
                        <div className="text-xs text-gray-500">No governance trend rows in selected window.</div>
                      )}
                      {governanceTrendRows.length > 0 && (
                        <div className="space-y-1">
                          {governanceTrendRows.slice(-7).map((row) => (
                            <div key={`governance-trend-${row.date}`} className="grid grid-cols-5 gap-2 rounded border border-slate-100 px-2 py-1 text-xs">
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

                    <div className="rounded border border-slate-200 p-2">
                      <div className="text-xs font-medium text-gray-500 mb-1">Latest Governance Events</div>
                      {governanceLatestRows.length === 0 && (
                        <div className="text-xs text-gray-500">No recent governance events in selected window.</div>
                      )}
                      {governanceLatestRows.length > 0 && (
                        <div className="space-y-1">
                          {governanceLatestRows.slice(0, 5).map((row, idx) => (
                            <div key={`governance-latest-${idx}`} className="grid grid-cols-5 gap-2 rounded border border-slate-100 px-2 py-1 text-xs">
                              <span>{row.governanceType || 'unknown'}</span>
                              <span>{row.status || row.decision || 'unknown'}</span>
                              <span>{row.requestId || 'request n/a'}</span>
                              <span>{row.rolloutBlocked ? 'blocked' : 'clear'}</span>
                              <span>{formatTimestamp(row.createdAt)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {governanceReport.ownerActionMatrix?.length ? (
                      <div className="rounded border border-slate-200 p-2 space-y-1">
                        <div className="text-xs font-medium text-gray-500">Governance Alert Response Matrix</div>
                        {governanceReport.ownerActionMatrix.map((item, idx) => (
                          <div key={`governance-owner-action-${idx}`} className="rounded border border-slate-100 bg-slate-50 px-2 py-1">
                            <div className="text-xs text-gray-500">
                              {item.priority} • {item.severity} • {item.ownerRole}
                            </div>
                            <div>{item.action}</div>
                            <div className="font-mono text-xs text-gray-600 mt-1">{item.command}</div>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {governanceReportHistory && (
                      <div className="rounded border border-slate-200 p-2 space-y-2">
                        <div className="text-xs font-medium text-gray-500">Governance Artifact History</div>
                        <div className="text-xs text-gray-500">
                          Retention: {governanceReportHistory.retentionDays || governanceHistoryParams.retentionDays} days
                          {' '}• History limit: {governanceReportHistory.limit || governanceHistoryParams.limit}
                        </div>
                        <div className="grid md:grid-cols-4 gap-2 text-xs">
                          <div className="rounded border border-slate-100 bg-slate-50 px-2 py-1">
                            Artifacts: {governanceReportHistory.artifactCount}
                          </div>
                          <div className="rounded border border-slate-100 bg-slate-50 px-2 py-1">
                            Stale: {governanceReportHistory.staleCount}
                          </div>
                          <div className="rounded border border-slate-100 bg-slate-50 px-2 py-1">
                            Rollout blocked: {governanceReportHistory.rolloutBlockedCount}
                          </div>
                          <div className="rounded border border-slate-100 bg-slate-50 px-2 py-1">
                            Latest: {governanceReportHistory.latestArtifact?.name || 'n/a'}
                          </div>
                        </div>
                        <div className="rounded border border-slate-100 bg-slate-50 p-2">
                          <div className="text-xs font-medium text-gray-500 mb-1">History Schema Versions</div>
                          {governanceHistorySchemaRows.length === 0 && (
                            <div className="text-xs text-gray-500">No schema-version metadata found in governance history.</div>
                          )}
                          {governanceHistorySchemaRows.length > 0 && (
                            <div className="grid md:grid-cols-3 gap-1 text-xs">
                              {governanceHistorySchemaRows.map(([schemaVersion, count]) => (
                                <div key={`governance-history-schema-${schemaVersion}`} className="flex items-center justify-between rounded border border-slate-200 bg-white px-2 py-1">
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
                        {governanceHistoryRows.length === 0 && (
                          <div className="text-xs text-gray-500">No governance history artifacts found.</div>
                        )}
                        {governanceHistoryRows.length > 0 && (
                          <div className="space-y-1">
                            {governanceHistoryRows.slice(0, 5).map((row) => (
                              <div key={`governance-history-${row.name}`} className="grid grid-cols-4 gap-2 rounded border border-slate-100 px-2 py-1 text-xs">
                                <span>{row.name}</span>
                                <span>{row.status}</span>
                                <span>{row.withinRetention ? 'within retention' : 'stale'}</span>
                                <span>{row.rolloutBlocked ? 'blocked' : 'clear'}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="rounded-md border p-3">
                <div className="text-xs font-medium text-gray-500 mb-2">Telemetry Daily Trend</div>
                {telemetryTrendRows.length === 0 && (
                  <div className="text-sm text-gray-500">No trend data in current window.</div>
                )}
                {telemetryTrendRows.length > 0 && (
                  <div className="space-y-1 text-sm text-gray-700">
                    {telemetryTrendRows.slice(-7).map((row) => (
                      <div key={row.date} className="grid grid-cols-5 gap-2 rounded border border-slate-100 px-2 py-1">
                        <span>{row.date}</span>
                        <span>events {row.events}</span>
                        <span>errors {row.errors}</span>
                        <span>sales {row.salesIntelligenceEvents}</span>
                        <span>orchestration {row.orchestrationEvents ?? 0}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-md border p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="text-xs font-medium text-gray-500">Recent Correlated Events</div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      data-testid="recent-events-filter-all"
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
                      data-testid="recent-events-filter-packet"
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
                  <div className="text-sm text-gray-500">
                    {effectiveRecentTelemetryFilter === 'packet'
                      ? `No packet-validation events in this telemetry window. Increase Window Days or Event Limit (currently ${telemetryParams.days} days / ${telemetryParams.limit} events), then refresh telemetry.`
                      : 'No recent telemetry events for selected filter.'}
                  </div>
                )}
                {filteredRecentTelemetryRows.length > 0 && (
                  <div className="space-y-1 text-sm text-gray-700">
                    {filteredRecentTelemetryRows.slice(0, 5).map((row, idx) => (
                      <div key={`${row.eventType || 'event'}-${idx}`} className="grid grid-cols-5 gap-2 rounded border border-slate-100 px-2 py-1">
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
                          ? `rate-limit ${row.connectorRateLimitEndpoint}${
                              row.connectorRateLimitRetryAfterSeconds != null
                                ? ` retry ${row.connectorRateLimitRetryAfterSeconds}s`
                                : ''
                            }${
                              row.connectorRateLimitResetInSeconds != null
                                ? ` reset ${row.connectorRateLimitResetInSeconds}s`
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
                        void copyGovernanceCommands(
                          'Snapshot governance remediation',
                          collectGovernanceCommands(
                            snapshotGovernance?.handoff?.actions,
                            snapshotGovernance?.rolloutActions
                          )
                        )
                      }
                      disabled={!snapshotGovernance}
                    >
                      Copy Snapshot Commands
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
                    <Button
                      variant="outline"
                      onClick={() =>
                        void copyGovernanceCommands(
                          'Baseline governance remediation',
                          collectBaselineGovernanceCommands(baselineGovernance)
                        )
                      }
                      disabled={!baselineGovernance}
                    >
                      Copy Baseline Commands
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
                    {snapshotGovernance.rolloutActions?.length ? (
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-gray-500">Alert Response Matrix</div>
                        {snapshotGovernance.rolloutActions.map((item, idx) => (
                          <div key={`${item.trigger}-${idx}`} className="rounded border border-slate-200 bg-slate-50 px-2 py-1">
                            <div className="text-xs text-gray-500">
                              {item.priority} • {item.severity} • {item.ownerRole}
                            </div>
                            <div>{item.action}</div>
                            {item.command && (
                              <div className="font-mono text-xs text-gray-600 mt-1">{item.command}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : null}
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
                      <div>
                        Orchestration gate available:{' '}
                        {baselineGovernance.orchestrationGate?.available ? 'yes' : 'no'}
                      </div>
                      {baselineGovernance.orchestrationGate && (
                        <div>
                          Orchestration decision:{' '}
                          {baselineGovernance.orchestrationGate.decision || 'unknown'}
                          {' '}• error gate{' '}
                          {baselineGovernance.orchestrationGate.attemptErrorGatePassed == null
                            ? 'unknown'
                            : baselineGovernance.orchestrationGate.attemptErrorGatePassed
                            ? 'pass'
                            : 'fail'}
                          {' '}• skipped gate{' '}
                          {baselineGovernance.orchestrationGate.attemptSkippedGatePassed == null
                            ? 'unknown'
                            : baselineGovernance.orchestrationGate.attemptSkippedGatePassed
                            ? 'pass'
                            : 'fail'}
                        </div>
                      )}
                      {baselineGovernance.orchestrationGate && (
                        <div>
                          Orchestration observed (err/sk):{' '}
                          {baselineGovernance.orchestrationGate.observedAttemptErrorCount ?? 'n/a'}
                          /
                          {baselineGovernance.orchestrationGate.observedAttemptSkippedCount ?? 'n/a'}
                          {' '}• threshold (err/sk):{' '}
                          {baselineGovernance.orchestrationGate.maxAttemptErrorCountThreshold ?? 'n/a'}
                          /
                          {baselineGovernance.orchestrationGate.maxAttemptSkippedCountThreshold ?? 'n/a'}
                        </div>
                      )}
                      {baselineGovernance.runtimePrereqs && (
                        <>
                          <div>
                            Runtime prereq gate present:{' '}
                            {baselineGovernance.runtimePrereqs.present ? 'yes' : 'no'}
                          </div>
                          <div>
                            Runtime prereq artifact available:{' '}
                            {baselineGovernance.runtimePrereqs.available ? 'yes' : 'no'}
                          </div>
                          <div>
                            Runtime prereq gate passed:{' '}
                            {baselineGovernance.runtimePrereqs.passed == null
                              ? 'unknown'
                              : baselineGovernance.runtimePrereqs.passed
                              ? 'yes'
                              : 'no'}
                            {' '}• contract{' '}
                            {baselineGovernance.runtimePrereqs.contractValid == null
                              ? 'unknown'
                              : baselineGovernance.runtimePrereqs.contractValid
                              ? 'pass'
                              : 'fail'}
                            {' '}• checks{' '}
                            {baselineGovernance.runtimePrereqs.valid == null
                              ? 'unknown'
                              : baselineGovernance.runtimePrereqs.valid
                              ? 'pass'
                              : 'fail'}
                          </div>
                          <div>
                            Runtime missing checks: {baselineGovernance.runtimePrereqs.missingCheckCount ?? 0}
                          </div>
                          <div>
                            Runtime artifact generated:{' '}
                            {formatTimestamp(baselineGovernance.runtimePrereqs.generatedAt || undefined)}
                          </div>
                          <div>
                            Runtime artifact validated:{' '}
                            {formatTimestamp(baselineGovernance.runtimePrereqs.validatedAt || undefined)}
                          </div>
                          {baselineGovernance.runtimePrereqs.command && (
                            <div className="font-mono text-xs text-gray-600">
                              Runtime command: {baselineGovernance.runtimePrereqs.command}
                            </div>
                          )}
                        </>
                      )}
                      {baselineGovernance.runtimePrereqs?.missingChecks?.commands?.length ? (
                        <div>
                          Runtime missing commands:{' '}
                          {baselineGovernance.runtimePrereqs.missingChecks.commands.join(', ')}
                        </div>
                      ) : null}
                      {baselineGovernance.runtimePrereqs?.missingChecks?.workspace?.length ? (
                        <div>
                          Runtime missing workspace checks:{' '}
                          {baselineGovernance.runtimePrereqs.missingChecks.workspace.join(', ')}
                        </div>
                      ) : null}
                      {baselineGovernance.commandAliases && (
                        <>
                          <div>
                            Command alias artifact present:{' '}
                            {baselineGovernance.commandAliases.present == null
                              ? 'unknown'
                              : baselineGovernance.commandAliases.present
                              ? 'yes'
                              : 'no'}
                          </div>
                          <div>
                            Command alias artifact available:{' '}
                            {baselineGovernance.commandAliases.available == null
                              ? 'unknown'
                              : baselineGovernance.commandAliases.available
                              ? 'yes'
                              : 'no'}
                            {' '}• source{' '}
                            {baselineGovernance.commandAliases.source || 'unknown'}
                          </div>
                          <div>
                            Command alias gate:{' '}
                            {baselineGovernance.commandAliases.gatePassed == null
                              ? 'unknown'
                              : baselineGovernance.commandAliases.gatePassed
                              ? 'pass'
                              : 'fail'}
                            {' '}• contract{' '}
                            {baselineGovernance.commandAliases.contractValid == null
                              ? 'unknown'
                              : baselineGovernance.commandAliases.contractValid
                              ? 'pass'
                              : 'fail'}
                            {' '}• checks{' '}
                            {baselineGovernance.commandAliases.valid == null
                              ? 'unknown'
                              : baselineGovernance.commandAliases.valid
                              ? 'pass'
                              : 'fail'}
                          </div>
                          <div>
                            Command alias drift (missing/mismatched):{' '}
                            {baselineGovernance.commandAliases.missingAliasCount ?? 0}
                            /
                            {baselineGovernance.commandAliases.mismatchedAliasCount ?? 0}
                          </div>
                          <div>
                            Command alias artifact validated:{' '}
                            {formatTimestamp(baselineGovernance.commandAliases.validatedAt || undefined)}
                          </div>
                          {baselineGovernance.commandAliases.command && (
                            <div className="font-mono text-xs text-gray-600">
                              Command alias command: {baselineGovernance.commandAliases.command}
                            </div>
                          )}
                          {baselineGovernance.commandAliases.artifactPath && (
                            <div className="font-mono text-xs text-gray-600">
                              Command alias artifact: {baselineGovernance.commandAliases.artifactPath}
                            </div>
                          )}
                        </>
                      )}
                      {baselineGovernance.commandAliases?.missingAliases?.length ? (
                        <div>
                          Command alias missing mappings:{' '}
                          {baselineGovernance.commandAliases.missingAliases.join(', ')}
                        </div>
                      ) : null}
                      {baselineGovernance.commandAliases?.mismatchedAliases?.length ? (
                        <div>
                          Command alias mismatched mappings:{' '}
                          {baselineGovernance.commandAliases.mismatchedAliases.join(', ')}
                        </div>
                      ) : null}
                      {baselineGovernance.releaseGateFixturePolicy.message && (
                        <div>{baselineGovernance.releaseGateFixturePolicy.message}</div>
                      )}
                      {baselineGovernanceFallbackCommandsInUse && (
                        <div
                          data-testid="integrations-baseline-governance-command-fallback-warning"
                          className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-amber-800"
                        >
                          Baseline governance is failing and backend recommendedCommands are missing. Using local fallback remediation commands.
                        </div>
                      )}
                      {baselineGovernance.releaseGateFixturePolicy.missingProfiles?.length > 0 && (
                        <div>
                          Missing fixture profiles:{' '}
                          {baselineGovernance.releaseGateFixturePolicy.missingProfiles.join(', ')}
                        </div>
                      )}
                      {baselineGovernance.alerts?.length ? (
                        <div className="space-y-1">
                          <div className="text-xs font-medium text-gray-500">Governance Alerts</div>
                          {baselineGovernance.alerts.map((alert, idx) => (
                            <div key={`${alert}-${idx}`} className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-amber-800">
                              {alert}
                            </div>
                          ))}
                        </div>
                      ) : null}
                      {baselineGovernance.rolloutActions?.length ? (
                        <div className="space-y-1">
                          <div className="text-xs font-medium text-gray-500">Alert Response Matrix</div>
                          {baselineGovernance.rolloutActions.map((item, idx) => (
                            <div key={`${item.trigger}-${idx}`} className="rounded border border-slate-200 bg-slate-50 px-2 py-1">
                              <div className="text-xs text-gray-500">
                                {item.priority} • {item.severity} • {item.ownerRole}
                              </div>
                              <div>{item.action}</div>
                              {item.command && (
                                <div className="font-mono text-xs text-gray-600 mt-1">{item.command}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : null}
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
            <div>
              <label className="text-xs text-gray-500">Max Orchestration Attempt Errors</label>
              <Input
                type="number"
                min={0}
                max={5000}
                step={1}
                value={sloOrchestrationErrorCountInput}
                onChange={(e) => setSloOrchestrationErrorCountInput(Number(e.target.value) || 5)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Max Orchestration Attempt Skipped</label>
              <Input
                type="number"
                min={0}
                max={5000}
                step={1}
                value={sloOrchestrationSkippedCountInput}
                onChange={(e) => setSloOrchestrationSkippedCountInput(Number(e.target.value) || 25)}
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
                Generated: {formatTimestamp(sloGates.generatedAt)} • Window: {sloGates.windowDays || sloParams.days} days • Overall Gate: {sloGates.gates?.overallPassed == null ? 'UNKNOWN' : sloGates.gates.overallPassed ? 'PASS' : 'FAIL'} • Schema Sample Gate: {sloGates.gates?.schemaSampleSizePassed == null ? 'UNKNOWN' : sloGates.gates.schemaSampleSizePassed ? 'PASS' : 'FAIL'} • Retry Volume Gate: {sloGates.gates?.retryAuditVolumePassed == null ? 'UNKNOWN' : sloGates.gates.retryAuditVolumePassed ? 'PASS' : 'FAIL'} • Orchestration Error Gate: {sloGates.gates?.orchestrationAttemptErrorPassed == null ? 'UNKNOWN' : sloGates.gates.orchestrationAttemptErrorPassed ? 'PASS' : 'FAIL'}
              </div>
              <div className="grid md:grid-cols-9 gap-3">
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
                  <div className="text-xs text-gray-500">Retry Audit</div>
                  <div className="text-xl font-semibold">
                    {Number(sloGates.retryAudit?.observedEventCount || 0)}
                  </div>
                  <div className="text-xs text-gray-500">
                    Threshold {sloGates.retryAudit?.maxEventCountThreshold ?? 'n/a'} • Avg delay {(Number(sloGates.retryAudit?.observedAvgNextDelaySeconds || 0)).toFixed(2)}s / {(Number(sloGates.retryAudit?.maxAvgNextDelaySecondsThreshold || 0)).toFixed(2)}s
                  </div>
                  <div className="text-xs text-gray-500">
                    Gates {sloGates.gates?.retryAuditVolumePassed == null ? 'unknown' : sloGates.gates.retryAuditVolumePassed ? 'volume pass' : 'volume fail'} • {sloGates.gates?.retryAuditDelayPassed == null ? 'delay unknown' : sloGates.gates.retryAuditDelayPassed ? 'delay pass' : 'delay fail'}
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-gray-500">Orchestration Attempts</div>
                  <div className="text-xl font-semibold">
                    {Number(sloGates.orchestrationAudit?.observedAttemptErrorCount || 0)} err / {Number(sloGates.orchestrationAudit?.observedAttemptSkippedCount || 0)} sk
                  </div>
                  <div className="text-xs text-gray-500">
                    Threshold {sloGates.orchestrationAudit?.maxAttemptErrorCountThreshold ?? 'n/a'} err • {sloGates.orchestrationAudit?.maxAttemptSkippedCountThreshold ?? 'n/a'} sk
                  </div>
                  <div className="text-xs text-gray-500">
                    Gates {sloGates.gates?.orchestrationAttemptErrorPassed == null ? 'error unknown' : sloGates.gates.orchestrationAttemptErrorPassed ? 'error pass' : 'error fail'} • {sloGates.gates?.orchestrationAttemptSkippedPassed == null ? 'skipped unknown' : sloGates.gates.orchestrationAttemptSkippedPassed ? 'skipped pass' : 'skipped fail'}
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
                <div className="rounded-md border p-3">
                  <div className="text-xs font-medium text-gray-500 mb-2">Connector Rate-Limit Endpoints</div>
                  <div className="text-xs text-gray-500 mb-2">
                    Latest event: {formatTimestamp(telemetrySummary?.connectorRateLimit?.latestEventAt || undefined)}
                  </div>
                  <div className="text-xs text-gray-500 mb-2">
                    Max retry: {telemetrySummary?.connectorRateLimit?.maxRetryAfterSeconds ?? 'n/a'}s • Avg retry: {telemetrySummary?.connectorRateLimit?.avgRetryAfterSeconds ?? 'n/a'}s • Max reset: {telemetrySummary?.connectorRateLimit?.maxResetInSeconds ?? 'n/a'}s • Avg reset: {telemetrySummary?.connectorRateLimit?.avgResetInSeconds ?? 'n/a'}s
                  </div>
                  <div className={`text-xs mb-2 ${connectorRateLimitPressure.toneClass}`}>
                    Connector throttle pressure: {connectorRateLimitPressure.label}. {connectorRateLimitPressure.hint}
                  </div>
                  <div className="space-y-1 text-sm text-gray-700">
                    {connectorRateLimitRows.length === 0 && (
                      <div className="text-gray-500">No connector rate-limit events in current window.</div>
                    )}
                    {connectorRateLimitRows.map(([endpoint, count]) => (
                      <div key={`connector-rate-limit-${endpoint}`} className="flex items-center justify-between">
                        <span>{endpoint}</span>
                        <span>{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-md border p-3">
                <div className="text-xs font-medium text-gray-500 mb-2">Signoff Requirements</div>
                <div className="mb-3 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-sm text-gray-700">
                  Baseline governance status:{' '}
                  <span className={baselineGovernancePass ? 'text-emerald-700 font-medium' : 'text-amber-700 font-medium'}>
                    {baselineGovernance?.status || 'UNKNOWN'}
                  </span>
                </div>
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

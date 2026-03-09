export interface GovernanceConnectorRateLimitRollup {
  eventCount?: number | null;
  byEndpoint?: Record<string, number> | null;
  latestEventAt?: string | null;
  maxRetryAfterSeconds?: number | null;
  avgRetryAfterSeconds?: number | null;
  maxResetInSeconds?: number | null;
  avgResetInSeconds?: number | null;
  pressure?: {
    label?: string | null;
    hint?: string | null;
    signalSeconds?: number | null;
    thresholdSeconds?: number | null;
  } | null;
}

export interface ConnectorPressureParityMetadata {
  topLevelEventCount: number | null;
  nestedEventCount: number | null;
  totalsEventCount: number | null;
  eventCountMatchesNested: boolean | null;
  eventCountMatchesTotals: boolean | null;
  byEndpointMatchesNested: boolean | null;
  pressureLabelMatchesNested: boolean | null;
  normalizedTopLevelByEndpoint: Record<string, number>;
  normalizedNestedByEndpoint: Record<string, number>;
  computedAt: string;
}

export interface GovernanceSendgridWebhookTimestampRollup {
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

export interface SendgridWebhookTimestampParityMetadata {
  topLevelEventCount: number | null;
  nestedEventCount: number | null;
  totalsEventCount: number | null;
  topLevelAnomalyCountTotal: number | null;
  nestedAnomalyCountTotal: number | null;
  eventCountMatchesNested: boolean | null;
  eventCountMatchesTotals: boolean | null;
  anomalyCountTotalMatchesNested: boolean | null;
  pressureLabelCountsMatchNested: boolean | null;
  pressureHintCountsMatchNested: boolean | null;
  ageBucketCountsMatchNested: boolean | null;
  anomalyEventTypeCountsMatchNested: boolean | null;
  latestEventAtMatchesNested: boolean | null;
  normalizedTopLevelPressureLabelCounts: Record<string, number>;
  normalizedNestedPressureLabelCounts: Record<string, number>;
  normalizedTopLevelPressureHintCounts: Record<string, number>;
  normalizedNestedPressureHintCounts: Record<string, number>;
  normalizedTopLevelAgeBucketCounts: Record<string, number>;
  normalizedNestedAgeBucketCounts: Record<string, number>;
  normalizedTopLevelAnomalyEventTypeCounts: Record<string, number>;
  normalizedNestedAnomalyEventTypeCounts: Record<string, number>;
  normalizedLatestEventAtTopLevel: string | null;
  normalizedLatestEventAtNested: string | null;
  computedAt: string;
}

const normalizeConnectorRateLimitByEndpoint = (
  value?: Record<string, unknown> | null
): Record<string, number> => {
  const normalized: Record<string, number> = {};
  if (!value || typeof value !== 'object') {
    return normalized;
  }
  Object.entries(value).forEach(([endpoint, count]) => {
    const normalizedEndpoint = String(endpoint || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'unknown';
    const numericCount = Number(count);
    if (!Number.isFinite(numericCount) || numericCount < 0) {
      return;
    }
    const normalizedCount = Math.floor(numericCount);
    normalized[normalizedEndpoint] = (normalized[normalizedEndpoint] || 0) + normalizedCount;
  });
  return normalized;
};

const normalizeConnectorRateLimitCount = (value: unknown): number | null => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return null;
  }
  return Math.floor(numeric);
};

const normalizePressureLabel = (value: unknown): string | null => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized || null;
};

const normalizeTelemetryTokenKey = (value: unknown): string => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || 'unknown';
};

const normalizeTelemetryHintKey = (value: unknown): string => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  return normalized || 'timestamp posture not available.';
};

const normalizeTimestampIso = (value: unknown): string | null => {
  const raw = String(value || '').trim();
  if (!raw) {
    return null;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
};

const normalizeCountMap = (
  value: Record<string, unknown> | null | undefined,
  normalizeKey: (value: unknown) => string
): Record<string, number> => {
  const normalized: Record<string, number> = {};
  if (!value || typeof value !== 'object') {
    return normalized;
  }
  Object.entries(value).forEach(([rawKey, rawCount]) => {
    const key = normalizeKey(rawKey);
    const numericCount = Number(rawCount);
    if (!Number.isFinite(numericCount) || numericCount < 0) {
      return;
    }
    const normalizedCount = Math.floor(numericCount);
    normalized[key] = (normalized[key] || 0) + normalizedCount;
  });
  return normalized;
};

const stableSerializeEndpointMap = (value: Record<string, number>): string =>
  JSON.stringify(
    Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .reduce<Record<string, number>>((acc, [key, count]) => {
        acc[key] = count;
        return acc;
      }, {})
  );

export const buildConnectorPressureParityMetadata = (
  topLevelConnector?: GovernanceConnectorRateLimitRollup | null,
  nestedConnector?: GovernanceConnectorRateLimitRollup | null,
  totalsConnectorRateLimitEventCount?: unknown
): ConnectorPressureParityMetadata => {
  const topLevelEventCount = normalizeConnectorRateLimitCount(topLevelConnector?.eventCount);
  const nestedEventCount = normalizeConnectorRateLimitCount(nestedConnector?.eventCount);
  const totalsEventCount = normalizeConnectorRateLimitCount(totalsConnectorRateLimitEventCount);
  const topLevelByEndpoint = normalizeConnectorRateLimitByEndpoint(topLevelConnector?.byEndpoint);
  const nestedByEndpoint = normalizeConnectorRateLimitByEndpoint(nestedConnector?.byEndpoint);
  const topLevelPressureLabel = normalizePressureLabel(topLevelConnector?.pressure?.label);
  const nestedPressureLabel = normalizePressureLabel(nestedConnector?.pressure?.label);

  return {
    topLevelEventCount,
    nestedEventCount,
    totalsEventCount,
    eventCountMatchesNested:
      topLevelEventCount !== null && nestedEventCount !== null
        ? topLevelEventCount === nestedEventCount
        : null,
    eventCountMatchesTotals:
      topLevelEventCount !== null && totalsEventCount !== null
        ? topLevelEventCount === totalsEventCount
        : null,
    byEndpointMatchesNested:
      Object.keys(topLevelByEndpoint).length > 0 || Object.keys(nestedByEndpoint).length > 0
        ? stableSerializeEndpointMap(topLevelByEndpoint) === stableSerializeEndpointMap(nestedByEndpoint)
        : null,
    pressureLabelMatchesNested:
      topLevelPressureLabel && nestedPressureLabel
        ? topLevelPressureLabel === nestedPressureLabel
        : null,
    normalizedTopLevelByEndpoint: topLevelByEndpoint,
    normalizedNestedByEndpoint: nestedByEndpoint,
    computedAt: new Date().toISOString(),
  };
};

export const buildSendgridWebhookTimestampParityMetadata = (
  topLevelSendgrid?: GovernanceSendgridWebhookTimestampRollup | null,
  nestedSendgrid?: GovernanceSendgridWebhookTimestampRollup | null,
  totalsSendgridWebhookTimestampEventCount?: unknown
): SendgridWebhookTimestampParityMetadata => {
  const topLevelEventCount = normalizeConnectorRateLimitCount(topLevelSendgrid?.eventCount);
  const nestedEventCount = normalizeConnectorRateLimitCount(nestedSendgrid?.eventCount);
  const totalsEventCount = normalizeConnectorRateLimitCount(
    totalsSendgridWebhookTimestampEventCount
  );
  const topLevelAnomalyCountTotal = normalizeConnectorRateLimitCount(
    topLevelSendgrid?.timestampAnomalyCountTotal
  );
  const nestedAnomalyCountTotal = normalizeConnectorRateLimitCount(
    nestedSendgrid?.timestampAnomalyCountTotal
  );

  const topLevelPressureLabelCounts = normalizeCountMap(
    topLevelSendgrid?.pressureLabelCounts || undefined,
    normalizeTelemetryTokenKey
  );
  const nestedPressureLabelCounts = normalizeCountMap(
    nestedSendgrid?.pressureLabelCounts || undefined,
    normalizeTelemetryTokenKey
  );
  const topLevelPressureHintCounts = normalizeCountMap(
    topLevelSendgrid?.pressureHintCounts || undefined,
    normalizeTelemetryHintKey
  );
  const nestedPressureHintCounts = normalizeCountMap(
    nestedSendgrid?.pressureHintCounts || undefined,
    normalizeTelemetryHintKey
  );
  const topLevelAgeBucketCounts = normalizeCountMap(
    topLevelSendgrid?.timestampAgeBucketCounts || undefined,
    normalizeTelemetryTokenKey
  );
  const nestedAgeBucketCounts = normalizeCountMap(
    nestedSendgrid?.timestampAgeBucketCounts || undefined,
    normalizeTelemetryTokenKey
  );
  const topLevelAnomalyEventTypeCounts = normalizeCountMap(
    topLevelSendgrid?.timestampAnomalyEventTypeCounts || undefined,
    normalizeTelemetryTokenKey
  );
  const nestedAnomalyEventTypeCounts = normalizeCountMap(
    nestedSendgrid?.timestampAnomalyEventTypeCounts || undefined,
    normalizeTelemetryTokenKey
  );
  const normalizedLatestEventAtTopLevel = normalizeTimestampIso(topLevelSendgrid?.latestEventAt);
  const normalizedLatestEventAtNested = normalizeTimestampIso(nestedSendgrid?.latestEventAt);

  return {
    topLevelEventCount,
    nestedEventCount,
    totalsEventCount,
    topLevelAnomalyCountTotal,
    nestedAnomalyCountTotal,
    eventCountMatchesNested:
      topLevelEventCount !== null && nestedEventCount !== null
        ? topLevelEventCount === nestedEventCount
        : null,
    eventCountMatchesTotals:
      topLevelEventCount !== null && totalsEventCount !== null
        ? topLevelEventCount === totalsEventCount
        : null,
    anomalyCountTotalMatchesNested:
      topLevelAnomalyCountTotal !== null && nestedAnomalyCountTotal !== null
        ? topLevelAnomalyCountTotal === nestedAnomalyCountTotal
        : null,
    pressureLabelCountsMatchNested:
      Object.keys(topLevelPressureLabelCounts).length > 0
      || Object.keys(nestedPressureLabelCounts).length > 0
        ? stableSerializeEndpointMap(topLevelPressureLabelCounts)
          === stableSerializeEndpointMap(nestedPressureLabelCounts)
        : null,
    pressureHintCountsMatchNested:
      Object.keys(topLevelPressureHintCounts).length > 0
      || Object.keys(nestedPressureHintCounts).length > 0
        ? stableSerializeEndpointMap(topLevelPressureHintCounts)
          === stableSerializeEndpointMap(nestedPressureHintCounts)
        : null,
    ageBucketCountsMatchNested:
      Object.keys(topLevelAgeBucketCounts).length > 0 || Object.keys(nestedAgeBucketCounts).length > 0
        ? stableSerializeEndpointMap(topLevelAgeBucketCounts)
          === stableSerializeEndpointMap(nestedAgeBucketCounts)
        : null,
    anomalyEventTypeCountsMatchNested:
      Object.keys(topLevelAnomalyEventTypeCounts).length > 0
      || Object.keys(nestedAnomalyEventTypeCounts).length > 0
        ? stableSerializeEndpointMap(topLevelAnomalyEventTypeCounts)
          === stableSerializeEndpointMap(nestedAnomalyEventTypeCounts)
        : null,
    latestEventAtMatchesNested:
      normalizedLatestEventAtTopLevel && normalizedLatestEventAtNested
        ? normalizedLatestEventAtTopLevel === normalizedLatestEventAtNested
        : null,
    normalizedTopLevelPressureLabelCounts: topLevelPressureLabelCounts,
    normalizedNestedPressureLabelCounts: nestedPressureLabelCounts,
    normalizedTopLevelPressureHintCounts: topLevelPressureHintCounts,
    normalizedNestedPressureHintCounts: nestedPressureHintCounts,
    normalizedTopLevelAgeBucketCounts: topLevelAgeBucketCounts,
    normalizedNestedAgeBucketCounts: nestedAgeBucketCounts,
    normalizedTopLevelAnomalyEventTypeCounts: topLevelAnomalyEventTypeCounts,
    normalizedNestedAnomalyEventTypeCounts: nestedAnomalyEventTypeCounts,
    normalizedLatestEventAtTopLevel,
    normalizedLatestEventAtNested,
    computedAt: new Date().toISOString(),
  };
};

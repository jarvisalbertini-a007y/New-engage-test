const TELEMETRY_STATUS_SANITIZE_PATTERN = /[^A-Z0-9]+/g;
const TELEMETRY_STATUS_TRIM_UNDERSCORE_PATTERN = /^_+|_+$/g;

export const normalizeTelemetryStatusToken = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value
    .trim()
    .toUpperCase()
    .replace(TELEMETRY_STATUS_SANITIZE_PATTERN, '_')
    .replace(TELEMETRY_STATUS_TRIM_UNDERSCORE_PATTERN, '');
  return normalized || null;
};

const toSortedStatusCountMap = (counts: Record<string, number>): Record<string, number> => {
  const sortedEntries = Object.entries(counts).sort(([left], [right]) => {
    if (left < right) {
      return -1;
    }
    if (left > right) {
      return 1;
    }
    return 0;
  });
  return Object.fromEntries(sortedEntries);
};

export const normalizeTelemetryStatusCountMap = (
  value: unknown
): Record<string, number> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  const counts: Record<string, number> = {};
  for (const [rawKey, rawCount] of Object.entries(value as Record<string, unknown>)) {
    const normalizedKey = normalizeTelemetryStatusToken(rawKey);
    if (!normalizedKey) {
      continue;
    }
    const numericCount = Number(rawCount);
    if (!Number.isFinite(numericCount)) {
      continue;
    }
    const normalizedCount = Math.floor(numericCount);
    if (normalizedCount < 0) {
      continue;
    }
    counts[normalizedKey] = (counts[normalizedKey] || 0) + normalizedCount;
  }
  return toSortedStatusCountMap(counts);
};

export const buildTelemetryStatusCountMap = (values: unknown[]): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const value of values) {
    const normalized = normalizeTelemetryStatusToken(value);
    if (!normalized) {
      continue;
    }
    counts[normalized] = (counts[normalized] || 0) + 1;
  }
  return toSortedStatusCountMap(counts);
};

export const formatTelemetryStatusCountMap = (counts: Record<string, number>): string => {
  const entries = Object.entries(counts || {});
  if (entries.length === 0) {
    return 'none';
  }
  return entries
    .sort(([left], [right]) => {
      if (left < right) {
        return -1;
      }
      if (left > right) {
        return 1;
      }
      return 0;
    })
    .map(([status, count]) => `${status}: ${count}`)
    .join(' | ');
};

export const areTelemetryStatusCountMapsEqual = (
  left: Record<string, number>,
  right: Record<string, number>
): boolean => {
  const leftKeys = Object.keys(left || {}).sort();
  const rightKeys = Object.keys(right || {}).sort();
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }
  for (let index = 0; index < leftKeys.length; index += 1) {
    const leftKey = leftKeys[index];
    if (leftKey !== rightKeys[index]) {
      return false;
    }
    if (left[leftKey] !== right[rightKeys[index]]) {
      return false;
    }
  }
  return true;
};

export type TelemetryStatusCountSource = 'server' | 'local';

export interface TelemetryStatusCountProvenance {
  effectiveCounts: Record<string, number>;
  serverCounts: Record<string, number>;
  fallbackCounts: Record<string, number>;
  source: TelemetryStatusCountSource;
  mismatch: boolean;
}

export type TelemetryStatusCountPosture =
  | 'server_consistent'
  | 'server_drift'
  | 'local_fallback'
  | 'local_drift';

export interface TelemetryStatusCountPostureMetadata {
  posture: TelemetryStatusCountPosture;
  label: string;
  severity: 'info' | 'warning';
  requiresInvestigation: boolean;
}

export interface TelemetryStatusCountPostureBackendMetadata {
  posture?: unknown;
  postureSeverity?: unknown;
  requiresInvestigation?: unknown;
}

export interface TelemetryStatusCountBackendMetadata {
  statusCounts?: unknown;
  statusCountsSource?: unknown;
  statusCountsMismatch?: unknown;
  statusCountsServer?: unknown;
  statusCountsFallback?: unknown;
}

export const resolveTelemetryStatusCountProvenance = (
  serverValue: unknown,
  fallbackValue: Record<string, number>
): TelemetryStatusCountProvenance => {
  const serverCounts = normalizeTelemetryStatusCountMap(serverValue);
  const fallbackCounts = normalizeTelemetryStatusCountMap(fallbackValue);
  const hasServerCounts = Object.keys(serverCounts).length > 0;
  const effectiveCounts = hasServerCounts ? serverCounts : fallbackCounts;
  const source: TelemetryStatusCountSource = hasServerCounts ? 'server' : 'local';
  const mismatch = hasServerCounts
    ? !areTelemetryStatusCountMapsEqual(serverCounts, fallbackCounts)
    : false;

  return {
    effectiveCounts,
    serverCounts,
    fallbackCounts,
    source,
    mismatch,
  };
};

export const resolveTelemetryStatusCountProvenanceWithMetadata = (
  metadata: TelemetryStatusCountBackendMetadata | null | undefined,
  fallbackValue: Record<string, number>
): TelemetryStatusCountProvenance => {
  const serverValue = metadata?.statusCountsServer ?? metadata?.statusCounts;
  const fallbackMap = normalizeTelemetryStatusCountMap(
    metadata?.statusCountsFallback ?? fallbackValue
  );
  const resolved = resolveTelemetryStatusCountProvenance(serverValue, fallbackMap);
  const sourceRaw = String(metadata?.statusCountsSource || '').trim().toLowerCase();
  const source: TelemetryStatusCountSource = (
    sourceRaw === 'server' || sourceRaw === 'local'
  ) ? (sourceRaw as TelemetryStatusCountSource) : resolved.source;

  const mismatch = typeof metadata?.statusCountsMismatch === 'boolean'
    ? metadata.statusCountsMismatch
    : source === 'server'
      ? !areTelemetryStatusCountMapsEqual(resolved.serverCounts, resolved.fallbackCounts)
      : false;

  const effectiveCounts = source === 'local' && Object.keys(resolved.fallbackCounts).length > 0
    ? resolved.fallbackCounts
    : source === 'server' && Object.keys(resolved.serverCounts).length > 0
      ? resolved.serverCounts
      : resolved.effectiveCounts;

  return {
    effectiveCounts,
    serverCounts: resolved.serverCounts,
    fallbackCounts: resolved.fallbackCounts,
    source,
    mismatch,
  };
};

export const classifyTelemetryStatusCountProvenance = (
  provenance: TelemetryStatusCountProvenance
): TelemetryStatusCountPostureMetadata => {
  if (provenance.source === 'server' && provenance.mismatch) {
    return {
      posture: 'server_drift',
      label: 'SERVER_DRIFT',
      severity: 'warning',
      requiresInvestigation: true,
    };
  }
  if (provenance.source === 'server') {
    return {
      posture: 'server_consistent',
      label: 'SERVER_CONSISTENT',
      severity: 'info',
      requiresInvestigation: false,
    };
  }
  if (provenance.mismatch) {
    return {
      posture: 'local_drift',
      label: 'LOCAL_DRIFT',
      severity: 'warning',
      requiresInvestigation: true,
    };
  }
  return {
    posture: 'local_fallback',
    label: 'LOCAL_FALLBACK',
    severity: 'info',
    requiresInvestigation: false,
  };
};

const TELEMETRY_STATUS_COUNT_POSTURE_ALLOWED: ReadonlySet<TelemetryStatusCountPosture> = new Set<TelemetryStatusCountPosture>([
  'server_consistent',
  'server_drift',
  'local_fallback',
  'local_drift',
]);

const TELEMETRY_STATUS_COUNT_POSTURE_DEFAULTS: Record<
  TelemetryStatusCountPosture,
  Pick<TelemetryStatusCountPostureMetadata, 'severity' | 'requiresInvestigation' | 'label'>
> = {
  server_consistent: {
    severity: 'info',
    requiresInvestigation: false,
    label: 'SERVER_CONSISTENT',
  },
  server_drift: {
    severity: 'warning',
    requiresInvestigation: true,
    label: 'SERVER_DRIFT',
  },
  local_fallback: {
    severity: 'info',
    requiresInvestigation: false,
    label: 'LOCAL_FALLBACK',
  },
  local_drift: {
    severity: 'warning',
    requiresInvestigation: true,
    label: 'LOCAL_DRIFT',
  },
};

const normalizeTelemetryStatusCountPostureToken = (
  value: unknown
): TelemetryStatusCountPosture | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().toLowerCase() as TelemetryStatusCountPosture;
  return TELEMETRY_STATUS_COUNT_POSTURE_ALLOWED.has(normalized)
    ? normalized
    : null;
};

const normalizeTelemetryStatusCountPostureSeverity = (
  value: unknown
): 'info' | 'warning' | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  return normalized === 'info' || normalized === 'warning'
    ? normalized
    : null;
};

export const resolveTelemetryStatusCountPosture = (
  provenance: TelemetryStatusCountProvenance,
  metadata?: TelemetryStatusCountPostureBackendMetadata | null
): TelemetryStatusCountPostureMetadata => {
  const computed = classifyTelemetryStatusCountProvenance(provenance);
  const posture = normalizeTelemetryStatusCountPostureToken(metadata?.posture) || computed.posture;
  const defaults = TELEMETRY_STATUS_COUNT_POSTURE_DEFAULTS[posture];
  const severity = normalizeTelemetryStatusCountPostureSeverity(metadata?.postureSeverity)
    || defaults.severity;
  const requiresInvestigation = typeof metadata?.requiresInvestigation === 'boolean'
    ? metadata.requiresInvestigation
    : defaults.requiresInvestigation;
  return {
    posture,
    label: defaults.label,
    severity,
    requiresInvestigation,
  };
};

export interface RecentEventCountNormalizationInput {
  totalCount: unknown;
  filteredCount: unknown;
  rowCount: number;
  hasServerFilterEcho: boolean;
}

export interface RecentEventCountNormalizationResult {
  totalCount: number;
  filteredCount: number;
}

export interface RecentEventPacketBreakdownInput {
  totalCount: number;
  packetValidationCount: unknown;
  nonPacketCount: unknown;
  fallbackPacketValidationCount: number;
}

export interface RecentEventPacketBreakdownResult {
  packetValidationCount: number;
  nonPacketCount: number;
}

export type RecentEventFilter = 'all' | 'packet';
export type RecentEventServerFilterEvaluation = 'supported' | 'unsupported' | 'absent';
export type RecentEventFilterSource = 'server' | 'local';
export type RecentEventFilterResolution =
  | 'server_supported'
  | 'local_no_server_filter'
  | 'local_blank_server_filter'
  | 'local_unsupported_server_filter';

export interface RecentEventFilterProvenanceInput {
  selectedFilter: RecentEventFilter;
  rawServerFilter: unknown;
}

export interface RecentEventFilterProvenance {
  serverFilterRaw: string | null;
  serverFilterRawTrimmed: string | null;
  serverFilterBlank: boolean;
  serverFilterEcho: RecentEventFilter | null;
  serverFilterUnsupported: boolean;
  serverFilterEvaluation: RecentEventServerFilterEvaluation;
  serverFilterNormalizationChanged: boolean;
  effectiveFilter: RecentEventFilter;
  filterSource: RecentEventFilterSource;
  filterMismatch: boolean;
  filterResolution: RecentEventFilterResolution;
}

const coerceNonNegativeInteger = (value: unknown, fallback: number): number => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  const floored = Math.floor(numeric);
  if (floored < 0) {
    return fallback;
  }
  return floored;
};

export const normalizeRecentEventCounts = (
  input: RecentEventCountNormalizationInput
): RecentEventCountNormalizationResult => {
  const rowCount = Math.max(0, Math.floor(Number(input.rowCount) || 0));
  const totalBase = coerceNonNegativeInteger(input.totalCount, rowCount);
  const normalizedTotalCount = Math.max(totalBase, rowCount);
  const filteredBase = input.hasServerFilterEcho
    ? coerceNonNegativeInteger(input.filteredCount, rowCount)
    : rowCount;
  const normalizedFilteredCount = Math.min(
    Math.max(filteredBase, rowCount),
    normalizedTotalCount
  );

  return {
    totalCount: normalizedTotalCount,
    filteredCount: normalizedFilteredCount,
  };
};

export const normalizeRecentEventPacketBreakdown = (
  input: RecentEventPacketBreakdownInput
): RecentEventPacketBreakdownResult => {
  const normalizedTotalCount = Math.max(0, Math.floor(Number(input.totalCount) || 0));
  const fallbackPacketValidationCount = Math.min(
    Math.max(0, Math.floor(Number(input.fallbackPacketValidationCount) || 0)),
    normalizedTotalCount
  );

  const normalizedPacketValidationCount = Math.min(
    coerceNonNegativeInteger(input.packetValidationCount, fallbackPacketValidationCount),
    normalizedTotalCount
  );
  const fallbackNonPacketCount = Math.max(
    0,
    normalizedTotalCount - normalizedPacketValidationCount
  );
  const normalizedNonPacketCount = Math.min(
    coerceNonNegativeInteger(input.nonPacketCount, fallbackNonPacketCount),
    normalizedTotalCount
  );

  if (normalizedPacketValidationCount + normalizedNonPacketCount <= normalizedTotalCount) {
    return {
      packetValidationCount: normalizedPacketValidationCount,
      nonPacketCount: normalizedNonPacketCount,
    };
  }

  return {
    packetValidationCount: normalizedPacketValidationCount,
    nonPacketCount: Math.max(
      0,
      normalizedTotalCount - normalizedPacketValidationCount
    ),
  };
};

export const resolveRecentEventFilterProvenance = (
  input: RecentEventFilterProvenanceInput
): RecentEventFilterProvenance => {
  const serverFilterRaw = typeof input.rawServerFilter === 'string'
    ? input.rawServerFilter
    : null;
  const serverFilterRawTrimmedValue = serverFilterRaw
    ? serverFilterRaw.trim()
    : '';
  const serverFilterRawTrimmed = serverFilterRawTrimmedValue || null;
  const serverFilterBlank = Boolean(serverFilterRaw && !serverFilterRawTrimmed);
  const normalized = serverFilterRawTrimmed
    ? serverFilterRawTrimmed.toLowerCase()
    : '';
  const serverFilterEcho: RecentEventFilter | null = normalized === 'packet'
    ? 'packet'
    : normalized === 'all'
      ? 'all'
      : null;
  const serverFilterUnsupported = Boolean(serverFilterRawTrimmed && !serverFilterEcho);
  const serverFilterEvaluation: RecentEventServerFilterEvaluation = serverFilterEcho
    ? 'supported'
    : serverFilterRawTrimmed
      ? 'unsupported'
      : 'absent';
  const serverFilterNormalizationChanged = Boolean(
    serverFilterRaw
    && serverFilterEcho
    && serverFilterRaw !== serverFilterEcho
  );
  const effectiveFilter = serverFilterEcho || input.selectedFilter;
  const filterSource: RecentEventFilterSource = serverFilterEcho ? 'server' : 'local';
  const filterMismatch = Boolean(serverFilterEcho && serverFilterEcho !== input.selectedFilter);
  const filterResolution: RecentEventFilterResolution = serverFilterEcho
    ? 'server_supported'
    : serverFilterBlank
      ? 'local_blank_server_filter'
      : serverFilterRaw
        ? 'local_unsupported_server_filter'
        : 'local_no_server_filter';

  return {
    serverFilterRaw,
    serverFilterRawTrimmed,
    serverFilterBlank,
    serverFilterEcho,
    serverFilterUnsupported,
    serverFilterEvaluation,
    serverFilterNormalizationChanged,
    effectiveFilter,
    filterSource,
    filterMismatch,
    filterResolution,
  };
};

const RETRY_TERMINAL_TOKEN_SANITIZE_PATTERN = /[^A-Z0-9]+/g;
const RETRY_TERMINAL_TOKEN_TRIM_UNDERSCORE_PATTERN = /^_+|_+$/g;

const normalizeRetryToken = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value
    .trim()
    .toUpperCase()
    .replace(RETRY_TERMINAL_TOKEN_SANITIZE_PATTERN, '_')
    .replace(RETRY_TERMINAL_TOKEN_TRIM_UNDERSCORE_PATTERN, '');
  return normalized || null;
};

export type RetryTerminalOutcomeToken = 'FAIL_FAST' | 'EXHAUSTED' | 'UNKNOWN';

const normalizeRetryTerminalOutcomeAlias = (value: string): RetryTerminalOutcomeToken | null => {
  if (value === 'FAIL_FAST' || value === 'EXHAUSTED' || value === 'UNKNOWN') {
    return value;
  }
  if (value === 'FAILFAST') {
    return 'FAIL_FAST';
  }
  return null;
};

export const normalizeRetryTerminalOutcomeToken = (
  value: unknown
): RetryTerminalOutcomeToken | null => {
  const normalized = normalizeRetryToken(value);
  if (!normalized) {
    return null;
  }
  return normalizeRetryTerminalOutcomeAlias(normalized);
};

export const normalizeRetryTerminalErrorType = (value: unknown): string | null => {
  return normalizeRetryToken(value);
};

export const normalizeRetryTerminalReasonCode = (value: unknown): string | null => {
  return normalizeRetryToken(value);
};

export const normalizeRetryTerminalStatusCode = (value: unknown): number | null => {
  if (value == null || value === '' || typeof value === 'boolean') {
    return null;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }
  const normalized = Math.floor(numeric);
  if (normalized <= 0) {
    return null;
  }
  return normalized;
};

const toSortedCountMap = (counts: Record<string, number>): Record<string, number> => {
  return Object.fromEntries(
    Object.entries(counts).sort(([left], [right]) => left.localeCompare(right))
  );
};

const incrementCount = (counts: Record<string, number>, key: string): void => {
  counts[key] = (counts[key] || 0) + 1;
};

export interface RetryTerminalEventLike {
  retryFinalOutcome?: unknown;
  retryRetryable?: unknown;
  retryErrorType?: unknown;
  retryErrorStatusCode?: unknown;
  retryErrorReasonCode?: unknown;
}

export interface RetryTerminalSummary {
  eventCount: number;
  outcomeCounts: Record<string, number>;
  retryabilityCounts: Record<string, number>;
  errorTypeCounts: Record<string, number>;
  reasonCodeCounts: Record<string, number>;
  statusCodeCounts: Record<string, number>;
}

export interface RetryTerminalPressure {
  label: 'None' | 'Low' | 'Moderate' | 'High';
  hint: string;
  signalCount: number;
}

export interface RetryTerminalTopEntry {
  key: string;
  count: number;
}

export const buildRetryTerminalSummary = (
  rows: RetryTerminalEventLike[]
): RetryTerminalSummary => {
  let eventCount = 0;
  const outcomeCounts: Record<string, number> = {};
  const retryabilityCounts: Record<string, number> = {};
  const errorTypeCounts: Record<string, number> = {};
  const reasonCodeCounts: Record<string, number> = {};
  const statusCodeCounts: Record<string, number> = {};

  for (const row of rows || []) {
    const outcome = normalizeRetryTerminalOutcomeToken(row.retryFinalOutcome);
    const errorType = normalizeRetryTerminalErrorType(row.retryErrorType);
    const reasonCode = normalizeRetryTerminalReasonCode(row.retryErrorReasonCode);
    const statusCode = normalizeRetryTerminalStatusCode(row.retryErrorStatusCode);
    const retryableValue = row.retryRetryable;

    const hasTerminalContext =
      Boolean(outcome)
      || typeof retryableValue === 'boolean'
      || Boolean(errorType)
      || Boolean(reasonCode)
      || typeof statusCode === 'number';

    if (!hasTerminalContext) {
      continue;
    }

    eventCount += 1;
    incrementCount(outcomeCounts, outcome || 'UNKNOWN');
    if (retryableValue === true) {
      incrementCount(retryabilityCounts, 'RETRYABLE');
    } else if (retryableValue === false) {
      incrementCount(retryabilityCounts, 'NON_RETRYABLE');
    } else {
      incrementCount(retryabilityCounts, 'UNKNOWN');
    }
    if (errorType) {
      incrementCount(errorTypeCounts, errorType);
    }
    if (reasonCode) {
      incrementCount(reasonCodeCounts, reasonCode);
    }
    if (typeof statusCode === 'number') {
      incrementCount(statusCodeCounts, String(statusCode));
    }
  }

  return {
    eventCount,
    outcomeCounts: toSortedCountMap(outcomeCounts),
    retryabilityCounts: toSortedCountMap(retryabilityCounts),
    errorTypeCounts: toSortedCountMap(errorTypeCounts),
    reasonCodeCounts: toSortedCountMap(reasonCodeCounts),
    statusCodeCounts: toSortedCountMap(statusCodeCounts),
  };
};

export const resolveRetryTerminalPressure = (
  summary: RetryTerminalSummary
): RetryTerminalPressure => {
  const eventCount = Number(summary?.eventCount || 0);
  const nonRetryableCount = Number(summary?.retryabilityCounts?.NON_RETRYABLE || 0);
  const failFastCount = Number(summary?.outcomeCounts?.FAIL_FAST || 0);

  const signalCount = Math.max(nonRetryableCount, failFastCount);
  if (eventCount <= 0) {
    return {
      label: 'None',
      hint: 'No retry terminal failures observed in this telemetry window.',
      signalCount: 0,
    };
  }
  if (nonRetryableCount >= 5 || failFastCount >= 3) {
    return {
      label: 'High',
      hint: 'Sustained terminal retry failures detected. Hold expansion and triage top reason/status immediately.',
      signalCount,
    };
  }
  if (nonRetryableCount >= 2 || failFastCount >= 1 || eventCount >= 4) {
    return {
      label: 'Moderate',
      hint: 'Terminal retry pressure is elevated. Keep rollout guarded and monitor dominant reason codes.',
      signalCount,
    };
  }
  return {
    label: 'Low',
    hint: 'Terminal retry failures are present but limited. Continue guarded monitoring.',
    signalCount,
  };
};

export const getRetryTerminalTopEntry = (
  counts: Record<string, number>
): RetryTerminalTopEntry | null => {
  const normalizedEntries = Object.entries(counts || {})
    .filter(([, value]) => Number.isFinite(Number(value)) && Number(value) > 0)
    .map(([key, value]) => [key, Number(value)] as const);
  if (normalizedEntries.length === 0) {
    return null;
  }
  normalizedEntries.sort(([leftKey, leftValue], [rightKey, rightValue]) => {
    if (rightValue !== leftValue) {
      return rightValue - leftValue;
    }
    return leftKey.localeCompare(rightKey);
  });
  const [key, count] = normalizedEntries[0];
  return { key, count };
};

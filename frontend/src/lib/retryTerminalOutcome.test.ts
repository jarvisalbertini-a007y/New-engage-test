import {
  buildRetryTerminalSummary,
  getRetryTerminalTopEntry,
  normalizeRetryTerminalErrorType,
  normalizeRetryTerminalOutcomeToken,
  normalizeRetryTerminalReasonCode,
  normalizeRetryTerminalStatusCode,
  resolveRetryTerminalPressure,
} from './retryTerminalOutcome';

describe('normalizeRetryTerminalOutcomeToken', () => {
  it('normalizes fail-fast aliases and canonical values', () => {
    expect(normalizeRetryTerminalOutcomeToken(' fail fast ')).toBe('FAIL_FAST');
    expect(normalizeRetryTerminalOutcomeToken('exhausted')).toBe('EXHAUSTED');
    expect(normalizeRetryTerminalOutcomeToken('unknown')).toBe('UNKNOWN');
  });

  it('returns null for unsupported or non-string values', () => {
    expect(normalizeRetryTerminalOutcomeToken('success')).toBeNull();
    expect(normalizeRetryTerminalOutcomeToken(null)).toBeNull();
    expect(normalizeRetryTerminalOutcomeToken(42)).toBeNull();
  });
});

describe('retry-terminal token normalizers', () => {
  it('normalizes error type and reason code tokens', () => {
    expect(normalizeRetryTerminalErrorType(' http 5xx ')).toBe('HTTP_5XX');
    expect(normalizeRetryTerminalReasonCode(' provider.http_error ')).toBe('PROVIDER_HTTP_ERROR');
  });

  it('normalizes retry status codes to non-negative integers', () => {
    expect(normalizeRetryTerminalStatusCode('503')).toBe(503);
    expect(normalizeRetryTerminalStatusCode(429.9)).toBe(429);
    expect(normalizeRetryTerminalStatusCode(-1)).toBeNull();
    expect(normalizeRetryTerminalStatusCode('not-a-number')).toBeNull();
  });
});

describe('buildRetryTerminalSummary', () => {
  it('aggregates terminal retry outcomes and metadata counts', () => {
    expect(
      buildRetryTerminalSummary([
        {
          retryFinalOutcome: 'exhausted',
          retryRetryable: true,
          retryErrorType: 'http_5xx',
          retryErrorStatusCode: 503,
          retryErrorReasonCode: 'provider_http_5xx',
        },
        {
          retryFinalOutcome: 'fail-fast',
          retryRetryable: false,
          retryErrorType: 'auth_error',
          retryErrorStatusCode: 401,
          retryErrorReasonCode: 'provider_auth_error',
        },
        {
          retryRetryable: null,
          retryErrorReasonCode: ' provider_http_5xx ',
        },
        {},
      ])
    ).toEqual({
      eventCount: 3,
      outcomeCounts: {
        EXHAUSTED: 1,
        FAIL_FAST: 1,
        UNKNOWN: 1,
      },
      retryabilityCounts: {
        NON_RETRYABLE: 1,
        RETRYABLE: 1,
        UNKNOWN: 1,
      },
      errorTypeCounts: {
        AUTH_ERROR: 1,
        HTTP_5XX: 1,
      },
      reasonCodeCounts: {
        PROVIDER_AUTH_ERROR: 1,
        PROVIDER_HTTP_5XX: 2,
      },
      statusCodeCounts: {
        '401': 1,
        '503': 1,
      },
    });
  });

  it('returns empty aggregates when terminal metadata is absent', () => {
    expect(
      buildRetryTerminalSummary([
        {},
      ])
    ).toEqual({
      eventCount: 0,
      outcomeCounts: {},
      retryabilityCounts: {},
      errorTypeCounts: {},
      reasonCodeCounts: {},
      statusCodeCounts: {},
    });
  });
});

describe('resolveRetryTerminalPressure', () => {
  it('returns none pressure when no terminal events exist', () => {
    expect(
      resolveRetryTerminalPressure(
        buildRetryTerminalSummary([{}])
      )
    ).toEqual({
      label: 'None',
      hint: 'No retry terminal failures observed in this telemetry window.',
      signalCount: 0,
    });
  });

  it('returns high pressure for sustained non-retryable or fail-fast outcomes', () => {
    expect(
      resolveRetryTerminalPressure({
        eventCount: 6,
        outcomeCounts: { FAIL_FAST: 3, EXHAUSTED: 2, UNKNOWN: 1 },
        retryabilityCounts: { NON_RETRYABLE: 5, RETRYABLE: 1 },
        errorTypeCounts: {},
        reasonCodeCounts: {},
        statusCodeCounts: {},
      }).label
    ).toBe('High');
  });

  it('returns moderate pressure for limited but non-zero terminal signals', () => {
    expect(
      resolveRetryTerminalPressure({
        eventCount: 3,
        outcomeCounts: { FAIL_FAST: 1, EXHAUSTED: 2 },
        retryabilityCounts: { NON_RETRYABLE: 1, RETRYABLE: 2 },
        errorTypeCounts: {},
        reasonCodeCounts: {},
        statusCodeCounts: {},
      }).label
    ).toBe('Moderate');
  });

  it('returns low pressure for small terminal signal counts', () => {
    expect(
      resolveRetryTerminalPressure({
        eventCount: 1,
        outcomeCounts: { EXHAUSTED: 1 },
        retryabilityCounts: { NON_RETRYABLE: 1 },
        errorTypeCounts: {},
        reasonCodeCounts: {},
        statusCodeCounts: {},
      }).label
    ).toBe('Low');
  });
});

describe('getRetryTerminalTopEntry', () => {
  it('returns null for empty/invalid maps', () => {
    expect(getRetryTerminalTopEntry({})).toBeNull();
    expect(getRetryTerminalTopEntry({ PASS: -1 })).toBeNull();
  });

  it('returns highest-count entry and resolves ties lexicographically', () => {
    expect(
      getRetryTerminalTopEntry({
        PROVIDER_HTTP_5XX: 4,
        PROVIDER_AUTH_ERROR: 4,
        PROVIDER_TIMEOUT: 1,
      })
    ).toEqual({
      key: 'PROVIDER_AUTH_ERROR',
      count: 4,
    });
  });
});

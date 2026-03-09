import {
  normalizeRecentEventCounts,
  normalizeRecentEventPacketBreakdown,
  resolveRecentEventFilterProvenance
} from './recentEventCounts';

describe('normalizeRecentEventCounts', () => {
  it('uses row count when metadata is missing', () => {
    const result = normalizeRecentEventCounts({
      totalCount: undefined,
      filteredCount: undefined,
      rowCount: 3,
      hasServerFilterEcho: false,
    });

    expect(result).toEqual({ totalCount: 3, filteredCount: 3 });
  });

  it('coerces negative counts back to row count', () => {
    const result = normalizeRecentEventCounts({
      totalCount: -5,
      filteredCount: -2,
      rowCount: 2,
      hasServerFilterEcho: true,
    });

    expect(result).toEqual({ totalCount: 2, filteredCount: 2 });
  });

  it('coerces non-finite values back to row count', () => {
    const result = normalizeRecentEventCounts({
      totalCount: Number.NaN,
      filteredCount: Number.POSITIVE_INFINITY,
      rowCount: 4,
      hasServerFilterEcho: true,
    });

    expect(result).toEqual({ totalCount: 4, filteredCount: 4 });
  });

  it('clamps filtered count to total count when metadata exceeds bounds', () => {
    const result = normalizeRecentEventCounts({
      totalCount: 5,
      filteredCount: 99,
      rowCount: 2,
      hasServerFilterEcho: true,
    });

    expect(result).toEqual({ totalCount: 5, filteredCount: 5 });
  });

  it('forces total count to be at least rendered row count', () => {
    const result = normalizeRecentEventCounts({
      totalCount: 1,
      filteredCount: 1,
      rowCount: 3,
      hasServerFilterEcho: true,
    });

    expect(result).toEqual({ totalCount: 3, filteredCount: 3 });
  });
});

describe('resolveRecentEventFilterProvenance', () => {
  it('uses server supported filter token and flags mismatch when user selected different filter', () => {
    const result = resolveRecentEventFilterProvenance({
      selectedFilter: 'all',
      rawServerFilter: ' PACKET ',
    });

    expect(result.serverFilterRaw).toBe(' PACKET ');
    expect(result.serverFilterRawTrimmed).toBe('PACKET');
    expect(result.serverFilterBlank).toBe(false);
    expect(result.serverFilterEcho).toBe('packet');
    expect(result.serverFilterUnsupported).toBe(false);
    expect(result.serverFilterEvaluation).toBe('supported');
    expect(result.serverFilterNormalizationChanged).toBe(true);
    expect(result.effectiveFilter).toBe('packet');
    expect(result.filterSource).toBe('server');
    expect(result.filterMismatch).toBe(true);
    expect(result.filterResolution).toBe('server_supported');
  });

  it('treats unsupported non-empty server filter token as local fallback', () => {
    const result = resolveRecentEventFilterProvenance({
      selectedFilter: 'packet',
      rawServerFilter: 'surprise-filter-token',
    });

    expect(result.serverFilterRaw).toBe('surprise-filter-token');
    expect(result.serverFilterRawTrimmed).toBe('surprise-filter-token');
    expect(result.serverFilterBlank).toBe(false);
    expect(result.serverFilterEcho).toBeNull();
    expect(result.serverFilterUnsupported).toBe(true);
    expect(result.serverFilterEvaluation).toBe('unsupported');
    expect(result.serverFilterNormalizationChanged).toBe(false);
    expect(result.effectiveFilter).toBe('packet');
    expect(result.filterSource).toBe('local');
    expect(result.filterMismatch).toBe(false);
    expect(result.filterResolution).toBe('local_unsupported_server_filter');
  });

  it('treats whitespace-only server filter token as blank and absent', () => {
    const result = resolveRecentEventFilterProvenance({
      selectedFilter: 'packet',
      rawServerFilter: '   ',
    });

    expect(result.serverFilterRaw).toBe('   ');
    expect(result.serverFilterRawTrimmed).toBeNull();
    expect(result.serverFilterBlank).toBe(true);
    expect(result.serverFilterEcho).toBeNull();
    expect(result.serverFilterUnsupported).toBe(false);
    expect(result.serverFilterEvaluation).toBe('absent');
    expect(result.serverFilterNormalizationChanged).toBe(false);
    expect(result.effectiveFilter).toBe('packet');
    expect(result.filterSource).toBe('local');
    expect(result.filterMismatch).toBe(false);
    expect(result.filterResolution).toBe('local_blank_server_filter');
  });

  it('treats missing server filter token as absent and local fallback', () => {
    const result = resolveRecentEventFilterProvenance({
      selectedFilter: 'all',
      rawServerFilter: null,
    });

    expect(result.serverFilterRaw).toBeNull();
    expect(result.serverFilterRawTrimmed).toBeNull();
    expect(result.serverFilterBlank).toBe(false);
    expect(result.serverFilterEcho).toBeNull();
    expect(result.serverFilterUnsupported).toBe(false);
    expect(result.serverFilterEvaluation).toBe('absent');
    expect(result.serverFilterNormalizationChanged).toBe(false);
    expect(result.effectiveFilter).toBe('all');
    expect(result.filterSource).toBe('local');
    expect(result.filterMismatch).toBe(false);
    expect(result.filterResolution).toBe('local_no_server_filter');
  });
});

describe('normalizeRecentEventPacketBreakdown', () => {
  it('uses server-provided packet and non-packet counts when valid', () => {
    const result = normalizeRecentEventPacketBreakdown({
      totalCount: 10,
      packetValidationCount: 4,
      nonPacketCount: 6,
      fallbackPacketValidationCount: 3,
    });

    expect(result).toEqual({ packetValidationCount: 4, nonPacketCount: 6 });
  });

  it('falls back to derived packet counts when server packet count is malformed', () => {
    const result = normalizeRecentEventPacketBreakdown({
      totalCount: 5,
      packetValidationCount: Number.NaN,
      nonPacketCount: 3,
      fallbackPacketValidationCount: 2,
    });

    expect(result).toEqual({ packetValidationCount: 2, nonPacketCount: 3 });
  });

  it('clamps overflow so packet+non-packet does not exceed total', () => {
    const result = normalizeRecentEventPacketBreakdown({
      totalCount: 7,
      packetValidationCount: 6,
      nonPacketCount: 4,
      fallbackPacketValidationCount: 1,
    });

    expect(result).toEqual({ packetValidationCount: 6, nonPacketCount: 1 });
  });
});

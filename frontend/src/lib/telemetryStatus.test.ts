import {
  classifyTelemetryStatusCountProvenance,
  resolveTelemetryStatusCountPosture,
  areTelemetryStatusCountMapsEqual,
  buildTelemetryStatusCountMap,
  formatTelemetryStatusCountMap,
  normalizeTelemetryStatusCountMap,
  normalizeTelemetryStatusToken,
  resolveTelemetryStatusCountProvenance,
  resolveTelemetryStatusCountProvenanceWithMetadata,
} from './telemetryStatus';

describe('normalizeTelemetryStatusToken', () => {
  it('normalizes casing and whitespace', () => {
    expect(normalizeTelemetryStatusToken(' action required ')).toBe('ACTION_REQUIRED');
  });

  it('collapses punctuation and separators', () => {
    expect(normalizeTelemetryStatusToken('ready-for.rollout')).toBe('READY_FOR_ROLLOUT');
  });

  it('returns null for blank or punctuation-only strings', () => {
    expect(normalizeTelemetryStatusToken('   ')).toBeNull();
    expect(normalizeTelemetryStatusToken('!!!')).toBeNull();
  });

  it('returns null for non-string values', () => {
    expect(normalizeTelemetryStatusToken(null)).toBeNull();
    expect(normalizeTelemetryStatusToken(12)).toBeNull();
    expect(normalizeTelemetryStatusToken(true)).toBeNull();
  });
});

describe('normalizeTelemetryStatusCountMap', () => {
  it('normalizes status keys and aggregates duplicate variants', () => {
    expect(
      normalizeTelemetryStatusCountMap({
        pass: 1,
        'PASS ': 2,
        'action required': 3,
      })
    ).toEqual({
      ACTION_REQUIRED: 3,
      PASS: 3,
    });
  });

  it('ignores invalid keys and invalid counts', () => {
    expect(
      normalizeTelemetryStatusCountMap({
        '   ': 2,
        '!!!': 4,
        READY: -1,
        HOLD: 'abc',
      })
    ).toEqual({});
  });

  it('returns empty map for non-object inputs', () => {
    expect(normalizeTelemetryStatusCountMap(null)).toEqual({});
    expect(normalizeTelemetryStatusCountMap([])).toEqual({});
    expect(normalizeTelemetryStatusCountMap('PASS')).toEqual({});
  });
});

describe('buildTelemetryStatusCountMap', () => {
  it('builds counts from status-token arrays', () => {
    expect(
      buildTelemetryStatusCountMap(['pass', 'PASS', 'action required', null, '!!!'])
    ).toEqual({
      ACTION_REQUIRED: 1,
      PASS: 2,
    });
  });
});

describe('formatTelemetryStatusCountMap', () => {
  it('formats status counts for UI summaries', () => {
    expect(
      formatTelemetryStatusCountMap({ ACTION_REQUIRED: 2, PASS: 1 })
    ).toBe('ACTION_REQUIRED: 2 | PASS: 1');
  });

  it('returns none when map is empty', () => {
    expect(formatTelemetryStatusCountMap({})).toBe('none');
  });
});

describe('areTelemetryStatusCountMapsEqual', () => {
  it('returns true for matching maps regardless of key order', () => {
    expect(
      areTelemetryStatusCountMapsEqual(
        { PASS: 2, ACTION_REQUIRED: 1 },
        { ACTION_REQUIRED: 1, PASS: 2 }
      )
    ).toBe(true);
  });

  it('returns false for mismatched keys or values', () => {
    expect(
      areTelemetryStatusCountMapsEqual(
        { PASS: 2 },
        { PASS: 1 }
      )
    ).toBe(false);
    expect(
      areTelemetryStatusCountMapsEqual(
        { PASS: 2 },
        { FAIL: 2 }
      )
    ).toBe(false);
  });
});

describe('resolveTelemetryStatusCountProvenance', () => {
  it('uses server counts when provided and detects no mismatch when equal', () => {
    expect(
      resolveTelemetryStatusCountProvenance(
        { 'pass ': 2 },
        { PASS: 2 }
      )
    ).toEqual({
      effectiveCounts: { PASS: 2 },
      serverCounts: { PASS: 2 },
      fallbackCounts: { PASS: 2 },
      source: 'server',
      mismatch: false,
    });
  });

  it('detects mismatch when server and fallback counts differ', () => {
    const result = resolveTelemetryStatusCountProvenance(
      { PASS: 1 },
      { PASS: 2 }
    );
    expect(result.source).toBe('server');
    expect(result.mismatch).toBe(true);
    expect(result.effectiveCounts).toEqual({ PASS: 1 });
    expect(result.serverCounts).toEqual({ PASS: 1 });
    expect(result.fallbackCounts).toEqual({ PASS: 2 });
  });

  it('falls back to local counts when server counts are absent', () => {
    const result = resolveTelemetryStatusCountProvenance(
      null,
      { ACTION_REQUIRED: 3 }
    );
    expect(result.source).toBe('local');
    expect(result.mismatch).toBe(false);
    expect(result.effectiveCounts).toEqual({ ACTION_REQUIRED: 3 });
    expect(result.serverCounts).toEqual({});
    expect(result.fallbackCounts).toEqual({ ACTION_REQUIRED: 3 });
  });
});

describe('resolveTelemetryStatusCountProvenanceWithMetadata', () => {
  it('uses explicit backend provenance fields when provided', () => {
    expect(
      resolveTelemetryStatusCountProvenanceWithMetadata(
        {
          statusCounts: { PASS: 5 },
          statusCountsSource: 'local',
          statusCountsMismatch: true,
          statusCountsServer: { PASS: 5 },
          statusCountsFallback: { ACTION_REQUIRED: 1 },
        },
        { PASS: 2 }
      )
    ).toEqual({
      effectiveCounts: { ACTION_REQUIRED: 1 },
      serverCounts: { PASS: 5 },
      fallbackCounts: { ACTION_REQUIRED: 1 },
      source: 'local',
      mismatch: true,
    });
  });

  it('falls back to computed provenance when backend provenance fields are absent', () => {
    expect(
      resolveTelemetryStatusCountProvenanceWithMetadata(
        {
          statusCounts: { PASS: 2 },
        },
        { PASS: 1 }
      )
    ).toEqual({
      effectiveCounts: { PASS: 2 },
      serverCounts: { PASS: 2 },
      fallbackCounts: { PASS: 1 },
      source: 'server',
      mismatch: true,
    });
  });

  it('falls back to computed source when backend source token is unsupported', () => {
    expect(
      resolveTelemetryStatusCountProvenanceWithMetadata(
        {
          statusCounts: { PASS: 2 },
          statusCountsSource: ' unsupported_source ',
        },
        { PASS: 1 }
      )
    ).toEqual({
      effectiveCounts: { PASS: 2 },
      serverCounts: { PASS: 2 },
      fallbackCounts: { PASS: 1 },
      source: 'server',
      mismatch: true,
    });
  });

  it('ignores non-boolean mismatch metadata and keeps local-source mismatch false', () => {
    expect(
      resolveTelemetryStatusCountProvenanceWithMetadata(
        {
          statusCountsSource: 'local',
          statusCountsMismatch: 'true',
          statusCountsServer: { PASS: 4 },
          statusCountsFallback: { ACTION_REQUIRED: 2 },
        },
        { PASS: 1 }
      )
    ).toEqual({
      effectiveCounts: { ACTION_REQUIRED: 2 },
      serverCounts: { PASS: 4 },
      fallbackCounts: { ACTION_REQUIRED: 2 },
      source: 'local',
      mismatch: false,
    });
  });
});

describe('classifyTelemetryStatusCountProvenance', () => {
  it('classifies server and mismatch=false as server_consistent', () => {
    expect(
      classifyTelemetryStatusCountProvenance({
        effectiveCounts: { PASS: 1 },
        serverCounts: { PASS: 1 },
        fallbackCounts: { PASS: 1 },
        source: 'server',
        mismatch: false,
      })
    ).toEqual({
      posture: 'server_consistent',
      label: 'SERVER_CONSISTENT',
      severity: 'info',
      requiresInvestigation: false,
    });
  });

  it('classifies server and mismatch=true as server_drift', () => {
    expect(
      classifyTelemetryStatusCountProvenance({
        effectiveCounts: { PASS: 2 },
        serverCounts: { PASS: 2 },
        fallbackCounts: { PASS: 1 },
        source: 'server',
        mismatch: true,
      })
    ).toEqual({
      posture: 'server_drift',
      label: 'SERVER_DRIFT',
      severity: 'warning',
      requiresInvestigation: true,
    });
  });

  it('classifies local and mismatch=false as local_fallback', () => {
    expect(
      classifyTelemetryStatusCountProvenance({
        effectiveCounts: { ACTION_REQUIRED: 1 },
        serverCounts: {},
        fallbackCounts: { ACTION_REQUIRED: 1 },
        source: 'local',
        mismatch: false,
      })
    ).toEqual({
      posture: 'local_fallback',
      label: 'LOCAL_FALLBACK',
      severity: 'info',
      requiresInvestigation: false,
    });
  });

  it('classifies local and mismatch=true as local_drift', () => {
    expect(
      classifyTelemetryStatusCountProvenance({
        effectiveCounts: { ACTION_REQUIRED: 1 },
        serverCounts: { PASS: 3 },
        fallbackCounts: { ACTION_REQUIRED: 1 },
        source: 'local',
        mismatch: true,
      })
    ).toEqual({
      posture: 'local_drift',
      label: 'LOCAL_DRIFT',
      severity: 'warning',
      requiresInvestigation: true,
    });
  });
});

describe('resolveTelemetryStatusCountPosture', () => {
  const baseProvenance = {
    effectiveCounts: { PASS: 1 },
    serverCounts: { PASS: 1 },
    fallbackCounts: { PASS: 1 },
    source: 'server' as const,
    mismatch: false,
  };

  it('uses computed posture when backend posture metadata is absent', () => {
    expect(resolveTelemetryStatusCountPosture(baseProvenance)).toEqual({
      posture: 'server_consistent',
      label: 'SERVER_CONSISTENT',
      severity: 'info',
      requiresInvestigation: false,
    });
  });

  it('uses backend-provided posture metadata when valid', () => {
    expect(
      resolveTelemetryStatusCountPosture(baseProvenance, {
        posture: 'local_drift',
        postureSeverity: 'warning',
        requiresInvestigation: true,
      })
    ).toEqual({
      posture: 'local_drift',
      label: 'LOCAL_DRIFT',
      severity: 'warning',
      requiresInvestigation: true,
    });
  });

  it('falls back to computed posture when backend posture token is unsupported', () => {
    expect(
      resolveTelemetryStatusCountPosture(baseProvenance, {
        posture: 'unknown-posture',
        postureSeverity: 'bad-severity',
        requiresInvestigation: 'true',
      })
    ).toEqual({
      posture: 'server_consistent',
      label: 'SERVER_CONSISTENT',
      severity: 'info',
      requiresInvestigation: false,
    });
  });

  it('falls back severity to posture defaults when backend severity is absent', () => {
    expect(
      resolveTelemetryStatusCountPosture(baseProvenance, {
        posture: 'server_drift',
      })
    ).toEqual({
      posture: 'server_drift',
      label: 'SERVER_DRIFT',
      severity: 'warning',
      requiresInvestigation: true,
    });
  });

  it('falls back severity to posture defaults when backend severity token is invalid', () => {
    expect(
      resolveTelemetryStatusCountPosture(baseProvenance, {
        posture: 'local_fallback',
        postureSeverity: 'invalid',
        requiresInvestigation: false,
      })
    ).toEqual({
      posture: 'local_fallback',
      label: 'LOCAL_FALLBACK',
      severity: 'info',
      requiresInvestigation: false,
    });
  });

  it('falls back requiresInvestigation to posture defaults when metadata is non-boolean', () => {
    expect(
      resolveTelemetryStatusCountPosture(baseProvenance, {
        posture: 'local_fallback',
        postureSeverity: 'info',
        requiresInvestigation: 'false',
      })
    ).toEqual({
      posture: 'local_fallback',
      label: 'LOCAL_FALLBACK',
      severity: 'info',
      requiresInvestigation: false,
    });
  });
});

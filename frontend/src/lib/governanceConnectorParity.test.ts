import {
  buildConnectorPressureParityMetadata,
  buildSendgridWebhookTimestampParityMetadata,
} from './governanceConnectorParity';

describe('buildConnectorPressureParityMetadata', () => {
  it('normalizes endpoint keys and computes parity fields', () => {
    const metadata = buildConnectorPressureParityMetadata(
      {
        eventCount: 5,
        byEndpoint: {
          ' Apollo Search ': 2,
          'company-enrichment orchestration': 3,
        },
        pressure: { label: 'HIGH' },
      },
      {
        eventCount: 5,
        byEndpoint: {
          apollo_search: 2,
          company_enrichment_orchestration: 3,
        },
        pressure: { label: 'high' },
      },
      5
    );

    expect(metadata.topLevelEventCount).toBe(5);
    expect(metadata.nestedEventCount).toBe(5);
    expect(metadata.totalsEventCount).toBe(5);
    expect(metadata.eventCountMatchesNested).toBe(true);
    expect(metadata.eventCountMatchesTotals).toBe(true);
    expect(metadata.byEndpointMatchesNested).toBe(true);
    expect(metadata.pressureLabelMatchesNested).toBe(true);
    expect(metadata.normalizedTopLevelByEndpoint.apollo_search).toBe(2);
    expect(metadata.normalizedTopLevelByEndpoint.company_enrichment_orchestration).toBe(3);
    expect(typeof metadata.computedAt).toBe('string');
  });

  it('returns null parity fields when evidence is missing', () => {
    const metadata = buildConnectorPressureParityMetadata(
      {
        eventCount: undefined,
        byEndpoint: undefined,
        pressure: { label: undefined },
      },
      {
        eventCount: undefined,
        byEndpoint: undefined,
        pressure: { label: undefined },
      },
      undefined
    );

    expect(metadata.eventCountMatchesNested).toBeNull();
    expect(metadata.eventCountMatchesTotals).toBeNull();
    expect(metadata.byEndpointMatchesNested).toBeNull();
    expect(metadata.pressureLabelMatchesNested).toBeNull();
    expect(metadata.normalizedTopLevelByEndpoint).toEqual({});
    expect(metadata.normalizedNestedByEndpoint).toEqual({});
  });

  it('ignores invalid counts and compares endpoint maps independent of object key ordering', () => {
    const metadata = buildConnectorPressureParityMetadata(
      {
        eventCount: 6,
        byEndpoint: {
          b_endpoint: 1,
          a_endpoint: 2,
          skipped: -1,
        },
      },
      {
        eventCount: 6,
        byEndpoint: {
          a_endpoint: 2,
          b_endpoint: 1,
        },
      },
      7
    );

    expect(metadata.byEndpointMatchesNested).toBe(true);
    expect(metadata.eventCountMatchesNested).toBe(true);
    expect(metadata.eventCountMatchesTotals).toBe(false);
  });
});

describe('buildSendgridWebhookTimestampParityMetadata', () => {
  it('normalizes sendgrid timestamp maps and computes parity fields', () => {
    const metadata = buildSendgridWebhookTimestampParityMetadata(
      {
        eventCount: 4,
        timestampAnomalyCountTotal: 3,
        pressureLabelCounts: { High: 2, moderate: 2 },
        pressureHintCounts: {
          'Investigate stale timestamps': 2,
          'Investigate stale    timestamps ': 1,
        },
        timestampAgeBucketCounts: { 'future-skew': 1, stale: 2 },
        timestampAnomalyEventTypeCounts: { Open: 2, processed: 1 },
        latestEventAt: '2026-03-02T10:00:00+00:00',
      },
      {
        eventCount: 4,
        timestampAnomalyCountTotal: 3,
        pressureLabelCounts: { high: 2, MODERATE: 2 },
        pressureHintCounts: {
          'investigate stale timestamps': 3,
        },
        timestampAgeBucketCounts: { future_skew: 1, STALE: 2 },
        timestampAnomalyEventTypeCounts: { open: 2, PROCESSED: 1 },
        latestEventAt: '2026-03-02T10:00:00Z',
      },
      4
    );

    expect(metadata.eventCountMatchesNested).toBe(true);
    expect(metadata.eventCountMatchesTotals).toBe(true);
    expect(metadata.anomalyCountTotalMatchesNested).toBe(true);
    expect(metadata.pressureLabelCountsMatchNested).toBe(true);
    expect(metadata.pressureHintCountsMatchNested).toBe(true);
    expect(metadata.ageBucketCountsMatchNested).toBe(true);
    expect(metadata.anomalyEventTypeCountsMatchNested).toBe(true);
    expect(metadata.latestEventAtMatchesNested).toBe(true);
    expect(metadata.normalizedTopLevelPressureLabelCounts.high).toBe(2);
    expect(metadata.normalizedTopLevelPressureLabelCounts.moderate).toBe(2);
    expect(metadata.normalizedTopLevelPressureHintCounts['investigate stale timestamps']).toBe(3);
    expect(metadata.normalizedTopLevelAgeBucketCounts.future_skew).toBe(1);
    expect(metadata.normalizedTopLevelAnomalyEventTypeCounts.open).toBe(2);
  });

  it('returns null parity checks when comparable sendgrid evidence is missing', () => {
    const metadata = buildSendgridWebhookTimestampParityMetadata(
      {
        eventCount: undefined,
        timestampAnomalyCountTotal: undefined,
        pressureLabelCounts: undefined,
        pressureHintCounts: undefined,
        timestampAgeBucketCounts: undefined,
        timestampAnomalyEventTypeCounts: undefined,
        latestEventAt: undefined,
      },
      {
        eventCount: undefined,
        timestampAnomalyCountTotal: undefined,
        pressureLabelCounts: undefined,
        pressureHintCounts: undefined,
        timestampAgeBucketCounts: undefined,
        timestampAnomalyEventTypeCounts: undefined,
        latestEventAt: undefined,
      },
      undefined
    );

    expect(metadata.eventCountMatchesNested).toBeNull();
    expect(metadata.eventCountMatchesTotals).toBeNull();
    expect(metadata.anomalyCountTotalMatchesNested).toBeNull();
    expect(metadata.pressureLabelCountsMatchNested).toBeNull();
    expect(metadata.pressureHintCountsMatchNested).toBeNull();
    expect(metadata.ageBucketCountsMatchNested).toBeNull();
    expect(metadata.anomalyEventTypeCountsMatchNested).toBeNull();
    expect(metadata.latestEventAtMatchesNested).toBeNull();
  });

  it('flags sendgrid parity mismatch when top-level and nested rollups drift', () => {
    const metadata = buildSendgridWebhookTimestampParityMetadata(
      {
        eventCount: 3,
        timestampAnomalyCountTotal: 4,
        pressureLabelCounts: { high: 3 },
        timestampAgeBucketCounts: { stale: 3 },
        timestampAnomalyEventTypeCounts: { open: 2, click: 2 },
        latestEventAt: '2026-03-02T09:00:00Z',
      },
      {
        eventCount: 2,
        timestampAnomalyCountTotal: 1,
        pressureLabelCounts: { moderate: 2 },
        timestampAgeBucketCounts: { stale: 1, future_skew: 1 },
        timestampAnomalyEventTypeCounts: { open: 1 },
        latestEventAt: '2026-03-02T08:00:00Z',
      },
      2
    );

    expect(metadata.eventCountMatchesNested).toBe(false);
    expect(metadata.eventCountMatchesTotals).toBe(false);
    expect(metadata.anomalyCountTotalMatchesNested).toBe(false);
    expect(metadata.pressureLabelCountsMatchNested).toBe(false);
    expect(metadata.ageBucketCountsMatchNested).toBe(false);
    expect(metadata.anomalyEventTypeCountsMatchNested).toBe(false);
    expect(metadata.latestEventAtMatchesNested).toBe(false);
  });
});

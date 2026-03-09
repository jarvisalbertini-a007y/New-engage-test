import {
  buildIntegrationHealthExportMetadata,
  buildIntegrationHealthFreshnessRows,
  buildIntegrationHealthFreshnessStatusCountMap,
  normalizeIntegrationHealthStatus,
  normalizeIntegrationHealthFreshnessStatusCountMap,
  resolveIntegrationHealthFreshnessStatusCountProvenance,
} from "./integrationHealth";

describe("normalizeIntegrationHealthStatus", () => {
  it("normalizes valid status values", () => {
    expect(normalizeIntegrationHealthStatus(" action required ")).toBe(
      "ACTION_REQUIRED"
    );
    expect(normalizeIntegrationHealthStatus("ready")).toBe("READY");
    expect(normalizeIntegrationHealthStatus("unknown")).toBe("UNKNOWN");
  });

  it("uses fallback for unsupported or invalid values", () => {
    expect(normalizeIntegrationHealthStatus("hold")).toBe("UNKNOWN");
    expect(normalizeIntegrationHealthStatus(null)).toBe("UNKNOWN");
    expect(normalizeIntegrationHealthStatus("hold", "READY")).toBe("READY");
  });
});

describe("buildIntegrationHealthFreshnessRows", () => {
  it("builds sorted provider rows with normalized status and numeric ages", () => {
    expect(
      buildIntegrationHealthFreshnessRows({
        clearbit: {
          status: " action required ",
          configuredAgeDays: "120",
          rotationAgeDays: 101,
          staleReasons: ["rotation_age_exceeded"],
        },
        apollo: {
          status: "ready",
          configuredAgeDays: 9,
          rotationAgeDays: "8",
          staleReasons: [],
        },
      })
    ).toEqual([
      {
        provider: "apollo",
        status: "READY",
        configuredAgeDays: 9,
        rotationAgeDays: 8,
        staleReasons: [],
      },
      {
        provider: "clearbit",
        status: "ACTION_REQUIRED",
        configuredAgeDays: 120,
        rotationAgeDays: 101,
        staleReasons: ["rotation_age_exceeded"],
      },
    ]);
  });

  it("handles malformed inputs safely", () => {
    expect(buildIntegrationHealthFreshnessRows(null)).toEqual([]);
    expect(
      buildIntegrationHealthFreshnessRows({
        "": { status: "ready" },
        crunchbase: {
          status: "unexpected",
          configuredAgeDays: "n/a",
          rotationAgeDays: undefined,
          staleReasons: [null, " ", "missing_rotation_timestamp"],
        },
      })
    ).toEqual([
      {
        provider: "crunchbase",
        status: "UNKNOWN",
        configuredAgeDays: null,
        rotationAgeDays: null,
        staleReasons: ["missing_rotation_timestamp"],
      },
    ]);
  });
});

describe("normalizeIntegrationHealthFreshnessStatusCountMap", () => {
  it("normalizes count keys and aggregates duplicate variants", () => {
    expect(
      normalizeIntegrationHealthFreshnessStatusCountMap({
        "action required": 1,
        ACTION_REQUIRED: 2,
        ready: 3,
      })
    ).toEqual({
      ACTION_REQUIRED: 3,
      READY: 3,
    });
  });

  it("maps unsupported keys into UNKNOWN and ignores invalid counts", () => {
    expect(
      normalizeIntegrationHealthFreshnessStatusCountMap({
        hold: 4,
        READY: -1,
        UNKNOWN: "x",
      })
    ).toEqual({
      UNKNOWN: 4,
    });
  });
});

describe("buildIntegrationHealthFreshnessStatusCountMap", () => {
  it("builds count map from provider freshness rows", () => {
    const rows = buildIntegrationHealthFreshnessRows({
      apollo: { status: "ready", staleReasons: [] },
      clearbit: { status: "action required", staleReasons: [] },
      crunchbase: { status: "unknown", staleReasons: [] },
    });
    expect(buildIntegrationHealthFreshnessStatusCountMap(rows)).toEqual({
      ACTION_REQUIRED: 1,
      READY: 1,
      UNKNOWN: 1,
    });
  });
});

describe("resolveIntegrationHealthFreshnessStatusCountProvenance", () => {
  it("uses server counts when available and reports mismatch", () => {
    expect(
      resolveIntegrationHealthFreshnessStatusCountProvenance(
        { READY: 2 },
        { READY: 1 }
      )
    ).toEqual({
      effectiveCounts: { READY: 2 },
      serverCounts: { READY: 2 },
      fallbackCounts: { READY: 1 },
      source: "server",
      mismatch: true,
    });
  });

  it("falls back to local counts when server counts are absent", () => {
    expect(
      resolveIntegrationHealthFreshnessStatusCountProvenance(
        null,
        { ACTION_REQUIRED: 1 }
      )
    ).toEqual({
      effectiveCounts: { ACTION_REQUIRED: 1 },
      serverCounts: {},
      fallbackCounts: { ACTION_REQUIRED: 1 },
      source: "local",
      mismatch: false,
    });
  });
});

describe("buildIntegrationHealthExportMetadata", () => {
  it("builds normalized export metadata with server freshness counts", () => {
    expect(
      buildIntegrationHealthExportMetadata({
        status: "action required",
        healthyCount: 2,
        unhealthyCount: 1,
        credentialActionRequiredProviders: ["clearbit"],
        credentialFreshnessStatusCounts: {
          ACTION_REQUIRED: 1,
          READY: 2,
        },
        credentialFreshnessByProvider: {
          clearbit: {
            status: "action required",
            configuredAgeDays: "120",
            rotationAgeDays: 101,
            staleReasons: ["rotation_age_exceeded"],
          },
          apollo: {
            status: "ready",
            configuredAgeDays: 12,
            rotationAgeDays: 11,
            staleReasons: [],
          },
        },
        recommendedCommands: ["npm run verify:smoke:credential-freshness"],
      })
    ).toMatchObject({
      exportIntegrationHealthStatus: "ACTION_REQUIRED",
      exportIntegrationHealthHealthyCount: 2,
      exportIntegrationHealthUnhealthyCount: 1,
      exportIntegrationHealthCredentialActionRequiredProviders: ["clearbit"],
      exportIntegrationHealthCredentialFreshnessStatusCounts: {
        ACTION_REQUIRED: 1,
        READY: 2,
      },
      exportIntegrationHealthCredentialFreshnessStatusCountsSource: "server",
      exportIntegrationHealthCredentialFreshnessStatusCountsMismatch: true,
      exportIntegrationHealthCredentialFreshnessStatusCountsServer: {
        ACTION_REQUIRED: 1,
        READY: 2,
      },
      exportIntegrationHealthCredentialFreshnessStatusCountsFallback: {
        ACTION_REQUIRED: 1,
        READY: 1,
      },
      exportIntegrationHealthRecommendedCommands: [
        "npm run verify:smoke:credential-freshness",
      ],
    });
  });

  it("falls back to provider-derived counts when server counts are missing", () => {
    expect(
      buildIntegrationHealthExportMetadata({
        status: "ready",
        credentialFreshnessByProvider: {
          apollo: { status: "ready", staleReasons: [] },
          crunchbase: { status: "unknown", staleReasons: [] },
        },
      })
    ).toMatchObject({
      exportIntegrationHealthStatus: "READY",
      exportIntegrationHealthCredentialFreshnessStatusCounts: {
        READY: 1,
        UNKNOWN: 1,
      },
      exportIntegrationHealthCredentialFreshnessStatusCountsSource: "local",
      exportIntegrationHealthCredentialFreshnessStatusCountsMismatch: false,
      exportIntegrationHealthCredentialFreshnessStatusCountsServer: {},
      exportIntegrationHealthCredentialFreshnessStatusCountsFallback: {
        READY: 1,
        UNKNOWN: 1,
      },
      exportIntegrationHealthCredentialFreshnessTotalProviders: 2,
    });
  });

  it("honors explicit backend freshness provenance fields", () => {
    expect(
      buildIntegrationHealthExportMetadata({
        status: "ready",
        credentialFreshnessStatusCounts: { READY: 9 },
        credentialFreshnessStatusCountsSource: "local",
        credentialFreshnessStatusCountsMismatch: true,
        credentialFreshnessStatusCountsServer: { READY: 9 },
        credentialFreshnessStatusCountsFallback: {
          ACTION_REQUIRED: 1,
          UNKNOWN: 2,
        },
        credentialFreshnessByProvider: {
          apollo: { status: "action_required", staleReasons: [] },
          crunchbase: { status: "unknown", staleReasons: [] },
          clearbit: { status: "unknown", staleReasons: [] },
        },
      })
    ).toMatchObject({
      exportIntegrationHealthCredentialFreshnessStatusCounts: {
        ACTION_REQUIRED: 1,
        UNKNOWN: 2,
      },
      exportIntegrationHealthCredentialFreshnessStatusCountsSource: "local",
      exportIntegrationHealthCredentialFreshnessStatusCountsMismatch: true,
      exportIntegrationHealthCredentialFreshnessStatusCountsServer: { READY: 9 },
      exportIntegrationHealthCredentialFreshnessStatusCountsFallback: {
        ACTION_REQUIRED: 1,
        UNKNOWN: 2,
      },
      exportIntegrationHealthCredentialFreshnessActionRequiredCount: 1,
      exportIntegrationHealthCredentialFreshnessUnknownCount: 2,
    });
  });
});

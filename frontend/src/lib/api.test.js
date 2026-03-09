import { api } from "./api";

describe("api client", () => {
  afterEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  it("calls health endpoint without auth header when token is absent", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ status: "healthy" }),
    });

    await api.healthCheck();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/health");
    expect(options.headers).toMatchObject({
      "Content-Type": "application/json",
      "X-Request-Id": expect.stringMatching(/^req-/),
    });
    expect(options.headers).not.toMatchObject({
      Authorization: expect.any(String),
    });
  });

  it("adds bearer token when token is present", async () => {
    localStorage.setItem("token", "token-123");
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });

    await api.getIntegrations();

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers).toMatchObject({
      Authorization: "Bearer token-123",
      "X-Request-Id": expect.stringMatching(/^req-/),
    });
  });

  it("surfaces API error detail when request fails", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      json: async () => ({ detail: "Unauthorized" }),
    });

    await expect(api.healthCheck()).rejects.toThrow("Unauthorized");
  });

  it("surfaces structured API error detail and retry metadata on connector throttling", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 429,
      headers: {
        get: (name) => (String(name || "").toLowerCase() === "retry-after" ? "19" : null),
      },
      json: async () => ({
        detail: {
          errorCode: "connector_rate_limited",
          message: "Connector rate limit exceeded for /api/integrations/providers/apollo/search. Retry in 19 seconds.",
          retryAfterSeconds: 19,
          rateLimit: {
            windowSeconds: 60,
            limit: 1,
            remaining: 0,
            retryAfterSeconds: 19,
            resetInSeconds: 19,
          },
        },
      }),
    });

    try {
      await api.apolloSearchProspects({ query: "revops", limit: 1 });
      throw new Error("Expected connector throttle error");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toContain("Retry in 19 seconds");
      expect(error.status).toBe(429);
      expect(error.errorCode).toBe("connector_rate_limited");
      expect(error.retryAfterSeconds).toBe(19);
      expect(error.rateLimit.limit).toBe(1);
      expect(error.rateLimit.remaining).toBe(0);
      expect(error.rateLimit.resetInSeconds).toBe(19);
    }
  });

  it("derives connector throttle metadata from response headers when payload omits rateLimit", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 429,
      headers: {
        get: (name) => {
          const key = String(name || "").toLowerCase();
          if (key === "retry-after") return "12";
          if (key === "x-ratelimit-limit") return "30";
          if (key === "x-ratelimit-remaining") return "0";
          if (key === "x-ratelimit-window-seconds") return "60";
          if (key === "x-ratelimit-reset-in-seconds") return "12";
          if (key === "x-ratelimit-reset-at") return "2026-02-24T12:00:00Z";
          return null;
        },
      },
      json: async () => ({
        detail: {
          errorCode: "connector_rate_limited",
          message: "Connector rate limit exceeded.",
        },
      }),
    });

    try {
      await api.apolloEnrichCompany({ domain: "example.com", limit: 1 });
      throw new Error("Expected connector throttle error");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(error.status).toBe(429);
      expect(error.errorCode).toBe("connector_rate_limited");
      expect(error.retryAfterSeconds).toBe(12);
      expect(error.rateLimit.limit).toBe(30);
      expect(error.rateLimit.remaining).toBe(0);
      expect(error.rateLimit.windowSeconds).toBe(60);
      expect(error.rateLimit.resetInSeconds).toBe(12);
      expect(error.rateLimit.resetAt).toBe("2026-02-24T12:00:00Z");
    }
  });

  it("uses reset-in header as retry fallback when Retry-After is absent", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 429,
      headers: {
        get: (name) => {
          const key = String(name || "").toLowerCase();
          if (key === "x-ratelimit-limit") return "30";
          if (key === "x-ratelimit-remaining") return "0";
          if (key === "x-ratelimit-window-seconds") return "60";
          if (key === "x-ratelimit-reset-in-seconds") return "9";
          return null;
        },
      },
      json: async () => ({
        detail: {
          errorCode: "connector_rate_limited",
          message: "Connector rate limit exceeded.",
        },
      }),
    });

    try {
      await api.apolloEnrichCompany({ domain: "example.com", limit: 1 });
      throw new Error("Expected connector throttle error");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(error.retryAfterSeconds).toBe(9);
      expect(error.rateLimit.resetInSeconds).toBe(9);
    }
  });

  it("surfaces structured connector input-validation details from 400 responses", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      status: 400,
      headers: {
        get: () => null,
      },
      json: async () => ({
        detail: {
          errorCode: "invalid_request_bounds",
          message: "Invalid limit: expected integer between 1 and 25.",
          field: "limit",
          min: 1,
          max: 25,
          reason: "type",
          received: true,
        },
      }),
    });

    try {
      await api.apolloEnrichCompany({ domain: "example.com", limit: 25 });
      throw new Error("Expected connector validation error");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(error.status).toBe(400);
      expect(error.errorCode).toBe("invalid_request_bounds");
      expect(error.field).toBe("limit");
      expect(error.minimum).toBe(1);
      expect(error.maximum).toBe(25);
      expect(error.reason).toBe("type");
      expect(error.received).toBe(true);
      expect(error.validation).toEqual({
        field: "limit",
        minimum: 1,
        maximum: 25,
        reason: "type",
        received: true,
      });
    }
  });

  it("calls phrase analytics endpoint with query parameters", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ phrases: [] }),
    });

    await api.getPhraseAnalytics({
      windowDays: 45,
      minExposure: 3,
      limit: 25,
      query: "demo",
    });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/sales-intelligence/analytics/phrases");
    expect(url).toContain("window_days=45");
    expect(url).toContain("min_exposure=3");
    expect(url).toContain("limit=25");
    expect(url).toContain("query=demo");
    expect(options.method).toBe("GET");
  });

  it("calls phrase channel summary endpoint with channels filter", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ channels: [] }),
    });

    await api.getPhraseChannelSummary({
      windowDays: 60,
      minExposure: 2,
      limit: 5,
      channels: ["email", "linkedin"],
    });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/sales-intelligence/analytics/phrases/channel-summary");
    expect(url).toContain("window_days=60");
    expect(url).toContain("min_exposure=2");
    expect(url).toContain("limit=5");
    expect(url).toContain("channels=email%2Clinkedin");
    expect(options.method).toBe("GET");
  });

  it("posts response prediction payload", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ responseProbability: 0.42 }),
    });

    await api.predictResponse({
      message: "Can we schedule a quick demo?",
      channel: "email",
    });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/sales-intelligence/prediction/response");
    expect(options.method).toBe("POST");
    expect(options.body).toContain("schedule");
  });

  it("posts prediction feedback payload", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    await api.recordPredictionFeedback({
      predictionId: "pred-1",
      predictedProbability: 0.72,
      outcome: "meeting_booked",
      channel: "email",
      responseLatencyHours: 4,
    });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/sales-intelligence/prediction/feedback");
    expect(options.method).toBe("POST");
    expect(options.body).toContain("meeting_booked");
  });

  it("gets prediction performance with window parameter", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ sampleSize: 2 }),
    });

    await api.getPredictionPerformance({ windowDays: 120 });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/sales-intelligence/prediction/performance");
    expect(url).toContain("window_days=120");
    expect(options.method).toBe("GET");
  });

  it("gets prediction performance report with window parameter", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ qualityTier: "watch" }),
    });

    await api.getPredictionPerformanceReport({ windowDays: 60 });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/sales-intelligence/prediction/performance/report");
    expect(url).toContain("window_days=60");
    expect(options.method).toBe("GET");
  });

  it("gets prediction feedback history with window and limit", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ count: 1, records: [] }),
    });

    await api.getPredictionFeedbackHistory({ windowDays: 90, limit: 25 });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/sales-intelligence/prediction/feedback/history");
    expect(url).toContain("window_days=90");
    expect(url).toContain("limit=25");
    expect(options.method).toBe("GET");
  });

  it("gets pipeline forecast with window parameter", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ weightedPipelineValue: 10000 }),
    });

    await api.getPipelineForecast(120);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/sales-intelligence/forecast/pipeline");
    expect(url).toContain("window_days=120");
    expect(options.method).toBe("GET");
  });

  it("gets conversation intelligence with window and limit parameters", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ totals: { records: 4 } }),
    });

    await api.getConversationIntelligence({ windowDays: 120, limit: 300 });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/sales-intelligence/conversation/intelligence");
    expect(url).toContain("window_days=120");
    expect(url).toContain("limit=300");
    expect(options.method).toBe("GET");
  });

  it("gets multi-channel engagement summary with window and limit parameters", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ coverageScore: 82 }),
    });

    await api.getMultiChannelEngagement({
      windowDays: 120,
      campaignLimit: 120,
      abTestLimit: 240,
      prospectLimit: 400,
    });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/sales-intelligence/engagement/multi-channel");
    expect(url).toContain("window_days=120");
    expect(url).toContain("campaign_limit=120");
    expect(url).toContain("ab_test_limit=240");
    expect(url).toContain("prospect_limit=400");
    expect(options.method).toBe("GET");
  });

  it("gets relationship map with window and limit parameters", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ stats: { connections: 2 } }),
    });

    await api.getRelationshipMap({ windowDays: 60, limit: 120 });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/sales-intelligence/relationships/map");
    expect(url).toContain("window_days=60");
    expect(url).toContain("limit=120");
    expect(options.method).toBe("GET");
  });

  it("handles sales campaign API endpoints", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });

    await api.getSalesCampaigns("active");
    let [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/sales-intelligence/campaigns");
    expect(url).toContain("status=active");
    expect(options.method).toBe("GET");

    fetchMock.mockClear();
    await api.getSalesCampaignPerformance("camp-1");
    [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/sales-intelligence/campaigns/camp-1/performance");
    expect(options.method).toBe("GET");

    fetchMock.mockClear();
    await api.getSalesCampaignPerformance("camp-1", { channelLimit: 7 });
    [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/sales-intelligence/campaigns/camp-1/performance");
    expect(url).toContain("channel_limit=7");
    expect(options.method).toBe("GET");

    fetchMock.mockClear();
    await api.getSalesCampaignPortfolio({ windowDays: 60, status: "active", limit: 15 });
    [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/sales-intelligence/campaigns/performance/portfolio");
    expect(url).toContain("window_days=60");
    expect(url).toContain("status=active");
    expect(url).toContain("limit=15");
    expect(options.method).toBe("GET");

    fetchMock.mockClear();
    await api.createSalesCampaign({
      name: "Q2 Outbound",
      channels: ["email", "linkedin"],
    });
    [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/sales-intelligence/campaigns");
    expect(options.method).toBe("POST");

    fetchMock.mockClear();
    await api.activateSalesCampaign("camp-1");
    [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/sales-intelligence/campaigns/camp-1/activate");
    expect(options.method).toBe("POST");

    fetchMock.mockClear();
    await api.recordSalesCampaignMetrics("camp-1", {
      channel: "email",
      sent: 10,
      opened: 4,
      replied: 2,
    });
    [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/sales-intelligence/campaigns/camp-1/metrics");
    expect(options.method).toBe("POST");
  });

  it("gets integrations telemetry summary with days/limit", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ eventCount: 12 }),
    });

    await api.getIntegrationsTelemetrySummary(14, 500);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/integrations/integrations/telemetry/summary");
    expect(url).toContain("days=14");
    expect(url).toContain("limit=500");
    expect(url).not.toContain("packet_only_recent_events");
    expect(options.method).toBe("GET");
  });

  it("gets integrations telemetry summary with packet-only recent-events filter", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ eventCount: 4 }),
    });

    await api.getIntegrationsTelemetrySummary(21, 1200, true);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/integrations/integrations/telemetry/summary");
    expect(url).toContain("days=21");
    expect(url).toContain("limit=1200");
    expect(url).toContain("packet_only_recent_events=true");
    expect(options.method).toBe("GET");
  });

  it("gets integrations telemetry summary with explicit non-packet recent-events filter", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ eventCount: 7 }),
    });

    await api.getIntegrationsTelemetrySummary(30, 900, false);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/integrations/integrations/telemetry/summary");
    expect(url).toContain("days=30");
    expect(url).toContain("limit=900");
    expect(url).toContain("packet_only_recent_events=false");
    expect(options.method).toBe("GET");
  });

  it("gets integrations telemetry summary with governance and packet status filters", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ eventCount: 5 }),
    });

    await api.getIntegrationsTelemetrySummary(30, 900, false, {
      governanceStatus: " ACTION_REQUIRED ",
      packetValidationStatus: " ready ",
    });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/integrations/integrations/telemetry/summary");
    expect(url).toContain("days=30");
    expect(url).toContain("limit=900");
    expect(url).toContain("packet_only_recent_events=false");
    expect(url).toContain("governance_status=ACTION_REQUIRED");
    expect(url).toContain("packet_validation_status=ready");
    expect(options.method).toBe("GET");
  });

  it("omits empty governance and packet status filters from telemetry summary query", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ eventCount: 6 }),
    });

    await api.getIntegrationsTelemetrySummary(30, 900, false, {
      governanceStatus: "   ",
      packetValidationStatus: "",
    });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/integrations/integrations/telemetry/summary");
    expect(url).toContain("days=30");
    expect(url).toContain("limit=900");
    expect(url).toContain("packet_only_recent_events=false");
    expect(url).not.toContain("governance_status=");
    expect(url).not.toContain("packet_validation_status=");
    expect(options.method).toBe("GET");
  });

  it("returns governance schema telemetry summary payload fields unchanged", async () => {
    const responsePayload = {
      eventCount: 3,
      governanceSchemaAudit: {
        eventCount: 2,
        statusCounts: { READY: 1, ACTION_REQUIRED: 1 },
        reasonCodeParityPassCount: 1,
        reasonCodeParityFailCount: 1,
        recommendedCommandParityPassCount: 1,
        recommendedCommandParityFailCount: 1,
        handoffParityPassCount: 1,
        handoffParityFailCount: 1,
        allParityPassedCount: 1,
        allParityFailedCount: 1,
        rolloutBlockedCount: 1,
        latestEvaluatedAt: "2026-02-24T12:00:00+00:00",
      },
      recentEvents: [
        {
          eventType: "integrations_traceability_governance_schema_viewed",
          governanceSchemaReasonCodeParityOk: false,
          governanceSchemaRecommendedCommandParityOk: false,
          governanceSchemaHandoffParityOk: true,
          governanceSchemaAllParityOk: false,
          governanceSchemaRolloutBlocked: true,
          governanceSchemaReasonCodeCount: 2,
          governanceSchemaRecommendedCommandCount: 1,
        },
      ],
    };
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => responsePayload,
    });

    const payload = await api.getIntegrationsTelemetrySummary(7, 500, true);

    expect(payload.governanceSchemaAudit.eventCount).toBe(2);
    expect(payload.governanceSchemaAudit.statusCounts.ACTION_REQUIRED).toBe(1);
    expect(payload.recentEvents[0].governanceSchemaReasonCodeParityOk).toBe(false);
    expect(payload.recentEvents[0].governanceSchemaRecommendedCommandParityOk).toBe(false);
    expect(payload.recentEvents[0].governanceSchemaHandoffParityOk).toBe(true);
    expect(payload.recentEvents[0].governanceSchemaAllParityOk).toBe(false);
    expect(payload.recentEvents[0].governanceSchemaRolloutBlocked).toBe(true);
    expect(payload.recentEvents[0].governanceSchemaReasonCodeCount).toBe(2);
    expect(payload.recentEvents[0].governanceSchemaRecommendedCommandCount).toBe(1);
  });

  it("returns telemetry status-count provenance and posture payload fields unchanged", async () => {
    const responsePayload = {
      eventCount: 2,
      recentEventsGovernanceStatusCounts: { PASS: 2 },
      recentEventsPacketValidationStatusCounts: { READY: 2 },
      recentEventsGovernanceStatusCountsSource: "local",
      recentEventsPacketValidationStatusCountsSource: "local",
      recentEventsGovernanceStatusCountsMismatch: true,
      recentEventsPacketValidationStatusCountsMismatch: true,
      recentEventsGovernanceStatusCountsServer: { PASS: 4 },
      recentEventsPacketValidationStatusCountsServer: { READY: 4 },
      recentEventsGovernanceStatusCountsFallback: { ACTION_REQUIRED: 1 },
      recentEventsPacketValidationStatusCountsFallback: { ACTION_REQUIRED: 1 },
      recentEventsGovernanceStatusCountsPosture: "local_drift",
      recentEventsPacketValidationStatusCountsPosture: "local_drift",
      recentEventsGovernanceStatusCountsPostureSeverity: "warning",
      recentEventsPacketValidationStatusCountsPostureSeverity: "warning",
      recentEventsGovernanceStatusCountsRequiresInvestigation: true,
      recentEventsPacketValidationStatusCountsRequiresInvestigation: true,
      recentEvents: [
        {
          eventType: "integrations_traceability_status_evaluated",
          governanceStatus: "PASS",
          governancePacketValidationStatus: "READY",
        },
      ],
    };
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => responsePayload,
    });

    const payload = await api.getIntegrationsTelemetrySummary(7, 250, true);

    expect(payload.recentEventsGovernanceStatusCounts).toEqual({ PASS: 2 });
    expect(payload.recentEventsPacketValidationStatusCounts).toEqual({ READY: 2 });
    expect(payload.recentEventsGovernanceStatusCountsSource).toBe("local");
    expect(payload.recentEventsPacketValidationStatusCountsSource).toBe("local");
    expect(payload.recentEventsGovernanceStatusCountsMismatch).toBe(true);
    expect(payload.recentEventsPacketValidationStatusCountsMismatch).toBe(true);
    expect(payload.recentEventsGovernanceStatusCountsServer).toEqual({ PASS: 4 });
    expect(payload.recentEventsPacketValidationStatusCountsServer).toEqual({ READY: 4 });
    expect(payload.recentEventsGovernanceStatusCountsFallback).toEqual({ ACTION_REQUIRED: 1 });
    expect(payload.recentEventsPacketValidationStatusCountsFallback).toEqual({
      ACTION_REQUIRED: 1,
    });
    expect(payload.recentEventsGovernanceStatusCountsPosture).toBe("local_drift");
    expect(payload.recentEventsPacketValidationStatusCountsPosture).toBe("local_drift");
    expect(payload.recentEventsGovernanceStatusCountsPostureSeverity).toBe("warning");
    expect(payload.recentEventsPacketValidationStatusCountsPostureSeverity).toBe("warning");
    expect(payload.recentEventsGovernanceStatusCountsRequiresInvestigation).toBe(true);
    expect(payload.recentEventsPacketValidationStatusCountsRequiresInvestigation).toBe(true);
  });

  it("gets integrations telemetry snapshot governance with retention window", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ status: "READY" }),
    });

    await api.getIntegrationsTelemetrySnapshotGovernance(45);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/integrations/integrations/telemetry/snapshot-governance");
    expect(url).toContain("retention_days=45");
    expect(options.method).toBe("GET");
  });

  it("gets integrations baseline governance", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ status: "PASS" }),
    });

    await api.getIntegrationsBaselineGovernance();

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/integrations/integrations/telemetry/baseline-governance");
    expect(options.method).toBe("GET");
  });

  it("gets integrations governance report with days and limit", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ totals: { governanceEventCount: 2 } }),
    });

    await api.getIntegrationsGovernanceReport(14, 750);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/integrations/integrations/telemetry/governance-report");
    expect(url).toContain("days=14");
    expect(url).toContain("limit=750");
    expect(options.method).toBe("GET");
  });

  it("gets integrations governance report export with days and limit", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ governanceType: "weekly_report" }),
    });

    await api.getIntegrationsGovernanceReportExport(10, 420);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/integrations/integrations/telemetry/governance-report/export");
    expect(url).toContain("days=10");
    expect(url).toContain("limit=420");
    expect(options.method).toBe("GET");
  });

  it("gets integrations governance report history with retention and limit", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ governanceType: "weekly_report_history" }),
    });

    await api.getIntegrationsGovernanceReportHistory(21, 25);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/integrations/integrations/telemetry/governance-report/history");
    expect(url).toContain("retention_days=21");
    expect(url).toContain("limit=25");
    expect(options.method).toBe("GET");
  });

  it("gets integrations governance schema metadata", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ governanceType: "schema_metadata" }),
    });

    await api.getIntegrationsGovernanceSchema();

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/integrations/integrations/telemetry/governance-schema");
    expect(options.method).toBe("GET");
  });

  it("gets integrations SLO gate summary with optional thresholds", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ decision: "PROCEED" }),
    });

    await api.getIntegrationsSloGates({
      days: 14,
      limit: 1500,
      maxErrorRatePct: 3.5,
      minSchemaV2Pct: 90,
      minSchemaV2SampleCount: 40,
      maxOrchestrationAttemptErrorCount: 2,
      maxOrchestrationAttemptSkippedCount: 10,
    });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/integrations/integrations/telemetry/slo-gates");
    expect(url).toContain("days=14");
    expect(url).toContain("limit=1500");
    expect(url).toContain("max_error_rate_pct=3.5");
    expect(url).toContain("min_schema_v2_pct=90");
    expect(url).toContain("min_schema_v2_sample_count=40");
    expect(url).toContain("max_orchestration_attempt_error_count=2");
    expect(url).toContain("max_orchestration_attempt_skipped_count=10");
    expect(options.method).toBe("GET");
  });

  it("supports connector credentials and health endpoints", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    await api.getIntegrationsHealth();
    let [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/integrations/integrations/health");
    expect(options.method).toBe("GET");

    fetchMock.mockClear();
    await api.saveSendgridIntegration({ api_key: "sendgrid-key", from_email: "owner@example.com" });
    [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/integrations/integrations/sendgrid");
    expect(options.method).toBe("POST");
    expect(options.body).toContain("owner@example.com");

    fetchMock.mockClear();
    await api.saveApolloIntegration({ api_key: "apollo-key" });
    [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/integrations/integrations/apollo");
    expect(options.method).toBe("POST");

    fetchMock.mockClear();
    await api.saveClearbitIntegration({ api_key: "clearbit-key" });
    [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/integrations/integrations/clearbit");
    expect(options.method).toBe("POST");

    fetchMock.mockClear();
    await api.saveCrunchbaseIntegration({ api_key: "crunchbase-key" });
    [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/integrations/integrations/crunchbase");
    expect(options.method).toBe("POST");

    fetchMock.mockClear();
    await api.removeSendgridIntegration();
    [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/integrations/integrations/sendgrid");
    expect(options.method).toBe("DELETE");

    fetchMock.mockClear();
    await api.removeApolloIntegration();
    [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/integrations/integrations/apollo");
    expect(options.method).toBe("DELETE");

    fetchMock.mockClear();
    await api.removeClearbitIntegration();
    [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/integrations/integrations/clearbit");
    expect(options.method).toBe("DELETE");

    fetchMock.mockClear();
    await api.removeCrunchbaseIntegration();
    [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/integrations/integrations/crunchbase");
    expect(options.method).toBe("DELETE");
  });

  it("returns integrations health freshness fields unchanged", async () => {
    const payload = {
      generatedAt: "2026-02-27T00:00:00Z",
      status: "ACTION_REQUIRED",
      healthyCount: 2,
      unhealthyCount: 2,
      credentialActionRequiredProviders: ["clearbit"],
      credentialFreshnessStatusCounts: {
        ACTION_REQUIRED: 1,
        READY: 2,
        UNKNOWN: 1,
      },
      credentialFreshnessStatusCountsSource: "server",
      credentialFreshnessStatusCountsMismatch: false,
      credentialFreshnessStatusCountsServer: {
        ACTION_REQUIRED: 1,
        READY: 2,
        UNKNOWN: 1,
      },
      credentialFreshnessStatusCountsFallback: {
        ACTION_REQUIRED: 1,
        READY: 2,
        UNKNOWN: 1,
      },
      credentialFreshnessByProvider: {
        clearbit: {
          status: "ACTION_REQUIRED",
          configuredAgeDays: 120,
          rotationAgeDays: 101,
          staleReasons: ["rotation_age_exceeded"],
        },
      },
      credentialFreshnessTotalProviders: 4,
      credentialFreshnessActionRequiredCount: 1,
      credentialFreshnessWithinPolicyCount: 2,
      credentialFreshnessUnknownCount: 1,
      providers: [],
    };
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => payload,
    });

    const result = await api.getIntegrationsHealth();
    expect(result).toEqual(payload);
  });

  it("supports connector lookup and enrichment endpoints", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });

    await api.apolloSearchProspects({
      query: "revops",
      title: "VP Sales",
      domain: "example.com",
      limit: 10,
      page: 2,
      saveResults: true,
    });
    let [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/integrations/providers/apollo/search");
    expect(options.method).toBe("POST");
    expect(options.body).toContain("revops");

    fetchMock.mockClear();
    await api.apolloEnrichCompany({ domain: "example.com", companyName: "Example", limit: 5 });
    [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/integrations/providers/apollo/company");
    expect(options.method).toBe("POST");

    fetchMock.mockClear();
    await api.clearbitEnrichCompany({ domain: "example.com" });
    [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/integrations/providers/clearbit/company");
    expect(options.method).toBe("POST");

    fetchMock.mockClear();
    await api.crunchbaseEnrichCompany({ companyName: "Example", limit: 5 });
    [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/integrations/providers/crunchbase/company");
    expect(options.method).toBe("POST");

    fetchMock.mockClear();
    await api.orchestrateCompanyEnrichment({
      domain: "example.com",
      companyName: "Example",
      providerOrder: ["clearbit", "apollo", "crunchbase"],
    });
    [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/integrations/providers/company-enrichment");
    expect(options.method).toBe("POST");
    expect(options.body).toContain("clearbit");
  });
});

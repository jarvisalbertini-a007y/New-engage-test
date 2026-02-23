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

  it("gets conversation intelligence with limit parameter", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ totals: { records: 4 } }),
    });

    await api.getConversationIntelligence(300);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/sales-intelligence/conversation/intelligence");
    expect(url).toContain("limit=300");
    expect(options.method).toBe("GET");
  });

  it("gets multi-channel engagement summary", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ coverageScore: 82 }),
    });

    await api.getMultiChannelEngagement();

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/sales-intelligence/engagement/multi-channel");
    expect(options.method).toBe("GET");
  });

  it("gets relationship map with limit parameter", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ stats: { connections: 2 } }),
    });

    await api.getRelationshipMap(120);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/sales-intelligence/relationships/map");
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
    expect(options.method).toBe("GET");
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
    });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/integrations/integrations/telemetry/slo-gates");
    expect(url).toContain("days=14");
    expect(url).toContain("limit=1500");
    expect(url).toContain("max_error_rate_pct=3.5");
    expect(url).toContain("min_schema_v2_pct=90");
    expect(url).toContain("min_schema_v2_sample_count=40");
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

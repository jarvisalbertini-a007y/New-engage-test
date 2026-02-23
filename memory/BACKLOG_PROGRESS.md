# EngageAI2 Backlog Progress (Sales-Only)

## Restarted Last 5 Roadmap Items

1. Predictive Analytics
- Implemented pipeline forecast endpoint with weighted value, projected won value, and confidence interval.
- Path: `/api/sales-intelligence/forecast/pipeline`

2. Conversation Intelligence
- Implemented conversation health summary with sentiment mix and objection detection.
- Path: `/api/sales-intelligence/conversation/intelligence`

3. Multi-Channel Engagement
- Implemented channel coverage and usage summary with recommendations.
- Path: `/api/sales-intelligence/engagement/multi-channel`

4. Campaign Management Framework
- Implemented campaign create/list/get, activation, and metrics recording.
- Paths:
  - `/api/sales-intelligence/campaigns`
  - `/api/sales-intelligence/campaigns/{campaign_id}`
  - `/api/sales-intelligence/campaigns/{campaign_id}/activate`
  - `/api/sales-intelligence/campaigns/{campaign_id}/metrics`

5. Relationship Mapping (Social Graph)
- Implemented relationship map endpoint for prospect-company graph and strength scoring.
- Path: `/api/sales-intelligence/relationships/map`

6. Phrase-Level Effectiveness Analytics
- Implemented phrase analytics endpoint with exposure, effectiveness score, and confidence.
- Path: `/api/sales-intelligence/analytics/phrases`

7. Response Prediction (Send-Time + Content)
- Implemented response prediction endpoint with probability, confidence, rationale, and recommended send windows.
- Path: `/api/sales-intelligence/prediction/response`

8. Phrase Analytics Telemetry
- Added structured telemetry event emission for phrase analytics generation.
- Event: `sales_phrase_analytics_generated`

9. Response Prediction Telemetry
- Added structured telemetry event emission for prediction generation.
- Event: `sales_response_prediction_generated`

10. Sales Intelligence HTTP Contract Tests
- Added endpoint-level contract tests for auth, feature flags, error handling, and response shape.
- Path: `backend/tests/test_sales_intelligence_http_contract.py`

11. Frontend API Bindings for Sales Intelligence
- Added frontend API helpers for phrase analytics and response prediction endpoints.
- Paths:
  - `api.getPhraseAnalytics(...)`
  - `api.predictResponse(...)`

12. Prediction Feedback Ingestion
- Added endpoint to record observed outcomes for prediction calibration.
- Path: `/api/sales-intelligence/prediction/feedback`

13. Prediction Performance Summary
- Added endpoint for calibration/performance metrics from feedback history.
- Path: `/api/sales-intelligence/prediction/performance`

14. Feedback Loop Coverage
- Added unit + HTTP contract tests for feedback validation, persistence, and performance summary.
- Paths:
  - `backend/tests/test_sales_intelligence_backlog.py`
  - `backend/tests/test_sales_intelligence_http_contract.py`

15. Frontend Bindings for Feedback Loop
- Added frontend API helpers for recording prediction feedback and reading performance metrics.
- Paths:
  - `api.recordPredictionFeedback(...)`
  - `api.getPredictionPerformance(...)`

16. Window-Scoped Analytics Enforcement
- Enforced `window_days` filtering for phrase analytics and prediction performance endpoints.
- Reduced stale data leakage in aggregate analytics queries.

17. Idempotent Feedback Writes
- Added idempotent behavior for feedback records when `predictionId` is supplied.
- Existing feedback entries are updated instead of duplicated.

18. Feedback History Endpoint
- Added endpoint for ordered feedback retrieval for calibration audits.
- Path: `/api/sales-intelligence/prediction/feedback/history`

19. Frontend Feedback History Binding
- Added frontend helper for feedback history retrieval with window/limit parameters.
- Path: `api.getPredictionFeedbackHistory(...)`

20. Phrase Channel Summary Analytics
- Added per-channel phrase effectiveness summary endpoint and telemetry.
- Path: `/api/sales-intelligence/analytics/phrases/channel-summary`

21. Prediction Performance Decision Report
- Added rollout decision endpoint (quality tier + recommendations) based on calibration metrics.
- Path: `/api/sales-intelligence/prediction/performance/report`

22. Frontend Bindings for New Analytics Views
- Added frontend API helpers:
  - `api.getPhraseChannelSummary(...)`
  - `api.getPredictionPerformanceReport(...)`

23. Added Builder-Level Coverage for New Analytics Utilities
- Added unit tests for phrase channel summary and performance report tiering logic.
- Path: `backend/tests/test_sales_intelligence_backlog.py`

24. Pipeline Forecast Feature Flag + Telemetry
- Added gated rollout control for pipeline forecast endpoint.
- Added structured telemetry emission for forecast generation.
- Path: `/api/sales-intelligence/forecast/pipeline`
- Event: `sales_pipeline_forecast_generated`

25. Conversation Intelligence Feature Flag + Telemetry
- Added gated rollout control for conversation intelligence endpoint.
- Added structured telemetry emission for conversation intelligence generation.
- Path: `/api/sales-intelligence/conversation/intelligence`
- Event: `sales_conversation_intelligence_generated`

26. Multi-Channel Engagement Feature Flag + Telemetry
- Added gated rollout control for multi-channel engagement endpoint.
- Added structured telemetry emission for engagement health generation.
- Path: `/api/sales-intelligence/engagement/multi-channel`
- Event: `sales_multi_channel_engagement_generated`

27. Sales Campaign Lifecycle Feature Flag + Telemetry
- Added gated rollout control for campaign create/list/get/activate/metrics endpoints.
- Added structured telemetry for campaign lifecycle events.
- Paths:
  - `/api/sales-intelligence/campaigns`
  - `/api/sales-intelligence/campaigns/{campaign_id}`
  - `/api/sales-intelligence/campaigns/{campaign_id}/activate`
  - `/api/sales-intelligence/campaigns/{campaign_id}/metrics`
- Events:
  - `sales_campaign_created`
  - `sales_campaign_list_viewed`
  - `sales_campaign_viewed`
  - `sales_campaign_activated`
  - `sales_campaign_metrics_recorded`

28. Relationship Map Feature Flag + Telemetry
- Added gated rollout control for relationship map endpoint.
- Added structured telemetry emission for graph generation.
- Path: `/api/sales-intelligence/relationships/map`
- Event: `sales_relationship_map_generated`

29. Sales Intelligence API Contract Coverage Expansion
- Added HTTP contract tests for forecast, conversation, engagement, campaign lifecycle, and relationship map endpoints.
- Path: `backend/tests/test_sales_intelligence_http_contract.py`

30. Frontend API Contract Coverage Expansion
- Added frontend API tests for forecast, conversation, engagement, relationship map, and campaign endpoint bindings.
- Path: `frontend/src/lib/api.test.js`

31. Feature-Flag Deny Path Coverage Expansion
- Added HTTP contract tests for disabled-flag behavior on:
  - conversation intelligence
  - multi-channel engagement
  - campaign lifecycle endpoints
  - relationship map
- Path: `backend/tests/test_sales_intelligence_http_contract.py`

32. Campaign Metrics Validation Hardening
- Added HTTP contract coverage that rejects negative metric increments with `400`.
- Path: `backend/tests/test_sales_intelligence_http_contract.py`

33. Sales Campaign Query Indexes
- Added indexes for campaign retrieval at scale:
  - `userId`
  - `status`
  - `updatedAt`
  - compound `(userId, status, updatedAt desc)`
  - compound `(userId, id)`
- Path: `backend/database.py`

34. Telemetry Summary Sales-Intelligence Aggregation
- Extended integrations telemetry summary endpoint to include a `salesIntelligence` block with:
  - total event count
  - event family distribution
  - event type distribution
- Path: `backend/routes/real_integrations.py`
- Covered by:
  - `backend/tests/test_integration_telemetry_summary.py`
  - `backend/tests/test_integration_http_contract.py`

35. Campaign Lifecycle Smoke Workflow
- Added dedicated smoke test for campaign create/list/activate/metrics workflow and telemetry assertions.
- Added dedicated runner script and npm command.
- Paths:
  - `backend/tests/test_sales_campaign_smoke.py`
  - `backend/scripts/run_smoke_sales_campaign_workflow.sh`
  - `backend/scripts/run_sales_only_tests.sh`
  - `package.json`

36. Campaign Performance Endpoint
- Added endpoint to compute campaign-level performance metrics and quality tier:
  - `/api/sales-intelligence/campaigns/{campaign_id}/performance`
- Added telemetry:
  - `sales_campaign_performance_viewed`

37. Campaign Portfolio Performance Endpoint
- Added endpoint to rank campaign performance by reply-rate with filters and time window:
  - `/api/sales-intelligence/campaigns/performance/portfolio`
- Added telemetry:
  - `sales_campaign_portfolio_viewed`

38. Campaign Performance Utility Coverage
- Added helper-level unit tests for:
  - campaign open/reply rate calculations
  - campaign portfolio ranking behavior
- Path:
  - `backend/tests/test_sales_intelligence_backlog.py`

39. Campaign Performance HTTP Contract Coverage
- Added endpoint-level contract tests for:
  - performance endpoint success
  - portfolio endpoint filtering/window behavior
  - flag-disabled deny paths for new campaign analytics endpoints
- Path:
  - `backend/tests/test_sales_intelligence_http_contract.py`

40. Frontend Campaign Performance API Bindings
- Added frontend API bindings and test assertions for:
  - `api.getSalesCampaignPerformance(...)`
  - `api.getSalesCampaignPortfolio(...)`
- Paths:
  - `frontend/src/lib/api.ts`
  - `frontend/src/lib/api.test.js`

41. Integrations Page Campaign Analytics UI
- Added campaign analytics panel in Integrations page with:
  - portfolio totals
  - campaign selector
  - selected campaign performance summary
- Path:
  - `frontend/src/pages/Integrations.tsx`

42. Feature-Flag Disabled UX for Campaign Analytics
- Added explicit disabled-state messaging in Integrations page when campaign analytics endpoints return feature-flag `503`.
- Path:
  - `frontend/src/pages/Integrations.tsx`

43. Telemetry Summary UI Consumer (Sales Intelligence)
- Added telemetry summary panel in Integrations page that consumes:
  - provider-level counts
  - `salesIntelligence.byEventFamily` distribution
- Paths:
  - `frontend/src/pages/Integrations.tsx`
  - `frontend/src/lib/api.ts`

44. Integrations Telemetry Summary API Contract Test
- Added frontend API test for:
  - `api.getIntegrationsTelemetrySummary(days, limit)`
- Path:
  - `frontend/src/lib/api.test.js`

45. Backend Verification Suite Split
- Added dedicated backend scripts and npm commands:
  - `verify:backend:sales:integrations`
  - `verify:backend:sales:intelligence`
- Updated aggregate sales-only runner to execute both split suites.
- Paths:
  - `backend/scripts/run_sales_integrations_tests.sh`
  - `backend/scripts/run_sales_intelligence_tests.sh`
  - `backend/scripts/run_sales_only_tests.sh`
  - `package.json`
  - `DEV_SETUP.md`

46. Dedicated Sales Intelligence Page + Route
- Added a first-class Sales Intelligence page and router entry:
  - `/sales-intelligence`
- Path:
  - `frontend/src/pages/SalesIntelligence.tsx`
  - `frontend/src/App.tsx`

47. Sales Intelligence Navigation Wiring
- Added authenticated layout navigation entry for Sales Intelligence.
- Path:
  - `frontend/src/components/Layout.tsx`

48. Frontend Chart Visualizations for Sales Analytics
- Added chart views for:
  - campaign channel performance (open/reply rate bars)
  - sales event family distribution (telemetry pie)
- Path:
  - `frontend/src/pages/SalesIntelligence.tsx`

49. Integrations + Sales Intelligence Component-Level Frontend Tests
- Added component tests for analytics render paths and disabled-feature UX:
  - Integrations page analytics panels
  - Sales Intelligence page dashboards
- Paths:
  - `frontend/src/pages/Integrations.test.tsx`
  - `frontend/src/pages/SalesIntelligence.test.tsx`

50. Frontend Type/Build Guardrail Alignment
- Updated frontend TypeScript config to exclude test files from production build type checking while preserving Jest execution.
- Path:
  - `frontend/tsconfig.json`

51. Connector API Client Coverage (Apollo/Clearbit/Crunchbase + Health)
- Added frontend API bindings for:
  - `api.getIntegrationsHealth(...)`
  - `api.saveApolloIntegration(...)`
  - `api.saveClearbitIntegration(...)`
  - `api.saveCrunchbaseIntegration(...)`
  - `api.removeApolloIntegration(...)`
  - `api.removeClearbitIntegration(...)`
  - `api.removeCrunchbaseIntegration(...)`
- Added frontend API tests for connector credential and health endpoints.
- Paths:
  - `frontend/src/lib/api.ts`
  - `frontend/src/lib/api.test.js`

52. Integrations UI Connector Credential Flows
- Added Integrations page UX for Apollo/Clearbit/Crunchbase API key save flows via modal form.
- Added mutation wiring and cache refresh on success.
- Path:
  - `frontend/src/pages/Integrations.tsx`

53. Integrations UI Connector Disconnect Flows
- Added disconnect actions for configured Apollo/Clearbit/Crunchbase connectors.
- Added cache refresh for integrations and health summary after removal.
- Path:
  - `frontend/src/pages/Integrations.tsx`

54. Integrations UI Connector Health + Flag Visibility
- Added integrations-health query consumption and provider health display in active rows/cards.
- Added feature-flag status badge (`Flag Off`) for disabled connector flags.
- Path:
  - `frontend/src/pages/Integrations.tsx`

55. Connector UI Test and Runbook Expansion
- Expanded Integrations component test coverage for configured connector health/flag states.
- Updated connector enrichment runbook to include:
  - UI-based credential setup flow
  - health endpoint verification
  - corrected local workspace command paths.
- Paths:
  - `frontend/src/pages/Integrations.test.tsx`
  - `docs/runbooks/CONNECTOR_ENRICHMENT_RUNBOOK.md`

56. Connector Lookup API Bindings (Apollo + Company Enrichment)
- Added frontend API bindings for:
  - `api.apolloSearchProspects(...)`
  - `api.apolloEnrichCompany(...)`
  - `api.clearbitEnrichCompany(...)`
  - `api.crunchbaseEnrichCompany(...)`
  - `api.orchestrateCompanyEnrichment(...)`
- Added API contract tests for each endpoint binding.
- Paths:
  - `frontend/src/lib/api.ts`
  - `frontend/src/lib/api.test.js`

57. Integrations UI Company Enrichment Sandbox
- Added a sales-only connector sandbox section for company enrichment testing.
- Supports provider selection across:
  - orchestration fallback
  - Apollo
  - Clearbit
  - Crunchbase
- Includes domain/company/limit controls and optional persistence toggle.
- Path:
  - `frontend/src/pages/Integrations.tsx`

58. Integrations UI Apollo Prospect Lookup Sandbox
- Added a dedicated Apollo prospect lookup section for lead search validation.
- Supports query/title/domain/limit controls and optional save toggle.
- Path:
  - `frontend/src/pages/Integrations.tsx`

59. Connector Lookup Result and Error UX
- Added result summary panels for connector lookup responses, including:
  - selected provider
  - result/saved counts
  - fallback attempt count
  - top company/prospect preview
- Added explicit error display for lookup failures and feature-flag denials.
- Path:
  - `frontend/src/pages/Integrations.tsx`

60. Connector Sandbox Test and Runbook Coverage
- Expanded Integrations page tests to verify connector sandbox UI rendering.
- Extended connector runbook operational checklist to include UI lookup validation steps.
- Paths:
  - `frontend/src/pages/Integrations.test.tsx`
  - `docs/runbooks/CONNECTOR_ENRICHMENT_RUNBOOK.md`

61. Connector SLO Gate API Binding
- Added frontend API binding for telemetry SLO evaluation endpoint:
  - `api.getIntegrationsSloGates(...)`
- Supports window, event limit, and optional error-rate threshold overrides.
- Path:
  - `frontend/src/lib/api.ts`

62. Connector SLO Gate API Contract Tests
- Added frontend API tests validating SLO gate query parameter wiring and endpoint path contract.
- Path:
  - `frontend/src/lib/api.test.js`

63. Integrations UI SLO Gate Observability Panel
- Added `Connector Rollout SLO Gate` panel in Integrations page.
- Added interactive controls for evaluation window and max error-rate threshold.
- Added decision summary with:
  - proceed/hold status
  - event count
  - observed vs threshold error rate
  - signoff status
- Path:
  - `frontend/src/pages/Integrations.tsx`

64. Integrations UI Rollout Actions and Signoff Rendering
- Added UI rendering for SLO-driven:
  - provider latency pass/fail summary
  - rollout action matrix (`priority`, `ownerRole`, `action`, `trigger`)
  - signoff requirements (approvals + evidence artifacts)
  - active alert list
- Path:
  - `frontend/src/pages/Integrations.tsx`

65. Integrations UI SLO Gate Test Coverage and Runbook Update
- Added component-level test coverage for SLO gate decision/action/signoff rendering.
- Updated connector runbook to include SLO gate card review in rollout checklist.
- Paths:
  - `frontend/src/pages/Integrations.test.tsx`
  - `docs/runbooks/CONNECTOR_ENRICHMENT_RUNBOOK.md`

66. Integrations Telemetry Query Controls
- Added telemetry controls in Integrations UI for:
  - `window days` (1-30)
  - `event limit` (50-5000)
- Added refresh action to re-query telemetry summary with operator-selected bounds.
- Path:
  - `frontend/src/pages/Integrations.tsx`

67. Integrations Telemetry Daily Trend View
- Added daily trend rendering in telemetry panel for:
  - date
  - total events
  - error events
  - sales-intelligence event counts
- Path:
  - `frontend/src/pages/Integrations.tsx`

68. Integrations Telemetry Snapshot Export
- Added JSON export action for telemetry summary payloads from Integrations UI.
- Path:
  - `frontend/src/pages/Integrations.tsx`

69. Integrations SLO Snapshot Export
- Added JSON export action for connector SLO gate responses from Integrations UI.
- Path:
  - `frontend/src/pages/Integrations.tsx`

70. Telemetry/SLO UI Test and Runbook Expansion
- Expanded Integrations component test expectations to validate:
  - telemetry refresh/export controls
  - telemetry trend rows
  - SLO export control
- Extended connector runbook checklist to include telemetry refresh + snapshot export evidence steps.
- Paths:
  - `frontend/src/pages/Integrations.test.tsx`
  - `docs/runbooks/CONNECTOR_ENRICHMENT_RUNBOOK.md`

71. Integrations Operation Feedback Banner
- Added top-level notice banner for operator feedback across:
  - connector credential save/remove
  - company/prospect lookup outcomes
  - telemetry/SLO snapshot exports
- Includes success and error notice variants.
- Path:
  - `frontend/src/pages/Integrations.tsx`

72. Telemetry and SLO Metadata Visibility
- Added metadata rows to Integrations telemetry and SLO cards for:
  - generated timestamp
  - effective window days
  - SLO overall gate pass/fail status
- Path:
  - `frontend/src/pages/Integrations.tsx`

73. Snapshot Export Error Handling
- Hardened snapshot download flow with explicit try/catch handling and error notice fallback.
- Path:
  - `frontend/src/pages/Integrations.tsx`

74. Interaction-Level Test Coverage for Refresh and Export Actions
- Added component interaction checks for:
  - telemetry refresh button query reissue
  - telemetry export button action
  - SLO export button action
- Added browser-API test stubs for URL blob handling and anchor click.
- Path:
  - `frontend/src/pages/Integrations.test.tsx`

75. Runbook Checklist Expansion for Operator Feedback Validation
- Updated connector runbook checklist to include verification of UI success/error notices during integration operations.
- Path:
  - `docs/runbooks/CONNECTOR_ENRICHMENT_RUNBOOK.md`

76. Notice Banner Dismiss Control
- Added explicit dismiss action to Integrations operation notice banner.
- Path:
  - `frontend/src/pages/Integrations.tsx`

77. Notice Banner Auto-Clear Timeout
- Added timed auto-clear behavior for operation notices to prevent stale feedback remaining on screen.
- Path:
  - `frontend/src/pages/Integrations.tsx`

78. Bounded Refresh Handlers with Feedback
- Added refresh helpers for telemetry and SLO controls that:
  - enforce valid bounds
  - emit info notices when operator input is normalized.
- Path:
  - `frontend/src/pages/Integrations.tsx`

79. SLO Refresh Interaction Test Coverage
- Added component interaction test validating SLO refresh button reissues the SLO query path.
- Path:
  - `frontend/src/pages/Integrations.test.tsx`

80. Notice Dismiss Interaction Test Coverage
- Added component interaction test path validating notice dismissal after export feedback appears.
- Path:
  - `frontend/src/pages/Integrations.test.tsx`

81. Notice Auto-Clear Timer Test Coverage
- Added deterministic interaction test coverage to verify integration operation notices clear automatically after timeout.
- Path:
  - `frontend/src/pages/Integrations.test.tsx`

82. Telemetry and SLO Bounds Normalization Interaction Tests
- Added component interaction test coverage for out-of-range telemetry and SLO filter inputs.
- Verified normalization query reissue and info notices for both telemetry and SLO refresh paths.
- Path:
  - `frontend/src/pages/Integrations.test.tsx`

83. Integration Telemetry/SLO HTTP Bounds Contract Coverage
- Added API contract tests for invalid query bounds on:
  - telemetry summary `days` and `limit`
  - SLO gate `days`, `limit`, and `max_error_rate_pct`
- Path:
  - `backend/tests/test_integration_http_contract.py`

84. Connector Runtime Verification Batch Command
- Added connector runtime verification script to run integration suite plus health smoke in one command.
- Added npm command:
  - `verify:backend:sales:connectors:runtime`
- Paths:
  - `backend/scripts/run_connector_runtime_verification.sh`
  - `package.json`

85. Runtime Verification Closure for Pending Connector Tasks
- Updated execution backlog runtime status for connector/provider/SLO/signoff items previously marked pending.
- Added runbook command reference for full connector runtime verification batch.
- Paths:
  - `EXECUTION_BACKLOG.md`
  - `docs/runbooks/CONNECTOR_ENRICHMENT_RUNBOOK.md`

86. Authenticated Layout Navigation Test Coverage
- Added component tests to verify:
  - Sales Intelligence navigation link visibility in authenticated layout
  - active-state styling on the Sales Intelligence route
- Path:
  - `frontend/src/components/Layout.test.tsx`

87. Integrations Metadata Fallback Test Coverage
- Added component test coverage to verify fallback metadata rendering when API responses omit:
  - telemetry `windowDays`
  - SLO `windowDays` and `gates.overallPassed`
- Path:
  - `frontend/src/pages/Integrations.test.tsx`

88. Sales Frontend Verification Command
- Added dedicated command for sales-only frontend validation:
  - `npm run verify:frontend:sales`
- Targets:
  - layout navigation
  - integrations page
  - sales intelligence page
- Path:
  - `package.json`

89. DEV_SETUP Sales Frontend Verification Update
- Added sales-focused frontend verification command to baseline setup documentation.
- Path:
  - `DEV_SETUP.md`

90. Backlog Evidence Hardening for Frontend UX Items
- Updated execution backlog verification evidence to test-backed checks for:
  - campaign analytics disabled-state UX
  - Sales Intelligence navigation entry
  - telemetry/SLO metadata rendering
  - notice auto-clear behavior
- Path:
  - `EXECUTION_BACKLOG.md`

91. Connector Runbook Contract Test Suite
- Added automated pytest coverage that validates connector runbook includes:
  - operations + verification command references
  - connector lookup validation steps
  - SLO gate review checklist guidance
  - telemetry refresh/export evidence steps
  - notice dismiss/auto-clear validation steps
- Path:
  - `backend/tests/test_connector_runbook_contract.py`

92. Sales Integrations Verification Suite Expansion
- Included runbook contract tests in the sales integrations verification script so runbook checks execute in standard backend sales verification.
- Path:
  - `backend/scripts/run_sales_integrations_tests.sh`

93. Dedicated Runbook Verification Command
- Added npm command for connector runbook contract verification:
  - `npm run verify:docs:sales:runbook`
- Path:
  - `package.json`

94. DEV_SETUP Runbook Verification Update
- Added runbook verification command to setup baseline checks.
- Path:
  - `DEV_SETUP.md`

95. Backlog Evidence Hardening for Runbook and Export Items
- Updated execution backlog verification evidence from manual review/component render checks to test-backed evidence for:
  - runbook operation/checklist update items
  - telemetry JSON export action
  - SLO JSON export action
- Path:
  - `EXECUTION_BACKLOG.md`

96. Backlog Evidence Hardening for Campaign Analytics Panel
- Updated execution backlog verification to replace compile-only proof with test-backed evidence for campaign analytics panel rendering.
- Path:
  - `EXECUTION_BACKLOG.md`

97. Backlog Evidence Hardening for Telemetry Summary Consumer
- Updated execution backlog verification to include explicit frontend test coverage for `salesIntelligence` telemetry summary rendering.
- Path:
  - `EXECUTION_BACKLOG.md`

98. Backlog Evidence Hardening for Sales Intelligence Page/Route Entry
- Updated execution backlog verification for Sales Intelligence page/route item to reference layout navigation + page test coverage.
- Path:
  - `EXECUTION_BACKLOG.md`

99. Backlog Evidence Hardening for Connector UI Config/Sandbox/SLO Controls
- Updated execution backlog verification to replace `npm run check` evidence with `npm run verify:frontend:sales` for:
  - connector key entry/removal flows
  - connector enrichment sandbox
  - SLO gate panel rendering
  - telemetry window controls
- Path:
  - `EXECUTION_BACKLOG.md`

100. Verification Stability Confirmation After Evidence Hardening
- Re-ran full baseline and targeted frontend/backend/docs suites after evidence updates.
- Commands:
  - `npm run verify:baseline`
  - `npm run verify:frontend:sales`
  - `npm run verify:backend:sales:integrations`
  - `npm run verify:docs:sales:runbook`
- Path:
  - `memory/BACKLOG_PROGRESS.md`

101. App Route Integration Coverage for Sales Intelligence
- Added application-level route tests for:
  - authenticated access to `/sales-intelligence`
  - unauthenticated redirect from `/sales-intelligence` to login
  - authenticated root redirect to AI command center
- Path:
  - `frontend/src/App.test.tsx`

102. Sales Intelligence Telemetry Empty-State Coverage
- Added component test coverage for empty telemetry trend and family distribution fallback messaging.
- Path:
  - `frontend/src/pages/SalesIntelligence.test.tsx`

103. Sales Intelligence Rollback Playbook Coverage
- Added component test coverage for `rollback` prediction decision playbook rendering (owner/action/checklist).
- Path:
  - `frontend/src/pages/SalesIntelligence.test.tsx`

104. Sales Frontend Verification Command Expansion
- Expanded sales frontend verification command to include route-level app test coverage.
- Command:
  - `npm run verify:frontend:sales`
- Path:
  - `package.json`

105. Backlog Evidence Hardening for Sales Intelligence Route/Charts
- Updated execution backlog verification evidence for:
  - Sales Intelligence page route visibility
  - campaign channel chart visualization
  - sales event family distribution visualization
- Path:
  - `EXECUTION_BACKLOG.md`

106. App Route Test Warning Noise Reduction
- Added targeted console warning filter in app route test setup for known React Router future-flag warnings to keep verification output focused on actionable failures.
- Path:
  - `frontend/src/App.test.tsx`

107. Frontend API and UI Evidence Hardening (Remaining Generic Lines)
- Updated execution backlog verification evidence for:
  - integrations telemetry summary API binding test
  - connector credential/health API binding tests
  - provider health visibility and feature-flag badge UI checks
  - component-level analytics test references for Integrations + Sales Intelligence pages
- Path:
  - `EXECUTION_BACKLOG.md`

108. Sales Intelligence Telemetry Controls and Bounds Enforcement
- Added dashboard controls for telemetry `window days` and `event limit`.
- Added bounded refresh logic with operator-facing normalization notices.
- Path:
  - `frontend/src/pages/SalesIntelligence.tsx`
  - `frontend/src/pages/SalesIntelligence.test.tsx`

109. Sales Intelligence Snapshot Export Actions
- Added dashboard JSON exports for telemetry summary and prediction report snapshots.
- Added explicit success/error notice handling for export operations.
- Path:
  - `frontend/src/pages/SalesIntelligence.tsx`
  - `frontend/src/pages/SalesIntelligence.test.tsx`

110. Sales Intelligence Notice Banner Lifecycle
- Added dashboard operation notice banner with dismiss action and timed auto-clear behavior.
- Path:
  - `frontend/src/pages/SalesIntelligence.tsx`
  - `frontend/src/pages/SalesIntelligence.test.tsx`

111. Sales Intelligence Telemetry Metadata Visibility
- Added telemetry metadata row for generated timestamp, effective window, and active limit controls.
- Path:
  - `frontend/src/pages/SalesIntelligence.tsx`
  - `frontend/src/pages/SalesIntelligence.test.tsx`

112. Predictive Runbook Contract Coverage Expansion
- Added runbook contract tests to enforce dashboard control/export/notice validation steps.
- Included predictive runbook test suite in the sales-intelligence verification runner.
- Path:
  - `backend/tests/test_predictive_runbook_contract.py`
  - `backend/scripts/run_sales_intelligence_tests.sh`
  - `docs/runbooks/PREDICTIVE_OPTIMIZATION_RUNBOOK.md`

113. Dedicated Sales Intelligence Frontend Verification Command
- Added focused frontend command for Sales Intelligence page-only validation:
  - `npm run verify:frontend:sales:intelligence`
- Path:
  - `package.json`
  - `DEV_SETUP.md`

114. Dedicated Predictive Runbook Verification Command
- Added docs-focused command to run predictive optimization runbook contract checks:
  - `npm run verify:docs:sales:predictive`
- Path:
  - `package.json`
  - `DEV_SETUP.md`

115. Predictive Runbook Operational Linkage and Rollback Evidence Expansion
- Added related connector rollout/rollback/signoff references.
- Added explicit rollback evidence artifact checklist entries.
- Path:
  - `docs/runbooks/PREDICTIVE_OPTIMIZATION_RUNBOOK.md`
  - `backend/tests/test_predictive_runbook_contract.py`

116. Predictive Runbook Contract Path Hardening
- Updated predictive runbook contract test to resolve runbook paths relative to repository root for environment portability.
- Path:
  - `backend/tests/test_predictive_runbook_contract.py`

117. Sales Intelligence Test Warning Noise Reduction
- Added targeted warning filter for known Recharts zero-dimension test warnings to keep frontend verification logs focused on actionable failures.
- Path:
  - `frontend/src/pages/SalesIntelligence.test.tsx`

118. Integration Request-Correlation Propagation
- Added `X-Request-Id` header generation in frontend API requests.
- Added backend extraction and telemetry/log propagation of request IDs for core integration operations (email send, webhook processing, provider enrichment, orchestration).
- Added HTTP contract coverage validating request-id persistence in integration telemetry payload.
- Path:
  - `frontend/src/lib/api.ts`
  - `frontend/src/lib/api.test.js`
  - `backend/routes/real_integrations.py`
  - `backend/tests/test_integration_http_contract.py`
  - `backend/tests/test_integration_telemetry_summary.py`

119. Integration Log and Telemetry Sanitization Hardening
- Added recursive payload sanitization for sensitive keys (`api_key`, `authorization`, `token`, `password`, `secret`, etc.).
- Added email masking in structured integration logs/telemetry payloads for privacy minimization.
- Added contract tests for nested redaction behavior.
- Path:
  - `backend/routes/real_integrations.py`
  - `backend/tests/test_integration_logging_contract.py`
  - `backend/tests/test_integration_telemetry_summary.py`

120. Baseline Metrics Artifact Tooling
- Added baseline metrics collector script that runs baseline steps and writes:
  - `backend/test_reports/baseline_metrics.json`
- Captures per-step status, command, duration, and parsed test-count metrics.
- Added unit tests for parser logic and required step coverage.
- Added npm command:
  - `npm run verify:baseline:metrics`
- Path:
  - `backend/scripts/collect_baseline_metrics.py`
  - `backend/tests/test_baseline_metrics_tooling_unittest.py`
  - `backend/scripts/run_sales_integrations_tests.sh`
  - `package.json`
  - `DEV_SETUP.md`

121. Sales Dashboard Smoke Verification Command
- Added dedicated smoke command for Sales Intelligence dashboard validation:
  - frontend dashboard tests + predictive runbook contract checks.
- Added npm command:
  - `npm run verify:smoke:sales-dashboard`
- Path:
  - `backend/scripts/run_smoke_sales_dashboard_workflow.sh`
  - `package.json`
  - `DEV_SETUP.md`

122. Sales Intelligence Telemetry Metadata Fallback Coverage
- Added frontend test coverage for metadata fallback rendering when telemetry payload omits `generatedAt` and `windowDays`.
- Path:
  - `frontend/src/pages/SalesIntelligence.test.tsx`

123. Sales Intelligence Request-Correlation Telemetry Propagation
- Propagated request context to all sales-intelligence telemetry emit calls (forecast, conversation, engagement, campaign lifecycle, relationship map, phrase analytics, and prediction endpoints).
- Telemetry payload now captures bounded `request_id` where `X-Request-Id` or `X-Correlation-Id` is provided.
- Path:
  - `backend/routes/sales_intelligence.py`

124. Sales Intelligence Telemetry Schema Contract Coverage
- Added HTTP contract coverage to verify sales-intelligence telemetry records include:
  - root `schemaVersion=2`
  - payload `schema_version=2`
  - payload `request_id` propagation from request header
- Path:
  - `backend/tests/test_sales_intelligence_http_contract.py`

125. Predictive Runbook Correlation and Schema Verification Guidance
- Expanded runbook manual validation checklist and observability notes for request-correlation + schema metadata checks.
- Added runbook contract assertions for `X-Request-Id`, `schema_version`, and `schemaVersion=2` guidance.
- Path:
  - `docs/runbooks/PREDICTIVE_OPTIMIZATION_RUNBOOK.md`
  - `backend/tests/test_predictive_runbook_contract.py`

126. Sales Intelligence Correlation Header Fallback Coverage
- Added HTTP contract coverage validating sales-intelligence telemetry uses `X-Correlation-Id` when `X-Request-Id` is absent.
- Path:
  - `backend/tests/test_sales_intelligence_http_contract.py`

127. Sales Intelligence Cross-Endpoint Request-Correlation Matrix Coverage
- Added endpoint-family contract test that exercises forecast, conversation, engagement, campaign lifecycle/performance, relationship map, phrase analytics, and prediction flows with shared request ID.
- Added assertions that telemetry records across these flows persist `request_id` and schema version metadata.
- Path:
  - `backend/tests/test_sales_intelligence_http_contract.py`

128. Integrations Telemetry Summary Schema Aggregation
- Extended telemetry summary response with:
  - top-level `bySchemaVersion`
  - `salesIntelligence.bySchemaVersion`
  - `recentEvents[].schemaVersion`
  - `recentEvents[].requestId`
- Path:
  - `backend/routes/real_integrations.py`

129. Telemetry Summary Schema Metadata Contract Expansion
- Added integration summary unit + HTTP contract assertions for schema-version aggregation and request-correlation metadata fields.
- Path:
  - `backend/tests/test_integration_telemetry_summary.py`
  - `backend/tests/test_integration_http_contract.py`

130. Integrations Reliability Runbook Schema/Correlation Contract
- Updated integrations reliability runbook with schema-version and request-correlation validation checks for telemetry summary review.
- Added dedicated runbook contract tests and included them in integrations verification runner.
- Path:
  - `docs/runbooks/INTEGRATIONS_RELIABILITY_RUNBOOK.md`
  - `backend/tests/test_integrations_reliability_runbook_contract.py`
  - `backend/scripts/run_sales_integrations_tests.sh`

131. Connector SLO Gate Schema-Coverage Enforcement
- Extended connector SLO evaluation endpoint with schema-coverage gating:
  - query parameter `min_schema_v2_pct`
  - gate output `gates.schemaCoveragePassed`
  - metrics block `schemaCoverage` (`thresholdPct`, `observedPct`, `sampleCount`, `schemaV2Count`)
- Added schema-coverage alert path and hold-decision behavior when schema v2 adoption is below threshold.
- Path:
  - `backend/routes/real_integrations.py`
  - `backend/tests/test_integration_telemetry_summary.py`
  - `backend/tests/test_integration_http_contract.py`

132. Integrations Frontend Schema Observability Panel
- Added Integrations telemetry UI sections for:
  - overall schema-version adoption breakdown
  - sales-intelligence schema-version breakdown
  - recent correlated events (`requestId`, `schemaVersion`) preview
- Added schema-coverage display in telemetry metadata and summary cards.
- Path:
  - `frontend/src/pages/Integrations.tsx`
  - `frontend/src/pages/Integrations.test.tsx`

133. Sales Intelligence Schema Health Visibility
- Added dashboard-level schema health indicators:
  - telemetry metadata now includes schema v2 coverage
  - schema-version breakdown panel under sales event family distribution
- Path:
  - `frontend/src/pages/SalesIntelligence.tsx`
  - `frontend/src/pages/SalesIntelligence.test.tsx`

134. Frontend API + SLO Controls for Schema Threshold
- Extended frontend API binding for SLO gates with `minSchemaV2Pct` query option.
- Added Integrations SLO control input for minimum schema v2 threshold and included it in refresh query state.
- Added frontend tests for request query formation and SLO query-key refresh behavior with schema threshold.
- Path:
  - `frontend/src/lib/api.ts`
  - `frontend/src/lib/api.test.js`
  - `frontend/src/pages/Integrations.tsx`
  - `frontend/src/pages/Integrations.test.tsx`

135. Release Gate Schema Coverage Enforcement
- Extended connector release-gate evaluator to require `sloSummary.gates.schemaCoveragePassed`.
- Added explicit schema coverage details to gate output and failure reasons.
- Path:
  - `backend/scripts/enforce_connector_release_gate.py`
  - `backend/tests/test_enforce_connector_release_gate_unittest.py`

136. Alert Matrix Schema-Coverage Response Contract
- Added explicit `schema_coverage` gate action/owner guidance to connector alert response matrix.
- Added dedicated contract test to prevent regressions in matrix coverage.
- Path:
  - `docs/runbooks/CONNECTOR_ALERT_RESPONSE_MATRIX.md`
  - `backend/tests/test_connector_alert_response_matrix_contract.py`
  - `backend/scripts/run_sales_integrations_tests.sh`

137. Connector SLO Alerts Runbook Schema Gate Guidance
- Updated SLO gates runbook with schema-coverage threshold configuration, query parameter, and response fields.
- Added dedicated runbook contract test for schema-gate fragments.
- Path:
  - `docs/runbooks/CONNECTOR_SLO_ALERTS.md`
  - `backend/tests/test_connector_slo_alerts_contract.py`
  - `backend/scripts/run_sales_integrations_tests.sh`

138. Baseline Metrics Schema-Adoption Counters
- Extended baseline metrics collector with `schemaAdoption` artifact block sourced from connector canary evidence when present.
- Added missing/invalid evidence fallbacks and extraction coverage for schema v2 percent/sample counters.
- Path:
  - `backend/scripts/collect_baseline_metrics.py`
  - `backend/tests/test_baseline_metrics_tooling_unittest.py`

139. Schema Threshold Passthrough for SLO Automation Scripts
- Added `--min-schema-v2-pct` support to:
  - connector SLO evaluator CLI
  - canary evidence collection CLI
- Ensures automated SLO evaluations/evidence snapshots can enforce schema coverage policy.
- Path:
  - `backend/scripts/evaluate_connector_slo_gates.py`
  - `backend/scripts/collect_connector_canary_evidence.py`

140. Baseline Pipeline Schema-Gate Smoke Wiring
- Added schema-gate smoke verification into the baseline pipeline so schema rollout guardrails run on every baseline check.
- Added baseline metrics step tracking for schema-gate smoke execution.
- Path:
  - `package.json`
  - `backend/scripts/collect_baseline_metrics.py`
  - `backend/tests/test_baseline_metrics_tooling_unittest.py`

141. Integrations Reliability Runbook Schema-Gate Smoke Coverage
- Added schema-gate smoke command guidance to integrations reliability runbook verification commands.
- Added runbook contract test coverage to prevent command drift.
- Path:
  - `docs/runbooks/INTEGRATIONS_RELIABILITY_RUNBOOK.md`
  - `backend/tests/test_integrations_reliability_runbook_contract.py`

142. Canary/SLO Script Preflight Validation Hardening
- Added argument preflight validation in SLO automation scripts for:
  - `days` range (1-30)
  - `limit` range (100-5000)
  - `max_error_rate_pct` range (0-100)
  - `min_schema_v2_pct` range (0-100)
- Script now fails fast with non-zero exit on invalid inputs before network calls.
- Path:
  - `backend/scripts/evaluate_connector_slo_gates.py`
  - `backend/scripts/collect_connector_canary_evidence.py`

143. SLO Automation Query Validation Contract Expansion
- Added unittest coverage ensuring invalid schema thresholds and invalid limits are rejected before URL fetches/output writes.
- Path:
  - `backend/tests/test_connector_slo_script_query_unittest.py`

144. Setup Guide Schema Threshold and Smoke Command Alignment
- Updated developer setup commands to include schema threshold usage for canary/SLO scripts.
- Added schema-gate smoke command to baseline health command checklist.
- Path:
  - `DEV_SETUP.md`

145. Release-Gate Smoke Workflow Command + Baseline Wiring
- Added dedicated release-gate smoke command:
  - `npm run verify:smoke:release-gate`
- Wired baseline verification to run release-gate smoke before health smoke.
- Extended baseline metrics step capture to include release-gate smoke execution.
- Path:
  - `package.json`
  - `backend/scripts/run_smoke_connector_release_gate_workflow.sh`
  - `backend/scripts/collect_baseline_metrics.py`
  - `backend/tests/test_baseline_metrics_tooling_unittest.py`

146. Release-Gate End-to-End Hold-to-Proceed Smoke Test
- Added end-to-end smoke coverage for connector signoff chain:
  - generate signoff template
  - validate signoff bundle
  - enforce release gate
- Added hold-to-proceed transition assertions for schema gate recovery in one workflow.
- Path:
  - `backend/tests/test_connector_release_gate_smoke.py`

147. SLO Automation Network Failure Contract Expansion
- Added script-level tests for transport failure behavior:
  - SLO evaluator returns non-zero on `URLError`
  - canary evidence collector returns non-zero on `HTTPError`
- Path:
  - `backend/tests/test_connector_slo_script_query_unittest.py`

148. DEV_SETUP Contract Coverage
- Added contract tests to verify `DEV_SETUP.md` keeps required baseline/smoke commands and schema-threshold CLI examples.
- Path:
  - `backend/tests/test_dev_setup_contract.py`

149. Integrations Verification Runner Expansion
- Added new smoke and contract suites into integrations verification runner:
  - release-gate smoke workflow test
  - DEV_SETUP contract checks
- Expanded integrations reliability runbook contract with release-gate smoke command check.
- Path:
  - `backend/scripts/run_sales_integrations_tests.sh`
  - `backend/tests/test_integrations_reliability_runbook_contract.py`
  - `docs/runbooks/INTEGRATIONS_RELIABILITY_RUNBOOK.md`

150. Baseline Lint Gate Enablement
- Added repository-level `lint` command and integrated it into baseline verification entrypoint.
- Maintained compatibility by mapping lint to existing TypeScript static checks.
- Updated baseline metrics step sequencing to track `lint` as first-class gate.
- Path:
  - `package.json`
  - `backend/scripts/collect_baseline_metrics.py`
  - `backend/tests/test_baseline_metrics_tooling_unittest.py`

151. Shared Integrations SLO Policy Constants
- Added centralized integrations SLO policy constants module for:
  - telemetry day ranges
  - telemetry summary query limits
  - SLO query limits
  - percentage threshold bounds
  - default threshold values
- Refactored integrations telemetry summary/SLO gate route validation to consume shared constants.
- Refactored connector SLO automation scripts to consume shared constants.
- Path:
  - `backend/core/integration_slo_policy.py`
  - `backend/routes/real_integrations.py`
  - `backend/scripts/evaluate_connector_slo_gates.py`
  - `backend/scripts/collect_connector_canary_evidence.py`

152. Shared SLO Policy Contract Tests
- Added contract tests for shared SLO policy constants and script validation consistency.
- Added policy contract suite to integrations verification runner.
- Path:
  - `backend/tests/test_integration_slo_policy_contract.py`
  - `backend/scripts/run_sales_integrations_tests.sh`

153. Release-Gate Smoke Active-Alert Failure Coverage
- Extended release-gate smoke workflow with active-alert blocking scenario.
- Ensures release gate remains blocked when alerts are present even with schema coverage and approvals.
- Path:
  - `backend/tests/test_connector_release_gate_smoke.py`

154. DEV Setup Lint Command Contract Alignment
- Added `npm run lint` into setup baseline command checklist.
- Extended DEV setup contract tests to enforce lint command presence.
- Path:
  - `DEV_SETUP.md`
  - `backend/tests/test_dev_setup_contract.py`

155. Release-Gate Smoke Missing-Approval Failure Coverage
- Added release-gate smoke scenario for missing required approver.
- Validates signoff bundle failure propagates to release-gate enforcement (`validationPassed` fail path).
- Path:
  - `backend/tests/test_connector_release_gate_smoke.py`

156. Release-Gate Smoke Missing-Evidence Failure Coverage
- Added release-gate smoke scenario for missing required evidence artifact (`telemetry_slo_gates_snapshot.json`).
- Validates invalid bundle blocks release-gate approval even with decision/signoff status set.
- Path:
  - `backend/tests/test_connector_release_gate_smoke.py`

157. Baseline Command Chain Contract Guard
- Added package-level contract tests enforcing:
  - `lint` script presence
  - exact `verify:baseline` command-stage ordering (lint/build/frontend/backend/smokes)
- Path:
  - `backend/tests/test_baseline_command_chain_contract.py`

158. Integrations Runner Contract Expansion (Baseline Chain)
- Added baseline command chain contract suite into integrations verification runner.
- Path:
  - `backend/scripts/run_sales_integrations_tests.sh`
  - `backend/tests/test_baseline_command_chain_contract.py`

159. SLO Threshold Default Resolution Contract
- Added route-level helper for integrations SLO threshold resolution and validation.
- Added contract coverage for default threshold behavior and environment override behavior.
- Path:
  - `backend/routes/real_integrations.py`
  - `backend/tests/test_integration_slo_policy_contract.py`

160. SLO Script Omitted-Threshold Query Contract
- Added script contract tests verifying SLO automation URLs omit optional threshold parameters when not provided.
- Confirms API default threshold resolution path remains authoritative.
- Path:
  - `backend/tests/test_connector_slo_script_query_unittest.py`

161. Baseline Metrics Artifact Validator Script
- Added validator script for baseline metrics artifact schema/ordering checks.
- Added npm command for explicit artifact contract enforcement:
  - `verify:baseline:metrics:contract`
- Updated aggregate metrics command to run collection + contract validation.
- Path:
  - `backend/scripts/validate_baseline_metrics_artifact.py`
  - `backend/tests/test_baseline_metrics_artifact_contract_unittest.py`
  - `package.json`

162. Integrations Runbook Full Baseline Command Contract
- Added integrations reliability runbook guidance for full baseline verification command.
- Added runbook contract assertion for baseline command presence.
- Path:
  - `docs/runbooks/INTEGRATIONS_RELIABILITY_RUNBOOK.md`
  - `backend/tests/test_integrations_reliability_runbook_contract.py`

163. DEV Setup Metrics Contract Command Alignment
- Added baseline metrics contract command to setup checklist.
- Extended DEV_SETUP contract tests to enforce command presence.
- Path:
  - `DEV_SETUP.md`
  - `backend/tests/test_dev_setup_contract.py`

164. CI-Friendly Sales Verification Wrapper Command
- Added unified CI wrapper command chaining full sales baseline + baseline metrics contract validation:
  - `npm run verify:ci:sales`
- Added package contract assertion for wrapper command stability.
- Path:
  - `package.json`
  - `backend/tests/test_baseline_command_chain_contract.py`

165. Release-Gate Smoke Malformed-Approval Coverage
- Added release-gate smoke scenario for malformed approval markers that should not satisfy required approvals.
- Validates malformed markers still fail signoff validation and block release gate (`validationPassed` fail path).
- Path:
  - `backend/tests/test_connector_release_gate_smoke.py`

166. Integrations Runbook Command Inventory Contract Expansion
- Expanded integrations reliability runbook command inventory with:
  - CI wrapper command
  - baseline metrics command
  - baseline metrics contract command
- Added contract assertion covering the full required command set.
- Path:
  - `docs/runbooks/INTEGRATIONS_RELIABILITY_RUNBOOK.md`
  - `backend/tests/test_integrations_reliability_runbook_contract.py`

167. Baseline Metrics CI Contract Gate
- Added dedicated baseline metrics artifact validator script.
- Chained `verify:baseline:metrics` to enforce collection + contract validation every run.
- Added validator unittest coverage for missing keys, status validity, and step-order drift.
- Path:
  - `backend/scripts/validate_baseline_metrics_artifact.py`
  - `backend/tests/test_baseline_metrics_artifact_contract_unittest.py`
  - `package.json`

168. SLO Threshold Non-Numeric Environment Guard
- Hardened integrations SLO threshold resolution to reject non-numeric environment values with explicit `400` responses.
- Added contract coverage for both error-rate and schema-threshold env parse failures.
- Path:
  - `backend/routes/real_integrations.py`
  - `backend/tests/test_integration_slo_policy_contract.py`

169. Integrations Runbook Evidence Artifact Inventory
- Added explicit reliability artifact inventory section with canonical artifact paths:
  - baseline metrics
  - connector canary evidence
  - signoff validation
  - release gate decision
- Added retention guidance (`>=14 days`) and contract assertions.
- Path:
  - `docs/runbooks/INTEGRATIONS_RELIABILITY_RUNBOOK.md`
  - `backend/tests/test_integrations_reliability_runbook_contract.py`

170. DEV Setup Artifact Path Contract Alignment
- Added baseline metrics artifact file path to setup checklist.
- Extended setup contract coverage to enforce artifact path mention.
- Path:
  - `DEV_SETUP.md`
  - `backend/tests/test_dev_setup_contract.py`

171. Release-Gate Smoke Malformed Evidence Coverage
- Added release-gate smoke scenario for malformed evidence payload shape.
- Validates malformed evidence still blocks release via `decisionIsProceed` and `signoffReady` failed checks.
- Path:
  - `backend/tests/test_connector_release_gate_smoke.py`

172. HTTP Contract Coverage for Non-Numeric SLO Threshold Environment Values
- Added endpoint-level contract coverage for invalid SLO threshold env values:
  - `INTEGRATION_SLO_MAX_ERROR_RATE_PCT`
  - `INTEGRATION_SLO_MIN_SCHEMA_V2_PCT`
- Confirms `/integrations/telemetry/slo-gates` returns `400` with explicit numeric error details.
- Path:
  - `backend/tests/test_integration_http_contract.py`

173. Predictive Runbook CI Command + Artifact Retention Guidance
- Added predictive runbook deployment guidance for CI wrapper command:
  - `npm run verify:ci:sales`
- Added baseline metrics artifact path and evidence retention guidance (`>=14 days`).
- Added predictive runbook contract assertions for the new command and retention fragments.
- Path:
  - `docs/runbooks/PREDICTIVE_OPTIMIZATION_RUNBOOK.md`
  - `backend/tests/test_predictive_runbook_contract.py`

174. Schema Sample-Size SLO Gate Policy
- Added shared policy constants for minimum schema sample thresholds and default rollout requirement.
- Extended integrations SLO threshold resolution to include `min_schema_v2_sample_count` (query + env driven).
- Added SLO gate output and decision wiring for `gates.schemaSampleSizePassed` and `schemaCoverage.minSampleCount`.
- Path:
  - `backend/core/integration_slo_policy.py`
  - `backend/routes/real_integrations.py`
  - `backend/tests/test_integration_slo_policy_contract.py`
  - `backend/tests/test_integration_http_contract.py`
  - `backend/tests/test_integration_telemetry_summary.py`

175. Connector SLO CLI Sample Threshold Propagation
- Added schema sample threshold CLI arg support and validation:
  - `--min-schema-v2-sample-count`
- Propagated sample threshold to SLO gate query URLs in canary-evidence and SLO evaluator scripts.
- Added unit coverage for param passthrough and invalid threshold rejection.
- Path:
  - `backend/scripts/collect_connector_canary_evidence.py`
  - `backend/scripts/evaluate_connector_slo_gates.py`
  - `backend/tests/test_connector_slo_script_query_unittest.py`

176. Release Gate Sample-Size Enforcement Hardening
- Hardened release gate evaluator to fail closed when schema gate markers are missing.
- Added explicit schema sample-size gate check (`schemaSampleSizePassed`) and reason output.
- Extended smoke + unit coverage for sample-size blocking paths.
- Path:
  - `backend/scripts/enforce_connector_release_gate.py`
  - `backend/tests/test_enforce_connector_release_gate_unittest.py`
  - `backend/tests/test_connector_release_gate_smoke.py`

177. Baseline Metrics Schema Sample Gate Extraction
- Extended baseline metrics schema-adoption extraction with schema sample gate fields:
  - `schemaSampleGatePassed`
  - `schemaObservedSampleCount`
  - `schemaMinSampleCount`
- Added tooling tests to lock contract and evidence parsing.
- Path:
  - `backend/scripts/collect_baseline_metrics.py`
  - `backend/tests/test_baseline_metrics_tooling_unittest.py`

178. Runbook + Setup Contract Alignment for Schema Sample Gate
- Expanded integrations reliability and SLO alerts runbooks with schema sample-size guidance.
- Updated setup canary/SLO command examples to include sample threshold override.
- Added contract assertions for docs/setup drift protection.
- Path:
  - `docs/runbooks/INTEGRATIONS_RELIABILITY_RUNBOOK.md`
  - `docs/runbooks/CONNECTOR_SLO_ALERTS.md`
  - `DEV_SETUP.md`
  - `backend/tests/test_integrations_reliability_runbook_contract.py`
  - `backend/tests/test_connector_slo_alerts_contract.py`
  - `backend/tests/test_dev_setup_contract.py`

179. Integrations UI Schema Sample Gate Controls + Visibility
- Extended integrations SLO gate query controls with minimum schema sample count input (`1..5000` bounded).
- Propagated `min_schema_v2_sample_count` through frontend API bindings and query keys.
- Added SLO card visibility for schema sample gate status and observed/min sample counts.
- Path:
  - `frontend/src/lib/api.ts`
  - `frontend/src/lib/api.test.js`
  - `frontend/src/pages/Integrations.tsx`
  - `frontend/src/pages/Integrations.test.tsx`

180. Schema Sample-Size Alert Response Ownership Mapping
- Added explicit rollout action mapping for `schema_sample_size` alerts:
  - `ownerRole = Sales Ops Lead`
  - hold rollout + collect additional schema-v2 telemetry samples
- Updated alert response matrix runbook and contract assertions for sample-size alert ownership/action.
- Path:
  - `backend/routes/real_integrations.py`
  - `docs/runbooks/CONNECTOR_ALERT_RESPONSE_MATRIX.md`
  - `backend/tests/test_connector_alert_response_matrix_contract.py`
  - `backend/tests/test_integration_http_contract.py`

181. Signoff Traceability Checklist Enforcement
- Added generated signoff template checklist section for schema gate traceability markers:
  - `schemaCoverage.thresholdPct`
  - `schemaCoverage.observedPct`
  - `schemaCoverage.sampleCount`
  - `schemaCoverage.minSampleCount`
  - `gates.schemaCoveragePassed`
  - `gates.schemaSampleSizePassed`
- Extended signoff bundle validator to enforce marker presence before pass.
- Updated signoff runbook validation rule text and unit coverage.
- Path:
  - `backend/scripts/generate_connector_signoff_template.py`
  - `backend/scripts/validate_connector_signoff_bundle.py`
  - `docs/runbooks/CONNECTOR_RELEASE_SIGNOFF.md`
  - `backend/tests/test_signoff_toolchain_unittest.py`
  - `backend/tests/test_validate_connector_signoff_bundle_unittest.py`

182. Predictive Runbook Schema Sample-Gate Interpretation
- Added predictive rollout checklist guidance for connector schema gates:
  - require `gates.schemaSampleSizePassed=true` and `gates.schemaCoveragePassed=true`
  - require `schemaCoverage.sampleCount >= schemaCoverage.minSampleCount`
  - hold predictive rollout when schema sample gate fails
- Added optional dry-run guidance using:
  - `--min-schema-v2-sample-count 25`
- Extended predictive runbook contract assertions for the new schema sample-gate fragments.
- Path:
  - `docs/runbooks/PREDICTIVE_OPTIMIZATION_RUNBOOK.md`
  - `backend/tests/test_predictive_runbook_contract.py`

183. Canary Evidence Dry-Run Smoke for Schema Sample Override
- Added dry-run smoke test for canary evidence collector with mocked endpoint responses:
  - verifies `min_schema_v2_sample_count` query propagation
  - verifies output includes `sloSummary.gates.schemaSampleSizePassed`
  - verifies output includes `sloSummary.schemaCoverage.minSampleCount`
- Added test to integrations verification runner.
- Path:
  - `backend/tests/test_connector_canary_dry_run_smoke.py`
  - `backend/scripts/run_sales_integrations_tests.sh`

184. Runbook Contracts for Canary Evidence and Release Signoff
- Added canary evidence runbook contract assertions for schema sample override command and output fields.
- Added release signoff runbook contract assertions for schema traceability validation markers.
- Added both contract suites to integrations verification runner.
- Path:
  - `docs/runbooks/CONNECTOR_CANARY_EVIDENCE.md`
  - `docs/runbooks/CONNECTOR_RELEASE_SIGNOFF.md`
  - `backend/tests/test_connector_canary_evidence_runbook_contract.py`
  - `backend/tests/test_connector_release_signoff_runbook_contract.py`
  - `backend/scripts/run_sales_integrations_tests.sh`

185. Integrations UI Signoff Traceability Readiness
- Added a dedicated `Traceability Readiness` status in the connector SLO gate panel.
- Readiness now requires:
  - `gates.schemaCoveragePassed=true`
  - `gates.schemaSampleSizePassed=true`
  - `signoff.status=READY_FOR_APPROVAL`
  - non-empty required approvals/evidence lists
- Added visible approval/evidence counts for operator validation.
- Path:
  - `frontend/src/pages/Integrations.tsx`

186. Frontend Coverage for Traceability Readiness
- Added component test coverage for READY-state rendering of traceability readiness.
- Verifies readiness status and approval/evidence counters in SLO panel output.
- Path:
  - `frontend/src/pages/Integrations.test.tsx`

187. Release-Gate Result Artifact Schema Contract
- Added result-contract tests for release-gate output schema to enforce schema traceability fields:
  - `schemaCoverage.passed`
  - `schemaCoverage.sampleSizePassed`
  - `schemaCoverage.sampleCount`
  - `schemaCoverage.minSampleCount`
- Added fail-safe default coverage for missing schema gate payloads.
- Path:
  - `backend/tests/test_connector_release_gate_result_contract.py`
  - `backend/scripts/run_sales_integrations_tests.sh`

188. Connector Docs Verification Wrapper Commands
- Added connector runbook verification wrapper script:
  - `backend/scripts/run_docs_connector_runbook_contracts.sh`
- Added npm commands:
  - `verify:docs:sales:connectors`
  - `verify:docs:sales` (connectors + predictive)
- Added package script contract checks and setup/runbook command inventory alignment.
- Path:
  - `backend/scripts/run_docs_connector_runbook_contracts.sh`
  - `package.json`
  - `backend/tests/test_baseline_command_chain_contract.py`
  - `backend/tests/test_dev_setup_contract.py`
  - `docs/runbooks/INTEGRATIONS_RELIABILITY_RUNBOOK.md`
  - `backend/tests/test_integrations_reliability_runbook_contract.py`
  - `DEV_SETUP.md`

189. Canary Dry-Run Smoke Wrapper Command
- Added dedicated canary dry-run smoke workflow wrapper:
  - `backend/scripts/run_smoke_connector_canary_dry_run_workflow.sh`
- Added npm command:
  - `verify:smoke:canary-dry-run`
- Extended script command contract coverage and docs/setup command inventory.
- Path:
  - `backend/scripts/run_smoke_connector_canary_dry_run_workflow.sh`
  - `package.json`
  - `backend/tests/test_baseline_command_chain_contract.py`
  - `backend/tests/test_dev_setup_contract.py`
  - `docs/runbooks/INTEGRATIONS_RELIABILITY_RUNBOOK.md`
  - `backend/tests/test_integrations_reliability_runbook_contract.py`

190. Combined Sales Smoke Wrapper Command
- Added combined sales smoke workflow wrapper:
  - `campaign` smoke
  - `canary dry-run` smoke
  - `schema gate` smoke
  - `release gate` smoke
  - `health` smoke
- Added npm command:
  - `verify:smoke:sales`
- Added package script contract coverage.
- Path:
  - `backend/scripts/run_smoke_sales_suite.sh`
  - `package.json`
  - `backend/tests/test_baseline_command_chain_contract.py`

191. Integrations Traceability Remediation Guidance
- Added `NOT READY` remediation checklist rendering in Integrations SLO card.
- Remediation checklist now surfaces missing schema gates/signoff state/approvals/evidence.
- Added frontend test coverage for remediation rendering.
- Path:
  - `frontend/src/pages/Integrations.tsx`
  - `frontend/src/pages/Integrations.test.tsx`

192. Connector Release-Gate Artifact Schema Validator
- Added release-gate artifact validator script for JSON contract checks.
- Added unit tests covering valid shape, missing schema keys, invalid check types, and invalid file handling.
- Added npm command:
  - `verify:release-gate:artifact:contract`
- Path:
  - `backend/scripts/validate_connector_release_gate_artifact.py`
  - `backend/tests/test_connector_release_gate_artifact_contract_unittest.py`
  - `package.json`

193. Release-Gate Artifact Fixture Generation in Smoke Workflow
- Added fixture generator script for deterministic release-gate artifact creation.
- Wired release-gate smoke workflow to generate:
  - `backend/test_reports/connector_release_gate_result.json`
- Added unit test coverage for fixture payload and file output behavior.
- Path:
  - `backend/scripts/generate_connector_release_gate_artifact_fixture.py`
  - `backend/scripts/run_smoke_connector_release_gate_workflow.sh`
  - `backend/tests/test_connector_release_gate_artifact_fixture_unittest.py`

194. Extended Sales CI Wrapper + Runbook Path Normalization
- Added extended CI wrapper command:
  - `verify:ci:sales:extended` (`verify:ci:sales` + docs suite + canary dry-run smoke)
- Normalized stale runbook workspace paths from `EngageAI2-main` to `EngageAI2`.
- Added runbook path normalization contract to block stale workspace path regressions.
- Updated runbook/setup command inventories and contracts for new wrappers.
- Path:
  - `package.json`
  - `docs/runbooks/CONNECTOR_CANARY_EVIDENCE.md`
  - `docs/runbooks/CONNECTOR_RELEASE_SIGNOFF.md`
  - `docs/runbooks/CONNECTOR_SLO_ALERTS.md`
  - `docs/runbooks/INTEGRATIONS_RELIABILITY_RUNBOOK.md`
  - `docs/runbooks/CONNECTOR_ENRICHMENT_RUNBOOK.md`
  - `DEV_SETUP.md`
  - `backend/tests/test_runbook_path_normalization_contract.py`
  - `backend/tests/test_dev_setup_contract.py`
  - `backend/tests/test_integrations_reliability_runbook_contract.py`
  - `backend/tests/test_connector_runbook_contract.py`
  - `backend/tests/test_baseline_command_chain_contract.py`

195. Release-Gate Fixture Hold Profile
- Extended release-gate fixture generator with profile support:
  - `--profile pass`
  - `--profile hold`
- Added blocked-release fixture payload coverage with expected failed checks and schema sample shortfall.
- Path:
  - `backend/scripts/generate_connector_release_gate_artifact_fixture.py`
  - `backend/tests/test_connector_release_gate_artifact_fixture_unittest.py`

196. Release-Gate Artifact Fixture Verification Wrapper
- Added wrapper command to generate + validate both pass and hold release-gate artifacts.
- Added npm command:
  - `verify:release-gate:artifact:fixtures`
- Added package script contract coverage for fixture wrapper command and CI chain inclusion.
- Path:
  - `backend/scripts/run_release_gate_artifact_fixture_checks.sh`
  - `package.json`
  - `backend/tests/test_baseline_command_chain_contract.py`

197. SLO Traceability Audit Telemetry Emission
- Added SLO-gate evaluation audit telemetry event emission:
  - `integrations_traceability_status_evaluated`
- Captures request correlation and traceability readiness fields:
  - decision, event count, alert count
  - schema gate pass states
  - signoff status + approval/evidence counts
  - traceability readiness bool
- Persisted sanitized audit event in integration telemetry store.
- Path:
  - `backend/routes/real_integrations.py`
  - `backend/tests/test_integration_http_contract.py`
  - `backend/tests/test_integration_telemetry_summary.py`

198. Prevent SLO Self-Influence from Audit Events
- Excluded existing traceability-audit events from SLO denominator and schema sample calculations.
- Added HTTP + unit coverage to ensure event counts remain based on customer-facing integration telemetry only.
- Path:
  - `backend/routes/real_integrations.py`
  - `backend/tests/test_integration_http_contract.py`
  - `backend/tests/test_integration_telemetry_summary.py`

199. Baseline Chain + Metrics Include Release Artifact Contract
- Added `verify:release-gate:artifact:contract` into `verify:baseline` command order.
- Added baseline metrics step entry:
  - `verify_release_gate_artifact_contract`
- Updated baseline command contract + baseline metrics tooling contract expectations.
- Path:
  - `package.json`
  - `backend/scripts/collect_baseline_metrics.py`
  - `backend/tests/test_baseline_command_chain_contract.py`
  - `backend/tests/test_baseline_metrics_tooling_unittest.py`

200. Docs-Wide Workspace Path Normalization Contract
- Expanded stale-path contract checks from runbooks-only to:
  - `docs/**/*.md`
  - `DEV_SETUP.md`
- Prevents reintroduction of obsolete `EngageAI2-main` workspace path in operational docs.
- Path:
  - `backend/tests/test_runbook_path_normalization_contract.py`

201. Release-Gate Fixture Validation-Fail Profile
- Extended release-gate artifact fixture generator profile support:
  - `--profile validation-fail`
- Added deterministic blocked-release fixture behavior where:
  - `decision = PROCEED`
  - `checks.validationPassed = false`
  - `approved = false`
- Added fixture unit assertions for validation-fail profile shape.
- Path:
  - `backend/scripts/generate_connector_release_gate_artifact_fixture.py`
  - `backend/tests/test_connector_release_gate_artifact_fixture_unittest.py`

202. Release-Gate Fixture Verification Wrapper Expansion
- Expanded fixture verification wrapper to generate and validate:
  - `connector_release_gate_result.json` (`pass`)
  - `connector_release_gate_result_hold.json` (`hold`)
  - `connector_release_gate_result_validation_fail.json` (`validation-fail`)
- Path:
  - `backend/scripts/run_release_gate_artifact_fixture_checks.sh`

203. Traceability Audit Aggregation in Telemetry Summary
- Extended integration telemetry summary API payload with:
  - `traceabilityAudit.eventCount`
  - `traceabilityAudit.decisionCounts`
  - `traceabilityAudit.readyCount`
  - `traceabilityAudit.notReadyCount`
  - `traceabilityAudit.latestEvaluatedAt`
- Extended `recentEvents` rows with:
  - `traceabilityDecision`
  - `traceabilityReady`
- Added HTTP + summary contract coverage.
- Path:
  - `backend/routes/real_integrations.py`
  - `backend/tests/test_integration_telemetry_summary.py`
  - `backend/tests/test_integration_http_contract.py`

204. Integrations UI Traceability Audit Visibility
- Added traceability-audit telemetry cards in Integrations UI:
  - audit event totals
  - ready/not-ready counts
  - decision breakdown
  - latest traceability evaluation timestamp
- Added recent-event row traceability marker for correlated audit events.
- Added frontend test coverage for new telemetry rendering.
- Path:
  - `frontend/src/pages/Integrations.tsx`
  - `frontend/src/pages/Integrations.test.tsx`

205. Runbook + Baseline Metrics Contract Expansion
- Extended integrations reliability runbook with:
  - traceability-audit summary field guidance
  - traceability decision correlation field guidance
  - fixture artifact inventory (`hold`, `validation-fail`)
  - traceability audit telemetry snapshot retention guidance (`>=30 days`)
- Extended runbook contract tests for the new guidance.
- Extended baseline metrics artifact with `releaseGateFixtures` profile status metadata:
  - per-profile availability, decision, approval, validation status, failed checks
- Extended baseline metrics artifact validator contract and unit tests.
- Path:
  - `docs/runbooks/INTEGRATIONS_RELIABILITY_RUNBOOK.md`
  - `backend/tests/test_integrations_reliability_runbook_contract.py`
  - `backend/scripts/collect_baseline_metrics.py`
  - `backend/scripts/validate_baseline_metrics_artifact.py`
  - `backend/tests/test_baseline_metrics_tooling_unittest.py`
  - `backend/tests/test_baseline_metrics_artifact_contract_unittest.py`

206. Telemetry Snapshot Fixture Generator
- Added deterministic telemetry summary fixture generator for traceability contract validation.
- Fixture includes:
  - `traceabilityAudit` counts/decision breakdown
  - `recentEvents` traceability correlation fields
- Added unit tests for payload shape and file output.
- Path:
  - `backend/scripts/generate_connector_telemetry_snapshot_fixture.py`
  - `backend/tests/test_connector_telemetry_snapshot_fixture_unittest.py`

207. Telemetry Snapshot Contract Validator
- Added snapshot validator script for telemetry exports with traceability requirements:
  - required top-level telemetry summary keys
  - required `traceabilityAudit` keys and integer counts
  - required traceability recent-event markers (`requestId`, `traceabilityDecision`, `traceabilityReady`)
- Added unit tests for pass/fail paths.
- Path:
  - `backend/scripts/validate_connector_telemetry_snapshot.py`
  - `backend/tests/test_connector_telemetry_snapshot_contract_unittest.py`

208. Traceability Snapshot Retention Validator
- Added retention policy validator for telemetry snapshot artifacts:
  - minimum snapshot count
  - newest snapshot max-age threshold
  - `generatedAt` timestamp parsing and validation
- Added unit tests for recent/missing/stale/missing-directory scenarios.
- Path:
  - `backend/scripts/validate_connector_telemetry_snapshot_retention.py`
  - `backend/tests/test_connector_telemetry_snapshot_retention_unittest.py`

209. Extended CI Chain Includes Traceability Snapshot Gates
- Added npm command chain:
  - `verify:telemetry:traceability:fixture`
  - `verify:telemetry:traceability:contract`
  - `verify:telemetry:traceability:retention`
  - `verify:telemetry:traceability`
- Wired `verify:telemetry:traceability` into `verify:ci:sales:extended`.
- Added package-script contract assertions.
- Path:
  - `package.json`
  - `backend/tests/test_baseline_command_chain_contract.py`

210. Setup + Runbook Contracts for Traceability Snapshot Governance
- Expanded setup and runbook command inventories with telemetry traceability commands and snapshot artifact path guidance.
- Expanded setup/runbook contract tests accordingly.
- Added frontend export-path test assertion that telemetry JSON export payload contains traceability audit contract fields.
- Path:
  - `DEV_SETUP.md`
  - `docs/runbooks/INTEGRATIONS_RELIABILITY_RUNBOOK.md`
  - `backend/tests/test_dev_setup_contract.py`
  - `backend/tests/test_integrations_reliability_runbook_contract.py`
  - `frontend/src/pages/Integrations.test.tsx`

211. Strict Baseline Fixture-Profile Policy Enforcement
- Extended baseline metrics collection steps to include:
  - `verify_release_gate_artifact_fixtures`
- Added strict fixture-profile policy evaluation:
  - `releaseGateFixturePolicy.passed`
  - required/missing profile tracking
- Baseline metrics overall status now fails if required release-gate fixture profiles are missing.
- Baseline metrics artifact validator now enforces:
  - `releaseGateFixtures.allProfilesAvailable=true`
  - `releaseGateFixturePolicy.passed=true`
- Path:
  - `backend/scripts/collect_baseline_metrics.py`
  - `backend/scripts/validate_baseline_metrics_artifact.py`
  - `backend/tests/test_baseline_metrics_tooling_unittest.py`
  - `backend/tests/test_baseline_metrics_artifact_contract_unittest.py`

212. Telemetry Snapshot Cleanup/Rotation Automation
- Added cleanup script for stale telemetry snapshots with safety controls:
  - default dry-run mode
  - explicit `--apply` for deletion
  - `--keep-days` and `--keep-min-count` retention controls
- Added cleanup command:
  - `verify:telemetry:traceability:cleanup:dry-run`
- Added unittest coverage for stale selection, dry-run behavior, apply behavior, and invalid args.
- Path:
  - `backend/scripts/cleanup_connector_telemetry_snapshots.py`
  - `backend/tests/test_cleanup_connector_telemetry_snapshots_unittest.py`
  - `package.json`

213. Snapshot Governance API + Integrations UI Visibility
- Added operator endpoint:
  - `GET /api/integrations/integrations/telemetry/snapshot-governance`
- Endpoint reports:
  - snapshot retention status
  - latest snapshot timestamp and age
  - stale snapshot count
  - release-gate fixture availability/missing profiles
  - actionable alerts and readiness status
- Added frontend API binding and Integrations UI panel for snapshot governance status + refresh controls.
- Added HTTP and frontend test coverage.
- Path:
  - `backend/routes/real_integrations.py`
  - `backend/tests/test_integration_http_contract.py`
  - `frontend/src/lib/api.ts`
  - `frontend/src/lib/api.test.js`
  - `frontend/src/pages/Integrations.tsx`
  - `frontend/src/pages/Integrations.test.tsx`

214. Extended CI Failure-Mode Smoke for Traceability Contracts
- Added dedicated smoke test proving invalid telemetry snapshot payloads fail traceability contract validation.
- Added smoke command:
  - `verify:smoke:traceability-ci-guard`
- Wired smoke guard into extended CI chain.
- Added script-chain contract assertions.
- Path:
  - `backend/tests/test_traceability_ci_failure_smoke.py`
  - `package.json`
  - `backend/tests/test_baseline_command_chain_contract.py`
  - `backend/scripts/run_sales_integrations_tests.sh`

215. Runbook Hardening: Retention Incident Response
- Added `Traceability Snapshot Retention Incident Response` section to integrations reliability runbook.
- Added command-level response flow for `ACTION_REQUIRED` governance status:
  - verify traceability snapshot chain
  - cleanup dry-run
  - re-generate snapshot
  - contract + retention re-validation
  - CI guard smoke
- Expanded runbook/setup contracts to lock incident-response guidance and commands.
- Path:
  - `docs/runbooks/INTEGRATIONS_RELIABILITY_RUNBOOK.md`
  - `DEV_SETUP.md`
  - `backend/tests/test_integrations_reliability_runbook_contract.py`
  - `backend/tests/test_dev_setup_contract.py`

216. Scheduled Cleanup Apply-Mode Policy Guard
- Added cleanup policy evaluator script for unattended apply-mode safety decisions:
  - `ALLOW_APPLY`
  - `SKIP_APPLY`
  - `ACTION_REQUIRED` (non-zero exit)
- Added policy command:
  - `verify:telemetry:traceability:cleanup:policy`
- Added unittest coverage for allow/skip/action-required/invalid-policy paths.
- Path:
  - `backend/scripts/evaluate_connector_telemetry_cleanup_policy.py`
  - `backend/tests/test_connector_telemetry_cleanup_policy_unittest.py`
  - `package.json`

217. Baseline Governance Audit Telemetry Emission
- Added structured audit event emission for baseline governance evaluations:
  - event type `integrations_traceability_baseline_governance_evaluated`
  - request-id propagation + persisted telemetry payload
- Included baseline governance events in internal traceability-event exclusion for SLO denominator calculations.
- Added HTTP contract coverage for event persistence.
- Path:
  - `backend/routes/real_integrations.py`
  - `backend/tests/test_integration_http_contract.py`

218. Integrations UI Baseline Governance Consumer
- Added frontend API binding:
  - `getIntegrationsBaselineGovernance()`
- Added Integrations UI baseline governance panel for:
  - fixture policy status
  - baseline artifact status/metadata
  - profile availability counts
- Added frontend rendering + API contract tests.
- Path:
  - `frontend/src/lib/api.ts`
  - `frontend/src/lib/api.test.js`
  - `frontend/src/pages/Integrations.tsx`
  - `frontend/src/pages/Integrations.test.tsx`

219. Governance JSON Export Actions (Snapshot + Baseline)
- Added Integrations UI export actions:
  - `Export Snapshot Governance JSON`
  - `Export Baseline Governance JSON`
- Added interaction-level tests validating export payload shape and notice feedback.
- Path:
  - `frontend/src/pages/Integrations.tsx`
  - `frontend/src/pages/Integrations.test.tsx`

220. ACTION_REQUIRED Governance Handoff Smoke + CI Gate
- Added dedicated smoke test for rollout-blocking handoff behavior when snapshot governance is `ACTION_REQUIRED`.
- Added smoke command:
  - `verify:smoke:traceability-governance-handoff`
- Wired cleanup policy + governance handoff smoke into extended CI chain and command-chain contract assertions.
- Expanded setup/runbook command inventories and contract checks for the new governance commands.
- Path:
  - `backend/tests/test_traceability_governance_handoff_smoke.py`
  - `backend/tests/test_traceability_ci_failure_smoke.py`
  - `backend/tests/test_baseline_command_chain_contract.py`
  - `backend/tests/test_dev_setup_contract.py`
  - `backend/tests/test_integrations_reliability_runbook_contract.py`
  - `backend/scripts/run_sales_integrations_tests.sh`
  - `package.json`
  - `DEV_SETUP.md`
  - `docs/runbooks/INTEGRATIONS_RELIABILITY_RUNBOOK.md`

## Verification Targets
- Python unit tests: `backend/tests/test_sales_intelligence_backlog.py`
- Type checks/build:
  - `npm run lint`
  - `npm run check`
  - `npm run build`
- Baseline verification suite:
  - `npm run verify:baseline`
  - `npm run verify:baseline:metrics`
  - `npm run verify:baseline:metrics:contract`
  - `npm run verify:backend:sales:connectors:runtime`
  - `npm run verify:frontend:sales`
  - `npm run verify:frontend:sales:intelligence`
  - `npm run verify:docs:sales:runbook`
  - `npm run verify:docs:sales:connectors`
  - `npm run verify:docs:sales:predictive`
  - `npm run verify:docs:sales`
  - `npm run verify:smoke:canary-dry-run`
  - `npm run verify:smoke:release-gate`
  - `npm run verify:smoke:sales-dashboard`

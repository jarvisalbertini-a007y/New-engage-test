from routes.sales_intelligence import (
    build_campaign_performance,
    build_campaign_portfolio,
    build_phrase_channel_summary,
    build_prediction_performance,
    build_prediction_performance_report,
    build_response_prediction,
    build_conversation_intelligence,
    build_multi_channel_health,
    build_pipeline_forecast,
    build_phrase_effectiveness,
    build_relationship_map,
    normalize_feedback_outcome,
    normalize_channel,
)


def test_pipeline_forecast_returns_confidence_and_projection():
    prospects = [
        {"id": "p1", "leadScore": 82, "companySize": 300, "title": "VP Sales"},
        {"id": "p2", "leadScore": 46, "companySize": 80, "title": "Director"},
        {"id": "p3", "leadPriority": "warm", "companySize": 1500, "title": "CTO"},
    ]
    outcomes = [
        {"outcome": "won", "scoreAtOutcome": 83},
        {"outcome": "won", "scoreAtOutcome": 74},
        {"outcome": "lost", "scoreAtOutcome": 51},
    ]

    forecast = build_pipeline_forecast(prospects, outcomes, window_days=90)

    assert forecast["openPipelineValue"] > 0
    assert forecast["weightedPipelineValue"] > 0
    assert forecast["projectedWonValue"] > 0
    assert forecast["historicalWinRate"] > 0
    assert forecast["confidenceInterval"]["high"] > forecast["confidenceInterval"]["low"]
    assert forecast["confidenceIntervalWidth"] > 0
    assert forecast["confidenceIntervalWidthPct"] > 0
    assert forecast["forecastReliabilityTier"] in {"low", "medium", "high"}
    assert isinstance(forecast["forecastRecommendation"], str)
    assert forecast["sampleSize"]["openProspects"] == 3
    assert forecast["sampleSize"]["closedOutcomes"] == 3


def test_pipeline_forecast_low_reliability_when_history_is_sparse():
    prospects = [
        {"id": "p1", "leadScore": 80, "companySize": 300, "title": "VP Sales"},
    ]
    outcomes = [
        {"outcome": "won", "scoreAtOutcome": 81},
    ]

    forecast = build_pipeline_forecast(prospects, outcomes, window_days=90)

    assert forecast["sampleSize"]["closedOutcomes"] == 1
    assert forecast["forecastReliabilityTier"] == "low"
    assert "Collect additional closed-outcome evidence" in forecast["forecastRecommendation"]


def test_conversation_intelligence_detects_sentiment_and_objections():
    records = [
        {"text": "Great call. We are interested and can move fast.", "channel": "chat"},
        {"text": "This is too expensive and outside budget for this quarter.", "channel": "email"},
        {"text": "Not the right person, our manager owns this decision.", "channel": "linkedin"},
    ]

    intelligence = build_conversation_intelligence(records)

    assert intelligence["totals"]["records"] == 3
    assert intelligence["sentiment"]["positive"] >= 1
    assert intelligence["sentiment"]["negative"] >= 1
    objection_types = [item["type"] for item in intelligence["topObjections"]]
    assert "budget" in objection_types
    assert "authority" in objection_types


def test_multi_channel_health_scores_coverage():
    campaigns = [
        {"channels": ["email", "linkedin"], "status": "active"},
        {"channels": ["phone"], "status": "draft"},
    ]
    ab_tests = [
        {"testType": "channel", "channelA": "email", "channelB": "sms"},
    ]
    prospects = [
        {"preferredChannel": "linkedin"},
        {"preferredChannel": "call"},
    ]

    health = build_multi_channel_health(campaigns, ab_tests, prospects)

    assert "email" in health["activeChannels"]
    assert "linkedin" in health["activeChannels"]
    assert health["coverageScore"] >= 75
    assert health["coverageReliabilityTier"] == "high"
    assert isinstance(health["coverageRecommendation"], str)
    assert isinstance(health["recommendations"], list)


def test_campaign_performance_computes_rates_and_quality():
    campaign = {
        "id": "c1",
        "name": "Q2 Outbound",
        "status": "active",
        "channels": ["email", "linkedin"],
        "metrics": {
            "email": {"sent": 100, "opened": 38, "replied": 12},
            "linkedin": {"sent": 40, "opened": 18, "replied": 4},
        },
        "updatedAt": "2026-02-22T10:00:00+00:00",
    }
    summary = build_campaign_performance(campaign)
    assert summary["totals"]["sent"] == 140
    assert summary["totals"]["opened"] == 56
    assert summary["totals"]["replied"] == 16
    assert summary["overall"]["openRate"] == 0.4
    assert summary["overall"]["replyRate"] == round(16 / 140, 4)
    assert summary["overall"]["qualityTier"] in {"watch", "strong"}
    assert len(summary["byChannel"]) == 2
    assert summary["channelCount"] == 2
    assert summary["displayedChannelCount"] == 2
    assert summary["channelsTruncated"] is False


def test_campaign_performance_applies_channel_limit_and_marks_truncation():
    campaign = {
        "id": "c1",
        "name": "Q2 Outbound",
        "status": "active",
        "channels": ["email", "linkedin", "phone"],
        "metrics": {
            "email": {"sent": 100, "opened": 38, "replied": 12},
            "linkedin": {"sent": 40, "opened": 18, "replied": 4},
            "phone": {"sent": 10, "opened": 4, "replied": 1},
        },
        "updatedAt": "2026-02-22T10:00:00+00:00",
    }
    summary = build_campaign_performance(campaign, channel_limit=2)
    assert summary["channelCount"] == 3
    assert summary["displayedChannelCount"] == 2
    assert summary["appliedChannelLimit"] == 2
    assert summary["channelsTruncated"] is True
    assert [entry["channel"] for entry in summary["byChannel"]] == ["email", "linkedin"]


def test_campaign_portfolio_ranks_by_reply_rate():
    campaigns = [
        {
            "id": "c-low",
            "name": "Low",
            "status": "active",
            "channels": ["email"],
            "metrics": {"email": {"sent": 80, "opened": 20, "replied": 2}},
        },
        {
            "id": "c-high",
            "name": "High",
            "status": "active",
            "channels": ["email"],
            "metrics": {"email": {"sent": 50, "opened": 20, "replied": 10}},
        },
    ]
    portfolio = build_campaign_portfolio(campaigns, top_k=10)
    assert portfolio["campaignCount"] == 2
    assert portfolio["activeCampaignCount"] == 2
    assert portfolio["rankedCampaigns"][0]["campaignId"] == "c-high"
    assert portfolio["portfolioTotals"]["replied"] == 12


def test_relationship_map_builds_nodes_edges():
    prospects = [
        {"id": "p1", "firstName": "Alex", "lastName": "Ng", "companyId": "c1", "leadScore": 78, "engagement": {"opens": 3, "clicks": 2, "replies": 1}},
        {"id": "p2", "firstName": "Jamie", "lastName": "Lopez", "companyId": "c1", "leadScore": 55, "engagement": {"opens": 1, "clicks": 0, "replies": 0}},
    ]
    companies = [{"id": "c1", "name": "Acme Inc"}]

    graph = build_relationship_map(prospects, companies, max_nodes=50)

    assert len(graph["nodes"]) >= 3
    assert len(graph["edges"]) == 2
    assert graph["stats"]["companies"] == 1
    assert graph["stats"]["prospects"] == 2
    assert graph["stats"]["averageRelationshipStrength"] > 0


def test_normalize_channel_aliases():
    assert normalize_channel("linkedin_message") == "linkedin"
    assert normalize_channel("call") == "phone"
    assert normalize_channel("text") == "sms"
    assert normalize_channel("EMAIL") == "email"


def test_phrase_effectiveness_tracks_positive_vs_negative_signals():
    records = [
        {
            "text": "Book a demo this week for Acme platform rollout",
            "eventType": "meeting_booked",
            "channel": "email",
        },
        {
            "text": "Book a demo with our team to review roadmap",
            "eventType": "reply",
            "channel": "email",
        },
        {
            "text": "Too expensive budget pressure this quarter",
            "eventType": "unsubscribe",
            "channel": "email",
        },
    ]

    analytics = build_phrase_effectiveness(records, min_exposure=1, top_k=20)
    assert analytics["summary"]["trackedPhrases"] > 0
    phrases = {item["phrase"]: item for item in analytics["phrases"]}
    assert "book" in phrases
    assert phrases["book"]["effectivenessScore"] > 0


def test_phrase_effectiveness_query_filter():
    records = [
        {"text": "Book a call with finance", "eventType": "reply"},
        {"text": "Book a call with security", "eventType": "reply"},
        {"text": "Need pricing details", "eventType": "open"},
    ]
    filtered = build_phrase_effectiveness(records, min_exposure=1, top_k=10, query="book")
    assert filtered["summary"]["query"] == "book"
    assert all("book" in item["phrase"] for item in filtered["phrases"])


def test_response_prediction_returns_probability_confidence_and_rationale():
    payload = {
        "message": "Hi Alex, can we schedule a 20-minute demo next Tuesday?",
        "channel": "email",
        "sendTime": "2026-02-24T10:00:00+00:00",
        "prospect": {
            "firstName": "Alex",
            "company": "Acme",
            "leadScore": 81,
            "engagement": {"opens": 5, "clicks": 3, "replies": 2},
        },
    }
    recent_events = [
        {"eventType": "reply"},
        {"eventType": "clicked"},
        {"eventType": "open"},
    ]

    prediction = build_response_prediction(payload, recent_events)
    assert 0.05 <= prediction["responseProbability"] <= 0.95
    assert 0.5 <= prediction["confidence"] <= 0.95
    assert prediction["channel"] == "email"
    assert len(prediction["rationale"]) >= 3
    assert len(prediction["recommendedSendWindows"]) >= 1


def test_normalize_feedback_outcome_maps_positive_and_negative():
    positive = normalize_feedback_outcome("meeting booked")
    assert positive["actualLabel"] == 1
    negative = normalize_feedback_outcome("unsubscribed")
    assert negative["actualLabel"] == 0


def test_prediction_performance_returns_calibration_metrics():
    feedback = [
        {"predictedProbability": 0.8, "actualLabel": 1, "channel": "email"},
        {"predictedProbability": 0.7, "actualLabel": 1, "channel": "email"},
        {"predictedProbability": 0.2, "actualLabel": 0, "channel": "linkedin"},
        {"predictedProbability": 0.4, "actualLabel": 0, "channel": "phone"},
    ]
    performance = build_prediction_performance(feedback)
    assert performance["sampleSize"] == 4
    assert 0 <= performance["meanAbsoluteCalibrationError"] <= 1
    assert performance["avgPredictedProbability"] > 0
    assert "email" in performance["byChannel"]
    assert len(performance["confidenceBuckets"]) >= 1


def test_phrase_channel_summary_returns_per_channel_top_phrases():
    records = [
        {"text": "Book a demo this week", "eventType": "reply", "channel": "email"},
        {"text": "Book a demo with finance team", "eventType": "meeting_booked", "channel": "email"},
        {"text": "Connect on linkedin for pricing follow-up", "eventType": "open", "channel": "linkedin"},
    ]
    summary = build_phrase_channel_summary(records, min_exposure=1, top_k=5)
    assert summary["channelCount"] >= 2
    channels = {item["channel"]: item for item in summary["channels"]}
    assert "email" in channels
    assert channels["email"]["trackedPhrases"] > 0


def test_prediction_performance_report_quality_tiers():
    low_sample_perf = {
        "sampleSize": 5,
        "avgPredictedProbability": 0.5,
        "actualPositiveRate": 0.5,
        "meanAbsoluteCalibrationError": 0.12,
    }
    report = build_prediction_performance_report(low_sample_perf)
    assert report["qualityTier"] == "insufficient_data"
    assert report["rolloutDecision"] == "hold"

    strong_perf = {
        "sampleSize": 80,
        "avgPredictedProbability": 0.54,
        "actualPositiveRate": 0.52,
        "meanAbsoluteCalibrationError": 0.14,
    }
    strong_report = build_prediction_performance_report(strong_perf)
    assert strong_report["qualityTier"] == "good"

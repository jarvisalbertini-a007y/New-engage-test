from backend.routes import real_integrations


def test_status_count_posture_classification_server_consistent():
    posture = real_integrations._classify_status_count_provenance_posture(
        "server",
        False,
    )
    assert posture == {
        "posture": "server_consistent",
        "severity": "info",
        "requiresInvestigation": False,
    }


def test_status_count_posture_classification_server_drift():
    posture = real_integrations._classify_status_count_provenance_posture(
        "server",
        True,
    )
    assert posture == {
        "posture": "server_drift",
        "severity": "warning",
        "requiresInvestigation": True,
    }


def test_status_count_posture_classification_local_fallback():
    posture = real_integrations._classify_status_count_provenance_posture(
        "local",
        False,
    )
    assert posture == {
        "posture": "local_fallback",
        "severity": "info",
        "requiresInvestigation": False,
    }


def test_status_count_posture_classification_local_drift():
    posture = real_integrations._classify_status_count_provenance_posture(
        "local",
        True,
    )
    assert posture == {
        "posture": "local_drift",
        "severity": "warning",
        "requiresInvestigation": True,
    }


def test_status_count_posture_classification_unknown_source_falls_back_to_local():
    posture = real_integrations._classify_status_count_provenance_posture(
        "unexpected",
        False,
    )
    assert posture == {
        "posture": "local_fallback",
        "severity": "info",
        "requiresInvestigation": False,
    }

import json
from pathlib import Path

from routes import real_integrations


FIXTURES_DIR = Path(__file__).parent / "fixtures" / "providers"


def _load_fixture(name: str):
    return json.loads((FIXTURES_DIR / name).read_text(encoding="utf-8"))


def _assert_required_keys(record: dict, required_keys: list[str]):
    missing = [key for key in required_keys if key not in record]
    assert not missing, f"Missing keys: {missing}"


def test_apollo_fixture_normalizes_expected_contract():
    payload = _load_fixture("apollo_people_search.json")
    normalized = real_integrations._normalize_apollo_people(payload)
    assert len(normalized) >= 1
    required = [
        "id",
        "firstName",
        "lastName",
        "fullName",
        "title",
        "email",
        "company",
        "companyDomain",
        "linkedinUrl",
        "location",
        "industry",
        "companySize",
        "source",
        "confidence",
    ]
    for row in normalized:
        _assert_required_keys(row, required)
        assert row["source"] == "apollo"


def test_apollo_edge_fixture_normalizes_without_crashing():
    payload = _load_fixture("apollo_people_search_edge.json")
    normalized = real_integrations._normalize_apollo_people(payload)
    assert len(normalized) >= 1
    for row in normalized:
        assert row["source"] == "apollo"
        assert "companyDomain" in row


def test_clearbit_fixture_normalizes_expected_contract():
    payload = _load_fixture("clearbit_company_find.json")
    normalized = real_integrations._normalize_clearbit_company(payload)
    required = [
        "name",
        "domain",
        "description",
        "industry",
        "businessModel",
        "targetMarket",
        "products",
        "companySize",
        "techStack",
        "painPoints",
        "outreachAngle",
        "competitorHints",
        "fundingStage",
        "contactEmail",
        "linkedinUrl",
        "location",
        "source",
    ]
    _assert_required_keys(normalized, required)
    assert normalized["source"] == "clearbit"


def test_clearbit_edge_fixture_normalizes_defaults():
    payload = _load_fixture("clearbit_company_find_edge.json")
    normalized = real_integrations._normalize_clearbit_company(payload)
    assert normalized["source"] == "clearbit"
    assert normalized["domain"] == "partial.example"
    assert isinstance(normalized["products"], list)


def test_crunchbase_fixture_normalizes_expected_contract():
    payload = _load_fixture("crunchbase_organizations_search.json")
    normalized = real_integrations._normalize_crunchbase_search_results(payload)
    assert len(normalized) >= 1
    required = [
        "name",
        "domain",
        "description",
        "industry",
        "businessModel",
        "targetMarket",
        "products",
        "companySize",
        "techStack",
        "painPoints",
        "outreachAngle",
        "competitorHints",
        "fundingStage",
        "contactEmail",
        "linkedinUrl",
        "location",
        "source",
    ]
    for row in normalized:
        _assert_required_keys(row, required)
        assert row["source"] == "crunchbase"


def test_crunchbase_edge_fixture_normalizes_sparse_results():
    payload = _load_fixture("crunchbase_organizations_search_edge.json")
    normalized = real_integrations._normalize_crunchbase_search_results(payload)
    assert len(normalized) >= 1
    names = [row.get("name", "") for row in normalized]
    assert "Nested Sparse" in names
    for row in normalized:
        assert row["source"] == "crunchbase"
        assert "domain" in row

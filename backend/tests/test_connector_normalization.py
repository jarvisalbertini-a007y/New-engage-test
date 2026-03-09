import pytest

from routes import real_integrations


def test_normalize_domain_removes_protocol_and_www():
    assert real_integrations._normalize_domain("https://www.Example.com/path") == "example.com"


def test_normalize_company_size_for_integer_ranges():
    assert real_integrations._normalize_company_size(8) == "1-10"
    assert real_integrations._normalize_company_size(75) == "51-200"
    assert real_integrations._normalize_company_size(1200) == "500+"


def test_normalize_apollo_people_common_payload():
    payload = {
        "people": [
            {
                "id": "p-1",
                "first_name": "Ava",
                "last_name": "Reed",
                "name": "Ava Reed",
                "title": "VP Sales",
                "email": "ava@example.com",
                "linkedin_url": "https://linkedin.com/in/ava-reed",
                "organization": {
                    "name": "Example Inc",
                    "website_url": "https://example.com",
                    "industry": "Software",
                    "estimated_num_employees": 120,
                },
                "city": "Austin, TX",
            }
        ]
    }
    rows = real_integrations._normalize_apollo_people(payload, max_items=5)
    assert len(rows) == 1
    assert rows[0]["company"] == "Example Inc"
    assert rows[0]["companyDomain"] == "example.com"
    assert rows[0]["source"] == "apollo"


def test_normalize_clearbit_company_maps_core_fields():
    payload = {
        "name": "Acme",
        "domain": "acme.com",
        "description": "B2B platform",
        "city": "New York",
        "state": "NY",
        "country": "US",
        "category": {"industry": "SaaS"},
        "metrics": {"employees": 35},
    }
    company = real_integrations._normalize_clearbit_company(payload)
    assert company["name"] == "Acme"
    assert company["domain"] == "acme.com"
    assert company["companySize"] == "11-50"
    assert company["source"] == "clearbit"


def test_normalize_crunchbase_company_maps_core_fields():
    payload = {
        "entity": {
            "properties": {
                "name": "Globex",
                "website_url": "https://globex.com",
                "short_description": "AI sales tooling",
                "category_groups": "Sales Automation",
                "funding_stage": "Series A",
                "city_name": "Boston",
                "country_code": "US",
            }
        }
    }
    company = real_integrations._normalize_crunchbase_company(payload)
    assert company["name"] == "Globex"
    assert company["domain"] == "globex.com"
    assert company["fundingStage"] == "Series A"
    assert company["source"] == "crunchbase"


def test_require_provider_enabled_raises_when_disabled(monkeypatch):
    monkeypatch.setenv("ENABLE_APOLLO_CONNECTOR", "false")
    with pytest.raises(real_integrations.HTTPException) as exc:
        real_integrations._require_provider_enabled("Apollo", "ENABLE_APOLLO_CONNECTOR")
    assert exc.value.status_code == 403

from app.api.readiness_replay import _names


def test_replay_name_extraction_ignores_missing_requirement_names():
    assert _names([
        {"requirement_name": "Safety Certificate"},
        {"requirement_name": None},
        {},
        {"requirement_name": "Insurance"},
    ]) == ["Safety Certificate", "Insurance"]

from app.api.readiness_impact import ReadinessImpactItem


def test_impact_item_contract_is_ranked_and_explicit():
    item = ReadinessImpactItem(
        action_key="provide:req-1",
        action_type="provide_evidence",
        label="Provide Trade License",
        projected_score=100,
        score_delta=40,
        projected_status="ready",
        resolved_requirements=["Trade License"],
        remaining_blockers=[],
        impact_rank=1,
    )
    assert item.projected_status == "ready"
    assert item.score_delta == 40
    assert item.impact_rank == 1

"""
Computes an Overall Athlete Health Score per athlete — combines their average
movement quality score (higher = better) with their average injury risk score
(lower = better) into one number, matching the doc's "Overall athlete health
score" requirement under Risk Scoring Engine. Also aggregates which joints
most frequently show biomechanical deviations across the whole athlete pool,
for the Sports Scientist's biomechanical analytics view.
"""

from ml.feature_engineering import NORMAL_RANGES

HEALTH_WEIGHTS = {"quality": 0.6, "risk": 0.4}


def compute_overall_health(avg_quality: float | None, avg_risk: float | None) -> dict:
    """
    Health score is 0-100, higher = healthier. Quality score contributes
    directly; risk score is inverted (100 - risk) since higher risk should
    pull the health score down.
    """
    quality_component = avg_quality if avg_quality is not None else 50.0
    risk_component = (100 - avg_risk) if avg_risk is not None else 50.0

    health_score = round(
        quality_component * HEALTH_WEIGHTS["quality"] + risk_component * HEALTH_WEIGHTS["risk"], 1
    )

    if health_score >= 80:
        category = "excellent"
    elif health_score >= 60:
        category = "good"
    elif health_score >= 40:
        category = "at_risk"
    else:
        category = "critical"

    return {"health_score": health_score, "health_category": category}


def flag_joint_deviations(joint_summary: dict) -> set[str]:
    """Returns the set of joint names whose min/max angle fell outside the
    normal reference range for this single video's analysis."""
    flagged = set()
    for joint, (lo, hi) in NORMAL_RANGES.items():
        data = joint_summary.get(joint)
        if not data:
            continue
        if data["min"] < lo or data["max"] > hi:
            flagged.add(joint)
    return flagged
"""
Computes a Movement Quality Score (0-100) from the biomechanics analysis.

Important honesty note: this is a HEURISTIC score based on symmetry and data
completeness — it is NOT the full ML-based Injury Risk Score described in the
project doc (that needs historical injury data + trained models, which is
Milestone 3's job). Think of this as "how complete and balanced was the
movement", not yet "how likely is an ACL tear". Say this plainly if a mentor
asks how the score is calculated.
"""

def compute_quality_score(biomechanics_analysis: dict, pose_detection_rate: float) -> dict:
    joint_summary = biomechanics_analysis.get("joint_summary", {})
    symmetry = biomechanics_analysis.get("symmetry", {})

    # 1. Symmetry component: average symmetry_score across all left/right pairs found
    if symmetry:
        symmetry_scores = [s["symmetry_score"] for s in symmetry.values()]
        symmetry_component = sum(symmetry_scores) / len(symmetry_scores)
    else:
        symmetry_component = 50  # neutral if no symmetry pairs were measurable

    # 2. Completeness: how much of the video had a person detected at all
    completeness_component = pose_detection_rate * 100

    # 3. Coverage: how many of the expected joints were actually measurable
    expected_joints = 6  # left/right knee, hip, elbow
    coverage_component = min(len(joint_summary) / expected_joints, 1.0) * 100

    quality_score = round(
        symmetry_component * 0.5 +
        completeness_component * 0.3 +
        coverage_component * 0.2,
        1
    )

    if quality_score >= 85:
        risk_category = "low"
    elif quality_score >= 65:
        risk_category = "moderate"
    elif quality_score >= 45:
        risk_category = "high"
    else:
        risk_category = "critical"

    return {
        "quality_score": quality_score,
        "risk_category": risk_category,
        "components": {
            "symmetry_component": round(symmetry_component, 1),
            "completeness_component": round(completeness_component, 1),
            "coverage_component": round(coverage_component, 1),
        },
    }


def generate_recommendations(biomechanics_analysis: dict) -> list[str]:
    """
    Rule-based recommendations from symmetry gaps only, for now. Matching
    specific injury types (ACL, hamstring, etc.) needs the trained risk
    model from Milestone 3 — this is a reasonable placeholder until then.
    """
    symmetry = biomechanics_analysis.get("symmetry", {})
    recommendations = []
    SYMMETRY_THRESHOLD = 85

    label_map = {
        "knee": "Single-leg squats and step-downs to correct knee flexion imbalance",
        "hip": "Hip abductor and glute strengthening to correct hip movement imbalance",
        "elbow": "Unilateral upper-body mobility work to correct elbow movement imbalance",
    }

    for joint_label, data in symmetry.items():
        if data["symmetry_score"] < SYMMETRY_THRESHOLD:
            side = "left" if data["left_avg"] < data["right_avg"] else "right"
            recommendations.append(
                f"{joint_label.capitalize()} asymmetry detected ({side} side lower range) — "
                f"{label_map.get(joint_label, 'targeted mobility work recommended')}"
            )

    if not recommendations:
        recommendations.append("No significant asymmetry detected — movement pattern looks balanced")

    return recommendations
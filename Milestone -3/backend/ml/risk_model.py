"""
Applies the Weighted Scoring Model from the project doc:
  Injury Risk Score = Biomechanical Deviations (35%) + Historical Injury Factors (20%)
                     + Movement Asymmetry (20%) + Training Load Indicators (15%)
                     + Fatigue Indicators (10%)
"""

WEIGHTS = {
    "biomechanical_deviation": 0.35,
    "historical_injury": 0.20,
    "movement_asymmetry": 0.20,
    "training_load": 0.15,
    "fatigue": 0.10,
}


def compute_risk_score(features: dict) -> dict:
    weighted_total = sum(features[key]["score"] * weight for key, weight in WEIGHTS.items())
    risk_score = round(weighted_total, 1)

    if risk_score < 30:
        risk_category = "low"
    elif risk_score < 55:
        risk_category = "moderate"
    elif risk_score < 75:
        risk_category = "high"
    else:
        risk_category = "critical"

    return {
        "risk_score": risk_score,
        "risk_category": risk_category,
        "factor_breakdown": {
            key: {"score": features[key]["score"], "weight": WEIGHTS[key], "contribution": round(features[key]["score"] * WEIGHTS[key], 1)}
            for key in WEIGHTS
        },
    }


def predict_injury_type(features: dict) -> str:
    """
    Maps the strongest contributing signal to a specific injury category.
    This is rule-based pattern matching, not a trained classifier — see
    feature_engineering.py docstring for why.
    """
    biomech_flags = features["biomechanical_deviation"].get("flags", [])
    history_labels = features["historical_injury"].get("matched_labels", [])

    flag_text = " ".join(biomech_flags).lower()

    if "knee" in flag_text or "ACL" in history_labels or "Knee" in history_labels:
        return "ACL Injury Risk"
    if "trunk lean" in flag_text or "Lower Back" in history_labels:
        return "Lower Back Injury Risk"
    if "Ankle" in history_labels:
        return "Ankle Sprain Risk"
    if "Hamstring" in history_labels:
        return "Hamstring Injury Risk"
    if "Shoulder" in history_labels:
        return "Shoulder Injury Risk"
    if features["training_load"]["score"] > 70 and features["fatigue"]["score"] > 50:
        return "Overuse Injury Risk"

    return "General Injury Risk"


def generate_risk_explanation(features: dict, injury_type: str) -> list[str]:
    """Human-readable reasons behind the score, for the frontend report."""
    reasons = []

    biomech = features["biomechanical_deviation"]
    if biomech["score"] > 0:
        reasons.extend(biomech["flags"])

    if features["movement_asymmetry"]["score"] > 15:
        reasons.append(f"Left/right movement asymmetry detected ({features['movement_asymmetry']['score']}% deviation)")

    if features["historical_injury"]["matched_labels"]:
        reasons.append(f"Prior injury history noted: {', '.join(features['historical_injury']['matched_labels'])}")

    if features["training_load"]["score"] >= 90:
        reasons.append("High training load reported — elevated overuse risk")

    if features["fatigue"]["score"] > 40:
        reasons.append("Movement consistency declined later in the clip — possible fatigue effect")

    if not reasons:
        reasons.append("No significant risk factors detected in this analysis")

    return reasons
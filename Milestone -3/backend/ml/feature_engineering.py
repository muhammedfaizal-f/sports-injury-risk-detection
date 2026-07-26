"""
Extracts the five weighted risk factors defined in the project doc's
Weighted Scoring Model:
  Biomechanical Deviations (35%) | Historical Injury Factors (20%)
  Movement Asymmetry (20%) | Training Load Indicators (15%) | Fatigue Indicators (10%)

Each factor is scored 0-100. This is a RULE-BASED system, not a trained ML
model — there's no labeled injury dataset available yet to train a classifier
on. If real labeled data becomes available later, risk_model.py's weighting
logic is where you'd swap in a trained model's prediction instead.
"""

# Expected "normal" min/max angle ranges per joint, in degrees.
# These are reasonable general references, not sport-specific or validated
# against a clinical dataset — flag this if a mentor asks about the source.
NORMAL_RANGES = {
    "left_knee": (60, 140),
    "right_knee": (60, 140),
    "left_hip": (30, 120),
    "right_hip": (30, 120),
    "trunk_lean": (0, 15),
}

INJURY_KEYWORDS = {
    "acl": ("ACL", 80),
    "knee": ("Knee", 60),
    "hamstring": ("Hamstring", 70),
    "ankle": ("Ankle", 60),
    "shoulder": ("Shoulder", 50),
    "back": ("Lower Back", 55),
}

TRAINING_LOAD_SCORES = {"low": 10, "moderate": 50, "high": 90}


def biomechanical_deviation_score(joint_summary: dict) -> tuple[float, list[str]]:
    """Flags joint angles that fall outside expected normal ranges."""
    deviations = []
    flags = []

    for joint, (lo, hi) in NORMAL_RANGES.items():
        if joint not in joint_summary:
            continue
        data = joint_summary[joint]

        if data["min"] < lo:
            deviations.append(min(100, (lo - data["min"]) / lo * 100))
            flags.append(
                f"{joint.replace('_', ' ')} minimum angle ({data['min']}°) below expected "
                f"range (>{lo}°) — possible excessive flexion/collapse"
            )

        if data["max"] > hi:
            deviations.append(min(100, (data["max"] - hi) / hi * 100))
            flags.append(
                f"{joint.replace('_', ' ')} maximum angle ({data['max']}°) above expected "
                f"range (<{hi}°)"
            )

    score = round(sum(deviations) / len(deviations), 1) if deviations else 0.0
    return score, flags


def movement_asymmetry_score(symmetry: dict) -> float:
    """Inverse of the symmetry scores already computed in Milestone 2 —
    higher asymmetry (lower symmetry_score) means higher risk contribution."""
    if not symmetry:
        return 0.0
    diffs = [100 - s["symmetry_score"] for s in symmetry.values()]
    return round(sum(diffs) / len(diffs), 1)


def historical_injury_score(injury_history: str | None) -> tuple[float, list[str]]:
    """Simple keyword match against the athlete's self-reported injury history text."""
    if not injury_history:
        return 0.0, []

    text = injury_history.lower()
    matched_labels = []
    max_score = 0.0

    for keyword, (label, score) in INJURY_KEYWORDS.items():
        if keyword in text:
            matched_labels.append(label)
            max_score = max(max_score, score)

    return max_score, matched_labels


def training_load_score(training_load: str | None) -> float:
    if not training_load:
        return 30.0  # neutral default when unknown
    return TRAINING_LOAD_SCORES.get(training_load.strip().lower(), 30.0)


def fatigue_score(keypoints_json: list[dict]) -> float:
    """
    Proxy fatigue indicator: compares movement variability in the first half
    vs. second half of the clip. Increasing variability later in the clip can
    indicate form breakdown from fatigue. This is a simple heuristic — not a
    validated fatigue biomarker — and works best on longer clips.
    """
    if len(keypoints_json) < 6:
        return 0.0

    mid = len(keypoints_json) // 2
    first_half, second_half = keypoints_json[:mid], keypoints_json[mid:]

    def variability(frames):
        ys = [f["joints"]["LEFT_KNEE"]["y"] for f in frames if "LEFT_KNEE" in f["joints"]]
        if len(ys) < 2:
            return 0.0
        mean_y = sum(ys) / len(ys)
        return sum((y - mean_y) ** 2 for y in ys) / len(ys)

    v1, v2 = variability(first_half), variability(second_half)
    if v1 == 0:
        return 0.0

    increase = max(0.0, (v2 - v1) / v1 * 100)
    return round(min(increase, 100), 1)


def extract_risk_features(biomechanics_analysis: dict, keypoints_json: list[dict], athlete) -> dict:
    """Combines all five weighted factors into one feature dict."""
    joint_summary = biomechanics_analysis.get("joint_summary", {})
    symmetry = biomechanics_analysis.get("symmetry", {})

    biomech_score, biomech_flags = biomechanical_deviation_score(joint_summary)
    asymmetry_score = movement_asymmetry_score(symmetry)
    history_score, history_labels = historical_injury_score(athlete.injury_history)
    load_score = training_load_score(athlete.training_load)
    fatigue = fatigue_score(keypoints_json)

    return {
        "biomechanical_deviation": {"score": biomech_score, "flags": biomech_flags},
        "movement_asymmetry": {"score": asymmetry_score},
        "historical_injury": {"score": history_score, "matched_labels": history_labels},
        "training_load": {"score": load_score},
        "fatigue": {"score": fatigue},
    }
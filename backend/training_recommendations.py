"""
Rule-based training modification suggestions for coaches. Unlike the physio's
exercise library (which reacts to movement recommendations), this reacts to
the athlete's RISK PREDICTION — injury type, risk category, training load,
and symmetry — to suggest how a coach should adjust training to reduce
injury risk going forward. Rule-based, same honesty caveat as the risk
model itself: not a trained ML recommender.
"""

INJURY_TYPE_SUGGESTIONS = {
    "ACL Injury Risk": [
        "Reduce high-intensity cutting/pivoting drills for 1-2 sessions",
        "Add landing mechanics coaching cues (soft knees, hip-dominant landing) before plyometric work",
        "Prioritize single-leg strength work in warm-ups this week",
    ],
    "Hamstring Injury Risk": [
        "Cap sprint volume and avoid max-velocity sprints until symmetry improves",
        "Add eccentric hamstring loading (e.g. Nordic curls) to strength sessions",
        "Ensure adequate warm-up time before any sprint-based drills",
    ],
    "Ankle Sprain Risk": [
        "Review training surface — avoid uneven ground drills this week",
        "Add proprioceptive/balance work to warm-up routine",
        "Consider ankle taping/bracing during high-cutting drills",
    ],
    "Shoulder Injury Risk": [
        "Reduce overhead throwing/serving volume temporarily",
        "Add rotator cuff activation work before throwing sessions",
    ],
    "Lower Back Injury Risk": [
        "Review lifting technique in strength sessions — check trunk control under load",
        "Add core stability work (dead bug, bird dog) to daily warm-up",
    ],
    "Overuse Injury Risk": [
        "Reduce total weekly training volume by 10-20% for this athlete",
        "Add a full rest or active-recovery day this week",
    ],
    "General Injury Risk": [
        "Monitor this athlete's technique closely in the next session",
        "No specific injury pattern flagged — standard training can continue with normal monitoring",
    ],
}

RISK_CATEGORY_NOTES = {
    "critical": "Recommend a movement re-assessment before returning to full training load.",
    "high": "Reduce training intensity this week and re-check after their next analyzed session.",
    "moderate": "Monitor closely — no major changes needed yet, but flag for next check-in.",
    "low": "No training modification needed based on current data.",
}

TRAINING_LOAD_NOTES = {
    "High": "Current training load is already high — this is a contributing risk factor worth reviewing.",
    "Moderate": "Training load is moderate — likely not the primary risk driver here.",
    "Low": "Training load is low — risk is likely driven by technique or biomechanics, not overtraining.",
}


def build_training_suggestions(injury_type: str, risk_category: str, training_load: str | None) -> dict:
    suggestions = list(INJURY_TYPE_SUGGESTIONS.get(injury_type, INJURY_TYPE_SUGGESTIONS["General Injury Risk"]))

    risk_note = RISK_CATEGORY_NOTES.get(risk_category, "")
    load_note = TRAINING_LOAD_NOTES.get(training_load, "Training load not recorded for this athlete.")

    return {
        "injury_type": injury_type,
        "risk_category": risk_category,
        "suggestions": suggestions,
        "risk_note": risk_note,
        "load_note": load_note,
    }
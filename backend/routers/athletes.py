from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db

from models import Athlete, User, UserRole, Video, QualityReport, RiskPrediction, BiomechanicsResult
from schemas import AthleteCreate, AthleteUpdate, AthleteOut, ProgressPoint
from dependencies import get_current_user
from training_recommendations import build_training_suggestions
from exercise_library import suggest_exercises
from health_index import compute_overall_health, flag_joint_deviations

router = APIRouter(prefix="/athletes", tags=["athletes"])


@router.post("/me", response_model=AthleteOut)
def create_my_profile(
    data: AthleteCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != UserRole.athlete:
        raise HTTPException(status_code=403, detail="Only athletes can create an athlete profile")

    existing = db.query(Athlete).filter(Athlete.user_id == current_user.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Profile already exists, use PUT to update")

    profile = Athlete(user_id=current_user.id, **data.model_dump())
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@router.get("/me", response_model=AthleteOut)
def get_my_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = db.query(Athlete).filter(Athlete.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found, create one first")
    return profile

@router.get("/me/training-guidance")
def my_training_guidance(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Same logic a coach would see for this athlete — now self-served."""
    if current_user.role != UserRole.athlete:
        raise HTTPException(status_code=403, detail="Only athletes can view their own training guidance")

    athlete = db.query(Athlete).filter(Athlete.user_id == current_user.id).first()
    if not athlete:
        raise HTTPException(status_code=404, detail="Create your athlete profile first")

    videos = db.query(Video).filter(Video.athlete_id == athlete.id).order_by(Video.id.desc()).all()
    video_ids = [v.id for v in videos]

    latest_risk = (
        db.query(RiskPrediction)
        .filter(RiskPrediction.video_id.in_(video_ids))
        .order_by(RiskPrediction.id.desc())
        .first()
        if video_ids else None
    )

    if not latest_risk:
        return {"has_risk_data": False, "training_suggestions": None}

    suggestions = build_training_suggestions(
        injury_type=latest_risk.injury_type,
        risk_category=latest_risk.risk_category,
        training_load=athlete.training_load,
    )
    return {"has_risk_data": True, "training_suggestions": suggestions}


@router.get("/me/recovery-guidance")
def my_recovery_guidance(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Same logic a physiotherapist would see for this athlete — now self-served."""
    if current_user.role != UserRole.athlete:
        raise HTTPException(status_code=403, detail="Only athletes can view their own recovery guidance")

    athlete = db.query(Athlete).filter(Athlete.user_id == current_user.id).first()
    if not athlete:
        raise HTTPException(status_code=404, detail="Create your athlete profile first")

    videos = db.query(Video).filter(Video.athlete_id == athlete.id).order_by(Video.id.desc()).all()
    video_ids = [v.id for v in videos]

    latest_quality = (
        db.query(QualityReport)
        .filter(QualityReport.video_id.in_(video_ids))
        .order_by(QualityReport.id.desc())
        .first()
        if video_ids else None
    )

    if not latest_quality or not latest_quality.report_json:
        return {"recommendations": [], "suggested_exercises": []}

    recommendations = latest_quality.report_json.get("recommendations", [])
    exercises = suggest_exercises(recommendations)
    return {"recommendations": recommendations, "suggested_exercises": exercises}


@router.get("/me/analytics")
def my_analytics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Same logic a sports scientist would see for this athlete — now self-served."""
    if current_user.role != UserRole.athlete:
        raise HTTPException(status_code=403, detail="Only athletes can view their own analytics")

    athlete = db.query(Athlete).filter(Athlete.user_id == current_user.id).first()
    if not athlete:
        raise HTTPException(status_code=404, detail="Create your athlete profile first")

    videos = db.query(Video).filter(Video.athlete_id == athlete.id).order_by(Video.uploaded_at.asc()).all()
    video_ids = [v.id for v in videos]

    quality_reports = db.query(QualityReport).filter(QualityReport.video_id.in_(video_ids)).all() if video_ids else []
    risk_predictions = db.query(RiskPrediction).filter(RiskPrediction.video_id.in_(video_ids)).all() if video_ids else []
    biomech_results = db.query(BiomechanicsResult).filter(BiomechanicsResult.video_id.in_(video_ids)).all() if video_ids else []

    avg_quality = sum(float(q.quality_score) for q in quality_reports) / len(quality_reports) if quality_reports else None
    avg_risk = sum(float(r.risk_score) for r in risk_predictions) / len(risk_predictions) if risk_predictions else None
    health = compute_overall_health(avg_quality, avg_risk)

    joint_flag_counts = {}
    for result in biomech_results:
        joint_summary = result.analysis_json.get("joint_summary", {})
        for joint in flag_joint_deviations(joint_summary):
            label = joint.replace("_", " ").title()
            joint_flag_counts[label] = joint_flag_counts.get(label, 0) + 1

    risk_trend = [
        {"video_id": r.video_id, "score": float(r.risk_score), "category": r.risk_category}
        for r in sorted(risk_predictions, key=lambda x: x.id)
    ]

    return {
        "avg_quality_score": round(avg_quality, 1) if avg_quality is not None else None,
        "avg_risk_score": round(avg_risk, 1) if avg_risk is not None else None,
        "health_score": health["health_score"],
        "health_category": health["health_category"],
        "videos_analyzed": len(video_ids),
        "risk_trend": risk_trend,
        "joint_deviation_frequency": joint_flag_counts,
    }

@router.put("/me", response_model=AthleteOut)
def update_my_profile(
    data: AthleteUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = db.query(Athlete).filter(Athlete.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found, create one first")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)

    db.commit()
    db.refresh(profile)
    return profile


@router.get("/{athlete_id}", response_model=AthleteOut)
def get_athlete_by_id(
    athlete_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role == UserRole.athlete:
        raise HTTPException(status_code=403, detail="Athletes can only view their own profile via /athletes/me")

    profile = db.query(Athlete).filter(Athlete.id == athlete_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Athlete not found")
    return profile

@router.get("/me/progress", response_model=list[ProgressPoint])
def get_my_progress(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != UserRole.athlete:
        raise HTTPException(status_code=403, detail="Only athletes have a progress trend")

    athlete = db.query(Athlete).filter(Athlete.user_id == current_user.id).first()
    if not athlete:
        raise HTTPException(status_code=404, detail="Create your athlete profile first")

    videos = (
        db.query(Video)
        .filter(Video.athlete_id == athlete.id)
        .order_by(Video.uploaded_at.asc())
        .all()
    )

    points = []
    for video in videos:
        quality = (
            db.query(QualityReport)
            .filter(QualityReport.video_id == video.id)
            .order_by(QualityReport.id.desc())
            .first()
        )
        risk = (
            db.query(RiskPrediction)
            .filter(RiskPrediction.video_id == video.id)
            .order_by(RiskPrediction.id.desc())
            .first()
        )

        # Skip videos with neither score — they haven't reached analysis yet,
        # and including them would just show flat gaps in the trend line.
        if not quality and not risk:
            continue

        points.append(ProgressPoint(
            video_id=video.id,
            date=video.uploaded_at.strftime("%Y-%m-%d"),
            quality_score=float(quality.quality_score) if quality else None,
            risk_score=float(risk.risk_score) if risk else None,
            risk_category=risk.risk_category if risk else None,
        ))

    return points
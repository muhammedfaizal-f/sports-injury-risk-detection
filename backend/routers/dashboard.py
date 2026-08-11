from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import User, UserRole, Athlete, CoachAthlete, Video, QualityReport, RiskPrediction, RecoveryPlan
from schemas import (
    LinkAthleteRequest, AthleteRiskSummary,
    RecoveryPlanCreate, RecoveryPlanUpdate, RecoveryPlanOut,
)
from dependencies import get_current_user, require_role
from exercise_library import suggest_exercises

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _athlete_risk_summary(athlete: Athlete, db: Session) -> AthleteRiskSummary:
    videos = db.query(Video).filter(Video.athlete_id == athlete.id).order_by(Video.uploaded_at.asc()).all()
    analyzed_count = len([v for v in videos if v.status in ("analyzed", "risk_predicted")])

    video_ids = [v.id for v in videos]
    all_risk = (
        db.query(RiskPrediction)
        .filter(RiskPrediction.video_id.in_(video_ids))
        .order_by(RiskPrediction.id.asc())
        .all()
        if video_ids else []
    )

    latest_risk = all_risk[-1] if all_risk else None

    # Trend: compare the most recent score against the one before it
    trend = "flat"
    if len(all_risk) >= 2:
        prev_score = float(all_risk[-2].risk_score)
        curr_score = float(all_risk[-1].risk_score)
        if curr_score - prev_score > 3:
            trend = "up"       # risk going up = bad
        elif curr_score - prev_score < -3:
            trend = "down"     # risk going down = good

    return AthleteRiskSummary(
        athlete_id=athlete.id,
        full_name=athlete.user.full_name,
        sport_type=athlete.sport_type,
        latest_risk_score=float(latest_risk.risk_score) if latest_risk else None,
        latest_risk_category=latest_risk.risk_category if latest_risk else None,
        latest_injury_type=latest_risk.injury_type if latest_risk else None,
        videos_analyzed=analyzed_count,
        risk_trend=trend,
        training_load=athlete.training_load,
    )



# ---------- COACH ----------

@router.post("/coach/link-athlete")
def link_athlete(
    data: LinkAthleteRequest,
    current_user: User = Depends(require_role(UserRole.coach)),
    db: Session = Depends(get_db),
):
    athlete = db.query(Athlete).filter(Athlete.id == data.athlete_id).first()
    if not athlete:
        raise HTTPException(status_code=404, detail="Athlete not found")

    existing = db.query(CoachAthlete).filter(
        CoachAthlete.coach_id == current_user.id,
        CoachAthlete.athlete_id == data.athlete_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Athlete already linked to this coach")

    link = CoachAthlete(coach_id=current_user.id, athlete_id=data.athlete_id)
    db.add(link)
    db.commit()
    return {"message": f"Linked athlete {data.athlete_id} to coach"}


@router.get("/coach/team", response_model=list[AthleteRiskSummary])
def coach_team_overview(
    current_user: User = Depends(require_role(UserRole.coach)),
    db: Session = Depends(get_db),
):
    links = db.query(CoachAthlete).filter(CoachAthlete.coach_id == current_user.id).all()
    athlete_ids = [l.athlete_id for l in links]
    athletes = db.query(Athlete).filter(Athlete.id.in_(athlete_ids)).all()
    return [_athlete_risk_summary(a, db) for a in athletes]


@router.get("/coach/athlete/{athlete_id}")
def coach_athlete_detail(
    athlete_id: int,
    current_user: User = Depends(require_role(UserRole.coach)),
    db: Session = Depends(get_db),
):
    link = db.query(CoachAthlete).filter(
        CoachAthlete.coach_id == current_user.id,
        CoachAthlete.athlete_id == athlete_id,
    ).first()
    if not link:
        raise HTTPException(status_code=403, detail="This athlete is not on your team")

    athlete = db.query(Athlete).filter(Athlete.id == athlete_id).first()
    videos = db.query(Video).filter(Video.athlete_id == athlete.id).order_by(Video.uploaded_at.asc()).all()
    video_ids = [v.id for v in videos]

    quality_history = (
        db.query(QualityReport).filter(QualityReport.video_id.in_(video_ids)).order_by(QualityReport.id.asc()).all()
        if video_ids else []
    )
    risk_history = (
        db.query(RiskPrediction).filter(RiskPrediction.video_id.in_(video_ids)).order_by(RiskPrediction.id.asc()).all()
        if video_ids else []
    )

    return {
        "athlete_id": athlete.id,
        "full_name": athlete.user.full_name,
        "sport_type": athlete.sport_type,
        "position": athlete.position,
        "age": athlete.age,
        "training_load": athlete.training_load,
        "injury_history": athlete.injury_history,
        "videos_total": len(videos),
        "quality_history": [{"video_id": q.video_id, "score": float(q.quality_score)} for q in quality_history],
        "risk_history": [
            {"video_id": r.video_id, "score": float(r.risk_score), "category": r.risk_category, "injury_type": r.injury_type}
            for r in risk_history
        ],
    }

# ---------- PHYSIOTHERAPIST ----------

@router.get("/physio/athlete/{athlete_id}")
def physio_athlete_view(
    athlete_id: int,
    current_user: User = Depends(require_role(UserRole.physiotherapist)),
    db: Session = Depends(get_db),
):
    athlete = db.query(Athlete).filter(Athlete.id == athlete_id).first()
    if not athlete:
        raise HTTPException(status_code=404, detail="Athlete not found")

    videos = db.query(Video).filter(Video.athlete_id == athlete.id).order_by(Video.id.desc()).all()
    video_ids = [v.id for v in videos]

    quality_reports = (
        db.query(QualityReport).filter(QualityReport.video_id.in_(video_ids)).all()
        if video_ids else []
    )
    risk_predictions = (
        db.query(RiskPrediction).filter(RiskPrediction.video_id.in_(video_ids)).all()
        if video_ids else []
    )

    return {
        "athlete_id": athlete.id,
        "full_name": athlete.user.full_name,
        "injury_history": athlete.injury_history,
        "training_load": athlete.training_load,
        "videos_total": len(videos),
        "quality_score_trend": [
            {"video_id": q.video_id, "score": float(q.quality_score)} for q in quality_reports
        ],
        "risk_trend": [
            {"video_id": r.video_id, "score": float(r.risk_score), "category": r.risk_category, "injury_type": r.injury_type}
            for r in risk_predictions
        ],
    }

    @router.get("/physio/athlete/{athlete_id}/suggested-exercises")
def suggested_exercises_for_athlete(
    athlete_id: int,
    current_user: User = Depends(require_role(UserRole.physiotherapist)),
    db: Session = Depends(get_db),
):
    athlete = db.query(Athlete).filter(Athlete.id == athlete_id).first()
    if not athlete:
        raise HTTPException(status_code=404, detail="Athlete not found")

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
        return {"athlete_id": athlete.id, "recommendations": [], "suggested_exercises": []}

    recommendations = latest_quality.report_json.get("recommendations", [])
    exercises = suggest_exercises(recommendations)

    return {
        "athlete_id": athlete.id,
        "recommendations": recommendations,
        "suggested_exercises": exercises,
    }


@router.post("/physio/recovery-plan", response_model=RecoveryPlanOut)
def create_recovery_plan(
    data: RecoveryPlanCreate,
    current_user: User = Depends(require_role(UserRole.physiotherapist)),
    db: Session = Depends(get_db),
):
    athlete = db.query(Athlete).filter(Athlete.id == data.athlete_id).first()
    if not athlete:
        raise HTTPException(status_code=404, detail="Athlete not found")

    plan = RecoveryPlan(
        physio_id=current_user.id,
        athlete_id=data.athlete_id,
        exercises_json=data.exercises,
        notes=data.notes,
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


@router.get("/physio/athlete/{athlete_id}/recovery-plans", response_model=list[RecoveryPlanOut])
def list_recovery_plans(
    athlete_id: int,
    current_user: User = Depends(require_role(UserRole.physiotherapist)),
    db: Session = Depends(get_db),
):
    return (
        db.query(RecoveryPlan)
        .filter(RecoveryPlan.athlete_id == athlete_id)
        .order_by(RecoveryPlan.id.desc())
        .all()
    )


@router.put("/physio/recovery-plan/{plan_id}", response_model=RecoveryPlanOut)
def update_recovery_plan_status(
    plan_id: int,
    data: RecoveryPlanUpdate,
    current_user: User = Depends(require_role(UserRole.physiotherapist)),
    db: Session = Depends(get_db),
):
    plan = db.query(RecoveryPlan).filter(RecoveryPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Recovery plan not found")
    if plan.physio_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your recovery plan")

    if data.status not in ("not_started", "in_progress", "completed"):
        raise HTTPException(status_code=400, detail="Invalid status value")

    plan.status = data.status
    db.commit()
    db.refresh(plan)
    return plan


# ---------- SPORTS SCIENTIST ----------

@router.get("/sports-scientist/overview")
def sports_scientist_overview(
    current_user: User = Depends(require_role(UserRole.sports_scientist)),
    db: Session = Depends(get_db),
):
    all_athletes = db.query(Athlete).all()
    all_risk = db.query(RiskPrediction).all()

    risk_by_category = {"low": 0, "moderate": 0, "high": 0, "critical": 0}
    injury_type_counts = {}

    for r in all_risk:
        risk_by_category[r.risk_category] = risk_by_category.get(r.risk_category, 0) + 1
        injury_type_counts[r.injury_type] = injury_type_counts.get(r.injury_type, 0) + 1

    return {
        "total_athletes": len(all_athletes),
        "total_risk_assessments": len(all_risk),
        "risk_distribution": risk_by_category,
        "injury_type_distribution": injury_type_counts,
    }


# ---------- ADMIN ----------

@router.get("/admin/overview")
def admin_overview(
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    role_counts = {}
    for role in UserRole:
        role_counts[role.value] = db.query(User).filter(User.role == role).count()

    total_videos = db.query(Video).count()
    status_counts = {}
    for v in db.query(Video).all():
        status_counts[v.status] = status_counts.get(v.status, 0) + 1

    return {
        "users_by_role": role_counts,
        "total_videos": total_videos,
        "videos_by_status": status_counts,
    }
    

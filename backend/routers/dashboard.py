from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import User, UserRole, Athlete, CoachAthlete, Video, RiskPrediction, QualityReport
from schemas import LinkAthleteRequest, AthleteRiskSummary
from dependencies import get_current_user, require_role

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _athlete_risk_summary(athlete: Athlete, db: Session) -> AthleteRiskSummary:
    videos = db.query(Video).filter(Video.athlete_id == athlete.id).all()
    analyzed_count = len([v for v in videos if v.status in ("analyzed", "risk_predicted")])

    latest_risk = None
    if videos:
        video_ids = [v.id for v in videos]
        latest_risk = (
            db.query(RiskPrediction)
            .filter(RiskPrediction.video_id.in_(video_ids))
            .order_by(RiskPrediction.id.desc())
            .first()
        )

    return AthleteRiskSummary(
        athlete_id=athlete.id,
        full_name=athlete.user.full_name,
        sport_type=athlete.sport_type,
        latest_risk_score=float(latest_risk.risk_score) if latest_risk else None,
        latest_risk_category=latest_risk.risk_category if latest_risk else None,
        latest_injury_type=latest_risk.injury_type if latest_risk else None,
        videos_analyzed=analyzed_count,
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
    
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import User, UserRole, Athlete, CoachAthlete, Video, RiskPrediction, QualityReport
from schemas import LinkAthleteRequest, AthleteRiskSummary
from dependencies import get_current_user, require_role

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _athlete_risk_summary(athlete: Athlete, db: Session) -> AthleteRiskSummary:
    videos = db.query(Video).filter(Video.athlete_id == athlete.id).all()
    analyzed_count = len([v for v in videos if v.status in ("analyzed", "risk_predicted")])

    latest_risk = None
    if videos:
        video_ids = [v.id for v in videos]
        latest_risk = (
            db.query(RiskPrediction)
            .filter(RiskPrediction.video_id.in_(video_ids))
            .order_by(RiskPrediction.id.desc())
            .first()
        )

    return AthleteRiskSummary(
        athlete_id=athlete.id,
        full_name=athlete.user.full_name,
        sport_type=athlete.sport_type,
        latest_risk_score=float(latest_risk.risk_score) if latest_risk else None,
        latest_risk_category=latest_risk.risk_category if latest_risk else None,
        latest_injury_type=latest_risk.injury_type if latest_risk else None,
        videos_analyzed=analyzed_count,
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
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from io import BytesIO
from sqlalchemy.orm import Session
from database import get_db
from models import (
    User, UserRole, Athlete, CoachAthlete, Video, QualityReport, RiskPrediction,
    RecoveryPlan, TrainingPlan, BiomechanicsResult, PoseResult, ActivityLog,
    Organization, OrganizationMember, JoinCode,
)
from schemas import (
    LinkAthleteRequest, AthleteRiskSummary,
    RecoveryPlanCreate, RecoveryPlanUpdate, RecoveryPlanOut,
    TrainingPlanCreate, TrainingPlanUpdate, TrainingPlanOut,
    AdminUserOut, AdminUserUpdate, ActivityLogOut,
)
from dependencies import get_current_user, require_role
from activity_log import log_activity
from exercise_library import suggest_exercises
from training_recommendations import build_training_suggestions
from health_index import compute_overall_health, flag_joint_deviations
from utils.research_report import build_research_report_pdf, build_research_report_excel

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
    log_activity(db, current_user.id, f"Physiotherapist created recovery plan #{plan.id}")
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

@router.get("/physio/athletes/search")
def physio_search_athletes(
    name: str = "",
    current_user: User = Depends(require_role(UserRole.physiotherapist)),
    db: Session = Depends(get_db),
):
    """Search athletes by name — used to populate the name-based lookup instead of raw IDs."""
    query = db.query(Athlete)
    if name:
        query = query.join(User, Athlete.user_id == User.id).filter(User.full_name.ilike(f"%{name}%"))

    athletes = query.limit(10).all()
    return [
        {"athlete_id": a.id, "full_name": a.user.full_name, "sport_type": a.sport_type}
        for a in athletes
    ]


# ---------- ADMIN ----------

@router.get("/admin/overview")
def admin_overview(
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    # Organizations created by this admin
    organization_ids = [
        org.id
        for org in db.query(Organization)
        .filter(Organization.created_by == current_user.id)
        .all()
    ]

    # No organization = completely fresh dashboard
    if not organization_ids:
        return {
            "users_by_role": {
                "athlete": 0,
                "coach": 0,
                "physiotherapist": 0,
                "sports_scientist": 0,
                "admin": 0,
            },
            "total_users": 0,
            "total_videos": 0,
            "videos_by_status": {},
        }

    # Users who joined this admin's organization
    member_user_ids = [
        user_id
        for (user_id,) in db.query(OrganizationMember.user_id)
        .filter(
            OrganizationMember.organization_id.in_(organization_ids)
        )
        .distinct()
        .all()
    ]

    # Count roles
    role_counts = {}

    for role in UserRole:
        role_counts[role.value] = (
            db.query(User)
            .filter(
                User.id.in_(member_user_ids),
                User.role == role,
            )
            .count()
        )

    # Athletes belonging to this organization
    athlete_ids = [
        athlete.id
        for athlete in db.query(Athlete)
        .filter(Athlete.user_id.in_(member_user_ids))
        .all()
    ]

    # Videos belonging to those athletes
    videos = []

    if athlete_ids:
        videos = (
            db.query(Video)
            .filter(Video.athlete_id.in_(athlete_ids))
            .all()
        )

    # Pipeline status
    status_counts = {}

    for video in videos:
        status = video.status or "unknown"
        status_counts[status] = status_counts.get(status, 0) + 1

    return {
        "users_by_role": role_counts,
        "total_users": len(member_user_ids),
        "total_videos": len(videos),
        "videos_by_status": status_counts,
    }
    
@router.get("/coach/athlete/{athlete_id}/suggested-training")
def suggested_training_for_athlete(
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
        return {"athlete_id": athlete.id, "has_risk_data": False, "training_suggestions": None}

    suggestions = build_training_suggestions(
        injury_type=latest_risk.injury_type,
        risk_category=latest_risk.risk_category,
        training_load=athlete.training_load,
    )

    return {"athlete_id": athlete.id, "has_risk_data": True, "training_suggestions": suggestions}


@router.post("/coach/training-plan", response_model=TrainingPlanOut)
def create_training_plan(
    data: TrainingPlanCreate,
    current_user: User = Depends(require_role(UserRole.coach)),
    db: Session = Depends(get_db),
):
    link = db.query(CoachAthlete).filter(
        CoachAthlete.coach_id == current_user.id,
        CoachAthlete.athlete_id == data.athlete_id,
    ).first()
    if not link:
        raise HTTPException(status_code=403, detail="This athlete is not on your team")

    plan = TrainingPlan(
        coach_id=current_user.id,
        athlete_id=data.athlete_id,
        suggestions_json=data.suggestions,
        notes=data.notes,
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    log_activity(db, current_user.id, f"Coach created training plan #{plan.id}")
    return plan


@router.get("/coach/athlete/{athlete_id}/training-plans", response_model=list[TrainingPlanOut])
def list_training_plans(
    athlete_id: int,
    current_user: User = Depends(require_role(UserRole.coach)),
    db: Session = Depends(get_db),
):
    return (
        db.query(TrainingPlan)
        .filter(TrainingPlan.athlete_id == athlete_id, TrainingPlan.coach_id == current_user.id)
        .order_by(TrainingPlan.id.desc())
        .all()
    )


@router.put("/coach/training-plan/{plan_id}", response_model=TrainingPlanOut)
def update_training_plan_status(
    plan_id: int,
    data: TrainingPlanUpdate,
    current_user: User = Depends(require_role(UserRole.coach)),
    db: Session = Depends(get_db),
):
    plan = db.query(TrainingPlan).filter(TrainingPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Training plan not found")
    if plan.coach_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your training plan")

    if data.status not in ("proposed", "applied", "reviewed"):
        raise HTTPException(status_code=400, detail="Invalid status value")

    plan.status = data.status
    db.commit()
    db.refresh(plan)
    return plan

def _to_admin_user_out(user: User, db: Session) -> AdminUserOut:
    athlete = db.query(Athlete).filter(Athlete.user_id == user.id).first()
    videos_uploaded = None
    if athlete:
        videos_uploaded = db.query(Video).filter(Video.athlete_id == athlete.id).count()

    # Which organization did they join, and via which code?
    membership = (
        db.query(OrganizationMember)
        .filter(OrganizationMember.user_id == user.id)
        .order_by(OrganizationMember.id.desc())
        .first()
    )
    organization_name = None
    if membership:
        org = db.query(Organization).filter(Organization.id == membership.organization_id).first()
        organization_name = org.name if org else None

    used_code = (
        db.query(JoinCode)
        .filter(JoinCode.used_by == user.id)
        .order_by(JoinCode.id.desc())
        .first()
    )
    joined_via_code = used_code.code if used_code else None

    return AdminUserOut(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        has_password=bool(user.password_hash),
        is_google_linked=bool(user.google_id),
        created_at=user.created_at,
        athlete_id=athlete.id if athlete else None,
        videos_uploaded=videos_uploaded,
        organization_name=organization_name,
        joined_via_code=joined_via_code,
    )


@router.get("/admin/users", response_model=list[AdminUserOut])
def admin_list_users(
    role: Optional[str] = None,
    search: Optional[str] = None,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    # Organizations created by this admin
    organization_ids = [
        org.id
        for org in db.query(Organization)
        .filter(Organization.created_by == current_user.id)
        .all()
    ]

    if not organization_ids:
        return []

    # Only members of this admin's organizations
    member_user_ids = [
        user_id
        for (user_id,) in db.query(OrganizationMember.user_id)
        .filter(
            OrganizationMember.organization_id.in_(organization_ids)
        )
        .distinct()
        .all()
    ]

    if not member_user_ids:
        return []

    query = db.query(User).filter(
        User.id.in_(member_user_ids)
    )

    # Role filter
    if role and role != "all":
        query = query.filter(User.role == role)

    # Search filter
    if search:
        like_pattern = f"%{search}%"

        query = query.filter(
            (User.full_name.ilike(like_pattern)) |
            (User.email.ilike(like_pattern))
        )

    users = query.order_by(User.id.desc()).all()

    return [
        _to_admin_user_out(user, db)
        for user in users
    ]

@router.get("/admin/users/{user_id}", response_model=AdminUserOut)
def admin_get_user(
    user_id: int,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return _to_admin_user_out(user, db)


@router.put("/admin/users/{user_id}", response_model=AdminUserOut)
def admin_update_user(
    user_id: int,
    data: AdminUserUpdate,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.id == current_user.id and data.is_active is False:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account")

    if data.full_name is not None:
        user.full_name = data.full_name
    if data.role is not None:
        user.role = data.role
    if data.is_active is not None:
        user.is_active = data.is_active

    db.commit()
    db.refresh(user)
    return _to_admin_user_out(user, db)


@router.delete("/admin/users/{user_id}")
def admin_delete_user(
    user_id: int,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    db.delete(user)
    db.commit()
    return {"message": f"User {user_id} deleted"}

@router.get("/sports-scientist/health-index")
def health_index(
    current_user: User = Depends(require_role(UserRole.sports_scientist)),
    db: Session = Depends(get_db),
):
    athletes = db.query(Athlete).all()
    results = []

    for athlete in athletes:
        videos = db.query(Video).filter(Video.athlete_id == athlete.id).all()
        video_ids = [v.id for v in videos]
        if not video_ids:
            continue

        quality_reports = db.query(QualityReport).filter(QualityReport.video_id.in_(video_ids)).all()
        risk_predictions = db.query(RiskPrediction).filter(RiskPrediction.video_id.in_(video_ids)).all()

        if not quality_reports and not risk_predictions:
            continue

        avg_quality = (
            sum(float(q.quality_score) for q in quality_reports) / len(quality_reports)
            if quality_reports else None
        )
        avg_risk = (
            sum(float(r.risk_score) for r in risk_predictions) / len(risk_predictions)
            if risk_predictions else None
        )

        health = compute_overall_health(avg_quality, avg_risk)

        results.append({
            "athlete_id": athlete.id,
            "full_name": athlete.user.full_name,
            "sport_type": athlete.sport_type,
            "avg_quality_score": round(avg_quality, 1) if avg_quality is not None else None,
            "avg_risk_score": round(avg_risk, 1) if avg_risk is not None else None,
            "videos_analyzed": len(video_ids),
            **health,
        })

    # Worst health first — that's what a sports authority needs to see immediately
    results.sort(key=lambda r: r["health_score"])
    return results


@router.get("/sports-scientist/biomechanics-analytics")
def biomechanics_analytics(
    current_user: User = Depends(require_role(UserRole.sports_scientist)),
    db: Session = Depends(get_db),
):
    all_results = db.query(BiomechanicsResult).all()
    total_analyzed = len(all_results)

    joint_flag_counts: dict[str, int] = {}
    for result in all_results:
        joint_summary = result.analysis_json.get("joint_summary", {})
        for joint in flag_joint_deviations(joint_summary):
            joint_flag_counts[joint] = joint_flag_counts.get(joint, 0) + 1

    joint_frequency = [
        {
            "joint": joint.replace("_", " ").title(),
            "flagged_count": count,
            "total_analyzed": total_analyzed,
            "flagged_rate": round(count / total_analyzed * 100, 1) if total_analyzed else 0,
        }
        for joint, count in sorted(joint_flag_counts.items(), key=lambda x: -x[1])
    ]

    return {"total_videos_analyzed": total_analyzed, "joint_deviation_frequency": joint_frequency}


def _build_research_report_data(db: Session) -> dict:
    all_athletes = db.query(Athlete).all()
    all_risk = db.query(RiskPrediction).all()
    all_biomech = db.query(BiomechanicsResult).all()

    risk_by_category = {"low": 0, "moderate": 0, "high": 0, "critical": 0}
    injury_type_counts = {}
    for r in all_risk:
        risk_by_category[r.risk_category] = risk_by_category.get(r.risk_category, 0) + 1
        injury_type_counts[r.injury_type] = injury_type_counts.get(r.injury_type, 0) + 1

    joint_flag_counts = {}
    for result in all_biomech:
        joint_summary = result.analysis_json.get("joint_summary", {})
        for joint in flag_joint_deviations(joint_summary):
            joint_flag_counts[joint.replace("_", " ").title()] = joint_flag_counts.get(joint.replace("_", " ").title(), 0) + 1

    return {
        "total_athletes": len(all_athletes),
        "total_risk_assessments": len(all_risk),
        "total_biomechanics_analyses": len(all_biomech),
        "risk_distribution": risk_by_category,
        "injury_type_distribution": injury_type_counts,
        "joint_deviation_frequency": joint_flag_counts,
    }


@router.get("/sports-scientist/export/pdf")
def export_research_report_pdf(
    current_user: User = Depends(require_role(UserRole.sports_scientist)),
    db: Session = Depends(get_db),
):
    data = _build_research_report_data(db)
    pdf_bytes = build_research_report_pdf(data)
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=research_report.pdf"},
    )


@router.get("/sports-scientist/export/excel")
def export_research_report_excel(
    current_user: User = Depends(require_role(UserRole.sports_scientist)),
    db: Session = Depends(get_db),
):
    data = _build_research_report_data(db)
    excel_bytes = build_research_report_excel(data)
    return StreamingResponse(
        BytesIO(excel_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=research_report.xlsx"},
    )

@router.get("/admin/system-monitoring")
def system_monitoring(
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    """
    Show pipeline monitoring only for videos belonging to
    athletes who joined organizations created by this admin.
    """

    # 1. Get organizations created by the logged-in admin
    organization_ids = [
        org.id
        for org in db.query(Organization)
        .filter(Organization.created_by == current_user.id)
        .all()
    ]

    # Fresh admin = no organizations = no pipeline data
    if not organization_ids:
        return {
            "total_videos": 0,
            "videos_by_status": {
                "uploaded": 0,
                "processed": 0,
                "pose_estimated": 0,
                "biomechanics_analyzed": 0,
                "analyzed": 0,
                "risk_predicted": 0,
                "invalid": 0,
            },
            "pose_estimations_completed": 0,
            "biomechanics_completed": 0,
            "risk_predictions_completed": 0,
            "failed_analyses": 0,
        }

    # 2. Get users who joined this admin's organizations
    member_user_ids = [
        user_id
        for (user_id,) in db.query(OrganizationMember.user_id)
        .filter(
            OrganizationMember.organization_id.in_(organization_ids)
        )
        .distinct()
        .all()
    ]

    if not member_user_ids:
        return {
            "total_videos": 0,
            "videos_by_status": {
                "uploaded": 0,
                "processed": 0,
                "pose_estimated": 0,
                "biomechanics_analyzed": 0,
                "analyzed": 0,
                "risk_predicted": 0,
                "invalid": 0,
            },
            "pose_estimations_completed": 0,
            "biomechanics_completed": 0,
            "risk_predictions_completed": 0,
            "failed_analyses": 0,
        }

    # 3. Get athletes belonging to those organization members
    athlete_ids = [
        athlete.id
        for athlete in db.query(Athlete)
        .filter(Athlete.user_id.in_(member_user_ids))
        .all()
    ]

    if not athlete_ids:
        return {
            "total_videos": 0,
            "videos_by_status": {
                "uploaded": 0,
                "processed": 0,
                "pose_estimated": 0,
                "biomechanics_analyzed": 0,
                "analyzed": 0,
                "risk_predicted": 0,
                "invalid": 0,
            },
            "pose_estimations_completed": 0,
            "biomechanics_completed": 0,
            "risk_predictions_completed": 0,
            "failed_analyses": 0,
        }

    # 4. Get ONLY videos belonging to those athletes
    all_videos = (
        db.query(Video)
        .filter(Video.athlete_id.in_(athlete_ids))
        .all()
    )

    video_ids = [video.id for video in all_videos]

    # 5. Pipeline status
    funnel = {
        "uploaded": 0,
        "processed": 0,
        "pose_estimated": 0,
        "biomechanics_analyzed": 0,
        "analyzed": 0,
        "risk_predicted": 0,
        "invalid": 0,
    }

    for video in all_videos:
        status = video.status or "unknown"

        if status in funnel:
            funnel[status] += 1

    # 6. Count only analysis records for this admin's videos
    pose_count = (
        db.query(PoseResult)
        .filter(PoseResult.video_id.in_(video_ids))
        .count()
        if video_ids else 0
    )

    biomechanics_count = (
        db.query(BiomechanicsResult)
        .filter(BiomechanicsResult.video_id.in_(video_ids))
        .count()
        if video_ids else 0
    )

    risk_count = (
        db.query(RiskPrediction)
        .filter(RiskPrediction.video_id.in_(video_ids))
        .count()
        if video_ids else 0
    )

    return {
        "total_videos": len(all_videos),
        "videos_by_status": funnel,
        "pose_estimations_completed": pose_count,
        "biomechanics_completed": biomechanics_count,
        "risk_predictions_completed": risk_count,
        "failed_analyses": funnel["invalid"],
    }

@router.get("/admin/activity", response_model=list[ActivityLogOut])
def activity_log(
    limit: int = 50,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    return db.query(ActivityLog).order_by(ActivityLog.id.desc()).limit(limit).all()
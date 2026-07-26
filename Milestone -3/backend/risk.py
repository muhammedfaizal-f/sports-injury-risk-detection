from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Video, Athlete, PoseResult, BiomechanicsResult, RiskPrediction, User
from schemas import RiskPredictionOut
from dependencies import get_current_user
from ml.feature_engineering import extract_risk_features
from ml.risk_model import compute_risk_score, predict_injury_type, generate_risk_explanation

router = APIRouter(prefix="/videos", tags=["risk"])


def _get_owned_video(video_id: int, current_user: User, db: Session) -> Video:
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    athlete = db.query(Athlete).filter(Athlete.id == video.athlete_id).first()
    if not athlete or athlete.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your video")
    return video


@router.post("/{video_id}/predict-risk", response_model=RiskPredictionOut)
def predict_risk(
    video_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Runs the Weighted Scoring Model on a video that's already completed
    Milestone 2's pipeline (analyzed status required).
    """
    video = _get_owned_video(video_id, current_user, db)

    if video.status != "analyzed":
        raise HTTPException(
            status_code=400,
            detail="Video must complete the Milestone 2 pipeline first (status must be 'analyzed')",
        )

    athlete = db.query(Athlete).filter(Athlete.id == video.athlete_id).first()

    biomech_result = (
        db.query(BiomechanicsResult)
        .filter(BiomechanicsResult.video_id == video.id)
        .order_by(BiomechanicsResult.id.desc())
        .first()
    )
    pose_result = (
        db.query(PoseResult)
        .filter(PoseResult.video_id == video.id)
        .order_by(PoseResult.id.desc())
        .first()
    )

    if not biomech_result or not pose_result:
        raise HTTPException(status_code=404, detail="Missing biomechanics or pose data for this video")

    features = extract_risk_features(biomech_result.analysis_json, pose_result.keypoints_json, athlete)
    risk = compute_risk_score(features)
    injury_type = predict_injury_type(features)
    explanation = generate_risk_explanation(features, injury_type)

    prediction = RiskPrediction(
        video_id=video.id,
        risk_score=risk["risk_score"],
        risk_category=risk["risk_category"],
        injury_type=injury_type,
        factors_json={
            "factor_breakdown": risk["factor_breakdown"],
            "explanation": explanation,
        },
    )
    db.add(prediction)
    video.status = "risk_predicted"
    db.commit()
    db.refresh(prediction)

    return prediction


@router.get("/{video_id}/risk", response_model=RiskPredictionOut)
def get_risk_prediction(
    video_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    video = _get_owned_video(video_id, current_user, db)

    prediction = (
        db.query(RiskPrediction)
        .filter(RiskPrediction.video_id == video.id)
        .order_by(RiskPrediction.id.desc())
        .first()
    )
    if not prediction:
        raise HTTPException(status_code=404, detail="No risk prediction yet — run /predict-risk first")

    return prediction
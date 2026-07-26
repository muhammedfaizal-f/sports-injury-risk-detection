from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from io import BytesIO
from database import get_db
from models import Video, Athlete, BiomechanicsResult, QualityReport, RiskPrediction, User
from dependencies import get_current_user
from utils.pdf_export import build_video_report_pdf
from utils.excel_export import build_video_report_excel

router = APIRouter(prefix="/reports", tags=["reports"])

JOINT_DISPLAY = {
    "left_knee": {"label": "Knee Flexion (L)", "max": 140},
    "right_knee": {"label": "Knee Flexion (R)", "max": 140},
    "left_hip": {"label": "Hip Flexion (L)", "max": 120},
    "right_hip": {"label": "Hip Flexion (R)", "max": 120},
    "trunk_lean": {"label": "Trunk Lean", "max": 30},
}


def _assemble_report_data(video_id: int, current_user: User, db: Session) -> dict:
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    athlete = db.query(Athlete).filter(Athlete.id == video.athlete_id).first()
    if not athlete or athlete.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your video")

    biomech = db.query(BiomechanicsResult).filter(BiomechanicsResult.video_id == video.id).order_by(BiomechanicsResult.id.desc()).first()
    quality = db.query(QualityReport).filter(QualityReport.video_id == video.id).order_by(QualityReport.id.desc()).first()
    risk = db.query(RiskPrediction).filter(RiskPrediction.video_id == video.id).order_by(RiskPrediction.id.desc()).first()

    joint_angles = []
    if biomech:
        for key, data in biomech.analysis_json.get("joint_summary", {}).items():
            if key in JOINT_DISPLAY:
                joint_angles.append({"joint": JOINT_DISPLAY[key]["label"], "value": data["avg"], "max": JOINT_DISPLAY[key]["max"]})

    return {
        "video_id": video.id,
        "athlete_name": athlete.user.full_name,
        "activity_type": video.activity_type,
        "quality_score": float(quality.quality_score) if quality else None,
        "risk_category": risk.risk_category if risk else (quality.risk_category if quality else None),
        "risk_score": float(risk.risk_score) if risk else None,
        "injury_type": risk.injury_type if risk else None,
        "joint_angles": joint_angles,
        "recommendations": quality.report_json.get("recommendations", []) if quality else [],
    }


@router.get("/{video_id}/pdf")
def export_pdf(video_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    data = _assemble_report_data(video_id, current_user, db)
    pdf_bytes = build_video_report_pdf(data)
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=report_video_{video_id}.pdf"},
    )


@router.get("/{video_id}/excel")
def export_excel(video_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    data = _assemble_report_data(video_id, current_user, db)
    excel_bytes = build_video_report_excel(data)
    return StreamingResponse(
        BytesIO(excel_bytes),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=report_video_{video_id}.xlsx"},
    )
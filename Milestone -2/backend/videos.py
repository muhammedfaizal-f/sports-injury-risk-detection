import os
import glob
import shutil
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Form
from sqlalchemy.orm import Session
from database import get_db
from models import Video, PoseResult, BiomechanicsResult, QualityReport, Athlete, User, UserRole
from schemas import VideoOut, PoseResultOut, BiomechanicsResultOut
from dependencies import get_current_user
from video_processing import get_video_metadata, validate_video, extract_frames
from pose_estimation import estimate_pose_on_frames, save_annotated_sample
from biomechanics import analyze_pose_sequence
from movement_quality import compute_quality_score, generate_recommendations

# Display labels + reference max angle for each joint, used to shape the
# /report response into exactly what the frontend Analysis page expects.
JOINT_DISPLAY = {
    "left_knee": {"label": "Knee Flexion (L)", "max": 140},
    "right_knee": {"label": "Knee Flexion (R)", "max": 140},
    "left_hip": {"label": "Hip Flexion (L)", "max": 120},
    "right_hip": {"label": "Hip Flexion (R)", "max": 120},
    "left_elbow": {"label": "Elbow Flexion (L)", "max": 160},
    "right_elbow": {"label": "Elbow Flexion (R)", "max": 160},
    "trunk_lean": {"label": "Trunk Lean", "max": 30},
}

router = APIRouter(prefix="/videos", tags=["videos"])

UPLOAD_DIR = "uploads/videos"
FRAMES_DIR = "uploads/frames"
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {".mp4", ".mov", ".avi"}
MAX_SIZE_MB = 100


def _get_owned_video(video_id: int, current_user: User, db: Session) -> Video:
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    athlete = db.query(Athlete).filter(Athlete.id == video.athlete_id).first()
    if not athlete or athlete.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your video")

    return video


@router.post("/upload", response_model=VideoOut)
def upload_video(
    file: UploadFile = File(...),
    activity_type: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != UserRole.athlete:
        raise HTTPException(status_code=403, detail="Only athletes can upload videos")

    athlete = db.query(Athlete).filter(Athlete.user_id == current_user.id).first()
    if not athlete:
        raise HTTPException(status_code=404, detail="Create your athlete profile first")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Only .mp4, .mov, .avi files are allowed")

    save_path = os.path.join(UPLOAD_DIR, f"athlete_{athlete.id}_{file.filename}")
    with open(save_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    size_mb = os.path.getsize(save_path) / (1024 * 1024)
    if size_mb > MAX_SIZE_MB:
        os.remove(save_path)
        raise HTTPException(status_code=400, detail=f"File exceeds {MAX_SIZE_MB}MB limit")

    video = Video(
        athlete_id=athlete.id,
        file_path=save_path,
        activity_type=activity_type,
        status="uploaded",
    )
    db.add(video)
    db.commit()
    db.refresh(video)
    return video


@router.get("/mine", response_model=list[VideoOut])
def my_videos(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    athlete = db.query(Athlete).filter(Athlete.user_id == current_user.id).first()
    if not athlete:
        return []
    return db.query(Video).filter(Video.athlete_id == athlete.id).all()


@router.post("/{video_id}/process")
def process_video(
    video_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    video = _get_owned_video(video_id, current_user, db)

    try:
        metadata = get_video_metadata(video.file_path)
    except ValueError as e:
        video.status = "invalid"
        db.commit()
        raise HTTPException(status_code=400, detail=str(e))

    issues = validate_video(metadata)
    if issues:
        video.status = "invalid"
        db.commit()
        raise HTTPException(status_code=400, detail={"issues": issues, "metadata": metadata})

    video.status = "processing"
    db.commit()

    frames_dir = os.path.join(FRAMES_DIR, f"video_{video.id}")
    frame_paths = extract_frames(video.file_path, frames_dir, target_fps=5)

    video.status = "processed"
    db.commit()

    return {
        "video_id": video.id,
        "status": video.status,
        "metadata": metadata,
        "frames_extracted": len(frame_paths),
    }


@router.post("/{video_id}/estimate-pose")
def estimate_pose(
    video_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Runs MediaPipe pose detection on the frames already extracted for this
    video (requires /process to have run first). Stores keypoints per frame
    and saves one annotated sample frame for visual verification.
    """
    video = _get_owned_video(video_id, current_user, db)

    if video.status != "processed":
        raise HTTPException(
            status_code=400,
            detail="Video must be processed (frames extracted) before pose estimation. Call /process first.",
        )

    frames_dir = os.path.join(FRAMES_DIR, f"video_{video.id}")
    if not os.path.isdir(frames_dir):
        raise HTTPException(status_code=400, detail="No extracted frames found for this video")

    frame_paths = sorted(glob.glob(os.path.join(frames_dir, "*.jpg")))
    if not frame_paths:
        raise HTTPException(status_code=400, detail="No frames available to analyze")

    pose_data = estimate_pose_on_frames(frame_paths)

    if not pose_data:
        raise HTTPException(
            status_code=422,
            detail="No person detected in any extracted frame — try a clearer video with the full body visible",
        )

    # Save one annotated sample frame (middle of the detected sequence) for
    # visual sanity-checking that the skeleton is actually being tracked.
    annotated_dir = os.path.join(FRAMES_DIR, f"video_{video.id}_annotated")
    os.makedirs(annotated_dir, exist_ok=True)
    mid_entry = pose_data[len(pose_data) // 2]
    sample_frame_path = frame_paths[mid_entry["frame"]]
    save_annotated_sample(sample_frame_path, os.path.join(annotated_dir, "sample_annotated.jpg"))

    pose_result = PoseResult(
        video_id=video.id,
        frame_count=len(pose_data),
        total_frames=len(frame_paths),
        keypoints_json=pose_data,
    )
    db.add(pose_result)
    video.status = "pose_estimated"
    db.commit()
    db.refresh(pose_result)

    return {
        "video_id": video.id,
        "status": video.status,
        "total_frames_analyzed": len(frame_paths),
        "frames_with_pose_detected": len(pose_data),
        "detection_rate": round(len(pose_data) / len(frame_paths), 2),
        "pose_result_id": pose_result.id,
    }


@router.get("/{video_id}/pose", response_model=PoseResultOut)
def get_pose_result(
    video_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    video = _get_owned_video(video_id, current_user, db)

    pose_result = (
        db.query(PoseResult)
        .filter(PoseResult.video_id == video.id)
        .order_by(PoseResult.id.desc())
        .first()
    )
    if not pose_result:
        raise HTTPException(status_code=404, detail="No pose estimation results yet — run /estimate-pose first")

    return pose_result

@router.post("/{video_id}/analyze-biomechanics")
def analyze_biomechanics(
    video_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Computes joint angles, range of motion, and left/right symmetry from
    the stored pose keypoints. Requires /estimate-pose to have run first.
    """
    video = _get_owned_video(video_id, current_user, db)

    if video.status != "pose_estimated":
        raise HTTPException(
            status_code=400,
            detail="Video must have pose estimation completed first. Call /estimate-pose.",
        )

    pose_result = (
        db.query(PoseResult)
        .filter(PoseResult.video_id == video.id)
        .order_by(PoseResult.id.desc())
        .first()
    )
    if not pose_result or not pose_result.keypoints_json:
        raise HTTPException(status_code=404, detail="No pose data found for this video")

    analysis = analyze_pose_sequence(pose_result.keypoints_json)

    if not analysis["joint_summary"]:
        raise HTTPException(
            status_code=422,
            detail="Could not compute joint angles — key landmarks weren't visible enough across frames",
        )

    biomech_result = BiomechanicsResult(video_id=video.id, analysis_json=analysis)
    db.add(biomech_result)
    video.status = "biomechanics_analyzed"
    db.commit()
    db.refresh(biomech_result)

    return {
        "video_id": video.id,
        "status": video.status,
        "biomechanics_result_id": biomech_result.id,
        "joints_analyzed": list(analysis["joint_summary"].keys()),
        "symmetry": analysis["symmetry"],
    }


@router.get("/{video_id}/biomechanics", response_model=BiomechanicsResultOut)
def get_biomechanics_result(
    video_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    video = _get_owned_video(video_id, current_user, db)

    result = (
        db.query(BiomechanicsResult)
        .filter(BiomechanicsResult.video_id == video.id)
        .order_by(BiomechanicsResult.id.desc())
        .first()
    )
    if not result:
        raise HTTPException(status_code=404, detail="No biomechanics analysis yet — run /analyze-biomechanics first")

    return result

@router.post("/{video_id}/quality-score")
def compute_quality(
    video_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    video = _get_owned_video(video_id, current_user, db)

    if video.status != "biomechanics_analyzed":
        raise HTTPException(status_code=400, detail="Run /analyze-biomechanics first")

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
        raise HTTPException(status_code=404, detail="Missing analysis data")

    detection_rate = (
        pose_result.frame_count / pose_result.total_frames
        if pose_result.total_frames else 1.0
    )

    quality = compute_quality_score(biomech_result.analysis_json, detection_rate)
    recommendations = generate_recommendations(biomech_result.analysis_json)

    report = QualityReport(
        video_id=video.id,
        quality_score=quality["quality_score"],
        risk_category=quality["risk_category"],
        report_json={**quality, "recommendations": recommendations},
    )
    db.add(report)
    video.status = "analyzed"
    db.commit()
    db.refresh(report)

    return {
        "video_id": video.id,
        "status": video.status,
        "quality_score": quality["quality_score"],
        "risk_category": quality["risk_category"],
        "recommendations": recommendations,
    }


@router.get("/{video_id}/report")
def get_full_report(
    video_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Shapes the full analysis into exactly the structure the frontend
    Analysis page expects — see mockAnalysis in Analysis.jsx. This means
    wiring the frontend to real data is a one-line swap, no restructuring.
    """
    video = _get_owned_video(video_id, current_user, db)

    quality_report = (
        db.query(QualityReport)
        .filter(QualityReport.video_id == video.id)
        .order_by(QualityReport.id.desc())
        .first()
    )
    biomech_result = (
        db.query(BiomechanicsResult)
        .filter(BiomechanicsResult.video_id == video.id)
        .order_by(BiomechanicsResult.id.desc())
        .first()
    )
    if not quality_report or not biomech_result:
        raise HTTPException(status_code=404, detail="Full report not available yet — run the analysis pipeline first")

    joint_summary = biomech_result.analysis_json.get("joint_summary", {})
    symmetry = biomech_result.analysis_json.get("symmetry", {})

    joint_angles = [
        {
            "joint": JOINT_DISPLAY[key]["label"],
            "value": data["avg"],
            "max": JOINT_DISPLAY[key]["max"],
        }
        for key, data in joint_summary.items()
        if key in JOINT_DISPLAY
    ]

    symmetry_left = [
        {"label": f"{label.capitalize()} angle", "value": f"{data['left_avg']}°"}
        for label, data in symmetry.items()
    ]
    symmetry_right = [
        {"label": f"{label.capitalize()} angle", "value": f"{data['right_avg']}°"}
        for label, data in symmetry.items()
    ]

    return {
        "quality_score": float(quality_report.quality_score),
        "risk_category": quality_report.risk_category,
        "joint_angles": joint_angles,
        "symmetry": {"left": symmetry_left, "right": symmetry_right},
        "recommendations": quality_report.report_json.get("recommendations", []),
    }

@router.post("/{video_id}/analyze-full")
def analyze_full_pipeline(
    video_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Runs process → estimate-pose → analyze-biomechanics → quality-score
    in sequence. Convenience endpoint so the frontend doesn't need to call
    four separate endpoints and manage state between them.
    """
    video = _get_owned_video(video_id, current_user, db)

    if video.status not in ("uploaded", "invalid"):
        raise HTTPException(status_code=400, detail=f"Video already at status '{video.status}' — cannot re-run from start")

    # Step 1: process (frame extraction)
    try:
        metadata = get_video_metadata(video.file_path)
    except ValueError as e:
        video.status = "invalid"
        db.commit()
        raise HTTPException(status_code=400, detail=str(e))

    issues = validate_video(metadata)
    if issues:
        video.status = "invalid"
        db.commit()
        raise HTTPException(status_code=400, detail={"issues": issues})

    frames_dir = os.path.join(FRAMES_DIR, f"video_{video.id}")
    frame_paths = extract_frames(video.file_path, frames_dir, target_fps=5)
    video.status = "processed"
    db.commit()

    # Step 2: pose estimation
    pose_data = estimate_pose_on_frames(frame_paths)
    if not pose_data:
        video.status = "invalid"
        db.commit()
        raise HTTPException(status_code=422, detail="No person detected in this video")

    pose_result = PoseResult(
        video_id=video.id,
        frame_count=len(pose_data),
        total_frames=len(frame_paths),
        keypoints_json=pose_data,
    )
    db.add(pose_result)
    video.status = "pose_estimated"
    db.commit()
    db.refresh(pose_result)

    # Step 3: biomechanical analysis
    analysis = analyze_pose_sequence(pose_data)
    if not analysis["joint_summary"]:
        raise HTTPException(status_code=422, detail="Could not compute joint angles from this video")

    biomech_result = BiomechanicsResult(video_id=video.id, analysis_json=analysis)
    db.add(biomech_result)
    video.status = "biomechanics_analyzed"
    db.commit()
    db.refresh(biomech_result)

    # Step 4: quality score
    detection_rate = pose_result.frame_count / pose_result.total_frames
    quality = compute_quality_score(analysis, detection_rate)
    recommendations = generate_recommendations(analysis)

    report = QualityReport(
        video_id=video.id,
        quality_score=quality["quality_score"],
        risk_category=quality["risk_category"],
        report_json={**quality, "recommendations": recommendations},
    )
    db.add(report)
    video.status = "analyzed"
    db.commit()

    return {
        "video_id": video.id,
        "status": video.status,
        "quality_score": quality["quality_score"],
        "risk_category": quality["risk_category"],
        "frames_extracted": len(frame_paths),
        "frames_with_pose": len(pose_data),
    }
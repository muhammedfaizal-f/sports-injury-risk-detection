import os
import glob
import shutil
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Form
from sqlalchemy.orm import Session
from database import get_db
from models import Video, PoseResult, BiomechanicsResult, Athlete, User, UserRole
from schemas import VideoOut, PoseResultOut, BiomechanicsResultOut
from dependencies import get_current_user
from video_processing import get_video_metadata, validate_video, extract_frames
from pose_estimation import estimate_pose_on_frames, save_annotated_sample
from biomechanics import analyze_pose_sequence

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
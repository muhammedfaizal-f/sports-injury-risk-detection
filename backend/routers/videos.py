import os
import shutil
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Form
from sqlalchemy.orm import Session
from database import get_db
from models import Video, Athlete, User, UserRole
from schemas import VideoOut
from dependencies import get_current_user
from video_processing import get_video_metadata, validate_video, extract_frames

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

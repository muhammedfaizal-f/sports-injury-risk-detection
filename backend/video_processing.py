import cv2
import os


def get_video_metadata(video_path: str) -> dict:
    """Reads basic metadata from a video file using OpenCV."""
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError("Cannot open video file — it may be corrupted or an unsupported codec")

    fps = cap.get(cv2.CAP_PROP_FPS)
    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    duration = frame_count / fps if fps > 0 else 0
    cap.release()

    return {
        "fps": round(fps, 2),
        "frame_count": frame_count,
        "width": width,
        "height": height,
        "duration_sec": round(duration, 2),
    }


MIN_WIDTH = 480
MIN_HEIGHT = 360
MIN_DURATION_SEC = 1
MAX_DURATION_SEC = 30


def validate_video(metadata: dict) -> list[str]:
    """Returns a list of quality issues. Empty list = video passes validation."""
    issues = []

    if metadata["width"] < MIN_WIDTH or metadata["height"] < MIN_HEIGHT:
        issues.append(
            f"Resolution too low ({metadata['width']}x{metadata['height']}); "
            f"minimum required is {MIN_WIDTH}x{MIN_HEIGHT}"
        )

    if metadata["duration_sec"] < MIN_DURATION_SEC:
        issues.append("Video is too short for meaningful movement analysis")

    if metadata["duration_sec"] > MAX_DURATION_SEC:
        issues.append(
            f"Video is too long ({metadata['duration_sec']}s); keep clips under "
            f"{MAX_DURATION_SEC}s for now to control processing time"
        )

    if metadata["fps"] < 15:
        issues.append(f"Frame rate too low ({metadata['fps']} fps) for reliable pose tracking")

    return issues


def extract_frames(video_path: str, output_dir: str, target_fps: int = 5) -> list[str]:
    """Extracts frames from a video at a target sampling rate."""
    os.makedirs(output_dir, exist_ok=True)

    cap = cv2.VideoCapture(video_path)
    source_fps = cap.get(cv2.CAP_PROP_FPS) or target_fps
    frame_interval = max(1, round(source_fps / target_fps))

    saved_paths = []
    frame_idx = 0
    saved_idx = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break
        if frame_idx % frame_interval == 0:
            frame_path = os.path.join(output_dir, f"frame_{saved_idx:04d}.jpg")
            cv2.imwrite(frame_path, frame)
            saved_paths.append(frame_path)
            saved_idx += 1
        frame_idx += 1

    cap.release()
    return saved_paths

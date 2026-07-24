import cv2
import mediapipe as mp

mp_pose = mp.solutions.pose
mp_drawing = mp.solutions.drawing_utils
mp_drawing_styles = mp.solutions.drawing_styles

# MediaPipe's 33 body landmarks (nose, eyes, shoulders, elbows, wrists,
# hips, knees, ankles, etc.) — index order is fixed by the library.
LANDMARK_NAMES = [lm.name for lm in mp_pose.PoseLandmark]


def estimate_pose_on_frames(frame_paths: list[str]) -> list[dict]:
    """
    Runs MediaPipe Pose on a list of frame image paths (static image mode —
    each frame treated independently, which is fine for our ~5fps sampled frames).

    Returns a list of entries, one per frame WHERE a person was detected:
        [{ "frame": 0, "joints": { "LEFT_KNEE": {"x":.., "y":.., "z":.., "visibility":..}, ... } }, ...]

    Frames with no detected person are skipped.
    """
    results = []

    with mp_pose.Pose(static_image_mode=True, min_detection_confidence=0.5) as pose:
        for idx, frame_path in enumerate(frame_paths):
            image = cv2.imread(frame_path)
            if image is None:
                continue

            image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            result = pose.process(image_rgb)

            if not result.pose_landmarks:
                continue

            joints = {}
            for i, lm in enumerate(result.pose_landmarks.landmark):
                name = LANDMARK_NAMES[i]
                joints[name] = {
                    "x": round(lm.x, 4),
                    "y": round(lm.y, 4),
                    "z": round(lm.z, 4),
                    "visibility": round(lm.visibility, 4),
                }

            results.append({"frame": idx, "joints": joints})

    return results


def save_annotated_sample(frame_path: str, output_path: str) -> bool:
    """
    Draws the detected skeleton onto a single frame and saves it.
    Useful for visually verifying pose detection is actually working.
    Returns True if a pose was detected and the image was saved.
    """
    image = cv2.imread(frame_path)
    if image is None:
        return False

    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

    with mp_pose.Pose(static_image_mode=True, min_detection_confidence=0.5) as pose:
        result = pose.process(image_rgb)
        if not result.pose_landmarks:
            return False

        mp_drawing.draw_landmarks(
            image,
            result.pose_landmarks,
            mp_pose.POSE_CONNECTIONS,
            landmark_drawing_spec=mp_drawing_styles.get_default_pose_landmarks_style(),
        )

    cv2.imwrite(output_path, image)
    return True
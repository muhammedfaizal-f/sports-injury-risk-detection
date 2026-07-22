import math


def calculate_angle(a: dict, b: dict, c: dict) -> float | None:
    """
    Calculates the angle (in degrees) at point b, formed by points a-b-c.
    Uses x,y only — MediaPipe's z is a rough relative depth, not calibrated,
    so 2D angle calculation from the video plane is the standard approach.
    """
    ax, ay = a["x"], a["y"]
    bx, by = b["x"], b["y"]
    cx, cy = c["x"], c["y"]

    ba = (ax - bx, ay - by)
    bc = (cx - bx, cy - by)

    dot = ba[0] * bc[0] + ba[1] * bc[1]
    mag_ba = math.hypot(*ba)
    mag_bc = math.hypot(*bc)

    if mag_ba == 0 or mag_bc == 0:
        return None

    cos_angle = max(-1.0, min(1.0, dot / (mag_ba * mag_bc)))
    angle_rad = math.acos(cos_angle)
    return round(math.degrees(angle_rad), 1)


def midpoint(p1: dict, p2: dict) -> dict:
    return {"x": (p1["x"] + p2["x"]) / 2, "y": (p1["y"] + p2["y"]) / 2}


def calculate_trunk_lean(shoulder_mid: dict, hip_mid: dict) -> float:
    """
    Angle of the trunk line (shoulder midpoint to hip midpoint) relative to
    vertical. 0 = upright, larger = more forward/backward lean.
    """
    dx = shoulder_mid["x"] - hip_mid["x"]
    dy = shoulder_mid["y"] - hip_mid["y"]
    angle_rad = math.atan2(abs(dx), abs(dy))
    return round(math.degrees(angle_rad), 1)


# Each entry: (point_before_joint, joint, point_after_joint)
JOINT_TRIPLETS = {
    "left_knee": ("LEFT_HIP", "LEFT_KNEE", "LEFT_ANKLE"),
    "right_knee": ("RIGHT_HIP", "RIGHT_KNEE", "RIGHT_ANKLE"),
    "left_hip": ("LEFT_SHOULDER", "LEFT_HIP", "LEFT_KNEE"),
    "right_hip": ("RIGHT_SHOULDER", "RIGHT_HIP", "RIGHT_KNEE"),
    "left_elbow": ("LEFT_SHOULDER", "LEFT_ELBOW", "LEFT_WRIST"),
    "right_elbow": ("RIGHT_SHOULDER", "RIGHT_ELBOW", "RIGHT_WRIST"),
}

MIN_VISIBILITY = 0.5  # ignore landmarks MediaPipe wasn't confident about


def analyze_frame(joints: dict) -> dict:
    """Computes joint angles + trunk lean for a single frame's keypoints."""
    angles = {}

    for angle_name, (p1_name, p2_name, p3_name) in JOINT_TRIPLETS.items():
        p1, p2, p3 = joints.get(p1_name), joints.get(p2_name), joints.get(p3_name)
        if not (p1 and p2 and p3):
            continue
        if min(p1["visibility"], p2["visibility"], p3["visibility"]) < MIN_VISIBILITY:
            continue
        angle = calculate_angle(p1, p2, p3)
        if angle is not None:
            angles[angle_name] = angle

    l_shoulder, r_shoulder = joints.get("LEFT_SHOULDER"), joints.get("RIGHT_SHOULDER")
    l_hip, r_hip = joints.get("LEFT_HIP"), joints.get("RIGHT_HIP")
    if l_shoulder and r_shoulder and l_hip and r_hip:
        shoulder_mid = midpoint(l_shoulder, r_shoulder)
        hip_mid = midpoint(l_hip, r_hip)
        angles["trunk_lean"] = calculate_trunk_lean(shoulder_mid, hip_mid)

    return angles


def analyze_pose_sequence(pose_frames: list[dict]) -> dict:
    """
    Aggregates per-frame joint angles across a whole video's pose sequence.
    Returns min/max/avg range of motion per joint, plus left/right symmetry.
    """
    per_joint_values: dict[str, list[float]] = {}

    for frame_entry in pose_frames:
        angles = analyze_frame(frame_entry["joints"])
        for joint_name, value in angles.items():
            per_joint_values.setdefault(joint_name, []).append(value)

    joint_summary = {}
    for joint_name, values in per_joint_values.items():
        joint_summary[joint_name] = {
            "min": round(min(values), 1),
            "max": round(max(values), 1),
            "avg": round(sum(values) / len(values), 1),
            "samples": len(values),
        }

    symmetry = {}
    pairs = [
        ("knee", "left_knee", "right_knee"),
        ("hip", "left_hip", "right_hip"),
        ("elbow", "left_elbow", "right_elbow"),
    ]
    for label, left_key, right_key in pairs:
        if left_key in joint_summary and right_key in joint_summary:
            left_avg = joint_summary[left_key]["avg"]
            right_avg = joint_summary[right_key]["avg"]
            diff = abs(left_avg - right_avg)
            larger = max(left_avg, right_avg, 1)
            symmetry[label] = {
                "left_avg": left_avg,
                "right_avg": right_avg,
                "difference": round(diff, 1),
                "symmetry_score": round(100 - (diff / larger * 100), 1),
            }

    return {"joint_summary": joint_summary, "symmetry": symmetry}
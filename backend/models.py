import enum
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum, ForeignKey, Numeric, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import secrets
from datetime import datetime, timedelta


class UserRole(str, enum.Enum):
    athlete = "athlete"
    coach = "coach"
    physiotherapist = "physiotherapist"
    sports_scientist = "sports_scientist"
    admin = "admin"


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now())


class OrganizationMember(Base):
    __tablename__ = "organization_members"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    role = Column(Enum(UserRole), nullable=False)
    joined_at = Column(DateTime, server_default=func.now())


class JoinCode(Base):
    __tablename__ = "join_codes"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(4), nullable=False, index=True)
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    admin_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False)
    used_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String(255), nullable=False)
    created_at = Column(DateTime, server_default=func.now())


def generate_join_code() -> str:
    """4-digit numeric code, zero-padded (e.g. '0042')."""
    return f"{secrets.randbelow(10000):04d}"




class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(150), nullable=False)
    email = Column(String(150), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=True)
    google_id = Column(String(255), unique=True, nullable=True, index=True)
    avatar_path = Column(String(255), nullable=True)
    role = Column(Enum(UserRole), default=UserRole.athlete, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())

    athlete_profile = relationship("Athlete", back_populates="user", uselist=False)

class Athlete(Base):
    __tablename__ = "athletes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    sport_type = Column(String(100))
    position = Column(String(100))
    age = Column(Integer)
    height_cm = Column(Numeric(5, 2))
    weight_kg = Column(Numeric(5, 2))
    injury_history = Column(Text)
    training_load = Column(String(50))

    user = relationship("User", back_populates="athlete_profile")


class Video(Base):
    __tablename__ = "videos"

    id = Column(Integer, primary_key=True, index=True)
    athlete_id = Column(Integer, ForeignKey("athletes.id"), nullable=False)
    file_path = Column(String(255), nullable=False)
    activity_type = Column(String(50))
    status = Column(String(50), default="uploaded")
    uploaded_at = Column(DateTime, server_default=func.now())


class PoseResult(Base):
    __tablename__ = "pose_results"

    id = Column(Integer, primary_key=True, index=True)
    video_id = Column(Integer, ForeignKey("videos.id"), nullable=False)
    frame_count = Column(Integer)
    total_frames = Column(Integer)
    keypoints_json = Column(JSONB)
    created_at = Column(DateTime, server_default=func.now())


class BiomechanicsResult(Base):
    __tablename__ = "biomechanics_results"

    id = Column(Integer, primary_key=True, index=True)
    video_id = Column(Integer, ForeignKey("videos.id"), nullable=False)
    analysis_json = Column(JSONB)
    created_at = Column(DateTime, server_default=func.now())

class QualityReport(Base):
    __tablename__ = "quality_reports"

    id = Column(Integer, primary_key=True, index=True)
    video_id = Column(Integer, ForeignKey("videos.id"), nullable=False)
    quality_score = Column(Numeric(5, 2))
    risk_category = Column(String(20))
    report_json = Column(JSONB)
    created_at = Column(DateTime, server_default=func.now())

class RiskPrediction(Base):
    __tablename__ = "risk_predictions"

    id = Column(Integer, primary_key=True, index=True)
    video_id = Column(Integer, ForeignKey("videos.id"), nullable=False)
    risk_score = Column(Numeric(5, 2))
    risk_category = Column(String(20))
    injury_type = Column(String(50))
    factors_json = Column(JSONB)
    created_at = Column(DateTime, server_default=func.now())

class CoachAthlete(Base):
    __tablename__ = "coach_athlete"

    id = Column(Integer, primary_key=True, index=True)
    coach_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    athlete_id = Column(Integer, ForeignKey("athletes.id"), nullable=False)

class InviteStatus(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"
    declined = "declined"


class Invite(Base):
    __tablename__ = "invites"

    id = Column(Integer, primary_key=True, index=True)
    coach_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    athlete_email = Column(String(150), nullable=False)
    status = Column(Enum(InviteStatus), default=InviteStatus.pending, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    responded_at = Column(DateTime, nullable=True)

class RecoveryPlanStatus(str, enum.Enum):
    not_started = "not_started"
    in_progress = "in_progress"
    completed = "completed"


class RecoveryPlan(Base):
    __tablename__ = "recovery_plans"

    id = Column(Integer, primary_key=True, index=True)
    physio_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    athlete_id = Column(Integer, ForeignKey("athletes.id"), nullable=False)
    exercises_json = Column(JSONB)
    notes = Column(Text)
    status = Column(Enum(RecoveryPlanStatus), default=RecoveryPlanStatus.not_started, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

class TrainingPlanStatus(str, enum.Enum):
    proposed = "proposed"
    applied = "applied"
    reviewed = "reviewed"


class TrainingPlan(Base):
    __tablename__ = "training_plans"

    id = Column(Integer, primary_key=True, index=True)
    coach_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    athlete_id = Column(Integer, ForeignKey("athletes.id"), nullable=False)
    suggestions_json = Column(JSONB)
    notes = Column(Text)
    status = Column(Enum(TrainingPlanStatus), default=TrainingPlanStatus.proposed, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
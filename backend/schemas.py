from pydantic import BaseModel, EmailStr
from typing import Optional, Any
from decimal import Decimal
from models import UserRole


class UserCreate(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    role: UserRole = UserRole.athlete


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    role: UserRole

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class AthleteCreate(BaseModel):
    sport_type: Optional[str] = None
    position: Optional[str] = None
    age: Optional[int] = None
    height_cm: Optional[Decimal] = None
    weight_kg: Optional[Decimal] = None
    injury_history: Optional[str] = None
    training_load: Optional[str] = None


class AthleteUpdate(AthleteCreate):
    pass


class AthleteOut(AthleteCreate):
    id: int
    user_id: int

    class Config:
        from_attributes = True


class VideoOut(BaseModel):
    id: int
    athlete_id: int
    file_path: str
    activity_type: Optional[str] = None
    status: str

    class Config:
        from_attributes = True

class PoseResultOut(BaseModel):
    id: int
    video_id: int
    frame_count: Optional[int] = None
    keypoints_json: Optional[Any] = None

    class Config:
        from_attributes = True


class BiomechanicsResultOut(BaseModel):
    id: int
    video_id: int
    analysis_json: Optional[Any] = None

    class Config:
        from_attributes = True


class QualityReportOut(BaseModel):
    id: int
    video_id: int
    quality_score: Optional[Decimal] = None
    risk_category: Optional[str] = None
    report_json: Optional[Any] = None

    class Config:
        from_attributes = True

class RiskPredictionOut(BaseModel):
    id: int
    video_id: int
    risk_score: float
    risk_category: str
    injury_type: str
    factors_json: Optional[Any] = None

    class Config:
        from_attributes = True

class LinkAthleteRequest(BaseModel):
    athlete_id: int


class AthleteRiskSummary(BaseModel):
    athlete_id: int
    full_name: str
    sport_type: Optional[str] = None
    latest_risk_score: Optional[float] = None
    latest_risk_category: Optional[str] = None
    latest_injury_type: Optional[str] = None
    videos_analyzed: int

class GoogleLoginRequest(BaseModel):
    id_token: str
    role: Optional[UserRole] = UserRole.athlete  # only used if creating a new account
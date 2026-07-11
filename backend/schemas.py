from pydantic import BaseModel, EmailStr
from typing import Optional
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

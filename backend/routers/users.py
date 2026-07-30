import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from database import get_db
from models import User
from schemas import UserProfileOut, UserUpdate, PasswordChange
from dependencies import get_current_user
from auth_utils import hash_password, verify_password

router = APIRouter(prefix="/users", tags=["users"])

AVATAR_DIR = "uploads/avatars"
os.makedirs(AVATAR_DIR, exist_ok=True)

ALLOWED_IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp"}
MAX_AVATAR_MB = 5


def _to_profile_out(user: User) -> UserProfileOut:
    avatar_url = f"/uploads/avatars/{os.path.basename(user.avatar_path)}" if user.avatar_path else None
    return UserProfileOut(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        role=user.role,
        avatar_url=avatar_url,
        has_password=bool(user.password_hash),
    )


@router.get("/me", response_model=UserProfileOut)
def get_me(current_user: User = Depends(get_current_user)):
    return _to_profile_out(current_user)


@router.put("/me", response_model=UserProfileOut)
def update_me(
    data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if data.email and data.email != current_user.email:
        existing = db.query(User).filter(User.email == data.email).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already in use")
        current_user.email = data.email

    if data.full_name:
        current_user.full_name = data.full_name

    db.commit()
    db.refresh(current_user)
    return _to_profile_out(current_user)


@router.post("/me/avatar", response_model=UserProfileOut)
def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_IMAGE_EXT:
        raise HTTPException(status_code=400, detail="Only .jpg, .jpeg, .png, .webp images are allowed")

    # Remove any previous avatar (possibly a different extension) before saving the new one
    for old_ext in ALLOWED_IMAGE_EXT:
        old_path = os.path.join(AVATAR_DIR, f"user_{current_user.id}{old_ext}")
        if os.path.exists(old_path):
            os.remove(old_path)

    save_path = os.path.join(AVATAR_DIR, f"user_{current_user.id}{ext}")
    with open(save_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    size_mb = os.path.getsize(save_path) / (1024 * 1024)
    if size_mb > MAX_AVATAR_MB:
        os.remove(save_path)
        raise HTTPException(status_code=400, detail=f"Image exceeds {MAX_AVATAR_MB}MB limit")

    current_user.avatar_path = save_path
    db.commit()
    db.refresh(current_user)
    return _to_profile_out(current_user)


@router.put("/me/password")
def change_password(
    data: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.password_hash:
        if not data.current_password or not verify_password(data.current_password, current_user.password_hash):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
    # If password_hash is None (Google-only account), no current password is required —
    # this lets them set a password for the first time as a fallback login method.

    current_user.password_hash = hash_password(data.new_password)
    db.commit()
    return {"message": "Password updated successfully"}
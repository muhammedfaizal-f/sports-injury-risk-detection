from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
from models import User, UserRole
from schemas import UserCreate, UserOut, Token, GoogleLoginRequest
from auth_utils import (
    hash_password,
    verify_password,
    create_access_token,
    verify_google_token,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserOut)
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    # Check email
    existing = db.query(User).filter(User.email == user_data.email).first()

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    # Check duplicate athlete name
    if user_data.role == UserRole.athlete:
        name = user_data.full_name.strip()

        existing_athlete = (
            db.query(User)
            .filter(
                User.role == UserRole.athlete,
                func.lower(User.full_name) == name.lower()
            )
            .first()
        )

        if existing_athlete:
            raise HTTPException(
                status_code=400,
                detail="Athlete name already taken"
            )

    new_user = User(
        full_name=user_data.full_name.strip(),
        email=user_data.email,
        password_hash=hash_password(user_data.password),
        role=user_data.role,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user


@router.post("/login", response_model=Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.email == form_data.username).first()

    if not user or not user.password_hash or not verify_password(
        form_data.password,
        user.password_hash
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )

    token = create_access_token({
        "sub": str(user.id),
        "role": user.role.value
    })

    return {
        "access_token": token,
        "token_type": "bearer"
    }


@router.post("/google", response_model=Token)
def google_login(
    data: GoogleLoginRequest,
    db: Session = Depends(get_db)
):
    payload = verify_google_token(data.id_token)

    if not payload:
        raise HTTPException(
            status_code=401,
            detail="Invalid Google token"
        )

    email = payload.get("email")
    google_sub = payload.get("sub")

    if not email:
        raise HTTPException(
            status_code=400,
            detail="Google account has no email"
        )

    full_name = payload.get(
        "name",
        email.split("@")[0]
    ).strip()

    user = db.query(User).filter(User.email == email).first()

    if user:
        # Existing account — link Google ID if needed
        if not user.google_id:
            user.google_id = google_sub
            db.commit()

    else:
        # Check duplicate athlete name for a new Google athlete
        if data.role == UserRole.athlete:
            existing_athlete = (
                db.query(User)
                .filter(
                    User.role == UserRole.athlete,
                    func.lower(User.full_name) == full_name.lower()
                )
                .first()
            )

            if existing_athlete:
                raise HTTPException(
                    status_code=400,
                    detail="Athlete name already taken"
                )

        user = User(
            full_name=full_name,
            email=email,
            password_hash=None,
            google_id=google_sub,
            role=data.role,
        )

        db.add(user)
        db.commit()
        db.refresh(user)

    token = create_access_token({
        "sub": str(user.id),
        "role": user.role.value
    })

    return {
        "access_token": token,
        "token_type": "bearer"
    }
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Invite, InviteStatus, User, UserRole, Athlete, CoachAthlete
from schemas import InviteCreate, InviteOut, InviteRespond
from dependencies import get_current_user, require_role

router = APIRouter(prefix="/invites", tags=["invites"])


@router.post("/send", response_model=InviteOut)
def send_invite(
    data: InviteCreate,
    current_user: User = Depends(require_role(UserRole.coach)),
    db: Session = Depends(get_db),
):
    existing_pending = db.query(Invite).filter(
        Invite.coach_id == current_user.id,
        Invite.athlete_email == data.athlete_email,
        Invite.status == InviteStatus.pending,
    ).first()
    if existing_pending:
        raise HTTPException(status_code=400, detail="An invite to this email is already pending")

    invite = Invite(coach_id=current_user.id, athlete_email=data.athlete_email)
    db.add(invite)
    db.commit()
    db.refresh(invite)
    return invite


@router.get("/sent", response_model=list[InviteOut])
def sent_invites(
    current_user: User = Depends(require_role(UserRole.coach)),
    db: Session = Depends(get_db),
):
    return db.query(Invite).filter(Invite.coach_id == current_user.id).order_by(Invite.id.desc()).all()


@router.get("/received", response_model=list[InviteOut])
def received_invites(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != UserRole.athlete:
        raise HTTPException(status_code=403, detail="Only athletes receive invites")

    return (
        db.query(Invite)
        .filter(Invite.athlete_email == current_user.email, Invite.status == InviteStatus.pending)
        .order_by(Invite.id.desc())
        .all()
    )


@router.post("/{invite_id}/respond", response_model=InviteOut)
def respond_to_invite(
    invite_id: int,
    data: InviteRespond,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != UserRole.athlete:
        raise HTTPException(status_code=403, detail="Only athletes can respond to invites")

    invite = db.query(Invite).filter(Invite.id == invite_id).first()
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    if invite.athlete_email != current_user.email:
        raise HTTPException(status_code=403, detail="This invite is not addressed to you")
    if invite.status != InviteStatus.pending:
        raise HTTPException(status_code=400, detail="This invite has already been responded to")

    invite.status = InviteStatus.accepted if data.accept else InviteStatus.declined
    invite.responded_at = datetime.utcnow()

    if data.accept:
        athlete = db.query(Athlete).filter(Athlete.user_id == current_user.id).first()
        if not athlete:
            raise HTTPException(status_code=400, detail="Create your athlete profile before accepting invites")

        already_linked = db.query(CoachAthlete).filter(
            CoachAthlete.coach_id == invite.coach_id,
            CoachAthlete.athlete_id == athlete.id,
        ).first()
        if not already_linked:
            db.add(CoachAthlete(coach_id=invite.coach_id, athlete_id=athlete.id))

    db.commit()
    db.refresh(invite)
    return invite
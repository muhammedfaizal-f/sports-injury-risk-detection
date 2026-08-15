from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import (
    User, UserRole, Organization, OrganizationMember, JoinCode, Athlete, generate_join_code,
)
from schemas import (
    OrganizationCreate, OrganizationOut, OrgMemberOut,
    JoinCodeCreate, JoinCodeOut, JoinCodeVerify,
)
from dependencies import get_current_user, require_role
from activity_log import log_activity

router = APIRouter(prefix="/organizations", tags=["organizations"])

JOIN_CODE_EXPIRY_MINUTES = 15


# ---------- ADMIN: create + manage organizations ----------

@router.post("", response_model=OrganizationOut)
def create_organization(
    data: OrganizationCreate,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    org = Organization(name=data.name, created_by=current_user.id)
    db.add(org)
    db.commit()
    db.refresh(org)

    # Admin auto-joins their own organization
    db.add(OrganizationMember(organization_id=org.id, user_id=current_user.id, role=UserRole.admin))
    db.commit()

    log_activity(db, current_user.id, f"Admin created organization '{org.name}'")
    return org


@router.get("", response_model=list[OrganizationOut])
def list_organizations(
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    # Only show organizations created by the logged-in admin
    return (
        db.query(Organization)
        .filter(Organization.created_by == current_user.id)
        .order_by(Organization.id.desc())
        .all()
    )

@router.get("/{org_id}/members", response_model=list[OrgMemberOut])
def list_organization_members(
    org_id: int,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    members = db.query(OrganizationMember).filter(OrganizationMember.organization_id == org_id).all()
    result = []
    for m in members:
        user = db.query(User).filter(User.id == m.user_id).first()
        if user:
            result.append(OrgMemberOut(
                user_id=user.id, full_name=user.full_name, email=user.email,
                role=m.role, joined_at=m.joined_at,
            ))
    return result


@router.delete("/{org_id}/members/{user_id}")
def remove_organization_member(
    org_id: int,
    user_id: int,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    member = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == org_id,
        OrganizationMember.user_id == user_id,
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found in this organization")

    db.delete(member)
    db.commit()
    log_activity(db, current_user.id, f"Admin removed user {user_id} from organization {org_id}")
    return {"message": "Member removed"}


# ---------- ADMIN: generate join codes ----------

@router.post("/join-codes", response_model=JoinCodeOut)
def generate_code(
    data: JoinCodeCreate,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    org = db.query(Organization).filter(Organization.id == data.organization_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    # Retry a few times on the unlikely chance of a duplicate active code
    for _ in range(5):
        code = generate_join_code()
        clash = db.query(JoinCode).filter(
            JoinCode.code == code, JoinCode.used == False, JoinCode.expires_at > datetime.utcnow()
        ).first()
        if not clash:
            break
    else:
        raise HTTPException(status_code=500, detail="Could not generate a unique code, try again")

    join_code = JoinCode(
        code=code,
        organization_id=org.id,
        admin_id=current_user.id,
        expires_at=datetime.utcnow() + timedelta(minutes=JOIN_CODE_EXPIRY_MINUTES),
    )
    db.add(join_code)
    db.commit()
    db.refresh(join_code)

    log_activity(db, current_user.id, f"Admin generated a join code for '{org.name}'")
    return join_code


@router.get("/join-codes", response_model=list[JoinCodeOut])
def list_join_codes(
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
):
    return db.query(JoinCode).filter(JoinCode.admin_id == current_user.id).order_by(JoinCode.id.desc()).all()


# ---------- ANY LOGGED-IN USER: verify + join with a code ----------

@router.post("/join")
def join_with_code(
    data: JoinCodeVerify,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    join_code = db.query(JoinCode).filter(JoinCode.code == data.code).order_by(JoinCode.id.desc()).first()

    if not join_code:
        raise HTTPException(status_code=404, detail="Invalid code")
    if join_code.used:
        raise HTTPException(status_code=400, detail="This code has already been used")
    if join_code.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="This code has expired — ask your admin for a new one")

    existing = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == join_code.organization_id,
        OrganizationMember.user_id == current_user.id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="You are already a member of this organization")

    member = OrganizationMember(
        organization_id=join_code.organization_id,
        user_id=current_user.id,
        role=current_user.role,
    )
    db.add(member)

    join_code.used = True
    join_code.used_by = current_user.id
    db.commit()

    org = db.query(Organization).filter(Organization.id == join_code.organization_id).first()
    log_activity(db, current_user.id, f"{current_user.full_name} joined organization '{org.name}'")

    return {"message": f"Joined {org.name}", "organization_id": org.id, "organization_name": org.name}


@router.get("/mine", response_model=OrganizationOut)
def my_organization(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    member = db.query(OrganizationMember).filter(OrganizationMember.user_id == current_user.id).first()
    if not member:
        raise HTTPException(status_code=404, detail="You are not part of any organization yet")

    org = db.query(Organization).filter(Organization.id == member.organization_id).first()
    return org
from sqlalchemy.orm import Session
from models import ActivityLog


def log_activity(db: Session, user_id: int | None, action: str) -> None:
    """
    Records an activity log entry. Called as a side effect from other
    endpoints (video upload, plan creation, join requests, etc.) — never
    raises, so a logging failure never breaks the actual operation it's
    attached to.
    """
    try:
        entry = ActivityLog(user_id=user_id, action=action)
        db.add(entry)
        db.commit()
    except Exception:
        db.rollback()
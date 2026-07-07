from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.session import SessionLocal
from app.models.favorite import UserFavorite
from app.models.meditation import Meditation
from app.models.user import User
from app.schemas.favorite import FavoriteListResponse, FavoriteRead

router = APIRouter()


def get_db():
    """Open a database session for this request and close it afterward."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def favorite_response(favorite: UserFavorite, meditation: Meditation) -> FavoriteRead:
    """Build the response for one saved meditation."""
    return FavoriteRead(
        id=favorite.id,
        meditation_id=favorite.meditation_id,
        created_at=favorite.created_at,
        meditation=meditation,
    )


@router.get("/me", response_model=FavoriteListResponse)
def list_my_favorites(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all meditations saved by the signed-in user."""
    rows = db.query(UserFavorite, Meditation).join(
        Meditation,
        Meditation.id == UserFavorite.meditation_id,
    ).filter(
        UserFavorite.user_id == current_user.id,
        Meditation.is_published.is_(True),
    ).order_by(UserFavorite.created_at.desc(), UserFavorite.id.desc()).all()

    items = [
        favorite_response(favorite, meditation)
        for favorite, meditation in rows
    ]
    return FavoriteListResponse(
        items=items,
        meditation_ids=[item.meditation_id for item in items],
    )


@router.post("/{meditation_id}", response_model=FavoriteRead)
def save_favorite(
    meditation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Save a meditation to the signed-in user's favorites."""
    meditation = db.query(Meditation).filter(
        Meditation.id == meditation_id,
        Meditation.is_published.is_(True),
    ).first()
    if meditation is None:
        raise HTTPException(status_code=404, detail="Meditation not found")

    favorite = db.query(UserFavorite).filter(
        UserFavorite.user_id == current_user.id,
        UserFavorite.meditation_id == meditation_id,
    ).first()
    if favorite is None:
        favorite = UserFavorite(
            user_id=current_user.id,
            meditation_id=meditation_id,
        )
        db.add(favorite)
        db.commit()
        db.refresh(favorite)

    return favorite_response(favorite, meditation)


@router.delete("/{meditation_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_favorite(
    meditation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove a meditation from the signed-in user's favorites."""
    db.query(UserFavorite).filter(
        UserFavorite.user_id == current_user.id,
        UserFavorite.meditation_id == meditation_id,
    ).delete(synchronize_session=False)
    db.commit()
    return None

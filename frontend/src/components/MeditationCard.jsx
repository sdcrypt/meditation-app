import { Link } from "react-router-dom";
import MeditationArtwork from "./MeditationArtwork";
import { useFavorites } from "../context/FavoritesContext";

export const formatDuration = (seconds) => {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} min`;
};

export const meditationDescription = (meditation) =>
  meditation.description ||
  `A gentle ${meditation.category.toLowerCase()} practice to help you slow down and reconnect.`;

const ArrowIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M5 12h13M13 6l6 6-6 6" />
  </svg>
);

export default function MeditationCard({ meditation, featured = false, reason = "" }) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const visibleTags = (meditation.tags ?? []).slice(0, featured ? 4 : 3);
  const firstBenefit = meditation.benefits?.[0];
  const saved = isFavorite(meditation.id);

  const handleFavoriteClick = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    const result = await toggleFavorite(meditation);
    if (result?.requiresLogin) {
      window.location.href = "/login";
    }
  };

  return (
    <Link
      className={`library-card ${featured ? "library-card--featured" : ""}`}
      to={`/meditations/${meditation.id}`}
    >
      <MeditationArtwork meditation={meditation} className="library-card__art">
        <div className="library-card__art-top">
          <span>{meditation.category}</span>
          <span>{formatDuration(meditation.duration_sec)}</span>
        </div>
        <button
          className={`library-card__favorite ${saved ? "is-saved" : ""}`}
          onClick={handleFavoriteClick}
          aria-label={saved ? "Remove from saved meditations" : "Save meditation"}
          title={saved ? "Saved" : "Save"}
        >
          {saved ? "♥" : "♡"}
        </button>
        <span className="library-card__play" aria-hidden="true">
          <i />
        </span>
      </MeditationArtwork>
      <div className="library-card__body">
        {reason && <span className="library-card__match">✦ {reason}</span>}
        <p className="library-card__teacher">
          {meditation.teacher_name || "Still guide"}
        </p>
        <h3>{meditation.title}</h3>
        <p className="library-card__description">
          {meditationDescription(meditation)}
        </p>
        {visibleTags.length > 0 && (
          <div className="library-card__tags">
            {visibleTags.map((tag) => <span key={tag}>{tag}</span>)}
          </div>
        )}
        <div className="library-card__footer">
          <span>{meditation.level}</span>
          {firstBenefit && <span className="library-card__benefit">{firstBenefit}</span>}
          <ArrowIcon />
        </div>
      </div>
    </Link>
  );
}

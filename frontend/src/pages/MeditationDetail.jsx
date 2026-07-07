import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import MeditationArtwork from "../components/MeditationArtwork";
import { formatDuration, meditationDescription } from "../components/MeditationCard";
import { API_BASE_URL } from "../config";
import { useFavorites } from "../context/FavoritesContext";
import { usePlayer } from "../context/PlayerContext";

const BackIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M19 12H6M11 6l-6 6 6 6" />
  </svg>
);

export default function MeditationDetail() {
  const { meditationId } = useParams();
  const [meditation, setMeditation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const {
    currentMeditation,
    isPlaying,
    currentTime,
    playMeditation,
  } = usePlayer();
  const { isFavorite, toggleFavorite } = useFavorites();

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetch(`${API_BASE_URL}/meditations/${meditationId}`, { signal: controller.signal })
      .then((response) => {
        if (response.status === 404) throw new Error("This meditation is not available.");
        if (!response.ok) throw new Error("Unable to load this meditation.");
        return response.json();
      })
      .then(setMeditation)
      .catch((requestError) => {
        if (requestError.name !== "AbortError") setError(requestError.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [meditationId]);

  if (loading) {
    return <main className="detail-page"><div className="detail-loading">Preparing your practice…</div></main>;
  }

  if (error || !meditation) {
    return (
      <main className="detail-page">
        <div className="detail-error">
          <p className="eyebrow">Not found</p>
          <h1>{error || "This meditation is not available."}</h1>
          <Link to="/explore"><BackIcon /> Return to Explore</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="detail-page">
      <div className="site-shell detail-shell">
        <Link className="detail-back" to="/explore"><BackIcon /> Back to Explore</Link>
        <div className="detail-grid">
          <MeditationArtwork meditation={meditation} className="detail-artwork">
            {meditation.is_featured && <span className="detail-featured-badge">Featured practice</span>}
            <div className="detail-artwork__caption">
              <span>{meditation.category}</span>
              <span>still.</span>
            </div>
          </MeditationArtwork>

          <article className="detail-content">
            <p className="eyebrow">{meditation.category} · {meditation.level}</p>
            <h1>{meditation.title}</h1>
            <p className="detail-teacher">Guided by <strong>{meditation.teacher_name || "Still guide"}</strong></p>
            <p className="detail-description">{meditationDescription(meditation)}</p>
            <button
              className={`detail-favorite ${isFavorite(meditation.id) ? "is-saved" : ""}`}
              onClick={async () => {
                const result = await toggleFavorite(meditation);
                if (result?.requiresLogin) window.location.href = "/login";
              }}
            >
              {isFavorite(meditation.id) ? "♥ Saved meditation" : "♡ Save meditation"}
            </button>

            <div className="detail-meta">
              <div><span>Duration</span><strong>{formatDuration(meditation.duration_sec)}</strong></div>
              <div><span>Level</span><strong>{meditation.level}</strong></div>
              <div><span>Focus</span><strong>{meditation.category}</strong></div>
            </div>

            {meditation.audio_url ? (
              <div className="detail-player">
                <div>
                  <span>{currentMeditation?.id === meditation.id && currentTime > 0 ? "Continue your practice" : "Ready when you are"}</span>
                  <strong>
                    {currentMeditation?.id === meditation.id && currentTime > 0
                      ? `Resume from ${Math.floor(currentTime / 60)}:${String(Math.floor(currentTime % 60)).padStart(2, "0")}`
                      : "Press play and settle in"}
                  </strong>
                </div>
                <button
                  className="detail-player__button"
                  onClick={() => playMeditation(meditation)}
                >
                  <span>{currentMeditation?.id === meditation.id && isPlaying ? "Ⅱ" : "▶"}</span>
                  {currentMeditation?.id === meditation.id && isPlaying ? "Pause meditation" : "Play meditation"}
                </button>
                <small>Your progress is saved automatically across pages.</small>
              </div>
            ) : (
              <div className="detail-player detail-player--unavailable">
                Audio for this practice is being prepared.
              </div>
            )}

            {(meditation.benefits ?? []).length > 0 && (
              <section className="detail-benefits">
                <h2>This practice may help you</h2>
                <ul>
                  {meditation.benefits.map((benefit) => (
                    <li key={benefit}><span>✓</span>{benefit}</li>
                  ))}
                </ul>
              </section>
            )}

            {(meditation.tags ?? []).length > 0 && (
              <div className="detail-tags">
                {meditation.tags.map((tag) => <span key={tag}>{tag}</span>)}
              </div>
            )}
          </article>
        </div>
      </div>
    </main>
  );
}

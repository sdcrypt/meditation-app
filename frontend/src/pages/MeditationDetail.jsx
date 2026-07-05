import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import MeditationArtwork from "../components/MeditationArtwork";
import { formatDuration, meditationDescription } from "../components/MeditationCard";
import { API_BASE_URL, DEVICE_ID } from "../config";

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
  const sessionId = useRef(null);

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

  const startSession = async () => {
    if (sessionId.current) return;
    sessionId.current = "pending";
    try {
      const response = await fetch(`${API_BASE_URL}/sessions/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meditation_id: meditation.id,
          device_id: Number(DEVICE_ID),
        }),
      });
      if (!response.ok) throw new Error("Unable to start session");
      const session = await response.json();
      sessionId.current = session.id;
    } catch {
      sessionId.current = null;
    }
  };

  const completeSession = async () => {
    if (!Number.isInteger(sessionId.current)) return;
    await fetch(`${API_BASE_URL}/sessions/${sessionId.current}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seconds_listened: meditation.duration_sec }),
    }).catch(() => {});
  };

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

            <div className="detail-meta">
              <div><span>Duration</span><strong>{formatDuration(meditation.duration_sec)}</strong></div>
              <div><span>Level</span><strong>{meditation.level}</strong></div>
              <div><span>Focus</span><strong>{meditation.category}</strong></div>
            </div>

            {meditation.audio_url ? (
              <div className="detail-player">
                <div><span>Ready when you are</span><strong>Press play and settle in</strong></div>
                <audio
                  src={meditation.audio_url}
                  controls
                  preload="metadata"
                  onPlay={startSession}
                  onEnded={completeSession}
                />
                <small>A richer custom player is coming in the next build.</small>
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

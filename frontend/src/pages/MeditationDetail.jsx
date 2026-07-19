import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import MeditationArtwork from "../components/MeditationArtwork";
import { formatDuration, meditationDescription } from "../components/MeditationCard";
import { API_BASE_URL } from "../config";
import { useFavorites } from "../context/FavoritesContext";
import { usePlayer } from "../context/PlayerContext";
import { cleanListValues } from "../utils/listValues";

const BackIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M19 12H6M11 6l-6 6 6 6" />
  </svg>
);

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString() : "";

export default function MeditationDetail() {
  const { meditationId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const programId = searchParams.get("program");
  const [meditation, setMeditation] = useState(null);
  const [program, setProgram] = useState(null);
  const [programError, setProgramError] = useState("");
  const [programRefreshKey, setProgramRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const {
    currentMeditation,
    isPlaying,
    currentTime,
    lastCompletedPlayback,
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

  useEffect(() => {
    if (!programId) {
      setProgram(null);
      setProgramError("");
      return undefined;
    }

    const controller = new AbortController();
    setProgramError("");
    fetch(`${API_BASE_URL}/programs/${programId}`, {
      credentials: "include",
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load program context.");
        return response.json();
      })
      .then(setProgram)
      .catch((requestError) => {
        if (requestError.name !== "AbortError") setProgramError(requestError.message);
      });
    return () => controller.abort();
  }, [programId, programRefreshKey]);

  useEffect(() => {
    if (
      lastCompletedPlayback?.meditationId === Number(meditationId) &&
      lastCompletedPlayback?.programId === Number(programId)
    ) {
      setProgramRefreshKey(lastCompletedPlayback.completedAt);
    }
  }, [lastCompletedPlayback, meditationId, programId]);

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

  const benefits = cleanListValues(meditation.benefits);
  const tags = cleanListValues(meditation.tags);
  const backLink = programId ? `/programs/${programId}` : "/explore";
  const backLabel = programId ? "Back to program" : "Back to Explore";
  const programItems = program?.meditations ?? [];
  const currentProgramItem = programItems.find(
    (item) => item.meditation.id === Number(meditationId)
  );
  const nextProgramItem = currentProgramItem
    ? programItems.find(
        (item) =>
          item.position > currentProgramItem.position &&
          !item.is_completed
      ) || programItems.find((item) => item.position > currentProgramItem.position)
    : null;
  const nextProgramMeditation = nextProgramItem?.meditation ?? null;
  const isLastProgramMeditation = Boolean(program && currentProgramItem && !nextProgramMeditation);
  const isProgramComplete = Boolean(
    program &&
    program.total_meditations > 0 &&
    program.completed_meditations >= program.total_meditations
  );
  const completedDate = formatDate(program?.enrollment_completed_at);

  const handleProgramNextAction = () => {
    if (nextProgramMeditation) {
      navigate(`/meditations/${nextProgramMeditation.id}?program=${program.id}`);
      return;
    }
    if (!isProgramComplete && isLastProgramMeditation) {
      playMeditation(meditation, { programId });
    }
  };

  return (
    <main className="detail-page">
      <div className="site-shell detail-shell">
        <Link className="detail-back" to={backLink}><BackIcon /> {backLabel}</Link>
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

            {program && currentProgramItem && (
              <section className={`detail-program-card ${isProgramComplete ? "is-complete" : ""}`}>
                <div>
                  <span>{isProgramComplete ? "Program complete" : `Part of ${program.title}`}</span>
                  <strong>
                    {isProgramComplete
                      ? `You completed ${program.title}`
                      : `Step ${currentProgramItem.position} of ${program.total_meditations}`}
                  </strong>
                  {isProgramComplete ? (
                    <p>
                      {completedDate
                        ? `Completed ${completedDate}. Your full path is saved in Account.`
                        : "Your full path is saved in Account."}
                    </p>
                  ) : nextProgramMeditation ? (
                    <p>Next in program · {nextProgramMeditation.title}</p>
                  ) : (
                    <p>Final meditation in this program.</p>
                  )}
                </div>
                <div className="detail-program-card__actions">
                  <Link to={`/programs/${program.id}`}>View program</Link>
                  {nextProgramMeditation ? (
                    <button onClick={handleProgramNextAction}>Play next meditation</button>
                  ) : isProgramComplete ? (
                    <Link to={`/programs/${program.id}`}>Program complete</Link>
                  ) : (
                    <button onClick={handleProgramNextAction}>Finish program</button>
                  )}
                </div>
              </section>
            )}

            {programError && (
              <div className="detail-program-card detail-program-card--error">
                {programError} <Link to={`/programs/${programId}`}>Open program</Link>
              </div>
            )}

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
                  onClick={() => playMeditation(meditation, { programId })}
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

            {benefits.length > 0 && (
              <section className="detail-benefits">
                <h2>This practice may help you</h2>
                <ul>
                  {benefits.map((benefit) => (
                    <li key={benefit}><span>✓</span>{benefit}</li>
                  ))}
                </ul>
              </section>
            )}

            {tags.length > 0 && (
              <div className="detail-tags">
                {tags.map((tag) => <span key={tag}>{tag}</span>)}
              </div>
            )}
          </article>
        </div>
      </div>
    </main>
  );
}

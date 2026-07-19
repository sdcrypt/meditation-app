import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import MeditationArtwork from "../components/MeditationArtwork";
import { formatDuration } from "../components/MeditationCard";
import { API_BASE_URL } from "../config";
import { useAuth } from "../context/AuthContext";

export default function ProgramDetail() {
  const { programId } = useParams();
  const navigate = useNavigate();
  const [program, setProgram] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const { user } = useAuth();

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE_URL}/programs/${programId}`, {
      credentials: "include",
      signal: controller.signal,
    })
      .then((response) => {
        if (response.status === 404) throw new Error("This program is not available.");
        if (!response.ok) throw new Error("Unable to load this program.");
        return response.json();
      })
      .then(setProgram)
      .catch((requestError) => {
        if (requestError.name !== "AbortError") setError(requestError.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [programId]);

  if (loading) {
    return <main className="program-detail-page"><div className="detail-loading">Opening your program…</div></main>;
  }

  if (error || !program) {
    return (
      <main className="program-detail-page">
        <div className="detail-error">
          <p className="eyebrow">Not found</p>
          <h1>{error || "This program is not available."}</h1>
          <Link to="/programs">Return to Programs</Link>
        </div>
      </main>
    );
  }

  const artworkMeditation = program.meditations?.[0]?.meditation || {
    id: program.id,
    title: program.title,
    artwork_url: program.artwork_url,
  };
  const totalMeditations = program.total_meditations ?? program.meditations.length;
  const completedMeditations = program.completed_meditations ?? 0;
  const completionPercent = program.completion_percent ?? 0;
  const firstMeditation = program.meditations?.[0]?.meditation ?? null;
  const nextProgramItem = program.meditations.find((item) => !item.is_completed) ?? null;
  const nextMeditation = nextProgramItem?.meditation ?? firstMeditation;
  const isProgramComplete = totalMeditations > 0 && completedMeditations === totalMeditations;

  const handleProgramAction = async () => {
    if (!user) {
      window.location.href = "/login";
      return;
    }

    if (program.is_enrolled) {
      if (!isProgramComplete && nextMeditation) {
        navigate(`/meditations/${nextMeditation.id}?program=${program.id}`);
      }
      return;
    }

    setStarting(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/programs/${program.id}/start`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Unable to start this program.");
      const enrollment = await response.json();
      setProgram(enrollment.program);
      if (nextMeditation) navigate(`/meditations/${nextMeditation.id}?program=${program.id}`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setStarting(false);
    }
  };

  return (
    <main className="program-detail-page">
      <section className="site-shell program-detail-hero">
        <MeditationArtwork
          meditation={{ ...artworkMeditation, artwork_url: program.artwork_url || artworkMeditation.artwork_url }}
          className="program-detail-art"
        />
        <div>
          <Link className="detail-back" to="/programs">← Back to Programs</Link>
          <p className="eyebrow">{program.goal || "mindfulness"} · {program.level}</p>
          <h1>{program.title}</h1>
          <p>{program.description}</p>
          <div className="program-detail-meta">
            <span>{totalMeditations} practices</span>
            <span>{program.level}</span>
            <span>{program.goal || "mindfulness"}</span>
          </div>
          {program.is_enrolled && (
            <div className="program-detail-progress">
              <div>
                <span>{completedMeditations} of {totalMeditations} completed</span>
                <strong>{completionPercent}% complete</strong>
              </div>
              <i><b style={{ width: `${completionPercent}%` }} /></i>
            </div>
          )}
          <button
            className={`program-start-button ${isProgramComplete ? "is-started" : ""}`}
            onClick={handleProgramAction}
            disabled={starting || isProgramComplete}
          >
            {starting
              ? "Starting…"
              : isProgramComplete
                ? "✓ Program complete"
                : program.is_enrolled
                  ? "Continue program"
                  : "Start program"}
          </button>
        </div>
      </section>

      <section className="site-shell program-sequence">
        <div className="explore-section-heading">
          <div>
            <p className="eyebrow">Your path</p>
            <h2>Program sequence</h2>
          </div>
          <p>Move through these meditations in order, or choose the practice you need today.</p>
        </div>
        <div className="program-step-list">
          {program.meditations.map((item) => {
            const isNextUp = program.is_enrolled && nextProgramItem?.meditation.id === item.meditation.id;
            const isInProgress = program.is_enrolled && item.is_started && !item.is_completed;
            const statusLabel = item.is_completed
              ? "Completed"
              : isInProgress
                ? "In progress"
                : isNextUp
                  ? "Next up"
                  : "Not started";
            const actionLabel = item.is_completed
              ? "Replay →"
              : isInProgress || isNextUp
                ? "Continue →"
                : "Start →";
            return (
            <Link
              className={`program-step ${item.is_completed ? "is-completed" : ""} ${isNextUp ? "is-next" : ""} ${isInProgress ? "is-in-progress" : ""}`}
              to={program.is_enrolled
                ? `/meditations/${item.meditation.id}?program=${program.id}`
                : `/meditations/${item.meditation.id}`}
              key={`${item.position}-${item.meditation.id}`}
            >
              <span>{item.is_completed ? "✓" : String(item.position).padStart(2, "0")}</span>
              <MeditationArtwork meditation={item.meditation} />
              <div>
                <small>
                  {statusLabel} · {item.meditation.category} · {formatDuration(item.meditation.duration_sec)}
                </small>
                <strong>{item.meditation.title}</strong>
                <p>{item.meditation.teacher_name || "Still guide"}</p>
              </div>
              <b>{actionLabel}</b>
            </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}

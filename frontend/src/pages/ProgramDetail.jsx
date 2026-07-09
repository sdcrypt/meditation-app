import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import MeditationArtwork from "../components/MeditationArtwork";
import { formatDuration } from "../components/MeditationCard";
import { API_BASE_URL } from "../config";
import { useAuth } from "../context/AuthContext";

export default function ProgramDetail() {
  const { programId } = useParams();
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

  const startProgram = async () => {
    if (!user) {
      window.location.href = "/login";
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
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setStarting(false);
    }
  };

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
            className={`program-start-button ${program.is_enrolled ? "is-started" : ""}`}
            onClick={startProgram}
            disabled={starting || program.is_enrolled}
          >
            {starting
              ? "Starting…"
              : program.is_enrolled
                ? "✓ Program started"
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
          {program.meditations.map((item) => (
            <Link
              className="program-step"
              to={`/meditations/${item.meditation.id}`}
              key={`${item.position}-${item.meditation.id}`}
            >
              <span>{String(item.position).padStart(2, "0")}</span>
              <MeditationArtwork meditation={item.meditation} />
              <div>
                <small>{item.meditation.category} · {formatDuration(item.meditation.duration_sec)}</small>
                <strong>{item.meditation.title}</strong>
                <p>{item.meditation.teacher_name || "Still guide"}</p>
              </div>
              <b>Start →</b>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

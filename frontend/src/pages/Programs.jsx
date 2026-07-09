import { useEffect, useState } from "react";
import ProgramCard from "../components/ProgramCard";
import { API_BASE_URL } from "../config";

export default function Programs() {
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE_URL}/programs/?limit=100`, {
      credentials: "include",
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load programs.");
        return response.json();
      })
      .then(setPrograms)
      .catch((requestError) => {
        if (requestError.name !== "AbortError") setError(requestError.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  return (
    <main className="programs-page">
      <section className="programs-hero">
        <div className="site-shell">
          <p className="eyebrow">Guided paths</p>
          <h1>Programs for your next chapter.</h1>
          <p>Follow structured sequences for calm, sleep, and beginner mindfulness.</p>
        </div>
      </section>
      <section className="site-shell programs-content">
        {loading && <div className="explore-state">Loading programs…</div>}
        {error && <div className="explore-state"><h3>Programs unavailable</h3><p>{error}</p></div>}
        {!loading && !error && programs.length === 0 && (
          <div className="explore-state"><h3>No programs yet.</h3><p>Check back soon for guided paths.</p></div>
        )}
        {!loading && !error && programs.length > 0 && (
          <div className="program-grid">
            {programs.map((program) => (
              <ProgramCard key={program.id} program={program} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

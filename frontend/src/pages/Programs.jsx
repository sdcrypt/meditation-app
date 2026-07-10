import { useEffect, useState } from "react";
import ProgramCard from "../components/ProgramCard";
import { API_BASE_URL } from "../config";

const PROGRAM_TABS = [
  { id: "all", label: "All Programs" },
  { id: "started", label: "Started" },
  { id: "completed", label: "Completed" },
];

export default function Programs() {
  const [programs, setPrograms] = useState([]);
  const [activeTab, setActiveTab] = useState("all");
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

  const startedPrograms = programs.filter((program) => program.is_enrolled);
  const completedPrograms = programs.filter(
    (program) => program.is_enrolled && program.completion_percent >= 100
  );
  const visiblePrograms =
    activeTab === "started"
      ? startedPrograms
      : activeTab === "completed"
        ? completedPrograms
        : programs;
  const tabCounts = {
    all: programs.length,
    started: startedPrograms.length,
    completed: completedPrograms.length,
  };
  const emptyCopy = {
    all: ["No programs yet.", "Check back soon for guided paths."],
    started: ["No started programs yet.", "Start a guided path and it will appear here."],
    completed: ["No completed programs yet.", "Complete every meditation in a program to see it here."],
  };

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
        {!loading && !error && programs.length > 0 && (
          <div className="program-tabs" role="tablist" aria-label="Program filters">
            {PROGRAM_TABS.map((tab) => (
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                className={activeTab === tab.id ? "is-active" : ""}
                onClick={() => setActiveTab(tab.id)}
                key={tab.id}
              >
                {tab.label}
                <span>{tabCounts[tab.id]}</span>
              </button>
            ))}
          </div>
        )}
        {loading && <div className="explore-state">Loading programs…</div>}
        {error && <div className="explore-state"><h3>Programs unavailable</h3><p>{error}</p></div>}
        {!loading && !error && visiblePrograms.length === 0 && (
          <div className="explore-state">
            <h3>{emptyCopy[activeTab][0]}</h3>
            <p>{emptyCopy[activeTab][1]}</p>
          </div>
        )}
        {!loading && !error && visiblePrograms.length > 0 && (
          <div className="program-grid">
            {visiblePrograms.map((program) => (
              <ProgramCard key={program.id} program={program} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

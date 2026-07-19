import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import MeditationCard from "../components/MeditationCard";
import MeditationArtwork from "../components/MeditationArtwork";
import { formatDuration } from "../components/MeditationCard";
import { API_BASE_URL, DEVICE_ID } from "../config";
import { useAuth } from "../context/AuthContext";
import { useFavorites } from "../context/FavoritesContext";
import { usePreferences } from "../context/PreferencesContext";
import {
  DURATION_OPTIONS,
  EXPERIENCE_OPTIONS,
  GOAL_OPTIONS,
  PRACTICE_TIME_OPTIONS,
} from "../utils/personalization";

const TIMEZONE_ALIASES = {
  "Asia/Calcutta": "Asia/Kolkata",
  "Asia/Katmandu": "Asia/Kathmandu",
};

const formatListeningTime = (seconds = 0) => {
  if (seconds < 60 && seconds > 0) return "<1 min";
  return `${Math.round(seconds / 60)} min`;
};

const formatAccountDate = (value) =>
  value ? new Date(value).toLocaleDateString() : "";

export default function Account() {
  const { user, logout } = useAuth();
  const { favorites, isLoading: favoritesLoading } = useFavorites();
  const { preferences, openOnboarding } = usePreferences();
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [enrolledPrograms, setEnrolledPrograms] = useState([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState("");
  const location = useLocation();
  const navigate = useNavigate();

  const timezone = useMemo(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    return TIMEZONE_ALIASES[detected] || detected;
  }, []);

  const fetchDashboard = useCallback(async () => {
    setDashboardError("");
    try {
      const [summaryResponse, historyResponse, programsResponse] = await Promise.all([
        fetch(
          `${API_BASE_URL}/sessions/progress/${DEVICE_ID}?timezone=${encodeURIComponent(timezone)}`,
          { credentials: "include" }
        ),
        fetch(
          `${API_BASE_URL}/sessions/history/${DEVICE_ID}?limit=4`,
          { credentials: "include" }
        ),
        fetch(
          `${API_BASE_URL}/programs/me/enrollments`,
          { credentials: "include" }
        ),
      ]);
      if (!summaryResponse.ok || !historyResponse.ok || !programsResponse.ok) {
        throw new Error("Unable to load account dashboard.");
      }
      const [summaryData, historyData, programsData] = await Promise.all([
        summaryResponse.json(),
        historyResponse.json(),
        programsResponse.json(),
      ]);
      setSummary(summaryData);
      setHistory(historyData.items ?? []);
      setEnrolledPrograms(programsData ?? []);
    } catch (error) {
      setDashboardError(error.message);
    } finally {
      setDashboardLoading(false);
    }
  }, [timezone]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleLogout = async () => {
    await logout();
    navigate("/", { replace: true });
  };

  const goalLabels = useMemo(
    () =>
      GOAL_OPTIONS
        .filter((item) => preferences?.goals?.includes(item.id))
        .map((item) => item.label),
    [preferences]
  );
  const durationLabel = DURATION_OPTIONS.find(
    (item) => item.id === preferences?.duration
  )?.label;
  const experienceLabel = EXPERIENCE_OPTIONS.find(
    (item) => item.id === preferences?.experience
  )?.label;
  const practiceTimeLabel = PRACTICE_TIME_OPTIONS.find(
    (item) => item.id === preferences?.practiceTime
  )?.label;

  const getProgramAction = (program) => {
    if (program.completion_percent >= 100) return "Review program";
    return program.next_meditation || program.completed_meditations > 0
      ? "Continue"
      : "Start path";
  };

  const getProgramStatus = (program, isComplete) => {
    if (isComplete) return "Completed";
    const inProgressItem = program.meditations?.find(
      (item) => item.is_started && !item.is_completed
    );
    if (inProgressItem) {
      return `In progress · ${inProgressItem.meditation.title}`;
    }
    if (program.next_meditation) {
      return `Current · ${program.next_meditation.title}`;
    }
    return "Active";
  };

  const programGroups = useMemo(() => {
    const active = [];
    const completed = [];
    enrolledPrograms.forEach((enrollment) => {
      if (enrollment.completed_at || enrollment.program?.completion_percent >= 100) {
        completed.push(enrollment);
      } else {
        active.push(enrollment);
      }
    });
    return { active, completed };
  }, [enrolledPrograms]);

  const getProgramActionLink = (enrollment) => {
    const program = enrollment.program;
    if (enrollment.completed_at || program.completion_percent >= 100) {
      return `/programs/${program.id}`;
    }
    const nextMeditation =
      program.next_meditation ||
      program.meditations?.find((item) => !item.is_completed)?.meditation ||
      program.meditations?.[0]?.meditation;
    return nextMeditation
      ? `/meditations/${nextMeditation.id}?program=${program.id}`
      : `/programs/${program.id}`;
  };

  const renderProgramList = (items, emptyState) => {
    if (items.length === 0) return emptyState;
    return (
      <div className="account-program-list">
        {items.map((enrollment) => {
          const program = enrollment.program;
          const isComplete = Boolean(enrollment.completed_at) || program.completion_percent >= 100;
          const startedAt = formatAccountDate(enrollment.started_at || program.enrollment_started_at);
          const completedAt = formatAccountDate(
            enrollment.completed_at || program.enrollment_completed_at
          );
          const status = getProgramStatus(program, isComplete);
          return (
            <article
              className={`account-program-item ${isComplete ? "is-complete" : ""}`}
              key={enrollment.id}
            >
              <Link className="account-program-art-link" to={`/programs/${program.id}`}>
                <MeditationArtwork
                  meditation={{
                    ...(program.meditations?.[0]?.meditation ?? {
                      id: program.id,
                      title: program.title,
                    }),
                    artwork_url:
                      program.artwork_url ||
                      program.meditations?.[0]?.meditation?.artwork_url,
                  }}
                />
              </Link>
              <div>
                <span>{status}</span>
                <Link to={`/programs/${program.id}`}>
                  <strong>{program.title}</strong>
                </Link>
                <small>
                  {program.completed_meditations} of {program.total_meditations} completed
                  {isComplete && completedAt
                    ? ` · Completed ${completedAt}`
                    : startedAt
                      ? ` · Started ${startedAt}`
                      : ""}
                </small>
                {program.next_meditation && !isComplete && (
                  <small className="account-program-current">
                    Continue with · {program.next_meditation.title}
                  </small>
                )}
                <i><b style={{ width: `${program.completion_percent}%` }} /></i>
              </div>
              <em>
                {isComplete ? "✓ Complete" : `${program.completion_percent}%`}
              </em>
              <Link className="account-program-action" to={getProgramActionLink(enrollment)}>
                {getProgramAction(program)} →
              </Link>
            </article>
          );
        })}
      </div>
    );
  };

  return (
    <main className="account-page">
      <div className="site-shell account-shell">
        {location.state?.error && (
          <div className="account-alert" role="alert">{location.state.error}</div>
        )}
        <section className="account-hero">
          <div className="account-avatar">{user.email.slice(0, 1).toUpperCase()}</div>
          <div>
            <p className="eyebrow">Your account</p>
            <h1>A place for your practice.</h1>
            <p>{user.email}</p>
          </div>
          <div className="account-profile-card">
            <span>{user.is_admin ? "Administrator" : "Member"}</span>
            <strong>Active</strong>
            <small>Joined {new Date(user.created_at).toLocaleDateString()}</small>
          </div>
        </section>

        {dashboardError && (
          <div className="account-alert" role="alert">{dashboardError}</div>
        )}

        <section className="account-metrics">
          <article>
            <span>Mindful minutes</span>
            <strong>{dashboardLoading ? "…" : summary?.mindful_minutes ?? 0}</strong>
            <p>All-time practice</p>
          </article>
          <article>
            <span>Current streak</span>
            <strong>{dashboardLoading ? "…" : summary?.current_streak ?? 0}</strong>
            <p>Longest · {summary?.longest_streak ?? 0} days</p>
          </article>
          <article>
            <span>Completed</span>
            <strong>{dashboardLoading ? "…" : summary?.completed_sessions ?? 0}</strong>
            <p>{summary?.total_sessions ?? 0} listening sessions</p>
          </article>
          <article>
            <span>Saved</span>
            <strong>{favorites.length}</strong>
            <p>Bookmarked meditations</p>
          </article>
        </section>

        <section className="account-dashboard-grid">
          <article className="account-panel account-preferences">
            <div className="account-section-heading">
              <div>
                <p className="eyebrow">Personalization</p>
                <h2>Your preferences</h2>
              </div>
              <button onClick={openOnboarding}>
                {preferences ? "Edit" : "Set up"}
              </button>
            </div>
            {preferences ? (
              <div className="account-preference-list">
                <div>
                  <span>Goals</span>
                  <p>{goalLabels.length ? goalLabels.join(", ") : "Not selected"}</p>
                </div>
                <div>
                  <span>Duration</span>
                  <p>{durationLabel || "Any length"}</p>
                </div>
                <div>
                  <span>Experience</span>
                  <p>{experienceLabel || "Open to anything"}</p>
                </div>
                <div>
                  <span>Practice time</span>
                  <p>{practiceTimeLabel || "Any time"}</p>
                </div>
              </div>
            ) : (
              <div className="account-empty-mini">
                <h3>Make recommendations personal.</h3>
                <p>Answer four quick questions to tune Explore and For You.</p>
                <button onClick={openOnboarding}>Choose preferences</button>
              </div>
            )}
          </article>

          <article className="account-panel account-history">
            <div className="account-section-heading">
              <div>
                <p className="eyebrow">Recent practice</p>
                <h2>Listening history</h2>
              </div>
              <Link to="/progress">View all</Link>
            </div>
            {dashboardLoading ? (
              <div className="account-empty-mini">Loading recent practice…</div>
            ) : history.length > 0 ? (
              <div className="account-history-list">
                {history.map((item) => (
                  <Link
                    className="account-history-item"
                    to={`/meditations/${item.meditation_id}`}
                    key={item.id}
                  >
                    <MeditationArtwork
                      meditation={{
                        id: item.meditation_id,
                        title: item.title,
                        artwork_url: item.artwork_url,
                      }}
                    />
                    <div>
                      <span>{item.category} · {formatListeningTime(item.seconds_listened)}</span>
                      <strong>{item.title}</strong>
                      <small>{item.is_completed ? "Completed" : `${item.progress_percent}% played`}</small>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="account-empty-mini">
                <h3>No listening history yet.</h3>
                <p>Play a meditation and your recent practice will appear here.</p>
                <Link to="/explore">Explore meditations</Link>
              </div>
            )}
          </article>
        </section>

        <section className="account-programs">
          <div className="account-section-heading">
            <div>
              <p className="eyebrow">Guided paths</p>
              <h2>Your programs</h2>
            </div>
            <Link to="/programs">Browse programs</Link>
          </div>
          {dashboardLoading ? (
            <div className="account-saved-empty">Loading your programs…</div>
          ) : enrolledPrograms.length > 0 ? (
            <div className="account-program-groups">
              <div className="account-program-group">
                <div className="account-program-group__heading">
                  <h3>Active programs</h3>
                  <span>{programGroups.active.length}</span>
                </div>
                {renderProgramList(
                  programGroups.active,
                  <div className="account-empty-mini">
                    <h3>No active programs.</h3>
                    <p>Start another guided path when you are ready.</p>
                    <Link to="/programs">Browse programs</Link>
                  </div>
                )}
              </div>
              <div className="account-program-group">
                <div className="account-program-group__heading">
                  <h3>Completed programs</h3>
                  <span>{programGroups.completed.length}</span>
                </div>
                {renderProgramList(
                  programGroups.completed,
                  <div className="account-empty-mini">
                    <h3>No completed programs yet.</h3>
                    <p>Complete every meditation in a program to see it here.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="account-saved-empty">
              <h3>No programs started yet.</h3>
              <p>Start a guided path and your progress will appear here.</p>
              <Link to="/programs">Find a program</Link>
            </div>
          )}
        </section>

        <section className="account-saved">
          <div className="account-section-heading">
            <div>
              <p className="eyebrow">Saved library</p>
              <h2>Saved meditations</h2>
            </div>
            <Link to="/explore">Explore more</Link>
          </div>
          {favoritesLoading ? (
            <div className="account-saved-empty">Loading saved meditations…</div>
          ) : favorites.length > 0 ? (
            <div className="account-saved-grid">
              {favorites.slice(0, 6).map((favorite) => (
                <MeditationCard
                  key={favorite.id}
                  meditation={favorite.meditation}
                  reason="Saved by you"
                />
              ))}
            </div>
          ) : (
            <div className="account-saved-empty">
              <h3>No saved meditations yet.</h3>
              <p>Use the heart button on Explore or a meditation detail page to save practices here.</p>
              <Link to="/explore">Find meditations to save</Link>
            </div>
          )}
        </section>

        <section className="account-actions">
          <div><h2>Session</h2><p>Sign out of this browser.</p></div>
          <button onClick={handleLogout}>Log out</button>
        </section>
      </div>
    </main>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import MeditationArtwork from "../components/MeditationArtwork";
import { API_BASE_URL, DEVICE_ID } from "../config";

const FlameIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12.5 3.5c.6 3.2-2.8 4.2-2 7.1.4-1.1 1.3-1.9 2.4-2.4 1.9 1.7 3.1 3.6 3.1 6A4.2 4.2 0 0 1 11.8 19 4.6 4.6 0 0 1 7 14.4c0-3.4 2.1-6.2 5.5-10.9Z" />
  </svg>
);

const formatListeningTime = (seconds) => {
  if (seconds < 60 && seconds > 0) return "<1 min";
  return `${Math.round(seconds / 60)} min`;
};

const formatActivityDate = (value) =>
  new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));

const TIMEZONE_ALIASES = {
  "Asia/Calcutta": "Asia/Kolkata",
  "Asia/Katmandu": "Asia/Kathmandu",
};

export default function Progress() {
  const [summary, setSummary] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLimit, setHistoryLimit] = useState(10);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const timezone = useMemo(
    () => {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      return TIMEZONE_ALIASES[detected] || detected;
    },
    []
  );

  const fetchProgress = useCallback(async ({ quiet = false } = {}) => {
    if (quiet) setRefreshing(true);
    setError("");
    try {
      const [summaryResponse, historyResponse] = await Promise.all([
        fetch(
          `${API_BASE_URL}/sessions/progress/${DEVICE_ID}?timezone=${encodeURIComponent(timezone)}`
        ),
        fetch(
          `${API_BASE_URL}/sessions/history/${DEVICE_ID}?limit=${historyLimit}`
        ),
      ]);
      if (!summaryResponse.ok || !historyResponse.ok) {
        throw new Error("Unable to load your progress right now.");
      }
      const [summaryData, historyData] = await Promise.all([
        summaryResponse.json(),
        historyResponse.json(),
      ]);
      setSummary(summaryData);
      setHistory(historyData.items);
      setHistoryTotal(historyData.total);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [historyLimit, timezone]);

  useEffect(() => {
    fetchProgress();
    const refreshTimer = window.setInterval(
      () => fetchProgress({ quiet: true }),
      30_000
    );
    return () => window.clearInterval(refreshTimer);
  }, [fetchProgress]);

  const maximumDaySeconds = Math.max(
    60,
    ...(summary?.last_7_days ?? []).map((day) => day.mindful_seconds)
  );

  return (
    <main className="progress-page">
      <section className="progress-hero">
        <div className="progress-hero__rings" />
        <div className="site-shell progress-hero__content">
          <div>
            <p className="eyebrow">Your practice</p>
            <h1>Small moments.<br />Meaningful change.</h1>
            <p>Every mindful minute is a quiet vote for the life you want to live.</p>
          </div>
          <div className="progress-streak">
            <span><FlameIcon /></span>
            <strong>{summary?.current_streak ?? 0}</strong>
            <p>day streak</p>
            <small>Longest · {summary?.longest_streak ?? 0} days</small>
          </div>
        </div>
      </section>

      <div className="site-shell progress-content">
        {loading && (
          <div className="progress-loading">
            <i /><i /><i />
            <p>Gathering your mindful moments…</p>
          </div>
        )}

        {!loading && error && (
          <div className="progress-empty">
            <h2>We couldn’t load your progress.</h2>
            <p>{error}</p>
            <button onClick={() => fetchProgress()}>Try again</button>
          </div>
        )}

        {!loading && !error && summary && (
          <>
            <section className="progress-metrics" aria-label="Practice summary">
              <article>
                <span>All-time mindful minutes</span>
                <strong>{summary.mindful_minutes}</strong>
                <small>{summary.total_sessions} listening sessions</small>
              </article>
              <article>
                <span>Completed practices</span>
                <strong>{summary.completed_sessions}</strong>
                <small>Each one a moment for you</small>
              </article>
              <article>
                <span>Today</span>
                <strong>{formatListeningTime(summary.today_seconds)}</strong>
                <small>{summary.today_seconds >= 60 ? "Today counts toward your streak" : "60 seconds begins a streak day"}</small>
              </article>
            </section>

            <section className="progress-week">
              <div className="progress-section-heading">
                <div><p className="eyebrow">The last seven days</p><h2>Your mindful rhythm</h2></div>
                {refreshing && <span>Updating…</span>}
              </div>
              <div className="progress-chart">
                {summary.last_7_days.map((day) => {
                  const height = day.mindful_seconds
                    ? Math.max(10, (day.mindful_seconds / maximumDaySeconds) * 100)
                    : 2;
                  return (
                    <div className="progress-chart__day" key={day.date}>
                      <span className="progress-chart__value">
                        {day.mindful_seconds ? formatListeningTime(day.mindful_seconds) : ""}
                      </span>
                      <div className="progress-chart__track">
                        <i
                          className={day.qualifies_for_streak ? "qualifies" : ""}
                          style={{ height: `${height}%` }}
                        />
                      </div>
                      <strong>{day.day_label}</strong>
                      <small>{new Date(`${day.date}T00:00:00`).getDate()}</small>
                    </div>
                  );
                })}
              </div>
              <p className="progress-week__note">
                A day joins your streak after a completed meditation or 60 seconds of mindful listening.
              </p>
            </section>

            <section className="progress-history">
              <div className="progress-section-heading">
                <div><p className="eyebrow">Your journey</p><h2>Listening history</h2></div>
                <span>{historyTotal} {historyTotal === 1 ? "session" : "sessions"}</span>
              </div>

              {history.length === 0 ? (
                <div className="progress-empty">
                  <h2>Your first mindful moment is waiting.</h2>
                  <p>Play any meditation for your listening history to begin.</p>
                  <Link to="/explore">Explore meditations</Link>
                </div>
              ) : (
                <div className="history-list">
                  {history.map((item) => (
                    <Link className="history-item" to={`/meditations/${item.meditation_id}`} key={item.id}>
                      <MeditationArtwork
                        meditation={{ id: item.meditation_id, title: item.title, artwork_url: item.artwork_url }}
                      />
                      <div className="history-item__content">
                        <div className="history-item__top">
                          <div>
                            <span>{item.category}</span>
                            <h3>{item.title}</h3>
                            <p>{item.teacher_name || "Still guide"}</p>
                          </div>
                          <span className={item.is_completed ? "is-complete" : "is-progress"}>
                            {item.is_completed ? "Completed" : `${item.progress_percent}% played`}
                          </span>
                        </div>
                        <div className="history-item__bottom">
                          <div className="history-item__bar"><i style={{ width: `${item.progress_percent}%` }} /></div>
                          <span>{formatListeningTime(item.seconds_listened)} mindful</span>
                          <span>{formatActivityDate(item.last_activity_at)}</span>
                        </div>
                      </div>
                      <b>→</b>
                    </Link>
                  ))}
                </div>
              )}

              {history.length < historyTotal && (
                <button className="history-load-more" onClick={() => setHistoryLimit((value) => value + 10)}>
                  Show more history
                </button>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

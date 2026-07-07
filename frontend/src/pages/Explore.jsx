import { useEffect, useMemo, useState } from "react";
import MeditationCard from "../components/MeditationCard";
import { API_BASE_URL, DEVICE_ID } from "../config";
import { usePreferences } from "../context/PreferencesContext";
import {
  DURATION_OPTIONS,
  GOAL_OPTIONS,
  rankMeditations,
} from "../utils/personalization";

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  </svg>
);

const durationMatches = (duration, seconds) => {
  if (duration === "short") return seconds < 600;
  if (duration === "medium") return seconds >= 600 && seconds <= 1200;
  if (duration === "long") return seconds > 1200;
  return true;
};

export default function Explore() {
  const [meditations, setMeditations] = useState([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [duration, setDuration] = useState("all");
  const [level, setLevel] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [history, setHistory] = useState([]);
  const {
    preferences,
    hasPreferences,
    shouldPrompt,
    openOnboarding,
  } = usePreferences();

  useEffect(() => {
    if (shouldPrompt) openOnboarding();
  }, [openOnboarding, shouldPrompt]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE_URL}/meditations/?limit=100`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load the meditation library.");
        return response.json();
      })
      .then(setMeditations)
      .catch((requestError) => {
        if (requestError.name !== "AbortError") setError(requestError.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE_URL}/sessions/history/${DEVICE_ID}?limit=50`, {
      credentials: "include",
      signal: controller.signal,
    })
      .then((response) => response.ok ? response.json() : { items: [] })
      .then((data) => setHistory(data.items ?? []))
      .catch((requestError) => {
        if (requestError.name !== "AbortError") setHistory([]);
      });
    return () => controller.abort();
  }, []);

  const categories = useMemo(
    () => [...new Set(meditations.map((item) => item.category))].sort(),
    [meditations]
  );

  const featuredMeditations = useMemo(
    () => meditations.filter((item) => item.is_featured).slice(0, 3),
    [meditations]
  );

  const personalizedMeditations = useMemo(
    () => rankMeditations(meditations, preferences, history).slice(0, 3),
    [history, meditations, preferences]
  );

  const preferenceLabels = useMemo(() => {
    if (!preferences) return [];
    const goals = GOAL_OPTIONS
      .filter((item) => preferences.goals?.includes(item.id))
      .map((item) => item.label);
    const durationPreference = DURATION_OPTIONS.find(
      (item) => item.id === preferences.duration
    );
    return [...goals.slice(0, 2), durationPreference?.label].filter(Boolean);
  }, [preferences]);

  const filteredMeditations = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return meditations.filter((item) => {
      const searchableText = [
        item.title,
        item.teacher_name,
        item.description,
        item.category,
        ...(item.tags ?? []),
        ...(item.benefits ?? []),
      ].join(" ").toLowerCase();

      return (
        (!normalizedQuery || searchableText.includes(normalizedQuery)) &&
        (category === "all" || item.category === category) &&
        (level === "all" || item.level.toLowerCase() === level) &&
        durationMatches(duration, item.duration_sec)
      );
    });
  }, [category, duration, level, meditations, query]);

  const hasFilters =
    query || category !== "all" || duration !== "all" || level !== "all";

  const clearFilters = () => {
    setQuery("");
    setCategory("all");
    setDuration("all");
    setLevel("all");
  };

  return (
    <main className="explore-page">
      <section className="explore-hero">
        <div className="explore-hero__orb explore-hero__orb--one" />
        <div className="explore-hero__orb explore-hero__orb--two" />
        <div className="site-shell explore-hero__content">
          <p className="eyebrow">Explore the library</p>
          <h1>How would you like<br />to feel?</h1>
          <p>
            Find a practice for this exact moment—whether you need deep rest,
            clear focus, or simply one quiet breath.
          </p>
          <label className="explore-search">
            <SearchIcon />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by title, teacher, feeling, or benefit"
              aria-label="Search meditations"
            />
            {query && <button onClick={() => setQuery("")} aria-label="Clear search">×</button>}
          </label>
          <button className="explore-personalize-button" onClick={openOnboarding}>
            <span>✦</span> {hasPreferences ? "Edit my preferences" : "Personalize my library"}
          </button>
        </div>
      </section>

      <div className="explore-content site-shell">
        {hasPreferences && personalizedMeditations.length > 0 && !hasFilters && (
          <section className="explore-personalized">
            <div className="explore-section-heading">
              <div>
                <p className="eyebrow">Made personal</p>
                <h2>For You</h2>
                <div className="preference-chips">
                  {preferenceLabels.map((label) => <span key={label}>{label}</span>)}
                  <button onClick={openOnboarding}>Adjust</button>
                </div>
              </div>
              <p>Selected from your intentions, preferred rhythm, and listening history.</p>
            </div>
            <div className="featured-library-grid">
              {personalizedMeditations.map((meditation) => (
                <MeditationCard
                  key={meditation.id}
                  meditation={meditation}
                  featured
                  reason={meditation.recommendationReason}
                />
              ))}
            </div>
          </section>
        )}

        {!hasPreferences && !shouldPrompt && !hasFilters && (
          <section className="personalization-invite">
            <div><span>✦</span><div><strong>Make this library yours</strong><p>Answer four quick questions for more relevant practices.</p></div></div>
            <button onClick={openOnboarding}>Personalize</button>
          </section>
        )}

        {featuredMeditations.length > 0 && !hasFilters && (
          <section className="explore-featured">
            <div className="explore-section-heading">
              <div>
                <p className="eyebrow">Chosen with care</p>
                <h2>Featured practices</h2>
              </div>
              <p>Thoughtful guidance for the moments that matter most.</p>
            </div>
            <div className="featured-library-grid">
              {featuredMeditations.map((meditation) => (
                <MeditationCard key={meditation.id} meditation={meditation} featured />
              ))}
            </div>
          </section>
        )}

        <section className="explore-library">
          <div className="explore-section-heading explore-section-heading--library">
            <div>
              <p className="eyebrow">{hasFilters ? "Your selection" : "All practices"}</p>
              <h2>{hasFilters ? "Find your moment" : "Something for every day"}</h2>
            </div>
            {!loading && !error && (
              <p>{filteredMeditations.length} {filteredMeditations.length === 1 ? "practice" : "practices"}</p>
            )}
          </div>

          <div className="explore-filters">
            <div className="category-filter" aria-label="Filter by category">
              <button className={category === "all" ? "active" : ""} onClick={() => setCategory("all")}>All</button>
              {categories.map((item) => (
                <button className={category === item ? "active" : ""} key={item} onClick={() => setCategory(item)}>
                  {item}
                </button>
              ))}
            </div>
            <div className="select-filters">
              <label>
                <span>Duration</span>
                <select value={duration} onChange={(event) => setDuration(event.target.value)}>
                  <option value="all">Any length</option>
                  <option value="short">Under 10 min</option>
                  <option value="medium">10–20 min</option>
                  <option value="long">Over 20 min</option>
                </select>
              </label>
              <label>
                <span>Level</span>
                <select value={level} onChange={(event) => setLevel(event.target.value)}>
                  <option value="all">All levels</option>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </label>
            </div>
          </div>

          {loading && (
            <div className="library-grid" aria-label="Loading meditations">
              {[1, 2, 3, 4, 5, 6].map((item) => <div className="library-skeleton" key={item} />)}
            </div>
          )}
          {error && (
            <div className="explore-state">
              <h3>We couldn’t open the library.</h3>
              <p>{error} Make sure the API is running, then refresh the page.</p>
            </div>
          )}
          {!loading && !error && filteredMeditations.length === 0 && (
            <div className="explore-state">
              <h3>No practices match those filters.</h3>
              <p>Try a different feeling, duration, or search phrase.</p>
              <button onClick={clearFilters}>Clear all filters</button>
            </div>
          )}
          {!loading && !error && filteredMeditations.length > 0 && (
            <div className="library-grid">
              {filteredMeditations.map((meditation) => (
                <MeditationCard key={meditation.id} meditation={meditation} />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

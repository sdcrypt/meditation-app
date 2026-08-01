import { cleanListValues } from "./listValues";

export const GOAL_OPTIONS = [
  { id: "stress", label: "Less stress", icon: "≈", keywords: ["stress", "calm", "relax", "anxiety", "breath"] },
  { id: "sleep", label: "Better sleep", icon: "☾", keywords: ["sleep", "rest", "bedtime", "evening", "deep"] },
  { id: "focus", label: "More focus", icon: "◎", keywords: ["focus", "clarity", "energy", "morning", "concentration"] },
  { id: "healing", label: "Emotional healing", icon: "♡", keywords: ["healing", "emotion", "grief", "release", "self-love"] },
  { id: "spiritual", label: "Spiritual growth", icon: "✦", keywords: ["spiritual", "chant", "mantra", "awareness", "compassion"] },
  { id: "mindfulness", label: "Daily mindfulness", icon: "◌", keywords: ["mindful", "presence", "breath", "calm", "awareness"] },
];

export const DURATION_OPTIONS = [
  { id: "short", label: "5–10 minutes", detail: "A small daily pause" },
  { id: "medium", label: "10–20 minutes", detail: "Time to settle deeply" },
  { id: "long", label: "20+ minutes", detail: "A spacious practice" },
  { id: "any", label: "Any length", detail: "Choose for me" },
];

export const EXPERIENCE_OPTIONS = [
  { id: "beginner", label: "I’m new", detail: "Gentle, accessible guidance" },
  { id: "intermediate", label: "Some experience", detail: "I practice occasionally" },
  { id: "advanced", label: "Experienced", detail: "I have an established practice" },
  { id: "all levels", label: "Open to anything", detail: "Let the moment decide" },
];

export const PRACTICE_TIME_OPTIONS = [
  { id: "morning", label: "Morning", icon: "◡", keywords: ["morning", "focus", "energy", "clarity"] },
  { id: "afternoon", label: "Afternoon", icon: "○", keywords: ["focus", "reset", "stress", "calm"] },
  { id: "evening", label: "Evening", icon: "◠", keywords: ["evening", "relax", "release", "calm"] },
  { id: "bedtime", label: "Before bed", icon: "☾", keywords: ["sleep", "bedtime", "rest", "deep"] },
];

const durationMatchesPreference = (preference, seconds) => {
  if (preference === "short") return seconds <= 600;
  if (preference === "medium") return seconds > 600 && seconds <= 1200;
  if (preference === "long") return seconds > 1200;
  return true;
};

const durationPreferenceLabel = (preference) =>
  DURATION_OPTIONS.find((item) => item.id === preference)?.label;

const searchableMeditationText = (meditation) =>
  [
    meditation.title,
    meditation.category,
    meditation.description,
    ...cleanListValues(meditation.tags),
    ...cleanListValues(meditation.benefits),
  ].join(" ").toLowerCase();

const addReason = (reasons, reason) => {
  if (reason && !reasons.includes(reason)) reasons.push(reason);
};

const daysSince = (value) => {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return (Date.now() - timestamp) / 86_400_000;
};

const getFavoriteMeditations = (favorites = []) =>
  favorites.map((favorite) => favorite.meditation).filter(Boolean);

const buildProgramBoosts = (enrolledPrograms = []) => {
  const boosts = new Map();
  enrolledPrograms.forEach((enrollment) => {
    const program = enrollment.program ?? enrollment;
    if (!program || program.completion_percent >= 100) return;
    if (program.next_meditation?.id) {
      boosts.set(program.next_meditation.id, {
        score: 50,
        reason: `Next in ${program.title}`,
      });
    }
    (program.meditations ?? []).forEach((item) => {
      if (!item?.meditation?.id || item.is_completed) return;
      const existing = boosts.get(item.meditation.id);
      if (!existing) {
        boosts.set(item.meditation.id, {
          score: item.is_started ? 35 : 18,
          reason: item.is_started ? `Continue ${program.title}` : `Part of ${program.title}`,
        });
      }
    });
  });
  return boosts;
};

export const rankMeditations = (
  meditations,
  preferences,
  history = [],
  favorites = [],
  enrolledPrograms = []
) => {
  if (!preferences) return meditations;

  const completedIds = new Set(
    history.filter((item) => item.is_completed).map((item) => item.meditation_id)
  );
  const recentCompletedIds = new Set(
    history
      .filter((item) => item.is_completed && (daysSince(item.completed_at || item.last_activity_at) ?? 999) <= 14)
      .map((item) => item.meditation_id)
  );
  const historyCategoryCounts = history.reduce((counts, item) => {
    const category = item.category?.toLowerCase();
    if (category) {
      counts[category] =
        (counts[category] || 0) + (item.is_completed ? 2 : 1);
    }
    return counts;
  }, {});
  const selectedGoals = GOAL_OPTIONS.filter((goal) =>
    preferences.goals?.includes(goal.id)
  );
  const practiceTime = PRACTICE_TIME_OPTIONS.find(
    (item) => item.id === preferences.practiceTime
  );
  const favoriteMeditations = getFavoriteMeditations(favorites);
  const favoriteTexts = favoriteMeditations.map(searchableMeditationText);
  const favoriteCategories = new Set(
    favoriteMeditations
      .map((item) => item.category?.toLowerCase())
      .filter(Boolean)
  );
  const favoriteTeachers = new Set(
    favoriteMeditations
      .map((item) => item.teacher_name?.toLowerCase())
      .filter(Boolean)
  );
  const favoriteIds = new Set(
    favorites.map((item) => item.meditation_id).filter(Boolean)
  );
  const programBoosts = buildProgramBoosts(enrolledPrograms);

  return meditations
    .map((meditation) => {
      const text = searchableMeditationText(meditation);
      let score = meditation.is_featured ? 5 : 0;
      const reasons = [];
      const programBoost = programBoosts.get(meditation.id);
      if (programBoost) {
        score += programBoost.score;
        addReason(reasons, programBoost.reason);
      }

      selectedGoals.forEach((goal) => {
        if (goal.keywords.some((keyword) => text.includes(keyword))) {
          score += 30;
          addReason(reasons, `Because you chose ${goal.label.toLowerCase()}`);
        }
      });

      if (durationMatchesPreference(preferences.duration, meditation.duration_sec)) {
        score += 15;
        const label = durationPreferenceLabel(preferences.duration);
        if (label && preferences.duration !== "any") {
          addReason(reasons, `Fits your ${label.toLowerCase()} preference`);
        }
      }

      const meditationLevel = meditation.level?.toLowerCase();
      if (
        preferences.experience === "all levels" ||
        meditationLevel === preferences.experience ||
        meditationLevel === "all levels"
      ) {
        score += 15;
        if (preferences.experience && preferences.experience !== "all levels") {
          addReason(reasons, `${preferences.experience} friendly`);
        }
      }

      if (practiceTime?.keywords.some((keyword) => text.includes(keyword))) {
        score += 8;
        addReason(reasons, `For your ${practiceTime.label.toLowerCase()}`);
      }

      const categoryHistory =
        historyCategoryCounts[meditation.category?.toLowerCase()] || 0;
      if (categoryHistory) {
        score += Math.min(10, categoryHistory * 2.5);
        addReason(reasons, `More ${meditation.category}`);
      }

      if (favoriteCategories.has(meditation.category?.toLowerCase())) {
        score += 10;
        addReason(reasons, "Similar to saved practices");
      }
      if (favoriteTeachers.has(meditation.teacher_name?.toLowerCase())) {
        score += 6;
        addReason(reasons, "A teacher you saved");
      }
      if (
        favoriteTexts.some((favoriteText) =>
          cleanListValues(meditation.tags).some((tag) => favoriteText.includes(tag.toLowerCase()))
        )
      ) {
        score += 8;
        addReason(reasons, "Matches your saved themes");
      }

      if (favoriteIds.has(meditation.id)) {
        score += 4;
        addReason(reasons, "Saved by you");
      }

      if (completedIds.has(meditation.id)) score -= 10;
      if (recentCompletedIds.has(meditation.id)) score -= 25;
      if (!history.some((item) => item.meditation_id === meditation.id)) score += 3;
      if (meditation.is_featured) addReason(reasons, "Featured practice");

      return {
        ...meditation,
        personalizationScore: score,
        recommendationReasons: reasons.slice(0, 3),
        recommendationReason: reasons.slice(0, 2).join(" · ") || "Selected for you",
      };
    })
    .sort(
      (first, second) =>
        second.personalizationScore - first.personalizationScore ||
        Number(second.is_featured) - Number(first.is_featured) ||
        second.id - first.id
    );
};

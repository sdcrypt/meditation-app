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

const searchableMeditationText = (meditation) =>
  [
    meditation.title,
    meditation.category,
    meditation.description,
    ...(meditation.tags ?? []),
    ...(meditation.benefits ?? []),
  ].join(" ").toLowerCase();

export const rankMeditations = (meditations, preferences, history = []) => {
  if (!preferences) return meditations;

  const completedIds = new Set(
    history.filter((item) => item.is_completed).map((item) => item.meditation_id)
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

  return meditations
    .map((meditation) => {
      const text = searchableMeditationText(meditation);
      let score = meditation.is_featured ? 0.5 : 0;
      const reasons = [];

      selectedGoals.forEach((goal) => {
        if (goal.keywords.some((keyword) => text.includes(keyword))) {
          score += 6;
          reasons.push(goal.label);
        }
      });

      if (durationMatchesPreference(preferences.duration, meditation.duration_sec)) {
        score += 3;
        reasons.push("Your preferred length");
      }

      const meditationLevel = meditation.level?.toLowerCase();
      if (
        preferences.experience === "all levels" ||
        meditationLevel === preferences.experience ||
        meditationLevel === "all levels"
      ) {
        score += 2;
      }

      if (practiceTime?.keywords.some((keyword) => text.includes(keyword))) {
        score += 1.5;
        reasons.push(`For your ${practiceTime.label.toLowerCase()}`);
      }

      const categoryHistory =
        historyCategoryCounts[meditation.category?.toLowerCase()] || 0;
      if (categoryHistory) {
        score += Math.min(4, categoryHistory * 1.25);
        reasons.push("Inspired by your history");
      }

      if (completedIds.has(meditation.id)) score -= 1.5;

      return {
        ...meditation,
        personalizationScore: score,
        recommendationReason: reasons[0] || "Selected for you",
      };
    })
    .sort(
      (first, second) =>
        second.personalizationScore - first.personalizationScore ||
        Number(second.is_featured) - Number(first.is_featured) ||
        second.id - first.id
    );
};

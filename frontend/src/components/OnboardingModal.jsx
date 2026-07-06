import { useEffect, useState } from "react";
import { usePreferences } from "../context/PreferencesContext";
import {
  DURATION_OPTIONS,
  EXPERIENCE_OPTIONS,
  GOAL_OPTIONS,
  PRACTICE_TIME_OPTIONS,
} from "../utils/personalization";

const EMPTY_PREFERENCES = {
  goals: [],
  duration: "",
  experience: "",
  practiceTime: "",
};

const steps = [
  { eyebrow: "Your intention", title: "What would you like support with?", note: "Choose as many as feel true today." },
  { eyebrow: "Your rhythm", title: "How much time feels realistic?", note: "We’ll prioritize practices that fit your day." },
  { eyebrow: "Your experience", title: "Where are you starting from?", note: "There’s no right level—only what feels comfortable." },
  { eyebrow: "Your moment", title: "When do you usually pause?", note: "We’ll tune recommendations to that part of your day." },
];

export default function OnboardingModal() {
  const {
    preferences,
    isOnboardingOpen,
    closeOnboarding,
    dismissOnboarding,
    savePreferences,
  } = usePreferences();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(EMPTY_PREFERENCES);

  useEffect(() => {
    if (!isOnboardingOpen) return;
    setStep(0);
    setDraft(preferences ? {
      goals: preferences.goals ?? [],
      duration: preferences.duration ?? "",
      experience: preferences.experience ?? "",
      practiceTime: preferences.practiceTime ?? "",
    } : EMPTY_PREFERENCES);
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOnboardingOpen, preferences]);

  if (!isOnboardingOpen) return null;

  const toggleGoal = (goalId) => {
    setDraft((current) => ({
      ...current,
      goals: current.goals.includes(goalId)
        ? current.goals.filter((item) => item !== goalId)
        : [...current.goals, goalId],
    }));
  };

  const selectedValue =
    step === 1 ? draft.duration :
    step === 2 ? draft.experience :
    step === 3 ? draft.practiceTime :
    draft.goals;
  const canContinue = Array.isArray(selectedValue)
    ? selectedValue.length > 0
    : Boolean(selectedValue);

  const chooseSingleValue = (value) => {
    const field = step === 1 ? "duration" : step === 2 ? "experience" : "practiceTime";
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const options =
    step === 0 ? GOAL_OPTIONS :
    step === 1 ? DURATION_OPTIONS :
    step === 2 ? EXPERIENCE_OPTIONS :
    PRACTICE_TIME_OPTIONS;

  return (
    <div className="onboarding-overlay" role="presentation">
      <section className="onboarding-modal" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
        <div className="onboarding-visual">
          <div className="onboarding-visual__sun" />
          <div className="onboarding-visual__ridge onboarding-visual__ridge--back" />
          <div className="onboarding-visual__ridge onboarding-visual__ridge--front" />
          <div className="onboarding-visual__copy">
            <span>still.</span>
            <blockquote>“A practice should meet you exactly where you are.”</blockquote>
          </div>
        </div>
        <div className="onboarding-content">
          <button
            className="onboarding-close"
            onClick={preferences ? closeOnboarding : dismissOnboarding}
            aria-label="Close onboarding"
          >
            ×
          </button>
          <div className="onboarding-progress">
            {steps.map((_, index) => <i className={index <= step ? "active" : ""} key={index} />)}
          </div>
          <p className="eyebrow">{steps[step].eyebrow} · {step + 1} of 4</p>
          <h2 id="onboarding-title">{steps[step].title}</h2>
          <p className="onboarding-note">{steps[step].note}</p>

          <div className={`onboarding-options onboarding-options--step-${step + 1}`}>
            {options.map((option) => {
              const selected = step === 0
                ? draft.goals.includes(option.id)
                : selectedValue === option.id;
              return (
                <button
                  className={selected ? "selected" : ""}
                  key={option.id}
                  onClick={() => step === 0 ? toggleGoal(option.id) : chooseSingleValue(option.id)}
                >
                  {option.icon && <span>{option.icon}</span>}
                  <div><strong>{option.label}</strong>{option.detail && <small>{option.detail}</small>}</div>
                  <i>{selected ? "✓" : ""}</i>
                </button>
              );
            })}
          </div>

          <div className="onboarding-actions">
            {step > 0 ? (
              <button className="onboarding-back" onClick={() => setStep((value) => value - 1)}>Back</button>
            ) : (
              <button className="onboarding-back" onClick={preferences ? closeOnboarding : dismissOnboarding}>
                {preferences ? "Cancel" : "Not now"}
              </button>
            )}
            <button
              className="onboarding-next"
              disabled={!canContinue}
              onClick={() => step === steps.length - 1
                ? savePreferences(draft)
                : setStep((value) => value + 1)}
            >
              {step === steps.length - 1 ? (preferences ? "Save changes" : "Create my recommendations") : "Continue"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

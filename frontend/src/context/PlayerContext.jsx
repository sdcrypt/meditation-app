import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { API_BASE_URL, DEVICE_ID } from "../config";
import { csrfFetch } from "../utils/authFetch";

const PlayerContext = createContext(null);
const CURRENT_KEY = "still_current_meditation";
const CURRENT_PROGRAM_KEY = "still_current_program";
const PROGRESS_KEY = "still_meditation_progress";
const VOLUME_KEY = "still_player_volume";
const SPEED_KEY = "still_player_speed";

const readJson = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};

const clamp = (value, minimum, maximum) =>
  Math.min(Math.max(Number(value) || 0, minimum), maximum);

export function PlayerProvider({ children }) {
  const [currentMeditation, setCurrentMeditation] = useState(() =>
    readJson(CURRENT_KEY, null)
  );
  const [currentProgramId, setCurrentProgramId] = useState(() =>
    readJson(CURRENT_PROGRAM_KEY, null)
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeProgram, setActiveProgram] = useState(null);
  const [lastCompletedPlayback, setLastCompletedPlayback] = useState(null);
  const [nextPrompt, setNextPrompt] = useState(null);
  const [completionCelebration, setCompletionCelebration] = useState(null);
  const [volume, setVolumeState] = useState(() =>
    clamp(localStorage.getItem(VOLUME_KEY) ?? 0.8, 0, 1)
  );
  const [playbackRate, setPlaybackRateState] = useState(() =>
    clamp(localStorage.getItem(SPEED_KEY) ?? 1, 0.5, 2)
  );
  const [trackingError, setTrackingError] = useState("");

  const audioRef = useRef(null);
  const currentMeditationRef = useRef(currentMeditation);
  const currentProgramIdRef = useRef(currentProgramId);
  const sessionIdRef = useRef(null);
  const sessionPromiseRef = useRef(null);
  const listenedSecondsRef = useRef(0);
  const lastAccountingAtRef = useRef(null);
  const pendingAutoplayRef = useRef(false);
  const lastLocalSaveRef = useRef(0);

  useEffect(() => {
    currentMeditationRef.current = currentMeditation;
  }, [currentMeditation]);

  useEffect(() => {
    currentProgramIdRef.current = currentProgramId;
  }, [currentProgramId]);

  const progressKey = useCallback(
    (meditationId, programId = currentProgramIdRef.current) =>
      `${programId || "standalone"}:${meditationId}`,
    []
  );

  const getProgress = useCallback((meditationId, programId) => {
    const progress = readJson(PROGRESS_KEY, {});
    return Number(progress[progressKey(meditationId, programId)]) || 0;
  }, [progressKey]);

  const saveProgress = useCallback((meditationId, position, programId) => {
    const progress = readJson(PROGRESS_KEY, {});
    progress[progressKey(meditationId, programId)] = Math.max(0, Math.floor(position));
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  }, [progressKey]);

  const clearProgress = useCallback((meditationId, programId) => {
    const progress = readJson(PROGRESS_KEY, {});
    delete progress[progressKey(meditationId, programId)];
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  }, [progressKey]);

  const accountListeningTime = useCallback(() => {
    if (lastAccountingAtRef.current === null) return;
    const elapsed = (Date.now() - lastAccountingAtRef.current) / 1000;
    // Ignore long gaps caused by suspended/backgrounded tabs.
    listenedSecondsRef.current += clamp(elapsed, 0, 15);
    lastAccountingAtRef.current = Date.now();
  }, []);

  const ensureSession = useCallback(async () => {
    if (Number.isInteger(sessionIdRef.current)) return sessionIdRef.current;
    if (sessionPromiseRef.current) return sessionPromiseRef.current;

    const meditation = currentMeditationRef.current;
    const programId = currentProgramIdRef.current;
    if (!meditation?.id || !meditation.audio_url) return null;

    sessionPromiseRef.current = csrfFetch(`${API_BASE_URL}/sessions/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        meditation_id: meditation.id,
        device_id: Number(DEVICE_ID),
        program_id: programId || null,
      }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Listening progress is temporarily unavailable.");
        const session = await response.json();
        sessionIdRef.current = session.id;
        listenedSecondsRef.current = session.seconds_listened || 0;

        const audio = audioRef.current;
        const localPosition = getProgress(meditation.id, programId);
        const resumePosition = Math.max(
          localPosition,
          session.last_position_sec || 0
        );
        if (
          audio &&
          resumePosition > audio.currentTime + 2 &&
          resumePosition < (audio.duration || meditation.duration_sec) - 2
        ) {
          audio.currentTime = resumePosition;
          setCurrentTime(resumePosition);
        }
        setTrackingError("");
        return session.id;
      })
      .catch((error) => {
        sessionIdRef.current = null;
        setTrackingError(error.message);
        return null;
      })
      .finally(() => {
        sessionPromiseRef.current = null;
      });

    return sessionPromiseRef.current;
  }, [getProgress]);

  const sendProgress = useCallback(async ({ keepalive = false } = {}) => {
    const meditation = currentMeditationRef.current;
    const audio = audioRef.current;
    const activeSessionId = sessionIdRef.current;
    if (!meditation || !audio || !Number.isInteger(activeSessionId)) return;

    const payload = {
      device_id: Number(DEVICE_ID),
      position_sec: Math.floor(audio.currentTime || 0),
      seconds_listened: Math.floor(listenedSecondsRef.current),
    };
    saveProgress(meditation.id, payload.position_sec);

    try {
      const response = await csrfFetch(
        `${API_BASE_URL}/sessions/${activeSessionId}/progress`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
          keepalive,
        }
      );
      if (!response.ok) throw new Error();
      setTrackingError("");
    } catch {
      setTrackingError("Progress will be saved locally until the connection returns.");
    }
  }, [saveProgress]);

  const togglePlayback = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !currentMeditationRef.current?.audio_url) return;
    if (audio.paused) {
      try {
        await audio.play();
      } catch {
        setIsPlaying(false);
      }
    } else {
      audio.pause();
    }
  }, []);

  const playMeditation = useCallback((meditation, options = {}) => {
    const nextProgramId = options.programId ? Number(options.programId) : null;
    const audio = audioRef.current;
    setNextPrompt(null);
    setCompletionCelebration(null);
    if (
      currentMeditationRef.current?.id === meditation.id &&
      currentProgramIdRef.current === nextProgramId
    ) {
      togglePlayback();
      return;
    }

    if (audio && !audio.paused) {
      accountListeningTime();
      void sendProgress();
      audio.pause();
    }

    sessionIdRef.current = null;
    sessionPromiseRef.current = null;
    listenedSecondsRef.current = 0;
    lastAccountingAtRef.current = null;
    pendingAutoplayRef.current = true;
    setCurrentTime(0);
    setDuration(meditation.duration_sec || 0);
    setIsPlaying(false);
    setCurrentMeditation(meditation);
    setCurrentProgramId(nextProgramId);
    currentMeditationRef.current = meditation;
    currentProgramIdRef.current = nextProgramId;
    localStorage.setItem(CURRENT_KEY, JSON.stringify(meditation));
    if (nextProgramId) {
      localStorage.setItem(CURRENT_PROGRAM_KEY, JSON.stringify(nextProgramId));
    } else {
      localStorage.removeItem(CURRENT_PROGRAM_KEY);
    }
  }, [accountListeningTime, sendProgress, togglePlayback]);

  useEffect(() => {
    if (!currentProgramId) {
      setActiveProgram(null);
      return undefined;
    }

    const controller = new AbortController();
    fetch(`${API_BASE_URL}/programs/${currentProgramId}`, {
      credentials: "include",
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then(setActiveProgram)
      .catch((error) => {
        if (error.name !== "AbortError") setActiveProgram(null);
      });
    return () => controller.abort();
  }, [currentProgramId, currentMeditation?.id, lastCompletedPlayback]);

  const activeProgramItem =
    activeProgram?.meditations?.find(
      (item) => item.meditation.id === currentMeditation?.id
    ) ?? null;
  const nextProgramItem = activeProgramItem
    ? activeProgram.meditations.find(
        (item) => item.position > activeProgramItem.position
      )
    : null;
  const nextProgramMeditation = nextProgramItem?.meditation ?? null;

  const playNextProgramMeditation = useCallback(() => {
    const currentId = currentMeditationRef.current?.id;
    const program = activeProgram;
    const currentItem = program?.meditations?.find(
      (item) => item.meditation.id === currentId
    );
    const nextItem = currentItem
      ? program.meditations.find((item) => item.position > currentItem.position)
      : null;
    if (nextItem?.meditation) {
      playMeditation(nextItem.meditation, { programId: currentProgramIdRef.current });
    }
  }, [activeProgram, playMeditation]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentMeditation?.audio_url) return;
    audio.load();
    if (pendingAutoplayRef.current) {
      pendingAutoplayRef.current = false;
      audio.play().catch(() => setIsPlaying(false));
    }
  }, [currentMeditation]);

  const seek = useCallback((position) => {
    const audio = audioRef.current;
    if (!audio) return;
    const maximum = Number.isFinite(audio.duration)
      ? audio.duration
      : currentMeditationRef.current?.duration_sec || 0;
    const nextPosition = clamp(position, 0, maximum);
    audio.currentTime = nextPosition;
    setCurrentTime(nextPosition);
    if (currentMeditationRef.current) {
      saveProgress(currentMeditationRef.current.id, nextPosition);
    }
  }, [saveProgress]);

  const skip = useCallback((seconds) => {
    seek((audioRef.current?.currentTime || 0) + seconds);
  }, [seek]);

  const setVolume = useCallback((nextVolume) => {
    const normalized = clamp(nextVolume, 0, 1);
    if (audioRef.current) audioRef.current.volume = normalized;
    setVolumeState(normalized);
    localStorage.setItem(VOLUME_KEY, String(normalized));
  }, []);

  const setPlaybackRate = useCallback((nextRate) => {
    const normalized = clamp(nextRate, 0.5, 2);
    if (audioRef.current) audioRef.current.playbackRate = normalized;
    setPlaybackRateState(normalized);
    localStorage.setItem(SPEED_KEY, String(normalized));
  }, []);

  const closePlayer = useCallback(() => {
    const audio = audioRef.current;
    if (audio && !audio.paused) accountListeningTime();
    void sendProgress();
    audio?.pause();
    setCurrentMeditation(null);
    currentMeditationRef.current = null;
    setCurrentProgramId(null);
    currentProgramIdRef.current = null;
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setNextPrompt(null);
    setCompletionCelebration(null);
    sessionIdRef.current = null;
    localStorage.removeItem(CURRENT_KEY);
    localStorage.removeItem(CURRENT_PROGRAM_KEY);
  }, [accountListeningTime, sendProgress]);

  const handlePlay = () => {
    setIsPlaying(true);
    lastAccountingAtRef.current = Date.now();
    void ensureSession();
  };

  const handlePause = () => {
    if (lastAccountingAtRef.current !== null) accountListeningTime();
    lastAccountingAtRef.current = null;
    setIsPlaying(false);
    void sendProgress();
  };

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentTime(audio.currentTime);
    if (
      currentMeditationRef.current &&
      Date.now() - lastLocalSaveRef.current > 2000
    ) {
      saveProgress(currentMeditationRef.current.id, audio.currentTime);
      lastLocalSaveRef.current = Date.now();
    }
  };

  const handleLoadedMetadata = () => {
    const audio = audioRef.current;
    const meditation = currentMeditationRef.current;
    if (!audio || !meditation) return;
    audio.volume = volume;
    audio.playbackRate = playbackRate;
    const mediaDuration = Number.isFinite(audio.duration)
      ? audio.duration
      : meditation.duration_sec;
    setDuration(mediaDuration);
    const savedPosition = getProgress(meditation.id);
    if (savedPosition > 0 && savedPosition < mediaDuration - 2) {
      audio.currentTime = savedPosition;
      setCurrentTime(savedPosition);
    }
  };

  const handleEnded = async () => {
    accountListeningTime();
    lastAccountingAtRef.current = null;
    setIsPlaying(false);

    const meditation = currentMeditationRef.current;
    const programId = currentProgramIdRef.current;
    const program = activeProgram;
    const currentItem = program?.meditations?.find(
      (item) => item.meditation.id === meditation?.id
    );
    const nextItem = currentItem
      ? program.meditations.find((item) => item.position > currentItem.position)
      : null;
    const activeSessionId = await ensureSession();
    if (meditation && Number.isInteger(activeSessionId)) {
      try {
        await csrfFetch(`${API_BASE_URL}/sessions/${activeSessionId}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            device_id: Number(DEVICE_ID),
            position_sec: Math.floor(duration || meditation.duration_sec),
            seconds_listened: Math.floor(listenedSecondsRef.current),
          }),
        });
        setLastCompletedPlayback({
          meditationId: meditation.id,
          programId,
          completedAt: Date.now(),
        });
        if (programId && program && nextItem?.meditation) {
          setNextPrompt({
            programId,
            programTitle: program.title,
            currentTitle: meditation.title,
            nextMeditation: nextItem.meditation,
            nextPosition: nextItem.position,
            totalMeditations: program.total_meditations,
          });
          setCompletionCelebration(null);
        } else if (programId && program && currentItem) {
          setCompletionCelebration({
            programId,
            programTitle: program.title,
            totalMeditations: program.total_meditations,
            completedAt: Date.now(),
          });
          setNextPrompt(null);
        } else {
          setNextPrompt(null);
          setCompletionCelebration(null);
        }
      } catch {
        setTrackingError("Completion will sync when you listen again.");
      }
      clearProgress(meditation.id);
    }
    sessionIdRef.current = null;
    listenedSecondsRef.current = 0;
  };

  useEffect(() => {
    if (!isPlaying) return undefined;
    const heartbeat = window.setInterval(() => {
      accountListeningTime();
      void sendProgress();
    }, 10_000);
    return () => window.clearInterval(heartbeat);
  }, [accountListeningTime, isPlaying, sendProgress]);

  useEffect(() => {
    const handlePageHide = () => {
      if (lastAccountingAtRef.current !== null) accountListeningTime();
      void sendProgress({ keepalive: true });
    };
    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, [accountListeningTime, sendProgress]);

  return (
    <PlayerContext.Provider
      value={{
        currentMeditation,
        currentProgramId,
        activeProgram,
        activeProgramItem,
        nextProgramMeditation,
        nextPrompt,
        completionCelebration,
        isPlaying,
        currentTime,
        duration,
        volume,
        playbackRate,
        trackingError,
        lastCompletedPlayback,
        playMeditation,
        playNextProgramMeditation,
        dismissNextPrompt: () => setNextPrompt(null),
        dismissCompletionCelebration: () => setCompletionCelebration(null),
        togglePlayback,
        seek,
        skip,
        setVolume,
        setPlaybackRate,
        closePlayer,
      }}
    >
      {children}
      <audio
        ref={audioRef}
        src={currentMeditation?.audio_url || undefined}
        preload="metadata"
        onPlay={handlePlay}
        onPause={handlePause}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onDurationChange={handleLoadedMetadata}
        onEnded={handleEnded}
      />
    </PlayerContext.Provider>
  );
}

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (!context) throw new Error("usePlayer must be used within PlayerProvider");
  return context;
};

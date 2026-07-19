import { useState } from "react";
import { Link } from "react-router-dom";
import { usePlayer } from "../context/PlayerContext";
import MeditationArtwork from "./MeditationArtwork";

const formatTime = (seconds) => {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

const Icon = ({ type }) => {
  const paths = {
    play: <path d="m9 6 9 6-9 6V6Z" />,
    pause: <><path d="M9 6v12M15 6v12" /></>,
    back: <><path d="M5 9V5h4" /><path d="M6.5 17a7 7 0 1 0-.9-7.7" /><text x="12" y="15">15</text></>,
    forward: <><path d="M19 9V5h-4" /><path d="M17.5 17a7 7 0 1 1 .9-7.7" /><text x="12" y="15">15</text></>,
    volume: <><path d="M5 10v4h3l4 3V7l-4 3H5Z" /><path d="M15 9.5a4 4 0 0 1 0 5" /></>,
    close: <><path d="m7 7 10 10M17 7 7 17" /></>,
    chevron: <path d="m7 14 5-5 5 5" />,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[type]}</svg>;
};

export default function PersistentPlayer() {
  const {
    currentMeditation,
    currentProgramId,
    activeProgram,
    activeProgramItem,
    nextProgramMeditation,
    isPlaying,
    currentTime,
    duration,
    volume,
    playbackRate,
    trackingError,
    nextPrompt,
    togglePlayback,
    seek,
    skip,
    setVolume,
    setPlaybackRate,
    playNextProgramMeditation,
    dismissNextPrompt,
    closePlayer,
  } = usePlayer();
  const [mobileExpanded, setMobileExpanded] = useState(false);

  if (!currentMeditation) return null;

  const remaining = Math.max(0, duration - currentTime);
  const progress = duration ? (currentTime / duration) * 100 : 0;
  const meditationLink = currentProgramId
    ? `/meditations/${currentMeditation.id}?program=${currentProgramId}`
    : `/meditations/${currentMeditation.id}`;

  return (
    <aside
      className={`persistent-player ${mobileExpanded ? "is-expanded" : ""} ${currentProgramId ? "has-program" : ""}`}
      aria-label="Meditation player"
    >
      <div className="persistent-player__progress">
        <input
          type="range"
          min="0"
          max={duration || 1}
          step="0.1"
          value={Math.min(currentTime, duration || 1)}
          onChange={(event) => seek(Number(event.target.value))}
          aria-label="Playback position"
          style={{ "--player-progress": `${progress}%` }}
        />
      </div>
      <div className="persistent-player__inner">
        <div className="persistent-player__meditation">
          <MeditationArtwork meditation={currentMeditation} />
          <div>
            <Link to={meditationLink}>{currentMeditation.title}</Link>
            <span>{currentMeditation.teacher_name || "Still guide"}</span>
          </div>
        </div>

        {currentProgramId && (
          <div className="persistent-player__program">
            <div>
              <Link to={`/programs/${currentProgramId}`}>
                {activeProgram?.title || "Program"}
              </Link>
              <span>
                {activeProgramItem && activeProgram
                  ? `Step ${activeProgramItem.position} of ${activeProgram.total_meditations}`
                  : "Program session"}
              </span>
            </div>
            <div className="persistent-player__program-actions">
              <Link to={`/programs/${currentProgramId}`}>Back to program</Link>
              <button
                onClick={playNextProgramMeditation}
                disabled={!nextProgramMeditation}
                title={nextProgramMeditation ? nextProgramMeditation.title : "No next meditation"}
              >
                Next
              </button>
            </div>
          </div>
        )}

        <div className="persistent-player__transport">
          <button onClick={() => skip(-15)} aria-label="Back 15 seconds"><Icon type="back" /></button>
          <button className="persistent-player__play" onClick={togglePlayback} aria-label={isPlaying ? "Pause" : "Play"}>
            <Icon type={isPlaying ? "pause" : "play"} />
          </button>
          <button onClick={() => skip(15)} aria-label="Forward 15 seconds"><Icon type="forward" /></button>
        </div>

        <div className="persistent-player__timeline">
          <span>{formatTime(currentTime)}</span>
          <input
            type="range"
            min="0"
            max={duration || 1}
            step="0.1"
            value={Math.min(currentTime, duration || 1)}
            onChange={(event) => seek(Number(event.target.value))}
            aria-label="Playback position"
            style={{ "--player-progress": `${progress}%` }}
          />
          <span>-{formatTime(remaining)}</span>
        </div>

        <div className="persistent-player__settings">
          <select
            value={playbackRate}
            onChange={(event) => setPlaybackRate(Number(event.target.value))}
            aria-label="Playback speed"
          >
            <option value="0.75">0.75×</option>
            <option value="1">1×</option>
            <option value="1.25">1.25×</option>
            <option value="1.5">1.5×</option>
            <option value="2">2×</option>
          </select>
          <label className="persistent-player__volume">
            <Icon type="volume" />
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(event) => setVolume(Number(event.target.value))}
              aria-label="Volume"
              style={{ "--player-progress": `${volume * 100}%` }}
            />
          </label>
        </div>

        <button className="persistent-player__expand" onClick={() => setMobileExpanded((value) => !value)} aria-label="Expand player">
          <Icon type="chevron" />
        </button>
        <button className="persistent-player__close" onClick={closePlayer} aria-label="Close player"><Icon type="close" /></button>
      </div>
      {nextPrompt && (
        <div className="persistent-player__next-prompt" role="status">
          <div>
            <span>Program step complete</span>
            <strong>Next: {nextPrompt.nextMeditation.title}</strong>
            <small>
              {nextPrompt.programTitle} · Step {nextPrompt.nextPosition} of {nextPrompt.totalMeditations}
            </small>
          </div>
          <button onClick={playNextProgramMeditation}>Play next</button>
          <button onClick={dismissNextPrompt}>Not now</button>
        </div>
      )}
      {trackingError && <p className="persistent-player__status">{trackingError}</p>}
    </aside>
  );
}

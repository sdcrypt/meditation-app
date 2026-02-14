import { useEffect, useState } from "react";
import { API_BASE_URL, DEVICE_ID } from "../config";

export default function Explore() {
  const [meditations, setMeditations] = useState([]);
  const [activeSessions, setActiveSessions] = useState({}); 
  // stores meditationId -> sessionId mapping

  useEffect(() => {
    fetch(`${API_BASE_URL}/meditations`)
      .then((res) => res.json())
      .then((data) => setMeditations(data))
      .catch((err) => console.error("Error fetching meditations:", err));
  }, []);

  const startSession = async (meditationId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/sessions/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meditation_id: meditationId,
          device_id: DEVICE_ID,
        }),
      });

      const data = await res.json();

      setActiveSessions((prev) => ({
        ...prev,
        [meditationId]: data.id,
      }));
    } catch (err) {
      console.error("Error starting session:", err);
    }
  };

  const completeSession = async (meditationId, durationSec) => {
    const sessionId = activeSessions[meditationId];
    if (!sessionId) return;

    try {
      await fetch(`${API_BASE_URL}/sessions/${sessionId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seconds_listened: durationSec,
        }),
      });

      setActiveSessions((prev) => {
        const updated = { ...prev };
        delete updated[meditationId];
        return updated;
      });

    } catch (err) {
      console.error("Error completing session:", err);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-semibold">Explore</h2>

      {meditations.map((m) => (
        <div
          key={m.id}
          className="p-4 rounded-xl bg-gray-900 border border-gray-800"
        >
          <div className="font-medium text-lg">{m.title}</div>

          <div className="text-sm text-gray-400 mb-3">
            {m.category.toUpperCase()} • {Math.round(m.duration_sec / 60)} min
          </div>

          {m.audio_url ? (
            <audio
              src={m.audio_url}
              controls
              className="w-full"
              onPlay={() => startSession(m.id)}
              onEnded={() => completeSession(m.id, m.duration_sec)}
            />
          ) : (
            <div className="text-red-400 text-sm">
              Audio not available
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

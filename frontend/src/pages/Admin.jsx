/**
 * @file Admin.jsx
 * @description Admin page for the meditation app. Flow: (1) Unlock with admin key (X-ADMIN-KEY).
 * (2) Add new meditations via form (POST create + optional audio upload). (3) List existing
 * meditations with inline edit (PATCH), replace audio (POST upload-audio), and delete (DELETE).
 */

import { useEffect, useState } from "react";
import { API_BASE_URL } from "../config";

/**
 * Admin page component. Shows an unlock form until a valid admin key is submitted,
 * then displays all meditations with editable title/category/duration, audio upload,
 * and save/delete actions.
 * @returns {JSX.Element} Either the unlock form or the meditation list UI
 */
export default function Admin() {
  // --- Auth & list state ---
  /** Admin key entered in the unlock form; sent as X-ADMIN-KEY on all admin API calls. */
  const [adminKey, setAdminKey] = useState("");
  /** True after user submits the unlock form; gates showing the meditation list and forms. */
  const [adminKeySubmitted, setAdminKeySubmitted] = useState(false);
  /** List of meditations from GET /meditations; each has id, title, category, duration_sec, audio_url, etc. */
  const [meditations, setMeditations] = useState([]);
  /** Validation error message for the unlock form (e.g. empty key). */
  const [keyError, setKeyError] = useState(null);

  // --- Upload / create loading state ---
  /** Id of the meditation currently uploading audio; used to show "Uploading…" and disable that row's file input. */
  const [uploadingId, setUploadingId] = useState(null);
  /** True while the "Add meditation" form is submitting (create + optional upload). */
  const [creating, setCreating] = useState(false);

  // --- "Add new meditation" form state ---
  /** Draft fields for the new meditation (title, category, duration_sec, level). Reset after successful create. */
  const [newMeditation, setNewMeditation] = useState({
    title: "",
    category: "",
    duration_sec: "",
    level: "beginner",
  });
  /** Selected audio file in the "Add new meditation" form; optional, cleared after create. */
  const [newAudioFile, setNewAudioFile] = useState(null);

  /**
   * Fetches all meditations from the public API (GET /meditations) and updates local state.
   * Used after create, update, delete, or upload so the list stays in sync.
   */
  const fetchMeditations = () => {
    fetch(`${API_BASE_URL}/meditations`)
      .then((res) => res.json())
      .then(setMeditations);
  };

  /** When admin key is submitted, fetch the meditation list once (and whenever key/submitted change). */
  useEffect(() => {
    if (adminKeySubmitted && adminKey) fetchMeditations();
  }, [adminKeySubmitted, adminKey]);

  /**
   * Handles unlock form submit. Validates that admin key is non-empty, then marks
   * as submitted so the meditation list is shown and fetched.
   * @param {React.FormEvent} e - Form submit event
   */
  const handleUnlock = (e) => {
    e.preventDefault();
    setKeyError(null);
    if (!adminKey.trim()) {
      setKeyError("Please enter an admin key.");
      return;
    }
    setAdminKeySubmitted(true);
  };

  /**
   * Deletes a meditation by id using the admin API (DELETE /admin/meditations/{id}).
   * Sends X-ADMIN-KEY header. On success refetches the list; on error shows alert.
   * @param {number|string} id - Meditation id to delete
   * @returns {Promise<void>}
   */
  const deleteMeditation = async (id) => {
    const res = await fetch(`${API_BASE_URL}/admin/meditations/${id}`, {
      method: "DELETE",
      headers: { "X-ADMIN-KEY": adminKey },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.detail ?? `Delete failed: ${res.status}`);
      return;
    }
    fetchMeditations();
  };

  /**
   * Uploads an audio file for a meditation (POST /admin/meditations/{id}/upload-audio).
   * Uses multipart/form-data; do not set Content-Type so the browser adds the boundary.
   * Sets uploadingId for loading UI; on success refetches list; on error shows alert.
   * Replaces any existing audio_url for that meditation.
   * @param {number|string} id - Meditation id
   * @param {File} file - Audio file (e.g. from input type="file")
   * @returns {Promise<void>}
   */
  const uploadAudio = async (id, file) => {
    if (!file) return;
    setUploadingId(id);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/meditations/${id}/upload-audio`, {
        method: "POST",
        headers: { "X-ADMIN-KEY": adminKey },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.detail ?? `Upload failed: ${res.status}`);
        return;
      }
      fetchMeditations();
    } finally {
      setUploadingId(null);
    }
  };

  /**
   * Updates a meditation via PATCH /admin/meditations/{id}. Sends title, category, duration_sec.
   * On success refetches the list; on error shows alert.
   * @param {{ id: number|string, title: string, category: string, duration_sec: number|string }} m - Meditation with fields to save
   * @returns {Promise<void>}
   */
  const updateMeditation = async (m) => {
    const res = await fetch(`${API_BASE_URL}/admin/meditations/${m.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-ADMIN-KEY": adminKey,
      },
      body: JSON.stringify({
        title: m.title,
        category: m.category,
        duration_sec: Number(m.duration_sec),
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.detail ?? `Save failed: ${res.status}`);
      return;
    }
    fetchMeditations();
  };

  /**
   * Updates a single field of one meditation in state without mutating. Used for inline edit inputs.
   * @param {number|string} id - Meditation id to update
   * @param {string} field - Field name (e.g. "title", "category", "duration_sec")
   * @param {string|number} value - New value for that field
   */
  const setMeditationField = (id, field, value) => {
    setMeditations((prev) =>
      prev.map((x) => (x.id === id ? { ...x, [field]: value } : x))
    );
  };

  /**
   * Creates a new meditation via POST, then optionally uploads audio for it.
   * Flow: validate form → POST /admin/meditations/ (title, category, duration_sec, level) →
   * if file selected, POST /admin/meditations/{id}/upload-audio → reset form and refetch list.
   * This adds a new meditation (and new audio); it does not replace existing ones.
   * @param {React.FormEvent} e - Form submit event
   * @returns {Promise<void>}
   */
  const handleCreateMeditation = async (e) => {
    e.preventDefault();
    const title = newMeditation.title?.trim();
    const category = newMeditation.category?.trim();
    const duration_sec = Number(newMeditation.duration_sec);
    const level = newMeditation.level?.trim() || "beginner";
    if (!title || !category || Number.isNaN(duration_sec) || duration_sec < 0) {
      alert("Please fill title, category, and a valid duration (sec).");
      return;
    }
    setCreating(true);
    try {
      const createRes = await fetch(`${API_BASE_URL}/admin/meditations/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-ADMIN-KEY": adminKey,
        },
        body: JSON.stringify({
          title,
          category,
          duration_sec,
          level,
          audio_url: null,
        }),
      });
      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}));
        alert(err.detail ?? `Create failed: ${createRes.status}`);
        return;
      }
      const created = await createRes.json();
      if (newAudioFile) {
        const formData = new FormData();
        formData.append("file", newAudioFile);
        const uploadRes = await fetch(
          `${API_BASE_URL}/admin/meditations/${created.id}/upload-audio`,
          {
            method: "POST",
            headers: { "X-ADMIN-KEY": adminKey },
            body: formData,
          }
        );
        if (!uploadRes.ok) {
          const err = await uploadRes.json().catch(() => ({}));
          alert(err.detail ?? `Audio upload failed: ${uploadRes.status}`);
        }
      }
      setNewMeditation({ title: "", category: "", duration_sec: "", level: "beginner" });
      setNewAudioFile(null);
      fetchMeditations();
    } finally {
      setCreating(false);
    }
  };

  // --- Unlock gate: show password form until key is submitted ---
  if (!adminKeySubmitted) {
    return (
      <div className="p-6 max-w-md">
        <h2 className="text-xl mb-4">Admin</h2>
        <form onSubmit={handleUnlock}>
          <label className="block text-sm text-gray-400 mb-1">Admin Key</label>
          <input
            type="password"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            placeholder="Enter admin key"
            className="bg-gray-800 border border-gray-700 rounded p-2 w-full text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-green-500"
            autoFocus
          />
          {keyError && (
            <p className="text-red-400 text-sm mt-1">{keyError}</p>
          )}
          <button
            type="submit"
            className="mt-3 px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white"
          >
            Continue
          </button>
        </form>
      </div>
    );
  }

  // --- Main admin UI: "Add new meditation" form + list of existing meditations ---
  return (
    <div className="p-6 space-y-4">
      <h2 className="text-xl">Admin Meditations</h2>

      {/* Add new meditation: POST /admin/meditations/ then optional POST .../upload-audio for the new id */}
      <form
        onSubmit={handleCreateMeditation}
        className="p-4 bg-gray-800 rounded space-y-2 border border-gray-700"
      >
        <h3 className="text-lg text-gray-200 mb-2">Add new meditation</h3>
        <input
          value={newMeditation.title}
          onChange={(e) => setNewMeditation((p) => ({ ...p, title: e.target.value }))}
          placeholder="Title"
          className="bg-gray-900 border border-gray-700 p-2 w-full rounded text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-green-500"
        />
        <input
          value={newMeditation.category}
          onChange={(e) => setNewMeditation((p) => ({ ...p, category: e.target.value }))}
          placeholder="Category"
          className="bg-gray-900 border border-gray-700 p-2 w-full rounded text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-green-500"
        />
        <input
          type="number"
          value={newMeditation.duration_sec}
          onChange={(e) => setNewMeditation((p) => ({ ...p, duration_sec: e.target.value }))}
          placeholder="Duration (sec)"
          min={0}
          className="bg-gray-900 border border-gray-700 p-2 w-full rounded text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-green-500"
        />
        <input
          value={newMeditation.level}
          onChange={(e) => setNewMeditation((p) => ({ ...p, level: e.target.value }))}
          placeholder="Level (e.g. beginner)"
          className="bg-gray-900 border border-gray-700 p-2 w-full rounded text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-green-500"
        />
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-400 shrink-0">Audio (optional):</label>
          <input
            type="file"
            accept="audio/*"
            onChange={(e) => setNewAudioFile(e.target.files?.[0] ?? null)}
            className="text-sm text-gray-300 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-green-600 file:text-white file:text-sm"
          />
          {newAudioFile && (
            <span className="text-sm text-gray-400">{newAudioFile.name}</span>
          )}
        </div>
        <button
          type="submit"
          disabled={creating}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded text-white"
        >
          {creating ? "Creating…" : "Add meditation"}
        </button>
      </form>

      {/* Existing meditations: inline edit (PATCH), replace audio (POST upload-audio), delete (DELETE) */}
      <h3 className="text-lg text-gray-300">Existing meditations</h3>
      {meditations.length === 0 && (
        <p className="text-gray-400">No meditations yet.</p>
      )}

      {meditations.map((m) => (
        <div key={m.id} className="p-4 bg-gray-900 rounded space-y-2">
          <input
            value={m.title ?? ""}
            onChange={(e) => setMeditationField(m.id, "title", e.target.value)}
            placeholder="Title"
            className="bg-gray-800 border border-gray-700 p-2 w-full rounded text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-green-500"
          />
          <input
            value={m.category ?? ""}
            onChange={(e) => setMeditationField(m.id, "category", e.target.value)}
            placeholder="Category"
            className="bg-gray-800 border border-gray-700 p-2 w-full rounded text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-green-500"
          />
          <input
            type="number"
            value={m.duration_sec ?? ""}
            onChange={(e) => setMeditationField(m.id, "duration_sec", e.target.value)}
            placeholder="Duration (sec)"
            min={0}
            className="bg-gray-800 border border-gray-700 p-2 w-full rounded text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-green-500"
          />

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400 shrink-0">Audio:</label>
            <input
              type="file"
              accept="audio/*"
              disabled={uploadingId === m.id}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadAudio(m.id, file);
                e.target.value = "";
              }}
              className="text-sm text-gray-300 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-green-600 file:text-white file:text-sm"
            />
            {uploadingId === m.id && (
              <span className="text-sm text-gray-400">Uploading…</span>
            )}
          </div>

          {m.audio_url && (
            <audio src={m.audio_url} controls className="w-full" />
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => updateMeditation(m)}
              className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-white text-sm"
            >
              Save
            </button>
            <button
              onClick={() => deleteMeditation(m.id)}
              className="px-3 py-1.5 bg-red-600/80 hover:bg-red-600 rounded text-white text-sm"
            >
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

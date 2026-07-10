import { useCallback, useEffect, useState } from "react";
import { formatDuration } from "../components/MeditationCard";
import { API_BASE_URL } from "../config";
import { useAuth } from "../context/AuthContext";

const EMPTY_MEDITATION = {
  title: "",
  category: "",
  duration_sec: "",
  level: "beginner",
  description: "",
  teacher_name: "",
  tags_text: "",
  benefits_text: "",
  is_featured: false,
  is_published: true,
};

const EMPTY_PROGRAM = {
  title: "",
  description: "",
  artwork_url: "",
  level: "beginner",
  goal: "",
  is_published: true,
  meditation_ids: [],
  meditation_search: "",
};

const withDraftFields = (meditation) => ({
  ...meditation,
  tags_text: (meditation.tags ?? []).join(", "),
  benefits_text: (meditation.benefits ?? []).join("\n"),
});

const parseTags = (value) =>
  value.split(",").map((item) => item.trim()).filter(Boolean);

const parseBenefits = (value) =>
  value.split("\n").map((item) => item.trim()).filter(Boolean);

const withProgramDraftFields = (program) => ({
  ...program,
  meditation_ids: (program.meditations ?? []).map((item) => item.meditation.id),
  meditation_search: "",
});

const getErrorMessage = (payload, fallback) => {
  if (typeof payload?.detail === "string") return payload.detail;
  if (Array.isArray(payload?.detail)) {
    return payload.detail.map((item) => item.msg).join(", ");
  }
  return fallback;
};

const moveItem = (items, index, direction) => {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= items.length) return items;
  const updated = [...items];
  const [item] = updated.splice(index, 1);
  updated.splice(nextIndex, 0, item);
  return updated;
};

function ProgramMeditationPicker({
  meditations,
  selectedIds,
  search,
  onSearch,
  onChange,
}) {
  const meditationById = new Map(meditations.map((item) => [item.id, item]));
  const selectedMeditations = selectedIds
    .map((id) => meditationById.get(id))
    .filter(Boolean);
  const normalizedSearch = search.trim().toLowerCase();
  const searchResults = meditations
    .filter((meditation) => !selectedIds.includes(meditation.id))
    .filter((meditation) => {
      if (!normalizedSearch) return true;
      return [
        meditation.title,
        meditation.category,
        meditation.teacher_name,
        meditation.level,
        String(meditation.id),
      ].some((value) => value?.toLowerCase().includes(normalizedSearch));
    })
    .slice(0, 8);

  return (
    <div className="admin-program-picker">
      <div className="admin-program-picker__selected">
        <div className="admin-program-picker__top">
          <strong>Program sequence</strong>
          <span>{selectedMeditations.length} selected</span>
        </div>
        {selectedMeditations.length > 0 ? (
          <div className="admin-program-selected-list">
            {selectedMeditations.map((meditation, index) => (
              <div className="admin-program-selected-item" key={meditation.id}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{meditation.title}</strong>
                  <small>
                    #{meditation.id} · {meditation.category || "Uncategorized"} · {formatDuration(meditation.duration_sec)}
                    {!meditation.is_published ? " · Draft" : ""}
                  </small>
                </div>
                <div className="admin-program-order-actions">
                  <button
                    type="button"
                    onClick={() => onChange(moveItem(selectedIds, index, -1))}
                    disabled={index === 0}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange(moveItem(selectedIds, index, 1))}
                    disabled={index === selectedIds.length - 1}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange(selectedIds.filter((id) => id !== meditation.id))}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="admin-program-picker__empty">
            Add meditations below to build the program path.
          </div>
        )}
      </div>

      <div className="admin-program-picker__search">
        <label className="admin-field">
          <span>Find meditations</span>
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search by title, category, teacher, or ID"
          />
        </label>
        <div className="admin-program-search-results">
          {searchResults.length > 0 ? (
            searchResults.map((meditation) => (
              <button
                type="button"
                onClick={() => onChange([...selectedIds, meditation.id])}
                className={!meditation.is_published ? "is-draft" : ""}
                key={meditation.id}
              >
                <span>{meditation.title}</span>
                <small>
                  #{meditation.id} · {meditation.category || "Uncategorized"} · {meditation.level}
                  {!meditation.is_published ? " · Draft" : ""}
                </small>
              </button>
            ))
          ) : (
            <div className="admin-program-picker__empty">
              No matching meditations found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Admin() {
  const { logout } = useAuth();
  const [meditations, setMeditations] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [newMeditation, setNewMeditation] = useState(EMPTY_MEDITATION);
  const [newProgram, setNewProgram] = useState(EMPTY_PROGRAM);
  const [newAudioFile, setNewAudioFile] = useState(null);
  const [newArtworkFile, setNewArtworkFile] = useState(null);
  const [creating, setCreating] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [uploadingKey, setUploadingKey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [notice, setNotice] = useState("");

  const request = useCallback(async (path, options = {}) => {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        ...options.headers,
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(getErrorMessage(payload, `Request failed: ${response.status}`));
    }
    return payload;
  }, []);

  const fetchMeditations = useCallback(async () => {
    setPageError("");
    try {
      const data = await request("/admin/meditations/");
      setMeditations(data.map(withDraftFields));
    } catch (error) {
      setPageError(error.message);
    } finally {
      setLoading(false);
    }
  }, [request]);

  const fetchPrograms = useCallback(async () => {
    try {
      const data = await request("/admin/programs/");
      setPrograms(data.map(withProgramDraftFields));
    } catch (error) {
      setPageError(error.message);
    }
  }, [request]);

  useEffect(() => {
    fetchMeditations();
    fetchPrograms();
  }, [fetchMeditations, fetchPrograms]);

  const setMeditationField = (id, field, value) => {
    setMeditations((current) =>
      current.map((item) => item.id === id ? { ...item, [field]: value } : item)
    );
  };

  const setProgramField = (id, field, value) => {
    setPrograms((current) =>
      current.map((item) => item.id === id ? { ...item, [field]: value } : item)
    );
  };

  const setNewProgramMeditations = (meditationIds) => {
    setNewProgram((item) => ({ ...item, meditation_ids: meditationIds }));
  };

  const setExistingProgramMeditations = (programId, meditationIds) => {
    setProgramField(programId, "meditation_ids", meditationIds);
  };

  const validateProgramDraft = (program) => {
    if (!program.title.trim()) return "Program title is required.";
    if (program.meditation_ids.length === 0) {
      return "Choose at least one published meditation for this program.";
    }
    const meditationById = new Map(meditations.map((item) => [item.id, item]));
    const missingIds = program.meditation_ids.filter((id) => !meditationById.has(id));
    if (missingIds.length > 0) {
      return `These meditation IDs are no longer available: ${missingIds.join(", ")}.`;
    }
    const unpublishedItems = program.meditation_ids
      .map((id) => meditationById.get(id))
      .filter((item) => item && !item.is_published);
    if (unpublishedItems.length > 0) {
      return `Publish or remove these meditations first: ${unpublishedItems
        .map((item) => item.title)
        .join(", ")}.`;
    }
    return "";
  };

  const uploadFile = async (id, file, kind) => {
    const formData = new FormData();
    formData.append("file", file);
    return request(`/admin/meditations/${id}/upload-${kind}`, {
      method: "POST",
      body: formData,
    });
  };

  const uploadExistingFile = async (id, file, kind) => {
    if (!file) return;
    const key = `${kind}-${id}`;
    setUploadingKey(key);
    setNotice("");
    try {
      const updated = await uploadFile(id, file, kind);
      setMeditations((current) =>
        current.map((item) => item.id === id ? withDraftFields(updated) : item)
      );
      setNotice(`${kind === "artwork" ? "Artwork" : "Audio"} uploaded successfully.`);
    } catch (error) {
      setPageError(error.message);
    } finally {
      setUploadingKey(null);
    }
  };

  const meditationPayload = (meditation) => ({
    title: meditation.title.trim(),
    category: meditation.category.trim(),
    duration_sec: Number(meditation.duration_sec),
    level: meditation.level.trim(),
    description: meditation.description.trim(),
    teacher_name: meditation.teacher_name.trim(),
    tags: parseTags(meditation.tags_text),
    benefits: parseBenefits(meditation.benefits_text),
    is_featured: meditation.is_featured,
    is_published: meditation.is_published,
  });

  const programPayload = (program) => ({
    title: program.title.trim(),
    description: program.description.trim(),
    artwork_url: program.artwork_url.trim() || null,
    level: program.level.trim(),
    goal: program.goal.trim(),
    is_published: program.is_published,
    meditation_ids: program.meditation_ids,
  });

  const handleCreateMeditation = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    setCreating(true);
    setPageError("");
    setNotice("");
    try {
      let created = await request("/admin/meditations/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...meditationPayload(newMeditation),
          audio_url: null,
          artwork_url: null,
        }),
      });
      if (newArtworkFile) {
        created = await uploadFile(created.id, newArtworkFile, "artwork");
      }
      if (newAudioFile) {
        created = await uploadFile(created.id, newAudioFile, "audio");
      }
      setMeditations((current) => [withDraftFields(created), ...current]);
      setNewMeditation(EMPTY_MEDITATION);
      setNewAudioFile(null);
      setNewArtworkFile(null);
      setNotice("Meditation created successfully.");
      form.reset();
    } catch (error) {
      setPageError(error.message);
    } finally {
      setCreating(false);
    }
  };

  const handleCreateProgram = async (event) => {
    event.preventDefault();
    setPageError("");
    setNotice("");
    try {
      const validationError = validateProgramDraft(newProgram);
      if (validationError) throw new Error(validationError);
      const created = await request("/admin/programs/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(programPayload(newProgram)),
      });
      setPrograms((current) => [withProgramDraftFields(created), ...current]);
      setNewProgram(EMPTY_PROGRAM);
      setNotice("Program created successfully.");
    } catch (error) {
      setPageError(error.message);
    }
  };

  const updateMeditation = async (meditation) => {
    setSavingId(meditation.id);
    setPageError("");
    setNotice("");
    try {
      const updated = await request(`/admin/meditations/${meditation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(meditationPayload(meditation)),
      });
      setMeditations((current) =>
        current.map((item) =>
          item.id === meditation.id ? withDraftFields(updated) : item
        )
      );
      setNotice(`“${updated.title}” saved.`);
    } catch (error) {
      setPageError(error.message);
    } finally {
      setSavingId(null);
    }
  };

  const deleteMeditation = async (meditation) => {
    if (!window.confirm(`Delete “${meditation.title}”? This cannot be undone.`)) return;
    setPageError("");
    try {
      await request(`/admin/meditations/${meditation.id}`, { method: "DELETE" });
      setMeditations((current) =>
        current.filter((item) => item.id !== meditation.id)
      );
      setNotice("Meditation deleted.");
    } catch (error) {
      setPageError(error.message);
    }
  };

  const updateProgram = async (program) => {
    setSavingId(`program-${program.id}`);
    setPageError("");
    setNotice("");
    try {
      const validationError = validateProgramDraft(program);
      if (validationError) throw new Error(validationError);
      const updated = await request(`/admin/programs/${program.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(programPayload(program)),
      });
      setPrograms((current) =>
        current.map((item) => item.id === program.id ? withProgramDraftFields(updated) : item)
      );
      setNotice(`“${updated.title}” saved.`);
    } catch (error) {
      setPageError(error.message);
    } finally {
      setSavingId(null);
    }
  };

  const deleteProgram = async (program) => {
    if (!window.confirm(`Delete “${program.title}”? This cannot be undone.`)) return;
    setPageError("");
    try {
      await request(`/admin/programs/${program.id}`, { method: "DELETE" });
      setPrograms((current) => current.filter((item) => item.id !== program.id));
      setNotice("Program deleted.");
    } catch (error) {
      setPageError(error.message);
    }
  };

  return (
    <main className="admin-page">
      <div className="admin-shell">
        <header className="admin-heading">
          <div>
            <p className="admin-kicker">Content studio</p>
            <h1>Meditation library</h1>
            <p>Create, enrich, publish, and organize every practice.</p>
          </div>
          <button
            className="admin-logout"
            onClick={async () => {
              await logout();
              window.location.href = "/login";
            }}
          >
            Log out
          </button>
        </header>

        {(pageError || notice) && (
          <div
            className={`admin-alert ${pageError ? "admin-alert--error" : "admin-alert--success"}`}
            role={pageError ? "alert" : "status"}
          >
            {pageError || notice}
            <button onClick={() => { setPageError(""); setNotice(""); }} aria-label="Dismiss">×</button>
          </div>
        )}

        <section className="admin-create">
          <div className="admin-section-title">
            <span>01</span>
            <div><h2>Add a meditation</h2><p>Build the complete content entry before publishing.</p></div>
          </div>
          <form onSubmit={handleCreateMeditation}>
            <div className="admin-form-grid">
              <label className="admin-field admin-field--wide">
                <span>Title</span>
                <input required maxLength={200} value={newMeditation.title}
                  onChange={(event) => setNewMeditation((item) => ({ ...item, title: event.target.value }))}
                  placeholder="e.g. A Quiet Place Within" />
              </label>
              <label className="admin-field">
                <span>Teacher</span>
                <input maxLength={120} value={newMeditation.teacher_name}
                  onChange={(event) => setNewMeditation((item) => ({ ...item, teacher_name: event.target.value }))}
                  placeholder="Teacher name" />
              </label>
              <label className="admin-field">
                <span>Category</span>
                <input required maxLength={80} value={newMeditation.category}
                  onChange={(event) => setNewMeditation((item) => ({ ...item, category: event.target.value }))}
                  placeholder="Sleep, Stress, Focus…" />
              </label>
              <label className="admin-field">
                <span>Duration in seconds</span>
                <input required type="number" min="1" max="86400" value={newMeditation.duration_sec}
                  onChange={(event) => setNewMeditation((item) => ({ ...item, duration_sec: event.target.value }))}
                  placeholder="600" />
              </label>
              <label className="admin-field">
                <span>Level</span>
                <select value={newMeditation.level}
                  onChange={(event) => setNewMeditation((item) => ({ ...item, level: event.target.value }))}>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                  <option value="all levels">All levels</option>
                </select>
              </label>
              <label className="admin-field admin-field--full">
                <span>Description</span>
                <textarea rows="4" maxLength={5000} value={newMeditation.description}
                  onChange={(event) => setNewMeditation((item) => ({ ...item, description: event.target.value }))}
                  placeholder="Describe what this meditation helps the listener experience…" />
              </label>
              <label className="admin-field admin-field--wide">
                <span>Tags <small>comma separated</small></span>
                <input value={newMeditation.tags_text}
                  onChange={(event) => setNewMeditation((item) => ({ ...item, tags_text: event.target.value }))}
                  placeholder="calm, breathwork, evening" />
              </label>
              <label className="admin-field admin-field--wide">
                <span>Benefits <small>one per line</small></span>
                <textarea rows="3" value={newMeditation.benefits_text}
                  onChange={(event) => setNewMeditation((item) => ({ ...item, benefits_text: event.target.value }))}
                  placeholder={"Reduces mental noise\nSupports deeper sleep"} />
              </label>
            </div>

            <div className="admin-media-row">
              <label className="admin-upload-card">
                <strong>Artwork</strong>
                <span>JPEG, PNG, WebP or AVIF · max 10 MB</span>
                <input type="file" accept="image/jpeg,image/png,image/webp,image/avif"
                  onChange={(event) => setNewArtworkFile(event.target.files?.[0] ?? null)} />
                <b>{newArtworkFile?.name || "Choose image"}</b>
              </label>
              <label className="admin-upload-card">
                <strong>Audio</strong>
                <span>Upload the guided meditation track</span>
                <input type="file" accept="audio/*"
                  onChange={(event) => setNewAudioFile(event.target.files?.[0] ?? null)} />
                <b>{newAudioFile?.name || "Choose audio"}</b>
              </label>
              <div className="admin-publish-controls">
                <label><input type="checkbox" checked={newMeditation.is_featured}
                  onChange={(event) => setNewMeditation((item) => ({ ...item, is_featured: event.target.checked }))} />
                  Feature this meditation</label>
                <label><input type="checkbox" checked={newMeditation.is_published}
                  onChange={(event) => setNewMeditation((item) => ({ ...item, is_published: event.target.checked }))} />
                  Publish immediately</label>
              </div>
            </div>
            <button className="admin-primary-button" type="submit" disabled={creating}>
              {creating ? "Creating and uploading…" : "Create meditation"}
            </button>
          </form>
        </section>

        <section className="admin-library">
          <div className="admin-section-title">
            <span>02</span>
            <div><h2>Existing meditations</h2><p>{meditations.length} items in your library</p></div>
          </div>

          {loading && <div className="admin-empty">Loading your library…</div>}
          {!loading && meditations.length === 0 && (
            <div className="admin-empty">No meditations yet. Create the first one above.</div>
          )}

          <div className="admin-card-list">
            {meditations.map((meditation) => (
              <article className="admin-card" key={meditation.id}>
                <aside className="admin-card__media">
                  {meditation.artwork_url ? (
                    <img src={meditation.artwork_url} alt="" />
                  ) : (
                    <div className="admin-artwork-placeholder"><span>still.</span><small>No artwork</small></div>
                  )}
                  <label className="admin-file-button">
                    {uploadingKey === `artwork-${meditation.id}` ? "Uploading…" : "Replace artwork"}
                    <input type="file" accept="image/jpeg,image/png,image/webp,image/avif"
                      disabled={Boolean(uploadingKey)}
                      onChange={(event) => {
                        uploadExistingFile(meditation.id, event.target.files?.[0], "artwork");
                        event.target.value = "";
                      }} />
                  </label>
                </aside>

                <div className="admin-card__content">
                  <div className="admin-card__topline">
                    <div className="admin-statuses">
                      <span className={meditation.is_published ? "is-live" : "is-draft"}>
                        {meditation.is_published ? "Published" : "Draft"}
                      </span>
                      {meditation.is_featured && <span className="is-featured">Featured</span>}
                    </div>
                    <small>#{meditation.id} · {new Date(meditation.created_at).toLocaleDateString()}</small>
                  </div>

                  <div className="admin-form-grid admin-form-grid--edit">
                    <label className="admin-field admin-field--wide">
                      <span>Title</span>
                      <input value={meditation.title}
                        onChange={(event) => setMeditationField(meditation.id, "title", event.target.value)} />
                    </label>
                    <label className="admin-field">
                      <span>Teacher</span>
                      <input value={meditation.teacher_name}
                        onChange={(event) => setMeditationField(meditation.id, "teacher_name", event.target.value)} />
                    </label>
                    <label className="admin-field">
                      <span>Category</span>
                      <input value={meditation.category}
                        onChange={(event) => setMeditationField(meditation.id, "category", event.target.value)} />
                    </label>
                    <label className="admin-field">
                      <span>Duration</span>
                      <input type="number" min="1" max="86400" value={meditation.duration_sec}
                        onChange={(event) => setMeditationField(meditation.id, "duration_sec", event.target.value)} />
                    </label>
                    <label className="admin-field">
                      <span>Level</span>
                      <select value={meditation.level}
                        onChange={(event) => setMeditationField(meditation.id, "level", event.target.value)}>
                        <option value="beginner">Beginner</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="advanced">Advanced</option>
                        <option value="all levels">All levels</option>
                      </select>
                    </label>
                    <label className="admin-field admin-field--full">
                      <span>Description</span>
                      <textarea rows="3" maxLength={5000} value={meditation.description}
                        onChange={(event) => setMeditationField(meditation.id, "description", event.target.value)} />
                    </label>
                    <label className="admin-field admin-field--wide">
                      <span>Tags <small>comma separated</small></span>
                      <input value={meditation.tags_text}
                        onChange={(event) => setMeditationField(meditation.id, "tags_text", event.target.value)} />
                    </label>
                    <label className="admin-field admin-field--wide">
                      <span>Benefits <small>one per line</small></span>
                      <textarea rows="3" value={meditation.benefits_text}
                        onChange={(event) => setMeditationField(meditation.id, "benefits_text", event.target.value)} />
                    </label>
                  </div>

                  <div className="admin-card__bottom">
                    <div className="admin-audio">
                      {meditation.audio_url
                        ? <audio src={meditation.audio_url} controls preload="none" />
                        : <span>No audio uploaded</span>}
                      <label className="admin-file-button admin-file-button--dark">
                        {uploadingKey === `audio-${meditation.id}` ? "Uploading…" : "Replace audio"}
                        <input type="file" accept="audio/*" disabled={Boolean(uploadingKey)}
                          onChange={(event) => {
                            uploadExistingFile(meditation.id, event.target.files?.[0], "audio");
                            event.target.value = "";
                          }} />
                      </label>
                    </div>
                    <div className="admin-publish-controls admin-publish-controls--inline">
                      <label><input type="checkbox" checked={meditation.is_featured}
                        onChange={(event) => setMeditationField(meditation.id, "is_featured", event.target.checked)} />
                        Featured</label>
                      <label><input type="checkbox" checked={meditation.is_published}
                        onChange={(event) => setMeditationField(meditation.id, "is_published", event.target.checked)} />
                        Published</label>
                    </div>
                    <div className="admin-card__actions">
                      <button className="admin-delete-button" type="button"
                        onClick={() => deleteMeditation(meditation)}>Delete</button>
                      <button className="admin-primary-button" type="button"
                        disabled={savingId === meditation.id}
                        onClick={() => updateMeditation(meditation)}>
                        {savingId === meditation.id ? "Saving…" : "Save changes"}
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="admin-library admin-programs">
          <div className="admin-section-title">
            <span>03</span>
            <div><h2>Programs</h2><p>Create guided paths from ordered meditation sequences.</p></div>
          </div>

          <form className="admin-program-create" onSubmit={handleCreateProgram}>
            <div className="admin-form-grid">
              <label className="admin-field admin-field--wide">
                <span>Program title</span>
                <input required maxLength={200} value={newProgram.title}
                  onChange={(event) => setNewProgram((item) => ({ ...item, title: event.target.value }))}
                  placeholder="7 Days of Calm" />
              </label>
              <label className="admin-field">
                <span>Goal</span>
                <input maxLength={80} value={newProgram.goal}
                  onChange={(event) => setNewProgram((item) => ({ ...item, goal: event.target.value }))}
                  placeholder="stress, sleep, mindfulness" />
              </label>
              <label className="admin-field">
                <span>Level</span>
                <select value={newProgram.level}
                  onChange={(event) => setNewProgram((item) => ({ ...item, level: event.target.value }))}>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                  <option value="all levels">All levels</option>
                </select>
              </label>
              <label className="admin-field admin-field--full">
                <span>Description</span>
                <textarea rows="3" maxLength={5000} value={newProgram.description}
                  onChange={(event) => setNewProgram((item) => ({ ...item, description: event.target.value }))}
                  placeholder="Describe the journey this program guides users through." />
              </label>
              <label className="admin-field admin-field--wide">
                <span>Artwork URL <small>optional</small></span>
                <input value={newProgram.artwork_url}
                  onChange={(event) => setNewProgram((item) => ({ ...item, artwork_url: event.target.value }))}
                  placeholder="https://…" />
              </label>
            </div>
            <ProgramMeditationPicker
              meditations={meditations}
              selectedIds={newProgram.meditation_ids}
              search={newProgram.meditation_search}
              onSearch={(value) => setNewProgram((item) => ({ ...item, meditation_search: value }))}
              onChange={setNewProgramMeditations}
            />
            <div className="admin-card__bottom">
              <div className="admin-publish-controls admin-publish-controls--inline">
                <label><input type="checkbox" checked={newProgram.is_published}
                  onChange={(event) => setNewProgram((item) => ({ ...item, is_published: event.target.checked }))} />
                  Published</label>
              </div>
              <button className="admin-primary-button" type="submit">Create program</button>
            </div>
          </form>

          <div className="admin-program-list">
            {programs.map((program) => (
              <article className="admin-program-card" key={program.id}>
                <div className="admin-form-grid admin-form-grid--edit">
                  <label className="admin-field admin-field--wide">
                    <span>Title</span>
                    <input value={program.title}
                      onChange={(event) => setProgramField(program.id, "title", event.target.value)} />
                  </label>
                  <label className="admin-field">
                    <span>Goal</span>
                    <input value={program.goal}
                      onChange={(event) => setProgramField(program.id, "goal", event.target.value)} />
                  </label>
                  <label className="admin-field">
                    <span>Level</span>
                    <select value={program.level}
                      onChange={(event) => setProgramField(program.id, "level", event.target.value)}>
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                      <option value="all levels">All levels</option>
                    </select>
                  </label>
                  <label className="admin-field admin-field--full">
                    <span>Description</span>
                    <textarea rows="3" value={program.description}
                      onChange={(event) => setProgramField(program.id, "description", event.target.value)} />
                  </label>
                  <label className="admin-field admin-field--wide">
                    <span>Artwork URL</span>
                    <input value={program.artwork_url || ""}
                      onChange={(event) => setProgramField(program.id, "artwork_url", event.target.value)} />
                  </label>
                </div>
                <ProgramMeditationPicker
                  meditations={meditations}
                  selectedIds={program.meditation_ids}
                  search={program.meditation_search}
                  onSearch={(value) => setProgramField(program.id, "meditation_search", value)}
                  onChange={(meditationIds) => setExistingProgramMeditations(program.id, meditationIds)}
                />
                <div className="admin-card__bottom">
                  <div className="admin-publish-controls admin-publish-controls--inline">
                    <label><input type="checkbox" checked={program.is_published}
                      onChange={(event) => setProgramField(program.id, "is_published", event.target.checked)} />
                      Published</label>
                    <span>{program.meditations?.length ?? 0} practices</span>
                  </div>
                  <div className="admin-card__actions">
                    <button className="admin-delete-button" type="button"
                      onClick={() => deleteProgram(program)}>Delete</button>
                    <button className="admin-primary-button" type="button"
                      disabled={savingId === `program-${program.id}`}
                      onClick={() => updateProgram(program)}>
                      {savingId === `program-${program.id}` ? "Saving…" : "Save program"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

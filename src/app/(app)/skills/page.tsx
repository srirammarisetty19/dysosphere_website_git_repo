"use client";

// ============================================================================
// Skills Page — manage per-user AI skills + browse built-in skills
// Server: /skills/* (identity from Bearer token — no user_id is sent)
//
// UX pattern: ChatGPT "Customize" / custom GPT instructions —
//   list → create/edit drawer → optimistic toggles → confirm on delete.
// ============================================================================

import { useEffect, useMemo, useState } from "react";
import {
  Puzzle,
  Plus,
  Search,
  X,
  Loader2,
  AlertCircle,
  Menu,
  Pencil,
  Trash2,
  Sparkles,
  Library,
  Zap,
  Check,
  RefreshCw,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import type { CentralSkill, UserSkill, UserSkillInput } from "@/lib/types";

// Mirror server-side limits (ai_server/api/routes/skills.py)
const MAX_NAME = 100;
const MAX_DESCRIPTION = 1000;
const MAX_CONTENT = 20000;

type Tab = "mine" | "builtin";

function errorMessage(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

export default function SkillsPage() {
  const [tab, setTab] = useState<Tab>("mine");
  const [query, setQuery] = useState("");
  const [userSkills, setUserSkills] = useState<UserSkill[]>([]);
  const [centralSkills, setCentralSkills] = useState<CentralSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ mode: "create" } | { mode: "edit"; id: string } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [reloading, setReloading] = useState(false);

  // Initial load. `loading` starts true, so state is only set after the await
  // (no synchronous setState inside the effect).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Load both lists independently — one failing shouldn't blank the other.
      const [mine, all] = await Promise.allSettled([apiClient.getUserSkills(), apiClient.getSkills()]);
      if (cancelled) return;
      if (mine.status === "fulfilled") setUserSkills(mine.value);
      if (all.status === "fulfilled") setCentralSkills(all.value.central_skills ?? []);
      if (mine.status === "rejected" && all.status === "rejected") {
        setError(errorMessage(mine.reason, "Couldn't load skills"));
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Optimistic updates (revert on failure) ──
  const patchLocal = (id: string, patch: Partial<UserSkill>) =>
    setUserSkills((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const handleToggleAutoLoad = async (skill: UserSkill, value: boolean) => {
    patchLocal(skill.id, { auto_load: value });
    try {
      await apiClient.toggleSkillAutoLoad(skill.id, value);
    } catch (e) {
      patchLocal(skill.id, { auto_load: !value });
      setError(errorMessage(e, "Couldn't update auto-load"));
    }
  };

  const handleToggleEnabled = async (skill: UserSkill, value: boolean) => {
    patchLocal(skill.id, { enabled: value });
    try {
      await apiClient.updateUserSkill(skill.id, { enabled: value });
    } catch (e) {
      patchLocal(skill.id, { enabled: !value });
      setError(errorMessage(e, "Couldn't update skill"));
    }
  };

  const handleDelete = async (id: string) => {
    const snapshot = userSkills;
    setUserSkills((prev) => prev.filter((s) => s.id !== id));
    setConfirmDeleteId(null);
    try {
      await apiClient.deleteUserSkill(id);
    } catch (e) {
      setUserSkills(snapshot);
      setError(errorMessage(e, "Couldn't delete skill"));
    }
  };

  const handleReload = async () => {
    setReloading(true);
    try {
      await apiClient.reloadCentralSkills();
      const all = await apiClient.getSkills();
      setCentralSkills(all.central_skills ?? []);
    } catch (e) {
      setError(errorMessage(e, "Couldn't reload built-in skills"));
    } finally {
      setReloading(false);
    }
  };

  // ── Filtering ──
  const q = query.trim().toLowerCase();
  const filteredMine = useMemo(
    () =>
      userSkills.filter(
        (s) =>
          !q ||
          s.name.toLowerCase().includes(q) ||
          (s.description || "").toLowerCase().includes(q) ||
          (s.triggers || []).some((t) => t.toLowerCase().includes(q))
      ),
    [userSkills, q]
  );
  const filteredBuiltin = useMemo(
    () =>
      centralSkills.filter(
        (s) =>
          !q ||
          s.name.toLowerCase().includes(q) ||
          (s.description || "").toLowerCase().includes(q) ||
          (s.category || "").toLowerCase().includes(q)
      ),
    [centralSkills, q]
  );

  const autoLoadCount = userSkills.filter((s) => s.auto_load && s.enabled).length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 h-14 border-b border-white/[0.04] shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("toggle-sidebar"))}
            className="lg:hidden p-2 -ml-2 mr-1 rounded-lg text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
            aria-label="Open sidebar"
          >
            <Menu size={22} />
          </button>
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#7C4DFF] to-[#00BCD4] flex items-center justify-center">
            <Puzzle size={15} className="text-white" />
          </div>
          <h1 className="text-white font-semibold text-lg tracking-tight">Skills</h1>
          {userSkills.length > 0 && (
            <span className="text-white/20 text-xs ml-1 hidden sm:inline">
              {userSkills.length} custom · {autoLoadCount} always on
            </span>
          )}
        </div>
        <button
          id="skills-create-button"
          onClick={() => setEditor({ mode: "create" })}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[#00BCD4] hover:bg-[#00BCD4]/10 transition-colors text-sm font-medium"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">New skill</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="max-w-4xl mx-auto">
          {/* Intro */}
          <p className="text-white/30 text-xs mb-4 leading-relaxed">
            Skills teach the assistant how to handle specific tasks. Skills marked{" "}
            <span className="text-[#00BCD4]/70">Always on</span> are added to every conversation; the rest are
            picked automatically when your message matches their triggers.
          </p>

          {/* Tabs + Search */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
            <div className="flex p-1 rounded-xl bg-white/[0.03] border border-white/[0.05] shrink-0">
              <TabButton id="skills-tab-mine" active={tab === "mine"} onClick={() => setTab("mine")}>
                <Sparkles size={13} /> My skills
                <span className="text-[10px] text-white/30">{userSkills.length}</span>
              </TabButton>
              <TabButton id="skills-tab-builtin" active={tab === "builtin"} onClick={() => setTab("builtin")}>
                <Library size={13} /> Built-in
                <span className="text-[10px] text-white/30">{centralSkills.length}</span>
              </TabButton>
            </div>
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
              <input
                id="skills-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && setQuery("")}
                placeholder="Search skills"
                className="w-full pl-9 pr-8 py-2 bg-white/[0.03] rounded-xl text-white text-sm placeholder:text-white/20 border border-white/[0.05] focus:border-[#00BCD4]/40 focus:outline-none transition-colors"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-white/25 hover:text-white/50"
                  aria-label="Clear search"
                >
                  <X size={13} />
                </button>
              )}
            </div>
            {tab === "builtin" && (
              <button
                id="skills-reload-button"
                onClick={handleReload}
                disabled={reloading}
                title="Reload built-in skills from the server"
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-white/40 hover:text-white/70 hover:bg-white/5 border border-white/[0.05] text-xs transition-colors disabled:opacity-50"
              >
                <RefreshCw size={13} className={reloading ? "animate-spin" : ""} />
                Reload
              </button>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-red-500/10 border border-red-500/20">
              <AlertCircle size={14} className="text-red-400 shrink-0" />
              <p className="text-red-400 text-xs flex-1">{error}</p>
              <button onClick={() => setError(null)} className="text-red-400/60 hover:text-red-400" aria-label="Dismiss">
                <X size={13} />
              </button>
            </div>
          )}

          {/* Content */}
          {loading ? (
            <SkeletonGrid />
          ) : tab === "mine" ? (
            filteredMine.length === 0 ? (
              q ? (
                <NoMatches query={query} />
              ) : (
                <EmptyMine onCreate={() => setEditor({ mode: "create" })} />
              )
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredMine.map((skill) => (
                  <UserSkillCard
                    key={skill.id}
                    skill={skill}
                    confirmingDelete={confirmDeleteId === skill.id}
                    onEdit={() => setEditor({ mode: "edit", id: skill.id })}
                    onAskDelete={() => setConfirmDeleteId(skill.id)}
                    onCancelDelete={() => setConfirmDeleteId(null)}
                    onConfirmDelete={() => handleDelete(skill.id)}
                    onToggleAutoLoad={(v) => handleToggleAutoLoad(skill, v)}
                    onToggleEnabled={(v) => handleToggleEnabled(skill, v)}
                  />
                ))}
              </div>
            )
          ) : filteredBuiltin.length === 0 ? (
            q ? (
              <NoMatches query={query} />
            ) : (
              <p className="text-white/25 text-sm text-center py-16">No built-in skills are installed on this server.</p>
            )
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredBuiltin.map((skill) => (
                <CentralSkillCard key={skill.name} skill={skill} />
              ))}
            </div>
          )}
        </div>
      </div>

      {editor && (
        <SkillEditor
          key={editor.mode === "edit" ? editor.id : "create"}
          skillId={editor.mode === "edit" ? editor.id : null}
          onClose={() => setEditor(null)}
          onSaved={async () => {
            setEditor(null);
            setTab("mine");
            try {
              setUserSkills(await apiClient.getUserSkills());
            } catch {
              // list refresh is best-effort
            }
          }}
        />
      )}
    </div>
  );
}

// ── Tabs ────────────────────────────────────────────────────────────────
function TabButton({
  id,
  active,
  onClick,
  children,
}: {
  id: string;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      id={id}
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
        active ? "bg-white/[0.08] text-white shadow-sm" : "text-white/40 hover:text-white/70"
      }`}
    >
      {children}
    </button>
  );
}

// ── Switch ──────────────────────────────────────────────────────────────
function Switch({
  checked,
  onChange,
  label,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  id: string;
}) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 cursor-pointer select-none">
      <span className="relative inline-flex items-center">
        <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only peer" />
        <span className="w-8 h-[18px] bg-white/10 rounded-full peer-checked:bg-[#00BCD4] transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-[14px] after:w-[14px] after:transition-transform peer-checked:after:translate-x-[14px]" />
      </span>
      <span className="text-[11px] text-white/40">{label}</span>
    </label>
  );
}

// ── User Skill Card ─────────────────────────────────────────────────────
function UserSkillCard({
  skill,
  confirmingDelete,
  onEdit,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
  onToggleAutoLoad,
  onToggleEnabled,
}: {
  skill: UserSkill;
  confirmingDelete: boolean;
  onEdit: () => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
  onToggleAutoLoad: (v: boolean) => void;
  onToggleEnabled: (v: boolean) => void;
}) {
  const triggers = (skill.triggers || []).filter(Boolean);
  const active = skill.enabled;

  return (
    <div
      className={`group relative flex flex-col rounded-2xl border p-4 transition-all ${
        active
          ? "bg-white/[0.03] border-white/[0.06] hover:border-[#00BCD4]/25 hover:bg-white/[0.045]"
          : "bg-white/[0.015] border-white/[0.04] opacity-70"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
            skill.auto_load && active ? "bg-gradient-to-br from-[#00BCD4]/25 to-[#7C4DFF]/25" : "bg-white/[0.04]"
          }`}
        >
          {skill.auto_load && active ? (
            <Zap size={16} className="text-[#00BCD4]" />
          ) : (
            <Sparkles size={16} className={active ? "text-white/50" : "text-white/20"} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`text-sm font-semibold truncate ${active ? "text-white" : "text-white/40"}`}>{skill.name}</p>
            {skill.source === "template" && (
              <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#7C4DFF]/15 text-[#B39DFF]">
                Template
              </span>
            )}
          </div>
          <p className="text-white/35 text-xs mt-0.5 line-clamp-2 leading-relaxed">
            {skill.description || skill.content || "No description"}
          </p>
        </div>
        <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg text-white/40 hover:text-[#00BCD4] hover:bg-[#00BCD4]/10 transition-colors"
            aria-label={`Edit ${skill.name}`}
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={onAskDelete}
            className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-colors"
            aria-label={`Delete ${skill.name}`}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {triggers.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {triggers.slice(0, 6).map((t) => (
            <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.04] text-white/40 border border-white/[0.05]">
              {t}
            </span>
          ))}
          {triggers.length > 6 && <span className="text-[10px] text-white/25 px-1">+{triggers.length - 6}</span>}
        </div>
      )}

      <div className="flex items-center gap-4 mt-auto pt-3 border-t border-white/[0.04]">
        <Switch id={`skill-enabled-${skill.id}`} checked={skill.enabled} onChange={onToggleEnabled} label="Enabled" />
        <Switch
          id={`skill-autoload-${skill.id}`}
          checked={skill.auto_load}
          onChange={onToggleAutoLoad}
          label="Always on"
        />
      </div>

      {/* Inline delete confirmation */}
      {confirmingDelete && (
        <div className="absolute inset-0 rounded-2xl bg-[#0b0d12]/95 backdrop-blur-sm flex flex-col items-center justify-center gap-3 p-4 animate-modal-bg">
          <p className="text-white/70 text-sm text-center">
            Delete <span className="font-semibold text-white">{skill.name}</span>?
          </p>
          <p className="text-white/30 text-[11px] -mt-2">This can&apos;t be undone.</p>
          <div className="flex gap-2">
            <button
              onClick={onCancelDelete}
              className="px-3 py-1.5 rounded-lg text-xs text-white/60 bg-white/5 hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              id={`skill-confirm-delete-${skill.id}`}
              onClick={onConfirmDelete}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-red-500/80 hover:bg-red-500 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Built-in Skill Card ─────────────────────────────────────────────────
function CentralSkillCard({ skill }: { skill: CentralSkill }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.02] p-4">
      <div className="w-9 h-9 rounded-xl bg-white/[0.04] flex items-center justify-center shrink-0">
        <Library size={16} className="text-white/35" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-white/85 truncate">{skill.name}</p>
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${skill.active ? "bg-emerald-400" : "bg-white/15"}`}
            title={skill.active ? "Active" : "Inactive"}
          />
        </div>
        <p className="text-white/35 text-xs mt-0.5 line-clamp-2 leading-relaxed">{skill.description || "No description"}</p>
        {skill.category && (
          <span className="inline-block mt-2 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#00BCD4]/10 text-[#00BCD4]/70">
            {skill.category}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Editor Drawer ───────────────────────────────────────────────────────
function SkillEditor({
  skillId,
  onClose,
  onSaved,
}: {
  skillId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = skillId !== null;
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [triggers, setTriggers] = useState<string[]>([]);
  const [triggerDraft, setTriggerDraft] = useState("");
  const [autoLoad, setAutoLoad] = useState(false);

  // Edit mode: list endpoint truncates content → fetch the full skill.
  useEffect(() => {
    if (!skillId) return;
    let cancelled = false;
    apiClient
      .getUserSkill(skillId)
      .then((s) => {
        if (cancelled) return;
        setName(s.name || "");
        setDescription(s.description || "");
        setContent(s.content || "");
        setTriggers((s.triggers || []).filter(Boolean));
        setAutoLoad(!!s.auto_load);
      })
      .catch((e) => !cancelled && setError(errorMessage(e, "Couldn't load skill")))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [skillId]);

  // Escape closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !saving && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  const addTrigger = (raw: string) => {
    const parts = raw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    setTriggers((prev) => Array.from(new Set([...prev, ...parts])).slice(0, 50));
    setTriggerDraft("");
  };

  const canSave = name.trim().length > 0 && content.trim().length > 0 && !saving && !loading;

  const handleSave = async () => {
    if (!canSave) return;
    // Include any half-typed trigger
    const allTriggers = triggerDraft.trim()
      ? Array.from(new Set([...triggers, ...triggerDraft.split(",").map((t) => t.trim()).filter(Boolean)]))
      : triggers;
    const payload: UserSkillInput & { name: string; content: string } = {
      name: name.trim(),
      description: description.trim(),
      content: content.trim(),
      triggers: allTriggers,
      auto_load: autoLoad,
    };
    setSaving(true);
    setError(null);
    try {
      if (isEdit && skillId) {
        await apiClient.updateUserSkill(skillId, payload);
      } else {
        await apiClient.createUserSkill(payload);
      }
      onSaved();
    } catch (e) {
      setError(errorMessage(e, "Couldn't save skill"));
      setSaving(false);
    }
  };

  const inputCls =
    "w-full px-4 py-2.5 bg-white/[0.04] rounded-xl text-white text-sm placeholder:text-white/15 border border-transparent focus:border-[#00BCD4]/40 focus:outline-none transition-colors";

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="skill-editor-title">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] animate-modal-bg" onClick={() => !saving && onClose()} />
      <div className="relative w-full max-w-lg h-full bg-[var(--color-bg-elevated,#111318)] border-l border-white/[0.06] shadow-2xl flex flex-col animate-drawer-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 h-14 border-b border-white/[0.05] shrink-0">
          <h2 id="skill-editor-title" className="text-white font-semibold text-base">
            {isEdit ? "Edit skill" : "New skill"}
          </h2>
          <button onClick={onClose} disabled={saving} className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="animate-spin text-[#00BCD4]" size={22} />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                <AlertCircle size={14} className="text-red-400 shrink-0" />
                <p className="text-red-400 text-xs">{error}</p>
              </div>
            )}

            <Field label="Name" counter={`${name.length}/${MAX_NAME}`}>
              <input
                id="skill-name-input"
                autoFocus
                value={name}
                maxLength={MAX_NAME}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Weekly report writer"
                className={inputCls}
              />
            </Field>

            <Field label="Description" hint="Short summary shown in the list and used for matching.">
              <input
                id="skill-description-input"
                value={description}
                maxLength={MAX_DESCRIPTION}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What this skill helps with"
                className={inputCls}
              />
            </Field>

            <Field
              label="Instructions"
              counter={`${content.length.toLocaleString()}/${MAX_CONTENT.toLocaleString()}`}
              hint="Markdown supported. Tell the assistant exactly how to behave when this skill applies."
            >
              <textarea
                id="skill-content-input"
                value={content}
                maxLength={MAX_CONTENT}
                onChange={(e) => setContent(e.target.value)}
                rows={12}
                placeholder={"## When to use\nWhen I ask for a weekly report…\n\n## Steps\n1. …"}
                className={`${inputCls} font-mono text-[13px] leading-relaxed resize-y min-h-[200px]`}
              />
            </Field>

            <Field label="Triggers" hint="Keywords that activate this skill. Press Enter or comma to add.">
              <div className="flex flex-wrap items-center gap-1.5 px-2 py-2 bg-white/[0.04] rounded-xl border border-transparent focus-within:border-[#00BCD4]/40 transition-colors">
                {triggers.map((t) => (
                  <span key={t} className="flex items-center gap-1 text-[11px] pl-2 pr-1 py-0.5 rounded-full bg-[#00BCD4]/12 text-[#00BCD4]/90">
                    {t}
                    <button
                      onClick={() => setTriggers((prev) => prev.filter((x) => x !== t))}
                      className="p-0.5 rounded-full hover:bg-white/10"
                      aria-label={`Remove trigger ${t}`}
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
                <input
                  id="skill-trigger-input"
                  value={triggerDraft}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v.endsWith(",")) addTrigger(v);
                    else setTriggerDraft(v);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTrigger(triggerDraft);
                    } else if (e.key === "Backspace" && !triggerDraft && triggers.length) {
                      setTriggers((prev) => prev.slice(0, -1));
                    }
                  }}
                  onBlur={() => addTrigger(triggerDraft)}
                  placeholder={triggers.length ? "" : "report, weekly summary"}
                  className="flex-1 min-w-[120px] bg-transparent px-2 py-1 text-white text-sm placeholder:text-white/15 focus:outline-none"
                />
              </div>
            </Field>

            <div className="flex items-start justify-between gap-4 p-4 rounded-xl bg-white/[0.025] border border-white/[0.05]">
              <div>
                <p className="text-white/80 text-sm font-medium flex items-center gap-1.5">
                  <Zap size={13} className="text-[#00BCD4]" /> Always on
                </p>
                <p className="text-white/30 text-[11px] mt-0.5 leading-relaxed">
                  Add this skill to every conversation instead of only when triggers match. Uses more context, so keep it
                  short.
                </p>
              </div>
              <Switch id="skill-autoload-input" checked={autoLoad} onChange={setAutoLoad} label="" />
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/[0.05] shrink-0">
          <button onClick={onClose} disabled={saving} className="px-4 py-2 rounded-xl text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors">
            Cancel
          </button>
          <button
            id="skill-save-button"
            onClick={handleSave}
            disabled={!canSave}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#00BCD4] text-black font-semibold text-sm hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="animate-spin" size={15} /> : <Check size={15} />}
            {isEdit ? "Save changes" : "Create skill"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  counter,
  children,
}: {
  label: string;
  hint?: string;
  counter?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5 px-1">
        <span className="text-white/45 text-[11px] font-semibold uppercase tracking-wider">{label}</span>
        {counter && <span className="text-white/20 text-[10px] tabular-nums">{counter}</span>}
      </div>
      {children}
      {hint && <p className="text-white/20 text-[10px] mt-1.5 px-1">{hint}</p>}
    </div>
  );
}

// ── States ──────────────────────────────────────────────────────────────
function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-white/[0.04] bg-white/[0.02] p-4 animate-pulse">
          <div className="flex gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/[0.05]" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-1/2 rounded bg-white/[0.06]" />
              <div className="h-2.5 w-5/6 rounded bg-white/[0.04]" />
            </div>
          </div>
          <div className="h-2.5 w-1/3 rounded bg-white/[0.04] mt-5" />
        </div>
      ))}
    </div>
  );
}

function EmptyMine({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#7C4DFF]/15 to-[#00BCD4]/15 border border-white/[0.06] flex items-center justify-center mb-4">
        <Puzzle size={28} className="text-white/40" />
      </div>
      <p className="text-white/50 text-sm font-medium mb-1">No custom skills yet</p>
      <p className="text-white/25 text-xs max-w-xs mb-5">
        Create a skill to teach the assistant your own workflows, writing style, or domain knowledge.
      </p>
      <button
        onClick={onCreate}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00BCD4] text-black font-semibold text-sm hover:brightness-110 transition-all"
      >
        <Plus size={15} /> Create your first skill
      </button>
    </div>
  );
}

function NoMatches({ query }: { query: string }) {
  return (
    <div className="text-center py-16">
      <p className="text-white/35 text-sm">No skills match &ldquo;{query}&rdquo;</p>
    </div>
  );
}

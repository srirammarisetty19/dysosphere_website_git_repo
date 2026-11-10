"use client";

// ============================================================================
// Settings Page — Port of settings_screen.dart
// Profile, password, email integration, server info
// ============================================================================

import { useState, useEffect } from "react";
import {
  Settings as SettingsIcon,
  User,
  Lock,
  Mail,
  Eye,
  EyeOff,
  Server,
  LogOut,
  AlertCircle,
  CheckCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Send,
  Trash2,
  Menu,
  Wrench,
  Search,
  KeyRound,
  Globe,
  Plus,
  Pencil,
  ShieldCheck,
  Copy,
  Check,
  Cookie,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import type {
  ToolInfo,
  SavedLogin,
  BrowserSavedSession,
  CredentialProtection,
  CredentialApprovalPolicy,
  CredentialMatchMode,
  RevealedSavedLogin,
} from "@/lib/types";

export default function SettingsPage() {
  const router = useRouter();
  const { user, logout, activeAccount } = useAuthStore();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 h-14 border-b border-white/[0.04] shrink-0">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("toggle-sidebar"))}
            className="lg:hidden p-2 -ml-2 mr-1 rounded-lg text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
            aria-label="Open sidebar"
          >
            <Menu size={22} />
          </button>
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#78909C] to-[#546E7A] flex items-center justify-center">
            <SettingsIcon size={15} className="text-white" />
          </div>
          <h1 className="text-white font-semibold text-lg tracking-tight">Settings</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6 max-w-2xl">
        {/* Profile Section */}
        <ProfileSection user={user} />

        {/* Change Password */}
        <ChangePasswordSection />

        {/* Email Integration */}
        <EmailSection />

        {/* Telegram Integration */}
        <TelegramSection />

        {/* Saved Website Logins (Browser Vault) */}
        <SavedLoginsSection />

        {/* Server Info */}
        <ServerSection activeAccount={activeAccount} />

        {/* AI Tools (GET /tools/) */}
        <ToolsSection />

        {/* Sign Out */}
        <div className="pt-2 pb-8 space-y-3">
          <button
            onClick={() => {
              logout();
              router.replace("/login");
            }}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/8 border border-red-500/15 text-red-400 text-sm font-medium hover:bg-red-500/15 transition-colors"
          >
            <LogOut size={16} />
            Sign Out
          </button>

          <DeleteAccountSection />
        </div>
      </div>
    </div>
  );
}

// ── Section Header ──────────────────────────────────────────────────────
function SectionHeader({
  icon,
  label,
  color,
  expanded,
  onToggle,
  trailing,
}: {
  icon: React.ReactNode;
  label: string;
  color: string;
  expanded?: boolean;
  onToggle?: () => void;
  trailing?: React.ReactNode;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-3 w-full py-1"
    >
      <div
        className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${color}20` }}
      >
        <span style={{ color }}>{icon}</span>
      </div>
      <span className="text-white font-semibold text-[15px] tracking-tight flex-1 text-left">
        {label}
      </span>
      {trailing}
      {onToggle && (
        expanded ? <ChevronUp size={16} className="text-white/25" /> : <ChevronDown size={16} className="text-white/25" />
      )}
    </button>
  );
}

// ── Profile Section ─────────────────────────────────────────────────────
function ProfileSection({ user }: { user: { id: string; username: string; email: string } | null }) {
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState(user?.username || "");
  const [email, setEmail] = useState(user?.email || "");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSave = async () => {
    if (!username.trim() || !email.trim()) return;
    setLoading(true);
    setMsg(null);
    try {
      await apiClient.updateProfile({ username: username.trim(), email: email.trim() });
      setMsg({ type: "success", text: "Profile updated" });
      setEditing(false);
    } catch (err) {
      setMsg({ type: "error", text: err instanceof Error ? err.message : "Update failed" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/[0.05] overflow-hidden">
      <div className="p-5">
        <SectionHeader
          icon={<User size={16} />}
          label="Profile"
          color="#7C4DFF"
          expanded={editing}
          onToggle={() => { setEditing(!editing); setMsg(null); }}
        />

        {/* Profile display */}
        <div className="flex items-center gap-3 mt-4">
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#00BCD4] to-[#7C4DFF] flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-lg">
              {(user?.username || "?")[0].toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-semibold truncate">{user?.username || "—"}</p>
            {user?.email && (
              <p className="text-white/30 text-xs truncate">{user.email}</p>
            )}
          </div>
        </div>

        {/* Edit Form */}
        {editing && (
          <div className="mt-4 p-4 rounded-xl bg-white/[0.03] border border-white/[0.05] space-y-3">
            <FormField
              icon={<User size={14} />}
              placeholder="Username"
              value={username}
              onChange={setUsername}
            />
            <FormField
              icon={<Mail size={14} />}
              placeholder="Email"
              value={email}
              onChange={setEmail}
              type="email"
            />

            {msg && (
              <StatusMessage type={msg.type} text={msg.text} />
            )}

            <button
              onClick={handleSave}
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-[#7C4DFF]/15 text-[#7C4DFF] text-sm font-semibold hover:bg-[#7C4DFF]/25 transition-colors disabled:opacity-50 flex items-center justify-center"
            >
              {loading ? <Loader2 className="animate-spin" size={16} /> : "Save Changes"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Change Password Section ─────────────────────────────────────────────
function ChangePasswordSection() {
  const [expanded, setExpanded] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSubmit = async () => {
    if (!currentPw || !newPw || !confirmPw) {
      setMsg({ type: "error", text: "Please fill in all fields" });
      return;
    }
    if (newPw !== confirmPw) {
      setMsg({ type: "error", text: "New passwords do not match" });
      return;
    }
    if (newPw.length < 8) {
      setMsg({ type: "error", text: "Password must be at least 8 characters" });
      return;
    }

    setLoading(true);
    setMsg(null);
    try {
      await apiClient.changePassword(currentPw, newPw);
      setMsg({ type: "success", text: "Password changed. Please sign in again." });
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (err) {
      setMsg({ type: "error", text: err instanceof Error ? err.message : "Failed" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/[0.05] overflow-hidden">
      <div className="p-5">
        <SectionHeader
          icon={<Lock size={16} />}
          label="Change Password"
          color="#4DD0E1"
          expanded={expanded}
          onToggle={() => { setExpanded(!expanded); setMsg(null); }}
        />

        {expanded && (
          <div className="mt-4 p-4 rounded-xl bg-white/[0.03] border border-white/[0.05] space-y-3">
            <PasswordField
              placeholder="Current password"
              value={currentPw}
              onChange={setCurrentPw}
              show={showCurrent}
              onToggle={() => setShowCurrent(!showCurrent)}
            />
            <PasswordField
              placeholder="New password (min 8 chars)"
              value={newPw}
              onChange={setNewPw}
              show={showNew}
              onToggle={() => setShowNew(!showNew)}
            />
            <PasswordField
              placeholder="Confirm new password"
              value={confirmPw}
              onChange={setConfirmPw}
              show={showConfirm}
              onToggle={() => setShowConfirm(!showConfirm)}
            />

            <p className="text-white/15 text-[10px] px-1">
              After changing, you will be signed out of all devices.
            </p>

            {msg && <StatusMessage type={msg.type} text={msg.text} />}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-[#4DD0E1]/15 text-[#4DD0E1] text-sm font-semibold hover:bg-[#4DD0E1]/25 transition-colors disabled:opacity-50 flex items-center justify-center"
            >
              {loading ? <Loader2 className="animate-spin" size={16} /> : "Update Password"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Email Integration Section ───────────────────────────────────────────
function EmailSection() {
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState<{ configured: boolean; email: string; provider: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // Setup form
  const [showSetup, setShowSetup] = useState(false);
  const [emailAddr, setEmailAddr] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [setupLoading, setSetupLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getEmailStatus();
      setStatus(data);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const detectProvider = (email: string) => {
    const domain = email.split("@").pop()?.toLowerCase() || "";
    if (domain.includes("gmail")) return "gmail";
    if (domain.includes("outlook") || domain.includes("hotmail")) return "outlook";
    if (domain.includes("yahoo")) return "yahoo";
    return "gmail";
  };

  const handleSetup = async () => {
    if (!emailAddr.trim() || !appPassword.trim()) {
      setMsg({ type: "error", text: "Email and App Password required" });
      return;
    }
    setSetupLoading(true);
    setMsg(null);
    try {
      await apiClient.setupEmail(emailAddr.trim(), appPassword.trim(), detectProvider(emailAddr));
      setMsg({ type: "success", text: "Email configured" });
      setShowSetup(false);
      setEmailAddr("");
      setAppPassword("");
      loadStatus();
    } catch (err) {
      setMsg({ type: "error", text: err instanceof Error ? err.message : "Setup failed" });
    } finally {
      setSetupLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await apiClient.disconnectEmail();
      loadStatus();
    } catch {
      // ignore
    }
  };

  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/[0.05] overflow-hidden">
      <div className="p-5">
        <SectionHeader
          icon={<Mail size={16} />}
          label="Email Integration"
          color="#4DD0E1"
          expanded={expanded}
          onToggle={() => setExpanded(!expanded)}
          trailing={
            status?.configured ? (
              <span className="text-emerald-400 text-[10px] font-semibold mr-2">Connected</span>
            ) : null
          }
        />

        {expanded && (
          <div className="mt-4">
            {loading ? (
              <div className="py-4 text-center">
                <Loader2 className="animate-spin text-white/20 mx-auto" size={18} />
              </div>
            ) : status?.configured ? (
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <CheckCircle size={16} className="text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{status.email}</p>
                    <p className="text-white/25 text-[10px] uppercase">{status.provider}</p>
                  </div>
                </div>
                <button
                  onClick={handleDisconnect}
                  className="w-full py-2 rounded-lg bg-red-500/8 text-red-400 text-xs font-medium hover:bg-red-500/15 transition-colors"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {!showSetup ? (
                  <button
                    onClick={() => setShowSetup(true)}
                    className="w-full py-3 rounded-xl bg-[#4DD0E1]/10 text-[#4DD0E1] text-sm font-medium hover:bg-[#4DD0E1]/20 transition-colors flex items-center justify-center gap-2"
                  >
                    <Mail size={14} />
                    Configure Email
                  </button>
                ) : (
                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.05] space-y-3">
                    <FormField
                      icon={<Mail size={14} />}
                      placeholder="Email address"
                      value={emailAddr}
                      onChange={setEmailAddr}
                      type="email"
                    />
                    <div className="relative">
                      <FormField
                        icon={<Lock size={14} />}
                        placeholder="App Password"
                        value={appPassword}
                        onChange={setAppPassword}
                        type={showPw ? "text" : "password"}
                      />
                      <button
                        onClick={() => setShowPw(!showPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20"
                      >
                        {showPw ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                    </div>

                    {msg && <StatusMessage type={msg.type} text={msg.text} />}

                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowSetup(false)}
                        className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/40 text-sm font-medium hover:bg-white/10 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSetup}
                        disabled={setupLoading}
                        className="flex-1 py-2.5 rounded-xl bg-[#4DD0E1]/15 text-[#4DD0E1] text-sm font-semibold hover:bg-[#4DD0E1]/25 transition-colors disabled:opacity-50 flex items-center justify-center"
                      >
                        {setupLoading ? <Loader2 className="animate-spin" size={16} /> : "Connect"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Server Info Section ─────────────────────────────────────────────────
function ServerSection({ activeAccount }: { activeAccount: { serverUrl: string; username: string } | null }) {
  const serverUrl = activeAccount?.serverUrl || (typeof window !== "undefined" ? localStorage.getItem("spherex_server") : null) || "—";

  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/[0.05] overflow-hidden">
      <div className="p-5">
        <SectionHeader
          icon={<Server size={16} />}
          label="Server"
          color="#78909C"
        />

        <div className="mt-4 p-4 rounded-xl bg-white/[0.03] border border-white/[0.05]">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-white/25 text-[10px] uppercase tracking-wider font-semibold mb-1">Connected To</p>
              <p className="text-white/60 text-sm font-mono truncate">
                {serverUrl.replace(/^https?:\/\//, "")}
              </p>
            </div>
            <div className="flex items-center gap-1.5 ml-3 shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-400/60" />
              <span className="text-emerald-400/60 text-[10px] font-medium">Online</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── AI Tools Section ───────────────────────────────────────────────────
// Read-only list of tools the assistant can use on this server.
function ToolsSection() {
  const [expanded, setExpanded] = useState(false);
  const [tools, setTools] = useState<ToolInfo[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [openTool, setOpenTool] = useState<string | null>(null);

  // Lazy-load on first expand (from the click handler, not an effect).
  // Re-opening after an error retries.
  const handleToggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (!next || loading || tools !== null) return;
    setLoading(true);
    setError(null);
    apiClient
      .getAvailableTools()
      .then((list) => setTools([...list].sort((a, b) => a.name.localeCompare(b.name))))
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load tools"))
      .finally(() => setLoading(false));
  };

  const q = query.trim().toLowerCase();
  const filtered = (tools ?? []).filter(
    (t) => !q || t.name.toLowerCase().includes(q) || (t.description || "").toLowerCase().includes(q)
  );

  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/[0.05] overflow-hidden">
      <div className="p-5">
        <SectionHeader
          icon={<Wrench size={16} />}
          label="AI Tools"
          color="#7C4DFF"
          expanded={expanded}
          onToggle={handleToggle}
          trailing={
            tools !== null ? (
              <span className="text-white/25 text-[11px] mr-2 tabular-nums">{tools.length}</span>
            ) : undefined
          }
        />

        {expanded && (
          <div className="mt-4 space-y-3">
            <p className="text-white/30 text-xs leading-relaxed">
              Capabilities the assistant can use automatically while answering. This list comes from your server.
            </p>

            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="animate-spin text-[#7C4DFF]" size={20} />
              </div>
            ) : error ? (
              <StatusMessage type="error" text={error} />
            ) : (
              <>
                {(tools?.length ?? 0) > 6 && (
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
                    <input
                      id="settings-tools-search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search tools"
                      className="w-full pl-9 pr-3 py-2 bg-white/[0.04] rounded-xl text-white text-sm placeholder:text-white/15 border border-transparent focus:border-[#7C4DFF]/40 focus:outline-none transition-colors"
                    />
                  </div>
                )}
                {filtered.length === 0 ? (
                  <p className="text-white/25 text-xs text-center py-4">
                    {q ? `No tools match “${query}”` : "No tools are registered on this server."}
                  </p>
                ) : (
                  <div className="max-h-[420px] overflow-y-auto -mx-1 px-1 space-y-1.5">
                    {filtered.map((tool) => {
                      const params = tool.schema?.function?.parameters;
                      const props = Object.entries(params?.properties ?? {});
                      const required = new Set(params?.required ?? []);
                      const open = openTool === tool.name;
                      return (
                        <div key={tool.name} className="rounded-xl bg-white/[0.025] border border-white/[0.04]">
                          <button
                            onClick={() => setOpenTool(open ? null : tool.name)}
                            className="w-full text-left px-3.5 py-2.5"
                            aria-expanded={open}
                          >
                            <div className="flex items-center gap-2">
                              <code className="text-[12px] text-[#B39DFF] font-mono">{tool.name}</code>
                              {props.length > 0 && (
                                <span className="text-white/20 text-[10px]">
                                  {props.length} param{props.length > 1 ? "s" : ""}
                                </span>
                              )}
                            </div>
                            <p className={`text-white/40 text-xs mt-0.5 leading-relaxed ${open ? "" : "line-clamp-2"}`}>
                              {tool.description || "No description"}
                            </p>
                          </button>
                          {open && props.length > 0 && (
                            <div className="px-3.5 pb-3 space-y-1.5">
                              {props.map(([pname, p]) => (
                                <div key={pname} className="flex gap-2 text-[11px]">
                                  <code className="text-white/60 font-mono shrink-0">
                                    {pname}
                                    {required.has(pname) && <span className="text-[#FF8A80]">*</span>}
                                  </code>
                                  {p.type && <span className="text-white/20 shrink-0">{p.type}</span>}
                                  {p.description && <span className="text-white/35">{p.description}</span>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Shared UI Components ────────────────────────────────────────────────
function FormField({
  icon,
  placeholder,
  value,
  onChange,
  type = "text",
}: {
  icon: React.ReactNode;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="relative">
      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/20">{icon}</span>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-10 pr-4 py-3 bg-white/[0.04] rounded-xl text-white text-sm placeholder:text-white/15 border border-transparent focus:border-white/10 focus:outline-none transition-colors"
      />
    </div>
  );
}

function PasswordField({
  placeholder,
  value,
  onChange,
  show,
  onToggle,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="relative">
      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/20">
        <Lock size={14} />
      </span>
      <input
        type={show ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-10 pr-10 py-3 bg-white/[0.04] rounded-xl text-white text-sm placeholder:text-white/15 border border-transparent focus:border-white/10 focus:outline-none transition-colors"
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/40 transition-colors"
      >
        {show ? <Eye size={14} /> : <EyeOff size={14} />}
      </button>
    </div>
  );
}

function StatusMessage({ type, text }: { type: "success" | "error"; text: string }) {
  return (
    <div className={`flex items-center gap-2 p-3 rounded-lg text-xs ${
      type === "success"
        ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
        : "bg-red-500/10 border border-red-500/20 text-red-400"
    }`}>
      {type === "success" ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
      {text}
    </div>
  );
}

// ── Telegram Integration Section ────────────────────────────────────────
function TelegramSection() {
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState<{ configured: boolean; bot_username?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const [showSetup, setShowSetup] = useState(false);
  const [botToken, setBotToken] = useState("");
  const [setupLoading, setSetupLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getTelegramStatus();
      setStatus(data);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleSetup = async () => {
    if (!botToken.trim()) {
      setMsg({ type: "error", text: "Bot token is required" });
      return;
    }
    setSetupLoading(true);
    setMsg(null);
    try {
      await apiClient.setupTelegram(botToken.trim());
      setMsg({ type: "success", text: "Telegram bot connected" });
      setShowSetup(false);
      setBotToken("");
      loadStatus();
    } catch (err) {
      setMsg({ type: "error", text: err instanceof Error ? err.message : "Setup failed" });
    } finally {
      setSetupLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await apiClient.disconnectTelegram();
      loadStatus();
    } catch {
      // ignore
    }
  };

  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/[0.05] overflow-hidden">
      <div className="p-5">
        <SectionHeader
          icon={<Send size={16} />}
          label="Telegram Integration"
          color="#0088CC"
          expanded={expanded}
          onToggle={() => setExpanded(!expanded)}
          trailing={
            status?.configured ? (
              <span className="text-emerald-400 text-[10px] font-semibold mr-2">Connected</span>
            ) : null
          }
        />

        {expanded && (
          <div className="mt-4">
            {loading ? (
              <div className="py-4 text-center">
                <Loader2 className="animate-spin text-white/20 mx-auto" size={18} />
              </div>
            ) : status?.configured ? (
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-[#0088CC]/10 flex items-center justify-center">
                    <Send size={16} className="text-[#0088CC]" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">
                      @{status.bot_username || "Connected"}
                    </p>
                    <p className="text-white/25 text-[10px] uppercase">Telegram Bot</p>
                  </div>
                </div>
                <button
                  onClick={handleDisconnect}
                  className="w-full py-2 rounded-lg bg-red-500/8 text-red-400 text-xs font-medium hover:bg-red-500/15 transition-colors"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {!showSetup ? (
                  <button
                    onClick={() => setShowSetup(true)}
                    className="w-full py-3 rounded-xl bg-[#0088CC]/10 text-[#0088CC] text-sm font-medium hover:bg-[#0088CC]/20 transition-colors flex items-center justify-center gap-2"
                  >
                    <Send size={14} />
                    Connect Telegram Bot
                  </button>
                ) : (
                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.05] space-y-3">
                    <FormField
                      icon={<Send size={14} />}
                      placeholder="Bot token from @BotFather"
                      value={botToken}
                      onChange={setBotToken}
                    />
                    <p className="text-white/15 text-[10px] px-1">
                      Create a bot via @BotFather on Telegram, then paste the token here.
                    </p>

                    {msg && <StatusMessage type={msg.type} text={msg.text} />}

                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowSetup(false)}
                        className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/40 text-sm font-medium hover:bg-white/10 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSetup}
                        disabled={setupLoading}
                        className="flex-1 py-2.5 rounded-xl bg-[#0088CC]/15 text-[#0088CC] text-sm font-semibold hover:bg-[#0088CC]/25 transition-colors disabled:opacity-50 flex items-center justify-center"
                      >
                        {setupLoading ? <Loader2 className="animate-spin" size={16} /> : "Connect"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Saved Website Logins (Browser Vault) Section ───────────────────────
function SavedLoginsSection() {
  const [expanded, setExpanded] = useState(false);
  const [logins, setLogins] = useState<SavedLogin[]>([]);
  const [sessions, setSessions] = useState<BrowserSavedSession[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Add / Edit form state
  const [formOpen, setFormOpen] = useState(false);
  const [editingLogin, setEditingLogin] = useState<SavedLogin | null>(null);
  const [origin, setOrigin] = useState("");
  const [label, setLabel] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [totpSecret, setTotpSecret] = useState("");
  const [clearTotp, setClearTotp] = useState(false);
  const [matchMode, setMatchMode] = useState<CredentialMatchMode>("exact");
  const [linkedOriginsInput, setLinkedOriginsInput] = useState("");
  const [protection, setProtection] = useState<CredentialProtection>("automatic");
  const [approvalPolicy, setApprovalPolicy] = useState<CredentialApprovalPolicy>("first_time");
  const [passphrase, setPassphrase] = useState("");
  const [currentPassphrase, setCurrentPassphrase] = useState("");
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Reveal state (auto-clears after 30s; never stored outside transient component memory)
  const [revealingId, setRevealingId] = useState<string | null>(null);
  const [revealAccountPw, setRevealAccountPw] = useState("");
  const [revealPassphrase, setRevealPassphrase] = useState("");
  const [revealLoading, setRevealLoading] = useState(false);
  const [revealError, setRevealError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<RevealedSavedLogin | null>(null);
  const [copiedField, setCopiedField] = useState<"username" | "password" | null>(null);

  // Browser cookie session state
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [loginList, sessionList] = await Promise.all([
        apiClient.getSavedLogins(),
        apiClient.getBrowserSavedSessions().catch(() => [] as BrowserSavedSession[]),
      ]);
      setLogins(loginList);
      setSessions(sessionList);
      setLoaded(true);
    } catch (err) {
      setMsg({ type: "error", text: err instanceof Error ? err.message : "Failed to load saved logins" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!revealed) return;
    const timer = setTimeout(() => {
      setRevealed(null);
      setRevealingId(null);
      setRevealAccountPw("");
      setRevealPassphrase("");
    }, 30_000);
    return () => clearTimeout(timer);
  }, [revealed]);

  const handleToggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (!next) {
      // Clear any revealed secrets on collapse
      setRevealed(null);
      setRevealingId(null);
      setRevealAccountPw("");
      setRevealPassphrase("");
      return;
    }
    if (!loaded && !loading) {
      void loadAll();
    }
  };

  const resetForm = () => {
    setEditingLogin(null);
    setOrigin("");
    setLabel("");
    setUsername("");
    setPassword("");
    setShowPassword(false);
    setTotpSecret("");
    setClearTotp(false);
    setMatchMode("exact");
    setLinkedOriginsInput("");
    setProtection("automatic");
    setApprovalPolicy("first_time");
    setPassphrase("");
    setCurrentPassphrase("");
    setShowPassphrase(false);
  };

  const openAddForm = () => {
    resetForm();
    setMsg(null);
    setFormOpen(true);
  };

  const openEditForm = (item: SavedLogin) => {
    resetForm();
    setEditingLogin(item);
    setOrigin(item.origin);
    setLabel(item.label);
    setMatchMode(item.match_mode);
    setLinkedOriginsInput((item.linked_origins || []).join(", "));
    setProtection(item.protection);
    setApprovalPolicy(item.approval_policy);
    setMsg(null);
    setFormOpen(true);
  };

  const handleSave = async () => {
    const cleanOrigin = origin.trim();
    if (!cleanOrigin) {
      setMsg({ type: "error", text: "Website URL (https://...) is required" });
      return;
    }
    if (!editingLogin && (!username.trim() || !password)) {
      setMsg({ type: "error", text: "Username and password are required" });
      return;
    }
    const linked = linkedOriginsInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (protection === "locked" && !editingLogin && passphrase.length < 6) {
      setMsg({ type: "error", text: "Unlock passphrase must be at least 6 characters for Locked logins" });
      return;
    }

    setSaving(true);
    setMsg(null);
    try {
      if (editingLogin) {
        await apiClient.updateSavedLogin(editingLogin.id, {
          origin: cleanOrigin,
          label: label.trim() || undefined,
          linked_origins: linked,
          match_mode: matchMode,
          ...(username.trim() ? { username: username.trim() } : {}),
          ...(password ? { password } : {}),
          ...(totpSecret.trim() ? { totp_secret: totpSecret.trim() } : {}),
          ...(clearTotp ? { clear_totp: true } : {}),
          protection,
          approval_policy: approvalPolicy,
          ...(passphrase ? { passphrase } : {}),
          ...(currentPassphrase ? { current_passphrase: currentPassphrase } : {}),
        });
        setMsg({ type: "success", text: "Saved login updated" });
      } else {
        await apiClient.createSavedLogin({
          origin: cleanOrigin,
          label: label.trim() || undefined,
          username: username.trim(),
          password,
          ...(totpSecret.trim() ? { totp_secret: totpSecret.trim() } : {}),
          linked_origins: linked.length > 0 ? linked : undefined,
          match_mode: matchMode,
          protection,
          approval_policy: approvalPolicy,
          ...(protection === "locked" && passphrase ? { passphrase } : {}),
        });
        setMsg({ type: "success", text: "Login encrypted and saved to vault" });
      }
      resetForm();
      setFormOpen(false);
      await loadAll();
    } catch (err) {
      setMsg({ type: "error", text: err instanceof Error ? err.message : "Could not save login" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    setMsg(null);
    try {
      await apiClient.deleteSavedLogin(id);
      if (revealingId === id) {
        setRevealed(null);
        setRevealingId(null);
      }
      await loadAll();
    } catch (err) {
      setMsg({ type: "error", text: err instanceof Error ? err.message : "Could not delete login" });
    } finally {
      setDeletingId(null);
    }
  };

  const handleRevealSubmit = async (item: SavedLogin) => {
    if (!revealAccountPw) {
      setRevealError("Account password is required to reveal saved secrets");
      return;
    }
    if (item.protection === "locked" && !revealPassphrase) {
      setRevealError("Unlock passphrase is required for this locked login");
      return;
    }
    setRevealLoading(true);
    setRevealError(null);
    try {
      const res = await apiClient.revealSavedLogin(
        item.id,
        revealAccountPw,
        revealPassphrase || undefined,
      );
      setRevealed(res);
      setRevealAccountPw("");
      setRevealPassphrase("");
    } catch (err) {
      setRevealError(err instanceof Error ? err.message : "Reveal failed");
    } finally {
      setRevealLoading(false);
    }
  };

  const copySecret = async (field: "username" | "password", val: string | null) => {
    if (!val) return;
    try {
      await navigator.clipboard.writeText(val);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // clipboard unavailable
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    setRevokingSessionId(sessionId);
    try {
      await apiClient.revokeBrowserSavedSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (err) {
      setMsg({ type: "error", text: err instanceof Error ? err.message : "Could not sign out session" });
    } finally {
      setRevokingSessionId(null);
    }
  };

  const handleRevokeAllSessions = async () => {
    setRevokingSessionId("__all__");
    try {
      await apiClient.revokeAllBrowserSavedSessions();
      setSessions([]);
      setMsg({ type: "success", text: "Signed out of all saved browser sessions" });
    } catch (err) {
      setMsg({ type: "error", text: err instanceof Error ? err.message : "Could not sign out sessions" });
    } finally {
      setRevokingSessionId(null);
    }
  };

  const policyLabel = (p: CredentialApprovalPolicy) => {
    if (p === "first_time") return "Ask first time";
    if (p === "every_time") return "Ask every time";
    return "Auto-allow";
  };

  return (
    <div className="rounded-2xl bg-white/[0.03] border border-white/[0.05] overflow-hidden">
      <div className="p-5">
        <SectionHeader
          icon={<KeyRound size={16} />}
          label="Website Logins"
          color="#FFB300"
          expanded={expanded}
          onToggle={handleToggle}
          trailing={
            loaded && logins.length > 0 ? (
              <span className="text-amber-300/80 text-[10px] font-semibold mr-2 tabular-nums">
                {logins.length} saved
              </span>
            ) : null
          }
        />

        {expanded && (
          <div className="mt-4 space-y-4">
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/[0.05] border border-amber-400/15">
              <ShieldCheck size={15} className="text-amber-300 shrink-0 mt-0.5" />
              <p className="text-white/55 text-[11.5px] leading-relaxed">
                Store website credentials for the browser agent. Passwords &amp; 2FA secrets are encrypted with per-secret AES-256-GCM keys and are <span className="text-white/85 font-medium">never visible to the AI model</span>—only filled into verified HTTPS login fields.
              </p>
            </div>

            {msg && <StatusMessage type={msg.type} text={msg.text} />}

            {loading ? (
              <div className="py-5 text-center">
                <Loader2 className="animate-spin text-white/25 mx-auto" size={18} />
              </div>
            ) : (
              <>
                {/* Saved Logins List */}
                {logins.length > 0 && (
                  <div className="space-y-2.5">
                    {logins.map((item) => {
                      const isRevealing = revealingId === item.id;
                      const itemRevealed = revealed?.id === item.id ? revealed : null;
                      return (
                        <div
                          key={item.id}
                          className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-2.5"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-white text-sm font-semibold truncate">
                                  {item.label || item.domain}
                                </span>
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                    item.protection === "locked"
                                      ? "bg-amber-500/15 text-amber-300"
                                      : "bg-emerald-500/15 text-emerald-300"
                                  }`}
                                >
                                  {item.protection === "locked" ? "Locked" : "Automatic"}
                                </span>
                                {item.has_totp && (
                                  <span className="px-1.5 py-0.5 rounded bg-[#7C4DFF]/15 text-[#B39DFF] text-[10px] font-semibold">
                                    2FA
                                  </span>
                                )}
                                {item.protection === "automatic" && (
                                  <span className="px-1.5 py-0.5 rounded bg-white/[0.05] text-white/45 text-[10px]">
                                    {policyLabel(item.approval_policy)}
                                  </span>
                                )}
                              </div>
                              <p className="text-white/40 text-xs font-mono truncate mt-0.5">
                                {item.origin}
                              </p>
                              <p className="text-white/50 text-xs mt-0.5">
                                {item.username_hint}
                                {item.use_count > 0 ? ` · Used ${item.use_count}×` : ""}
                              </p>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => {
                                  if (isRevealing) {
                                    setRevealingId(null);
                                    setRevealed(null);
                                    setRevealError(null);
                                  } else {
                                    setRevealingId(item.id);
                                    setRevealed(null);
                                    setRevealError(null);
                                    setRevealAccountPw("");
                                    setRevealPassphrase("");
                                  }
                                }}
                                className="p-2 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/5 transition-colors"
                                title={isRevealing ? "Hide secret" : "Reveal secret"}
                              >
                                {isRevealing ? <EyeOff size={14} /> : <Eye size={14} />}
                              </button>
                              <button
                                type="button"
                                onClick={() => openEditForm(item)}
                                className="p-2 rounded-lg text-white/40 hover:text-white/80 hover:bg-white/5 transition-colors"
                                title="Edit login"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDelete(item.id)}
                                disabled={deletingId === item.id}
                                className="p-2 rounded-lg text-white/35 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40"
                                title="Delete login"
                              >
                                {deletingId === item.id ? (
                                  <Loader2 className="animate-spin" size={14} />
                                ) : (
                                  <Trash2 size={14} />
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Reveal panel */}
                          {isRevealing && (
                            <div className="p-3 rounded-lg bg-black/30 border border-white/[0.06] space-y-2">
                              {itemRevealed ? (
                                <div className="space-y-1.5 text-xs">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-white/40">Username:</span>
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <code className="text-white/90 font-mono truncate">
                                        {itemRevealed.username || "—"}
                                      </code>
                                      {itemRevealed.username && (
                                        <button
                                          type="button"
                                          onClick={() => void copySecret("username", itemRevealed.username)}
                                          className="p-1 text-white/40 hover:text-white"
                                          title="Copy username"
                                        >
                                          {copiedField === "username" ? <Check size={12} /> : <Copy size={12} />}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-white/40">Password:</span>
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <code className="text-amber-200 font-mono truncate">
                                        {itemRevealed.password || "—"}
                                      </code>
                                      {itemRevealed.password && (
                                        <button
                                          type="button"
                                          onClick={() => void copySecret("password", itemRevealed.password)}
                                          className="p-1 text-white/40 hover:text-white"
                                          title="Copy password"
                                        >
                                          {copiedField === "password" ? <Check size={12} /> : <Copy size={12} />}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  <p className="text-[10px] text-white/25 pt-1">
                                    Auto-hides in 30 seconds.
                                  </p>
                                </div>
                              ) : (
                                <>
                                  <p className="text-[11px] text-white/50">
                                    Confirm your Sphere account password to reveal this login:
                                  </p>
                                  <input
                                    type="password"
                                    autoComplete="current-password"
                                    placeholder="Account password"
                                    value={revealAccountPw}
                                    onChange={(e) => setRevealAccountPw(e.target.value)}
                                    className="w-full px-3 py-2 bg-white/[0.04] rounded-lg text-white text-xs placeholder:text-white/20 border border-white/[0.06] focus:outline-none"
                                  />
                                  {item.protection === "locked" && (
                                    <input
                                      type="password"
                                      autoComplete="off"
                                      placeholder="Unlock passphrase for this locked login"
                                      value={revealPassphrase}
                                      onChange={(e) => setRevealPassphrase(e.target.value)}
                                      className="w-full px-3 py-2 bg-white/[0.04] rounded-lg text-white text-xs placeholder:text-white/20 border border-white/[0.06] focus:outline-none"
                                    />
                                  )}
                                  {revealError && (
                                    <p className="text-red-400 text-[11px]">{revealError}</p>
                                  )}
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setRevealingId(null);
                                        setRevealError(null);
                                      }}
                                      className="flex-1 py-1.5 rounded-lg bg-white/5 text-white/50 text-xs hover:bg-white/10"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      disabled={revealLoading}
                                      onClick={() => void handleRevealSubmit(item)}
                                      className="flex-1 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 text-xs font-semibold hover:bg-amber-500/30 disabled:opacity-50 flex items-center justify-center"
                                    >
                                      {revealLoading ? <Loader2 className="animate-spin" size={13} /> : "Reveal"}
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add / Edit Form */}
                {!formOpen ? (
                  <button
                    type="button"
                    onClick={openAddForm}
                    className="w-full py-3 rounded-xl bg-[#FFB300]/12 text-[#FFB300] text-sm font-medium hover:bg-[#FFB300]/20 transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus size={15} />
                    Add Website Login
                  </button>
                ) : (
                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-3">
                    <p className="text-white text-xs font-semibold">
                      {editingLogin ? `Edit ${editingLogin.label || editingLogin.domain}` : "Add Website Login"}
                    </p>

                    <FormField
                      icon={<Globe size={14} />}
                      placeholder="Website URL (e.g. https://amazon.in)"
                      value={origin}
                      onChange={setOrigin}
                      type="url"
                    />

                    <FormField
                      icon={<KeyRound size={14} />}
                      placeholder="Label (optional, e.g. Amazon Personal)"
                      value={label}
                      onChange={setLabel}
                    />

                    <FormField
                      icon={<User size={14} />}
                      placeholder={
                        editingLogin
                          ? `New username/email (leave blank to keep ${editingLogin.username_hint})`
                          : "Username or email"
                      }
                      value={username}
                      onChange={setUsername}
                    />

                    <PasswordField
                      placeholder={
                        editingLogin
                          ? "New password (leave blank to keep current)"
                          : "Password"
                      }
                      value={password}
                      onChange={setPassword}
                      show={showPassword}
                      onToggle={() => setShowPassword(!showPassword)}
                    />

                    <FormField
                      icon={<ShieldCheck size={14} />}
                      placeholder={
                        editingLogin?.has_totp
                          ? "Replace 2FA TOTP secret (Base32, optional)"
                          : "Optional 2FA TOTP secret (Base32)"
                      }
                      value={totpSecret}
                      onChange={setTotpSecret}
                    />

                    {editingLogin?.has_totp && (
                      <label className="flex items-center gap-2 text-xs text-white/55 px-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={clearTotp}
                          onChange={(e) => setClearTotp(e.target.checked)}
                          className="rounded border-white/20 bg-white/5"
                        />
                        Remove saved 2FA secret
                      </label>
                    )}

                    {/* Origin match mode & linked auth origins */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider text-white/35 font-semibold mb-1 px-1">
                          Domain Matching
                        </label>
                        <select
                          value={matchMode}
                          onChange={(e) => setMatchMode(e.target.value as CredentialMatchMode)}
                          className="w-full px-3 py-2.5 bg-white/[0.04] rounded-xl text-white text-xs border border-white/[0.06] focus:outline-none"
                        >
                          <option value="exact" className="bg-[#141820]">Exact origin only (Recommended)</option>
                          <option value="site" className="bg-[#141820]">Include subdomains</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase tracking-wider text-white/35 font-semibold mb-1 px-1">
                          Protection Mode
                        </label>
                        <select
                          value={protection}
                          onChange={(e) => setProtection(e.target.value as CredentialProtection)}
                          className="w-full px-3 py-2.5 bg-white/[0.04] rounded-xl text-white text-xs border border-white/[0.06] focus:outline-none"
                        >
                          <option value="automatic" className="bg-[#141820]">Automatic (Server Vault)</option>
                          <option value="locked" className="bg-[#141820]">Locked (Passphrase Required)</option>
                        </select>
                      </div>
                    </div>

                    {protection === "automatic" && (
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider text-white/35 font-semibold mb-1 px-1">
                          Agent Approval Policy
                        </label>
                        <select
                          value={approvalPolicy}
                          onChange={(e) => setApprovalPolicy(e.target.value as CredentialApprovalPolicy)}
                          className="w-full px-3 py-2.5 bg-white/[0.04] rounded-xl text-white text-xs border border-white/[0.06] focus:outline-none"
                        >
                          <option value="first_time" className="bg-[#141820]">Ask me the first time on a site</option>
                          <option value="every_time" className="bg-[#141820]">Ask me every time before signing in</option>
                          <option value="never_ask" className="bg-[#141820]">Allow automatically without asking</option>
                        </select>
                      </div>
                    )}

                    {editingLogin?.protection === "locked" && (
                      <PasswordField
                        placeholder="Current unlock passphrase (required to update secrets)"
                        value={currentPassphrase}
                        onChange={setCurrentPassphrase}
                        show={showPassphrase}
                        onToggle={() => setShowPassphrase(!showPassphrase)}
                      />
                    )}

                    {protection === "locked" && (
                      <PasswordField
                        placeholder={
                          editingLogin?.protection === "locked"
                            ? "New unlock passphrase (leave blank to keep current)"
                            : "Set unlock passphrase (min 6 chars)"
                        }
                        value={passphrase}
                        onChange={setPassphrase}
                        show={showPassphrase}
                        onToggle={() => setShowPassphrase(!showPassphrase)}
                      />
                    )}

                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-white/35 font-semibold mb-1 px-1">
                        Linked Auth Origins (optional, comma-separated)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. https://accounts.example.com"
                        value={linkedOriginsInput}
                        onChange={(e) => setLinkedOriginsInput(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white/[0.04] rounded-xl text-white text-xs placeholder:text-white/15 border border-transparent focus:border-white/10 focus:outline-none"
                      />
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          resetForm();
                          setFormOpen(false);
                        }}
                        className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/45 text-sm font-medium hover:bg-white/10 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSave()}
                        disabled={saving}
                        className="flex-1 py-2.5 rounded-xl bg-[#FFB300]/20 text-[#FFB300] text-sm font-semibold hover:bg-[#FFB300]/30 transition-colors disabled:opacity-50 flex items-center justify-center"
                      >
                        {saving ? (
                          <Loader2 className="animate-spin" size={16} />
                        ) : editingLogin ? (
                          "Update Login"
                        ) : (
                          "Save Login"
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Signed-In Browser Cookie Sessions */}
                {sessions.length > 0 && (
                  <div className="pt-2 border-t border-white/[0.05] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Cookie size={13} className="text-white/40" />
                        <span className="text-white/60 text-xs font-semibold">
                          Signed-In Browser Sessions ({sessions.length})
                        </span>
                      </div>
                      {sessions.length > 1 && (
                        <button
                          type="button"
                          disabled={revokingSessionId !== null}
                          onClick={() => void handleRevokeAllSessions()}
                          className="text-[11px] text-red-400/80 hover:text-red-300 font-medium disabled:opacity-50"
                        >
                          Sign out all
                        </button>
                      )}
                    </div>
                    <p className="text-white/30 text-[11px]">
                      Encrypted session cookies let the browser agent stay signed in across runs without re-authenticating.
                    </p>
                    <div className="space-y-1.5">
                      {sessions.map((sess) => (
                        <div
                          key={sess.id}
                          className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white/[0.025] border border-white/[0.04]"
                        >
                          <div className="min-w-0">
                            <p className="text-white/80 text-xs font-medium truncate">
                              {sess.site_domain}
                            </p>
                            <p className="text-white/30 text-[10px]">
                              {sess.cookie_count} cookie{sess.cookie_count === 1 ? "" : "s"}
                              {sess.expires_at
                                ? ` · Expires ${new Date(sess.expires_at).toLocaleDateString()}`
                                : ""}
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={revokingSessionId === sess.id}
                            onClick={() => void handleRevokeSession(sess.id)}
                            className="px-2.5 py-1 rounded-lg bg-red-500/10 text-red-400 text-[11px] font-medium hover:bg-red-500/20 transition-colors disabled:opacity-50"
                          >
                            {revokingSessionId === sess.id ? "..." : "Sign out"}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Delete Account Section ──────────────────────────────────────────────
function DeleteAccountSection() {
  const router = useRouter();
  const { logout } = useAuthStore();
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    try {
      await apiClient.deleteAccount();
      logout();
      router.replace("/login");
    } catch {
      setLoading(false);
    }
  };

  return confirm ? (
    <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20 space-y-3">
      <p className="text-red-400 text-xs font-medium">
        This will permanently delete your account and all data. This action cannot be undone.
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => setConfirm(false)}
          className="flex-1 py-2.5 rounded-xl bg-white/5 text-white/40 text-sm font-medium hover:bg-white/10 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="flex-1 py-2.5 rounded-xl bg-red-500/20 text-red-400 text-sm font-semibold hover:bg-red-500/30 transition-colors disabled:opacity-50 flex items-center justify-center"
        >
          {loading ? <Loader2 className="animate-spin" size={16} /> : "Delete Forever"}
        </button>
      </div>
    </div>
  ) : (
    <button
      onClick={() => setConfirm(true)}
      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white/[0.02] border border-white/[0.04] text-white/20 text-xs font-medium hover:text-red-400 hover:border-red-500/20 transition-colors"
    >
      <Trash2 size={13} />
      Delete Account
    </button>
  );
}

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
} from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";

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

        {/* Server Info */}
        <ServerSection activeAccount={activeAccount} />

        {/* Sign Out */}
        <div className="pt-2 pb-8 space-y-3">
          <button
            onClick={() => {
              logout();
              router.push("/login");
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
      router.push("/login");
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

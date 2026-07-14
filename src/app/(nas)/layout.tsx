"use client";

// ============================================================================
// NAS App Layout — Google Drive-style layout with sidebar + content area
// Shares auth with AI app via the same auth-store
// ============================================================================

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { nasApiClient } from "@/lib/nas-api-client";
import { NasSidebar } from "@/components/nas/nas-sidebar";
import { Loader2, WifiOff, RefreshCw, PanelLeftClose, Menu, LogOut, Settings, ChevronRight } from "lucide-react";
import Link from "next/link";

function NasLayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, _hasHydrated } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile drawer
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("nas-sidebar-collapsed") === "true";
    }
    return false;
  });
  const [isServerOnline, setIsServerOnline] = useState(true);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);

  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarCollapsed((v) => {
      const next = !v;
      localStorage.setItem("nas-sidebar-collapsed", String(next));
      return next;
    });
  }, []);

  // ── Gateway Auth Handoff ────────────────────────────────────────────
  useEffect(() => {
    const token = searchParams.get("token");
    const server = searchParams.get("server");
    const username = searchParams.get("username");

    if (token && server && username) {
      const { accounts } = useAuthStore.getState();
      const account = {
        id: `${username}@${server}`,
        username,
        email: "",
        serverUrl: server,
        token,
      };
      const updatedAccounts = [
        ...accounts.filter((a) => a.id !== account.id),
        account,
      ];

      useAuthStore.setState({
        user: { id: "gateway", username, email: "" },
        activeAccount: account,
        accounts: updatedAccounts,
      });

      // Sync NAS client
      nasApiClient.setToken(token);
      nasApiClient.setServerUrl(server);

      // Clean URL
      router.replace("/nas");
    }
  }, [searchParams, router]);

  // ── Sync NAS client with auth store ─────────────────────────────────
  useEffect(() => {
    const { activeAccount } = useAuthStore.getState();
    if (activeAccount) {
      nasApiClient.setToken(activeAccount.token);
      nasApiClient.setServerUrl(activeAccount.serverUrl);
    }
  }, [user]);

  // ── Auth Guard ──────────────────────────────────────────────────────
  useEffect(() => {
    if (_hasHydrated && !user) {
      router.replace("/login");
    }
  }, [_hasHydrated, user, router]);

  // ── Health Monitor ──────────────────────────────────────────────────
  const checkHealth = useCallback(async () => {
    setIsCheckingHealth(true);
    try {
      await nasApiClient.healthCheck();
      setIsServerOnline(true);
    } catch {
      setIsServerOnline(false);
    } finally {
      setIsCheckingHealth(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  // ── Theme Hydration ─────────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem("nas-theme") || "dark";
    let resolved: "dark" | "light" = "dark";
    if (saved === "light") {
      resolved = "light";
    } else if (saved === "system") {
      resolved = window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark";
    }
    document.documentElement.setAttribute("data-theme", resolved);
  }, []);

  // ── Loading state ───────────────────────────────────────────────────
  if (!_hasHydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg-primary">
        <Loader2 className="h-8 w-8 animate-spin text-accent-blue" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-bg-primary">
      {/* Sidebar */}
      <NasSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapsed}
      />

      {/* Floating re-open tab — desktop only, visible when collapsed */}
      {sidebarCollapsed && (
        <button
          onClick={toggleSidebarCollapsed}
          title="Show sidebar"
          className="hidden lg:flex fixed left-0 top-1/2 -translate-y-1/2 z-30 flex-col items-center justify-center w-5 h-16 bg-bg-secondary border border-border-subtle border-l-0 rounded-r-xl text-text-tertiary hover:text-text-primary hover:bg-white/5 transition-all shadow-lg"
        >
          <PanelLeftClose size={13} className="rotate-180" />
        </button>
      )}

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Offline Ribbon */}
        {!isServerOnline && (
          <div className="flex items-center justify-center gap-2 bg-red-900/80 px-4 py-2 text-sm text-white backdrop-blur-sm">
            <WifiOff className="h-4 w-4" />
            <span>NAS server is offline</span>
            <button
              onClick={checkHealth}
              disabled={isCheckingHealth}
              className="ml-2 rounded-md bg-white/10 px-3 py-1 text-xs hover:bg-white/20 transition-colors"
            >
              {isCheckingHealth ? (
                <RefreshCw className="h-3 w-3 animate-spin" />
              ) : (
                "Retry"
              )}
            </button>
          </div>
        )}

        {/* Page Content */}
        <div className="flex items-center justify-between px-4 h-12 border-b border-border-subtle shrink-0">
          {/* Mobile menu toggle */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 -ml-2 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-white/5 transition-colors"
            aria-label="Open sidebar"
          >
            <Menu size={22} />
          </button>
          <div className="flex-1" />
          {/* Account avatar (top-right) */}
          <NasHeaderAccountMenu />
        </div>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}

export default function NasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-bg-primary">
          <Loader2 className="h-8 w-8 animate-spin text-accent-blue" />
        </div>
      }
    >
      <NasLayoutInner>{children}</NasLayoutInner>
    </Suspense>
  );
}

// ── NAS Header Account Menu (top-right avatar → dropdown) ────────────────
function NasHeaderAccountMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { user, activeAccount, logout } = useAuthStore();

  const initial = (user?.username || "U")[0].toUpperCase();
  const serverUrl = activeAccount?.serverUrl || "";
  const displayServer = serverUrl.replace(/^https?:\/\//, "");

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  const handleSignOut = async () => {
    setIsOpen(false);
    await logout();
    router.replace("/login");
  };

  return (
    <div className="relative" ref={menuRef}>
      {/* Avatar Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-8 h-8 rounded-full bg-gradient-to-br from-[#00BCD4] to-[#7C4DFF] flex items-center justify-center hover:ring-2 hover:ring-[#7C4DFF]/40 transition-all cursor-pointer"
        aria-label="Account menu"
      >
        <span className="text-white text-xs font-semibold">{initial}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl bg-bg-elevated border border-border-default shadow-2xl overflow-hidden z-50">
          {/* User Info */}
          <div className="px-4 py-4 border-b border-border-subtle">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00BCD4] to-[#7C4DFF] flex items-center justify-center shrink-0">
                <span className="text-white font-bold text-sm">{initial}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-text-primary text-sm font-semibold truncate">
                  {user?.username || "User"}
                </p>
                {user?.email && (
                  <p className="text-text-tertiary text-[11px] truncate">{user.email}</p>
                )}
              </div>
            </div>
            {displayServer && (
              <div className="mt-2.5 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/60" />
                <span className="text-text-tertiary text-[10px] truncate font-mono">
                  {displayServer}
                </span>
              </div>
            )}
          </div>

          {/* Menu Items */}
          <div className="py-1">
            <Link
              href="/nas/settings"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-text-secondary hover:bg-white/[0.04] transition-colors text-sm"
            >
              <Settings size={15} />
              NAS Settings
              <ChevronRight size={13} className="ml-auto text-text-tertiary" />
            </Link>
          </div>

          {/* Sign Out */}
          <div className="border-t border-border-subtle py-1">
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-red-400/70 hover:bg-red-500/5 transition-colors text-sm"
            >
              <LogOut size={15} />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

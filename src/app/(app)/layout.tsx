"use client";

// ============================================================================
// App Layout — Shared sidebar + content layout for all (app) routes
// The sidebar persists across chat, calendar, reminders, settings navigation
// Includes server connectivity monitor (offline ribbon like the Flutter app)
// ============================================================================

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { apiClient } from "@/lib/api-client";
import { AppSidebar } from "@/components/app-sidebar";
import { Loader2, WifiOff, RefreshCw, PanelLeftClose } from "lucide-react";

function AppLayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, _hasHydrated } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile drawer
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    // Persist collapse state across refreshes
    if (typeof window !== "undefined") {
      return localStorage.getItem("ai-sidebar-collapsed") === "true";
    }
    return false;
  });
  const [isServerOnline, setIsServerOnline] = useState(true);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);

  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarCollapsed((v) => {
      const next = !v;
      localStorage.setItem("ai-sidebar-collapsed", String(next));
      return next;
    });
  }, []);

  // ── Gateway Auth Handoff (OAuth redirect pattern) ────────────────────
  useEffect(() => {
    const token = searchParams.get("token");
    const server = searchParams.get("server");
    const username = searchParams.get("username");

    if (token && server && username) {
      const email = searchParams.get("email") || "";
      const uid = searchParams.get("uid") || "";
      const normalizedServer = server.replace(/\/+$/, "");

      apiClient.setToken(token);
      apiClient.setServerUrl(normalizedServer);
      try { localStorage.setItem("spherex_server", normalizedServer); } catch { /* ok */ }

      const account = {
        id: `${username}@${normalizedServer}`,
        username,
        email,
        serverUrl: normalizedServer,
        token,
      };
      useAuthStore.setState({
        user: { id: uid || "gateway", username, email },
        activeAccount: account,
        accounts: [account],
        _hasHydrated: true,
      });

      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [searchParams]);

  // Hydration safety net
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!useAuthStore.getState()._hasHydrated) {
        useAuthStore.setState({ _hasHydrated: true });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Listen for sidebar toggle events from child pages
  useEffect(() => {
    const handler = () => setSidebarOpen((v) => !v);
    window.addEventListener("toggle-sidebar", handler);
    return () => window.removeEventListener("toggle-sidebar", handler);
  }, []);

  // ── Server Connectivity Monitor (Google Drive / Slack pattern) ───────
  // Background health check every 15s. Shows persistent ribbon when offline.
  // Dispatches event for sidebar status indicator.
  const checkHealth = useCallback(async () => {
    try {
      const online = await apiClient.healthCheck();
      setIsServerOnline(online);
      // Notify sidebar status indicator
      window.dispatchEvent(new CustomEvent("server-health-update", { detail: { online } }));
    } catch {
      setIsServerOnline(false);
      window.dispatchEvent(new CustomEvent("server-health-update", { detail: { online: false } }));
    }
  }, []);

  useEffect(() => {
    // Wait for auth hydration before running health checks to prevent false offline flash
    if (!_hasHydrated || !user) return;

    // Initial check after 500ms (give time for API client to be configured)
    const initialTimer = setTimeout(checkHealth, 500);
    // Periodic check every 15 seconds
    const interval = setInterval(checkHealth, 15000);
    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [checkHealth, _hasHydrated, user]);

  const handleRetry = async () => {
    setIsCheckingHealth(true);
    await checkHealth();
    setIsCheckingHealth(false);
  };

  // Redirect to login if not authenticated
  useEffect(() => {
    if (_hasHydrated && !user) {
      router.push("/login");
    }
  }, [_hasHydrated, user, router]);

  // Show loading during hydration
  if (!_hasHydrated || !user) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
        <Loader2 className="animate-spin text-white/20" size={28} />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[var(--color-bg-primary)] overflow-hidden">
      {/* Offline Ribbon — Persistent server connectivity banner */}
      {!isServerOnline && (
        <div className="flex items-center justify-center gap-3 px-4 py-2 bg-red-500/10 border-b border-red-500/20 shrink-0 animate-in">
          <WifiOff size={14} className="text-red-400" />
          <span className="text-red-400 text-sm font-medium">
            Server is offline
          </span>
          <span className="text-red-400/50 text-xs hidden sm:inline">
            — Check your SphereX device connection
          </span>
          <button
            onClick={handleRetry}
            disabled={isCheckingHealth}
            className="ml-2 flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors disabled:opacity-40"
          >
            <RefreshCw size={12} className={isCheckingHealth ? "animate-spin" : ""} />
            Retry
          </button>
        </div>
      )}

      {/* Main layout */}
      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        <AppSidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebarCollapsed}
        />

        {/* Floating re-open tab — only visible on desktop when collapsed */}
        {sidebarCollapsed && (
          <button
            onClick={toggleSidebarCollapsed}
            title="Show sidebar"
            className="hidden lg:flex fixed left-0 top-1/2 -translate-y-1/2 z-30 flex-col items-center justify-center w-5 h-16 bg-[var(--color-bg-secondary)] border border-white/[0.08] border-l-0 rounded-r-xl text-white/25 hover:text-white/60 hover:bg-white/[0.08] transition-all shadow-lg"
          >
            <PanelLeftClose size={13} className="rotate-180" />
          </button>
        )}

        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div className="h-screen w-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
        <Loader2 className="animate-spin text-white/20" size={28} />
      </div>
    }>
      <AppLayoutInner>{children}</AppLayoutInner>
    </Suspense>
  );
}

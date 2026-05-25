"use client";

// ============================================================================
// NAS App Layout — Google Drive-style layout with sidebar + content area
// Shares auth with AI app via the same auth-store
// ============================================================================

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { nasApiClient } from "@/lib/nas-api-client";
import { NasSidebar } from "@/components/nas/nas-sidebar";
import { Loader2, WifiOff, RefreshCw, PanelLeftClose } from "lucide-react";

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

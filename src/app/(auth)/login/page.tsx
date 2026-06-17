"use client";

// ============================================================================
// Login Page — Port of login_screen.dart
// Premium dark glass card design with gradient accent button
//
// Supports two entry points:
//   1. Via Gateway — serverUrl already in localStorage, skip server input
//   2. Direct visit — user enters server URL here (like the mobile app)
// ============================================================================

import { useState, useEffect, Suspense, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, User, Lock, AlertCircle, Loader2, Globe } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { apiClient } from "@/lib/api-client";
import { DSLogo } from "@/components/ui/ds-logo";

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isLoading, error, setError, user, _hasHydrated } = useAuthStore();

  // Determine post-auth redirect based on ?service= param from gateway
  const service = searchParams.get("service");
  const redirectPath = service === "nas" ? "/nas" : "/chat";

  const [serverUrl, setServerUrlInput] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [serverConnected, setServerConnected] = useState(false);
  const [checkingServer, setCheckingServer] = useState(false);

  // On mount, check if a server URL is already configured (e.g. via gateway)
  useEffect(() => {
    const stored = apiClient.getServerUrl();
    if (stored) {
      setServerUrlInput(stored.replace(/^https?:\/\//, ""));
      setServerConnected(true);
    }
  }, []);

  // If user is already authenticated (e.g. via gateway), redirect to chat
  useEffect(() => {
    if (_hasHydrated && user) {
      router.push(redirectPath);
    }
  }, [_hasHydrated, user, router]);

  const handleServerConnect = async () => {
    const raw = serverUrl.trim();
    if (!raw) {
      setError("Please enter your SphereX server address");
      return;
    }

    // Normalize URL
    let normalized = raw;
    if (!raw.startsWith("http://") && !raw.startsWith("https://")) {
      normalized = `https://${raw}`;
    }
    normalized = normalized.replace(/\/+$/, "");

    setCheckingServer(true);
    setError(null);

    try {
      // Health check through Nginx: GET /api/ai/health
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(`${normalized}/api/ai/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error("Server returned an error");

      // Store and configure
      apiClient.setServerUrl(normalized);
      try {
        localStorage.setItem("spherex_server", normalized);
      } catch { /* ok */ }

      setServerConnected(true);
      setCheckingServer(false);
    } catch (err) {
      setCheckingServer(false);
      if ((err as Error).name === "AbortError") {
        setError("Server did not respond — check the address and try again.");
      } else {
        setError(
          "Cannot connect. If using HTTPS with a self-signed certificate, " +
          "visit your server URL directly first to accept the certificate."
        );
      }
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!username.trim() || !password.trim()) {
      setError("Please fill in all fields");
      return;
    }

    try {
      await login(username.trim(), password.trim());
      router.push(redirectPath);
    } catch {
      // Error already set by store
    }
  };

  const inputClass =
    "w-full pl-12 pr-4 py-4 bg-white/5 border border-transparent rounded-[14px] text-white text-[15px] placeholder:text-white/15 focus:border-[var(--color-accent-cyan)] focus:outline-none transition-colors disabled:opacity-50";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--color-bg-primary)] px-6">
      {/* Logo + Brand */}
      <div className="flex items-center gap-3 mb-8">
        <DSLogo size={30} className="text-[var(--color-accent-blue)]" />
        <div>
          <h1 className="text-white text-xl font-bold tracking-tight leading-tight">
            Sphere AI
          </h1>
        </div>
      </div>

      {/* Glass Card */}
      <div className="w-full max-w-md glass-card p-8">
        {!serverConnected ? (
          /* ── Step 1: Server Connection ────────────────────────────── */
          <div className="space-y-4">
            <div className="text-center mb-2">
              <p className="text-white/40 text-sm">
                Connect to your SphereX server
              </p>
            </div>

            {/* Server URL */}
            <div className="relative">
              <Globe
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30"
                size={18}
              />
              <input
                id="login-server-url"
                type="text"
                placeholder="e.g. 192.168.1.100 or spherex.company.com"
                value={serverUrl}
                onChange={(e) => setServerUrlInput(e.target.value)}
                disabled={checkingServer}
                autoComplete="url"
                spellCheck={false}
                onKeyDown={(e) => e.key === "Enter" && handleServerConnect()}
                className={inputClass}
              />
            </div>

            <p className="text-white/15 text-xs px-1">
              Your SphereX appliance IP or domain address
            </p>

            {/* Error Message */}
            {error && (
              <div className="flex items-start gap-3 p-3 rounded-[10px] bg-red-500/10 border border-red-500/20">
                <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={16} />
                <p className="text-red-400 text-[13px] leading-relaxed">
                  {error}
                </p>
              </div>
            )}

            {/* Connect Button */}
            <button
              id="login-connect"
              onClick={handleServerConnect}
              disabled={checkingServer}
              className="w-full h-[52px] rounded-[14px] gradient-bg text-white font-semibold text-base tracking-wide hover:brightness-110 active:brightness-95 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {checkingServer ? (
                <Loader2 className="animate-spin" size={22} />
              ) : (
                "Connect"
              )}
            </button>
          </div>
        ) : (
          /* ── Step 2: Credentials ──────────────────────────────────── */
          <div>
            {/* Connected server indicator */}
            <div className="flex items-center gap-2 mb-5 px-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-white/30 text-xs">
                Connected to{" "}
                <span className="text-white/50 font-medium">
                  {serverUrl.replace(/^https?:\/\//, "")}
                </span>
              </span>
              <button
                onClick={() => {
                  setServerConnected(false);
                  setError(null);
                }}
                className="ml-auto text-white/20 text-xs hover:text-white/40 transition-colors"
              >
                Change
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Username */}
              <div className="relative">
                <User
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30"
                  size={18}
                />
                <input
                  id="login-username"
                  type="text"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isLoading}
                  autoComplete="username"
                  className={inputClass}
                />
              </div>

              {/* Password */}
              <div className="relative">
                <Lock
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30"
                  size={18}
                />
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  autoComplete="current-password"
                  onKeyDown={(e) => e.key === "Enter" && handleSubmit(e)}
                  className="w-full pl-12 pr-12 py-4 bg-white/5 border border-transparent rounded-[14px] text-white text-[15px] placeholder:text-white/15 focus:border-[var(--color-accent-cyan)] focus:outline-none transition-colors disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                </button>
              </div>

              {/* Error Message */}
              {error && (
                <div className="flex items-start gap-3 p-3 rounded-[10px] bg-red-500/10 border border-red-500/20">
                  <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={16} />
                  <p className="text-red-400 text-[13px] leading-relaxed">
                    {error}
                  </p>
                </div>
              )}

              {/* Submit Button */}
              <button
                id="login-submit"
                type="submit"
                disabled={isLoading}
                className="w-full h-[52px] rounded-[14px] gradient-bg text-white font-semibold text-base tracking-wide hover:brightness-110 active:brightness-95 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isLoading ? (
                  <Loader2 className="animate-spin" size={22} />
                ) : (
                  "Sign in"
                )}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Sign Up Link */}
      <p className="mt-7 text-white/30 text-[13px]">
        Don&apos;t have an account?{" "}
        <Link
          href={service ? `/register?service=${service}` : "/register"}
          className="text-[var(--color-accent-teal)] font-semibold hover:underline"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  );
}

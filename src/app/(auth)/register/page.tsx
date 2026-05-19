"use client";

// ============================================================================
// Register Page — Port of register_screen.dart
// ============================================================================

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { User, Mail, Lock, AlertCircle, Loader2 } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { DSLogo } from "@/components/ui/ds-logo";

export default function RegisterPage() {
  const router = useRouter();
  const { register, isLoading, error, setError, user, _hasHydrated } = useAuthStore();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // If user is already authenticated, redirect to chat
  useEffect(() => {
    if (_hasHydrated && user) {
      router.push("/chat");
    }
  }, [_hasHydrated, user, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!username.trim() || !email.trim() || !password.trim()) {
      setError("Please fill in all fields");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    try {
      await register(username.trim(), email.trim(), password.trim());
      router.push("/chat");
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
          <p className="text-white/30 text-xs">Create your account</p>
        </div>
      </div>

      {/* Glass Card */}
      <div className="w-full max-w-md glass-card p-8">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username */}
          <div className="relative">
            <User
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30"
              size={18}
            />
            <input
              id="register-username"
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoading}
              autoComplete="username"
              className={inputClass}
            />
          </div>

          {/* Email */}
          <div className="relative">
            <Mail
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30"
              size={18}
            />
            <input
              id="register-email"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              autoComplete="email"
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
              id="register-password"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              autoComplete="new-password"
              className={inputClass}
            />
          </div>

          {/* Confirm Password */}
          <div className="relative">
            <Lock
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30"
              size={18}
            />
            <input
              id="register-confirm-password"
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isLoading}
              autoComplete="new-password"
              className={inputClass}
            />
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
            id="register-submit"
            type="submit"
            disabled={isLoading}
            className="w-full h-[52px] rounded-[14px] gradient-bg text-white font-semibold text-base tracking-wide hover:brightness-110 active:brightness-95 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isLoading ? (
              <Loader2 className="animate-spin" size={22} />
            ) : (
              "Create account"
            )}
          </button>
        </form>
      </div>

      {/* Sign In Link */}
      <p className="mt-7 text-white/30 text-[13px]">
        Already have an account?{" "}
        <Link
          href="/login"
          className="text-[var(--color-accent-teal)] font-semibold hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}

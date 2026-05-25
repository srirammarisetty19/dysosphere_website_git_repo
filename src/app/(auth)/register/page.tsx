"use client";

// ============================================================================
// Register Page — Port of register_screen.dart
// Password rules: min 8 chars + letter + number + special character
// ============================================================================

import { useState, useEffect, useCallback, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { User, Mail, Lock, Eye, EyeOff, AlertCircle, Loader2, CheckCircle2, Circle } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { DSLogo } from "@/components/ui/ds-logo";

// ── Password validation helpers ──────────────────────────────────────────────
const SPECIAL_CHAR_RE = /[!@#$%^&*()\-_=+[\]{};:'",.<>/?`~\\|]/;

function validatePassword(password: string): string | null {
  if (!password) return "Password is required";
  if (password.length < 8) return "Password must be at least 8 characters";
  if (!/[A-Za-z]/.test(password)) return "Password must contain at least one letter";
  if (!/[0-9]/.test(password)) return "Password must contain at least one number";
  if (!SPECIAL_CHAR_RE.test(password))
    return "Password must contain at least one special character (e.g. @, #, $, !)";
  return null;
}

function validateUsername(username: string): string | null {
  if (!username.trim()) return "Username is required";
  if (username.trim().length < 3) return "Username must be at least 3 characters";
  if (!/^[a-zA-Z0-9_]+$/.test(username.trim()))
    return "Username can only contain letters, numbers, and underscores";
  return null;
}

function validateEmail(email: string): string | null {
  if (!email.trim()) return "Email is required";
  if (!/^[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}$/.test(email.trim()))
    return "Enter a valid email address";
  return null;
}

// ── Password strength requirement row ────────────────────────────────────────
function PasswordRequirement({ label, met }: { label: string; met: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {met ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-[var(--color-accent-cyan)] shrink-0" />
      ) : (
        <Circle className="h-3.5 w-3.5 text-white/25 shrink-0" />
      )}
      <span className={`text-[12px] transition-colors ${met ? "text-white/70" : "text-white/30"}`}>
        {label}
      </span>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function RegisterPage() {
  const router = useRouter();
  const { register, isLoading, error, setError, user, _hasHydrated } = useAuthStore();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Per-field validation errors (shown after first submit attempt)
  const [fieldErrors, setFieldErrors] = useState<{
    username?: string;
    email?: string;
    password?: string;
    confirm?: string;
  }>({});
  const [submitted, setSubmitted] = useState(false);

  // Live password requirement flags
  const hasMinLength = password.length >= 8;
  const hasLetter = /[A-Za-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  const hasSpecial = SPECIAL_CHAR_RE.test(password);

  // If user is already authenticated, redirect to chat
  useEffect(() => {
    if (_hasHydrated && user) {
      router.push("/chat");
    }
  }, [_hasHydrated, user, router]);

  // Re-validate on every change once user has submitted once
  const revalidate = useCallback(() => {
    if (!submitted) return;
    setFieldErrors({
      username: validateUsername(username) ?? undefined,
      email: validateEmail(email) ?? undefined,
      password: validatePassword(password) ?? undefined,
      confirm: password !== confirmPassword ? "Passwords do not match" : undefined,
    });
  }, [submitted, username, email, password, confirmPassword]);

  useEffect(() => {
    revalidate();
    setError(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, email, password, confirmPassword]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);

    const errors = {
      username: validateUsername(username) ?? undefined,
      email: validateEmail(email) ?? undefined,
      password: validatePassword(password) ?? undefined,
      confirm: password !== confirmPassword ? "Passwords do not match" : undefined,
    };
    setFieldErrors(errors);

    // Abort if any field has an error
    if (Object.values(errors).some(Boolean)) return;

    try {
      await register(username.trim(), email.trim(), password);
      router.push("/chat");
    } catch {
      // Error already set by store
    }
  };

  const inputClass = (hasError: boolean) =>
    `w-full pl-12 pr-4 py-4 bg-white/5 border rounded-[14px] text-white text-[15px] placeholder:text-white/15 focus:outline-none transition-colors disabled:opacity-50 ${
      hasError
        ? "border-red-500/50 focus:border-red-500"
        : "border-transparent focus:border-[var(--color-accent-cyan)]"
    }`;

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
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>

          {/* Username */}
          <div>
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
                autoCorrect="off"
                autoCapitalize="none"
                className={inputClass(!!fieldErrors.username)}
              />
            </div>
            {fieldErrors.username && (
              <p className="mt-1.5 text-[12px] text-red-400 flex items-center gap-1.5">
                <AlertCircle size={11} />
                {fieldErrors.username}
              </p>
            )}
          </div>

          {/* Email */}
          <div>
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
                className={inputClass(!!fieldErrors.email)}
              />
            </div>
            {fieldErrors.email && (
              <p className="mt-1.5 text-[12px] text-red-400 flex items-center gap-1.5">
                <AlertCircle size={11} />
                {fieldErrors.email}
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <div className="relative">
              <Lock
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30"
                size={18}
              />
              <input
                id="register-password"
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                autoComplete="new-password"
                className={`${inputClass(!!fieldErrors.password)} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50 transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Live password strength indicator */}
            {password && (
              <div className="mt-2.5 p-3 rounded-[10px] bg-white/[0.03] space-y-1.5">
                <PasswordRequirement label="At least 8 characters" met={hasMinLength} />
                <PasswordRequirement label="At least one letter" met={hasLetter} />
                <PasswordRequirement label="At least one number" met={hasDigit} />
                <PasswordRequirement label="At least one special character (@, #, $…)" met={hasSpecial} />
              </div>
            )}

            {fieldErrors.password && (
              <p className="mt-1.5 text-[12px] text-red-400 flex items-center gap-1.5">
                <AlertCircle size={11} />
                {fieldErrors.password}
              </p>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <div className="relative">
              <Lock
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30"
                size={18}
              />
              <input
                id="register-confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
                autoComplete="new-password"
                className={`${inputClass(!!fieldErrors.confirm)} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/25 hover:text-white/50 transition-colors"
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {fieldErrors.confirm && (
              <p className="mt-1.5 text-[12px] text-red-400 flex items-center gap-1.5">
                <AlertCircle size={11} />
                {fieldErrors.confirm}
              </p>
            )}
          </div>

          {/* Server Error Message */}
          {error && (
            <div className="flex items-start gap-3 p-3 rounded-[10px] bg-red-500/10 border border-red-500/20">
              <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={16} />
              <p className="text-red-400 text-[13px] leading-relaxed">{error}</p>
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

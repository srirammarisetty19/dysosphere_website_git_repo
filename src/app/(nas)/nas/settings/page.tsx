"use client";

// ============================================================================
// NAS Settings Page
// ============================================================================

import { useState, useEffect } from "react";
import { nasApiClient } from "@/lib/nas-api-client";
import { ArrowLeft, Palette, Bell, Moon, Sun, Monitor } from "lucide-react";
import Link from "next/link";

type ThemeMode = "light" | "dark" | "system";

export default function NasSettingsPage() {
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [notifyShare, setNotifyShare] = useState(true);
  const [notifyStorage, setNotifyStorage] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const profile = await nasApiClient.getProfile();
      if (profile.theme) setTheme(profile.theme as ThemeMode);
      if (profile.notify_on_share !== undefined)
        setNotifyShare(!!profile.notify_on_share);
      if (profile.notify_on_storage !== undefined)
        setNotifyStorage(!!profile.notify_on_storage);
    } catch {
      // Use defaults
    }
  }

  async function handleThemeChange(newTheme: ThemeMode) {
    setTheme(newTheme);
    try {
      await nasApiClient.updateProfile({ theme: newTheme });
    } catch {
      // ignore
    }
  }

  async function handleNotifyShareChange(val: boolean) {
    setNotifyShare(val);
    try {
      await nasApiClient.updateProfile({ notify_on_share: val });
    } catch {
      // ignore
    }
  }

  async function handleNotifyStorageChange(val: boolean) {
    setNotifyStorage(val);
    try {
      await nasApiClient.updateProfile({ notify_on_storage: val });
    } catch {
      // ignore
    }
  }

  const themeOptions = [
    { value: "system" as const, icon: Monitor, label: "System default" },
    { value: "dark" as const, icon: Moon, label: "Dark" },
    { value: "light" as const, icon: Sun, label: "Light" },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border-subtle">
        <Link href="/nas" className="p-2 rounded-lg hover:bg-white/5 lg:hidden">
          <ArrowLeft className="h-5 w-5 text-text-secondary" />
        </Link>
        <h1 className="text-lg font-semibold text-text-primary">Settings</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 max-w-2xl">
        {/* Appearance */}
        <section className="mb-8">
          <h2 className="flex items-center gap-2 text-xs font-semibold text-accent-blue uppercase tracking-wider mb-4">
            <Palette className="h-4 w-4" />
            Appearance
          </h2>
          <div className="rounded-2xl border border-border-subtle bg-bg-tertiary overflow-hidden">
            {themeOptions.map(({ value, icon: Icon, label }, index) => (
              <button
                key={value}
                onClick={() => handleThemeChange(value)}
                className={`
                  flex items-center gap-4 w-full px-5 py-4 text-left transition-colors
                  ${index > 0 ? "border-t border-border-subtle" : ""}
                  hover:bg-white/[0.03]
                `}
              >
                <div
                  className={`h-9 w-9 rounded-xl flex items-center justify-center ${
                    theme === value
                      ? "bg-accent-blue/15"
                      : "bg-white/5"
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 ${
                      theme === value
                        ? "text-accent-blue"
                        : "text-text-tertiary"
                    }`}
                  />
                </div>
                <span
                  className={`text-sm flex-1 ${
                    theme === value
                      ? "text-text-primary font-medium"
                      : "text-text-secondary"
                  }`}
                >
                  {label}
                </span>
                <div
                  className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                    theme === value
                      ? "border-accent-blue"
                      : "border-white/20"
                  }`}
                >
                  {theme === value && (
                    <div className="h-2.5 w-2.5 rounded-full bg-accent-blue" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Notifications */}
        <section>
          <h2 className="flex items-center gap-2 text-xs font-semibold text-accent-blue uppercase tracking-wider mb-4">
            <Bell className="h-4 w-4" />
            Notifications
          </h2>
          <div className="rounded-2xl border border-border-subtle bg-bg-tertiary overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="text-sm text-text-primary">Shared with me</p>
                <p className="text-xs text-text-tertiary mt-0.5">
                  Get notified when someone shares a file with you
                </p>
              </div>
              <button
                onClick={() => handleNotifyShareChange(!notifyShare)}
                className={`
                  relative h-6 w-11 rounded-full transition-colors
                  ${notifyShare ? "bg-accent-blue" : "bg-white/10"}
                `}
              >
                <div
                  className={`
                    absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform
                    ${notifyShare ? "translate-x-5.5 left-0.5" : "left-0.5"}
                  `}
                  style={{
                    transform: notifyShare
                      ? "translateX(20px)"
                      : "translateX(0)",
                  }}
                />
              </button>
            </div>
            <div className="border-t border-border-subtle" />
            <div className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="text-sm text-text-primary">Storage alerts</p>
                <p className="text-xs text-text-tertiary mt-0.5">
                  Get notified when storage space is low
                </p>
              </div>
              <button
                onClick={() => handleNotifyStorageChange(!notifyStorage)}
                className={`
                  relative h-6 w-11 rounded-full transition-colors
                  ${notifyStorage ? "bg-accent-blue" : "bg-white/10"}
                `}
              >
                <div
                  className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
                  style={{
                    transform: notifyStorage
                      ? "translateX(20px)"
                      : "translateX(0)",
                    left: "2px",
                  }}
                />
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

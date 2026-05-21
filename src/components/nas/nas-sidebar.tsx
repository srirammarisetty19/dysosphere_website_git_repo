"use client";

// ============================================================================
// NAS Sidebar — Google Drive-style navigation drawer
// Persistent on desktop, slide-over on mobile
// ============================================================================

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { nasApiClient } from "@/lib/nas-api-client";
import { formatBytes } from "@/lib/nas-types";
import {
  Home,
  Star,
  Users,
  Share2,
  Clock,
  Upload,
  Trash2,
  Bell,
  Settings,
  HardDrive,
  Search,
  X,
  ChevronRight,
} from "lucide-react";
import Image from "next/image";

interface NasSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NasSidebar({ isOpen, onClose }: NasSidebarProps) {
  const pathname = usePathname();
  const [storageUsed, setStorageUsed] = useState(0);
  const [storageLimit, setStorageLimit] = useState(1);
  const [storageBreakdown, setStorageBreakdown] = useState<
    Array<{ username: string; bytes: number }>
  >([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showBreakdown, setShowBreakdown] = useState(false);

  // ── Load storage stats ──────────────────────────────────────────────
  const loadStats = useCallback(async () => {
    try {
      const stats = await nasApiClient.getStorageStats();
      console.log('[NAS Sidebar] Storage stats:', stats);
      setStorageUsed(stats.used || 0);
      setStorageLimit(stats.limit || 1);
      setStorageBreakdown(stats.breakdown || []);
    } catch (err) {
      console.warn('[NAS Sidebar] Failed to load storage stats:', err);
    }
  }, []);

  const loadUnreadCount = useCallback(async () => {
    try {
      const count = await nasApiClient.getUnreadCount();
      setUnreadCount(count);
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => {
    loadStats();
    loadUnreadCount();
    const interval = setInterval(loadUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [loadStats, loadUnreadCount]);

  const progress = Math.min(storageUsed / storageLimit, 1);

  const mainNav = [
    { href: "/nas", icon: Home, label: "Home", exact: true },
    { href: "/nas/starred", icon: Star, label: "Starred" },
    { href: "/nas/people", icon: Users, label: "People" },
    { href: "/nas/shared", icon: Share2, label: "Shared" },
  ];

  const drawerNav = [
    { href: "/nas/search", icon: Search, label: "Search" },
    { href: "/nas/trash", icon: Trash2, label: "Trash" },
    {
      href: "/nas/notifications",
      icon: Bell,
      label: "Notifications",
      badge: unreadCount,
    },
  ];

  const bottomNav = [
    { href: "/nas/settings", icon: Settings, label: "Settings" },
  ];

  const isActive = (href: string, exact = false) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-[280px] flex flex-col
          bg-bg-secondary border-r border-border-subtle
          transition-transform duration-200 ease-in-out
          lg:relative lg:translate-x-0
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-border-subtle">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/DS.svg" alt="DS" className="h-7 w-auto" />
          <span className="text-lg font-semibold tracking-tight text-text-primary">
            SphereX NAS
          </span>
          <button
            onClick={onClose}
            className="ml-auto p-1 rounded-md hover:bg-white/5 lg:hidden"
          >
            <X className="h-5 w-5 text-text-tertiary" />
          </button>
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {mainNav.map(({ href, icon: Icon, label, exact }) => (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={`
                flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium
                transition-all duration-150
                ${
                  isActive(href, exact)
                    ? "bg-accent-blue/12 text-accent-blue"
                    : "text-text-secondary hover:bg-white/5 hover:text-text-primary"
                }
              `}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span>{label}</span>
            </Link>
          ))}

          {/* Divider */}
          <div className="!my-4 mx-4 border-t border-border-subtle" />

          {/* Drawer Items */}
          {drawerNav.map(({ href, icon: Icon, label, badge }) => (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={`
                flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium
                transition-all duration-150
                ${
                  isActive(href)
                    ? "bg-accent-blue/12 text-accent-blue"
                    : "text-text-secondary hover:bg-white/5 hover:text-text-primary"
                }
              `}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span>{label}</span>
              {badge && badge > 0 ? (
                <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
                  {badge > 99 ? "99+" : badge}
                </span>
              ) : null}
            </Link>
          ))}

          <div className="!my-4 mx-4 border-t border-border-subtle" />

          {bottomNav.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              onClick={onClose}
              className={`
                flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium
                transition-all duration-150
                ${
                  isActive(href)
                    ? "bg-accent-blue/12 text-accent-blue"
                    : "text-text-secondary hover:bg-white/5 hover:text-text-primary"
                }
              `}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span>{label}</span>
            </Link>
          ))}
        </nav>

        {/* Storage Footer — Google Drive style */}
        <div className="border-t border-border-subtle p-4">
          <button
            onClick={() => setShowBreakdown(!showBreakdown)}
            className="w-full text-left group"
          >
            <div className="flex items-center gap-2 mb-2">
              <HardDrive className="h-4 w-4 text-text-tertiary" />
              <span className="text-sm text-text-secondary">Storage</span>
              <ChevronRight
                className={`ml-auto h-4 w-4 text-text-tertiary transition-transform duration-200 ${
                  showBreakdown ? "rotate-90" : ""
                }`}
              />
            </div>

            {/* Progress bar */}
            <div className="h-1 rounded-full bg-white/10 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  progress > 0.9
                    ? "bg-red-500"
                    : progress > 0.7
                      ? "bg-amber-500"
                      : "bg-accent-blue"
                }`}
                style={{ width: `${progress * 100}%` }}
              />
            </div>

            <p className="mt-1.5 text-xs text-text-tertiary">
              {formatBytes(storageUsed)} of {formatBytes(storageLimit)} used
            </p>
          </button>

          {/* Breakdown popover */}
          {showBreakdown && storageBreakdown.length > 0 && (
            <div className="mt-3 rounded-lg bg-bg-tertiary border border-border-subtle p-3 space-y-2">
              <p className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">
                Breakdown
              </p>
              {storageBreakdown.map((user) => (
                <div
                  key={user.username}
                  className="flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-accent-blue/20 flex items-center justify-center text-[10px] font-bold text-accent-blue">
                      {user.username[0].toUpperCase()}
                    </div>
                    <span className="text-text-secondary">
                      {user.username}
                    </span>
                  </div>
                  <span className="text-text-tertiary font-mono">
                    {formatBytes(user.bytes)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

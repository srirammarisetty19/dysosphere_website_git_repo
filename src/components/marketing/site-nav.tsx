"use client";

// ============================================================================
// Marketing navigation — sticky, blurs on scroll, mobile drawer, sign-in menu
// ============================================================================

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, ChevronDown, HardDrive, Menu, MessageSquare, X } from "lucide-react";
import { DSLogo } from "@/components/ui/ds-logo";
import { NAV_LINKS, QUOTE_HREF } from "./site";

const SIGN_IN_OPTIONS = [
  {
    service: "ai",
    title: "Sphere AI",
    desc: "Chat, agents and automations",
    Icon: MessageSquare,
  },
  {
    service: "nas",
    title: "SphereX Storage",
    desc: "Files, photos, sharing and sync",
    Icon: HardDrive,
  },
] as const;

function rememberService(service: string) {
  try {
    localStorage.setItem("spherex_service", service);
  } catch {
    /* storage unavailable — non-critical */
  }
}

export function SiteNav() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const signInRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close menus on route change (adjust state during render — no effect needed)
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
    setSignInOpen(false);
  }

  // Close sign-in dropdown on outside click / Escape
  useEffect(() => {
    if (!signInOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!signInRef.current?.contains(e.target as Node)) setSignInOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSignInOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [signInOpen]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="mk-nav" data-scrolled={scrolled} data-open={open}>
      <div className="mk-container mk-nav-inner">
        <Link href="/" className="mk-logo" aria-label="DysoSphere SphereX — home" id="nav-logo">
          <DSLogo size={20} className="mk-logo-mark" />
          <span className="mk-logo-sep" aria-hidden="true" />
          <span>SphereX</span>
        </Link>

        <nav aria-label="Main" className="mk-nav-links">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              id={`nav-${l.label.toLowerCase()}`}
              aria-current={isActive(l.href) ? "page" : undefined}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="mk-nav-actions">
          <div className="mk-signin" ref={signInRef}>
            <button
              type="button"
              className="mk-btn mk-btn-ghost mk-btn-sm"
              aria-haspopup="menu"
              aria-expanded={signInOpen}
              onClick={() => setSignInOpen((v) => !v)}
              id="nav-signin"
            >
              Login <ChevronDown size={14} />
            </button>
            {signInOpen && (
              <div className="mk-signin-menu" role="menu">
                {SIGN_IN_OPTIONS.map(({ service, title, desc, Icon }) => (
                  <a
                    key={service}
                    role="menuitem"
                    href={`/login?service=${service}`}
                    onClick={() => rememberService(service)}
                    id={`nav-signin-${service}`}
                  >
                    <Icon size={18} />
                    <div>
                      <strong>{title}</strong>
                      <span>{desc}</span>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
          <Link href={QUOTE_HREF} className="mk-btn mk-btn-primary mk-btn-sm" id="nav-quote">
            Request a quote
          </Link>
        </div>

        <button
          type="button"
          className="mk-nav-toggle"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          id="nav-toggle"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      <div className="mk-mobile-menu">
        <Link href="/" className="mk-mobile-link" aria-current={pathname === "/" ? "page" : undefined}>
          Home
        </Link>
        {NAV_LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="mk-mobile-link"
            aria-current={isActive(l.href) ? "page" : undefined}
          >
            {l.label}
          </Link>
        ))}
        <div className="mk-actions">
          <a href="/login?service=ai" className="mk-btn mk-btn-secondary" onClick={() => rememberService("ai")}>
            Login
          </a>
          <Link href={QUOTE_HREF} className="mk-btn mk-btn-primary">
            Request a quote <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </header>
  );
}

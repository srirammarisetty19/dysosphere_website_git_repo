// ============================================================================
// Marketing footer
// ============================================================================

import Link from "next/link";
import { Mail } from "lucide-react";
import { DSLogo } from "@/components/ui/ds-logo";
import { CONTACT_EMAIL, QUOTE_HREF } from "./site";

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/product", label: "SphereX" },
      { href: "/#how-it-works", label: "How it works" },
      { href: "/solutions", label: "Solutions" },
      { href: "/security", label: "Security" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About us" },
      { href: "/contact", label: "Contact" },
      { href: QUOTE_HREF, label: "Request a quote" },
      { href: "/login?service=ai", label: "Login" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy policy" },
      { href: "/terms", label: "Terms of use" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mk-footer">
      <div className="mk-container">
        <div className="mk-footer-grid">
          <div className="mk-footer-brand">
            <Link href="/" className="mk-logo" aria-label="DysoSphere home">
              <DSLogo size={20} className="mk-logo-mark" />
              <span>DysoSphere</span>
            </Link>
            <p>Private AI and secure storage in one device, for businesses that can&apos;t send their data to the cloud.</p>
            <a href={`mailto:${CONTACT_EMAIL}`} className="mk-team-email" id="footer-email">
              <Mail size={15} /> {CONTACT_EMAIL}
            </a>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4>{col.title}</h4>
              <ul>
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href}>{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mk-footer-bottom">
          <span>© {new Date().getFullYear()} DysoSphere. All rights reserved.</span>
          <span>SphereX — your AI, your data, your hardware.</span>
        </div>
      </div>
    </footer>
  );
}

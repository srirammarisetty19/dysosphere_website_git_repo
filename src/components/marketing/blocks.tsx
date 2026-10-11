// ============================================================================
// Reusable marketing building blocks (server components)
// ============================================================================

import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";
import { CONTACT_EMAIL, QUOTE_HREF } from "./site";

export function SectionHead({
  eyebrow,
  title,
  lead,
  center = false,
  as: Tag = "h2",
}: {
  eyebrow?: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  center?: boolean;
  as?: "h1" | "h2";
}) {
  return (
    <div className={`mk-section-head mk-reveal${center ? " mk-center" : ""}`}>
      {eyebrow && <p className="mk-eyebrow">{eyebrow}</p>}
      <Tag className={Tag === "h1" ? "mk-h1" : "mk-h2"}>{title}</Tag>
      {lead && <p className="mk-lead">{lead}</p>}
    </div>
  );
}

export function QuoteButton({
  label = "Request a quote",
  size = "lg",
  href = QUOTE_HREF,
  id,
}: {
  label?: string;
  size?: "lg" | "md";
  href?: string;
  id?: string;
}) {
  return (
    <Link href={href} className={`mk-btn mk-btn-primary${size === "lg" ? " mk-btn-lg" : ""}`} id={id}>
      {label} <ArrowRight size={18} className="mk-arrow" />
    </Link>
  );
}

export type FaqItem = { q: string; a: React.ReactNode };

/** Accessible FAQ using native <details> — works without JavaScript. */
export function Faq({
  items,
  title = "Questions, answered",
  lead,
}: {
  items: FaqItem[];
  title?: string;
  lead?: React.ReactNode;
}) {
  return (
    <div className="mk-faq">
      <div className="mk-reveal">
        <p className="mk-eyebrow">FAQ</p>
        <h2 className="mk-h2">{title}</h2>
        <p className="mk-lead">
          {lead ?? (
            <>
              Can&apos;t find your answer? Email{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="mk-link">
                {CONTACT_EMAIL}
              </a>
            </>
          )}
        </p>
      </div>
      <div className="mk-faq-list">
        {items.map((item) => (
          <details key={item.q} className="mk-faq-item">
            <summary>
              {item.q}
              <ChevronDown size={20} aria-hidden="true" />
            </summary>
            <div className="mk-faq-answer">{item.a}</div>
          </details>
        ))}
      </div>
    </div>
  );
}

export function CtaBand({
  title = "See what SphereX can do for your team",
  lead = "Tell us about your team and data. We'll recommend the right configuration and send you a quote — no commitment.",
  label = "Request a quote",
  href = QUOTE_HREF,
}: {
  title?: React.ReactNode;
  lead?: React.ReactNode;
  label?: string;
  href?: string;
}) {
  return (
    <section className="mk-section-tight" aria-labelledby="cta-title">
      <div className="mk-container">
        <div className="mk-cta mk-reveal">
          <h2 className="mk-h2" id="cta-title">
            {title}
          </h2>
          <p className="mk-lead">{lead}</p>
          <div className="mk-actions">
            <QuoteButton label={label} href={href} id="cta-quote" />
          </div>
          <p className="mk-cta-note">
            Prefer email? Write to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> — a founder will reply personally.
          </p>
        </div>
      </div>
    </section>
  );
}

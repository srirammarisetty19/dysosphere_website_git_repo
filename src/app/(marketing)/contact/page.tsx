// ============================================================================
// /contact — request a quote + direct founder contacts
// ============================================================================

import type { Metadata } from "next";
import { Suspense } from "react";
import { Mail } from "lucide-react";
import { QuoteForm } from "@/components/marketing/quote-form";
import { CONTACT_EMAIL, FOUNDERS } from "@/components/marketing/site";

export const metadata: Metadata = {
  title: "Request a quote — contact DysoSphere",
  description:
    "Tell us about your team and data and we'll recommend the right SphereX configuration and send you a quote. Or email the founders directly.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <>
      <section className="mk-page-hero" aria-labelledby="contact-title" style={{ paddingBottom: 40 }}>
        <div className="mk-container">
          <p className="mk-eyebrow">Request a quote</p>
          <h1 className="mk-h1" id="contact-title" style={{ maxWidth: 820 }}>
            Let&apos;s find the right SphereX for your team.
          </h1>
          <p className="mk-lead">
            Every business is different, so we tailor each SphereX to your team size, data and workflows. Share a few
            details and we&apos;ll send a recommendation and quote — no commitment.
          </p>
        </div>
      </section>

      <section className="mk-section" id="quote" style={{ paddingTop: 0, scrollMarginTop: 80 }} aria-label="Quote request form">
        <div className="mk-container mk-contact">
          <div className="mk-card" style={{ padding: "clamp(24px, 4vw, 40px)" }}>
            <Suspense
              fallback={
                <p className="mk-muted">
                  Loading the form… You can also email{" "}
                  <a href={`mailto:${CONTACT_EMAIL}`} className="mk-link">
                    {CONTACT_EMAIL}
                  </a>
                </p>
              }
            >
              <QuoteForm />
            </Suspense>
          </div>

          <aside style={{ display: "grid", gap: 20 }}>
            <div className="mk-card">
              <h2 className="mk-h3">What happens next</h2>
              <ol className="mk-next-steps">
                <li>
                  <span className="mk-step-num">1</span>
                  <div>
                    <strong>We review your needs</strong>
                    <span>A founder reads every request personally.</span>
                  </div>
                </li>
                <li>
                  <span className="mk-step-num">2</span>
                  <div>
                    <strong>A short call</strong>
                    <span>We learn about your workflows and show SphereX in action.</span>
                  </div>
                </li>
                <li>
                  <span className="mk-step-num">3</span>
                  <div>
                    <strong>Your tailored quote</strong>
                    <span>A recommended configuration with clear, one-time pricing.</span>
                  </div>
                </li>
              </ol>
            </div>

            <div className="mk-card">
              <h2 className="mk-h3">Prefer email?</h2>
              <div className="mk-contact-list">
                <a href={`mailto:${CONTACT_EMAIL}`} id="contact-general">
                  <span className="mk-icon">
                    <Mail size={16} />
                  </span>
                  <div>
                    <strong>General &amp; sales</strong>
                    <span>{CONTACT_EMAIL}</span>
                  </div>
                </a>
                {FOUNDERS.map((f) => (
                  <a key={f.email} href={`mailto:${f.email}`} aria-label={`Email ${f.name}`}>
                    <span className="mk-icon">
                      <Mail size={16} />
                    </span>
                    <div>
                      <strong>{f.name}</strong>
                      <span>{f.email}</span>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}

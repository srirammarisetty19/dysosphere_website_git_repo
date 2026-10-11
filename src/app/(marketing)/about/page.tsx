// ============================================================================
// /about — mission, why cloud AI is broken, values, founders (no photos)
// ============================================================================

import type { Metadata } from "next";
import { Ban, Boxes, EyeOff, Globe, HandCoins, Lock, Mail, ShieldCheck, Users } from "lucide-react";
import { CtaBand, SectionHead } from "@/components/marketing/blocks";
import { CONTACT_EMAIL, FOUNDERS } from "@/components/marketing/site";

export const metadata: Metadata = {
  title: "About us — the team behind SphereX",
  description:
    "DysoSphere builds SphereX so every business can use AI on its own hardware, with its data under its own control. Meet the founders.",
  alternates: { canonical: "/about" },
};

const PROBLEMS = [
  { Icon: EyeOff, title: "Privacy erosion", body: "Every cloud AI conversation can feed someone else's model. Your files and know-how become their product." },
  { Icon: HandCoins, title: "Subscription fatigue", body: "Per-seat AI, cloud storage, per-token APIs — the bills compound forever, and you never own anything." },
  { Icon: Lock, title: "Vendor lock-in", body: "Files on one platform, AI history on another. Switching is made painful on purpose." },
  { Icon: Globe, title: "Loss of sovereignty", body: "Your data sits in data centres you don't control, under jurisdictions and policies that can change." },
];

const VALUES = [
  { Icon: ShieldCheck, title: "Privacy first", body: "No telemetry, no analytics, no data collection. SphereX never phones home." },
  { Icon: Boxes, title: "Open architecture", body: "Open models and open standards. Your hardware, your choice." },
  { Icon: Ban, title: "No rent-seeking", body: "Buy once and own it. No per-token fees and no “free trial ended” messages." },
  { Icon: Users, title: "Built with customers", body: "We build alongside the businesses that use SphereX every day." },
];

export default function AboutPage() {
  return (
    <>
      <section className="mk-page-hero" aria-labelledby="about-title">
        <div className="mk-container" style={{ maxWidth: 960 }}>
          <p className="mk-eyebrow">About DysoSphere</p>
          <h1 className="mk-h1" id="about-title">
            We believe your intelligence should belong to you.
          </h1>
          <p className="mk-lead">
            The promise of AI was empowerment. Instead, it became a data-extraction engine: every file and every
            question feeds someone else&apos;s model, sold back to you as a subscription. DysoSphere was founded on a
            simple idea — your AI should run on your hardware, process your data locally, and answer only to you.
          </p>
          <p className="mk-lead">
            SphereX is the first product of that vision: a device that gives any business a private AI assistant, AI
            agents and secure storage — in one box, under its own control.
          </p>
        </div>
      </section>

      <section className="mk-section mk-section-alt" aria-labelledby="why-title">
        <div className="mk-container">
          <SectionHead eyebrow="Why we exist" title={<span id="why-title">Cloud AI is broken for most businesses</span>} />
          <div className="mk-grid-4">
            {PROBLEMS.map(({ Icon, title, body }) => (
              <article key={title} className="mk-card mk-reveal">
                <span className="mk-icon">
                  <Icon size={20} />
                </span>
                <h3 className="mk-h3">{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mk-section" aria-labelledby="values-title">
        <div className="mk-container">
          <SectionHead eyebrow="Our values" title={<span id="values-title">What we stand for</span>} />
          <div className="mk-grid-4">
            {VALUES.map(({ Icon, title, body }) => (
              <article key={title} className="mk-card mk-reveal">
                <span className="mk-icon">
                  <Icon size={20} />
                </span>
                <h3 className="mk-h3">{title}</h3>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mk-section mk-section-alt" aria-labelledby="team-title">
        <div className="mk-container">
          <SectionHead
            eyebrow="Founding team"
            title={<span id="team-title">The people behind DysoSphere</span>}
            lead="A small team on a big mission: bringing private AI to every business. Reach any of us directly."
          />
          <div className="mk-grid-3">
            {FOUNDERS.map((f) => (
              <article key={f.email} className="mk-card mk-team-card mk-reveal">
                <span className="mk-avatar" aria-hidden="true">
                  {f.initials}
                </span>
                <h3 className="mk-h3">{f.name}</h3>
                <p style={{ marginTop: 0 }}>{f.role}</p>
                <a href={`mailto:${f.email}`} className="mk-team-email" aria-label={`Email ${f.name}`}>
                  <Mail size={15} /> {f.email}
                </a>
              </article>
            ))}
          </div>
          <p className="mk-footnote" style={{ marginTop: 24 }}>
            General enquiries: <a href={`mailto:${CONTACT_EMAIL}`} className="mk-link">{CONTACT_EMAIL}</a>
          </p>
        </div>
      </section>

      <CtaBand
        title="Let's build your private AI"
        lead="Whether you want to deploy SphereX, partner with us or invest — we'd love to hear from you."
        label="Get in touch"
        href="/contact"
      />
    </>
  );
}

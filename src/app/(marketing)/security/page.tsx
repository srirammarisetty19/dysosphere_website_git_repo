// ============================================================================
// /security — trust page: where data lives, how it's protected, compliance
// ============================================================================

import type { Metadata } from "next";
import {
  Archive,
  BadgeCheck,
  Bot,
  CloudOff,
  EyeOff,
  HardDrive,
  KeyRound,
  Laptop,
  Lock,
  Smartphone,
  Users,
  WifiOff,
} from "lucide-react";
import { CtaBand, Faq, SectionHead, type FaqItem } from "@/components/marketing/blocks";

export const metadata: Metadata = {
  title: "Security & privacy — your data never leaves your building",
  description:
    "How SphereX protects your data: on-premise AI processing, AES-256 encryption, zero telemetry, per-user access control, immutable snapshots, air-gap support and HIPAA-ready design.",
  alternates: { canonical: "/security" },
};

const PILLARS = [
  { Icon: CloudOff, title: "On-premise by design", body: "Your files, AI models and AI processing all live on the SphereX in your office. No cloud AI provider ever sees your data." },
  { Icon: Lock, title: "AES-256 encryption", body: "Hardware-accelerated full-disk encryption at rest, and encrypted connections in transit — including remote access." },
  { Icon: EyeOff, title: "Zero telemetry", body: "SphereX never phones home. No analytics, no usage data, no content scanning. We can't see your data — by design." },
  { Icon: Users, title: "Per-user access control", body: "Every person and department has their own account and data scope. AI answers respect the same permissions." },
  { Icon: Archive, title: "Ransomware protection", body: "Immutable snapshots and version history let you roll files back to a clean point in time." },
  { Icon: WifiOff, title: "Air-gap capable", body: "AI, search and storage keep working with no internet at all — for high-security and offline environments." },
];

const FAQ: FaqItem[] = [
  {
    q: "Does any of our data go to DysoSphere?",
    a: "No. SphereX doesn't send files, prompts, AI conversations or usage analytics to us or anyone else. Data only leaves the device if you deliberately use an internet feature such as remote access, web research or WhatsApp messaging.",
  },
  {
    q: "Are our files used to train AI models?",
    a: "Never. The AI models run locally on your SphereX and your data stays on your hardware. Nothing is collected, so nothing can be used for training.",
  },
  {
    q: "What does “HIPAA-ready” mean?",
    a: "SphereX provides the technical safeguards HIPAA expects — on-premise data storage and processing, encryption at rest and in transit, per-user access control and backups. Compliance also depends on your organisation's own policies and procedures; we'll help you configure SphereX to support them.",
  },
  {
    q: "How does remote access stay secure?",
    a: "Remote access uses an end-to-end encrypted tunnel directly to your SphereX, with no port forwarding required. You can switch it off entirely if you don't need it.",
  },
  {
    q: "What happens if the device fails?",
    a: "SphereX supports redundant drive configurations, snapshots and version history. We'll recommend a setup — including an optional second device for backup — when we prepare your quote.",
  },
];

export default function SecurityPage() {
  return (
    <>
      <section className="mk-page-hero" aria-labelledby="security-title">
        <div className="mk-container mk-split">
          <div>
            <p className="mk-eyebrow">Security &amp; privacy</p>
            <h1 className="mk-h1" id="security-title">
              Your data never leaves your building.
            </h1>
            <p className="mk-lead">
              Cloud AI asks you to trust someone else with your most sensitive information. SphereX doesn&apos;t. The AI
              comes to your data — on hardware you own, inside your own network.
            </p>
            <div className="mk-hero-micro" style={{ marginTop: 28 }}>
              <span>
                <BadgeCheck size={15} /> HIPAA-ready
              </span>
              <span>
                <BadgeCheck size={15} /> AES-256 encryption
              </span>
              <span>
                <BadgeCheck size={15} /> Zero telemetry
              </span>
            </div>
          </div>

          {/* Network boundary diagram */}
          <div className="mk-diagram mk-reveal" role="img" aria-label="Diagram: your devices connect to SphereX inside your network; nothing goes to the cloud">
            <div className="mk-diagram-zone">
              <span className="mk-diagram-label">Your network</span>
              <div className="mk-diagram-row">
                <div className="mk-node">
                  <span>
                    <Laptop size={16} /> Laptops
                  </span>
                  <span>
                    <Smartphone size={16} /> Phones
                  </span>
                  <span>
                    <Users size={16} /> Your team
                  </span>
                </div>
                <div className="mk-wire" />
                <div className="mk-node mk-node-main">
                  <strong>SphereX</strong>
                  <span>
                    <Bot size={16} /> AI models
                  </span>
                  <span>
                    <HardDrive size={16} /> Encrypted storage
                  </span>
                  <span>
                    <KeyRound size={16} /> Access control
                  </span>
                </div>
              </div>
            </div>
            <div className="mk-diagram-cloud">
              <CloudOff size={18} /> No cloud AI · No data sent to third parties
            </div>
          </div>
        </div>
      </section>

      <section className="mk-section mk-section-alt" aria-labelledby="pillars-title">
        <div className="mk-container">
          <SectionHead
            eyebrow="How we protect you"
            title={<span id="pillars-title">Six layers of protection, built in</span>}
          />
          <div className="mk-grid-3">
            {PILLARS.map(({ Icon, title, body }) => (
              <article key={title} className="mk-card mk-reveal">
                <span className="mk-icon">
                  <Icon size={20} />
                </span>
                <h2 className="mk-h3">{title}</h2>
                <p>{body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mk-section" aria-labelledby="compliance-title">
        <div className="mk-container">
          <SectionHead
            eyebrow="Compliance"
            title={<span id="compliance-title">Built for regulated industries</span>}
            lead="When data never leaves your premises, meeting data-protection and data-residency rules becomes far simpler."
          />
          <div className="mk-grid-3">
            <article className="mk-card mk-reveal">
              <span className="mk-icon">
                <BadgeCheck size={20} />
              </span>
              <h3 className="mk-h3">HIPAA-ready</h3>
              <p>Patient data is stored and processed on-site — even AI inference — with encryption and access controls.</p>
            </article>
            <article className="mk-card mk-reveal">
              <span className="mk-icon">
                <HardDrive size={20} />
              </span>
              <h3 className="mk-h3">Data residency</h3>
              <p>Your data physically stays in your building and your jurisdiction, never in a foreign data centre.</p>
            </article>
            <article className="mk-card mk-reveal">
              <span className="mk-icon">
                <Lock size={20} />
              </span>
              <h3 className="mk-h3">Privilege &amp; confidentiality</h3>
              <p>No external AI provider processes client or patient data, removing a major confidentiality risk.</p>
            </article>
          </div>
        </div>
      </section>

      <section className="mk-section mk-section-alt" aria-label="Security questions">
        <div className="mk-container">
          <Faq items={FAQ} title="Security questions" />
        </div>
      </section>

      <CtaBand
        title="Have a security review to pass?"
        lead="We're happy to walk your IT or compliance team through how SphereX handles data. Request a quote and mention your requirements."
      />
    </>
  );
}

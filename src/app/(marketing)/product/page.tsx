// ============================================================================
// /product — what SphereX does, explained as outcomes, then the details
// ============================================================================

import type { Metadata } from "next";
import Image from "next/image";
import {
  Bot,
  Boxes,
  Check,
  Cpu,
  FileText,
  Gauge,
  Globe,
  HardDrive,
  Image as ImageIcon,
  KeyRound,
  Layers,
  MessageCircle,
  Network,
  RefreshCw,
  Search,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { CtaBand, QuoteButton, SectionHead } from "@/components/marketing/blocks";

export const metadata: Metadata = {
  title: "Product — private AI server and secure storage in one device",
  description:
    "Explore SphereX: local AI chat over your documents, AI agents that automate work, semantic file and photo search, automatic backup and petabyte-scale storage — all on-premise.",
  alternates: { canonical: "/product" },
};

type Feature = {
  id: string;
  Icon: typeof Sparkles;
  label: string;
  title: string;
  body: string;
  points: string[];
  example?: { q: string; a: string };
};

const AI_FEATURES: Feature[] = [
  {
    id: "ask",
    Icon: Sparkles,
    label: "Private AI assistant",
    title: "A ChatGPT for your company — that never leaves the building",
    body: "Ask questions, draft documents, summarise reports and analyse data with large language models running directly on SphereX. No API calls, no per-token charges.",
    points: [
      "Runs Gemma, Llama, Qwen, Mistral and other open models",
      "Hardware-accelerated on a dedicated AI chip",
      "Large context windows for long documents",
      "Unlimited use — no metering, ever",
    ],
    example: {
      q: "Draft an NDA from our standard template with a 3-year term.",
      a: "Done — NDA-Draft.pdf saved to /Legal/Drafts with your standard clauses and a 3-year term applied.",
    },
  },
  {
    id: "knowledge",
    Icon: FileText,
    label: "Answers from your files",
    title: "Every document, instantly answerable",
    body: "SphereX indexes your PDFs, spreadsheets, documents and scans on-device. Ask in plain English and get precise answers with the exact source and page — so your team can trust them.",
    points: [
      "Answers cite the file and page they came from",
      "Ideal for policies, contracts, SOPs and archives",
      "Indexing and retrieval happen entirely on-premise",
      "Per-user permissions respected in every answer",
    ],
    example: {
      q: "What's the notice period in our office lease?",
      a: "90 days' written notice before the renewal date. Source: Office-Lease-2024.pdf, page 6.",
    },
  },
  {
    id: "agents",
    Icon: Bot,
    label: "AI agents, 24×7",
    title: "Hand off the busywork to AI agents",
    body: "Schedule agents that work for you — morning briefings, expense digests, report generation and web research. Ready-made assistant packs (like Clinic Receptionist or Office Manager) install in one step.",
    points: [
      "Plain-English scheduling: “every Monday at 9am”",
      "Browser agent researches the web and summarises findings",
      "Each team member gets their own workflows",
      "Results delivered in-app, on WhatsApp or Telegram",
    ],
  },
  {
    id: "messaging",
    Icon: MessageCircle,
    label: "WhatsApp & Telegram",
    title: "An AI receptionist that never sleeps",
    body: "Let SphereX reply to customers on WhatsApp and Telegram — answering questions, confirming appointments and sending reminders, with full conversation memory. Messages are processed on your device.",
    points: [
      "Automatic, context-aware replies per contact",
      "Booking confirmations and reminders",
      "Scheduled summaries sent to your phone",
      "No third-party AI reads your conversations",
    ],
  },
];

const STORAGE_FEATURES = [
  { Icon: Search, title: "Semantic file search", body: "Find files by describing them — “the electrician's invoice from March” — across every document type." },
  { Icon: ImageIcon, title: "Smart photo library", body: "Face grouping, scene and object recognition, and search by description. Nothing is uploaded anywhere." },
  { Icon: RefreshCw, title: "Automatic backup & sync", body: "Back up iPhone, Android, Mac and Windows devices continuously, with version history and snapshots." },
  { Icon: Globe, title: "Secure remote access", body: "Reach your files from anywhere through an encrypted tunnel — no port forwarding, no cloud relay." },
  { Icon: KeyRound, title: "Encryption & snapshots", body: "AES-256 at rest and in transit, plus immutable snapshots that protect against ransomware." },
  { Icon: Smartphone, title: "Web & mobile apps", body: "A clean, consumer-simple interface your whole team can use without training." },
];

const HARDWARE = [
  { Icon: Cpu, title: "Dedicated AI accelerator", body: "Sustained local inference for language, vision and embedding models — concurrently." },
  { Icon: HardDrive, title: "Petabyte-scale storage", body: "Start with multiple terabytes and expand capacity as your data grows." },
  { Icon: Layers, title: "Tiered NVMe + HDD", body: "A fast NVMe tier for AI and hot files, high-capacity drives for everything else." },
  { Icon: Network, title: "Multi-gigabit networking", body: "Fast enough that the whole office can work from SphereX at once." },
  { Icon: Gauge, title: "Enterprise-grade compute", body: "Engineered to run AI and storage workloads around the clock." },
  { Icon: Boxes, title: "Open software stack", body: "Built on open standards and open models — no proprietary lock-in." },
];

export default function ProductPage() {
  return (
    <>
      <section className="mk-page-hero" aria-labelledby="product-title">
        <div className="mk-container mk-split">
          <div>
            <p className="mk-eyebrow">SphereX</p>
            <h1 className="mk-h1" id="product-title">
              Everything your business needs from AI, in one device.
            </h1>
            <p className="mk-lead">
              SphereX combines a private AI server, ready-made AI agents and intelligent storage in a single appliance
              that sits on your network. Your team gets modern AI; your data never leaves your premises.
            </p>
            <div className="mk-actions">
              <QuoteButton id="product-hero-quote" />
            </div>
            <nav className="mk-anchor-nav" aria-label="On this page">
              <a href="#ai">AI engine</a>
              <a href="#storage">Storage</a>
              <a href="#hardware">Hardware</a>
            </nav>
          </div>
          <div className="mk-platform-device" style={{ maxWidth: 480, marginInline: "auto", width: "100%" }}>
            <Image
              src="/images/spherex-device.png"
              alt="SphereX — compact white AI server and storage appliance"
              width={1024}
              height={1024}
              sizes="(max-width: 900px) 90vw, 480px"
              preload
            />
          </div>
        </div>
      </section>

      {/* ── AI engine ───────────────────────────────────────────────────── */}
      <section className="mk-section mk-section-alt" id="ai" aria-labelledby="ai-title" style={{ scrollMarginTop: 72 }}>
        <div className="mk-container">
          <SectionHead
            eyebrow="AI engine"
            title={<span id="ai-title">Intelligent by design. Private by default.</span>}
            lead="A complete AI stack running on-device — from language models to computer vision — without sending a single byte to the cloud."
          />
          {AI_FEATURES.map((f, i) => (
            <div key={f.id} id={f.id} className={`mk-split${i % 2 ? " mk-flip" : ""}`}>
              <div className="mk-reveal">
                <div className="mk-split-label">
                  <span className="mk-icon">
                    <f.Icon size={20} />
                  </span>
                  <span>{f.label}</span>
                </div>
                <h3 className="mk-h2">{f.title}</h3>
                <p className="mk-lead">{f.body}</p>
                <ul className="mk-checks">
                  {f.points.map((p) => (
                    <li key={p}>
                      <Check size={16} /> {p}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mk-window mk-reveal" aria-hidden="true">
                <div className="mk-window-bar">
                  <span className="mk-dots">
                    <i />
                    <i />
                    <i />
                  </span>
                  <span>Sphere AI</span>
                  <span className="mk-window-status">● Local</span>
                </div>
                <div className="mk-window-body" style={{ minHeight: 0 }}>
                  {f.example ? (
                    <>
                      <div className="mk-msg-user">{f.example.q}</div>
                      <div className="mk-msg-ai">{f.example.a}</div>
                    </>
                  ) : f.id === "agents" ? (
                    <>
                      <div className="mk-msg-user">Every Friday at 5pm, summarise this week&apos;s invoices and email me the total.</div>
                      <div className="mk-msg-ai">
                        <strong>Agent scheduled.</strong> Every Friday at 5:00 PM I&apos;ll read new invoices in /Finance/Invoices, total
                        them by vendor and send you a summary.
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="mk-msg-user">Hi, can I book a check-up for Saturday morning?</div>
                      <div className="mk-msg-ai">
                        Of course! Saturday has slots at <strong>9:30</strong> and <strong>11:00</strong>. Which works for you?
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Storage ─────────────────────────────────────────────────────── */}
      <section className="mk-section" id="storage" aria-labelledby="storage-title" style={{ scrollMarginTop: 72 }}>
        <div className="mk-container">
          <SectionHead
            eyebrow="Storage engine"
            title={<span id="storage-title">Storage that understands what&apos;s in it</span>}
            lead="Replace scattered cloud drives with one secure place for every file, photo and backup — searchable by meaning."
          />
          <div className="mk-grid-3">
            {STORAGE_FEATURES.map(({ Icon, title, body }) => (
              <article key={title} className="mk-card mk-card-hover mk-reveal">
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

      {/* ── Hardware ────────────────────────────────────────────────────── */}
      <section className="mk-section mk-section-alt" id="hardware" aria-labelledby="hardware-title" style={{ scrollMarginTop: 72 }}>
        <div className="mk-container">
          <SectionHead
            eyebrow="What's inside"
            title={<span id="hardware-title">Built for serious workloads</span>}
            lead="Purpose-built hardware that runs continuous AI alongside petabyte-scale storage. We configure each SphereX to your team's size and data."
          />
          <div className="mk-grid-3">
            {HARDWARE.map(({ Icon, title, body }) => (
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

      <CtaBand
        title="Find the right SphereX for your team"
        lead="Tell us how many people will use it and how much data you have. We'll recommend a configuration and send a quote."
      />
    </>
  );
}

// ============================================================================
// Homepage — follows the "textbook" structure:
// hero → proof → problem → solution → how it works → outcomes → demo →
// platform → cost comparison → industries → security → FAQ → final CTA
// ============================================================================

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Bot,
  Briefcase,
  Check,
  CloudOff,
  Cpu,
  EyeOff,
  Factory,
  FileLock2,
  FolderUp,
  GraduationCap,
  Image as ImageIcon,
  Lock,
  MessageCircle,
  Plug,
  RefreshCw,
  Scale,
  Search,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Store,
  Workflow,
  X,
} from "lucide-react";
import { CtaBand, Faq, QuoteButton, SectionHead, type FaqItem } from "@/components/marketing/blocks";
import { DemoShowcase } from "@/components/marketing/demo-showcase";
import { CONTACT_EMAIL, SITE_URL } from "@/components/marketing/site";

export const metadata: Metadata = {
  title: { absolute: "SphereX — Private AI for your business, on your own hardware | DysoSphere" },
  alternates: { canonical: "/" },
};

const OUTCOMES = [
  {
    Icon: Search,
    title: "Find any document in seconds",
    body: "Search by meaning, not filenames. “The electrician's invoice from March” just works — across PDFs, sheets and scans.",
  },
  {
    Icon: Sparkles,
    title: "Get answers with sources",
    body: "Ask questions in plain English and get answers drawn from your own files, with the exact page cited.",
  },
  {
    Icon: Workflow,
    title: "Automate the busywork 24×7",
    body: "AI agents handle briefings, reports, triage and web research on a schedule — no engineers required.",
  },
  {
    Icon: MessageCircle,
    title: "An AI receptionist on WhatsApp",
    body: "Answer customer questions, confirm bookings and send reminders on WhatsApp and Telegram, around the clock.",
  },
  {
    Icon: ImageIcon,
    title: "Search photos by describing them",
    body: "On-device vision AI recognises scenes, objects and faces, so “safety violation on site” finds the right photos.",
  },
  {
    Icon: RefreshCw,
    title: "Replace cloud storage",
    body: "Back up every laptop and phone automatically, share files securely, and access them from anywhere.",
  },
];

const INDUSTRY_TILES = [
  { id: "healthcare", Icon: Stethoscope, title: "Healthcare & clinics", body: "Keep patient records on-site and run a WhatsApp AI receptionist for bookings." },
  { id: "legal", Icon: Scale, title: "Legal & law firms", body: "Search case files and review contracts with AI — without risking privilege." },
  { id: "corporate", Icon: Briefcase, title: "Corporate & HR", body: "A private knowledge base employees can ask about policies, SOPs and benefits." },
  { id: "retail", Icon: Store, title: "Retail & shops", body: "Track inventory, get restock reminders and spot sales patterns automatically." },
  { id: "education", Icon: GraduationCap, title: "Education", body: "Give staff and students AI tools while student data stays on campus." },
  { id: "manufacturing", Icon: Factory, title: "Manufacturing", body: "Index manuals and inspection photos, fully offline on the factory floor." },
];

const FAQ: FaqItem[] = [
  {
    q: "What exactly is SphereX?",
    a: "SphereX is a physical device that sits in your office. It combines a private AI server (it runs large language models locally) with secure, expandable storage for your company's files. Your team uses it through simple web and mobile apps — like ChatGPT and Google Drive, but running on AI you own.",
  },
  {
    q: "How is it different from a regular NAS or file server?",
    a: "A normal NAS only stores files. SphereX understands them: it indexes every document and photo so you can search by meaning, ask questions and get cited answers, and run AI agents that automate work — all on the device, with no cloud AI service involved.",
  },
  {
    q: "Does SphereX need an internet connection?",
    a: "No. All AI processing, search and storage happen on the device, so SphereX keeps working fully offline and can run air-gapped. An internet connection is only needed for optional features you choose to use, such as remote access, web research or WhatsApp messaging.",
  },
  {
    q: "How much does it cost?",
    a: (
      <>
        Pricing depends on your team size, storage capacity and the AI workloads you need, so we quote each configuration.
        It&apos;s a one-time hardware purchase with no per-token or per-seat AI fees.{" "}
        <Link href="/contact#quote" className="mk-link">
          Request a quote <ArrowRight size={14} />
        </Link>
      </>
    ),
  },
  {
    q: "Is SphereX HIPAA-ready?",
    a: "Yes. Patient data never leaves your premises — not even for AI processing — and it's protected with AES-256 encryption at rest and in transit, per-user access controls and immutable snapshots. Full HIPAA compliance also depends on your organisation's own policies, and we'll help you configure SphereX to support them.",
  },
  {
    q: "Which AI models does it run?",
    a: "SphereX runs leading open models such as Gemma, Llama, Qwen and Mistral, accelerated by dedicated AI hardware. Because it's an open stack, you're never locked into one vendor's model.",
  },
  {
    q: "Do we need an IT team to set it up?",
    a: "No. SphereX is designed to be plugged in and used. Ready-made AI assistants (for example a clinic receptionist or office manager) install in one step, and we help you get started.",
  },
  {
    q: "How many people can use one SphereX?",
    a: "SphereX is multi-user: each person or department gets their own account, data scope and AI workflows, while sharing a common company knowledge base. We size the hardware to your team when we prepare your quote.",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "DysoSphere",
      url: SITE_URL,
      logo: `${SITE_URL}/images/DS.svg`,
      email: CONTACT_EMAIL,
    },
    {
      "@type": "Product",
      name: "SphereX",
      brand: { "@type": "Brand", name: "DysoSphere" },
      image: `${SITE_URL}/images/spherex-device.png`,
      description:
        "An on-premise private AI server and secure storage appliance for small and medium businesses. HIPAA-ready, petabyte-scale storage, no token fees.",
      category: "On-premise AI server",
    },
  ],
};

export default function HomePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ── 1. Hero ─────────────────────────────────────────────────────── */}
      <section className="mk-hero" aria-labelledby="hero-title">
        <div className="mk-container mk-hero-grid">
          <div className="mk-hero-copy">
            <span className="mk-pill">
              <span className="mk-pill-dot" aria-hidden="true" /> Now shipping · HIPAA-ready
            </span>
            <h1 className="mk-h1" id="hero-title">
              Private AI for your business, <span className="mk-grad">running in your office.</span>
            </h1>
            <p className="mk-lead">
              SphereX is an AI server and secure storage in one device. Ask questions about your files, automate
              routine work with AI agents, and keep every byte on your own network — no cloud, no token bills.
            </p>
            <div className="mk-actions">
              <QuoteButton id="hero-quote" />
              <a href="#demo" className="mk-btn mk-btn-secondary mk-btn-lg" id="hero-demo">
                See it in action
              </a>
            </div>
            <div className="mk-hero-micro">
              <span>
                <Check size={15} /> One-time purchase
              </span>
              <span>
                <Check size={15} /> No per-token fees
              </span>
              <span>
                <Check size={15} /> Works fully offline
              </span>
            </div>
          </div>

          <div className="mk-hero-visual">
            <div className="mk-hero-device">
              <Image
                src="/images/spherex-device.png"
                alt="The SphereX device — a compact white AI server with a glowing blue ring"
                width={1024}
                height={1024}
                sizes="(max-width: 900px) 90vw, 560px"
                preload
              />
            </div>
            <div className="mk-hero-badge" aria-hidden="true">
              <ShieldCheck size={20} />
              <div>
                <strong>0 bytes sent to the cloud</strong>
                <span>All AI runs on-device</span>
              </div>
            </div>
            <div className="mk-hero-chat" aria-hidden="true">
              <div className="mk-hero-chat-q">Summarise the key changes in the new vendor contract</div>
              <div className="mk-hero-chat-a">
                <strong>3 key changes:</strong> payment terms move to 45 days, liability cap rises to 25%, and a new
                data-residency clause is added.
              </div>
              <div className="mk-hero-chat-src">
                <FileLock2 size={12} /> Vendor-Agreement-v3.pdf · pages 4–9
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. Proof strip ──────────────────────────────────────────────── */}
      <section className="mk-proof" aria-label="Built on proven technology">
        <div className="mk-container mk-proof-inner">
          <p className="mk-proof-label">Runs leading open AI models, secured to enterprise standards</p>
          <div className="mk-proof-items">
            <span>Gemma</span>
            <span>Llama</span>
            <span>Qwen</span>
            <span>Mistral</span>
            <span>
              <Lock size={16} /> AES-256
            </span>
            <span>
              <BadgeCheck size={16} /> HIPAA-ready
            </span>
          </div>
        </div>
      </section>

      {/* ── 3. Problem ──────────────────────────────────────────────────── */}
      <section className="mk-section" aria-labelledby="problem-title">
        <div className="mk-container">
          <SectionHead
            eyebrow="The problem"
            title={<span id="problem-title">Your team wants AI. Your data can&apos;t go to the cloud.</span>}
            lead={
              <>
                Small and medium businesses avoid cloud AI because of <span className="mk-hl">data privacy</span> risks,
                recurring <span className="mk-hl">token costs</span>, and the <span className="mk-hl">engineering
                effort</span> it takes to make AI actually useful.
              </>
            }
          />
          <div className="mk-grid-3">
            <article className="mk-problem-card mk-blue mk-reveal">
              <div className="mk-problem-num">01.</div>
              <h3>The cost spiral</h3>
              <p>A single autonomous AI workflow can burn 100k+ tokens. That&apos;s $150–$500 a month in recurring overhead — forever.</p>
            </article>
            <article className="mk-problem-card mk-reveal">
              <div className="mk-problem-num">02.</div>
              <h3>Data privacy</h3>
              <p>Confidential files leave your premises, and your private information can end up training someone else&apos;s model.</p>
            </article>
            <article className="mk-problem-card mk-light mk-reveal">
              <div className="mk-problem-num">03.</div>
              <h3>The integration gap</h3>
              <p>Turning raw AI into real productivity takes developers and integrations most small teams don&apos;t have.</p>
            </article>
          </div>
        </div>
      </section>

      {/* ── 4. Solution in numbers ──────────────────────────────────────── */}
      <section className="mk-section mk-section-alt" aria-labelledby="solution-title">
        <div className="mk-container">
          <SectionHead
            eyebrow="The solution"
            title={<span id="solution-title">One device. Your own private AI.</span>}
            lead="SphereX brings the AI, the storage and ready-made automations into a single machine that lives on your network and answers only to you."
            center
          />
          <div className="mk-stats mk-reveal">
            <div className="mk-stat">
              <div className="mk-stat-value">$0</div>
              <div className="mk-stat-label">Token &amp; rental costs</div>
              <div className="mk-stat-sub">AI runs on your hardware, so there&apos;s nothing to meter.</div>
            </div>
            <div className="mk-stat">
              <div className="mk-stat-value">0 bytes</div>
              <div className="mk-stat-label">Leave your network</div>
              <div className="mk-stat-sub">Files and AI processing stay on your premises.</div>
            </div>
            <div className="mk-stat">
              <div className="mk-stat-value">0 engineers</div>
              <div className="mk-stat-label">Needed to deploy</div>
              <div className="mk-stat-sub">Ready-made AI assistants, set up in one step.</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. How it works ─────────────────────────────────────────────── */}
      <section className="mk-section" id="how-it-works" aria-labelledby="how-title">
        <div className="mk-container">
          <SectionHead
            eyebrow="How it works"
            title={<span id="how-title">Up and running in three steps</span>}
            lead="No cloud accounts, no API keys, no developers."
          />
          <ol className="mk-steps">
            <li className="mk-step mk-reveal">
              <span className="mk-step-num">1</span>
              <span className="mk-icon">
                <Plug size={20} />
              </span>
              <h3 className="mk-h3">Plug it in</h3>
              <p>Connect SphereX to power and your office network. It&apos;s ready to use from any browser or phone.</p>
            </li>
            <li className="mk-step mk-reveal">
              <span className="mk-step-num">2</span>
              <span className="mk-icon">
                <FolderUp size={20} />
              </span>
              <h3 className="mk-h3">Add your files</h3>
              <p>Drag in documents or sync laptops and phones automatically. SphereX indexes everything on-device.</p>
            </li>
            <li className="mk-step mk-reveal">
              <span className="mk-step-num">3</span>
              <span className="mk-icon">
                <Bot size={20} />
              </span>
              <h3 className="mk-h3">Ask and automate</h3>
              <p>Chat with your files, search photos by description, and put AI agents to work on a schedule.</p>
            </li>
          </ol>
        </div>
      </section>

      {/* ── 6. Outcomes ─────────────────────────────────────────────────── */}
      <section className="mk-section mk-section-alt" aria-labelledby="outcomes-title">
        <div className="mk-container">
          <SectionHead
            eyebrow="What your team can do"
            title={<span id="outcomes-title">Less searching. Less busywork. More done.</span>}
          />
          <div className="mk-grid-3">
            {OUTCOMES.map(({ Icon, title, body }) => (
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

      {/* ── 7. Live demo ────────────────────────────────────────────────── */}
      <section className="mk-section" id="demo" aria-labelledby="demo-title" style={{ scrollMarginTop: 72 }}>
        <div className="mk-container">
          <SectionHead
            eyebrow="See it in action"
            title={<span id="demo-title">Like ChatGPT — but it knows your business, and it&apos;s yours.</span>}
          />
          <DemoShowcase />
        </div>
      </section>

      {/* ── 8. Platform ─────────────────────────────────────────────────── */}
      <section className="mk-section mk-section-alt" aria-labelledby="platform-title">
        <div className="mk-container">
          <SectionHead
            eyebrow="The SphereX platform"
            title={<span id="platform-title">Purpose-built hardware. Secure software.</span>}
            lead="A secure, on-premise private AI and storage device — designed as one system, so there's nothing to integrate."
            center
          />
          <div className="mk-platform">
            <div className="mk-platform-col mk-reveal">
              <h3>
                <span className="mk-icon">
                  <Cpu size={20} />
                </span>
                Powerful hardware
              </h3>
              <ul>
                <li>
                  <strong>Enterprise-grade compute</strong>
                  <span>Built to run AI and storage around the clock</span>
                </li>
                <li>
                  <strong>Dedicated AI accelerator</strong>
                  <span>Fast local inference for language and vision models</span>
                </li>
                <li>
                  <strong>Petabyte-scale storage</strong>
                  <span>Start with terabytes, expand as you grow</span>
                </li>
                <li>
                  <strong>Multi-gigabit networking</strong>
                  <span>No bottleneck between your team and your data</span>
                </li>
              </ul>
            </div>
            <div className="mk-platform-device">
              <Image
                src="/images/spherex-device.png"
                alt="SphereX device"
                width={1024}
                height={1024}
                sizes="(max-width: 1024px) 400px, 420px"
              />
            </div>
            <div className="mk-platform-col mk-reveal">
              <h3>
                <span className="mk-icon">
                  <ShieldCheck size={20} />
                </span>
                Secure software
              </h3>
              <ul>
                <li>
                  <strong>Autonomous AI agents</strong>
                  <span>Scheduled tasks, research and messaging</span>
                </li>
                <li>
                  <strong>Private data vault</strong>
                  <span>AES-256 encryption and per-user access</span>
                </li>
                <li>
                  <strong>Unified web &amp; mobile apps</strong>
                  <span>Consumer-simple — no training needed</span>
                </li>
                <li>
                  <strong>Open model support</strong>
                  <span>Gemma, Llama, Qwen, Mistral and more</span>
                </li>
              </ul>
            </div>
          </div>
          <p className="mk-caption">Representative product image.</p>
        </div>
      </section>

      {/* ── 9. Cost comparison ──────────────────────────────────────────── */}
      <section className="mk-section" aria-labelledby="compare-title">
        <div className="mk-container">
          <SectionHead
            eyebrow="Own it, don't rent it"
            title={<span id="compare-title">Stop paying rent on your own intelligence</span>}
            lead="Cloud AI charges you every month, for every seat and every token. SphereX is a one-time purchase."
          />
          <div className="mk-compare mk-reveal">
            <table>
              <thead>
                <tr>
                  <th scope="col">
                    <span className="sr-only">Feature</span>
                  </th>
                  <th scope="col">Cloud AI + cloud storage</th>
                  <th scope="col" className="mk-us">
                    SphereX
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["AI usage costs", "$150–$500/month per automated workflow", "$0 — no token fees"],
                  ["Pricing model", "Monthly subscriptions that grow with every hire", "One-time purchase"],
                  ["Where your data lives", "Vendor data centres", "Your office, on your network"],
                  ["Works without internet", "No", "Yes — fully offline capable"],
                  ["Setup effort", "Developers, APIs and integrations", "Plug in and use ready-made assistants"],
                  ["Who owns it", "Rented — stop paying and lose access", "You do, outright"],
                ].map(([label, them, us]) => (
                  <tr key={label}>
                    <td>{label}</td>
                    <td className="mk-them">
                      <span className="mk-cell">
                        <X size={16} /> {them}
                      </span>
                    </td>
                    <td className="mk-us">
                      <span className="mk-cell">
                        <Check size={16} /> {us}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mk-footnote">Cloud cost range reflects typical token usage of autonomous AI workflows (100k+ tokens per run).</p>
        </div>
      </section>

      {/* ── 10. Industries ──────────────────────────────────────────────── */}
      <section className="mk-section mk-section-alt" aria-labelledby="industries-title">
        <div className="mk-container">
          <SectionHead
            eyebrow="Built for your industry"
            title={<span id="industries-title">For teams where privacy isn&apos;t optional</span>}
          />
          <div className="mk-grid-3">
            {INDUSTRY_TILES.map(({ id, Icon, title, body }) => (
              <Link key={id} href={`/solutions#${id}`} className="mk-card mk-card-hover mk-industry mk-reveal" id={`industry-${id}`}>
                <span className="mk-icon">
                  <Icon size={20} />
                </span>
                <h3 className="mk-h3">{title}</h3>
                <p>{body}</p>
                <span className="mk-link">
                  Learn more <ArrowRight size={15} />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── 11. Security ────────────────────────────────────────────────── */}
      <section className="mk-section" aria-labelledby="security-title">
        <div className="mk-container mk-security">
          <div className="mk-reveal">
            <p className="mk-eyebrow">Security &amp; privacy</p>
            <h2 className="mk-h2" id="security-title">
              Your data physically stays with you.
            </h2>
            <p className="mk-lead">
              SphereX was designed for organisations where data leaving the building isn&apos;t an option. No cloud
              relay, no third-party AI, no telemetry.
            </p>
            <div className="mk-actions">
              <Link href="/security" className="mk-btn mk-btn-secondary" id="home-security">
                How we protect your data <ArrowRight size={16} className="mk-arrow" />
              </Link>
            </div>
          </div>
          <div className="mk-security-list">
            {[
              { Icon: CloudOff, title: "No cloud dependency", body: "AI, search and storage run on-device — even fully air-gapped." },
              { Icon: Lock, title: "AES-256 encryption", body: "Hardware-accelerated encryption at rest and in transit." },
              { Icon: EyeOff, title: "Zero telemetry", body: "SphereX never phones home. We can't see your data." },
              { Icon: BadgeCheck, title: "HIPAA-ready", body: "Patient data never leaves your premises, even for AI." },
            ].map(({ Icon, title, body }) => (
              <div key={title} className="mk-security-item mk-reveal">
                <span className="mk-icon">
                  <Icon size={18} />
                </span>
                <h3 className="mk-h3" style={{ fontSize: "1.02rem" }}>
                  {title}
                </h3>
                <p>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 12. FAQ ─────────────────────────────────────────────────────── */}
      <section className="mk-section mk-section-alt" aria-label="Frequently asked questions">
        <div className="mk-container">
          <Faq items={FAQ} />
        </div>
      </section>

      {/* ── 13. Final CTA ───────────────────────────────────────────────── */}
      <CtaBand title="Get a SphereX quote for your team" />
    </>
  );
}

// ============================================================================
// /solutions — one block per industry: pain → how SphereX helps → example
// ============================================================================

import type { Metadata } from "next";
import { Briefcase, Check, Factory, GraduationCap, Scale, Stethoscope, Store } from "lucide-react";
import { CtaBand, QuoteButton } from "@/components/marketing/blocks";

export const metadata: Metadata = {
  title: "Solutions — private AI for healthcare, legal, HR, retail, education and manufacturing",
  description:
    "See how clinics, law firms, corporate teams, retailers, schools and manufacturers use SphereX to adopt AI while keeping sensitive data on-premise.",
  alternates: { canonical: "/solutions" },
};

const SOLUTIONS = [
  {
    id: "healthcare",
    Icon: Stethoscope,
    title: "Healthcare & clinics",
    heading: "SphereX for clinics & hospitals",
    pain: "Patient data can't be sent to cloud AI services — but staff are buried in bookings, records and follow-ups.",
    points: [
      "Store patient records, reports and imaging on-site with AES-256 encryption",
      "HIPAA-ready: patient data never leaves your network, even for AI processing",
      "A WhatsApp AI receptionist for bookings, reminders and common questions",
      "AI summaries of patient histories to speed up consultations",
      "Medicine inventory tracking with low-stock and expiry alerts",
    ],
    example: { q: "Which patients are due for a follow-up this week?", a: "7 patients are due. 3 have no booking yet — want me to send them a WhatsApp reminder?" },
  },
  {
    id: "legal",
    Icon: Scale,
    title: "Legal & law firms",
    heading: "SphereX for law firms",
    pain: "Uploading privileged client documents to an external AI provider risks confidentiality and privilege.",
    points: [
      "Secure local storage for case files, contracts and client communications",
      "Search thousands of case documents in plain English",
      "Contract review: extract key clauses and flag unusual terms",
      "Automatic case timelines built from scattered documents",
      "No external AI provider ever processes client data",
    ],
    example: { q: "List every indemnity clause across the Sharma case contracts.", a: "Found 5 indemnity clauses in 3 contracts. The 2023 supplier agreement has an uncapped indemnity (page 11)." },
  },
  {
    id: "corporate",
    Icon: Briefcase,
    title: "Corporate & HR",
    heading: "SphereX for corporate & HR teams",
    pain: "Employees waste hours hunting for policies and answers, and HR data is too sensitive for public AI tools.",
    points: [
      "A private knowledge base for policies, SOPs and benefits",
      "Employees ask questions and get answers with page references",
      "Automated document processing: resumes, contracts, compliance summaries",
      "Department-level data isolation with a shared company knowledge base",
      "Zero IP exposure — proprietary data never touches external servers",
    ],
    example: { q: "How many casual leave days do I get after probation?", a: "12 days per year after probation. Source: Leave-Policy-2025.pdf, section 4.2." },
  },
  {
    id: "retail",
    Icon: Store,
    title: "Retail & shops",
    heading: "SphereX for retailers",
    pain: "Inventory and sales data are spread across spreadsheets, and stock-outs are noticed too late.",
    points: [
      "Local inventory tracking across products — no cloud POS dependency",
      "Restock reminders when items hit their reorder level",
      "Sales insights: best sellers, dead stock and seasonal demand",
      "Daily sales summaries delivered on WhatsApp",
      "Customer questions answered automatically on WhatsApp",
    ],
    example: { q: "What should I reorder before the festival weekend?", a: "Based on last year's festival sales, reorder 6 items — 2 are already below their reorder level." },
  },
  {
    id: "education",
    Icon: GraduationCap,
    title: "Education & institutions",
    heading: "SphereX for schools & universities",
    pain: "Schools want to give staff and students AI tools, but can't send student data to external services.",
    points: [
      "Securely host student records, research and institutional archives",
      "An AI research assistant over your paper and thesis archives",
      "Automate admin: enrolment processing and report generation",
      "Student data stays on campus — no external AI processing",
      "A local AI lab for students with no per-use cloud costs",
    ],
    example: { q: "Summarise the main findings of last year's theses on water conservation.", a: "4 theses found. Common findings: drip irrigation cut usage 30–45%, and rainwater harvesting adoption was limited by cost." },
  },
  {
    id: "manufacturing",
    Icon: Factory,
    title: "Manufacturing & industry",
    heading: "SphereX for manufacturers",
    pain: "Factory floors often have limited connectivity, and process know-how is locked in manuals and people's heads.",
    points: [
      "Index manuals, safety procedures and compliance records for instant search",
      "Search inspection photos by describing defects",
      "Production reports and downtime summaries generated automatically",
      "Fully functional offline — air-gapped operation supported",
      "Proprietary process data never leaves the plant",
    ],
    example: { q: "What's the lockout procedure for press line 3?", a: "6-step lockout procedure found in Safety-Manual-v7.pdf, page 32. Step 1: notify the shift supervisor…" },
  },
];

export default function SolutionsPage() {
  return (
    <>
      <section className="mk-page-hero mk-center" aria-labelledby="solutions-title">
        <div className="mk-container mk-center" style={{ textAlign: "center" }}>
          <p className="mk-eyebrow">Solutions</p>
          <h1 className="mk-h1" id="solutions-title" style={{ maxWidth: 900, marginInline: "auto" }}>
            Adopt AI without handing over your data.
          </h1>
          <p className="mk-lead" style={{ marginInline: "auto" }}>
            Every industry faces the same choice: fall behind on AI, or trust sensitive data to someone else&apos;s cloud.
            SphereX removes that trade-off.
          </p>
          <nav className="mk-anchor-nav" aria-label="Industries" style={{ justifyContent: "center" }}>
            {SOLUTIONS.map((s) => (
              <a key={s.id} href={`#${s.id}`}>
                {s.title}
              </a>
            ))}
          </nav>
        </div>
      </section>

      <section className="mk-section" style={{ paddingTop: 24 }}>
        <div className="mk-container">
          {SOLUTIONS.map((s, i) => (
            <article key={s.id} id={s.id} className={`mk-split${i % 2 ? " mk-flip" : ""}`} aria-labelledby={`${s.id}-title`}>
              <div className="mk-reveal">
                <div className="mk-split-label">
                  <span className="mk-icon">
                    <s.Icon size={20} />
                  </span>
                  <span>{s.title}</span>
                </div>
                <h2 className="mk-h2" id={`${s.id}-title`}>
                  {s.heading}
                </h2>
                <p className="mk-solution-pain">
                  <strong>The challenge: </strong>
                  {s.pain}
                </p>
                <ul className="mk-checks">
                  {s.points.map((p) => (
                    <li key={p}>
                      <Check size={16} /> {p}
                    </li>
                  ))}
                </ul>
                <div className="mk-actions">
                  <QuoteButton
                    size="md"
                    label="Get a quote for your team"
                    href={`/contact?industry=${s.id}#quote`}
                    id={`solutions-quote-${s.id}`}
                  />
                </div>
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
                  <div className="mk-msg-user">{s.example.q}</div>
                  <div className="mk-msg-ai">{s.example.a}</div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <CtaBand
        title="Don't see your industry?"
        lead="If your data is sensitive, SphereX can probably help. Tell us about your workflow and we'll show you how."
        label="Talk to us"
      />
    </>
  );
}

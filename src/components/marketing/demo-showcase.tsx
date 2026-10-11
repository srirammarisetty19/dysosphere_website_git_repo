"use client";

// ============================================================================
// Interactive product demo — tabbed example conversations with SphereX.
// Auto-advances until the visitor picks a tab themselves.
// ============================================================================

import { useEffect, useState } from "react";
import { CalendarClock, FileText, Globe, Image as ImageIcon, Lock } from "lucide-react";

type Demo = {
  id: string;
  title: string;
  desc: string;
  Icon: typeof FileText;
  question: string;
  answer: React.ReactNode;
  source?: string;
};

const DEMOS: Demo[] = [
  {
    id: "docs",
    title: "Ask your documents",
    desc: "Answers from your own files, with the exact source.",
    Icon: FileText,
    question: "What's our parental leave policy for employees with 3+ years of tenure?",
    answer: (
      <>
        <strong>Parental leave (3+ years tenure):</strong>
        <ul>
          <li>Primary caregiver: 26 weeks paid</li>
          <li>Secondary caregiver: 4 weeks paid</li>
          <li>Plus 12 weeks unpaid, job-protected</li>
        </ul>
      </>
    ),
    source: "HR-Policy-Handbook.pdf · Section 12.3, page 47",
  },
  {
    id: "briefing",
    title: "Daily briefings, automated",
    desc: "AI agents that work on a schedule — even while you sleep.",
    Icon: CalendarClock,
    question: "Every weekday at 8am, send me a briefing on WhatsApp.",
    answer: (
      <>
        <strong>Done — scheduled for weekdays at 8:00 AM.</strong> Here&apos;s today&apos;s:
        <ul>
          <li>3 meetings — first one is the 10:00 product standup</li>
          <li>Q3 budget proposal is due tomorrow</li>
          <li>4 files updated overnight, including Sales-deck v3.2</li>
        </ul>
      </>
    ),
    source: "Delivered via WhatsApp · processed on your SphereX",
  },
  {
    id: "photos",
    title: "Search photos by describing them",
    desc: "On-device vision AI finds images without filenames or tags.",
    Icon: ImageIcon,
    question: "Find site photos showing cracks in the walls from last year.",
    answer: (
      <>
        <strong>Found 38 photos</strong> across 6 project folders.
        <div className="mk-photo-grid" aria-hidden="true">
          {Array.from({ length: 8 }).map((_, i) => (
            <i key={i} />
          ))}
        </div>
      </>
    ),
    source: "/Projects/2025/Site-Inspections",
  },
  {
    id: "research",
    title: "Research the web for you",
    desc: "A browser agent that visits sites and summarises what it finds.",
    Icon: Globe,
    question: "Compare the prices and warranty terms of the 3 shortlisted printer vendors.",
    answer: (
      <>
        <strong>Visited 9 pages across 3 vendor sites.</strong>
        <ul>
          <li>Vendor A — lowest price, 1-year warranty</li>
          <li>Vendor B — 8% more, 3-year on-site warranty</li>
          <li>Vendor C — mid-priced, warranty excludes the print head</li>
        </ul>
        Recommendation: Vendor B for the lowest 3-year cost.
      </>
    ),
    source: "Summary saved to /Purchasing/Printers.md",
  },
];

export function DemoShowcase() {
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);

  useEffect(() => {
    if (!auto) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) return;
    const t = window.setInterval(() => setActive((i) => (i + 1) % DEMOS.length), 7000);
    return () => window.clearInterval(t);
  }, [auto]);

  const demo = DEMOS[active];

  return (
    <div className="mk-demo">
      <div className="mk-demo-tabs" role="tablist" aria-label="SphereX examples">
        {DEMOS.map((d, i) => (
          <button
            key={d.id}
            type="button"
            role="tab"
            id={`demo-tab-${d.id}`}
            aria-selected={i === active}
            aria-controls="demo-panel"
            className="mk-demo-tab"
            onClick={() => {
              setActive(i);
              setAuto(false);
            }}
          >
            <span className="mk-icon">
              <d.Icon size={20} />
            </span>
            <span className="mk-demo-tab-text">
              <strong>{d.title}</strong>
              <span>{d.desc}</span>
            </span>
          </button>
        ))}
      </div>

      <div>
        <div className="mk-window" id="demo-panel" role="tabpanel" aria-labelledby={`demo-tab-${demo.id}`}>
          <div className="mk-window-bar">
            <span className="mk-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span>Sphere AI</span>
            <span className="mk-window-status">
              <Lock size={12} /> Running locally
            </span>
          </div>
          <div className="mk-window-body mk-demo-panel" key={demo.id}>
            <div className="mk-msg-user">{demo.question}</div>
            <div className="mk-msg-ai">
              {demo.answer}
              {demo.source && (
                <div>
                  <span className="mk-msg-src">
                    <FileText size={12} /> {demo.source}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
        <p className="mk-demo-note">Example conversations. Names and figures are illustrative.</p>
      </div>
    </div>
  );
}

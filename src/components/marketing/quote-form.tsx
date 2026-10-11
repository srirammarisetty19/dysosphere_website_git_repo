"use client";

// ============================================================================
// Request-a-quote form. Posts to /api/quote; if email delivery isn't set up
// on the server, falls back to opening a pre-filled email to contact@.
// ============================================================================

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { CONTACT_EMAIL, INDUSTRIES } from "./site";

type Status = "idle" | "sending" | "sent" | "mailto" | "error";

export function QuoteForm() {
  const params = useSearchParams();
  const initialIndustry = INDUSTRIES.find((i) => i.id === params.get("industry"))?.label ?? "";
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
    setStatus("sending");
    setError("");

    try {
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) {
        setStatus("sent");
        form.reset();
        return;
      }
      if (json.fallback === "mailto") {
        openMailto(data);
        setStatus("mailto");
        return;
      }
      setError(json.error || "Something went wrong. Please try again.");
      setStatus("error");
    } catch {
      openMailto(data);
      setStatus("mailto");
    }
  }

  if (status === "sent") {
    return (
      <div className="mk-alert mk-alert-ok" role="status">
        <CheckCircle2 size={20} />
        <div>
          <strong>Thanks — your request is in.</strong>
          <br />A founder will get back to you shortly with next steps and a quote.
        </div>
      </div>
    );
  }

  return (
    <form className="mk-form" onSubmit={onSubmit} noValidate={false} aria-describedby="quote-help">
      <div className="mk-form-row">
        <div className="mk-field">
          <label htmlFor="q-name">Full name</label>
          <input id="q-name" name="name" required autoComplete="name" placeholder="Jane Doe" />
        </div>
        <div className="mk-field">
          <label htmlFor="q-email">Work email</label>
          <input id="q-email" name="email" type="email" required autoComplete="email" placeholder="jane@company.com" />
        </div>
      </div>
      <div className="mk-form-row">
        <div className="mk-field">
          <label htmlFor="q-company">Company</label>
          <input id="q-company" name="company" autoComplete="organization" placeholder="Company name" />
        </div>
        <div className="mk-field">
          <label htmlFor="q-phone">
            Phone <em>(optional)</em>
          </label>
          <input id="q-phone" name="phone" type="tel" autoComplete="tel" placeholder="+91 98765 43210" />
        </div>
      </div>
      <div className="mk-form-row">
        <div className="mk-field">
          <label htmlFor="q-industry">Industry</label>
          <select id="q-industry" name="industry" defaultValue={initialIndustry}>
            <option value="">Select your industry</option>
            {INDUSTRIES.map((i) => (
              <option key={i.id} value={i.label}>
                {i.label}
              </option>
            ))}
            <option value="Other">Other</option>
          </select>
        </div>
        <div className="mk-field">
          <label htmlFor="q-team">Team size</label>
          <select id="q-team" name="teamSize" defaultValue="">
            <option value="">How many people?</option>
            <option>1–10</option>
            <option>11–50</option>
            <option>51–200</option>
            <option>200+</option>
          </select>
        </div>
      </div>
      <div className="mk-field">
        <label htmlFor="q-storage">How much data do you have?</label>
        <select id="q-storage" name="storage" defaultValue="">
          <option value="">Approximate storage needed</option>
          <option>Under 5 TB</option>
          <option>5–20 TB</option>
          <option>20–100 TB</option>
          <option>100 TB+</option>
          <option>Not sure</option>
        </select>
      </div>
      <div className="mk-field">
        <label htmlFor="q-message">
          What would you like SphereX to do? <em>(optional)</em>
        </label>
        <textarea
          id="q-message"
          name="message"
          placeholder="e.g. Search our contracts with AI, back up 30 laptops, and run a WhatsApp receptionist."
        />
      </div>
      {/* Honeypot — hidden from people, tempting for bots */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
        <label htmlFor="q-website">Website</label>
        <input id="q-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      {status === "mailto" && (
        <div className="mk-alert mk-alert-ok" role="status">
          <CheckCircle2 size={20} />
          <div>
            Your email app should open with your request filled in — just press send. If it didn&apos;t open, email us at{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} style={{ textDecoration: "underline" }}>
              {CONTACT_EMAIL}
            </a>
            .
          </div>
        </div>
      )}
      {status === "error" && (
        <div className="mk-alert mk-alert-err" role="alert">
          <AlertCircle size={20} />
          <div>{error}</div>
        </div>
      )}

      <div className="mk-form-foot">
        <span id="quote-help">No commitment. We never share your details.</span>
        <button type="submit" className="mk-btn mk-btn-primary mk-btn-lg" disabled={status === "sending"} id="quote-submit">
          {status === "sending" ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Sending…
            </>
          ) : (
            <>
              Request a quote <ArrowRight size={18} className="mk-arrow" />
            </>
          )}
        </button>
      </div>
    </form>
  );
}

function openMailto(data: Record<string, string>) {
  const lines = [
    `Name: ${data.name ?? ""}`,
    `Email: ${data.email ?? ""}`,
    data.company && `Company: ${data.company}`,
    data.phone && `Phone: ${data.phone}`,
    data.industry && `Industry: ${data.industry}`,
    data.teamSize && `Team size: ${data.teamSize}`,
    data.storage && `Storage needed: ${data.storage}`,
    data.message && `\n${data.message}`,
  ].filter(Boolean);
  const subject = `SphereX quote request — ${data.company || data.name || "website"}`;
  window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
}

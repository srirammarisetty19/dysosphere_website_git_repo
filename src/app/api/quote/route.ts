// ============================================================================
// POST /api/quote — website "Request a quote" form.
//
// Delivery: if RESEND_API_KEY is set, the enquiry is emailed (via Resend's
// REST API, no extra dependency) to QUOTE_TO_EMAIL (default
// contact@dysosphere.ai). If email isn't configured, responds 503 with
// { fallback: "mailto" } and the client opens a pre-filled email instead,
// so no enquiry is ever silently lost.
//
// Env:
//   RESEND_API_KEY     — enables email delivery
//   QUOTE_TO_EMAIL     — recipient (default contact@dysosphere.ai)
//   QUOTE_FROM_EMAIL   — verified sender (default "SphereX Website <website@dysosphere.ai>")
// ============================================================================

import { NextResponse } from "next/server";

type QuotePayload = {
  name?: string;
  email?: string;
  company?: string;
  phone?: string;
  industry?: string;
  teamSize?: string;
  storage?: string;
  message?: string;
  website?: string; // honeypot
};

const MAX = 2000;
const clean = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export async function POST(request: Request) {
  let body: QuotePayload;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Bots fill hidden fields; pretend success so they don't retry.
  if (clean(body.website)) return NextResponse.json({ ok: true });

  const data = {
    name: clean(body.name),
    email: clean(body.email),
    company: clean(body.company),
    phone: clean(body.phone, 40),
    industry: clean(body.industry, 60),
    teamSize: clean(body.teamSize, 40),
    storage: clean(body.storage, 40),
    message: clean(body.message, MAX),
  };

  if (!data.name || !data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    return NextResponse.json({ error: "Please provide your name and a valid email." }, { status: 422 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.info("[quote] Email delivery not configured; client will fall back to mailto.", {
      company: data.company,
      industry: data.industry,
    });
    return NextResponse.json({ fallback: "mailto" }, { status: 503 });
  }

  const rows: [string, string][] = [
    ["Name", data.name],
    ["Email", data.email],
    ["Company", data.company],
    ["Phone", data.phone],
    ["Industry", data.industry],
    ["Team size", data.teamSize],
    ["Storage needed", data.storage],
    ["Message", data.message],
  ];
  const html = `<h2>New SphereX quote request</h2><table cellpadding="6">${rows
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr><td><strong>${k}</strong></td><td>${escapeHtml(v).replace(/\n/g, "<br>")}</td></tr>`)
    .join("")}</table>`;
  const text = rows
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.QUOTE_FROM_EMAIL || "SphereX Website <website@dysosphere.ai>",
        to: [process.env.QUOTE_TO_EMAIL || "contact@dysosphere.ai"],
        reply_to: data.email,
        subject: `Quote request — ${data.company || data.name}`,
        html,
        text,
      }),
    });
    if (!res.ok) {
      console.error("[quote] Resend error", res.status, await res.text());
      return NextResponse.json({ fallback: "mailto" }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[quote] Delivery failed", err);
    return NextResponse.json({ fallback: "mailto" }, { status: 502 });
  }
}

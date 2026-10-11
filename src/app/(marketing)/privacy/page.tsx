// ============================================================================
// /privacy — website privacy policy
// ============================================================================

import type { Metadata } from "next";
import { CONTACT_EMAIL } from "@/components/marketing/site";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "How DysoSphere handles information collected through dysosphere.ai.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <section className="mk-page-hero">
      <div className="mk-container">
        <p className="mk-eyebrow">Legal</p>
        <h1 className="mk-h1" style={{ fontSize: "clamp(2.2rem, 4vw, 3.2rem)" }}>
          Privacy policy
        </h1>
        <p className="mk-dim" style={{ marginTop: 12 }}>
          Last updated: October 2026
        </p>
        <div className="mk-prose" style={{ marginTop: 32 }}>
          <p>
            Privacy is the reason DysoSphere exists, so we keep this simple. This policy explains what information we
            collect through this website (dysosphere.ai) and how we use it. It does not cover data stored on a SphereX
            device — that data stays on your hardware and is never sent to us.
          </p>

          <h2>What we collect</h2>
          <ul>
            <li>
              <strong>Information you send us</strong> — when you request a quote or email us, we receive the details you
              provide, such as your name, email, company, phone number and message.
            </li>
            <li>
              <strong>Basic technical logs</strong> — our servers may keep standard request logs (such as IP address and
              browser type) for security and troubleshooting.
            </li>
          </ul>
          <p>We do not use advertising trackers, and we do not sell or rent your information to anyone.</p>

          <h2>How we use it</h2>
          <ul>
            <li>To reply to your enquiry and prepare a quote</li>
            <li>To provide support if you become a customer</li>
            <li>To keep the website secure and working properly</li>
          </ul>

          <h2>Sharing</h2>
          <p>
            We only share information with service providers that help us operate (for example, our email provider), and
            only as needed to deliver that service — or when required by law.
          </p>

          <h2>Retention</h2>
          <p>We keep enquiry information only as long as needed to respond and maintain our business relationship.</p>

          <h2>Your choices</h2>
          <p>
            You can ask us to access, correct or delete the information you&apos;ve sent us at any time by emailing{" "}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </p>

          <h2>Contact</h2>
          <p>
            Questions about this policy? Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </p>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// /terms — website terms of use
// ============================================================================

import type { Metadata } from "next";
import { CONTACT_EMAIL } from "@/components/marketing/site";

export const metadata: Metadata = {
  title: "Terms of use",
  description: "Terms governing use of the dysosphere.ai website.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <section className="mk-page-hero">
      <div className="mk-container">
        <p className="mk-eyebrow">Legal</p>
        <h1 className="mk-h1" style={{ fontSize: "clamp(2.2rem, 4vw, 3.2rem)" }}>
          Terms of use
        </h1>
        <p className="mk-dim" style={{ marginTop: 12 }}>
          Last updated: October 2026
        </p>
        <div className="mk-prose" style={{ marginTop: 32 }}>
          <p>
            These terms apply to your use of the dysosphere.ai website. Purchases of SphereX hardware and related services
            are governed by the separate agreement provided with your quote.
          </p>

          <h2>Using this website</h2>
          <p>
            You may browse this website and use its content for information about DysoSphere and SphereX. Please don&apos;t
            misuse the site — for example, by attempting to disrupt it or gain unauthorised access.
          </p>

          <h2>Information on this site</h2>
          <p>
            We work to keep product information accurate, but features, specifications and availability may change.
            Example conversations and figures shown on the site are illustrative. Product images are representative.
          </p>

          <h2>Intellectual property</h2>
          <p>
            The DysoSphere and SphereX names, logos and website content belong to DysoSphere. Third-party names (such as
            AI model names) belong to their respective owners and are used for identification only.
          </p>

          <h2>Liability</h2>
          <p>
            This website is provided &quot;as is&quot;. To the extent permitted by law, DysoSphere is not liable for losses
            arising from use of the website.
          </p>

          <h2>Contact</h2>
          <p>
            Questions about these terms? Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </p>
        </div>
      </div>
    </section>
  );
}

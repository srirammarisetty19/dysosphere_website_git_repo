// ============================================================================
// (marketing) layout — public website (/, /product, /solutions, /security,
// /about, /contact, legal). The SphereX web app lives in other route groups.
// ============================================================================

import type { Metadata, Viewport } from "next";
import { Inter_Tight } from "next/font/google";
import { SiteNav } from "@/components/marketing/site-nav";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SITE_URL } from "@/components/marketing/site";
import "./marketing.css";

const display = Inter_Tight({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "SphereX — Private AI for your business, on your own hardware | DysoSphere",
    template: "%s | DysoSphere SphereX",
  },
  description:
    "SphereX is an AI server and secure storage in one device. Chat with your files, automate work with AI agents and keep every byte on your own network. HIPAA-ready, no token fees.",
  applicationName: "DysoSphere SphereX",
  keywords: [
    "private AI",
    "on-premise AI",
    "local LLM server",
    "AI NAS",
    "HIPAA-ready AI",
    "AI for small business",
    "secure document AI",
  ],
  openGraph: {
    type: "website",
    siteName: "DysoSphere",
    url: SITE_URL,
    images: [{ url: "/images/spherex-device.png", width: 1024, height: 1024, alt: "SphereX private AI device" }],
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#07080b",
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`mk ${display.variable}`}>
      <a href="#main" className="sr-only focus:not-sr-only">
        Skip to content
      </a>
      <SiteNav />
      <main id="main">{children}</main>
      <SiteFooter />
    </div>
  );
}

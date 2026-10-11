// ============================================================================
// Marketing site constants — single source of truth for nav, contacts, etc.
// ============================================================================

export const SITE_URL = "https://dysosphere.ai";

export const CONTACT_EMAIL = "contact@dysosphere.ai";

export const FOUNDERS = [
  { name: "Akash P", initials: "AP", role: "Co-Founder", email: "akash.pahariya@dysosphere.ai" },
  { name: "Mayank S", initials: "MS", role: "Co-Founder", email: "mayank.sensharma@dysosphere.ai" },
  { name: "Sriram M", initials: "SM", role: "Co-Founder", email: "sriram.marisetty@dysosphere.ai" },
] as const;

export const NAV_LINKS = [
  { href: "/product", label: "Product" },
  { href: "/solutions", label: "Solutions" },
  { href: "/security", label: "Security" },
  { href: "/about", label: "About" },
] as const;

export const QUOTE_HREF = "/contact#quote";

export const INDUSTRIES = [
  { id: "healthcare", label: "Healthcare & clinics" },
  { id: "legal", label: "Legal & law firms" },
  { id: "corporate", label: "Corporate & HR" },
  { id: "retail", label: "Retail & shops" },
  { id: "education", label: "Education" },
  { id: "manufacturing", label: "Manufacturing" },
] as const;

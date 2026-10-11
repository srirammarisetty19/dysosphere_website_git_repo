import type { MetadataRoute } from "next";
import { SITE_URL } from "@/components/marketing/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Keep the signed-in web app out of search results
      disallow: ["/api/", "/chat", "/nas", "/settings", "/skills", "/artifacts", "/calendar", "/reminders", "/login", "/register"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}

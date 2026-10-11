import type { NextConfig } from "next";

const AI_SERVER_URL = process.env.AI_SERVER_URL || "http://127.0.0.1:8001";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // Live browser view WebSocket (BFF/dev mode). Route Handlers can't hold
      // WebSockets, so proxy the upgrade straight to the AI server.
      {
        source: "/api/ai/ws/browser/:path*",
        destination: `${AI_SERVER_URL}/ws/browser/:path*`,
      },
    ];
  },
  // The marketing site used to be static HTML in /public. It now lives in
  // src/app/(marketing). Keep old URLs working for bookmarks and search engines.
  async redirects() {
    return [
      { source: "/index.html", destination: "/", permanent: true },
      { source: "/about.html", destination: "/about", permanent: true },
      { source: "/contact.html", destination: "/contact", permanent: true },
      { source: "/product.html", destination: "/product", permanent: true },
      { source: "/solutions.html", destination: "/solutions", permanent: true },
    ];
  },
};

export default nextConfig;

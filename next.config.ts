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
      {
        source: "/",
        destination: "/index.html",
      },
      {
        source: "/about",
        destination: "/about.html",
      },
      {
        source: "/contact",
        destination: "/contact.html",
      },
      {
        source: "/product",
        destination: "/product.html",
      },
      {
        source: "/solutions",
        destination: "/solutions.html",
      },
    ];
  },
};

export default nextConfig;

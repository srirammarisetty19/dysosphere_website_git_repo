import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
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

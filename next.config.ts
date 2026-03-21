import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/webp", "image/avif"],
    deviceSizes: [640, 750, 828, 1080, 1280],
    imageSizes: [64, 128, 256, 384],
    remotePatterns: [
      {
        // Cloudflare R2 — custom domain (media.nemovizor.cz)
        protocol: "https",
        hostname: "media.nemovizor.cz",
        pathname: "/**",
      },
      {
        // Cloudflare R2 — fallback (přímý R2 endpoint)
        protocol: "https",
        hostname: "*.r2.cloudflarestorage.com",
        pathname: "/**",
      },
      {
        // Cloudflare R2 — public dev endpoint
        protocol: "https",
        hostname: "*.r2.dev",
        pathname: "/**",
      },
      {
        // Supabase Storage (fallback pro starší data)
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/**",
      },
      {
        // Realitní portály (scraped listings)
        protocol: "https",
        hostname: "*.rmcl.cz",
        pathname: "/**",
      },
      {
        // Sreality a jiné portály
        protocol: "https",
        hostname: "*.sreality.cz",
        pathname: "/**",
      },
      {
        // Bezrealitky
        protocol: "https",
        hostname: "*.bezrealitky.cz",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
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
        // Supabase Storage (fallback pro starší data)
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/**",
      },
    ],
  },
};

export default nextConfig;

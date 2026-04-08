import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nemovizor API · Developers",
  description:
    "Headless real-estate platform with 72 655 active listings, AI search, webhooks and an MCP server. Build CRM mirrors, mobile apps, AI agents and white-label portals on top of the Nemovizor public API.",
  openGraph: {
    title: "Nemovizor API · Developers",
    description:
      "Build real-estate apps on top of 72 655 active listings. REST API, webhooks, AI search, MCP server.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function DevelopersLayout({ children }: { children: React.ReactNode }) {
  return children;
}

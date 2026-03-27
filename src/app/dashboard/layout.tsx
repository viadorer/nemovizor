"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { SiteHeader } from "@/components/site-header";
import { useAuth } from "@/components/auth-provider";
import { useT } from "@/i18n/provider";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import type { ReactNode } from "react";

type SidebarItem = {
  href: string;
  label: string;
  icon: ReactNode;
};

// Icons defined outside — they don't need translations
const ICONS = {
  overview: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  ),
  favorites: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  ),
  savedSearches: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  ),
  recentlyViewed: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  history: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  notifications: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
  settings: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  myListings: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  structure: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="2" width="16" height="6" rx="1" />
      <rect x="1" y="16" width="10" height="6" rx="1" />
      <rect x="13" y="16" width="10" height="6" rx="1" />
      <path d="M12 8v4" />
      <path d="M6 12h12" />
      <path d="M6 12v4" />
      <path d="M18 12v4" />
    </svg>
  ),
  messages: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  analytics: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 20V10" />
      <path d="M12 20V4" />
      <path d="M6 20v-6" />
    </svg>
  ),
  properties: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  projects: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
    </svg>
  ),
  brokers: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  agencies: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01" />
      <path d="M16 6h.01" />
      <path d="M8 10h.01" />
      <path d="M16 10h.01" />
      <path d="M8 14h.01" />
      <path d="M16 14h.01" />
    </svg>
  ),
  users: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  scraper: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  ),
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const t = useT();
  const [role, setRole] = useState<string>("user");

  useEffect(() => {
    if (!user) return;
    const supabase = getBrowserSupabase();
    if (!supabase) return;

    supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.role) setRole(data.role);
      });
  }, [user]);

  const userItems: SidebarItem[] = useMemo(() => [
    { href: "/dashboard", label: t.dashboard.overview, icon: ICONS.overview },
    { href: "/dashboard/oblibene", label: t.dashboard.favorites, icon: ICONS.favorites },
    { href: "/dashboard/prohlizene", label: t.dashboard.recentlyViewed, icon: ICONS.recentlyViewed },
    { href: "/dashboard/hledani", label: t.dashboard.savedSearches, icon: ICONS.savedSearches },
    { href: "/dashboard/historie", label: t.dashboard.history, icon: ICONS.history },
    { href: "/dashboard/upozorneni", label: t.dashboard.notifications, icon: ICONS.notifications },
    { href: "/dashboard/nastaveni", label: t.dashboard.settings, icon: ICONS.settings },
  ], [t]);

  const brokerItems: SidebarItem[] = useMemo(() => [
    { href: "/dashboard/moje-inzeraty", label: t.dashboard.myListings, icon: ICONS.myListings },
    { href: "/dashboard/moje-struktura", label: t.dashboard.myStructure, icon: ICONS.structure },
    { href: "/dashboard/poptavky", label: t.dashboard.inquiries, icon: ICONS.messages },
    { href: "/dashboard/moje-analytika", label: t.dashboard.analytics, icon: ICONS.analytics },
    { href: "/dashboard/penezenka", label: "Peněženka", icon: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>) },
  ], [t]);

  const adminItems: SidebarItem[] = useMemo(() => [
    { href: "/dashboard/sprava/nemovitosti", label: t.dashboard.adminListings, icon: ICONS.properties },
    { href: "/dashboard/sprava/projekty", label: t.dashboard.projects, icon: ICONS.projects },
    { href: "/dashboard/sprava/makleri", label: t.dashboard.adminBrokers, icon: ICONS.brokers },
    { href: "/dashboard/sprava/kancelare", label: t.dashboard.adminAgencies, icon: ICONS.agencies },
    { href: "/dashboard/sprava/uzivatele", label: t.dashboard.adminUsers, icon: ICONS.users },
    { href: "/dashboard/sprava/analytika", label: t.dashboard.analytics, icon: ICONS.analytics },
    { href: "/dashboard/sprava/scraper", label: t.dashboard.scraper, icon: ICONS.scraper },
    { href: "/dashboard/sprava/penezenky", label: "Peněženky", icon: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>) },
    { href: "/dashboard/sprava/cenik", label: "Ceník služeb", icon: (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>) },
  ], [t]);

  const items = [
    ...userItems,
    ...(role === "broker" || role === "admin" ? [{ divider: true as const, label: t.dashboard.brokerSection }] : []),
    ...(role === "broker" || role === "admin" ? brokerItems : []),
    ...(role === "admin" ? [{ divider: true as const, label: t.dashboard.adminSection }] : []),
    ...(role === "admin" ? adminItems : []),
  ];

  return (
    <div className="page-shell">
      <SiteHeader />
      <div className="dashboard-layout">
        <aside className="dashboard-sidebar">
          <nav className="dashboard-nav">
            {items.map((item, i) => {
              if ("divider" in item) {
                return (
                  <div key={`divider-${i}`} className="dashboard-nav-divider">
                    <span>{item.label}</span>
                  </div>
                );
              }
              const isActive =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`dashboard-nav-item ${isActive ? "dashboard-nav-item--active" : ""}`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="dashboard-content">{children}</main>
      </div>
    </div>
  );
}

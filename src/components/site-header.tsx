"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme-provider";

const navItems = [
  {
    href: "/nabidky",
    label: "Nabídky",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
    ),
  },
  {
    href: "/specialiste",
    label: "Specialisté",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    href: "/oceneni",
    label: "Ocenění",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="4" y="2" width="16" height="20" rx="2" />
        <path d="M8 6h8" />
        <path d="M8 10h8" />
        <path d="M8 14h4" />
      </svg>
    ),
  },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // Body scroll lock
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <>
      <header className="site-header">
        <div className="navbar">
          <div className="logo-container">
            <Link href="/">
              <img src="/branding/nemovizor_logo.png" alt="Nemovizor Logo" className="logo" />
            </Link>
          </div>
          <nav className="navbar-desktop-nav">
            <ul>
              {navItems.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className={pathname === item.href ? "active" : undefined}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="navbar-right">
            <ThemeToggle />
            <button className="login-btn" type="button">
              Přihlásit
            </button>
          </div>

          {/* Hamburger — pouze mobil */}
          <button
            className="hamburger-btn"
            onClick={() => setMenuOpen(true)}
            aria-label="Otevřít menu"
            type="button"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 6h18" />
              <path d="M3 12h18" />
              <path d="M3 18h18" />
            </svg>
          </button>
        </div>
      </header>

      {/* Mobilní fullscreen menu overlay */}
      <div className={`mobile-menu-overlay ${menuOpen ? "mobile-menu-overlay--open" : ""}`}>
        <div className="mobile-menu-header">
          <Link href="/" onClick={() => setMenuOpen(false)}>
            <img src="/branding/nemovizor_logo.png" alt="Nemovizor Logo" className="logo" />
          </Link>
          <button
            className="mobile-menu-close"
            onClick={() => setMenuOpen(false)}
            aria-label="Zavřít menu"
            type="button"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18" />
              <path d="M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="mobile-menu-nav">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`mobile-menu-link ${pathname === item.href ? "mobile-menu-link--active" : ""}`}
              onClick={() => setMenuOpen(false)}
            >
              <span className="mobile-menu-link-icon">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mobile-menu-divider" />

        <div className="mobile-menu-footer">
          <div className="mobile-menu-theme">
            <ThemeToggle />
            <span>Přepnout režim</span>
          </div>
          <button className="mobile-menu-login" type="button">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            Přihlásit
          </button>
        </div>
      </div>
    </>
  );
}

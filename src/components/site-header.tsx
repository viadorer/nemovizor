"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme-provider";

const navItems = [
  { href: "/nabidky", label: "Nabídky" },
  { href: "/specialiste", label: "Specialisté" },
  { href: "/oceneni", label: "Ocenění" },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="site-header">
      <div className="navbar">
        <div className="logo-container">
          <Link href="/">
            <img src="/branding/nemovizor_logo.png" alt="Nemovizor Logo" className="logo" />
          </Link>
        </div>
        <nav>
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
      </div>
    </header>
  );
}

import type { ReactNode } from "react";
import { brand } from "@/brands";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-layout">
      <div className="auth-card">
        <a href="/" className="auth-logo">
          <img src="/branding/nemovizor_logo.png" alt={brand.name} />
        </a>
        {children}
      </div>
    </div>
  );
}

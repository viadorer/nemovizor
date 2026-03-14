import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-layout">
      <div className="auth-card">
        <a href="/" className="auth-logo">
          <img src="/branding/nemovizor_logo.png" alt="Nemovizor" />
        </a>
        {children}
      </div>
    </div>
  );
}

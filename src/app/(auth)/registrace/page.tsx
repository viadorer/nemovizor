"use client";

import { useState } from "react";
import Link from "next/link";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import { useT } from "@/i18n/provider";

export default function RegisterPage() {
  const t = useT();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const supabase = getBrowserSupabase();

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;

    if (password !== passwordConfirm) {
      setError(t.auth.passwordMismatch);
      return;
    }

    setError("");
    setLoading(true);

    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setLoading(false);

    if (err) {
      setError(err.message);
      return;
    }

    setSuccess(true);
  }

  async function handleGoogleLogin() {
    if (!supabase) return;
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (err) setError(err.message);
  }

  if (success) {
    return (
      <>
        <h1 className="auth-title">{t.auth.emailVerificationTitle}</h1>
        <div className="auth-success">
          {t.auth.emailVerificationMessage.replace("{email}", email)}
        </div>
        <p className="auth-switch">
          <Link href="/prihlaseni">{t.auth.backToLogin}</Link>
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="auth-title">{t.auth.registerTitle}</h1>

      {error && <div className="auth-error">{error}</div>}

      <form onSubmit={handleRegister} className="auth-form">
        <label className="auth-label">
          {t.auth.name}
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="auth-input"
            required
            autoComplete="name"
          />
        </label>

        <label className="auth-label">
          {t.auth.email}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="auth-input"
            required
            autoComplete="email"
          />
        </label>

        <label className="auth-label">
          {t.auth.password}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="auth-input"
            required
            autoComplete="new-password"
            minLength={6}
          />
        </label>

        <label className="auth-label">
          {t.auth.confirmPassword}
          <input
            type="password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            className="auth-input"
            required
            autoComplete="new-password"
            minLength={6}
          />
        </label>

        <button type="submit" className="auth-submit" disabled={loading}>
          {loading ? t.common.loading : t.auth.registerButton}
        </button>
      </form>

      <div className="auth-divider">
        <span>{t.auth.orContinueWith}</span>
      </div>

      <button
        type="button"
        className="auth-google"
        onClick={handleGoogleLogin}
        disabled={loading}
      >
        <svg width="20" height="20" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        {t.auth.registerViaGoogle}
      </button>

      <p className="auth-switch">
        {t.auth.hasAccount} <Link href="/prihlaseni">{t.nav.login}</Link>
      </p>
    </>
  );
}

"use client";

import { useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import Link from "next/link";
import { useT } from "@/i18n/provider";
import { brand } from "@/brands";
import "./prodat.css";

export default function ProdatPage() {
  const t = useT();

  const PROPERTY_TYPES = [
    { value: "byt", label: t.sell.typeApartment },
    { value: "dum", label: t.sell.typeHouse },
    { value: "pozemek", label: t.sell.typeLand },
    { value: "komercni", label: t.sell.typeCommercial },
    { value: "jine", label: t.sell.typeOther },
  ];

  const INTENT = [
    { value: "prodat", label: t.sell.intentSell },
    { value: "pronajmout", label: t.sell.intentRent },
    { value: "odhad", label: t.sell.intentEstimate },
  ];

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    propertyType: "",
    intent: "",
    address: "",
    note: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, source: "prodat-page", created_at: new Date().toISOString() }),
      });
    } catch {
      // still show success
    }
    setSending(false);
    setSubmitted(true);
  };

  const update = (field: string, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  return (
    <div className="page-shell">
      <SiteHeader />
      <main>
        <section className="sell-hero">
          <div className="container">
            <div className="sell-hero-grid">
              <div className="sell-hero-text">
                <h1>{t.sell.heroTitle}</h1>
                <p className="sell-hero-sub">
                  {t.sell.heroSubtitle}
                </p>
                <div className="sell-hero-stats">
                  <div className="sell-hero-stat">
                    <span className="sell-hero-stat-value">{t.sell.statBuyers}</span>
                    <span className="sell-hero-stat-label">{t.sell.statBuyersLabel}</span>
                  </div>
                  <div className="sell-hero-stat">
                    <span className="sell-hero-stat-value">{t.sell.statEstimate}</span>
                    <span className="sell-hero-stat-label">{t.sell.statEstimateLabel}</span>
                  </div>
                  <div className="sell-hero-stat">
                    <span className="sell-hero-stat-value">{t.sell.statFree}</span>
                    <span className="sell-hero-stat-label">{t.sell.statFreeLabel}</span>
                  </div>
                </div>
                <a href="#formular" className="sell-hero-cta">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                  {t.sell.heroCta}
                </a>
              </div>
              <div className="sell-hero-visual">
                <div className="sell-value-card">
                  <div className="sell-value-label">{t.sell.valueCardLabel}</div>
                  <div className="sell-value-price">?</div>
                  <div className="sell-value-sub">{t.sell.valueCardSub}</div>
                  <a href="#formular" className="sell-value-btn">{t.sell.valueCardBtn}</a>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="sell-steps">
          <div className="container">
            <h2 className="sell-section-title">{t.sell.howItWorks}</h2>
            <div className="sell-steps-grid">
              <div className="sell-step">
                <span className="sell-step-num">1</span>
                <h3>{t.sell.step1Sell}</h3>
                <p>{t.sell.step1SellDesc}</p>
              </div>
              <div className="sell-step">
                <span className="sell-step-num">2</span>
                <h3>{t.sell.step2Sell}</h3>
                <p>{t.sell.step2SellDesc}</p>
              </div>
              <div className="sell-step">
                <span className="sell-step-num">3</span>
                <h3>{t.sell.step3Sell}</h3>
                <p>{t.sell.step3SellDesc}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="sell-benefits">
          <div className="container">
            <h2 className="sell-section-title">{t.sell.whySellTitle}</h2>
            <div className="sell-benefits-grid">
              <div className="sell-benefit">
                <div className="sell-benefit-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                </div>
                <h3>{t.sell.benefit1Title}</h3>
                <p>{t.sell.benefit1Desc}</p>
              </div>
              <div className="sell-benefit">
                <div className="sell-benefit-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </div>
                <h3>{t.sell.benefit2Title}</h3>
                <p>{t.sell.benefit2Desc}</p>
              </div>
              <div className="sell-benefit">
                <div className="sell-benefit-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                </div>
                <h3>{t.sell.benefit3Title}</h3>
                <p>{t.sell.benefit3Desc}</p>
              </div>
              <div className="sell-benefit">
                <div className="sell-benefit-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </div>
                <h3>{t.sell.benefit4Title}</h3>
                <p>{t.sell.benefit4Desc}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="sell-form-section" id="formular">
          <div className="container">
            <div className="sell-form-wrapper">
              <div className="sell-form-info">
                <h2>{t.sell.formTitle}</h2>
                <p>{t.sell.formSubtitle}</p>
                <ul className="sell-form-checklist">
                  <li>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                    {t.sell.checkEstimate}
                  </li>
                  <li>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                    {t.sell.checkFree}
                  </li>
                  <li>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                    {t.sell.checkRealData}
                  </li>
                  <li>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                    {t.sell.checkNoObligation}
                  </li>
                </ul>
              </div>

              {submitted ? (
                <div className="sell-form-success">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  <h3>{t.sell.successTitle}</h3>
                  <p>{t.sell.successMessage}</p>
                  <Link href="/" className="sell-form-back">{t.sell.successBackHome}</Link>
                </div>
              ) : (
                <form className="sell-form" onSubmit={handleSubmit}>
                  <div className="sell-form-row">
                    <label>
                      <span>{t.sell.nameLabel}</span>
                      <input type="text" required value={form.name} onChange={(e) => update("name", e.target.value)} placeholder={t.sell.namePlaceholder} />
                    </label>
                  </div>
                  <div className="sell-form-row sell-form-row--half">
                    <label>
                      <span>{t.sell.emailLabel}</span>
                      <input type="email" required value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="jan@email.cz" />
                    </label>
                    <label>
                      <span>{t.sell.phoneLabelShort}</span>
                      <input type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="+420 ..." />
                    </label>
                  </div>
                  <div className="sell-form-row sell-form-row--half">
                    <label>
                      <span>{t.sell.propertyTypeLabel}</span>
                      <select required value={form.propertyType} onChange={(e) => update("propertyType", e.target.value)}>
                        <option value="">{t.sell.selectPlaceholder}</option>
                        {PROPERTY_TYPES.map((pt) => (
                          <option key={pt.value} value={pt.value}>{pt.label}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>{t.sell.intentLabel}</span>
                      <select value={form.intent} onChange={(e) => update("intent", e.target.value)}>
                        <option value="">{t.sell.selectPlaceholder}</option>
                        {INTENT.map((it) => (
                          <option key={it.value} value={it.value}>{it.label}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="sell-form-row">
                    <label>
                      <span>{t.sell.addressLabel}</span>
                      <input type="text" value={form.address} onChange={(e) => update("address", e.target.value)} placeholder={t.sell.addressPlaceholder} />
                    </label>
                  </div>
                  <div className="sell-form-row">
                    <label>
                      <span>{t.sell.noteLabel}</span>
                      <textarea rows={3} value={form.note} onChange={(e) => update("note", e.target.value)} placeholder={t.sell.notePlaceholder} />
                    </label>
                  </div>
                  <button type="submit" className="sell-form-submit" disabled={sending}>
                    {sending ? t.sell.sending : t.sell.submitFree}
                  </button>
                  <p className="sell-form-disclaimer">
                    {t.sell.formDisclaimer}
                  </p>
                </form>
              )}
            </div>
          </div>
        </section>

        <section className="sell-faq">
          <div className="container">
            <h2 className="sell-section-title">{t.sell.faq.title}</h2>
            <div className="sell-faq-list">
              {t.sell.faq.items.map((item, i) => (
                <details key={i} className="sell-faq-item">
                  <summary>{item.question}</summary>
                  <p>{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

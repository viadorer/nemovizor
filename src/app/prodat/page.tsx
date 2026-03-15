"use client";

import { useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import Link from "next/link";
import "./prodat.css";

const PROPERTY_TYPES = [
  { value: "byt", label: "Byt" },
  { value: "dum", label: "D\u016fm" },
  { value: "pozemek", label: "Pozemek" },
  { value: "komercni", label: "Komer\u010dn\u00ed objekt" },
  { value: "jine", label: "Jin\u00e9" },
];

const INTENT = [
  { value: "prodat", label: "Chci prodat" },
  { value: "pronajmout", label: "Chci pronajmout" },
  { value: "odhad", label: "Chci jen odhad ceny" },
];

export default function ProdatPage() {
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
                <h1>{"Prodejte nebo pronajm\u011bte nemovitost rychleji a za lep\u0161\u00ed cenu"}</h1>
                <p className="sell-hero-sub">
                  {"Z\u00edskejte profesion\u00e1ln\u00ed odhad tr\u017en\u00ed hodnoty zdarma. Va\u0161i nab\u00eddku uvid\u00ed tis\u00edce aktivn\u00edch z\u00e1jemc\u016f, kte\u0159\u00ed pr\u00e1v\u011b te\u010f hledaj\u00ed nemovitost."}
                </p>
                <div className="sell-hero-stats">
                  <div className="sell-hero-stat">
                    <span className="sell-hero-stat-value">9 500+</span>
                    <span className="sell-hero-stat-label">{"aktivn\u00edch z\u00e1jemc\u016f"}</span>
                  </div>
                  <div className="sell-hero-stat">
                    <span className="sell-hero-stat-value">24h</span>
                    <span className="sell-hero-stat-label">odhad ceny zdarma</span>
                  </div>
                  <div className="sell-hero-stat">
                    <span className="sell-hero-stat-value">{"0 K\u010d"}</span>
                    <span className="sell-hero-stat-label">{"bez z\u00e1vazk\u016f"}</span>
                  </div>
                </div>
                <a href="#formular" className="sell-hero-cta">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                  Chci odhad zdarma
                </a>
              </div>
              <div className="sell-hero-visual">
                <div className="sell-value-card">
                  <div className="sell-value-label">{"Odhadovan\u00e1 cena va\u0161\u00ed nemovitosti"}</div>
                  <div className="sell-value-price">?</div>
                  <div className="sell-value-sub">{"Zjist\u00edte do 24 hodin zdarma"}</div>
                  <a href="#formular" className="sell-value-btn">Zjistit cenu</a>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="sell-steps">
          <div className="container">
            <h2 className="sell-section-title">Jak to funguje</h2>
            <div className="sell-steps-grid">
              <div className="sell-step">
                <span className="sell-step-num">1</span>
                <h3>{"Vypl\u0148te formul\u00e1\u0159"}</h3>
                <p>{"Zadejte z\u00e1kladn\u00ed \u00fadaje o nemovitosti. Zabere to 2 minuty."}</p>
              </div>
              <div className="sell-step">
                <span className="sell-step-num">2</span>
                <h3>{"Z\u00edsk\u00e1te odhad ceny"}</h3>
                <p>{"Do 24 hodin v\u00e1m za\u0161leme profesion\u00e1ln\u00ed odhad tr\u017en\u00ed hodnoty. Zcela zdarma."}</p>
              </div>
              <div className="sell-step">
                <span className="sell-step-num">3</span>
                <h3>{"Vyberete si \u0159e\u0161en\u00ed"}</h3>
                <p>{"Prodejte sami s na\u0161\u00ed podporou, nebo v\u00e1m najdeme ov\u011b\u0159en\u00e9ho specialistu ve va\u0161em regionu."}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="sell-benefits">
          <div className="container">
            <h2 className="sell-section-title">{"Pro\u010d prod\u00e1vat p\u0159es Nemovizor"}</h2>
            <div className="sell-benefits-grid">
              <div className="sell-benefit">
                <div className="sell-benefit-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                </div>
                <h3>{"Re\u00e1ln\u00fd odhad ceny"}</h3>
                <p>{"Na z\u00e1klad\u011b skute\u010dn\u00fdch prodejn\u00edch dat z va\u0161eho okol\u00ed. \u017d\u00e1dn\u00fd odhad od oka \u2014 v\u00edme, za kolik se nemovitosti re\u00e1ln\u011b prod\u00e1vaj\u00ed."}</p>
              </div>
              <div className="sell-benefit">
                <div className="sell-benefit-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </div>
                <h3>{"Tis\u00edce aktivn\u00edch z\u00e1jemc\u016f"}</h3>
                <p>{"Va\u0161i nab\u00eddku uvid\u00ed lid\u00e9, kte\u0159\u00ed pr\u00e1v\u011b te\u010f aktivn\u011b hledaj\u00ed nemovitost. \u017d\u00e1dn\u00e9 \u010dek\u00e1n\u00ed na n\u00e1v\u0161t\u011bvn\u00edky."}</p>
              </div>
              <div className="sell-benefit">
                <div className="sell-benefit-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                </div>
                <h3>{"Ov\u011b\u0159en\u00ed specialist\u00e9"}</h3>
                <p>{"Spoj\u00edme v\u00e1s s makl\u00e9\u0159i, kte\u0159\u00ed maj\u00ed prokazateln\u00e9 v\u00fdsledky a recenze od klient\u016f ve va\u0161em m\u011bst\u011b."}</p>
              </div>
              <div className="sell-benefit">
                <div className="sell-benefit-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </div>
                <h3>{"Bez z\u00e1vazk\u016f a poplatk\u016f"}</h3>
                <p>{"Odhad je zdarma. Nikdo v\u00e1s nebude nutit k ni\u010demu. Rozhodnete se a\u017e budete m\u00edt v\u0161echny informace."}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="sell-form-section" id="formular">
          <div className="container">
            <div className="sell-form-wrapper">
              <div className="sell-form-info">
                <h2>{"Z\u00edskejte odhad ceny zdarma"}</h2>
                <p>{"Vypl\u0148te formul\u00e1\u0159 a do 24 hodin v\u00e1m za\u0161leme odhad tr\u017en\u00ed hodnoty va\u0161\u00ed nemovitosti. Zcela zdarma a bez z\u00e1vazk\u016f."}</p>
                <ul className="sell-form-checklist">
                  <li>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                    Odhad do 24 hodin
                  </li>
                  <li>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                    Zcela zdarma
                  </li>
                  <li>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                    {"Na z\u00e1klad\u011b re\u00e1ln\u00fdch prodejn\u00edch dat"}
                  </li>
                  <li>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                    {"Bez z\u00e1vazk\u016f \u2014 rozhodnete se sami"}
                  </li>
                </ul>
              </div>

              {submitted ? (
                <div className="sell-form-success">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  <h3>{"D\u011bkujeme!"}</h3>
                  <p>{"V\u00e1\u0161 po\u017eadavek jsme p\u0159ijali. Ozveme se v\u00e1m do 24 hodin s odhadem ceny."}</p>
                  <Link href="/" className="sell-form-back">{"Zp\u011bt na hlavn\u00ed str\u00e1nku"}</Link>
                </div>
              ) : (
                <form className="sell-form" onSubmit={handleSubmit}>
                  <div className="sell-form-row">
                    <label>
                      <span>{"Jm\u00e9no a p\u0159\u00edjmen\u00ed *"}</span>
                      <input type="text" required value={form.name} onChange={(e) => update("name", e.target.value)} placeholder={"Jan Nov\u00e1k"} />
                    </label>
                  </div>
                  <div className="sell-form-row sell-form-row--half">
                    <label>
                      <span>E-mail *</span>
                      <input type="email" required value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="jan@email.cz" />
                    </label>
                    <label>
                      <span>Telefon</span>
                      <input type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="+420 ..." />
                    </label>
                  </div>
                  <div className="sell-form-row sell-form-row--half">
                    <label>
                      <span>Typ nemovitosti *</span>
                      <select required value={form.propertyType} onChange={(e) => update("propertyType", e.target.value)}>
                        <option value="">Vyberte...</option>
                        {PROPERTY_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Co chcete?</span>
                      <select value={form.intent} onChange={(e) => update("intent", e.target.value)}>
                        <option value="">Vyberte...</option>
                        {INTENT.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="sell-form-row">
                    <label>
                      <span>Adresa nemovitosti</span>
                      <input type="text" value={form.address} onChange={(e) => update("address", e.target.value)} placeholder={"Ulice, m\u011bsto"} />
                    </label>
                  </div>
                  <div className="sell-form-row">
                    <label>
                      <span>{"Pozn\u00e1mka"}</span>
                      <textarea rows={3} value={form.note} onChange={(e) => update("note", e.target.value)} placeholder={"Cokoli dal\u0161\u00edho n\u00e1m chcete sd\u011blit..."} />
                    </label>
                  </div>
                  <button type="submit" className="sell-form-submit" disabled={sending}>
                    {sending ? "Odes\u00edl\u00e1m..." : "Odeslat a z\u00edskat odhad zdarma"}
                  </button>
                  <p className="sell-form-disclaimer">
                    {"Odesl\u00e1n\u00edm souhlas\u00edte se zpracov\u00e1n\u00edm osobn\u00edch \u00fadaj\u016f za \u00fa\u010delem kontaktov\u00e1n\u00ed. Va\u0161e data jsou v bezpe\u010d\u00ed."}
                  </p>
                </form>
              )}
            </div>
          </div>
        </section>

        <section className="sell-faq">
          <div className="container">
            <h2 className="sell-section-title">{"\u010cast\u00e9 dotazy"}</h2>
            <div className="sell-faq-list">
              <details className="sell-faq-item">
                <summary>{"Kolik stoj\u00ed odhad ceny?"}</summary>
                <p>{"Odhad ceny je zcela zdarma a bez z\u00e1vazk\u016f. Nemus\u00edte se k ni\u010demu zavazovat."}</p>
              </details>
              <details className="sell-faq-item">
                <summary>{"Jak dlouho trv\u00e1, ne\u017e dostanu odhad?"}</summary>
                <p>{"Odhad v\u00e1m za\u0161leme do 24 hodin od vypln\u011bn\u00ed formul\u00e1\u0159e. Ve v\u011bt\u0161in\u011b p\u0159\u00edpad\u016f je\u0161t\u011b tent\u00fd\u017e den."}</p>
              </details>
              <details className="sell-faq-item">
                <summary>{"Mus\u00edm pak prod\u00e1vat p\u0159es v\u00e1s?"}</summary>
                <p>{"Ne. Odhad je bez z\u00e1vazk\u016f. M\u016f\u017eete prodat sami, p\u0159es na\u0161eho specialistu, nebo t\u0159eba v\u016fbec neprodat. Je to zcela na v\u00e1s."}</p>
              </details>
              <details className="sell-faq-item">
                <summary>{"Jak stanovujete cenu?"}</summary>
                <p>{"Odhad vych\u00e1z\u00ed z re\u00e1ln\u00fdch prodejn\u00edch dat v na\u0161em syst\u00e9mu \u2014 analyzujeme ceny podobn\u00fdch nemovitost\u00ed ve va\u0161em okol\u00ed za posledn\u00edch 12 m\u011bs\u00edc\u016f."}</p>
              </details>
              <details className="sell-faq-item">
                <summary>{"Pom\u016f\u017eete mi i s pron\u00e1jmem?"}</summary>
                <p>{"Ano. A\u0165 chcete prodat nebo pronajmout, pom\u016f\u017eeme v\u00e1m s odhadem ceny i s nalezen\u00edm z\u00e1jemc\u016f."}</p>
              </details>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

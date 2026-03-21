"use client";

import { useState, useMemo } from "react";
import { useT } from "@/i18n/provider";

type MortgageCalculatorProps = {
  propertyPrice: number;
  priceCurrency?: string;
};

function fmtMortgage(n: number, currency: string): string {
  const cur = (currency || "czk").toUpperCase();
  const localeMap: Record<string, string> = { CZK: "cs-CZ", EUR: "de-DE", GBP: "en-GB", USD: "en-US" };
  const locale = localeMap[cur] ?? "cs-CZ";
  return new Intl.NumberFormat(locale, { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(n);
}

export function MortgageCalculator({ propertyPrice, priceCurrency }: MortgageCalculatorProps) {
  const t = useT();
  const [downPaymentPct, setDownPaymentPct] = useState(20);
  const [rate, setRate] = useState(4.0);
  const [years, setYears] = useState(30);

  const result = useMemo(() => {
    const downPayment = propertyPrice * (downPaymentPct / 100);
    const principal = propertyPrice - downPayment;
    if (principal <= 0) return { monthly: 0, principal: 0, totalPaid: 0, totalInterest: 0 };

    const monthlyRate = rate / 100 / 12;
    const n = years * 12;

    let monthly: number;
    if (monthlyRate === 0) {
      monthly = principal / n;
    } else {
      monthly = principal * (monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1);
    }

    const totalPaid = monthly * n;
    const totalInterest = totalPaid - principal;

    return { monthly, principal, totalPaid, totalInterest };
  }, [propertyPrice, downPaymentPct, rate, years]);

  const cur = priceCurrency || "czk";
  const fmt = (n: number) => fmtMortgage(Math.round(n), cur);

  return (
    <div className="detail-sidebar-card">
      <h3
        className="detail-section-title"
        style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted)" }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="4" y="2" width="16" height="20" rx="2" />
          <path d="M8 6h8M8 10h8M8 14h3M13 14h3M8 18h3M13 18h3" />
        </svg>
        {t.mortgage.title}
      </h3>

      <div className="mortgage-result-main">
        <span className="mortgage-result-label">{t.mortgage.monthlyPayment}</span>
        <span className="mortgage-result-value">{fmt(result.monthly)}</span>
      </div>

      <div className="mortgage-slider-group">
        <div className="mortgage-slider-header">
          <span>{t.mortgage.ownFunds}</span>
          <span className="mortgage-slider-value">{downPaymentPct} % ({fmt(propertyPrice * downPaymentPct / 100)})</span>
        </div>
        <input
          type="range"
          min={10}
          max={90}
          step={5}
          value={downPaymentPct}
          onChange={(e) => setDownPaymentPct(Number(e.target.value))}
          className="mortgage-slider"
        />
        <div className="mortgage-slider-range">
          <span>10 %</span>
          <span>90 %</span>
        </div>
      </div>

      <div className="mortgage-slider-group">
        <div className="mortgage-slider-header">
          <span>{t.mortgage.interestRate}</span>
          <span className="mortgage-slider-value">{rate.toFixed(1)} %</span>
        </div>
        <input
          type="range"
          min={2}
          max={7}
          step={0.1}
          value={rate}
          onChange={(e) => setRate(Number(e.target.value))}
          className="mortgage-slider"
        />
        <div className="mortgage-slider-range">
          <span>2 %</span>
          <span>7 %</span>
        </div>
      </div>

      <div className="mortgage-slider-group">
        <div className="mortgage-slider-header">
          <span>{t.mortgage.repaymentPeriod}</span>
          <span className="mortgage-slider-value">{years} {t.mortgage.yearsLabel}</span>
        </div>
        <input
          type="range"
          min={5}
          max={40}
          step={1}
          value={years}
          onChange={(e) => setYears(Number(e.target.value))}
          className="mortgage-slider"
        />
        <div className="mortgage-slider-range">
          <span>5 let</span>
          <span>40 let</span>
        </div>
      </div>

      <div className="mortgage-summary">
        <div className="mortgage-summary-row">
          <span>{t.mortgage.loanAmount}</span>
          <span>{fmt(result.principal)}</span>
        </div>
        <div className="mortgage-summary-row">
          <span>{t.mortgage.totalPaid}</span>
          <span>{fmt(result.totalPaid)}</span>
        </div>
        <div className="mortgage-summary-row mortgage-summary-row--interest">
          <span>{t.mortgage.ofWhichInterest}</span>
          <span>{fmt(result.totalInterest)}</span>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export default function ValuationReportPage() {
  const searchParams = useSearchParams();
  const valuationId = searchParams.get("valuation_id");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!valuationId) { setStatus("error"); return; }

    // Poll for PDF (webhook may not have completed yet)
    let attempts = 0;
    const poll = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(`/api/valuation/status?id=${valuationId}`);
        const data = await res.json();
        if (data.pdf_url) {
          setPdfUrl(data.pdf_url);
          setStatus("success");
          clearInterval(poll);
        } else if (attempts > 20) {
          // After 60s, try generating directly
          const genRes = await fetch("/api/valuation/report", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ valuationId, skipPayment: true }),
          });
          const genData = await genRes.json();
          if (genData.pdf_url) {
            setPdfUrl(genData.pdf_url);
            setStatus("success");
          } else {
            setStatus("error");
          }
          clearInterval(poll);
        }
      } catch {
        if (attempts > 30) { setStatus("error"); clearInterval(poll); }
      }
    }, 3000);

    return () => clearInterval(poll);
  }, [valuationId]);

  return (
    <div className="page-shell">
      <SiteHeader />
      <main style={{ paddingTop: 96, minHeight: "100vh", background: "var(--bg)" }}>
        <div className="container">
          <div className="valuation-wizard">
            <div className="valuation-success">
              {status === "loading" && (
                <>
                  <div className="pf-spinner" style={{ width: 48, height: 48, margin: "0 auto" }} />
                  <h2 style={{ fontSize: "1.3rem", fontWeight: 700, marginTop: 20, color: "var(--text)" }}>
                    Generuji váš report...
                  </h2>
                  <p style={{ color: "var(--text-muted)", marginTop: 8 }}>
                    Platba byla přijata. AI analyzuje data a připravuje PDF report.
                  </p>
                </>
              )}

              {status === "success" && pdfUrl && (
                <>
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <path d="M22 4L12 14.01l-3-3" />
                  </svg>
                  <h2 style={{ fontSize: "1.3rem", fontWeight: 700, marginTop: 16, color: "var(--text)" }}>
                    Report je připraven
                  </h2>
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noopener"
                    className="valuation-btn valuation-btn--primary"
                    style={{ display: "inline-block", marginTop: 20, textDecoration: "none" }}
                  >
                    Stáhnout PDF report
                  </a>
                  <p style={{ color: "var(--text-muted)", marginTop: 12, fontSize: "0.85rem" }}>
                    Report byl také odeslán na váš email.
                  </p>
                </>
              )}

              {status === "error" && (
                <>
                  <h2 style={{ fontSize: "1.3rem", fontWeight: 700, marginTop: 16, color: "var(--text)" }}>
                    Omlouváme se
                  </h2>
                  <p style={{ color: "var(--text-muted)", marginTop: 8 }}>
                    Report se nepodařilo vygenerovat. Kontaktujte nás na info@nemovizor.cz.
                  </p>
                </>
              )}

              <Link href="/nabidky" style={{ display: "inline-block", marginTop: 24, color: "var(--text-muted)", fontSize: "0.85rem" }}>
                Zpět na nabídky
              </Link>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

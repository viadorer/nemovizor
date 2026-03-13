import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getUniqueCities } from "@/lib/api";

export default async function LocationsPage() {
  const cities = await getUniqueCities();

  return (
    <div className="page-shell">
      <SiteHeader />
      <main style={{ paddingTop: 96, minHeight: "100vh", background: "var(--bg)" }}>
        <div className="container">
          <p style={{ fontSize: "0.8rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: 8 }}>
            Lokality
          </p>
          <h1 className="section-title" style={{ fontSize: "2rem", marginBottom: 32 }}>
            Procházejte nabídky podle města
          </h1>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {cities.map((city) => (
              <Link
                key={city}
                href={`/nabidky?city=${encodeURIComponent(city)}`}
                style={{
                  padding: "12px 24px",
                  borderRadius: 12,
                  fontSize: "1rem",
                  fontWeight: 600,
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                  background: "var(--bg-card)",
                  transition: "all 0.2s",
                }}
              >
                {city}
              </Link>
            ))}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

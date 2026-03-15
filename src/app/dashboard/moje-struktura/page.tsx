"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import Link from "next/link";

type AgencyInfo = {
  id: string;
  name: string;
  logo: string | null;
  seat_city: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
};

type BrokerInfo = {
  id: string;
  user_id: string | null;
  name: string;
  photo: string | null;
  email: string | null;
  phone: string | null;
  specialization: string | null;
  active_listings: number;
};

type BranchInfo = {
  id: string;
  name: string;
  city: string | null;
  address: string | null;
  phone: string | null;
  is_headquarters: boolean;
};

function BuildingIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 17V4a1 1 0 011-1h5a1 1 0 011 1v13M3 17h8M3 17H1M11 17h2m0 0h2m-2 0V9a1 1 0 011-1h3a1 1 0 011 1v8m0 0h1M5 6h2M5 9h2M5 12h2M13 11h2M13 14h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 10a4 4 0 100-8 4 4 0 000 8zM3 18c0-3.866 3.134-7 7-7s7 3.134 7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function BranchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 10h14M10 3v14M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function StarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 1l2.39 4.84 5.34.78-3.87 3.77.91 5.33L10 13.27l-4.77 2.51.91-5.33L2.27 6.62l5.34-.78L10 1z"/>
    </svg>
  );
}

function HeadquartersBadge() {
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      fontSize: "0.7rem",
      fontWeight: 600,
      padding: "2px 8px",
      borderRadius: 4,
      background: "var(--primary-light, #e0e7ff)",
      color: "var(--primary, #4f46e5)",
    }}>
      <svg width="10" height="10" viewBox="0 0 20 20" fill="currentColor">
        <path d="M10 1l2.39 4.84 5.34.78-3.87 3.77.91 5.33L10 13.27l-4.77 2.51.91-5.33L2.27 6.62l5.34-.78L10 1z"/>
      </svg>
      Sidlo
    </span>
  );
}

export default function MojeStrukturaPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [agency, setAgency] = useState<AgencyInfo | null>(null);
  const [brokers, setBrokers] = useState<BrokerInfo[]>([]);
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [myBrokerUserId, setMyBrokerUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const supabase = getBrowserSupabase();
    if (!supabase) return;

    (async () => {
      try {
        let agencyId: string | null = null;

        // 1. Check if user owns an agency
        const { data: ownedAgency } = await supabase
          .from("agencies")
          .select("id, name, logo, seat_city, email, phone, website, rating")
          .eq("user_id", user.id)
          .single();

        if (ownedAgency) {
          agencyId = ownedAgency.id;
          setAgency(ownedAgency);
        }

        // 2. Check if user is a broker
        const { data: myBroker } = await supabase
          .from("brokers")
          .select("id, user_id, agency_id")
          .eq("user_id", user.id)
          .single();

        if (myBroker) {
          setMyBrokerUserId(myBroker.user_id);
          if (!agencyId && myBroker.agency_id) {
            agencyId = myBroker.agency_id;
            // Fetch agency details
            const { data: brokerAgency } = await supabase
              .from("agencies")
              .select("id, name, logo, seat_city, email, phone, website, rating")
              .eq("id", agencyId)
              .single();
            if (brokerAgency) {
              setAgency(brokerAgency);
            }
          }
        }

        // 3. Fetch brokers and branches if agency found
        if (agencyId) {
          const [brokersRes, branchesRes] = await Promise.all([
            supabase
              .from("brokers")
              .select("id, user_id, name, photo, email, phone, specialization, active_listings")
              .eq("agency_id", agencyId)
              .order("name"),
            supabase
              .from("branches")
              .select("id, name, city, address, phone, is_headquarters")
              .eq("agency_id", agencyId)
              .order("name"),
          ]);

          setBrokers(brokersRes.data ?? []);
          setBranches(branchesRes.data ?? []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  if (loading) {
    return (
      <div className="dashboard-page">
        <h1 className="dashboard-page-title">Moje struktura</h1>
        <p style={{ color: "var(--text-muted)" }}>Nacitani...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <h1 className="dashboard-page-title">Moje struktura</h1>

      {/* Section 1: Agency */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{
          fontSize: "1.1rem",
          fontWeight: 600,
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}>
          <BuildingIcon />
          Moje kancelar
        </h2>

        {agency ? (
          <div style={{
            background: "var(--card-bg, #fff)",
            border: "1px solid var(--border, #e5e7eb)",
            borderRadius: 12,
            padding: 24,
          }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              flexWrap: "wrap",
              gap: 16,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                {agency.logo && (
                  <img
                    src={agency.logo}
                    alt={agency.name}
                    style={{ width: 56, height: 56, borderRadius: 8, objectFit: "cover", border: "1px solid var(--border, #e5e7eb)" }}
                  />
                )}
                <div>
                  <h3 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>
                    {agency.name}
                  </h3>
                  {agency.seat_city && (
                    <p style={{ color: "var(--text-muted)", margin: "4px 0 0", fontSize: "0.9rem" }}>
                      {agency.seat_city}
                    </p>
                  )}
                </div>
              </div>
              {agency.rating != null && (
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  color: "var(--warning, #f59e0b)",
                  fontWeight: 600,
                  fontSize: "0.95rem",
                }}>
                  <StarIcon />
                  {Number(agency.rating).toFixed(1)}
                </div>
              )}
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: 12,
              marginTop: 16,
              fontSize: "0.9rem",
            }}>
              {agency.email && (
                <div>
                  <span style={{ color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    E-mail
                  </span>
                  <div style={{ marginTop: 2 }}>{agency.email}</div>
                </div>
              )}
              {agency.phone && (
                <div>
                  <span style={{ color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Telefon
                  </span>
                  <div style={{ marginTop: 2 }}>{agency.phone}</div>
                </div>
              )}
              {agency.website && (
                <div>
                  <span style={{ color: "var(--text-muted)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Web
                  </span>
                  <div style={{ marginTop: 2 }}>
                    <a
                      href={agency.website.startsWith("http") ? agency.website : `https://${agency.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "var(--primary, #4f46e5)", textDecoration: "none" }}
                    >
                      {agency.website}
                    </a>
                  </div>
                </div>
              )}
            </div>

            <div style={{ marginTop: 20 }}>
              <Link
                href="/dashboard/nastaveni"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 16px",
                  borderRadius: 8,
                  background: "var(--primary, #4f46e5)",
                  color: "#fff",
                  fontSize: "0.85rem",
                  fontWeight: 500,
                  textDecoration: "none",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a3 3 0 100-6 3 3 0 000 6z"/>
                  <path d="M17.4 12.6a1.5 1.5 0 00.3 1.65l.05.06a1.82 1.82 0 01-1.29 3.1 1.82 1.82 0 01-1.29-.53l-.06-.06a1.5 1.5 0 00-1.65-.3 1.5 1.5 0 00-.91 1.37v.17a1.82 1.82 0 01-3.64 0v-.09A1.5 1.5 0 008 16.52a1.5 1.5 0 00-1.65.3l-.06.06a1.82 1.82 0 01-2.58-2.58l.06-.06a1.5 1.5 0 00.3-1.65 1.5 1.5 0 00-1.37-.91h-.17a1.82 1.82 0 010-3.64h.09A1.5 1.5 0 003.48 8a1.5 1.5 0 00-.3-1.65l-.06-.06a1.82 1.82 0 012.58-2.58l.06.06a1.5 1.5 0 001.65.3h.07a1.5 1.5 0 00.91-1.37v-.17a1.82 1.82 0 013.64 0v.09a1.5 1.5 0 00.91 1.37 1.5 1.5 0 001.65-.3l.06-.06a1.82 1.82 0 012.58 2.58l-.06.06a1.5 1.5 0 00-.3 1.65v.07a1.5 1.5 0 001.37.91h.17a1.82 1.82 0 010 3.64h-.09a1.5 1.5 0 00-1.37.91z"/>
                </svg>
                Nastaveni kancelare
              </Link>
            </div>
          </div>
        ) : (
          <div style={{
            background: "var(--card-bg, #fff)",
            border: "1px solid var(--border, #e5e7eb)",
            borderRadius: 12,
            padding: 32,
            textAlign: "center",
            color: "var(--text-muted)",
          }}>
            <BuildingIcon />
            <p style={{ marginTop: 8 }}>Nejste prirazeni k zadne kancelari</p>
          </div>
        )}
      </div>

      {/* Section 2: Brokers */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{
          fontSize: "1.1rem",
          fontWeight: 600,
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}>
          <UserIcon />
          Makleri v kancelari
          {brokers.length > 0 && (
            <span style={{
              fontSize: "0.75rem",
              fontWeight: 500,
              padding: "2px 10px",
              borderRadius: 12,
              background: "var(--primary-light, #e0e7ff)",
              color: "var(--primary, #4f46e5)",
            }}>
              {brokers.length}
            </span>
          )}
        </h2>

        {!agency ? (
          <div style={{
            background: "var(--card-bg, #fff)",
            border: "1px solid var(--border, #e5e7eb)",
            borderRadius: 12,
            padding: 32,
            textAlign: "center",
            color: "var(--text-muted)",
          }}>
            <p>Zadni makleri k zobrazeni</p>
          </div>
        ) : brokers.length === 0 ? (
          <div style={{
            background: "var(--card-bg, #fff)",
            border: "1px solid var(--border, #e5e7eb)",
            borderRadius: 12,
            padding: 32,
            textAlign: "center",
            color: "var(--text-muted)",
          }}>
            <p>V kancelari nejsou zadni makleri</p>
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 12,
          }}>
            {brokers.map((broker) => {
              const isMe = broker.user_id === user?.id;
              return (
                <div
                  key={broker.id}
                  style={{
                    background: "var(--card-bg, #fff)",
                    border: isMe
                      ? "2px solid var(--primary, #4f46e5)"
                      : "1px solid var(--border, #e5e7eb)",
                    borderRadius: 10,
                    padding: 16,
                    position: "relative",
                  }}
                >
                  {isMe && (
                    <span style={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                      fontSize: "0.65rem",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      padding: "2px 8px",
                      borderRadius: 4,
                      background: "var(--primary, #4f46e5)",
                      color: "#fff",
                    }}>
                      Vy
                    </span>
                  )}
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {broker.photo ? (
                      <img
                        src={broker.photo}
                        alt={broker.name}
                        style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", border: "1px solid var(--border, #e5e7eb)" }}
                      />
                    ) : (
                      <div style={{
                        width: 40, height: 40, borderRadius: "50%",
                        background: "var(--bg-muted, #f3f4f6)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "var(--text-muted)", fontWeight: 600, fontSize: "0.9rem",
                      }}>
                        {broker.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>
                        {broker.name}
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                        {broker.email && <span>{broker.email}</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 4 }}>
                    {broker.phone && <div>{broker.phone}</div>}
                  </div>
                  <div style={{
                    display: "flex",
                    gap: 12,
                    marginTop: 10,
                    fontSize: "0.8rem",
                  }}>
                    {broker.specialization && (
                      <span style={{
                        padding: "2px 8px",
                        borderRadius: 4,
                        background: "var(--bg-muted, #f3f4f6)",
                        color: "var(--text-secondary, #6b7280)",
                      }}>
                        {broker.specialization}
                      </span>
                    )}
                    <span style={{
                      padding: "2px 8px",
                      borderRadius: 4,
                      background: "var(--bg-muted, #f3f4f6)",
                      color: "var(--text-secondary, #6b7280)",
                    }}>
                      {broker.active_listings || 0} inzeratu
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 3: Branches (only if branches exist) */}
      {branches.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h2 style={{
            fontSize: "1.1rem",
            fontWeight: 600,
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}>
            <BranchIcon />
            Pobocky
            <span style={{
              fontSize: "0.75rem",
              fontWeight: 500,
              padding: "2px 10px",
              borderRadius: 12,
              background: "var(--primary-light, #e0e7ff)",
              color: "var(--primary, #4f46e5)",
            }}>
              {branches.length}
            </span>
          </h2>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 12,
          }}>
            {branches.map((branch) => (
              <div
                key={branch.id}
                style={{
                  background: "var(--card-bg, #fff)",
                  border: "1px solid var(--border, #e5e7eb)",
                  borderRadius: 10,
                  padding: 16,
                }}
              >
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 8,
                }}>
                  <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>
                    {branch.name}
                  </div>
                  {branch.is_headquarters && <HeadquartersBadge />}
                </div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 6 }}>
                  {branch.city && <div>{branch.city}</div>}
                  {branch.address && <div>{branch.address}</div>}
                  {branch.phone && <div style={{ marginTop: 4 }}>{branch.phone}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

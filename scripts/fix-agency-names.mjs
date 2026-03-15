#!/usr/bin/env node
// ============================================================
// Fix Agency Names - Oprava nazvu kancelari
// Nekteré kancelare maji jako nazev ulici/adresu místo nazvu.
// Tento skript:
// 1. Nacte vsechny agentury z DB
// 2. Detekuje ty, ktere maji jako nazev adresu (cislo popisne, ulice)
// 3. Pokusi se dohledat spravny nazev z Sreality API
// 4. Zobrazi preview zmen a ceka na potvrzeni
// ============================================================

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createInterface } from "readline";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// Load env
function loadEnv() {
  const envPath = resolve(ROOT, ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error("Missing SUPABASE env vars"); process.exit(1); }
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const DRY_RUN = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");

// Detekce: nazev vypada jako adresa
function looksLikeAddress(name) {
  if (!name) return false;
  // Obsahuje cislo popisne (napr. "Vodickova 699/30" nebo "Na Porici 12")
  if (/\d{2,}\/\d+/.test(name)) return true;           // "699/30"
  if (/^\d+\s/.test(name)) return true;                 // zacina cislem
  if (/\s\d{3,}$/.test(name)) return true;              // konci cislem 3+
  if (/\s\d+\/\d+$/.test(name)) return true;            // konci "12/3"
  // Typicke ulice bez nazvu firmy
  if (/^(ul\.|ulice)\s/i.test(name)) return true;
  // Obsahuje PSC
  if (/\d{3}\s?\d{2}/.test(name)) return true;
  // Kratky nazev, ktery je jen cislo
  if (/^\d+$/.test(name.trim())) return true;
  return false;
}

async function main() {
  console.log("\n=== Fix Agency Names ===\n");
  if (DRY_RUN) console.log("  (DRY RUN - zadne zmeny nebudou provedeny)\n");

  // Nacist agentury
  const { data: agencies, error } = await sb
    .from("agencies")
    .select("id, name, slug, seat_address, seat_city, website, email")
    .order("name");

  if (error) { console.error("Chyba:", error.message); process.exit(1); }
  console.log(`Celkem agentur v DB: ${agencies.length}\n`);

  // Najit podezrele
  const suspicious = agencies.filter(a => looksLikeAddress(a.name));

  if (suspicious.length === 0) {
    console.log("Zadne agentury s adresou jako nazvem nebyly nalezeny.");
    return;
  }

  console.log(`Nalezeno ${suspicious.length} agentur s podezrelym nazvem:\n`);
  console.log("─".repeat(80));

  const fixes = [];

  for (const agency of suspicious) {
    console.log(`\n  ID:      ${agency.id}`);
    console.log(`  Nazev:   "${agency.name}"  <-- vypada jako adresa`);
    console.log(`  Slug:    ${agency.slug}`);
    console.log(`  Adresa:  ${agency.seat_address || "-"}`);
    console.log(`  Mesto:   ${agency.seat_city || "-"}`);
    console.log(`  Web:     ${agency.website || "-"}`);
    console.log(`  Email:   ${agency.email || "-"}`);

    // Pokusit se odvodit nazev z:
    // 1. Website domeny
    // 2. Email domeny
    // 3. Slug (pokud obsahuje nazev pred -sr)
    let suggestedName = null;

    if (agency.website) {
      // Extrahovat nazev z domeny: https://www.remax.cz -> RE/MAX
      const domain = agency.website
        .replace(/^https?:\/\/(www\.)?/, "")
        .replace(/\/.*$/, "")
        .replace(/\.cz$|\.com$|\.eu$/, "");
      if (domain && !looksLikeAddress(domain) && domain.length > 2) {
        suggestedName = domain.charAt(0).toUpperCase() + domain.slice(1);
      }
    }

    if (!suggestedName && agency.email) {
      const domain = agency.email.split("@")[1]
        ?.replace(/\.cz$|\.com$|\.eu$/, "");
      if (domain && !looksLikeAddress(domain) && domain.length > 2) {
        suggestedName = domain.charAt(0).toUpperCase() + domain.slice(1);
      }
    }

    if (suggestedName) {
      console.log(`  Navrh:   "${suggestedName}"`);
      fixes.push({ id: agency.id, oldName: agency.name, newName: suggestedName });
    } else {
      console.log(`  Navrh:   (nelze odvodit - nutna rucni oprava)`);
      fixes.push({ id: agency.id, oldName: agency.name, newName: null });
    }
  }

  console.log("\n" + "─".repeat(80));

  const autoFixes = fixes.filter(f => f.newName);
  const manualFixes = fixes.filter(f => !f.newName);

  console.log(`\nAutomaticky opravitelne: ${autoFixes.length}`);
  console.log(`Nutna rucni oprava:     ${manualFixes.length}`);

  if (autoFixes.length === 0) {
    console.log("\nZadne automaticke opravy k provedeni.");
    return;
  }

  if (DRY_RUN) {
    console.log("\n(DRY RUN - pro provedeni oprav spustte bez --dry-run)\n");
    return;
  }

  // Potvrdit
  if (!FORCE) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise(resolve => {
      rl.question(`\nProvest ${autoFixes.length} oprav? (y/n): `, resolve);
    });
    rl.close();

    if (answer.toLowerCase() !== "y") {
      console.log("Zruseno.");
      return;
    }
  } else {
    console.log(`\n--force: provadim ${autoFixes.length} oprav...`);
  }

  // Provest opravy
  let updated = 0;
  for (const fix of autoFixes) {
    const { error } = await sb
      .from("agencies")
      .update({ name: fix.newName, updated_at: new Date().toISOString() })
      .eq("id", fix.id);

    if (error) {
      console.error(`  CHYBA ${fix.oldName}: ${error.message}`);
    } else {
      console.log(`  OK: "${fix.oldName}" -> "${fix.newName}"`);
      updated++;
    }

    // Opravit i agency_name na brokeru
    await sb
      .from("brokers")
      .update({ agency_name: fix.newName })
      .eq("agency_id", fix.id);
  }

  console.log(`\nOpraveno: ${updated}/${autoFixes.length} agentur`);
}

main().catch(e => { console.error(e); process.exit(1); });

-- ============================================================
-- Nemovizor – Seed: Brokers (zkusebni data)
-- ============================================================

INSERT INTO brokers (id, name, phone, email, agency_name, specialization, active_listings, rating, total_deals, bio, slug, agency_id, languages, certifications, year_started) VALUES
  ('b1', 'Jan Novák', '+420 777 111 222', 'jan.novak@nemovizor.cz', 'Nemovizor Prime', 'Rodinné domy, vily', 12, 4.9, 87,
   'Specialista na prémiové nemovitosti v Praze s 15 lety zkušeností.',
   'jan-novak', 'a1', ARRAY['Čeština','Angličtina','Němčina'], ARRAY['Certifikovaný realitní makléř ARK ČR','Hypoteční specialista'], 2009),

  ('b2', 'Tereza Svobodová', '+420 777 222 333', 'tereza.svobodova@nemovizor.cz', 'Nemovizor Prime', 'Byty, apartmány', 18, 4.8, 124,
   'Expertka na bytové jednotky a investiční nemovitosti v Brně a okolí.',
   'tereza-svobodova', 'a1', ARRAY['Čeština','Angličtina'], ARRAY['Certifikovaný realitní makléř ARK ČR'], 2014),

  ('b3', 'Lucie Hálová', '+420 777 333 444', 'lucie.halova@nemovizor.cz', 'Nemovizor Prime', 'Historické nemovitosti', 8, 5.0, 63,
   'Specialistka na historické byty a nemovitosti v centru Prahy.',
   'lucie-halova', 'a1', ARRAY['Čeština','Angličtina','Francouzština'], ARRAY['Certifikovaný realitní makléř ARK ČR','Specialista na historické objekty'], 2011),

  ('b4', 'Martin Veselý', '+420 777 444 555', 'martin.vesely@nemovizor.cz', 'Nemovizor Prime', 'Novostavby', 22, 4.7, 156,
   'Zaměřuje se na novostavby a developerské projekty po celé ČR.',
   'martin-vesely', 'a1', ARRAY['Čeština','Angličtina'], ARRAY['Certifikovaný realitní makléř ARK ČR','Energetický specialista'], 2008),

  ('b7', 'Tomáš Krejčí', '+420 585 200 301', 'tomas.krejci@remax-horizont.cz', 'RE/MAX Horizont', 'Rezidenční nemovitosti', 19, 4.6, 112,
   'Zkušený makléř působící na Moravě s důrazem na rezidenční nemovitosti.',
   'tomas-krejci', 'a2', ARRAY['Čeština','Angličtina'], ARRAY['RE/MAX Certified Agent'], 2013),

  ('b8', 'Petra Němcová', '+420 585 200 302', 'petra.nemcova@remax-horizont.cz', 'RE/MAX Horizont', 'Pronájmy, investice', 15, 4.7, 98,
   'Specialistka na pronájmy a investiční nemovitosti v Olomouci a Přerově.',
   'petra-nemcova', 'a2', ARRAY['Čeština','Angličtina','Polština'], ARRAY['RE/MAX Certified Agent','Investiční poradce'], 2016),

  ('b9', 'Ondřej Fiala', '+420 377 300 401', 'ondrej.fiala@century21bonus.cz', 'Century 21 Bonus', 'Rodinné domy, pozemky', 22, 4.5, 89,
   'Rodák z Plzně se zaměřením na rodinné domy a stavební pozemky.',
   'ondrej-fiala', 'a3', ARRAY['Čeština','Němčina'], ARRAY['Century 21 Certified Professional'], 2018);

-- ============================================================
-- Nemovizor – Seed: Agencies
-- ============================================================

INSERT INTO agencies (id, name, slug, description, phone, email, website, founded_year, total_brokers, total_listings, total_deals, rating, specializations, is_independent) VALUES
('00000000-0000-0000-0000-00000000a001', 'Nemovizor Prime', 'nemovizor-prime',
 'Prémiová realitní kancelář zaměřená na exkluzivní nemovitosti v České republice. Nabízíme individuální přístup, profesionální marketing a kompletní právní servis.',
 '+420 800 100 200', 'info@nemovizor-prime.cz', 'https://www.nemovizor-prime.cz',
 2010, 6, 81, 573, 4.8,
 ARRAY['Luxusní nemovitosti', 'Prémiové byty', 'Komerční prostory', 'Investiční poradenství'],
 false),

('00000000-0000-0000-0000-00000000a002', 'RE/MAX Horizont', 'remax-horizont',
 'Franšízová pobočka mezinárodní sítě RE/MAX. Působíme na Moravě se zaměřením na rezidenční nemovitosti.',
 '+420 585 200 300', 'info@remax-horizont.cz', 'https://www.remax-horizont.cz',
 2015, 2, 34, 210, 4.6,
 ARRAY['Rezidenční nemovitosti', 'Pronájmy', 'Zahraniční klientela'],
 true),

('00000000-0000-0000-0000-00000000a003', 'Century 21 Bonus', 'century-21-bonus',
 'Pobočka mezinárodní sítě Century 21 pokrývající západní a jižní Čechy. Specializujeme se na rodinné domy, pozemky a rekreační objekty.',
 '+420 377 300 400', 'info@century21bonus.cz', 'https://www.century21bonus.cz',
 2018, 1, 22, 89, 4.5,
 ARRAY['Rodinné domy', 'Pozemky', 'Rekreační objekty'],
 false);

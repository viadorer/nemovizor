-- ============================================================
-- Nemovizor – Seed: Reviews
-- ============================================================

-- Broker reviews
INSERT INTO reviews (target_type, broker_id, author_name, rating, text, date, property_type) VALUES
('broker', '00000000-0000-0000-0000-00000000b001', 'Michaela Procházková', 5,
 'Pan Novák nám pomohl najít dokonalou vilu v Praze 6. Jeho profesionalita a znalost trhu je výjimečná.',
 '2025-11-15', 'Prodej vily 6+kk'),

('broker', '00000000-0000-0000-0000-00000000b001', 'David Černý', 5,
 'Výborná spolupráce při prodeji rodinného domu. Jan dokázal nemovitost prodat za vyšší cenu, než jsme očekávali.',
 '2025-09-22', 'Prodej rodinného domu'),

('broker', '00000000-0000-0000-0000-00000000b002', 'Kateřina Malá', 5,
 'Tereza je naprosto skvělá makléřka. Pomohla nám s koupí bytu v Brně. Vždy dostupná, ochotná a profesionální.',
 '2025-12-03', 'Koupě bytu 3+kk'),

('broker', '00000000-0000-0000-0000-00000000b003', 'Robert Šimek', 5,
 'Lucie má neuvěřitelné znalosti historické architektury. Našla nám byt v secesním domě.',
 '2025-10-18', 'Koupě bytu v historickém centru'),

('broker', '00000000-0000-0000-0000-00000000b004', 'Lenka Dvořáková', 4,
 'Martin nám představil několik novostaveb, které přesně odpovídaly našim požadavkům.',
 '2025-08-30', 'Koupě bytu v novostavbě'),

('broker', '00000000-0000-0000-0000-00000000b007', 'Filip Horák', 5,
 'Tomáš nám pomohl s prodejem bytu v Olomouci. Rychlé jednání, férový přístup.',
 '2025-11-28', 'Prodej bytu 2+1');

-- Agency reviews
INSERT INTO reviews (target_type, agency_id, author_name, rating, text, date, property_type) VALUES
('agency', '00000000-0000-0000-0000-00000000a001', 'Ing. Pavel Kořínek', 5,
 'Nemovizor Prime je špička v oboru. Kompletní servis od prvního kontaktu až po předání klíčů.',
 '2025-10-05', 'Koupě bytu 4+kk'),

('agency', '00000000-0000-0000-0000-00000000a001', 'Simona Vlčková', 5,
 'Profesionální přístup celého týmu. Home staging a fotografie na nejvyšší úrovni.',
 '2025-07-12', 'Prodej vily'),

('agency', '00000000-0000-0000-0000-00000000a002', 'Jakub Marek', 4,
 'RE/MAX Horizont nabízí solidní služby s mezinárodním zázemím. Ocenili jsme přístup k zahraničním klientům.',
 '2025-09-15', 'Prodej bytu 2+kk');

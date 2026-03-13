-- ============================================================
-- Nemovizor – Seed: Branches
-- ============================================================

INSERT INTO branches (id, agency_id, name, slug, address, city, phone, email, latitude, longitude, is_headquarters) VALUES
('br1', 'a1', 'Nemovizor Prime – Praha', 'nemovizor-prime-praha',
 'Národní 1009/5, 110 00 Praha 1', 'Praha',
 '+420 800 100 200', 'praha@nemovizor-prime.cz',
 50.0815, 14.4165, true),

('br2', 'a1', 'Nemovizor Prime – Brno', 'nemovizor-prime-brno',
 'Masarykova 427/31, 602 00 Brno', 'Brno',
 '+420 800 100 201', 'brno@nemovizor-prime.cz',
 49.1951, 16.6068, false),

('br3', 'a2', 'RE/MAX Horizont – Olomouc', 'remax-horizont-olomouc',
 'Horní náměstí 583/7, 779 00 Olomouc', 'Olomouc',
 '+420 585 200 300', 'olomouc@remax-horizont.cz',
 49.5938, 17.2509, true),

('br4', 'a3', 'Century 21 Bonus – Plzeň', 'century-21-bonus-plzen',
 'Americká 2141/56, 301 00 Plzeň', 'Plzeň',
 '+420 377 300 400', 'plzen@century21bonus.cz',
 49.7384, 13.3736, true),

('br5', 'a3', 'Century 21 Bonus – České Budějovice', 'century-21-bonus-cb',
 'Náměstí Přemysla Otakara II. 87/25, 370 01 České Budějovice', 'České Budějovice',
 '+420 377 300 401', 'cb@century21bonus.cz',
 48.9745, 14.4742, false);

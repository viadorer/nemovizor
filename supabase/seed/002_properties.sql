-- ============================================================
-- Nemovizor – Seed: Properties (zkusebni data, 10 nemovitosti)
-- ============================================================

INSERT INTO properties (
  slug, title, listing_type, category, subtype, rooms_label,
  price, city, district, location_label, latitude, longitude,
  area, summary, condition, ownership, furnishing, energy_rating,
  building_material, floor, total_floors, parking,
  balcony, terrace, garden, elevator, cellar, garage, pool, loggia,
  image_src, image_alt, images, broker_id, featured, active
) VALUES
-- 1. Luxusni vila Praha 6
(
  'luxusni-vila-praha-6',
  'Luxusni rodinny dum',
  'sale', 'house', 'Vila', '6+kk',
  9890000, 'Praha', 'Praha 6', 'Praha 6, 245 m2', 50.0872, 14.3912,
  245, 'Luxusni vila v klidne rezidencni ctvrti Praha 6. Moderni architektura, prostorny zahrada a garaz pro 2 auta.',
  'novostavba', 'osobni', 'ano', 'A',
  'cihla', NULL, 2, 'dvojgaraz',
  true, true, true, false, true, true, true, false,
  '/images/u9534644866_A_luxurious_family_home_exterior_in_a_modern_arch_79afac09-b8fc-422f-8681-d24b4e78ec2c_1.png',
  'Luxusni rodinny dum',
  ARRAY['/images/u9534644866_A_luxurious_family_home_exterior_in_a_modern_arch_79afac09-b8fc-422f-8681-d24b4e78ec2c_1.png'],
  'b1000000-0000-0000-0000-000000000001',
  true, true
),
-- 2. Moderni byt Praha 2
(
  'moderni-byt-praha-2',
  'Luxusni byt',
  'sale', 'apartment', '3+kk', '3+kk',
  7300000, 'Praha', 'Praha 2', 'Praha 2, 110 m2', 50.0755, 14.4378,
  110, 'Moderni byt 3+kk v samem centru Prahy 2. Vysoke stropy, balkon s vyhledem na Vltavu.',
  'po_rekonstrukci', 'osobni', 'castecne', 'B',
  'cihla', 4, 6, 'podzemni',
  true, false, false, true, true, false, false, false,
  '/images/u9534644866_A_chic_and_modern_Parisian_apartment_with_sleek_m_978ddd7e-c1ba-47fd-b9f6-3d3e92409162_1.png',
  'Luxusni byt',
  ARRAY['/images/u9534644866_A_chic_and_modern_Parisian_apartment_with_sleek_m_978ddd7e-c1ba-47fd-b9f6-3d3e92409162_1.png'],
  'b1000000-0000-0000-0000-000000000001',
  true, true
),
-- 3. Pronajem Praha 5
(
  'designovy-byt-praha-5',
  'Designovy byt',
  'rent', 'apartment', '2+kk', '2+kk',
  25000, 'Praha', 'Praha 5', 'Praha 5, 65 m2', 50.0713, 14.4044,
  65, 'Designovy byt 2+kk s terasou v Praze 5. Plne vybaveny, ihned k nasazeni.',
  'velmi_dobry', 'osobni', 'ano', 'C',
  'panel', 3, 8, 'parkovaci_stani',
  false, true, false, true, false, false, false, false,
  '/images/u9534644866_A_contemporary_apartment_interior_with_three_dist_cbb61a6d-dc86-4aeb-8b9c-7c02268c90fb_3.png',
  'Designovy byt',
  ARRAY['/images/u9534644866_A_contemporary_apartment_interior_with_three_dist_cbb61a6d-dc86-4aeb-8b9c-7c02268c90fb_3.png'],
  'b1000000-0000-0000-0000-000000000004',
  false, true
),
-- 4. Vila Brno
(
  'moderni-vila-brno',
  'Moderni vila',
  'sale', 'house', 'Vila', '7+1',
  12500000, 'Brno', 'Brno-sever', 'Brno, 320 m2', 49.2125, 16.5955,
  320, 'Nadstandardni vila v Brne s bazénem a velkou zahradou. Klidna lokalita.',
  'novostavba', 'osobni', 'ano', 'A',
  'cihla', NULL, 2, 'dvojgaraz',
  false, true, true, false, true, true, true, false,
  '/images/u9534644866_A_hypermodern_luxury_house_with_futuristic_archit_038b2e37-1fbc-4d5b-a953-675705175b3a_2.png',
  'Moderni vila',
  ARRAY['/images/u9534644866_A_hypermodern_luxury_house_with_futuristic_archit_038b2e37-1fbc-4d5b-a953-675705175b3a_2.png'],
  'b1000000-0000-0000-0000-000000000002',
  true, true
),
-- 5. Investicni byt Usti
(
  'investicni-byt-usti',
  'Investicni byt Usti',
  'sale', 'apartment', '1+kk', '1+kk',
  1290000, 'Usti nad Labem', 'Stredni terasa', 'Usti n. L., 32 m2', 50.6607, 14.0323,
  32, 'Investicni byt 1+kk v Usti nad Labem. Nizka cena, idealni pro pronajem.',
  'dobry', 'osobni', 'ne', 'D',
  'panel', 2, 12, 'zadne',
  false, false, false, true, true, false, false, false,
  '/images/u9534644866_A_contemporary_apartment_interior_with_three_dist_5c88f539-845f-40a3-957d-755e1f886c9d_0.png',
  'Investicni byt Usti',
  ARRAY['/images/u9534644866_A_contemporary_apartment_interior_with_three_dist_5c88f539-845f-40a3-957d-755e1f886c9d_0.png'],
  'b1000000-0000-0000-0000-000000000003',
  false, true
),
-- 6. Penthouse Brno
(
  'penthouse-brno',
  'Penthouse Brno',
  'sale', 'apartment', '4+kk', '4+kk',
  13800000, 'Brno', 'Brno-stred', 'Brno, 145 m2', 49.1951, 16.6068,
  145, 'Luxusni penthouse s panoramatickym vyhledem na Brno. Terasa 40 m2.',
  'novostavba', 'osobni', 'ano', 'A',
  'skeletal', 8, 8, 'podzemni',
  false, true, false, true, true, false, false, true,
  '/images/u9534644866_A_beautifully_designed_apartment_in_France_blendi_b6767da1-246c-43e4-bda5-1b7ed1494a0e_0.png',
  'Penthouse Brno',
  ARRAY['/images/u9534644866_A_beautifully_designed_apartment_in_France_blendi_b6767da1-246c-43e4-bda5-1b7ed1494a0e_0.png'],
  'b1000000-0000-0000-0000-000000000002',
  true, true
),
-- 7. Dum s garazi Praha 5
(
  'moderni-dum-praha-5',
  'Moderni dum s garazi',
  'sale', 'house', 'Rodinny', '5+kk',
  11750000, 'Praha', 'Praha 5', 'Praha 5, 210 m2', 50.0553, 14.3951,
  210, 'Moderni rodinny dum s dvojgarazi a zahradou v Praze 5.',
  'novostavba', 'osobni', 'ano', 'B',
  'cihla', NULL, 2, 'dvojgaraz',
  false, false, true, false, true, true, false, false,
  '/images/u9534644866_A_modern_luxury_home_exterior_with_a_sleek_garage_807055a2-b1a6-486c-a56b-051b92561a75_0.png',
  'Moderni dum s garazi',
  ARRAY['/images/u9534644866_A_modern_luxury_home_exterior_with_a_sleek_garage_807055a2-b1a6-486c-a56b-051b92561a75_0.png'],
  'b1000000-0000-0000-0000-000000000001',
  true, true
),
-- 8. Drazba Ostrava
(
  'drazbovy-byt-ostrava',
  'Drazbovy byt Ostrava',
  'auction', 'apartment', '2+1', '2+1',
  1450000, 'Ostrava', 'Ostrava-Poruba', 'Ostrava, 58 m2', 49.8209, 18.1552,
  58, 'Drazbovy byt 2+1 v Ostrave-Porube. Drazba 15.4.2026.',
  'pred_rekonstrukci', 'osobni', 'ne', 'E',
  'panel', 5, 12, 'zadne',
  true, false, false, true, true, false, false, false,
  '/images/u9534644866_A_contemporary_apartment_interior_with_three_dist_5c88f539-845f-40a3-957d-755e1f886c9d_1.png',
  'Drazbovy byt Ostrava',
  ARRAY['/images/u9534644866_A_contemporary_apartment_interior_with_three_dist_5c88f539-845f-40a3-957d-755e1f886c9d_1.png'],
  'b1000000-0000-0000-0000-000000000003',
  false, true
),
-- 9. Real: Koprivnice
(
  'real-koprivnice-2-1',
  'Byt 2+1 Koprivnice',
  'sale', 'apartment', '2+1', '2+1',
  3995000, 'Koprivnice', 'Tachovska', 'Tachovska, Plzen - Bolevec', 49.7478, 18.1447,
  39, 'Prodej bytu 2+1 39 m2 v Koprivnici.',
  'dobry', 'osobni', 'ne', 'C',
  'panel', 3, 5, 'zadne',
  false, false, false, false, true, false, false, false,
  '/images/real-koprivnice-2+1.jpg',
  'Byt 2+1 Koprivnice',
  ARRAY['/images/real-koprivnice-2+1.jpg'],
  'b1000000-0000-0000-0000-000000000001',
  false, true
),
-- 10. Real: Plzen
(
  'real-plzen-1-1',
  'Byt 1+1 Plzen',
  'sale', 'apartment', '1+1', '1+1',
  3995000, 'Plzen', 'Plzen - Bory', 'Plzen - Bory, 39 m2', 49.7386, 13.3617,
  39, 'Prodej bytu 1+1 39 m2 v Plzni - Borech. Novostavba.',
  'novostavba', 'osobni', 'castecne', 'A',
  'montovana', 6, 8, 'podzemni',
  true, false, false, true, false, false, false, false,
  '/images/real-plzen-1+1.jpg',
  'Byt 1+1 Plzen',
  ARRAY['/images/real-plzen-1+1.jpg'],
  'b1000000-0000-0000-0000-000000000004',
  false, true
);

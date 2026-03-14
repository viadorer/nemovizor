-- Fix subtypes in existing properties to match types.ts keys
-- Run this in Supabase SQL Editor

-- Apartments (mostly fine but fix Atypicky)
UPDATE properties SET subtype = 'atypicky' WHERE subtype = 'Atypicky';

-- Houses
UPDATE properties SET subtype = 'rodinny' WHERE subtype = 'Rodinny';
UPDATE properties SET subtype = 'vila' WHERE subtype = 'Vila';
UPDATE properties SET subtype = 'chalupa' WHERE subtype = 'Chalupa';
UPDATE properties SET subtype = 'chata' WHERE subtype = 'Chata';
UPDATE properties SET subtype = 'zemedelska_usedlost' WHERE subtype = 'Zemedelska usedlost';
UPDATE properties SET subtype = 'na_klic' WHERE subtype = 'Na klic';
UPDATE properties SET subtype = 'vicegeneracni' WHERE subtype = 'Vicegeneracni';
UPDATE properties SET subtype = 'pamatka' WHERE subtype = 'Pamatka';

-- Land
UPDATE properties SET subtype = 'bydleni' WHERE subtype = 'Bydleni';
UPDATE properties SET subtype = 'komercni' WHERE subtype = 'Komercni' AND category = 'land';
UPDATE properties SET subtype = 'pole' WHERE subtype = 'Pole';
UPDATE properties SET subtype = 'lesy' WHERE subtype = 'Lesy';
UPDATE properties SET subtype = 'louky' WHERE subtype = 'Louky';
UPDATE properties SET subtype = 'zahrady' WHERE subtype = 'Zahrady';
UPDATE properties SET subtype = 'rybniky' WHERE subtype = 'Rybniky';
UPDATE properties SET subtype = 'sady_vinice' WHERE subtype = 'Sady_vinice' OR subtype = 'Sady/vinice';
UPDATE properties SET subtype = 'ostatni' WHERE subtype = 'Ostatni';

-- Commercial
UPDATE properties SET subtype = 'kancelare' WHERE subtype = 'Kancelare';
UPDATE properties SET subtype = 'sklady' WHERE subtype = 'Sklady';
UPDATE properties SET subtype = 'vyroba' WHERE subtype = 'Vyroba';
UPDATE properties SET subtype = 'obchodni_prostory' WHERE subtype = 'Obchodni prostory';
UPDATE properties SET subtype = 'ubytovani' WHERE subtype = 'Ubytovani';
UPDATE properties SET subtype = 'restaurace' WHERE subtype = 'Restaurace';
UPDATE properties SET subtype = 'cinzovni_dum' WHERE subtype = 'Cinzovni dum';
UPDATE properties SET subtype = 'virtualni_kancelar' WHERE subtype = 'Virtualni kancelar';

-- Also fix rooms_label for non-apartment categories
UPDATE properties SET rooms_label = subtype WHERE category != 'apartment';

-- Verify: show distinct subtypes per category
SELECT category, subtype, COUNT(*) FROM properties GROUP BY category, subtype ORDER BY category, COUNT(*) DESC;

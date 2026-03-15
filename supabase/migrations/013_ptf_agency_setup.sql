-- ===== PTF Agency + Owner Broker Setup =====

-- 1) Create agency PTF
INSERT INTO agencies (name, slug, email, phone, website, seat_city, description, user_id)
VALUES (
  'PTF Reality',
  'ptf-reality',
  'info@ptf.cz',
  '',
  'https://ptf.cz',
  'Praha',
  '',
  '3c160468-02ec-418f-8109-4dbc3c849a8d'
)
ON CONFLICT (slug) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  email = EXCLUDED.email;

-- 2) Create broker record for the owner
INSERT INTO brokers (name, slug, email, phone, agency_id, user_id)
VALUES (
  'David Choc',
  'david-choc-ptf',
  'david.choc@ptf.cz',
  '',
  (SELECT id FROM agencies WHERE slug = 'ptf-reality'),
  '3c160468-02ec-418f-8109-4dbc3c849a8d'
)
ON CONFLICT (slug) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  email = EXCLUDED.email,
  agency_id = EXCLUDED.agency_id;

-- 3) Assign created_by on properties the owner created manually
UPDATE properties
  SET created_by = '3c160468-02ec-418f-8109-4dbc3c849a8d',
      broker_id = (SELECT id FROM brokers WHERE slug = 'david-choc-ptf')
  WHERE created_by IS NULL
    AND broker_id IS NULL
    AND (source IS NULL OR source NOT IN ('sreality'));

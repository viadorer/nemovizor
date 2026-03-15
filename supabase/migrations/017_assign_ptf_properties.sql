-- ===================================================================
-- Prirazeni PTF nemovitosti k brokeru David Choc
-- + nastaveni user_id na brokerovi aby "Moje inzeraty" fungovaly
-- ===================================================================

-- 1) Zajistit ze broker david-choc-ptf ma user_id
UPDATE brokers
SET user_id = '3c160468-02ec-418f-8109-4dbc3c849a8d'
WHERE slug = 'david-choc-ptf'
  AND (user_id IS NULL OR user_id != '3c160468-02ec-418f-8109-4dbc3c849a8d');

-- 2) Vsechny PTF importovane nemovitosti prirazit k tomuto brokeru
UPDATE properties
SET broker_id = (SELECT id FROM brokers WHERE slug = 'david-choc-ptf'),
    created_by = '3c160468-02ec-418f-8109-4dbc3c849a8d'
WHERE source = 'ptf-reality'
  AND broker_id IS DISTINCT FROM (SELECT id FROM brokers WHERE slug = 'david-choc-ptf');

-- 3) Nemovitosti bez broker_id a bez source (rucne vytvorene) taky prirazit
UPDATE properties
SET broker_id = (SELECT id FROM brokers WHERE slug = 'david-choc-ptf'),
    created_by = '3c160468-02ec-418f-8109-4dbc3c849a8d'
WHERE broker_id IS NULL
  AND created_by IS NULL
  AND (source IS NULL OR source = '');

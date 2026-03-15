-- ===================================================================
-- Automaticky prepocet ratingu z reviews tabulky
-- Trigger pri INSERT/UPDATE/DELETE na reviews prepocita prumerny
-- rating na prislusnem brokeru nebo agenture.
-- ===================================================================

-- Funkce pro prepocet ratingu maklere
CREATE OR REPLACE FUNCTION update_broker_rating()
RETURNS TRIGGER AS $$
DECLARE
  target UUID;
  avg_rating NUMERIC;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target := OLD.broker_id;
  ELSE
    target := NEW.broker_id;
  END IF;

  -- Pri UPDATE mohlo dojit ke zmene broker_id, prepocitat i stary
  IF TG_OP = 'UPDATE' AND OLD.broker_id IS DISTINCT FROM NEW.broker_id AND OLD.broker_id IS NOT NULL THEN
    SELECT COALESCE(ROUND(AVG(rating)::numeric, 1), 0) INTO avg_rating
      FROM reviews WHERE broker_id = OLD.broker_id;
    UPDATE brokers SET rating = avg_rating WHERE id = OLD.broker_id;
  END IF;

  IF target IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COALESCE(ROUND(AVG(rating)::numeric, 1), 0) INTO avg_rating
    FROM reviews WHERE broker_id = target;

  UPDATE brokers SET rating = avg_rating WHERE id = target;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Funkce pro prepocet ratingu kancelare
CREATE OR REPLACE FUNCTION update_agency_rating()
RETURNS TRIGGER AS $$
DECLARE
  target UUID;
  avg_rating NUMERIC;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target := OLD.agency_id;
  ELSE
    target := NEW.agency_id;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.agency_id IS DISTINCT FROM NEW.agency_id AND OLD.agency_id IS NOT NULL THEN
    SELECT COALESCE(ROUND(AVG(rating)::numeric, 1), 0) INTO avg_rating
      FROM reviews WHERE agency_id = OLD.agency_id;
    UPDATE agencies SET rating = avg_rating WHERE id = OLD.agency_id;
  END IF;

  IF target IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COALESCE(ROUND(AVG(rating)::numeric, 1), 0) INTO avg_rating
    FROM reviews WHERE agency_id = target;

  UPDATE agencies SET rating = avg_rating WHERE id = target;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Triggery - rozdelene na INSERT/UPDATE a DELETE zvlast (DELETE nemuze referencovat NEW)
DROP TRIGGER IF EXISTS trg_update_broker_rating ON reviews;
DROP TRIGGER IF EXISTS trg_update_broker_rating_insert ON reviews;
DROP TRIGGER IF EXISTS trg_update_broker_rating_delete ON reviews;

CREATE TRIGGER trg_update_broker_rating_insert
  AFTER INSERT OR UPDATE ON reviews
  FOR EACH ROW
  WHEN (NEW.target_type = 'broker')
  EXECUTE FUNCTION update_broker_rating();

CREATE TRIGGER trg_update_broker_rating_delete
  AFTER DELETE ON reviews
  FOR EACH ROW
  WHEN (OLD.target_type = 'broker')
  EXECUTE FUNCTION update_broker_rating();

DROP TRIGGER IF EXISTS trg_update_agency_rating ON reviews;
DROP TRIGGER IF EXISTS trg_update_agency_rating_insert ON reviews;
DROP TRIGGER IF EXISTS trg_update_agency_rating_delete ON reviews;

CREATE TRIGGER trg_update_agency_rating_insert
  AFTER INSERT OR UPDATE ON reviews
  FOR EACH ROW
  WHEN (NEW.target_type = 'agency')
  EXECUTE FUNCTION update_agency_rating();

CREATE TRIGGER trg_update_agency_rating_delete
  AFTER DELETE ON reviews
  FOR EACH ROW
  WHEN (OLD.target_type = 'agency')
  EXECUTE FUNCTION update_agency_rating();

-- Jednorazovy prepocet existujicich reviews -> rating
UPDATE brokers b SET rating = COALESCE((
  SELECT ROUND(AVG(r.rating)::numeric, 1)
  FROM reviews r WHERE r.broker_id = b.id
), 0);

UPDATE agencies a SET rating = COALESCE((
  SELECT ROUND(AVG(r.rating)::numeric, 1)
  FROM reviews r WHERE r.agency_id = a.id
), 0);

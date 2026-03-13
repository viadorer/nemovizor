-- ============================================================
-- Nemovizor – Migration 004: Relax RLS for MVP
-- Umožňuje CRUD přes anon key (bez nutnosti service key)
-- TODO: Po přidání auth zpřísnit zpět na authenticated
-- ============================================================

-- Properties
DROP POLICY IF EXISTS "properties_insert" ON properties;
DROP POLICY IF EXISTS "properties_update" ON properties;
DROP POLICY IF EXISTS "properties_delete" ON properties;
CREATE POLICY "properties_insert" ON properties FOR INSERT WITH CHECK (true);
CREATE POLICY "properties_update" ON properties FOR UPDATE USING (true);
CREATE POLICY "properties_delete" ON properties FOR DELETE USING (true);

-- Brokers
DROP POLICY IF EXISTS "brokers_insert" ON brokers;
DROP POLICY IF EXISTS "brokers_update" ON brokers;
DROP POLICY IF EXISTS "brokers_delete" ON brokers;
CREATE POLICY "brokers_insert" ON brokers FOR INSERT WITH CHECK (true);
CREATE POLICY "brokers_update" ON brokers FOR UPDATE USING (true);
CREATE POLICY "brokers_delete" ON brokers FOR DELETE USING (true);

-- Agencies
DROP POLICY IF EXISTS "agencies_insert_auth" ON agencies;
DROP POLICY IF EXISTS "agencies_update_auth" ON agencies;
CREATE POLICY "agencies_insert" ON agencies FOR INSERT WITH CHECK (true);
CREATE POLICY "agencies_update" ON agencies FOR UPDATE USING (true);
CREATE POLICY "agencies_delete" ON agencies FOR DELETE USING (true);

-- Branches
DROP POLICY IF EXISTS "branches_insert_auth" ON branches;
DROP POLICY IF EXISTS "branches_update_auth" ON branches;
CREATE POLICY "branches_insert" ON branches FOR INSERT WITH CHECK (true);
CREATE POLICY "branches_update" ON branches FOR UPDATE USING (true);
CREATE POLICY "branches_delete" ON branches FOR DELETE USING (true);

-- Reviews
DROP POLICY IF EXISTS "reviews_insert_auth" ON reviews;
CREATE POLICY "reviews_insert" ON reviews FOR INSERT WITH CHECK (true);
CREATE POLICY "reviews_update" ON reviews FOR UPDATE USING (true);
CREATE POLICY "reviews_delete" ON reviews FOR DELETE USING (true);

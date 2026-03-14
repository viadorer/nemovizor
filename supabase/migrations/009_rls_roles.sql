-- ============================================================
-- Nemovizor – Migration 009: Role-based RLS
-- Replaces 004_relax_rls_mvp.sql with proper role checks
-- ============================================================

-- Helper: get current user role (public schema - auth schema is restricted)
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT COALESCE(
    (SELECT role FROM public.profiles WHERE id = auth.uid()),
    'user'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: is admin?
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT public.get_user_role() = 'admin';
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper: is broker or admin?
CREATE OR REPLACE FUNCTION public.is_broker_or_admin()
RETURNS BOOLEAN AS $$
  SELECT public.get_user_role() IN ('broker', 'admin');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ===== PROPERTIES: read=all, write=admin/broker =====
DROP POLICY IF EXISTS "properties_insert" ON properties;
DROP POLICY IF EXISTS "properties_update" ON properties;
DROP POLICY IF EXISTS "properties_delete" ON properties;
DROP POLICY IF EXISTS "properties_insert_admin" ON properties;
DROP POLICY IF EXISTS "properties_update_admin_or_broker" ON properties;
DROP POLICY IF EXISTS "properties_delete_admin" ON properties;

CREATE POLICY "properties_insert_admin" ON properties FOR INSERT
  WITH CHECK (public.is_admin());
CREATE POLICY "properties_update_admin_or_broker" ON properties FOR UPDATE
  USING (
    public.is_admin() OR (
      public.is_broker_or_admin() AND broker_id IN (SELECT id FROM brokers WHERE user_id = auth.uid())
    )
  );
CREATE POLICY "properties_delete_admin" ON properties FOR DELETE
  USING (public.is_admin());

-- ===== PROJECTS: read=all, write=admin =====
DROP POLICY IF EXISTS "projects_insert_admin" ON projects;
DROP POLICY IF EXISTS "projects_update_admin" ON projects;
DROP POLICY IF EXISTS "projects_delete_admin" ON projects;

CREATE POLICY "projects_insert_admin" ON projects FOR INSERT
  WITH CHECK (public.is_admin());
CREATE POLICY "projects_update_admin" ON projects FOR UPDATE
  USING (public.is_admin());
CREATE POLICY "projects_delete_admin" ON projects FOR DELETE
  USING (public.is_admin());

-- ===== BROKERS: read=all, write=admin =====
DROP POLICY IF EXISTS "brokers_insert" ON brokers;
DROP POLICY IF EXISTS "brokers_update" ON brokers;
DROP POLICY IF EXISTS "brokers_delete" ON brokers;

CREATE POLICY "brokers_insert_admin" ON brokers FOR INSERT
  WITH CHECK (public.is_admin());
CREATE POLICY "brokers_update_admin" ON brokers FOR UPDATE
  USING (public.is_admin());
CREATE POLICY "brokers_delete_admin" ON brokers FOR DELETE
  USING (public.is_admin());

-- ===== AGENCIES: read=all, write=admin =====
DROP POLICY IF EXISTS "agencies_insert" ON agencies;
DROP POLICY IF EXISTS "agencies_update" ON agencies;
DROP POLICY IF EXISTS "agencies_delete" ON agencies;

CREATE POLICY "agencies_insert_admin" ON agencies FOR INSERT
  WITH CHECK (public.is_admin());
CREATE POLICY "agencies_update_admin" ON agencies FOR UPDATE
  USING (public.is_admin());
CREATE POLICY "agencies_delete_admin" ON agencies FOR DELETE
  USING (public.is_admin());

-- ===== BRANCHES: read=all, write=admin =====
DROP POLICY IF EXISTS "branches_insert" ON branches;
DROP POLICY IF EXISTS "branches_update" ON branches;
DROP POLICY IF EXISTS "branches_delete" ON branches;

CREATE POLICY "branches_insert_admin" ON branches FOR INSERT
  WITH CHECK (public.is_admin());
CREATE POLICY "branches_update_admin" ON branches FOR UPDATE
  USING (public.is_admin());
CREATE POLICY "branches_delete_admin" ON branches FOR DELETE
  USING (public.is_admin());

-- ===== REVIEWS: read=all, write=admin =====
DROP POLICY IF EXISTS "reviews_insert" ON reviews;
DROP POLICY IF EXISTS "reviews_update" ON reviews;
DROP POLICY IF EXISTS "reviews_delete" ON reviews;

CREATE POLICY "reviews_insert_admin" ON reviews FOR INSERT
  WITH CHECK (public.is_admin());
CREATE POLICY "reviews_update_admin" ON reviews FOR UPDATE
  USING (public.is_admin());
CREATE POLICY "reviews_delete_admin" ON reviews FOR DELETE
  USING (public.is_admin());

-- ===== PROFILES: admin can read all =====
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_select" ON profiles;

CREATE POLICY "profiles_select" ON profiles FOR SELECT
  USING (auth.uid() = id OR public.is_admin());

-- ===== CONTACT REQUESTS: broker sees own, admin sees all =====
DROP POLICY IF EXISTS "contact_requests_select_auth" ON contact_requests;
DROP POLICY IF EXISTS "contact_requests_select" ON contact_requests;

CREATE POLICY "contact_requests_select" ON contact_requests FOR SELECT
  USING (
    public.is_admin() OR (
      public.is_broker_or_admin() AND broker_id IN (SELECT id FROM brokers WHERE user_id = auth.uid())
    ) OR user_id = auth.uid()
  );

-- ===== SCRAPER RUNS: admin only =====
CREATE POLICY "scraper_runs_select_admin" ON scraper_runs FOR SELECT USING (public.is_admin());
CREATE POLICY "scraper_runs_insert_admin" ON scraper_runs FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "scraper_runs_update_admin" ON scraper_runs FOR UPDATE USING (public.is_admin());

-- ===== AUDIT LOG: admin only =====
CREATE POLICY "audit_log_select_admin" ON admin_audit_log FOR SELECT USING (public.is_admin());
CREATE POLICY "audit_log_insert_admin" ON admin_audit_log FOR INSERT WITH CHECK (public.is_admin());

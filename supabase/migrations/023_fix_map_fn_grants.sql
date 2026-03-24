-- Grant EXECUTE on map RPC functions to API roles
-- Without this, anon/authenticated get permission denied and the cluster
-- logic silently falls back to the 1000-row raw SELECT fallback.
-- Using schema-wide grant to avoid exact signature matching issues.

GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

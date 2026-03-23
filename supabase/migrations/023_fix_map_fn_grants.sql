-- Grant EXECUTE on map RPC functions to API roles
-- Without this, anon/authenticated get permission denied and the cluster
-- logic silently falls back to the 1000-row raw SELECT fallback.

GRANT EXECUTE ON FUNCTION get_map_clusters(INT, FLOAT, FLOAT, FLOAT, FLOAT, TEXT, TEXT, FLOAT, FLOAT, FLOAT, FLOAT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_map_points(TEXT, TEXT, TEXT, NUMERIC, NUMERIC, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER) TO anon, authenticated;

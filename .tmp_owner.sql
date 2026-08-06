SELECT p.proname, r.rolname AS owner, r.rolbypassrls
FROM pg_proc p JOIN pg_roles r ON r.oid = p.proowner
WHERE p.proname IN ('record_cv_consultations','get_cv_quota_today');

SELECT relrowsecurity, relforcerowsecurity, r.rolname as table_owner
FROM pg_class c JOIN pg_roles r ON r.oid = c.relowner
WHERE c.relname = 'cv_consultations';

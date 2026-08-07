SELECT routine_name, grantee FROM information_schema.role_routine_grants
WHERE routine_name IN ('approve_badge_request','reject_badge_request','revoke_badge')
ORDER BY routine_name, grantee;

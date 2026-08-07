-- =====================================================================
-- Invariant 1 a immédiatement détecté ce que ALTER DEFAULT PRIVILEGES sur
-- le schéma public accorde silencieusement à CHAQUE nouvelle table créée
-- par le rôle postgres (donc par toute migration future, sans qu'aucune
-- ligne GRANT n'apparaisse dans le fichier) : INSERT/SELECT/UPDATE/DELETE/
-- TRUNCATE/REFERENCES/TRIGGER à anon, authenticated ET service_role.
-- Probablement la cause réelle d'au moins une partie des GRANTs
-- "jamais dans une migration, jamais dans un commit" trouvés plus tôt
-- dans ce chantier (établissements, profiles...) — même classe de
-- problème, cette fois localisée à la source plutôt que corrigée table
-- par table. Le default lui-même (ALTER DEFAULT PRIVILEGES) n'est PAS
-- modifié ici — décision qui dépasse la demande de cette partie D,
-- signalée séparément pour validation explicite.
--
-- invariant_status n'a besoin que d'un SELECT pour authenticated
-- (RLS-restreint aux admins) ; l'écriture ne passe jamais par PostgREST
-- (seulement une connexion privilégiée hors authenticated/anon/service_role,
-- voir tests/security/invariants.spec.js).
-- =====================================================================

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.invariant_status FROM anon, authenticated, service_role;
REVOKE SELECT ON public.invariant_status FROM anon;

-- Même défaut côté fonctions (obj_type 'f' dans pg_default_acl accorde
-- EXECUTE à anon sur toute nouvelle fonction) : les 4 fonctions créées
-- dans les parties C et D de ce chantier l'ont hérité silencieusement —
-- REVOKE ALL ... FROM PUBLIC ne suffit pas à l'enlever (PUBLIC est un
-- pseudo-rôle distinct des rôles anon/authenticated eux-mêmes). Pas
-- exploitable (le contrôle current_user_role() = 'admin' à l'intérieur de
-- chaque fonction bloque quand même anon, qui n'a pas de session), mais
-- une fonction admin-only ne devrait pas être appelable du tout par un
-- rôle non authentifié — même principe que is_admin(uuid) corrigé le
-- 2026-08-06 (docs/incident-2026-08-06.md).
REVOKE EXECUTE ON FUNCTION public.grant_verified_recruiter_badge(UUID, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_test_account_flag(UUID, BOOLEAN, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.resolve_security_alert(UUID, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_security_alert_history(INT, TEXT, TEXT) FROM anon;

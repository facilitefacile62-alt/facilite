-- Correctif trouvé par tests/e2e/badge-requests.spec.js à sa première
-- exécution : approve_badge_request() (SECURITY DEFINER, 20260802080000)
-- essayait d'écrire profiles.badges, mais trg_protect_cosmetic_columns
-- (20260802051000) l'annulait silencieusement — has_badge() restait false
-- après une approbation "réussie" (aucune erreur renvoyée, juste un no-op).
--
-- Cause : SECURITY DEFINER change current_user (bascule vers le
-- propriétaire de la fonction, "postgres" ici — vérifié empiriquement),
-- mais PAS auth.role(), qui lit une claim JWT indépendante de current_user.
-- Le trigger ne vérifiait que auth.role() <> 'service_role' : depuis une
-- fonction SECURITY DEFINER appelée par un admin authentifié normal,
-- auth.role() reste 'authenticated' même si current_user est devenu
-- 'postgres'. Vérifié : session_user reste 'authenticator' (le rôle de
-- connexion PostgREST) dans les deux cas, donc pas un signal utilisable ici
-- — c'est bien current_user qui distingue "code serveur de confiance
-- (SECURITY DEFINER possédée par postgres)" de "requête brute du client".

CREATE OR REPLACE FUNCTION public.protect_cosmetic_columns()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.badges IS DISTINCT FROM OLD.badges OR NEW.recruiter_verified IS DISTINCT FROM OLD.recruiter_verified)
     AND auth.role() <> 'service_role'
     AND current_user <> 'postgres' THEN
    NEW.badges := OLD.badges;
    NEW.recruiter_verified := OLD.recruiter_verified;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

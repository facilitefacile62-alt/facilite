-- Correctif immédiat : REVOKE UPDATE (badges) ON profiles FROM authenticated
-- (20260802050000) s'est révélé inefficace — prouvé par
-- tests/e2e/rbac-privilege-escalation.spec.js, qui a échoué à la première
-- exécution contre la base réelle. Cause : public.profiles a un GRANT
-- UPDATE de TABLE (pas seulement de colonnes) à "authenticated" (vérifié
-- via information_schema.role_table_grants) — un REVOKE au niveau colonne
-- ne retire rien à un privilège de table déjà accordé qui couvre cette
-- même colonne. Il aurait fallu REVOKE UPDATE ON profiles FROM authenticated
-- puis regranter précisément les ~33 autres colonnes légitimement
-- modifiables par leur propriétaire — fragile (une future migration qui
-- ajoute une colonne à profiles sans penser à régranter la casserait
-- silencieusement).
--
-- Remplacé par un trigger, exactement le même mécanisme déjà éprouvé dans ce
-- projet pour "role" avant sa migration vers user_roles
-- (prevent_role_self_escalation, 20260729232500) : indépendant des GRANTs de
-- table, agit sur les valeurs de la ligne après coup.

REVOKE UPDATE (badges) ON public.profiles FROM authenticated;
REVOKE UPDATE (recruiter_verified) ON public.profiles FROM authenticated;
-- REVOKE laissé en place par cohérence documentaire malgré son inefficacité
-- prouvée seule (défense en profondeur si un jour la table perd son GRANT
-- large) ; le trigger ci-dessous est la vraie protection.

CREATE OR REPLACE FUNCTION public.protect_cosmetic_columns()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.badges IS DISTINCT FROM OLD.badges OR NEW.recruiter_verified IS DISTINCT FROM OLD.recruiter_verified)
     AND auth.role() <> 'service_role' THEN
    NEW.badges := OLD.badges;
    NEW.recruiter_verified := OLD.recruiter_verified;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS trg_protect_cosmetic_columns ON public.profiles;
CREATE TRIGGER trg_protect_cosmetic_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_cosmetic_columns();

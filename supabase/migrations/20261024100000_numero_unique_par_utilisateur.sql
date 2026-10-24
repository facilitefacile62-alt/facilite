-- Un numéro de téléphone ne peut appartenir qu'à UN seul utilisateur.
--
-- Diagnostic du 24/10/2026 : aucune contrainte d'unicité n'existe sur profiles.phone ni sur marketplace_stores.telephone_whatsapp, et la
-- production contient déjà un doublon de chaque (1 WhatsApp de boutique partagé par 2 propriétaires, 1 téléphone de profil partagé par 2
-- profils). Un index UNIQUE échouerait donc sur ces lignes ; on ne les modifie pas. À la place :
--   1. numero_deja_utilise(p_numero) : l'application demande, avant d'enregistrer, si le numéro appartient à un AUTRE utilisateur
--      (téléphone de connexion, téléphone du profil, WhatsApp d'une boutique) et prévient la personne ;
--   2. deux déclencheurs refusent, côté base, tout NOUVEAU numéro (ajout ou changement) déjà pris par un autre utilisateur. Les lignes
--      existantes ne sont pas touchées, et seuls les clients connectés sont contrôlés (auth.uid() non nul) : l'inscription, les tâches
--      serveur et l'administration ne sont pas bloquées.
-- Comparaison sur les chiffres seuls, par leurs 9 derniers chiffres (771400832 = +221 77 140 08 32).

CREATE OR REPLACE FUNCTION public.normaliser_numero(p_numero TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN length(regexp_replace(coalesce(p_numero, ''), '\D', '', 'g')) >= 9
      THEN right(regexp_replace(p_numero, '\D', '', 'g'), 9)
    ELSE regexp_replace(coalesce(p_numero, ''), '\D', '', 'g')
  END;
$$;

CREATE OR REPLACE FUNCTION public.numero_pris_par_un_autre(p_numero TEXT, p_utilisateur UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_n TEXT := public.normaliser_numero(p_numero);
BEGIN
  IF v_n = '' OR length(v_n) < 7 THEN
    RETURN FALSE;
  END IF;
  RETURN EXISTS (SELECT 1 FROM auth.users u WHERE u.id IS DISTINCT FROM p_utilisateur AND public.normaliser_numero(u.phone) = v_n)
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id IS DISTINCT FROM p_utilisateur AND public.normaliser_numero(p.phone) = v_n)
      OR EXISTS (SELECT 1 FROM public.marketplace_stores s WHERE s.owner_id IS DISTINCT FROM p_utilisateur AND public.normaliser_numero(s.telephone_whatsapp) = v_n);
END;
$$;

REVOKE ALL ON FUNCTION public.numero_pris_par_un_autre(TEXT, UUID) FROM PUBLIC, anon, authenticated;

-- Appelée par l'application avant d'enregistrer : vrai si le numéro appartient à un autre utilisateur que l'appelant.
CREATE OR REPLACE FUNCTION public.numero_deja_utilise(p_numero TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_moi UUID := auth.uid();
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.';
  END IF;
  RETURN public.numero_pris_par_un_autre(p_numero, v_moi);
END;
$$;

REVOKE ALL ON FUNCTION public.numero_deja_utilise(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.numero_deja_utilise(TEXT) TO authenticated;

-- Déclencheur du téléphone de profil : refuse un numéro déjà pris quand il CHANGE.
CREATE OR REPLACE FUNCTION public.verifier_numero_profil()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NEW.phone IS DISTINCT FROM OLD.phone
     AND coalesce(NEW.phone, '') IS DISTINCT FROM ''
     AND public.numero_pris_par_un_autre(NEW.phone, NEW.id) THEN
    RAISE EXCEPTION 'Ce numéro est déjà utilisé par un autre compte.' USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS verifier_numero_profil ON public.profiles;
CREATE TRIGGER verifier_numero_profil
  BEFORE UPDATE OF phone ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.verifier_numero_profil();

-- Déclencheur du WhatsApp de boutique : à la création et à chaque changement.
CREATE OR REPLACE FUNCTION public.verifier_numero_boutique()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND coalesce(NEW.telephone_whatsapp, '') IS DISTINCT FROM ''
     AND (TG_OP = 'INSERT' OR NEW.telephone_whatsapp IS DISTINCT FROM OLD.telephone_whatsapp)
     AND public.numero_pris_par_un_autre(NEW.telephone_whatsapp, NEW.owner_id) THEN
    RAISE EXCEPTION 'Ce numéro est déjà utilisé par un autre compte.' USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS verifier_numero_boutique ON public.marketplace_stores;
CREATE TRIGGER verifier_numero_boutique
  BEFORE INSERT OR UPDATE OF telephone_whatsapp ON public.marketplace_stores
  FOR EACH ROW EXECUTE FUNCTION public.verifier_numero_boutique();

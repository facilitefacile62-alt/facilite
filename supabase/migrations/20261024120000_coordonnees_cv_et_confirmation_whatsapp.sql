-- 1) Coordonnées DU CV : trois colonnes À PART (téléphone, e-mail, ville du CV), vides tant que la personne ne les remplit pas.
--    Les colonnes phone / contact_email / city du profil sont préremplies ou utilisées ailleurs (inscription, numéro de compte) : elles
--    ne servent plus d'écran « Coordonnées du CV ». Lecture et écriture réservées à la personne (même règle que le reste du profil :
--    policies « son propre profil », droits par colonne).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cv_telephone TEXT,
  ADD COLUMN IF NOT EXISTS cv_email TEXT,
  ADD COLUMN IF NOT EXISTS cv_ville TEXT;

GRANT SELECT (cv_telephone, cv_email, cv_ville), UPDATE (cv_telephone, cv_email, cv_ville) ON public.profiles TO authenticated;

-- 2) Confirmation du WhatsApp d'une boutique par un code envoyé SUR WhatsApp.
--    whatsapp_confirme_numero garde le numéro (9 derniers chiffres) qui a été confirmé : la boutique est « confirmée » seulement tant que son
--    numéro WhatsApp actuel est celui-là. Dès que le numéro change, la confirmation disparaît (déclencheur ci-dessous).
ALTER TABLE public.marketplace_stores
  ADD COLUMN IF NOT EXISTS whatsapp_confirme_numero TEXT;

-- Codes en attente : jamais le code en clair, seulement son empreinte (SHA-256 de « code:identifiant de la boutique »). Table réservée au
-- serveur : aucune policy, aucun droit pour les clients ; les codes sont créés par la route /api/marketplace/whatsapp-code (rôle serveur,
-- après contrôle du propriétaire) et vérifiés par confirmer_whatsapp_boutique().
CREATE TABLE IF NOT EXISTS public.whatsapp_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.marketplace_stores(id) ON DELETE CASCADE,
  numero TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  tentatives INTEGER NOT NULL DEFAULT 0,
  expire_le TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.whatsapp_confirmations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.whatsapp_confirmations FROM PUBLIC, anon, authenticated;
CREATE INDEX IF NOT EXISTS whatsapp_confirmations_store ON public.whatsapp_confirmations (store_id, created_at DESC);

-- Vérifie le code saisi par le propriétaire. Résultats : confirme | code_incorrect | expire | trop_de_tentatives | aucun_code.
CREATE OR REPLACE FUNCTION public.confirmer_whatsapp_boutique(p_store_id UUID, p_code TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_moi UUID := auth.uid();
  v_numero TEXT;
  v_ligne public.whatsapp_confirmations%ROWTYPE;
  v_hash TEXT;
BEGIN
  IF v_moi IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.';
  END IF;

  SELECT public.normaliser_numero(s.telephone_whatsapp) INTO v_numero
    FROM public.marketplace_stores s
   WHERE s.id = p_store_id AND s.owner_id = v_moi;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Boutique introuvable.';
  END IF;

  SELECT * INTO v_ligne
    FROM public.whatsapp_confirmations c
   WHERE c.store_id = p_store_id
   ORDER BY c.created_at DESC
   LIMIT 1;
  -- Aucun code, ou code envoyé pour un AUTRE numéro que l'actuel (le numéro a changé depuis) : il faut en demander un nouveau.
  IF NOT FOUND OR v_ligne.numero IS DISTINCT FROM v_numero THEN
    RETURN 'aucun_code';
  END IF;
  IF v_ligne.expire_le < now() THEN
    RETURN 'expire';
  END IF;
  IF v_ligne.tentatives >= 5 THEN
    RETURN 'trop_de_tentatives';
  END IF;

  UPDATE public.whatsapp_confirmations SET tentatives = tentatives + 1 WHERE id = v_ligne.id;

  v_hash := encode(sha256(convert_to(coalesce(p_code, '') || ':' || p_store_id::TEXT, 'UTF8')), 'hex');
  IF v_hash IS DISTINCT FROM v_ligne.code_hash THEN
    RETURN 'code_incorrect';
  END IF;

  UPDATE public.marketplace_stores SET whatsapp_confirme_numero = v_numero WHERE id = p_store_id;
  DELETE FROM public.whatsapp_confirmations WHERE store_id = p_store_id;
  RETURN 'confirme';
END;
$$;

REVOKE ALL ON FUNCTION public.confirmer_whatsapp_boutique(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirmer_whatsapp_boutique(UUID, TEXT) TO authenticated;

-- Changer de numéro WhatsApp efface la confirmation (sauf simple changement de forme du même numéro : +221 77… / 77…).
CREATE OR REPLACE FUNCTION public.reinitialiser_confirmation_whatsapp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF public.normaliser_numero(NEW.telephone_whatsapp) IS DISTINCT FROM public.normaliser_numero(OLD.telephone_whatsapp)
     AND NEW.whatsapp_confirme_numero IS NOT DISTINCT FROM OLD.whatsapp_confirme_numero THEN
    NEW.whatsapp_confirme_numero := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reinitialiser_confirmation_whatsapp ON public.marketplace_stores;
CREATE TRIGGER reinitialiser_confirmation_whatsapp
  BEFORE UPDATE OF telephone_whatsapp ON public.marketplace_stores
  FOR EACH ROW EXECUTE FUNCTION public.reinitialiser_confirmation_whatsapp();

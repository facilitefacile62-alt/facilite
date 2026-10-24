-- « Achat de CV » — point 2 : paiement Orange Money (même circuit que les jetons et la formation CV).
--
--  - cv_achat_webhook_events : journal d'idempotence du webhook commun (src/lib/webhookOrange.js), une table par produit, comme
--    jetons_webhook_events et formation_redaction_cv_webhook_events. Aucun droit ni règle côté client : lu et écrit par le serveur seulement.
--  - un seul achat « pending » à la fois par acheteur ET par modèle (index unique partiel) ;
--  - preparer_achat_cv() : appelée UNIQUEMENT par le serveur (rôle service_role). Le prix est lu ICI, dans cv_modeles, jamais fourni par le
--    navigateur ; elle refuse un modèle déjà acheté, renvoie le paiement encore valable s'il y en a un (au lieu d'en ouvrir un second) et
--    marque « failed » les anciens paiements périmés (un paiement réussi confirmé plus tard reste crédité : pending OU failed → success).

CREATE TABLE IF NOT EXISTS public.cv_achat_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL UNIQUE,
  status TEXT,
  orange_transaction_id TEXT,
  reference TEXT,
  achat_id UUID REFERENCES public.cv_achats(id),
  raw_payload JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.cv_achat_webhook_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cv_achat_webhook_events FROM PUBLIC, anon, authenticated;
CREATE INDEX IF NOT EXISTS cv_achat_webhook_events_achat ON public.cv_achat_webhook_events (achat_id);
CREATE INDEX IF NOT EXISTS cv_achat_webhook_events_recu ON public.cv_achat_webhook_events (received_at DESC);

-- Un seul paiement en attente par acheteur et par modèle.
CREATE UNIQUE INDEX IF NOT EXISTS cv_achats_un_pending ON public.cv_achats (user_id, modele_id) WHERE status = 'pending';

CREATE OR REPLACE FUNCTION public.preparer_achat_cv(p_user_id UUID, p_modele_id UUID, p_callback_token_hash TEXT)
RETURNS TABLE (etat TEXT, achat_id UUID, montant_xof INTEGER, nom TEXT, reste_secondes INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_modele public.cv_modeles%ROWTYPE;
  v_encours public.cv_achats%ROWTYPE;
  v_nouveau UUID;
  -- Validité du QR (300 s, voir QR_VALIDITE_SECONDES) + 10 s de marge pour l'ouverture du paiement chez Orange.
  v_validite CONSTANT INTEGER := 310;
BEGIN
  -- Deux demandes simultanées du même acheteur pour le même modèle passent l'une après l'autre.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::TEXT || ':' || p_modele_id::TEXT, 0));

  SELECT * INTO v_modele FROM public.cv_modeles m WHERE m.id = p_modele_id AND m.actif;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'modele_introuvable'::TEXT, NULL::UUID, NULL::INTEGER, NULL::TEXT, NULL::INTEGER;
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.cv_achats a WHERE a.user_id = p_user_id AND a.modele_id = p_modele_id AND a.status = 'success') THEN
    RETURN QUERY SELECT 'deja_achete'::TEXT, NULL::UUID, NULL::INTEGER, v_modele.nom, NULL::INTEGER;
    RETURN;
  END IF;

  SELECT * INTO v_encours FROM public.cv_achats a
   WHERE a.user_id = p_user_id AND a.modele_id = p_modele_id AND a.status = 'pending'
   ORDER BY a.created_at DESC LIMIT 1 FOR UPDATE;
  IF FOUND THEN
    -- Paiement encore valable (QR créé), ou demande toute récente dont le QR est en cours de création : on n'en ouvre pas un second.
    IF v_encours.created_at > now() - make_interval(secs => v_validite)
       AND (v_encours.provider_reference IS NOT NULL OR v_encours.created_at > now() - make_interval(secs => 20)) THEN
      RETURN QUERY SELECT 'en_cours'::TEXT, v_encours.id, v_encours.montant_xof, v_modele.nom,
        GREATEST(0, 300 - EXTRACT(EPOCH FROM (now() - v_encours.created_at))::INTEGER);
      RETURN;
    END IF;
    -- Périmé : « failed » (jamais supprimé — si Orange confirme plus tard un paiement réel, il sera crédité).
    UPDATE public.cv_achats a SET status = 'failed' WHERE a.user_id = p_user_id AND a.modele_id = p_modele_id AND a.status = 'pending';
  END IF;

  INSERT INTO public.cv_achats (user_id, modele_id, montant_xof, status, callback_token_hash)
  VALUES (p_user_id, p_modele_id, v_modele.prix_xof, 'pending', p_callback_token_hash)
  RETURNING id INTO v_nouveau;
  RETURN QUERY SELECT 'cree'::TEXT, v_nouveau, v_modele.prix_xof, v_modele.nom, 300;
END;
$$;
REVOKE ALL ON FUNCTION public.preparer_achat_cv(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.preparer_achat_cv(UUID, UUID, TEXT) TO service_role;

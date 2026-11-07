-- Aide unifiée (support + assistant IA, un seul point d'entrée) — SITE WEB.
-- Derrière l'interrupteur feat_aide_unifiee (désactivé par défaut).
-- Retour arrière : docs/rollbacks/20261107120000_aide_unifiee.down.sql
-- NON APPLIQUÉE : aucune base ne reçoit ce fichier sans « go » écrit séparé.
--
-- Principes :
--  * on réutilise assistant_messages (IA), messages SUPPORT + support_threads (humain), notifications ;
--  * aucun contenu de message dans les tables de comptage (jetons et coûts seulement) ;
--  * tout ce qui compte la dépense est écrit par le serveur (service_role) ; les administrateurs
--    lisent par policy SELECT et modifient les réglages par une fonction réservée aux admins ;
--  * aucun droit UPDATE/DELETE donné à authenticated ou anon.

-- 1. Réglages (une seule ligne) -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.aide_reglages (
  id                        SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  ia_active                 BOOLEAN NOT NULL DEFAULT false,            -- interrupteur d'urgence de l'IA
  limite_ia_par_jour        INTEGER NOT NULL DEFAULT 10  CHECK (limite_ia_par_jour BETWEEN 0 AND 200),
  longueur_max_message      INTEGER NOT NULL DEFAULT 500 CHECK (longueur_max_message BETWEEN 50 AND 2000),
  max_tokens                INTEGER NOT NULL DEFAULT 300 CHECK (max_tokens BETWEEN 50 AND 1500),
  plafond_jour_usd          NUMERIC(8,2) NOT NULL DEFAULT 1.00 CHECK (plafond_jour_usd >= 0),
  plafond_mois_usd          NUMERIC(8,2) NOT NULL DEFAULT 5.00 CHECK (plafond_mois_usd >= 0),
  conservation_vocaux_jours INTEGER NOT NULL DEFAULT 30 CHECK (conservation_vocaux_jours BETWEEN 1 AND 365),
  vocaux_par_jour           INTEGER NOT NULL DEFAULT 5   CHECK (vocaux_par_jour BETWEEN 0 AND 50),
  vocal_secondes_max        INTEGER NOT NULL DEFAULT 60  CHECK (vocal_secondes_max BETWEEN 5 AND 120),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by                UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
INSERT INTO public.aide_reglages (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.aide_reglages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Un admin lit les réglages de l'aide" ON public.aide_reglages;
CREATE POLICY "Un admin lit les réglages de l'aide" ON public.aide_reglages
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
REVOKE ALL ON public.aide_reglages FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.aide_reglages TO authenticated;
GRANT ALL ON public.aide_reglages TO service_role;

-- 2. Usage par jour (global) et par utilisateur ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.aide_usage_jour (
  jour            DATE PRIMARY KEY DEFAULT CURRENT_DATE,
  demandes        INTEGER NOT NULL DEFAULT 0,
  preparees       INTEGER NOT NULL DEFAULT 0,
  memoire         INTEGER NOT NULL DEFAULT 0,
  appels_ia       INTEGER NOT NULL DEFAULT 0,
  escalades       INTEGER NOT NULL DEFAULT 0,
  jetons_entree   BIGINT NOT NULL DEFAULT 0,
  jetons_sortie   BIGINT NOT NULL DEFAULT 0,
  jetons_cache    BIGINT NOT NULL DEFAULT 0,
  cout_micro_usd  BIGINT NOT NULL DEFAULT 0          -- 1 000 000 = 1 $
);
ALTER TABLE public.aide_usage_jour ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Un admin lit l'usage de l'aide" ON public.aide_usage_jour;
CREATE POLICY "Un admin lit l'usage de l'aide" ON public.aide_usage_jour
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
REVOKE ALL ON public.aide_usage_jour FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.aide_usage_jour TO authenticated;
GRANT ALL ON public.aide_usage_jour TO service_role;

CREATE TABLE IF NOT EXISTS public.aide_usage_utilisateur_jour (
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  jour        DATE NOT NULL DEFAULT CURRENT_DATE,
  appels_ia   INTEGER NOT NULL DEFAULT 0,
  vocaux      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, jour)
);
ALTER TABLE public.aide_usage_utilisateur_jour ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Un admin lit l'usage par personne" ON public.aide_usage_utilisateur_jour;
CREATE POLICY "Un admin lit l'usage par personne" ON public.aide_usage_utilisateur_jour
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
REVOKE ALL ON public.aide_usage_utilisateur_jour FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.aide_usage_utilisateur_jour TO authenticated;
GRANT ALL ON public.aide_usage_utilisateur_jour TO service_role;

-- 3. Mémoire des réponses génériques (jamais de donnée personnelle) --------------------------
CREATE TABLE IF NOT EXISTS public.aide_reponses_cache (
  cle           TEXT PRIMARY KEY,                    -- empreinte de la question normalisée
  reponse       TEXT NOT NULL,
  utilisations  INTEGER NOT NULL DEFAULT 1,
  cree_le       TIMESTAMPTZ NOT NULL DEFAULT now(),
  expire_le     TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days')
);
CREATE INDEX IF NOT EXISTS idx_aide_reponses_cache_expire ON public.aide_reponses_cache (expire_le);
ALTER TABLE public.aide_reponses_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Un admin lit la mémoire des réponses" ON public.aide_reponses_cache;
CREATE POLICY "Un admin lit la mémoire des réponses" ON public.aide_reponses_cache
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
REVOKE ALL ON public.aide_reponses_cache FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.aide_reponses_cache TO authenticated;
GRANT ALL ON public.aide_reponses_cache TO service_role;

-- 4. Messages vocaux à l'équipe --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.aide_messages_vocaux (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chemin           TEXT NOT NULL,
  duree_secondes   INTEGER NOT NULL CHECK (duree_secondes BETWEEN 1 AND 120),
  taille_octets    INTEGER NOT NULL CHECK (taille_octets BETWEEN 1 AND 1048576),
  cree_le          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_aide_messages_vocaux_user ON public.aide_messages_vocaux (user_id, cree_le);
ALTER TABLE public.aide_messages_vocaux ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Une personne lit ses vocaux" ON public.aide_messages_vocaux;
CREATE POLICY "Une personne lit ses vocaux" ON public.aide_messages_vocaux
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Un admin lit les vocaux" ON public.aide_messages_vocaux;
CREATE POLICY "Un admin lit les vocaux" ON public.aide_messages_vocaux
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
REVOKE ALL ON public.aide_messages_vocaux FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.aide_messages_vocaux TO authenticated;
GRANT ALL ON public.aide_messages_vocaux TO service_role;

-- Bucket privé : écrit et lu uniquement par le serveur (adresses signées de courte durée),
-- donc aucune policy storage pour authenticated/anon.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('aide-vocaux', 'aide-vocaux', false, 1048576,
        ARRAY['audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/aac','audio/x-m4a'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 1048576,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 5. Fonctions réservées au serveur (service_role) -------------------------------------------
-- Réserve atomiquement un appel IA pour cette personne aujourd'hui ; false si la limite est atteinte.
CREATE OR REPLACE FUNCTION public.aide_reserver_ia(p_user_id UUID, p_limite INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_lignes INTEGER;
BEGIN
  INSERT INTO public.aide_usage_utilisateur_jour (user_id, jour, appels_ia)
  VALUES (p_user_id, CURRENT_DATE, 1)
  ON CONFLICT (user_id, jour) DO UPDATE
    SET appels_ia = public.aide_usage_utilisateur_jour.appels_ia + 1
    WHERE public.aide_usage_utilisateur_jour.appels_ia < p_limite;
  GET DIAGNOSTICS v_lignes = ROW_COUNT;
  RETURN v_lignes > 0;
END;
$$;

-- Réserve un vocal pour cette personne aujourd'hui ; false si la limite est atteinte.
CREATE OR REPLACE FUNCTION public.aide_reserver_vocal(p_user_id UUID, p_limite INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_lignes INTEGER;
BEGIN
  INSERT INTO public.aide_usage_utilisateur_jour (user_id, jour, vocaux)
  VALUES (p_user_id, CURRENT_DATE, 1)
  ON CONFLICT (user_id, jour) DO UPDATE
    SET vocaux = public.aide_usage_utilisateur_jour.vocaux + 1
    WHERE public.aide_usage_utilisateur_jour.vocaux < p_limite;
  GET DIAGNOSTICS v_lignes = ROW_COUNT;
  RETURN v_lignes > 0;
END;
$$;

-- Écrit une ligne d'usage : source = 'preparee' | 'memoire' | 'ia' | 'escalade'.
CREATE OR REPLACE FUNCTION public.aide_enregistrer_usage(
  p_source TEXT, p_entree INTEGER, p_sortie INTEGER, p_cache INTEGER, p_cout_micro BIGINT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.aide_usage_jour (jour, demandes, preparees, memoire, appels_ia, escalades,
                                      jetons_entree, jetons_sortie, jetons_cache, cout_micro_usd)
  VALUES (CURRENT_DATE, 1,
          CASE WHEN p_source = 'preparee' THEN 1 ELSE 0 END,
          CASE WHEN p_source = 'memoire' THEN 1 ELSE 0 END,
          CASE WHEN p_source = 'ia' THEN 1 ELSE 0 END,
          CASE WHEN p_source = 'escalade' THEN 1 ELSE 0 END,
          GREATEST(coalesce(p_entree, 0), 0), GREATEST(coalesce(p_sortie, 0), 0),
          GREATEST(coalesce(p_cache, 0), 0), GREATEST(coalesce(p_cout_micro, 0), 0))
  ON CONFLICT (jour) DO UPDATE SET
    demandes = public.aide_usage_jour.demandes + 1,
    preparees = public.aide_usage_jour.preparees + CASE WHEN p_source = 'preparee' THEN 1 ELSE 0 END,
    memoire = public.aide_usage_jour.memoire + CASE WHEN p_source = 'memoire' THEN 1 ELSE 0 END,
    appels_ia = public.aide_usage_jour.appels_ia + CASE WHEN p_source = 'ia' THEN 1 ELSE 0 END,
    escalades = public.aide_usage_jour.escalades + CASE WHEN p_source = 'escalade' THEN 1 ELSE 0 END,
    jetons_entree = public.aide_usage_jour.jetons_entree + GREATEST(coalesce(p_entree, 0), 0),
    jetons_sortie = public.aide_usage_jour.jetons_sortie + GREATEST(coalesce(p_sortie, 0), 0),
    jetons_cache = public.aide_usage_jour.jetons_cache + GREATEST(coalesce(p_cache, 0), 0),
    cout_micro_usd = public.aide_usage_jour.cout_micro_usd + GREATEST(coalesce(p_cout_micro, 0), 0);
END;
$$;

-- Dépense estimée du jour et du mois en cours (micro-dollars).
CREATE OR REPLACE FUNCTION public.aide_cout_actuel()
RETURNS TABLE (cout_jour BIGINT, cout_mois BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    coalesce(sum(u.cout_micro_usd) FILTER (WHERE u.jour = CURRENT_DATE), 0)::bigint,
    coalesce(sum(u.cout_micro_usd) FILTER (WHERE u.jour >= date_trunc('month', CURRENT_DATE)::date), 0)::bigint
  FROM public.aide_usage_jour u;
$$;

-- Vocaux dont le fil de support est résolu depuis plus de p_jours jours.
CREATE OR REPLACE FUNCTION public.aide_vocaux_a_purger(p_jours INTEGER)
RETURNS TABLE (id UUID, chemin TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT v.id, v.chemin
  FROM public.aide_messages_vocaux v
  JOIN public.support_threads t ON t.user_id = v.user_id
  WHERE t.status = 'resolved'
    AND t.updated_at < now() - make_interval(days => p_jours);
$$;

REVOKE ALL ON FUNCTION public.aide_reserver_ia(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.aide_reserver_vocal(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.aide_enregistrer_usage(TEXT, INTEGER, INTEGER, INTEGER, BIGINT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.aide_cout_actuel() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.aide_vocaux_a_purger(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.aide_reserver_ia(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.aide_reserver_vocal(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.aide_enregistrer_usage(TEXT, INTEGER, INTEGER, INTEGER, BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION public.aide_cout_actuel() TO service_role;
GRANT EXECUTE ON FUNCTION public.aide_vocaux_a_purger(INTEGER) TO service_role;

-- 6. Fonctions réservées aux administrateurs (connectés) -------------------------------------
-- Historique de l'assistant d'une personne, pour que l'équipe voie tout sans que la personne se répète.
CREATE OR REPLACE FUNCTION public.aide_historique_admin(p_user_id UUID)
RETURNS TABLE (role TEXT, content TEXT, created_at TIMESTAMPTZ)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Réservé aux administrateurs.';
  END IF;
  RETURN QUERY
    SELECT m.role, m.content, m.created_at
    FROM (
      SELECT am.role, am.content, am.created_at
      FROM public.assistant_messages am
      WHERE am.user_id = p_user_id
      ORDER BY am.created_at DESC
      LIMIT 50
    ) m
    ORDER BY m.created_at ASC;
END;
$$;

-- Modifie les réglages (interrupteur d'urgence, limites, plafonds) sans redéployer.
CREATE OR REPLACE FUNCTION public.aide_modifier_reglages(p_donnees JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Réservé aux administrateurs.';
  END IF;
  UPDATE public.aide_reglages SET
    ia_active = coalesce((p_donnees->>'ia_active')::boolean, ia_active),
    limite_ia_par_jour = coalesce((p_donnees->>'limite_ia_par_jour')::int, limite_ia_par_jour),
    longueur_max_message = coalesce((p_donnees->>'longueur_max_message')::int, longueur_max_message),
    max_tokens = coalesce((p_donnees->>'max_tokens')::int, max_tokens),
    plafond_jour_usd = coalesce((p_donnees->>'plafond_jour_usd')::numeric, plafond_jour_usd),
    plafond_mois_usd = coalesce((p_donnees->>'plafond_mois_usd')::numeric, plafond_mois_usd),
    conservation_vocaux_jours = coalesce((p_donnees->>'conservation_vocaux_jours')::int, conservation_vocaux_jours),
    vocaux_par_jour = coalesce((p_donnees->>'vocaux_par_jour')::int, vocaux_par_jour),
    vocal_secondes_max = coalesce((p_donnees->>'vocal_secondes_max')::int, vocal_secondes_max),
    updated_at = now(),
    updated_by = auth.uid()
  WHERE id = 1;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.aide_historique_admin(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.aide_modifier_reglages(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aide_historique_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aide_modifier_reglages(JSONB) TO authenticated;

-- 7. Interrupteur du panneau « Aide » (désactivé par défaut) ---------------------------------
INSERT INTO public.feature_flags (id, branch_id, name, path, enabled, roles, updated_at)
VALUES (
  'feat_aide_unifiee',
  'branch_services',
  'Aide unifiée (support + assistant IA)',
  NULL,
  false,
  '{"user": true, "visitor": false, "recruiter": true}'::jsonb,
  now()
)
ON CONFLICT (id) DO NOTHING;

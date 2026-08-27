-- Point 2 (2026-08-27) : une seule candidature par offre et par candidat.
--
-- Résultat brut avant correction, relevé en production :
--   contraintes sur public.candidatures -> pkey(id) + 3 FK + un CHECK sur
--   status. AUCUN index unique composite. Le contrôle applicatif présent
--   dans /api/postuler porte sur la CONVERSATION existante, pas sur la
--   candidature.
--   146 lignes, dont 13 paires (job_offer_id, user_id) déjà en doublon —
--   jusqu'à 5 candidatures du même candidat sur la même offre — et 25
--   candidatures spontanées (job_offer_id NULL).
--
-- POURQUOI UN DÉCLENCHEUR ET NON UN INDEX UNIQUE PARTIEL
--
-- L'index unique partiel demandé, borné aux nouvelles lignes par un
-- prédicat sur created_at, ne couvrirait PAS le cas principal : un candidat
-- ayant postulé AVANT la date de bascule pourrait repostuler après, parce
-- que sa ligne ancienne resterait hors de l'index et ne provoquerait aucun
-- conflit. Or c'est exactement le comportement que ce point veut empêcher.
-- Un index unique complet, lui, refuserait tout simplement d'être créé tant
-- que les 13 paires en doublon existent.
--
-- Le déclencheur ci-dessous tient les deux exigences ensemble : il ne
-- touche à AUCUNE ligne existante (les doublons déjà en base restent tels
-- quels et personne n'est bloqué rétroactivement) et il compare chaque
-- nouvelle candidature à TOUT l'historique, pas seulement aux lignes
-- récentes.
--
-- Les candidatures spontanées (job_offer_id NULL) restent volontairement
-- libres : sans offre rattachée, il n'y a rien à dédoublonner, et un
-- candidat doit pouvoir en déposer plusieurs.

CREATE OR REPLACE FUNCTION public.empecher_candidature_doublon()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Candidature spontanée : aucune offre à dédoublonner.
  IF NEW.job_offer_id IS NULL OR NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.candidatures c
    WHERE c.job_offer_id = NEW.job_offer_id
      AND c.user_id = NEW.user_id
      AND c.id IS DISTINCT FROM NEW.id
  ) THEN
    -- ERRCODE 23505 (unique_violation) volontairement : l'appelant traite
    -- déjà ce code comme un conflit, le message reste lisible côté API.
    RAISE EXCEPTION 'Vous avez déjà postulé à cette offre.'
      USING ERRCODE = '23505', HINT = 'candidature_doublon';
  END IF;

  RETURN NEW;
END;
$$;

-- SECURITY DEFINER : la vérification doit voir TOUTES les candidatures de
-- l'offre, y compris celles qu'une policy RLS masquerait à l'appelant.
-- search_path figé (invariant 3).

DROP TRIGGER IF EXISTS trg_candidature_unique_par_offre ON public.candidatures;
CREATE TRIGGER trg_candidature_unique_par_offre
  BEFORE INSERT ON public.candidatures
  FOR EACH ROW
  EXECUTE FUNCTION public.empecher_candidature_doublon();

-- Index NON unique : le déclencheur fait un EXISTS sur (job_offer_id,
-- user_id) à chaque insertion, les deux index simples existants obligeraient
-- à filtrer ensuite ligne à ligne.
CREATE INDEX IF NOT EXISTS idx_candidatures_offre_candidat
  ON public.candidatures (job_offer_id, user_id)
  WHERE job_offer_id IS NOT NULL;

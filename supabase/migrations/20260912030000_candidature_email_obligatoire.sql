-- Règle métier : l'adresse email est strictement obligatoire pour
-- candidater sur Facilité. Vérifié avant d'écrire quoi que ce soit :
-- profiles.email est nullable depuis 20260801190000 (comptes créés par
-- téléphone avant le 21/08/2026 signInWithOtp(shouldCreateUser:true) —
-- corrigé depuis, signup téléphone désormais impossible, mais ces comptes
-- existent toujours en production sans email). Cette règle bloque donc
-- réellement des utilisateurs déjà existants, pas seulement hypothétiques.
--
-- "Intention" de candidater mémorisée côté serveur, liée au compte
-- (jamais sessionStorage/état client) : un lien de validation d'email
-- s'ouvre souvent dans un nouvel onglet ou un autre appareil, sans accès à
-- l'état du navigateur d'origine. Champs volontairement minimaux (pas de
-- CV/lettre de motivation) : l'interception a lieu AVANT l'ouverture du
-- formulaire de candidature (src/components/OffreApplySection.jsx), qui
-- est le seul endroit où ces informations existent — la finalisation
-- automatique utilise donc le CV le plus récent déjà au dossier du
-- candidat (public.resumes), jamais un fichier inventé.

CREATE TABLE IF NOT EXISTS public.candidature_intentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id INTEGER,
  job_offer_id UUID,
  recruiter_id UUID,
  job_title TEXT NOT NULL,
  company TEXT NOT NULL,
  recruiter_email TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'offre_indisponible', 'necessite_action')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_candidature_intentions_user ON public.candidature_intentions(user_id);

-- Une seule intention "pending" par (utilisateur, offre) : cliquer
-- plusieurs fois sur "Postuler" avant d'avoir confirmé son email ne doit
-- pas empiler des lignes identiques. COALESCE sur des littéraux fixes
-- (pas d'appel non-IMMUTABLE) : autorisé dans un index partiel.
CREATE UNIQUE INDEX IF NOT EXISTS ux_candidature_intentions_pending
  ON public.candidature_intentions (
    user_id,
    COALESCE(job_offer_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(job_id, -1)
  )
  WHERE status = 'pending';

ALTER TABLE public.candidature_intentions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Un candidat lit ses propres intentions" ON public.candidature_intentions;
CREATE POLICY "Un candidat lit ses propres intentions" ON public.candidature_intentions
  FOR SELECT USING (auth.uid() = user_id);

-- Insertion directe par le client authentifié (pas de fonction dédiée
-- nécessaire ici : contrairement à activer_premium_marketplace, il n'y a
-- pas de solde/contrainte métier à vérifier atomiquement, juste
-- mémoriser une intention). Jamais de GRANT UPDATE/DELETE à
-- authenticated : la résolution (passage à completed/offre_indisponible/
-- necessite_action) se fait uniquement via finaliser_candidatures_en_attente
-- ci-dessous, SECURITY DEFINER.
DROP POLICY IF EXISTS "Un candidat cree sa propre intention" ON public.candidature_intentions;
CREATE POLICY "Un candidat cree sa propre intention" ON public.candidature_intentions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT ON public.candidature_intentions TO authenticated;

-- ---------------------------------------------------------------------------
-- finaliser_candidatures_en_attente — appelée par le client authentifié
-- (typiquement juste après connexion, voir AuthContext.jsx) : ne fait
-- jamais rien tant que l'email du compte appelant n'est pas confirmé (donc
-- inoffensive à appeler "au cas où" à chaque connexion), puis traite
-- CHACUNE de ses propres intentions en attente.
--
-- Revérifie l'offre (Point 4 : ne jamais soumettre silencieusement une
-- candidature à une offre qui a expiré ou disparu entre l'interception et
-- la validation de l'email) avant toute création. Utilise le CV le plus
-- récent déjà au dossier (public.resumes) : sans aucun CV, la candidature
-- ne peut pas être créée automatiquement — marquée "necessite_action"
-- plutôt que silencieusement abandonnée ou fabriquée sans document.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finaliser_candidatures_en_attente()
RETURNS TABLE(intention_id UUID, resultat TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_email TEXT;
  v_email_confirme BOOLEAN;
  v_full_name TEXT;
  v_intention RECORD;
  v_resume_id UUID;
  v_resume_url TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Connexion requise.';
  END IF;

  SELECT email, (email_confirmed_at IS NOT NULL) INTO v_email, v_email_confirme
  FROM auth.users WHERE id = v_user_id;

  IF v_email IS NULL OR NOT v_email_confirme THEN
    RETURN; -- Email toujours pas confirmé : rien à finaliser pour l'instant.
  END IF;

  SELECT full_name INTO v_full_name FROM public.profiles WHERE id = v_user_id;

  FOR v_intention IN
    SELECT * FROM public.candidature_intentions
    WHERE user_id = v_user_id AND status = 'pending'
    ORDER BY created_at ASC
  LOOP
    -- Offre "vraie" (job_offer_id, UUID) : revérifie qu'elle existe encore,
    -- qu'elle est active et pas expirée. Flux historique (job_id entier,
    -- offres statiques sans table dédiée) : rien à revérifier, ce flux n'a
    -- jamais eu de notion d'expiration.
    IF v_intention.job_offer_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.job_offers
        WHERE id = v_intention.job_offer_id
          AND is_active = true
          AND lower(coalesce(status, '')) NOT IN ('expired', 'closed', 'archived', 'archive', 'expiree', 'expirée')
          AND (deadline IS NULL OR deadline >= CURRENT_DATE)
      ) THEN
        UPDATE public.candidature_intentions
        SET status = 'offre_indisponible', resolved_at = now()
        WHERE id = v_intention.id;

        intention_id := v_intention.id;
        resultat := 'offre_indisponible';
        RETURN NEXT;
        CONTINUE;
      END IF;
    END IF;

    -- CV le plus récent au dossier du candidat — jamais inventé.
    SELECT id, file_url INTO v_resume_id, v_resume_url
    FROM public.resumes
    WHERE user_id = v_user_id AND file_url IS NOT NULL AND btrim(file_url) <> ''
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_resume_id IS NULL THEN
      UPDATE public.candidature_intentions
      SET status = 'necessite_action', resolved_at = now()
      WHERE id = v_intention.id;

      intention_id := v_intention.id;
      resultat := 'necessite_action';
      RETURN NEXT;
      CONTINUE;
    END IF;

    BEGIN
      INSERT INTO public.candidatures
        (user_id, job_id, job_offer_id, recruiter_id, job_title, company, full_name, email, recruiter_email, cv_url, status)
      VALUES (
        v_user_id, v_intention.job_id, v_intention.job_offer_id, v_intention.recruiter_id,
        v_intention.job_title, v_intention.company,
        coalesce(v_full_name, 'Candidat Facilité'),
        v_email, v_intention.recruiter_email, v_resume_url, 'pending'
      );

      UPDATE public.candidature_intentions
      SET status = 'completed', resolved_at = now()
      WHERE id = v_intention.id;

      intention_id := v_intention.id;
      resultat := 'completed';
      RETURN NEXT;
    EXCEPTION WHEN unique_violation THEN
      -- Déjà postulé entre-temps (trg_candidature_unique_par_offre,
      -- 20260827130000) : pas une erreur, rien de plus à faire ici.
      UPDATE public.candidature_intentions
      SET status = 'completed', resolved_at = now()
      WHERE id = v_intention.id;

      intention_id := v_intention.id;
      resultat := 'completed';
      RETURN NEXT;
    END;
  END LOOP;

  RETURN;
END;
$$;

-- SECURITY DEFINER mais sans risque d'élévation de privilège : la fonction
-- n'agit jamais que sur auth.uid() (l'appelant lui-même) et ses propres
-- intentions/candidatures — appelable largement par tout utilisateur
-- authentifié, comme activer_premium_marketplace (même famille de
-- fonctions "j'agis sur mon propre compte").
REVOKE ALL ON FUNCTION public.finaliser_candidatures_en_attente() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finaliser_candidatures_en_attente() TO authenticated;

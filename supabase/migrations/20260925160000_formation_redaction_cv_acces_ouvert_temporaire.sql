-- Ouvre temporairement l'accès aux modules/quiz/exercices de la formation
-- "Rédaction de CV" à tout compte connecté, sans exiger paye=true — demande
-- explicite de l'utilisateur : "ne pas exiger le paiement pour accéder à la
-- formation pour l'instant... le champ paye reste dans la table, prêt à
-- être réactivé comme condition d'accès plus tard quand ce sera voulu."
--
-- Ne touche NI à la page de paiement (écran 1, inchangée), NI à la colonne
-- paye elle-même, NI à la logique de certification (soumettre_quiz_module
-- continue de lire/écrire paye/certifie normalement — seule la GARDE
-- "Formation non payee" qui bloquait l'accès est retirée). Pour réactiver
-- le paiement comme condition d'accès plus tard : remettre les 2 policies
-- SELECT ci-dessous à leur forme de 20260925140000/150000 (EXISTS ...
-- paye = true) et réintroduire la vérification IF NOT EXISTS (...) dans
-- les 3 fonctions ci-dessous (voir leur définition d'origine,
-- 20260925140000).

DROP POLICY IF EXISTS "Payants ou admin voient les questions de la formation" ON public.formation_redaction_cv_quiz_questions;
CREATE POLICY "Connectes voient les questions de la formation (acces temporairement ouvert)" ON public.formation_redaction_cv_quiz_questions
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Payants ou admin voient les exercices de la formation" ON public.formation_redaction_cv_exercices;
CREATE POLICY "Connectes voient les exercices de la formation (acces temporairement ouvert)" ON public.formation_redaction_cv_exercices
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- marquer_module_vu : meme signature, garde "Formation non payee" retiree.
CREATE OR REPLACE FUNCTION public.marquer_module_vu(p_module_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_moi UUID := auth.uid();
BEGIN
  IF v_moi IS NULL THEN RAISE EXCEPTION 'Connexion requise.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.formation_redaction_cv_modules WHERE id = p_module_id) THEN
    RAISE EXCEPTION 'Module introuvable.';
  END IF;

  INSERT INTO public.formation_redaction_cv_progression_modules (user_id, module_id, vu, vu_le)
  VALUES (v_moi, p_module_id, true, now())
  ON CONFLICT (user_id, module_id) DO UPDATE
  SET vu = true,
      vu_le = coalesce(public.formation_redaction_cv_progression_modules.vu_le, now());
END;
$$;

REVOKE ALL ON FUNCTION public.marquer_module_vu(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marquer_module_vu(UUID) TO authenticated;

-- soumettre_quiz_module : meme signature/logique de correction et de
-- certification, garde "Formation non payee" retiree.
CREATE OR REPLACE FUNCTION public.soumettre_quiz_module(p_module_id UUID, p_reponses JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_moi UUID := auth.uid();
  v_total INT;
  v_corrects INT;
  v_score INT;
  v_reussi BOOLEAN;
  v_total_modules INT;
  v_modules_reussis INT;
  v_certifie BOOLEAN := false;
  SOUMETTRE_QUIZ_SEUIL_REUSSITE CONSTANT INT := 70;
BEGIN
  IF v_moi IS NULL THEN RAISE EXCEPTION 'Connexion requise.'; END IF;

  SELECT count(*) INTO v_total
  FROM public.formation_redaction_cv_quiz_questions
  WHERE module_id = p_module_id;

  IF v_total = 0 THEN
    RAISE EXCEPTION 'Ce module n''a pas de quiz.';
  END IF;

  SELECT count(*) INTO v_corrects
  FROM public.formation_redaction_cv_quiz_questions q
  JOIN jsonb_to_recordset(p_reponses) AS r(question_id UUID, choix_index INT)
    ON r.question_id = q.id
  WHERE q.module_id = p_module_id
    AND r.choix_index = q.bonne_reponse_index;

  v_score := round((v_corrects::numeric / v_total) * 100);
  v_reussi := v_score >= SOUMETTRE_QUIZ_SEUIL_REUSSITE;

  INSERT INTO public.formation_redaction_cv_progression_modules
    (user_id, module_id, vu, vu_le, quiz_score_pourcent, quiz_reussi, quiz_tente_le)
  VALUES (v_moi, p_module_id, true, now(), v_score, v_reussi, now())
  ON CONFLICT (user_id, module_id) DO UPDATE
  SET vu = true,
      vu_le = coalesce(public.formation_redaction_cv_progression_modules.vu_le, now()),
      quiz_score_pourcent = EXCLUDED.quiz_score_pourcent,
      quiz_reussi = EXCLUDED.quiz_reussi,
      quiz_tente_le = EXCLUDED.quiz_tente_le;

  SELECT count(*) INTO v_total_modules FROM public.formation_redaction_cv_modules;
  SELECT count(*) INTO v_modules_reussis
  FROM public.formation_redaction_cv_progression_modules
  WHERE user_id = v_moi AND vu = true AND quiz_reussi = true;

  IF v_total_modules > 0 AND v_modules_reussis = v_total_modules THEN
    v_certifie := true;
    UPDATE public.formation_redaction_cv_inscriptions
    SET certifie = true, certifie_le = now(), updated_at = now()
    WHERE user_id = v_moi AND certifie = false;
  END IF;

  RETURN jsonb_build_object('score_pourcent', v_score, 'reussi', v_reussi, 'certifie', v_certifie);
END;
$$;

REVOKE ALL ON FUNCTION public.soumettre_quiz_module(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soumettre_quiz_module(UUID, JSONB) TO authenticated;

-- soumettre_exercice_module : meme signature, garde "Formation non payee"
-- retiree.
CREATE OR REPLACE FUNCTION public.soumettre_exercice_module(p_exercice_id UUID, p_contenu TEXT)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_moi UUID := auth.uid();
BEGIN
  IF v_moi IS NULL THEN RAISE EXCEPTION 'Connexion requise.'; END IF;
  IF btrim(coalesce(p_contenu, '')) = '' THEN
    RAISE EXCEPTION 'La reponse ne peut pas etre vide.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.formation_redaction_cv_exercices WHERE id = p_exercice_id) THEN
    RAISE EXCEPTION 'Exercice introuvable.';
  END IF;

  INSERT INTO public.formation_redaction_cv_exercices_soumissions (user_id, exercice_id, contenu, soumis_le)
  VALUES (v_moi, p_exercice_id, btrim(p_contenu), now())
  ON CONFLICT (user_id, exercice_id) DO UPDATE
  SET contenu = EXCLUDED.contenu, soumis_le = now();
END;
$$;

REVOKE ALL ON FUNCTION public.soumettre_exercice_module(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.soumettre_exercice_module(UUID, TEXT) TO authenticated;

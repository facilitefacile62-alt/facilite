-- Formation payante "Rédaction de CV" avec certification (statut
-- "rédacteur CV" sur la plateforme) — nouvelle fonctionnalité demandée par
-- l'utilisateur, structurée en 6 tables + 4 fonctions SECURITY DEFINER.
--
-- Hypothèses posées (demande explicite : "pose cette hypothèse, signale si
-- tu vois un problème") :
--   1. Seuil de réussite d'un quiz : 70% (proposé par l'utilisateur, repris
--      tel quel — voir SOUMETTRE_QUIZ_SEUIL_REUSSITE ci-dessous, un seul
--      endroit à changer si ce chiffre doit évoluer).
--   2. Certification automatique dès que TOUS les modules existants ont
--      vu=true ET quiz_reussi=true pour l'utilisateur — aucune validation
--      manuelle, exactement comme demandé.
--   3. "Les exercices pratiques sont soumis et stockés" (point 3) suppose
--      une notion d'exercice par module, jamais définie au point 1 (qui ne
--      liste que modules + questions de quiz + suivi utilisateur). Ajoutée
--      ici comme une table séparée (formation_redaction_cv_exercices +
--      ..._soumissions) plutôt que de l'improviser dans le suivi — à
--      confirmer/ajuster si ce n'est pas ce qui était voulu.
--   4. Le déblocage réel de l'accès "rédacteur" ailleurs sur la plateforme
--      (user_roles, pages dédiées) est explicitement hors périmètre ici
--      (point séparé, dixit l'utilisateur) : "certifie" reste un simple
--      booléen dans formation_redaction_cv_inscriptions, ne touche à rien
--      d'autre (aucun user_roles, aucune policy existante modifiée).
--   5. "Réutilise le même mécanisme de paiement Orange Money... pas de
--      nouvelle intégration de paiement à construire" (point 2) : compris
--      comme "réutiliser la table transactions + le webhook Orange Money
--      déjà en place (20260801200000, 20260911120000)", PAS la table
--      subscriptions (user_id UNIQUE : un seul plan Premium par
--      utilisateur, incompatible avec un second produit indépendant).
--      transaction_id ci-dessous prépare ce lien ; le branchement réel
--      (checkout + webhook reconnaissant ce produit) est un point séparé,
--      pas fait ici — cette migration ne touche à aucun fichier de
--      paiement existant.
--
-- Contenu factice inclus (module 1 + 2 questions + 1 exercice) : "pas
-- encore de contenu vidéo réel... juste la structure et un module factice
-- pour tester le parcours de bout en bout" (point 4). video_url reste NULL
-- (aucun vrai contenu à ce stade).

-- 1. Modules ---------------------------------------------------------------
CREATE TABLE public.formation_redaction_cv_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titre TEXT NOT NULL,
  description TEXT,
  video_url TEXT,
  ordre INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.formation_redaction_cv_modules ENABLE ROW LEVEL SECURITY;

-- Titre/description visibles de tout utilisateur connecté (curriculum de
-- vente, avant paiement) — aucune donnée sensible sur cette table.
--
-- Pas de GRANT INSERT/UPDATE/DELETE à authenticated ici (même verrouillé
-- par une policy is_admin) : l'Invariant 1 refuse par défaut tout GRANT
-- UPDATE/DELETE sur authenticated/anon, liste blanche volontairement vide
-- ("jamais en bloc", voir tests/security/invariants.spec.js). La création/
-- édition des modules attendra son propre point avec ses propres fonctions
-- SECURITY DEFINER (même patron que admin_activer_formation_cv plus bas) —
-- pour l'instant le contenu passe par le module factice seedé en fin de
-- fichier, une donnée réelle viendra avec l'écran d'administration.
CREATE POLICY "Modules formation CV visibles des connectes" ON public.formation_redaction_cv_modules
  FOR SELECT USING (auth.uid() IS NOT NULL);

GRANT SELECT ON public.formation_redaction_cv_modules TO authenticated;

-- 2. Inscription/paiement/certification par utilisateur --------------------
-- Créée ici (avant les questions/exercices) : leurs policies SELECT ci-
-- dessous référencent cette table via EXISTS, elle doit déjà exister.
CREATE TABLE public.formation_redaction_cv_inscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  paye BOOLEAN NOT NULL DEFAULT false,
  montant_xof INT NOT NULL DEFAULT 15000,
  transaction_id UUID REFERENCES public.transactions(id),
  paye_le TIMESTAMPTZ,
  certifie BOOLEAN NOT NULL DEFAULT false,
  certifie_le TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.formation_redaction_cv_inscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Un utilisateur lit sa propre inscription formation CV" ON public.formation_redaction_cv_inscriptions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admin lit toutes les inscriptions formation CV" ON public.formation_redaction_cv_inscriptions
  FOR SELECT USING (public.is_admin(auth.uid()));
-- Aucune policy INSERT/UPDATE pour authenticated (même principe que
-- "subscriptions", 20260801200000) : paye/certifie ne doivent jamais être
-- modifiables par le client lui-même. Seules les fonctions SECURITY
-- DEFINER ci-dessous (et le futur webhook Orange Money, service_role,
-- point séparé) écrivent sur cette table.

GRANT SELECT ON public.formation_redaction_cv_inscriptions TO authenticated;

-- 3. Questions de quiz par module -------------------------------------------
CREATE TABLE public.formation_redaction_cv_quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES public.formation_redaction_cv_modules(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  choix JSONB NOT NULL,
  bonne_reponse_index INT NOT NULL CHECK (bonne_reponse_index >= 0),
  ordre INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.formation_redaction_cv_quiz_questions ENABLE ROW LEVEL SECURITY;

-- Uniquement les payants (ou un admin, pour pouvoir un jour relire/gerer le
-- contenu sans payer) voient les questions (donner le contenu du quiz
-- gratuitement viderait l'intérêt de payer) ; la bonne réponse, elle,
-- n'est JAMAIS accordée à authenticated (GRANT colonne ci-dessous) — seule
-- soumettre_quiz_module (SECURITY DEFINER) la lit, côté serveur. Pas de
-- GRANT INSERT/UPDATE/DELETE ici — même raison que pour les modules
-- ci-dessus (Invariant 1).
CREATE POLICY "Payants ou admin voient les questions de la formation" ON public.formation_redaction_cv_quiz_questions
  FOR SELECT USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.formation_redaction_cv_inscriptions i
      WHERE i.user_id = auth.uid() AND i.paye = true
    )
  );

GRANT SELECT (id, module_id, question, choix, ordre, created_at) ON public.formation_redaction_cv_quiz_questions TO authenticated;

-- 4. Exercices pratiques par module (hypothèse 3 ci-dessus) -----------------
CREATE TABLE public.formation_redaction_cv_exercices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES public.formation_redaction_cv_modules(id) ON DELETE CASCADE,
  consigne TEXT NOT NULL,
  ordre INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.formation_redaction_cv_exercices ENABLE ROW LEVEL SECURITY;

-- Pas de GRANT INSERT/UPDATE/DELETE ici — meme raison que pour les modules
-- (Invariant 1).
CREATE POLICY "Payants ou admin voient les exercices de la formation" ON public.formation_redaction_cv_exercices
  FOR SELECT USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.formation_redaction_cv_inscriptions i
      WHERE i.user_id = auth.uid() AND i.paye = true
    )
  );

GRANT SELECT ON public.formation_redaction_cv_exercices TO authenticated;

-- 5. Progression par module ---------------------------------------------
CREATE TABLE public.formation_redaction_cv_progression_modules (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES public.formation_redaction_cv_modules(id) ON DELETE CASCADE,
  vu BOOLEAN NOT NULL DEFAULT false,
  vu_le TIMESTAMPTZ,
  quiz_score_pourcent INT CHECK (quiz_score_pourcent IS NULL OR (quiz_score_pourcent >= 0 AND quiz_score_pourcent <= 100)),
  quiz_reussi BOOLEAN NOT NULL DEFAULT false,
  quiz_tente_le TIMESTAMPTZ,
  PRIMARY KEY (user_id, module_id)
);

ALTER TABLE public.formation_redaction_cv_progression_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Un utilisateur lit sa propre progression formation CV" ON public.formation_redaction_cv_progression_modules
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admin lit toute la progression formation CV" ON public.formation_redaction_cv_progression_modules
  FOR SELECT USING (public.is_admin(auth.uid()));
-- Écriture uniquement via marquer_module_vu / soumettre_quiz_module
-- (SECURITY DEFINER) : jamais de policy INSERT/UPDATE authenticated,
-- sinon un utilisateur pourrait s'auto-attribuer vu=true/quiz_reussi=true
-- sans jamais répondre au quiz.

GRANT SELECT ON public.formation_redaction_cv_progression_modules TO authenticated;

-- 6. Soumissions d'exercices ----------------------------------------------
CREATE TABLE public.formation_redaction_cv_exercices_soumissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercice_id UUID NOT NULL REFERENCES public.formation_redaction_cv_exercices(id) ON DELETE CASCADE,
  contenu TEXT NOT NULL,
  soumis_le TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, exercice_id)
);

ALTER TABLE public.formation_redaction_cv_exercices_soumissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Un utilisateur lit ses propres soumissions formation CV" ON public.formation_redaction_cv_exercices_soumissions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admin lit toutes les soumissions formation CV" ON public.formation_redaction_cv_exercices_soumissions
  FOR SELECT USING (public.is_admin(auth.uid()));
-- Écriture uniquement via soumettre_exercice_module (SECURITY DEFINER).

GRANT SELECT ON public.formation_redaction_cv_exercices_soumissions TO authenticated;

-- =====================================================================
-- Fonctions SECURITY DEFINER
-- =====================================================================

-- marquer_module_vu : enregistre qu'un payant a consulté un module.
CREATE FUNCTION public.marquer_module_vu(p_module_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_moi UUID := auth.uid();
BEGIN
  IF v_moi IS NULL THEN RAISE EXCEPTION 'Connexion requise.'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.formation_redaction_cv_inscriptions WHERE user_id = v_moi AND paye = true
  ) THEN
    RAISE EXCEPTION 'Formation non payee.';
  END IF;
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

-- soumettre_quiz_module : corrige le quiz cote serveur (jamais la bonne
-- reponse envoyee au client), enregistre le score, certifie
-- automatiquement si TOUS les modules sont vu=true ET quiz_reussi=true.
-- p_reponses : [{"question_id": "<uuid>", "choix_index": 0}, ...].
CREATE FUNCTION public.soumettre_quiz_module(p_module_id UUID, p_reponses JSONB)
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
  -- Hypothese posee par l'utilisateur ("proposer 70%") : un seul endroit a
  -- changer si ce seuil doit evoluer.
  SOUMETTRE_QUIZ_SEUIL_REUSSITE CONSTANT INT := 70;
BEGIN
  IF v_moi IS NULL THEN RAISE EXCEPTION 'Connexion requise.'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.formation_redaction_cv_inscriptions WHERE user_id = v_moi AND paye = true
  ) THEN
    RAISE EXCEPTION 'Formation non payee.';
  END IF;

  SELECT count(*) INTO v_total
  FROM public.formation_redaction_cv_quiz_questions
  WHERE module_id = p_module_id;

  IF v_total = 0 THEN
    RAISE EXCEPTION 'Ce module n''a pas de quiz.';
  END IF;

  -- Jointure sur les VRAIES questions du module (jamais les question_id
  -- envoyes tels quels) : un id qui n'appartient pas a p_module_id, ou
  -- absent de p_reponses, compte simplement comme faux.
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

-- soumettre_exercice_module : stocke la reponse a l'exercice pratique,
-- sans effet sur la certification (point 3 : "ne bloquent pas la
-- certification pour l'instant").
CREATE FUNCTION public.soumettre_exercice_module(p_exercice_id UUID, p_contenu TEXT)
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
  IF NOT EXISTS (
    SELECT 1 FROM public.formation_redaction_cv_inscriptions WHERE user_id = v_moi AND paye = true
  ) THEN
    RAISE EXCEPTION 'Formation non payee.';
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

-- admin_activer_formation_cv : bascule manuelle du paiement, reservee
-- admin. Sert de bequille de test tant que le paiement Orange Money reel
-- (point separe, non fait ici) n'est pas branche sur cette table, et
-- restera utile ensuite pour les cas de paiement hors-ligne/support.
CREATE FUNCTION public.admin_activer_formation_cv(p_user_id UUID, p_paye BOOLEAN)
RETURNS public.formation_redaction_cv_inscriptions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_row public.formation_redaction_cv_inscriptions;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Reserve aux administrateurs.';
  END IF;

  INSERT INTO public.formation_redaction_cv_inscriptions (user_id, paye, paye_le)
  VALUES (p_user_id, p_paye, CASE WHEN p_paye THEN now() ELSE NULL END)
  ON CONFLICT (user_id) DO UPDATE
  SET paye = p_paye,
      paye_le = CASE WHEN p_paye THEN coalesce(public.formation_redaction_cv_inscriptions.paye_le, now()) ELSE NULL END,
      updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_activer_formation_cv(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_activer_formation_cv(UUID, BOOLEAN) TO authenticated;

-- =====================================================================
-- Contenu factice (module 1) — "pour tester le parcours de bout en bout"
-- =====================================================================

INSERT INTO public.formation_redaction_cv_modules (id, titre, description, video_url, ordre)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'Module 1 — Les fondamentaux d''un CV percutant',
  'Module de test (contenu factice, aucune vraie video pour l''instant) : structure du CV, erreurs a eviter, mise en forme.',
  NULL,
  1
);

INSERT INTO public.formation_redaction_cv_quiz_questions (module_id, question, choix, bonne_reponse_index, ordre)
VALUES
  (
    '00000000-0000-4000-8000-000000000001',
    'Quelle est la longueur recommandee pour un CV de debut de carriere ?',
    '["Une demi-page", "Une page", "Trois pages ou plus"]'::jsonb,
    1,
    1
  ),
  (
    '00000000-0000-4000-8000-000000000001',
    'Que faut-il verifier en priorite avant d''envoyer son CV ?',
    '["La couleur du papier", "L''absence de fautes d''orthographe", "Le nombre de polices utilisees"]'::jsonb,
    1,
    2
  );

INSERT INTO public.formation_redaction_cv_exercices (module_id, consigne, ordre)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'Redigez en 3 phrases un resume professionnel (accroche de CV) pour votre propre profil.',
  1
);

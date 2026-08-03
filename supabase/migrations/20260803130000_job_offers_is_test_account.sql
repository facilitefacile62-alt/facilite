-- Étape E du chantier (2026-08-03) : mode démo. Même principe que
-- profiles.is_test_account (20260802150000) appliqué à job_offers — un
-- compte démo doit pouvoir publier des offres qui ont l'air réelles dans
-- SON tableau de bord, sans jamais apparaître sur le site public (/offres,
-- page d'accueil, sitemap) ni être indexées par un moteur de recherche.
-- Décision validée : zéro pollution du site public, pas d'exception.

ALTER TABLE public.job_offers
ADD COLUMN IF NOT EXISTS is_test_account BOOLEAN NOT NULL DEFAULT false;

-- Volontairement PAS de GRANT UPDATE sur cette colonne pour authenticated —
-- même raisonnement que profiles.is_test_account : seul un accès SQL
-- privilégié (ce chantier, ou docs/mode-demo.md) peut la positionner.

-- La policy de lecture publique exclut désormais explicitement les offres
-- de démo — c'est la SEULE modification nécessaire : "Un recruteur lit ses
-- propres offres" reste inchangée, donc le compte démo continue de voir
-- ses propres offres de test dans son propre tableau de bord.
DROP POLICY IF EXISTS "Anyone can view active job offers" ON public.job_offers;
CREATE POLICY "Anyone can view active job offers"
  ON public.job_offers FOR SELECT
  TO public
  USING (status = 'approved' AND is_active = true AND archived_at IS NULL AND is_test_account = false);

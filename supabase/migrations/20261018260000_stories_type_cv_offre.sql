-- Type de story : « cv » (modèle de CV, bouton « Commander via WhatsApp ») ou « offre » (offre d'emploi, bouton
-- « Postuler » vers le lien de l'offre).
--
-- Décision du propriétaire (18/10/2026) : les stories montrent les MODÈLES DE CV avec le numéro WhatsApp de Facilité.
-- Une offre d'emploi n'y est jamais mise sans bouton « Postuler ». Le type est donc enregistré, et le bouton de la story
-- en découle (côté admin : le lien d'une offre est obligatoire). Par défaut « cv » (comportement existant).
-- La story « Offre Comptable » créée en départ (20261018240000) est retirée : c'était une offre sans bouton Postuler.

ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'cv';

ALTER TABLE public.stories DROP CONSTRAINT IF EXISTS stories_type_check;
ALTER TABLE public.stories ADD CONSTRAINT stories_type_check CHECK (type IN ('cv', 'offre'));

DELETE FROM public.stories WHERE titre = 'Offre Comptable' AND lien IS NULL;

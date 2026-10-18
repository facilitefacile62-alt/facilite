-- « Devenir livreur » visible par TOUS, visiteurs compris.
--
-- Décision du propriétaire (18/10/2026) : parmi les boutons liés au transport, « Devenir livreur » est le seul
-- laissé visible au public (Voyages et chauffeurs restent en pause). Plus il y a de livreurs inscrits, plus les
-- acheteurs en trouvent dans leur zone. Un visiteur non connecté voit le bouton ; il est renvoyé vers la
-- connexion puis vers le formulaire d'accréditation (la candidature elle-même exige toujours un compte).
-- Seul le rôle « visiteur » change ; l'état (activé/coupé) choisi par l'administrateur est conservé.

UPDATE public.feature_flags
SET roles = jsonb_set(coalesce(roles, '{}'::jsonb), '{visitor}', 'true'::jsonb), updated_at = now()
WHERE id = 'nav_marketplace_livreur';

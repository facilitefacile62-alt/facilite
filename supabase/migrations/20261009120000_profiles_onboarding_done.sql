-- =====================================================================
-- Onboarding de l'app mobile (écrans 23 à 27 de pages-apk-complet/) :
-- savoir si un compte a déjà fait (ou passé) son accueil.
--
-- profiles.onboarding_done : false = l'app ouvre l'écran « Bienvenue » à
-- la première ouverture ; true = rien ne change.
--
-- Décision du client (09/10/2026) : TOUS les comptes qui existent à
-- l'application de cette migration passent à true, pour que personne ne
-- voie l'onboarding par erreur. Seuls les comptes créés ensuite
-- l'obtiendront (valeur par défaut false).
--
-- Technique : la colonne est ajoutée avec DEFAULT true (les lignes
-- existantes la reçoivent en une seule opération, sans fenêtre où un
-- compte serait à false), puis le défaut des futures lignes est ramené à
-- false.
-- =====================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_done BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.profiles
  ALTER COLUMN onboarding_done SET DEFAULT false;

-- Écriture par le propriétaire : GRANT colonne par colonne (voir
-- 20260802060000_profiles_deny_by_default.sql), la RLS limite déjà la
-- ligne à son propriétaire. Le site web ne lit ni n'écrit cette colonne.
GRANT UPDATE (onboarding_done) ON public.profiles TO authenticated;

-- =====================================================================
-- Refonte "Sécurité & Connexion" — section Informations du compte.
-- Ajoute la date de naissance (région/pays existe déjà : public.profiles.country).
--
-- Confidentialité : colonne volontairement absente de get_candidats_recherche
-- et get_profils_publics (vérifié : aucune des deux ne fait SELECT * ni ne
-- référence country, qui suit la même règle) — jamais exposée aux recruteurs
-- ni sur un profil public. Auto-éditable uniquement (GRANT UPDATE colonne
-- par colonne, comme le reste de profiles — jamais de GRANT large).
-- =====================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS date_naissance DATE
    CHECK (date_naissance IS NULL OR (date_naissance <= CURRENT_DATE AND date_naissance >= '1900-01-01'));

GRANT UPDATE (date_naissance) ON TABLE public.profiles TO authenticated;

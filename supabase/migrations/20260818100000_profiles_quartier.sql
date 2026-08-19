-- Ajoute le champ quartier au profil — destination du pré-remplissage par
-- pièce d'identité (nom/prénom/quartier uniquement, voir
-- src/app/api/profil/scan-identity-document/route.js). Simple colonne
-- texte optionnelle, éditable manuellement comme city/country via
-- handleSaveAboutField, aucune donnée sensible n'y transite jamais.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS quartier TEXT;

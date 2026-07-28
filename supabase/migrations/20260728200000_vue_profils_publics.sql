-- =====================================================================
-- Profils publics : vue dédiée en opt-in explicite
-- =====================================================================
-- Problème résolu :
-- La page /in/[username] a besoin de lire le profil d'un AUTRE utilisateur,
-- ce que la policy RLS de public.profiles interdit (et doit interdire :
-- la table contient email, phone, birth_date, gender, marital_status,
-- driver_license, cv_url...).
--
-- La tentation est d'ajouter "FOR SELECT USING (true)" sur profiles. C'est
-- exactement la faille corrigée par la migration 20260727090000 : le RLS
-- filtre les LIGNES, pas les COLONNES — exposer la ligne expose TOUT.
--
-- Solution retenue : une vue qui ne projette que les colonnes réellement
-- publiques, filtrée sur un consentement explicite de l'utilisateur.
-- La table profiles, elle, reste strictement privée.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Colonnes de consentement + colonnes d'affichage
-- ---------------------------------------------------------------------
-- DEFAULT false : personne n'est publié sans l'avoir demandé (opt-in).
-- Un DEFAULT true publierait rétroactivement le nom, la bio et la
-- localisation de tous les comptes existants sans leur consentement.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_public    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_contact BOOLEAN NOT NULL DEFAULT false;

-- Colonnes d'affichage ajoutées hors migrations par le passé (la table
-- préexistait en production). Ajout idempotent pour que la vue ci-dessous
-- soit créable sur une base neuve.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS slug            TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url      TEXT,
  ADD COLUMN IF NOT EXISTS cover_url       TEXT,
  ADD COLUMN IF NOT EXISTS city            TEXT,
  ADD COLUMN IF NOT EXISTS phone           TEXT,
  ADD COLUMN IF NOT EXISTS website_url     TEXT,
  ADD COLUMN IF NOT EXISTS pinned_details  JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS educations      JSONB DEFAULT '[]'::jsonb;

-- Le slug sert d'identifiant d'URL : il doit être unique.
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_slug_unique
  ON public.profiles (lower(slug))
  WHERE slug IS NOT NULL;


-- ---------------------------------------------------------------------
-- 2. La vue publique
-- ---------------------------------------------------------------------
-- security_invoker = off (valeur par défaut, rendue explicite) : la vue
-- s'exécute avec les droits de son propriétaire et constitue donc une
-- fenêtre contrôlée sur profiles. C'est volontaire et c'est tout l'intérêt
-- du dispositif — la sélection des colonnes et le filtre is_public sont
-- ici la frontière de sécurité, à la place du RLS.
--
-- Colonnes délibérément ABSENTES : email (adresse de connexion du compte),
-- birth_date, gender, marital_status, driver_license, contact_email brut,
-- cv_url, interests. Ne jamais les ajouter ici sans y réfléchir à deux fois.

DROP VIEW IF EXISTS public.profils_publics;

CREATE VIEW public.profils_publics
WITH (security_invoker = off) AS
SELECT
  id,
  slug,
  full_name,
  headline,
  bio,
  avatar_url,
  cover_url,
  location,
  city,
  experiences,
  educations,
  pinned_details,
  -- Coordonnées : second niveau de consentement, indépendant du premier.
  -- contact_email est le champ dédié au contact ; l'e-mail de connexion
  -- (colonne "email") n'est jamais exposé.
  CASE WHEN show_contact THEN contact_email ELSE NULL END AS contact_email,
  CASE WHEN show_contact THEN phone         ELSE NULL END AS phone,
  CASE WHEN show_contact THEN website_url   ELSE NULL END AS website_url
FROM public.profiles
WHERE is_public = true;


-- ---------------------------------------------------------------------
-- 3. Droits d'accès
-- ---------------------------------------------------------------------
-- Lecture seule, pour les visiteurs anonymes comme pour les connectés.
-- Aucun droit d'écriture : les modifications passent par public.profiles,
-- qui reste protégée par son RLS strict (auth.uid() = id).

REVOKE ALL ON public.profils_publics FROM PUBLIC;
GRANT SELECT ON public.profils_publics TO anon, authenticated;

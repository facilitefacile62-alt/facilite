-- =====================================================================
-- Corrige à la source la faille structurelle trouvée en partie D
-- (2026-08-07) : ALTER DEFAULT PRIVILEGES sur le schéma public accordait
-- silencieusement, à CHAQUE nouvelle table/fonction/séquence créée par le
-- rôle postgres, des droits complets à anon/authenticated (tables,
-- séquences) et EXECUTE à anon (fonctions) — sans qu'aucune ligne GRANT
-- n'apparaisse dans la migration qui la crée. Cause probable d'une partie
-- des GRANTs "jamais tracés" trouvés et corrigés table par table pendant
-- ce chantier (establishments, is_admin(uuid), invariant_status...).
--
-- Ce qui est volontairement PRÉSERVÉ : authenticated garde EXECUTE par
-- défaut sur les fonctions (cohérent avec le pattern déjà utilisé partout
-- dans ce projet — GRANT EXECUTE ... TO authenticated explicite sur
-- chaque fonction admin, mais les fonctions "normales" du produit restent
-- appelables sans grant manuel systématique) ; service_role garde tout
-- (accès serveur de confiance, hors RLS par design Supabase).
--
-- Effet : SEULEMENT sur les tables/fonctions/séquences créées APRÈS cette
-- migration par le rôle postgres — ne touche à aucun GRANT déjà en place
-- sur les objets existants (revoke table par table déjà fait séparément).
-- =====================================================================

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON FUNCTIONS FROM anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;

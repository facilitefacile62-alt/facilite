-- GRANTs manquants sur le projet de test (facilite-e2e-test), découverts
-- en reproduisant les échecs de tests contre le schéma importé depuis la
-- production.
--
-- Cause : dump-schema-via-introspection.js capture les définitions de
-- fonctions (pg_get_functiondef) mais jamais leurs GRANT/REVOKE — écart
-- connu du générateur, pas corrigé ici. Résultat : les 50 fonctions
-- créées sur le projet de test ont hérité du comportement par défaut de
-- PostgreSQL pour CREATE FUNCTION (EXECUTE accordé à PUBLIC, donc
-- effectivement à `anon` aussi) — 49 fonctions sur 50 étaient concernées,
-- pas seulement les 6 initialement repérées. Ça contourne silencieusement
-- tout le travail de durcissement GRANT/REVOKE fait sur la production
-- tout au long de ce chantier (aucune de ces révocations n'existe dans
-- pg_get_functiondef, qui ne décrit que le corps de la fonction).
--
-- Correctif large plutôt que fonction par fonction : retire PUBLIC/anon
-- de TOUTES les fonctions du schéma public, accorde authenticated à
-- toutes (cohérent avec le pattern déjà en place sur la production —
-- authenticated par défaut, anon jamais, sauf exception explicite qui
-- n'existe pas dans ce projet à ce jour).
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

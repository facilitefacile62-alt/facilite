-- =====================================================================
-- PARTIE 2, ÉTAPE 3.3 du chantier — supprime la table `applications`,
-- morte : 0 ligne, aucune référence dans src/ (grep exhaustif), aucune
-- clé étrangère pointant vers elle, aucune fonction ne la mentionne dans
-- son corps. `candidatures` est la table réellement utilisée pour les
-- candidatures — `applications` semble être un doublon jamais branché.
-- =====================================================================
DROP TABLE IF EXISTS public.applications;

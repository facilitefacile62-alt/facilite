-- Rouvrir la Marketplace.
--
-- Elle avait été coupée le 01/09/2026 (migration 20260901180000) parce qu'elle
-- ne persistait rien : annonces dans localStorage, photos en base64, et une
-- « recherche visuelle par IA » qui lisait le nom du fichier. Les trois motifs
-- sont levés :
--
--   * les annonces vivent dans marketplace_stores / marketplace_items, avec
--     RLS et écritures par fonctions SECURITY DEFINER (20260901190000 et
--     20260901220000) ;
--   * les photos sont compressées côté navigateur et déposées dans le bucket
--     marketplace-photos, une par fichier, plafonnées à 2 Mo ;
--   * la simulation de reconnaissance d'image a été supprimée, pas déguisée.
--
-- S'y ajoute ce qui manquait à une v1 ouverte au public : un bouton
-- « Signaler cette annonce » et l'écran d'administration qui va avec
-- (20260902120000 et 20260902140000).
--
-- Reste un point que la technique ne règle pas : la fraîcheur du stock repose
-- entièrement sur les commerçants. Le badge « Stock confirmé il y a X » dit la
-- vérité sur la dernière mise à jour, pas sur l'état du rayon.

UPDATE public.feature_flags
SET enabled = true,
    updated_at = now()
WHERE id = 'nav_marketplace';

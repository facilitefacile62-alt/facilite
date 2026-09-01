-- Aligner les catégories de la base sur celles de l'interface.
--
-- La migration 20260901190000 a figé une liste écrite d'après le schéma, pas
-- d'après l'écran : « informatique » et « services » y manquaient, alors que
-- l'interface les propose depuis le début — et ce sont deux rubriques
-- structurantes du marché local (vente de PC reconditionnés, prestations de
-- couture, plomberie, coiffure).
--
-- Corriger la contrainte plutôt que l'interface : amputer deux catégories
-- pour coller à une liste écrite trop vite reviendrait à laisser le schéma
-- décider du produit. La table est vide, aucune donnée n'est concernée.

ALTER TABLE public.marketplace_items DROP CONSTRAINT IF EXISTS marketplace_items_categorie_check;
ALTER TABLE public.marketplace_items ADD CONSTRAINT marketplace_items_categorie_check
  CHECK (categorie IN (
    'telephones', 'vehicules', 'immobilier', 'mode', 'maison',
    'electronique', 'informatique', 'services', 'alimentation', 'autre'
  ));

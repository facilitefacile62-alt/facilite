-- Invariant 7 : la lecture des emplacements de bâtiments suit désormais la visibilité de la boutique.
-- Avant (20261113120000) : USING (true) — l'emplacement d'une boutique masquée ou non vérifiée restait lisible par tous.
-- Après : une ligne n'est lisible que si la boutique l'est aussi (la sous-requête applique la RLS de marketplace_stores au lecteur).
-- Les droits de colonnes (store_id, latitude, longitude pour anon et authenticated) ne changent pas.
DROP POLICY IF EXISTS "lecture publique des emplacements de bâtiments" ON public.marketplace_store_building_positions;
DROP POLICY IF EXISTS "emplacements visibles avec leur boutique" ON public.marketplace_store_building_positions;
CREATE POLICY "emplacements visibles avec leur boutique"
  ON public.marketplace_store_building_positions
  FOR SELECT
  TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.marketplace_stores s WHERE s.id = marketplace_store_building_positions.store_id));

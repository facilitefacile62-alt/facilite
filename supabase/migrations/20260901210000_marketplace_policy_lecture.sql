-- Retirer la policy de lecture des photos de la Marketplace.
--
-- Elle était inutile et trompeuse. Sur un bucket `public`, Storage sert les
-- objets par URL directe SANS évaluer la RLS : une policy SELECT n'y filtre
-- rien, elle donne seulement l'illusion d'un contrôle. C'est exactement le
-- piège documenté par l'invariant 7 — un `bucket_id` vérifié seul, sans
-- restriction de dossier ni de propriétaire.
--
-- Le précédent bucket public du projet, `job-offers`, n'a d'ailleurs aucune
-- policy SELECT, pour la même raison. On s'aligne dessus.
--
-- Les écritures restent verrouillées : INSERT, UPDATE et DELETE exigent
-- toujours que le premier segment du chemin soit l'identifiant du vendeur,
-- ce qui empêche d'écraser la photo d'un concurrent.

DROP POLICY IF EXISTS "photos marketplace lisibles" ON storage.objects;

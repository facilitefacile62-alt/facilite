-- Masquage de 7 offres de test ou aberrantes (31/10/2026), sur accord écrit du propriétaire. MASQUER, jamais supprimer.
-- Mécanisme existant : job_offers.is_active = false (le bouton « Désactiver » de /admin/offres) ; la lecture publique ne laisse passer que is_active = true.
-- Aucune colonne ni migration créée. Une seule modification, par identifiants exacts, dans une transaction : si le nombre de lignes touchées n'est pas
-- exactement 7, tout est annulé.
-- Propriétaires vérifiés avant : 5 offres de comptes marqués « test » (dont le compte de démonstration), 1 offre (« clipeu ») du compte administrateur
-- de l'utilisateur. Aucune offre d'un recruteur externe.
-- Retour arrière : 20261031_masquage_7_offres_test.down.sql (valeurs d'origine) ; sauvegarde complète des lignes hors dépôt :
-- C:\Users\gta\Exports-Facilite\sauvegardes-lignes\offres-test-avant-masquage-20261031.json
BEGIN;

DO $$
DECLARE
  v_touchees integer;
BEGIN
  UPDATE public.job_offers
     SET is_active = false
   WHERE id IN (
     '964fb82a-ac52-4809-8b19-9da032ef4c70',
     '121a8297-99d1-4a4c-9f70-165b5dc0941d',
     '570d09a0-4f1e-48d0-807c-13ddea3b4a98',
     '859eb6bb-2ae2-427e-91df-248432240a48',
     'efd3bba7-0dee-48cb-9e1a-58e9d61123eb',
     'c2b3e26c-aa21-44a9-9bb4-9f10422d27ca',
     '3178ebd8-8d9f-4031-bfdb-e63e875ddb4e'
   )
     AND is_active = true;
  GET DIAGNOSTICS v_touchees = ROW_COUNT;
  IF v_touchees <> 7 THEN
    RAISE EXCEPTION 'Masquage annulé : % ligne(s) touchée(s) au lieu de 7', v_touchees;
  END IF;
END
$$;

COMMIT;

-- =====================================================================
-- Nettoyage des deux commandes créées pendant les tests de bascule KPay
-- Live du 2026-08-07 (docs/etat-du-projet.md). Les deux paiements ont
-- réellement échoué côté KPay ("Échec du paiement — Aucun montant n'a
-- été débité", confirmé à l'écran par l'utilisateur pour la seconde, et
-- par l'absence totale de webhook pour la première) — passées à 'failed'
-- ici plutôt que laissées 'pending' indéfiniment, ce qui aurait pollué
-- tout futur rapport admin sur les commandes en attente. Choix honnête,
-- pas une fabrication : ni l'une ni l'autre n'a jamais été payée.
-- =====================================================================

UPDATE public.orders
SET payment_status = 'failed'
WHERE id IN ('2247ab8e-7cd4-4388-b42e-30bacba09b1c', '21db5fe5-58c8-4560-b3cd-5810c093b3c2')
  AND payment_status = 'pending';

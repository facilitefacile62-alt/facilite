-- Paiements : plus aucune écriture directe du client sur jetons_transactions ni sur les inscriptions formation CV.
--
-- Constat (19/10/2026) : avec la clé anon + JWT, un utilisateur connecté pouvait, pour SA propre ligne, INSERER
-- montant_xof et callback_token_hash (jetons et formation CV) et modifier provider_reference. Ce n'était pas
-- exploitable pour se créditer (statut/paye forcés à pending/false par les policies, aucun UPDATE sur ces colonnes, et le
-- webhook ne crédite que sur confirmation d'Orange — référence ET montant), mais ces colonnes servent à contrôler un
-- paiement : elles ne doivent être écrites que par le serveur.
--
-- Les routes de paiement (jetons-checkout, formation-cv-checkout) écrivent désormais ces lignes avec le rôle serveur,
-- après avoir vérifié la propriété. Les lectures du client (SELECT) restent inchangées.
-- À APPLIQUER APRÈS le déploiement de ces routes, sinon le paiement échouerait entre-temps.

REVOKE INSERT ON public.jetons_transactions FROM authenticated;
REVOKE UPDATE (provider_reference) ON public.jetons_transactions FROM authenticated;
DROP POLICY IF EXISTS "Un vendeur initie un achat de jetons pour sa boutique" ON public.jetons_transactions;
DROP POLICY IF EXISTS "Un vendeur met a jour la reference de paiement de sa transaction" ON public.jetons_transactions;

REVOKE INSERT ON public.formation_redaction_cv_inscriptions FROM authenticated;
REVOKE UPDATE (provider_reference) ON public.formation_redaction_cv_inscriptions FROM authenticated;
DROP POLICY IF EXISTS "Un utilisateur initie son inscription formation CV" ON public.formation_redaction_cv_inscriptions;
DROP POLICY IF EXISTS "Un utilisateur pose la reference de paiement de sa formation CV" ON public.formation_redaction_cv_inscriptions;

-- Nettoyage lié à l'incident du 18/08 (voir 20260820130000_restore_sponsorship_trigger.sql).
-- 4 offres réelles portaient is_sponsored=true avec un sponsor_priority
-- assigné (20, 21, 22, 25) mais sponsored_until=NULL — état impossible à
-- obtenir via le chemin légitime set_offer_sponsorship() (qui exige
-- sponsored_until non nul dès que is_sponsored=true). Créées entre
-- 2026-08-18 20:35 et 21:29 UTC, exactement dans la fenêtre du
-- contournement du trigger prevent_sponsorship_self_edit. Sans effet
-- visible aujourd'hui (isOfferActivelySponsored() les exclut déjà, faute
-- de sponsored_until), mais état résiduel incohérent à assainir plutôt
-- qu'à laisser trainer.
--
-- IDs concernés : 30e060ee-6c17-48f8-b3bf-5e744d03e911 (Youth Linguists
-- Programme), 5e869719-79a6-4a4e-9b2f-90e633d7b420 (Simplon Sénégal),
-- 4d9b3e21-789a-4c2e-8123-bc9a1f284901 (AGEROUTE Sénégal),
-- 7c9a2814-6ef1-42e7-9104-d54b83ea1902 (ODS).

-- prevent_sponsorship_self_edit() bloque aussi la connexion de migration
-- elle-même (current_user_role() lit auth.uid(), NULL hors session
-- PostgREST — comportement voulu, vérifié le 2026-08-20). Désactivation
-- scopée à cette seule correction ponctuelle, dans une migration commitée
-- et relue : différent d'un contournement permanent dans le code de la
-- fonction (c'est précisément ce qui vient d'être corrigé).
ALTER TABLE public.job_offers DISABLE TRIGGER trg_prevent_sponsorship_self_edit;

UPDATE public.job_offers
SET is_sponsored = false,
    sponsor_priority = 0
WHERE id IN (
  '30e060ee-6c17-48f8-b3bf-5e744d03e911',
  '5e869719-79a6-4a4e-9b2f-90e633d7b420',
  '4d9b3e21-789a-4c2e-8123-bc9a1f284901',
  '7c9a2814-6ef1-42e7-9104-d54b83ea1902'
)
AND sponsored_until IS NULL;

ALTER TABLE public.job_offers ENABLE TRIGGER trg_prevent_sponsorship_self_edit;

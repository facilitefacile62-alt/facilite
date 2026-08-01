-- Découvert en testant le téléchargement PDF post-paiement (nouvelle
-- fonctionnalité) : la policy RLS INSERT sur orders ("Un candidat crée ses
-- propres commandes", WITH CHECK auth.uid() = user_id) ne restreint aucune
-- autre colonne. N'importe quel utilisateur authentifié pouvait donc
-- insérer directement via l'API REST Supabase une commande avec
-- payment_status: 'paid' pour lui-même, sans jamais passer par
-- /api/pay/checkout ni KPay — contournant entièrement la prestation
-- payante ("la confection finale (export PDF) est désormais une
-- prestation payante", voir creer-cv/page.js) qui vient d'être câblée sur
-- ce statut. Vérifié empiriquement (insertion directe réussie avant ce
-- correctif). Aucune policy UPDATE n'existe sur orders pour les
-- utilisateurs standards — seul ce vecteur INSERT était ouvert.
--
-- Même pattern que prevent_role_self_escalation() sur profiles
-- (20260729232500_profiles_multi_roles.sql) : un trigger BEFORE INSERT
-- force payment_status à 'pending' pour tout acteur autre que service_role,
-- quoi que le client ait envoyé — la seule voie légitime pour marquer une
-- commande "paid" reste le webhook KPay (déjà en service_role, non affecté).
CREATE OR REPLACE FUNCTION public.prevent_order_status_spoofing()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    NEW.payment_status := 'pending';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_prevent_order_status_spoofing ON public.orders;
CREATE TRIGGER trg_prevent_order_status_spoofing
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.prevent_order_status_spoofing();

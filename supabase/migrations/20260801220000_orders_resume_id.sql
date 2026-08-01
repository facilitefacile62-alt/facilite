-- Lie une commande CV payée au brouillon exact (resumes) qui l'a déclenchée.
-- Sans ce lien, régénérer le PDF après paiement n'a aucun moyen fiable de
-- retrouver QUEL brouillon (contenu, modèle, couleur) correspond à quelle
-- commande — un candidat peut sauvegarder plusieurs brouillons avant de
-- payer. Nullable : les commandes déjà existantes n'ont pas ce lien
-- rétroactivement, et le flux "recharge de crédits" (transactions) n'a
-- jamais de resume associé.
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS resume_id UUID REFERENCES public.resumes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_resume_id ON public.orders(resume_id);

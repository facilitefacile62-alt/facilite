-- Ajoute 'MARKETPLACE' aux types de discussion autorisés sur messages.
--
-- Contexte : les conversations acheteur<->vendeur du Marketplace ("Contacter
-- le vendeur" sur une fiche article) réutilisaient le même canal générique
-- que la messagerie Facilité (candidat<->recruteur), sans aucune étiquette
-- distincte — elles finissaient donc classées 'ECHANGE' par défaut, comme
-- une simple demande de stage, et étaient même agrégées dans le même fil
-- fusionné "Support RH Facilité" que le support technique. Signalé par
-- l'utilisateur (captures d'écran) : les messages du Marketplace doivent
-- être ceux du client et du vendeur, distincts de la plateforme Facilité.
ALTER TABLE public.messages DROP CONSTRAINT messages_type_discussion_check;

ALTER TABLE public.messages ADD CONSTRAINT messages_type_discussion_check
  CHECK (type_discussion = ANY (ARRAY['OFFRE'::text, 'ECHANGE'::text, 'SUPPORT'::text, 'MARKETPLACE'::text]));

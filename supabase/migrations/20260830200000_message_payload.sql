-- Contenu enrichi dans le fil de conversation.
--
-- Un message ne portait jusqu'ici que du texte et, au plus, une pièce jointe
-- (attachment_url + attachment_type). Impossible d'y attacher des données
-- structurées : un itinéraire trouvé par chercher_itineraire ne pouvait donc
-- être rendu qu'en texte, alors qu'il contient des coordonnées, des arrêts,
-- une distance et un tarif — de quoi dessiner une carte.
--
-- `payload` est volontairement libre (jsonb sans schéma) : le premier usage
-- est l'itinéraire, mais la même colonne servira une carte d'offre d'emploi
-- ou un aperçu de CV sans nouvelle migration. Le champ attachment_type dit
-- comment l'interpréter — il n'a aucune contrainte CHECK, « itineraire »
-- s'ajoute donc aux valeurs déjà utilisées (image, pdf, document, audio,
-- video-interview) sans rien modifier.
--
-- Aucune donnée personnelle n'y transite : l'itinéraire ne contient que des
-- lignes de transport publiques, jamais la position de la personne.

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS payload JSONB;

COMMENT ON COLUMN public.messages.payload IS
  'Données structurées du message, interprétées selon attachment_type (ex. "itineraire"). Jamais de donnée personnelle.';

-- ---------------------------------------------------------------------------
-- Le fil de l'assistant ne vit PAS dans public.messages.
-- ---------------------------------------------------------------------------
-- Les réponses de l'assistant sont enregistrées dans assistant_messages, une
-- table distincte qui n'a ni attachment_type ni payload : à l'écran, les deux
-- fils sont réunis par un pont côté client (MessagerieClient), mais en base ils
-- restent séparés.
--
-- Conséquence concrète : ajouter payload uniquement à public.messages ferait
-- disparaître la carte au premier rechargement de page, puisque le message qui
-- la porte est relu depuis assistant_messages. Les deux tables reçoivent donc
-- les mêmes deux colonnes, avec la même signification.

ALTER TABLE public.assistant_messages
  ADD COLUMN IF NOT EXISTS attachment_type TEXT,
  ADD COLUMN IF NOT EXISTS payload JSONB;

COMMENT ON COLUMN public.assistant_messages.payload IS
  'Données structurées du message, interprétées selon attachment_type (ex. "itineraire"). Jamais de donnée personnelle.';

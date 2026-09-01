-- Retirer la position GPS des itinéraires déjà enregistrés.
--
-- La charge utile d'un message « itineraire » contenait un objet `depart`
-- avec la latitude et la longitude exactes de la personne au moment où elle
-- posait sa question. Il servait à placer le point « Vous êtes ici » sur la
-- carte — un besoin d'affichage, le temps de la conversation.
--
-- Le commentaire de la migration 20260830200000 affirmait pourtant :
-- « Aucune donnée personnelle n'y transite : l'itinéraire ne contient que des
-- lignes de transport publiques, jamais la position de la personne. » C'était
-- faux. Conservée message après message, cette coordonnée constitue un
-- historique des déplacements — ni annoncé dans la politique de
-- confidentialité, ni déclaré à Google Play.
--
-- Le code n'enregistre plus `depart` (voir MessagerieClient). Cette migration
-- efface ce qui l'a déjà été. Le reste de la charge utile — lignes, arrêts,
-- tarifs — est public et reste intact : les cartes déjà affichées continuent
-- de fonctionner, sans le point « Vous êtes ici ».

UPDATE public.assistant_messages
SET payload = payload - 'depart'
WHERE attachment_type = 'itineraire'
  AND payload ? 'depart';

UPDATE public.messages
SET payload = payload - 'depart'
WHERE attachment_type = 'itineraire'
  AND payload ? 'depart';

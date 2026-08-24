-- Point 2 du chantier Examinateur (2026-08-24) : séparer l'ADRESSE DE
-- CANDIDATURE des autres liens d'une offre.
--
-- Diagnostic brut à l'origine de cette migration : le prompt du Scanner IA
-- (extractFullJobOfferFromPosterWithGemini, src/lib/documentParser.js)
-- confond explicitement les deux notions dans deux de ses champs —
--   « 6. Adresse e-mail de contact OU de recrutement »
--   « 7. Lien externe / site officiel OU lien de postulation »
-- — et aucun champ n'existe pour un lien annexe (fiche de poste, dossier à
-- fournir). Faute de champ dédié, resolveOfferAction (src/lib/offerContact.js)
-- devinait la destination du bouton « Postuler » par mots-clés d'URL
-- (vacancy|sigof|mirador|forms|jobs|apply…) avec pour repli : « s'il n'y a
-- pas d'email fourni, tout lien externe renseigné sert de portail officiel ».
--
-- Deux erreurs symétriques mesurées sur des cas réels :
--   https://recrutement.ucad.sn + un email de contact
--       -> le VRAI portail est ignoré, le bouton devient un mailto générique
--   https://ucad.sn/docs/fiche-poste.pdf sans email
--       -> le PDF annexe DEVIENT la destination du bouton « Postuler »
--
-- Ces trois colonnes suppriment la devinette : ce que l'affiche désigne
-- explicitement comme adresse de candidature est stocké comme tel, le
-- reste va dans additional_info et n'est jamais promu destination.

ALTER TABLE public.job_offers
  -- Lien de candidature EXPLICITEMENT désigné par l'annonce
  -- ("postulez sur…", "déposez votre dossier ici…"). Jamais un site
  -- institutionnel ni un document annexe.
  ADD COLUMN IF NOT EXISTS application_url TEXT,
  -- Adresse e-mail EXPLICITEMENT désignée pour recevoir les candidatures
  -- ("envoyez votre CV à…"). Distincte de contact_email, qui reste
  -- l'adresse de contact général de l'annonceur.
  ADD COLUMN IF NOT EXISTS application_email TEXT,
  -- Tout le reste : liens annexes, documents à fournir, précisions
  -- logistiques. Affiché dans une section "Informations complémentaires",
  -- jamais utilisé comme destination de candidature.
  ADD COLUMN IF NOT EXISTS additional_info TEXT;

-- Même périmètre de droits que les colonnes voisines (contact_email,
-- external_link) : ces tables sont accordées COLONNE PAR COLONNE, une
-- nouvelle colonne serait sinon invisible en écriture pour le recruteur.
GRANT INSERT (application_url, application_email, additional_info) ON public.job_offers TO anon, authenticated;
GRANT UPDATE (application_url, application_email, additional_info) ON public.job_offers TO authenticated;

-- Pas de reprise automatique de l'existant : deviner après coup, à partir
-- de external_link/contact_email, laquelle des deux valeurs historiques
-- était « l'adresse de candidature » reproduirait exactement l'heuristique
-- que cette migration supprime. Les offres déjà publiées gardent donc
-- application_url/application_email à NULL et continuent d'être résolues
-- par l'ancien chemin (voir resolveOfferAction, repli inchangé) ; seules
-- les offres passées par l'Examinateur portent l'information explicite.

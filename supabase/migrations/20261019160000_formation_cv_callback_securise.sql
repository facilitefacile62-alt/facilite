-- Formation « Rédaction de CV » : callback Orange Money sécurisé sans dépendre d'une signature.
--
-- Même schéma que les achats de jetons (20261019140000) : le webhook traite la notification comme un déclencheur, la
-- confirme auprès d'Orange puis compare statut, référence ET montant. Une colonne suffit ici :
--  - callback_token_hash : empreinte SHA-256 du jeton secret (32 octets aléatoires) placé dans l'URL de callback de la
--    tentative de paiement en cours (renouvelé à chaque nouveau QR) — jamais le jeton lui-même en base.
-- Pas de montant_xof à ajouter : la colonne existe déjà mais est posée par le client à l'insertion, donc non fiable ;
-- le prix est une constante serveur (MONTANT_FORMATION_CV_XOF, src/lib/formationCvPaiement.js).
-- Colonne facultative : les inscriptions déjà créées n'ont pas de jeton et ne peuvent être validées que par une
-- notification signée valide ou le secret global de l'URL fixe.

ALTER TABLE public.formation_redaction_cv_inscriptions
  ADD COLUMN IF NOT EXISTS callback_token_hash TEXT;

-- Achat de jetons : callback Orange Money sécurisé sans dépendre d'une signature.
--
-- Orange annonce le secret de signature des notifications comme « une évolution à venir » : ses notifications sont donc
-- probablement NON signées aujourd'hui. Le webhook ne crédite plus jamais sur le seul contenu d'une notification : il la
-- traite comme un déclencheur, confirme l'état réel du paiement auprès d'Orange puis compare statut, référence ET montant
-- à la commande. Deux colonnes le permettent :
--  - callback_token_hash : empreinte SHA-256 du jeton secret (32 octets aléatoires) placé dans l'URL de callback de CETTE
--    commande — premier filtre, un jeton par commande (jamais le jeton lui-même en base) ;
--  - montant_xof : le prix en FCFA figé à la commande (« montant » est un nombre de jetons, le prix n'était pas conservé).
-- Colonnes facultatives : les commandes déjà créées n'ont ni l'une ni l'autre et ne peuvent être créditées que par une
-- notification signée valide, jamais par la voie non signée.

ALTER TABLE public.jetons_transactions
  ADD COLUMN IF NOT EXISTS callback_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS montant_xof INTEGER CHECK (montant_xof IS NULL OR montant_xof > 0);

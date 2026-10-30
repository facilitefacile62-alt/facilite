-- « Modèles de documents » : phrase d'accompagnement du message WhatsApp, saisie par l'administrateur (/admin/modeles-documents).
-- Le lien de l'affiche est ajouté automatiquement APRÈS la phrase par l'application et par la story : la phrase n'a pas à le contenir.
-- Vide (NULL) = phrase par défaut écrite dans l'application. Additif : une colonne facultative, rien n'est modifié ni supprimé.
-- Lecture : la colonne est ajoutée aux colonnes déjà lisibles par les comptes connectés (aucune écriture directe, comme le reste de la table).
ALTER TABLE public.modeles_documents
  ADD COLUMN IF NOT EXISTS message_whatsapp text
  CHECK (message_whatsapp IS NULL OR char_length(btrim(message_whatsapp)) BETWEEN 1 AND 300);

GRANT SELECT (message_whatsapp) ON public.modeles_documents TO authenticated;

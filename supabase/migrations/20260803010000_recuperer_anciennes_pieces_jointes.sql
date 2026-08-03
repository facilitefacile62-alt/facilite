-- =====================================================================
-- PARTIE 2, ÉTAPE 2 du chantier — récupère les pièces jointes envoyées
-- avant le passage de chat-attachments en privé (2026-08-03). Ces 10 lignes
-- stockaient encore l'URL publique complète ; ChatAttachmentUrl ne sait
-- résoudre qu'un chemin. Vérifié avant écriture : les 10 fichiers existent
-- toujours dans le bucket (aucun manquant à signaler).
-- =====================================================================
UPDATE public.messages
SET attachment_url = regexp_replace(
  attachment_url,
  '^https?://[^/]+/storage/v1/object/public/chat-attachments/',
  ''
)
WHERE attachment_url LIKE 'http%chat-attachments%';

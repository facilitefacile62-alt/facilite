-- Purge, à la demande du propriétaire (23/10/2026), des messages « Candidature envoyée… » (type_discussion = 'OFFRE') reçus par le
-- compte administrateur principal, qui encombraient sa messagerie. Les échanges, notes vocales, messages de support et de Locaux de ce
-- compte ne sont pas touchés, ni la table `candidatures` elle-même. Une copie des lignes supprimées a été conservée hors du dépôt.
DELETE FROM public.messages
WHERE type_discussion = 'OFFRE'
  AND receiver_id = public.resolve_admin_id();

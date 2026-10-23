-- Purge, à la demande du propriétaire (23/10/2026), de tous les échanges restants du compte administrateur principal : messages
-- envoyés ou reçus (échanges, notes vocales, support, Locaux) puis conversations. Les candidatures (table `candidatures`) et les
-- comptes ne sont pas touchés. Une copie des lignes supprimées a été conservée hors du dépôt.
DELETE FROM public.messages
WHERE sender_id = public.resolve_admin_id()
   OR receiver_id = public.resolve_admin_id();

DELETE FROM public.conversations
WHERE user_1_id = public.resolve_admin_id()
   OR user_2_id = public.resolve_admin_id();

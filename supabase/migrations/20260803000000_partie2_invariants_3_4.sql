-- =====================================================================
-- PARTIE 2 du chantier — les 2 derniers invariants rouges.
-- =====================================================================

-- Invariant 3 : search_path figé sur les 2 fonctions restantes. Ni l'une ni
-- l'autre ne référence d'identifiant ambigu (un seul UPDATE sur auth.users,
-- déjà qualifié) — search_path = '' est donc sûr, pas de qualification
-- supplémentaire nécessaire dans le corps des fonctions.
ALTER FUNCTION public.auto_confirm_user() SET search_path = '';
ALTER FUNCTION public.auto_confirm_user_on_signup() SET search_path = '';

-- Invariant 4 : chat-attachments passe en privé. Risque ÉLEVÉ documenté
-- depuis l'audit du 2026-08 (point 113), jamais corrigé jusqu'ici — le
-- bucket était public et n'avait AUCUNE policy Storage dédiée : n'importe
-- qui devinant/obtenant une URL (partagée, cachée, indexée) accédait à la
-- pièce jointe, participant ou non à la conversation.
UPDATE storage.buckets SET public = false WHERE id = 'chat-attachments';

-- Upload : chacun dans son propre dossier, comme pour resumes/badge-documents.
-- Une ancienne policy "Authenticated upload chat-attachments" (WITH CHECK
-- bucket_id = 'chat-attachments' uniquement, sans restriction de dossier)
-- préexistait et rendait cette nouvelle policy inopérante — même classe de
-- bug qu'une policy permissive trouvée sur job_offers (Vague 2) : une
-- policy trop large masque silencieusement une policy correcte, car les
-- policies permissives d'une même commande sont combinées en OR.
DROP POLICY IF EXISTS "Authenticated upload chat-attachments" ON storage.objects;
CREATE POLICY "Upload de sa propre piece jointe de discussion" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'chat-attachments' AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Lecture : uniquement les participants du message qui référence ce chemin
-- (sender_id/receiver_id), ou un admin/publisher pour la modération —
-- même périmètre que les policies RLS déjà en place sur public.messages.
-- Les URLs signées à expiration courte (createSignedUrl) sont générées côté
-- client via ce même client authentifié : la policy ci-dessous EST le
-- contrôle d'accès réel, pas juste l'existence d'un token temporaire.
CREATE POLICY "Participants lisent les pieces jointes de leur conversation" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'chat-attachments' AND (
      EXISTS (
        SELECT 1 FROM public.messages m
        WHERE m.attachment_url = storage.objects.name
          AND (m.sender_id = auth.uid() OR m.receiver_id = auth.uid())
      )
      OR public.current_user_role() = ANY (ARRAY['admin', 'publisher'])
    )
  );

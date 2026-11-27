-- Retour arrière de 20261127130000_boite_reception_recruteur.sql.
-- ATTENTION : les notes et le journal des consultations sont SUPPRIMÉS ; les candidatures « Vu » redeviennent « Nouveau ».

drop trigger if exists trg_proteger_candidature_a_la_creation on public.candidatures;
drop function if exists public.proteger_candidature_a_la_creation();
drop function if exists public.ouvrir_cv_candidature(uuid);
drop function if exists public.enregistrer_note_candidature(uuid, text);
drop function if exists public.changer_statut_candidature(uuid, text);
drop function if exists public.boite_candidatures(uuid);
drop function if exists public.boite_mes_offres();
drop function if exists public.candidature_dans_ma_boite(uuid);
drop function if exists public.compte_peut_recevoir_candidatures();
drop table if exists public.journal_consultations_cv;
drop table if exists public.candidature_notes;

update public.candidatures set status = 'pending' where status = 'viewed';
alter table public.candidatures drop constraint if exists candidatures_status_check;
alter table public.candidatures add constraint candidatures_status_check
  check (status = any (array['pending', 'reviewed', 'contacted', 'interview_scheduled', 'accepted', 'rejected']));

drop policy if exists "Proprietaire et administrateur lisent les CV" on storage.objects;
create policy "Recruteurs et admins lisent les CV" on storage.objects
  for select using (
    bucket_id = 'resumes'
    and (
      auth.uid() = owner
      or (public.current_user_role() = 'admin' and exists (
            select 1 from public.profiles p
             where p.id::text = (storage.foldername(objects.name))[1] and public.can_admin_read_document(p.id, auth.uid())))
      or (public.current_user_role() = 'user' and public.has_badge(auth.uid(), 'verified_recruiter') and (
            exists (select 1 from public.profiles p where p.id::text = (storage.foldername(objects.name))[1] and p.cv_visible_recruteurs = true)
            or exists (select 1 from public.candidatures c where c.user_id::text = (storage.foldername(objects.name))[1] and c.recruiter_id = auth.uid())))
    )
  );
grant execute on function public.can_recruiter_read_cv(uuid, uuid) to anon, authenticated;

-- Espace recruteur, point 3 : boîte de réception par offre.
-- NON APPLIQUÉE tant que le propriétaire n'a pas donné son accord. À appliquer avec le déploiement du code de la même branche.
-- Retour arrière : supabase/retours_arriere/20261127130000_boite_reception_recruteur.sql
--
-- Règles : un compte voit les candidatures de SES offres APPROUVÉES (badge non exigé), jamais celles des autres ; les comptes de test sont
-- exclus ; les candidatures spontanées restent réservées aux comptes vérifiés ou administrateur. Aucun accès direct au bucket : le CV
-- s'ouvre par une route serveur (lien signé de 60 secondes) et chaque ouverture est journalisée.

-- 1. Statut « Vu ».
alter table public.candidatures drop constraint if exists candidatures_status_check;
alter table public.candidatures add constraint candidatures_status_check
  check (status = any (array['pending', 'viewed', 'reviewed', 'contacted', 'interview_scheduled', 'accepted', 'rejected']));

-- 2. Qui a le droit de recevoir des candidatures : un compte actif qui n'est pas un compte de test.
create or replace function public.compte_peut_recevoir_candidatures()
returns boolean language sql stable security definer set search_path = '' as $f$
  select auth.uid() is not null
     and public.current_user_role() is not null
     and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_test_account);
$f$;

-- 3. Cette candidature est-elle dans la boîte de l'appelant ?
create or replace function public.candidature_dans_ma_boite(p_candidature uuid)
returns boolean language sql stable security definer set search_path = '' as $f$
  select public.compte_peut_recevoir_candidatures() and exists (
    select 1
      from public.candidatures c
      left join public.job_offers o on o.id = c.job_offer_id
     where c.id = p_candidature
       and (
         (c.job_offer_id is not null and o.recruiter_id = auth.uid() and o.status = 'approved')
         or (c.job_offer_id is null and c.recruiter_id = auth.uid()
             and (public.current_user_role() = 'admin' or public.has_badge(auth.uid(), 'verified_recruiter')))
       )
  );
$f$;

-- 4. Notes privées : une par candidature et par auteur. Le candidat n'y a aucun accès.
create table if not exists public.candidature_notes (
  candidature_id uuid not null references public.candidatures (id) on delete cascade,
  auteur_id uuid not null references auth.users (id) on delete cascade,
  note text not null check (char_length(note) between 1 and 2000),
  modifie_le timestamptz not null default now(),
  primary key (candidature_id, auteur_id)
);
alter table public.candidature_notes enable row level security;
revoke all on public.candidature_notes from public, anon, authenticated;
drop policy if exists "Une note n'est lue que par son auteur" on public.candidature_notes;
create policy "Une note n'est lue que par son auteur" on public.candidature_notes
  for select to authenticated using (auteur_id = (select auth.uid()));

-- 5. Journal : chaque CV réellement ouvert (qui, quel candidat, quand).
create table if not exists public.journal_consultations_cv (
  id bigint generated always as identity primary key,
  candidature_id uuid references public.candidatures (id) on delete set null,
  recruteur_id uuid not null,
  candidat_id uuid not null,
  consulte_le timestamptz not null default now()
);
create index if not exists journal_consultations_cv_recruteur on public.journal_consultations_cv (recruteur_id, consulte_le desc);
create index if not exists journal_consultations_cv_candidat on public.journal_consultations_cv (candidat_id, consulte_le desc);
alter table public.journal_consultations_cv enable row level security;
revoke all on public.journal_consultations_cv from public, anon, authenticated;
drop policy if exists "Un administrateur lit le journal des consultations de CV" on public.journal_consultations_cv;
create policy "Un administrateur lit le journal des consultations de CV" on public.journal_consultations_cv
  for select to authenticated using (public.current_user_role() = 'admin');
grant select on public.journal_consultations_cv to authenticated;

-- 6. Mes offres, avec leurs compteurs (les candidatures ne comptent que pour une offre approuvée).
create or replace function public.boite_mes_offres()
returns table (
  offre_id uuid, titre text, societe text, statut_offre text, active boolean, archivee boolean, date_limite date, publiee_le timestamptz,
  total int, nouvelles int, vues int, preselectionnees int, contactees int, entretiens int, retenues int, refusees int, derniere timestamptz
) language sql stable security definer set search_path = '' as $f$
  (select o.id, o.title, o.company, o.status, o.is_active, o.archived_at is not null, o.deadline, o.created_at,
          count(c.id)::int,
          count(c.id) filter (where c.status = 'pending')::int,
          count(c.id) filter (where c.status = 'viewed')::int,
          count(c.id) filter (where c.status = 'reviewed')::int,
          count(c.id) filter (where c.status = 'contacted')::int,
          count(c.id) filter (where c.status = 'interview_scheduled')::int,
          count(c.id) filter (where c.status = 'accepted')::int,
          count(c.id) filter (where c.status = 'rejected')::int,
          max(c.created_at)
     from public.job_offers o
     left join public.candidatures c on c.job_offer_id = o.id and o.status = 'approved'
    where o.recruiter_id = auth.uid() and public.compte_peut_recevoir_candidatures()
    group by o.id)
  union all
  (select null::uuid, 'Candidatures spontanées'::text, null::text, 'approved'::text, true, false, null::date, null::timestamptz,
          count(*)::int,
          count(*) filter (where c.status = 'pending')::int,
          count(*) filter (where c.status = 'viewed')::int,
          count(*) filter (where c.status = 'reviewed')::int,
          count(*) filter (where c.status = 'contacted')::int,
          count(*) filter (where c.status = 'interview_scheduled')::int,
          count(*) filter (where c.status = 'accepted')::int,
          count(*) filter (where c.status = 'rejected')::int,
          max(c.created_at)
     from public.candidatures c
    where c.job_offer_id is null and c.recruiter_id = auth.uid() and public.compte_peut_recevoir_candidatures()
      and (public.current_user_role() = 'admin' or public.has_badge(auth.uid(), 'verified_recruiter'))
   having count(*) > 0)
  order by 17 desc nulls last, 8 desc nulls last;
$f$;

-- 7. Les candidatures d'une de mes offres (p_offre nul = candidatures spontanées). Ni chemin de CV ni coordonnées non révélées.
create or replace function public.boite_candidatures(p_offre uuid)
returns table (
  candidature_id uuid, nom text, poste text, niveau_code text, niveau_exige_code text, score int, recue_le timestamptz, statut text,
  statut_depuis timestamptz, a_un_cv boolean, lettre text, note text, email text
) language sql stable security definer set search_path = '' as $f$
  select c.id, c.full_name, coalesce(o.title, c.job_title), p.education_level_code, o.min_education_level_code,
         nullif(c.cv_match_score, 0), c.created_at, c.status, c.status_changed_at,
         length(coalesce(c.cv_url, '')) > 0, c.cover_letter, n.note,
         case when c.contact_revealed then c.email end
    from public.candidatures c
    left join public.job_offers o on o.id = c.job_offer_id
    left join public.profiles p on p.id = c.user_id
    left join public.candidature_notes n on n.candidature_id = c.id and n.auteur_id = auth.uid()
   where public.compte_peut_recevoir_candidatures()
     and (
       (p_offre is not null and c.job_offer_id = p_offre and o.recruiter_id = auth.uid() and o.status = 'approved')
       or (p_offre is null and c.job_offer_id is null and c.recruiter_id = auth.uid()
           and (public.current_user_role() = 'admin' or public.has_badge(auth.uid(), 'verified_recruiter')))
     )
   order by c.created_at desc
   limit 500;
$f$;

-- 8. Changer le statut d'une candidature de ma boîte.
create or replace function public.changer_statut_candidature(p_candidature uuid, p_statut text)
returns text language plpgsql security definer set search_path = '' as $f$
begin
  if not public.candidature_dans_ma_boite(p_candidature) then
    raise exception 'candidature_introuvable' using errcode = 'P0002';
  end if;
  if p_statut is null or not (p_statut = any (array['pending', 'viewed', 'reviewed', 'interview_scheduled', 'accepted', 'rejected'])) then
    raise exception 'statut_invalide' using errcode = '22023';
  end if;
  update public.candidatures set status = p_statut where id = p_candidature;
  return p_statut;
end;
$f$;

-- 9. Note privée (texte vide = suppression).
create or replace function public.enregistrer_note_candidature(p_candidature uuid, p_note text)
returns void language plpgsql security definer set search_path = '' as $f$
declare
  v_note text := btrim(coalesce(p_note, ''));
begin
  if not public.candidature_dans_ma_boite(p_candidature) then
    raise exception 'candidature_introuvable' using errcode = 'P0002';
  end if;
  if length(v_note) > 2000 then
    raise exception 'note_trop_longue' using errcode = '22001';
  end if;
  if length(v_note) = 0 then
    delete from public.candidature_notes where candidature_id = p_candidature and auteur_id = auth.uid();
    return;
  end if;
  insert into public.candidature_notes (candidature_id, auteur_id, note)
  values (p_candidature, auth.uid(), v_note)
  on conflict (candidature_id, auteur_id) do update set note = excluded.note, modifie_le = now();
end;
$f$;

-- 10. Ouvrir un CV : contrôle, journal, passage de « Nouveau » à « Vu ». Renvoie le chemin à signer par le serveur.
create or replace function public.ouvrir_cv_candidature(p_candidature uuid)
returns table (chemin text, candidat uuid) language plpgsql security definer set search_path = '' as $f$
declare
  v record;
begin
  if not public.candidature_dans_ma_boite(p_candidature) then
    raise exception 'candidature_introuvable' using errcode = 'P0002';
  end if;
  select c.user_id, c.cv_url, c.created_at, c.status into v from public.candidatures c where c.id = p_candidature;
  -- Le fichier doit être dans le dossier du candidat (ancien format « cvs/ » toléré pour les candidatures d'avant le 15/08/2026).
  if position('..' in v.cv_url) > 0
     or not (v.cv_url like v.user_id::text || '/%' or (v.cv_url like 'cvs/%' and v.created_at < timestamptz '2026-08-15')) then
    raise exception 'cv_indisponible' using errcode = 'P0002';
  end if;
  -- Frein à l'aspiration : 200 ouvertures par jour et par compte (l'administrateur n'est pas limité).
  if public.current_user_role() is distinct from 'admin'
     and (select count(*) from public.journal_consultations_cv j where j.recruteur_id = auth.uid() and j.consulte_le > now() - interval '1 day') >= 200 then
    raise exception 'quota_cv_atteint' using errcode = '54000';
  end if;
  insert into public.journal_consultations_cv (candidature_id, recruteur_id, candidat_id) values (p_candidature, auth.uid(), v.user_id);
  if v.status = 'pending' then
    update public.candidatures set status = 'viewed' where id = p_candidature;
  end if;
  return query select v.cv_url::text, v.user_id;
end;
$f$;

-- 11. Droits : appelables par un compte connecté seulement.
revoke all on function public.compte_peut_recevoir_candidatures() from public, anon;
revoke all on function public.candidature_dans_ma_boite(uuid) from public, anon;
revoke all on function public.boite_mes_offres() from public, anon;
revoke all on function public.boite_candidatures(uuid) from public, anon;
revoke all on function public.changer_statut_candidature(uuid, text) from public, anon;
revoke all on function public.enregistrer_note_candidature(uuid, text) from public, anon;
revoke all on function public.ouvrir_cv_candidature(uuid) from public, anon;
grant execute on function public.compte_peut_recevoir_candidatures() to authenticated;
grant execute on function public.candidature_dans_ma_boite(uuid) to authenticated;
grant execute on function public.boite_mes_offres() to authenticated;
grant execute on function public.boite_candidatures(uuid) to authenticated;
grant execute on function public.changer_statut_candidature(uuid, text) to authenticated;
grant execute on function public.enregistrer_note_candidature(uuid, text) to authenticated;
grant execute on function public.ouvrir_cv_candidature(uuid) to authenticated;

-- 12. Faille E : une candidature créée avec le jeton d'un utilisateur ne peut fixer ni son score, ni son statut, ni un CV hors de son dossier.
--     La route serveur écrit le score ensuite avec la clé de service.
create or replace function public.proteger_candidature_a_la_creation()
returns trigger language plpgsql security definer set search_path = '' as $f$
begin
  if auth.role() = 'authenticated' and public.current_user_role() is distinct from 'admin' then
    new.status := 'pending';
    new.status_changed_at := now();
    new.first_response_at := null;
    new.contact_revealed := false;
    new.cv_match_score := null;
    -- Le destinataire interne d'une candidature à une offre est le propriétaire de l'offre, jamais une valeur envoyée par le client
    -- (c'est aussi lui que notifie notify_recruiter_new_candidature).
    if new.job_offer_id is not null then
      new.recruiter_id := (select o.recruiter_id from public.job_offers o where o.id = new.job_offer_id);
    end if;
    if length(coalesce(new.cv_url, '')) > 0
       and (position('..' in new.cv_url) > 0 or not (new.cv_url like new.user_id::text || '/%')) then
      raise exception 'cv_hors_de_votre_dossier' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$f$;
revoke all on function public.proteger_candidature_a_la_creation() from public, anon, authenticated;
drop trigger if exists trg_proteger_candidature_a_la_creation on public.candidatures;
create trigger trg_proteger_candidature_a_la_creation
  before insert on public.candidatures
  for each row execute function public.proteger_candidature_a_la_creation();

-- 13. Faille A : plus aucun accès direct d'un recruteur au bucket des CV (tout le dossier d'un candidat était lisible).
--     Le propriétaire et l'administrateur (avec consentement) gardent leur accès.
drop policy if exists "Recruteurs et admins lisent les CV" on storage.objects;
drop policy if exists "Proprietaire et administrateur lisent les CV" on storage.objects;
create policy "Proprietaire et administrateur lisent les CV" on storage.objects
  for select using (
    bucket_id = 'resumes'
    and (
      auth.uid() = owner
      or (public.current_user_role() = 'admin' and exists (
            select 1 from public.profiles p
             where p.id::text = (storage.foldername(objects.name))[1] and public.can_admin_read_document(p.id, auth.uid())))
    )
  );
-- Ancienne fonction inutilisée, au contrôle erroné et appelable par un visiteur anonyme.
revoke all on function public.can_recruiter_read_cv(uuid, uuid) from public, anon, authenticated;

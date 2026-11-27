-- Vérification de 20261127130000_boite_reception_recruteur.sql avec DEUX recruteurs et DEUX candidats fabriqués. Rien n'est conservé :
-- tout est dans une transaction qui se termine par une exception volontaire (« VERIFICATION_REUSSIE »), donc annulée.
-- Toute assertion fausse arrête le script avec « ECHEC : … ». Pour un essai à blanc AVANT application, le contenu de la migration est
-- placé à la ligne « -- MIGRATION ».
begin;
set local lock_timeout = '5s';
set local statement_timeout = '90s';
-- MIGRATION

insert into auth.users (id, email, aud, role, email_confirmed_at) values
  ('00000000-0000-4000-8000-00000000000a', 'verif-recruteur-a@verification.invalid', 'authenticated', 'authenticated', now()),
  ('00000000-0000-4000-8000-00000000000b', 'verif-recruteur-b@verification.invalid', 'authenticated', 'authenticated', now()),
  ('00000000-0000-4000-8000-00000000000c', 'verif-candidat-c@verification.invalid', 'authenticated', 'authenticated', now()),
  ('00000000-0000-4000-8000-00000000000d', 'verif-candidat-d@verification.invalid', 'authenticated', 'authenticated', now());
insert into public.profiles (id, email, full_name) values
  ('00000000-0000-4000-8000-00000000000a', 'verif-recruteur-a@verification.invalid', 'Recruteur A'),
  ('00000000-0000-4000-8000-00000000000b', 'verif-recruteur-b@verification.invalid', 'Recruteur B'),
  ('00000000-0000-4000-8000-00000000000c', 'verif-candidat-c@verification.invalid', 'Candidat C'),
  ('00000000-0000-4000-8000-00000000000d', 'verif-candidat-d@verification.invalid', 'Candidat D')
on conflict (id) do update set full_name = excluded.full_name;
insert into public.user_roles (user_id, role, status) values
  ('00000000-0000-4000-8000-00000000000a', 'user', 'active'),
  ('00000000-0000-4000-8000-00000000000b', 'user', 'active'),
  ('00000000-0000-4000-8000-00000000000c', 'user', 'active'),
  ('00000000-0000-4000-8000-00000000000d', 'user', 'active')
on conflict (user_id) do update set role = 'user', status = 'active';

-- Offres : A approuvée (recruteur A), B approuvée (recruteur B), une offre de A en attente.
insert into public.job_offers (id, title, company, location, description, recruiter_id, status, is_active) values
  ('10000000-0000-4000-8000-00000000000a', 'Offre A', 'Société A', 'Dakar', 'x', '00000000-0000-4000-8000-00000000000a', 'approved', true),
  ('10000000-0000-4000-8000-00000000000b', 'Offre B', 'Société B', 'Dakar', 'x', '00000000-0000-4000-8000-00000000000b', 'approved', true),
  ('10000000-0000-4000-8000-0000000000a2', 'Offre A en attente', 'Société A', 'Dakar', 'x', '00000000-0000-4000-8000-00000000000a', 'pending_review', true);
select set_config('request.jwt.claims', json_build_object('sub', (select user_id from public.user_roles where role = 'admin' limit 1), 'role', 'authenticated')::text, true);
update public.job_offers set status = 'approved' where id in ('10000000-0000-4000-8000-00000000000a', '10000000-0000-4000-8000-00000000000b');
update public.job_offers set status = 'pending_review' where id = '10000000-0000-4000-8000-0000000000a2';
select set_config('request.jwt.claims', '', true);

-- Un fichier de CV fictif dans le dossier de chaque candidat.
insert into storage.objects (bucket_id, name, owner, owner_id) values
  ('resumes', '00000000-0000-4000-8000-00000000000c/cvs/cv.pdf', '00000000-0000-4000-8000-00000000000c', '00000000-0000-4000-8000-00000000000c'),
  ('resumes', '00000000-0000-4000-8000-00000000000d/cvs/cv.pdf', '00000000-0000-4000-8000-00000000000d', '00000000-0000-4000-8000-00000000000d');

-- Candidat C postule à l'offre A avec SON jeton : il essaie de falsifier score, statut, destinataire, et de joindre le CV d'un autre.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000c","role":"authenticated"}', true);
set local role authenticated;
insert into public.candidatures (id, user_id, job_offer_id, job_title, company, full_name, email, cv_url, status, cv_match_score, recruiter_id, contact_revealed) values
  ('20000000-0000-4000-8000-00000000000c', '00000000-0000-4000-8000-00000000000c', '10000000-0000-4000-8000-00000000000a', 'Offre A', 'Société A', 'Candidat C', 'verif-candidat-c@verification.invalid',
   '00000000-0000-4000-8000-00000000000c/cvs/cv.pdf', 'accepted', 100, '00000000-0000-4000-8000-00000000000b', true);
do $$
declare r record; refus boolean;
begin
  select * into r from public.candidatures where id = '20000000-0000-4000-8000-00000000000c';
  assert r.status = 'pending', 'ECHEC : le candidat a fixé le statut';
  assert r.cv_match_score is null, 'ECHEC : le candidat a fixé son score';
  assert r.recruiter_id = '00000000-0000-4000-8000-00000000000a', 'ECHEC : destinataire interne différent du propriétaire';
  assert r.contact_revealed is false, 'ECHEC : contact révélé par le client';
  begin
    insert into public.candidatures (user_id, job_offer_id, job_title, company, full_name, email, cv_url)
    values ('00000000-0000-4000-8000-00000000000c', '10000000-0000-4000-8000-00000000000b', 'Offre B', 'Société B', 'Candidat C', 'x@verification.invalid', '00000000-0000-4000-8000-00000000000d/cvs/cv.pdf');
    refus := false;
  exception when insufficient_privilege then refus := true; end;
  assert refus, 'ECHEC : le CV d''un autre candidat a été accepté';
end $$;
reset role;

-- Candidat D postule à l'offre B.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000d","role":"authenticated"}', true);
set local role authenticated;
insert into public.candidatures (id, user_id, job_offer_id, job_title, company, full_name, email, cv_url) values
  ('20000000-0000-4000-8000-00000000000d', '00000000-0000-4000-8000-00000000000d', '10000000-0000-4000-8000-00000000000b', 'Offre B', 'Société B', 'Candidat D', 'verif-candidat-d@verification.invalid',
   '00000000-0000-4000-8000-00000000000d/cvs/cv.pdf');

-- Candidat D : ne voit que les siennes ; ni notes, ni journal, ni CV d'un autre, ni boîte.
do $$
declare refus boolean;
begin
  assert (select count(*) from public.candidatures) = 1 and (select id from public.candidatures) = '20000000-0000-4000-8000-00000000000d', 'ECHEC : D voit d''autres candidatures';
  assert (select count(*) from storage.objects where bucket_id = 'resumes' and name like '00000000-0000-4000-8000-00000000000d/%') = 1, 'ECHEC : D ne voit pas son CV';
  assert (select count(*) from storage.objects where bucket_id = 'resumes' and name like '00000000-0000-4000-8000-00000000000c/%') = 0, 'ECHEC : D voit le CV de C';
  begin perform 1 from public.candidature_notes; refus := false; exception when insufficient_privilege then refus := true; end;
  assert refus, 'ECHEC : un candidat accède à la table des notes';
  assert (select count(*) from public.journal_consultations_cv) = 0, 'ECHEC : un candidat lit le journal';
  assert (select count(*) from public.boite_candidatures('10000000-0000-4000-8000-00000000000b')) = 0, 'ECHEC : un candidat lit la boîte d''une offre';
  assert not public.candidature_dans_ma_boite('20000000-0000-4000-8000-00000000000c'), 'ECHEC : candidature d''un autre accessible';
end $$;
reset role;

-- Candidat C : ne voit que les siennes.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000c","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  assert (select count(*) from public.candidatures) = 1 and (select id from public.candidatures) = '20000000-0000-4000-8000-00000000000c', 'ECHEC : C voit d''autres candidatures';
  assert (select count(*) from storage.objects where bucket_id = 'resumes' and name like '00000000-0000-4000-8000-00000000000d/%') = 0, 'ECHEC : C voit le CV de D';
  assert (select count(*) from public.boite_mes_offres()) = 0, 'ECHEC : le candidat voit des offres dans sa boîte';
end $$;
reset role;

-- Recruteur A : voit la candidature de SON offre seulement ; peut la traiter ; aucun fichier en direct ; rien de B.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v record; refus int := 0;
begin
  assert (select total from public.boite_mes_offres() where offre_id = '10000000-0000-4000-8000-00000000000a') = 1, 'ECHEC : A ne voit pas sa candidature';
  assert not exists (select 1 from public.boite_mes_offres() where offre_id = '10000000-0000-4000-8000-00000000000b'), 'ECHEC : A voit l''offre de B';
  assert (select count(*) from public.boite_candidatures('10000000-0000-4000-8000-00000000000b')) = 0, 'ECHEC : A lit les candidatures de B';
  assert (select count(*) from public.candidatures) = 0, 'ECHEC : A lit la table des candidatures';
  assert (select count(*) from storage.objects where bucket_id = 'resumes' and name like '00000000-0000-4000-8000-00000000000%') = 0, 'ECHEC : A accède au bucket des CV';
  assert (select email from public.boite_candidatures('10000000-0000-4000-8000-00000000000a')) is null, 'ECHEC : e-mail non révélé visible';
  select * into v from public.ouvrir_cv_candidature('20000000-0000-4000-8000-00000000000c');
  assert v.chemin = '00000000-0000-4000-8000-00000000000c/cvs/cv.pdf', 'ECHEC : chemin du CV';
  assert (select statut from public.boite_candidatures('10000000-0000-4000-8000-00000000000a')) = 'viewed', 'ECHEC : statut « Vu » après ouverture';
  perform public.changer_statut_candidature('20000000-0000-4000-8000-00000000000c', 'reviewed');
  perform public.enregistrer_note_candidature('20000000-0000-4000-8000-00000000000c', 'note privée de A');
  assert (select statut || '|' || note from public.boite_candidatures('10000000-0000-4000-8000-00000000000a')) = 'reviewed|note privée de A', 'ECHEC : statut ou note';
  begin perform * from public.ouvrir_cv_candidature('20000000-0000-4000-8000-00000000000d'); exception when no_data_found then refus := refus + 1; end;
  begin perform public.changer_statut_candidature('20000000-0000-4000-8000-00000000000d', 'rejected'); exception when no_data_found then refus := refus + 1; end;
  begin perform public.enregistrer_note_candidature('20000000-0000-4000-8000-00000000000d', 'intrus'); exception when no_data_found then refus := refus + 1; end;
  assert refus = 3, 'ECHEC : A a pu agir sur la candidature de B (' || refus || ' refus sur 3)';
end $$;
reset role;

-- Recruteur B : la sienne, rien de A (ni lecture, ni statut, ni note, ni CV).
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v record; refus int := 0;
begin
  assert (select count(*) from public.boite_candidatures('10000000-0000-4000-8000-00000000000b')) = 1, 'ECHEC : B ne voit pas sa candidature';
  select * into v from public.ouvrir_cv_candidature('20000000-0000-4000-8000-00000000000d');
  assert v.chemin = '00000000-0000-4000-8000-00000000000d/cvs/cv.pdf', 'ECHEC : chemin du CV de B';
  assert not exists (select 1 from public.boite_mes_offres() where offre_id = '10000000-0000-4000-8000-00000000000a'), 'ECHEC : B voit l''offre de A';
  assert (select count(*) from public.boite_candidatures('10000000-0000-4000-8000-00000000000a')) = 0, 'ECHEC : B lit les candidatures de A';
  assert (select note from public.boite_candidatures('10000000-0000-4000-8000-00000000000b')) is null, 'ECHEC : B voit une note';
  assert (select count(*) from storage.objects where bucket_id = 'resumes' and name like '00000000-0000-4000-8000-00000000000%') = 0, 'ECHEC : B accède au bucket des CV';
  begin perform * from public.ouvrir_cv_candidature('20000000-0000-4000-8000-00000000000c'); exception when no_data_found then refus := refus + 1; end;
  begin perform public.changer_statut_candidature('20000000-0000-4000-8000-00000000000c', 'rejected'); exception when no_data_found then refus := refus + 1; end;
  begin perform public.enregistrer_note_candidature('20000000-0000-4000-8000-00000000000c', 'intrus'); exception when no_data_found then refus := refus + 1; end;
  assert refus = 3, 'ECHEC : B a pu agir sur la candidature de A (' || refus || ' refus sur 3)';
end $$;
reset role;

-- Offre non approuvée : aucune candidature visible. Compte de test : exclu.
select set_config('request.jwt.claims', json_build_object('sub', (select user_id from public.user_roles where role = 'admin' limit 1), 'role', 'authenticated')::text, true);
update public.job_offers set status = 'rejected' where id = '10000000-0000-4000-8000-00000000000a';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  assert (select count(*) from public.boite_candidatures('10000000-0000-4000-8000-00000000000a')) = 0, 'ECHEC : offre non approuvée visible';
end $$;
reset role;
select set_config('request.jwt.claims', '', true);
update public.profiles set is_test_account = true where id = '00000000-0000-4000-8000-00000000000b';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  assert (select count(*) from public.boite_mes_offres()) = 0, 'ECHEC : un compte de test a une boîte';
end $$;
reset role;

-- Le journal a retenu chaque CV ouvert (recruteur, candidat) : deux ouvertures, ni plus ni moins.
do $$ begin
  assert (select count(*) from public.journal_consultations_cv where candidat_id in ('00000000-0000-4000-8000-00000000000c', '00000000-0000-4000-8000-00000000000d')) = 2, 'ECHEC : journal';
  assert (select recruteur_id from public.journal_consultations_cv where candidat_id = '00000000-0000-4000-8000-00000000000c') = '00000000-0000-4000-8000-00000000000a', 'ECHEC : journal, recruteur';
  raise exception 'VERIFICATION_REUSSIE (tout est annulé volontairement)';
end $$;

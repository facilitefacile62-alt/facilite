-- Vérification de 20261127130000_boite_reception_recruteur.sql avec DEUX comptes recruteurs fabriqués. Rien n'est conservé :
-- tout est dans une transaction qui se termine par une exception volontaire (« VERIFICATION_REUSSIE »), donc annulée.
-- Toute assertion fausse arrête le script avec « ECHEC : … ». Pour un essai à blanc AVANT application, placer le contenu de la
-- migration entre le « begin; » et la première insertion.
begin;

insert into auth.users (id, email, aud, role, email_confirmed_at) values
  ('00000000-0000-4000-8000-00000000000a', 'verif-recruteur-a@verification.invalid', 'authenticated', 'authenticated', now()),
  ('00000000-0000-4000-8000-00000000000b', 'verif-recruteur-b@verification.invalid', 'authenticated', 'authenticated', now()),
  ('00000000-0000-4000-8000-00000000000c', 'verif-candidat@verification.invalid', 'authenticated', 'authenticated', now());
insert into public.profiles (id, email, full_name) values
  ('00000000-0000-4000-8000-00000000000a', 'verif-recruteur-a@verification.invalid', 'Recruteur A'),
  ('00000000-0000-4000-8000-00000000000b', 'verif-recruteur-b@verification.invalid', 'Recruteur B'),
  ('00000000-0000-4000-8000-00000000000c', 'verif-candidat@verification.invalid', 'Candidat C')
on conflict (id) do update set full_name = excluded.full_name;
insert into public.user_roles (user_id, role, status) values
  ('00000000-0000-4000-8000-00000000000a', 'user', 'active'),
  ('00000000-0000-4000-8000-00000000000b', 'user', 'active'),
  ('00000000-0000-4000-8000-00000000000c', 'user', 'active')
on conflict (user_id) do update set role = 'user', status = 'active';

-- Offres : A approuvée, B approuvée, A en attente. Écrites avec les droits du script (le déclencheur de modération est contourné par
-- une mise à jour du statut au nom de l'administrateur).
insert into public.job_offers (id, title, company, location, description, recruiter_id, status, is_active) values
  ('10000000-0000-4000-8000-00000000000a', 'Offre A', 'Société A', 'Dakar', 'x', '00000000-0000-4000-8000-00000000000a', 'approved', true),
  ('10000000-0000-4000-8000-00000000000b', 'Offre B', 'Société B', 'Dakar', 'x', '00000000-0000-4000-8000-00000000000b', 'approved', true),
  ('10000000-0000-4000-8000-0000000000a2', 'Offre A en attente', 'Société A', 'Dakar', 'x', '00000000-0000-4000-8000-00000000000a', 'pending_review', true);
select set_config('request.jwt.claims', json_build_object('sub', (select user_id from public.user_roles where role = 'admin' limit 1), 'role', 'authenticated')::text, true);
update public.job_offers set status = 'approved' where id in ('10000000-0000-4000-8000-00000000000a', '10000000-0000-4000-8000-00000000000b');
update public.job_offers set status = 'pending_review' where id = '10000000-0000-4000-8000-0000000000a2';

-- Le candidat postule avec SON jeton : il essaie de falsifier score, statut et destinataire.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000c","role":"authenticated"}', true);
set local role authenticated;
insert into public.candidatures (id, user_id, job_offer_id, job_title, company, full_name, email, cv_url, status, cv_match_score, recruiter_id, contact_revealed) values
  ('20000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000c', '10000000-0000-4000-8000-00000000000a', 'Offre A', 'Société A', 'Candidat C', 'verif-candidat@verification.invalid',
   '00000000-0000-4000-8000-00000000000c/cvs/cv.pdf', 'accepted', 100, '00000000-0000-4000-8000-00000000000b', true);
do $$
declare r record; refus boolean;
begin
  select * into r from public.candidatures where id = '20000000-0000-4000-8000-00000000000a';
  assert r.status = 'pending', 'ECHEC : le candidat a fixé le statut';
  assert r.cv_match_score is null, 'ECHEC : le candidat a fixé son score';
  assert r.recruiter_id = '00000000-0000-4000-8000-00000000000a', 'ECHEC : destinataire interne différent du propriétaire';
  assert r.contact_revealed is false, 'ECHEC : contact révélé par le client';
  begin
    insert into public.candidatures (user_id, job_offer_id, job_title, company, full_name, email, cv_url)
    values ('00000000-0000-4000-8000-00000000000c', '10000000-0000-4000-8000-00000000000b', 'Offre B', 'Société B', 'Candidat C', 'x@verification.invalid', '00000000-0000-4000-8000-00000000000b/cvs/autre.pdf');
    refus := false;
  exception when insufficient_privilege then refus := true; end;
  assert refus, 'ECHEC : un CV hors du dossier du candidat a été accepté';
  assert (select count(*) from public.boite_mes_offres()) = 0, 'ECHEC : le candidat voit des offres dans sa boîte';
end $$;

-- Recruteur A : voit SA candidature, pas celles de B ; peut la traiter.
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
do $$
declare v record;
begin
  assert (select total from public.boite_mes_offres() where offre_id = '10000000-0000-4000-8000-00000000000a') = 1, 'ECHEC : A ne voit pas sa candidature';
  assert not exists (select 1 from public.boite_mes_offres() where offre_id = '10000000-0000-4000-8000-00000000000b'), 'ECHEC : A voit l''offre de B';
  assert (select count(*) from public.boite_candidatures('10000000-0000-4000-8000-00000000000b')) = 0, 'ECHEC : A lit les candidatures de B';
  assert (select email from public.boite_candidatures('10000000-0000-4000-8000-00000000000a')) is null, 'ECHEC : e-mail non révélé visible';
  select * into v from public.ouvrir_cv_candidature('20000000-0000-4000-8000-00000000000a');
  assert v.chemin = '00000000-0000-4000-8000-00000000000c/cvs/cv.pdf', 'ECHEC : chemin du CV';
  assert (select statut from public.boite_candidatures('10000000-0000-4000-8000-00000000000a')) = 'viewed', 'ECHEC : statut « Vu » après ouverture';
  perform public.changer_statut_candidature('20000000-0000-4000-8000-00000000000a', 'reviewed');
  perform public.enregistrer_note_candidature('20000000-0000-4000-8000-00000000000a', 'note privée de A');
  assert (select statut || '|' || note from public.boite_candidatures('10000000-0000-4000-8000-00000000000a')) = 'reviewed|note privée de A', 'ECHEC : statut ou note';
end $$;

-- Recruteur B : rien de A, ni lecture, ni statut, ni note, ni CV.
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
do $$
declare refus int := 0;
begin
  assert not exists (select 1 from public.boite_mes_offres() where offre_id = '10000000-0000-4000-8000-00000000000a'), 'ECHEC : B voit l''offre de A';
  assert (select count(*) from public.boite_candidatures('10000000-0000-4000-8000-00000000000a')) = 0, 'ECHEC : B lit les candidatures de A';
  assert not public.candidature_dans_ma_boite('20000000-0000-4000-8000-00000000000a'), 'ECHEC : candidature de A dans la boîte de B';
  begin perform public.changer_statut_candidature('20000000-0000-4000-8000-00000000000a', 'rejected'); exception when no_data_found then refus := refus + 1; end;
  begin perform public.enregistrer_note_candidature('20000000-0000-4000-8000-00000000000a', 'intrus'); exception when no_data_found then refus := refus + 1; end;
  begin perform * from public.ouvrir_cv_candidature('20000000-0000-4000-8000-00000000000a'); exception when no_data_found then refus := refus + 1; end;
  assert refus = 3, 'ECHEC : B a pu agir sur la candidature de A (' || refus || ' refus sur 3)';
  assert (select count(*) from public.candidatures where id = '20000000-0000-4000-8000-00000000000a') = 0, 'ECHEC : B lit la table';
end $$;

-- Offre non approuvée : aucune candidature visible. Compte de test : exclu.
reset role;
select set_config('request.jwt.claims', json_build_object('sub', (select user_id from public.user_roles where role = 'admin' limit 1), 'role', 'authenticated')::text, true);
update public.job_offers set status = 'rejected' where id = '10000000-0000-4000-8000-00000000000a';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  assert (select count(*) from public.boite_candidatures('10000000-0000-4000-8000-00000000000a')) = 0, 'ECHEC : offre non approuvée visible';
end $$;
reset role;
update public.profiles set is_test_account = true where id = '00000000-0000-4000-8000-00000000000b';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-00000000000b","role":"authenticated"}', true);
set local role authenticated;
do $$ begin
  assert (select count(*) from public.boite_mes_offres()) = 0, 'ECHEC : un compte de test a une boîte';
end $$;

-- Le journal a bien retenu l'ouverture, et seul un administrateur le lit.
reset role;
do $$ begin
  assert (select count(*) from public.journal_consultations_cv where candidature_id = '20000000-0000-4000-8000-00000000000a') = 1, 'ECHEC : journal';
  raise exception 'VERIFICATION_REUSSIE (tout est annulé volontairement)';
end $$;

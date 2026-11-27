-- Retour arrière de 20261127120000_masquer_offres.sql : remet ces offres en ligne (état d'origine : approved).
-- Garde-fou : un seul compte administrateur, sinon rien n'est fait.
do $g$ begin
  if (select count(*) from public.user_roles where role = 'admin') is distinct from 1 then
    raise exception 'un seul administrateur attendu';
  end if;
end $g$;
-- La décision de modération est prise au nom de l'administrateur (moderate_job_offer la journalise).
select set_config('request.jwt.claims', json_build_object('sub', (select user_id from public.user_roles where role = 'admin'), 'role', 'authenticated')::text, true);
select public.moderate_job_offer(id, 'approved', 'retour arriere du masquage du 27/11/2026')
  from public.job_offers
 where id in (
    '20000000-0000-4000-a000-000000000001',
    '20000000-0000-4000-a000-000000000002',
    'acbf6a9a-1d52-4dd3-a571-1da6d65965a4',
    '9723e187-05f5-45e8-9659-a07a1434071c',
    '7228c89a-62bd-4094-a71d-b7768e1f6810',
    '5504e393-423f-476e-b14b-d571504fea48',
    '23d20fb9-897d-4781-ae8e-3f12a6aebccb',
    '60cb8b6a-611a-4691-8ac9-1c5564097f7f',
    '88eab237-ff22-45af-8026-663c93633601',
    '20000000-0000-4000-a000-000000000005',
    '20000000-0000-4000-a000-000000000006',
    '20000000-0000-4000-a000-000000000003',
    '20000000-0000-4000-a000-000000000004',
    '402cd388-5e86-4082-950b-fb5ec69f4e9e',
    '88198ab0-bd53-43d1-bbf9-ffd294fb48ed',
    '258eca7f-d9e2-45b8-a015-5642354ab712',
    '82dd1b8a-8234-4862-8580-dfe4e47897b0',
    '8119367c-e0e0-4279-ba9f-ec1a6063bae0',
    'b69b4b86-859f-4cff-a508-b2c21c74e765'
 )
   and status = 'rejected';

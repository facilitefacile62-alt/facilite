-- Décision du propriétaire du site (27/11/2026) : masquer ces 19 offres (exception explicite à la règle « ne jamais masquer »,
-- valable pour elles seules). Réversible : aucune suppression, candidatures et traces conservées.
-- 13 offres d'exemple et 6 offres douteuses. Méthode : modération « rejected » (invisible du public, y compris à l'adresse directe).
-- Retour arrière : supabase/retours_arriere/20261127120000_masquer_offres.sql
--   SeneTech Solutions : Développeur Full-Stack React / Node.js
--   SeneTech Solutions : Ingénieur DevOps Cloud
--   Alpha Digital Sénégal : Développeur Full-Stack
--   Alpha Digital Sénégal : Chargé(e) de Clientèle
--   Alpha Digital Sénégal : Comptable Senior
--   Alpha Digital Sénégal : Assistant(e) Marketing Digital
--   Alpha Digital Sénégal : Responsable Commercial
--   Alpha Digital Sénégal : Stagiaire RH
--   Alpha Digital Sénégal : Technicien Support IT
--   Teranga Consulting : Chargé(e) de Recrutement
--   Teranga Consulting : Assistant(e) Administratif(ve) RH
--   Dakar Digital Agency : Chargé(e) de Community Management
--   Dakar Digital Agency : Chef de Projet Marketing Digital
--   Fadel Digital : Développeur Informaticien Web
--   Wave : Assistante Administrative RH SN
--   Fadel Digital : Responsable E-commerce & Réseaux Sociaux
--   UNICEF : Programme de Stages Internationaux - UNICEF 2026
--   Établissement de Santé (Secteur Hospital : Cadre infirmier(ère) référent(e) senior en prévention et con
--   Entreprise Industrielle & Automatisme : Électrotechnicien(ne) / Ingénieur(e) en Automatisme & Génie 
-- Garde-fou : un seul compte administrateur, sinon rien n'est fait.
do $g$ begin
  if (select count(*) from public.user_roles where role = 'admin') is distinct from 1 then
    raise exception 'un seul administrateur attendu';
  end if;
end $g$;
-- La décision de modération est prise au nom de l'administrateur (moderate_job_offer la journalise).
select set_config('request.jwt.claims', json_build_object('sub', (select user_id from public.user_roles where role = 'admin'), 'role', 'authenticated')::text, true);
select public.moderate_job_offer(id, 'rejected', 'masquee le 27/11/2026 : offre de test ou douteuse')
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
   and status = 'approved';

-- Décision du propriétaire du site (27/11/2026) : ces 22 annonces réelles, publiées depuis un compte de démonstration, passent au compte
-- administrateur. Aucun contenu modifié (ni updated_at), offres à date dépassée comprises ; les candidatures suivent l'offre.
-- Retour arrière : supabase/retours_arriere/20261127121000_transferer_offres.sql
--   Sonagoo Transformation Agricole : Référente Digitale & Community Manager
--   Ambassade des États-Unis au Sénégal : Chauffeur (Motor Pool) - Ambassade des États-Unis
--   SECAM S.A. : Recrutement Chantier (12 Profils Engins & BTP) - SECAM S.A.
--   BCEAO (Banque Centrale des États de l'Af : BCEAO recrute 03 Assistants de direction à Dakar
--   Hôtel & Resort Terrou-Bi Dakar : Le Terrou-Bi Dakar recrute un(e) Agent de Réservation Indivi
--   SEMI SARL : SEMI SARL recrute un(e) Chef(fe) de Chantier (BTP & Construc
--   Zenith International Audit & Conseil (ZI : Stagiaire Informaticien(ne) - Connaissances ERP Sage & Odoo
--   ICS Industrial (Société de Placement & B : Recrutement Massif BTP : 30 Profils Différents pour Un Grand
--   AFRI-MOOV (Mobilité & Logistique) : AFRI-MOOV recrute un(e) Agent Livreur / Coursier (H/F)
--   Dexintec : Recrutement Chauffeur Expérimenté - Dexintec
--   Foundever : Conseillers Clients en Réception d’Appels
--   SENSAT (Sénégal Spatial / MESRI) : Ingénieur(e) Logiciel Embarqué (H/F) - Projet GAINDESAT-1A
--   Grant Thornton Technologies (GT Technolo : Architecte d’Entreprise Junior (H/F) - Stagiaire
--   Université Cheikh Anta Diop de Dakar (UC : Appel à candidatures : Enseignants-chercheurs à l'EBAD (UCAD
--   Pyxis Logistics : Pyxis Logistics recrute un Chauffeur
--   Auchan Sénégal : Auchan Sénégal recrute — Renforts Ramadan 2027 (Caissiers, R
--   Auchan Sénégal & EFMA : Auchan Sénégal x EFMA — Formation en Boucherie (8ᵉ Promotion
--   Sen Interim : Sen Interim recrute — Assistante de direction, Caissiers, Ag
--   ADEPME : ADEPME recrute un(e) assistant(e) comptable chargé(e) de la 
--   Tectra Sénégal : Tectra Sénégal recrute un Peintre à Dakar
--   Top Work : Top Work recrute 12 postes dans les hydrocarbures à Fatick (
--   Grazeina Technologies : Agent de suivi client B2B
update public.job_offers
   set recruiter_id = (select user_id from public.user_roles where role = 'admin')
 where id in (
    'ccd4d891-ab59-428f-97fa-0343cfd45808',
    'f302e044-0ff5-4d60-9b33-b9db11fa2df7',
    'ddc8c73d-7d1e-4ff0-a7af-153e5b5aa8a6',
    '9d28564d-7084-4f71-8a71-f1c8a7796ff9',
    '72ce49fa-efa7-4aa4-95ec-b1f73e6c581f',
    'df1477a7-88df-4817-a130-25b681c32413',
    '000d9a92-0af4-4c51-af40-e748db51c89d',
    '14390fbb-528a-4bd1-bba2-114bead8c2f9',
    '962a37cc-55ff-422f-87d4-402f096483f4',
    '3234b690-ae1b-4204-9dd3-73e98ea4c713',
    '8e7bdec1-c693-43a8-af11-d5515f733a4c',
    'a7ccd61a-5661-4e7d-bc40-bc725ae4fa63',
    'b8ec7721-89f2-4a12-bb41-958bcf7d6392',
    'fa161041-9194-427c-85dc-440bcd9e8b06',
    '09200c93-6593-4d9c-b6da-9b7680e4d8f0',
    '1fb8e6b7-dbba-4972-a5d6-585617c81693',
    'de3b96fb-fb88-48d3-9628-14d7ebf6dc66',
    '0753abd7-c6b3-4d1f-97dc-73ff458139eb',
    '6d31720b-622c-4f29-8cac-91a7b045be94',
    '0ddab5d9-eeb6-4a17-b4a3-56e4ded62aed',
    '7dcd6395-8d41-4f9b-8791-3e46448a75a0',
    '4170d9dc-5c67-4cf1-a59c-ba3ee6d7e82a'
 )
   and recruiter_id = '00000000-0000-4000-a000-000000000001'
   and (select count(*) from public.user_roles where role = 'admin') = 1;

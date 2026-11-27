-- Retour arrière de 20261127121000_transferer_offres.sql : rend les 22 offres à leur compte d'origine.
update public.job_offers
   set recruiter_id = '00000000-0000-4000-a000-000000000001'
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
   and recruiter_id = (select user_id from public.user_roles where role = 'admin');

-- Comptes de démonstration (@facilite-demo.local) présents en production : blocage et fermeture de leurs sessions.
-- Aucune donnée n'est supprimée : profils, offres, messages et pièces jointes sont conservés.
-- Retour arrière du blocage : update auth.users set banned_until = null where email like '%@facilite-demo.local';
update auth.users set banned_until = '2999-12-31' where email like '%@facilite-demo.local';
delete from auth.sessions where user_id in (select id from auth.users where email like '%@facilite-demo.local');

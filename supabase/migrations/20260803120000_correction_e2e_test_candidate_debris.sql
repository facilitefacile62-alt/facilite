-- Correction de 20260803100000 : l'audit Étape D avait inclus
-- e2e-test-candidate@facilite-demo.local dans les comptes à badger "pour
-- ne pas perdre l'accès" — en réalité, ses 17 job_offers ("Titre modifié",
-- "Test SARL"...) sont des débris de tests (job-offer-moderation.spec.js,
-- wave2-delete-replacements.spec.js) accumulés faute de cleanup complet
-- entre des runs répétés cette session, pas du contenu réel à préserver.
-- Lui laisser le badge verified_recruiter cassait silencieusement
-- recruiter-search-views.spec.js:91, qui utilise précisément ce compte
-- comme fixture "utilisateur standard SANS badge" — deux vérités
-- contradictoires sur le même compte. On nettoie plutôt que de badger.

DELETE FROM public.job_offers WHERE recruiter_id = '30000000-0000-4000-a000-000000000001';

UPDATE public.profiles
SET badges = badges - 'verified_recruiter'
WHERE id = '30000000-0000-4000-a000-000000000001';

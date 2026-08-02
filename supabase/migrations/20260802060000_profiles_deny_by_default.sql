-- Verrouillage deny-by-default de public.profiles.
--
-- authenticated avait un GRANT UPDATE de TABLE (confirmé via
-- information_schema.role_table_grants, cf. 20260802051000) : toute
-- nouvelle colonne sensible ajoutée à profiles serait modifiable par défaut
-- tant que ce grant large existe. Retiré ici, puis regrant explicite
-- colonne par colonne.
--
-- Liste des colonnes ci-dessous établie par lecture exhaustive de tous les
-- call sites .update()/.upsert() sur "profiles" dans src/ (24 occurrences,
-- 3 fichiers : profil/page.js, importer-cv/page.js, register/page.js), pas
-- devinée. Deux découvertes au passage, non corrigées ici (hors périmètre) :
--   - profil/page.js:2360 appelle handleSaveAboutField("company", ...), qui
--     upsert une colonne "company" — INEXISTANTE dans profiles. Bug
--     préexistant, indépendant de ce chantier (le call échoue déjà
--     silencieusement aujourd'hui). Impossible de la GRANTer puisqu'elle
--     n'existe pas.
--   - register.js:71-77 upsert encore { role: role } après le signUp — code
--     mort depuis la suppression de profiles.role : l'erreur PostgREST
--     résultante n'est jamais vérifiée (pas de destructuring `{ error }`),
--     donc invisible pour l'utilisateur. handle_new_user() (le trigger
--     serveur) a déjà créé la ligne profiles + user_roles correctement au
--     moment du signUp() — cet upsert client est redondant depuis toujours,
--     sa panne silencieuse ne casse rien de fonctionnel.

REVOKE UPDATE ON public.profiles FROM authenticated;

-- Colonnes réellement modifiables par le propriétaire (vérifiées, pas
-- supposées) : id/email/updated_at apparaissent dans TOUS les upserts
-- (id est la cible du ON CONFLICT, requis pour que .upsert() fonctionne) ;
-- le reste correspond aux champs du formulaire "profil" (bio, expériences,
-- coordonnées...), au CV importé (cv_url/cv_name) et au compteur de vues
-- auto-incrémenté à l'ouverture de sa propre page (profile_views).
--
-- Délibérément ABSENTES : badges et recruiter_verified (protégées par
-- trigger, voir plus bas — jamais par GRANT), created_at, slug et
-- post_impressions (aucun call site client ne les écrit aujourd'hui,
-- verrouillées par défaut plutôt que grantées "au cas où").
GRANT UPDATE (
  id, email, updated_at,
  full_name, avatar_url, cover_url, bio, headline, location,
  experiences, skills, interests, educations, languages, pinned_details,
  cv_url, cv_name,
  city, country, birth_date, gender, marital_status, driver_license,
  phone, contact_email, website_url, education_level,
  is_public, show_contact, profile_views
) ON public.profiles TO authenticated;

-- trg_protect_cosmetic_columns (20260802051000) reste la protection
-- réelle de badges/recruiter_verified : le GRANT ci-dessus ne les
-- inclut pas, et le trigger reste en place en seconde couche (défense en
-- profondeur si une future migration élargissait le GRANT par erreur).
--
-- Pourquoi badges reste sur profiles alors que role a déménagé vers
-- user_roles, plutôt que les protéger tous les deux de la même façon :
-- ce sont deux natures de données différentes. role/status gouvernent des
-- policies RLS sur D'AUTRES tables (job_offers, candidats_recherche...) —
-- les isoler dans une table à zéro GRANT élimine structurellement tout
-- risque qu'un SELECT * un jour négligent les expose ou qu'un GRANT trop
-- large les rende écrivables. badges est un AFFICHAGE public (le futur
-- badge "Recruteur vérifié" doit apparaître à côté du nom sur une offre,
-- comme le reste des colonnes publiques de profils) : le sortir de
-- profiles obligerait soit une jointure supplémentaire sur toutes les
-- lectures publiques de profil, soit sa duplication dans profils_publics.
-- Le trigger BEFORE UPDATE protège l'écriture aussi efficacement qu'un
-- GRANT sur une table séparée — la seule différence structurelle entre
-- les deux mécanismes est que le trigger dépend de rester à jour à chaque
-- nouvelle colonne cosmétique, alors qu'une table séparée protège tout
-- nouvel ajout par défaut. C'est un point de divergence réel : si
-- badge_requests (section 4) introduit une deuxième colonne cosmétique un
-- jour, il faudra explicitement l'ajouter à trg_protect_cosmetic_columns —
-- rien ne le fera automatiquement. Documenté ici pour que ce ne soit pas
-- oublié au moment de construire badge_requests.

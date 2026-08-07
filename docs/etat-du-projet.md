# État du projet Facilite — 2026-08-07

Ce document répond à une seule question : **où en est-on aujourd'hui,
concrètement**, pour quelqu'un qui n'a pas suivi le détail des chantiers.
Écrit pour être relu dans un mois sans contexte perdu. Remplace entièrement
la version du 2026-08-03 — obsolète sur presque tous les points depuis.

## En une phrase

Deux incidents réels de fuite de données personnelles ont eu lieu et ont été
fermés le même jour (2026-08-06) — l'un exposait 45 CV, l'autre exposait
potentiellement les données de tous les comptes. Depuis, le projet a gagné
une détection active des abus (quota CV, refus d'accès répétés), une
sauvegarde chiffrée testée de bout en bout, et une réduction volontaire de
sa surface de données personnelles. Le SMTP fonctionne de bout en bout,
confirmé par une vraie personne cliquant un vrai lien. Ce qui reste ouvert
est connu et listé plus bas, pas oublié.

## ⚠️ Action qui vous revient, non fermée

**La clé privée de sauvegarde** (`facilite-backup-PRIVATE-key-GARDER-EN-LIEU-SUR.pem`)
était encore dans `Downloads`, non déplacée, au moment du dernier contrôle —
malgré une confirmation de votre part qu'elle avait été sécurisée et
supprimée. Vérifiez maintenant. Si elle est perdue avant d'être copiée en
lieu sûr, aucune sauvegarde existante ne sera jamais récupérable — aucune
régénération possible. Voir `docs/sauvegarde-restauration.md`.

## Ce qui est fait et protégé

### Fondations de sécurité automatiques

11 invariants tournent en CI sur chaque push/PR
(`npx playwright test tests/security/invariants.spec.js`, détail dans
`docs/invariants-securite.md`) : GRANT non justifiés, tables sans RLS,
`SECURITY DEFINER` sans `search_path`, buckets Storage publics, endpoints
sans autorisation, `service_role` sans filtrage, policies RLS tautologiques,
gardes NULL-fragiles, objets en base absents des migrations, liens/gates
frontend conditionnés à un rôle obsolète.

**Connu et non réglé** : ce job CI ne bloque encore aucun déploiement —
`main` n'a pas de branch protection GitHub l'exigeant. Procédure donnée
(pas exécutée par moi, hors de ma portée) dans le fil de discussion du
2026-08-06 ; à vérifier si elle a été appliquée.

### Incident du 2026-08-06 — fermé, documenté intégralement

Voir `docs/incident-2026-08-06.md` pour la chronologie complète. Résumé :
- Bucket `resumes` public depuis sa création (2026-07-27), corrigé un jour
  puis redevenu public par un mécanisme jamais tracé — 45 CV de 3 comptes
  réels exposés. Rebasculé privé, policies resserrées (autorisation par
  candidature réelle ou opt-in explicite, plus par simple badge).
- Policy `"Profiles read access"` sur `public.profiles` — table entière
  (36 colonnes, email garanti pour tout compte) lisible par n'importe qui
  sans authentification, vérifié exploitable en direct. Supprimée.
- `establishments` (annuaire pharmacies/hôtels) : GRANT DELETE/UPDATE ouvert
  à `anon`/`authenticated`, retiré. `is_app_admin()` orpheline (modèle
  pré-RBAC) supprimée. `is_admin(uuid)` : `EXECUTE` retiré à `anon`.
- Origine des trois premiers : jamais dans une migration, jamais dans un
  commit — action humaine directe en base, non attribuable depuis cet
  environnement. `docs/regle-migrations.md` formalise la règle qui aurait
  empêché ça.

### Détection active des abus (nouveau depuis le 2026-08-06)

- **Quota CV** : 100 consultations de profil candidat distinctes par jour et
  par compte badgé, appliqué côté serveur (`record_cv_consultations()`),
  compteur visible en permanence dans l'espace recruteur, alerte
  `security_logs` au dépassement, admin exempté. 5 tests dédiés, seuil
  exact de 100/101 prouvé avec de vrais comptes jetables créés puis
  supprimés — `tests/security/cv-quota.spec.js`.
- **Refus d'accès répétés** : chaque 401/403 sur les routes CVthèque et
  candidatures est journalisé (compte, IP, route, horodatage). Seuil de 10
  refus/5 min (par compte ou IP) déclenche une alerte visible dans un
  encart du tableau de bord admin (`SecurityAlertsWidget.jsx`). IP purgée
  après 30 jours (la ligne elle-même ne l'est jamais). **Vérifié tournant
  en production réelle** le 2026-08-07 (pas seulement en test local) — une
  requête directe contre `ffacilite.com` a produit une entrée
  `security_logs` en quelques secondes.
- **Portée volontairement limitée** : profils et messagerie n'ont pas de
  Route Handler dédié dans ce projet (accès direct PostgREST sous RLS) —
  hors de portée de cette détection pour l'instant, documenté explicitement.
  `auth.audit_log_entries` (échecs de connexion natifs Supabase) est
  interrogeable mais constaté **vide** (0 ligne) malgré une activité réelle
  le jour même — cause non déterminable en SQL, à vérifier côté Dashboard
  Supabase/support.

### Minimisation des données (nouveau)

`birth_date`, `marital_status`, `driver_license` supprimées de `profiles`
(2026-08-07) après vérification qu'elles n'avaient plus qu'un usage privé
(section "À propos" de son propre profil) et aucune interface fonctionnelle
d'exposition publique réelle malgré une étiquette "🌐 Public" trompeuse qui
laissait penser le contraire. Une donnée non collectée ne peut plus fuiter.
Rétention des CV et purge automatique : **pas commencé**, chantier séparé.

### Sauvegarde chiffrée (nouveau)

Chiffrement hybride RSA-4096 + AES-256-GCM, clé privée jamais en CI —
`docs/sauvegarde-restauration.md`. **Testé réellement** le 2026-08-06 :
1317 lignes (19 tables) + 107 fichiers Storage sauvegardés, chiffrés,
restaurés dans un schéma isolé, intégrité vérifiée ligne par ligne, mauvaise
clé testée et rejetée proprement.

**Connu et non réglé** : l'automatisation quotidienne
(`.github/workflows/backup.yml`) dépend de 6 secrets GitHub Actions dont la
création (compte de service Google Cloud, dossier Drive partagé) vous
revenait — statut non confirmé au moment de ce document. Sans eux, le
workflow échoue explicitement (pas silencieusement) à chaque exécution
planifiée.

### SMTP / récupération de mot de passe — fermé

Confirmé fonctionnel de bout en bout par une vraie réception et un vrai
clic (délai de 2 min 51 s entre inscription et confirmation, signature d'un
comportement humain, pas d'un trigger). `auto_confirm_user` supprimée,
aucun doublon de trigger sur `auth.users` (un seul : `on_auth_user_created`,
vérifié en le déclenchant réellement). Les 33 comptes historiques
pré-confirmés par l'ancien trigger (jamais par un vrai clic) ont reçu
l'email de vérification informatif le 2026-08-07 (7 comptes réels
concernés, les autres étant des comptes de test/démo) — **à vérifier dans
48h combien ont cliqué**, pas encore fait au moment de ce document.

### Modèle de rôles, modération, espace recruteur (acquis antérieurs, toujours vrais)

- `user`/`publisher`/`admin` + badges — l'ancien modèle
  `candidat`/`recruteur`/`agent`/`entreprise` n'existe plus nulle part.
- Modération des offres, suspension de compte au niveau PostgreSQL,
  protection des données candidat (contact masqué jusqu'à autorisation
  explicite, isolation stricte recruteur/recruteur et test/réel).
- Espace recruteur : publier/modifier une offre, candidatures + CV reçus,
  CVthèque, entretiens vidéo (**Daily.co vérifié fonctionnel en direct** le
  2026-08-06 — clé API réelle testée, salon créé et supprimé avec succès),
  messagerie — tous fonctionnels, vérifiés dans le code, pas supposés.
- Navigation : doublon "Accueil" supprimé, liens Admin/Recruteur
  conditionnés au rôle/badge réel (RLS-vérifié, pas juste UI), badge de
  profil cliquable uniquement sur son propre profil, utilisable à 320px —
  livré par une session concurrente le 2026-08-06, vérifié par relecture de
  code plutôt que refait.
- `/admin/messages` : bug de colonne morte (`profiles.role`) corrigé.

## Ce qui reste ouvert (connu, pas oublié)

1. **CI ne bloque pas le déploiement** — branch protection GitHub à
   confirmer (voir plus haut).
2. **Automatisation de la sauvegarde** — dépend des 6 secrets GitHub à
   configurer par vous.
3. **Suivi 48h de l'email de vérification** des 7 comptes — pas encore fait.
4. **`auth.audit_log_entries` vide** — cause non identifiée, limite la
   détection des échecs de connexion.
5. **Détection limitée à 2 routes** (CVthèque, candidatures) — profils et
   messagerie n'ont pas d'équivalent, architecture directe-PostgREST.
6. **Comptes `e2e-test-*` tous `role='admin'`** — découvert le 2026-08-06 en
   construisant le test du quota (`e2e-test-admin`, `e2e-test-agent`,
   `e2e-test-candidate`, `e2e-test-security` portent TOUS le rôle admin en
   base réelle, pas les rôles distincts que leurs noms impliquent). Signalé
   à plusieurs reprises, **jamais corrigé** — des dizaines de tests
   existants qui affirment "un non-admin ne peut pas faire X" pourraient
   passer pour la mauvaise raison. Mérite un audit dédié.
7. **Badge de compte test (`is_test_account`) non gérable depuis l'admin** —
   l'approbation/révocation de `verified_recruiter` existe dans
   `/admin` (`approve_badge_request`/`revoke_badge`), mais aucun
   interrupteur `is_test_account` n'y figure — à faire manuellement en base
   aujourd'hui.
8. **Registre de migrations et `supabase db push`** — désynchronisation
   historique jamais entièrement réconciliée ; la règle "jamais `db push`"
   reste la seule protection.

## Ce qui n'est jamais commencé

- **Panneau de sécurité temps réel complet** — l'encart d'alertes actuel
  (`SecurityAlertsWidget`) couvre les refus répétés et le quota, mais pas la
  vue d'ensemble des invariants ni le catalogue d'événements complet
  initialement envisagé.
- **Projet Supabase de test séparé** — tous les tests E2E tournent encore
  contre la même base que la production.
- **Rétention et purge automatique des CV**.
- **Migration vers Cloudflare R2/Backblaze B2** — documentée comme triviale
  si une carte non-prépayée devient disponible (`docs/sauvegarde-restauration.md`),
  jamais faite faute d'accès à ce type de carte.

## Prochaine étape suggérée

Dans l'ordre d'impact probable : (1) confirmer la clé privée de sauvegarde
est réellement en lieu sûr — action déjà en attente en haut de ce document ;
(2) l'audit des comptes `e2e-test-*` mal rôlés, qui touche la fiabilité de
toute la suite de tests existante ; (3) terminer la configuration Google
Cloud pour que la sauvegarde tourne réellement, pas seulement le jour où
elle a été testée manuellement.

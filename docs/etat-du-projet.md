# État du projet Facilite — 2026-08-07 (mise à jour)

Ce document répond à une seule question : **où en est-on aujourd'hui,
concrètement**, pour quelqu'un qui n'a pas suivi le détail des chantiers.
Écrit pour être relu dans un mois sans contexte perdu. Remplace entièrement
la version précédente du même jour — obsolète depuis la bascule KPay en
production et le chantier du tableau de bord admin.

## En une phrase

KPay est en production (clés Live), le paiement et le webhook sont prouvés
fonctionnels de bout en bout — il ne manque qu'un paiement mobile money qui
aboutisse réellement pour clore définitivement ce point. Le tableau de bord
admin a été réorganisé et enrichi d'un onglet Sécurité temps réel. Une
faille structurelle qui rendait chaque correction de GRANT fragile (les
droits par défaut du schéma se rouvraient à chaque nouvelle table) a été
corrigée à la source.

## Ce qui est fait et protégé

### KPay — Live, sous réserve d'un paiement réel confirmé

Bascule en production effectuée le 2026-08-07 : nouvelles clés Live
générées et déployées sur Vercel, ancienne paire sandbox révoquée,
redéploiement confirmé (`ffacilite.com` sert bien le build avec les
nouvelles variables).

- **Checkout fonctionnel** : testé en conditions réelles contre la
  production (compte candidat de test, vraie requête `POST
  /api/pay/checkout`), commande créée en base, vrai lien de paiement KPay
  obtenu.
- **Webhook fonctionnel et signature acceptée** : un premier test a révélé
  `KPAY_WEBHOOK_SECRET` désynchronisé (signature rejetée) — corrigé côté
  Vercel. Un second test, surveillé en direct dans les logs Vercel pendant
  que l'utilisateur complétait le paiement, a confirmé la réception de
  deux appels `POST /api/pay/kpay-webhook` acceptés (niveau `info`, pas
  `error`) : la chaîne checkout → KPay → webhook signé → traitement selon
  le statut est prouvée bout en bout.
- **Ce qui reste en attente** : les deux tentatives de paiement réel ont
  toutes les deux échoué côté opérateur mobile money ("Échec du paiement —
  aucun montant débité", écran KPay), pas côté plateforme. Le code gère
  déjà ce cas correctement (statut ≠ `COMPLETED` → aucune écriture en
  base). **Un premier paiement qui aboutit réellement (`COMPLETED`)
  confirmera la dernière étape** (webhook → `orders.payment_status =
  'paid'`) — non testé faute d'un paiement mobile money réussi jusqu'ici.

### Fondations de sécurité automatiques

13 invariants tournent en CI sur chaque push/PR
(`npx playwright test tests/security/invariants.spec.js`, détail dans
`docs/invariants-securite.md`), dont deux ajoutés le 2026-08-07 : aucun
compte de test avec `role='admin'` hors liste blanche, et aucune fonction
`SECURITY DEFINER` critique sans `GRANT EXECUTE` actif.

**Connu et non réglé** : ce job CI ne bloque encore aucun déploiement —
`main` n'a pas de branch protection GitHub l'exigeant (voir "Ce qui reste
ouvert").

### ALTER DEFAULT PRIVILEGES — corrigé à la source (2026-08-07)

Découverte en construisant l'onglet Sécurité : le schéma `public` accordait
silencieusement, à **chaque nouvelle table/fonction/séquence créée par le
rôle `postgres`** (donc par toute migration future), des droits complets à
`anon`/`authenticated` — sans qu'aucun `GRANT` n'apparaisse dans la
migration elle-même. Cause probable d'une partie des GRANTs "jamais
tracés" trouvés et corrigés table par table pendant ce chantier
(`establishments`, `is_admin(uuid)`, `invariant_status`...).

Corrigé par `ALTER DEFAULT PRIVILEGES ... REVOKE` pour le rôle `postgres`
(celui par lequel 100 % des migrations de ce projet passent). Preuve
empirique : une vraie table temporaire créée après le correctif n'hérite
plus d'aucun droit `anon`/`authenticated`, testé et supprimé. Invariant 1
étendu pour vérifier `pg_default_acl` en continu — toute régression future
serait détectée automatiquement.

**Limite documentée, pas ignorée** : le rôle `postgres` n'a pas la
permission de modifier les default privileges de `supabase_admin`
(`permission denied to change default privileges`, testé). Sans impact
pratique tant que la règle "jamais de schéma créé via le Dashboard, toujours
via migration CLI" (`docs/regle-migrations.md`) tient — mais si cette règle
est un jour contournée, cette porte-là resterait ouverte.

### Tableau de bord admin — réorganisé et enrichi (2026-08-07)

- **Navigation** : sidebar catégorisée (Contenu/Communication/Gestion/
  Données/Administration) avec lien actif visible, menu hamburger mobile
  ajouté (les liens de la sidebar étaient auparavant invisibles sur
  mobile). Doublons de navigation supprimés (Messagerie Support en double,
  lien Accueil redondant).
- **Onglet Sécurité** (nouveau) : alertes actives triées par gravité puis
  date (rouge = refus d'accès, orange = quota dépassé), actions
  Suspendre/Ignorer/Marquer résolu, historique 30 jours filtrable par type
  et gravité, mise à jour **temps réel** (Supabase Realtime sur
  `security_logs`, vérifié par test qu'un `publisher` abonné au même canal
  ne reçoit rien), encart Invariants de sécurité affichant le résultat réel
  de la dernière exécution CI (jamais recalculé côté client). Aucune
  suppression de log possible, aucune exécution SQL libre, aucun contenu de
  CV/message exposé — contraintes du client respectées à la lettre.
- **Attribution de badge et compte de test** : interrupteurs directement
  dans la liste des comptes (`grant_verified_recruiter_badge()`,
  `set_test_account_flag()`, admin-only, journalisées dans
  `security_logs`), confirmation obligatoire avant d'accorder le badge à un
  compte non-test, bandeau "Mode test" pour les admins connectés avec
  `is_test_account = true`.
- **Éléments inactifs corrigés** : `ScraperDashboard` (bouton "Lancer le
  scraping") était câblé en dur sur `localhost:8000`, donc systématiquement
  cassé en production — utilise maintenant `NEXT_PUBLIC_API_URL` avec un
  avertissement explicite si la variable est absente (elle ne l'est pas
  configurée sur Vercel à ce jour, voir "Ce qui reste ouvert").

### Incident du 2026-08-06 — fermé, documenté intégralement

Voir `docs/incident-2026-08-06.md` pour la chronologie complète : bucket
`resumes` public corrigé, policy `profiles` ouverte à tous supprimée,
GRANTs `establishments` retirés, `is_app_admin()` orpheline supprimée.
Origine jamais tracée dans une migration — `docs/regle-migrations.md`
formalise la règle qui aurait empêché ça, et le correctif ALTER DEFAULT
PRIVILEGES ci-dessus en referme une partie de la cause structurelle.

### Détection active des abus, minimisation des données, sauvegarde, SMTP, rôles/modération

Inchangés depuis la version précédente de ce document — toujours vrais,
non re-décrits ici pour éviter la redondance. Voir l'historique git de ce
fichier pour le détail complet si besoin.

## Récapitulatif final

### FERMÉ ET PROTÉGÉ

- Incidents du 2026-08-06 (bucket public, policy `profiles` ouverte,
  GRANTs `establishments`) — corrigés, invariants automatiques empêchant
  la récidive.
- Clé privée de sauvegarde — confirmée hors du disque, deux copies sûres
  ailleurs.
- SMTP / récupération de mot de passe — confirmé par un vrai clic humain.
- Comptes de test correctement rôlés (Invariant 12).
- `approve_badge_request()` — GRANT restauré (Invariant 13 empêche la
  récidive silencieuse pour toute fonction critique).
- **ALTER DEFAULT PRIVILEGES sur `public`** — corrigé à la source pour le
  rôle `postgres`, vérifié par test, surveillé en continu par Invariant 1.
- **`payment_reference` NULL sur les commandes** — policy RLS `UPDATE`
  manquante ajoutée (scopée au propriétaire, colonne `payment_reference`
  uniquement — le `GRANT` de la vague 3 restait déjà correctement limité,
  seule la policy manquait). Vérifié : une commande fraîche obtient bien sa
  référence, `payment_status` reste inaccessible au propriétaire, une
  commande d'un autre compte reste inaccessible.
- **KPay checkout et webhook** — chaîne technique prouvée fonctionnelle de
  bout en bout (signature acceptée, traitement correct selon statut).
- **Tableau de bord admin** — navigation réorganisée, onglet Sécurité
  temps réel, attribution de badge/compte de test via RPC admin-only
  journalisées, `ScraperDashboard` corrigé.
- Sauvegarde chiffrée — testée réellement (restauration + intégrité
  vérifiées).
- Quota CV et détection des refus d'accès répétés — vérifiés en
  production réelle.
- Modèle de rôles, modération, espace recruteur, entretiens vidéo
  (Daily.co) — fonctionnels, vérifiés dans le code.

### OUVERT ET DOCUMENTÉ

1. **Un paiement KPay `COMPLETED` réel n'a pas encore été observé** —
   risque **faible** : la logique de traitement est déjà prouvée correcte
   pour les statuts non-`COMPLETED` (aucune écriture erronée), il ne reste
   qu'à confirmer le dernier maillon (`payment_status → 'paid'`) sur un
   vrai paiement réussi. Deux tentatives ont échoué côté opérateur mobile
   money, pas côté plateforme.
2. **CI ne bloque pas le déploiement** — risque **moyen** : branch
   protection GitHub sur `main` toujours à confirmer (procédure exacte
   redonnée à l'utilisateur le 2026-08-07, à appliquer manuellement — droits
   admin GitHub requis).
3. **Automatisation de la sauvegarde** — risque **moyen** : dépend des 6
   secrets GitHub Actions (compte de service Google Cloud) à configurer.
4. **`NEXT_PUBLIC_API_URL` non configurée sur Vercel** — risque
   **faible** : `ScraperDashboard` affiche maintenant un avertissement
   explicite au lieu d'échouer silencieusement, mais l'agrégation reste
   inutilisable en production tant que le backend FastAPI n'est pas
   déployé quelque part et référencé par cette variable.
5. **`auth.audit_log_entries` vide** — risque **faible** : limite la
   détection des échecs de connexion natifs Supabase, cause non identifiée.
6. **Détection limitée à 2 routes** (CVthèque, candidatures) — risque
   **faible** : profils et messagerie restent hors du périmètre de
   détection des refus d'accès (architecture directe-PostgREST, pas de
   Route Handler dédié).
7. **`supabase_admin` garde des DEFAULT PRIVILEGES larges** — risque
   **faible/théorique** : hors de portée du rôle `postgres` utilisé par ce
   projet ; sans impact tant que le Dashboard Supabase n'est jamais utilisé
   pour créer du schéma (déjà la règle en vigueur).
8. **Registre de migrations et `supabase db push`** — risque **faible** :
   désynchronisation historique jamais entièrement réconciliée, la règle
   "jamais `db push`" reste la seule protection.

### NON COMMENCÉ

- Panneau de sécurité "vue d'ensemble complète" au-delà de l'onglet
  Sécurité actuel (déjà livré : alertes temps réel, historique filtrable,
  statut des invariants — pas encore fait : catalogue exhaustif de tous
  les types d'événements possibles).
- Rétention et purge automatique des CV.
- Migration vers Cloudflare R2/Backblaze B2 (triviale si une carte
  non-prépayée devient disponible, `docs/sauvegarde-restauration.md`).
- Badge/compte de test gérable depuis l'admin pour d'autres attributs que
  `verified_recruiter`/`is_test_account` (aucun autre type de badge
  n'existe dans ce projet à ce jour — pas un manque, juste hors périmètre).

## Prochaine étape suggérée

Dans l'ordre d'impact probable : (1) activer la branch protection GitHub
sur `main` (procédure donnée le 2026-08-07, à appliquer manuellement) pour
que la CI bloque vraiment un déploiement défaillant ; (2) confirmer un
paiement KPay réellement réussi pour clore définitivement ce point ;
(3) terminer la configuration Google Cloud (6 secrets GitHub) pour
l'automatisation de la sauvegarde.

## Projet Supabase de test séparé (facilite-e2e-test) — OPÉRATIONNEL

Chantier clos le 2026-08-08. Déclenché par l'incident du 2 août (fausses
offres publiées en production par un test) — objectif : que plus aucun
test E2E/sécurité ne puisse jamais écrire en production. Tous les tests
(`tests/e2e/*`, `tests/security/*`, à l'exception délibérée de
`tests/security/invariants.spec.js`, qui doit continuer à vérifier la
vraie prod) tournent désormais contre un second projet Supabase dédié
(`facilite-e2e-test`, ref `xisjmeouaragjfhubcjl`, région eu-west-3), avec
un garde-fou qui refuse de démarrer si `TEST_SUPABASE_URL` est absente ou
pointe vers le ref de production.

**Résultat final : 135/150 = 90,0%.** 14 skipped, 1 failed (flake de
timing, `security-profile.spec.js`, absorbé par `retries:1` — voir
`playwright.config.js`), 0 en situation de blocage.

**Les 14 tests skippés, avec raison :**
- `candidate-application.spec.js` (1) — bug applicatif réel dans
  `ApplyModal.jsx`, voir "CONSTAT BUG APPLICATIF" ci-dessous.
- `password-reset.spec.js` (3) — SMTP non configuré sur le projet de test
  (comportement attendu, jamais eu vocation à l'être).
- `payment-amount-tampering.spec.js` (1) et `payment-and-billing.spec.js`
  (1) — clés KPay sandbox non configurées sur le projet de test.
- `storage-role-literals-fix.spec.js` (3) — policy storage
  `"Recruteurs et admins lisent les CV"` structurellement plus stricte que
  ce que ce test suppose, voir constat 5 ci-dessous.
- `access-denial-detection.spec.js` (3) — `TEST_SUPABASE_SERVICE_ROLE_KEY`
  invalide (voir juste après).
- `cv-quota.spec.js` (2) — sous-ensemble réduit, documenté dans le fichier
  lui-même : sans `SUPABASE_SERVICE_ROLE_KEY` utilisable, les tests de
  seuil exact (101 comptes fictifs) sont skippés plutôt que simulés.

**`TEST_SUPABASE_SERVICE_ROLE_KEY` reste à corriger** : la vraie clé
service_role fournie le 2026-08-08 a été rejetée par Supabase
(`Invalid API key`) immédiatement après avoir été collée dans le chat —
probable rotation automatique par la détection de fuite de Supabase, même
comportement que les mots de passe DB plus tôt dans ce chantier. Il faudra
récupérer une clé fraîche (Project Settings → API → service_role secret,
sans la coller en clair dans une conversation) pour lever le skip
d'`access-denial-detection.spec.js` et le sous-ensemble réduit de
`cv-quota.spec.js`.

**Dette technique restante :**
- `candidate-application.spec.js` — bug `ApplyModal.jsx` (état de succès
  écrasé par un `useEffect` mal scopé), détail dans "CONSTAT BUG
  APPLICATIF" plus bas dans ce document. Toujours en skip, pas encore
  corrigé.
- `storage-role-literals-fix.spec.js` — les 3 tests passent (`can_recruiter_read_cv()`
  corrigée le 2026-08-08, appliquée en test ET en production ; les 4
  buckets manquants créés le même jour, voir juste en dessous).
- **CORRIGÉ le 2026-08-08 — 4 buckets Storage manquants sur
  `facilite-e2e-test`** — `job-offers` (public), `badge-documents`,
  `completed_cvs`, `invoices` (privés) créés via l'API Admin Storage
  (`scripts/setup-test-buckets.js`, jamais un `INSERT` SQL direct dans
  `storage.buckets`), avec les mêmes paramètres exacts que la prod (aucun
  bucket n'a de `file_size_limit`/`allowed_mime_types` configuré). Les 18
  policies RLS correspondantes étaient déjà en place depuis un correctif
  antérieur (elles s'appliquent indépendamment de l'existence du bucket).
  `scripts/setup-test-buckets.js` doit être relancé (avec un
  `TEST_SUPABASE_SERVICE_ROLE_KEY` valide) avant tout reset complet de
  `supabase/seed-test.sql` sur un projet de test fraîchement créé — la
  création de bucket ne peut pas être exprimée en SQL pur, voir le
  commentaire en tête de `seed-test.sql`.
- **RÉSOLU le 2026-08-08** — le générateur de dump de schéma
  (`scripts/dump-schema-via-introspection.js`) capture désormais les
  GRANTs (schéma, table, colonne, fonction), les policies
  `storage.objects` et l'appartenance à la publication
  `supabase_realtime` ; détail dans "DETTE TECHNIQUE (Dump de schéma pour
  le projet de test)" ci-dessous. Reste hors périmètre : la liste des
  buckets Storage eux-mêmes (la création d'un bucket exige l'API Admin
  Storage, pas exprimable en SQL — `scripts/setup-test-buckets.js` reste
  un prérequis séparé, voir juste au-dessus).

## DETTE TECHNIQUE (Migrations)

L'historique de migrations ne peut pas recréer la base de prod depuis zéro. 18 colonnes de la table `profiles` créées hors migrations. À résorber progressivement avec une migration de rattrapage.

## DETTE TECHNIQUE (Dump de schéma pour le projet de test) — RÉSOLUE le 2026-08-08

**`scripts/dump-schema-via-introspection.js` capture maintenant les 3
catégories qui manquaient** (détaillées ci-dessous à titre d'historique) :
GRANTs (schéma, table, colonne, fonction), policies `storage.objects`,
appartenance à la publication `supabase_realtime`. Un nouveau projet de
test recréé directement depuis le dump n'a plus besoin des correctifs
manuels documentés plus bas — tout est désormais généré automatiquement.

Chiffres du dump complet, lancé contre la production le 2026-08-08 :
**92 policies RLS** (74 `public` + 18 `storage.objects`), **42 GRANTs de
table**, **13 GRANTs de colonne**, **49 GRANTs `EXECUTE`** sur fonctions,
**7 tables** dans la publication `supabase_realtime`.

Les GRANTs de fonction reflètent l'état réel et actuel des GRANTs (une
jointure par `oid` via `specific_name`, pas par nom seul — indispensable
pour les fonctions surchargées comme `is_admin()` vs `is_admin(uuid)`, qui
n'ont pas les mêmes GRANTs) : une fonction dont l'`EXECUTE` a été
explicitement révoqué (`log_security_event()`) n'apparaît simplement plus
dans `information_schema.role_routine_grants`, donc jamais dans le dump —
aucun filtrage supplémentaire nécessaire.

**Vérifié le 2026-08-08** : le dump complet (1914 lignes) s'applique sans
aucune erreur SQL sur un schéma `public` entièrement vierge, en 3 étapes
(tables/contraintes/index, puis les 51 fonctions rejouées individuellement
en boucle jusqu'à point fixe pour résoudre leurs dépendances mutuelles —
mécanisme déjà en place dans `scripts/import-schema-dump-to-test.js`, puis
RLS/policies/GRANTs/vues/triggers/Realtime en bloc). Méthode : transaction
sur `facilite-e2e-test` annulée à la fin (`ROLLBACK`), jamais appliquée de
façon permanente — le schéma `public` existant est renommé le temps du
test, un `public` vierge est créé à la place, puis tout est restauré à
l'identique par l'annulation. Confirmé après coup : 23 tables, trigger
`on_auth_user_created` toujours présent, aucun schéma résiduel.

### Historique (le trou d'origine, avant le correctif du 2026-08-08)

`scripts/dump-schema-via-introspection.js` (remplace `pg_dump`, indisponible
dans cet environnement — ni Docker ni binaire local) ne capture que les
grants table/fonction/séquence via introspection SQL — **jamais le grant
`GRANT USAGE ON SCHEMA public TO anon, authenticated`**, un grant au niveau
du schéma lui-même que `pg_dump` inclut normalement. Sans lui, absolument
rien n'est accessible dans `public` pour ces deux rôles, quels que soient
les autres grants ou policies RLS en place — trouvé le 2026-08-07 en
lançant la suite complète contre `facilite-e2e-test` fraîchement importé
(77 échecs sur 150, la quasi-totalité causée par ce seul grant manquant).

**À appliquer manuellement sur tout nouveau projet de test** créé à partir
de ce script tant qu'il n'est pas corrigé à la source :
```sql
GRANT USAGE ON SCHEMA public TO anon, authenticated;
```
Déjà ajouté à `supabase/seed-test.sql` pour que tout reset de
`facilite-e2e-test` via ce fichier l'inclue automatiquement — mais le
générateur de dump lui-même n'a pas été corrigé (un futur projet de test
recréé directement depuis le dump, sans repasser par le seed, aurait le
même trou).

Même trou, deux autres cas trouvés le 2026-08-08 en lançant la suite
complète après correction du grant ci-dessus (33 échecs restants sur 150) :

- **Policies RLS de `storage.objects`** — le script scope toute son
  introspection à `nspname = 'public'`, jamais au schéma `storage`. Le
  projet de test avait 2 policies fabriquées à la main (jamais présentes en
  prod, dont une rendant les pièces jointes de chat lisibles sans
  authentification) au lieu des 18 vraies policies de production.
- **Appartenance à la publication `supabase_realtime`** — également hors
  du périmètre du script ; la publication était entièrement vide sur le
  projet de test fraîchement importé (`agent_assignments`, `candidatures`,
  `conversations`, `messages`, `orders`, `resumes`, `security_logs` sont
  publiées en prod).

**À exporter et appliquer manuellement sur tout nouveau projet de test**
tant que le générateur n'est pas corrigé à la source :
- `scripts/export-storage-policies.js` (lecture seule sur la prod, imprime
  les `CREATE POLICY` à appliquer sur `storage.objects`).
- Pas de script dédié pour la publication Realtime — requête de contrôle :
  `SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime';`
  puis un `ALTER PUBLICATION supabase_realtime ADD TABLE ...` par table
  listée.

Les deux sont déjà ajoutés à `supabase/seed-test.sql` (sections "0ter." et
"0quater.") pour que tout reset de `facilite-e2e-test` les inclue
automatiquement.

Deux écarts supplémentaires trouvés le 2026-08-08 en creusant les échecs
restants (72,7% de réussite) — corrigés et ajoutés à `supabase/seed-test.sql`
(section "0bis-suite") :
- `current_user_role()` n'avait `EXECUTE` que pour `authenticated` sur le
  projet de test ; la prod l'accorde aussi à `anon`.
- `GRANT INSERT` sur `reports` pour `authenticated` est **column-scoped** en
  prod (`target_type`, `target_id`, `reason`, `reporter_id` —
  `20260803040000_moderation_et_suspension.sql`), jamais un GRANT table
  entière. `scripts/export-table-grants.js` ne capture que les colonnes
  **UPDATE** restreintes (`role_column_grants` filtré à
  `privilege_type='UPDATE'`), jamais INSERT — troisième variante du même
  trou de méthode, à corriger dans le script à l'occasion.

## CONSTATS SÉCURITÉ EN PRODUCTION (trouvés le 2026-08-08, PAS des écarts de projet de test — décision à prendre)

En creusant pourquoi certains tests échouaient encore après les correctifs
GRANT/policies ci-dessus, deux constats concernent la **production
elle-même**, vérifiés directement par introspection sur `ocfhzwwjvljintabxxlg` :
rien n'a été modifié en prod, ceci est un rapport, pas une action.

**1. Trois fonctions "Vague 2" ne fonctionnent probablement pas pour un
vrai utilisateur en prod aujourd'hui** — `delete_own_resume()`,
`archive_own_job_offer()`, `clear_own_assistant_messages()` (créées par
`20260802220000_wave2_delete_replacements.sql` pour remplacer un DELETE
client direct). Ce sont des fonctions PL/pgSQL normales
(`prosecdef = false`, confirmé identique en prod et en test), donc elles
s'exécutent avec les droits de l'appelant (`authenticated`) — mais la prod
n'accorde **aucun** GRANT DELETE sur `resumes`/`assistant_messages` à
`authenticated`, et le GRANT UPDATE column-scoped sur `job_offers` exclut
explicitement `archived_at` (commentaire de
`20260802250000_wave3_update_columns.sql` ligne 31 : "archived_at
explicitement EXCLU (uniquement via archive_own_job_offer())" — ce qui
suppose que cette fonction ait des droits élevés, ce qu'elle n'a pas).
Conséquence : un appel à ces 3 fonctions par un utilisateur normal échoue
avec `permission denied for table ...`, aussi bien en prod qu'en test — ce
n'est pas un trou du projet de test, le projet de test reproduit fidèlement
ce comportement de prod. Correctif probable : ajouter `SECURITY DEFINER` à
ces 3 fonctions (avec le `SET search_path` déjà présent) via une nouvelle
migration — mais c'est un changement de logique de sécurité en prod, hors
périmètre de ce chantier d'isolation des tests, à valider explicitement
avant toute migration.

**DÉCISION PRISE le 2026-08-08 :** appliquer `SECURITY DEFINER` +
`SET search_path = ''` sur ces 3 fonctions. Fait sur `facilite-e2e-test`
(section "0bis-suite-3" de `supabase/seed-test.sql`) — les 6 tests de
`wave2-delete-replacements.spec.js` passent, y compris les 2 cas
anti-usurpation qui échouaient en cascade (le `SELECT` initial de la
fonction était bloqué par RLS avant même la vérification métier, causant un
retour `NULL` silencieux au lieu de l'exception attendue — ce n'était donc
pas un vrai trou de sécurité). **Correctif équivalent en prod proposé, en
attente de validation** avant toute migration.

**2. `log_security_event()` est appelable directement par `authenticated`
en prod, sans aucune vérification de l'identité de l'appelant dans son
corps.** C'est une fonction `SECURITY DEFINER`, et `authenticated` a bien
`EXECUTE` dessus en prod (confirmé par introspection, pas une supposition).
Son corps se contente d'un `INSERT INTO security_logs (...) VALUES
(p_event_type, p_severity, p_actor_id, p_target_user_id, p_details)` — les
paramètres `p_actor_id`/`p_target_user_id`/`p_event_type`/`p_severity` sont
fournis tels quels par l'appelant, sans comparaison à `auth.uid()`.
Concrètement, n'importe quel compte authentifié peut aujourd'hui insérer
une entrée dans `security_logs` en se faisant passer pour n'importe quel
autre acteur, avec n'importe quelle sévérité — un vecteur de forgerie de
journal de sécurité. Le test `storage-deletion-failure-log.spec.js:43`
attendait que ce soit bloqué pour `authenticated`, ce qui a permis de
découvrir l'écart. Aucune action prise en prod — à trancher : soit le GRANT
EXECUTE à `authenticated` est une erreur historique à révoquer, soit la
fonction doit valider `p_actor_id = auth.uid()` (sauf appel service_role).

**DÉCISION PRISE le 2026-08-08 :** révoquer `EXECUTE` à `authenticated`/
`anon` sur `log_security_event()` — seul `service_role` (et l'owner
`postgres`) peut l'appeler désormais. Les utilisateurs authentifiés passent
par des fonctions dédiées déjà existantes (`log_own_storage_deletion_failure()`,
`SECURITY DEFINER`, force `auth.uid()` comme acteur) plutôt que par un
`p_actor_id` fourni librement. Fait sur `facilite-e2e-test` (section
"0bis-suite-2" de `supabase/seed-test.sql`) — les 3 tests de
`storage-deletion-failure-log.spec.js` passent. **Correctif équivalent en
prod proposé, en attente de validation** avant toute migration.

**3. `get_candidats_recherche()` ne peut renvoyer aucun candidat à un
recruteur, ni en prod ni en test — trouvé le 2026-08-08, même famille que
le constat 1.** GRANTs `EXECUTE` vérifiés identiques entre prod et test
(diff exhaustif de `routine_privileges`, zéro écart). La fonction est
`LANGUAGE sql`, `prosecdef = false` : elle s'exécute avec les droits de
l'appelant, donc soumise à RLS sur `public.profiles`. Or `profiles` n'a que
3 policies `SELECT` en prod : lecture de son propre profil, lecture par un
admin, lecture par un agent pour ses candidats assignés — **aucune ne
permet à un recruteur badgé `verified_recruiter` de lire le profil d'un
autre candidat**, même avec `cv_visible_recruteurs = true`. Le filtrage
métier interne à la fonction (badge, `is_test_account`, rôle) ne sert donc
à rien : RLS bloque tout accès à des lignes hors profil propre avant même
que ce filtrage s'applique. Résultat observé : `get_candidats_recherche()`
renvoie toujours 0 lignes pour un recruteur réel, aussi bien en prod qu'en
test. Aucune action prise — à trancher, probablement la même direction que
le constat 1 (passer la fonction en `SECURITY DEFINER`, puisqu'elle fait
déjà elle-même tout le filtrage de sécurité nécessaire dans son corps) ou
ajouter une policy RLS dédiée sur `profiles`.

**DÉCISION PRISE le 2026-08-08 (Décision 3, même direction que la Décision
1) :** appliquer `SECURITY DEFINER` + `SET search_path = ''` sur
`get_candidats_recherche()`. Fait sur `facilite-e2e-test` (section
"0bis-suite-5" de `supabase/seed-test.sql`) — les 4 tests de
`recruiter-search-views.spec.js` et `recruiter-verification.spec.js`
passent. **Correctif équivalent en prod proposé, en attente de
validation** avant toute migration.

**4. `get_recruiter_candidatures()` — même famille, trouvé le 2026-08-08.**
`LANGUAGE sql`, `prosecdef = false` en prod. `candidatures` n'a que 2
policies SELECT (propre candidature, admin) — aucune ne permet à un
recruteur de lire les candidatures liées à ses propres offres, identique
en prod. **DÉCISION PRISE :** `SECURITY DEFINER` + `SET search_path = ''`.
Fait sur `facilite-e2e-test` — les 5 tests de
`recruiter-candidate-data-protection.spec.js` passent. **Correctif
équivalent en prod proposé, en attente de validation.**

**5. Policy storage `"Recruteurs et admins lisent les CV"` non
fonctionnelle pour un `verified_recruiter` réel — trouvé le 2026-08-08,
même famille mais PAS corrigeable par une simple donnée de seed.** Ses
deux conditions d'échappement (`cv_visible_recruteurs=true` sur le profil
du candidat, OU une ligne `candidatures` liant candidat et recruteur)
échouent TOUTES LES DEUX en pratique, vérifié en direct par appel réel
(`.storage.download()`) avec les deux conditions satisfaites une par une.
Cause : la policy contient des sous-requêtes `EXISTS (SELECT 1 FROM
profiles ...)` / `EXISTS (SELECT 1 FROM candidatures ...)` — ces
sous-requêtes sont elles-mêmes filtrées par le RLS de `profiles`/
`candidatures` pour l'appelant (un recruteur ne peut voir ni le profil
d'un autre candidat, ni une ligne `candidatures` où il n'est pas
`user_id`, via leurs policies SELECT respectives) — donc les deux `EXISTS`
renvoient toujours faux pour un recruteur non-admin, quelle que soit la
donnée réelle. Contrairement aux constats 1, 3 et 4, `SECURITY DEFINER`
ne s'applique pas directement (ce n'est pas une fonction, c'est une
policy) — le correctif probable est d'extraire ce test dans une fonction
`SECURITY DEFINER` dédiée (même principe que `has_badge()`) et de
l'appeler depuis la policy, au lieu d'y embarquer les `EXISTS` bruts.
**CORRIGÉ le 2026-08-08 :** extrait dans `public.can_recruiter_read_cv(candidate_id
uuid, recruiter_id uuid)`, `SECURITY DEFINER SET search_path = ''`, même
principe que `has_badge()`. Reprend exactement la même logique métier
(`cv_visible_recruteurs=true` OU `candidatures.recruiter_id` direct, sans
jointure `job_offers`) sous un garde commun
`has_badge(recruiter_id, 'verified_recruiter')` — sans ce garde, la
branche `cv_visible_recruteurs=true` aurait été lisible par n'importe quel
utilisateur authentifié, pas seulement un recruteur badgé. Migration
`20260808010000_storage_cv_policy_security_definer.sql`, appliquée et
vérifiée sur `facilite-e2e-test` PUIS en production (4 scénarios réels :
recruteur badgé + candidature → succès ; recruteur badgé sans lien →
refus ; candidat lit son propre CV → succès ; non authentifié → refus).
13 invariants vérifiés verts après déploiement en production.
`storage-role-literals-fix.spec.js:74` (le test qui avait permis de
détecter ce bug) reste néanmoins rouge — mais pour une raison distincte et
sans rapport : le bucket `job-offers` n'existe pas sur
`facilite-e2e-test` (voir "Dette technique restante" plus haut).

## CONSTAT BUG APPLICATIF (trouvé le 2026-08-08, PAS un écart de projet de test)

**`ApplyModal.jsx` : le message de succès disparaît quelques secondes après
une candidature réussie, le formulaire se réaffiche comme si rien ne
s'était passé.** Trouvé en diagnostiquant `candidate-application.spec.js`
(le test attendait un libellé obsolète, "Candidature transmise !" au lieu
de "Candidature Envoyée !" — corrigé — mais échouait encore après). Capture
réseau directe : `/api/postuler` répond bien `200 {"success":true, ...}`,
la candidature est réellement créée en base. Le composant affiche
correctement le message de succès (confirmé par polling direct : visible
de t=4s à t=6s après soumission) puis le perd (formulaire vide réaffiché
dès t=7s). Cause : le `useEffect` de `ApplyModal.jsx` (ligne 24) a pour
dépendances `[isOpen, job, selectedLang]` et fait `setSuccess(false)`
(ligne 73) à chaque déclenchement — si la prop `job` est recréée comme un
nouvel objet à chaque rendu du composant parent (référence différente,
contenu identique, cas fréquent sans `useMemo`), cet effect se redéclenche
et efface l'état de succès juste après l'avoir affiché, même si l'utilisateur
n'a rien fait. La candidature reste bien enregistrée (pas de perte de
données), seul l'affichage de confirmation est perdu — un vrai utilisateur
verrait probablement le même comportement en production. Aucune action
prise : nécessite d'identifier où `job` est calculé dans le composant
parent et de le stabiliser (`useMemo` ou dépendance sur un identifiant
stable plutôt que l'objet entier), hors périmètre de ce chantier
d'isolation des tests. `candidate-application.spec.js` reste rouge tant
que ce point n'est pas corrigé.

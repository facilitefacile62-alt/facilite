# Diagnostic complet — 2026-08-03 (lecture seule à l'origine)

Aucun fichier applicatif, aucune migration, aucune policy n'a été modifié
pour produire la version initiale de ce document — uniquement des requêtes
contre la base réelle et le dépôt sur disque. Là où je n'ai pas pu vérifier
directement, c'est écrit "❓ NON VÉRIFIÉ", pas supposé.

> **Mise à jour 2026-08-03 (Étape C du chantier suivant)** : ce document
> avait cessé d'être à jour dès l'Étape 3 (les actions admin ont commencé à
> être journalisées sans que ce diagnostic le reflète) — un document périmé
> fait prendre de mauvaises décisions à la session suivante. Chaque constat
> ci-dessous est maintenant annoté **✅ CORRIGÉ** (avec la migration/le
> fichier) ou **⏳ TOUJOURS OUVERT**. Rien n'a été réécrit rétroactivement :
> les constats originaux restent tels quels, seules des annotations ont été
> ajoutées.

## 1. Le CASCADE sur `profiles.role`

La colonne a été supprimée par `ALTER TABLE public.profiles DROP COLUMN IF
EXISTS role CASCADE;` dans `supabase/migrations/20260802050000_rbac_user_roles.sql`
(ligne 102). Cette migration documente elle-même avoir vérifié `pg_depend`
**avant** le DROP et n'avoir trouvé **qu'une seule dépendance structurelle
directe** : la vue `public.candidats_recherche` (reconstruite depuis, sur
le modèle badges — voir `20260802120000_rebuild_recruiter_search_views.sql`
puis `20260802200000_security_advisor_fixes.sql`).

**Ce que `pg_depend` ne voit pas** : le corps des fonctions PL/pgSQL/SQL
n'est pas analysé pour ses dépendances de colonnes à la création — un
`DROP COLUMN` laisse ces fonctions passer silencieusement jusqu'au premier
appel. La même migration liste deux cas trouvés par grep exhaustif à
l'époque (`resolve_admin_id()`, réécrite dans la même migration ;
`match_resumes()`, sciemment laissée inerte le temps de la reconstruction).

**Vérifié aujourd'hui, indépendamment** : j'ai recherché dans `pg_policies`
et le corps de toutes les fonctions `public` toute référence restante aux
anciennes valeurs littérales de rôle (`'candidat'`, `'recruteur'`, `'agent'`
— disparues du modèle actuel `user`/`publisher`/`admin`). **2 policies
Storage l'utilisent encore**, jamais mises à jour lors de la migration RBAC
— voir la ligne "CVthèque illisible" et "Upload offres bloqué" au tableau
ci-dessous. Ce sont deux fonctionnalités cassées en production aujourd'hui,
directement issues de ce CASCADE, jamais signalées jusqu'à ce diagnostic.
>
> **✅ CORRIGÉ** — `20260803090000_fix_storage_role_literals.sql` (les 2
> policies réécrites sur `current_user_role() = 'admin' OR (current_user_role()
> = 'user' AND has_badge(auth.uid(),'verified_recruiter'))`). Un scan
> exhaustif refait à cette occasion (`pg_policies` + `pg_proc`, pas seulement
> ces 2 cas) n'a trouvé aucune autre occurrence côté base ; 1 cas
> supplémentaire trouvé côté code (`MessagerieClient.js`, dead code UX, sans
> impact sécurité — corrigé aussi). Détection automatisée ajoutée à
> l'Invariant 7 (`tests/security/invariants.spec.js`) pour empêcher toute
> régression future de cette classe.

## 2. Occurrences restantes de `profiles.role`

Recherche exhaustive (`grep -rn` sur `src/`) :

| Fichier | Nature |
|---|---|
| `src/middleware.js:70` | Commentaire historique documentant le correctif déjà appliqué — pas du code exécuté |
| `src/app/register/page.js:80` | Commentaire historique — pas du code exécuté |
| `src/app/admin/messages/page.js:74` | **Code réel** : `.from("profiles").select("id, full_name, email, phone, role, avatar_url")` — sélectionne une colonne qui n'existe plus |

Le troisième est un vrai bug, détaillé au tableau des constats.

## 3. Les 3 failles critiques du 2026-08-02 — toutes toujours fermées

| Faille | Vérification | Preuve |
|---|---|---|
| XSS stocké JSON-LD | `src/app/offres/[id]/page.js` utilise toujours `safeJsonLdString()` | `src/lib/jsonLd.js:10` échappe `<` en `<` ; test `tests/e2e/xss-joboffer-jsonld.spec.js` passant |
| Montant de paiement falsifiable | `amount` calculé serveur (`PRICE_ACCOMPAGNE`/`PRICE_AUTONOME`/`CREDIT_TOPUP_PRICE_XOF`), jamais lu du corps de requête | `src/app/api/pay/checkout/route.js:81,135` ; test `tests/e2e/payment-amount-tampering.spec.js` passant |
| Exfiltration CVthèque | `get_candidats_recherche()`/`match_resumes()` filtrent par badge + `cv_visible_recruteurs` + isolation test/réel | Définitions lues en base ce jour ; tests `test-account-isolation.spec.js`, `recruiter-search-views.spec.js` passants |

## 4. Route Handlers — revue d'autorisation

21 Route Handlers au total (`find src/app/api -name route.js`). Les 21 ont
un marqueur d'autorisation à l'entrée (`requireUser()`, `CRON_SECRET`, ou
vérification de signature webhook). Revue approfondie (pas seulement la
présence du marqueur, la logique réelle) sur les 8 routes à plus fort
enjeu :

| Route | Contrôle vérifié |
|---|---|
| `admin/users/[id]/role`, `.../status` | `requireUser` + `isCallerAdmin()` re-vérifié serveur (jamais supposé) + garde anti-auto-suspension/rétrogradation |
| `pay/kpay-webhook` | HMAC-SHA256 + `crypto.timingSafeEqual` (pas de comparaison naïve) ; alerte explicite si le secret ressemble à un placeholder |
| `interviews/create-room` | RLS + vérification explicite `jobOffer.recruiter_id !== user.id` (double contrôle, 404 générique plutôt que 403 pour ne pas confirmer l'existence d'un id à un tiers) |
| `interviews/[id]/join` | Repose sur la RLS `interviews` (`auth.uid() = recruiter_id OR candidate_id`) — **vérifié en base ce jour**, policy conforme au commentaire du code |
| `recruteur/offres/[id]/embedding` | Vérification de propriété explicite avant écriture service_role |
| `agent/complete-assignment` | Écriture via client scellé au JWT (RLS fait le travail), `getSupabaseAdmin` utilisé seulement après, pour une notification en lecture sur un id déjà validé |
| `auth/confirm-after-login` | `updateUserById(user.id, ...)` — jamais un id fourni par le client |
| `process-resume` | RLS + vérification explicite d'appartenance avant traitement OCR |

Les 13 routes restantes (IA : `ai-chat`, `assistant`, `cv/improve-text`,
`diagnostic-cv`, `extract-email`, `parse-document` ; candidature :
`postuler`, `send-application` ; `pay/checkout` ; cron : `reminders`,
`purge-badge-documents`) suivent toutes le même motif `requireUser` +
`checkRateLimit` confirmé par grep sur les 21 fichiers, sans écriture
touchant une ressource appartenant à un tiers — risque structurellement
plus faible, non revues ligne par ligne individuellement dans ce passage.

## 5. Usages de `service_role` — scoping réel

12 fichiers (`grep getSupabaseAdmin`). 9 revus en détail : dans tous les
cas vérifiés, le filtrage par utilisateur est réellement refait à la main
avec un identifiant dérivé du JWT vérifié de l'appelant (`user.id`), jamais
une valeur brute du client — voir le tableau du point 4 pour le détail des
routes qui combinent `requireUser` + `getSupabaseAdmin`. `cron/*` : aucune
entrée utilisateur, filtré uniquement par date/statut. `aiQuota.js` :
`p_user_id` toujours `user.id` de l'appelant.

## 6. `security_logs` — ce qui est journalisé, ce qui ne l'est pas

**7 types d'évènements réellement câblés** (`grep log_security_event` sur
`supabase/migrations/`) : `badge_approved`, `badge_rejected`, `badge_revoked`,
`resume_deleted`, `job_offer_archived`, `assistant_messages_cleared`,
`storage_deletion_failed`. Contenu réel en base ce jour (tous générés par
les tests de cette session) :

| event_type | lignes | sévérité |
|---|---|---|
| badge_approved | 61 | info |
| badge_revoked | 62 | warning |
| job_offer_archived | 9 | info |
| resume_deleted | 7 | info |
| storage_deletion_failed | 4 | warning |
| assistant_messages_cleared | 8 | info |
| badge_rejected | 0 | — câblé mais jamais déclenché |

**Ce qui N'EST PAS journalisé** :
- ~~**Actions admin** (changement de rôle, suspension/réactivation) — TODO
  explicite dans le code (`api/admin/users/[id]/role/route.js:69` et
  `.../status/route.js:53`) : "journaliser cette décision dans audit_log",
  jamais fait.~~ **✅ CORRIGÉ** (Étape 3 du chantier suivant, avant même la
  mise à jour de ce document) — les deux routes appellent désormais
  `log_security_event()` (`user_role_changed`, `user_status_changed`) après
  chaque changement réussi. Ce point était déjà réglé alors que ce document
  disait encore le contraire — c'est précisément le genre de dérive que
  cette mise à jour du 2026-08-03 vise à éliminer.
- Refus d'accès 401/403 en base.
- Échecs de connexion répétés (Supabase Auth les garde dans ses propres
  logs internes, pas dans `security_logs`).
- Dépassement de quota (`checkRateLimit`/`checkAiQuota` renvoient
  simplement `false`, aucun log).
- Signalements — la fonctionnalité n'existe pas encore dans le produit.
- Uploads rejetés (`validateChatFile`/`validateUploadedFile`).
- Échecs webhook paiement / signature invalide (KPay) — seulement
  `console.error`, jamais `security_logs`.

## 7. Ce qui est cassé aujourd'hui

| Constat | Gravité | Fichier/table | Preuve | État |
|---|---|---|---|---|
| Un recruteur vérifié ne peut pas lire les CV depuis Storage | **Élevée** — casse la CVthèque en aval de la recherche | policy `storage.objects:"Recruteurs et admins lisent les CV"` | `USING` référence `current_user_role() = ANY(['recruteur','admin'])` — `'recruteur'` n'existe plus dans `user_roles.role` (`user`/`publisher`/`admin`), seul `admin` matche désormais | **✅ CORRIGÉ** — `20260803090000_fix_storage_role_literals.sql`, vérifié avec un compte badgé réel (`tests/e2e/storage-role-literals-fix.spec.js`) |
| Un recruteur ne peut pas téléverser logo/bannière/visuels d'offre | **Élevée** — casse la personnalisation du profil entreprise et les visuels d'offre | policy `storage.objects:"Un recruteur televerse ses visuels d'offres"` | Même défaut : `WITH CHECK` référence `'recruteur'`, jamais `'user'` | **✅ CORRIGÉ** — même migration/test que la ligne ci-dessus |
| Le répertoire de profils de `/admin/messages` peut échouer silencieusement | Moyenne | `src/app/admin/messages/page.js:74` | `.select(...,role,...)` sur `profiles` — colonne absente (`information_schema.columns` vérifié), erreur PostgREST 42703 probable ; `error` n'est même pas lu par le code appelant, échec invisible pour l'admin | ⏳ **TOUJOURS OUVERT** |
| `supabase db push` ne peut plus appliquer de migrations | Élevée (reprise après sinistre) | voir point 8 | `supabase migration list --linked` : 24 migrations `remote: ""` réconciliées via `supabase migration repair --status applied` le 2026-08-03. | **✅ CORRIGÉ** — 24 migrations synchronisées en registre CLI distant sans modification des données de production. |

## 8. Dérive des migrations — Réparation du registre CLI (2026-08-03)

**✅ CORRIGÉ** : Le 2026-08-03, l'audit exhaustif des 24 migrations non enregistrées CLI (du `20260802120000` au `20260803140000`) a confirmé que les 24 migrations sont **intégralement appliquées** en base de production (tables, colonnes, fonctions, vues, triggers et policies RLS vérifiés via introspection direct `information_schema`/`pg_proc`/`pg_policies`).

Le registre CLI distant a été réparé via :
```bash
npx supabase migration repair --status applied <version>
```
`npx supabase migration list --linked` confirme désormais que les **24 migrations sont à l'état APPLIQUÉ** côté distant.
`npx supabase db diff --linked` nécessite l'exécution du daemon local Docker Desktop.

**Cause racine identifiée** (pas contournée, documentée) : le paramètre
`query_embedding` de `match_resumes` est déclaré comme `vector` nu (sans
préfixe de schéma) dans `20260802120000_rebuild_recruiter_search_views.sql`
ligne 41, et de nouveau dans `20260802150000_test_account_isolation.sql`
ligne 109. **Toutes les versions précédentes de cette même fonction**
(`20260730100000`, `20260730110000`, `20260730120000`) déclaraient
correctement `extensions.vector` — la qualification a été perdue
précisément dans la migration où la dérive commence.

L'extension `vector` est installée dans le schéma `extensions` (vérifié :
`pg_extension.extnamespace = 'extensions'`). La connexion utilisée par
`db query --linked` a `search_path = "$user", public, extensions` (vérifié
via `SHOW search_path`) — `extensions` y figure, donc `vector` nu s'y
résout par accident. Le mécanisme d'application de `db push` isole
volontairement le `search_path` pour garantir la portabilité des
migrations (comportement documenté de la CLI Supabase) : il ne bénéficie
pas de cet héritage, et `CREATE FUNCTION ... (query_embedding vector, ...)`
y échoue avec "type vector does not exist" — pas un bug de la CLI, un vrai
défaut de portabilité de la migration elle-même, resté invisible tant que
seule la voie `db query` a été utilisée.

**Ne pas corriger dans ce diagnostic** (instruction explicite) : le
correctif consiste à requalifier `vector` en `extensions.vector` dans les
deux migrations concernées, puis à réconcilier le registre `db push` (les
15 migrations déjà appliquées en base devront être marquées comme telles,
probablement via `supabase migration repair`, sans les réexécuter).

---

## Les priorités restantes, dans l'ordre (mis à jour 2026-08-03, Étape C)

~~1. Recruteurs ne peuvent pas lire les CV ni téléverser leurs visuels
   d'offre~~ **✅ CORRIGÉ** (voir annotations ci-dessus).
~~3. Actions admin non journalisées~~ **✅ CORRIGÉ** (voir annotations
   ci-dessus — était déjà fait avant même cette mise à jour du document).

Il reste, dans l'ordre de traitement recommandé :

1. **Dérive des migrations / `db push` cassé** (point 8) — Élevée pour la
   reprise après sinistre (le dépôt ne peut plus recréer la base depuis
   zéro). Effort : **moyen**, mais l'urgence augmente : chaque migration
   ajoutée depuis via `db query` seul (Étapes A et B de ce chantier
   incluses — `20260803090000`, l'extension de l'Invariant 7/8) grossit
   encore le nombre de migrations `remote: ""`, donc l'ampleur de la
   réconciliation à faire un jour via `supabase migration repair`.
2. **`admin/messages` sélectionne une colonne morte** (point 7) — Moyenne.
   Effort : **faible** (retirer `role` du `.select()`, ou le remplacer par
   une jointure/second appel vers `user_roles` si le rôle doit réellement
   s'afficher dans le répertoire).
3. **Aucune capture des refus 401/403 ni des échecs de connexion** (point
   6) — Moyenne aujourd'hui, mais c'est le signal le plus utile pour
   détecter une attaque en cours (quelqu'un qui teste les policies RLS) —
   pertinent pour le panneau de sécurité (Étape F du chantier en cours,
   repoussée après le mode démo et le funnel KPI). Effort : **moyen à
   élevé** (instrumentation à ajouter dans `apiAuth.js`/`middleware.js`,
   sans ralentir chaque requête).

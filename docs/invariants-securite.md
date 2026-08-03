# Les 7 invariants de sécurité

`tests/security/invariants.spec.js` — sept vérifications contre la base
réelle (pas de simulation). Chacune doit renvoyer zéro ligne pour passer.

**Branché en CI** (`.github/workflows/ci.yml`, job `security-invariants`) —
tourne à chaque push et chaque pull request vers `main`, échoue le build si
un seul invariant est rouge. Nécessite le secret GitHub Actions
`SUPABASE_DB_URL` (chaîne de connexion Postgres directe, Dashboard Supabase
→ Project Settings → Database → Connection string) — sans lui, le job
échoue explicitement plutôt que de tourner silencieusement à vide. En local,
la CLI utilise l'état "linked" existant (`--linked`) à la place ; aucun
changement du geste local (`npx playwright test tests/security/invariants.spec.js`).

## Invariant 1 — Aucun GRANT de table non justifié

**Ce qu'il protège** : `authenticated`/`anon` ne doivent pas pouvoir modifier
ou supprimer une ligne d'une table directement, hors d'une fonction
contrôlée — sinon la RLS devient la SEULE ligne de défense, sans filet.
C'est la faille trouvée deux fois (`profiles`, `badge_requests`) : un GRANT
de table court-circuite les fonctions `SECURITY DEFINER`.

**Quoi faire quand il échoue** : pour chaque ligne signalée, décide si la
table doit gérer ses écritures via RLS pure (légitime pour beaucoup de
tables — un candidat qui modifie sa propre candidature n'a pas besoin d'une
fonction dédiée) ou si elle doit être verrouillée (comme `profiles`/
`user_roles`/`badge_requests`/`security_logs`). Documente la décision dans
`docs/grants-matrix.md`, puis ajoute l'entrée à la liste blanche du test
(`JUSTIFIED`) — jamais en bloc, table par table.

## Invariant 2 — Aucune table sans protection

**Ce qu'il protège** : RLS désactivé = table entièrement ouverte à qui a un
accès réseau. RLS activé + 0 policy = table entièrement fermée par défaut,
ce qui peut être voulu (`ai_usage_daily`, service_role uniquement) ou être
un oubli qui casse une fonctionnalité en silence.

**Quoi faire quand il échoue** : si RLS est désactivé, l'activer et ajouter
au minimum une policy `USING (false)` avant de définir les vraies règles —
jamais laisser une fenêtre sans RLS. Si 0 policy est voulu, documenter
pourquoi et ajouter au `JUSTIFIED_ZERO_POLICY` du test.

## Invariant 3 — Aucune fonction SECURITY DEFINER sans search_path figé

**Ce qu'il protège** : une fonction `SECURITY DEFINER` sans `search_path`
explicite résout les noms d'objets non qualifiés selon le search_path de
l'appelant — un attaquant qui crée une table/fonction du même nom dans un
schéma qu'il contrôle (si search_path le permet) peut la faire exécuter à
la place de l'originale, avec les privilèges du propriétaire de la fonction.

**Quoi faire quand il échoue** : ajouter `SET search_path = ''` (vide, le
plus strict) ou `SET search_path = public` a minima, et qualifier tous les
noms de table/fonction à l'intérieur (`public.ma_table`, pas juste
`ma_table`).

## Invariant 4 — Aucun bucket Storage public non justifié

**Ce qu'il protège** : un bucket public rend chaque fichier accessible par
URL directe à quiconque la devine ou l'obtient, sans authentification.

**Quoi faire quand il échoue** : basculer le bucket en privé
(`UPDATE storage.buckets SET public = false WHERE id = '...'`) et servir les
fichiers via `createSignedUrl()` (expiration courte), ou documenter et
ajouter à `JUSTIFIED_PUBLIC_BUCKETS` si le contenu est authentiquement
destiné à être public (ex: visuels marketing d'offres d'emploi).

## Invariant 5 — Aucun endpoint public sans contrôle d'autorisation

**Ce qu'il protège** : toute Route Handler (`route.js`) ou Server Action
(`"use server"`) est appelable directement par n'importe qui connaissant
l'URL/le nom de la fonction — une vérification uniquement dans le composant
qui l'appelle ne protège rien contre un appel direct.

**Quoi faire quand il échoue** : ajouter `requireUser()` (ou l'équivalent
`CRON_SECRET`/vérification de signature webhook) en première ligne du
handler, jamais supposé fait par l'appelant. Note : c'est une analyse
statique par mots-clés (heuristique) — un fichier qui échoue mérite une
relecture humaine, pas une correction automatique aveugle.

## Invariant 6 — Aucun usage de service_role sans filtrage manuel

**Ce qu'il protège** : `getSupabaseAdmin()` (clé service_role) ignore
totalement la RLS — toute requête faite avec ce client doit filtrer
manuellement par utilisateur dans le code applicatif, sinon elle opère sur
TOUTE la base sans restriction.

**Quoi faire quand il échoue** : vérifier que chaque usage de
`getSupabaseAdmin()` est suivi d'un `.eq("user_id", ...)` ou équivalent
scopé à un utilisateur précis (dérivé d'un JWT vérifié, jamais d'une valeur
brute fournie par le client). Heuristique par mots-clés également — relire
à la main, pas de correction automatique.

## Invariant 7 — Aucune policy RLS permissive tautologique, ni référence à un rôle obsolète

**Ce qu'il protège (volet 1 — tautologie)** : les policies RLS permissives se
combinent en OU — une seule policy dont le `USING`/`WITH CHECK` vaut `true`
(ou un chemin trop large comme `bucket_id = 'x'` sans restriction de dossier)
rend TOUTES les autres policies de la même commande inopérantes, même si
elles sont parfaitement écrites. C'est la classe de faille trouvée deux fois
de suite (`job_offers`, `chat-attachments`) : un scan manuel ponctuel qui
conclut "isolé" après avoir trouvé un seul cas ne suffit pas.

**Quoi faire quand il échoue** : lire la policy et les colonnes réellement
exposées. Si la lecture/écriture publique est réellement voulue, documenter
la décision dans `docs/rls-policies.md` et ajouter l'entrée à la liste
blanche du test (`JUSTIFIED`, format `"schema.table:policyname"`). Sinon,
supprimer la policy ou la remplacer par une condition explicite — et
vérifier l'effet de bord sur les lectures/écritures légitimes qui pouvaient
en dépendre sans qu'on le sache (cas vécu : `job_offers` a nécessité l'ajout
d'une policy compensatoire pour que le recruteur garde accès à ses propres
offres archivées).

**Ce qu'il protège (volet 2 — rôle obsolète, ajouté 2026-08-03)** : la
migration RBAC (`20260802050000_rbac_user_roles.sql`) a remplacé le modèle
`candidat`/`recruteur`/`agent`/`entreprise` par `user`/`publisher`/`admin` +
badges, mais `pg_depend` ne voit pas les littéraux de rôle codés en dur dans
le corps d'une policy ou d'une fonction — deux policies Storage
(`"Recruteurs et admins lisent les CV"`, `"Un recruteur televerse ses visuels
d'offres"`) ont continué à comparer `current_user_role()` à `'recruteur'`,
une valeur qui n'existe plus, cassant silencieusement la CVthèque et
l'upload de visuels pour tout recruteur vérifié réel. Ce volet scanne
`pg_policies` ET `pg_proc` pour tout littéral `'candidat'`, `'recruteur'`,
`'agent'` ou `'entreprise'` codé en dur, pas seulement les deux cas déjà
connus.

**Quoi faire quand il échoue** : réécrire la policy/fonction sur le modèle
actuel (`current_user_role() = 'admin' OR (current_user_role() = 'user' AND
has_badge(auth.uid(), '<badge>'))`, voir
`20260803090000_fix_storage_role_literals.sql`). Si un littéral matché n'est
en réalité pas une comparaison de rôle (faux positif), ajouter l'entrée à
`JUSTIFIED_ROLE_LITERAL` avec le format `"policy:schema.table:policyname"` ou
`"function:proname"`, jamais en silence.

## Invariant 8 — Aucune garde de rôle/statut fragile face à NULL

**Ce qu'il protège (volet SQL)** : `NULL <> 'admin'` vaut `NULL` (ni vrai ni
faux) en SQL — un `IF` sur ce résultat ne se déclenche jamais, laissant
passer silencieusement l'action censée être bloquée. C'est exactement le bug
trouvé sur 4 fonctions (`approve_badge_request`, `reject_badge_request`,
`revoke_badge`, `moderate_job_offer`) dès que `current_user_role()` a pu
renvoyer `NULL` pour un compte suspendu (`20260803050000_fix_null_unsafe_admin_checks.sql`).
Ce volet scanne toute fonction `SECURITY DEFINER` pour `<>`/`!=` contre un
littéral texte, pas seulement les 4 cas déjà connus.

**Quoi faire quand il échoue** : remplacer `<>`/`!=` par `IS DISTINCT FROM`.
Si le littéral matché compare `auth.role()` ou `current_user` (GUC de session
Postgres, toujours peuplés par PostgREST — pas la même classe de risque que
`current_user_role()`), documenter la décision et ajouter l'entrée à
`JUSTIFIED_SQL_GUARD` (format `"function:proname"`).

**Ce qu'il protège (volet JS)** : `===`/`!==` en JavaScript traitent
`null`/`undefined` sans ambiguïté (contrairement à SQL) — un scan mot-à-mot
de tout `.role`/`.status` dans `src/` produirait surtout du bruit (statut
d'un message de chat, d'un document OCR, etc.). Le vrai bug JS trouvé
(`isCallerAdmin()`, `src/lib/rbac.js`) n'était pas une comparaison
NULL-fragile mais un contrôle **omis** (`role` vérifié, `status` oublié) —
sur les routes admin qui écrivent en `service_role`, donc hors RLS : ce
fichier est leur seule barrière réelle. Ce volet pin donc précisément sa
complétude (vérifie `role === 'admin'` ET `status === 'active'` ET la garde
sur ligne absente/en erreur) plutôt que de scanner un pattern qui n'est pas
dangereux en JS.

**Quoi faire quand il échoue** : `src/lib/rbac.js` a été modifié pour retirer
une des trois conditions — les restaurer, ne jamais assouplir ce fichier
pour faire passer le test.

## Invariant 10 — Aucune fonction ni déclencheur absent de toute migration

**Ce qu'il protège** : `auto_confirm_user()` a existé en base pendant des
jours sans jamais apparaître dans une seule migration versionnée — créée
directement dans l'éditeur SQL du Dashboard Supabase, invisible à quiconque
ne pense pas à comparer manuellement la base et le dépôt. Cet invariant scanne
toute fonction `public.*` et tout déclencheur sur `public.*`/`auth.users`, et
vérifie que son nom apparaît dans au moins un fichier de
`supabase/migrations/` — sinon, il a été créé hors du processus de migration
et personne n'en garde la trace écrite.

**Quoi faire quand il échoue** : rapatrier l'objet trouvé dans une vraie
migration (`CREATE OR REPLACE FUNCTION`/`CREATE TRIGGER` avec son contenu
réel, lu en base via `pg_get_functiondef`/`pg_get_triggerdef`), pour qu'il
survive à une reconstruction de la base depuis zéro. Si l'objet est mort
(plus utilisé), le supprimer par migration plutôt que de le laisser traîner.
Un faux positif légitime (objet fourni par une extension/le système,
jamais créé par nous) s'ajoute à `JUSTIFIED` avec le format
`"function:proname"` ou `"trigger:schema.table:tgname"`.

## Invariant 11 — Aucun lien de navigation ni gate conditionné à un rôle obsolète dans le frontend

**Ce qu'il protège** : Trois fois la même classe de bug a cassé le projet : le lien Admin conditionné à `profiles.role='admin'`, les policies Storage conditionnées à `role='recruteur'`, et le lien Recruteur conditionné à `profileRole==='recruteur'`. Depuis la migration RBAC, ces littéraux de rôles (`'recruteur'`, `'candidat'`, `'agent'`) n'existent plus dans `user_roles`. Ce test scanne tous les fichiers `.js/.jsx` de `src/` pour identifier les littéraux de rôles obsolètes utilisés dans des CONDITIONS de gate (`===` ou `!==`), excluant les usages décoratifs légitimes (ex: `RoleBadge role="candidat"`).

**Quoi faire quand il échoue** : Remplacer l'utilisation du rôle obsolète par un contrôle sur les badges (`has_badge()` via RPC ou `profileBadges.includes()`). Si c'est un faux positif (ex: état local purement UI non transmis au serveur), ajouter le fichier à la liste `JUSTIFIED` dans le test.

## Exécution

```bash
npx playwright test tests/security/invariants.spec.js --project=chromium
```

Nécessite `npx supabase db query --linked` fonctionnel (connexion CLI
authentifiée) — invariants 1 à 4 interrogent `information_schema`/
`pg_catalog`/`storage.buckets`, non exposés via PostgREST.

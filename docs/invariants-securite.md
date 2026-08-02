# Les 6 invariants de sécurité

`tests/security/invariants.spec.js` — six vérifications contre la base réelle
(pas de simulation). Chacune doit renvoyer zéro ligne pour passer.

**⚠️ Pas encore branché en CI.** `.github/workflows/ci.yml` ne lance
actuellement aucun test Playwright (ni e2e, ni sécurité) — seulement lint et
build. Les faire tourner en CI nécessite d'exposer des secrets au workflow
GitHub Actions (au minimum `SUPABASE_ACCESS_TOKEN` pour que la CLI
s'authentifie ; les invariants passent par `npx supabase db query`, pas par
la clé anon). C'est une décision à prendre consciemment, pas un ajout
silencieux — voir docs/diagnostic-2026-08.md.

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

## Exécution

```bash
npx playwright test tests/security/invariants.spec.js --project=chromium
```

Nécessite `npx supabase db query --linked` fonctionnel (connexion CLI
authentifiée) — invariants 1 à 4 interrogent `information_schema`/
`pg_catalog`/`storage.buckets`, non exposés via PostgREST.

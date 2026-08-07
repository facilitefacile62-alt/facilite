# Règle : toute modification de base passe par une migration versionnée

Écrit le 2026-08-06, suite à l'incident du même jour
(`docs/incident-2026-08-06.md`) — Partie 4A du chantier.

## La règle

**Aucune modification de schéma, de policy, de GRANT ou de configuration
Storage (bucket public/privé) ne doit jamais être faite directement dans le
Dashboard Supabase (éditeur SQL, interface graphique) ni par un script qui
s'exécute au démarrage d'un service.**

Toute modification passe par un fichier dans `supabase/migrations/`, commité
dans le dépôt, avec un message expliquant le pourquoi. Une modification faite
hors de ce processus est invisible à `git log`, invisible à quiconque relit
l'historique, et — l'incident du 2026-08-06 l'a montré deux fois dans la même
journée (le bucket `resumes`, la policy `"Profiles read access"` sur
`profiles`) — invisible jusqu'à ce qu'un audit la trouve par hasard, parfois
des jours ou des semaines plus tard.

## Pourquoi cette règle, concrètement

Trois précédents dans ce seul projet :
1. `auto_confirm_user()` — créée directement dans l'éditeur SQL du Dashboard,
   restée invisible plusieurs jours (incident antérieur, voir
   `docs/invariants-securite.md`, Invariant 10).
2. Le bucket `resumes` — créé public par une migration, corrigé en privé par
   une migration le lendemain, puis **redevenu public par un mécanisme non
   tracé** entre le 2026-07-28 et le 2026-08-06. Aucune migration ne
   documente ce dernier changement — origine non attribuable.
3. La policy `"Profiles read access"` sur `public.profiles` — absente de
   toute migration, absente de tout commit, découverte uniquement parce que
   l'Invariant 4 (bucket) a déclenché un audit plus large qui l'a trouvée par
   ricochet.

Dans les trois cas : le code applicatif n'était pas en cause (vérifié —
aucun `create_bucket`/`updateBucket`/DDL au démarrage nulle part dans
`src/`, `backend-api/`, `scripts/`). La cause est humaine, hors du processus
de migration, à chaque fois.

## Ce que ça veut dire concrètement

- **Un changement en urgence** (comme fermer une fuite active) peut être
  appliqué immédiatement via `supabase db query --linked -f migration.sql`
  (jamais `supabase db push`, voir `docs/smtp-resend-auth.md`) — mais le
  fichier de migration doit exister et être commité **le jour même**, pas
  "plus tard". C'est exactement ce qui a été fait pour l'incident du
  2026-08-06 : correctif appliqué en direct, migration écrite et commitée
  dans la foulée.
- **Le Dashboard Supabase** (éditeur SQL, Table Editor, Storage → bucket
  settings) ne doit servir qu'à *consulter* l'état de la base, jamais à le
  *modifier* — sauf exception listée ci-dessous.
- **Un script qui tourne au démarrage d'un service** (`backend-api/`
  notamment) ne doit créer/modifier que ce qu'il a explicitement le droit de
  gérer (aujourd'hui : `establishments`/`job_offers` via
  `Base.metadata.create_all()`, lui-même une forme de DDL hors migration —
  toléré pour l'instant car documenté et vérifié idempotent, mais à terme
  ces tables devraient aussi avoir leur migration d'origine).

## Exceptions légitimes (aucune modification de schéma/donnée)

- Lecture de logs, de métriques, de la liste des utilisateurs.
- Gestion des secrets/clés API (Vercel, Resend, Daily.co...) — hors du
  périmètre de cette règle, qui ne concerne que la base Postgres/Storage.
- Actions ponctuelles sur des **données**, pas sur le **schéma** (ex: bannir
  un compte via une fonction déjà prévue à cet effet) — tant que l'action
  passe par une fonction `SECURITY DEFINER` déjà versionnée, pas par un
  `UPDATE`/`DELETE` à la main sur une table.

## Comment vérifier qu'elle tient

`tests/security/invariants.spec.js`, Invariant 10 : scanne toute fonction et
tout déclencheur en base et vérifie que son nom apparaît dans au moins un
fichier de `supabase/migrations/`. Tourne en CI (`security-invariants`,
`.github/workflows/ci.yml`) à chaque push. Ne couvre pas encore les buckets
Storage ni les policies individuellement par nom (seulement leur *contenu*
via l'Invariant 7 pour les policies tautologiques) — une extension possible,
non faite à ce jour.

**La CI seule ne bloque rien tant que `main` n'est pas protégé côté
GitHub** (requérir que `security-invariants` passe avant de fusionner, y
compris pour les administrateurs) — voir la procédure donnée séparément à
l'utilisateur pour ce réglage, hors du périmètre de ce document technique.

## Règle Absolue (Mise à jour 2026-08-07)

**Toute nouvelle colonne ou table créée en production doit avoir sa migration correspondante dans le même PR. Plus jamais de colonnes créées via le dashboard sans migration.**

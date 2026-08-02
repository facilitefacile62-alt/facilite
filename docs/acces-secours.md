# Accès de secours administrateur

Procédure à suivre si `/admin` est inaccessible depuis l'interface Next.js
(middleware ou pages cassés) et que tu dois te redonner un accès admin
directement, sans passer par l'application.

**Vérifié empiriquement** (2026-08-02) contre la base de production, via
`npx supabase db query --linked` — connexion équivalente au Query Editor du
Dashboard Supabase (rôle Postgres privilégié, hors du chemin
PostgREST/`authenticated` que l'application web emprunte). Les deux
protections mises en place dans ce projet — `REVOKE`/absence de `GRANT` sur
`public.user_roles`, et le trigger `trg_protect_cosmetic_columns` sur
`public.profiles.badges` — **ne s'appliquent pas** à cette connexion : les
requêtes ci-dessous fonctionnent sans contournement ni astuce.

## 1. Trouver ton `user_id`

Dans le **Dashboard Supabase → SQL Editor**, exécute (remplace l'email) :

```sql
SELECT id, email FROM auth.users WHERE email = 'ton-email@exemple.com';
```

Note l'`id` (UUID) retourné — c'est ton `user_id` pour la suite.

## 2. Te redonner le rôle admin

```sql
UPDATE public.user_roles
SET role = 'admin', status = 'active', updated_at = now()
WHERE user_id = '<ton-user_id>';
```

Si aucune ligne n'existe encore pour ce compte (ne devrait pas arriver —
`handle_new_user()` en crée une à l'inscription — mais au cas où) :

```sql
INSERT INTO public.user_roles (user_id, role, status)
VALUES ('<ton-user_id>', 'admin', 'active')
ON CONFLICT (user_id) DO UPDATE SET role = 'admin', status = 'active';
```

Vérifie :

```sql
SELECT role, status FROM public.user_roles WHERE user_id = '<ton-user_id>';
```

## 3. (Optionnel) T'attribuer le badge cosmétique `official_staff`

Purement décoratif — n'accorde aucune permission (voir
`docs/audit-securite-2026-08.md` et les migrations RBAC : aucune policy RLS
ne lit jamais `badges`). Utile seulement si tu veux que ton profil affiche
le badge dès maintenant plutôt que d'attendre la section 4 (`badge_requests`).

```sql
UPDATE public.profiles
SET badges = badges || '["official_staff"]'::jsonb
WHERE id = '<ton-user_id>';
```

(`||` concatène sans dupliquer si tu relances la commande — pas idempotent à
100 % si le badge existe déjà en double ailleurs dans le tableau, mais sans
conséquence pratique pour un tableau de badges.)

## 4. Reconnexion

Redémarre ta session applicative (déconnexion/reconnexion, ou juste rafraîchir
si ta session est encore valide) — le rôle est relu à chaque requête via
`current_user_role()` (fonction `SECURITY DEFINER`, pas de cache JWT), donc
aucun délai de propagation à attendre.

## Rappel important

**Cette procédure ne rétablit pas l'accès à `/admin` via l'interface** si le
blocage vient de `middleware.js` (qui lit encore `profiles.role`, colonne
supprimée — voir `docs/audit-securite-2026-08.md`, section RBAC). Tant que
`middleware.js` n'est pas réécrit pour lire `user_roles`, être admin en base
ne suffit pas à retrouver l'accès UI à `/admin` : le rôle sera correct, mais
le middleware plantera avant de le vérifier. Cette procédure sert
principalement à préparer le terrain (ton compte est admin en base, prêt
dès que le middleware sera corrigé), et à débloquer tout accès qui passe
directement par une route API (ex. `/api/admin/users/[id]/role`, qui lit
`user_roles` correctement, pas `profiles.role`).

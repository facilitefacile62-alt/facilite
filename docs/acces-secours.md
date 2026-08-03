# Accès de secours — administrateur et mode démonstration recruteur

Requêtes SQL à exécuter depuis le **Dashboard Supabase → SQL Editor** (ou
`npx supabase db query --linked`). Cette connexion est un rôle Postgres
privilégié, hors du chemin PostgREST/`authenticated` que l'application web
emprunte : les protections RLS et les fonctions `SECURITY DEFINER` qui
exigent `current_user_role() = 'admin'` (ex. `approve_badge_request`,
`revoke_badge`) **ne peuvent pas être appelées depuis cette connexion** —
`auth.uid()` y est toujours `NULL`. C'est pourquoi les requêtes ci-dessous
écrivent directement dans les tables plutôt que d'appeler ces fonctions.

**Testées de bout en bout le 2026-08-02, re-testées le 2026-08-03** contre
la base réelle (compte `facilitefacile62@gmail.com`, id
`eda26422-98b2-436f-b3b6-8beaaebf1188`) : marquage `is_test_account`,
attribution du badge, vérification via `has_badge()`, retrait du badge,
re-confirmation du rôle admin intact tout du long. Utilisable même si
l'application est complètement cassée — ces requêtes ne dépendent d'aucun
code applicatif, seulement de tables/fonctions Postgres de base.

## 1. Trouver un `user_id`

```sql
SELECT id, email FROM auth.users WHERE email = 'ton-email@exemple.com';
```

## 2. Se (re)donner le rôle admin

```sql
UPDATE public.user_roles
SET role = 'admin', status = 'active', updated_at = now()
WHERE user_id = '<user_id>';
```

Si aucune ligne n'existe pour ce compte (ne devrait pas arriver —
`handle_new_user()` en crée une à l'inscription) :

```sql
INSERT INTO public.user_roles (user_id, role, status)
VALUES ('<user_id>', 'admin', 'active')
ON CONFLICT (user_id) DO UPDATE SET role = 'admin', status = 'active';
```

Vérifier :

```sql
SELECT role, status FROM public.user_roles WHERE user_id = '<user_id>';
```

## 3. Passer un compte en mode test (accès démo recruteur)

Prérequis pour s'attribuer `verified_recruiter` sans jamais toucher un
compte réel — voir la règle du gel des badges. `is_test_account` n'est
accordable à `authenticated` par aucun GRANT (ni table, ni colonne) : seule
cette connexion SQL directe peut le poser.

```sql
UPDATE public.profiles SET is_test_account = true WHERE id = '<user_id>';
```

## 4. S'attribuer le badge `verified_recruiter`

```sql
UPDATE public.profiles
SET badges = CASE
  WHEN badges @> '["verified_recruiter"]'::jsonb THEN badges
  ELSE badges || '["verified_recruiter"]'::jsonb
END
WHERE id = '<user_id>';
```

Vérifier :

```sql
SELECT id, is_test_account, badges, public.has_badge(id, 'verified_recruiter') AS badge_actif
FROM public.profiles WHERE id = '<user_id>';
```

## 5. Retirer le badge

```sql
UPDATE public.profiles SET badges = badges - 'verified_recruiter' WHERE id = '<user_id>';
```

## 6. Sortir un compte du mode test

```sql
UPDATE public.profiles SET is_test_account = false WHERE id = '<user_id>';
```

## 7. Confirmer manuellement un utilisateur bloqué

Si un compte n'a jamais reçu son email de confirmation (SMTP cassé, voir
Partie 5 du chantier auth) et reste bloqué à l'inscription :

```sql
UPDATE auth.users SET email_confirmed_at = now() WHERE email = '<email>';
```

## 8. (Optionnel) Badge cosmétique `official_staff`

Purement décoratif — aucune policy RLS ne lit jamais `badges` pour une
décision d'autorisation (voir `docs/audit-securite-2026-08.md`). Utile
seulement pour l'affichage.

```sql
UPDATE public.profiles
SET badges = CASE WHEN badges @> '["official_staff"]'::jsonb THEN badges ELSE badges || '["official_staff"]'::jsonb END
WHERE id = '<user_id>';
```

## Reconnexion

Le rôle et les badges sont relus à chaque requête via `current_user_role()`
et `has_badge()` (fonctions `SECURITY DEFINER`, pas de cache JWT) — pas de
délai de propagation. Un rafraîchissement de session suffit si nécessaire.

## Rappel — gel des badges

`verified_recruiter` ne doit jamais être attribué à un compte réel tant que
le tableau de bord recruteur (chantier en cours) n'est pas terminé et testé.
Cette procédure ne doit être exécutée que sur un compte `is_test_account =
true` t'appartenant, jamais sur un compte externe.

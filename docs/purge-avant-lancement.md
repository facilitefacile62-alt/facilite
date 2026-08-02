# Purge avant lancement — comptes de test, profils fictifs, badges de simulation

À exécuter juste avant l'ouverture publique. Chaque requête est indépendante
— vérifie le résultat de chacune avant de passer à la suivante plutôt que de
tout coller d'un bloc.

## 1. Inventaire — vérifier avant de supprimer

```sql
-- Tous les comptes marqués comme comptes de test
SELECT id, full_name, email, is_test_account
FROM public.profiles
WHERE is_test_account = true;

-- Tous les comptes ayant le badge verified_recruiter (inclut les vrais
-- recruteurs accrédités ET tes amis en simulation — à distinguer avant de
-- révoquer en masse)
SELECT p.id, p.full_name, p.badges, ur.role
FROM public.profiles p
JOIN public.user_roles ur ON ur.user_id = p.id
WHERE p.badges @> '["verified_recruiter"]'::jsonb;

-- Toutes les demandes de badge (historique complet, y compris les
-- simulations)
SELECT id, user_id, company_name, ninea_number, status, created_at
FROM public.badge_requests
ORDER BY created_at DESC;
```

## 2. Retirer le badge verified_recruiter des comptes de simulation

Ne PAS révoquer en masse — seulement les comptes identifiés comme
simulation à l'étape 1 (les vraies accréditations de recruteurs réels
doivent rester). Pour chaque compte de simulation identifié :

```sql
-- Remplace <user_id> par l'UUID trouvé à l'étape 1
UPDATE public.profiles SET badges = badges - 'verified_recruiter' WHERE id = '<user_id>';
```

(Préférer `revoke_badge()` — RPC admin, journalise dans `security_logs` —
plutôt que cet UPDATE direct si tu es connecté avec une session admin :
`SELECT revoke_badge('<user_id>', 'verified_recruiter', 'Fin de simulation, purge pré-lancement');`)

## 3. Nettoyer les demandes de badge de simulation

```sql
-- Supprime les demandes des comptes de simulation (garde l'historique des
-- vraies demandes de recruteurs réels)
DELETE FROM public.badge_requests
WHERE user_id IN (SELECT id FROM public.profiles WHERE is_test_account = true);
```

## 4. Supprimer les 3 profils candidats fictifs

Créés par la migration `20260802150000_test_account_isolation.sql`
(`test-fictif-1/2/3@facilite-demo.local`). Le `ON DELETE CASCADE` de
`profiles.id -> auth.users.id` nettoie `profiles`/`user_roles` en même
temps que `auth.users` — supprimer via `auth.users` suffit.

```sql
DELETE FROM auth.users WHERE email IN (
  'test-fictif-1@facilite-demo.local',
  'test-fictif-2@facilite-demo.local',
  'test-fictif-3@facilite-demo.local'
);
```

## 5. Comptes de test e2e (utilisés par la suite Playwright)

**Ne pas supprimer si tu comptes garder la suite de tests fonctionnelle**
(`tests/e2e/*.spec.js` les réutilise à chaque run). Si le dépôt garde ces
tests après lancement, laisse ces comptes en place :

- `e2e-test-admin@facilite-demo.local`
- `e2e-test-agent@facilite-demo.local` (role='publisher')
- `e2e-test-candidate@facilite-demo.local`
- `e2e-test-security@facilite-demo.local`

Si tu préfères les retirer malgré tout (ex: environnement de prod
définitivement séparé des tests) :

```sql
DELETE FROM auth.users WHERE email IN (
  'e2e-test-admin@facilite-demo.local',
  'e2e-test-agent@facilite-demo.local',
  'e2e-test-candidate@facilite-demo.local',
  'e2e-test-security@facilite-demo.local'
);
```

## 6. Comptes recruteurs de démonstration (seed.sql)

`demo.senetech@…`, `demo.dakardigital@…`, `demo.terangaconsulting@…` — déjà
grandfathered `recruiter_verified`/badges lors de la migration RBAC. À
retirer aussi si non destinés à rester visibles publiquement (ils ont
publié de vraies-fausses offres d'emploi, visibles sur `/offres`) :

```sql
SELECT id, full_name, email FROM public.profiles
WHERE email LIKE 'demo.%@facilite-demo.local';

-- Si à retirer : supprime d'abord leurs offres (FK), puis le compte.
DELETE FROM public.job_offers WHERE recruiter_id IN (
  SELECT id FROM public.profiles WHERE email LIKE 'demo.%@facilite-demo.local'
);
DELETE FROM auth.users WHERE email LIKE 'demo.%@facilite-demo.local';
```

## 7. Vérification finale

```sql
-- Doit renvoyer 0 lignes si tout est purgé
SELECT count(*) FROM public.profiles WHERE is_test_account = true;
SELECT count(*) FROM public.badge_requests br
  JOIN public.profiles p ON p.id = br.user_id WHERE p.is_test_account = true;
```

## Rappel

`is_test_account` n'est modifiable par personne via l'API (ni le
propriétaire du profil, ni un admin via son propre client authentifié —
colonne jamais grantée à `authenticated`, voir
`20260802150000_test_account_isolation.sql`). Toute manipulation de cette
colonne, y compris cette purge, passe obligatoirement par un accès SQL
direct (Dashboard Supabase → SQL Editor, ou `npx supabase db query
--linked`) — jamais par l'interface Next.js.

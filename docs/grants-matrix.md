# Matrice des GRANT — plan des 3 vagues (Partie 1)

**État : LES 3 VAGUES SONT APPLIQUÉES** (2026-08-03, migrations
`20260802220000` à `20260802250000`). Invariant 1 est vert. Voir le rapport
livré au point d'arrêt pour le détail exécution par exécution, les 2
correctifs découverts en cours de route (policy RLS `job_offers` "Lecture
publique" + policy manquante "Un recruteur lit ses propres offres"), et les
tests committés (`tests/e2e/wave2-delete-replacements.spec.js`,
`tests/e2e/wave3-column-grants.spec.js`). Le contenu ci-dessous reste le
plan tel que validé à l'Arrêt 1 — conservé pour traçabilité.

## Contexte

L'invariant 1 (`tests/security/invariants.spec.js`) a trouvé 75 GRANT
`UPDATE`/`DELETE` non justifiés sur `authenticated`/`anon`, répartis sur 19
tables. Depuis, un commit externe (`f0368c8`, voir échange du 2026-08-02)
a transformé deux de ces "tables" (`candidats_recherche`, `profils_publics`)
en fonctions `SECURITY DEFINER` — elles n'apparaissent plus dans
`information_schema.role_table_grants`. **Baseline réelle au moment de ce
plan : 67 GRANT sur 17 tables.**

Méthode de vérification par table : recherche exhaustive de
`.from("<table>").update(` et `.from("<table>").delete(` dans `src/`,
classée par type de client (`getSupabaseAdmin()` = service_role, ignore
totalement RLS/GRANT et n'est donc jamais concerné par ces vagues ;
`createClient(..., ANON_KEY, {headers:{Authorization: Bearer <jwt utilisateur>}})`
ou l'import partagé `@/lib/supabase` = client `authenticated`, directement
concerné).

---

## Vague 1 — révoquer UPDATE + DELETE de `anon`

Aucune fonctionnalité connue ne dépend d'une écriture `anon` (un visiteur
non connecté n'a besoin que de `SELECT` sur les données publiques). Aucun
impact attendu.

```sql
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'agent_assignments','ai_usage_daily','applications','assistant_messages',
    'candidatures','contact_messages','conversations','interviews',
    'job_offers','messages','orders','profiles','recruiter_profiles',
    'resumes','subscriptions','support_threads','transactions'
  ])
  LOOP
    EXECUTE format('REVOKE UPDATE, DELETE ON public.%I FROM anon', t);
  END LOOP;
END $$;
```

## Vague 2 — révoquer DELETE de `authenticated`

Recherche exhaustive de `.delete()` client (hors `getSupabaseAdmin()`) sur
les 17 tables : **3 impacts trouvés**, tous nécessitant une fonction
`SECURITY DEFINER` construite **avant** la révocation (pas après) pour
éviter toute coupure de fonctionnalité :

| Table | Fichier | Usage actuel | Fonction de remplacement à créer |
|---|---|---|---|
| `resumes` | `src/app/profil/page.js:1057` | le candidat supprime un document CV qu'il a déposé | `delete_own_resume(resume_id uuid)` — vérifie `user_id = auth.uid()` |
| `job_offers` | `src/app/recruteur/page.js:667` | le recruteur supprime sa propre offre | `delete_own_job_offer(offer_id uuid)` — vérifie `recruiter_id = auth.uid()` |
| `assistant_messages` | `src/app/messagerie/MessagerieClient.js:529` | l'utilisateur efface son historique de chat IA pour une conversation | `clear_own_assistant_messages(conv_id uuid)` — filtre `user_id = auth.uid() AND conversation_id = conv_id` |

Aucun `.delete()` client trouvé sur les 14 autres tables (`agent_assignments`,
`ai_usage_daily`, `applications`, `candidatures`, `contact_messages`,
`conversations`, `interviews`, `messages`, `orders`, `profiles`,
`recruiter_profiles`, `subscriptions`, `support_threads`, `transactions`) —
révocation sans impact attendu pour celles-ci, `profiles` inclus (pas de
suppression de compte en libre-service implémentée aujourd'hui — c'est un
vrai manque pour le "droit à l'oubli" cité dans les règles du chantier, à
traiter séparément, hors de ce correctif de GRANT).

```sql
-- Après création des 3 fonctions ci-dessus et mise à jour des 3 fichiers
-- appelants pour utiliser .rpc(...) au lieu de .delete() :
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'agent_assignments','ai_usage_daily','applications','assistant_messages',
    'candidatures','contact_messages','conversations','interviews',
    'job_offers','messages','orders','profiles','recruiter_profiles',
    'resumes','subscriptions','support_threads','transactions'
  ])
  LOOP
    EXECUTE format('REVOKE DELETE ON public.%I FROM authenticated', t);
  END LOOP;
END $$;
```

## Vague 3 — UPDATE `authenticated`, colonnes justifiées par table

Recherche exhaustive de `.update(`/`.upsert(` client (hors service_role)
par table :

| Table | Colonnes UPDATE nécessaires | Preuve (fichier) |
|---|---|---|
| `agent_assignments` | `status`, `agent_id`, `completed_cv_url` | `admin/commandes-agent/page.js`, `api/agent/complete-assignment/route.js` |
| `ai_usage_daily` | **aucune** — écrit uniquement via `increment_ai_usage()` (service_role) | `src/lib/aiQuota.js` |
| `applications` | **aucune** — zéro référence trouvée dans `src/`, table probablement morte | recherche exhaustive, 0 résultat |
| `assistant_messages` | **aucune** (seul un `.delete()`, couvert Vague 2) | — |
| `candidatures` | `status` | `recruteur/page.js:711`, `api/interviews/create-room/route.js:134` |
| `contact_messages` | **aucune** — écrit seulement via `INSERT` (formulaire de contact) | recherche exhaustive, 0 résultat `.update(` |
| `conversations` | `last_message`, `updated_at` | `src/lib/messages.js:265`, `admin/messages/page.js` |
| `interviews` | **aucune** — statut jamais modifié côté client, seulement `INSERT`/`SELECT` | recherche exhaustive, 0 résultat |
| `job_offers` | `title`, `company`, `location`, `contract_type`, `salary_range`, `min_education_level`, `description`, `image_url`, `deadline`, `updated_at`, `is_active`, `embedding` — **explicitement PAS** `recruiter_id`, `id`, `created_at` | `recruteur/page.js:583,625,687` |
| `messages` | `is_read` | `admin/messages/page.js`, `MessagerieClient.js:994` |
| `orders` | `payment_reference` | `api/pay/checkout/route.js:117` (seule écriture `authenticated` — le reste passe par `supabaseAdmin` dans le webhook) |
| `profiles` | déjà fait (voir migration `20260802150000` et suivantes) — hors périmètre de cette vague | — |
| `recruiter_profiles` | `company_name`, `sector`, `location`, `description`, `website`, `logo_url`, `banner_url` | `recruteur/page.js:520-529` |
| `resumes` | `status`, `content`, `embedding`, `updated_at` | `api/process-resume/route.js` |
| `subscriptions` | **aucune** — toutes les écritures passent par `supabaseAdmin` dans le webhook KPay | recherche exhaustive, 0 résultat `authenticated` |
| `support_threads` | `status`, `updated_at` | `admin/support/page.js:210` |
| `transactions` | `provider_reference` | `api/pay/checkout/route.js:172` (seule écriture `authenticated`) |

**Effet de bord attendu et volontaire sur `job_offers`** : restreindre le
GRANT aux colonnes ci-dessus ferme, au niveau PostgreSQL, la faille de
mass-assignment jamais corrigée depuis l'audit initial
(`const payload = { ...offerForm, ... }` dans `recruteur/page.js:620`,
qui spread directement dans `.update()`). `offerForm`/`EMPTY_OFFER` ne
contient déjà que des champs sûrs côté React, mais rien n'empêchait
aujourd'hui un appel API direct (clé anon + JWT volé/forgé) de modifier
`recruiter_id` pour voler une offre. Après la Vague 3, ce sera
structurellement impossible même sans toucher au code React.

```sql
-- Exemple pour une table (répété pour chacune, avec sa propre liste de colonnes) :
REVOKE UPDATE ON public.job_offers FROM authenticated;
GRANT UPDATE (title, company, location, contract_type, salary_range,
  min_education_level, description, image_url, deadline, updated_at,
  is_active, embedding) ON public.job_offers TO authenticated;

-- Tables sans besoin d'UPDATE authenticated : simple REVOKE, pas de GRANT de colonne.
REVOKE UPDATE ON public.ai_usage_daily FROM authenticated;
REVOKE UPDATE ON public.applications FROM authenticated;
REVOKE UPDATE ON public.assistant_messages FROM authenticated;
REVOKE UPDATE ON public.contact_messages FROM authenticated;
REVOKE UPDATE ON public.interviews FROM authenticated;
REVOKE UPDATE ON public.subscriptions FROM authenticated;
```

---

## Script de rollback (préparé, non exécuté)

À utiliser uniquement si une vague casse une fonctionnalité en production
et qu'il faut rouvrir le temps de corriger — jamais comme solution
définitive (voir consigne : "si une fonctionnalité casse, dis-le-moi AVANT
de rétablir le privilège").

```sql
-- Rollback Vague 1 (anon) :
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'agent_assignments','ai_usage_daily','applications','assistant_messages',
    'candidatures','contact_messages','conversations','interviews',
    'job_offers','messages','orders','profiles','recruiter_profiles',
    'resumes','subscriptions','support_threads','transactions'
  ])
  LOOP
    EXECUTE format('GRANT UPDATE, DELETE ON public.%I TO anon', t);
  END LOOP;
END $$;

-- Rollback Vague 2 (authenticated DELETE) :
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'agent_assignments','ai_usage_daily','applications','assistant_messages',
    'candidatures','contact_messages','conversations','interviews',
    'job_offers','messages','orders','profiles','recruiter_profiles',
    'resumes','subscriptions','support_threads','transactions'
  ])
  LOOP
    EXECUTE format('GRANT DELETE ON public.%I TO authenticated', t);
  END LOOP;
END $$;

-- Rollback Vague 3 (authenticated UPDATE) : réouverture complète, table par table.
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'agent_assignments','ai_usage_daily','applications','assistant_messages',
    'candidatures','contact_messages','conversations','interviews',
    'job_offers','messages','orders','recruiter_profiles',
    'resumes','subscriptions','support_threads','transactions'
  ])
  LOOP
    EXECUTE format('GRANT UPDATE ON public.%I TO authenticated', t);
  END LOOP;
END $$;
-- profiles volontairement exclu du rollback Vague 3 : son verrouillage par
-- colonne est un correctif antérieur validé, pas une action de cette vague.
```

## Ordre d'exécution proposé

1. **Vague 1** — aucun prérequis, risque nul attendu.
2. **Construction des 3 fonctions de remplacement** (`delete_own_resume`,
   `delete_own_job_offer`, `clear_own_assistant_messages`) + mise à jour des
   3 fichiers appelants pour utiliser `.rpc(...)`, **avant** la révocation.
3. **Vague 2** — une fois les 3 fonctions en place et testées.
4. **Vague 3** — table par table, en commençant par les tables sensibles
   nommées explicitement (`transactions`, `orders`, `subscriptions`,
   `resumes`, `candidatures`, `applications`, `messages`, `conversations`),
   avec confirmation avant chacune.
5. Après **chaque** vague : les 6 invariants + la suite Playwright complète,
   résultat brut rapporté avant de passer à la vague suivante.

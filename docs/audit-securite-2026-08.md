# Audit sécurité Facilite — référentiel 101-150 (2026-08-02)

Audit du dépôt contre les points 101-150 du référentiel (les points 1-100 n'ont
jamais été fournis dans la conversation source — seuls 101-150 sont couverts
ici). Statuts basés sur lecture directe du code et des migrations, pas sur
supposition. `✅ OK` n'est utilisé que lorsqu'une preuve concrète existe ;
`❓ Non vérifiable` quand le point relève d'un réglage Dashboard/registrar
invisible depuis le code.

Légende : ✅ OK · ⚠️ Partiel · ❌ Absent · ❓ Non vérifiable · N/A non applicable

## Commits de correction (chronologique)

| Commit | Contenu |
|---|---|
| `bdb5da8` | XSS stocké JSON-LD (`/offres/[id]`) — point 107 |
| `c51b4f7` | Montant de paiement falsifiable (recharge crédits) — points 123/144 |
| `d9c6245` | Exfiltration base candidats (vérification recruteur + pagination) — points 121+122 |
| `efa1b68` | GitHub Actions épinglées par SHA — point 136 |
| `375b33d` | Quota IA quotidien (6 routes) — point 146(c) |

Tests commités et exécutables (`npm run test:e2e` — **pas** `npm test`, ce script
n'existe pas) : `tests/e2e/xss-joboffer-jsonld.spec.js`,
`tests/e2e/payment-amount-tampering.spec.js`,
`tests/e2e/recruiter-verification.spec.js`. Le correctif GitHub Actions n'a pas
de test applicable (config CI). Le quota IA (`375b33d`) a été vérifié
uniquement par requêtes SQL manuelles via `npx supabase db query`, jamais
committé comme test automatisé — `SUPABASE_SERVICE_ROLE_KEY` (requis par les 6
routes concernées) est absent en local.

---

## 13 — Pièges spécifiques Next.js

| N° | Point | Statut | Fichier | Preuve |
|---|---|---|---|---|
| 101 | Middleware n'est pas la sécurité | ✅ OK | `src/middleware.js:38-107`, `src/lib/apiAuth.js:14-46` | `getUser()` (revalidation JWT serveur) + chaque Route Handler revérifie indépendamment via `requireUser()`. |
| 102 | Route Handlers = endpoints publics | ✅ OK | tous les `src/app/api/**/route.js` | 14/16 routes appellent `requireUser`, 1 utilise `CRON_SECRET`, 1 (webhook) une signature HMAC. |
| 103 | Validation par schéma (Zod) | ⚠️ Partiel | `src/app/api/postuler/route.js:33-39` | Seules 5/16 routes utilisent Zod ; les autres font des contrôles de présence manuels sans validation de type/format/bornes. |
| 104 | Pas de mass assignment | ✅ OK (vérifié après coup) | `src/app/recruteur/page.js:453-455,553`, `supabase/migrations/20260730000100_recruteur_cvtheque.sql:104-114`, `20260730140000_recruiter_showcase.sql:39-47` | `{...offerForm}`/`{...recruiterProfileForm}` toujours présents, non corrigés. Vérification (faite en réponse à une question directe, pas pendant l'audit initial) : ni `offerForm` ni `recruiterProfileForm` ne contiennent de colonne privilégiée (`is_active`, `embedding`, `recruiter_id`/`user_id`), et le `WITH CHECK`/`USING` des policies RLS reste la vraie frontière. Pas d'escalade de privilège possible aujourd'hui, mais ce point avait été explicitement promis pour la catégorie 14 puis jamais revérifié à ce moment-là — miss de process, pas seulement de code. |
| 105 | Cache et données personnelles | ✅ OK | build output (`○ Static` sur toutes les pages `/candidat/*`, `/profil`) | Pages personnelles en `"use client"`, données chargées après montage — pas de HTML statique contenant des données privées. |
| 106 | Clés de cache (`unstable_cache`) | N/A | — | Introuvable dans `src/` — fonctionnalité non utilisée. |
| 107 | Pas de HTML brut / XSS | ✅ OK (corrigé) | `src/lib/jsonLd.js`, `src/app/offres/[id]/page.js`, `src/app/page.js` | `JSON.stringify` n'échappait pas `</script>` — XSS stocké via description d'offre. Corrigé par `safeJsonLdString()` (commit `bdb5da8`), test `tests/e2e/xss-joboffer-jsonld.spec.js`. |
| 108 | En-têtes (`next.config`) | ⚠️ Partiel | `next.config.mjs:52-93` | X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, HSTS présents et corrects. CSP envoyée en `Content-Security-Policy-Report-Only` uniquement — jamais appliquée en production. |

## 14 — Angles morts Supabase

| N° | Point | Statut | Fichier | Preuve |
|---|---|---|---|---|
| 109 | `service_role` ignore la RLS | ✅ OK | `src/app/api/agent/complete-assignment/route.js:45-69`, `src/app/api/pay/kpay-webhook/route.js:36,148` | Écriture privilégiée toujours faite via le client RLS-scopé de l'appelant ; `service_role` utilisé seulement après coup, scopé par un ID dérivé d'une ligne déjà validée par RLS ou signature webhook. |
| 110 | Vues `SECURITY DEFINER` mal déclarées | ✅ OK | `supabase/migrations/20260728200000_vue_profils_publics.sql:53-98`, `20260730000200_fix_profiles_rls_recursion.sql:40-65` | `security_invoker=off` utilisé sur 2 vues, mais chacune a une allowlist de colonnes explicite et un filtre de lignes dans son `WHERE` — pattern correctement appliqué, pas une faille. |
| 111 | `search_path` figé (`= ''`) | ⚠️ Partiel | 14 fonctions dans `supabase/migrations/*.sql` | Toutes fixent `search_path`, mais à `public` (ou `public, extensions`), jamais `''`. Risque faible (tables déjà qualifiées dans les corps de fonction) mais pas la pratique recommandée. |
| 112 | Perf RLS (index, `(select auth.uid())`) | ❌ Absent | 26 fichiers de migration ; `candidatures`, `applications`, `conversations` | 0/26 fichiers n'utilise le pattern `(select auth.uid())` (toujours `auth.uid()` nu). `candidatures.user_id`, `applications.user_id`, `conversations.user_1_id/user_2_id` — tables à plus fort volume — n'ont aucun index (confirmé via `pg_indexes`), contrairement à `orders`/`transactions`/`subscriptions`. |
| 113 | Policies Storage distinctes des tables | 🟠 **ÉLEVÉ (reclassé)** | `supabase/migrations/20260730070000_chat_attachments.sql:36-56`, `src/lib/chatAttachments.js:58-84` | Bucket `chat-attachments` public (`public=true`), chemin `{userId}/{timestamp}_{filename}`. Le `userId` (seule vraie protection) est exposé publiquement pour tout utilisateur avec profil public (`profils_publics.id`) ou offre publiée (`job_offers.recruiter_id` dans `select("*")`) — la lecture non authentifiée d'une pièce jointe est réaliste pour ces comptes, pas seulement théorique. `resumes` (privé, own-only policies) reste correctement protégé. |
| 114 | Autorisation Realtime par canal | ✅ OK | 11 fichiers utilisant `.channel(...)` | Tous en `postgres_changes` (aucun `broadcast`/`presence` trouvé) — hérite automatiquement de la RLS `SELECT` de la table. |
| 115 | Allowlist Redirect URLs (auth) | ❓ Non vérifiable | — | Dashboard Supabase → Auth → URL Configuration. |
| 116 | Protection mots de passe fuités + CAPTCHA | ❓ Non vérifiable | — | Dashboard Supabase → Auth → Policies. |
| 117 | Rotation refresh tokens + déconnexion globale | ⚠️ Partiel | `src/components/SecurityTabContent.jsx` | Rotation = réglage Dashboard (non vérifiable). Aucun bouton "déconnecter tous les appareils" ni `signOut({scope:'global'})` trouvé dans le code. |
| 118 | SMTP personnalisé (emails Auth) | ❓ Non vérifiable | — | Dashboard Supabase → Auth → SMTP, distinct de Resend (emails applicatifs). |

## 15 — Logique métier

| N° | Point | Statut | Fichier | Preuve |
|---|---|---|---|---|
| 119 | IDOR | ✅ OK | `src/app/api/interviews/[id]/join/route.js:32-40` | Lecture via client RLS-scopé de l'appelant — ligne invisible = 404, IDs UUID non séquentiels. |
| 120 | Énumération de comptes | ⚠️ Partiel | `src/app/login/page.js:107`, `src/app/forgot-password/page.js:137` | Login/mot de passe oublié génériques et corrects. Inscription révèle probablement un email déjà pris (comportement Supabase par défaut, non re-généricisé) — non corrigé, sévérité faible. |
| 121 | Scraping de la base CV | ✅ OK (corrigé) | `src/app/api/recruteur/candidats-recherche/route.js` | `.select("*")` illimité, direct navigateur→PostgREST, hors rate-limit. Corrigé par une route paginée (30/page) + rate-limitée (commit `d9c6245`). |
| 122 | Vérification des recruteurs | ✅ OK (corrigé) | `supabase/migrations/20260802020000_recruiter_verification.sql`, `20260802030000_protect_recruiter_verified.sql` | N'importe qui pouvait s'inscrire recruteur et accéder immédiatement à `candidats_recherche`. Corrigé : `profiles.recruiter_verified` (grandfathered pour comptes existants), vue filtrée, trigger anti-auto-escalade, UI admin de validation. Test `tests/e2e/recruiter-verification.spec.js`. |
| 123/144 | Prix/rôle jamais dictés par le client | ✅ OK (corrigé) | `src/app/api/pay/checkout/route.js` | CV : catalogue serveur fixe (déjà OK). Crédits : `amount`/`planName` acceptés tels quels du client — corrigé (commit `c51b4f7`), catalogue fixe désormais. Rôle : lu depuis `profiles.role`, jamais du JWT. |
| 124 | Escalade de rôle | ✅ OK | `supabase/migrations/20260729232500_profiles_multi_roles.sql:68-89`, `20260802030000_protect_recruiter_verified.sql` | Trigger `prevent_role_self_escalation` annule tout changement de `role` (et désormais `recruiter_verified`) hors admin/`service_role`. |
| 125 | Modération du contenu | ❌ Absent | — | Aucun mécanisme de signalement/revue dans `src/`. `docs/moderation.md` (non suivi par git) suggère un autre chantier en cours — non touché. |
| 126 | Suppression réelle (RGPD) | ❌ Absent | — | Aucune fonctionnalité d'auto-suppression de compte dans le repo (aucun appel `auth.admin.deleteUser`, aucune UI). |
| — | Mass assignment `job_offers`/`recruiter_profiles` (cf. point 104) | ✅ OK (vérifié) | voir point 104 ci-dessus | Non corrigé mais vérifié non exploitable — RLS `WITH CHECK`/`USING` tient la frontière, aucune colonne privilégiée atteignable via le spread. |

## 16 — Uploads

| N° | Point | Statut | Fichier | Preuve |
|---|---|---|---|---|
| 127 | Vérifier le contenu (magic bytes) | ⚠️ Partiel | `src/lib/validation.js:23-73` | Implémenté et utilisé par 6 routes serveur. Les uploads directs navigateur→Storage (CV via `profil/page.js`, logos/bannières recruteur, `chatAttachments.js`) n'ont aucune vérification de contenu. |
| 128 | Domaine séparé pour fichiers utilisateurs | ✅ OK (par construction) | — | Tous les fichiers servis depuis `*.supabase.co`, distinct de `ffacilite.com` — protège contre le vol de cookie de session en cas de script exécuté, pas contre la lecture directe (cf. point 113 reclassé). |
| 129 | `Content-Disposition: attachment` | ❌ Absent | `src/lib/supabase.js:43-45`, `src/app/candidat/facturation/page.js:96-98`, `src/app/candidat/mes-cvs/page.js:102`, `src/app/api/pay/kpay-webhook/route.js:122-124` | Aucun des 4 usages de `createSignedUrl()` ne passe `{download:true}` — rendu inline systématique. |
| 130 | Jamais de SVG/HTML accepté | ⚠️ Partiel | `src/lib/validation.js:13-21` | Allowlist exclut SVG/HTML sur les 6 routes serveur ; aucune restriction sur les uploads directs (même gap que 127). Aucune configuration `allowed_mime_types` au niveau bucket dans les migrations. |
| 131 | Antivirus asynchrone | ❌ Absent | — | Aucune intégration (ClamAV, VirusTotal...) trouvée. |

## 17 — Chaîne d'approvisionnement

| N° | Point | Statut | Fichier | Preuve |
|---|---|---|---|---|
| 132 | Lockfile + `npm ci` | ✅ OK | `.github/workflows/ci.yml:24-25`, `package-lock.json` | `npm ci` en CI, lockfile committé. |
| 133 | Dependabot + `npm audit` | ⚠️ Partiel | — | Aucun `.github/dependabot.yml`. `npm audit` : 3 vulnérabilités (2 modérées, 1 haute) sur `postcss`, uniquement via la copie interne bundlée par `next@16.2.12` (dépendance de build, pas exposée à une entrée utilisateur) — risque réel faible. |
| 134 | Scripts postinstall désactivés | ❌ Absent | `package.json` | Non activé. Les 3 packages natifs (`sharp`, `@napi-rs/canvas`, `tesseract.js`) ne déclarent aucun script `install`/`postinstall` propre — `--ignore-scripts` a de bonnes chances de fonctionner mais n'a pas été testé empiriquement. |
| 135 | Typosquatting | ❓ Non vérifiable | — | Question de discipline au moment de chaque ajout, pas vérifiable rétroactivement. |
| 136 | Actions GitHub épinglées par SHA | ✅ OK (corrigé) | `.github/workflows/ci.yml:16,19,65` | `actions/checkout`, `actions/setup-node`, `supabase/setup-cli` épinglés par SHA de commit (commit `efa1b68`), SHA vérifiés via l'API GitHub. |

## 18 — Comptes et opérations

| N° | Point | Statut |
|---|---|---|
| 137 | MFA (GitHub/Vercel/Supabase/registrar/email) | ❓ Non vérifiable (action manuelle) |
| 138 | Verrouillage du registrar | ❓ Non vérifiable (action manuelle) |
| 139 | Sauvegarde hors plateforme | ❓ Non vérifiable (action manuelle) |
| 140 | Test de restauration | ❓ Non vérifiable (action manuelle) |
| 141 | Procédure de retrait d'accès | ❓ Non vérifiable (action manuelle) |
| 142 | SPF, DKIM, DMARC | ❓ Non vérifiable (config DNS, hors code) |

## 19 — Paiements et IA

| N° | Point | Statut | Fichier | Preuve |
|---|---|---|---|---|
| 143 | Idempotence / anti-rejeu webhook | ✅ OK | `src/app/api/pay/kpay-webhook/route.js:61,169` | `.eq("status","pending")` comme condition de l'UPDATE — un webhook rejoué trouve 0 ligne à modifier. |
| 144 | Montant recalculé serveur | ✅ OK (corrigé) | voir point 123 | Commit `c51b4f7`. |
| 145 | Réconciliation quotidienne | ❌ Absent | — | Aucun job de réconciliation (`vercel.json` ne contient que `/api/cron/reminders`). Process opérationnel, pas un bug de code. |
| 146 | IA : injection/PII/coût | ⚠️ Partiel | `src/app/api/diagnostic-cv/route.js:33`, `src/lib/aiQuota.js` | Clés API jamais `NEXT_PUBLIC_` (✅). Aucune défense explicite contre l'injection de prompt dans les system prompts (❌, non corrigé). Coût non plafonné sur 6 routes — corrigé par un quota de 40 appels/jour/utilisateur (commit `375b33d`), vérifié par SQL manuel (voir note test en tête de document), pas de test automatisé committé. |

## 20 — Conformité

| N° | Point | Statut | Fichier | Preuve |
|---|---|---|---|---|
| 147 | Loi sénégalaise n°2008-12 (déclaration CDP) | ❓ Non vérifiable (action externe) | — | Démarche administrative, hors du code. |
| 148 | Consentement explicite au partage du CV | ❌ Absent | `src/components/ApplyModal.jsx` | Aucune case à cocher ni mention de consentement dans le parcours de candidature. |
| 149 | Sous-traitants documentés | ❌ Absent | — | Aucune page politique de confidentialité/mentions légales/CGU dans le repo. |
| 150 | Registre des traitements | ❌ Absent | — | Document de gouvernance à tenir, absent du repo (normal, pas un artefact de code). |

---

## Risques résiduels acceptés (au 2026-08-02)

| Risque | Sévérité | Pourquoi accepté maintenant |
|---|---|---|
| `chat-attachments` public, divulgation non authentifiée réaliste | 🟠 ÉLEVÉ | Reclassé suite à vérification (voir point 113) — pas encore corrigé, décision de bascule vers URLs signées/privé à prendre séparément (changement de comportement UX). |
| Coût IA — pas de défense anti-injection de prompt | 🟡 MOYEN | Impact limité (pas d'exécution de code), correctif mécanique simple mais pas encore appliqué. |
| `search_path=public` (pas `''`) sur 14 fonctions SQL | 🟢 FAIBLE | Faible exploitabilité réelle, tu as choisi de ne pas le traiter cette session. |
| RLS sans `(select auth.uid())`, tables non indexées | 🟡 MOYEN | Dette de perf, pas une fuite ; gros blast radius, volume actuel faible. |
| Uploads directs sans validation magic-bytes | 🟡 MOYEN | Buckets sensibles déjà privés (`resumes`) ; changement d'architecture plus large que ce pass d'audit. |
| Pas de suppression de compte / droit à l'oubli | 🟠 ÉLEVÉ | Fonctionnalité entière à construire — décision produit séparée. |
| Pas de modération de contenu | 🟡 MOYEN | Chantier détecté en cours dans une autre session (`docs/moderation.md`), non dupliqué. |
| Pas d'antivirus sur les uploads | 🟢 FAIBLE | Chantier d'infrastructure à part entière. |

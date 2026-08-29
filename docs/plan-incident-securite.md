# Plan d'incident de sécurité

Document opérationnel. Il suppose qu'on le lit sous pression, sans temps pour
explorer le dépôt. Chaque étape indique la commande ou l'écran exact.

Périmètre : compromission suspectée, fuite de données, accès non autorisé,
abus automatisé. Pour une panne sans soupçon de malveillance (504, build
cassé, quota atteint), ce n'est pas le bon document — voir
`docs/diagnostic-2026-08.md`.

---

## 1. Qui contacter

| Rôle | Qui | Comment |
|---|---|---|
| Responsable du produit et des données | facilitefacile62@gmail.com | e-mail, et téléphone si l'incident touche des données de candidats |
| Hébergement applicatif | Vercel — équipe `facilite63`, plan Hobby | dashboard Vercel, support communautaire uniquement (pas de SLA sur ce plan) |
| Base de données et stockage | Supabase — plan gratuit | dashboard Supabase, support par ticket |
| Paiements | KPay, PayDunya | comptes marchands respectifs |
| Envoi d'e-mails | Resend | dashboard Resend |

**Le plan Hobby n'ouvre droit à aucun support prioritaire.** En cas
d'incident grave, ne pas attendre une réponse de Vercel ou de Supabase :
appliquer les mesures d'isolement ci-dessous soi-même.

Obligation légale : si des données personnelles de candidats sont exposées,
la notification aux personnes concernées relève du responsable de
traitement. Les données en jeu sont listées dans la déclaration Data Safety
(profils, CV, lettres, messages, historique de commandes).

---

## 2. Les vingt premières minutes

Dans cet ordre. Ne pas sauter l'étape 2.1 : sans trace, l'incident devient
impossible à reconstituer.

### 2.1 Figer les preuves avant toute correction

```sql
-- Journal de sécurité applicatif, 48 h glissantes
SELECT created_at, event_type, severity, ip_address, resolved_status, details
FROM public.security_logs
WHERE created_at > now() - interval '48 hours'
ORDER BY created_at DESC;

-- Accès aux documents de candidats
SELECT l.accessed_at, l.admin_id, l.candidate_id, l.document_type
FROM public.document_access_logs l
WHERE l.accessed_at > now() - interval '48 hours'
ORDER BY l.accessed_at DESC;

-- Comptes créés récemment (pic = création automatisée)
SELECT date_trunc('hour', created_at) AS heure, count(*)
FROM auth.users
WHERE created_at > now() - interval '7 days'
GROUP BY 1 ORDER BY 1 DESC;
```

Copier les résultats dans un fichier daté avant de modifier quoi que ce
soit. Les journaux Vercel ne sont conservés que peu de temps sur le plan
Hobby : `npx vercel logs <url-du-deploiement>` immédiatement si la piste est
applicative.

### 2.2 Évaluer l'étendue

Trois questions, dans cet ordre :

1. **Des données de candidats sont-elles sorties ?** `document_access_logs`
   et `security_logs` répondent. Si oui, l'incident est majeur : la
   notification aux personnes concernées devient obligatoire.
2. **Un compte administrateur est-il en cause ?**
   `SELECT * FROM public.user_roles WHERE role = 'admin';` — toute ligne
   inattendue est le point de départ.
3. **Des clés ont-elles fuité ?** `SUPABASE_SERVICE_KEY`, `GEMINI_API_KEY`,
   `KPAY_SECRET_KEY`, `RESEND_API_KEY`. Une clé `service_role` compromise
   donne accès à la totalité de la base, RLS ignorée.

### 2.3 Couper l'accès de l'attaquant

Du moins destructif au plus destructif.

**Suspendre un compte** — révoque son rôle sans supprimer ses données :

```sql
UPDATE public.user_roles
SET status = 'suspended', suspended_by = '<uuid-admin>', updated_at = now()
WHERE user_id = '<uuid-compromis>';
```

**Invalider toutes les sessions d'un utilisateur** — dashboard Supabase,
Authentication → Users → l'utilisateur → *Sign out user*. À faire après la
suspension, sinon le jeton en cours reste valide jusqu'à son expiration.

**Faire tourner une clé compromise** :

- `SUPABASE_SERVICE_KEY` : dashboard Supabase → Project Settings → API →
  *Reset service_role key*. **Rompt immédiatement toutes les routes serveur.**
  Reporter la nouvelle valeur dans Vercel → Settings → Environment Variables,
  puis redéployer. Compter quelques minutes d'indisponibilité, assumées.
- Clés d'IA, de paiement, d'e-mail : révoquer chez le fournisseur, remplacer
  dans Vercel, redéployer.

---

## 3. Isoler ou désactiver une fonctionnalité rapidement

Trois leviers, du plus rapide au plus lourd.

### 3.1 Bascule en base — quelques secondes, sans déploiement

`public.feature_flags` pilote la navigation et les fonctionnalités. C'est le
moyen le plus rapide de fermer une fonctionnalité compromise :

```sql
UPDATE public.feature_flags SET enabled = false WHERE id = '<identifiant>';
SELECT id, name, path, enabled FROM public.feature_flags ORDER BY id;
```

L'effet est immédiat pour tout visiteur qui recharge. **Griser, jamais
cacher** : l'interface doit montrer la fonctionnalité désactivée, pas la
faire disparaître — un bouton absent envoie l'utilisateur chercher un
contournement.

### 3.2 Fermer une porte au niveau de la base — effet immédiat, sans déploiement

Retirer un droit ferme l'accès à tous les clients à la fois, y compris ceux
qui n'utilisent pas l'application :

```sql
-- Fermer complètement une table au public
REVOKE ALL ON public.<table> FROM anon, authenticated;

-- Retirer une policy trop permissive
DROP POLICY "<nom exact>" ON public.<table>;
```

**Toute correction faite ainsi doit être immédiatement reportée dans un
fichier de migration commité sous `supabase/migrations/`.** L'absence de
migration a déjà produit un incident de sécurité non tracé le 18/08/2026 :
la base et le dépôt divergent, et personne ne sait plus quel est l'état
réel. Vérifier ensuite que la version figure bien dans le suivi :

```sql
SELECT version, name FROM supabase_migrations.schema_migrations
ORDER BY version DESC LIMIT 10;
```

### 3.3 Revenir à un déploiement antérieur — deux minutes

Si l'incident vient d'un déploiement :

```bash
npx vercel ls                    # repérer le dernier déploiement sain
npx vercel rollback <url>        # bascule le domaine dessus
```

Le retour arrière ne touche pas la base. Si la migration fautive a déjà été
appliquée, le code ancien tournera contre un schéma nouveau — vérifier la
compatibilité avant de basculer.

---

## 4. Restaurer depuis les sauvegardes

Le dispositif existe et tourne : `.github/workflows/backup.yml`, tous les
jours à 5 h UTC, base et Storage, chiffré par clé publique, déposé sur Google
Drive, environ 30 sauvegardes conservées. La procédure détaillée est dans
`docs/sauvegarde-restauration.md` — ce qui suit en est le résumé
opérationnel.

**Prérequis, à vérifier AVANT d'en avoir besoin** : la clé privée de
déchiffrement n'est pas dans le dépôt. Sans elle, aucune sauvegarde n'est
exploitable. Vérifier aussi que les exécutions récentes du workflow sont
vertes dans l'onglet Actions — un dispositif rouge depuis des semaines n'est
pas un filet.

```bash
# 1. Lister les sauvegardes disponibles
node scripts/backup/download-from-drive.js --list

# 2. Récupérer celle qui précède l'incident
node scripts/backup/download-from-drive.js <nom-du-fichier>

# 3. D'ABORD restaurer dans un schéma isolé et vérifier le contenu
node scripts/backup/restore-database.js <fichier> --schema=verification_incident

# 4. Seulement ensuite, restaurer pour de vrai
node scripts/backup/restore-database.js <fichier> --schema=public
```

**Ne jamais passer directement à l'étape 4.** L'étape 3 restaure dans un
schéma séparé sans toucher aux données réelles : c'est le seul moyen de
vérifier qu'une sauvegarde est saine avant de s'appuyer dessus. Le Storage
tourne à blanc tant que `--restore-storage` n'est pas passé explicitement.

La restauration en `public` procède par `INSERT ... ON CONFLICT DO NOTHING` :
elle **complète** les tables existantes, elle ne les remplace pas. Les
données écrites depuis la sauvegarde survivent — y compris celles écrites par
un attaquant. Si l'objectif est d'effacer une modification malveillante, il
faut la supprimer explicitement, la restauration ne le fera pas.

---

## 5. Après l'incident

1. **Écrire un fichier `docs/incident-AAAA-MM-JJ.md`** — ce qui s'est passé,
   comment on l'a su, ce qui a été fait, ce qui a manqué. Le dépôt en compte
   déjà (`incident-2026-08-06.md`) : ils servent de mémoire.
2. **Ajouter un invariant** si la faille appartient à une classe que
   `tests/security/invariants.spec.js` aurait pu détecter. C'est la seule
   défense contre la réapparition du même défaut sous une autre forme.
3. **Vérifier que la correction est dans une migration commitée**, pas
   seulement appliquée à chaud.
4. **Relancer la chaîne complète** avant de considérer l'incident clos :

```bash
npx playwright test tests/security/invariants.spec.js   # les 13 invariants
npm run build                                            # prebuild + build réel
```

Les deux, pas l'un ou l'autre : les invariants Playwright et
`scripts/check-invariants.mjs` (lancé par le `prebuild`) ne vérifient pas les
mêmes choses, et ESLint ne vérifie ni la résolution des modules ni les règles
d'architecture.

---

## 6. Ce qui manque encore, à savoir avant d'en avoir besoin

Ces points sont ouverts au 29/08/2026. Ils ne bloquent pas l'application au
quotidien, mais ils pèseront le jour d'un incident.

- **Aucun support prioritaire** chez Vercel ni Supabase (plans Hobby et
  gratuit). Toute réponse dépend de nous seuls.
- **Pas de page publique de suppression de compte** — exigée par Google Play,
  et utile pour répondre vite à une demande d'effacement.
- **La politique de confidentialité ne nomme aucun sous-traitant**, alors que
  onze services reçoivent des données. En cas de notification d'incident, il
  faudra pouvoir dire précisément qui détenait quoi.

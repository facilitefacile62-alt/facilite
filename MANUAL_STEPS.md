# Actions manuelles à effectuer — sécurisation du 28/07/2026

Tout ce qui pouvait être corrigé dans le code l'a été et est poussé sur `main`.
Les actions ci-dessous ne peuvent PAS être automatisées : elles nécessitent vos
accès aux dashboards. Elles sont classées par ordre d'urgence.

---

## 🔴 URGENT — à faire en premier

### 1. ✅ FAIT — Migration de durcissement appliquée

`20260728180000_durcissement_securite_rls_storage.sql` a été exécutée sur
Supabase. Les deux failles critiques sont fermées : le bucket `resumes` est
privé, et la policy `resumes` ne comporte plus `OR user_id IS NULL`.

### 1 bis. Appliquer les deux migrations restantes

Dans le [SQL Editor Supabase](https://supabase.com/dashboard/project/ocfhzwwjvljintabxxlg/sql/new),
**dans cet ordre** :

1. `supabase/migrations/20260728190000_messages_receiver_id.sql`
   — rend l'historique de migrations rejouable.
2. `supabase/migrations/20260728200000_vue_profils_publics.sql`
   — crée la vue `profils_publics`. **Sans elle, la page `/in/[slug]` renvoie
   une erreur**, puisque le code interroge désormais une vue inexistante.

Après application, chaque utilisateur devra activer lui-même son profil public
depuis **Profil → Confidentialité** (`is_public` vaut `false` par défaut :
personne n'est publié sans l'avoir demandé).

### 2. Corriger le Client ID Google dans Supabase

⚠️ Le Client ID actuellement enregistré dans Supabase est **erroné** : il contient
un `s` en trop (erreur de recopie lors de la configuration). La connexion Google
ne peut pas fonctionner en l'état.

1. Allez sur [Auth → Providers → Google](https://supabase.com/dashboard/project/ocfhzwwjvljintabxxlg/auth/providers).
2. Dans **Client IDs**, remplacez la valeur par exactement :
   ```
   289163120801-4i03d6irsmqbnrgd7tu98k46jnn1ae9m.apps.googleusercontent.com
   ```
   (la valeur actuelle contient `...jnn1aes9m...` — il faut `...jnn1ae9m...`, sans le `s`)
3. Cliquez sur **Save**.

### 3. Révoquer et remplacer le Client Secret Google

Le secret actuel a circulé en clair (conversation + fichier JSON dans le dossier
du projet). Il doit être considéré comme compromis, par principe.

1. Dans [Google Cloud Console → Identifiants](https://console.cloud.google.com/apis/credentials?project=facilite-web),
   ouvrez le client **Facilite Web Client**.
2. Cliquez sur **+ Add secret** pour en générer un nouveau.
3. Copiez ce nouveau secret et collez-le dans Supabase → Auth → Providers → Google
   → champ **Client Secret** → **Save**.
4. Vérifiez que la connexion Google fonctionne sur https://ffacilite.com/login.
5. **Seulement une fois que ça marche**, revenez dans Google Cloud et supprimez
   l'ancien secret (les deux peuvent coexister le temps de la bascule).

---

## 🟠 IMPORTANT — dans la foulée

### 4. Vérifier les URI de redirection Google Cloud

Dans [Google Cloud Console → Identifiants](https://console.cloud.google.com/apis/credentials?project=facilite-web)
→ **Facilite Web Client** :

- **Origines JavaScript autorisées** doit contenir :
  - `https://ffacilite.com`
- **URI de redirection autorisés** doit contenir :
  - `https://ocfhzwwjvljintabxxlg.supabase.co/auth/v1/callback` *(déjà ajouté)*

### 5. Vérifier les variables d'environnement sur Vercel

Le code échoue désormais volontairement au démarrage si une variable est
manquante (au lieu de retomber silencieusement sur la base de production).
Dans **Vercel → Settings → Environment Variables**, vérifiez la présence de :

| Variable | Rôle |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **Obligatoire** — l'app ne démarre pas sans |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Obligatoire** — l'app ne démarre pas sans |
| `GROQ_API_KEY` | Assistant IA et analyse de CV |
| `GEMINI_API_KEY` | Analyse d'images / OCR |
| `DEEPSEEK_API_KEY` | Secours si les deux autres échouent |

Puis relancez un déploiement.

### 6. Auditer les tables créées hors migrations

C'est l'angle mort que l'audit du dépôt ne peut pas couvrir : des tables ont
déjà été créées directement dans l'éditeur SQL par le passé, avec des policies
défaillantes (c'est documenté dans la migration `20260727090000`).

Exécutez ceci dans le SQL Editor et vérifiez que **chaque** ligne affiche `true` :

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

Puis vérifiez que chaque table possède bien des policies :

```sql
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;
```

Une table avec `rowsecurity = true` mais **aucune** policy renvoie
silencieusement des résultats vides — ça ressemble à un bug, pas à un problème
de sécurité, et c'est le piège le plus courant.

---

## 🟡 RECOMMANDÉ — quand vous aurez le temps

### 7. Durcir les quotas d'authentification Supabase

Dans [Auth → Rate Limits](https://supabase.com/dashboard/project/ocfhzwwjvljintabxxlg/auth/rate-limits),
abaissez les quotas par défaut (connexion, inscription, renvoi d'e-mail) pour
limiter le credential stuffing lent.

### 8. Passer le rate limiting des routes IA sur Upstash Redis

Le rate limiting actuellement en place (`src/lib/apiAuth.js`) est **en mémoire** :
il se réinitialise à chaque déploiement et n'est pas partagé entre les instances
serverless de Vercel. C'est un garde-fou utile contre l'abus basique, pas une
défense solide. Pour un quota réellement distribué : créer une base
[Upstash Redis](https://upstash.com/) (offre gratuite suffisante), puis
`npm i @upstash/ratelimit @upstash/redis` et remplacer `checkRateLimit`.

---

## ℹ️ Changements de comportement à connaître

Ces évolutions sont **volontaires** et découlent des correctifs de sécurité :

1. **Le diagnostic de CV et l'assistant IA exigent désormais une connexion.**
   Les routes API étaient totalement ouvertes : n'importe qui pouvait consommer
   vos crédits Groq/Gemini/DeepSeek avec une simple boucle `curl`. Si le
   diagnostic doit rester accessible aux visiteurs anonymes, il faudra un autre
   garde-fou (CAPTCHA + quota par IP) — dites-le-moi.

2. **Le CV n'est plus téléchargeable depuis les profils publics** (`/in/...`).
   Un CV contient nom, adresse, téléphone et date de naissance : l'exposer à
   tout visiteur anonyme était la faille la plus lourde côté RGPD.

3. **Les CV déjà envoyés avant cette migration** ont un chemin de stockage à
   l'ancien format (`cvs/{uid}_{timestamp}`) et ne seront plus lisibles, car les
   policies attendent désormais `{uid}/cvs/...`. Les URL publiques déjà stockées
   en base continueront de s'afficher tant qu'elles sont des `http...`
   (la fonction `getSignedCvUrl` les laisse passer telles quelles), mais elles
   cesseront de fonctionner une fois le bucket passé en privé. Prévoyez de
   redemander l'envoi du CV aux utilisateurs concernés, ou signalez-le-moi pour
   écrire un script de migration des chemins.

4. **Les candidatures anonymes ne sont plus possibles** : le dépôt exige une
   session. Si c'était un usage voulu, c'est réversible (voir le commentaire
   dans la migration).

# Réglages Supabase qui n'existent que dans le tableau de bord

L'export de la base (`scripts/export-production`) ne contient **pas** ces réglages : ils ne sont ni dans les tables, ni dans les migrations. À noter à la main avant de repasser en gratuit, pour pouvoir tout reconfigurer en cas de besoin.

**Règle : aucune valeur secrète dans ce document ni dans un fichier en clair.** On note le *nom* du réglage, son *état* (activé / désactivé) et les valeurs **non secrètes** (adresses, noms, ports). Les secrets restent dans leur coffre d'origine (indiqué en face de chacun) ou dans votre gestionnaire de mots de passe.

Menus : ceux du tableau de bord Supabase (barre de gauche, puis onglets). L'intitulé exact peut varier légèrement d'une version de l'interface à l'autre.

## 1. Authentification (menu **Authentication**)

| Réglage | Chemin dans le menu | À noter (non secret) | Où est le secret |
|---|---|---|---|
| **Connexion Google** | Authentication → Sign In / Providers → Google | Activé oui/non ; identifiant client (Client ID) ; options cochées (par exemple « Skip nonce checks ») ; l'adresse de rappel (Callback URL) affichée, qui doit rester déclarée côté Google | Le **Client Secret** : jamais ici. Il est dans Google Cloud Console → APIs & Services → Credentials |
| **URL de redirection** | Authentication → URL Configuration | **Site URL** ; liste complète des **Redirect URLs**, dont `facilite://auth/callback` (schéma de l'application mobile `facilite`). À vérifier : aucune adresse `exp://` ne doit rester (elles servaient aux essais Expo Go) | Aucun |
| **Modèles d'e-mails** | Authentication → Emails → Templates | Pour chacun des modèles (Confirm sign up, Invite user, Magic link, Change email address, Reset password, Reauthentication) : **objet** et **corps HTML**, à copier dans un fichier texte. Le dossier `supabase/templates/` du dépôt n'en contient que 3 (confirmation, changement d'e-mail, récupération) et ne prouve pas ce qui est en ligne | Aucun |
| **SMTP (envoi d'e-mails)** | Authentication → Emails → SMTP Settings | Activé oui/non ; hôte ; port ; nom d'utilisateur ; nom et adresse de l'expéditeur. Le dépôt utilise Resend pour d'autres envois : à confirmer si c'est le même fournisseur | Le **mot de passe SMTP / clé API** : dans le compte du fournisseur (Resend), jamais ici |
| **Hook « Send SMS »** | Authentication → Auth Hooks → Send SMS | Activé oui/non ; type (HTTPS) ; adresse du hook (voir `docs/activation-sms-hook-orange.md`, `https://ffacilite.com/api/auth/send-sms-hook`) | Le **secret du hook** (il commence par `v1,whsec_`) : copié dans la variable `SEND_SMS_HOOK_SECRET` de Vercel (Settings → Environment Variables). S'il se perd, on en génère un nouveau dans le hook et on met Vercel à jour |
| **Connexion par e-mail** | Authentication → Sign In / Providers → Email | « Confirm email » ; « Secure email change » ; longueur minimale et exigences du mot de passe ; durée de validité des liens | Aucun |
| **Connexion par téléphone** | Authentication → Sign In / Providers → Phone | Activé oui/non ; fournisseur choisi ; « Enable phone confirmations » ; longueur et durée du code | Les identifiants du fournisseur SMS (Twilio / Orange) : dans leurs comptes |
| **Limites de débit** | Authentication → Rate Limits | Chaque limite (e-mails, SMS, vérifications, connexions) | Aucun |
| **Sessions** | Authentication → Sessions | Durée maximale, inactivité (selon le plan) | Aucun |
| **Protection contre les abus** | Authentication → Attack Protection | CAPTCHA activé oui/non ; protection des mots de passe divulgués (selon le plan) | La clé secrète du CAPTCHA : chez le fournisseur |
| **Inscriptions** | Authentication → Sign In / Providers (en tête de page) | « Allow new users to sign up » ; « Allow manual linking » ; connexions anonymes | Aucun |
| **Autres hooks** | Authentication → Auth Hooks | Pour chaque hook (par exemple « Customize Access Token ») : activé oui/non, fonction ou adresse | Secret du hook : dans son propre coffre |

## 2. Fonctions et secrets

| Réglage | Chemin dans le menu | À noter (non secret) | Où est le secret |
|---|---|---|---|
| **Secrets des fonctions Edge** | Edge Functions → Secrets | **Les noms** des secrets seulement. La fonction du dépôt `gemini-orchestrator` lit `GEMINI_API_KEY`. Supabase fournit lui-même `SUPABASE_URL` et les clés du projet aux fonctions | Les **valeurs** : dans Google AI Studio (clé Gemini) et dans votre gestionnaire de mots de passe |
| **Fonctions Edge déployées** | Edge Functions → liste | Nom de chaque fonction et réglage « Verify JWT ». Le code est dans `supabase/functions/` ; le déploiement, lui, se fait hors dépôt | Aucun |
| **Coffre (Vault)** | Database → Vault | Mesuré le 29/10/2026 : **0 secret**, rien à noter | — |

## 3. Projet, accès et base (hors schémas exportés)

| Réglage | Chemin dans le menu | À noter (non secret) | Où est le secret |
|---|---|---|---|
| **Clés d'API** | Project Settings → API Keys | Les *noms* et types de clés (publique / secrète). Elles ne changent pas au passage en gratuit | Les valeurs : Vercel, `.env.local`, gestionnaire de mots de passe. **Ne jamais les écrire dans un fichier en clair** |
| **Clés de signature des jetons (JWT)** | Project Settings → JWT Keys | Type de clé et état de rotation seulement | Le secret JWT : ne pas le copier |
| **Mot de passe de la base** | Project Settings → Database | Date de la dernière réinitialisation seulement | Le mot de passe lui-même : gestionnaire de mots de passe. Le changer casse le secret GitHub `SUPABASE_DB_URL` et les variables de `.env.local` |
| **Rôles de base personnalisés** | Database → Roles | Liste des rôles ajoutés (hors rôles Supabase). `pg_dump` ne les exporte pas | Leurs mots de passe |
| **Pooler de connexions** | Project Settings → Database → Connection pooling | Mode et taille du pool | Aucun |
| **Restrictions réseau, SSL** | Project Settings → Database → Network Restrictions / SSL Configuration | Plages d'adresses autorisées ; « Enforce SSL » | Aucun |
| **API de données** | Project Settings → Data API | Schémas exposés ; nombre maximal de lignes ; chemin de recherche supplémentaire | Aucun |
| **Stockage** | Storage → Settings | Taille maximale de fichier (le gratuit est limité à 50 Mo) ; les réglages de chaque bucket sont déjà dans `metadonnees.json` de l'export | Aucun |
| **Temps réel** | Realtime → Settings | Limites, accès public aux canaux. Les tables publiées sont déjà dans `metadonnees.json` | Aucun |
| **Options payantes actives** | Project Settings → Add-ons | Lesquelles sont actives (domaine personnalisé, sauvegarde point-in-time, calcul supplémentaire…). **Elles sont perdues au passage en gratuit** | Aucun |
| **Équipe et accès** | Organization → Team | Membres et rôles | Aucun |
| **Intégrations** | Project Settings → Integrations | Vercel, GitHub : état et dépôts liés | Les jetons : chez Vercel / GitHub |

## 4. Hors Supabase mais liés (à noter aussi)

- **Google Cloud Console** → APIs & Services → Credentials → client OAuth : « Authorized redirect URIs » (doit contenir l'adresse de rappel Supabase) et « Authorized JavaScript origins ».
- **Vercel** → Settings → Environment Variables : la *liste des noms* (jamais les valeurs), en particulier `SEND_SMS_HOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`.
- **GitHub** → Settings → Secrets and variables → Actions : la *liste des noms*, dont `SUPABASE_DB_URL`.
- **Fournisseurs SMS et e-mails** (Twilio, Orange Developer, Resend) : identifiants conservés dans leurs comptes.

## Comment procéder

1. Ouvrir chaque ligne du tableau, dans l'ordre, et copier ce qui est demandé dans un fichier texte **hors du dépôt** (par exemple à côté de l'archive chiffrée).
2. Pour les modèles d'e-mails : copier le HTML complet de chacun.
3. Cocher ici, sur votre copie, chaque ligne faite. Ne rien coller dans le dépôt ni dans une conversation.
4. Ranger ce fichier texte avec l'archive chiffrée, ou le chiffrer avec `scripts/export-production/chiffrement.mjs` (même phrase secrète).

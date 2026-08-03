# Brancher Resend comme SMTP pour Supabase Auth

Ce document couvre uniquement les emails **envoyés par Supabase Auth**
(confirmation d'inscription, réinitialisation de mot de passe, changement
d'adresse) — un système entièrement séparé des emails que l'application
envoie déjà elle-même via Resend (factures, rappels, notifications CV —
`src/lib/notifications.js`). Les deux utilisent Resend, mais par deux
chemins différents : l'appli appelle l'API Resend directement, Supabase Auth
appellera son propre serveur SMTP.

**Bonne nouvelle** : le domaine `ffacilite.com` est déjà vérifié auprès de
Resend (il sert déjà à `facturation@ffacilite.com` pour les factures) — pas
besoin de revérifier SPF/DKIM/DMARC pour ce domaine, seulement pour un
sous-domaine ou une adresse d'expédition différente si tu en choisis une.

## 1. Créer une clé API Resend dédiée (recommandé)

Une clé API séparée de celle déjà utilisée par l'application (`RESEND_API_KEY`)
permet de révoquer l'accès SMTP de Supabase indépendamment si besoin, sans
casser l'envoi des factures.

Resend → API Keys → Create API Key → nom explicite (ex. `supabase-auth-smtp`)
→ permission "Sending access" suffit.

## 2. Configurer le SMTP dans le Dashboard Supabase

**Authentication → Emails → SMTP Settings** (Dashboard, pas la CLI — voir
la note en bas de ce document sur pourquoi ne pas utiliser `supabase config
push` ici) :

| Champ | Valeur |
|---|---|
| Enable Custom SMTP | activé |
| Sender email | `auth@ffacilite.com` (ou une autre adresse sur `ffacilite.com` — évite `no-reply@` si tu veux pouvoir recevoir les réponses des utilisateurs perdus) |
| Sender name | `Facilite` |
| Host | `smtp.resend.com` |
| Port | `465` (SSL) ou `587` (STARTTLS) — les deux fonctionnent, `465` est le plus simple à ne pas bloquer par un pare-feu réseau |
| Username | `resend` (littéralement le mot "resend", pas ton adresse) |
| Password | la clé API créée à l'étape 1 (commence par `re_`) |

## 3. Vérification DNS (si `ffacilite.com` n'est pas déjà 100% vérifié)

Resend → Domains → `ffacilite.com` → vérifier que les 3 statuts sont verts :
- **SPF** (`TXT` sur le domaine racine ou `send`, autorise Resend à envoyer en son nom)
- **DKIM** (`TXT`, signature cryptographique des emails — invisible à l'œil, essentiel pour éviter le dossier spam)
- **DMARC** (`TXT` sur `_dmarc.ffacilite.com`, politique appliquée en cas d'échec SPF/DKIM)

Si l'un des trois est rouge, Resend affiche l'enregistrement DNS exact à
ajouter chez ton registrar/hébergeur DNS — copier-coller tel quel, aucune
valeur à deviner.

## 4. Modèles d'e-mail (français)

Fichiers déjà rédigés dans ce dépôt, prêts à copier-coller dans
**Authentication → Emails → Templates** du Dashboard (un onglet par type) :

| Type Supabase | Fichier |
|---|---|
| Confirm signup | `supabase/templates/confirm_signup.html` |
| Reset Password | `supabase/templates/recovery.html` |
| Change Email Address | `supabase/templates/email_change.html` |

Chacun utilise `{{ .ConfirmationURL }}`, la variable native de Supabase —
ne pas la renommer, c'est elle qui insère le vrai lien signé.

## 5. Pourquoi pas `supabase config push` pour tout faire d'un coup

`supabase/config.toml` local contient des valeurs de développement pur
(`site_url = "http://127.0.0.1:3000"`, `additional_redirect_urls` pointant
sur `127.0.0.1`) — un `config push` enverrait ces valeurs de test vers le
projet de PRODUCTION et casserait les redirections réelles du site. Tant
que ce fichier n'est pas nettoyé pour refléter l'environnement de
production, toute modification de configuration Auth doit passer par le
Dashboard, pas par la CLI.

## 6. Vérification après configuration

Une fois les étapes 1-4 faites : je testerai un vrai parcours d'inscription
de bout en bout (Étape 2, point 4 du chantier) — c'est la seule preuve qui
compte, pas une simple lecture de la configuration.

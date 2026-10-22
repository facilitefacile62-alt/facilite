# Application iPhone — build et envoi sur TestFlight (EAS)

Ce guide ne contient AUCUN secret. Le dépôt est public : le fichier `.p8`, le Key ID, l'Issuer ID et tout mot de passe se saisissent
dans VOTRE terminal, jamais dans un fichier du dépôt. Rien ci-dessous ne se lance tout seul : chaque commande est tapée à la main.

## 0. Ce qui est préparé dans le dépôt

- `app.json` : `bundleIdentifier` `com.ffacilite.mobile` (le même que le package Android), iPad pris en charge, textes d'autorisation
  (appareil photo, photos, micro, position), `ITSAppUsesNonExemptEncryption: false`, icône iOS `assets/images/icon-ios.png`
  (1024 × 1024, sans canal alpha).
- `eas.json` : `appVersionSource: remote` ; profils `testflight` (distribution « store », variables d'environnement EAS « preview »)
  et `production` (variables « production »), tous deux avec `autoIncrement` (le numéro de build augmente seul) ; section `submit`
  vide (aucun secret).
- `.gitignore` (racine et `mobile/`) : `*.p8`, `AuthKey_*`, `*.p12`, `*.mobileprovision`.

## 1. Authentification Apple : ce que la documentation d'Expo dit aujourd'hui

| Besoin | Méthode | Ce qu'il faut |
|---|---|---|
| **Envoyer** un build sur TestFlight (`eas submit`) | **Clé API App Store Connect** (recommandée par Expo) | Votre clé (rôle « Gestionnaire d'apps » suffit) : fichier `.p8`, Key ID, Issuer ID |
| **Créer** certificat de distribution + profil de provisionnement + identifiant d'app (1er build) | Connexion **identifiant Apple + code de validation** dans `eas build` (assistant interactif) | Votre identifiant Apple, mot de passe, code envoyé sur vos appareils Apple/SMS |
| **Réparer** les identifiants Apple sans personne (CI) | Variables `EXPO_ASC_API_KEY_PATH`, `EXPO_ASC_KEY_ID`, `EXPO_ASC_ISSUER_ID` (+ `EXPO_APPLE_TEAM_ID`, `EXPO_APPLE_TEAM_TYPE`) | Une clé de niveau **Admin** ; documenté pour la maintenance, pas pour le tout premier build |

Conséquence honnête : votre clé « Gestionnaire d'apps » sert à ENVOYER sur TestFlight sans identifiant ni SMS. Pour le TOUT PREMIER
build, Expo prévoit de se connecter une fois avec l'identifiant Apple (code de validation inclus) afin de créer le certificat et le
profil ; EAS les garde ensuite chez lui, et les builds suivants n'ont plus besoin de vous. La documentation ne dit pas qu'une clé
API suffit à créer ces identifiants au premier build ; ne comptez pas dessus. Sur un compte « Individuel », seul le titulaire du
compte peut créer ces identifiants.

## 2. À faire à la main dans App Store Connect (l'API ne le fait pas à votre place)

Sur appstoreconnect.apple.com, « Apps » puis **+** puis **Nouvelle app** :

1. Plateforme : **iOS**.
2. Nom : `Facilité` (ou une variante si le nom est déjà pris : le nom est unique dans tout l'App Store).
3. Langue principale : **Français**.
4. Identifiant (Bundle ID) : `com.ffacilite.mobile`. S'il n'est pas dans la liste, il se crée automatiquement au premier
   `eas build` (étape 4), ou à la main sur developer.apple.com, « Certificates, Identifiers & Profiles », « Identifiers ».
   Un identifiant est unique dans le monde : s'il est déjà pris, choisissez une variante (par exemple `com.ffacilite.app`) et
   changez-la à la fois dans `app.json` (`ios.bundleIdentifier`) et ici.
5. SKU : une référence interne libre, par exemple `ffacilite-ios-1`.
6. Ensuite, dans la fiche : description, mots-clés, captures d'écran, URL de la politique de confidentialité
   (`https://ffacilite.com/politique-de-confidentialite`), catégorie, tranche d'âge, compte de démonstration pour le relecteur.
   Rien de tout cela ne se fait par l'API d'EAS.
7. Notez le **Apple ID de l'app** (nombre à 10 chiffres, « Informations sur l'app », « Informations générales ») : c'est `ascAppId`.
   Il n'est pas secret, mais on le saisit dans l'assistant (étape 6), pas besoin de l'écrire dans le dépôt.

## 3. Variables d'environnement EAS (jamais en dur dans le dépôt)

Une seule fois, depuis `mobile/` (les valeurs sont dans votre `mobile/.env` local ; l'adresse et la clé publique de Supabase sont
visibles dans toute application, mais on les garde hors des fichiers commités) :

```powershell
cd C:\Users\gta\Downloads\monprojetfacilite\mobile
eas login
eas env:create --environment preview --name EXPO_PUBLIC_SUPABASE_URL --visibility plaintext
eas env:create --environment preview --name EXPO_PUBLIC_SUPABASE_ANON_KEY --visibility plaintext
eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --visibility plaintext
eas env:create --environment production --name EXPO_PUBLIC_SUPABASE_ANON_KEY --visibility plaintext
```

Chaque commande demande la valeur : collez-la vous-même. Ne mettez jamais ici une clé secrète : tout ce qui commence par
`EXPO_PUBLIC_` est lisible dans l'application installée.

## 4. Premier build iOS (consomme un build de votre quota Expo) — seulement quand vous direz « go »

```powershell
cd C:\Users\gta\Downloads\monprojetfacilite\mobile
eas build --platform ios --profile testflight
```

L'assistant demande, DANS VOTRE TERMINAL :
- « Log in to your Apple Developer account » : votre identifiant Apple, votre mot de passe, puis le code de validation reçu sur
  vos appareils Apple ou par SMS. Choisissez votre équipe.
- « Generate a new Apple Distribution Certificate ? » : **oui**. « Generate a new provisioning profile ? » : **oui**.
- Si l'identifiant d'app n'existe pas encore : il est créé pour vous.

## 5. Lier votre clé API pour l'envoi (une seule fois)

```powershell
eas credentials --platform ios
```

Choisissez le profil `testflight`, connectez-vous si demandé, puis « App Store Connect : Manage your API Key » et « Set up your
project to use an API Key for EAS Submit ». L'assistant demande le chemin du fichier `.p8`, le Key ID et l'Issuer ID : saisissez-les
vous-même. EAS stocke la clé chiffrée chez lui ; rien n'est écrit dans le dépôt.

## 6. Envoyer sur TestFlight — seulement quand vous direz « go »

```powershell
eas submit --platform ios --profile testflight --latest
```

La première fois, l'assistant demande l'Apple ID de l'app (`ascAppId`, étape 2.7). Le build apparaît dans TestFlight après 10 à
15 minutes de traitement par Apple. Ajoutez-vous ensuite comme testeur interne dans App Store Connect, « TestFlight ».

## 7. Points qu'Apple examine avant de publier (risques à traiter avant la soumission à l'App Store)

- **Connexion avec Google** : si l'application propose une connexion avec un service tiers, Apple demande une option équivalente
  qui limite les données collectées (par exemple « Se connecter avec Apple »).
- **Suppression de compte** : obligatoire et doit pouvoir se lancer depuis l'application. L'application renvoie aujourd'hui vers la page du site (`mobile/src/lib/webEcrans.ts`) : à vérifier que ce parcours est simple et fonctionne depuis l'iPhone avant de soumettre.
- **Paiements** : l'achat de contenus numériques dans l'application (jetons, crédits) doit en principe passer par l'achat intégré
  d'Apple ; Orange Money pour des services numériques peut être refusé. À trancher avant de soumettre.
- **Notifications push** : l'application n'utilise pas `expo-notifications`, il n'y a donc rien à configurer côté Apple pour le moment.
- **Textes d'autorisation** : déjà en français dans `app.json` ; ils doivent rester fidèles à l'usage réel.

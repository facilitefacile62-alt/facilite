# Facilité mobile (Expo SDK 57, React Native 0.86, nouvelle architecture)

@AGENTS.md

Les règles permanentes de `../CLAUDE.md` s'appliquent aussi ici : 13 invariants verts, résultat brut avant toute correction, un point = un commit + push séparé, jamais `supabase db push`, toute modification de base = migration commitée, jamais de commit de `.claude/`.

## Règles propres à ce dossier

- **Jamais la valeur d'un secret** (clé, jeton, contenu de `.env`, `eas.json`, configuration d'un serveur MCP) dans une réponse, un log, un commit ou ce fichier : seulement leurs **noms**.
- **Tests Playwright sur localhost uniquement.** Aucune requête répétée vers ffacilite.com (les 403 de Vercel venaient de là). Sur la production, seuls les 13 invariants tournent, une fois après chaque déploiement.
- Le client Supabase mobile n'utilise que la clé **anon**, jamais `service_role`. La protection des données repose sur RLS.

## Lancer l'app (scan Expo Go)

Dans **votre propre terminal** (pour voir le QR code), dans `mobile/` (pas `mobile/mobile`) :

```
cd C:\Users\gta\Downloads\monprojetfacilite\mobile
npx expo start -c
```

1. Téléphone et PC sur le même Wi-Fi.
2. Ouvrir Expo Go et scanner le QR code avec **son scanner intégré**.
3. Si le scan échoue : « Enter URL manually » avec `exp://<IP du PC>:8081` (IP : `Get-NetIPConfiguration`).
4. Fast Refresh : une modification du code apparaît sur le téléphone en 1 à 2 secondes, sans rien recompiler. Touches du terminal Metro : `r` recharger, `m` menu développeur. Les erreurs s'affichent dans ce terminal.

Variables d'environnement : `mobile/.env` (noms seulement : `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`), ignoré par git. Expo l'annonce au démarrage (`env: load .env`).

## Architecture

- **Expo Router** dans `src/app` : groupes `(auth)` (login, register, forgot-password, verifiez-votre-email) et `(tabs)` (accueil, offres, extracteur, messages, profil), plus `offre/[id]`, `chat/[id]`, `recherche`, `entreprise/[slug]`, `candidature-spontanee`, `fonctionnalites`, `mon-profil/*`, `web/[cle]` (WebView).
- `src/app/_layout.tsx` : `AuthProvider` puis `AuthGate` (redirige entre `(auth)` et le reste selon la session), splash animé (`components/animated-icon.tsx`).
- `src/context/AuthContext.tsx` : session, profil, rôle, cache AsyncStorage. `src/lib/supabase.ts` : client unique, **lève une erreur dès l'import si les deux variables manquent**.
- Style : NativeWind (`nativewind/babel`), alias `@/` = `src/`.
- Modules natifs réellement utilisés : reanimated + worklets (splash), svg, webview, image-picker, document-picker, clipboard, auth-session, web-browser. Absents : cartes, stockage sécurisé, notifications.

## Données Supabase

Tables lues ou écrites par l'app : `profiles`, `user_roles`, `job_offers`, `conversations`, `messages`, `resumes`, `candidatures`. Toute évolution de schéma passe par une migration commitée dans `../supabase/migrations`.

## Écrans

- **Construits** : les 4 écrans d'authentification, les 5 onglets, fiche offre, chat, recherche, fiche entreprise, sous-écrans du profil, scanner de document.
- **Encore en « bientôt disponible »** : liste à jour avec `grep -rnE "BIENTOT\(|Bientôt disponible" src` (messages, profil, candidature spontanée, `fonctionnalites`, `mon-profil/a-propos`, `PanneauMenuProfil`).

## Build

- `android/` est **généré** (prebuild) et ignoré par git : EAS le régénère, les modifications locales n'y comptent pas.
- Profil EAS unique : `preview` (APK). Les deux variables `EXPO_PUBLIC_*` sont déclarées dans le bloc `env` de ce profil.
- `expo-doctor` doit rester à 21/21.

## Contrôles avant commit

`npx tsc --noEmit`, `npx expo lint`, `npx expo-doctor` côté `mobile/` ; côté site (si `src/` est touché) : `npm run build` et les 13 invariants (`npx playwright test tests/security/invariants.spec.js`).

## Build EAS : toujours `--clear-cache` après un changement des variables d'environnement

Résolu le 22/09/2026 (diagnostic par `adb logcat` sur un appareil réel — voir
« Bugs connus » ci-dessous pour l'historique). Un APK compilé via
`eas build --platform android --profile preview` plantait au lancement avec
`EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY manquantes` alors
que ces deux variables étaient bien déclarées, à la fois dans `eas.json`
(`build.preview.env`) et dans l'environnement EAS `preview` (tableau de
bord) — les logs du build confirmaient même les avoir chargées. Cause réelle :
EAS réutilisait un artefact JS compilé lors d'un build antérieur (fait avant
que les variables ne soient correctement configurées), sans le
recompiler — la commande a réussi, le fichier produit était juste périmé.
`eas build --platform android --profile preview --clear-cache` a résolu le
problème (confirmé : `adb logcat -b crash` vide, l'app s'affiche). **Toujours
ajouter `--clear-cache` au premier build suivant une modification des
variables `EXPO_PUBLIC_*`** (`eas.json` ou tableau de bord EAS), sans quoi le
prochain artefact peut de nouveau être réutilisé tel quel.

## Bugs connus (historique — plantage résolu ci-dessus, gardé pour référence)

- Avant résolution, hypothèse écartée : l'APK installé aurait pu être antérieur au commit `9c59063` (20/09/2026 23:32 : ajout des plugins `expo-image` et `expo-web-browser`, dépendances Expo remontées) — vérifiée fausse par `adb shell dumpsys package com.ffacilite.mobile` (date d'installation postérieure au commit en cause). Le test Expo Go prouvait que le JavaScript de l'app tournait ; il ne prouvait rien sur le binaire release — c'est `adb logcat -b crash` sur un appareil réel qui a donné la vraie cause.
- `src/components/FaciliteSnapMap.tsx` : fichier orphelin (importe `react-native-maps`, non installé, jamais importé) ; c'est la seule source des 3 erreurs de `npx tsc --noEmit`.
- `AuthContext.tsx` : `supabase.auth.getSession()` sans `.catch` au démarrage.
- Le splash animé (`components/animated-icon.tsx`) utilise encore `assets/images/expo-logo.png`, le logo du gabarit Expo.

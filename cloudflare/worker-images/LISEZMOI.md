# Worker « facilite-images » : guide de création (tableau de bord, sans wrangler)

Ce Worker sert les images publiques du site (`job-offers`, `marketplace-photos`, `stories-media`) depuis le bucket R2 `facilite-images`. Il n'a **aucun secret** et n'a besoin d'**aucune variable d'environnement** : seulement une liaison R2.

## 1. Copier le code
Dans PowerShell :
```powershell
Get-Content C:\Users\gta\Downloads\wt-site-r2\cloudflare\worker-images\index.js -Raw | Set-Clipboard
```
Le code du Worker est maintenant dans le presse-papiers.

## 2. Créer le Worker
1. `dash.cloudflare.com` → **Workers & Pages** → **Create** (ou « Create application ») → **Create Worker** (modèle « Hello World »).
2. **Name :** `facilite-images`. Cliquez sur **Deploy**.
3. Si Cloudflare demande de choisir votre sous-domaine `workers.dev`, tapez `ffacilite`.

## 3. Coller le code
1. Sur la page du Worker, cliquez sur **Edit code**.
2. Dans l'éditeur : **Ctrl+A** (tout sélectionner), **Ctrl+V** (coller le code), puis **Deploy** en haut à droite.

## 4. Brancher le bucket R2
1. Retour sur la page du Worker → **Settings** → **Bindings** → **Add**.
2. Choisissez **R2 bucket**.
3. **Variable name :** `IMAGES` (exactement, en majuscules). **R2 bucket :** `facilite-images`.
4. **Save / Deploy.**

## 5. Vérifier (deux adresses à ouvrir dans le navigateur)
- `https://facilite-images.<votre-sous-domaine>.workers.dev/_sante` doit afficher `{"ok":true,"r2":true}`.
- `https://facilite-images.<votre-sous-domaine>.workers.dev/job-offers/admin-posters/poster-1787085268438-w1280.webp` doit afficher une affiche.

Si `"r2":false` s'affiche, la liaison n'est pas branchée : refaites l'étape 4 (nom exact `IMAGES`).

## Ce que fait le Worker
- Fichier présent dans R2 : servi, avec cache navigateur d'un an.
- Fichier absent de R2 (ajouté sur Supabase après l'export) : récupéré **une seule fois** chez Supabase, rangé dans R2, puis servi (rattrapage automatique).
- Autres buckets (`avatars`, `covers`, `banque-cv`…) : toujours refusés (404). Lecture seule : aucune suppression, aucune écriture hors rattrapage.
- Limites gratuites : 100 000 requêtes par jour pour tout le compte Cloudflare.

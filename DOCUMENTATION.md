# 🚀 Facilite – Documentation Officielle du Projet

Bienvenue dans la documentation officielle de **Facilite**, la plateforme digitale de référence pour la création, l'optimisation et la valorisation de CVs professionnels et lettres de motivation à fort impact.

---

## 📐 1. Vision & Objectifs du Projet

**Facilite** est conçu pour offrir une expérience utilisateur haut de gamme, cinématique et ergonomique (inspirée des standards LinkedIn et des meilleures applications Web modernes). La plateforme permet aux candidats :
- De choisir parmi une sélection organisée de modèles de CV haute fidélité (liés à des templates Canva).
- D'importer leur CV existant pour une analyse automatique par IA.
- D'accéder à des services spécialisés (CV version Anglaise, Format Canadien, Lettre de motivation sur mesure).
- D'échanger en temps réel via une messagerie intégrée avec les recruteurs.

---

## 🎨 2. Charte Graphique & Système de Design

| Élément UI | Couleur / Code Hex | Utilisation |
| :--- | :--- | :--- |
| **Arrière-plan Navbar & Bottom Nav** | `#FAF6F1` | Navbar fixe supérieure et barre de navigation mobile basse |
| **Bandeau de Réassurance** | `#E3DBCC` | Arrière-plan des éléments de confiance et d'information |
| **Couleur d'Action Principale** | `#10E688` *(Vert Fluo)* | Boutons d'action prioritaires, badges d'onglets actifs, éléments clés |
| **Couleur d'Action Secondaire** | `#E4B8F9` *(Violet Clair)* | Cartes mises en avant, badges recommandés, accents d'importation |
| **Accentuation Interactive** | `#2563EB` *(Bleu Royal)* | Bordures de survol des tarifs, ombres portées, boutons de formulaire |
| **Textes & Titres** | `#111827` / `#374151` | Typographie sombre sur fond clair pour une lisibilité maximale |

---

## 🛠️ 3. Architecture Technique

Le projet est développé avec la stack technique moderne suivante :
- **Framework React / SSR** : [Next.js 16 (App Router)](https://nextjs.org/)
- **Moteur de Build** : Turbopack (temps de compilation ultra-rapide)
- **Styling** : Vanilla CSS & Utilities TailwindCSS
- **Iconographie** : FontAwesome 6 (Pro / Free Solid & Regular)
- **Internationalization (i18n)** : Support bilingue Français (`FR`) / Anglais (`GB`) avec persistance dans `localStorage`.

### Structure des Fichiers Principaux :
```
monprojetfacilite/
├── src/app/
│   ├── page.js             # Page d'accueil (Hero, Carrousel 360°, Tarifs, Profil LinkedIn)
│   ├── service/page.js     # Catalogue de services & aperçu interactif de modèles
│   ├── importer-cv/page.js # Module d'importation & analyseur IA de CV
│   ├── messagerie/page.js  # Interface de messagerie candidat-recruteur
│   ├── profil/page.js      # Gestion du profil candidat
│   ├── layout.js           # Layout racine avec injection des polices & scripts
│   └── globals.css         # Styles globaux & animations CSS
├── public/
│   ├── logo.jpeg           # Logo officiel Facilite
│   ├── francais.avif       # Drapeau langue française
│   └── anglais.jpeg        # Drapeau langue anglaise
└── GEMINI.md               # Directives et règles de développement
```

---

## 🌟 4. Fonctionnalités Clés & Composants

### 📱 A. Barre de Navigation Harmonisée (Desktop & Mobile)
- **Design Unifié** : Présent de manière identique sur toutes les pages (`/`, `/service`, `/importer-cv`, `/messagerie`).
- **Éléments PC** :
  1. Logo **Facilite** avec barre de recherche d'offres intégrée.
  2. Onglets principaux : **Accueil** 🏠, **Messagerie** 💬 (badge), **Notifications** 🔔 (compteur dynamique), **Recrutement** 👔, **Plus ▼** (Menu déroulant avec *Service* et *Contact*), **Connexion** 👤.
- **Éléments Mobile (Style LinkedIn App)** :
  1. Header supérieur compact : Logo + Recherche + Cloche de notification + Icône Messagerie.
  2. Barre de navigation basse fixée (`Fixed Bottom Bar`) pour un accès au pouce.

### 🔔 B. Centre de Notifications Interactif (Style LinkedIn)
- Accessible au clic sur la cloche de notification.
- **Filtres Pilules** : `[Toutes]`, `[Offres d'emploi]`, `[Mes posts]`, `[Mentions]`.
- **Indicateur bleu non lu** (`●`) pour repérer instantanément les nouveautés.
- **Action "Tout marquer comme lu"** réinitialisant le compteur dynamique de badges de `3` à `0`.

### 🎠 C. Carrousel de Modèles à 360° (Section 2)
- Boucle infinie sans à-coups grâce au clonage dynamique des cartes en JS.
- Support du défilement tactile (Swipe Mobile) et du Drag-and-Drop à la souris sur ordinateur.
- Calque sombre au survol avec bouton « 👁 Voir le modèle » redirigeant vers Canva.

### 💳 D. Tarifs Interactifs (Section 3)
- Grille de 4 cartes tarifaires (CV Professionnel, Lettre de Motivation, CV Version Anglaise, CV Canadien).
- Effet d'activation au survol avec mise en valeur bleue (`#2563EB`), ombres portées et badge « **Recommandé** ».

### 📄 E. Module d'Importation & Analyse IA de CV (`/importer-cv`)
- Workflow en 3 étapes :
  1. **Zone de Téléversement Drag & Drop** (PDF, DOCX).
  2. **Scanner IA Animé** avec étapes de traitement en temps réel.
  3. **Rapport d'Analyse & Recommandation** de modèles personnalisés.

### ✉️ F. Messagerie Candidat-Recruteur (`/messagerie`)
- Liste des discussions filtrable (`Toutes`, `Non lues`, `Favoris`).
- Zone de chat en direct avec simulation de réponse recruteur, sélecteur d'emojis et pièces jointes.

---

## 🚀 5. Commandes Utiles pour les Développeurs

### Lancer le serveur de développement local :
```bash
npm run dev
```

### Vérifier et construire la version de production :
```bash
npm run build
```

### Lancer le serveur de production :
```bash
npm run start
```

---

## 📝 6. Guide de Maintenance & Évolution
1. **Ajout d'un nouveau modèle Canva** : Ajouter l'entrée dans le tableau `modelsData` dans `src/app/page.js` et `src/app/service/page.js`.
2. **Ajout d'une nouvelle notification** : Mettre à jour l'état initial `notificationsList` présent dans le state global des pages.
3. **Traduction** : Modifier les objets `translations.FR` et `translations.GB` situés au début des fichiers de page.

---
*Document généré automatiquement pour le projet Facilite – Février 2026.*

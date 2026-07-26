# Projet Facilité - Documentation & Directives IA

> Agis comme un Technologie Créatif Senior de classe mondiale et Lead Ingénieur Frontend. Tu construis des applications et landing pages haute-fidélité, cinématographiques, "1:1 Pixel Perfect". Chaque site que tu produis doit ressembler à un instrument digital – chaque scroll est intentionnel, chaque animation est pondérée et professionnelle. Éradique tous les patterns génériques d'IA.
>
> ### Flux de l'Agent – A SUIVRE OBLIGATOIREMENT
> 💡
> Quand l'utilisateur demande de construire ou modifier le site (ou que ce fichier est chargé dans un nouveau projet), analyse d'abord les besoins et la charte graphique, puis construis/modifie de manière autonome et rigoureuse. Ne discute pas trop. Construis.

---

## 📌 1. Présentation de l'Application

**Facilité** est une plateforme digitale moderne d'aide à la création, l'optimisation et la valorisation de CVs professionnels et lettres de motivation à fort impact. L'application offre une expérience utilisateur cinématographique, réactive et ergonomique inspirée des standards Web les plus exigeants (style LinkedIn / SaaS moderne).

---

## 🚀 2. Toutes les Fonctionnalités Implémentées

1. **Navigation & En-tête Unifiée (PC & Mobile)**
   - Header fixe (`pt-[52px]`) avec logo officiel `logo.jpeg`.
   - Sélecteur de langue dynamique bilingue (Français `francais.avif` / Anglais `anglais.jpeg`) avec persistance `localStorage`.
   - Onglets de navigation : Accueil, Service, Importer CV, Messagerie, Recrutement.
   - Barre de navigation basse (Bottom Bar) fixée pour accès tactile sur mobile.

2. **Centre de Notifications Interactif (Style LinkedIn)**
   - Badge dynamique avec compteur de notifications non lues.
   - Filtres par pilules (`Toutes`, `Offres d'emploi`, `Mes posts`, `Mentions`).
   - Action "Tout marquer comme lu" réinitialisant le compteur.

3. **Carrousel de Modèles à 360° (Section 2)**
   - Système de boucle infinie à 360° via clonage automatique des cartes en JS.
   - Défilement fluide, support du drag-and-drop à la souris et du swipe sur mobile.
   - Effet de survol immersif avec calque assombri et indicateur « 👁 Voir le modèle ».
   - Redirection directe au clic vers les templates Canva correspondants.

4. **Grille de Tarifs Interactifs (Section 3)**
   - 4 cartes d'offres (CV Professionnel, Lettre de Motivation, CV Version Anglaise, CV Canadien).
   - Effet de suivi interactif au survol : bordure active bleu royal (`#2563EB`) et conversion du bouton en bleu plein avec ombre portée.
   - Badge horizontal « **Recommandé** » avec dégradé spécial.

5. **Module d'Importation & Analyseur IA de CV (`/importer-cv`)**
   - Zone de téléversement Drag & Drop (PDF, DOCX).
   - Animation de scanner IA simulant l'analyse en temps réel.
   - Génération d'un rapport de score et de recommandations de modèles.

6. **Messagerie Candidat-Recruteur (`/messagerie`)**
   - Interface de chat complète avec filtres de conversations.
   - Messagerie en temps réel simulée avec sélecteur d'émojis et pièces jointes.

7. **Modal de Contact Global**
   - Formulaire d'envoi élégant avec validation des champs.
   - Écran de succès animé lors de la soumission.
   - Fermeture responsive (Touche `Échap`, clic extérieur ou bouton `X`).

---

## 📁 3. Structure des Fichiers

```
monprojetfacilite/
├── src/
│   └── app/
│       ├── page.js             # Page d'accueil (Hero, Carrousel 360°, Tarifs, Contact)
│       ├── service/page.js     # Catalogue complet de services & modèles
│       ├── importer-cv/page.js # Module d'importation & Analyseur IA
│       ├── messagerie/page.js  # Interface de messagerie en temps réel
│       ├── profil/page.js      # Profil utilisateur & candidat
│       ├── layout.js           # Layout racine (Metadata, Polices & Scripts)
│       └── globals.css         # Styles globaux, variables CSS & animations
├── public/
│   ├── logo.jpeg           # Logo officiel Facilité
│   ├── francais.avif       # Icône drapeau français
│   └── anglais.jpeg        # Icône drapeau anglais
├── DOCUMENTATION.md        # Documentation officielle complète
├── GEMINI.md               # Directives du projet & instructions IA
├── package.json            # Dépendances du projet (Next.js 16, React 19, Tailwind)
└── next.config.mjs         # Configuration Next.js
```

---

## 🛠️ 4. Technologies Utilisées

* **Framework Principal** : Next.js 16 (App Router)
* **Bibliothèque UI** : React 19
* **Moteur de Build** : Turbopack
* **Styling** : Vanilla CSS & TailwindCSS (avec variables HSL & HEX personnalisées)
* **Iconographie** : FontAwesome 6 (Solid & Regular)
* **Gestion d'État & i18n** : React Hooks (`useState`, `useEffect`) & `localStorage`

---

## 🎨 5. Décisions de Design

* **Navbar Background** : `#FAF6F1` (Beige très doux pour un ton haut de gamme et chaleureux)
* **Réassurance Background** : `#E3DBCC` (Nuance terre/sable pour renforcer la confiance)
* **Couleur d'Action Principale** : Vert Fluo (`#10E688`) pour attirer l'attention sur les CTA majeurs
* **Couleur d'Action Secondaire** : Violet Clair (`#E4B8F9`) pour les éléments mis en avant et badges
* **Accentuation Interactive** : Bleu Royal (`#2563EB`) pour la section Tarifs et les éléments actifs
* **Philosophie UX** : Zero placeholder, animations fluides à 60fps, micro-interactions instantanées et lisibilité maximale.

---

## 🤖 6. Instructions pour un Futur Modèle IA

1. **Règle Pixel Perfect** : Toute nouvelle page ou modification doit strictement respecter la charte graphique (couleurs Hex exactes) et garder l'effet haut de gamme.
2. **Cohérence i18n** : Conserver le support bilingue (Français/Anglais) lors de l'ajout de nouveaux textes UI.
3. **Composants Reutilisables** : La Navbar et la Bottom Bar mobile doivent être synchronisées entre les différentes routes (`/`, `/service`, `/importer-cv`, `/messagerie`).
4. **Zéro suppression destructive** : Ne jamais supprimer le carrousel 360° ni le système de modal contact lors des refactorisations.
5. **Vérification** : Toujours exécuter `npm run build` après modification pour s'assurer qu'aucune erreur SSR/JSX n'a été introduite.

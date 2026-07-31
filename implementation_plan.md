# Plan d'implémentation — Optimisation Responsive & Mobile UX (Facilite)

Ce plan décrit les changements appliqués pour assurer une responsivité irréprochable sur tous types d'appareils, du plus petit smartphone (320px) aux moniteurs de bureau.

---

## Objectifs de Design

1. **Mobile-First** : Adapter l'ensemble de l'interface en utilisant les points de rupture Tailwind (`sm:`, `md:`, `lg:`) pour s'assurer que les téléphones étroits sont servis en premier.
2. **Confort de touché (Touch Targets)** : Garantir une zone interactive minimale de `44x44px` sur tous les boutons clés et formulaires.
3. **Prévention Zoom iOS Safari** : Forcer la taille de police des champs éditables à `16px` au moins pour éviter les zooms automatiques de Safari.
4. **0px de défilement horizontal** : Bloquer les débordements de contenu (`overflow-x`).

---

## Proposed Changes

### 1. Style Global
#### [MODIFY] [globals.css](file:///c:/Users/gta/Downloads/monprojetfacilite/src/app/globals.css)
- Forcer les boutons de formulaires et de saisie (`input`, `select`, `textarea`) à `font-size: 16px` en dessous de 768px.

### 2. Modale de Tarifs
#### [MODIFY] [PricingModal.js](file:///c:/Users/gta/Downloads/monprojetfacilite/src/components/PricingModal.js)
- Transformation de la boîte flottante en tiroir de bas de page (Bottom Sheet) sur petit écran (`items-end justify-center rounded-t-3xl`).
- Augmentation de la taille de la cible de toucher du bouton "X" (Fermer) à `11x11` (44px) pour l'ergonomie mobile.
- Mise en valeur de l'offre recommandée via un badge dédié.

### 3. En-têtes de Dashboard
#### [MODIFY] [candidatures/page.js](file:///c:/Users/gta/Downloads/monprojetfacilite/src/app/candidat/candidatures/page.js) & [dashboard/page.js](file:///c:/Users/gta/Downloads/monprojetfacilite/src/app/admin/dashboard/page.js)
- Rendre les boutons d'en-tête réactifs : masquer le texte sur mobile (`hidden md:inline`) pour ne garder que l'icône, afin d'éviter d'exploser la largeur de l'écran en 320px.

### 4. Grilles KPIs
#### [MODIFY] [admin/page.js](file:///c:/Users/gta/Downloads/monprojetfacilite/src/app/admin/page.js)
- Remplacement du conteneur de cartes KPI rigides par une grille Tailwind réactive (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`).

---

## Verification Plan

### Automated Tests
- Lancement de la suite de tests Playwright dédiée : `npx playwright test tests/e2e/responsive-check.spec.js`.
- Validation via compilation globale : `npm run build` et `npm run lint`.

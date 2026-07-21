# Projet Facilite - Documentation & Directives

> Agis comme un Technologie Creatif Senior de classe mondiale et Lead Ingenieur Frontend. Tu construis des landing pages haute-fidelite, cinematographiques, "1:1 Pixel Perfect". Chaque site que tu produis doit ressembler a un instrument digital – chaque scroll est intentionnel, chaque animation est ponderee et professionnelle. Eradique tous les patterns generiques d'IA.
>
> ### Flux de l'Agent – A SUIVRE OBLIGATOIREMENT
> 💡
> Quand l'utilisateur demande de construire un site (ou que ce fichier est charge dans un nouveau projet), pose immediatement exactement ces questions en utilisant `AskUserQuestion` en un seul appel; puis construis le site complet a partir des reponses. Ne pose pas de questions supplementaires. Ne discute pas trop. Construis.

Ce fichier sert de référence pour le développement de la landing page de **Facilite**, un outil moderne d'aide à la création de CV professionnels et impactants.

## 🎨 Charte Graphique & Design
* **Arrière-plan Navbar** : `#FAF6F1`
* **Arrière-plan Bandeau de Réassurance** : `#E3DBCC`
* **Couleur d'Action Principale (Vert fluo)** : `#10E688`
* **Couleur d'Action Secondaire (Violet clair)** : `#E4B8F9`
* **Accentuation interactive** : Bleu royal (`#2563EB`) pour la section des tarifs.

## 🚀 Fonctionnalités Clés du Projet

### 1. Navigation & En-tête
* Fixé en haut avec un ajustement dynamique de la marge supérieure du contenu principal (`pt-[52px]`).
* Logo personnalisé (`logo.jpeg`) et sélecteur de langue drapeau (`francais.avif` / `anglais.jpeg`).
* Bouton « **Contactez-nous** » ouvrant un modal interactif.

### 2. Carrousel de Modèles (Section 2)
* **Système de boucle infinie à 360°** (clonage automatique des cartes d'extrémité en JS).
* Support du défilement fluide, du drag-and-drop à la souris sur ordinateur et du swipe sur mobile.
* Survol avec calque assombri et indicateur « 👁 Voir le modèle ».
* Redirection au clic sur les modèles vers les liens Canva associés.

### 3. Tarifs Interactifs (Section 3)
* Grille de 4 cartes (CV Professionnel, Lettre de Motivation, CV Version Anglaise, CV Canadien).
* **Effet de suivi interactif au survol** : la carte survolée active sa bordure en bleu et change le style de son bouton en bleu plein avec ombre portée.
* Contient le badge horizontal « **Recommandé** » avec dégradé décalé.

### 4. Modal de Contact
* Formulaire d'envoi élégant avec validation des champs.
* Animation et affichage d'un écran de succès lors de la soumission.
* Fermeture via la touche `Échap`, en cliquant en dehors du formulaire, ou via le bouton de fermeture (`x`).

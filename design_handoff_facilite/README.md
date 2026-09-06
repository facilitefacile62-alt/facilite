# Handoff: Facilité — App mobile Android

## Overview
Facilité est une app de recherche d'emploi et de services administratifs au Sénégal (fil d'offres, candidature en 1 clic, messagerie, répertoire d'entreprises, outils PDF/IA). Ce dossier contient chaque écran séparé en fichier HTML pour l'implémentation par un développeur.

## À propos des fichiers de design
Les fichiers HTML de ce dossier sont des **références de design**, pas du code de production. Ils montrent la structure, le contenu et le comportement voulu. Le développeur doit **recréer ces écrans dans l'environnement réel de l'app** (Kotlin/Jetpack Compose pour Android natif, ou le framework déjà utilisé dans le projet) — pas copier le HTML tel quel.

Notation utilisée dans les fichiers :
- `{{ nom }}` = valeur dynamique (donnée réelle à injecter)
- `<sc-for>` = liste répétée (un élément par donnée)
- `<sc-if>` = affichage conditionnel selon l'état de l'app

## Fidélité
**Haute fidélité (hifi)** : couleurs, typographie, espacements et textes sont finaux. À reproduire pixel-perfect.

## Palette & typographie
- Bleu Royal `#2563EB`, Vert Menthe `#10B981`
- Fond clair des écrans : `#F2F0EA` ; cartes blanches `#fff`
- Fond sombre (cadre app / listes messagerie) : `#0B0D10`, `#15181D`
- Police : Roboto (400/500/700/900)
- Cartes très arrondies (16–24px de rayon), style inspiré Yimmo / LinkedIn mobile

## Écrans (pages/)
1. **01-accueil.html** — Fil d'offres d'emploi, cartes recruteurs, bouton flottant micro IA. Nav du bas : Accueil, Extracteur, Offres, Messages, Notifs, Admin.
2. **02-extracteur.html** — Assistant IA de candidature : import photo d'annonce ou texte brut, extraction automatique.
3. **03-offres.html** — Catalogue complet des offres, filtres Disponibles/Expirées, recherche IA.
4. **04-recherche.html** — Recherche par titre/entreprise/secteur, recherches récentes, catégories.
5. **05-messages.html** — Liste des discussions (support RH + recruteurs).
6. **06-chat-detail.html** — Conversation avec le Support RH : bulle de message, actions rapides IA, dictée vocale, modale "Réponses de l'IA".
7. **07-fiche-offre.html** — Détail d'une offre : salaire, compétences, bouton "Postuler en 1 clic".
8. **08-menu-profil.html** — Panneau menu (☰) : recherche de raccourcis, bascule espace Candidat/Business, tous les raccourcis (Fonctionnalités, Offres, Candidature Spontanée, etc.).
9. **09-fonctionnalites.html** — Liste des outils (Compresser/Fusionner PDF, Extracteur 1-Click…), filtrable par onglet.
10. **10-candidature-spontanee.html** — Répertoire officiel des entreprises acceptant les candidatures spontanées, recherche + filtres.
11. **11-fiche-entreprise.html** — Détail d'une entreprise : domaines, documents requis, canal de candidature direct.
12. **Profil** (fichiers séparés) — bannière CV + badges Admin/Vérifié, puis sous-pages :
    - **12a-profil-a-propos.html** — vue par défaut, phrase d'accroche et liste des rubriques
    - **12b-profil-infos-perso.html** — Informations personnelles
    - **12c-profil-langues.html** — Langues
    - **12d-profil-experiences.html** — Expériences professionnelles
    - **12e-profil-formation.html** — Formation
13. **13-notifications.html** — Panneau de notifications (onglets Tout/Non lu).
14. **14-connexion.html** — Connexion : logo clé, "Continuer avec Google", champ e-mail, lien mot de passe oublié, lien vers inscription.
15. **15-mot-de-passe-oublie.html** — Réinitialisation du mot de passe par e-mail.
16. **16-inscription.html** — Création de compte (Sign Up) : Nom/Prénom, Email, Password, Confirm Password, ou Google.

## Interactions & navigation clés
- Nav du bas (6 icônes) présente sur tous les écrans principaux ; l'icône active est verte.
- Icône ☰ (menu) ouvre le panneau `08-menu-profil` en overlay plein écran.
- Icône cloche ouvre `13-notifications` en modale, peu importe l'écran actif.
- Clic sur une carte d'offre → `07-fiche-offre`. Bouton "Postuler en 1 clic" bascule en état "Candidature envoyée" (coché, vert clair).
- Clic sur une conversation → `06-chat-detail`. Menu ⋮ → "Réponses de l'IA" → modale de confirmation "Mettre en pause".
- Icône micro (FAB vert, bas droite) démarre l'enregistrement vocal dans le chat (barre d'ondes + minuteur).
- `10-candidature-spontanee` → clic sur une carte entreprise → `11-fiche-entreprise`.
- `08-menu-profil` → clic "facile demo / Espace Candidature & CV" → `12-admin-profil`.

## Gestion d'état (résumé)
- Onglet actif (Accueil/Extracteur/Offres/Messages/Admin/Fonctionnalités/Candidature)
- Vue imbriquée courante (fiche offre, détail chat, détail entreprise, sous-section admin) — retour arrière vers l'onglet parent
- État "postulé" / "sauvegardé" par offre (toggle)
- Filtre actif (Offres disponibles/expirées, Outils Tous/PDF/IA, Entreprises Toutes/Stations-Services)
- Texte de recherche / saisie de message (contrôlé)

## Assets
Aucune image réelle : zones photo (avatar profil, flyers d'annonces, bannières entreprises) sont des placeholders à remplacer par les vrais visuels/logos.

## Fichiers sources complets (interactifs)
Le prototype interactif complet (toutes les pages connectées, avec état et navigation réelle) se trouve dans le projet source : `Facilite.dc.html` (galerie) et `PhonePreview.dc.html` (composant contenant tous les écrans). Ce dossier de handoff en est une extraction statique, écran par écran, pour faciliter la lecture.

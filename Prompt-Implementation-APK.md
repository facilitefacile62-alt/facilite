# Facilité — Prompt complet d'implémentation de l'application Android (APK)

Version finale — 6 octobre 2026

Tu es un développeur mobile senior. Tu dois implémenter l'application Android **Facilité** (ffacilite.com) à partir des maquettes HTML fournies dans ce projet (galerie `Facilite.dc.html` : 75 écrans ; fichiers `PhonePreview.dc.html`, `MarketRolesPhone.dc.html`, `Marketplace.dc.html`, `Profil.dc.html`, `Onboarding.dc.html`, `Inscription.dc.html`, `Navigation Marketplace.dc.html`). Reproduis chaque écran fidèlement (mise en page, textes, couleurs, comportements). Toute l'interface est **en français**. Respecte à la lettre les règles ci-dessous : elles viennent toutes des demandes du client.

---

## 1. Règles permanentes (à ne jamais enfreindre)

1. **La barre de navigation du bas reste TOUJOURS visible**, sur toutes les pages, y compris les pages de détail (article Marketplace, fiche offre, formulaires, visionneuse PDF, réglages…). Le contenu défile au-dessus, la barre est fixée en bas.
2. **Barres de navigation (haut et bas)** : fond **#e3dbcc**, style plat (icône + libellé), élément actif en **vert #10B981**, inactifs en gris (rgba(0,0,0,0.6)).
3. **Ne jamais mélanger les deux plateformes** :
   - **Facilité** = Accueil · Offres · Extracteur · Messages · Profil
   - **Marketplace** = Accueil · Autour de moi · Publier · Messages · Profil (Autour de moi = icône de géolocalisation ; Publier au milieu)
4. **Pastilles de notification** : rouges, chiffre blanc, en haut à droite de l'icône, « 9+ » au-delà de 9, aucune pastille si rien de non lu, ne doit pas déborder de la barre. Même pastille sur la cloche de l'en-tête.
5. **Tout bouton Retour ramène exactement à l'écran d'où l'utilisateur venait** (pile d'historique), pas à un écran fixe.
6. Montrer des visuels, pas de téléchargements, sauf demande.
7. Cibles tactiles ≥ 44 px. Texte lisible, contraste suffisant.
8. L'en-tête du haut (logo clé, recherche, notifications, menu) est celui du site : le garder tel quel.

## 2. Charte graphique

- Fond crème : **#F2F0EA** (pages) / **#FAF6F1** (onboarding). Cartes blanches, coins 16–20 px, bordure rgba(0,0,0,0.06).
- Vert principal **#10B981**, vert fluo **#10E688**, vert foncé **#0B3D2A / #0d3b34**, bleu Marketplace **#2563EB**.
- Badges : VISITEUR (ambre #B45309 sur #FEF3C7), BOUTIQUE (vert #047857 sur #D1FAE5), ADMIN violet, ADMINISTRATEUR rouge.
- Typographie sans-serif, libellés de barre 10,5–12 px en gras (14 px sur ordinateur).
- Mode sombre et mode clair avec les mêmes rôles de couleurs.

### 2.1 Style des boutons d'action (consigne globale)
Forme de référence = bouton **« Compresser PDF »** : rectangle aux coins arrondis (≈14 px), fond blanc légèrement vert **#F3FBF7**, bordure **1,5 px #34D399**, sans ombre.
- À gauche : petit carré arrondi vert clair **#D7F2EA** (40 px, rayon 10) contenant l'icône de l'action.
- Au centre : **titre en gras** (ex. Recevoir le code, Valider, Payer) + **sous-titre discret** gris en dessous si utile.
- À droite : chevron gris.
- Exemples : Recevoir le code (Code de connexion par SMS), Valider (Code reçu par SMS), Envoyer le lien (Réinitialisation par e-mail), Postuler en 1 clic, Continuer (Étape suivante), Enregistrer (Prénom et nom), Créer ma boutique et continuer, Relever ma position actuelle, Scanner avec l'IA (badge PRO), Accéder à la marketplace.
- « Continuer avec l'e-mail » garde son **vert foncé** (#0d3b34) avec la même forme (icône enveloppe, texte blanc).
- Boutons simples (Diagnostiquer mon CV, Postuler sur le site officiel, Email Direct, Create Account, Continuer avec Google) : même forme arrondie.
- Pastilles « + Ajouter une expérience / langue / formation » : coins arrondis 10 px, bordure 1,5 px.
- **Champs de saisie** : bordure **1,5 px vert foncé #0B3D2A**, coins 14 px, hauteur ≥ 52–60 px, comme « +221 | 77 000 00 00 ».

## 3. Espace Facilité (barre : Accueil · Offres · Extracteur · Messages · Profil)

- **Accueil / fil d'actualité** : cartes d'offres (logo entreprise, date, titre, description, lieu, contrat, flyer avec « Agrandir », « X personne a postulé », J'aime, partager, bouton bleu **« Postuler via Facilité »**, « Voir la fiche détaillée → »). Les boutons flottants assistant (micro) et la touche rouge ne sont présents **que sur la page fil d'actualité**, en position normale.
- **Postuler via Facilité** (fil ET fiche offre) ouvre la feuille **« Candidature Rapide »** : titre + poste • entreprise, croix de fermeture ; champs Nom complet*, Votre e-mail*, E-mail du recruteur*, Objet* (pré-remplis) ; « Votre CV ou document* » avec compteur « N sélectionné(s) », liste des CV enregistrés sur le profil (cases cochées, icône PDF, date), zone pointillée « Glissez votre CV ici ou cliquez pour parcourir — PDF, DOCX jusqu'à 10 Mo », Message (facultatif), bouton vert « Envoyer ma candidature ». Puis fenêtre **« Candidature Envoyée ! »** (coche verte avec halo, texte avec poste et entreprise en gras, rappel de l'e-mail de confirmation, bouton « J'ai compris »). L'offre passe en « postulée ».
- **Offres** : bandeau « Offres d'Emploi Disponibles », bouton « Recherche IA », onglets Offres disponibles (compteur) / Offres expirées, bandeau « Recrutements en cours ».
- **Fiche offre** détaillée, **Fiche entreprise**, **Candidature spontanée**, **Recherche** (avec bouton retour rond), **Notifications**, **Menu profil**, **Fonctionnalités** (outils PDF : Compresser, Fusionner, Diviser, Organiser, JPG en PDF…).
- **Extracteur** : extraction d'offres.
- **Messages** : liste + conversation (Support RH), bulles, saisie.
- Menu avatar : liens **Facilité** (icône carte verte, mène à l'accueil Facilité) et **Marketplace** (icône boutique bleue, ouvre la Marketplace).

## 4. Profil Facilité

- En-tête style réseau social : photo ronde avec « + » vert, nom « facile demo » + coche verte, @identifiant, badges ADMIN / ADMINISTRATEUR, bio, lien. Pas de compteurs, pas de bannière « CV ». Mettre la boutique et sa description.
- Boutons **« Modifier infos »** (= À propos / Edit infos) et **« Paramètres »** (= Settings). « À propos » ne s'ouvre que si on clique dessus.
- Onglets : **Documents** et **Fonctionnalités** (pas « Publications », pas « Archived posts »).
- **Documents** : grille 2 colonnes comme le fil (4 visibles à la fois), bouton Ajouter ; sous le nom de chaque document : icônes Voir / Télécharger / Supprimer. Un clic sur l'aperçu ouvre directement le document. Tous les documents sont des **PDF** ouverts dans une **visionneuse intégrée avec bouton retour** ; seule la **photo d'identité** est une image. Pas de lien d'invitation, pas de « Retour à l'accueil des offres », pas de Déconnexion dans cette section ni dans Paramètres.
- Rubriques avec page propre et flèche retour : Intro, Langues, Expériences, Formation, Compétences (étiquettes + « Ajouter »), Centres d'intérêt, Coordonnées (téléphone, WhatsApp, e-mail, ville), Confidentialité (interrupteurs : profil visible recruteurs, afficher téléphone, afficher e-mail + liens légaux), Sécurité & Connexion (mot de passe, e-mail de connexion, appareils, validation en deux étapes).

## 5. Connexion / Inscription

- **Connexion** inspirée de Yimmo : logo clé, champ « +221 | 77 000 00 00 », bouton **« Recevoir le code »**, « Continuer avec l'e-mail », « Mot de passe oublié ? », « Pas encore de compte ? Inscrivez-vous ».
- **Code SMS** : « Entre ton code », « Le code à 6 chiffres vient de partir au +221 … », **6 cases séparées** (case active bordure bleue, case remplie bordure vert foncé, saisie auto du code SMS), bouton Valider actif à 6 chiffres, « Pas reçu ? Renvoyer le code », « ‹ Modifier le numéro ».
- **E-mail / Google**, **Mot de passe oublié** (« Envoyer le lien », « ← Retour à la connexion »).
- **Inscription (Sign Up)** : clé, Nom / Prénom, sélecteur segmenté **Téléphone | E-mail** (E-mail par défaut ; Téléphone affiche « Numéro de téléphone » avec 🇸🇳 +221), Password, Confirm Password, Create Account, OR, Continuer avec Google, « Already have an account? Log In ». Pas de bouton séparé « Continuer avec mon numéro ».

## 6. Onboarding (après inscription/connexion)

1. **Bienvenue – Choix d'univers** : badge clé avec halo vert menthe, « Bienvenue sur Facilité ! », sous-titre « Par quel univers voulez-vous commencer ? Vous pourrez changer à tout moment. » Deux grands boutons illustrés (images de fond) : **Facilité** (mallette, « Recherche d'emploi et candidatures ») et **Facilité Business** (boutique, « Achetez et vendez sur la marketplace »). Pas de « Continuer vers l'accueil » (nouvel utilisateur).
2. **Facilité → « Un dernier détail »** : image du groupe de candidats avec CV ; uniquement **« + Ajouter mes documents »** (comme « Ajouter album » ; CV, lettre de motivation, comme la partie Documents du profil). « Passer cette étape › » vers l'accueil Facilité.
3. **Facilité Business → Choix du rôle** (image des 5 personnes) : « Je suis Visiteur » (panier) / « Je suis Vendeur » (boutique).
4. **Visiteur → Profil express** (image client satisfait) : Prénom, Nom, « Accéder à la marketplace ».
5. **Vendeur → Informations Vendeur & Boutique** : Prénom, Nom, Téléphone/WhatsApp, Nom de la boutique, Ville, bloc GPS « Relever ma position actuelle », « Créer ma boutique et continuer » → espace boutique.

## 7. Marketplace (barre : Accueil · Autour de moi · Publier · Messages · Profil)

- En-tête : logo + barre de recherche à côté des notifications (fond #e3dbcc, champ gris). Un clic ouvre la page Recherche (barre en haut + suggestions/historique dessous, page vierge pour les résultats) avec la barre de navigation.
- Rangée de catégories ; grille d'articles (pas de titre « Tous les produits »). Prix, localisation et achat sur la même ligne ; **le prix sert de bouton d'achat**. Bouton « M'y rendre » sur chaque article. Éléments déplaçables à la souris / au toucher.
- **Article** : galerie photos + **vidéo**, boutique vérifiée + « Boutique → », fil d'Ariane, titre, note ★ et avis, vendus, prix + remise, « Quelques articles restants », quantité −/+, Caractéristiques, Description. Barre fixe **Discuter / WhatsApp / panier** au-dessus de la barre de navigation. Discuter ouvre la discussion vendeur (message pré-rempli) ; WhatsApp ouvre la conversation WhatsApp du vendeur.
- **Autour de moi** (carte + articles proches), **Publier** : « Comment voulez-vous vendre ? » → **Scanner avec l'IA (PRO)** sur une page dédiée (Zéro saisie IA, fonctionne après import/photo ; le bouton change de couleur quand une photo est ajoutée, optionnel) ou **Vendre manuellement** (catégorie puis détails, Continuer).
- **Ma boutique** : bannière, logo, nom + vérifié, « Modifier infos » (page Modifier le profil : photo, Prénom/Nom avec compteur, WhatsApp, ville GPS verrouillé, positionner la boutique, relevé 10 s, date de naissance, sexe, description, Enregistrer), Réglages, onglets **ARTICLE · SERVICE · ÉTABLISSEMENT** (à conserver).
  - **SERVICE** : Métier / Prestation (Modifier → liste : Chauffeur, Mécanicien, Livreur, Plombier, Électricien, Maçon, Peintre bâtiment, Menuisier, Femme de ménage, Jardinier, Coiffeur/Coiffeuse, Couturier/Couturière, Pharmacien, Infirmier/Infirmière, Sage-femme, Professeur particulier, Photographe, Autre (précisez) + zone spécialités, Enregistrer / Annuler) ; Disponibilité (Disponible maintenant / Indisponible) ; **Programmer des horaires** (7 jours avec interrupteur chacun) ; **Devenir livreur** se trouve ici.
  - **Devenir livreur** (dans SERVICE uniquement, réservé à qui a une boutique) : formulaire Nom & Prénom, Téléphone, Ville/Zone, Véhicule (À pied / Vélo / Moto / Voiture), pièce d'identité (facultatif), « Envoyer ma demande » → statut en attente (icône sablier, « Votre demande est en cours de traitement »). Une fois validé : espace LIVREUR ACTIF (§8).
  - **ÉTABLISSEMENT** : catégorie (Non renseignée ✎) (pas de bloc « À propos de … »), Disponibilité, Horaires d'ouverture Lundi→Dimanche, jour actuel « AUJOURD'HUI », Dimanche « Fermé » en rouge, fuseau Africa/Dakar.

- **Interrupteur de visibilité en haut de chaque onglet** de Ma boutique : « Rendre mes articles visibles », « Rendre mon service visible », « Rendre mon établissement visible » (toggle vert, sous-texte « Visible par les utilisateurs » / « Masqué aux utilisateurs » — dire « utilisateurs », jamais « acheteurs »).
- **Publier** : pas de mode Vocal (ni onglet Vocal/Écrit, ni micro) — saisie écrite uniquement. À l'étape Catégorie, le bouton « Continuer » est placé juste **sous « ‹ Changer »**, pas collé en bas.
- **Messagerie Marketplace séparée de celle de Facilité** : « Messages » de la barre Marketplace ouvre « Discussions » (pastille du nombre, crayon, menu ⋮, recherche « Rechercher ou démarrer une discussion... », filtres Toutes / Non lues, liste avec avatar initiales vert, double coche bleue, heure). Les conversations Marketplace (vendeurs, acheteurs) ne se mélangent pas avec celles de Facilité (Support RH, offres, candidatures).
- Profil Facilité, onglet Documents : bouton « + Ajouter mes documents » (et non « Ajouter un album »).

## 8. Rôles Marketplace

**VISITEUR (connecté, sans boutique)**
- Profil : badge VISITEUR ; ligne « Ma boutique » → **« Devenir Vendeur »** (jamais « Voir ma boutique »).
- Hub À propos : bannière, badge VISITEUR ambre, « Boutique officielle partenaire sur Facilité Sénégal », bouton vert **Devenir Vendeur**, liens Foire aux questions et Réglages. Modifier le profil → page Prénom / Nom + Enregistrer.
- Devenir Vendeur Étape 1 (Identité) : **uniquement** Prénom*, Nom*, Téléphone (WhatsApp), E-mail (facultatif) + « Continuer → ». Rien d'autre.
- Étape 2 (Boutique), après Continuer : Nom de la boutique, « Positionner ma boutique » (Démarrer le relevé), Ville, bouton **noir** « Enregistrer les modifications ».
- Marketplace : pastilles rapides en haut **uniquement** « Devenir Vendeur » et « Mes commandes ». **« Devenir livreur » n'apparaît nulle part côté visiteur** (ni pastille, ni ligne du profil, ni action) : il se trouve uniquement dans Ma boutique > SERVICE (voir §7).
- Profil visiteur : lignes À propos, Mes commandes, Réglages (pas de « Devenir livreur »).
- Mes commandes : liste, badge de statut par ligne, « Suivre la livraison » / « Confirmer la réception ».
- Suivi de livraison : carte avec position du livreur, statut texte, « J'ai bien reçu mon colis » si le livreur a déclaré la livraison.
- Réglages visiteur : **uniquement** Informations personnelles, Coordonnées, Foire aux questions, Changer la langue, Confidentialité (icône lien externe → vraie page légale du site), Sécurité & Connexion, Se déconnecter. Interdits : Faire profit & Boost, Abonnés, Avis clients, Contact & Livraison, Désactiver le chat, Désactiver les commentaires, Gérer les notifications.

**VENDEUR (a une boutique)**
- Profil : « Ma boutique » ouvre l'aperçu réel (nom, bannière, badge BOUTIQUE).
- Tableau de bord : Mes annonces, Mes commandes, Service/métier, Établissement, Faire profit & Boost, Premium Marketplace, Abonnés, Avis, FAQ, À propos, Contact, Réglages.
- Mes annonces (compteur + « Publier un article ») ; Publier un article (titre, catégorie, prix, quantité, description, photos, scan IA + aperçu LIVE mis à jour en direct) ; Modifier l'article (pré-rempli, Enregistrer / Supprimer) ; Mes commandes reçues (badge de statut).
- Réglages complets : Faire profit & Boost / Abonnés / Avis clients — Informations personnelles / Coordonnées / Contact & Livraison / FAQ / Langue — Confidentialité (toggle « Rendre ma boutique visible ») / Désactiver le chat / Désactiver les commentaires / Gérer les notifications — Sécurité & Connexion / Se déconnecter.

**LIVREUR ACTIF** (vendeur dont la demande « Devenir livreur » faite depuis SERVICE a été acceptée)
- Mes livraisons en cours : carte par commande réclamée (nom, téléphone, adresse de l'acheteur révélés), bouton selon l'étape : « J'ai récupéré l'article » → « Je démarre la livraison » → « Marquer comme livré ».
- Livraisons disponibles : triées par distance, bouton « Réclamer ».

## 9. Navigation ordinateur / tablette (Marketplace)
- ≥1024 px : menu vertical gauche ~215 px sous l'en-tête, « Publier un article » pleine largeur bleu pilule avec « + » en haut ; Accueil, Messagerie (badge rouge), Marketplace (actif bleu), Autour de moi (cible verte).
- 768 px et 375 px : barre en bas (règles §1). États : actif, inactif, survol/appui (léger fond gris), non connecté (Messagerie et Publier ouvrent la connexion).

## 10. Exigences techniques
- Kotlin + Jetpack Compose (ou équivalent), Material 3 personnalisé avec la charte ci-dessus.
- Navigation avec pile d'historique (retour = écran précédent). Barre du bas persistante via Scaffold.
- Auth : SMS OTP (+221), e-mail, Google. Upload PDF/DOCX ≤ 10 Mo, visionneuse PDF intégrée.
- Géolocalisation (relevé GPS boutique, Autour de moi, suivi livreur), deep link WhatsApp, notifications push avec badges.
- Contenu réel via l'API ffacilite.com ; les textes des maquettes sont des exemples.
- Livrer un APK signé + AAB, testé sur Android 8+ en 360–412 px de large.

## 11. Checklist finale
Total : 75 maquettes dans la galerie (53 + 22 écrans de rôles). Voir INDEX.md.
Vérifier écran par écran dans la galerie : barre du bas visible partout, couleurs #e3dbcc / #10B981, bons onglets par plateforme, retours corrects, pastilles 9+, style des boutons « Compresser PDF », champs bordure vert foncé, tous les flux reliés (onboarding, candidature, devenir vendeur/livreur, commandes, livraison).

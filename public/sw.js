/* eslint-disable no-restricted-globals */
/**
 * Service worker minimal de Facilité.
 *
 * Objectif volontairement étroit : donner un vrai mode hors ligne de base
 * (coquille + page d'attente) sans transformer l'application en cache
 * opaque difficile à invalider. C'est le second manque relevé au
 * diagnostic « Thin Content » avant soumission Google Play — un wrapper
 * sans service worker n'apporte rien de plus que le navigateur.
 *
 * Trois règles, dans cet ordre :
 *   1. Tout ce qui n'est pas un GET de même origine passe directement au
 *      réseau, sans jamais être mis en cache. Cela exclut d'office /api/,
 *      Supabase, Gemini, Sentry, Clarity, et toute écriture.
 *   2. Les navigations (documents HTML) sont servies RÉSEAU D'ABORD :
 *      en ligne, le comportement est strictement identique à aujourd'hui.
 *      Hors ligne, on sert la dernière version vue de la page, et à défaut
 *      la page /hors-ligne.html.
 *   3. Les ressources versionnées (/_next/static/, icônes, polices) sont
 *      servies CACHE D'ABORD : leur URL contient déjà une empreinte, elles
 *      ne changent jamais sous une même URL.
 *
 * Aucune réponse authentifiée n'est mise en cache : les documents HTML de
 * ce site sont soit publics, soit régénérés par le middleware côté serveur,
 * et le cache est vidé à chaque changement de VERSION_CACHE.
 */

// Incrémenté le 2026-08-30. Trois fois dans la journée, des corrections
// déployées et vérifiées présentes dans le bundle servi restaient invisibles
// côté navigateur. Changer cette valeur fait supprimer TOUS les caches
// précédents à l'activation (voir l'événement "activate" plus bas), et
// skipWaiting + clients.claim rendent la purge immédiate plutôt qu'au
// prochain onglet.
//
// À incrémenter à chaque fois qu'un déploiement doit impérativement être vu
// tout de suite — une correction d'incident, typiquement.
// v12 (12/09/2026) : notifications filtrees par univers (Facilite vs
// v13 (12/09/2026) : suppression du doublon de bouton Admin entre header et barre mobile
// v14 (12/09/2026) : suppression de Détails de l'entreprise des réglages boutique
// v15 (13/09/2026) : suppression d'Horaires d'ouverture des réglages boutique
// v16 (13/09/2026) : éditeur d'avatar avec bouton d'enregistrement persistant sticky
// v17 (13/09/2026) : clic sur l'avatar photo ouvre directement l'éditeur d'avatar Bitmoji
// v21 (13/09/2026) : bouton Retour au Marketplace ferme la boutique et revient au Marketplace
// v22 (13/09/2026) : fiabilisation du parcours d'onboarding /bienvenue après inscription & connexion
// v23 (13/09/2026) : redirection systématique vers le choix de plateforme /bienvenue après connexion
// v25 (13/09/2026) : atterrissage direct sur sa propre boutique vierge (0 article) après création
// v26 (13/09/2026) : refonte visuelle de la page de bienvenue (logo officiel, lueur douce, tuiles enrichies)
// v41 (13/09/2026) : redirection directe vers le formulaire Modifier le profil au clic sur Modifier le profil
// v42 (13/09/2026) : enrichissement complet du formulaire Modifier le profil avec champ WhatsApp et sauvegarde synchrone
// v43 (13/09/2026) : accordéons / menus déroulants pour les consignes et autorisations de positionnement GPS
// v44 (13/09/2026) : intégration directe du positionnement GPS déroulant sur la page Modifier le profil
// v45 (13/09/2026) : ajout des boutons Service / métier et Établissement juste après Mes annonces dans le menu latéral
// v46 (13/09/2026) : purge forcée du cache pour affichage instantané des boutons Service et Établissement
// v47 (13/09/2026) : affichage du catalogue vide (avion en papier) pour les nouveaux vendeurs sur Mes annonces
// v48 (13/09/2026) : bandeau supérieur d'invitation 'Publie ton premier article' pour les nouveaux vendeurs
// v49 (13/09/2026) : suppression de la grande bannière dans Mes annonces pour un affichage épuré
// v50 (13/09/2026) : persistance absolue de la page, de la vue vendeur et de l'onglet actif après rechargement (F5)
// v51 (13/09/2026) : fiche boutique 1:1 mobile (avatar à droite, profil complet actif pour tout nouveau compte)
// v56 (14/09/2026) : utilisation de useSearchParams pour éliminer les erreurs d'hydratation SSR
// v57 (14/09/2026) : Messagerie visible en mode Vendeur ; Reglages Marketplace avec Coordonnees/Confidentialite/Securite & Connexion
// v58 (14/09/2026) : Informations personnelles partagees Facilite/Business ; correctif GRANT profiles.quartier
// v61 (16/09/2026) : ajout des boutons Autour de moi et Publier un article sur la barre de navigation
// v62 (16/09/2026) : refonte barre de recherche e-commerce (contour orange, scan photo IA, bouton gradient)
// v63 (16/09/2026) : application de la barre orange sur le Header et boutons mobile Publier & Autour de moi
// v65 (16/09/2026) : bordure et fond harmonises en #e3dbcc (style inline + classe)
// v66 (16/09/2026) : bouton Rechercher et accents passes en Vert Facilite (#10E688 / Emeraude)
// v67 (16/09/2026) : separation stricte Facilite vs Marketplace (ancienne barre et retrait boutons sur Facilite)
// v68 (16/09/2026) : messagerie Marketplace (client/vendeur) separee du Support RH Facilite
// v69 (16/09/2026) : perimetre Marketplace strict, exclut toute candidature (OFFRE) et masque les pilules Facilite
// v70 (16/09/2026) : nav desktop harmonisee icone-au-dessus/libelle-en-dessous (inspiration LinkedIn)
// v71 (16/09/2026) : geolocalisation "Autour de moi" plus rapide + suppression des fetch/canaux feature_flags dupliques (lenteur generale)
// v72 (16/09/2026) : boutons Facilite/Business en pilule sur /bienvenue (inspiration Telegram)
// v73 (17/09/2026) : boutons Facilite/Business reduits (etaient trop imposants)
// v74 (17/09/2026) : boutons /bienvenue encore reduits (54px -> 45px de hauteur)
// v75 (17/09/2026) : retrait du selecteur Type d'activite sur Informations Vendeur (toujours "produit")
// v76 (17/09/2026) : ajout du positionnement GPS obligatoire sur Informations Vendeur (manquant)
// v77 (17/09/2026) : "Publier un article" sans vraie boutique devient "Devenir Vendeur" et mene au vrai formulaire
// v78 (17/09/2026) : meme correctif sur la carte de profil du catalogue Acheteur
// v79 (17/09/2026) : badge "Visiteur" tant qu'aucune vraie boutique n'existe
// v80 (17/09/2026) : onglets mobiles Activite/Domaine renommes en Service/Etablissement avec vraies infos
// v81 (17/09/2026) : boutons Disponible maintenant/Indisponible/Programmer sur Service et Etablissement
// v82 (17/09/2026) : categories d'etablissement concretes (Point Wave/Pharmacie/Clinique/Autre)
// v83 (17/09/2026) : choix du type de boutique (Produit/Service/Etablissement) enfin possible a la creation
// v84 (17/09/2026) : sidebar vendeur masque pour un visiteur sans vraie boutique (Mes annonces, Service/metier, etc.)
// v85 (17/09/2026) : nettoyage onglet Service mobile + Disponibilite ajoutee sur desktop (Service/Etablissement)
// v86 (17/09/2026) : metier en liste deroulante, fermeture des reglages corrigee, 3e copie du panneau desktop Service/Etablissement alignee
// v87 (17/09/2026) : champ metier/categorie enfin visible et sauvegarde depuis "Modifier le profil" (bouton le plus visible)
// v88 (17/09/2026) : possibilite de changer le type de boutique existante (Produit/Service/Etablissement) dans Details de l'entreprise
// v89 (17/09/2026) : edition du metier/categorie directement dans la carte, plus de fenetre avec fond assombri
// v90 (17/09/2026) : le metier/categorie enregistre s'affiche enfin apres sauvegarde (fiche mobile ne restait plus figee)
// v91 (17/09/2026) : le metier/categorie enregistre depuis la carte inline force enfin le vrai type de boutique (etait silencieusement ignore avant)
// v92 (17/09/2026) : clic sur marqueurs superposes (carte Autour de moi) zoome pour les separer au lieu de rester sans effet
// v93 (18/09/2026) : bouton flottant "Lens" sur la fiche boutique, raccourci vers le scan IA Zero Saisie
// v94 (18/09/2026) : liste cliquable pour les marqueurs superposes a zoom maximal (carte Autour de moi)
// v95 (18/09/2026) : cadre de selection deplacable/redimensionnable pour voir toutes les boutiques d'une zone
// v96 (18/09/2026) : clic anti-superposition + cadre de selection portes sur la vue plein ecran Explorer
// v97 (18/09/2026) : icone loupe pour l'outil de cadre de selection (au lieu d'un appareil photo)
// v98 (18/09/2026) : popup de liste (Explorer) enfin lisible, fond sombre manquant faisait du texte blanc sur blanc
// v99 (18/09/2026) : la liste de lieux prend l'apparence du carrousel d'avatars existant
// v100 (18/09/2026) : apercu des articles en vignettes au survol d'une boutique (Autour de moi)
// v101 (18/09/2026) : cartes d'apercu articles agrandies avec prix, style story (au lieu de petites vignettes)
// v102 (18/09/2026) : retrait de Mon activite/Etablissements ouverts des raccourcis Facilite/candidat (place naturelle : Marketplace)
// v103 (18/09/2026) : menu mobile beaucoup plus rapide a ouvrir/fermer/naviguer (plus de demontage complet a chaque clic)
// v104 (18/09/2026) : selecteur de metier organise par domaine sur /profil (remplace le champ texte libre)
// v105 (18/09/2026) : liste de metiers etendue a 207 entrees / 14 categories (etait incomplete)
// v106 (18/09/2026) : apercu d'article robuste face a une photo qui echoue au chargement (fond sombre + repli icone)
// v107 (18/09/2026) : "Vous etes ici" ne bloque plus le survol des boutiques superposees (pane Leaflet dedie, z-index sous overlayPane/markerPane)
// v108 (18/09/2026) : carte de bienvenue (choix d'univers) centree verticalement au lieu d'alignee en haut
// v109 (18/09/2026) : carrousel Snapchat lenses circulaire avec anneau blanc sur la boutique active et produits au survol
// v110 (18/09/2026) : synchronisation du carrousel Snapchat circulaire sur CarteBoutiques et GlobeExplorateurBoutiques avec premier element actif
// v111 (18/09/2026) : boutons fleches gauche/droite pour faire defiler les boutiques du carrousel circulaire
// v112 (18/09/2026) : carrousel circulaire transparent avec defilement fluide a la molette souris et glissement tactile/drag
// v113 (19/09/2026) : dock des boutiques resserre, plus proche des lenses Snapchat (espacement, tailles, legendes uniquement sur la selection)
// v114 (19/09/2026) : carrousel du dock suit visuellement la selection quand elle boucle (fleches), et clic sur des boutiques a la meme position les dissocie legerement
// v115 (19/09/2026) : Explorer (globe) - clic boutique recentre sans forcer un zoom fixe, dissociation persiste au lieu d'etre annulee au clic suivant, fleches/anneau actif corriges sur le dock Articles
// v116 (19/09/2026) : dock des boutiques/articles transparent façon lenses Snapchat (fond glassmorphique clair, sans bordure ni ombre de pilule)
// v117 (19/09/2026) : position centrale de l'avatar actif du dock fixe (espaceurs de centrage), y compris pour le 1er/dernier element de la liste
// v118 (19/09/2026) : Explorer - navigation dans le dock Articles ne force plus de zoom/deplacement brusque de la carte (recentrage doux uniforme, comme les boutiques)
// v119 (19/09/2026) : boutiques trop proches dissociees automatiquement (cercle + trait fin vers la position reelle) sur Carte et Explorer ; fleches du dock (Carte) ne forcent plus de zoom ni n'ouvrent la fiche complete de la boutique
// v120 (19/09/2026) : rayon de dissociation augmente (22 -> 30px) pour eviter que les avatars ecartes se chevauchent encore un peu sur les bords
// v121 (19/09/2026) : Explorer - bulle produits ouverte sur le cote pour la boutique poussee vers le bas (evite de recouvrir l'autre) ; nouvelle interaction survol=apercu, simple clic=epingle/desepingle la bulle, double-clic=ouvre la fiche complete
// v122 (19/09/2026) : meme interaction survol/clic/double-clic + bulle sur le cote portee sur la Carte (mini-widget Autour de moi) ; espaceurs de centrage du dock plafonnes a 56px pour eviter une zone transparente excessive avec peu de boutiques
// v123 (20/09/2026) : Explorer - barre de recherche isolee des gestes Leaflet (disableClickPropagation/disableScrollPropagation) pour eviter un zoom de la carte au lieu du focus clavier
// v124 (20/09/2026) : rayon de dissociation et seuil de detection de chevauchement adaptes au zoom (suivent l'agrandissement des avatars jusqu'a x1.4) pour eviter qu'ils se rechevauchent en zoomant fort ; plafond du dock ajuste (56 -> 90px) ; maxZoom des tuiles Explorer reduit (19 -> 18) pour eviter des tuiles vides en zoom extreme
// v125 (20/09/2026) : navigation clavier fleches gauche/droite pour le dock (ignoree si focus dans un champ texte) ; "Vous etes ici" inclus dans la dissociation automatique (Carte + Explorer) pour ne plus jamais rester cache derriere une boutique superposee
const VERSION_CACHE = "facilite-v125";
const PAGE_HORS_LIGNE = "/hors-ligne.html";

// Volontairement court : uniquement ce qui est nécessaire pour afficher
// quelque chose d'utile sans réseau. Précacher davantage rendrait
// l'installation lente et fragile (un seul 404 fait échouer addAll).
const PRECACHE = [PAGE_HORS_LIGNE, "/manifest.json", "/icon-192x192.png", "/icon-512x512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      // Ne jamais bloquer l'installation sur un précache incomplet : le
      // service worker reste utile même si une icône manque.
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((noms) => Promise.all(noms.filter((n) => n !== VERSION_CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

function estRessourceVersionnee(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    /\.(?:png|jpe?g|gif|webp|avif|svg|ico|woff2?)$/i.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Règle 1 — hors périmètre : réseau direct, aucun cache.
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Règle 2 — navigations : réseau d'abord.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((reponse) => {
          // Seules les réponses complètes et valides sont conservées ; une
          // redirection du middleware vers /login n'a rien à faire en cache.
          if (reponse.ok && reponse.type === "basic") {
            const copie = reponse.clone();
            caches.open(VERSION_CACHE).then((cache) => cache.put(request, copie));
          }
          return reponse;
        })
        .catch(() =>
          caches.match(request).then((enCache) => enCache || caches.match(PAGE_HORS_LIGNE))
        )
    );
    return;
  }

  // Règle 3 — ressources versionnées : cache d'abord.
  if (estRessourceVersionnee(url)) {
    event.respondWith(
      caches.match(request).then(
        (enCache) =>
          enCache ||
          fetch(request).then((reponse) => {
            if (reponse.ok && reponse.type === "basic") {
              const copie = reponse.clone();
              caches.open(VERSION_CACHE).then((cache) => cache.put(request, copie));
            }
            return reponse;
          })
      )
    );
  }
});

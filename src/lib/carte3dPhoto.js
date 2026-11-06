// Vue 3D PHOTO (prototype) : tuiles photoréalistes « Photorealistic 3D Tiles » de Google (Map Tiles API), posées par deck.gl sur la carte MapLibre existante (les repères, bulles, recherche et bande de boutiques ne changent pas).
//
// Principes :
//  - ce fichier n'est chargé QUE quand l'utilisateur appuie sur « Vue 3D photo » (import dynamique dans Carte3D.jsx) : deck.gl et loaders.gl n'alourdissent aucune autre page ;
//  - le NAVIGATEUR charge les tuiles directement chez Google : aucune tuile n'est stockée ni relayée par nos serveurs ni par R2 ; le cache est celui du navigateur, qui suit les en-têtes de Google (Cache-Control) ;
//  - la clé (variable d'environnement NEXT_PUBLIC_GOOGLE_TILES_KEY, restreinte côté Google à nos adresses) n'est jamais écrite dans le code ; elle est passée par l'appelant et ajoutée en paramètre « key » des requêtes ;
//  - garde-fous : une seule requête racine par activation (2 par page au maximum), statuts 403 / 429 => coupure immédiate et retour au prototype gris, aucune requête vers un autre hôte que tile.googleapis.com.
import { altitudeAncrage, hauteurSolSousPoint } from "./hauteurSol.js";
import { DECALAGE_VERTICAL_PHOTO_M, DUREE_MAX_VUE_PHOTO_MS, MAX_RACINES_PAR_PAGE, RACINE_TUILES_GOOGLE, creditsAgreges, statutQuotaOuCle } from "./carte3d.js";

const HOTE_GOOGLE = "tile.googleapis.com";

/**
 * État de session de la PAGE, partagé par toutes les activations de la vue photo tant que la page n'est pas rechargée :
 *  - racines : nombre de requêtes racine réellement envoyées à Google (plafond MAX_RACINES_PAR_PAGE) ;
 *  - texteRacine / obtenueA : réponse de la racine gardée EN MÉMOIRE VIVE (jamais écrite sur disque ni envoyée ailleurs), pour relancer la vue sans nouvelle requête racine tant que la session Google
 *    (« au moins 3 heures ») est valable. Comme la racine et ses adresses de tuiles contiennent le jeton de session, les rejouer ne coûte pas de nouvelle racine ; les tuiles, elles, sont redemandées à Google.
 */
export function creerEtatSession() {
  return { racines: 0, texteRacine: null, obtenueA: 0 };
}
const etatSessionPage = creerEtatSession();

/**
 * Fonction « fetch » prêtée au moteur de tuiles. Pure et testable : le vrai fetch est injecté.
 *  - ajoute la clé en paramètre (requête « simple », sans en-tête personnalisé, donc sans pré-requête CORS) ;
 *  - compte les requêtes racine (au niveau de la page, voir creerEtatSession) : au-delà de MAX_RACINES_PAR_PAGE, répond 429 SANS rien envoyer ;
 *  - rejoue la racine gardée en mémoire tant que la session est valable (aucune nouvelle requête racine) ;
 *  - signale tout 403 / 429 à `surProbleme` (clé refusée ou quota atteint) ;
 *  - refuse tout autre hôte que tile.googleapis.com.
 */
export function creerFetchGoogle({ cle, fetchReel, surProbleme = () => {}, surEvenement = () => {}, maxRacines = MAX_RACINES_PAR_PAGE, etat = etatSessionPage, maintenant = () => (typeof performance !== "undefined" ? performance.now() : Date.now()) }) {
  let coupe = false;
  const reponseVide = (status) => new Response(null, { status });
  const fonction = async (entree, init) => {
    if (coupe) return reponseVide(429);
    const brut = typeof entree === "string" ? entree : entree?.url ?? String(entree);
    const u = new URL(brut, `https://${HOTE_GOOGLE}/`);
    if (u.hostname !== HOTE_GOOGLE) throw new Error("hôte inattendu");
    if (/\/root\.json$/.test(u.pathname)) {
      if (etat.texteRacine !== null && maintenant() - etat.obtenueA < DUREE_MAX_VUE_PHOTO_MS) {
        surEvenement({ type: "racine-reutilisee" });
        return new Response(etat.texteRacine, { status: 200, headers: { "content-type": "application/json" } });
      }
      if (etat.racines >= maxRacines) {
        coupe = true;
        surProbleme("limite");
        return reponseVide(429);
      }
      etat.racines += 1;
      etat.texteRacine = null;
    }
    if (!u.searchParams.has("key")) u.searchParams.set("key", cle);
    const debut = maintenant();
    const estRacine = /\/root\.json$/.test(u.pathname);
    const estTuile = /\.(glb|gltf|b3dm)$/i.test(u.pathname);
    let reponse;
    try {
      reponse = await fetchReel(u.toString(), { signal: init?.signal });
    } catch (erreur) {
      surEvenement({ type: "erreur", texte: `réseau : ${erreur?.message || erreur}` });
      throw erreur;
    }
    const duree = maintenant() - debut;
    if (estRacine && reponse.ok) {
      try {
        etat.texteRacine = await reponse.clone().text();
        etat.obtenueA = maintenant();
      } catch {
        etat.texteRacine = null;
      }
    }
    if (estRacine) surEvenement({ type: "racine", ms: duree, status: reponse.status });
    else if (estTuile) surEvenement({ type: "tuile", ms: duree, status: reponse.status });
    if (!reponse.ok) surEvenement({ type: "erreur", texte: `HTTP ${reponse.status} (${estRacine ? "racine" : estTuile ? "tuile" : "tileset"})` });
    if (statutQuotaOuCle(reponse.status)) {
      coupe = true;
      surProbleme(reponse.status === 429 ? "quota" : "refus");
    }
    return reponse;
  };
  fonction.racines = () => etat.racines;
  return fonction;
}

/**
 * Abaisse une tuile de `decalageM` mètres (une seule fois par chargement de tuile) en modifiant la hauteur de son origine cartographique [longitude, latitude, hauteur] ; deck.gl construit ensuite sa couche à partir de cette origine.
 * Voir DECALAGE_VERTICAL_PHOTO_M dans carte3d.js pour la raison et le réglage.
 */
export function decalerTuile(tuile, decalageM) {
  const contenu = tuile?.content;
  if (!decalageM || !contenu || contenu.__decalageM === decalageM) return false;
  const o = contenu.cartographicOrigin;
  if (!o || o.length < 3 || !Number.isFinite(o[2])) return false;
  contenu.cartographicOrigin = [o[0], o[1], o[2] - decalageM];
  contenu.__decalageM = decalageM;
  return true;
}

/** Retire clé et session de tout texte affiché ou copié (messages d'erreur, adresses). */
export function texteSansSecret(t) {
  return String(t ?? "").replace(/(key|session)=[^&\s"')]+/gi, "$1=XXX");
}

/** Mesures affichées dans la zone discrète des aperçus (secondes depuis l'appui sur « Vue 3D photo », sauf la durée de réponse de la racine). */
/** Erreur géométrique (m) la plus fine parmi les tuiles affichées (lodMetricValue de loaders.gl = geometricError de la tuile), ou null. Les tuiles sans contenu ou à erreur infinie sont ignorées. */
export function erreurGeometriqueLaPlusFine(tuiles) {
  let mini = null;
  for (const t of tuiles || []) {
    const e = t?.lodMetricValue ?? t?.header?.geometricError;
    if (!t?.content || !Number.isFinite(e) || e >= 1e10) continue;
    if (mini === null || e < mini) mini = e;
  }
  return mini;
}

export function creerMesures(maintenant = () => (typeof performance !== "undefined" ? performance.now() : Date.now())) {
  const t0 = maintenant();
  const m = { racineMs: null, racineStatut: null, premiereRecueMs: null, premiereAfficheeMs: null, tuilesChargees: 0, derniereErreur: "", tuiles: null, erreurFine: null };
  return {
    donnees: () => ({ ...m }),
    racine: (ms, status) => { m.racineMs = ms; m.racineStatut = status; },
    tuileRecue: () => { if (m.premiereRecueMs === null) m.premiereRecueMs = maintenant() - t0; },
    tuileAffichee: () => { if (m.premiereAfficheeMs === null) m.premiereAfficheeMs = maintenant() - t0; return m.premiereAfficheeMs; },
    tuileChargee: () => { m.tuilesChargees += 1; },
    erreur: (texte) => { m.derniereErreur = texteSansSecret(texte).slice(0, 160); },
    tuiles: (t) => { m.tuiles = t; },
    erreurFine: (e) => { m.erreurFine = e; },
  };
}

/** Récupère les « copyright » des tuiles sélectionnées (glTF : asset.copyright), pour l'attribution des sources de données exigée par Google. */
export function copyrightsDesTuiles(tuiles) {
  const liste = [];
  for (const t of tuiles || []) {
    const c = t?.content?.gltf?.asset?.copyright ?? t?.content?.asset?.copyright;
    if (c) liste.push(c);
  }
  return liste;
}

/**
 * Crée la vue photo sur une carte MapLibre déjà chargée.
 *  - carte : instance MapLibre ; cle : clé Google (fournie par l'appelant) ; profil : voir profilPhoto() ;
 *  - surCredits(texte) : mentions de sources à afficher ; surProbleme(code) : coupure (le prototype gris prend le relais) ; surAffichee() : la première tuile vient d'être DESSINÉE (c'est de là que se mesure la fluidité) ; surMesures(objet) : durées et compteurs pour la zone de mesures des aperçus.
 * Renvoie { retirer() }.
 */
export async function creerVuePhoto({ carte, cle, profil, surCredits = () => {}, surProbleme = () => {}, surAffichee = () => {}, surMesures = () => {}, surHauteurs = () => {}, fetchReel, etat, decalageM = DECALAGE_VERTICAL_PHOTO_M }) {
  const [{ MapboxOverlay }, { Tile3DLayer }, { WebMercatorViewport }] = await Promise.all([import("@deck.gl/mapbox"), import("@deck.gl/geo-layers"), import("@deck.gl/core")]);
  let retire = false;
  let overlay = null;
  let derniersCredits = "";
  const retirer = () => {
    if (retire) return;
    retire = true;
    try {
      if (overlay) {
        carte.removeControl(overlay);
        overlay.finalize?.();
      }
    } catch {
      /* déjà retiré */
    }
    overlay = null;
  };
  const probleme = (code) => {
    retirer();
    surProbleme(code);
  };
  const mesures = creerMesures();
  const emettre = () => surMesures(mesures.donnees());
  const moteurFetch = creerFetchGoogle({
    cle,
    fetchReel: fetchReel || ((u, i) => fetch(u, i)),
    surProbleme: probleme,
    ...(etat ? { etat } : {}),
    surEvenement: (e) => {
      if (e.type === "racine") mesures.racine(e.ms, e.status);
      else if (e.type === "racine-reutilisee") mesures.racine(0, "racine réutilisée");
      else if (e.type === "tuile" && e.status === 200) mesures.tuileRecue();
      else if (e.type === "erreur") mesures.erreur(e.texte);
      emettre();
    },
  });
  let afficheeSignalee = false;
  let dernierEtat = 0;
  // Ancrage des épingles : hauteur du sol sous chaque lieu (épingle), relue quand les tuiles changent (au plus toutes les 400 ms) et à chaque nouvelle liste de lieux.
  let lieux = [];
  const meilleuresLectures = new Map();
  let dernieresTuiles = [];
  let dernierCalculSol = 0;
  let signatureSol = "";
  const calculerHauteurs = (force = false) => {
    const maintenantMs = Date.now();
    if (!force && maintenantMs - dernierCalculSol < 400) return;
    dernierCalculSol = maintenantMs;
    const resultat = new Map();
    for (const l of lieux) {
      // On garde, pour chaque lieu, la lecture la plus FINE jamais vue (plus petite erreur géométrique) : une tuile momentanément absente de la sélection ne fait pas « sauter » l'épingle, et une tuile plus fine la précise.
      const lecture = hauteurSolSousPoint(dernieresTuiles, l);
      const ancienne = meilleuresLectures.get(l.id);
      if (lecture && (!ancienne || lecture.ge <= ancienne.ge)) meilleuresLectures.set(l.id, lecture);
      const retenue = meilleuresLectures.get(l.id) || null;
      resultat.set(l.id, retenue ? { bas: retenue.bas, altitude: altitudeAncrage(retenue, decalageM), ge: retenue.ge } : null);
    }
    const sig = [...resultat.entries()].map(([id, v]) => `${id}:${v ? `${Math.round(v.bas * 10)}/${Math.round(v.ge)}` : "-"}`).join("|");
    if (sig === signatureSol) return;
    signatureSol = sig;
    surHauteurs(resultat);
  };
  /** Même traitement que le passage du moteur de tuiles (sert aussi aux essais hors ligne avec de fausses tuiles). */
  const traiterTuiles = (tuiles) => {
    dernieresTuiles = tuiles || [];
    calculerHauteurs();
  };
  // Projection EXACTEMENT comme deck.gl (même fenêtre, même caméra que la carte) : sert à placer les épingles à leur hauteur dans la scène, image par image.
  const projeter = (points) => {
    const c = carte.getCenter();
    const conteneur = carte.getContainer();
    const vp = new WebMercatorViewport({ width: conteneur.clientWidth, height: conteneur.clientHeight, longitude: c.lng, latitude: c.lat, zoom: carte.getZoom(), pitch: carte.getPitch(), bearing: carte.getBearing() });
    return points.map(([lng, lat, alt]) => vp.project([lng, lat, alt]));
  };
  const couche = new Tile3DLayer({
    id: "google-3d-photo",
    data: RACINE_TUILES_GOOGLE,
    loadOptions: {
      fetch: moteurFetch,
      // Pas de « worker » : le moteur les chercherait sur un CDN que notre politique de sécurité refuse ; le décodage se fait sur la page.
      worker: false,
      // Décodeur Draco servi par le site lui-même (copie dans public/carte3d/draco/), jamais depuis un CDN.
      modules: {
        "draco_wasm_wrapper.js": "/carte3d/draco/draco_wasm_wrapper.js",
        "draco_decoder.wasm": "/carte3d/draco/draco_decoder.wasm",
      },
      tileset: {
        maximumScreenSpaceError: profil.erreurEcranMax,
        maximumMemoryUsage: profil.memoireMaxMo,
        throttleRequests: true,
        maxRequests: profil.requetesSimultanees,
      },
    },
    // Appelé AVANT la création de la couche de la tuile : on peut donc corriger sa hauteur ici.
    onTileLoad: (tuile) => {
      decalerTuile(tuile, decalageM);
      mesures.tuileChargee();
      emettre();
    },
    onTileError: (_tuile, message) => {
      mesures.erreur(`tuile : ${message || "erreur"}`);
      emettre();
    },
    onTilesetLoad: (tileset3d) => {
      tileset3d.options.onTraversalComplete = (tuilesChoisies) => {
        if (!afficheeSignalee && tuilesChoisies.some((t) => t.tileDrawn)) {
          afficheeSignalee = true;
          mesures.tuileAffichee();
          emettre();
          surAffichee();
        }
        traiterTuiles(tuilesChoisies);
        // Statistiques du moteur (au plus une par seconde) : tuiles dans la vue, à afficher, en cours de chargement, échecs.
        const maintenantMs = Date.now();
        if (maintenantMs - dernierEtat >= 1000) {
          dernierEtat = maintenantMs;
          const lire = (nom) => tileset3d.stats?.get?.(nom)?.count ?? 0;
          mesures.erreurFine(erreurGeometriqueLaPlusFine(tuilesChoisies));
          mesures.tuiles({ dansVue: lire("Tiles In View"), aAfficher: lire("Tiles To Render"), enCours: lire("Tiles Loading"), echecs: lire("Failed Tile Loads") });
          emettre();
        }
        const texte = creditsAgreges(copyrightsDesTuiles(tuilesChoisies));
        if (texte !== derniersCredits) {
          derniersCredits = texte;
          surCredits(texte);
        }
        return tuilesChoisies;
      };
    },
    onError: (e) => {
      mesures.erreur(`couche : ${e?.message || e || "erreur"}`);
      emettre();
      probleme("erreur");
    },
  });
  overlay = new MapboxOverlay({ interleaved: false, layers: [couche], useDevicePixels: profil.ratioPixelMax > 1 ? true : 1 });
  carte.addControl(overlay);
  return {
    retirer,
    racines: () => moteurFetch.racines(),
    projeter,
    definirLieux: (liste) => {
      lieux = liste || [];
      signatureSol = "";
      calculerHauteurs(true);
    },
    injecterTuiles: traiterTuiles,
  };
}

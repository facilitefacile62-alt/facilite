// Vue 3D PHOTO (prototype) : tuiles photoréalistes « Photorealistic 3D Tiles » de Google (Map Tiles API), posées par deck.gl sur la carte MapLibre existante (les repères, bulles, recherche et bande de boutiques ne changent pas).
//
// Principes :
//  - ce fichier n'est chargé QUE quand l'utilisateur appuie sur « Vue 3D photo » (import dynamique dans Carte3D.jsx) : deck.gl et loaders.gl n'alourdissent aucune autre page ;
//  - le NAVIGATEUR charge les tuiles directement chez Google : aucune tuile n'est stockée ni relayée par nos serveurs ni par R2 ; le cache est celui du navigateur, qui suit les en-têtes de Google (Cache-Control) ;
//  - la clé (variable d'environnement NEXT_PUBLIC_GOOGLE_TILES_KEY, restreinte côté Google à nos adresses) n'est jamais écrite dans le code ; elle est passée par l'appelant et ajoutée en paramètre « key » des requêtes ;
//  - garde-fous : une seule requête racine par activation (2 par page au maximum), statuts 403 / 429 => coupure immédiate et retour au prototype gris, aucune requête vers un autre hôte que tile.googleapis.com.
import { DECALAGE_VERTICAL_PHOTO_M, MAX_RACINES_PAR_PAGE, RACINE_TUILES_GOOGLE, creditsAgreges, statutQuotaOuCle } from "./carte3d.js";

const HOTE_GOOGLE = "tile.googleapis.com";

/**
 * Fonction « fetch » prêtée au moteur de tuiles. Pure et testable : le vrai fetch est injecté.
 *  - ajoute la clé en paramètre (requête « simple », sans en-tête personnalisé, donc sans pré-requête CORS) ;
 *  - compte les requêtes racine : au-delà de MAX_RACINES_PAR_PAGE, répond 429 SANS rien envoyer ;
 *  - signale tout 403 / 429 à `surProbleme` (clé refusée ou quota atteint) ;
 *  - refuse tout autre hôte que tile.googleapis.com.
 */
export function creerFetchGoogle({ cle, fetchReel, surProbleme = () => {}, maxRacines = MAX_RACINES_PAR_PAGE }) {
  let racines = 0;
  let coupe = false;
  const reponseVide = (status) => new Response(null, { status });
  const fonction = async (entree, init) => {
    if (coupe) return reponseVide(429);
    const brut = typeof entree === "string" ? entree : entree?.url ?? String(entree);
    const u = new URL(brut, `https://${HOTE_GOOGLE}/`);
    if (u.hostname !== HOTE_GOOGLE) throw new Error("hôte inattendu");
    if (/\/root\.json$/.test(u.pathname)) {
      if (racines >= maxRacines) {
        coupe = true;
        surProbleme("limite");
        return reponseVide(429);
      }
      racines += 1;
    }
    if (!u.searchParams.has("key")) u.searchParams.set("key", cle);
    const reponse = await fetchReel(u.toString(), { signal: init?.signal });
    if (statutQuotaOuCle(reponse.status)) {
      coupe = true;
      surProbleme(reponse.status === 429 ? "quota" : "refus");
    }
    return reponse;
  };
  fonction.racines = () => racines;
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
 *  - surCredits(texte) : mentions de sources à afficher ; surProbleme(code) : coupure (le prototype gris prend le relais).
 * Renvoie { retirer() }.
 */
export async function creerVuePhoto({ carte, cle, profil, surCredits = () => {}, surProbleme = () => {}, fetchReel, decalageM = DECALAGE_VERTICAL_PHOTO_M }) {
  const [{ MapboxOverlay }, { Tile3DLayer }] = await Promise.all([import("@deck.gl/mapbox"), import("@deck.gl/geo-layers")]);
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
  const moteurFetch = creerFetchGoogle({ cle, fetchReel: fetchReel || ((u, i) => fetch(u, i)), surProbleme: probleme });
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
    onTileLoad: (tuile) => decalerTuile(tuile, decalageM),
    onTilesetLoad: (tileset3d) => {
      tileset3d.options.onTraversalComplete = (tuilesChoisies) => {
        const texte = creditsAgreges(copyrightsDesTuiles(tuilesChoisies));
        if (texte !== derniersCredits) {
          derniersCredits = texte;
          surCredits(texte);
        }
        return tuilesChoisies;
      };
    },
    onError: () => probleme("erreur"),
  });
  overlay = new MapboxOverlay({ interleaved: false, layers: [couche], useDevicePixels: profil.ratioPixelMax > 1 ? true : 1 });
  carte.addControl(overlay);
  return { retirer, racines: () => moteurFetch.racines() };
}

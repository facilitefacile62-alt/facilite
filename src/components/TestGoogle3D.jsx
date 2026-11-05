"use client";
// TEST de couverture : Google Photorealistic 3D Tiles couvre-t-il Dakar, avec des bâtiments en volume ?
// Une seule requête « racine » par clic, bouton désactivé après le premier clic, aucun rechargement automatique. La clé vient de NEXT_PUBLIC_GOOGLE_TILES_KEY (lue au build) et n'est ni affichée ni stockée :
// les adresses affichées dans le rapport en sont débarrassées. On descend l'arbre de tuiles uniquement vers le point testé, avec un plafond de requêtes.
import { useState } from "react";

const RACINE = "https://tile.googleapis.com/v1/3dtiles/root.json";
const POINT = { nom: "Dakar Plateau (place de l'Indépendance)", lat: 14.6708, lng: -17.4377 };
const MAX_REQUETES = 14;

function versEcef(latDeg, lngDeg) {
  const a = 6378137, f = 1 / 298.257223563, e2 = f * (2 - f);
  const la = (latDeg * Math.PI) / 180, lo = (lngDeg * Math.PI) / 180;
  const n = a / Math.sqrt(1 - e2 * Math.sin(la) ** 2);
  return [n * Math.cos(la) * Math.cos(lo), n * Math.cos(la) * Math.sin(lo), n * (1 - e2) * Math.sin(la)];
}

// Applique la matrice 4x4 (colonne par colonne) cumulée au centre et aux axes de la boîte.
function appliquer(m, v, point) {
  return [
    m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + (point ? m[12] : 0),
    m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + (point ? m[13] : 0),
    m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + (point ? m[14] : 0),
  ];
}
function produit(a, b) {
  const r = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let l = 0; l < 4; l++) for (let k = 0; k < 4; k++) r[c * 4 + l] += a[k * 4 + l] * b[c * 4 + k];
  return r;
}
const IDENTITE = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function contient(tuile, m, p) {
  const bv = tuile.boundingVolume;
  if (bv?.region) {
    const [o, s, e, n] = bv.region;
    const la = (POINT.lat * Math.PI) / 180, lo = (POINT.lng * Math.PI) / 180;
    return lo >= o && lo <= e && la >= s && la <= n;
  }
  if (!bv?.box) return false;
  const b = bv.box;
  const c = appliquer(m, b.slice(0, 3), true);
  const axes = [b.slice(3, 6), b.slice(6, 9), b.slice(9, 12)].map((x) => appliquer(m, x, false));
  const d = [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
  return axes.every((u) => {
    const n2 = u[0] * u[0] + u[1] * u[1] + u[2] * u[2];
    return n2 === 0 ? true : Math.abs((d[0] * u[0] + d[1] * u[1] + d[2] * u[2]) / n2) <= 1.0001;
  });
}

export default function TestGoogle3D() {
  const [lance, setLance] = useState(false);
  const [lignes, setLignes] = useState([]);
  const [verdict, setVerdict] = useState("");
  const cle = process.env.NEXT_PUBLIC_GOOGLE_TILES_KEY;

  const ajouter = (t) => setLignes((l) => [...l, t]);

  async function tester() {
    if (lance) return;
    setLance(true);
    if (!cle) {
      setVerdict("Clé absente de cette version de la page : la preview n'a pas été reconstruite après l'ajout de la variable. Aucune requête envoyée.");
      return;
    }
    let requetes = 0, racines = 0;
    const get = async (url, binaire) => {
      if (requetes >= MAX_REQUETES) throw new Error("plafond de requêtes atteint");
      requetes++;
      const u = new URL(url, "https://tile.googleapis.com/");
      if (u.hostname !== "tile.googleapis.com") throw new Error("hôte inattendu");
      if (!u.searchParams.has("key")) u.searchParams.set("key", cle);
      const r = await fetch(u.toString(), { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return binaire ? r.arrayBuffer() : r.json();
    };
    try {
      const p = versEcef(POINT.lat, POINT.lng);
      racines++;
      ajouter(`Requête racine (${racines}) …`);
      const ts = await get(RACINE);
      let courant = ts.root, m = produit(IDENTITE, courant.transform || IDENTITE);
      let profondeur = 0, derniereErreurGeo = courant.geometricError, glb = null, jsonSuivis = 1;
      if (!contient(courant, m, p)) {
        setVerdict("Dakar n'est pas dans la zone de la tuile racine : pas de couverture.");
        return;
      }
      for (let garde = 0; garde < 40; garde++) {
        const uri = courant.content?.uri;
        if (uri && /\.glb(\?|$)/.test(uri)) glb = { uri, erreurGeo: courant.geometricError };
        if (uri && /\.json(\?|$)/.test(uri) && courant !== ts.root) {
          const sous = await get(uri);
          jsonSuivis++;
          courant = sous.root;
          m = produit(m, courant.transform || IDENTITE);
          derniereErreurGeo = courant.geometricError;
          ajouter(`Sous-arbre ${jsonSuivis} chargé (erreur géométrique ${Math.round(courant.geometricError)} m).`);
          continue;
        }
        const enfants = courant.children || [];
        const suivant = enfants.find((e) => contient(e, m, p));
        if (!suivant) break;
        courant = suivant;
        profondeur++;
        derniereErreurGeo = courant.geometricError;
        if (courant.content?.uri && /\.json(\?|$)/.test(courant.content.uri)) {
          const sous = await get(courant.content.uri);
          jsonSuivis++;
          courant = sous.root;
          m = produit(m, courant.transform || IDENTITE);
          derniereErreurGeo = courant.geometricError;
          ajouter(`Sous-arbre ${jsonSuivis} chargé (erreur géométrique ${Math.round(courant.geometricError)} m).`);
        }
      }
      ajouter(`Profondeur atteinte : ${profondeur}. Plus fine erreur géométrique vue : ${Math.round(derniereErreurGeo * 10) / 10} m.`);
      let taille = 0;
      if (glb) {
        const buf = await get(glb.uri, true);
        taille = buf.byteLength;
        ajouter(`Une tuile de détail (glb) téléchargée : ${Math.round(taille / 1024)} Ko, erreur géométrique ${Math.round(glb.erreurGeo * 10) / 10} m.`);
      }
      if (glb && glb.erreurGeo <= 16) setVerdict("COUVERT : des tuiles de maillage fin existent sur Dakar (bâtiments en volume probables). Regarder la capture et dire oui/non.");
      else if (glb) setVerdict("PARTIEL : des tuiles existent mais seulement à faible détail (relief sans bâtiments probable).");
      else setVerdict("NON COUVERT : aucune tuile de détail pour ce point.");
    } catch (e) {
      setVerdict(`Échec : ${String(e.message || e).replace(cle, "***")}`);
    } finally {
      ajouter(`Requêtes envoyées : ${requetes} (dont requêtes racine : ${racines}).`);
    }
  }

  return (
    <main className="mx-auto max-w-xl p-4 text-sm text-gray-900">
      <h1 className="mb-2 text-lg font-extrabold">Test de couverture — Google 3D à Dakar</h1>
      <p className="mb-3">Point testé : {POINT.nom} ({POINT.lat}, {POINT.lng}). Une seule requête racine, aucun rechargement automatique.</p>
      <button id="tester-dakar" type="button" onClick={tester} disabled={lance} className="rounded-xl bg-sky-500 px-4 py-3 font-extrabold text-white disabled:bg-gray-400">
        {lance ? "Test lancé" : "Tester Dakar"}
      </button>
      <ul className="mt-4 list-disc pl-5">{lignes.map((l, i) => <li key={i}>{l}</li>)}</ul>
      {verdict ? <p id="verdict" className="mt-3 rounded-xl bg-amber-100 p-3 font-bold">{verdict}</p> : null}
    </main>
  );
}

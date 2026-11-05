"use client";
// TEST de couverture : Google Photorealistic 3D Tiles couvre-t-il Dakar, avec des bâtiments en volume ?
// Deux boutons à usage unique : Dakar, puis la tour Eiffel (lieu sûr, pour vérifier que le test lui-même fonctionne). Une requête « racine » par bouton, jamais plus de 3 au total pour la page, aucun rechargement automatique.
// La clé vient de NEXT_PUBLIC_GOOGLE_TILES_KEY (lue au build) ; ni la clé ni la session ne sont affichées. On descend l'arbre de tuiles uniquement vers le point testé : on suit les enfants ET les contenus externes (.json),
// plafond de 14 requêtes par bouton (tuile de détail comprise).

import { useRef, useState } from "react";

const RACINE = "https://tile.googleapis.com/v1/3dtiles/root.json";
const MAX_REQUETES = 14;
const MAX_RACINES = 3;
const LIEUX = [
  { id: "dakar", bouton: "Tester Dakar", nom: "Dakar Plateau (place de l'Indépendance)", lat: 14.6708, lng: -17.4377 },
  { id: "paris", bouton: "Contrôle : tour Eiffel (Paris)", nom: "Paris (tour Eiffel)", lat: 48.8584, lng: 2.2945 },
];

function versEcef(latDeg, lngDeg) {
  const a = 6378137, f = 1 / 298.257223563, e2 = f * (2 - f);
  const la = (latDeg * Math.PI) / 180, lo = (lngDeg * Math.PI) / 180;
  const n = a / Math.sqrt(1 - e2 * Math.sin(la) ** 2);
  return [n * Math.cos(la) * Math.cos(lo), n * Math.cos(la) * Math.sin(lo), n * (1 - e2) * Math.sin(la)];
}

// Matrice 4x4 stockée colonne par colonne (convention 3D Tiles).
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

function typeVolume(t) {
  const bv = t?.boundingVolume;
  return bv?.region ? "region" : bv?.box ? "box" : bv?.sphere ? "sphere" : "aucun";
}
// Un volume inconnu (sphère, absent) est traité comme « contient » pour ne jamais arrêter la descente à tort ; le type est signalé dans le diagnostic.
function contient(tuile, m, lieu, p) {
  const bv = tuile?.boundingVolume;
  if (bv?.region) {
    const [o, s, e, n] = bv.region;
    const la = (lieu.lat * Math.PI) / 180, lo = (lieu.lng * Math.PI) / 180;
    return lo >= o && lo <= e && la >= s && la <= n;
  }
  if (bv?.box) {
    const b = bv.box;
    const c = appliquer(m, b.slice(0, 3), true);
    const axes = [b.slice(3, 6), b.slice(6, 9), b.slice(9, 12)].map((x) => appliquer(m, x, false));
    const d = [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
    return axes.every((u) => {
      const n2 = u[0] * u[0] + u[1] * u[1] + u[2] * u[2];
      return n2 === 0 ? true : Math.abs((d[0] * u[0] + d[1] * u[1] + d[2] * u[2]) / n2) <= 1.0001;
    });
  }
  return true;
}

// Rapport d'appartenance à une boîte orientée : projection du point sur chacun des 3 demi-axes (|valeur| <= 1 sur les trois = dedans). Sert au diagnostic hors ligne.
function rapports(tuile, m, p) {
  const b = tuile?.boundingVolume?.box;
  if (!b) return null;
  const c = appliquer(m, b.slice(0, 3), true);
  const axes = [b.slice(3, 6), b.slice(6, 9), b.slice(9, 12)].map((x) => appliquer(m, x, false));
  const d = [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
  return axes.map((u) => {
    const n2 = u[0] * u[0] + u[1] * u[1] + u[2] * u[2];
    return n2 === 0 ? null : Math.round(((d[0] * u[0] + d[1] * u[1] + d[2] * u[2]) / n2) * 1e6) / 1e6;
  });
}
// Les valeurs de key= et session= sont remplacées avant toute copie : la réponse brute ne contient aucun secret.
const nettoyer = (obj) => JSON.stringify(obj, null, 1).replace(/(key|session)=[^&"\\\s]+/gi, "$1=XXX");

// Adresse du contenu d'une tuile : « content » (1.0) ou « contents » (1.1, plusieurs contenus).
function adresseContenu(t) {
  return t?.content?.uri ?? t?.content?.url ?? t?.contents?.[0]?.uri ?? t?.contents?.[0]?.url ?? null;
}
const estModele = (u) => /\.(glb|gltf|b3dm|i3dm|pnts)(\?|$)/i.test(u);
const erreurTxt = (g) => (g == null ? "?" : g >= 1e10 ? "infinie" : `${Math.round(g * 10) / 10} m`);

export default function TestGoogle3D() {
  const [faits, setFaits] = useState({});
  const [sorties, setSorties] = useState({});
  const racinesUtilisees = useRef(0);
  const brutParLieu = useRef({});
  const [pret, setPret] = useState(0);
  const [copie, setCopie] = useState("");
  const [texteBrut, setTexteBrut] = useState("");

  // Copie hors ligne : réponses reçues (clé et session remplacées par XXX) + point en ECEF + détail de chaque test d'appartenance. Aucune requête.
  async function copierBrut() {
    const texte = nettoyer(brutParLieu.current);
    setTexteBrut(texte);
    try {
      await navigator.clipboard.writeText(texte);
      setCopie("Copié dans le presse-papiers (aucun secret : key= et session= remplacés par XXX).");
    } catch {
      setCopie("Copie automatique impossible : sélectionnez le texte ci-dessous et copiez-le à la main.");
    }
  }
  const cle = process.env.NEXT_PUBLIC_GOOGLE_TILES_KEY;

  const maj = (id, f) => setSorties((s) => ({ ...s, [id]: f(s[id] || { lignes: [], verdict: "" }) }));

  async function tester(lieu) {
    if (faits[lieu.id]) return;
    setFaits((f) => ({ ...f, [lieu.id]: true }));
    const ligne = (t) => maj(lieu.id, (o) => ({ ...o, lignes: [...o.lignes, t] }));
    const verdict = (t) => maj(lieu.id, (o) => ({ ...o, verdict: t }));
    if (!cle) return verdict("Clé absente de cette version de la page : la preview n'a pas été reconstruite après l'ajout de la variable. Aucune requête envoyée.");
    if (racinesUtilisees.current >= MAX_RACINES) return verdict("Plafond de requêtes racine atteint pour cette page : aucune requête envoyée.");
    let requetes = 0, racines = 0, session = null;
    const get = async (url, binaire) => {
      if (requetes >= MAX_REQUETES) throw new Error("plafond de requêtes atteint");
      requetes++;
      const u = new URL(url, "https://tile.googleapis.com/");
      if (u.hostname !== "tile.googleapis.com") throw new Error("hôte inattendu");
      if (u.searchParams.get("session")) session = u.searchParams.get("session");
      else if (session) u.searchParams.set("session", session);
      if (!u.searchParams.has("key")) u.searchParams.set("key", cle);
      const r = await fetch(u.toString(), { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return binaire ? r.arrayBuffer() : r.json();
    };
    let raison = "";
    let brut = null;
    try {
      const p = versEcef(lieu.lat, lieu.lng);
      racinesUtilisees.current++;
      racines++;
      const ts = await get(RACINE);
      let cur = ts.root;
      let m = produit(IDENTITE, cur.transform || IDENTITE);
      brut = { lieu: lieu.id, pointEcef: p, reponseRacine: ts, matriceRacine: m, tuilesRetenues: [], tilesetsExternes: [], evaluations: [] };
      brutParLieu.current[lieu.id] = brut;
      setPret((x) => x + 1);
      ligne(`Racine : volume « ${typeVolume(cur)} », ${(cur.children || []).length} enfant(s), contenu : ${adresseContenu(cur) ? (estModele(adresseContenu(cur)) ? "modèle" : "tileset externe") : "aucun"}, erreur géométrique ${erreurTxt(cur.geometricError)}.`);
      let profondeur = 0, ge = cur.geometricError, glb = null, ouverts = 0;
      for (let garde = 0; garde < 60; garde++) {
        const uri = adresseContenu(cur);
        if (uri && estModele(uri)) glb = { uri, ge: cur.geometricError };
        if (uri && !estModele(uri)) {
          if (requetes >= MAX_REQUETES - 1) { raison = "plafond de requêtes atteint avant d'ouvrir un tileset externe"; break; }
          const sous = await get(uri);
          ouverts++;
          brut.tilesetsExternes.push(sous);
          cur = sous.root;
          m = produit(m, cur.transform || IDENTITE);
          ge = cur.geometricError;
          ligne(`Tileset externe ${ouverts} ouvert : volume « ${typeVolume(cur)} », ${(cur.children || []).length} enfant(s), contenu : ${adresseContenu(cur) ? (estModele(adresseContenu(cur)) ? "modèle" : "tileset externe") : "aucun"}, erreur ${erreurTxt(cur.geometricError)}.`);
          if (!contient(cur, m, lieu, p)) { raison = "le point n'est pas dans le volume du tileset ouvert"; break; }
          continue;
        }
        const enfants = cur.children || [];
        if (!enfants.length) { raison = "fin de l'arbre (aucun enfant, pas de contenu à ouvrir)"; break; }
        // Le « transform » d'une tuile s'applique à son propre volume, à son contenu et à ses enfants : on le compose AVANT de tester l'appartenance (avant cette correction, seul celui de la racine l'était).
        const evalues = enfants.map((e, i) => {
          const me = produit(m, e.transform || IDENTITE);
          return { e, me, i, ok: contient(e, me, lieu, p) };
        });
        evalues.forEach((x) => brut.evaluations.push({ profondeur: profondeur + 1, enfant: x.i, volume: typeVolume(x.e), aTransform: !!x.e.transform, rapportsAxes: rapports(x.e, x.me, p), dedans: x.ok }));
        const retenu = evalues.find((x) => x.ok);
        if (!retenu) { raison = `aucun des ${enfants.length} enfants ne contient le point (volumes : ${[...new Set(enfants.map(typeVolume))].join(", ")})`; break; }
        const suivant = retenu.e;
        m = retenu.me;
        brut.tuilesRetenues.push({ profondeur: profondeur + 1, tuile: suivant, matriceCumulee: m });
        cur = suivant;
        profondeur++;
        ge = cur.geometricError;
        ligne(`Enfant retenu (profondeur ${profondeur}) : volume « ${typeVolume(cur)} », ${(cur.children || []).length} enfant(s), contenu : ${adresseContenu(cur) ? (estModele(adresseContenu(cur)) ? "modèle" : "tileset externe") : "aucun"}, erreur ${erreurTxt(cur.geometricError)}.`);
      }
      if (!raison) raison = "limite de boucle atteinte";
      ligne(`Arrêt de la descente : ${raison}. Profondeur ${profondeur}, tilesets externes ouverts ${ouverts}, plus fine erreur vue ${erreurTxt(ge)}.`);
      if (glb) {
        const buf = await get(glb.uri, true);
        ligne(`Tuile de détail téléchargée : ${Math.round(buf.byteLength / 1024)} Ko, erreur géométrique ${erreurTxt(glb.ge)}.`);
        verdict(glb.ge <= 16
          ? "COUVERT : des tuiles de maillage fin existent à cet endroit (bâtiments en volume probables)."
          : "PARTIEL : des tuiles existent mais seulement à faible détail (relief sans bâtiments probable).");
      } else if (/^fin de l'arbre/.test(raison)) {
        verdict("AUCUNE TUILE DE MODÈLE : l'arbre se termine sans contenu 3D à cet endroit. Valable seulement si le contrôle de Paris trouve, lui, une tuile.");
      } else {
        verdict(`INDÉTERMINÉ : le test s'est arrêté avant de trouver un modèle (${raison}). Ne rien conclure sur la couverture.`);
      }
    } catch (e) {
      verdict(`Échec : ${String(e.message || e).split(cle).join("***")}`);
    } finally {
      ligne(`Requêtes envoyées : ${requetes} (dont requête racine : ${racines}). Racines utilisées sur cette page : ${racinesUtilisees.current} sur ${MAX_RACINES}.`);
    }
  }

  return (
    <main className="mx-auto max-w-xl p-4 text-sm text-gray-900">
      <h1 className="mb-2 text-lg font-extrabold">Test de couverture — Google 3D</h1>
      <p className="mb-3">Une seule requête racine par bouton, 3 au maximum pour la page, aucun rechargement automatique. Chaque bouton ne sert qu&apos;une fois.</p>
      {LIEUX.map((l) => (
        <section key={l.id} className="mb-5">
          <p className="mb-1">Point : {l.nom} ({l.lat}, {l.lng}).</p>
          <button id={`tester-${l.id}`} type="button" onClick={() => tester(l)} disabled={!!faits[l.id]} className="rounded-xl bg-sky-500 px-4 py-3 font-extrabold text-white disabled:bg-gray-400">
            {faits[l.id] ? "Test lancé" : l.bouton}
          </button>
          <ul className="mt-3 list-disc pl-5">{(sorties[l.id]?.lignes || []).map((t, i) => <li key={i}>{t}</li>)}</ul>
          {sorties[l.id]?.verdict ? <p id={`verdict-${l.id}`} className="mt-2 rounded-xl bg-amber-100 p-3 font-bold">{sorties[l.id].verdict}</p> : null}
        </section>
      ))}
      <button id="copier-brut" type="button" onClick={copierBrut} disabled={!pret} className="rounded-xl bg-gray-800 px-4 py-3 font-extrabold text-white disabled:bg-gray-400">
        Copier la réponse brute
      </button>
      {copie ? <p className="mt-2 font-bold">{copie}</p> : null}
      {texteBrut ? <textarea id="texte-brut" readOnly value={texteBrut} className="mt-2 h-48 w-full rounded-lg border p-2 font-mono text-xs" /> : null}
    </main>
  );
}

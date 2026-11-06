"use client";
// TEST de couverture : Google Photorealistic 3D Tiles couvre-t-il Dakar, avec des bâtiments en volume ?
// Deux boutons à usage unique : Dakar, puis la tour Eiffel (lieu sûr, pour vérifier que le test lui-même fonctionne). Une requête « racine » par bouton, jamais plus de 3 au total pour la page, aucun rechargement automatique.
// La clé vient de NEXT_PUBLIC_GOOGLE_TILES_KEY (lue au build) ; ni la clé ni la session ne sont affichées ni copiées. La logique de recherche est dans src/lib/couvertureTuiles3d.js (testée hors ligne).

import { useRef, useState } from "react";
import { chercherTuile, erreurTxt, resumeTuile, verdictCouverture, versEcef } from "@/lib/couvertureTuiles3d";

const RACINE = "https://tile.googleapis.com/v1/3dtiles/root.json";
const MAX_REQUETES = 20;
const MAX_RACINES = 3;
const LIEUX = [
  { id: "dakar", bouton: "Tester Dakar", nom: "Dakar Plateau (place de l'Indépendance)", lat: 14.6708, lng: -17.4377 },
  { id: "paris", bouton: "Contrôle : tour Eiffel (Paris)", nom: "Paris (tour Eiffel)", lat: 48.8584, lng: 2.2945 },
];

// Les valeurs de key= et session= sont remplacées avant toute copie : la réponse brute ne contient aucun secret.
const nettoyer = (obj) => JSON.stringify(obj, null, 1).replace(/(key|session)=[^&"\\\s]+/gi, "$1=XXX");

export default function TestGoogle3D() {
  const [faits, setFaits] = useState({});
  const [sorties, setSorties] = useState({});
  const racinesUtilisees = useRef(0);
  const brutParLieu = useRef({});
  const [pret, setPret] = useState(0);
  const [copie, setCopie] = useState("");
  const [texteBrut, setTexteBrut] = useState("");
  const cle = process.env.NEXT_PUBLIC_GOOGLE_TILES_KEY;

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
    try {
      racinesUtilisees.current++;
      racines++;
      const ts = await get(RACINE);
      const brut = { lieu: lieu.id, pointEcef: versEcef(lieu.lat, lieu.lng), reponseRacine: ts, tilesetsExternes: [], evaluations: [], cheminTrouve: null };
      brutParLieu.current[lieu.id] = brut;
      setPret((x) => x + 1);
      ligne(`Racine : ${resumeTuile(ts.root)}.`);
      const res = await chercherTuile({
        racine: ts.root,
        lieu,
        ouvrir: (uri) => get(uri),
        restantes: () => MAX_REQUETES - requetes,
        surLigne: ligne,
        surTileset: (sous) => brut.tilesetsExternes.push(sous),
        surEvaluation: (e) => { if (brut.evaluations.length < 200) brut.evaluations.push(e); },
      });
      brut.cheminTrouve = res.meilleur ? res.meilleur.chemin : null;
      ligne(`Chemin suivi (indices d'enfants depuis la racine) : ${res.meilleur ? res.meilleur.chemin.join(" > ") : "aucun"}. Tilesets externes ouverts : ${res.ouverts}${res.plafond ? " ; arrêt par le plafond de requêtes" : ""}. Plus fine erreur géométrique atteinte : ${res.meilleur ? erreurTxt(res.meilleur.ge) : "aucun modèle"}.`);
      if (res.meilleur) {
        // Un seul modèle de contrôle est téléchargé, jamais plus.
        const buf = await get(res.meilleur.uri, true);
        ligne(`Tuile de détail téléchargée : ${Math.round(buf.byteLength / 1024)} Ko.`);
      }
      verdict(verdictCouverture(res).texte);
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

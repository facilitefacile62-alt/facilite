import { supabase } from "@/lib/supabase";

/**
 * Accès au référentiel `niveaux_etudes` (20260824100000_niveaux_etudes.sql)
 * et comparaison d'éligibilité.
 *
 * Remplace les DEUX échelles de 7 entrées qui coexistaient jusqu'ici et se
 * contredisaient (mesures du 2026-08-24, point 1) :
 *   - getEducationRank() (src/lib/eligibility.js) : sous-chaîne, "Bac+5
 *     (Ingénieur / Master…)" → rang BAC ;
 *   - levelRank() (OffreApplySection.jsx, OffresClient.jsx,
 *     RecruiterShowcaseClient.jsx) : indexOf() exact, "Bac+3" → rang 0.
 * `src/lib/eligibility.js` reste en place pour les appelants qui n'ont que
 * du texte libre à comparer ; dès qu'un code structuré est disponible,
 * c'est CE module qui fait foi.
 */

// Le référentiel ne change que par migration : un seul chargement par
// session de navigation suffit, partagé par tous les appelants (fiche
// d'offre, listing, profil). La promesse elle-même est mémorisée pour que
// deux composants montés en même temps ne déclenchent pas deux requêtes.
let cache = null;
let enVol = null;

export async function chargerNiveauxEtudes() {
  if (cache) return cache;
  if (enVol) return enVol;

  enVol = supabase
    .from("niveaux_etudes")
    .select("code, libelle, rang, categorie, bac_plus, ordre_affichage, comparable")
    .order("ordre_affichage", { ascending: true })
    .then(({ data, error }) => {
      enVol = null;
      if (error || !Array.isArray(data) || data.length === 0) {
        // Jamais bloquant : sans référentiel, l'IHM retombe sur "aucun
        // niveau structuré" et le score sémantique reste seul, exactement
        // comme avant ce chantier.
        console.error("[niveauxEtudes] Chargement du référentiel impossible :", error?.message);
        return [];
      }
      cache = data;
      return cache;
    });

  return enVol;
}

/** Regroupement pour un <select> à <optgroup>, dans l'ordre du référentiel. */
export const LIBELLES_CATEGORIES = {
  aucun: "Sans scolarité",
  elementaire: "Élémentaire",
  moyen: "Moyen",
  secondaire: "Secondaire",
  superieur: "Supérieur (LMD)",
  professionnel: "Professionnel / technique",
  certificat_pedagogique: "Certificats pédagogiques",
  religieux_traditionnel: "Formation religieuse / traditionnelle",
};

export function grouperParCategorie(niveaux) {
  const groupes = [];
  for (const n of niveaux) {
    let g = groupes.find((x) => x.categorie === n.categorie);
    if (!g) {
      g = { categorie: n.categorie, libelle: LIBELLES_CATEGORIES[n.categorie] || n.categorie, niveaux: [] };
      groupes.push(g);
    }
    g.niveaux.push(n);
  }
  return groupes;
}

export function trouverNiveau(niveaux, code) {
  if (!code) return null;
  return niveaux.find((n) => n.code === code) || null;
}

/**
 * Comparaison d'éligibilité sur le référentiel.
 *
 * Trois issues volontairement distinctes, jamais confondues :
 *   - "non_applicable" : l'offre n'exige rien d'interprétable (code NULL,
 *     ou 'AUCUN'). Ne bloque jamais, et ne se présente pas comme une
 *     vérification réussie.
 *   - "inconnu" : le candidat n'a pas renseigné son niveau, ou son niveau
 *     est hors échelle (Daara). Ne bloque jamais non plus — on ne peut pas
 *     conclure, et un Daara n'est ni au-dessus ni en dessous d'une Licence.
 *   - "suffisant" / "insuffisant" : les deux niveaux sont comparables.
 */
export function comparerNiveaux(niveaux, codeCandidat, codeExige) {
  const exige = trouverNiveau(niveaux, codeExige);
  if (!exige || !exige.comparable || exige.rang === null || exige.code === "AUCUN") {
    return { statut: "non_applicable", exige, candidat: trouverNiveau(niveaux, codeCandidat), ecart: 0 };
  }

  const candidat = trouverNiveau(niveaux, codeCandidat);
  if (!candidat || !candidat.comparable || candidat.rang === null) {
    return { statut: "inconnu", exige, candidat, ecart: 0 };
  }

  return {
    statut: candidat.rang >= exige.rang ? "suffisant" : "insuffisant",
    exige,
    candidat,
    ecart: candidat.rang - exige.rang,
  };
}

/**
 * Déduit le niveau d'études d'un CV à partir des formations extraites par
 * l'import (profil/page.js, mapExtractedFieldsToScannedData).
 *
 * Règle INVERSE de celle des offres, et c'est volontaire : une offre
 * déclare un PLANCHER (on retient le niveau le plus bas énuméré), un CV
 * déclare un PARCOURS (on retient le niveau le plus haut atteint). Un CV
 * qui liste « BFEM 2015, BAC 2018, Licence 2021 » correspond à une
 * Licence, pas à un BFEM.
 *
 * La reconnaissance elle-même n'est pas réimplémentée ici : elle appelle
 * la MÊME fonction SQL normaliser_niveau_etudes() que la reprise des
 * offres (20260824101000). Dupliquer ces règles en JavaScript recréerait
 * exactement la situation que ce chantier corrige — deux échelles qui
 * divergent.
 *
 * Jamais bloquant : en cas d'échec réseau ou d'absence de correspondance,
 * renvoie null et le menu déroulant reste sur la valeur précédente.
 */
export async function deduireNiveauDepuisFormations(formations) {
  if (!Array.isArray(formations) || formations.length === 0) return null;

  const textes = Array.from(
    new Set(
      formations
        .map((f) => [f?.degree, f?.field].filter(Boolean).join(" ").trim())
        .filter((t) => t.length > 0)
    )
  );
  if (textes.length === 0) return null;

  try {
    const niveaux = await chargerNiveauxEtudes();
    if (niveaux.length === 0) return null;

    const codes = await Promise.all(
      textes.map(async (texte) => {
        const { data, error } = await supabase.rpc("normaliser_niveau_etudes", { p_texte: texte });
        return error ? null : data;
      })
    );

    const trouves = codes.filter(Boolean).map((c) => trouverNiveau(niveaux, c)).filter(Boolean);
    if (trouves.length === 0) return null;

    const comparables = trouves.filter((n) => n.comparable && n.rang !== null);
    if (comparables.length > 0) {
      return comparables.reduce((a, b) => (b.rang > a.rang ? b : a)).code;
    }

    // Uniquement une formation hors échelle (Daara) : proposée telle
    // quelle plutôt que rien — le candidat garde la main sur le menu.
    return trouves[0].code;
  } catch (err) {
    console.error("[niveauxEtudes] Déduction du niveau impossible :", err?.message);
    return null;
  }
}

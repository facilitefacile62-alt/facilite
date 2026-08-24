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

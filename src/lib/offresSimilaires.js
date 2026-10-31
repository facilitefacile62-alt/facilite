// Choix des offres à proposer sous une offre clôturée : encore ouvertes, de même type, classées par proximité (lieu, mots du titre).
import { offreHorsReferencement } from "./offreReferencement.js";

const sansAccent = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const MOTS_VIDES = new Set(["recrute", "recrutement", "offre", "poste", "pour", "dans", "avec", "chez", "des", "les", "une", "sur", "the", "and"]);
const mots = (s) => new Set(sansAccent(s).split(/[^a-z0-9]+/).filter((m) => m.length > 3 && !MOTS_VIDES.has(m)));

/**
 * @param {object} offre l'offre clôturée
 * @param {object[]} candidates offres lues en base (id, title, location, listing_type, deadline, created_at, is_active)
 * @param {number} nombre
 */
export function choisirOffresSimilaires(offre, candidates, nombre = 4, maintenant = Date.now()) {
  const motsOffre = mots(offre?.title);
  const lieu = sansAccent((offre?.location || "").split(/[,/&]/)[0]).trim();
  return (candidates || [])
    .filter((c) => c && c.id !== offre?.id && !offreHorsReferencement(c, maintenant))
    .map((c) => {
      let score = 0;
      if (c.listing_type && c.listing_type === offre?.listing_type) score += 3;
      if (lieu && sansAccent(c.location).includes(lieu)) score += 2;
      for (const m of mots(c.title)) if (motsOffre.has(m)) score += 1;
      return { c, score, t: new Date(c.created_at || 0).getTime() || 0 };
    })
    .sort((a, b) => b.score - a.score || b.t - a.t)
    .slice(0, nombre)
    .map((x) => x.c);
}

// Liens vers les offres ouvertes, rendus dans le HTML de /offres (pour les moteurs de recherche, qui ne voient pas la liste chargée après coup par le navigateur).
// Logique pure. Seules les offres actives, approuvées et NON expirées (même règle que le plan du site) reçoivent un lien ; une offre masquée ou expirée n'en reçoit aucun.
//
// CONFIDENTIALITÉ : on ne lit et on n'affiche que l'identifiant, l'intitulé, l'entreprise et le lieu. Jamais l'identifiant du recruteur, un numéro, un e-mail ni un
// autre contact (voir COLONNES_LIENS_OFFRES : la requête ne les lit pas).
import { offreHorsReferencement } from "./offreReferencement.js";
import { nettoyerPourAffichage } from "./nettoyerTexteOffre.js";

export const COLONNES_LIENS_OFFRES = ["id", "title", "company", "location", "deadline", "created_at", "status", "is_active"];
export const SELECT_LIENS_OFFRES = COLONNES_LIENS_OFFRES.join(",");
export const LIMITE_LIENS_OFFRES = 100;

/**
 * @param {object[]} lignes offres lues en base (colonnes de COLONNES_LIENS_OFFRES)
 * @returns {{ id: string, title: string, company: string, location: string }[]} les offres ouvertes, les plus récentes d'abord, sans autre champ
 */
export function offresOuvertes(lignes, maintenant = Date.now(), limite = LIMITE_LIENS_OFFRES) {
  return (Array.isArray(lignes) ? lignes : [])
    .filter(
      (o) =>
        o &&
        o.id &&
        String(o.title || "").trim() &&
        o.is_active === true &&
        (o.status == null || o.status === "approved") &&
        !offreHorsReferencement(o, maintenant)
    )
    .slice(0, limite)
    .map((o) => ({ id: o.id, title: nettoyerPourAffichage(String(o.title).trim()), company: String(o.company || "").trim(), location: String(o.location || "").trim() }));
}

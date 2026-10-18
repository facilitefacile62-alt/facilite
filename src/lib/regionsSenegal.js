import { sansAccent } from "@/lib/texte";

// Les 14 régions du Sénégal, chacune avec les villes et quartiers qui la désignent dans un texte de zone libre
// (« Pikine », « Plateau », « Cap Skirring »…). Sert à ranger les livreurs par région dans « Trouver un livreur ».
export const REGIONS_SENEGAL = [
  { nom: "Dakar", mots: ["dakar", "pikine", "guediawaye", "rufisque", "diamniadio", "keur massar", "parcelles", "plateau", "medina", "almadies", "ouakam", "yoff", "ngor", "mermoz", "sacre", "hann", "liberte", "fann", "sicap", "bargny", "sebikotane", "thiaroye"] },
  { nom: "Thiès", mots: ["thies", "mbour", "saly", "tivaouane", "joal", "ngaparou", "popenguine", "somone", "pout", "khombole"] },
  { nom: "Diourbel", mots: ["diourbel", "touba", "mbacke", "bambey"] },
  { nom: "Saint-Louis", mots: ["saint-louis", "saint louis", "richard-toll", "richard toll", "podor", "dagana"] },
  { nom: "Louga", mots: ["louga", "linguere", "kebemer"] },
  { nom: "Fatick", mots: ["fatick", "foundiougne", "gossas"] },
  { nom: "Kaolack", mots: ["kaolack", "nioro"] },
  { nom: "Kaffrine", mots: ["kaffrine"] },
  { nom: "Tambacounda", mots: ["tambacounda", "bakel", "goudiry"] },
  { nom: "Kédougou", mots: ["kedougou", "salemata"] },
  { nom: "Kolda", mots: ["kolda", "velingara"] },
  { nom: "Sédhiou", mots: ["sedhiou", "bounkiling", "goudomp"] },
  { nom: "Ziguinchor", mots: ["ziguinchor", "bignona", "oussouye", "cap skirring"] },
  { nom: "Matam", mots: ["matam", "kanel", "ranerou"] },
];

/** Vrai si le texte de zone d'un livreur désigne cette région (son nom ou l'une de ses villes). */
export function zoneDansRegion(zone, region) {
  const texte = sansAccent(zone);
  if (!texte) return false;
  return [sansAccent(region.nom), ...region.mots].some((m) => texte.includes(m));
}

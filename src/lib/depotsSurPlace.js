// Dépôts sur place (page « Dépôts physiques », /recrutement-journalier) placés
// sur la carte « Autour de moi ». Ces entreprises n'ont qu'une adresse écrite,
// pas de GPS : on repère le QUARTIER cité dans l'adresse et on place le point au
// centre de ce quartier (position approximative, dite comme telle dans la bulle).
// Une adresse qui ne cite que « Dakar » est posée au centre de Dakar.
import { companiesList } from "@/app/recrutement-journalier/RecrutementJournalierClient";

const QUARTIERS = [
  { motif: /mousse diop/, nom: "Plateau", lat: 14.673, lng: -17.438 },
  { motif: /almadies/, nom: "Almadies", lat: 14.745, lng: -17.526 },
  { motif: /\bngor\b/, nom: "Ngor", lat: 14.751, lng: -17.513 },
  { motif: /mermoz|ouakam/, nom: "Mermoz / Ouakam", lat: 14.711, lng: -17.488 },
  { motif: /\byoff\b/, nom: "Yoff", lat: 14.756, lng: -17.468 },
  { motif: /bel-air|bel air|hydrocarbures/, nom: "Bel-Air", lat: 14.6985, lng: -17.431 },
  { motif: /\bhann\b/, nom: "Hann", lat: 14.726, lng: -17.434 },
  { motif: /centenaire/, nom: "Boulevard du Centenaire", lat: 14.706, lng: -17.448 },
  { motif: /thiaroye/, nom: "Thiaroye", lat: 14.748, lng: -17.355 },
  { motif: /pikine/, nom: "Pikine", lat: 14.7549, lng: -17.3985 },
  { motif: /gu[ée]diawaye/, nom: "Guédiawaye", lat: 14.7692, lng: -17.39 },
  { motif: /km 22/, nom: "Route de Rufisque (km 22)", lat: 14.732, lng: -17.33 },
  { motif: /rufisque/, nom: "Route de Rufisque", lat: 14.735, lng: -17.38 },
  { motif: /zone industrielle/, nom: "Zone industrielle", lat: 14.714, lng: -17.435 },
];
const DAKAR = { nom: "Dakar", lat: 14.6937, lng: -17.4441 };

function normaliser(t) {
  return String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** Les dépôts sur place avec une position approximative (quartier cité dans l'adresse, sinon centre de Dakar). */
export function depotsAvecPosition() {
  return companiesList.map((c) => {
    const texte = normaliser(c.location);
    const q = QUARTIERS.find((x) => x.motif.test(texte)) || DAKAR;
    return {
      id: c.id,
      nom: c.company_name,
      adresse: c.location,
      telephone: c.phone || null,
      categorie: c.category || "",
      quartier: q.nom,
      lat: q.lat,
      lng: q.lng,
    };
  });
}

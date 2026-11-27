import { infoStatut } from "@/lib/statutsCandidature";

// Statut tel que le CANDIDAT le voit : le vrai statut (« Contacté » n'est plus affiché « Envoyée »), jamais les notes du recruteur.
export default function BadgeStatutCandidature({ statut }) {
  const info = infoStatut(statut);
  return <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold border whitespace-nowrap ${info.classe}`}>{info.candidat}</span>;
}

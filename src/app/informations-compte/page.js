import InformationsCompte from "./InformationsCompte";

export const metadata = {
  title: "Informations du compte — Facilité",
  robots: { index: false, follow: false },
};

// Page réservée aux personnes connectées (le proxy renvoie les autres vers la connexion). Toute la logique est côté serveur (/api/compte/*).
export default function InformationsComptePage() {
  return <InformationsCompte />;
}

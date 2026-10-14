import HomeClient from "../HomeClient";

// « Autour de moi » de Facilité : où recrutent les entreprises. Même mise en
// page que l'accueil (colonnes de gauche et de droite conservées) ; seule la
// colonne du milieu montre la carte (voir AutourCentre.jsx).
export const metadata = { title: "Autour de moi — où recrutent les entreprises | Facilité" };

export default function AutourPage() {
  return <HomeClient initialOffers={[]} mode="autour" />;
}

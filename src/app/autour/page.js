import HomeClient from "../HomeClient";

// « Autour de moi » de Facilité : où recrutent les entreprises. Même mise en
// page que l'accueil (colonnes de gauche et de droite conservées) ; seule la
// colonne du milieu montre la carte (voir AutourCentre.jsx).
// Le modèle de titre du site ajoute la marque.
export const metadata = {
  title: "Autour de moi : où recrutent les entreprises",
  description: "La carte des entreprises qui recrutent près de vous au Sénégal : les offres approuvées de Facilité, placées sur la carte.",
};

export default function AutourPage() {
  return <HomeClient initialOffers={[]} mode="autour" />;
}

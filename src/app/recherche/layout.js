import { canonicalMetadata } from "@/lib/staticPageMetadata";

// La page est un composant client (pas d'export de métadonnées possible) : titre et description vivent ici. Le modèle de titre du site ajoute la marque.
export const metadata = {
  ...canonicalMetadata("/recherche"),
  title: "Rechercher sur le site",
  description: "Recherchez des offres d'emploi, des entreprises, des modèles de CV et des réponses à vos questions sur Facilité.",
};

export default function RechercheLayout({ children }) {
  return children;
}

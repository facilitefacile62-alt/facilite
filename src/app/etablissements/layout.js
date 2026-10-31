import { canonicalMetadata } from "@/lib/staticPageMetadata";

// La page est un composant client (pas d'export de métadonnées possible) : titre et description vivent ici. Le modèle de titre du site ajoute la marque.
export const metadata = {
  ...canonicalMetadata("/etablissements"),
  title: "Établissements ouverts près de moi",
  description: "Trouvez les établissements ouverts autour de vous, comme les pharmacies de garde, avec leur dernier statut déclaré par le commerçant.",
};

export default function EtablissementsLayout({ children }) {
  return children;
}

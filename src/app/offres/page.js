import { canonicalMetadata } from "@/lib/staticPageMetadata";
import { chargerOffresOuvertes } from "@/lib/offresOuvertesServeur";
import OffresClient from "./OffresClient";
import OffresOuvertesLiens from "./OffresOuvertesLiens";

// Wrapper serveur pur (même patron que /in, /recruteurs) : OffresClient
// reste intégralement inchangé. La liste elle-même n'a qu'une seule URL
// canonique — les pages individuelles ont déjà la leur (offres/[id]/page.js).
export const metadata = {
  ...canonicalMetadata("/offres"),
  title: "Offres d'emploi au Sénégal : CDI, CDD et stages",
  description: "Toutes les offres d'emploi, stages et concours au Sénégal : Dakar, Thiès et partout dans le pays. Consultez les offres ouvertes et postulez en ligne.",
};

export default async function Page() {
  // Liens des offres ouvertes dans le HTML (offres actives et non expirées seulement) : la liste interactive se charge après coup dans le navigateur, les moteurs de
  // recherche n'y verraient aucun lien. Sans effet sur la liste elle-même.
  const offresOuvertes = await chargerOffresOuvertes();
  return (
    <>
      <OffresClient />
      <OffresOuvertesLiens offres={offresOuvertes} />
    </>
  );
}

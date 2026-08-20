import { canonicalMetadata } from "@/lib/staticPageMetadata";
import RecrutementJournalierClient from "./RecrutementJournalierClient";

// Wrapper serveur pur (même patron que /in, /recruteurs) :
// RecrutementJournalierClient reste intégralement inchangé.
export const metadata = canonicalMetadata("/recrutement-journalier");

export default function Page() {
  return <RecrutementJournalierClient />;
}

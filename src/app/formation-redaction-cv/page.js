import { orangeMoneyActif } from "@/lib/orangeMoneyActif";
import FormationRedactionCvClient from "./FormationRedactionCvClient";

// Lit ORANGE_MONEY_ENABLED à chaque requête (et non figé au moment du build).
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Formation Rédaction de CV | Facilité",
  description: "Formation payante à la rédaction de CV avec certification rédacteur — Facilité.",
};

export default function FormationRedactionCvPage() {
  return <FormationRedactionCvClient orangeActif={orangeMoneyActif()} />;
}

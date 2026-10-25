import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ID_INTERRUPTEUR_TELEPHONE, telephoneOuvert } from "./connexionTelephoneRegle.js";

// Interrupteur « connexion et inscription par téléphone » (table feature_flags, ligne feat_connexion_telephone, lisible sans connexion). FERMÉ par défaut :
// le téléphone n'est proposé que si la ligne a été LUE et vaut « ouvert » (règle : connexionTelephoneRegle.js). Ligne absente, table illisible, réseau coupé, erreur :
// fermé. Fermé, le site ne montre que « Continuer avec Google » et l'e-mail. L'application a le même interrupteur (mobile/src/lib/featureFlags.ts).
// Cacher les boutons ne coupe pas à lui seul les SMS payants (l'envoi de code reste appelable directement) : voir la route du hook SMS pour le refus côté serveur.

/** Vrai si le téléphone est proposé. Faux tant que la lecture n'est pas terminée, et en cas de doute. */
export function useConnexionTelephoneOuverte() {
  const [ouvert, setOuvert] = useState(false);
  useEffect(() => {
    let actif = true;
    supabase
      .from("feature_flags")
      .select("enabled, roles")
      .eq("id", ID_INTERRUPTEUR_TELEPHONE)
      .maybeSingle()
      .then(({ data, error }) => {
        if (actif) setOuvert(!error && telephoneOuvert(data));
      })
      .catch(() => {
        if (actif) setOuvert(false);
      });
    return () => {
      actif = false;
    };
  }, []);
  return ouvert;
}

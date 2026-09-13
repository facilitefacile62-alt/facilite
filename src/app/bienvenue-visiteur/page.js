"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

// Étape 3 (branche Visiteur) : seuls Nom + Prénom, pré-remplis si déjà
// connus (inscription e-mail, qui les collecte déjà sur /register — sans
// ça redondant) sinon vides (inscription téléphone, qui ne les demande
// jamais). Écrit dans profiles.full_name, aucune nouvelle colonne : ce
// choix Visiteur/Vendeur n'est qu'un embranchement de ce parcours, rien
// n'existe encore en aval qui ait besoin de le lire une fois passé (voir
// le rapport de ce point pour la décision détaillée).
function BienvenueVisiteurContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [chargement, setChargement] = useState(true);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");

  const rawRedirect = searchParams.get("redirect") || "/";
  const safeRedirect = rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") ? rawRedirect : "/";

  useEffect(() => {
    let annule = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!annule && user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle();
        const fullName = (profile?.full_name || user.user_metadata?.full_name || "").trim();
        if (fullName) {
          // Dernier mot = nom de famille, le reste = prénom(s) — même
          // convention que VueReglages (MarketplaceClient.jsx).
          const parts = fullName.split(" ");
          setPrenom(parts.length > 1 ? parts.slice(0, -1).join(" ") : parts[0] || "");
          setNom(parts.length > 1 ? parts[parts.length - 1] : "");
        }
      }
      if (!annule) setChargement(false);
    })();
    return () => {
      annule = true;
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErreur("");
    if (!prenom.trim() || !nom.trim()) {
      setErreur("Merci de renseigner votre nom et votre prénom.");
      return;
    }
    setEnCours(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("profiles")
          .update({
            full_name: `${prenom.trim()} ${nom.trim()}`.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", user.id);
      }
      router.push(safeRedirect);
    } catch (err) {
      console.error("Erreur enregistrement nom/prénom (bienvenue-visiteur):", err);
      setErreur("Une erreur est survenue. Réessayez.");
      setEnCours(false);
    }
  };

  if (chargement) {
    return (
      <div className="min-h-screen bg-[#FAF6F1] flex items-center justify-center">
        <i className="fa-solid fa-circle-notch fa-spin text-2xl text-emerald-600"></i>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100dvh-60px)] bg-[#FAF6F1]/50 font-sans flex flex-col justify-center items-center px-3 sm:px-4">
      <main className="w-full max-w-md">
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-gray-100 space-y-6">
          <div className="text-center">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mb-2">
              Comment vous appelez-vous ?
            </h1>
            <p className="text-sm font-medium text-gray-500">
              Pour que les boutiques sachent à qui elles s&apos;adressent.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Prénom</label>
                <input
                  type="text"
                  value={prenom}
                  onChange={(e) => setPrenom(e.target.value)}
                  required
                  placeholder="Votre prénom"
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-sm font-medium placeholder-gray-400 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">Nom</label>
                <input
                  type="text"
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  required
                  placeholder="Votre nom"
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-sm font-medium placeholder-gray-400 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition"
                />
              </div>
            </div>

            {erreur && (
              <p className="text-xs font-semibold text-red-500 bg-red-50 p-2.5 rounded-lg border border-red-100">
                ⚠️ {erreur}
              </p>
            )}

            <button
              type="submit"
              disabled={enCours}
              className="w-full py-3.5 px-4 bg-[#10E688] hover:bg-[#0ed37c] text-gray-900 font-extrabold text-sm rounded-2xl shadow-md hover:shadow-lg transition-all duration-200 active:scale-[0.99] cursor-pointer disabled:opacity-60 flex items-center justify-center"
            >
              {enCours ? (
                <span className="inline-block w-4 h-4 border-2 border-gray-900 border-t-transparent rounded-full animate-spin"></span>
              ) : (
                "Continuer"
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

export default function BienvenueVisiteurPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FAF6F1] flex items-center justify-center"><i className="fa-solid fa-circle-notch fa-spin text-2xl text-emerald-600"></i></div>}>
      <BienvenueVisiteurContent />
    </Suspense>
  );
}

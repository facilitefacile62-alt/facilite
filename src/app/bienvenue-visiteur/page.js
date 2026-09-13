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
      <div className="min-h-screen bg-[#FAF6F1] dark:bg-zinc-950 flex items-center justify-center">
        <i className="fa-solid fa-circle-notch fa-spin text-2xl text-emerald-600"></i>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100dvh-60px)] bg-[#FAF6F1]/60 dark:bg-zinc-950 font-sans flex flex-col justify-center items-center px-3 sm:px-4 py-6 transition-colors">
      <main className="w-full max-w-md">
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 sm:p-8 shadow-xl border border-gray-100 dark:border-zinc-800 space-y-6">
          <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-2xl mx-auto shadow-xs">
            <i className="fa-solid fa-user-tag"></i>
          </div>
          <div className="text-center">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-2">
              Comment vous appelez-vous ?
            </h1>
            <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 leading-relaxed">
              Pour que les boutiques sachent à qui elles s&apos;adressent.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Prénom</label>
                <input
                  type="text"
                  value={prenom}
                  onChange={(e) => setPrenom(e.target.value)}
                  required
                  placeholder="Votre prénom"
                  className="w-full px-4 py-3 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-white rounded-xl text-sm font-medium placeholder-gray-400 focus:outline-none focus:border-gray-900 dark:focus:border-white focus:ring-1 focus:ring-gray-900 dark:focus:ring-white transition"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Nom</label>
                <input
                  type="text"
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  required
                  placeholder="Votre nom"
                  className="w-full px-4 py-3 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 text-gray-900 dark:text-white rounded-xl text-sm font-medium placeholder-gray-400 focus:outline-none focus:border-gray-900 dark:focus:border-white focus:ring-1 focus:ring-gray-900 dark:focus:ring-white transition"
                />
              </div>
            </div>

            {erreur && (
              <p className="text-xs font-semibold text-red-500 bg-red-50 dark:bg-red-950/40 p-2.5 rounded-lg border border-red-100 dark:border-red-900/50">
                ⚠️ {erreur}
              </p>
            )}

            <button
              type="submit"
              disabled={enCours}
              className="w-full py-3.5 px-4 bg-[#10E688] hover:bg-[#0ed37c] text-gray-950 font-black text-sm rounded-2xl shadow-md hover:shadow-lg transition-all duration-200 active:scale-[0.98] cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
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
    <Suspense fallback={<div className="min-h-screen bg-[#FAF6F1] dark:bg-zinc-950 flex items-center justify-center"><i className="fa-solid fa-circle-notch fa-spin text-2xl text-emerald-600"></i></div>}>
      <BienvenueVisiteurContent />
    </Suspense>
  );
}

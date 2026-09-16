"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

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
      const destination = safeRedirect === "/" ? "/marketplace" : safeRedirect;
      router.push(destination);
    } catch (err) {
      console.error("Erreur enregistrement nom/prénom (bienvenue-visiteur):", err);
      setErreur("Une erreur est survenue. Réessayez.");
      setEnCours(false);
    }
  };

  if (chargement) {
    return (
      <div className="min-h-screen bg-[#81b886] dark:bg-zinc-950 flex items-center justify-center">
        <i className="fa-solid fa-circle-notch fa-spin text-3xl text-white"></i>
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100dvh-60px)] bg-gradient-to-br from-[#8ec494] via-[#7caa81] to-[#6a9d70] dark:from-[#0d1713] dark:via-[#12221b] dark:to-[#0a110e] font-sans flex flex-col justify-center items-center px-4 py-8 overflow-hidden transition-colors selection:bg-[#10E688] selection:text-black">
      {/* Motif Telegram Doodle Pattern en arrière-plan */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none opacity-[0.14] dark:opacity-[0.06] mix-blend-multiply dark:mix-blend-screen"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='240' height='240' viewBox='0 0 240 240' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%230f381e' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M25 25 L55 35 L40 55 L35 42 L25 25 Z' /%3E%3Cpath d='M55 35 L35 42' /%3E%3Cpath d='M140 30 C155 30 165 40 165 52 C165 65 150 72 135 72 L125 78 L127 70 C120 68 115 60 115 52 C115 40 125 30 140 30 Z' /%3E%3Ccircle cx='200' cy='40' r='8' /%3E%3Cpath d='M200 48 L200 70 M195 62 L200 62 M195 68 L200 68' /%3E%3Cpath d='M85 95 L88 103 L96 103 L90 108 L92 116 L85 111 L78 116 L80 108 L74 103 L82 103 Z' /%3E%3Crect x='25' y='140' width='30' height='22' rx='4' /%3E%3Cpath d='M33 140 V134 C33 132 35 130 37 130 H43 C45 130 47 132 47 134 V140' /%3E%3Cpath d='M145 140 C140 135 132 135 127 140 C122 145 122 153 127 158 L145 175 L163 158 C168 153 168 145 163 140 C158 135 150 135 145 140 Z' /%3E%3Cpath d='M195 140 L220 140 L215 165 L200 165 Z' /%3E%3Cpath d='M195 140 C195 148 200 152 205 152 C210 152 215 148 215 140' /%3E%3Cpath d='M70 200 L70 180 L85 175 L85 195' /%3E%3Ccircle cx='65' cy='200' r='5' /%3E%3Ccircle cx='80' cy='195' r='5' /%3E%3Cpath d='M140 215 C145 222 155 222 160 215' /%3E%3Ccircle cx='138' cy='205' r='1.5' fill='%230f381e' /%3E%3Ccircle cx='162' cy='205' r='1.5' fill='%230f381e' /%3E%3C/g%3E%3C/svg%3E")`,
          backgroundSize: "220px 220px",
        }}
      ></div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[34rem] h-[34rem] bg-white/20 dark:bg-emerald-500/10 rounded-full blur-3xl"
      ></div>

      <main className="relative w-full max-w-[420px] z-10 animate-fade-in-up">
        <div className="bg-white dark:bg-zinc-900 rounded-[28px] sm:rounded-[32px] p-7 sm:p-9 shadow-[0_25px_60px_-15px_rgba(15,45,25,0.30)] dark:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.6)] border border-white/60 dark:border-zinc-800 space-y-6 backdrop-blur-xs text-center">
          
          <div className="relative inline-flex items-center justify-center mx-auto">
            <div className="absolute inset-0 rounded-full bg-[#10E688]/30 dark:bg-[#10E688]/20 blur-xl scale-125"></div>
            <div className="relative w-20 h-20 rounded-full bg-[#FAF6F1]/80 dark:bg-zinc-800/90 border-2 border-emerald-100 dark:border-emerald-900/60 ring-8 ring-emerald-500/10 dark:ring-emerald-400/5 flex items-center justify-center text-3xl text-emerald-600 dark:text-emerald-400 shadow-md">
              <i className="fa-solid fa-user-tag drop-shadow-xs"></i>
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl sm:text-[27px] font-black text-gray-900 dark:text-white tracking-tight leading-tight">
              Comment vous appelez-vous ?
            </h1>
            <p className="text-[13px] sm:text-sm font-medium text-gray-500 dark:text-gray-400 leading-relaxed max-w-[320px] mx-auto">
              Pour que les boutiques sachent à qui elles s&apos;adressent.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">Prénom</label>
                <input
                  type="text"
                  value={prenom}
                  onChange={(e) => setPrenom(e.target.value)}
                  required
                  placeholder="Votre prénom"
                  className="w-full px-3.5 py-3 bg-gray-50/70 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white rounded-xl text-sm font-medium placeholder-gray-400 focus:outline-none focus:border-[#10E688] dark:focus:border-[#10E688] focus:ring-2 focus:ring-[#10E688]/20 transition"
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
                  className="w-full px-3.5 py-3 bg-gray-50/70 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-white rounded-xl text-sm font-medium placeholder-gray-400 focus:outline-none focus:border-[#10E688] dark:focus:border-[#10E688] focus:ring-2 focus:ring-[#10E688]/20 transition"
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
              className="w-full py-3.5 px-4 bg-[#10E688] hover:bg-[#0ed37c] text-gray-950 font-black text-sm rounded-2xl shadow-[0_8px_20px_-4px_rgba(16,230,136,0.5)] hover:shadow-[0_10px_25px_-3px_rgba(16,230,136,0.6)] transition-all duration-200 active:scale-[0.98] cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2 border border-emerald-300/50"
            >
              {enCours ? (
                <span className="inline-block w-4 h-4 border-2 border-gray-950 border-t-transparent rounded-full animate-spin"></span>
              ) : (
                "Continuer"
              )}
            </button>
          </form>

          <div className="pt-2 border-t border-gray-100 dark:border-zinc-800/80 flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/bienvenue-marketplace")}
              disabled={enCours}
              className="text-[12px] font-bold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white uppercase tracking-wider transition-colors py-1 cursor-pointer"
            >
              ‹ Revenir en arrière
            </button>
          </div>
        </div>

        <p className="text-center text-xs font-semibold text-white/80 dark:text-zinc-500 mt-5 drop-shadow-xs">
          © {new Date().getFullYear()} Facilité • Tous droits réservés
        </p>
      </main>
    </div>
  );
}

export default function BienvenueVisiteurPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#81b886] dark:bg-zinc-950 flex items-center justify-center"><i className="fa-solid fa-circle-notch fa-spin text-3xl text-white"></i></div>}>
      <BienvenueVisiteurContent />
    </Suspense>
  );
}


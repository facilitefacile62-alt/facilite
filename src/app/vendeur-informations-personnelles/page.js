"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { creerBoutique, chargerMesBoutiques } from "@/lib/marketplaceData";

function VendeurInformationsPersonnellesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [nomBoutique, setNomBoutique] = useState("");
  const [telephone, setTelephone] = useState("");
  const [ville, setVille] = useState("");
  const [typeBoutique, setTypeBoutique] = useState("produit"); // 'produit' | 'service' | 'etablissement'
  const [chargement, setChargement] = useState(true);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");

  const rawRedirect = searchParams.get("redirect") || "/";
  const safeRedirect = rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") ? rawRedirect : "/";
  const destinationFinale = safeRedirect === "/" ? "/marketplace?mode=vendeur" : safeRedirect;

  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!annule && user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, phone, address_city")
            .eq("id", user.id)
            .maybeSingle();

          const fullName = (profile?.full_name || user.user_metadata?.full_name || "").trim();
          if (fullName) {
            const parts = fullName.split(" ");
            setPrenom(parts.length > 1 ? parts.slice(0, -1).join(" ") : parts[0] || "");
            setNom(parts.length > 1 ? parts[parts.length - 1] : "");
          }
          if (profile?.phone) setTelephone(profile.phone);
          if (profile?.address_city) setVille(profile.address_city);

          // Pré-remplir le nom de la boutique si déjà existante
          const mesBoutiques = await chargerMesBoutiques(user.id).catch(() => []);
          if (mesBoutiques && mesBoutiques.length > 0) {
            setNomBoutique(mesBoutiques[0].nom || "");
            if (mesBoutiques[0].telephone_whatsapp) setTelephone(mesBoutiques[0].telephone_whatsapp);
            if (mesBoutiques[0].ville) setVille(mesBoutiques[0].ville);
            if (mesBoutiques[0].type_boutique) setTypeBoutique(mesBoutiques[0].type_boutique);
          }
        }
      } catch (e) {
        console.warn("Erreur chargement profil vendeur:", e);
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
      setErreur("Veuillez renseigner votre nom et prénom.");
      return;
    }

    setEnCours(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push(destinationFinale);
        return;
      }

      const nomComplet = `${prenom.trim()} ${nom.trim()}`.trim();

      // 1. Mise à jour du profil utilisateur
      await supabase
        .from("profiles")
        .update({
          full_name: nomComplet,
          phone: telephone.trim() || null,
          address_city: ville.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      // 2. Si un nom de boutique est renseigné, création ou configuration de la boutique
      if (nomBoutique.trim()) {
        try {
          const mesBoutiques = await chargerMesBoutiques(user.id).catch(() => []);
          if (!mesBoutiques || mesBoutiques.length === 0) {
            await creerBoutique(user.id, {
              nom: nomBoutique.trim(),
              type_boutique: typeBoutique,
              telephone_whatsapp: telephone.trim() || null,
              ville: ville.trim() || null,
            });
          }
        } catch (bErr) {
          console.warn("Création boutique reportée ou existante:", bErr);
        }
      }

      router.push(destinationFinale);
    } catch (err) {
      console.error("Erreur enregistrement profil vendeur:", err);
      setErreur("Une erreur est survenue lors de l'enregistrement.");
      setEnCours(false);
    }
  };

  const handlePasser = () => {
    router.push(destinationFinale);
  };

  if (chargement) {
    return (
      <div className="min-h-screen bg-[#FAF6F1] dark:bg-zinc-950 flex items-center justify-center">
        <i className="fa-solid fa-circle-notch fa-spin text-2xl text-emerald-600"></i>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100dvh-60px)] bg-[#FAF6F1]/60 dark:bg-zinc-950 font-sans flex flex-col justify-center items-center px-3 sm:px-4 py-8 transition-colors">
      <main className="w-full max-w-lg">
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 sm:p-8 shadow-xl border border-gray-100 dark:border-zinc-800 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-2xl mx-auto shadow-xs">
              <i className="fa-solid fa-store"></i>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              Informations Vendeur
            </h1>
            <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">
              Configurez votre profil professionnel pour commencer à vendre sur le Marketplace.
            </p>
          </div>

          {erreur && (
            <div className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-2xl text-xs font-bold text-red-700 dark:text-red-300 flex items-center gap-2">
              <i className="fa-solid fa-circle-exclamation flex-shrink-0"></i>
              <span>{erreur}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Responsable : Prénom + Nom */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  Prénom *
                </label>
                <input
                  type="text"
                  required
                  value={prenom}
                  onChange={(e) => setPrenom(e.target.value)}
                  placeholder="Ex. Moussa"
                  className="w-full px-3.5 py-2.5 text-sm bg-gray-50 dark:bg-zinc-800/80 border border-gray-200 dark:border-zinc-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  Nom *
                </label>
                <input
                  type="text"
                  required
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  placeholder="Ex. Diop"
                  className="w-full px-3.5 py-2.5 text-sm bg-gray-50 dark:bg-zinc-800/80 border border-gray-200 dark:border-zinc-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                />
              </div>
            </div>

            {/* Nom de la boutique */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                Nom de votre boutique / activité
              </label>
              <input
                type="text"
                value={nomBoutique}
                onChange={(e) => setNomBoutique(e.target.value)}
                placeholder="Ex. Diop High-Tech & Services"
                className="w-full px-3.5 py-2.5 text-sm bg-gray-50 dark:bg-zinc-800/80 border border-gray-200 dark:border-zinc-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
              />
            </div>

            {/* Type d'activité */}
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                Type d&apos;activité
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setTypeBoutique("produit")}
                  className={`py-2 px-2 text-xs font-bold rounded-xl border transition cursor-pointer text-center ${
                    typeBoutique === "produit"
                      ? "bg-emerald-50 dark:bg-emerald-950/80 border-emerald-500 text-emerald-700 dark:text-emerald-300 shadow-xs"
                      : "bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-gray-400"
                  }`}
                >
                  <i className="fa-solid fa-box block mb-1 text-sm"></i>
                  <span>Produits</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTypeBoutique("service")}
                  className={`py-2 px-2 text-xs font-bold rounded-xl border transition cursor-pointer text-center ${
                    typeBoutique === "service"
                      ? "bg-emerald-50 dark:bg-emerald-950/80 border-emerald-500 text-emerald-700 dark:text-emerald-300 shadow-xs"
                      : "bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-gray-400"
                  }`}
                >
                  <i className="fa-solid fa-handshake block mb-1 text-sm"></i>
                  <span>Services</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTypeBoutique("etablissement")}
                  className={`py-2 px-2 text-xs font-bold rounded-xl border transition cursor-pointer text-center ${
                    typeBoutique === "etablissement"
                      ? "bg-emerald-50 dark:bg-emerald-950/80 border-emerald-500 text-emerald-700 dark:text-emerald-300 shadow-xs"
                      : "bg-gray-50 dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-gray-400"
                  }`}
                >
                  <i className="fa-solid fa-building block mb-1 text-sm"></i>
                  <span>Lieu fixe</span>
                </button>
              </div>
            </div>

            {/* Téléphone & Ville */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  Téléphone (WhatsApp)
                </label>
                <input
                  type="tel"
                  value={telephone}
                  onChange={(e) => setTelephone(e.target.value)}
                  placeholder="Ex. +221 77 000 00 00"
                  className="w-full px-3.5 py-2.5 text-sm bg-gray-50 dark:bg-zinc-800/80 border border-gray-200 dark:border-zinc-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                  Ville / Commune
                </label>
                <input
                  type="text"
                  value={ville}
                  onChange={(e) => setVille(e.target.value)}
                  placeholder="Ex. Dakar, Abidjan..."
                  className="w-full px-3.5 py-2.5 text-sm bg-gray-50 dark:bg-zinc-800/80 border border-gray-200 dark:border-zinc-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
                />
              </div>
            </div>

            <div className="pt-2 space-y-2.5">
              <button
                type="submit"
                disabled={enCours}
                className="w-full py-3.5 px-4 bg-[#10E688] hover:bg-[#0ed37c] text-gray-950 font-black text-sm rounded-2xl shadow-md hover:shadow-lg transition-all duration-200 active:scale-[0.98] cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {enCours ? (
                  <>
                    <i className="fa-solid fa-circle-notch fa-spin text-sm"></i>
                    <span>Enregistrement...</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-check text-sm"></i>
                    <span>Valider et ouvrir mon espace vendeur</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handlePasser}
                disabled={enCours}
                className="w-full py-2.5 px-4 text-xs font-bold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition cursor-pointer text-center"
              >
                Passer et configurer plus tard
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

export default function VendeurInformationsPersonnellesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FAF6F1] dark:bg-zinc-950 flex items-center justify-center">
          <i className="fa-solid fa-circle-notch fa-spin text-2xl text-emerald-600"></i>
        </div>
      }
    >
      <VendeurInformationsPersonnellesContent />
    </Suspense>
  );
}

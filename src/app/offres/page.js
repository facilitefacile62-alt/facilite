/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import ApplyModal from "@/components/ApplyModal";

export const dynamic = "force-dynamic";

const EDUCATION_LEVELS = ["Aucun", "CM2", "Brevet", "BAC", "Licence", "Master", "Doctorat"];
const levelRank = (level) => {
  const idx = EDUCATION_LEVELS.indexOf(level || "Aucun");
  return idx === -1 ? 0 : idx;
};

export default function OffresPage() {
  const [userSession, setUserSession] = useState(null);
  const [candidateEducationLevel, setCandidateEducationLevel] = useState("Aucun");
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [applyingOffer, setApplyingOffer] = useState(null);
  const [toast, setToast] = useState("");

  const triggerToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  };

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUserSession(session);

        if (session?.user?.id) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("education_level, degree")
            .eq("id", session.user.id)
            .single();
          setCandidateEducationLevel(profile?.degree || profile?.education_level || "Aucun");
        }

        // Récupérer toutes les offres d'emploi publiques sans bloquer sur un filtre de statut restrictif
        const { data, error } = await supabase
          .from("job_offers")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Erreur chargement des offres:", error);
        } else {
          // Filtrer dynamiquement côté client (is_active !== false ET status !== 'closed' / 'paused')
          const activeOffers = (data || []).filter(
            (o) => o.is_active !== false && o.status !== "closed" && o.status !== "paused"
          );
          setOffers(activeOffers);
        }
      } catch (err) {
        console.error("Exception chargement des offres:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const filteredOffers = offers.filter((o) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q || (o.title || "").toLowerCase().includes(q) || (o.company || "").toLowerCase().includes(q);
    const matchesLocation = !locationFilter || (o.location || "").toLowerCase().includes(locationFilter.toLowerCase());
    return matchesSearch && matchesLocation;
  });

  const handleApplyClick = (offer) => {
    if (!userSession) {
      window.location.href = "/login";
      return;
    }
    const eligible = levelRank(candidateEducationLevel) >= levelRank(offer.min_education_level);
    if (!eligible) return; // le bouton est déjà désactivé dans ce cas, sécurité supplémentaire
    setApplyingOffer(offer);
  };

  return (
    <div className="min-h-screen bg-[#FAF6F1] font-sans flex flex-col">
      {/* Toast */}
      <div
        className={`fixed top-20 right-4 z-[700] bg-gray-900 text-white px-5 py-3 rounded-2xl shadow-2xl transition-all duration-300 transform ${
          toast ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0 pointer-events-none"
        }`}
      >
        <span className="text-sm font-semibold">{toast}</span>
      </div>

      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <img src="/logo.jpeg" alt="Logo Facilite" className="w-9 h-9 rounded-full object-cover shadow-sm border border-gray-200" />
            <span className="text-xl font-extrabold text-gray-900 tracking-tight">Facilite</span>
          </Link>
          <Link
            href={userSession ? "/profil" : "/login"}
            className="text-xs font-bold text-gray-700 hover:text-emerald-700 bg-gray-100 hover:bg-emerald-50 px-3.5 py-2 rounded-xl transition"
          >
            {userSession ? "Mon profil" : "Se connecter"}
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        <div className="bg-gradient-to-r from-emerald-800 to-teal-900 rounded-3xl p-6 sm:p-8 text-white mb-8 shadow-xl">
          <span className="text-xs font-extrabold text-emerald-300 uppercase tracking-widest block mb-2">Recherche d'emploi</span>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight mb-3">Toutes les offres</h1>
          <p className="text-sm text-emerald-100 font-medium leading-relaxed">
            Parcourez les offres publiées par nos recruteurs et postulez directement en ligne.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative max-w-xs w-full">
            <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-3.5 text-gray-400 text-xs"></i>
            <input
              type="text"
              placeholder="Titre, entreprise..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-emerald-500 transition shadow-xs"
            />
          </div>
          <div className="relative max-w-xs w-full">
            <i className="fa-solid fa-location-dot absolute left-3.5 top-3.5 text-gray-400 text-xs"></i>
            <input
              type="text"
              placeholder="Localisation..."
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-emerald-500 transition shadow-xs"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : filteredOffers.length === 0 ? (
          <div className="text-center text-gray-400 italic text-sm py-16">Aucune offre disponible pour le moment.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredOffers.map((offer) => {
              const eligible = levelRank(candidateEducationLevel) >= levelRank(offer.min_education_level);
              return (
                <div key={offer.id} className="bg-white rounded-3xl border border-gray-200 shadow-xs overflow-hidden flex flex-col">
                  {offer.image_url && (
                    <img src={offer.image_url} alt={offer.title} className="w-full h-36 object-cover" />
                  )}
                  <div className="p-5 flex flex-col flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-blue-100 text-blue-700">
                        {offer.contract_type}
                      </span>
                      {offer.min_education_level && offer.min_education_level !== "Aucun" && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-purple-100 text-purple-700">
                          🎓 {offer.min_education_level}
                        </span>
                      )}
                    </div>
                    <h3 className="font-extrabold text-gray-900 text-sm mb-1">{offer.title}</h3>
                    <p className="text-xs text-gray-500 font-semibold mb-1">{offer.company}</p>
                    <p className="text-[11px] text-gray-400 font-medium mb-3">
                      <i className="fa-solid fa-location-dot mr-1"></i>
                      {offer.location}
                      {offer.salary_range && <span> · {offer.salary_range}</span>}
                    </p>
                    <p className="text-xs text-gray-600 leading-relaxed line-clamp-3 flex-1 mb-4">{offer.description}</p>

                    {userSession && !eligible && (
                      <p className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 mb-2 flex items-center gap-1.5">
                        <i className="fa-solid fa-triangle-exclamation"></i>
                        Niveau requis : {offer.min_education_level}. Complétez votre profil pour postuler.
                      </p>
                    )}

                    <button
                      onClick={() => handleApplyClick(offer)}
                      disabled={userSession && !eligible}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-300 disabled:bg-gray-300"
                    >
                      {userSession && !eligible ? "Niveau insuffisant" : "Postuler"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <ApplyModal
        isOpen={!!applyingOffer}
        onClose={() => setApplyingOffer(null)}
        job={
          applyingOffer
            ? {
                id: applyingOffer.id,
                titleFR: applyingOffer.title,
                titleEN: applyingOffer.title,
                company: applyingOffer.company,
              }
            : null
        }
        selectedLang="FR"
        triggerToast={triggerToast}
      />

      <footer className="bg-white border-t border-gray-200 py-4 text-center text-xs font-medium text-gray-500">
        © 2026 Facilite. Toutes les offres d'emploi.
      </footer>
    </div>
  );
}

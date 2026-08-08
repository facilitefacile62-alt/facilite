/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import ApplyModal from "@/components/ApplyModal";

export const dynamic = "force-dynamic";

const EDUCATION_LEVELS = ["Aucun", "CM2", "Brevet", "BAC", "Licence", "Master", "Doctorat"];
const levelRank = (level) => {
  const idx = EDUCATION_LEVELS.indexOf(level || "Aucun");
  return idx === -1 ? 0 : idx;
};

function OffresContent() {
  const searchParams = useSearchParams();
  const queryParam = searchParams?.get("q") || "";

  const [userSession, setUserSession] = useState(null);
  const [candidateEducationLevel, setCandidateEducationLevel] = useState("Aucun");
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(queryParam);
  const [locationFilter, setLocationFilter] = useState("");
  const [applyingOffer, setApplyingOffer] = useState(null);
  // Stabilise la référence de job passé à ApplyModal — voir
  // OffreApplySection.jsx pour l'explication complète du bug.
  const stableApplyingJob = useMemo(() => {
    if (!applyingOffer) return null;
    return {
      id: applyingOffer.id,
      titleFR: applyingOffer.title,
      titleEN: applyingOffer.title,
      company: applyingOffer.company,
      isSpontaneous: applyingOffer.isSpontaneous,
    };
  }, [applyingOffer?.id, applyingOffer?.title, applyingOffer?.company, applyingOffer?.isSpontaneous]);
  const [toast, setToast] = useState("");

  const [semanticResults, setSemanticResults] = useState(null);
  const [isSemanticSearching, setIsSemanticSearching] = useState(false);
  const [semanticSearchError, setSemanticSearchError] = useState("");

  const triggerToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  };

  useEffect(() => {
    if (queryParam) {
      setSearchQuery(queryParam);
    }
  }, [queryParam]);

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUserSession(session);

        if (session?.user?.id) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", session.user.id)
            .single();
          setCandidateEducationLevel(profile?.degree || profile?.education_level || "Aucun");
        }

        const { data, error } = await supabase
          .from("job_offers")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Erreur chargement des offres:", error);
        } else {
          const activeOffers = (data || []).filter((o) => o.is_active !== false);
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

  const handleSemanticSearch = async () => {
    const query = searchQuery.trim();
    if (!query) return;

    setIsSemanticSearching(true);
    setSemanticSearchError("");

    try {
      const { data: embedData, error: embedError } = await supabase.functions.invoke("gemini-orchestrator", {
        body: { action: "embed", text: query },
      });

      if (embedError || !embedData?.success || !Array.isArray(embedData?.embedding)) {
        throw new Error(embedData?.error || embedError?.message || "Échec de la génération de l'embedding.");
      }

      const { data: matches, error: matchError } = await supabase.rpc("match_job_offers", {
        query_embedding: `[${embedData.embedding.join(",")}]`,
        match_threshold: 0.5,
        match_count: 10,
      });

      if (matchError) {
        throw matchError;
      }

      const simMap = {};
      (matches || []).forEach((m) => {
        simMap[m.id] = m.similarity;
      });
      setSemanticResults(simMap);
    } catch (err) {
      console.error("Erreur recherche sémantique:", err);
      setSemanticSearchError(err?.message || "Erreur lors de la recherche sémantique.");
    } finally {
      setIsSemanticSearching(false);
    }
  };

  const handleResetSearch = () => {
    setSearchQuery("");
    setSemanticResults(null);
    setSemanticSearchError("");
  };

  const filteredOffers = offers.filter((offer) => {
    if (semanticResults !== null) {
      if (!(offer.id in semanticResults)) return false;
    } else if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = offer.title?.toLowerCase().includes(q);
      const matchComp = offer.company?.toLowerCase().includes(q);
      const matchDesc = offer.description?.toLowerCase().includes(q);
      const matchLoc = offer.location?.toLowerCase().includes(q);

      const reqSkills = Array.isArray(offer.required_skills)
        ? offer.required_skills.join(" ").toLowerCase()
        : (offer.required_skills || "").toLowerCase();
      const matchSkills = reqSkills.includes(q);

      if (!matchTitle && !matchComp && !matchDesc && !matchLoc && !matchSkills) {
        return false;
      }
    }

    if (locationFilter) {
      const locMatch = offer.location?.toLowerCase().includes(locationFilter.toLowerCase());
      if (!locMatch) return false;
    }

    return true;
  });

  if (semanticResults !== null) {
    filteredOffers.sort((a, b) => {
      const simA = semanticResults[a.id] || 0;
      const simB = semanticResults[b.id] || 0;
      return simB - simA;
    });
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 text-gray-900 font-sans pb-16">
      <div
        className={`fixed top-20 right-4 z-[700] bg-gray-900 text-white px-5 py-3 rounded-2xl shadow-2xl transition-all duration-300 transform ${
          toast ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0 pointer-events-none"
        }`}
      >
        <span className="text-sm font-semibold">{toast}</span>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-12 flex-1 w-full">
        <div className="bg-gradient-to-r from-emerald-800 to-teal-900 rounded-3xl p-6 sm:p-10 text-white mb-8 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <i className="fa-solid fa-briefcase text-9xl"></i>
          </div>
          <span className="text-xs font-extrabold text-emerald-300 uppercase tracking-widest block mb-2 relative z-10">
            Catalogue des Emplois
          </span>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-4 relative z-10">
            Offres d'Emploi Disponibles
          </h1>
          <p className="text-base text-emerald-100 font-medium leading-relaxed max-w-2xl relative z-10">
            Explorez toutes les opportunités publiées par nos recruteurs partenaires au Sénégal. Postulez en un clic.
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs mb-8">
          <div className="flex flex-col md:flex-row items-center gap-4">
            <div className="relative flex-1 w-full">
              <i className="fa-solid fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
              <input
                type="text"
                placeholder="Mot-clé (titre, compétence, entreprise)..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (semanticResults !== null) setSemanticResults(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSemanticSearch();
                }}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
              />
            </div>

            <div className="relative w-full md:w-64">
              <i className="fa-solid fa-location-dot absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
              <input
                type="text"
                placeholder="Ville / Localisation..."
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
              />
            </div>

            <button
              onClick={handleSemanticSearch}
              disabled={isSemanticSearching || !searchQuery.trim()}
              className="w-full md:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold text-xs rounded-xl transition shadow-xs flex items-center justify-center gap-2 whitespace-nowrap"
            >
              {isSemanticSearching ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin"></i>
                  Analyse IA...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-wand-magic-sparkles"></i>
                  Recherche IA
                </>
              )}
            </button>

            {(searchQuery || locationFilter || semanticResults !== null) && (
              <button
                onClick={handleResetSearch}
                className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-extrabold text-xs rounded-xl transition whitespace-nowrap"
              >
                Réinitialiser
              </button>
            )}
          </div>

          {semanticSearchError && (
            <p className="text-xs font-semibold text-red-600 mt-2">
              <i className="fa-solid fa-triangle-exclamation mr-1"></i>
              {semanticSearchError}
            </p>
          )}

          {semanticResults !== null && (
            <div className="mt-3 flex items-center justify-between bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-xs text-emerald-900 font-medium">
              <span>
                <i className="fa-solid fa-brain mr-1.5 text-emerald-700"></i>
                Résultats triés par pertinence sémantique (IA) pour « <strong>{searchQuery}</strong> »
              </span>
              <button
                onClick={() => setSemanticResults(null)}
                className="text-emerald-700 font-bold underline hover:text-emerald-900"
              >
                Revenir au filtre texte
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="py-20 text-center">
            <i className="fa-solid fa-circle-notch fa-spin text-4xl text-emerald-600 mb-3"></i>
            <p className="text-sm font-bold text-gray-500">Chargement des offres d'emploi...</p>
          </div>
        ) : filteredOffers.length === 0 ? (
          <div className="bg-white rounded-3xl border border-gray-200 p-12 text-center max-w-lg mx-auto shadow-sm">
            <div className="w-16 h-16 bg-gray-100 text-gray-400 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl">
              <i className="fa-solid fa-briefcase"></i>
            </div>
            <h3 className="text-lg font-extrabold text-gray-900 mb-1">Aucune offre ne correspond</h3>
            <p className="text-xs text-gray-500 mb-6">
              Essayez de modifier vos termes de recherche ou réinitialisez les filtres.
            </p>
            <button
              onClick={handleResetSearch}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition"
            >
              Afficher toutes les offres
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredOffers.map((offer) => {
              const reqRank = levelRank(offer.required_education_level);
              const candRank = levelRank(candidateEducationLevel);
              const eligible = candRank >= reqRank;

              return (
                <div
                  key={offer.id}
                  className="bg-white rounded-3xl border border-gray-200 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col p-6 group"
                >
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-extrabold uppercase tracking-wider">
                      {offer.contract_type || "CDI"}
                    </span>
                    {semanticResults && offer.id in semanticResults && (
                      <span className="px-2.5 py-1 bg-amber-100 text-amber-900 rounded-full text-[10px] font-black">
                        ⚡ {Math.round(semanticResults[offer.id] * 100)}% pertinence
                      </span>
                    )}
                  </div>

                  <h2 className="text-xl font-extrabold text-gray-900 mb-1 group-hover:text-emerald-700 transition-colors">
                    {offer.title}
                  </h2>
                  <p className="text-xs font-bold text-gray-500 mb-4">{offer.company || "Recruteur Confidentiel"}</p>

                  <p className="text-xs text-gray-600 line-clamp-3 mb-4 leading-relaxed bg-gray-50 p-3 rounded-xl border border-gray-100">
                    {offer.description}
                  </p>

                  <div className="space-y-2 mb-6 text-xs text-gray-600">
                    {offer.location && (
                      <div className="flex items-center gap-2">
                        <i className="fa-solid fa-location-dot text-emerald-600"></i>
                        <span>{offer.location}</span>
                      </div>
                    )}
                    {offer.salary_range && (
                      <div className="flex items-center gap-2">
                        <i className="fa-solid fa-coins text-emerald-600"></i>
                        <span>{offer.salary_range}</span>
                      </div>
                    )}
                    {offer.required_education_level && (
                      <div className="flex items-center gap-2">
                        <i className="fa-solid fa-graduation-cap text-emerald-600"></i>
                        <span>Niveau requis : <strong>{offer.required_education_level}</strong></span>
                      </div>
                    )}
                  </div>

                  <div className="mt-auto pt-4 border-t border-gray-100 flex items-center justify-between gap-3">
                    <Link
                      href={`/offres/${offer.id}`}
                      className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-extrabold text-xs rounded-xl transition text-center"
                    >
                      Détails
                    </Link>

                    {offer.is_spontaneous ? (
                      <button
                        onClick={() => setApplyingOffer({ ...offer, isSpontaneous: true })}
                        className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition text-center shadow-xs"
                      >
                        Postuler
                      </button>
                    ) : (
                      <button
                        onClick={() => setApplyingOffer(offer)}
                        disabled={userSession && !eligible}
                        className={`flex-1 py-2.5 text-white font-extrabold text-xs rounded-xl transition text-center shadow-xs ${
                          userSession && !eligible
                            ? "bg-gray-300 cursor-not-allowed"
                            : "bg-emerald-600 hover:bg-emerald-700"
                        }`}
                      >
                        {userSession && !eligible ? "Niveau insuffisant" : "Postuler"}
                      </button>
                    )}
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
        job={stableApplyingJob}
        selectedLang="FR"
        triggerToast={triggerToast}
      />

      <footer className="bg-white border-t border-gray-200 py-4 text-center text-xs font-medium text-gray-500">
        © 2026 Facilite. Toutes les offres d'emploi.
      </footer>
    </div>
  );
}

export default function OffresPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <i className="fa-solid fa-circle-notch fa-spin text-4xl text-emerald-600 mb-3"></i>
          <p className="text-sm font-bold text-gray-500">Chargement des offres...</p>
        </div>
      </div>
    }>
      <OffresContent />
    </Suspense>
  );
}

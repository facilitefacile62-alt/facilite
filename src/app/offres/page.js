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

  // Recherche sémantique : Map job_offers.id -> similarité une fois activée,
  // null quand on est revenu à la recherche texte classique.
  const [semanticResults, setSemanticResults] = useState(null);
  const [isSemanticSearching, setIsSemanticSearching] = useState(false);
  const [semanticSearchError, setSemanticSearchError] = useState("");

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
          // job_offers n'a pas de colonne `status` (seul is_active existe,
          // basculé via /recruteur) : un filtre dessus était toujours vrai et
          // ne faisait rien, laissé par erreur lors d'une évolution passée.
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

  // Recherche sémantique : embedding de la requête via l'Edge Function
  // gemini-orchestrator, puis match_job_offers (offres actives uniquement).
  // Déclenchée explicitement (bouton/Entrée), pas à chaque frappe.
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

      if (matchError) throw new Error(matchError.message);

      setSemanticResults(new Map((matches || []).map((m) => [m.id, m.similarity])));
    } catch (err) {
      console.error("Erreur recherche sémantique:", err);
      setSemanticSearchError(err.message || "Erreur lors de la recherche sémantique.");
      setSemanticResults(null);
    } finally {
      setIsSemanticSearching(false);
    }
  };

  const handleResetSemanticSearch = () => {
    setSemanticResults(null);
    setSemanticSearchError("");
  };

  const filteredOffers = semanticResults
    ? offers
        .filter((o) => semanticResults.has(o.id))
        .map((o) => ({ ...o, similarity: semanticResults.get(o.id) }))
        .sort((a, b) => b.similarity - a.similarity)
    : offers.filter((o) => {
        const q = searchQuery.toLowerCase();
        const matchesSearch =
          !q || (o.title || "").toLowerCase().includes(q) || (o.company || "").toLowerCase().includes(q);
        const matchesLocation = !locationFilter || (o.location || "").toLowerCase().includes(locationFilter.toLowerCase());
        return matchesSearch && matchesLocation;
      });

  const handleApplyClick = (offer) => {
    if (!userSession) {
      // Navigation impérative volontaire (rechargement complet), pas une
      // mutation de donnée React — react-hooks/immutability flatte tout
      // assignment sur un objet global comme window, y compris ce pattern
      // standard.
      // eslint-disable-next-line react-hooks/immutability
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

      <header className="bg-white border-b border-gray-200 fixed top-0 left-0 right-0 z-50 h-16 shadow-xs">
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-8 flex-1 w-full">
        <div className="bg-gradient-to-r from-emerald-800 to-teal-900 rounded-3xl p-6 sm:p-8 text-white mb-8 shadow-xl">
          <span className="text-xs font-extrabold text-emerald-300 uppercase tracking-widest block mb-2">Recherche d'emploi</span>
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight mb-3">Toutes les offres</h1>
          <p className="text-sm text-emerald-100 font-medium leading-relaxed">
            Parcourez les offres publiées par nos recruteurs et postulez directement en ligne.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-2">
          <div className="relative max-w-xs w-full">
            <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-3.5 text-gray-400 text-xs"></i>
            <input
              type="text"
              placeholder="Titre, entreprise..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSemanticSearch()}
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
          {semanticResults ? (
            <button
              type="button"
              onClick={handleResetSemanticSearch}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-extrabold text-xs rounded-xl transition cursor-pointer whitespace-nowrap"
            >
              <i className="fa-solid fa-xmark"></i> Réinitialiser
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSemanticSearch}
              disabled={isSemanticSearching || !searchQuery.trim()}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs rounded-xl transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {isSemanticSearching ? (
                <i className="fa-solid fa-spinner fa-spin"></i>
              ) : (
                <i className="fa-solid fa-wand-magic-sparkles"></i>
              )}
              Recherche IA
            </button>
          )}
        </div>

        {semanticSearchError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700 flex items-center gap-2">
            <i className="fa-solid fa-triangle-exclamation"></i> {semanticSearchError}
          </div>
        )}
        {semanticResults && (
          <p className="text-xs text-gray-500 font-semibold mb-4">Résultats triés par compatibilité IA avec votre recherche.</p>
        )}

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
                    <div className="relative w-full h-48 sm:h-56 overflow-hidden bg-gray-100">
                      {/* Fond flouté + image en object-contain (façon Facebook) :
                          une affiche recruteur au format A4 n'était pas coupée
                          avant en haut/bas par object-cover seul. */}
                      <img
                        src={offer.image_url}
                        alt=""
                        aria-hidden="true"
                        className="absolute inset-0 w-full h-full object-cover blur-xl opacity-40 scale-110 pointer-events-none select-none"
                      />
                      <img
                        src={offer.image_url}
                        alt={offer.title}
                        className="relative z-10 w-full h-full object-contain mx-auto block"
                        loading="lazy"
                      />
                    </div>
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
                      {typeof offer.similarity === "number" && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold text-white bg-emerald-600 flex items-center gap-1">
                          <i className="fa-solid fa-wand-magic-sparkles"></i> {Math.round(offer.similarity * 100)}% compatible
                        </span>
                      )}
                    </div>
                    <Link href={`/offres/${offer.id}`} className="font-extrabold text-gray-900 text-sm mb-1 hover:text-emerald-700 hover:underline transition block">
                      {offer.title}
                    </Link>
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

                    {offer.externalLink ? (
                      <div className="flex flex-col gap-2 w-full mt-2">
                        <a
                          href={offer.externalLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full text-center py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition cursor-pointer"
                        >
                          <i className="fa-solid fa-external-link-alt mr-1.5"></i>
                          {offer.externalButtonLabel || "Lien externe"}
                        </a>
                        {offer.allowSpontaneousModal && (
                          <button
                            onClick={() => handleApplyClick({ ...offer, isSpontaneous: true })}
                            className="w-full py-2.5 bg-white hover:bg-emerald-50 text-emerald-600 border border-emerald-500 font-extrabold text-xs rounded-xl transition cursor-pointer"
                          >
                            <i className="fa-regular fa-paper-plane mr-1.5"></i>
                            Candidature Rapide
                          </button>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => handleApplyClick(offer)}
                        disabled={userSession && !eligible}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-300 disabled:bg-gray-300 mt-2"
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
        job={
          applyingOffer
            ? {
                id: applyingOffer.id,
                titleFR: applyingOffer.title,
                titleEN: applyingOffer.title,
                company: applyingOffer.company,
                isSpontaneous: applyingOffer.isSpontaneous,
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

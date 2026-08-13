/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import ApplyModal from "@/components/ApplyModal";
import SocialShareButtons from "@/components/SocialShareButtons";

export const dynamic = "force-dynamic";

const EDUCATION_LEVELS = ["Aucun", "CM2", "Brevet", "BAC", "Licence", "Master", "Doctorat"];
const levelRank = (level) => {
  const idx = EDUCATION_LEVELS.indexOf(level || "Aucun");
  return idx === -1 ? 0 : idx;
};

const FALLBACK_JOB_POSTERS = [
  "/affichedoffre.jpeg",
  "/affiche_boostez_carriere.jpg",
  "/affiche_professionnel.jpeg",
  "/affiche_cv_pro.jpg",
  "/pub.jpeg",
  "/c2k_sabodala.jpg",
  "/affiche2.jpg",
  "/pub3.jpeg",
  "/demdikk.jpeg",
  "/soboa.png",
];

const COMPANY_COLORS = [
  "bg-emerald-600",
  "bg-blue-600",
  "bg-purple-600",
  "bg-amber-600",
  "bg-rose-600",
  "bg-teal-600",
  "bg-indigo-600",
  "bg-cyan-600",
];

function getOfferImage(offer, index = 0) {
  if (offer.image_url && offer.image_url.trim()) return offer.image_url;
  if (offer.image && offer.image.trim()) return offer.image;
  return FALLBACK_JOB_POSTERS[index % FALLBACK_JOB_POSTERS.length];
}

function OffresContent() {
  const searchParams = useSearchParams();
  const queryParam = searchParams?.get("q") || "";

  const [userSession, setUserSession] = useState(null);
  const [, setUserRole] = useState(null);
  const [candidateEducationLevel, setCandidateEducationLevel] = useState("Aucun");
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(queryParam);
  const [locationFilter, setLocationFilter] = useState("");
  const [applyingOffer, setApplyingOffer] = useState(null);
  const [viewImageModal, setViewImageModal] = useState({ isOpen: false, url: null });

  // Stabilise la référence de job passé à ApplyModal
  const stableApplyingJob = useMemo(() => {
    if (!applyingOffer) return null;
    return {
      id: applyingOffer.id,
      titleFR: applyingOffer.title,
      titleEN: applyingOffer.title,
      company: applyingOffer.company,
      isSpontaneous: applyingOffer.isSpontaneous,
      recruiterEmail: applyingOffer.contact_email || applyingOffer.recruiterEmail || "",
      recruiterId: applyingOffer.recruiter_id || applyingOffer.recruiterId || null,
    };
  }, [applyingOffer]);

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
          const [profileRes, roleRes] = await Promise.all([
            supabase
              .from("profiles")
              .select("*")
              .eq("id", session.user.id)
              .single(),
            supabase
              .from("user_roles")
              .select("role")
              .eq("user_id", session.user.id)
              .maybeSingle()
          ]);

          const profile = profileRes.data;
          setCandidateEducationLevel(profile?.degree || profile?.education_level || "Aucun");
          setUserRole(roleRes.data?.role || "user");
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

    // Abonnement Realtime Supabase sur la table job_offers
    const channel = supabase
      .channel("public-job-offers-catalog")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "job_offers" },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
      {/* Toast Notification */}
      <div
        className={`fixed top-20 right-4 z-[700] bg-gray-900 text-white px-5 py-3 rounded-2xl shadow-2xl transition-all duration-300 transform ${
          toast ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0 pointer-events-none"
        }`}
      >
        <span className="text-sm font-semibold">{toast}</span>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-12 flex-1 w-full">
        {/* Hero Banner */}
        <div className="bg-gradient-to-r from-emerald-800 via-teal-900 to-emerald-950 rounded-3xl p-6 sm:p-10 text-white mb-8 shadow-xl relative overflow-hidden">
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
            Explorez toutes les opportunités publiées par nos recruteurs partenaires au Sénégal. Postulez en un clic avec vos CVs enregistrés.
          </p>
        </div>

        {/* Barre de Recherche & Filtres */}
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
              className={`w-full md:w-auto px-5 py-2.5 rounded-xl font-extrabold text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-xs ${
                isSemanticSearching || !searchQuery.trim()
                  ? "bg-emerald-200 text-emerald-800 cursor-not-allowed"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white"
              }`}
            >
              {isSemanticSearching ? (
                <>
                  <i className="fa-solid fa-circle-notch fa-spin"></i>
                  <span>Recherche IA...</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-wand-magic-sparkles"></i>
                  <span>Recherche IA</span>
                </>
              )}
            </button>
          </div>

          {semanticSearchError && (
            <p className="mt-3 text-xs font-bold text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-100">
              <i className="fa-solid fa-triangle-exclamation mr-1.5"></i>
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
                className="text-emerald-700 font-bold underline hover:text-emerald-900 cursor-pointer"
              >
                Revenir au filtre texte
              </button>
            </div>
          )}
        </div>

        {/* Grille des Offres d'Emploi */}
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
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition cursor-pointer"
            >
              Afficher toutes les offres
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredOffers.map((offer, idx) => {
              const reqRank = levelRank(offer.required_education_level);
              const candRank = levelRank(candidateEducationLevel);
              const eligible = candRank >= reqRank;
              const offerImg = getOfferImage(offer, idx);
              const initials = offer.company ? offer.company.substring(0, 2).toUpperCase() : "CO";
              const logoColor = COMPANY_COLORS[idx % COMPANY_COLORS.length];
              const dateFormatted = offer.created_at
                ? new Date(offer.created_at).toLocaleDateString("fr-FR")
                : "Récent";

              return (
                <div
                  key={offer.id}
                  className="bg-white rounded-2xl border border-gray-200 shadow-xs hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col p-5 group hover:border-emerald-300"
                >
                  {/* Header Offre */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-start space-x-3 min-w-0 flex-1">
                      {/* Logo Entreprise */}
                      <div className={`w-11 h-11 rounded-xl ${logoColor} flex items-center justify-center text-white font-extrabold text-sm shadow-xs flex-shrink-0`}>
                        {initials}
                      </div>

                      <div className="flex-grow min-w-0">
                        <Link
                          href={`/offres/${offer.id}`}
                          className="text-sm font-extrabold text-gray-900 leading-snug hover:text-emerald-700 transition-colors block truncate"
                          title={offer.title}
                        >
                          {offer.title}
                        </Link>
                        <p className="text-xs text-gray-700 font-bold mt-0.5 truncate">
                          {offer.company || "Recruteur Confidentiel"}
                        </p>
                        <p className="text-[11px] text-gray-500 font-medium mt-1 flex items-center gap-1.5 flex-wrap">
                          <span className="text-emerald-700 font-extrabold flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                            <i className="fa-solid fa-location-dot text-[10px]"></i>
                            {offer.location || "Sénégal"}
                          </span>
                          <span>•</span>
                          <span className="font-extrabold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-md">
                            {offer.contract_type || "CDI"}
                          </span>
                          <span>•</span>
                          <span className="text-gray-400 font-normal">{dateFormatted}</span>
                        </p>
                      </div>
                    </div>

                    {/* Badge Rémunération en Haut à Droite */}
                    <div className="flex-shrink-0">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-gradient-to-r from-amber-50 to-orange-50 text-amber-900 border border-amber-200/90 shadow-2xs">
                        <span>💰</span>
                        <span>{offer.salary_range && offer.salary_range !== "Non spécifié" ? offer.salary_range : "Non renseigné"}</span>
                      </span>
                    </div>
                  </div>

                  {/* Description Rapide */}
                  <p className="text-xs text-gray-600 line-clamp-2 mb-3 leading-relaxed">
                    {offer.description}
                  </p>

                  {/* Tags Niveau d'études & Match sémantique */}
                  <div className="flex items-center gap-1.5 flex-wrap mb-3 text-[11px]">
                    {offer.required_education_level && (
                      <span className="bg-gray-100 text-gray-700 px-2.5 py-0.5 rounded-md font-bold flex items-center gap-1">
                        <i className="fa-solid fa-graduation-cap text-emerald-600 text-[10px]"></i>
                        Niveau : {offer.required_education_level}
                      </span>
                    )}
                    {semanticResults && offer.id in semanticResults && (
                      <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded-md font-black text-[10px]">
                        ⚡ {Math.round(semanticResults[offer.id] * 100)}% pertinence
                      </span>
                    )}
                  </div>

                  {/* Visuel Haute Définition de Recrutement (Double couche cinématographique) */}
                  <div
                    className="relative w-full h-52 sm:h-60 rounded-xl overflow-hidden bg-gray-100 mb-3 border border-gray-200/90 group/img cursor-pointer"
                    onClick={() => setViewImageModal({ isOpen: true, url: offerImg })}
                    title="Cliquer pour agrandir l'affiche"
                  >
                    {/* Fond flouté pour combler l'espace */}
                    <img
                      src={offerImg}
                      alt=""
                      aria-hidden="true"
                      className="absolute inset-0 w-full h-full object-cover blur-xl opacity-40 scale-110 pointer-events-none select-none transition-transform duration-300 group-hover/img:scale-125"
                    />
                    {/* Overlay au survol */}
                    <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/15 transition-colors duration-300 z-10 flex items-center justify-center">
                      <div className="opacity-0 group-hover/img:opacity-100 bg-white/95 text-gray-900 rounded-full p-2.5 shadow-xl transform scale-90 group-hover/img:scale-100 transition-all duration-300 flex items-center gap-1.5 px-3.5">
                        <i className="fa-solid fa-expand text-xs text-emerald-600"></i>
                        <span className="text-xs font-black">Agrandir</span>
                      </div>
                    </div>
                    {/* Image principale nette */}
                    <img
                      src={offerImg}
                      alt={offer.title}
                      className="relative z-10 w-full h-full object-contain mx-auto block animate-fade-in pointer-events-none"
                      loading="lazy"
                    />
                  </div>

                  {/* Barre d'Actions Réseau Social & Postuler */}
                  <div className="mt-auto">
                    <SocialShareButtons
                      offer={{
                        id: offer.id,
                        title: offer.title,
                        company: offer.company || "Recruteur Confidentiel",
                        location: offer.location || "Sénégal",
                        contract: offer.contract_type || "CDI",
                        salary: offer.salary_range,
                      }}
                      variant="compact"
                      onApply={() => {
                        if (userSession && !eligible && !offer.is_spontaneous) {
                          triggerToast("Niveau d'études requis insuffisant pour cette offre.");
                          return;
                        }
                        setApplyingOffer(offer);
                      }}
                      externalLink={offer.external_link}
                      externalButtonLabel={offer.external_link ? "Voir l'offre" : "Envoyer"}
                      onToast={triggerToast}
                    />

                    {/* Lien secondaire discret vers les détails */}
                    <div className="pt-2 text-center">
                      <Link
                        href={`/offres/${offer.id}`}
                        className="text-[11px] font-bold text-gray-500 hover:text-emerald-700 transition inline-flex items-center gap-1"
                      >
                        <span>Voir la fiche détaillée</span>
                        <i className="fa-solid fa-arrow-right text-[9px]"></i>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Modal Agrandissement d'Image / Affiche */}
      {viewImageModal.isOpen && (
        <div
          className="fixed inset-0 z-[800] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setViewImageModal({ isOpen: false, url: null })}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-white dark:bg-gray-900 rounded-3xl p-2 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setViewImageModal({ isOpen: false, url: null })}
              className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-black/60 hover:bg-black text-white flex items-center justify-center text-sm shadow-md transition cursor-pointer"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
            <img
              src={viewImageModal.url}
              alt="Affiche agrandie"
              className="w-full h-auto max-h-[85vh] object-contain rounded-2xl"
            />
          </div>
        </div>
      )}

      {/* Modal Candidature */}
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

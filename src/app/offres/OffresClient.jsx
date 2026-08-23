/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import ApplyModal from "@/components/ApplyModal";
import SocialShareButtons from "@/components/SocialShareButtons";
import OfferImageWatermark from "@/components/OfferImageWatermark";
import { interleaveSponsoredOffers, isOfferActivelySponsored } from "@/lib/sponsoredFeed";
import { LISTING_TYPE_LABELS } from "@/lib/listingTypes";

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

  // Session/profil chargés une seule fois pour toute l'app par AuthContext
  // (Point F1) — plus de getSession() ni de fetch profiles/user_roles propre
  // à cette page ; candidateEducationLevel dérivé directement du profil déjà
  // en contexte.
  const { session: userSession, profile: authProfile } = useAuth();
  const candidateEducationLevel = authProfile?.education_level || authProfile?.degree || "Aucun";
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

  // Badge de correspondance candidat (point 7) — un seul appel en lot
  // (match_job_offers, même RPC que semanticResults ci-dessus et que les
  // recommandations de candidat/page.js), jamais un appel par carte.
  const [candidateMatchScores, setCandidateMatchScores] = useState(null);

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
    const applyId = searchParams?.get("apply") || searchParams?.get("postuler");
    if (applyId && offers.length > 0) {
      const match = offers.find((o) => String(o.id) === String(applyId));
      if (match) {
        setApplyingOffer(match);
      }
    }
  }, [searchParams, offers]);

  useEffect(() => {
    async function loadData() {
      try {
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

  // Scores de correspondance candidat pour toutes les offres de la page —
  // un seul appel batch (comme candidat/page.js loadRecommendedOffers), pas
  // un appel par carte. Repose sur le CV avec embedding le plus récent ;
  // reste null (aucun badge affiché) si le candidat n'est pas connecté ou
  // n'a aucun CV avec embedding — jamais bloquant, jamais un second calcul
  // par offre.
  useEffect(() => {
    async function loadCandidateMatchScores() {
      const userId = userSession?.user?.id;
      if (!userId) {
        setCandidateMatchScores(null);
        return;
      }
      try {
        const { data: resume } = await supabase
          .from("resumes")
          .select("embedding")
          .eq("user_id", userId)
          .not("embedding", "is", null)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!resume?.embedding) {
          setCandidateMatchScores(null);
          return;
        }

        const embeddingLiteral = Array.isArray(resume.embedding)
          ? `[${resume.embedding.join(",")}]`
          : resume.embedding;

        const { data: matches, error } = await supabase.rpc("match_job_offers", {
          query_embedding: embeddingLiteral,
          match_threshold: 0,
          match_count: 200,
        });

        if (error || !matches) {
          setCandidateMatchScores(null);
          return;
        }

        const map = {};
        matches.forEach((m) => {
          map[m.id] = m.similarity;
        });
        setCandidateMatchScores(map);
      } catch (err) {
        console.error("Exception calcul scores de correspondance candidat:", err);
        setCandidateMatchScores(null);
      }
    }
    loadCandidateMatchScores();
  }, [userSession?.user?.id]);

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

  // Entrelace 1 offre sponsorisée active toutes les 5 offres standard —
  // interleaveSponsoredOffers revérifie elle-même is_sponsored/sponsored_until,
  // ne dépend jamais du contenu de filteredOffers pour cette garantie.
  const feedOffers = interleaveSponsoredOffers(filteredOffers, { everyN: 5 });

  // Catégorie "Formation" : pas un vrai catalogue de formations, juste une
  // recherche texte qui remonte des offres d'emploi normales sans rapport
  // (le mot apparaît par coïncidence dans leur texte). Calculé ici (pas
  // seulement dans la bannière ci-dessous) pour aussi masquer la grille de
  // résultats — accessible en tapant "formation" dans la recherche, ce que
  // ni le clic sur le lien du menu ni la navigation directe (tous deux déjà
  // bloqués via feature_flags) ne peuvent intercepter : c'est un filtrage
  // texte côté client, pas une navigation.
  const isFormationCategory =
    searchQuery?.toLowerCase()?.includes("formation") || queryParam?.toLowerCase()?.includes("formation");

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

      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-3 sm:pt-6 pb-12 flex-1 w-full">
        {/* Hero Banner - Dynamique selon la catégorie (Formation, Concours, Emploi) */}
        {(() => {
          const isConcoursCategory =
            searchQuery?.toLowerCase()?.includes("concours") || queryParam?.toLowerCase()?.includes("concours");

          return (
            <div className="bg-gradient-to-r from-emerald-800 via-teal-900 to-emerald-950 rounded-2xl sm:rounded-3xl p-4 sm:p-8 text-white mb-4 sm:mb-6 shadow-md sm:shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-3 sm:p-8 opacity-10 pointer-events-none">
                <i className={`fa-solid ${isFormationCategory ? "fa-graduation-cap" : isConcoursCategory ? "fa-landmark" : "fa-briefcase"} text-5xl sm:text-9xl`}></i>
              </div>
              <span className="text-[10px] sm:text-xs font-extrabold text-emerald-300 uppercase tracking-widest block mb-1 sm:mb-1.5 relative z-10">
                {isFormationCategory
                  ? "Catalogue des Formations"
                  : isConcoursCategory
                  ? "Concours & Fonction Publique"
                  : "Catalogue des Emplois"}
              </span>
              <h1 className="text-lg sm:text-3xl md:text-4xl font-extrabold tracking-tight mb-1 sm:mb-2 relative z-10 leading-snug">
                {isFormationCategory
                  ? "Formations & Certifications Professionnelles"
                  : isConcoursCategory
                  ? "Avis de Concours & Examens Publics"
                  : "Offres d'Emploi Disponibles"}
              </h1>
              <p className="text-xs sm:text-sm text-emerald-100 font-medium leading-relaxed max-w-2xl relative z-10">
                {isFormationCategory
                  ? "Découvrez les opportunités de formation, montées en compétences et certifications professionnelles au Sénégal."
                  : isConcoursCategory
                  ? "Consultez les concours officiels de l'État, recrutements spéciaux et examens professionnels."
                  : "Explorez toutes les opportunités publiées par nos recruteurs au Sénégal et postulez en un clic."}
              </p>
            </div>
          );
        })()}

        {/* Barre de Recherche & Filtres */}
        <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-gray-200 shadow-xs mb-4 sm:mb-8">
          <div className="flex flex-col md:flex-row items-center gap-2.5 sm:gap-4">
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
        {isFormationCategory ? (
          <div className="bg-white rounded-3xl border border-gray-200 p-12 text-center max-w-lg mx-auto shadow-sm">
            <div className="w-16 h-16 bg-gray-100 text-gray-400 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl">
              <i className="fa-solid fa-graduation-cap"></i>
            </div>
            <h3 className="text-lg font-extrabold text-gray-900 mb-1">Formation non disponible</h3>
            <p className="text-xs text-gray-500 mb-6">
              Le catalogue de formations n'est pas encore disponible. Revenez bientôt !
            </p>
            <button
              onClick={handleResetSearch}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition cursor-pointer"
            >
              Afficher toutes les offres
            </button>
          </div>
        ) : loading ? (
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
            {feedOffers.map((offer, idx) => {
              const reqRank = levelRank(offer.required_education_level);
              const candRank = levelRank(candidateEducationLevel);
              const eligible = candRank >= reqRank;
              const offerImg = getOfferImage(offer, idx);
              const initials = offer.company ? offer.company.substring(0, 2).toUpperCase() : "CO";
              const logoColor = COMPANY_COLORS[idx % COMPANY_COLORS.length];
              const dateFormatted = offer.created_at
                ? new Date(offer.created_at).toLocaleDateString("fr-FR")
                : "Récent";

              // Une offre sponsorisée peut apparaître plusieurs fois dans feedOffers
              // (injection round-robin) — offer.id seul comme clé React
              // provoquerait une collision, d'où l'index de position en plus.
              // Revérification indépendante de l'expiration réelle : le badge ne
              // doit jamais s'afficher sur la seule foi de is_sponsored, même si
              // interleaveSponsoredOffers a déjà filtré en amont.
              const isActivelySponsored = isOfferActivelySponsored(offer);

              return (
                <div
                  key={`${offer.id}-${idx}`}
                  className="bg-white rounded-2xl border border-gray-200 shadow-xs hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col p-5 group hover:border-emerald-300"
                >
                  {/* En-tête façon post Facebook : avatar + nom de la page (entreprise) +
                      horodatage — pas de badges colorés ici, juste texte gris discret
                      comme sur un vrai post (nom de page en gras, "27 min" en dessous).
                      "Sponsorisé" suit la même convention : texte gris discret à côté
                      de l'horodatage, comme un vrai post sponsorisé Facebook. */}
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-10 h-10 rounded-full ${logoColor} flex items-center justify-center text-white font-extrabold text-xs shadow-xs flex-shrink-0`}>
                      {initials}
                    </div>
                    <div className="flex-grow min-w-0">
                      <p className="text-sm font-extrabold text-gray-900 truncate">
                        {offer.company || "Recruteur Confidentiel"}
                      </p>
                      <div className="text-[11px] text-gray-500 font-medium flex items-center gap-1">
                        <span>{dateFormatted}</span>
                        {isActivelySponsored && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-bold text-amber-600">
                              <i className="fa-solid fa-star text-[9px] mr-0.5"></i>Sponsorisé
                            </span>
                          </>
                        )}
                        <span aria-hidden="true">·</span>
                        <i className="fa-solid fa-earth-africa text-[9px]" title="Offre publique"></i>
                      </div>
                    </div>
                  </div>

                  {/* Légende façon post : titre + description en texte simple, puis les
                      infos (lieu, contrat, date limite, niveau) sur une seule ligne grise
                      séparée par des points — même contenu qu'avant, sans les pastilles
                      colorées qui cassaient le look sobre d'un post Facebook. */}
                  <div className="mb-3">
                    <Link
                      href={`/offres/${offer.id}`}
                      className="text-sm font-extrabold text-gray-900 leading-snug hover:text-emerald-700 transition-colors block line-clamp-1 min-h-[20px]"
                      title={offer.title}
                    >
                      {offer.title}
                    </Link>
                    <p className="text-xs text-gray-600 line-clamp-2 mt-1 leading-relaxed min-h-[34px]">
                      {offer.description}
                    </p>
                    <p className="text-[11px] text-gray-500 font-medium mt-1.5 flex items-center gap-1.5 flex-wrap min-h-[18px]">
                      <span>{offer.location || "Sénégal"}</span>
                      <span aria-hidden="true">·</span>
                      <span>{offer.contract_type || "CDI"}</span>
                      {offer.deadline && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>Jusqu'au {new Date(offer.deadline).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>
                        </>
                      )}
                      {offer.required_education_level && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>Niveau {offer.required_education_level}</span>
                        </>
                      )}
                      {offer.listing_type && offer.listing_type !== "offre_emploi" && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-bold text-purple-700">{LISTING_TYPE_LABELS[offer.listing_type] || offer.listing_type}</span>
                        </>
                      )}
                      {semanticResults && offer.id in semanticResults && (
                        <span className="text-amber-700 font-bold">
                          ⚡ {Math.round(semanticResults[offer.id] * 100)}% pertinence
                        </span>
                      )}
                      {/* Badge de correspondance candidat (point 7) — masqué pendant une
                          recherche sémantique active pour ne pas doubler l'information avec
                          le badge "pertinence" ci-dessus, qui répond à une autre question
                          (correspondance à la recherche tapée, pas au profil du candidat). */}
                      {!semanticResults && candidateMatchScores && offer.id in candidateMatchScores && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-emerald-700 font-bold">
                            <i className="fa-solid fa-user-check text-[9px] mr-0.5"></i>
                            {Math.round(candidateMatchScores[offer.id] * 100)}% avec votre profil
                          </span>
                        </>
                      )}
                    </p>
                  </div>

                  {/* Visuel Haute Définition de Recrutement (Hauteur Standardisée et Cadrage Homogène) */}
                  <div
                    className="relative w-full h-56 sm:h-64 rounded-2xl overflow-hidden bg-gray-900/90 dark:bg-black/90 mb-3 border border-gray-200/90 dark:border-gray-800 group/img cursor-pointer flex items-center justify-center"
                    onClick={() => setViewImageModal({ isOpen: true, url: offerImg })}
                    title="Cliquer pour voir l'affiche complète en plein écran"
                  >
                    {/* Overlay au survol */}
                    <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/30 transition-colors duration-200 z-10 flex items-center justify-center">
                      <div className="opacity-0 group-hover/img:opacity-100 bg-black/80 text-white rounded-full py-1.5 px-3.5 shadow-xl transform scale-95 group-hover/img:scale-100 transition-all duration-200 flex items-center gap-1.5">
                        <i className="fa-solid fa-expand text-xs text-emerald-400"></i>
                        <span className="text-xs font-black">Voir l'affiche</span>
                      </div>
                    </div>
                    {/* Image principale nette avec cadrage uniforme */}
                    <img
                      src={offerImg}
                      alt={offer.title}
                      className="w-full h-full object-cover object-top mx-auto block animate-fade-in transition-transform duration-300 group-hover/img:scale-105"
                      loading="lazy"
                    />
                    <OfferImageWatermark />
                  </div>

                  {/* Barre d'Actions Réseau Social & Postuler */}
                  <div className="mt-auto">
                    <SocialShareButtons
                      offer={{
                        ...offer,
                        id: offer.id,
                        title: offer.title,
                        company: offer.company || "Recruteur Confidentiel",
                        location: offer.location || "Sénégal",
                        contact_email: offer.contact_email || offer.recruiterEmail,
                        recruiterEmail: offer.contact_email || offer.recruiterEmail,
                        contact_phone: offer.contact_phone || offer.phone,
                        contact_whatsapp: offer.contact_whatsapp || offer.whatsapp,
                        whatsapp: offer.contact_whatsapp || offer.whatsapp,
                        external_link: offer.external_link,
                        externalLink: offer.external_link,
                      }}
                      variant="feed"
                      onApply={() => {
                        if (userSession && !eligible && !offer.is_spontaneous) {
                          triggerToast("Niveau d'études requis insuffisant pour cette offre.");
                          return;
                        }
                        setApplyingOffer(offer);
                      }}
                      externalLink={offer.external_link}
                      externalButtonLabel={offer.external_button_label}
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

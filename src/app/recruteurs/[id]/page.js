/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import ApplyModal from "@/components/ApplyModal";

const EDUCATION_LEVELS = ["Aucun", "CM2", "Brevet", "BAC", "Licence", "Master", "Doctorat"];
const levelRank = (level) => {
  const idx = EDUCATION_LEVELS.indexOf(level || "Aucun");
  return idx === -1 ? 0 : idx;
};

function formatDeadline(deadline) {
  if (!deadline) return null;
  try {
    return new Date(deadline).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return null;
  }
}

function isExpired(deadline) {
  if (!deadline) return false;
  const d = new Date(deadline);
  d.setHours(23, 59, 59, 999);
  return d.getTime() < Date.now();
}

export default function RecruiterShowcasePage() {
  const params = useParams();
  const router = useRouter();
  const recruiterId = params?.id;

  const [userSession, setUserSession] = useState(null);
  const [candidateEducationLevel, setCandidateEducationLevel] = useState("Aucun");
  const [recruiterProfile, setRecruiterProfile] = useState(null);
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [applyingOffer, setApplyingOffer] = useState(null);
  const [toast, setToast] = useState("");

  const triggerToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  }, []);

  useEffect(() => {
    async function loadShowcase() {
      if (!recruiterId) return;
      setLoading(true);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUserSession(session);

        if (session?.user?.id) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("education_level")
            .eq("id", session.user.id)
            .single();
          setCandidateEducationLevel(profile?.education_level || "Aucun");
        }

        // Lecture publique (RLS "Lecture publique des profils recruteurs") :
        // pas de fallback possible sur profiles.full_name ici — la RLS de
        // `profiles` ne permet de lire que sa propre ligne, un visiteur ne
        // peut donc pas la consulter pour un autre utilisateur.
        const [{ data: recruiterData }, { data: offersData, error: offersError }] = await Promise.all([
          supabase.from("recruiter_profiles").select("*").eq("user_id", recruiterId).maybeSingle(),
          supabase
            .from("job_offers")
            .select("*")
            .eq("recruiter_id", recruiterId)
            .eq("is_active", true)
            .order("created_at", { ascending: false }),
        ]);

        if (offersError) {
          console.error("Erreur chargement des offres du recruteur:", offersError);
        }

        setRecruiterProfile(recruiterData || null);
        setOffers(offersData || []);

        // Ni profil vitrine, ni offre active : rien de public à montrer pour
        // cet id — distingue "recruteur inconnu/vide" d'une vraie erreur réseau.
        if (!recruiterData && (!offersData || offersData.length === 0)) {
          setNotFound(true);
        }
      } catch (err) {
        console.error("Erreur chargement vitrine recruteur:", err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }

    loadShowcase();
  }, [recruiterId]);

  const handleApplyClick = (offer) => {
    if (!userSession) {
      router.push("/login");
      return;
    }
    const eligible = levelRank(candidateEducationLevel) >= levelRank(offer.min_education_level);
    if (!eligible || isExpired(offer.deadline)) return;
    setSelectedOffer(null);
    setApplyingOffer(offer);
  };

  const companyName = recruiterProfile?.company_name || offers[0]?.company || "Recruteur";
  const initials = companyName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "R";

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF6F1] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-bold text-gray-700">Chargement de la vitrine...</p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-[#FAF6F1] flex flex-col items-center justify-center px-4 text-center">
        <div className="w-16 h-16 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center text-2xl mb-4">
          <i className="fa-solid fa-building-circle-xmark"></i>
        </div>
        <h1 className="text-lg font-extrabold text-gray-900 mb-1">Vitrine introuvable</h1>
        <p className="text-sm text-gray-500 font-medium mb-6 max-w-sm">
          Ce recruteur n'a pas encore de vitrine publique ou n'a publié aucune offre active.
        </p>
        <Link
          href="/offres"
          className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition"
        >
          Voir toutes les offres
        </Link>
      </div>
    );
  }

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
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
            <img src="/logo.jpeg" alt="Logo Facilite" className="w-9 h-9 rounded-full object-cover shadow-sm border border-gray-200" />
            <span className="text-xl font-extrabold text-gray-900 tracking-tight">Facilite</span>
          </Link>
          <Link
            href="/offres"
            className="text-xs font-bold text-gray-700 hover:text-emerald-700 bg-gray-100 hover:bg-emerald-50 px-3.5 py-2 rounded-xl transition"
          >
            <i className="fa-solid fa-arrow-left mr-1.5"></i> Toutes les offres
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        {/* En-tête entreprise */}
        <div className="bg-white rounded-3xl border border-gray-200 shadow-xs overflow-hidden mb-8">
          <div
            className="h-36 sm:h-48 w-full bg-gradient-to-r from-emerald-800 via-teal-800 to-teal-900 bg-cover bg-center"
            style={recruiterProfile?.banner_url ? { backgroundImage: `url(${recruiterProfile.banner_url})` } : undefined}
          ></div>
          <div className="px-5 sm:px-8 pb-6">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between -mt-10 sm:-mt-12 gap-4">
              <div className="flex items-end gap-4">
                {recruiterProfile?.logo_url ? (
                  <img
                    src={recruiterProfile.logo_url}
                    alt={companyName}
                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border-4 border-white shadow-lg bg-white flex-shrink-0"
                  />
                ) : (
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-emerald-700 text-white border-4 border-white shadow-lg flex items-center justify-center font-extrabold text-2xl flex-shrink-0">
                    {initials}
                  </div>
                )}
                <div className="pb-1">
                  <h1 className="text-lg sm:text-2xl font-extrabold text-gray-900">{companyName}</h1>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                    {recruiterProfile?.sector && (
                      <span className="text-[11px] font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                        {recruiterProfile.sector}
                      </span>
                    )}
                    <span className="text-xs text-gray-500 font-semibold">
                      <i className="fa-solid fa-location-dot mr-1"></i>
                      {recruiterProfile?.location || "Localisation non renseignée"}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!userSession) {
                    router.push("/login");
                    return;
                  }
                  router.push(`/messagerie?recipient=${recruiterId}`);
                }}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition cursor-pointer shadow-sm flex-shrink-0"
              >
                <i className="fa-solid fa-comments"></i> Contacter le recruteur
              </button>
            </div>

            {recruiterProfile?.description && (
              <p className="text-sm text-gray-600 leading-relaxed mt-5 whitespace-pre-line">{recruiterProfile.description}</p>
            )}

            {recruiterProfile?.website && (
              <a
                href={recruiterProfile.website.startsWith("http") ? recruiterProfile.website : `https://${recruiterProfile.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-3 text-xs font-bold text-blue-600 hover:text-blue-700 transition"
              >
                <i className="fa-solid fa-globe"></i>
                {recruiterProfile.website}
              </a>
            )}
          </div>
        </div>

        {/* Galerie des affiches */}
        <h2 className="text-lg font-extrabold text-gray-900 mb-4">
          Offres publiées ({offers.length})
        </h2>

        {offers.length === 0 ? (
          <div className="text-center text-gray-400 italic text-sm py-16 bg-white rounded-3xl border border-gray-200">
            Aucune offre active pour le moment.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {offers.map((offer) => {
              const expired = isExpired(offer.deadline);
              return (
                <button
                  key={offer.id}
                  type="button"
                  onClick={() => setSelectedOffer(offer)}
                  className="text-left bg-white rounded-3xl border border-gray-200 shadow-xs overflow-hidden flex flex-col hover:shadow-md hover:border-emerald-300 transition cursor-pointer"
                >
                  <div className="w-full h-40 bg-gray-100 relative overflow-hidden flex-shrink-0">
                    {offer.image_url ? (
                      <img src={offer.image_url} alt={offer.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300 text-3xl">
                        <i className="fa-solid fa-image"></i>
                      </div>
                    )}
                    {expired && (
                      <span className="absolute top-2 right-2 bg-gray-900/80 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                        Clôturée
                      </span>
                    )}
                  </div>
                  <div className="p-4 flex flex-col flex-1">
                    <h3 className="font-extrabold text-gray-900 text-sm mb-1.5 line-clamp-2">{offer.title}</h3>
                    <div className="flex flex-wrap gap-1.5 mt-auto pt-2">
                      {offer.min_education_level && offer.min_education_level !== "Aucun" && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-purple-100 text-purple-700">
                          🎓 {offer.min_education_level}
                        </span>
                      )}
                      {offer.deadline && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-100 text-amber-700">
                          <i className="fa-regular fa-clock mr-1"></i>
                          {formatDeadline(offer.deadline)}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>

      {/* Modale de détail d'affiche */}
      {selectedOffer && (
        <div
          className="fixed inset-0 z-[600] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedOffer(null);
          }}
        >
          <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-gray-100 relative max-h-[90vh] overflow-y-auto no-scrollbar animate-fade-in-up">
            <button
              onClick={() => setSelectedOffer(null)}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-gray-600 flex items-center justify-center transition cursor-pointer shadow-sm z-10"
            >
              <i className="fa-solid fa-xmark text-lg"></i>
            </button>

            {selectedOffer.image_url ? (
              <img src={selectedOffer.image_url} alt={selectedOffer.title} className="w-full max-h-80 object-cover" />
            ) : (
              <div className="w-full h-40 bg-gray-100 flex items-center justify-center text-gray-300 text-4xl">
                <i className="fa-solid fa-image"></i>
              </div>
            )}

            <div className="p-6 space-y-4">
              <div>
                <h3 className="text-lg font-extrabold text-gray-900">{selectedOffer.title}</h3>
                <p className="text-xs text-gray-500 font-semibold mt-0.5">{companyName}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                {selectedOffer.min_education_level && selectedOffer.min_education_level !== "Aucun" && (
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-purple-100 text-purple-700">
                    🎓 Niveau requis : {selectedOffer.min_education_level}
                  </span>
                )}
                {selectedOffer.deadline && (
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-amber-100 text-amber-700">
                    <i className="fa-regular fa-clock mr-1"></i>
                    Date limite : {formatDeadline(selectedOffer.deadline)}
                  </span>
                )}
                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                    isExpired(selectedOffer.deadline) ? "bg-gray-200 text-gray-600" : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {isExpired(selectedOffer.deadline) ? "Clôturée" : "Ouverte"}
                </span>
              </div>

              {selectedOffer.description && (
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  {selectedOffer.description}
                </p>
              )}

              {userSession && levelRank(candidateEducationLevel) < levelRank(selectedOffer.min_education_level) && (
                <p className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5 flex items-center gap-1.5">
                  <i className="fa-solid fa-triangle-exclamation"></i>
                  Niveau requis : {selectedOffer.min_education_level}. Complétez votre profil pour postuler.
                </p>
              )}

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Link
                  href={`/candidat/extracteur?posterId=${selectedOffer.id}`}
                  className="flex-1 text-center py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 font-extrabold text-xs rounded-xl transition"
                >
                  <i className="fa-solid fa-wand-magic-sparkles mr-1.5"></i>
                  Analyser mon CV avec l'Extracteur
                </Link>
                <button
                  type="button"
                  onClick={() => handleApplyClick(selectedOffer)}
                  disabled={
                    isExpired(selectedOffer.deadline) ||
                    (userSession && levelRank(candidateEducationLevel) < levelRank(selectedOffer.min_education_level))
                  }
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-300 disabled:bg-gray-300"
                >
                  <i className="fa-solid fa-paper-plane mr-1.5"></i>
                  {isExpired(selectedOffer.deadline) ? "Offre clôturée" : "Postuler à cette offre"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ApplyModal
        isOpen={!!applyingOffer}
        onClose={() => setApplyingOffer(null)}
        job={
          applyingOffer
            ? {
                id: applyingOffer.id,
                titleFR: applyingOffer.title,
                titleEN: applyingOffer.title,
                company: companyName,
              }
            : null
        }
        selectedLang="FR"
        triggerToast={triggerToast}
      />
    </div>
  );
}

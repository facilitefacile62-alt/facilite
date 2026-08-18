"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import ApplyModal from "@/components/ApplyModal";
import { resolveOfferAction, extractOfferContactMethods } from "@/lib/offerContact";

const EDUCATION_LEVELS = ["Aucun", "CM2", "Brevet", "BAC", "Licence", "Master", "Doctorat"];
const levelRank = (level) => {
  const idx = EDUCATION_LEVELS.indexOf(level || "Aucun");
  return idx === -1 ? 0 : idx;
};

// Composant client autonome : reçoit l'offre déjà chargée côté serveur
// (SEO/generateMetadata), mais recalcule lui-même la session et l'éligibilité
// du visiteur — comme /offres/page.js, ces deux informations dépendent du
// visiteur courant et n'ont pas de sens dans le rendu serveur partagé.
export default function OffreApplySection({ offer }) {
  const [userSession, setUserSession] = useState(null);
  const [candidateEducationLevel, setCandidateEducationLevel] = useState("Aucun");
  const [applyOpen, setApplyOpen] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    async function loadSession() {
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
    }
    loadSession();
  }, []);

  const triggerToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  };

  const eligible = levelRank(candidateEducationLevel) >= levelRank(offer.min_education_level);
  const blocked = !!userSession && !eligible;

  // Stabilise la référence de l'objet job passé à ApplyModal
  const stableJob = useMemo(
    () => ({
      id: offer.id,
      titleFR: offer.title || offer.titleFR,
      titleEN: offer.title || offer.titleEN,
      company: offer.company,
      recruiterEmail: offer.contact_email || offer.recruiter_email || offer.recruiterEmail || "",
      contact_email: offer.contact_email || offer.recruiter_email || offer.recruiterEmail || "",
    }),
    [offer]
  );

  // Extraction complète de tous les moyens de contact
  const contactMethods = useMemo(() => {
    return extractOfferContactMethods(offer);
  }, [offer]);

  // Résolution intelligente de l'action de candidature principale
  const offerAction = useMemo(() => {
    return resolveOfferAction(offer);
  }, [offer]);

  const targetUrl = offerAction.url;
  const isWhatsApp = offerAction.isWhatsApp;
  const buttonColorClass = offerAction.buttonColorClass || "bg-blue-600 hover:bg-blue-700 text-white";
  const buttonIconClass = offerAction.iconClass || "fa-solid fa-arrow-up-right-from-square";
  const buttonLabel = offerAction.label || "Postuler via Facilité";

  return (
    <>
      <div
        className={`fixed top-20 right-4 z-[700] bg-gray-900 text-white px-5 py-3 rounded-2xl shadow-2xl transition-all duration-300 transform ${
          toast ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0 pointer-events-none"
        }`}
      >
        <span className="text-sm font-semibold">{toast}</span>
      </div>

      {blocked && !isWhatsApp && (
        <p className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5 mb-3">
          <i className="fa-solid fa-triangle-exclamation mr-1"></i>
          Niveau requis : {offer.min_education_level}. Complétez votre profil pour postuler.
        </p>
      )}

      {/* Section Candidature dans la page */}
      <div className="w-full">
        {contactMethods.hasBoth ? (
          <div className="w-full flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => setApplyOpen(true)}
              disabled={blocked}
              className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-black text-sm sm:text-base rounded-2xl transition flex items-center justify-center gap-2.5 shadow-lg shadow-blue-600/25 cursor-pointer disabled:opacity-50"
            >
              <i className="fa-solid fa-paper-plane text-base sm:text-lg"></i>
              <span>Postuler via Facilité</span>
            </button>
            <a
              href={contactMethods.waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-3.5 bg-[#25D366] hover:bg-[#20bd5a] active:scale-98 text-white font-black text-sm sm:text-base rounded-2xl transition flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-500/25 cursor-pointer"
            >
              <i className="fa-brands fa-whatsapp text-lg"></i>
              <span>Postuler sur WhatsApp</span>
            </a>
          </div>
        ) : targetUrl ? (
          <a
            href={targetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`w-full py-3.5 ${buttonColorClass} active:scale-98 font-black text-sm sm:text-base rounded-2xl transition flex items-center justify-center gap-2.5 shadow-lg ${
              isWhatsApp ? "shadow-emerald-500/25" : "shadow-blue-600/25"
            } cursor-pointer`}
          >
            <i className={`${buttonIconClass} text-lg`}></i>
            <span>{buttonLabel}</span>
          </a>
        ) : (
          <button
            type="button"
            onClick={() => setApplyOpen(true)}
            disabled={blocked}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-black text-sm sm:text-base rounded-2xl transition flex items-center justify-center gap-2.5 shadow-lg shadow-blue-600/25 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className="fa-solid fa-paper-plane text-base"></i>
            <span>{blocked ? "Niveau insuffisant" : buttonLabel}</span>
          </button>
        )}
      </div>

      <ApplyModal
        isOpen={applyOpen}
        onClose={() => setApplyOpen(false)}
        job={stableJob}
        selectedLang="FR"
        triggerToast={triggerToast}
      />
    </>
  );
}

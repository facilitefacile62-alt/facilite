"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import ApplyModal from "@/components/ApplyModal";

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

  return (
    <>
      <div
        className={`fixed top-20 right-4 z-[700] bg-gray-900 text-white px-5 py-3 rounded-2xl shadow-2xl transition-all duration-300 transform ${
          toast ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0 pointer-events-none"
        }`}
      >
        <span className="text-sm font-semibold">{toast}</span>
      </div>

      {blocked && (
        <p className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5 mb-3">
          <i className="fa-solid fa-triangle-exclamation mr-1"></i>
          Niveau requis : {offer.min_education_level}. Complétez votre profil pour postuler.
        </p>
      )}

      <button
        type="button"
        onClick={() => setApplyOpen(true)}
        disabled={blocked}
        className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm rounded-xl transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-300 disabled:bg-gray-300"
      >
        {blocked ? "Niveau insuffisant" : "Postuler"}
      </button>

      <ApplyModal
        isOpen={applyOpen}
        onClose={() => setApplyOpen(false)}
        job={{
          id: offer.id,
          titleFR: offer.title,
          titleEN: offer.title,
          company: offer.company,
        }}
        selectedLang="FR"
        triggerToast={triggerToast}
      />
    </>
  );
}

"use client";

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import ApplyModal from "@/components/ApplyModal";
import { resolveOfferAction, extractOfferContactMethods } from "@/lib/offerContact";
import { chargerNiveauxEtudes, comparerNiveaux } from "@/lib/niveauxEtudes";
import { isOfferExpired } from "@/lib/offerExpiration";
import Link from "next/link";


// Composant client autonome : reçoit l'offre déjà chargée côté serveur
// (SEO/generateMetadata), mais recalcule lui-même la session et l'éligibilité
// du visiteur — comme /offres/page.js, ces deux informations dépendent du
// visiteur courant et n'ont pas de sens dans le rendu serveur partagé.
export default function OffreApplySection({ offer }) {
  const [userSession, setUserSession] = useState(null);
  const [candidateEducationCode, setCandidateEducationCode] = useState("");
  // Candidature déjà envoyée sur CETTE offre (point 2). Le déclencheur
  // trg_candidature_unique_par_offre refuse le doublon côté base ; cet état
  // évite au candidat de remplir toute la modale pour se voir refuser à
  // l'envoi.
  const [dejaPostule, setDejaPostule] = useState(false);
  const [niveauxEtudes, setNiveauxEtudes] = useState([]);
  const [applyOpen, setApplyOpen] = useState(false);
  const [toast, setToast] = useState("");
  // null tant que le chiffre n'est pas connu : afficher « 0 » pendant le
  // chargement laisserait croire que personne n'a postulé.
  const [nbCandidatures, setNbCandidatures] = useState(null);

  // Compteur de candidatures de CETTE offre.
  //
  // Passe par compter_candidatures_par_offre plutôt que par un count() direct :
  // la RLS de public.candidatures n'autorise que le candidat lui-même et les
  // administrateurs, un visiteur compterait donc toujours 0. La fonction ne
  // renvoie qu'un agrégat, et exclut les candidatures des comptes de test.
  useEffect(() => {
    const offreId = offer?.id;
    if (!offreId) return;
    let annule = false;
    (async () => {
      const { data, error } = await supabase.rpc("compter_candidatures_par_offre", {
        p_offres: [offreId],
      });
      if (annule) return;
      if (error) {
        // Un compteur indisponible ne doit pas empêcher de postuler : on
        // n'affiche simplement rien.
        console.warn("Compteur de candidatures indisponible :", error.message);
        return;
      }
      setNbCandidatures(data?.[0]?.nombre ?? 0);
    })();
    return () => {
      annule = true;
    };
  }, [offer?.id]);

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
        setCandidateEducationCode(profile?.education_level_code || "");

        // RLS : un candidat lit ses propres candidatures. `head: true` —
        // seul le compte nous intéresse, jamais les lignes.
        if (offer?.id) {
          const { count } = await supabase
            .from("candidatures")
            .select("id", { count: "exact", head: true })
            .eq("job_offer_id", offer.id)
            .eq("user_id", session.user.id);
          setDejaPostule((count || 0) > 0);
        }
      }
    }
    loadSession();
  }, []);

  useEffect(() => {
    let monte = true;
    chargerNiveauxEtudes().then((liste) => {
      if (monte) setNiveauxEtudes(liste);
    });
    return () => {
      monte = false;
    };
  }, []);

  const triggerToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  };

  // Comparaison sur le référentiel niveaux_etudes plutôt que sur l'ancien
  // indexOf() de 7 entrées. Mesuré le 2026-08-24 sur les 63 offres actives :
  // cet indexOf ne posait de barrière que sur 12 d'entre elles — les 51
  // autres ("Bac+3", "Bac+5 (Ingénieur / Master…)", "Bac+2 à Bac+4"…)
  // tombaient au rang 0, et un candidat CM2 y passait sans obstacle.
  const verdictNiveau = comparerNiveaux(niveauxEtudes, candidateEducationCode, offer.min_education_level_code);
  // Désactivé à la demande de l'administrateur : le niveau d'études ne bloque plus les candidatures
  const blocked = false;

  // Offre expirée (point 1) : isOfferExpired existait déjà et servait aux
  // onglets « disponibles / expirées » de /offres, mais cette fiche ne le
  // consultait pas — le bouton « Postuler » restait pleinement actif sur une
  // offre dont la date limite était passée. Le helper couvre les trois cas
  // (statut explicite, is_active === false, deadline dépassée en accordant
  // la journée entière sur un format AAAA-MM-JJ).
  const expiree = isOfferExpired(offer);
  const dateExpiration = offer?.deadline
    ? new Date(offer.deadline).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : null;

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

      {expiree && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 mb-3">
          <p className="text-sm font-black text-amber-900 flex items-center gap-2">
            <span aria-hidden="true">⏳</span>
            <span>Cette offre est terminée</span>
          </p>
          <p className="text-xs font-bold text-amber-800 mt-1.5 leading-relaxed">
            {dateExpiration ? `Elle a expiré le ${dateExpiration}. ` : ""}Des candidats l&apos;ont vue à temps — pas vous.
          </p>
          <p className="text-xs font-medium text-amber-700 mt-1 leading-relaxed">
            Chaque semaine, des dizaines d&apos;offres comme celle-ci passent sans que vous soyez prévenu.
          </p>
          <Link
            href="/offres"
            className="mt-3 inline-flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-black rounded-xl transition"
          >
            <i className="fa-solid fa-bell"></i>
            <span>Être alerté des prochaines offres</span>
          </Link>
        </div>
      )}

      {!expiree && dejaPostule && (
        <p className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg p-2.5 mb-3">
          <i className="fa-solid fa-circle-check mr-1"></i>
          Vous avez déjà postulé à cette offre. Le recruteur a bien reçu votre candidature.
        </p>
      )}

      {!expiree && !dejaPostule && blocked && !isWhatsApp && (
        <p className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5 mb-3">
          <i className="fa-solid fa-triangle-exclamation mr-1"></i>
          Niveau requis : {verdictNiveau.exige.libelle}. Votre profil indique {verdictNiveau.candidat.libelle}.
        </p>
      )}

      {/* Niveau demandé mais impossible à vérifier : on le dit au lieu de
          laisser croire à une vérification réussie, et on n'empêche pas de
          postuler pour autant. */}
      {!expiree && !blocked && !isWhatsApp && !!userSession && verdictNiveau.statut === "inconnu" && verdictNiveau.exige && (
        <p className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg p-2.5 mb-3">
          <i className="fa-solid fa-circle-info mr-1"></i>
          Cette offre demande le niveau {verdictNiveau.exige.libelle}.{" "}
          {verdictNiveau.candidat
            ? `Votre profil indique « ${verdictNiveau.candidat.libelle} », qui ne se compare pas à l'échelle académique.`
            : "Renseignez votre niveau d'études sur votre profil pour savoir si vous y correspondez."}
        </p>
      )}

      {/* Section Candidature dans la page */}
      <div className="w-full">
        {/* Compteur de candidatures — affiché même à zéro.
            Décision explicite : un recruteur qui consulte sa propre annonce
            doit lire un chiffre vrai. Masquer les zéros produirait une
            statistique flatteuse mais fausse, et rendrait le compteur
            inutilisable comme indicateur. Le chiffre exclut les candidatures
            des comptes de test, filtrées en base. */}
        {nbCandidatures !== null && (
          <p className="mb-3 text-xs font-bold text-gray-500 dark:text-gray-400 flex items-center gap-2">
            <i className="fa-solid fa-users text-[11px] text-blue-600"></i>
            {nbCandidatures === 0 ? (
              <span>Aucune candidature pour le moment — soyez la première personne à postuler.</span>
            ) : (
              <span>
                <strong className="text-gray-900 dark:text-white tabular-nums">{nbCandidatures}</strong>{" "}
                {nbCandidatures === 1 ? "personne a déjà postulé" : "personnes ont déjà postulé"} via Facilité
              </span>
            )}
          </p>
        )}
        {contactMethods.hasBoth ? (
          <div className="w-full flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => setApplyOpen(true)}
              disabled={blocked || expiree || dejaPostule}
              className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-black text-sm sm:text-base rounded-2xl transition flex items-center justify-center gap-2.5 shadow-lg shadow-blue-600/25 cursor-pointer disabled:opacity-50"
            >
              <i className="fa-solid fa-paper-plane text-base sm:text-lg"></i>
              <span>{dejaPostule ? "Offre déjà postulée" : "Postuler via Facilité"}</span>
            </button>
            {expiree ? (
              <button
                type="button"
                disabled
                className="flex-1 py-3.5 bg-gray-300 text-gray-600 font-black text-sm sm:text-base rounded-2xl flex items-center justify-center gap-2.5 cursor-not-allowed"
              >
                <i className="fa-brands fa-whatsapp text-lg"></i>
                <span>Candidatures closes</span>
              </button>
            ) : (
              <a
                href={contactMethods.waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-3.5 bg-[#25D366] hover:bg-[#20bd5a] active:scale-98 text-white font-black text-sm sm:text-base rounded-2xl transition flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-500/25 cursor-pointer"
              >
                <i className="fa-brands fa-whatsapp text-lg"></i>
                <span>Postuler sur WhatsApp</span>
              </a>
            )}
          </div>
        ) : targetUrl && !expiree ? (
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
            disabled={blocked || expiree || dejaPostule}
            className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-black text-sm sm:text-base rounded-2xl transition flex items-center justify-center gap-2.5 shadow-lg shadow-blue-600/25 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className="fa-solid fa-paper-plane text-base"></i>
            <span>{expiree ? "Candidatures closes" : dejaPostule ? "Offre déjà postulée" : blocked ? "Niveau insuffisant" : buttonLabel}</span>
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

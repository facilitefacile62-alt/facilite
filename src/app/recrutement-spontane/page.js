"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ApplyModal from "@/components/ApplyModal";

export default function RecrutementSpontanePage() {
  const router = useRouter();
  const [applyingOffer, setApplyingOffer] = useState(null);
  const [toast, setToast] = useState(null);

  const triggerToast = (msg, icon = "fa-check-circle") => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleApplyClick = (offer) => {
    setApplyingOffer(offer);
  };

  // Liste des entreprises pour recrutement spontané
  const spontaneousOffers = [
    {
      id: "seter-spontanee",
      title: "Candidature Spontanée - SETER",
      company: "SETER",
      location: "Sénégal",
      contract_type: "SPONTANÉ",
      description: "Rejoignez la SETER et participez au développement du Train Express Régional !\nPôles & Domaines de recrutement : Ressources Humaines, Transport & Logistique, Achats, Communication, Marketing, Services Voyageurs, Maintenance, Finances & Comptabilité, Qualité, Hygiène, Sécurité, Environnement, Sûreté, Systèmes d'Information, Conducteur de trains, Relation clients, Juridique, Exploitation, Audit.\nDocuments requis : CV & Lettre de motivation.",
      image_url: "/seterimage.avif",
      min_education_level: "Aucun",
      isSpontaneous: true,
      allowSpontaneousModal: true,
      externalLink: "https://seter.sn/recrutement/",
      externalButtonLabel: "Postuler sur le site SETER",
    },
    {
      id: "soboa-spontanee",
      title: "Candidature Spontanée - SOBOA",
      company: "SOBOA",
      location: "Rte des Brasseries, Dakar, Sénégal",
      contract_type: "Stage, Intérim, CDD, CDI",
      description: "Rejoignez la Société des Brasseries de l'Ouest-Africain (SOBOA) et développez votre carrière dans un environnement dynamique.\nTypes de contrats : Stage Académique, Stage Professionnel, Intérim, CDD, CDI.\nDocuments requis : CV & Lettre de motivation.",
      image_url: "/soboa.png",
      min_education_level: "Aucun",
      isSpontaneous: true,
      allowSpontaneousModal: true,
      externalLink: "https://soboa.sn/carriere/",
      externalButtonLabel: "Postuler via le site SOBOA",
    },
    {
      id: "dakardemdikk-spontanee",
      title: "Candidature Spontanée - Dakar Dem Dikk",
      company: "Dakar Dem Dikk",
      location: "Sénégal",
      contract_type: "SPONTANÉ",
      description: "Dakar Dem Dikk vous offre l'opportunité de rejoindre ses équipes. Envoyez votre candidature spontanée pour les postes de : Conducteur, Receveur, Contrôleur, Informatique, RH, Finance, Marketing, Commercial, Téléconseiller, Communication, Maintenance, BTP, etc.\nDocuments requis : CV & Lettre de motivation.",
      image_url: "/demdikk.jpeg",
      min_education_level: "Aucun",
      isSpontaneous: true,
      allowSpontaneousModal: true,
      externalLink: "https://jobs.demdikk.sn/offres/candidature-spontanee/",
      externalButtonLabel: "Postuler via le site Dakar Dem Dikk",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 selection:bg-emerald-200 selection:text-emerald-900 font-sans">
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
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs font-bold text-gray-700 hover:text-emerald-700 transition"
            >
              Retour à l'accueil
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12 flex-1 w-full">
        <div className="bg-gradient-to-r from-emerald-800 to-teal-900 rounded-3xl p-6 sm:p-10 text-white mb-10 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <i className="fa-solid fa-paper-plane text-9xl"></i>
          </div>
          <span className="text-xs font-extrabold text-emerald-300 uppercase tracking-widest block mb-2 relative z-10">Candidatures</span>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight mb-4 relative z-10">Recrutement Spontané</h1>
          <p className="text-base text-emerald-100 font-medium leading-relaxed max-w-2xl relative z-10">
            Envoyez votre profil directement aux entreprises partenaires pour de futures opportunités, même lorsqu'aucune offre n'est actuellement publiée.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {spontaneousOffers.map((offer) => (
            <div 
              key={offer.id} 
              onClick={() => router.push(`/recrutement-spontane/${offer.company.toLowerCase()}`)}
              className="bg-white rounded-3xl border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col group cursor-pointer"
            >
              {offer.image_url && (
                <div className="relative w-full h-48 sm:h-56 overflow-hidden bg-gray-100">
                  <img
                    src={offer.image_url}
                    alt=""
                    aria-hidden="true"
                    className="absolute inset-0 w-full h-full object-cover blur-xl opacity-40 scale-110 pointer-events-none select-none"
                  />
                  <img
                    src={offer.image_url}
                    alt={offer.title}
                    className="relative z-10 w-full h-full object-contain mx-auto block group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                </div>
              )}
              <div className="p-6 flex flex-col flex-1">
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-blue-100 text-blue-700">
                    {offer.contract_type}
                  </span>
                </div>
                <h2 className="font-extrabold text-gray-900 text-lg mb-1">{offer.title}</h2>
                <p className="text-sm text-gray-500 font-semibold mb-2">{offer.company}</p>
                <p className="text-xs text-gray-400 font-medium mb-4 flex items-center gap-1.5">
                  <i className="fa-solid fa-location-dot"></i>
                  {offer.location}
                </p>
                <p className="text-sm text-gray-600 leading-relaxed flex-1 mb-6 whitespace-pre-line line-clamp-3">
                  {offer.description}
                </p>

                <div className="flex flex-col gap-3 w-full mt-auto">
                  {offer.externalLink && (
                    <a
                      href={offer.externalLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="w-full text-center py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm rounded-xl transition cursor-pointer shadow-sm hover:shadow"
                    >
                      <i className="fa-solid fa-external-link-alt mr-2"></i>
                      {offer.externalButtonLabel || "Lien externe"}
                    </a>
                  )}
                  {offer.allowSpontaneousModal && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleApplyClick(offer);
                      }}
                      className="w-full py-3 bg-white hover:bg-emerald-50 text-emerald-600 border-2 border-emerald-500 font-extrabold text-sm rounded-xl transition cursor-pointer shadow-sm md:hidden"
                    >
                      <i className="fa-regular fa-paper-plane mr-2"></i>
                      Candidature Rapide
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
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

      <footer className="bg-white border-t border-gray-200 py-6 text-center text-sm font-medium text-gray-500">
        © 2026 Facilite. Tous droits réservés.
      </footer>
    </div>
  );
}

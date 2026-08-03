"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import ApplyModal from "@/components/ApplyModal";

export default function RecrutementSpontaneDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug;

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
  const spontaneousOffers = {
    seter: {
      id: "seter-spontanee",
      title: "Candidature Spontanée - SETER",
      company: "SETER",
      location: "Sénégal",
      contract_type: "SPONTANÉ",
      description: "Rejoignez la SETER et participez au développement du Train Express Régional ! Nous sommes en pleine croissance et recherchons régulièrement de nouveaux talents pour renforcer nos équipes sur l'ensemble de nos lignes.",
      image_url: "/seterimage.avif",
      min_education_level: "Aucun",
      isSpontaneous: true,
      allowSpontaneousModal: true,
      externalLink: "https://seter.sn/recrutement/",
      externalButtonLabel: "Postuler sur le site SETER",
      poles: [
        "Ressources Humaines",
        "Transport & Logistique",
        "Achats",
        "Communication",
        "Marketing",
        "Services Voyageurs",
        "Maintenance",
        "Finances & Comptabilité",
        "Qualité, Hygiène, Sécurité, Environnement",
        "Sûreté",
        "Systèmes d'Information",
        "Conducteur de trains",
        "Relation clients",
        "Juridique",
        "Exploitation",
        "Audit"
      ],
      requirements: ["CV", "Lettre de motivation"]
    },
    soboa: {
      id: "soboa-spontanee",
      title: "Candidature Spontanée - SOBOA",
      company: "SOBOA",
      location: "Rte des Brasseries, Dakar, Sénégal",
      contract_type: "Stage, Intérim, CDD, CDI",
      description: "La Société des Brasseries de l'Ouest-Africain (SOBOA) recherche des talents passionnés. N'hésitez pas à nous envoyer votre candidature spontanée pour rejoindre nos équipes dans un environnement dynamique et innovant.",
      image_url: "/soboa.png",
      min_education_level: "Aucun",
      isSpontaneous: true,
      allowSpontaneousModal: true,
      externalLink: "https://soboa.sn/carriere/",
      externalButtonLabel: "Postuler via le site SOBOA",
      poles: [
        "Production",
        "Qualité",
        "Maintenance",
        "Logistique & Supply Chain",
        "Commercial & Vente",
        "Marketing",
        "Ressources Humaines",
        "Finances & Comptabilité",
        "Systèmes d'Information"
      ],
      requirements: ["CV", "Lettre de motivation"]
    },
    "dakar-dem-dikk": {
      id: "dakardemdikk-spontanee",
      title: "Candidature Spontanée - Dakar Dem Dikk",
      company: "Dakar Dem Dikk",
      location: "Sénégal",
      contract_type: "SPONTANÉ",
      description: "Dakar Dem Dikk vous offre l'opportunité de rejoindre ses équipes et de participer à l'amélioration de la mobilité urbaine et interurbaine au Sénégal. N'hésitez pas à nous envoyer votre candidature spontanée.",
      image_url: "/demdikk.jpeg",
      min_education_level: "Aucun",
      isSpontaneous: true,
      allowSpontaneousModal: true,
      externalLink: "https://jobs.demdikk.sn/offres/candidature-spontanee/",
      externalButtonLabel: "Postuler via le site Dakar Dem Dikk",
      poles: [
        "Conducteur",
        "Receveur",
        "Contrôleur",
        "Informatique et Technologies",
        "RH",
        "Gestion Finance Comptabilité",
        "Marketing",
        "Commercial - Vente",
        "Téléconseiller - Télémarketing",
        "Communication",
        "Maintenance automobile",
        "Métiers du BTP",
        "Service juridique",
        "Gestion administrative",
        "Secrétariat - Assistanat",
        "Autres"
      ],
      requirements: ["CV", "Lettre de motivation"]
    }
  };

  const offer = spontaneousOffers[slug];

  if (!offer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Entreprise introuvable</h1>
          <button onClick={() => router.push("/recrutement-spontane")} className="text-emerald-600 hover:underline">
            Retour aux candidatures spontanées
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 selection:bg-emerald-200 selection:text-emerald-900 font-sans pb-16">
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
              href="/recrutement-spontane"
              className="text-xs font-bold text-gray-700 hover:text-emerald-700 transition"
            >
              Retour à la liste
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 w-full">
        <div className="bg-white rounded-3xl border border-gray-200 shadow-xl overflow-hidden">
          {offer.image_url && (
            <div className="relative w-full h-64 sm:h-96 bg-gray-100 overflow-hidden">
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
              />
            </div>
          )}
          
          <div className="p-8 sm:p-12">
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-blue-100 text-blue-700">
                {offer.contract_type}
              </span>
            </div>
            <h1 className="font-extrabold text-gray-900 text-3xl sm:text-4xl mb-2">{offer.title}</h1>
            <p className="text-lg text-gray-500 font-semibold mb-4">{offer.company}</p>
            <p className="text-sm text-gray-400 font-medium mb-8 flex items-center gap-2">
              <i className="fa-solid fa-location-dot"></i>
              {offer.location}
            </p>

            <div className="prose prose-emerald max-w-none mb-10">
              <h3 className="text-xl font-bold text-gray-900 mb-3">Présentation</h3>
              <p className="text-gray-600 leading-relaxed mb-6">{offer.description}</p>

              {offer.poles && offer.poles.length > 0 && (
                <>
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Pôles & Domaines de recrutement</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
                    {offer.poles.map((pole, index) => (
                      <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <i className="fa-solid fa-check-circle text-emerald-500 mt-0.5"></i>
                        <span className="text-sm text-gray-700 font-medium">{pole}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {offer.requirements && offer.requirements.length > 0 && (
                <>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">Documents requis</h3>
                  <ul className="list-disc pl-5 text-gray-600 space-y-1 mb-8">
                    {offer.requirements.map((req, index) => (
                      <li key={index}>{req}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 mt-8 pt-8 border-t border-gray-100">
              {offer.externalLink && (
                <a
                  href={offer.externalLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-center py-4 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-base rounded-xl transition cursor-pointer shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-external-link-alt"></i>
                  {offer.externalButtonLabel || "Lien externe"}
                </a>
              )}
              {offer.allowSpontaneousModal && (
                <button
                  onClick={() => handleApplyClick(offer)}
                  className="flex-1 py-4 px-6 bg-white hover:bg-emerald-50 text-emerald-600 border-2 border-emerald-500 font-extrabold text-base rounded-xl transition cursor-pointer shadow-sm hover:shadow-md flex items-center justify-center gap-2"
                >
                  <i className="fa-regular fa-paper-plane"></i>
                  Candidature Rapide
                </button>
              )}
            </div>
          </div>
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
    </div>
  );
}

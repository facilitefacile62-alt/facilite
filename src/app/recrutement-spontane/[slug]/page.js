"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import ApplyModal from "@/components/ApplyModal";
import { SPONTANEOUS_COMPANIES } from "@/lib/spontaneousData";

export default function RecrutementSpontaneDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug;

  const [applyingOffer, setApplyingOffer] = useState(null);
  const [toast, setToast] = useState(null);

  const triggerToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleApplyClick = (offer) => {
    setApplyingOffer(offer);
  };

  const offer = SPONTANEOUS_COMPANIES.find((item) => item.slug === slug);

  if (!offer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center bg-white p-8 rounded-3xl border border-gray-200 shadow-xl max-w-md w-full">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl">
            <i className="fa-solid fa-building-circle-xmark"></i>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Entreprise Introuvable</h1>
          <p className="text-sm text-gray-500 mb-6">L'entreprise demandée n'existe pas ou a été déplacée.</p>
          <button
            onClick={() => router.push("/recrutement-spontane")}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl transition"
          >
            Retour au répertoire des entreprises
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 selection:bg-emerald-200 selection:text-emerald-900 font-sans pb-16">
      {/* Toast Notification */}
      <div
        className={`fixed top-20 right-4 z-[700] bg-gray-900 text-white px-5 py-3 rounded-2xl shadow-2xl transition-all duration-300 transform ${
          toast ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0 pointer-events-none"
        }`}
      >
        <span className="text-sm font-semibold">{toast}</span>
      </div>

      {/* Header */}
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
              Retour au répertoire
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 w-full">
        <div className="bg-white rounded-3xl border border-gray-200 shadow-xl overflow-hidden">
          {/* Square Image Container / Emplacement d'image carré */}
          <div className="relative w-full aspect-square max-h-96 bg-gradient-to-br from-emerald-50 via-teal-50 to-gray-100 overflow-hidden flex flex-col items-center justify-center p-8 text-center border-b border-gray-100">
            {offer.image_url ? (
              <img
                src={offer.image_url}
                alt={offer.company}
                className="w-full h-full object-cover rounded-2xl"
              />
            ) : (
              <div className="flex flex-col items-center justify-center">
                <div className="w-24 h-24 rounded-3xl bg-white border border-emerald-200 shadow-lg flex items-center justify-center mb-4 text-emerald-600">
                  <i className="fa-solid fa-building text-4xl"></i>
                </div>
                <span className="text-sm font-extrabold text-emerald-800 bg-emerald-100/90 px-4 py-1.5 rounded-full mb-2">
                  {offer.company}
                </span>
                <span className="text-xs font-medium text-gray-400">
                  <i className="fa-solid fa-image mr-1 text-emerald-400"></i>
                  Zone d'Image Carrée (Prête pour intégration)
                </span>
              </div>
            )}
          </div>

          <div className="p-8 sm:p-12">
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                {offer.contract_type}
              </span>
            </div>
            
            <h1 className="font-extrabold text-gray-900 text-3xl sm:text-4xl mb-2">{offer.company}</h1>
            <p className="text-lg text-emerald-700 font-semibold mb-4">{offer.domains}</p>
            <p className="text-sm text-gray-400 font-medium mb-8 flex items-center gap-2">
              <i className="fa-solid fa-location-dot"></i>
              {offer.location}
            </p>

            {/* Direct Contact Info Box */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 mb-8">
              <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-800 block mb-1">
                Lien Direct / Adresse e-mail de recrutement :
              </span>
              <p className="text-base font-mono font-bold text-gray-900 selection:bg-emerald-300">
                {offer.rawContact}
              </p>
            </div>

            <div className="prose prose-emerald max-w-none mb-10">
              <h3 className="text-xl font-bold text-gray-900 mb-3">Présentation & Opportunité</h3>
              <p className="text-gray-600 leading-relaxed mb-6">{offer.description}</p>

              {offer.poles && offer.poles.length > 0 && (
                <>
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Domaines / Postes ciblés</h3>
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
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-4 mt-8 pt-8 border-t border-gray-100">
              {offer.contactType === "url" ? (
                <a
                  href={offer.externalLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-center py-4 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-base rounded-xl transition cursor-pointer shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-external-link-alt"></i>
                  Accéder au site officiel de l'entreprise
                </a>
              ) : (
                <a
                  href={`mailto:${offer.email}`}
                  className="flex-1 text-center py-4 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-base rounded-xl transition cursor-pointer shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                >
                  <i className="fa-solid fa-paper-plane"></i>
                  Envoyer sa candidature par e-mail
                </a>
              )}
              
              <button
                onClick={() => handleApplyClick(offer)}
                className="flex-1 py-4 px-6 bg-white hover:bg-emerald-50 text-emerald-700 border-2 border-emerald-500 font-extrabold text-base rounded-xl transition cursor-pointer shadow-sm hover:shadow-md flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-bolt"></i>
                Formulaire rapide
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Apply Modal */}
      <ApplyModal
        isOpen={!!applyingOffer}
        onClose={() => setApplyingOffer(null)}
        job={
          applyingOffer
            ? {
                id: applyingOffer.id,
                titleFR: `Candidature Spontanée - ${applyingOffer.company}`,
                titleEN: `Spontaneous Application - ${applyingOffer.company}`,
                company: applyingOffer.company,
                isSpontaneous: true,
              }
            : null
        }
        selectedLang="FR"
        triggerToast={triggerToast}
      />
    </div>
  );
}

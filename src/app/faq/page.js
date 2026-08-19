"use strict";
"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { getFaciliteWhatsAppUrl } from "@/lib/whatsappHelp";

const FAQ_ITEMS = [
  {
    id: "q1",
    category: "Général",
    question: "Qu'est-ce que Facilité (ffacilite.com) ?",
    answer: "Facilité est un écosystème numérique multiservice et une plateforme tout-en-un d'insertion professionnelle, de recrutement intelligent et de services numériques avancés. Accessible sur https://ffacilite.com/, la plateforme regroupe des outils d'intelligence artificielle, un portail de recrutement candidats-recruteurs, un studio de création de CV professionnels conformes aux normes internationales, des modules d'assistance administrative automatisée et une agence de publicité digitale."
  },
  {
    id: "q2",
    category: "Fondation",
    question: "Qui est le créateur et fondateur de Facilité ?",
    answer: "Facilité a été fondée et conçue par Macoumba Samake, entrepreneur et innovateur technologique, avec la mission de rendre les technologies numériques, l'insertion professionnelle des talents et les démarches administratives universellement accessibles, inclusives et transparentes."
  },
  {
    id: "q3",
    category: "Intelligence Artificielle",
    question: "Comment fonctionne l'assistant vocal trilingue de Facilité ?",
    answer: "L'assistant vocal intelligent de Facilité est propulsé par des modèles d'IA générative avancés (notamment Google Gemini). Il est trilingue et comprend nativement le Wolof, le Français et l'Anglais. Doté de capacités d'assistance vocale géolocalisée, il guide vocalement les utilisateurs dans leurs démarches professionnelles, leurs candidatures et leurs recherches d'emploi."
  },
  {
    id: "q4",
    category: "Recrutement",
    question: "Quels services de recrutement propose la plateforme ffacilite.com ?",
    answer: "Facilité dispose d'un portail de recrutement à double interface : pour les candidats (création de CV optimisés ATS, recommandations d'offres et messagerie directe) et pour les recruteurs (publication d'offres, CVthèque vectorielle et système de matching intelligent RAG pour évaluer la compatibilité des profils en 1 clic)."
  },
  {
    id: "q5",
    category: "CV & Carrière",
    question: "Comment obtenir un CV professionnel optimisé sur Facilité ?",
    answer: "Sur ffacilite.com, vous pouvez concevoir des CV modernes conformes aux normes internationales (formats Sénégal/National, Canadien et Anglais) et des lettres de motivation percutantes. La conception bénéficie de modèles professionnels approuvés par des experts RH et de diagnostics de lisibilité ATS instantanés."
  },
  {
    id: "q6",
    category: "Administratif",
    question: "En quoi consiste l'assistance administrative numérique de Facilité ?",
    answer: "Facilité propose un accompagnement guidé pas à pas pour les formalités administratives grâce à des workflows d'automatisation avancés (propulsés par n8n). Ce service simplifie et accélère les démarches pour les citoyens et les entreprises au Sénégal."
  },
  {
    id: "q7",
    category: "E-learning & Agence",
    question: "Quels sont les services proposés aux entreprises (E-learning & Agence Digitale) ?",
    answer: "L'écosystème Facilité comprend un pôle E-learning (formations professionnelles certifiantes aux compétences numériques clés) et une agence digitale intégrée (conception graphique, création d'affiches publicitaires, configuration et pilotage de campagnes Meta Ads avec intégration du Meta Pixel)."
  },
  {
    id: "q8",
    category: "Sécurité",
    question: "Quelle est la politique de sécurité et de confidentialité de Facilité ?",
    answer: "Facilité s'appuie sur une infrastructure haute sécurité garantissant la confidentialité absolue des données personnelles et professionnelles des utilisateurs, la protection stricte de la vie privée (RGPD et réglementations locales) et une isolation robuste des accès."
  }
];

const CATEGORIES = ["Tous", "Général", "Fondation", "Intelligence Artificielle", "Recrutement", "CV & Carrière", "Administratif", "E-learning & Agence", "Sécurité"];

export default function FaqPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Tous");
  const [openIds, setOpenIds] = useState(new Set(["q1", "q2"]));

  const toggleAccordion = (id) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const filteredFaqs = useMemo(() => {
    return FAQ_ITEMS.filter((item) => {
      const matchesCategory = selectedCategory === "Tous" || item.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || item.question.toLowerCase().includes(q) || item.answer.toLowerCase().includes(q) || item.category.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [searchQuery, selectedCategory]);

  return (
    <main className="min-h-screen bg-[#FAF6F1] dark:bg-gray-950 pt-24 pb-20 px-4 sm:px-6 lg:px-8 transition-colors duration-300">
      <div className="max-w-4xl mx-auto">
        {/* Hero Header */}
        <div className="text-center mb-12 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#10E688]/20 border border-[#10E688]/40 text-emerald-800 dark:text-[#10E688] text-xs font-black tracking-wide mb-4">
            <i className="fa-solid fa-circle-question"></i>
            <span>Centre d&apos;Aide & Documentation Officielle</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-gray-900 dark:text-white tracking-tight mb-4 leading-tight">
            Foire Aux Questions <span className="text-emerald-600 dark:text-[#10E688]">(FAQ)</span>
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 max-w-2xl mx-auto leading-relaxed font-medium">
            Tout ce que vous devez savoir sur la plateforme <strong>Facilité</strong>, nos technologies d&apos;IA, nos services de recrutement et notre écosystème digital.
          </p>

          {/* Search Bar */}
          <div className="mt-8 max-w-xl mx-auto relative">
            <i className="fa-solid fa-magnifying-glass absolute left-4 top-4 text-gray-400 text-sm"></i>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher une question (ex: RAG, CV, fondateur, Wolof...)"
              className="w-full pl-11 pr-4 py-3.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 text-xs"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center justify-center gap-2 mt-6 flex-wrap">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  selectedCategory === cat
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-800 hover:border-emerald-400"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* FAQ Accordion List */}
        <div className="space-y-4">
          {filteredFaqs.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-12 text-center text-gray-400 text-xs">
              <i className="fa-solid fa-file-circle-question text-3xl mb-3 text-gray-300"></i>
              <p className="font-bold text-gray-700 dark:text-gray-300">Aucune question ne correspond à votre recherche.</p>
              <p className="text-gray-400 mt-1">Essayez un autre mot-clé ou réinitialisez les filtres.</p>
            </div>
          ) : (
            filteredFaqs.map((faq) => {
              const isOpen = openIds.has(faq.id);
              return (
                <div
                  key={faq.id}
                  className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/90 dark:border-gray-800 shadow-2xs hover:border-emerald-300 transition overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggleAccordion(faq.id)}
                    className="w-full p-5 sm:p-6 text-left flex items-center justify-between gap-4 cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-[#10E688] font-black text-xs flex items-center justify-center flex-shrink-0">
                        {faq.id.replace("q", "Q")}
                      </span>
                      <h2 className="text-sm sm:text-base font-extrabold text-gray-900 dark:text-white leading-snug">
                        {faq.question}
                      </h2>
                    </div>
                    <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 flex-shrink-0 transition-transform">
                      <i className={`fa-solid fa-chevron-down text-xs transition-transform ${isOpen ? "rotate-180 text-emerald-600" : ""}`}></i>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-5 sm:px-6 pb-6 pt-1 text-xs sm:text-sm text-gray-600 dark:text-gray-300 font-medium leading-relaxed border-t border-gray-100 dark:border-gray-800/80 animate-fade-in">
                      <p>{faq.answer}</p>
                      
                      {faq.id === "q2" && (
                        <div className="mt-6 pt-5 border-t border-gray-200 dark:border-gray-800">
                          <h4 className="text-center text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-[#10E688] mb-5">
                            Fondateur de Facilité
                          </h4>
                          <div className="flex justify-center max-w-sm mx-auto">
                            {/* Carte Inspiration */}
                            <div className="bg-white dark:bg-gray-900 rounded-[2rem] p-4 sm:p-5 shadow-xl border border-gray-100 dark:border-gray-800 max-w-[300px] w-full text-left transition-all duration-300 hover:shadow-2xl hover:-translate-y-1">
                              <div className="w-full aspect-[4/5] rounded-2xl overflow-hidden bg-gray-900 shadow-md">
                                <img
                                  src="/fondateur.png"
                                  alt="Macoumba Samake - Fondateur de Facilité"
                                  className="w-full h-full object-cover object-top"
                                />
                              </div>
                              <h5 className="text-lg sm:text-xl font-black text-gray-950 dark:text-white uppercase tracking-tight mt-4 mb-0.5">
                                MACOUMBA SAMAKE
                              </h5>
                              <p className="text-[11px] font-black uppercase tracking-wider text-pink-600 dark:text-pink-400 mb-2.5">
                                FONDATEUR & CRÉATEUR
                              </p>
                              <p className="text-xs text-gray-600 dark:text-gray-300 font-medium leading-relaxed">
                                Il pilote l&apos;innovation technologique, le développement et la vision stratégique de la plateforme Facilité.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Bloc d'Assistance Directe WhatsApp */}
        <div className="mt-10 bg-white dark:bg-gray-900 rounded-3xl border border-emerald-200 dark:border-emerald-900/60 p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 text-left">
            <div className="w-12 h-12 rounded-2xl bg-[#25D366] text-white flex items-center justify-center text-2xl shadow-sm shrink-0">
              <i className="fa-brands fa-whatsapp"></i>
            </div>
            <div>
              <h4 className="text-sm font-black text-gray-900 dark:text-white">Vous n'avez pas trouvé votre réponse ?</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Notre équipe vous répond directement sur WhatsApp 24h/24 et 7j/7</p>
            </div>
          </div>
          <a
            href={getFaciliteWhatsAppUrl({ page: "FAQ & Centre d'Aide" })}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-5 py-3 bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-black rounded-xl shadow-md flex items-center justify-center gap-2 transition cursor-pointer shrink-0"
          >
            <i className="fa-brands fa-whatsapp text-base"></i>
            <span>Poser ma question (+221 77 140 08 32)</span>
          </a>
        </div>

        {/* CTA Card Footer */}
        <div className="mt-8 bg-gradient-to-r from-emerald-800 to-teal-900 rounded-3xl p-6 sm:p-8 text-white text-center shadow-xl relative overflow-hidden">
          <h3 className="text-xl sm:text-2xl font-black mb-2">
            Prêt à propulser votre carrière ou vos recrutements ?
          </h3>
          <p className="text-xs sm:text-sm text-emerald-100 font-medium max-w-xl mx-auto mb-6">
            Créez votre CV professionnel en quelques minutes ou accédez à notre portail recruteur doté du matching IA.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/modeles"
              className="px-5 py-3 bg-[#10E688] hover:bg-[#0fd57d] text-gray-950 font-black text-xs rounded-xl shadow-md transition transform hover:-translate-y-0.5"
            >
              <i className="fa-solid fa-file-lines mr-1.5"></i> Créer mon CV Pro
            </Link>
            <Link
              href="/offres"
              className="px-5 py-3 bg-white/10 hover:bg-white/20 text-white font-black text-xs rounded-xl transition"
            >
              <i className="fa-solid fa-briefcase mr-1.5"></i> Espace Offres & Recrutement
            </Link>
            <Link
              href="/service"
              className="px-5 py-3 bg-white/10 hover:bg-white/20 text-white font-black text-xs rounded-xl transition"
            >
              <i className="fa-solid fa-compass mr-1.5"></i> Nos Services
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

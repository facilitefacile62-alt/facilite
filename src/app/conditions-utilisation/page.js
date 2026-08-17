"use strict";
"use client";

import { useState } from "react";
import Link from "next/link";

export default function ConditionsUtilisationPage() {
  const [activeSection, setActiveSection] = useState("objet");

  const sections = [
    { id: "objet", title: "1. Objet & Champ d'Application", icon: "fa-scale-balanced" },
    { id: "services", title: "2. Description des Services Proposés", icon: "fa-cubes" },
    { id: "comptes", title: "3. Inscription & Sécurité des Comptes", icon: "fa-user-lock" },
    { id: "engagements", title: "4. Engagements & Obligations de l'Utilisateur", icon: "fa-handshake" },
    { id: "tarifs-paiements", title: "5. Tarifs, Facturation & Paiements Sécurisés", icon: "fa-credit-card" },
    { id: "propriete", title: "6. Propriété Intellectuelle & Droits d'Auteur", icon: "fa-copyright" },
    { id: "responsabilite", title: "7. Responsabilité & Disponibilité de la Plateforme", icon: "fa-shield-halved" },
    { id: "resiliation", title: "8. Suspension & Résiliation", icon: "fa-ban" },
    { id: "droit-applicable", title: "9. Droit Applicable & Juridiction Compétente", icon: "fa-gavel" },
  ];

  return (
    <main className="min-h-screen bg-[#FAF6F1] dark:bg-gray-950 text-gray-900 dark:text-gray-100 pt-28 pb-20 px-4 sm:px-6 lg:px-8 transition-colors duration-300 font-sans">
      <div className="max-w-6xl mx-auto">
        {/* En-tête Hero */}
        <div className="text-center mb-12 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-100 dark:bg-blue-950/60 border border-blue-300/50 dark:border-blue-700/40 text-blue-900 dark:text-blue-400 text-xs font-black tracking-wide mb-4 shadow-xs">
            <i className="fa-solid fa-file-contract text-sm"></i>
            <span>Termes & Conditions Légales Officielles</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-gray-900 dark:text-white tracking-tight mb-4 leading-tight">
            Conditions Générales d'<span className="text-blue-600 dark:text-blue-400">Utilisation</span> (CGU)
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed font-medium">
            Les présentes Conditions Générales régissent l'accès, l'utilisation de la plateforme <strong>Facilité</strong> (ffacilite.com) et la souscription à l'ensemble de nos services d'insertion professionnelle, de recrutement et d'assistance automatisée.
          </p>
          <div className="mt-4 flex items-center justify-center gap-4 text-xs font-bold text-gray-500 dark:text-gray-400">
            <span><i className="fa-regular fa-calendar-check mr-1.5 text-blue-600"></i> En vigueur au : 17 Août 2026</span>
            <span>•</span>
            <span><i className="fa-solid fa-stamp mr-1.5 text-blue-600"></i> Version 2.4</span>
          </div>
        </div>

        {/* Disposition Principale */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Sommaire interactif */}
          <aside className="lg:col-span-4">
            <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-200/80 dark:border-gray-800 shadow-sm sticky top-28 space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3 px-2">
                Sommaire des CGU
              </h3>
              <nav className="space-y-1">
                {sections.map((sec) => (
                  <a
                    key={sec.id}
                    href={`#${sec.id}`}
                    onClick={() => setActiveSection(sec.id)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                      activeSection === sec.id
                        ? "bg-blue-600 text-white shadow-md shadow-blue-600/20 font-black"
                        : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                    }`}
                  >
                    <i className={`fa-solid ${sec.icon} w-4 text-center text-sm`}></i>
                    <span className="truncate">{sec.title}</span>
                  </a>
                ))}
              </nav>

              <div className="pt-4 mt-4 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="w-full py-2.5 px-4 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <i className="fa-solid fa-print"></i>
                  <span>Imprimer ce document</span>
                </button>
              </div>
            </div>
          </aside>

          {/* Corps des Articles */}
          <article className="lg:col-span-8 space-y-8">
            {/* Article 1 */}
            <section id="objet" className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-3xl border border-gray-200/80 dark:border-gray-800 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 flex items-center justify-center font-black">
                  1
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white">
                  Objet & Champ d'Application
                </h2>
              </div>
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed space-y-3">
                <p>
                  Les présentes Conditions Générales d'Utilisation (ci-après les « <strong>CGU</strong> ») ont pour objet de définir les modalités et conditions dans lesquelles la plateforme <strong>Facilité</strong> (accessible à l'adresse <strong>https://ffacilite.com/</strong>), éditée sous la direction de son fondateur <strong>Macoumba Samake</strong>, met à la disposition des utilisateurs ses services numériques.
                </p>
                <p>
                  Tout accès ou utilisation de la plateforme implique l'acceptation sans réserve de l'intégralité des présentes conditions. Si un utilisateur refuse tout ou partie des présentes CGU, il lui est demandé de renoncer à l'utilisation des services.
                </p>
              </div>
            </section>

            {/* Article 2 */}
            <section id="services" className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-3xl border border-gray-200/80 dark:border-gray-800 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 flex items-center justify-center font-black">
                  2
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white">
                  Description des Services Proposés
                </h2>
              </div>
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed space-y-3">
                <p>La plateforme Facilité regroupe plusieurs pôles d'activités numériques innovants :</p>
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Conception & Optimisation de CV / Lettres :</strong> Éditeur en ligne interactif, modèles certifiés conformes ATS (National, Canadien, Anglais) et diagnostics de lisibilité instantanés.</li>
                  <li><strong>Espace Recrutement & Matching RAG :</strong> Publication d'offres d'emploi, CVthèque vectorielle et algorithmes de matching pour connecter candidats et employeurs.</li>
                  <li><strong>Assistance Administrative Automatisée :</strong> Workflows d'automatisation (n8n & scripts sécurisés) facilitant le traitement des démarches et dossiers officiels au Sénégal.</li>
                  <li><strong>Suite d'Outils Numériques (Client-Side) :</strong> Compression, fusion, conversion et manipulation locale de documents PDF et images.</li>
                  <li><strong>Support RH & Assistance IA 24/7 :</strong> Messagerie en temps réel assistée par intelligence artificielle et agents experts dédiés.</li>
                </ul>
              </div>
            </section>

            {/* Article 3 */}
            <section id="comptes" className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-3xl border border-gray-200/80 dark:border-gray-800 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 flex items-center justify-center font-black">
                  3
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white">
                  Inscription, Rôles & Sécurité des Identifiants
                </h2>
              </div>
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed space-y-3">
                <p>
                  Pour accéder à certaines fonctionnalités (candidature, téléchargement de factures, messagerie), l'utilisateur doit créer un compte.
                </p>
                <p>
                  L'utilisateur s'engage à fournir des informations exactes et à maintenir la stricte confidentialité de ses identifiants de connexion. Toute action effectuée depuis le compte d'un utilisateur est présumée avoir été réalisée par celui-ci. En cas de perte ou d'accès frauduleux, l'utilisateur doit immédiatement en avertir l'équipe Facilité.
                </p>
              </div>
            </section>

            {/* Article 4 */}
            <section id="engagements" className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-3xl border border-gray-200/80 dark:border-gray-800 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 flex items-center justify-center font-black">
                  4
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white">
                  Engagements & Obligations de l'Utilisateur
                </h2>
              </div>
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed space-y-3">
                <p>En utilisant Facilité, chaque utilisateur s'engage formellement à :</p>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>Ne publier aucun contenu mensonger, diffamatoire, injurieux ou attentatoire aux droits d'autrui.</li>
                  <li>Ne pas tenter de contourner les mesures de sécurité, de saturer l'infrastructure (attaques DDoS) ou d'aspirer massivement les données du site par des méthodes non autorisées.</li>
                  <li>Fournir des diplômes et justificatifs authentiques dans le cadre de ses candidatures.</li>
                </ul>
              </div>
            </section>

            {/* Article 5 */}
            <section id="tarifs-paiements" className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-3xl border border-gray-200/80 dark:border-gray-800 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 flex items-center justify-center font-black">
                  5
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white">
                  Tarifs, Facturation & Moyens de Paiement
                </h2>
              </div>
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed space-y-3">
                <p>
                  Les tarifs des services payants (rédaction experte de CV, conception de templates, assistance administrative premium) sont clairement indiqués en Francs CFA (XOF) sur le site.
                </p>
                <p>
                  Les règlements s'effectuent de manière instantanée et sécurisée via les passerelles mobiles agréées (<strong>Wave</strong>, <strong>Orange Money</strong>, <strong>KPay</strong>) ou par <strong>Carte bancaire</strong>. Une facture conforme est immédiatement émise et téléchargeable dans l'espace client.
                </p>
              </div>
            </section>

            {/* Article 6 */}
            <section id="propriete" className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-3xl border border-gray-200/80 dark:border-gray-800 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 flex items-center justify-center font-black">
                  6
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white">
                  Propriété Intellectuelle & Droits Réservés
                </h2>
              </div>
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed space-y-3">
                <p>
                  L'ensemble des éléments composant la plateforme Facilité (marques, logos, interfaces graphiques, textes, architectures logicielles, codes sources, modèles de CV) sont la propriété exclusive de <strong>Macoumba Samake / Facilité</strong> et sont protégés par le droit de la propriété intellectuelle.
                </p>
                <p>
                  Toute reproduction, imitation, extraction ou exploitation non autorisée est strictement interdite.
                </p>
              </div>
            </section>

            {/* Article 7 */}
            <section id="responsabilite" className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-3xl border border-gray-200/80 dark:border-gray-800 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 flex items-center justify-center font-black">
                  7
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white">
                  Responsabilité & Disponibilité du Service
                </h2>
              </div>
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed space-y-3">
                <p>
                  Facilité met en œuvre tous les moyens raisonnables pour assurer une disponibilité de service 24h/24 et 7j/7. Toutefois, la responsabilité de la plateforme ne saurait être engagée en cas de maintenance programmée, de force majeure ou d'interruptions imputables aux réseaux de télécommunication tiers.
                </p>
              </div>
            </section>

            {/* Article 8 */}
            <section id="resiliation" className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-3xl border border-gray-200/80 dark:border-gray-800 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 flex items-center justify-center font-black">
                  8
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white">
                  Suspension & Résiliation
                </h2>
              </div>
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed space-y-3">
                <p>
                  En cas de violation des présentes CGU par un utilisateur (fraude, usurpation d'identité, propos injurieux), Facilité se réserve le droit de suspendre ou de résilier son compte sans préavis, sans préjudice d'éventuelles poursuites judiciaires.
                </p>
              </div>
            </section>

            {/* Article 9 */}
            <section id="droit-applicable" className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-3xl border border-gray-200/80 dark:border-gray-800 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 flex items-center justify-center font-black">
                  9
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white">
                  Droit Applicable & Règlement des Litiges
                </h2>
              </div>
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed space-y-3">
                <p>
                  Les présentes Conditions Générales d'Utilisation sont régies et interprétées conformément au <strong>Droit de la République du Sénégal</strong>.
                </p>
                <p>
                  En cas de différend relatif à l'interprétation ou à l'exécution des présentes, les parties s'engagent à privilégier une solution amiable. À défaut d'accord, le litige sera soumis à la compétence exclusive des tribunaux compétents de <strong>Dakar, Sénégal</strong>.
                </p>
              </div>
            </section>
          </article>
        </div>

        {/* Bouton de retour en bas */}
        <div className="mt-12 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gray-900 hover:bg-black dark:bg-white dark:hover:bg-gray-100 text-white dark:text-gray-950 text-xs font-black transition-all shadow-md"
          >
            <i className="fa-solid fa-arrow-left"></i>
            <span>Retour à l'accueil Facilité</span>
          </Link>
        </div>
      </div>
    </main>
  );
}

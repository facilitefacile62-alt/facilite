"use strict";
"use client";

import { useState } from "react";
import Link from "next/link";

export default function ConditionsPage() {
  const [activeSection, setActiveSection] = useState("objet");

  const sections = [
    { id: "objet", title: "1. Objet & Acceptation des CGU", icon: "fa-scale-balanced" },
    { id: "services", title: "2. Description des Services Proposés", icon: "fa-cubes" },
    { id: "comptes-google", title: "3. Inscription, Sécurité & Connexion Google", icon: "fa-user-lock" },
    { id: "engagements", title: "4. Obligations de l'Utilisateur", icon: "fa-handshake" },
    { id: "tarifs-paiements", title: "5. Tarifs, Commandes & Paiements", icon: "fa-credit-card" },
    { id: "propriete", title: "6. Propriété Intellectuelle", icon: "fa-copyright" },
    { id: "responsabilite", title: "7. Responsabilité & Disponibilité", icon: "fa-shield-halved" },
    { id: "resiliation", title: "8. Suspension & Suppression de Compte", icon: "fa-ban" },
    { id: "droit-applicable", title: "9. Droit Applicable & Litiges", icon: "fa-gavel" },
    { id: "contact", title: "10. Contact & Assistance", icon: "fa-envelope" },
  ];

  return (
    <div className="min-h-screen bg-[#FAF6F1] dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-sans flex flex-col justify-between transition-colors duration-300">
      
      {/* Barre de navigation simplifiée */}
      {/* Sous-barre de navigation légale (point 3, 2026-08-27).
          AVANT : un <header sticky top-0 z-40> portant à nouveau le logo et
          « FFACILITE.COM », alors que le Header global est déjà rendu sur
          TOUTES les routes par layout.js:228. Deux en-têtes empilés, tous
          deux collants : sur un écran étroit sans barre d'adresse — le cas
          d'une WebView Android — le repère de marque se dédoublait et se
          chevauchait au défilement (remonté par le testeur Google Play).
          APRÈS : la marque en double est retirée et la barre n'est plus
          collante ; seuls les liens croisés entre pages légales restent,
          car eux n'existent pas dans le Header global. */}
      <nav className="border-b border-gray-200/80 dark:border-gray-800 bg-white/70 dark:bg-gray-900/70 px-4 sm:px-8 py-2.5">
        <div className="max-w-6xl mx-auto flex items-center justify-end flex-wrap gap-y-2">
          <div className="flex items-center gap-3">
            <Link
              href="/confidentialite"
              className="text-xs font-bold text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 px-3 py-1.5 rounded-lg transition"
            >
              Confidentialité
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-700 dark:text-blue-400 font-extrabold text-xs rounded-xl border border-blue-200/60 dark:border-blue-800 transition"
            >
              <i className="fa-solid fa-house text-xs"></i>
              <span>Accueil</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* Contenu Principal */}
      <main className="max-w-6xl mx-auto pt-8 pb-16 px-4 sm:px-6 lg:px-8 flex-1 w-full">
        {/* En-tête Hero */}
        <div className="text-center mb-10 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-100 dark:bg-blue-950/60 border border-blue-300/50 dark:border-blue-700/40 text-blue-900 dark:text-blue-400 text-xs font-black tracking-wide mb-3 shadow-xs">
            <i className="fa-solid fa-file-contract text-sm"></i>
            <span>Conditions Générales d&apos;Utilisation Officielles</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 dark:text-white tracking-tight mb-3 leading-tight">
            Conditions Générales d&apos;<span className="text-blue-600 dark:text-blue-400">Utilisation</span> (CGU)
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 max-w-2xl mx-auto leading-relaxed font-medium">
            Les présentes Conditions régissent l&apos;accès et l&apos;utilisation de la plateforme <strong>Facilité</strong> (ffacilite.com) pour la conception de CV, la candidature aux offres d&apos;emploi et nos services numériques.
          </p>
          <div className="mt-4 flex items-center justify-center gap-4 text-xs font-bold text-gray-500 dark:text-gray-400 flex-wrap">
            <span><i className="fa-regular fa-calendar-check mr-1.5 text-blue-600"></i> Dernière mise à jour : 17 Août 2026</span>
            <span>•</span>
            <span><i className="fa-solid fa-stamp mr-1.5 text-blue-600"></i> Version 2.5</span>
          </div>
        </div>

        {/* Disposition Principale */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Sommaire interactif */}
          <aside className="lg:col-span-4">
            <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-200/80 dark:border-gray-800 shadow-sm sticky top-24 space-y-3">
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
                  <span>Imprimer / Télécharger en PDF</span>
                </button>
              </div>
            </div>
          </aside>

          {/* Corps du texte des CGU */}
          <article className="lg:col-span-8 space-y-8">
            
            {/* Section 1 : Objet */}
            <section id="objet" className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-3xl border border-gray-200/80 dark:border-gray-800 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 flex items-center justify-center font-black">
                  1
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white">
                  Objet &amp; Acceptation des Conditions
                </h2>
              </div>
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed space-y-3">
                <p>
                  Les présentes Conditions Générales d&apos;Utilisation (ci-après les <strong>« CGU »</strong>) définissent les règles et conditions juridiques applicables à toute personne (ci-après l&apos;<strong>« Utilisateur »</strong>) naviguant sur le site <strong>https://ffacilite.com/</strong> ou recourant aux services proposés par <strong>Facilité</strong>.
                </p>
                <p>
                  Toute navigation, création de compte ou commande sur la plateforme implique l&apos;acceptation pleine, entière et sans réserve des présentes CGU ainsi que de notre <Link href="/confidentialite" className="text-blue-600 dark:text-blue-400 underline font-bold">Politique de Confidentialité</Link>.
                </p>
              </div>
            </section>

            {/* Section 2 : Services Proposés */}
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
                <p>Facilité met à la disposition des utilisateurs une gamme d&apos;outils modernes d&apos;insertion professionnelle :</p>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li><strong>Conception de CV &amp; Modèles :</strong> Édition et personnalisation de modèles de CV professionnels certifiés conformes ATS (Formats Sénégal, Canadien, Anglais).</li>
                  <li><strong>Catalogue d&apos;Offres d&apos;Emploi :</strong> Consultation gratuite et mise en relation directe avec les opportunités publiées par des recruteurs au Sénégal et en Afrique de l&apos;Ouest.</li>
                  <li><strong>Extracteur d&apos;Annonces 1-Click :</strong> Reconnaissance OCR d&apos;affiches d&apos;emploi et génération instantanée de candidatures.</li>
                  <li><strong>Outils PDF Utilitaires :</strong> Compression, fusion et conversion sécurisée de documents de candidature.</li>
                </ul>
              </div>
            </section>

            {/* Section 3 : Inscription, Sécurité & Authentification Google */}
            <section id="comptes-google" className="bg-blue-50/50 dark:bg-blue-950/20 p-6 sm:p-8 rounded-3xl border-2 border-blue-200 dark:border-blue-800/60 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-lg">
                  <i className="fa-brands fa-google"></i>
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-gray-950 dark:text-white">
                    Inscription, Sécurité &amp; Connexion Google
                  </h2>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                    Modalités d&apos;accès sécurisé et utilisation des identifiants Google OAuth
                  </span>
                </div>
              </div>

              <div className="text-xs sm:text-sm text-gray-700 dark:text-gray-200 leading-relaxed space-y-3">
                <p>
                  Pour accéder à certaines fonctionnalités avancées (sauvegarde de CV, suivi des candidatures, messagerie recruteur), l&apos;utilisateur peut créer un compte :
                </p>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li><strong>Soit par E-mail / Mot de passe :</strong> L&apos;utilisateur est seul responsable de la confidentialité de ses identifiants.</li>
                  <li><strong>Soit via l&apos;Authentification Google (Google Sign-In) :</strong> L&apos;utilisateur autorise Facilité à recevoir son <strong>nom complet</strong>, son <strong>adresse e-mail</strong> et sa <strong>photo de profil</strong> dans le but exclusif de créer et sécuriser son compte.</li>
                </ul>
                <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-blue-100 dark:border-gray-800 space-y-2 mt-2">
                  <p className="font-bold text-xs text-gray-900 dark:text-white">
                    🔒 Conformité Google OAuth :
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-300">
                    Facilité respecte rigoureusement la politique de données utilisateur des services API Google. Les données transmises par Google ne sont ni revendues, ni cédées, ni exploitées à des fins de profilage publicitaire. L&apos;utilisateur conserve la maîtrise intégrale de son compte et peut révoquer cette liaison à tout moment.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 4 : Obligations de l'Utilisateur */}
            <section id="engagements" className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-3xl border border-gray-200/80 dark:border-gray-800 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 flex items-center justify-center font-black">
                  4
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white">
                  Obligations &amp; Engagements de l&apos;Utilisateur
                </h2>
              </div>
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed space-y-3">
                <p>L&apos;utilisateur s&apos;engage à :</p>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>Fournir des informations exactes, sincères et véridiques dans son profil et son CV.</li>
                  <li>Ne pas usurper l&apos;identité d&apos;un tiers ni utiliser un faux compte.</li>
                  <li>Ne pas téléverser de contenus illicites, haineux, malveillants ou portant atteinte aux droits de tiers.</li>
                  <li>Ne pas tenter de compromettre la sécurité, l&apos;intégrité ou la disponibilité des serveurs de Facilité.</li>
                </ul>
              </div>
            </section>

            {/* Section 5 : Tarifs & Paiements */}
            <section id="tarifs-paiements" className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-3xl border border-gray-200/80 dark:border-gray-800 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 flex items-center justify-center font-black">
                  5
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white">
                  Tarification, Commandes &amp; Paiements Sécurisés
                </h2>
              </div>
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed space-y-3">
                <p>
                  Les tarifs des prestations payantes (modèles premium, accompagnement sur-mesure) sont affichés en Francs CFA (XOF) toutes taxes comprises.
                </p>
                <p>
                  Les transactions sont opérées par des passerelles de paiement partenaires certifiées et sécurisées (Wave, Orange Money, KPay, Carte Bancaire). Facilité ne conserve aucune coordonnée bancaire secrète.
                </p>
              </div>
            </section>

            {/* Section 6 : Propriété Intellectuelle */}
            <section id="propriete" className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-3xl border border-gray-200/80 dark:border-gray-800 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 flex items-center justify-center font-black">
                  6
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white">
                  Propriété Intellectuelle
                </h2>
              </div>
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed space-y-3">
                <p>
                  Tous les éléments de la marque <strong>Facilité</strong> (logo, chartes graphiques, logiciels, modèles exclusifs, textes) sont protégés par le droit de la propriété intellectuelle. Toute reproduction non autorisée sans accord écrit préalable est formellement interdite.
                </p>
                <p>
                  L&apos;utilisateur reste propriétaire exclusif des données et contenus qu&apos;il intègre dans ses propres CVs.
                </p>
              </div>
            </section>

            {/* Section 7 : Responsabilité */}
            <section id="responsabilite" className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-3xl border border-gray-200/80 dark:border-gray-800 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 flex items-center justify-center font-black">
                  7
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white">
                  Responsabilité &amp; Disponibilité du Service
                </h2>
              </div>
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed space-y-3">
                <p>
                  Facilité s&apos;efforce de maintenir la plateforme accessible 24h/24 et 7j/7 avec un taux de disponibilité optimal, sous réserve des périodes éventuelles de maintenance technique programmée.
                </p>
                <p>
                  Facilité agit en tant qu&apos;intermédiaire technique pour la diffusion des offres et la création de CV : nous ne garantissons pas l&apos;embauche automatique du candidat par les recruteurs tiers.
                </p>
              </div>
            </section>

            {/* Section 8 : Résiliation */}
            <section id="resiliation" className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-3xl border border-gray-200/80 dark:border-gray-800 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 flex items-center justify-center font-black">
                  8
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white">
                  Suspension &amp; Suppression de Compte
                </h2>
              </div>
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed space-y-3">
                <p>
                  L&apos;utilisateur peut clôturer et supprimer son compte à tout moment depuis son profil ou sur simple demande par e-mail.
                </p>
                <p>
                  Facilité se réserve le droit de suspendre tout compte qui violerait gravement les présentes CGU (fraude, faux documents, comportements abusifs).
                </p>
              </div>
            </section>

            {/* Section 9 : Droit Applicable */}
            <section id="droit-applicable" className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-3xl border border-gray-200/80 dark:border-gray-800 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 flex items-center justify-center font-black">
                  9
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white">
                  Droit Applicable &amp; Règlement des Litiges
                </h2>
              </div>
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed space-y-3">
                <p>
                  Les présentes CGU sont régies par le droit sénégalais et les conventions internationales en vigueur. En cas de différend, une solution amiable sera systématiquement recherchée avant toute action judiciaire.
                </p>
              </div>
            </section>

            {/* Section 10 : Contact */}
            <section id="contact" className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-3xl border border-gray-200/80 dark:border-gray-800 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 flex items-center justify-center font-black">
                  10
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white">
                  Contact &amp; Assistance
                </h2>
              </div>
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed space-y-3">
                <p>Pour toute question relative aux présentes Conditions Générales, contactez-nous :</p>
                <div className="p-4 bg-blue-50/50 dark:bg-blue-950/40 rounded-2xl border border-blue-200/60 dark:border-blue-800/40 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0">
                    <i className="fa-solid fa-headset text-sm"></i>
                  </div>
                  <div>
                    <div className="font-extrabold text-gray-900 dark:text-white text-xs">Support &amp; Juridique Facilité :</div>
                    <div className="text-blue-700 dark:text-blue-400 font-bold text-xs">contact@ffacilite.com</div>
                  </div>
                </div>
              </div>
            </section>

          </article>
        </div>
      </main>

      {/* Pied de page épuré */}
      <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 py-6 px-4 text-center">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-medium text-gray-500 dark:text-gray-400">
          <div>
            © 2026 <strong>Facilité</strong> (ffacilite.com). Tous droits réservés.
          </div>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 transition font-bold">
              Accueil
            </Link>
            <span>•</span>
            <Link href="/conditions" className="text-blue-600 dark:text-blue-400 font-bold">
              Conditions Générales (CGU)
            </Link>
            <span>•</span>
            <Link href="/confidentialite" className="hover:text-blue-600 dark:hover:text-blue-400 transition font-bold">
              Confidentialité
            </Link>
          </div>
        </div>
      </footer>

    </div>
  );
}

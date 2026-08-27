"use strict";
"use client";

import { useState } from "react";
import Link from "next/link";

export default function ConfidentialitePage() {
  const [activeSection, setActiveSection] = useState("preambule");
  const [copiedEmail, setCopiedEmail] = useState(false);

  const handleCopyEmail = () => {
    navigator.clipboard.writeText("contact@ffacilite.com");
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2500);
  };

  const sections = [
    { id: "preambule", title: "1. Introduction & Responsable", icon: "fa-shield-halved" },
    { id: "donnees-collectees", title: "2. Collecte des Données", icon: "fa-database" },
    { id: "authentification-google", title: "3. Authentification Google (OAuth)", icon: "fa-brands fa-google" },
    { id: "finalites", title: "4. Utilisation & Finalités", icon: "fa-bullseye" },
    { id: "securite-chiffrement", title: "5. Sécurité & Chiffrement", icon: "fa-lock" },
    { id: "droits-utilisateurs", title: "6. Droits des Utilisateurs", icon: "fa-user-check" },
    { id: "conservation", title: "7. Conservation & Suppression", icon: "fa-clock-rotate-left" },
    { id: "cookies", title: "8. Cookies & Traceurs", icon: "fa-cookie-bite" },
    { id: "contact", title: "9. Contact & Délégué aux Données", icon: "fa-envelope" },
  ];

  return (
    <div className="min-h-screen bg-[#FAF6F1] dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-sans flex flex-col justify-between transition-colors duration-300">
      
      {/* Barre de navigation simplifiée pour les pages légales */}
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
              href="/conditions"
              className="text-xs font-bold text-gray-600 dark:text-gray-300 hover:text-emerald-600 dark:hover:text-[#10E688] px-3 py-1.5 rounded-lg transition"
            >
              Conditions d&apos;utilisation (CGU)
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-700 dark:text-[#10E688] font-extrabold text-xs rounded-xl border border-emerald-200/60 dark:border-emerald-800 transition"
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
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300/50 dark:border-emerald-700/40 text-emerald-900 dark:text-[#10E688] text-xs font-black tracking-wide mb-3 shadow-xs">
            <i className="fa-solid fa-shield-halved text-sm"></i>
            <span>Politique de Confidentialité Officielle • Conforme CDP &amp; RGPD</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-gray-900 dark:text-white tracking-tight mb-3 leading-tight">
            Politique de <span className="text-emerald-600 dark:text-[#10E688]">Confidentialité</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 max-w-2xl mx-auto leading-relaxed font-medium">
            La protection de vos données personnelles et de votre vie privée est une priorité absolue pour <strong>Facilité</strong> (ffacilite.com). Découvrez nos engagements en matière de transparence, de sécurité et d&apos;utilisation responsable.
          </p>
          <div className="mt-4 flex items-center justify-center gap-4 text-xs font-bold text-gray-500 dark:text-gray-400 flex-wrap">
            <span><i className="fa-regular fa-calendar-check mr-1.5 text-emerald-600"></i> Dernière mise à jour : 17 Août 2026</span>
            <span>•</span>
            <span><i className="fa-solid fa-building-shield mr-1.5 text-emerald-600"></i> Version 2.5</span>
          </div>
        </div>

        {/* Disposition Principale */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Sommaire interactif (Desktop Sticky) */}
          <aside className="lg:col-span-4">
            <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-200/80 dark:border-gray-800 shadow-sm sticky top-24 space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3 px-2">
                Sommaire du document
              </h3>
              <nav className="space-y-1">
                {sections.map((sec) => (
                  <a
                    key={sec.id}
                    href={`#${sec.id}`}
                    onClick={() => setActiveSection(sec.id)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                      activeSection === sec.id
                        ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20 font-black"
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

          {/* Corps des Sections */}
          <article className="lg:col-span-8 space-y-8">
            
            {/* Section 1 : Introduction */}
            <section id="preambule" className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-3xl border border-gray-200/80 dark:border-gray-800 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-[#10E688] flex items-center justify-center font-black">
                  1
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white">
                  Introduction &amp; Responsable du Traitement
                </h2>
              </div>
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed space-y-3">
                <p>
                  La présente Politique de Confidentialité s&apos;applique à la plateforme web accessible à l&apos;adresse <strong>https://ffacilite.com/</strong>, ainsi qu&apos;à tous les services, outils d&apos;aide à la création de CV, modules d&apos;extraction d&apos;offres et formulaires d&apos;insertion professionnelle exploités sous la dénomination <strong>« Facilité »</strong>.
                </p>
                <p>
                  Le responsable du traitement des données à caractère personnel est <strong>Macoumba Samake</strong>, Fondateur &amp; Responsable de la plateforme Facilité, domicilié à Dakar, Sénégal.
                </p>
                <div className="bg-[#FAF6F1] dark:bg-gray-800/60 p-4 rounded-2xl border border-[#E3DBCC] dark:border-gray-700 font-medium">
                  ⚖️ <strong>Conformité légale :</strong> Facilité applique scrupuleusement les exigences de la <strong>Loi sénégalaise n° 2008-12 du 25 janvier 2008</strong> relative à la protection des données personnelles (CDP) et s&apos;aligne sur les standards internationaux du <strong>RGPD (Règlement Général sur la Protection des Données 2016/679)</strong>.
                </div>
              </div>
            </section>

            {/* Section 2 : Collecte des Données */}
            <section id="donnees-collectees" className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-3xl border border-gray-200/80 dark:border-gray-800 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-[#10E688] flex items-center justify-center font-black">
                  2
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white">
                  Collecte des Données Personnelles
                </h2>
              </div>
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed space-y-3">
                <p>Nous limitons la collecte de données aux informations strictement indispensables au bon fonctionnement de nos services :</p>
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Identité &amp; Profil :</strong> Nom, prénom, photo de profil facultative, adresse e-mail.</li>
                  <li><strong>Informations Professionnelles :</strong> Expériences, diplômes, compétences, CVs importés ou générés, lettres de motivation rédigées.</li>
                  <li><strong>Coordonnées :</strong> Numéro de téléphone / WhatsApp (si renseigné pour recevoir des notifications d&apos;offres), ville de résidence.</li>
                  <li><strong>Communications &amp; Candidatures :</strong> Messages envoyés via la messagerie interne aux recruteurs et formulaires de candidature.</li>
                  <li><strong>Transactions &amp; Commandes :</strong> Historique des factures de services sans aucun stockage d&apos;informations bancaires confidentielles (gérées par nos passerelles agréées).</li>
                </ul>
              </div>
            </section>

            {/* Section 3 : Authentification Google (Spécifique OAuth & Google User Data Policy) */}
            <section id="authentification-google" className="bg-emerald-50/50 dark:bg-emerald-950/20 p-6 sm:p-8 rounded-3xl border-2 border-emerald-200 dark:border-emerald-800/60 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black text-lg">
                  <i className="fa-brands fa-google"></i>
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-gray-950 dark:text-white">
                    Authentification Google (Google Sign-In &amp; OAuth)
                  </h2>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                    Déclaration de conformité aux règles Google API Services User Data Policy
                  </span>
                </div>
              </div>

              <div className="text-xs sm:text-sm text-gray-700 dark:text-gray-200 leading-relaxed space-y-3.5">
                <p>
                  Lorsque vous choisissez de vous connecter ou de créer un compte sur <strong>Facilité</strong> (ffacilite.com) via le service <strong>« Se connecter avec Google » (Google Sign-In)</strong>, nous accédons uniquement aux données de profil de base que vous autorisez explicitement Google à nous transmettre :
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div className="bg-white dark:bg-gray-900 p-3.5 rounded-2xl border border-emerald-100 dark:border-gray-800 shadow-2xs">
                    <div className="flex items-center gap-2 font-extrabold text-emerald-800 dark:text-[#10E688] mb-1">
                      <i className="fa-solid fa-user-tag"></i>
                      <span>Nom &amp; Prénom</span>
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">Pour personnaliser votre espace candidat et pré-remplir vos CVs.</p>
                  </div>

                  <div className="bg-white dark:bg-gray-900 p-3.5 rounded-2xl border border-emerald-100 dark:border-gray-800 shadow-2xs">
                    <div className="flex items-center gap-2 font-extrabold text-emerald-800 dark:text-[#10E688] mb-1">
                      <i className="fa-solid fa-envelope"></i>
                      <span>Adresse e-mail</span>
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">Pour sécuriser votre identifiant de connexion et recevoir vos notifications.</p>
                  </div>

                  <div className="bg-white dark:bg-gray-900 p-3.5 rounded-2xl border border-emerald-100 dark:border-gray-800 shadow-2xs">
                    <div className="flex items-center gap-2 font-extrabold text-emerald-800 dark:text-[#10E688] mb-1">
                      <i className="fa-solid fa-image-portrait"></i>
                      <span>Photo de profil</span>
                    </div>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">Pour afficher votre avatar dans votre tableau de bord candidat.</p>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-emerald-100 dark:border-gray-800 space-y-2">
                  <h4 className="font-black text-xs text-gray-900 dark:text-white uppercase tracking-wider">
                    🔒 Engagements de limitation d&apos;utilisation (Limited Use Requirements) :
                  </h4>
                  <ul className="list-disc pl-5 space-y-1 text-xs text-gray-600 dark:text-gray-300">
                    <li><strong>Usage exclusif :</strong> Les données reçues de Google sont uniquement utilisées pour l&apos;authentification et la gestion de votre compte Facilité.</li>
                    <li><strong>Aucune revente ni publicité :</strong> Nous ne vendons, ne louons et ne transférons JAMAIS vos données Google à des tiers, courtiers en données ou réseaux publicitaires.</li>
                    <li><strong>Aucun entraînement non sollicité d&apos;IA :</strong> Les données d&apos;authentification Google ne sont en aucun cas utilisées pour entraîner des modèles d&apos;IA généralistes.</li>
                    <li><strong>Contrôle &amp; Révocation immédiate :</strong> Vous pouvez à tout moment révoquer l&apos;accès accordé à Facilité directement depuis les paramètres de votre compte Google (<a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="text-emerald-600 dark:text-emerald-400 underline font-bold">Gérer les autorisations Google</a>) ou demander la suppression intégrale de votre compte en écrivant à <strong>contact@ffacilite.com</strong>.</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Section 4 : Utilisation & Finalités */}
            <section id="finalites" className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-3xl border border-gray-200/80 dark:border-gray-800 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-[#10E688] flex items-center justify-center font-black">
                  4
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white">
                  Utilisation &amp; Finalités des Données
                </h2>
              </div>
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed space-y-3">
                <p>Vos informations sont traitées exclusivement pour :</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="p-3.5 bg-gray-50 dark:bg-gray-800/80 rounded-2xl border border-gray-100 dark:border-gray-700">
                    <h4 className="font-extrabold text-gray-900 dark:text-white mb-1">📄 Création &amp; Exportation de CV</h4>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">Génération de CV conformes aux formats standards (Sénégal, Canadien, Anglais).</p>
                  </div>
                  <div className="p-3.5 bg-gray-50 dark:bg-gray-800/80 rounded-2xl border border-gray-100 dark:border-gray-700">
                    <h4 className="font-extrabold text-gray-900 dark:text-white mb-1">💼 Candidature aux Offres d&apos;Emploi</h4>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">Transmission de vos candidatures aux recruteurs et mise en relation directe.</p>
                  </div>
                  <div className="p-3.5 bg-gray-50 dark:bg-gray-800/80 rounded-2xl border border-gray-100 dark:border-gray-700">
                    <h4 className="font-extrabold text-gray-900 dark:text-white mb-1">🤖 Outils d&apos;Assistance IA &amp; OCR</h4>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">Lecture automatique d&apos;affiches d&apos;offres d&apos;emploi et aide à la rédaction de lettres.</p>
                  </div>
                  <div className="p-3.5 bg-gray-50 dark:bg-gray-800/80 rounded-2xl border border-gray-100 dark:border-gray-700">
                    <h4 className="font-extrabold text-gray-900 dark:text-white mb-1">🛡️ Sécurité &amp; Prévention des Abus</h4>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">Protection des comptes contre les accès non autorisés et conformité légale.</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 5 : Sécurité & Chiffrement */}
            <section id="securite-chiffrement" className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-3xl border border-gray-200/80 dark:border-gray-800 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-[#10E688] flex items-center justify-center font-black">
                  5
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white">
                  Sécurité, Stockage &amp; Chiffrement
                </h2>
              </div>
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed space-y-3">
                <p>
                  Nous mettons en œuvre des mesures techniques et organisationnelles robustes pour protéger vos données contre toute destruction, perte, altération ou divulgation non autorisée :
                </p>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li><strong>Chiffrement SSL / HTTPS (TLS 1.3) :</strong> L&apos;intégralité des flux entre votre appareil et nos serveurs est chiffrée.</li>
                  <li><strong>Stockage Sécurisé &amp; Cloisonné :</strong> Base de données hébergée avec politiques d&apos;accès strictes (Row-Level Security) empêchant tout accès non autorisé.</li>
                  <li><strong>Contrôle des Accès :</strong> Seuls les agents habilités et vous-même pouvez accéder aux documents de votre espace privé.</li>
                </ul>
              </div>
            </section>

            {/* Section 6 : Droits des Utilisateurs */}
            <section id="droits-utilisateurs" className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-3xl border border-gray-200/80 dark:border-gray-800 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-[#10E688] flex items-center justify-center font-black">
                  6
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white">
                  Vos Droits sur Vos Données
                </h2>
              </div>
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed space-y-3">
                <p>Conformément à la réglementation sur la protection des données, vous bénéficiez des droits suivants :</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                    <strong className="text-xs text-gray-900 dark:text-white block mb-0.5">👁️ Droit d&apos;accès</strong>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">Consulter l&apos;ensemble des données associées à votre compte.</span>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                    <strong className="text-xs text-gray-900 dark:text-white block mb-0.5">✏️ Droit de rectification</strong>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">Corriger ou actualiser vos informations personnelles directement dans votre profil.</span>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                    <strong className="text-xs text-gray-900 dark:text-white block mb-0.5">🗑️ Droit à l&apos;effacement (Droit à l&apos;oubli)</strong>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">Demander la suppression définitive de votre compte et de tous vos fichiers associés.</span>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                    <strong className="text-xs text-gray-900 dark:text-white block mb-0.5">📦 Droit à la portabilité</strong>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">Télécharger vos documents et CV sous format universel (PDF, JSON).</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 7 : Conservation & Suppression */}
            <section id="conservation" className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-3xl border border-gray-200/80 dark:border-gray-800 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-[#10E688] flex items-center justify-center font-black">
                  7
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white">
                  Durée de Conservation des Données
                </h2>
              </div>
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed space-y-3">
                <p>
                  Vos données sont conservées aussi longtemps que votre compte reste actif. En cas d&apos;inactivité prolongée supérieure à 24 mois sans connexion, ou sur simple demande de suppression de votre part, vos données personnelles et CVs sont intégralement et définitivement effacés de nos serveurs.
                </p>
              </div>
            </section>

            {/* Section 8 : Cookies */}
            <section id="cookies" className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-3xl border border-gray-200/80 dark:border-gray-800 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-[#10E688] flex items-center justify-center font-black">
                  8
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white">
                  Cookies &amp; Traceurs
                </h2>
              </div>
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed space-y-3">
                <p>
                  Facilité utilise uniquement des cookies strictement nécessaires au maintien de votre session de connexion sécurisée et à la mémorisation de vos préférences (ex. thème d&apos;affichage, langue). Nous n&apos;utilisons aucun cookie de ciblage publicitaire intrusif.
                </p>
              </div>
            </section>

            {/* Section 9 : Contact DPO */}
            <section id="contact" className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-3xl border border-gray-200/80 dark:border-gray-800 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-[#10E688] flex items-center justify-center font-black">
                  9
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white">
                  Contact &amp; Délégué à la Protection des Données
                </h2>
              </div>
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed space-y-4">
                <p>
                  Pour toute question relative à cette Politique de Confidentialité ou pour exercer vos droits d&apos;accès, de rectification ou de suppression, notre équipe d&apos;assistance vous répond sous 24 à 48 heures :
                </p>
                <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200/60 dark:border-emerald-800/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0">
                      <i className="fa-solid fa-envelope text-sm"></i>
                    </div>
                    <div>
                      <div className="font-extrabold text-gray-900 dark:text-white text-xs">Email du Délégué aux Données :</div>
                      <div className="text-emerald-700 dark:text-[#10E688] font-bold text-xs">contact@ffacilite.com</div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyEmail}
                    className="px-3 py-1.5 bg-white dark:bg-gray-800 hover:bg-gray-100 text-gray-800 dark:text-gray-200 text-xs font-bold rounded-xl border border-gray-200 dark:border-gray-700 transition shadow-2xs cursor-pointer flex items-center gap-1.5"
                  >
                    <i className={`fa-solid ${copiedEmail ? "fa-check text-emerald-600" : "fa-copy"}`}></i>
                    <span>{copiedEmail ? "Copié !" : "Copier l'adresse"}</span>
                  </button>
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
            <Link href="/" className="hover:text-emerald-600 dark:hover:text-[#10E688] transition font-bold">
              Accueil
            </Link>
            <span>•</span>
            <Link href="/conditions" className="hover:text-emerald-600 dark:hover:text-[#10E688] transition font-bold">
              Conditions Générales (CGU)
            </Link>
            <span>•</span>
            <Link href="/confidentialite" className="text-emerald-600 dark:text-[#10E688] font-bold">
              Confidentialité
            </Link>
          </div>
        </div>
      </footer>

    </div>
  );
}

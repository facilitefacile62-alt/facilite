"use strict";
"use client";

import { useState } from "react";
import Link from "next/link";

export default function ConfidentialitePage() {
  const [activeSection, setActiveSection] = useState("preambule");
  const [copiedEmail, setCopiedEmail] = useState(false);

  const handleCopyEmail = () => {
    navigator.clipboard.writeText("facilitefacile@gmail.com");
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
    { id: "sous-traitants", title: "8. Destinataires des Données", icon: "fa-share-nodes" },
    { id: "cookies", title: "9. Cookies & Traceurs", icon: "fa-cookie-bite" },
    { id: "contact", title: "10. Contact & Délégué aux Données", icon: "fa-envelope" },
  ];

  /**
   * Services tiers qui reçoivent réellement des données d'utilisateurs.
   *
   * Ajoutée le 2026-08-29 : la politique n'en nommait AUCUN, alors que onze
   * services en reçoivent. Google recoupe la fiche Data Safety avec la
   * politique publiée — une déclaration plus détaillée que la politique est
   * un motif de rejet classique.
   *
   * Liste établie en relevant les intégrations réelles du code (variables
   * d'environnement utilisées, scripts chargés dans layout.js), pas les
   * intentions. À reprendre à chaque ajout d'un service.
   */
  const sousTraitants = [
    { nom: "Supabase", role: "Hébergement des données", detail: "Authentification, base de données et stockage des fichiers. Reçoit le profil, les CV et les messages." },
    { nom: "Vercel", role: "Hébergement de l'application", detail: "Exécution des pages et des fonctions serveur, journaux techniques de requêtes." },
    { nom: "Microsoft Clarity", role: "Analyse d'audience", detail: "Enregistre les interactions et rejoue les sessions de navigation pour comprendre les difficultés d'usage." },
    { nom: "Plausible", role: "Mesure d'audience", detail: "Statistiques de fréquentation, sans cookie ni identifiant persistant." },
    { nom: "Sentry", role: "Rapports d'erreur", detail: "Reçoit les erreurs techniques. Les champs sensibles sont retirés avant envoi." },
    { nom: "Google (Gemini)", role: "Traitement par intelligence artificielle", detail: "Assistant, analyse de CV, extraction d'annonces et lecture des pièces d'identité." },
    { nom: "Groq et DeepSeek", role: "Traitement par intelligence artificielle", detail: "Modèles de secours lorsque le service principal est indisponible." },
    { nom: "KPay et PayDunya", role: "Paiement", detail: "Encaissement des commandes. Vos coordonnées bancaires sont saisies chez eux et ne transitent jamais par Facilité." },
    { nom: "Resend", role: "Envoi des e-mails", detail: "Confirmations d'inscription, alertes et notifications de candidature." },
    { nom: "Daily.co", role: "Entretiens vidéo", detail: "Transport des flux audio et vidéo pendant un entretien." },
    { nom: "Cloudflare R2", role: "Stockage de fichiers", detail: "Stockage complémentaire des documents." },
    { nom: "OpenStreetMap", role: "Fonds de carte", detail: "Fournit les images de carte affichées avec un itinéraire de transport. Votre adresse IP et la zone affichée lui parviennent au chargement de la carte ; votre position GPS ne lui est jamais transmise." },
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
            <span><i className="fa-regular fa-calendar-check mr-1.5 text-emerald-600"></i> Dernière mise à jour : 29 Août 2026</span>
            <span>•</span>
            <span><i className="fa-solid fa-building-shield mr-1.5 text-emerald-600"></i> Version 2.6</span>
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
                    <li><strong>Contrôle &amp; Révocation immédiate :</strong> Vous pouvez à tout moment révoquer l&apos;accès accordé à Facilité directement depuis les paramètres de votre compte Google (<a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="text-emerald-600 dark:text-emerald-400 underline font-bold">Gérer les autorisations Google</a>) ou demander la suppression intégrale de votre compte en écrivant à <strong>facilitefacile@gmail.com</strong>.</li>
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
                <p>
                  La suppression est demandée depuis votre profil, onglet « Sécurité &amp; Connexion », ou par e-mail si vous n&apos;avez plus accès à votre compte. Le compte est désactivé immédiatement et effacé définitivement 30 jours plus tard — ce délai vous laisse revenir sur une suppression demandée par erreur. La procédure complète, ce qui est effacé et ce que la loi nous impose de conserver, figure sur la page{" "}
                  <Link href="/suppression-compte" className="font-extrabold text-emerald-700 dark:text-[#10E688] underline underline-offset-2">
                    Supprimer mon compte
                  </Link>
                  , accessible sans connexion.
                </p>
              </div>
            </section>

            {/* Section 8 : Destinataires des données */}
            <section id="sous-traitants" className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-3xl border border-gray-200/80 dark:border-gray-800 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-[#10E688] flex items-center justify-center font-black">
                  8
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white">
                  Destinataires de vos Données
                </h2>
              </div>
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed space-y-3">
                <p>
                  Facilité ne vend ni ne loue vos données. Pour fonctionner, l&apos;application s&apos;appuie sur les prestataires ci-dessous, qui traitent des données pour notre compte et selon nos instructions. Chacun n&apos;en reçoit que ce qui lui est nécessaire.
                </p>
              </div>

              <ul className="space-y-3">
                {sousTraitants.map((s) => (
                  <li
                    key={s.nom}
                    className="border-l-2 border-emerald-200 dark:border-emerald-900/60 pl-4 py-0.5"
                  >
                    <p className="text-xs sm:text-sm font-extrabold text-gray-900 dark:text-white">
                      {s.nom}
                      <span className="font-bold text-gray-400 dark:text-gray-500"> — {s.role}</span>
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed mt-0.5">{s.detail}</p>
                  </li>
                ))}
              </ul>

              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed space-y-3 pt-1">
                <p>
                  Certains de ces prestataires hébergent leurs serveurs hors du Sénégal, notamment en Europe et aux États-Unis. Vos données peuvent donc y être transférées pour être traitées.
                </p>
                <p>
                  Les recruteurs vérifiés constituent une catégorie distincte : ils accèdent à votre CV uniquement si vous avez rendu votre profil visible aux recruteurs, ou si vous avez postulé à leur offre. Vous gardez la main sur ce réglage depuis votre profil.
                </p>
              </div>
            </section>

            {/* Section 9 : Cookies */}
            <section id="cookies" className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-3xl border border-gray-200/80 dark:border-gray-800 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-[#10E688] flex items-center justify-center font-black">
                  9
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white">
                  Cookies &amp; Traceurs
                </h2>
              </div>
              {/* Réécrit le 2026-08-29. Le texte précédent affirmait « uniquement
                  des cookies strictement nécessaires » : c'était inexact, Microsoft
                  Clarity dépose un identifiant de session et enregistre la
                  navigation. Une politique qui minimise ce qui est réellement posé
                  est un motif de rejet Google Play, au même titre qu'une omission. */}
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed space-y-3">
                <p>
                  Facilité dépose des cookies strictement nécessaires au maintien de votre session de connexion et à la mémorisation de vos préférences d&apos;affichage. Nous n&apos;utilisons <strong>aucun cookie publicitaire</strong> et ne pratiquons aucun ciblage.
                </p>
                <p>
                  À des fins de mesure et d&apos;amélioration, deux outils d&apos;analyse sont également actifs. <strong>Microsoft Clarity</strong> associe un identifiant à votre session et enregistre vos interactions — clics, défilement, parcours — afin que nous puissions repérer les écrans qui posent problème. <strong>Plausible</strong> mesure la fréquentation sans cookie ni identifiant persistant.
                </p>
                <p>
                  Vous pouvez bloquer ces outils depuis les réglages de votre navigateur ou une extension dédiée, sans que cela n&apos;empêche l&apos;usage de Facilité.
                </p>
              </div>
            </section>

            {/* Section 10 : Contact DPO */}
            <section id="contact" className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-3xl border border-gray-200/80 dark:border-gray-800 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-[#10E688] flex items-center justify-center font-black">
                  10
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
                      <div className="text-emerald-700 dark:text-[#10E688] font-bold text-xs">facilitefacile@gmail.com</div>
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

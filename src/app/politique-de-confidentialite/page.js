"use strict";
"use client";

import { useState } from "react";
import Link from "next/link";

export default function PolitiqueConfidentialitePage() {
  const [activeSection, setActiveSection] = useState("preambule");
  const [copiedEmail, setCopiedEmail] = useState(false);

  const handleCopyEmail = () => {
    navigator.clipboard.writeText("contact@ffacilite.com");
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2500);
  };

  const sections = [
    { id: "preambule", title: "1. Préambule & Responsable du Traitement", icon: "fa-shield-halved" },
    { id: "donnees-collectees", title: "2. Données Personnelles Collectées", icon: "fa-database" },
    { id: "finalites", title: "3. Finalités & Bases Légales", icon: "fa-bullseye" },
    { id: "ia-et-documents", title: "4. Traitement des Documents & Outils IA", icon: "fa-microchip" },
    { id: "partage-et-securite", title: "5. Partage, Sécurité & Chiffrement", icon: "fa-lock" },
    { id: "conservation", title: "6. Durée de Conservation & Purge", icon: "fa-clock-rotate-left" },
    { id: "vos-droits", title: "7. Vos Droits & Exercice (CDP & RGPD)", icon: "fa-user-check" },
    { id: "cookies", title: "8. Cookies & Traceurs", icon: "fa-cookie-bite" },
    { id: "contact", title: "9. Contact DPO & Réclamations", icon: "fa-envelope" },
  ];

  return (
    <main className="min-h-screen bg-[#FAF6F1] dark:bg-gray-950 text-gray-900 dark:text-gray-100 pt-28 pb-20 px-4 sm:px-6 lg:px-8 transition-colors duration-300 font-sans">
      <div className="max-w-6xl mx-auto">
        {/* En-tête Hero */}
        <div className="text-center mb-12 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300/50 dark:border-emerald-700/40 text-emerald-900 dark:text-[#10E688] text-xs font-black tracking-wide mb-4 shadow-xs">
            <i className="fa-solid fa-shield-halved text-sm"></i>
            <span>Cadre Juridique Conforme CDP (Sénégal) & RGPD</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-gray-900 dark:text-white tracking-tight mb-4 leading-tight">
            Politique de <span className="text-emerald-600 dark:text-[#10E688]">Confidentialité</span>
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 max-w-3xl mx-auto leading-relaxed font-medium">
            La protection de vos données personnelles et de votre vie privée est au cœur des engagements de la plateforme <strong>Facilité</strong> (ffacilite.com). Découvrez comment nous collectons, utilisons et protégeons vos informations avec rigueur et transparence.
          </p>
          <div className="mt-4 flex items-center justify-center gap-4 text-xs font-bold text-gray-500 dark:text-gray-400">
            <span><i className="fa-regular fa-calendar-check mr-1.5 text-emerald-600"></i> Dernière mise à jour : 17 Août 2026</span>
            <span>•</span>
            <span><i className="fa-solid fa-building-shield mr-1.5 text-emerald-600"></i> Version officielle 2.4</span>
          </div>
        </div>

        {/* Disposition Principale : Menu Latéral + Contenu */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Sommaire interactif (Desktop Sticky) */}
          <aside className="lg:col-span-4">
            <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-200/80 dark:border-gray-800 shadow-sm sticky top-28 space-y-3">
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
                  <span>Imprimer / Sauvegarder en PDF</span>
                </button>
              </div>
            </div>
          </aside>

          {/* Corps du texte légal */}
          <article className="lg:col-span-8 space-y-8">
            {/* Section 1 */}
            <section id="preambule" className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-3xl border border-gray-200/80 dark:border-gray-800 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-[#10E688] flex items-center justify-center font-black">
                  1
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white">
                  Préambule & Responsable du Traitement
                </h2>
              </div>
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed space-y-3 font-normal">
                <p>
                  La présente Politique de Confidentialité s'applique au site internet <strong>https://ffacilite.com/</strong>, ainsi qu'à l'ensemble des applications mobiles, services d'intelligence artificielle, formulaires d'assistance administrative et solutions associées exploités sous la dénomination <strong>« Facilité »</strong>.
                </p>
                <p>
                  Le responsable du traitement des données à caractère personnel est <strong>Macoumba Samake</strong>, Fondateur de la plateforme Facilité, domicilié à Dakar, Sénégal.
                </p>
                <p className="bg-[#FAF6F1] dark:bg-gray-800/60 p-4 rounded-2xl border border-[#E3DBCC] dark:border-gray-700 font-medium">
                  ⚖️ <strong>Conformité légale :</strong> Facilité s'engage à respecter scrupuleusement les dispositions de la <strong>Loi sénégalaise n° 2008-12 du 25 janvier 2008</strong> relative à la protection des données à caractère personnel (supervisée par la Commission de Protection des Données Personnelles - CDP) ainsi que les principes du <strong>Règlement Général sur la Protection des Données (RGPD 2016/679)</strong> pour les utilisateurs de l'espace international.
                </p>
              </div>
            </section>

            {/* Section 2 */}
            <section id="donnees-collectees" className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-3xl border border-gray-200/80 dark:border-gray-800 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-[#10E688] flex items-center justify-center font-black">
                  2
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white">
                  Données Personnelles Collectées
                </h2>
              </div>
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed space-y-3">
                <p>Nous ne collectons que les informations strictement nécessaires à la bonne exécution de nos services :</p>
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Données d'identification :</strong> Nom, prénom, civilité, photo de profil, copie de la CNI ou du passeport (dans le cadre strict des démarches administratives officielles déléguées).</li>
                  <li><strong>Coordonnées de contact :</strong> Adresse e-mail, numéro de téléphone portable (WhatsApp), ville et pays de résidence.</li>
                  <li><strong>Données professionnelles & académiques :</strong> Expériences professionnelles, diplômes, compétences, langues parlées, CVs importés ou générés, lettres de motivation.</li>
                  <li><strong>Données de communication :</strong> Messages échangés avec le Support RH, candidatures envoyées aux recruteurs, demandes de devis et feedbacks.</li>
                  <li><strong>Données de transaction :</strong> Numéro de facture, date, montant et devise réglée via nos partenaires de paiement agréés (Wave, Orange Money, KPay, Carte bancaire). <em>Aucun numéro de carte bancaire ou code secret mobile money n'est stocké sur nos serveurs.</em></li>
                </ul>
              </div>
            </section>

            {/* Section 3 */}
            <section id="finalites" className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-3xl border border-gray-200/80 dark:border-gray-800 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-[#10E688] flex items-center justify-center font-black">
                  3
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white">
                  Finalités & Bases Légales du Traitement
                </h2>
              </div>
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed space-y-3">
                <p>Vos données sont traitées pour des objectifs précis et licites :</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="p-3.5 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
                    <h4 className="font-extrabold text-gray-900 dark:text-white mb-1">🎯 Création & Optimisation de CV</h4>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">Génération de CV conformes aux normes ATS (Formats National, Canadien, International).</p>
                  </div>
                  <div className="p-3.5 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
                    <h4 className="font-extrabold text-gray-900 dark:text-white mb-1">💼 Mise en relation Candidats-Recruteurs</h4>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">Matching intelligent par intelligence artificielle pour recommander les profils pertinents.</p>
                  </div>
                  <div className="p-3.5 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
                    <h4 className="font-extrabold text-gray-900 dark:text-white mb-1">⚡ Assistance Administrative</h4>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">Automatisation sécurisée des inscriptions officielles et traitement des pièces jointes.</p>
                  </div>
                  <div className="p-3.5 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
                    <h4 className="font-extrabold text-gray-900 dark:text-white mb-1">🎧 Support Clientèle & RH 24/7</h4>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">Réponse aux sollicitations, suivi des commandes et assistance personnalisée.</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 4 */}
            <section id="ia-et-documents" className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-3xl border border-gray-200/80 dark:border-gray-800 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-[#10E688] flex items-center justify-center font-black">
                  4
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white">
                  Traitement Sécurisé des Documents & Outils IA
                </h2>
              </div>
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed space-y-3">
                <p>
                  <strong>🔒 Traitement local des outils PDF :</strong> Les outils de compression, fusion, division, organisation et conversion d'images/PDF disponibles sur notre page Fonctionnalités opèrent directement en mémoire dans le navigateur client (Client-Side) pour une confidentialité totale. Vos fichiers sensibles ne sont pas stockés inutilement.
                </p>
                <p>
                  <strong>🤖 Modèles d'Intelligence Artificielle :</strong> Nos assistants intelligents (Gemini, DeepSeek, Groq) ne réutilisent pas vos données privées ni le contenu de vos CV pour entraîner des modèles publics tiers. Les échanges demeurent strictement isolés et confidentiels.
                </p>
              </div>
            </section>

            {/* Section 5 */}
            <section id="partage-et-securite" className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-3xl border border-gray-200/80 dark:border-gray-800 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-[#10E688] flex items-center justify-center font-black">
                  5
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white">
                  Non-Vente des Données, Sécurité & Chiffrement
                </h2>
              </div>
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed space-y-3">
                <p className="font-bold text-emerald-700 dark:text-[#10E688]">
                  🛡️ Facilité ne vend, ne loue et ne cède JAMAIS vos données personnelles à des tiers à des fins publicitaires.
                </p>
                <p>
                  Pour assurer la sécurité absolue de vos informations, nous déployons une architecture de pointe :
                </p>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>Chiffrement de bout en bout de l'ensemble des flux (HTTPS / TLS 1.3).</li>
                  <li>Protection des bases de données par Row Level Security (RLS) et RBAC strict.</li>
                  <li>Protection anti-intrusion, Rate Limiting distribué et Content Security Policy (CSP).</li>
                </ul>
              </div>
            </section>

            {/* Section 6 */}
            <section id="conservation" className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-3xl border border-gray-200/80 dark:border-gray-800 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-[#10E688] flex items-center justify-center font-black">
                  6
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white">
                  Durée de Conservation & Purge Automatique
                </h2>
              </div>
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed space-y-3">
                <p>
                  Vos données de profil sont conservées tant que votre compte reste actif. En cas d'inactivité prolongée (supérieure à 24 mois) ou sur simple demande de suppression, vos données sont intégralement anonymisées ou détruites de manière irréversible via nos scripts de purge automatisés.
                </p>
              </div>
            </section>

            {/* Section 7 */}
            <section id="vos-droits" className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-3xl border border-gray-200/80 dark:border-gray-800 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-[#10E688] flex items-center justify-center font-black">
                  7
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white">
                  Vos Droits Légaux (Accès, Rectification & Suppression)
                </h2>
              </div>
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed space-y-3">
                <p>Conformément à la législation en vigueur, vous disposez des droits suivants :</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-semibold pt-1">
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">✓ Droit d'accès et d'information</div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">✓ Droit de rectification des données inexactes</div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">✓ Droit à l'effacement (« Droit à l'oubli »)</div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">✓ Droit à la portabilité de vos documents</div>
                </div>
                <p className="pt-2">
                  Vous pouvez exercer ces droits à tout moment depuis les paramètres de votre compte ou en nous écrivant directement.
                </p>
              </div>
            </section>

            {/* Section 8 */}
            <section id="cookies" className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-3xl border border-gray-200/80 dark:border-gray-800 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-[#10E688] flex items-center justify-center font-black">
                  8
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white">
                  Cookies & Traceurs
                </h2>
              </div>
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed space-y-3">
                <p>
                  Nous utilisons des cookies strictement nécessaires au fonctionnement du site (authentification Supabase, mémorisation de la langue Français/Anglais, préférences d'affichage). Aucun traceur publicitaire intrusif n'est activé sans votre accord préalable.
                </p>
              </div>
            </section>

            {/* Section 9 */}
            <section id="contact" className="bg-white dark:bg-gray-900 p-6 sm:p-8 rounded-3xl border border-gray-200/80 dark:border-gray-800 shadow-sm space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-[#10E688] flex items-center justify-center font-black">
                  9
                </div>
                <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 dark:text-white">
                  Contact DPO & Réclamations
                </h2>
              </div>
              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed space-y-4">
                <p>
                  Pour toute question relative à cette politique ou pour exercer vos droits, contactez notre Délégué à la Protection des Données :
                </p>
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-200 dark:border-emerald-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="font-extrabold text-gray-900 dark:text-white text-sm">Délégué à la Protection des Données (DPO)</h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400">Plateforme Facilité • Dakar, Sénégal</p>
                    <p className="text-xs font-bold text-emerald-700 dark:text-[#10E688] mt-1">contact@ffacilite.com / facilitefacile@gmail.com</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyEmail}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-2 cursor-pointer flex-shrink-0"
                  >
                    <i className={`fa-solid ${copiedEmail ? "fa-check" : "fa-copy"}`}></i>
                    <span>{copiedEmail ? "E-mail copié !" : "Copier l'e-mail"}</span>
                  </button>
                </div>
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

/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import Link from "next/link";

export default function BoiteAIdees() {
  const [suggestion, setSuggestion] = useState("");
  const [category, setCategory] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "" });

  const triggerToast = (message) => {
    setToast({ show: true, message });
    setTimeout(() => {
      setToast({ show: false, message: "" });
    }, 3500);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!suggestion || !category) {
      triggerToast("Veuillez remplir les champs obligatoires.");
      return;
    }
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitted(true);
      triggerToast("Votre suggestion a été envoyée avec succès !");
    }, 1200);
  };

  return (
    <>
      {/* Toast floating */}
      <div
        className={`fixed top-20 right-4 z-[700] flex items-center space-x-3 bg-gray-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-gray-700 transition-all duration-300 transform ${
          toast.show ? "translate-y-0 opacity-100 scale-100" : "-translate-y-4 opacity-0 scale-95 pointer-events-none"
        }`}
      >
        <i className="fa-solid fa-circle-check text-[#10E688] text-xl"></i>
        <span className="text-sm font-semibold tracking-wide">{toast.message}</span>
      </div>

      {/* Navbar Fixée (#FAF6F1) */}
      <nav className="bg-[#FAF6F1] px-4 py-2.5 md:px-8 flex justify-between items-center shadow-sm fixed top-0 left-0 w-full z-50">
        <Link href="/" className="flex items-center space-x-2.5 hover:opacity-85 transition">
          <img src="/logo.jpeg" alt="Logo Facilite" className="w-8 h-8 rounded-full object-cover shadow-sm border border-gray-200" />
          <span className="text-xl font-extrabold tracking-tight text-gray-900">Facilite</span>
        </Link>
        <div className="flex items-center space-x-6 text-sm">
          <Link href="/" className="flex items-center space-x-2 text-gray-700 hover:text-blue-600 transition font-semibold">
            <img src="/accueil.png" alt="Accueil" className="w-5 h-5 object-contain" />
            <span>Accueil</span>
          </Link>
        </div>
      </nav>

      {/* Page Content */}
      <main className="flex-grow pt-[52px] bg-white">
        
        {/* Banner Section */}
        <section className="w-full bg-[#E2ECE9]/70 py-12 px-6 md:px-12 border-b border-gray-200/50 relative overflow-hidden">
          <div className="max-w-7xl mx-auto flex justify-between items-center relative z-10">
            <div className="flex flex-col space-y-2">
              <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 tracking-tight">Boîte à idées</h1>
              <div className="flex items-center space-x-2 text-xs md:text-sm text-gray-500 font-semibold">
                <Link href="/" className="hover:text-gray-800 transition">🏠</Link>
                <span>&gt;</span>
                <span className="text-gray-800 font-bold">Boîte à idées</span>
              </div>
            </div>
            
            {/* Question Marks Icon Decoration */}
            <div className="hidden md:flex items-center justify-center opacity-85 translate-x-8">
              <div className="relative w-28 h-28 flex items-center justify-center">
                <i className="fa-solid fa-question text-6xl text-[#10E688]/30 font-black absolute transform -rotate-12 -translate-x-6 -translate-y-4"></i>
                <i className="fa-solid fa-question text-7xl text-purple-300/40 font-black absolute transform rotate-12 translate-x-6 translate-y-4"></i>
              </div>
            </div>
          </div>
        </section>

        {/* Content Area */}
        <section className="max-w-7xl mx-auto px-6 py-16 md:py-24 flex flex-col lg:flex-row gap-12 lg:gap-20 items-stretch">
          
          {/* Left Column */}
          <div className="w-full lg:w-1/2 flex flex-col justify-center space-y-8">
            <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center text-amber-500 shadow-sm border border-amber-200">
              <i className="fa-regular fa-lightbulb text-3xl font-bold"></i>
            </div>
            
            <div className="space-y-4">
              <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 leading-snug">
                Améliorations ensemble nos services publics
              </h2>
              <p className="text-gray-600 text-sm md:text-base leading-relaxed font-medium">
                Votre avis compte ! Partagez vos idées et suggestions pour améliorer la qualité des services publics sénégalais.
              </p>
              <p className="text-gray-600 text-sm md:text-base leading-relaxed font-medium">
                L&apos;objectif de cette boîte à idées est de recueillir vos suggestions constructives pour :
              </p>
            </div>

            <ul className="space-y-4 text-xs md:text-sm text-gray-700 font-bold">
              <li className="flex items-start space-x-3.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0"></span>
                <span>Simplifier les démarches administratives</span>
              </li>
              <li className="flex items-start space-x-3.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0"></span>
                <span>Améliorer l&apos;accueil dans les services</span>
              </li>
              <li className="flex items-start space-x-3.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0"></span>
                <span>Moderniser les processus</span>
              </li>
              <li className="flex items-start space-x-3.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0"></span>
                <span>Réduire les délais de traitement</span>
              </li>
            </ul>
          </div>

          {/* Right Column (Form Card) */}
          <div className="w-full lg:w-1/2">
            <div className="bg-white rounded-3xl p-6 md:p-10 border border-gray-200 shadow-xl relative overflow-hidden h-full flex flex-col justify-between">
              
              {!submitted ? (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <h3 className="text-2xl font-extrabold text-gray-900">Faire une contribution</h3>
                    <p className="text-xs text-gray-500 font-semibold">
                      Partagez votre idée pour améliorer nos services
                    </p>
                  </div>

                  {/* Suggestion Textarea */}
                  <div className="space-y-2">
                    <label className="block text-xs font-extrabold text-gray-700 uppercase tracking-wider">
                      Votre suggestion <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={5}
                      required
                      value={suggestion}
                      onChange={(e) => setSuggestion(e.target.value)}
                      placeholder="Décrivez votre idée ou suggestion pour améliorer nos services..."
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition resize-none font-medium text-gray-900"
                    />
                  </div>

                  {/* Category Select Dropdown */}
                  <div className="space-y-2">
                    <label className="block text-xs font-extrabold text-gray-700 uppercase tracking-wider">
                      Catégorie du service <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <select
                        required
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500/20 focus:ring-2 focus:ring-emerald-500/20 transition font-semibold text-gray-800 appearance-none cursor-pointer"
                      >
                        <option value="" disabled hidden>
                          Sélectionnez une catégorie
                        </option>
                        <option value="simplification">Simplification des démarches</option>
                        <option value="accueil">Qualité de l&apos;accueil</option>
                        <option value="modernisation">Modernisation des processus</option>
                        <option value="delais">Réduction des délais</option>
                        <option value="autre">Autre</option>
                      </select>
                      <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-gray-500">
                        <i className="fa-solid fa-chevron-down text-xs"></i>
                      </div>
                    </div>
                  </div>

                  {/* Email Input */}
                  <div className="space-y-2">
                    <label className="block text-xs font-extrabold text-gray-700 uppercase tracking-wider">
                      Adresse e-mail <span className="text-gray-400 font-medium text-[10px]">(facultatif)</span>
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="exemple@email.com"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition font-semibold text-gray-900"
                    />
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-[#10E688] hover:bg-[#0fd57d] text-gray-900 font-extrabold py-3.5 px-4 rounded-xl text-sm transition-all shadow-[0_6px_16px_rgba(16,230,136,0.2)] hover:shadow-[0_8px_20px_rgba(16,230,136,0.35)] mt-2 flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-75"
                  >
                    {isSubmitting ? (
                      <>
                        <i className="fa-solid fa-spinner fa-spin text-lg"></i>
                        <span>Envoi de la suggestion...</span>
                      </>
                    ) : (
                      <>
                        <i className="fa-regular fa-paper-plane"></i>
                        <span>Suggestion d&apos;envoi</span>
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <div className="flex flex-col items-center justify-center text-center py-12 space-y-6 animate-fade-in-up h-full">
                  <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-500 shadow-md border border-emerald-200 animate-bounce">
                    <i className="fa-solid fa-check text-4xl font-bold"></i>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-2xl font-extrabold text-gray-900">Merci pour votre contribution !</h4>
                    <p className="text-sm text-gray-500 max-w-sm leading-relaxed font-semibold">
                      Votre idée a bien été enregistrée et sera étudiée avec intérêt pour continuer d&apos;améliorer nos services.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSubmitted(false);
                      setSuggestion("");
                      setCategory("");
                      setEmail("");
                    }}
                    className="border-2 border-gray-200 text-gray-700 font-extrabold py-3 px-8 rounded-xl text-xs hover:bg-gray-50 transition cursor-pointer shadow-xs"
                  >
                    Faire une nouvelle suggestion
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Footer Éléments Sombre & Informations */}
      <footer className="bg-[#080E1E] text-gray-400 py-16 px-6 md:px-12 border-t border-gray-800">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
          {/* Colonne 1 : À Propos */}
          <div className="flex flex-col">
            <div className="flex items-center space-x-2.5 mb-4">
              <img src="/logo.jpeg" alt="Logo" className="w-7 h-7 rounded-full object-cover" />
              <h3 className="text-white text-xl font-extrabold">À propos de Facilite</h3>
            </div>
            <p className="text-sm leading-relaxed mb-6 text-gray-400 font-medium">
              Facilite est votre allié de confiance pour concevoir des CV percutants et professionnels. Grâce à nos outils intuitifs et nos modèles optimisés, propulsez votre carrière.
            </p>
            <h4 className="text-white text-base font-bold mb-3">Liens utiles</h4>
            <div className="flex flex-col space-y-2.5 text-sm font-semibold">
              <Link href="/" className="hover:text-[#10E688] transition-colors">
                Contact
              </Link>
            </div>
          </div>

          {/* Colonne 2 : Horaires & Support */}
          <div className="flex flex-col space-y-4">
            <h3 className="text-white text-lg font-bold mb-2">Horaires & Support</h3>
            <div className="flex items-center space-x-3">
              <span className="p-2.5 bg-gray-900 rounded-xl text-[#10E688] border border-gray-800 w-11 h-11 flex items-center justify-center">
                <i className="fa-solid fa-phone text-lg"></i>
              </span>
              <a href="tel:+221771400832" className="text-white text-xl font-black hover:text-[#10E688] transition-colors">
                +221 77 140 08 32
              </a>
            </div>
            <div className="flex items-center space-x-3">
              <a
                href="https://wa.me/message/KQERLEMIO7LKL1"
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 bg-gray-900 rounded-xl border border-gray-800 w-11 h-11 flex items-center justify-center hover:border-green-500 transition-colors"
              >
                <img src="/whtsapp.jpeg" alt="WhatsApp" className="w-full h-full object-cover rounded-lg" />
              </a>
              <a
                href="https://wa.me/message/KQERLEMIO7LKL1"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white text-base font-bold hover:text-green-500 transition-colors"
              >
                WhatsApp Direct
              </a>
            </div>
            <div className="flex items-center space-x-3 mb-2">
              <a
                href="mailto:facilitefacile@gmail.com"
                className="p-1 bg-gray-900 rounded-xl border border-gray-800 w-11 h-11 flex items-center justify-center hover:border-blue-500 transition-colors"
              >
                <img src="/email.png" alt="Email" className="w-full h-full object-contain" />
              </a>
              <a
                href="mailto:facilitefacile@gmail.com"
                className="text-white text-sm font-bold hover:text-blue-500 transition-colors truncate max-w-[200px]"
              >
                facilitefacile@gmail.com
              </a>
            </div>
          </div>

          {/* Colonne 3 : Réseaux & Newsletter */}
          <div className="flex flex-col">
            <h3 className="text-white text-lg font-bold mb-4">Restez en contact</h3>
            <p className="text-sm mb-6 text-gray-400 font-medium leading-relaxed">Suivez-nous sur nos réseaux sociaux pour ne rien rater de nos actualités.</p>
            <div className="flex space-x-4">
              <a
                href="#"
                className="w-11 h-11 bg-gray-900 rounded-2xl flex items-center justify-center text-white hover:bg-[#10E688] hover:text-black transition-all border border-gray-800 shadow-md"
                aria-label="Facebook"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M9 8H7v3h2v9h4v-9h3.61L17 8h-3V6.23c0-.85.34-1.23 1.08-1.23H17V1H14.12C11.53 1 10 2.5 10 5v3z" />
                </svg>
              </a>
              <a
                href="#"
                className="w-11 h-11 bg-gray-900 rounded-2xl flex items-center justify-center text-white hover:bg-[#10E688] hover:text-black transition-all border border-gray-800 shadow-md"
                aria-label="YouTube"
              >
                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                  <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.108C19.52 3.5 12 3.5 12 3.5s-7.52 0-9.388.555a3.002 3.002 0 0 0-2.11 2.108C0 8.03 0 12 0 12s0 3.97.502 5.837a3.003 3.003 0 0 0 2.11 2.108C4.48 20.5 12 20.5 12 20.5s7.52 0 9.388-.555a3.003 3.003 0 0 0 2.11-2.108C24 15.97 24 12 24 12s0-3.97-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </a>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-gray-800/80 text-center text-xs text-gray-500 font-medium">
          <p>© 2026 Facilite. Tous droits réservés.</p>
        </div>
      </footer>
    </>
  );
}

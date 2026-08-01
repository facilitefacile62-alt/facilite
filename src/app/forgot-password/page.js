/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import PhoneAuthForm from "@/components/PhoneAuthForm";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [method, setMethod] = useState("email");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (!email.includes("@")) {
      setErrorMessage("Veuillez saisir une adresse email valide.");
      return;
    }
    
    if (honeypot) {
      setIsLoading(true);
      setTimeout(() => {
        setIsLoading(false);
        setIsSuccess(true);
      }, 1500);
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/login?reset=true`,
      });

      setIsLoading(false);

      if (error) {
        setErrorMessage(error.message || "Erreur lors de l'envoi de l'e-mail de réinitialisation.");
        return;
      }

      setIsSuccess(true);
    } catch (err) {
      setIsLoading(false);
      setErrorMessage("Une erreur imprévue est survenue.");
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF6F1] font-sans flex flex-col justify-between items-center relative overflow-hidden">
      {/* Grille de fond subtile */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-40" 
        style={{
          backgroundImage: `radial-[#0000000a] 1px, transparent 1px), linear-gradient(to right, #00000008 1px, transparent 1px), linear-gradient(to bottom, #00000008 1px, transparent 1px)`,
          backgroundSize: "24px 24px"
        }}
      ></div>

      {/* Navigation En-tête */}
      <header className="w-full max-w-[1180px] px-6 py-5 flex items-center justify-between z-10">
        <Link href="/" className="flex items-center space-x-2.5 hover:opacity-85 transition">
          <img src="/logo.jpeg" alt="Logo Facilite" className="w-9 h-9 rounded-full object-cover shadow-sm border border-gray-200" />
          <span className="text-xl font-extrabold tracking-tight text-gray-900">Facilite</span>
        </Link>

        <Link
          href="/login"
          className="text-xs font-bold text-gray-600 hover:text-gray-900 bg-white border border-gray-200 px-4 py-2 rounded-full shadow-xs hover:shadow-sm transition flex items-center space-x-1.5"
        >
          <i className="fa-solid fa-arrow-left text-[11px]"></i>
          <span>Retour au Login</span>
        </Link>
      </header>

      {/* Conteneur Principal / Carte de Réinitialisation */}
      <main className="w-full max-w-md px-4 py-8 z-10">
        <div className="bg-white rounded-3xl p-8 sm:p-10 shadow-xl border border-gray-100 backdrop-blur-xs transition-all duration-300">
          
          {/* Logo officiel du site au-dessus de la carte */}
          <div className="flex justify-center mb-5">
            <img src="/logo.jpeg" alt="Logo Facilite" className="w-14 h-14 rounded-full object-cover shadow-md border-2 border-white ring-2 ring-gray-100" />
          </div>

          {/* Sélecteur d'onglets (E-mail / Téléphone) */}
          <div className="flex bg-white/50 backdrop-blur-sm p-1 rounded-xl mb-4 border border-white/40">
            <button
              type="button"
              onClick={() => setMethod("email")}
              className={`flex-1 py-1.5 text-xs font-extrabold rounded-lg transition-all duration-200 cursor-pointer ${
                method === "email"
                  ? "bg-[#10E688] text-gray-900 shadow-md scale-[1.02]"
                  : "text-gray-500 hover:text-gray-900 hover:bg-white/40"
              }`}
            >
              📧 E-mail
            </button>
            <button
              type="button"
              onClick={() => setMethod("phone")}
              className={`flex-1 py-1.5 text-xs font-extrabold rounded-lg transition-all duration-200 cursor-pointer ${
                method === "phone"
                  ? "bg-[#10E688] text-gray-900 shadow-md scale-[1.02]"
                  : "text-gray-500 hover:text-gray-900 hover:bg-white/40"
              }`}
            >
              📱 Téléphone
            </button>
          </div>

          {/* Titre & Sous-titre */}
          <div className="text-center mb-8">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mb-1.5">
              Reset Password
            </h1>
            <p className="text-sm font-medium text-gray-500">
              {method === "email" 
                ? "Entrez votre email pour recevoir un lien de réinitialisation."
                : "Connectez-vous via SMS pour pouvoir changer votre mot de passe depuis votre profil."}
            </p>
          </div>

          {isSuccess && method === "email" ? (
            <div className="text-center py-6 animate-fade-in">
              <div className="w-16 h-16 bg-[#10E688]/20 text-emerald-700 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                ✉️
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">E-mail envoyé !</h2>
              <p className="text-sm text-gray-600 mb-6">
                Si un compte existe pour <span className="font-semibold text-gray-900">{email}</span>, vous recevrez un lien de réinitialisation d'ici quelques instants.
              </p>
              <Link
                href="/login"
                className="inline-block w-full py-3.5 bg-[#10E688] hover:bg-[#0ed37c] text-gray-900 font-extrabold text-sm rounded-2xl shadow-md transition-all duration-200 text-center"
              >
                Retour à la connexion
              </Link>
            </div>
          ) : method === "email" ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <input
                type="text"
                name="address"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                style={{ position: 'absolute', opacity: 0, height: 0, width: 0, zIndex: -1 }}
                tabIndex={-1}
                autoComplete="off"
              />
              {/* Champ Email */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errorMessage) setErrorMessage("");
                  }}
                  required
                  placeholder="Enter your registered email"
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-sm font-medium placeholder-gray-400 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition"
                />
                {errorMessage && (
                  <p className="mt-1.5 text-xs font-semibold text-red-500">
                    {errorMessage}
                  </p>
                )}
              </div>

              {/* Bouton de Soumission */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-4 bg-[#10E688] hover:bg-[#0ed37c] text-gray-900 font-extrabold text-sm rounded-2xl shadow-md hover:shadow-lg transition-all duration-200 active:scale-[0.99] cursor-pointer flex items-center justify-center space-x-2 mt-2"
              >
                {isLoading ? (
                  <span className="inline-block w-4 h-4 border-2 border-gray-900 border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <span>Send Reset Link</span>
                )}
              </button>

              {/* Redirection Log in */}
              <div className="text-center pt-4">
                <Link
                  href="/login"
                  className="text-xs font-extrabold text-gray-700 hover:text-gray-900 hover:underline cursor-pointer flex items-center justify-center space-x-1.5"
                >
                  <i className="fa-solid fa-arrow-left text-[11px]"></i>
                  <span>Back to Login</span>
                </Link>
              </div>
            </form>
          ) : (
             <div className="mt-4">
               <PhoneAuthForm onSuccessRedirect="/profil?tab=securite" />
               {/* Redirection Log in */}
              <div className="text-center pt-4 mt-4 border-t border-gray-100">
                <Link
                  href="/login"
                  className="text-xs font-extrabold text-gray-700 hover:text-gray-900 hover:underline cursor-pointer flex items-center justify-center space-x-1.5"
                >
                  <i className="fa-solid fa-arrow-left text-[11px]"></i>
                  <span>Back to Login</span>
                </Link>
              </div>
             </div>
          )}
        </div>
      </main>

      {/* Footer minimaliste */}
      <footer className="w-full text-center py-4 text-xs font-semibold text-gray-400 z-10">
        © 2026 Facilite. All rights reserved.
      </footer>
    </div>
  );
}

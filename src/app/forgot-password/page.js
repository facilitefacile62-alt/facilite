/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (!email.includes("@")) {
      setErrorMessage("Veuillez saisir une adresse e-mail valide.");
      return;
    }

    if (honeypot) {
      setIsLoading(true);
      setTimeout(() => {
        setIsLoading(false);
        setIsSuccess(true);
      }, 1200);
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
    <div className="min-h-screen bg-[#F0F4F8]/80 font-sans flex flex-col justify-center items-center py-8 px-4 relative select-none">
      {/* Carte Centrale */}
      <div className="w-full max-w-[380px] mx-auto bg-white rounded-3xl p-6 sm:p-7 shadow-[0_8px_30px_rgba(0,0,0,0.06)] border border-gray-100 transition-all">
        
        {/* Badge Clé Officielle */}
        <div className="flex justify-center mb-1">
          <div className="w-14 h-14 rounded-full bg-white border border-gray-100 shadow-[0_4px_16px_rgba(0,0,0,0.06)] flex items-center justify-center p-2.5">
            <img
              src="/login_key.png"
              alt="Clé de réinitialisation"
              className="w-full h-full object-contain"
            />
          </div>
        </div>

        {/* Titre & Sous-titre */}
        <div className="text-center mb-5">
          <h1 className="text-2xl font-black text-[#0F172A] tracking-tight">
            Réinitialiser le mot de passe
          </h1>
          <p className="text-xs text-gray-500 font-medium mt-1">
            Entrez votre e-mail pour recevoir un lien de réinitialisation.
          </p>
        </div>

        {isSuccess ? (
          <div className="text-center py-4 space-y-3 animate-fade-in">
            <div className="w-14 h-14 bg-emerald-50 text-emerald-700 rounded-full flex items-center justify-center mx-auto text-2xl font-bold border border-emerald-200">
              ✓
            </div>
            <h2 className="text-base font-bold text-gray-900">E-mail envoyé !</h2>
            <p className="text-xs text-gray-600">
              Si un compte existe pour <span className="font-semibold text-gray-900">{email}</span>, vous recevrez un lien d'ici quelques instants.
            </p>
            <div className="pt-2">
              <Link
                href="/login"
                className="inline-block w-full py-3 bg-[#10E688] hover:bg-[#0ed37c] text-gray-950 font-bold text-xs rounded-xl shadow-xs transition text-center"
              >
                Retour à la connexion
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <input
              type="text"
              name="address"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              style={{ position: "absolute", opacity: 0, height: 0, width: 0, zIndex: -1 }}
              tabIndex={-1}
              autoComplete="off"
            />

            {/* Champ Adresse e-mail */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Adresse e-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errorMessage) setErrorMessage("");
                }}
                required
                autoFocus
                placeholder="Saisissez votre e-mail enregistré"
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-black transition"
              />
              {errorMessage && (
                <p className="mt-2 text-xs font-bold text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-200">
                  {errorMessage}
                </p>
              )}
            </div>

            {/* Bouton d'action Vert */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-[#10E688] hover:bg-[#0ed37c] text-gray-950 font-bold text-sm rounded-xl shadow-xs transition cursor-pointer flex items-center justify-center space-x-2 mt-1"
            >
              {isLoading ? (
                <span className="inline-block w-4 h-4 border-2 border-gray-950 border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <span>Envoyer le lien</span>
              )}
            </button>

            {/* Ligne fine */}
            <div className="border-t border-gray-100 my-4"></div>

            {/* Lien retour */}
            <div className="text-center">
              <Link
                href="/login"
                style={{ textDecoration: "none" }}
                className="text-xs font-semibold text-[#006666] hover:text-[#004d4d] no-underline hover:no-underline cursor-pointer inline-flex items-center gap-1.5 transition"
              >
                <span>← Retour à la connexion</span>
              </Link>
            </div>
          </form>
        )}
      </div>

      {/* Footer minimaliste */}
      <footer className="text-center py-3 text-xs text-gray-400">
        © 2026 Facilite · Tous droits réservés.
      </footer>
    </div>
  );
}

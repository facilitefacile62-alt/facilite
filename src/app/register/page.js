/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PhoneAuthForm from "@/components/PhoneAuthForm";

function RegisterForm() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [registerMethod, setRegisterMethod] = useState("email");
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect") || "/profil";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (password !== confirmPassword) {
      setErrorMessage("Les mots de passe ne correspondent pas.");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    
    if (honeypot) {
      setIsLoading(true);
      setTimeout(() => {
        setIsLoading(false);
        setIsSuccess(true); // Fake success for bots
      }, 1500);
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
        },
      });

      if (error) {
        setIsLoading(false);
        setErrorMessage(error.message || "Erreur lors de la création du compte.");
        return;
      }

      if (data?.user) {
        await supabase.from("profiles").upsert({
          id: data.user.id,
          email: email.trim(),
          full_name: fullName.trim(),
          updated_at: new Date().toISOString(),
        });
      }

      setIsLoading(false);
      setIsSuccess(true);
    } catch (err) {
      setIsLoading(false);
      setErrorMessage("Une erreur imprévue est survenue.");
    }
  };

  const handleOAuthSignUp = async (provider) => {
    if (oauthLoading) return;
    setOauthLoading(true);
    try {
      const safeRedirect = redirectUrl.startsWith("/") ? redirectUrl : "/profil";
      // /auth/callback échange le code CÔTÉ SERVEUR avant de rediriger vers
      // safeRedirect — voir la note détaillée dans login/page.js (même
      // correctif, même cause : double aller-retour avant sans cette route).
      const { error } = await supabase.auth.signInWithOAuth({
        provider: provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeRedirect)}`,
        },
      });
      if (error) throw error;
    } catch (err) {
      setErrorMessage(`Erreur lors de l'inscription via ${provider}`);
      setOauthLoading(false);
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
          href={`/login${redirectUrl && redirectUrl !== "/profil" ? `?redirect=${encodeURIComponent(redirectUrl)}` : ""}`}
          className="text-xs font-bold text-gray-600 hover:text-gray-900 bg-white border border-gray-200 px-4 py-2 rounded-full shadow-xs hover:shadow-sm transition flex items-center space-x-1.5"
        >
          <i className="fa-solid fa-arrow-left text-[11px]"></i>
          <span>Retour au Login</span>
        </Link>
      </header>

      {/* Conteneur Principal / Carte d'Inscription */}
      <main className="w-full max-w-md px-4 py-8 z-10">
        <div className="bg-white rounded-3xl p-8 sm:p-10 shadow-xl border border-gray-100 backdrop-blur-xs transition-all duration-300">
          
          {/* Logo officiel du site au-dessus de la carte */}
          <div className="flex justify-center mb-5">
            <Link href="/" className="cursor-pointer hover:opacity-85 transition" title="Retour à l'accueil Facilite">
              <img src="/logo.jpeg" alt="Logo Facilite" className="w-14 h-14 rounded-full object-cover shadow-md border-2 border-white ring-2 ring-gray-100" />
            </Link>
          </div>

          {/* Titre & Sous-titre */}
          <div className="text-center mb-6">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mb-1.5">
              Sign Up
            </h1>
            <p className="text-sm font-medium text-gray-500">
              Create your account to get started.
            </p>
          </div>

          {/* Bannière d'incitation quand l'utilisateur vient d'une redirection */}
          {redirectUrl && redirectUrl !== "/profil" && !isSuccess && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 mb-6 flex items-start gap-2.5 text-xs text-emerald-900 font-bold animate-fade-in shadow-2xs">
              <i className="fa-solid fa-sparkles text-emerald-600 text-sm mt-0.5 flex-shrink-0"></i>
              <div>
                <p className="font-black text-emerald-950">Créez votre compte gratuit en 30 secondes</p>
                <p className="text-[11px] text-emerald-800 font-normal mt-0.5">Pour accéder à toutes les offres d&apos;emploi et postuler directement sur Facilité.</p>
              </div>
            </div>
          )}

          {isSuccess ? (
            <div className="text-center py-6 animate-fade-in">
              <div className="w-16 h-16 bg-[#10E688]/20 text-emerald-700 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                ✓
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Compte créé avec succès !</h2>
              <p className="text-sm text-gray-600 mb-6">
                Vos informations ont bien été enregistrées sur Supabase. Vous pouvez maintenant vous connecter.
              </p>
              <Link
                href={`/login${redirectUrl && redirectUrl !== "/profil" ? `?redirect=${encodeURIComponent(redirectUrl)}` : ""}`}
                className="inline-block w-full py-3.5 bg-[#10E688] hover:bg-[#0ed37c] text-gray-900 font-extrabold text-sm rounded-2xl shadow-md transition-all duration-200"
              >
                Se connecter et continuer
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="text"
                name="website"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                style={{ position: 'absolute', opacity: 0, height: 0, width: 0, zIndex: -1 }}
                tabIndex={-1}
                autoComplete="off"
              />

              {/* Champ Nom Complet */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  placeholder="Enter your full name"
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-sm font-medium placeholder-gray-400 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition"
                />
              </div>

              {/* Champ Email */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="Enter your Email"
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-sm font-medium placeholder-gray-400 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition"
                />
              </div>

              {/* Champ Mot de Passe */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Create a password"
                    className="w-full pl-4 pr-10 py-3 bg-white border border-gray-300 rounded-xl text-sm font-medium placeholder-gray-400 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    <i className={`fa-solid ${showPassword ? "fa-eye-slash" : "fa-chevron-down"} text-xs`}></i>
                  </button>
                </div>
              </div>

              {/* Champ Confirmation Mot de Passe */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Confirm Password
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Confirm your password"
                  className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-sm font-medium placeholder-gray-400 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition"
                />
              </div>

              {errorMessage && (
                <p className="text-xs font-semibold text-red-500 bg-red-50 p-2.5 rounded-lg border border-red-100 mt-2">
                  ⚠️ {errorMessage}
                </p>
              )}

              {/* Bouton de Soumission Principal */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-4 bg-[#10E688] hover:bg-[#0ed37c] text-gray-900 font-extrabold text-sm rounded-2xl shadow-md hover:shadow-lg transition-all duration-200 active:scale-[0.99] cursor-pointer flex items-center justify-center space-x-2 mt-4"
              >
                {isLoading ? (
                  <span className="inline-block w-4 h-4 border-2 border-gray-900 border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <span>Create Account</span>
                )}
              </button>

              {/* Séparateur OR */}
              <div className="relative flex items-center justify-center my-6">
                <div className="border-t border-gray-200 w-full"></div>
                <span className="bg-white px-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider relative z-10">
                  OR
                </span>
              </div>

              {/* Bouton Google */}
              <button
                type="button"
                onClick={() => handleOAuthSignUp("google")}
                disabled={oauthLoading}
                className="w-full py-3 px-4 bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-800 font-bold text-sm rounded-xl transition flex items-center justify-center space-x-2.5 shadow-xs cursor-pointer disabled:opacity-60"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.15C3.26 21.39 7.37 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.24C.45 8.15 0 9.99 0 12s.45 3.85 1.24 5.42l4.04-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.37 0 3.26 2.61 1.24 6.58l4.04 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>{oauthLoading ? "Redirection..." : "Continue with Google"}</span>
              </button>

              {/* Redirection Log in */}
              <div className="text-center pt-2">
                <p className="text-xs text-gray-500 font-medium">
                  Already have an account?{" "}
                  <Link
                    href={`/login${redirectUrl && redirectUrl !== "/profil" ? `?redirect=${encodeURIComponent(redirectUrl)}` : ""}`}
                    className="font-extrabold text-gray-900 hover:underline cursor-pointer"
                  >
                    Log In
                  </Link>
                </p>
              </div>
            </form>
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

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FAF6F1] flex items-center justify-center"><i className="fa-solid fa-circle-notch fa-spin text-2xl text-emerald-600"></i></div>}>
      <RegisterForm />
    </Suspense>
  );
}

/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PhoneAuthForm from "@/components/PhoneAuthForm";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const router = useRouter();

  // Flux "mot de passe oublié" : Supabase ouvre une session temporaire de type
  // recovery quand l'utilisateur clique sur le lien reçu par email (redirectTo=/login?reset=true)
  const [isRecoveryMode, setIsRecoveryMode] = useState(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("reset") === "true";
  });
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [recoveryError, setRecoveryError] = useState("");
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoverySuccess, setRecoverySuccess] = useState(false);
  // Méthode de connexion sélectionnée : 'email' ou 'phone'
  const [loginMethod, setLoginMethod] = useState("email");

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecoveryMode(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    setRecoveryError("");

    if (newPassword.length < 6) {
      setRecoveryError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setRecoveryError("Les mots de passe ne correspondent pas.");
      return;
    }

    setRecoveryLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      setRecoveryLoading(false);

      if (error) {
        setRecoveryError(error.message || "Impossible de mettre à jour le mot de passe.");
        return;
      }

      setRecoverySuccess(true);
      await supabase.auth.signOut();
      setTimeout(() => {
        window.location.replace("/login");
      }, 2000);
    } catch (err) {
      setRecoveryLoading(false);
      setRecoveryError("Une erreur imprévue est survenue.");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setNeedsConfirmation(false);
    setIsLoading(true);

    try {
      // Authentification directe
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: password,
      });

      setIsLoading(false);

      if (error) {
        console.error("Supabase Auth Error:", error);
        if (error.message.includes("Invalid login credentials")) {
          setErrorMessage("Adresse email ou mot de passe incorrect. Vérifiez vos identifiants.");
        } else if (error.message.includes("Email not confirmed")) {
          setErrorMessage("Votre adresse email n'a pas encore été confirmée. Vérifiez votre boîte de réception ou renvoyez l'email de confirmation ci-dessous.");
          setNeedsConfirmation(true);
        } else if (error.status === 429 || error.message.toLowerCase().includes("rate limit") || error.message.toLowerCase().includes("too many requests")) {
          setErrorMessage("Trop de tentatives consécutives. Veuillez patienter quelques minutes puis réessayer.");
        } else {
          setErrorMessage(error.message || "Erreur de connexion. Veuillez réessayer.");
        }
        return;
      }

      if (data?.session) {
        setIsSuccess(true);

        const userId = data.session.user.id;
        let targetRole = data.session.user?.user_metadata?.role || "candidat";

        // Interroger la table profiles pour vérifier le rôle à jour
        try {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", userId)
            .single();

          if (profile?.role) {
            targetRole = profile.role;
          }
        } catch (pErr) {
          console.warn("Impossible de lire le profil:", pErr);
        }

        // Redirection dynamique selon le rôle
        let redirectUrl = "/messagerie";
        if (targetRole === "admin") redirectUrl = "/admin";
        else if (targetRole === "recruteur") redirectUrl = "/recruteur";

        setTimeout(() => {
          window.location.replace(redirectUrl);
        }, 500);
      }
    } catch (err) {
      console.error("Erreur de connexion d'exception:", err);
      setIsLoading(false);
      setErrorMessage("Une erreur est survenue lors de la communication avec le serveur.");
    }
  };

  const handleResendConfirmation = async () => {
    if (!email.trim()) return;
    setIsResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim().toLowerCase(),
      });
      if (error) {
        setErrorMessage(error.message || "Impossible de renvoyer l'email de confirmation.");
      } else {
        setErrorMessage("Un nouvel email de confirmation vient d'être envoyé.");
        setNeedsConfirmation(false);
      }
    } catch (err) {
      setErrorMessage("Une erreur est survenue lors du renvoi de l'email.");
    } finally {
      setIsResending(false);
    }
  };

  const handleOAuthLogin = async (provider) => {
    try {
      await supabase.auth.signInWithOAuth({
        provider: provider,
        options: {
          redirectTo: `${window.location.origin}/profil`,
        },
      });
    } catch (err) {
      setErrorMessage(`Erreur de connexion via ${provider}`);
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
          href="/"
          className="text-xs font-bold text-gray-600 hover:text-gray-900 bg-white border border-gray-200 px-4 py-2 rounded-full shadow-xs hover:shadow-sm transition flex items-center space-x-1.5"
        >
          <i className="fa-solid fa-arrow-left text-[11px]"></i>
          <span>Retour à l'accueil</span>
        </Link>
      </header>

      {/* Conteneur Principal / Carte de Login OU Carte de Réinitialisation */}
      <main className="w-[90%] max-w-sm mx-auto py-8 z-10">
        {isRecoveryMode ? (
          <div className="bg-white rounded-3xl p-4 sm:p-6 shadow-xl border border-gray-100 backdrop-blur-xs transition-all duration-300 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-center mb-5">
              <img src="/logo.jpeg" alt="Logo Facilite" className="w-14 h-14 rounded-full object-cover shadow-md border-2 border-white ring-2 ring-gray-100" />
            </div>

            <div className="text-center mb-8">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mb-1.5">
                Nouveau mot de passe
              </h1>
              <p className="text-sm font-medium text-gray-500">
                Choisissez un nouveau mot de passe pour votre compte.
              </p>
            </div>

            {recoverySuccess ? (
              <div className="text-center py-6 animate-fade-in">
                <div className="w-16 h-16 bg-[#10E688]/20 text-emerald-700 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                  ✓
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Mot de passe mis à jour !</h2>
                <p className="text-sm text-gray-600">
                  Redirection vers la page de connexion...
                </p>
              </div>
            ) : (
              <form onSubmit={handleResetPasswordSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    Nouveau mot de passe
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    placeholder="Au moins 6 caractères"
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-sm font-medium placeholder-gray-400 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    Confirmer le mot de passe
                  </label>
                  <input
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    required
                    placeholder="Confirmez le mot de passe"
                    className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-sm font-medium placeholder-gray-400 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition"
                  />
                </div>
                {recoveryError && (
                  <p className="text-xs font-semibold text-red-600 bg-red-50 p-3 rounded-xl border border-red-200">
                    ⚠️ {recoveryError}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={recoveryLoading}
                  className="w-full py-3.5 px-4 bg-[#10E688] hover:bg-[#0ed37c] text-gray-900 font-extrabold text-sm rounded-2xl shadow-md hover:shadow-lg transition-all duration-200 active:scale-[0.99] cursor-pointer flex items-center justify-center space-x-2 mt-2"
                >
                  {recoveryLoading ? (
                    <span className="inline-block w-4 h-4 border-2 border-gray-900 border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <span>Mettre à jour le mot de passe</span>
                  )}
                </button>
              </form>
            )}
          </div>
        ) : (
        <div className="bg-white rounded-3xl p-4 sm:p-6 shadow-xl border border-gray-100 backdrop-blur-xs transition-all duration-300 max-h-[90vh] overflow-y-auto">

          {/* Logo officiel du site au-dessus de la carte */}
          <div className="flex justify-center mb-5">
            <img src="/logo.jpeg" alt="Logo Facilite" className="w-14 h-14 rounded-full object-cover shadow-md border-2 border-white ring-2 ring-gray-100" />
          </div>

          {/* Sélecteur d'onglets Connexion (E-mail / Téléphone) */}
          <div className="flex bg-gray-100 p-1 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => setLoginMethod("email")}
              className={`flex-1 py-1.5 text-xs font-extrabold rounded-lg transition-all duration-200 ${
                loginMethod === "email"
                  ? "bg-white text-gray-900 shadow-xs"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              📧 E-mail
            </button>
            <button
              type="button"
              onClick={() => setLoginMethod("phone")}
              className={`flex-1 py-1.5 text-xs font-extrabold rounded-lg transition-all duration-200 ${
                loginMethod === "phone"
                  ? "bg-white text-gray-900 shadow-xs"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              📱 Téléphone
            </button>
          </div>

          {/* Titre & Sous-titre */}
          <div className="text-center mb-8">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mb-1.5">
              Login
            </h1>
            <p className="text-sm font-medium text-gray-500">
              {loginMethod === "email"
                ? "Saisissez vos identifiants pour vous connecter."
                : "Connectez-vous à l'aide de votre numéro de téléphone."}
            </p>
          </div>

          {isSuccess ? (
            <div className="text-center py-6 animate-fade-in">
              <div className="w-16 h-16 bg-[#10E688]/20 text-emerald-700 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                ✓
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Connexion réussie !</h2>
              <p className="text-sm text-gray-600 mb-6">
                Bienvenue sur votre espace Facilité. Redirection en cours...
              </p>
              <Link
                href="/profil"
                className="inline-block w-full py-3.5 bg-[#10E688] hover:bg-[#0ed37c] text-gray-900 font-extrabold text-sm rounded-2xl shadow-md transition-all duration-200"
              >
                Accéder à mon espace
              </Link>
            </div>
          ) : loginMethod === "email" ? (
            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Champ Email */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Email
                </label>
                <div className="relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errorMessage) setErrorMessage("");
                    }}
                    required
                    placeholder="Enter your Email"
                    className={`w-full px-3 py-2.5 bg-white border ${
                      errorMessage
                        ? "border-red-400 ring-2 ring-red-100 text-red-900"
                        : "border-gray-300 focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                    } rounded-xl text-sm font-medium placeholder-gray-400 focus:outline-none transition`}
                  />
                </div>
              </div>

              {/* Champ Mot de Passe */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-gray-700">
                    Password
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-xs font-extrabold text-blue-600 hover:text-blue-800 hover:underline transition-all duration-200 cursor-pointer"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errorMessage) setErrorMessage("");
                    }}
                    required
                    placeholder="Enter your password"
                    className="w-full pl-3 pr-10 py-2.5 bg-white border border-gray-300 rounded-xl text-sm font-medium placeholder-gray-400 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    <i className={`fa-solid ${showPassword ? "fa-eye-slash" : "fa-chevron-down"} text-xs`}></i>
                  </button>
                </div>
                {errorMessage && (
                  <p className="mt-2 text-xs font-semibold text-red-600 bg-red-50 p-3 rounded-xl border border-red-200">
                    ⚠️ {errorMessage}
                  </p>
                )}
                {needsConfirmation && (
                  <button
                    type="button"
                    onClick={handleResendConfirmation}
                    disabled={isResending}
                    className="mt-2 w-full text-xs font-extrabold text-blue-600 hover:text-blue-800 hover:underline transition cursor-pointer"
                  >
                    {isResending ? "Envoi en cours..." : "Renvoyer l'email de confirmation"}
                  </button>
                )}
              </div>

              {/* Bouton de Soumission Principal */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 px-4 bg-[#10E688] hover:bg-[#0ed37c] text-gray-900 font-extrabold text-sm rounded-xl shadow-md hover:shadow-lg transition-all duration-200 active:scale-[0.99] cursor-pointer flex items-center justify-center space-x-2 mt-2"
              >
                {isLoading ? (
                  <span className="inline-block w-4 h-4 border-2 border-gray-900 border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <span>Log In</span>
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
                onClick={() => handleOAuthLogin("google")}
                className="w-full py-3 px-4 bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-800 font-bold text-sm rounded-xl transition flex items-center justify-center space-x-2.5 shadow-xs cursor-pointer"
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
                <span>Continue with Google</span>
              </button>

              {/* Inscription Sign up */}
              <div className="text-center pt-4 border-t border-gray-100 mt-4">
                <p className="text-xs text-gray-600 font-semibold flex items-center justify-center space-x-1.5">
                  <span>Don't have an account yet?</span>
                  <Link
                    href="/register"
                    className="font-extrabold text-blue-600 hover:text-blue-800 hover:underline bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition-all duration-200 cursor-pointer"
                  >
                    Sign up
                  </Link>
                </p>
              </div>
            </form>
          ) : (
            <div className="mt-4">
              <PhoneAuthForm onSuccessRedirect="/profil" />
            </div>
          )}
        </div>
        )}
      </main>

      {/* Footer minimaliste */}
      <footer className="w-full text-center py-4 text-xs font-semibold text-gray-400 z-10">
        © 2026 Facilite. All rights reserved.
      </footer>
    </div>
  );
}

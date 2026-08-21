/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PhoneAuthForm from "@/components/PhoneAuthForm";

// Désactivé temporairement (Twilio non configuré, voir point 5 - inscription
// Google/e-mail) : masque l'onglet Téléphone sans toucher au code ni au
// composant PhoneAuthForm, pour pouvoir le réactiver d'un simple `true` une
// fois Twilio branché.
const PHONE_LOGIN_ENABLED = false;

export default function LoginPage() {
  const router = useRouter();

  // États du formulaire
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState(1); // 1 = Saisie Email, 2 = Saisie Mot de passe
  const [showPassword, setShowPassword] = useState(false);
  const [honeypot, setHoneypot] = useState("");

  // Méthode de connexion : 'email' ou 'phone'
  const [authMethod, setAuthMethod] = useState("email");

  // États de chargement et retours
  const [isLoading, setIsLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [showSuspendedNotice, setShowSuspendedNotice] = useState(false);

  // Mode de récupération de mot de passe (?reset=true)
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [isGoogleOnlyAccount, setIsGoogleOnlyAccount] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [recoveryError, setRecoveryError] = useState("");
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoverySuccess, setRecoverySuccess] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("reset") === "true") {
      setIsRecoveryMode(true);
    }
    if (params.get("suspended") === "true") {
      setShowSuspendedNotice(true);
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecoveryMode(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!isRecoveryMode) return;
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      const identities = data?.user?.identities || [];
      const hasPasswordIdentity = identities.some((i) => i.provider === "email");
      const hasGoogleIdentity = identities.some((i) => i.provider === "google");
      setIsGoogleOnlyAccount(hasGoogleIdentity && !hasPasswordIdentity);
    });
    return () => {
      cancelled = true;
    };
  }, [isRecoveryMode]);

  // Étape 1 : validation de l'e-mail
  const handleEmailStepSubmit = (e) => {
    e.preventDefault();
    setErrorMessage("");
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setErrorMessage("Veuillez saisir une adresse e-mail valide.");
      return;
    }
    setStep(2);
  };

  // Étape 2 : connexion par mot de passe
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");
    setNeedsConfirmation(false);

    if (honeypot) {
      setIsLoading(true);
      setTimeout(() => {
        setIsLoading(false);
        setErrorMessage("Adresse email ou mot de passe incorrect. Vérifiez vos identifiants.");
      }, 1200);
      return;
    }

    setIsLoading(true);

    try {
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
          setErrorMessage("Votre adresse email n'a pas encore été confirmée. Vérifiez votre boîte de réception.");
          setNeedsConfirmation(true);
        } else if (
          error.status === 429 ||
          error.message.toLowerCase().includes("rate limit") ||
          error.message.toLowerCase().includes("too many requests")
        ) {
          setErrorMessage("Trop de tentatives consécutives. Veuillez patienter quelques minutes.");
        } else {
          setErrorMessage(error.message || "Erreur de connexion. Veuillez réessayer.");
        }
        return;
      }

      if (data?.session) {
        setIsSuccess(true);

        fetch("/api/auth/confirm-after-login", {
          method: "POST",
          headers: { Authorization: `Bearer ${data.session.access_token}` },
        }).catch(() => {});

        const userId = data.session.user.id;
        let targetRole = "user";

        try {
          const { data: userRoleRow } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", userId)
            .single();

          if (userRoleRow?.role) {
            targetRole = userRoleRow.role;
          }
        } catch (pErr) {
          console.warn("Impossible de lire le rôle:", pErr);
        }

        const searchParams = new URLSearchParams(window.location.search);
        const targetRedirect = searchParams.get("redirect");
        let redirectUrl = targetRedirect || "/";

        if (!targetRedirect) {
          if (targetRole === "admin" || targetRole === "publisher") {
            redirectUrl = "/admin";
          } else if (targetRole === "user") {
            try {
              const { data: hasVerifiedBadge } = await supabase.rpc("has_badge", {
                check_user_id: userId,
                badge_name: "verified_recruiter",
              });
              if (hasVerifiedBadge === true) {
                redirectUrl = "/recruteur";
              }
            } catch (e) {
              console.warn("Impossible de vérifier le badge recruteur:", e);
            }
          }
        }

        setTimeout(() => {
          window.location.replace(redirectUrl);
        }, 400);
      }
    } catch (err) {
      console.error("Erreur de connexion:", err);
      setIsLoading(false);
      setErrorMessage("Une erreur est survenue lors de la connexion.");
    }
  };

  // Connexion Google OAuth
  const handleOAuthLogin = async (provider) => {
    if (oauthLoading) return;
    setOauthLoading(true);
    setErrorMessage("");
    try {
      const params = new URLSearchParams(window.location.search);
      const targetRedirect = params.get("redirect") || "/";
      const safeRedirect = targetRedirect.startsWith("/") && !targetRedirect.startsWith("//") ? targetRedirect : "/";

      const { error } = await supabase.auth.signInWithOAuth({
        provider: provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeRedirect)}`,
        },
      });

      if (error) throw error;
    } catch (err) {
      setErrorMessage(`Erreur de connexion via ${provider}`);
      setOauthLoading(false);
    }
  };

  // Envoi d'un Magic Link par email
  const handleSendMagicLink = async () => {
    if (!email.trim() || !email.includes("@")) {
      setErrorMessage("Veuillez saisir une adresse e-mail valide.");
      return;
    }
    setMagicLinkLoading(true);
    setErrorMessage("");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        setErrorMessage(error.message || "Impossible d'envoyer le lien magique.");
      } else {
        setMagicLinkSent(true);
      }
    } catch (err) {
      setErrorMessage("Erreur lors de l'envoi du lien.");
    } finally {
      setMagicLinkLoading(false);
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
        setErrorMessage("Un nouvel email de confirmation a été envoyé.");
        setNeedsConfirmation(false);
      }
    } catch (err) {
      setErrorMessage("Erreur lors du renvoi.");
    } finally {
      setIsResending(false);
    }
  };

  // Reset password submit
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
      await supabase.auth.signOut({ scope: "global" });
      setTimeout(() => {
        window.location.replace("/login");
      }, 1800);
    } catch (err) {
      setRecoveryLoading(false);
      setRecoveryError("Une erreur imprévue est survenue.");
    }
  };

  return (
    <div className="min-h-[calc(100dvh-60px)] bg-[#FAF6F1]/50 font-sans flex flex-col justify-start items-center pt-6 sm:pt-8 pb-8 px-3 sm:px-4 relative select-none">
      
      {/* CARTE DE CONNEXION PRINCIPALE */}
      <div className="w-full max-w-[340px] sm:max-w-[350px] mx-auto bg-white rounded-2xl p-5 sm:p-6 shadow-[0_6px_24px_rgba(0,0,0,0.06)] border border-gray-100/90 transition-all">
        
        {/* Mode Réinitialisation de mot de passe */}
        {isRecoveryMode ? (
          <div className="space-y-3.5">
            <div className="text-center mb-1">
              <h1 className="text-xl font-black text-[#111827]">Nouveau mot de passe</h1>
              <p className="text-[11px] text-gray-500 mt-0.5">Définissez votre nouveau mot de passe.</p>
            </div>

            {recoverySuccess ? (
              <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-center text-xs font-semibold">
                ✓ Mot de passe mis à jour ! Redirection...
              </div>
            ) : (
              <form onSubmit={handleResetPasswordSubmit} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">Nouveau mot de passe</label>
                  <input
                    type="password"
                    required
                    placeholder="Au moins 6 caractères"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs sm:text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#064034] focus:ring-4 focus:ring-[#085041]/20 transition"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">Confirmer le mot de passe</label>
                  <input
                    type="password"
                    required
                    placeholder="Confirmez le mot de passe"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs sm:text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#064034] focus:ring-4 focus:ring-[#085041]/20 transition"
                  />
                </div>

                {recoveryError && (
                  <p className="text-[11px] font-bold text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-200">
                    {recoveryError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={recoveryLoading}
                  className="w-full py-2.5 bg-[#085041] hover:bg-[#064034] text-white text-xs sm:text-sm font-bold rounded-xl transition shadow-xs cursor-pointer flex items-center justify-center"
                >
                  {recoveryLoading ? "Mise à jour..." : "Enregistrer le mot de passe"}
                </button>
              </form>
            )}
          </div>
        ) : isSuccess ? (
          /* Succès de Connexion */
          <div className="text-center py-5 space-y-2.5 animate-fade-in">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-700 rounded-full flex items-center justify-center mx-auto text-xl font-bold border border-emerald-200">
              ✓
            </div>
            <h2 className="text-base font-bold text-gray-900">Connexion réussie !</h2>
            <p className="text-[11px] text-gray-500">Bienvenue sur Facilité. Redirection en cours...</p>
          </div>
        ) : (
          /* Mode Principal : Logo Facilite + Login + Google en Haut + OU + Onglets E-mail/Téléphone */
          <div className="space-y-3">

            {/* Logo Facilite (identité teal #085041) avec contour animé */}
            <div className="flex justify-center mb-0.5">
              <div className="relative group">
                <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-[#085041] via-teal-400 to-[#085041] opacity-60 blur-xs animate-pulse"></div>
                <div className="relative w-11 h-11 rounded-full bg-white border-2 border-[#085041] shadow-[0_0_12px_rgba(8,80,65,0.25)] flex items-center justify-center p-2 transition-transform duration-300 group-hover:scale-105">
                  <img
                    src="/login_key_teal.png"
                    alt="Facilite"
                    className="w-full h-full object-contain drop-shadow-xs"
                  />
                </div>
              </div>
            </div>

            {/* Titre & Sous-titre */}
            <div className="text-center mb-3">
              <h1 className="text-xl sm:text-[22px] font-black text-[#0F172A] tracking-tight">
                Connexion
              </h1>
              <p className="text-[11px] text-gray-500 font-medium mt-0.5">
                Saisissez vos identifiants pour vous connecter.
              </p>
            </div>

            {showSuspendedNotice && (
              <p className="text-[11px] font-bold text-red-700 bg-red-50 p-2.5 rounded-xl border border-red-200">
                ⚠️ Ce compte a été suspendu. Contactez le support.
              </p>
            )}

            {/* 1. BOUTON GOOGLE EN HAUT */}
            <button
              type="button"
              onClick={() => handleOAuthLogin("google")}
              disabled={oauthLoading}
              className="w-full py-2.5 px-3.5 bg-white hover:bg-gray-50 border border-gray-200 text-gray-800 text-xs sm:text-sm font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-2xs cursor-pointer disabled:opacity-60 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#085041]/20 focus-visible:border-[#085041]"
            >
              <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
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
              <span>{oauthLoading ? "Redirection..." : "Continuer avec Google"}</span>
            </button>

            {/* 2. SÉPARATEUR OU AU CENTRE */}
            <div className="flex items-center justify-center my-2">
              <span className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">
                OU
              </span>
            </div>

            {/* Onglets E-mail / Téléphone — Téléphone masqué tant que Twilio
                n'est pas configuré (PHONE_LOGIN_ENABLED ci-dessus) */}
            {PHONE_LOGIN_ENABLED && (
              <div className="flex bg-gray-100 rounded-xl p-1" role="tablist" aria-label="Méthode de connexion">
                <button
                  type="button"
                  role="tab"
                  aria-selected={authMethod === "email"}
                  onClick={() => setAuthMethod("email")}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#085041]/40 ${
                    authMethod === "email" ? "bg-white text-[#085041] shadow-xs" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  E-mail
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={authMethod === "phone"}
                  onClick={() => setAuthMethod("phone")}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#085041]/40 ${
                    authMethod === "phone" ? "bg-white text-[#085041] shadow-xs" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Téléphone
                </button>
              </div>
            )}

            {/* 3. CONTENU DE L'ONGLET ACTIF */}
            {PHONE_LOGIN_ENABLED && authMethod === "phone" ? (
              <div className="space-y-2.5">
                <p className="text-[11px] text-gray-500 font-medium text-center">
                  Connexion avec un numéro déjà vérifié depuis votre profil. Pas encore de compte ?{" "}
                  <Link href="/register" className="font-bold text-[#085041] hover:underline">
                    Inscrivez-vous
                  </Link>{" "}
                  par e-mail ou Google.
                </p>
                <PhoneAuthForm onSuccessRedirect={typeof window !== "undefined" ? (new URLSearchParams(window.location.search).get("redirect") || "/") : "/"} />
              </div>
            ) : step === 1 ? (
              <form onSubmit={handleEmailStepSubmit} className="space-y-2.5">
                <input
                  type="text"
                  name="website"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                  style={{ position: "absolute", opacity: 0, height: 0, width: 0, zIndex: -1 }}
                  tabIndex={-1}
                  autoComplete="off"
                />
                <div>
                  <input
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errorMessage) setErrorMessage("");
                    }}
                    placeholder="nom@exemple.com"
                    className="w-full px-3.5 py-2.5 bg-white border-2 border-[#085041] hover:border-[#064034] rounded-xl text-xs sm:text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#064034] focus:ring-4 focus:ring-[#085041]/20 shadow-[0_0_12px_rgba(8,80,65,0.18)] transition-all duration-300"
                  />
                </div>

                {errorMessage && (
                  <p className="text-[11px] font-bold text-red-600 bg-red-50 p-2 rounded-xl border border-red-200">
                    {errorMessage}
                  </p>
                )}

                {/* Bouton Vert "Continuer avec l'e-mail" */}
                <button
                  type="submit"
                  className="w-full py-2.5 bg-[#085041] hover:bg-[#064034] active:scale-[0.99] text-white text-xs sm:text-sm font-bold rounded-xl transition shadow-xs cursor-pointer flex items-center justify-center"
                >
                  Continuer avec l'e-mail
                </button>

                {/* Lien Mot de passe oublié ? */}
                <div className="flex justify-end pt-0.5">
                  <Link
                    href="/forgot-password"
                    style={{ textDecoration: "none" }}
                    className="text-[11px] font-semibold text-[#085041] hover:text-[#064034] no-underline hover:no-underline transition"
                  >
                    Mot de passe oublié ?
                  </Link>
                </div>
              </form>
            ) : (
              /* Étape 2 : Saisie du Mot de Passe */
              <form onSubmit={handlePasswordSubmit} className="space-y-2.5 animate-fade-in">
                <div className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-xl border border-gray-200 text-xs">
                  <span className="font-semibold text-gray-800 truncate max-w-[200px]">{email}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setStep(1);
                      setPassword("");
                      setErrorMessage("");
                      setMagicLinkSent(false);
                    }}
                    style={{ textDecoration: "none" }}
                    className="text-[11px] font-semibold text-gray-500 hover:text-black no-underline hover:no-underline cursor-pointer"
                  >
                    Modifier
                  </button>
                </div>

                {magicLinkSent ? (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-800 space-y-0.5">
                    <p className="font-bold">✉️ Lien de connexion envoyé !</p>
                    <p>Vérifiez votre boîte de réception pour vous connecter en 1 clic.</p>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        autoFocus
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (errorMessage) setErrorMessage("");
                        }}
                        placeholder="Saisissez votre mot de passe"
                        className="w-full pl-3.5 pr-9 py-2.5 bg-white border-2 border-[#085041] hover:border-[#064034] rounded-xl text-xs sm:text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-[#064034] focus:ring-4 focus:ring-[#085041]/20 shadow-[0_0_12px_rgba(8,80,65,0.18)] transition-all duration-300"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-black cursor-pointer"
                      >
                        <i className={`fa-solid ${showPassword ? "fa-eye-slash" : "fa-eye"} text-xs`}></i>
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <button
                        type="button"
                        onClick={handleSendMagicLink}
                        disabled={magicLinkLoading}
                        style={{ textDecoration: "none" }}
                        className="text-gray-500 hover:text-black no-underline hover:no-underline cursor-pointer"
                      >
                        {magicLinkLoading ? "Envoi..." : "Lien magique"}
                      </button>

                      <Link
                        href="/forgot-password"
                        style={{ textDecoration: "none" }}
                        className="font-semibold text-[#085041] hover:text-[#064034] no-underline hover:no-underline"
                      >
                        Mot de passe oublié ?
                      </Link>
                    </div>

                    {errorMessage && (
                      <p className="text-[11px] font-bold text-red-600 bg-red-50 p-2 rounded-xl border border-red-200">
                        {errorMessage}
                      </p>
                    )}

                    {needsConfirmation && (
                      <button
                        type="button"
                        onClick={handleResendConfirmation}
                        disabled={isResending}
                        style={{ textDecoration: "none" }}
                        className="w-full text-[11px] font-bold text-[#085041] hover:text-[#064034] no-underline hover:no-underline py-0.5 cursor-pointer"
                      >
                        {isResending ? "Envoi en cours..." : "Renvoyer l'email de confirmation"}
                      </button>
                    )}

                    {/* Bouton Se Connecter Vert */}
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-2.5 bg-[#085041] hover:bg-[#064034] active:scale-[0.99] text-white text-xs sm:text-sm font-bold rounded-xl transition shadow-xs cursor-pointer flex items-center justify-center gap-2"
                    >
                      {isLoading ? (
                        <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      ) : (
                        <span>Se connecter</span>
                      )}
                    </button>
                  </>
                )}
              </form>
            )}

            {/* Séparateur Fin */}
            <div className="border-t border-gray-100 my-3"></div>

            {/* 4. FOOTER : Pas encore de compte ? Inscrivez-vous */}
            <div className="text-center pt-0.5">
              <p className="text-[11px] text-gray-700 font-normal">
                Pas encore de compte ?{" "}
                <Link
                  href="/register"
                  style={{ textDecoration: "none" }}
                  className="font-semibold text-[#085041] hover:text-[#064034] no-underline hover:no-underline"
                >
                  Inscrivez-vous
                </Link>
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer Minimaliste */}
      <footer className="text-center py-2 text-[11px] text-gray-400">
        © 2026 Facilite · Tous droits réservés.
      </footer>
    </div>
  );
}

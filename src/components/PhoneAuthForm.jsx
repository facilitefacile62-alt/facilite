/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { notifierConnexion } from "@/lib/confirmerConnexion";
import {
  DELAI_RENVOI_S,
  LIBELLE_UTILISER_EMAIL,
  MESSAGE_CODE_TARDE,
  libelleRenvoi,
  messageErreurCode,
  messageErreurEnvoi,
} from "@/lib/connexionTelephone";

// Liste des pays demandés avec ISO pour les drapeaux réels (FlagCDN)
const COUNTRIES = [
  { code: "+221", iso: "sn", name: "Sénégal" },
  { code: "+225", iso: "ci", name: "Côte d'Ivoire" },
  { code: "+212", iso: "ma", name: "Maroc" },
  { code: "+33", iso: "fr", name: "France" },
  { code: "+223", iso: "ml", name: "Mali" },
  { code: "+224", iso: "gn", name: "Guinée" },
  { code: "+229", iso: "bj", name: "Bénin" },
  { code: "+228", iso: "tg", name: "Togo" },
  { code: "+237", iso: "cm", name: "Cameroun" },
  { code: "other", iso: "other", name: "Autre (Saisie libre)" },
];

// Deux modes, un seul composant :
// - "login" (défaut, utilisé sur /login) : jamais de création de compte
//   (shouldCreateUser: false) — inchangé depuis l'origine de ce composant.
//   Un numéro vérifié s'ajoute après coup depuis le profil (Sécurité &
//   Connexion, cf. SecurityTabContent.jsx).
// - "signup" (utilisé sur /register, derrière PHONE_SIGNUP_ENABLED) :
//   shouldCreateUser: true. Un compte créé par téléphone n'a par
//   construction aucun email — si la session obtenue n'en a toujours pas,
//   onNeedsEmail(session) est appelée à la place de la redirection
//   habituelle, pour laisser l'appelant proposer PhoneSignupEmailPrompt
//   (jamais imposé : la règle "email obligatoire pour candidater" ne
//   bloque que la candidature, pas la création du compte).
export default function PhoneAuthForm({ onSuccessRedirect = "/", mode = "login", onNeedsEmail, onUseEmail }) {
  const router = useRouter();

  // Étape 1 : 'phone' (Saisie numéro) | Étape 2 : 'otp' (Saisie code 6 chiffres)
  const [step, setStep] = useState("phone");
  
  // États de saisie téléphone séparés
  const [selectedCountryCode, setSelectedCountryCode] = useState("+221");
  const [localNumber, setLocalNumber] = useState("");
  const [customCountryCode, setCustomCountryCode] = useState("");
  
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  const [phone, setPhone] = useState(""); // Numéro international complet final
  const [otpToken, setOtpToken] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  // Compte à rebours avant « Renvoyer le code » (60 s) et verrou contre les doubles envois (deux clics, ou un clic pendant l'envoi).
  const [attente, setAttente] = useState(0);
  const [envoyeLe, setEnvoyeLe] = useState(null);
  const envoiEnCours = useRef(false);
  useEffect(() => {
    if (attente <= 0) return;
    const t = setTimeout(() => setAttente((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [attente]);

  // Obtenir l'indicatif final à utiliser
  const getActiveCode = () => {
    return selectedCountryCode === "other" ? customCountryCode.trim() : selectedCountryCode;
  };

  // ----------------------------------------------------
  // ÉTAPE 1 : Envoi du code SMS via signInWithOtp
  // ----------------------------------------------------
  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const activeCode = getActiveCode();
    
    if (!activeCode || !activeCode.startsWith("+")) {
      setError("L'indicatif pays doit commencer par '+' (ex: +221 ou +33)");
      return;
    }

    // Supprimer tous les espaces, tirets et caractères non numériques (sauf le + initial) du numéro local
    const cleanLocal = localNumber.replace(/[\s\-\(\)]/g, "");
    
    if (!cleanLocal) {
      setError("Saisissez votre numéro.");
      return;
    }

    const fullPhoneNumber = `${activeCode}${cleanLocal}`;
    setPhone(fullPhoneNumber);
    await envoyerCode(fullPhoneNumber);
  };

  // Envoi (ou renvoi) du code : un seul à la fois, jamais de texte technique à l'écran.
  const envoyerCode = async (numero) => {
    if (envoiEnCours.current) return;
    envoiEnCours.current = true;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const { error: supabaseError } = await supabase.auth.signInWithOtp({
        phone: numero,
        options: {
          // mode "login" (défaut) : jamais de création de compte, un numéro inconnu renvoie une erreur explicite plutôt que de créer un compte
          // fantôme sans nom ni e-mail. mode "signup" : autorisé, voir onNeedsEmail plus bas pour ce qui suit une vraie création.
          shouldCreateUser: mode === "signup",
        },
      });
      if (supabaseError) throw supabaseError;
      setStep("otp");
      setOtpToken("");
      setEnvoyeLe(Date.now());
      setAttente(DELAI_RENVOI_S);
    } catch (err) {
      console.error("Détail complet erreur OTP :", err);
      setError(messageErreurEnvoi(err));
    } finally {
      envoiEnCours.current = false;
      setLoading(false);
    }
  };

  // ----------------------------------------------------
  // ÉTAPE 2 : Vérification du code avec verifyOtp
  // ----------------------------------------------------
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const cleanToken = otpToken.trim();
    if (cleanToken.length !== 6) {
      setError("Saisissez les 6 chiffres du code.");
      return;
    }

    setLoading(true);

    try {
      const { data, error: supabaseError } = await supabase.auth.verifyOtp({
        phone: phone.trim(),
        token: cleanToken,
        type: "sms", // Type de vérification SMS
      });

      if (supabaseError) throw supabaseError;

      if (data?.session) {
        // Best-effort, ne bloque jamais la suite : annule une suppression
        // de compte en attente si la personne se reconnecte (Section 3b
        // "Supprimer le compte" du profil).
        notifierConnexion(data.session);

        // Compte tout juste créé par téléphone, toujours sans e-mail —
        // propose l'ajout plutôt que de rediriger directement (jamais
        // imposé, voir PhoneSignupEmailPrompt).
        if (mode === "signup" && !data.session.user?.email && onNeedsEmail) {
          onNeedsEmail(data.session);
          return;
        }

        setMessage("Connexion réussie ! Redirection en cours...");
        const searchRedirect = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("redirect") : null;
        const targetUrl = searchRedirect || onSuccessRedirect || "/";
        setTimeout(() => {
          router.push(targetUrl);
          router.refresh();
        }, 1000);
      }
    } catch (err) {
      console.error("Détail complet erreur OTP :", err);
      
      // « Pas bon » ou « expiré » (Supabase répond la même chose pour les deux : on tranche sur le temps écoulé depuis l'envoi).
      setError(messageErreurCode(err, envoyeLe));
    } finally {
      setLoading(false);
    }
  };

  // Renvoyer le code au même numéro (seulement quand le compte à rebours est fini).
  const handleRenvoyer = () => {
    if (attente > 0) return;
    envoyerCode(phone);
  };

  // Revenir à la saisie pour corriger le numéro.
  const handleChangeNumber = () => {
    setOtpToken("");
    setStep("phone");
    setError(null);
    setMessage(null);
    setAttente(0);
  };

  return (
    <div className="w-full mx-auto">
      {/* Affichage du numéro pour l'étape OTP (sans répéter le titre principal) */}
      {step === "otp" && (
        <div className="text-center mb-4">
          <p className="text-sm font-medium text-gray-700 bg-white/50 backdrop-blur-sm border border-gray-200 py-1.5 px-3 rounded-lg inline-block">
            Code envoyé au <span className="font-extrabold">{phone}</span>
          </p>
        </div>
      )}

      {/* Alerte d'Erreur */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl flex items-start space-x-2 animate-fade-in">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Message de Succès / Info */}
      {message && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-start space-x-2 animate-fade-in">
          <span>✅</span>
          <span>{message}</span>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* ÉTAPE 1 : Formulaire Numéro de Téléphone */}
      {/* ---------------------------------------------------- */}
      {step === "phone" ? (
        <form onSubmit={handleSendOtp} className="space-y-2.5">
          <div className="space-y-2.5">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                Pays / Indicatif
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm bg-white/50 backdrop-blur-sm hover:bg-white transition-all duration-300 font-medium text-gray-800 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-2.5">
                    {(() => {
                      const sel = COUNTRIES.find(c => c.code === selectedCountryCode) || COUNTRIES[0];
                      return (
                        <>
                          {sel.iso === "other" ? (
                            <span className="text-base">🌍</span>
                          ) : (
                            <img src={`https://flagcdn.com/w20/${sel.iso}.png`} alt={sel.name} className="w-5 h-auto rounded-sm shadow-xs" />
                          )}
                          <span>{sel.name} {sel.code !== "other" ? `(${sel.code})` : ""}</span>
                        </>
                      );
                    })()}
                  </div>
                  <svg className={`w-4 h-4 text-gray-500 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </button>

                {isDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)}></div>
                    <div className="absolute z-20 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-56 overflow-y-auto py-1 animate-fade-in-up origin-top">
                      {COUNTRIES.map((c) => (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => {
                            setSelectedCountryCode(c.code);
                            setIsDropdownOpen(false);
                            setError(null);
                          }}
                          className={`w-full text-left px-4 py-2.5 text-sm flex items-center space-x-3 hover:bg-emerald-50 transition-colors ${selectedCountryCode === c.code ? "bg-emerald-50 text-emerald-700 font-bold" : "text-gray-700 font-medium"}`}
                        >
                          {c.iso === "other" ? (
                            <span className="text-base w-5 text-center">🌍</span>
                          ) : (
                            <img src={`https://flagcdn.com/w20/${c.iso}.png`} alt={c.name} className="w-5 h-auto rounded-sm shadow-xs" />
                          )}
                          <span>{c.name} {c.code !== "other" ? `(${c.code})` : ""}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Saisie libre si "Autre" sélectionné */}
            {selectedCountryCode === "other" && (
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Indicatif international personnalisé
                </label>
                <input
                  type="text"
                  value={customCountryCode}
                  onChange={(e) => setCustomCountryCode(e.target.value)}
                  placeholder="+243"
                  required
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 outline-none text-sm transition-all duration-300 bg-white/50 backdrop-blur-sm hover:bg-white font-medium placeholder-gray-400"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                Numéro de téléphone local
              </label>
              <input
                type="tel"
                value={localNumber}
                onChange={(e) => setLocalNumber(e.target.value)}
                placeholder="77 123 45 67"
                required
                className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm transition-all duration-300 bg-white/50 backdrop-blur-sm hover:bg-white font-medium tracking-wide placeholder-gray-400"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !localNumber.trim()}
            className="w-full py-2.5 bg-[#10E688] hover:bg-[#0ed37c] text-gray-900 font-extrabold text-sm rounded-xl shadow-[0_4px_14px_0_rgba(16,230,136,0.39)] hover:shadow-[0_6px_20px_rgba(16,230,136,0.23)] hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 flex items-center justify-center cursor-pointer"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin"></div>
            ) : (
              "Envoyer le code SMS"
            )}
          </button>
        </form>
      ) : (
        /* ---------------------------------------------------- */
        /* ÉTAPE 2 : Formulaire Code OTP */
        /* ---------------------------------------------------- */
        <form onSubmit={handleVerifyOtp} className="space-y-2.5">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 text-center">
              Code de vérification (6 chiffres)
            </label>
            <input
              type="text"
              maxLength={6}
              value={otpToken}
              onChange={(e) => setOtpToken(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              required
              className="w-full px-3 py-2.5 text-center tracking-[0.5em] text-2xl font-extrabold rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 outline-none transition-all duration-300 bg-white/50 backdrop-blur-sm hover:bg-white"
            />
          </div>

          <button
            type="submit"
            disabled={loading || otpToken.length !== 6}
            className="w-full py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-extrabold text-sm rounded-xl shadow-md transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-50 flex items-center justify-center cursor-pointer"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              "Valider & Se connecter"
            )}
          </button>

          <p className="text-sm font-semibold text-gray-700 text-center leading-snug">{MESSAGE_CODE_TARDE}</p>

          <button
            type="button"
            onClick={handleRenvoyer}
            disabled={attente > 0 || loading}
            className="w-full min-h-14 py-3 bg-white border-2 border-emerald-600 text-emerald-700 font-extrabold text-base rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {libelleRenvoi(attente)}
          </button>

          {onUseEmail && (
            <button
              type="button"
              onClick={onUseEmail}
              className="w-full min-h-14 py-3 bg-white border-2 border-gray-300 text-gray-900 font-extrabold text-base rounded-xl hover:bg-gray-50 transition cursor-pointer"
            >
              {LIBELLE_UTILISER_EMAIL}
            </button>
          )}

          <div className="text-center pt-1">
            <button
              type="button"
              onClick={handleChangeNumber}
              className="text-sm font-semibold text-emerald-700 hover:underline cursor-pointer"
            >
              ← Changer le numéro
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

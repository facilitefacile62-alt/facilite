"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

// Liste des pays demandés
const COUNTRIES = [
  { code: "+221", flag: "🇸🇳", name: "Sénégal" },
  { code: "+225", flag: "🇨🇮", name: "Côte d'Ivoire" },
  { code: "+212", flag: "🇲🇦", name: "Maroc" },
  { code: "+33", flag: "🇫🇷", name: "France" },
  { code: "+223", flag: "🇲🇱", name: "Mali" },
  { code: "+224", flag: "🇬🇳", name: "Guinée" },
  { code: "+229", flag: "🇧🇯", name: "Bénin" },
  { code: "+228", flag: "🇹🇬", name: "Togo" },
  { code: "+237", flag: "🇨🇲", name: "Cameroun" },
  { code: "other", flag: "🌍", name: "Autre (Saisie libre)" },
];

export default function PhoneAuthForm({ onSuccessRedirect = "/profil" }) {
  const router = useRouter();

  // Étape 1 : 'phone' (Saisie numéro) | Étape 2 : 'otp' (Saisie code 6 chiffres)
  const [step, setStep] = useState("phone");
  
  // États de saisie téléphone séparés
  const [selectedCountryCode, setSelectedCountryCode] = useState("+221");
  const [localNumber, setLocalNumber] = useState("");
  const [customCountryCode, setCustomCountryCode] = useState("");
  
  const [phone, setPhone] = useState(""); // Numéro international complet final
  const [otpToken, setOtpToken] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

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
      setError("Veuillez saisir un numéro de téléphone valide.");
      return;
    }

    const fullPhoneNumber = `${activeCode}${cleanLocal}`;
    setPhone(fullPhoneNumber);

    setLoading(true);

    try {
      const { error: supabaseError } = await supabase.auth.signInWithOtp({
        phone: fullPhoneNumber,
        options: {
          shouldCreateUser: true, // Crée l'utilisateur automatiquement s'il n'existe pas encore
        },
      });

      if (supabaseError) throw supabaseError;

      setStep("otp");
      setMessage(`Un code de validation à 6 chiffres a été envoyé par SMS au ${fullPhoneNumber}.`);
    } catch (err) {
      console.error("Détail complet erreur OTP :", err);
      
      // Extraction propre du message sans jamais passer un objet au state
      let msg = "Impossible d'envoyer le SMS. Vérifiez le numéro.";
      if (typeof err === 'string') {
        msg = err;
      } else if (err && typeof err === 'object') {
        msg = err.message || err.error_description || err.msg || String(err);
      }
      
      // Sécurité anti-objet vide "{}"
      if (!msg || msg === "{}" || msg === "[object Object]") {
        msg = "Erreur lors de l'envoi du SMS. Vérifiez la configuration Twilio/Supabase.";
      }
      
      setError(msg);
    } finally {
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
      setError("Veuillez saisir un code valide à 6 chiffres.");
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
        setMessage("Connexion réussie ! Redirection en cours...");
        setTimeout(() => {
          router.push(onSuccessRedirect);
          router.refresh();
        }, 1000);
      }
    } catch (err) {
      console.error("Détail complet erreur OTP :", err);
      
      // Extraction propre du message sans jamais passer un objet au state
      let msg = "Code invalide ou expiré. Veuillez réessayer.";
      if (typeof err === 'string') {
        msg = err;
      } else if (err && typeof err === 'object') {
        msg = err.message || err.error_description || err.msg || String(err);
      }
      
      // Sécurité anti-objet vide "{}"
      if (!msg || msg === "{}" || msg === "[object Object]") {
        msg = "Erreur lors de la vérification du code. Veuillez réessayer.";
      }
      
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Réinitialiser pour renvoyer un code
  const handleResendCode = () => {
    setOtpToken("");
    setStep("phone");
    setError(null);
    setMessage(null);
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white p-6 sm:p-8 rounded-2xl shadow-xl border border-gray-100">
      {/* En-tête */}
      <div className="text-center mb-6">
        <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3 text-xl">
          📱
        </div>
        <h2 className="text-2xl font-extrabold text-gray-900">Connexion par Téléphone</h2>
        <p className="text-xs text-gray-500 mt-1">
          {step === "phone"
            ? "Choisissez votre pays et saisissez votre numéro."
            : `Code envoyé au ${phone}`}
        </p>
      </div>

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
        <form onSubmit={handleSendOtp} className="space-y-4">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                Pays / Indicatif
              </label>
              <select
                value={selectedCountryCode}
                onChange={(e) => {
                  setSelectedCountryCode(e.target.value);
                  setError(null);
                }}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm bg-white transition font-medium text-gray-800"
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.name} {c.code !== "other" ? `(${c.code})` : ""}
                  </option>
                ))}
              </select>
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
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 outline-none text-sm transition font-medium placeholder-gray-400"
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
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm transition font-medium tracking-wide placeholder-gray-400"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !localNumber.trim()}
            className="w-full py-3.5 bg-[#10E688] hover:bg-emerald-400 text-gray-900 font-extrabold text-sm rounded-2xl shadow-md transition disabled:opacity-50 flex items-center justify-center cursor-pointer"
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
        <form onSubmit={handleVerifyOtp} className="space-y-4">
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
              className="w-full px-4 py-3 text-center tracking-[0.5em] text-2xl font-extrabold rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 outline-none transition bg-gray-50"
            />
          </div>

          <button
            type="submit"
            disabled={loading || otpToken.length !== 6}
            className="w-full py-3.5 bg-gray-900 hover:bg-gray-800 text-white font-extrabold text-sm rounded-2xl shadow-md transition disabled:opacity-50 flex items-center justify-center cursor-pointer"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              "Valider & Se connecter"
            )}
          </button>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={handleResendCode}
              className="text-xs font-semibold text-emerald-600 hover:underline cursor-pointer"
            >
              ← Modifier le numéro ou renvoyer un code
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

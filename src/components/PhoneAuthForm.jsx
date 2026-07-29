"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function PhoneAuthForm({ onSuccessRedirect = "/profil" }) {
  const router = useRouter();

  // Étape 1 : 'phone' (Saisie numéro) | Étape 2 : 'otp' (Saisie code 6 chiffres)
  const [step, setStep] = useState("phone");
  const [phone, setPhone] = useState("");
  const [otpToken, setOtpToken] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  // ----------------------------------------------------
  // ÉTAPE 1 : Envoi du code SMS via signInWithOtp
  // ----------------------------------------------------
  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    // Validation simple du format international
    const cleanPhone = phone.trim();
    if (!cleanPhone.startsWith("+")) {
      setError("Le numéro de téléphone doit inclure l'indicatif international (ex: +33612345678 ou +225...)");
      return;
    }

    setLoading(true);

    try {
      const { error: supabaseError } = await supabase.auth.signInWithOtp({
        phone: cleanPhone,
        options: {
          shouldCreateUser: true, // Crée l'utilisateur automatiquement s'il n'existe pas encore
        },
      });

      if (supabaseError) throw supabaseError;

      setStep("otp");
      setMessage(`Un code de validation à 6 chiffres a été envoyé par SMS au ${cleanPhone}.`);
    } catch (err) {
      console.error("Erreur d'envoi OTP SMS :", err);
      setError(err.message || "Impossible d'envoyer le code SMS. Vérifiez le numéro.");
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
      console.error("Erreur de vérification OTP :", err);
      setError(err.message || "Code invalide ou expiré. Veuillez réespérer.");
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
            ? "Entrez votre numéro pour recevoir un code d'accès par SMS."
            : `Code envoyé au ${phone}`}
        </p>
      </div>

      {/* Alerte d'Erreur */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl flex items-start space-x-2">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Message de Succès / Info */}
      {message && (
        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-start space-x-2">
          <span>✅</span>
          <span>{message}</span>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* ÉTAPE 1 : Formulaire Numéro de Téléphone */}
      {/* ---------------------------------------------------- */}
      {step === "phone" ? (
        <form onSubmit={handleSendOtp} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Numéro de téléphone (Format International)
            </label>
            <div className="relative">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+33 6 12 34 56 78"
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm transition font-medium tracking-wide"
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              N'oubliez pas l'indicatif (ex: +33 pour la France, +225 pour la Côte d'Ivoire).
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || !phone.trim()}
            className="w-full py-3 bg-[#10E688] hover:bg-emerald-400 text-gray-900 font-extrabold text-sm rounded-xl shadow-md transition disabled:opacity-50 flex items-center justify-center"
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
            <label className="block text-xs font-bold text-gray-700 mb-1 text-center">
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
            className="w-full py-3 bg-gray-900 hover:bg-gray-800 text-white font-extrabold text-sm rounded-xl shadow-md transition disabled:opacity-50 flex items-center justify-center"
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
              className="text-xs font-semibold text-emerald-600 hover:underline"
            >
              ← Modifier le numéro ou renvoyer un code
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

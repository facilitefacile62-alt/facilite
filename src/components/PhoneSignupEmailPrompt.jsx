"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { extractSendEmailErrorMessage } from "@/components/SecurityTabContent";

// Proposé (jamais imposé) juste après une inscription par téléphone, quand
// le compte n'a encore aucun e-mail : la règle "email obligatoire pour
// candidater" (voir supabase/migrations/20260912030000_candidature_email_obligatoire.sql)
// bloquera toute candidature tant qu'aucun e-mail confirmé n'existe — ce
// prompt donne la chance de le faire tout de suite, avec un "Plus tard"
// toujours visible. Même flux à 2 étapes que l'ajout d'e-mail déjà
// existant dans le profil (SecurityTabContent.jsx) : updateUser({email})
// -> verifyOtp type "email_change", même helper d'erreurs réutilisé.
export default function PhoneSignupEmailPrompt({ onDone, onSkip }) {
  const [etape, setEtape] = useState("offre"); // 'offre' | 'formulaire' | 'envoye'
  const [email, setEmail] = useState("");
  const [otpToken, setOtpToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (etape !== "envoye" || cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [etape, cooldown]);

  const envoyerEmail = async (e) => {
    e.preventDefault();
    setError("");
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Adresse e-mail invalide.");
      return;
    }
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ email: trimmed });
      if (updateError) throw updateError;
      setEmail(trimmed);
      setEtape("envoye");
      setCooldown(60);
      setMessage(`Un code de vérification a été envoyé à ${trimmed}.`);
    } catch (err) {
      setError(extractSendEmailErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const renvoyerCode = async () => {
    if (cooldown > 0) return;
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ email });
      if (updateError) throw updateError;
      setOtpToken("");
      setCooldown(60);
      setMessage(`Un nouveau code a été envoyé à ${email}.`);
    } catch (err) {
      setError(extractSendEmailErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const confirmerCode = async (e) => {
    e.preventDefault();
    setError("");
    const clean = otpToken.trim();
    if (clean.length !== 6) {
      setError("Veuillez saisir un code valide à 6 chiffres.");
      return;
    }
    setLoading(true);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({ email, token: clean, type: "email_change" });
      if (verifyError) throw verifyError;
      onDone?.();
    } catch (err) {
      let msg = err?.message || "Code invalide ou expiré.";
      if (/expired/i.test(msg)) msg = "Ce code a expiré. Demandez-en un nouveau.";
      else if (/invalid/i.test(msg)) msg = "Code incorrect. Vérifiez et réessayez.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full mx-auto space-y-3">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-semibold rounded-xl flex items-start space-x-2">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}
      {message && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-start space-x-2">
          <span>✅</span>
          <span>{message}</span>
        </div>
      )}

      {etape === "offre" && (
        <div className="text-center space-y-3 p-4 bg-blue-50 border border-blue-200 rounded-2xl">
          <p className="text-sm font-extrabold text-blue-900">Ajoutez votre e-mail (recommandé)</p>
          <p className="text-xs text-blue-800 font-medium leading-relaxed">
            Un e-mail confirmé est obligatoire pour postuler aux offres sur Facilité. Vous pouvez l&apos;ajouter tout de suite, ou plus tard depuis votre profil (Sécurité &amp; Connexion).
          </p>
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setEtape("formulaire")}
              className="px-4 py-2.5 bg-[#10E688] hover:bg-[#0ed37c] text-gray-900 font-extrabold text-xs rounded-xl transition cursor-pointer"
            >
              Ajouter mon e-mail
            </button>
            <button
              type="button"
              onClick={onSkip}
              className="px-4 py-2.5 text-gray-500 font-bold text-xs rounded-xl hover:bg-gray-100 transition cursor-pointer"
            >
              Plus tard
            </button>
          </div>
        </div>
      )}

      {etape === "formulaire" && (
        <form onSubmit={envoyerEmail} className="space-y-2.5">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@exemple.com"
            required
            autoFocus
            className="w-full px-3 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm transition-all duration-300 bg-white/50 backdrop-blur-sm hover:bg-white font-medium placeholder-gray-400"
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="flex-1 py-2.5 bg-[#10E688] hover:bg-[#0ed37c] text-gray-900 font-extrabold text-sm rounded-xl shadow-[0_4px_14px_0_rgba(16,230,136,0.39)] transition-all duration-300 disabled:opacity-50 cursor-pointer flex items-center justify-center"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                "Envoyer le code"
              )}
            </button>
            <button
              type="button"
              onClick={onSkip}
              className="px-4 py-2.5 text-gray-500 font-bold text-xs rounded-xl hover:bg-gray-100 transition cursor-pointer"
            >
              Passer
            </button>
          </div>
        </form>
      )}

      {etape === "envoye" && (
        <form onSubmit={confirmerCode} className="space-y-2.5">
          <p className="text-[11px] text-gray-500 font-medium text-center">
            Code envoyé à <span className="font-extrabold">{email}</span>
          </p>
          <input
            type="text"
            maxLength={6}
            value={otpToken}
            onChange={(e) => setOtpToken(e.target.value.replace(/\D/g, ""))}
            placeholder="123456"
            required
            autoFocus
            className="w-full px-3 py-2.5 text-center tracking-[0.5em] text-2xl font-extrabold rounded-xl border border-gray-300 focus:ring-2 focus:ring-emerald-500 outline-none transition-all duration-300 bg-white/50 backdrop-blur-sm hover:bg-white"
          />
          <button
            type="submit"
            disabled={loading || otpToken.length !== 6}
            className="w-full py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-extrabold text-sm rounded-xl shadow-md transition-all duration-300 disabled:opacity-50 cursor-pointer flex items-center justify-center"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              "Confirmer"
            )}
          </button>
          <div className="flex items-center justify-center gap-3 pt-1 text-xs">
            <button
              type="button"
              onClick={renvoyerCode}
              disabled={loading || cooldown > 0}
              className="font-bold text-emerald-700 hover:underline disabled:opacity-50 disabled:hover:no-underline cursor-pointer"
            >
              {cooldown > 0 ? `Renvoyer dans ${cooldown}s` : "Renvoyer le code"}
            </button>
            <button type="button" onClick={onSkip} className="font-bold text-gray-500 hover:underline cursor-pointer">
              Passer pour l&apos;instant
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

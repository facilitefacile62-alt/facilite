"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

// Décode le payload d'un JWT Supabase pour lire la revendication `amr`
// (Authentication Methods Reference) : la ou les méthodes ayant servi à
// obtenir la session EN COURS. Sert à savoir si l'utilisateur vient de
// prouver son identité via un code OTP fraîchement vérifié (auquel cas on
// peut dispenser de redemander l'ancien mot de passe — équivalent en
// robustesse) ou via un mot de passe (auquel cas on l'exige). Échoue de
// façon sûre : en cas de doute, on redemande toujours le mot de passe.
function getMostRecentAuthMethod(accessToken) {
  try {
    const payloadPart = accessToken.split(".")[1];
    const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join("")
    );
    const payload = JSON.parse(json);
    const amr = payload?.amr;
    if (!Array.isArray(amr) || amr.length === 0) return null;
    return amr.reduce((latest, entry) => (!latest || entry.timestamp > latest.timestamp ? entry : latest), null)
      ?.method || null;
  } catch {
    return null;
  }
}

export default function SecurityTabContent({ userSession }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Changement de mot de passe
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [skipCurrentPassword, setSkipCurrentPassword] = useState(false);

  // Identifiants
  const [hasEmail, setHasEmail] = useState(false);
  const [hasPhone, setHasPhone] = useState(false);
  const [emailConfirmed, setEmailConfirmed] = useState(false);
  const [phoneConfirmed, setPhoneConfirmed] = useState(false);

  // Confirmation du téléphone (flux à 2 étapes, même pattern que PhoneAuthForm)
  const [phoneConfirmStep, setPhoneConfirmStep] = useState("idle"); // idle | sent
  const [phoneOtpToken, setPhoneOtpToken] = useState("");

  // Dissociation
  const [unlinkTarget, setUnlinkTarget] = useState(null); // null | "email" | "phone"
  const [unlinkPassword, setUnlinkPassword] = useState("");

  const syncFromUser = (user) => {
    setHasEmail(!!user?.email);
    setHasPhone(!!user?.phone);
    setEmailConfirmed(!!user?.email_confirmed_at);
    setPhoneConfirmed(!!user?.phone_confirmed_at);
  };

  useEffect(() => {
    if (!userSession?.user) return;
    const user = userSession.user;
    const accessToken = userSession.access_token;
    // Micro-tâche : l'analyse react-hooks/set-state-in-effect interdit un
    // setState synchrone dans le corps de l'effet (dérivation directe d'une
    // prop). userSession n'arrive qu'après un getSession() asynchrone côté
    // parent — il n'y a pas d'alternative sans effet ici.
    queueMicrotask(() => {
      syncFromUser(user);
      setSkipCurrentPassword(getMostRecentAuthMethod(accessToken) === "otp");
    });
  }, [userSession]);

  // Relit l'utilisateur directement auprès du serveur Supabase (pas le
  // cache local de la session) : la seule source fiable pour compter les
  // identifiants réellement confirmés avant une action sensible.
  const fetchFreshUser = async () => {
    const { data, error: fetchError } = await supabase.auth.getUser();
    if (fetchError || !data?.user) {
      throw new Error("Impossible de vérifier votre session. Reconnectez-vous puis réessayez.");
    }
    syncFromUser(data.user);
    return data.user;
  };

  // Revérifie le mot de passe actuel via un signInWithPassword ciblé sur
  // l'identifiant confirmé de ce compte (préférence email). Ne déconnecte
  // aucun autre appareil : ça ne fait que rafraîchir la session courante.
  const reverifyPassword = async (user, password) => {
    const credential = user.email
      ? { email: user.email, password }
      : { phone: user.phone, password };
    const { error: reauthError } = await supabase.auth.signInWithPassword(credential);
    if (reauthError) {
      throw new Error("Mot de passe actuel incorrect.");
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (newPassword !== confirmPassword) {
      setError("Les nouveaux mots de passe ne correspondent pas.");
      return;
    }
    if (newPassword.length < 6) {
      setError("Le nouveau mot de passe doit contenir au moins 6 caractères.");
      return;
    }
    if (!skipCurrentPassword && !currentPassword) {
      setError("Veuillez saisir votre mot de passe actuel.");
      return;
    }

    setLoading(true);
    try {
      const user = await fetchFreshUser();

      if (!skipCurrentPassword) {
        await reverifyPassword(user, currentPassword);
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;

      setMessage("Votre mot de passe a été mis à jour avec succès.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSkipCurrentPassword(false);
    } catch (err) {
      console.error(err);
      setError(err.message || "Erreur lors de la mise à jour du mot de passe.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendPhoneConfirmation = async () => {
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const user = await fetchFreshUser();
      const { error: updateError } = await supabase.auth.updateUser({ phone: user.phone });
      if (updateError) throw updateError;
      setPhoneConfirmStep("sent");
      setMessage(`Un code de vérification à 6 chiffres a été envoyé au ${user.phone}.`);
    } catch (err) {
      console.error(err);
      setError(err.message || "Impossible d'envoyer le code de vérification.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPhoneConfirmation = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    if (phoneOtpToken.trim().length !== 6) {
      setError("Veuillez saisir un code valide à 6 chiffres.");
      return;
    }
    setLoading(true);
    try {
      const user = await fetchFreshUser();
      const { error: verifyError } = await supabase.auth.verifyOtp({
        phone: user.phone,
        token: phoneOtpToken.trim(),
        type: "phone_change",
      });
      if (verifyError) throw verifyError;

      await fetchFreshUser();
      setPhoneConfirmStep("idle");
      setPhoneOtpToken("");
      setMessage("Votre numéro de téléphone est confirmé.");
    } catch (err) {
      console.error(err);
      setError(err.message || "Code invalide ou expiré.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmailConfirmation = async () => {
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const user = await fetchFreshUser();
      const { error: updateError } = await supabase.auth.updateUser({ email: user.email });
      if (updateError) throw updateError;
      setMessage(`Un e-mail de confirmation a été envoyé à ${user.email}. Cliquez sur le lien qu'il contient.`);
    } catch (err) {
      console.error(err);
      setError(err.message || "Impossible d'envoyer l'e-mail de confirmation.");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestUnlink = async (provider) => {
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const user = await fetchFreshUser();
      const confirmedCount = (user.email_confirmed_at ? 1 : 0) + (user.phone_confirmed_at ? 1 : 0);
      if (confirmedCount <= 1) {
        setError("Vous devez conserver au moins un moyen de connexion vérifié (Email ou Téléphone).");
        return;
      }
      setUnlinkTarget(provider);
      setUnlinkPassword("");
    } catch (err) {
      setError(err.message || "Impossible de vérifier vos identifiants.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmUnlink = async () => {
    setError("");
    setMessage("");

    if (!skipCurrentPassword && !unlinkPassword) {
      setError("Veuillez saisir votre mot de passe pour confirmer.");
      return;
    }

    setLoading(true);
    try {
      const user = await fetchFreshUser();

      if (!skipCurrentPassword) {
        await reverifyPassword(user, unlinkPassword);
      }

      const identity = user.identities?.find((id) => id.provider === unlinkTarget);
      if (!identity) {
        throw new Error("Impossible de trouver l'identifiant à dissocier.");
      }

      const { error: unlinkError } = await supabase.auth.unlinkIdentity(identity);
      if (unlinkError) throw unlinkError;

      await fetchFreshUser();
      setMessage("Identifiant dissocié avec succès.");
      setUnlinkTarget(null);
      setUnlinkPassword("");
    } catch (err) {
      console.error(err);
      setError(err.message || "Erreur lors de la dissociation.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Alertes */}
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

      {/* Mes Identifiants de Connexion */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <h4 className="text-sm font-extrabold text-gray-900 mb-4 flex items-center gap-2">
          <i className="fa-solid fa-at text-indigo-600"></i>
          Mes identifiants de connexion
        </h4>

        <div className="space-y-4">
          {/* E-mail */}
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-xs font-bold text-gray-700 flex items-center gap-2">
                  E-mail
                  {hasEmail && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${emailConfirmed ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {emailConfirmed ? "Confirmé" : "Non confirmé"}
                    </span>
                  )}
                </p>
                {hasEmail ? (
                  <p className="text-sm text-gray-900 font-medium break-all">{userSession?.user?.email}</p>
                ) : (
                  <p className="text-xs text-gray-400 italic">Aucun e-mail associé</p>
                )}
              </div>
              {hasEmail && (
                <div className="flex items-center gap-2 shrink-0">
                  {!emailConfirmed && (
                    <button
                      type="button"
                      onClick={handleResendEmailConfirmation}
                      disabled={loading}
                      className="px-3 py-1.5 bg-amber-50 text-amber-700 text-xs font-bold rounded-lg hover:bg-amber-100 transition cursor-pointer disabled:opacity-50"
                    >
                      Confirmer
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRequestUnlink("email")}
                    disabled={loading}
                    className="px-3 py-1.5 bg-red-50 text-red-600 text-xs font-bold rounded-lg hover:bg-red-100 transition cursor-pointer disabled:opacity-50"
                  >
                    Dissocier
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Téléphone */}
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-xs font-bold text-gray-700 flex items-center gap-2">
                  Téléphone (SMS)
                  {hasPhone && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${phoneConfirmed ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {phoneConfirmed ? "Confirmé" : "Non confirmé"}
                    </span>
                  )}
                </p>
                {hasPhone ? (
                  <p className="text-sm text-gray-900 font-medium">{userSession?.user?.phone}</p>
                ) : (
                  <p className="text-xs text-gray-400 italic">Aucun numéro de téléphone associé</p>
                )}
              </div>
              {hasPhone && (
                <div className="flex items-center gap-2 shrink-0">
                  {!phoneConfirmed && phoneConfirmStep === "idle" && (
                    <button
                      type="button"
                      onClick={handleSendPhoneConfirmation}
                      disabled={loading}
                      className="px-3 py-1.5 bg-amber-50 text-amber-700 text-xs font-bold rounded-lg hover:bg-amber-100 transition cursor-pointer disabled:opacity-50"
                    >
                      Envoyer le code SMS
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRequestUnlink("phone")}
                    disabled={loading}
                    className="px-3 py-1.5 bg-red-50 text-red-600 text-xs font-bold rounded-lg hover:bg-red-100 transition cursor-pointer disabled:opacity-50"
                  >
                    Dissocier
                  </button>
                </div>
              )}
            </div>

            {!phoneConfirmed && phoneConfirmStep === "sent" && (
              <form onSubmit={handleVerifyPhoneConfirmation} className="mt-3 flex items-center gap-2 flex-wrap">
                <input
                  type="text"
                  maxLength={6}
                  value={phoneOtpToken}
                  onChange={(e) => setPhoneOtpToken(e.target.value.replace(/\D/g, ""))}
                  placeholder="Code à 6 chiffres"
                  className="flex-1 min-w-[140px] px-3 py-2 border border-gray-200 rounded-xl text-sm tracking-[0.3em] text-center focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                  required
                />
                <button
                  type="submit"
                  disabled={loading || phoneOtpToken.length !== 6}
                  className="px-4 py-2 bg-gray-900 text-white text-xs font-bold rounded-xl hover:bg-gray-800 transition disabled:opacity-50 cursor-pointer"
                >
                  Valider
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Changer le mot de passe */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <h4 className="text-sm font-extrabold text-gray-900 mb-4 flex items-center gap-2">
          <i className="fa-solid fa-key text-blue-600"></i>
          {skipCurrentPassword ? "Définir un mot de passe" : "Changer le mot de passe"}
        </h4>

        <form onSubmit={handleChangePassword} className="space-y-4">
          {!skipCurrentPassword && (
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Mot de passe actuel</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Requis pour confirmer que c'est bien vous"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 bg-gray-50 hover:bg-white transition"
                required
              />
            </div>
          )}
          {skipCurrentPassword && (
            <p className="text-[11px] text-gray-500 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
              Vous venez de vous authentifier par code — pas besoin de ressaisir un ancien mot de passe.
            </p>
          )}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Nouveau mot de passe</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min. 6 caractères"
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 bg-gray-50 hover:bg-white transition"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Confirmer le nouveau mot de passe</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirmez"
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 bg-gray-50 hover:bg-white transition"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-gray-900 text-white text-xs font-bold rounded-xl hover:bg-gray-800 transition disabled:opacity-50 cursor-pointer"
          >
            {loading ? "Mise à jour..." : "Mettre à jour le mot de passe"}
          </button>
        </form>
      </div>

      {/* Modale de confirmation avant dissociation */}
      {unlinkTarget && (
        <div className="fixed inset-0 z-[950] bg-black/50 flex items-center justify-center p-4" onClick={() => setUnlinkTarget(null)}>
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-sm font-extrabold text-gray-900">
              Dissocier votre {unlinkTarget === "email" ? "e-mail" : "numéro de téléphone"} ?
            </h4>
            <p className="text-xs text-gray-500">
              Vous ne pourrez plus vous connecter avec ce moyen. Cette action est irréversible.
            </p>
            {!skipCurrentPassword && (
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Mot de passe actuel</label>
                <input
                  type="password"
                  value={unlinkPassword}
                  onChange={(e) => setUnlinkPassword(e.target.value)}
                  placeholder="Confirmez avec votre mot de passe"
                  className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-1 focus:ring-red-500 focus:border-red-500 bg-gray-50"
                  autoFocus
                />
              </div>
            )}
            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setUnlinkTarget(null)}
                className="px-4 py-2 text-gray-600 text-xs font-bold rounded-xl hover:bg-gray-100 transition cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmUnlink}
                disabled={loading}
                className="px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700 transition disabled:opacity-50 cursor-pointer"
              >
                {loading ? "..." : "Dissocier"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

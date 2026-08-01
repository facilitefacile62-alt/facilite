"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function SecurityTabContent({ userSession }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Change password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // Identities
  const [hasEmail, setHasEmail] = useState(false);
  const [hasPhone, setHasPhone] = useState(false);

  useEffect(() => {
    if (userSession?.user) {
      setHasEmail(!!userSession.user.email);
      setHasPhone(!!userSession.user.phone);
    }
  }, [userSession]);

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

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) throw updateError;
      
      setMessage("Votre mot de passe a été mis à jour avec succès.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      console.error(err);
      setError(err.message || "Erreur lors de la mise à jour du mot de passe.");
    } finally {
      setLoading(false);
    }
  };
  
  const handleUnlink = async (provider) => {
    const identityToKeepCount = (hasEmail ? 1 : 0) + (hasPhone ? 1 : 0);
    if (identityToKeepCount <= 1) {
      setError("Vous devez conserver au moins un moyen de connexion vérifié (Email ou Téléphone).");
      return;
    }
    
    const identity = userSession.user.identities?.find(
      (id) => id.provider === provider || id.identity_data?.[provider]
    );

    if (!identity) {
       setError("Impossible de trouver l'identité à dissocier.");
       return;
    }

    if (confirm(`Êtes-vous sûr de vouloir dissocier votre ${provider === 'email' ? 'e-mail' : 'téléphone'} ? Vous ne pourrez plus vous connecter avec ce moyen.`)) {
      setLoading(true);
      try {
        const { error: unlinkError } = await supabase.auth.unlinkIdentity(identity);
        if (unlinkError) throw unlinkError;
        
        setMessage(`Identifiant dissocié avec succès.`);
        if (provider === 'email') setHasEmail(false);
        if (provider === 'phone') setHasPhone(false);
      } catch (err) {
        console.error(err);
        setError("Erreur lors de la dissociation : " + err.message);
      } finally {
        setLoading(false);
      }
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
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
            <div>
              <p className="text-xs font-bold text-gray-700">E-mail</p>
              {hasEmail ? (
                <p className="text-sm text-gray-900 font-medium">{userSession?.user?.email}</p>
              ) : (
                <p className="text-xs text-gray-400 italic">Aucun e-mail associé</p>
              )}
            </div>
            {hasEmail && (
              <button
                type="button"
                onClick={() => handleUnlink('email')}
                className="px-3 py-1.5 bg-red-50 text-red-600 text-xs font-bold rounded-lg hover:bg-red-100 transition cursor-pointer"
              >
                Dissocier
              </button>
            )}
          </div>
          
          {/* Téléphone */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
            <div>
              <p className="text-xs font-bold text-gray-700">Téléphone (SMS)</p>
              {hasPhone ? (
                <p className="text-sm text-gray-900 font-medium">{userSession?.user?.phone}</p>
              ) : (
                <p className="text-xs text-gray-400 italic">Aucun numéro de téléphone associé</p>
              )}
            </div>
            {hasPhone && (
              <button
                type="button"
                onClick={() => handleUnlink('phone')}
                className="px-3 py-1.5 bg-red-50 text-red-600 text-xs font-bold rounded-lg hover:bg-red-100 transition cursor-pointer"
              >
                Dissocier
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Changer le mot de passe */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
        <h4 className="text-sm font-extrabold text-gray-900 mb-4 flex items-center gap-2">
          <i className="fa-solid fa-key text-blue-600"></i>
          Changer le mot de passe
        </h4>
        
        <form onSubmit={handleChangePassword} className="space-y-4">
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
    </div>
  );
}

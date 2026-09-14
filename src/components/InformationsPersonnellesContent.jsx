"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { chargerNiveauxEtudes, grouperParCategorie, trouverNiveau } from "@/lib/niveauxEtudes";

/**
 * Onglet "Informations personnelles" — extrait de profil/page.js (candidat)
 * en composant autonome pour être réutilisé À L'IDENTIQUE depuis le
 * Marketplace (Réglages vendeur). Mêmes colonnes profiles (city, quartier,
 * country, gender, education_level_code/education_level), même RPC-free
 * écriture directe : un changement sur une plateforme est donc visible sur
 * l'autre puisque c'est littéralement la même ligne en base — pas une copie
 * de logique susceptible de diverger. Demande explicite de l'utilisateur,
 * 14/09/2026 (même principe déjà appliqué à SecurityTabContent).
 *
 * "company" reste un cas particulier hérité : aucune colonne profiles ne
 * l'accueille (voir commentaire d'origine ci-dessous), donc persisté en
 * localStorage — partagé de fait entre les deux plateformes puisqu'elles
 * vivent sur la même origine.
 */
export default function InformationsPersonnellesContent({ userSession }) {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [city, setCity] = useState("");
  const [quartier, setQuartier] = useState("");
  const [country, setCountry] = useState("");
  const [company, setCompany] = useState("");
  const [gender, setGender] = useState("");
  const [educationLevelCode, setEducationLevelCode] = useState("");
  const [niveauxEtudes, setNiveauxEtudes] = useState([]);

  useEffect(() => {
    if (!userSession?.user?.id) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("city, quartier, country, location, gender, education_level_code")
      .eq("id", userSession.user.id)
      .single()
      .then(({ data }) => {
        if (cancelled) return;
        if (data) {
          setCity(data.city || (data.location ? data.location.split(",")[0]?.trim() : "") || "");
          setCountry(data.country || (data.location ? data.location.split(",")[1]?.trim() : "") || "");
          setQuartier(data.quartier || "");
          setGender(data.gender || "");
          setEducationLevelCode(data.education_level_code || "");
        }
        if (typeof window !== "undefined") {
          setCompany(localStorage.getItem("user_company") || "");
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userSession?.user?.id]);

  useEffect(() => {
    chargerNiveauxEtudes().then((niveaux) => {
      setNiveauxEtudes(niveaux);
    });
  }, []);

  const showMessage = (msg) => {
    setMessage(msg);
    setError("");
    setTimeout(() => setMessage(""), 3500);
  };
  const showError = (msg) => {
    setError(msg);
    setMessage("");
  };

  const handleSaveField = async (fieldKey, fieldValue, setter) => {
    if (!userSession?.user?.id) return;
    setter(fieldValue);
    try {
      const { error: updErr } = await supabase
        .from("profiles")
        .update({ [fieldKey]: fieldValue, updated_at: new Date().toISOString() })
        .eq("id", userSession.user.id);
      if (updErr) throw updErr;
      showMessage("Information mise à jour avec succès !");
    } catch (err) {
      showError(err.message || "Erreur lors de la sauvegarde");
    }
  };

  const handleSaveNiveauEtudes = async (code) => {
    if (!userSession?.user?.id) return;
    const niveau = trouverNiveau(niveauxEtudes, code);
    setEducationLevelCode(code);
    try {
      const { error: updErr } = await supabase
        .from("profiles")
        .update({
          education_level_code: code || null,
          education_level: niveau?.libelle || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userSession.user.id);
      if (updErr) throw updErr;
      showMessage("Information mise à jour avec succès !");
    } catch (err) {
      showError(err.message || "Erreur lors de la sauvegarde");
    }
  };

  if (loading) {
    return <div className="py-10 text-center text-xs text-gray-400 font-semibold">Chargement…</div>;
  }

  return (
    <div className="space-y-4 animate-fade-in">
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

      {/* Lieu Actuel */}
      <div className="flex items-start justify-between p-3.5 hover:bg-gray-50/80 rounded-2xl transition border border-transparent hover:border-gray-200/60">
        <div className="flex items-center space-x-4 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 text-base shadow-xs">
            <i className="fa-solid fa-location-dot"></i>
          </div>
          <div>
            <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider">Lieu</h4>
            <p className="text-sm font-extrabold text-[#1D4ED8] mt-0.5">{city || "Non renseigné"}</p>
            <p className="text-[11px] text-gray-500 font-medium">Ville actuelle</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-[10px] bg-gray-100 text-gray-600 font-bold px-2 py-0.5 rounded-md border border-gray-200">🌐 Public</span>
          <button
            type="button"
            onClick={() => {
              const newCity = prompt("Modifier votre ville actuelle :", city || "");
              if (newCity !== null) handleSaveField("city", newCity.trim(), setCity);
            }}
            className="text-gray-400 hover:text-blue-600 p-2 rounded-full hover:bg-blue-50 transition cursor-pointer"
            title="Modifier"
          >
            <i className="fa-solid fa-pen text-xs"></i>
          </button>
        </div>
      </div>

      {/* Quartier */}
      <div className="flex items-start justify-between p-3.5 hover:bg-gray-50/80 rounded-2xl transition border border-transparent hover:border-gray-200/60">
        <div className="flex items-center space-x-4 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 text-base shadow-xs">
            <i className="fa-solid fa-map-pin"></i>
          </div>
          <div>
            <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider">Quartier</h4>
            <p className="text-sm font-extrabold text-[#1D4ED8] mt-0.5">{quartier || "Non renseigné"}</p>
            <p className="text-[11px] text-gray-500 font-medium">Peut être pré-rempli via "Scanner Document"</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-[10px] bg-gray-100 text-gray-600 font-bold px-2 py-0.5 rounded-md border border-gray-200">🌐 Public</span>
          <button
            type="button"
            onClick={() => {
              const newQuartier = prompt("Modifier votre quartier :", quartier || "");
              if (newQuartier !== null) handleSaveField("quartier", newQuartier.trim(), setQuartier);
            }}
            className="text-gray-400 hover:text-blue-600 p-2 rounded-full hover:bg-blue-50 transition cursor-pointer"
            title="Modifier"
          >
            <i className="fa-solid fa-pen text-xs"></i>
          </button>
        </div>
      </div>

      {/* Ville d'origine */}
      <div className="flex items-start justify-between p-3.5 hover:bg-gray-50/80 rounded-2xl transition border border-transparent hover:border-gray-200/60 border-t border-gray-100">
        <div className="flex items-center space-x-4 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 text-base shadow-xs">
            <i className="fa-solid fa-location-arrow"></i>
          </div>
          <div>
            <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider">Ville d'origine</h4>
            <p className="text-sm font-extrabold text-[#1D4ED8] mt-0.5">{country || "Non renseigné"}</p>
            <p className="text-[11px] text-gray-500 font-medium">Ville d'origine</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-[10px] bg-gray-100 text-gray-600 font-bold px-2 py-0.5 rounded-md border border-gray-200">🌐 Public</span>
          <button
            type="button"
            onClick={() => {
              const newCountry = prompt("Modifier votre pays/ville d'origine :", country || "");
              if (newCountry !== null) handleSaveField("country", newCountry.trim(), setCountry);
            }}
            className="text-gray-400 hover:text-blue-600 p-2 rounded-full hover:bg-blue-50 transition cursor-pointer"
            title="Modifier"
          >
            <i className="fa-solid fa-pen text-xs"></i>
          </button>
        </div>
      </div>

      {/* Membre de */}
      <div className="flex items-start justify-between p-3.5 hover:bg-gray-50/80 rounded-2xl transition border border-transparent hover:border-gray-200/60 border-t border-gray-100">
        <div className="flex items-center space-x-4 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 text-base shadow-xs">
            <i className="fa-solid fa-building"></i>
          </div>
          <div>
            <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider">Membre de</h4>
            <p className="text-sm font-extrabold text-gray-900 mt-0.5">{company || "Non renseigné"}</p>
            <p className="text-[11px] text-gray-500 font-medium">Organisation certifiée</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-[10px] bg-emerald-100 text-[#047857] font-bold px-2 py-0.5 rounded-md border border-emerald-200">Certifié</span>
          <button
            type="button"
            onClick={() => {
              const newCompany = prompt("Modifier votre organisation/société :", company || "");
              if (newCompany !== null) {
                const trimmed = newCompany.trim();
                setCompany(trimmed);
                // Pas de colonne "company" dans profiles (audit sécurité
                // 2026-08, section 7) : localStorage est le seul support —
                // même origine que /profil, donc déjà partagé de fait.
                if (typeof window !== "undefined") {
                  localStorage.setItem("user_company", trimmed);
                }
              }
            }}
            className="text-gray-400 hover:text-blue-600 p-2 rounded-full hover:bg-blue-50 transition cursor-pointer"
            title="Modifier"
          >
            <i className="fa-solid fa-pen text-xs"></i>
          </button>
        </div>
      </div>

      {/* Niveau d'études */}
      <div className="flex items-start justify-between p-3.5 hover:bg-gray-50/80 rounded-2xl transition border border-transparent hover:border-gray-200/60 border-t border-gray-100">
        <div className="flex items-center space-x-4 min-w-0 flex-1">
          <div className="w-11 h-11 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0 text-base shadow-xs">
            <i className="fa-solid fa-graduation-cap"></i>
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider">Niveau d'études</h4>
            <select
              id="reglages-education-level"
              name="reglages-education-level"
              value={educationLevelCode}
              onChange={(e) => handleSaveNiveauEtudes(e.target.value)}
              disabled={niveauxEtudes.length === 0}
              className="mt-1 text-sm font-extrabold text-gray-900 bg-transparent border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-indigo-500 cursor-pointer disabled:opacity-60"
            >
              <option value="">
                {niveauxEtudes.length === 0 ? "Chargement des niveaux…" : "Non renseigné"}
              </option>
              {grouperParCategorie(niveauxEtudes).map((groupe) => (
                <optgroup key={groupe.categorie} label={groupe.libelle}>
                  {groupe.niveaux.map((n) => (
                    <option key={n.code} value={n.code}>
                      {n.libelle}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <p className="text-[11px] text-gray-500 font-medium mt-1">
              {trouverNiveau(niveauxEtudes, educationLevelCode)?.comparable === false
                ? "Formation religieuse ou traditionnelle : affichée sur votre profil, jamais comparée à une exigence de diplôme."
                : "Utilisé pour vérifier votre éligibilité aux offres d'emploi"}
            </p>
          </div>
        </div>
      </div>

      {/* Genre */}
      <div className="flex items-start justify-between p-3.5 hover:bg-gray-50/80 rounded-2xl transition border border-transparent hover:border-gray-200/60 border-t border-gray-100">
        <div className="flex items-center space-x-4 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0 text-base shadow-xs">
            <i className="fa-solid fa-[#D946EF] fa-mars-stroke"></i>
          </div>
          <div>
            <h4 className="text-xs font-black text-gray-400 uppercase tracking-wider">Genre</h4>
            <p className="text-sm font-extrabold text-gray-900 mt-0.5">{gender || "Non renseigné"}</p>
            <p className="text-[11px] text-gray-500 font-medium">Genre du profil</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-[10px] bg-gray-100 text-gray-600 font-bold px-2 py-0.5 rounded-md border border-gray-200">🌐 Public</span>
          <button
            type="button"
            onClick={() => {
              const newGender = prompt("Modifier votre genre (Homme, Femme, Autre) :", gender);
              if (newGender !== null && newGender.trim()) handleSaveField("gender", newGender.trim(), setGender);
            }}
            className="text-gray-400 hover:text-blue-600 p-2 rounded-full hover:bg-blue-50 transition cursor-pointer"
            title="Modifier"
          >
            <i className="fa-solid fa-pen text-xs"></i>
          </button>
        </div>
      </div>
    </div>
  );
}

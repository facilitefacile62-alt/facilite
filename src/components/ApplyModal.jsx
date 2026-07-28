"use client";

import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

export default function ApplyModal({ isOpen, onClose, job, selectedLang, t, triggerToast }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [resumes, setResumes] = useState([]);
  const [cvChoice, setCvChoice] = useState("new"); // "existing" ou "new"
  const [existingCvId, setExistingCvId] = useState("");
  const [newCvFile, setNewCvFile] = useState(null);
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [success, setSuccess] = useState(false);

  const fileInputRef = useRef(null);

  // Charger la session et les CVs de l'utilisateur sur mount
  useEffect(() => {
    if (!isOpen) return;

    async function loadData() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setEmail(session.user.email || "");
          
          // Essayer de récupérer le profil complet pour pré-remplir le nom complet
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", session.user.id)
            .single();

          if (profile?.full_name) {
            setFullName(profile.full_name);
          } else {
            setFullName(session.user.user_metadata?.full_name || session.user.email.split("@")[0] || "");
          }

          // Charger la liste des CVs existants
          const { data: resumesList } = await supabase
            .from("resumes")
            .select("*")
            .eq("user_id", session.user.id)
            .order("created_at", { ascending: false });

          setResumes(resumesList || []);
          if (resumesList && resumesList.length > 0) {
            setExistingCvId(resumesList[0].id);
            setCvChoice("existing");
          } else {
            setCvChoice("new");
          }
        }
      } catch (err) {
        console.error("Erreur chargement données ApplyModal:", err);
      }
    }

    loadData();
    // Réinitialiser les états
    setNewCvFile(null);
    setCoverLetter("");
    setErrorMsg("");
    setSuccess(false);
  }, [isOpen]);

  if (!isOpen || !job) return null;

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setNewCvFile(e.target.files[0]);
      setErrorMsg("");
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setNewCvFile(e.dataTransfer.files[0]);
      setErrorMsg("");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) {
      setErrorMsg("Le nom et l'adresse e-mail sont obligatoires.");
      return;
    }

    if (cvChoice === "new" && !newCvFile) {
      setErrorMsg("Veuillez sélectionner ou déposer un fichier de CV.");
      return;
    }

    if (cvChoice === "existing" && !existingCvId) {
      setErrorMsg("Veuillez choisir un CV existant.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Votre session a expiré. Veuillez vous reconnecter.");
      }

      // Préparation du FormData
      const formData = new FormData();
      formData.append("jobId", job.id);
      formData.append("jobTitle", selectedLang === "FR" ? job.titleFR : job.titleEN);
      formData.append("company", job.company);
      formData.append("fullName", fullName.trim());
      formData.append("email", email.trim());
      formData.append("coverLetter", coverLetter.trim());

      if (cvChoice === "existing") {
        formData.append("existingCvId", existingCvId);
      } else {
        formData.append("cvFile", newCvFile);
      }

      // Requête HTTP POST vers notre route API
      const response = await fetch("/api/postuler", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Une erreur est survenue lors de l'envoi.");
      }

      setSuccess(true);
      if (triggerToast) {
        triggerToast("Candidature envoyée avec succès !", "fa-paper-plane");
      }
    } catch (err) {
      console.error("Erreur postuler:", err);
      setErrorMsg(err.message || "Une erreur est survenue lors de la soumission.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[600] flex items-center justify-center bg-black/65 backdrop-blur-xs p-4 animate-fade-in"
      id="apply-modal-overlay"
      onClick={(e) => {
        if (e.target.id === "apply-modal-overlay") onClose();
      }}
    >
      <div className="bg-white rounded-3xl w-full max-w-lg p-6 md:p-8 relative shadow-2xl flex flex-col border border-gray-100 max-h-[90vh] overflow-y-auto no-scrollbar animate-fade-in-up">
        {/* Bouton Fermer */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 cursor-pointer"
          disabled={loading}
        >
          <i className="fa-solid fa-xmark text-xl"></i>
        </button>

        {success ? (
          <div className="text-center py-8 space-y-6">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center border border-emerald-100 shadow-sm mx-auto animate-bounce">
              <i className="fa-solid fa-check-double text-3xl"></i>
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-extrabold text-gray-900">Candidature transmise !</h3>
              <p className="text-xs text-gray-500 font-medium leading-relaxed max-w-sm mx-auto">
                Félicitations, votre candidature pour le poste de <strong>{selectedLang === "FR" ? job.titleFR : job.titleEN}</strong> chez <strong>{job.company}</strong> a bien été enregistrée et envoyée au recruteur.
              </p>
            </div>
            <button
              onClick={onClose}
              className="mt-4 px-6 py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-extrabold text-xs rounded-xl transition cursor-pointer"
            >
              Fermer la fenêtre
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5 text-left">
            <div className="border-b border-gray-100 pb-3">
              <h3 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
                <i className="fa-solid fa-paper-plane text-emerald-500 text-sm"></i>
                Candidature Rapide
              </h3>
              <p className="text-[11px] text-gray-500 mt-1 leading-snug">
                Postuler pour le poste de <span className="font-extrabold text-gray-800">{selectedLang === "FR" ? job.titleFR : job.titleEN}</span> chez <span className="font-extrabold text-gray-800">{job.company}</span>.
              </p>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs font-bold text-rose-700 flex items-center gap-2">
                <i className="fa-solid fa-triangle-exclamation"></i>
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Section Informations Personnelles */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider block">Nom complet *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex. Aminata Diallo"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition"
                  disabled={loading}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider block">Adresse e-mail *</label>
                <input
                  type="email"
                  required
                  placeholder="Ex. diallo@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Section Choix du CV */}
            <div className="space-y-3">
              <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider block">Sélectionnez votre CV *</label>
              
              {resumes.length > 0 ? (
                <div className="flex gap-4 border-b border-gray-100 pb-2">
                  <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer">
                    <input
                      type="radio"
                      name="cvChoice"
                      value="existing"
                      checked={cvChoice === "existing"}
                      onChange={() => setCvChoice("existing")}
                      className="accent-emerald-500"
                      disabled={loading}
                    />
                    <span>CV déjà enregistré</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer">
                    <input
                      type="radio"
                      name="cvChoice"
                      value="new"
                      checked={cvChoice === "new"}
                      onChange={() => setCvChoice("new")}
                      className="accent-emerald-500"
                      disabled={loading}
                    />
                    <span>Importer un nouveau CV</span>
                  </label>
                </div>
              ) : null}

              {cvChoice === "existing" && resumes.length > 0 ? (
                <div className="space-y-1.5 animate-fade-in">
                  <select
                    value={existingCvId}
                    onChange={(e) => setExistingCvId(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-extrabold text-gray-700 focus:outline-none focus:border-emerald-500 transition cursor-pointer"
                    disabled={loading}
                  >
                    {resumes.map((cv) => (
                      <option key={cv.id} value={cv.id}>
                        {cv.title} ({new Date(cv.created_at).toLocaleDateString()})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-2xl p-5 text-center cursor-pointer hover:bg-gray-50 hover:border-emerald-400 transition animate-fade-in"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept=".pdf,.docx,.doc"
                    className="hidden"
                    disabled={loading}
                  />
                  {newCvFile ? (
                    <div className="space-y-1.5">
                      <i className="fa-solid fa-file-pdf text-3xl text-emerald-500"></i>
                      <p className="text-xs font-extrabold text-gray-800 truncate max-w-xs mx-auto">
                        {newCvFile.name}
                      </p>
                      <p className="text-[10px] text-gray-400 font-bold">
                        {(newCvFile.size / (1024 * 1024)).toFixed(2)} Mo - Cliquez pour remplacer
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1.5 text-gray-400">
                      <i className="fa-solid fa-cloud-arrow-up text-3xl"></i>
                      <p className="text-xs font-bold text-gray-600">
                        Glissez-déposez votre CV ici ou <span className="text-emerald-500 underline">parcourez</span>
                      </p>
                      <p className="text-[9px] font-bold">Formats acceptés : PDF, DOCX (10 Mo max)</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Section Message de motivation */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider block">Message d'accompagnement (Facultatif)</label>
              <textarea
                rows="3"
                placeholder="Parlez-nous brièvement de vos motivations ou ajoutez un message à l'attention du recruteur..."
                value={coverLetter}
                onChange={(e) => setCoverLetter(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition resize-none"
                disabled={loading}
              />
            </div>

            {/* Bouton de Soumission */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#10E688] hover:bg-[#0fd57d] text-gray-950 font-black py-3 px-4 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-2 shadow-[0_6px_16px_rgba(16,230,136,0.25)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <i className="fa-solid fa-spinner animate-spin text-sm"></i>
                  <span>Envoi de votre candidature...</span>
                </>
              ) : (
                <>
                  <i className="fa-regular fa-paper-plane text-xs"></i>
                  <span>Envoyer ma candidature</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

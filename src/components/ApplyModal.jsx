"use client";

import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

export default function ApplyModal({ isOpen, onClose, job, selectedLang, t, triggerToast }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [destinationEmail, setDestinationEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [resumes, setResumes] = useState([]);
  
  // Support multi-documents (CV FR + EN, lettres, diplômes...)
  const [selectedExistingCvIds, setSelectedExistingCvIds] = useState([]);
  const [newFiles, setNewFiles] = useState([]);
  
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

          // Charger la liste des CVs existants — uniquement ceux avec un vrai fichier
          const { data: resumesList } = await supabase
            .from("resumes")
            .select("*")
            .eq("user_id", session.user.id)
            .not("file_url", "is", null)
            .order("created_at", { ascending: false });

          setResumes(resumesList || []);
          if (resumesList && resumesList.length > 0) {
            setSelectedExistingCvIds([resumesList[0].id]);
          } else {
            setSelectedExistingCvIds([]);
          }
        }
      } catch (err) {
        console.error("Erreur chargement données ApplyModal:", err);
      }
    }

    loadData();
    // Réinitialiser les états à chaque ouverture de la modale
    setNewFiles([]);
    setSelectedExistingCvIds([]);
    setSubject(job ? (selectedLang === "FR" ? job.titleFR : job.titleEN) : "");
    const defaultRecruiterEmail = job?.recruiterEmail || job?.contact_email || job?.email || "";
    setDestinationEmail(defaultRecruiterEmail || (job?.company ? `${job.company.toLowerCase().replace(/[^a-z0-9]/g, "")}@gmail.com` : "recrutement@ffacilite.com"));
    setCoverLetter("");
    setErrorMsg("");
    setSuccess(false);
  }, [isOpen, job, selectedLang]);

  if (!isOpen || !job) return null;

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const added = Array.from(e.target.files);
      setNewFiles((prev) => [...prev, ...added]);
      setErrorMsg("");
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const added = Array.from(e.dataTransfer.files);
      setNewFiles((prev) => [...prev, ...added]);
      setErrorMsg("");
    }
  };

  const removeFile = (indexToRemove) => {
    setNewFiles((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const toggleExistingCv = (cvId) => {
    setSelectedExistingCvIds((prev) =>
      prev.includes(cvId) ? prev.filter((id) => id !== cvId) : [...prev, cvId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || !subject.trim()) {
      setErrorMsg("Le nom, l'adresse e-mail et l'objet de la candidature sont obligatoires.");
      return;
    }

    if (selectedExistingCvIds.length === 0 && newFiles.length === 0) {
      setErrorMsg("Veuillez joindre au moins un document ou CV pour votre candidature.");
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
      formData.append("subject", subject.trim());
      formData.append("company", job.company);
      formData.append("fullName", fullName.trim());
      formData.append("email", email.trim());
      formData.append("coverLetter", coverLetter.trim());
      if (destinationEmail && destinationEmail.trim()) {
        formData.append("recruiterEmail", destinationEmail.trim());
      } else if (job.recruiterEmail) {
        formData.append("recruiterEmail", job.recruiterEmail);
      }
      if (job.recruiterId) {
        formData.append("recruiterId", job.recruiterId);
      }

      // Ajout de tous les CVs existants cochés et des nouveaux fichiers
      selectedExistingCvIds.forEach((id) => {
        formData.append("existingCvIds", id);
      });
      newFiles.forEach((file) => {
        formData.append("cvFiles", file);
      });
      // Compatibilité
      if (selectedExistingCvIds.length > 0) {
        formData.append("existingCvId", selectedExistingCvIds[0]);
      }
      if (newFiles.length > 0) {
        formData.append("cvFile", newFiles[0]);
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
        const errorObj = result.error;
        const errMsg = typeof errorObj === "object" && errorObj !== null
          ? (errorObj.message || "Une erreur est survenue lors de l'envoi.")
          : (errorObj || "Une erreur est survenue lors de l'envoi.");
        const err = new Error(errMsg);
        err.error = errorObj;
        throw err;
      }

      setSuccess(true);
      if (triggerToast) {
        triggerToast("Candidature envoyée avec succès !", "fa-paper-plane");
      }
    } catch (err) {
      console.error("Erreur postuler:", err);
      setErrorMsg(err.error?.message || err.message || "Une erreur est survenue lors de la soumission.");
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
              <i className="fa-solid fa-circle-check text-4xl"></i>
            </div>
            <div className="space-y-2">
              <h4 className="text-xl font-black text-gray-900">Candidature Envoyée !</h4>
              <p className="text-xs font-semibold text-gray-600 max-w-sm mx-auto">
                Votre candidature pour <span className="text-gray-900 font-extrabold">{subject || (selectedLang === "FR" ? job.titleFR : job.titleEN)}</span> chez <span className="text-gray-900 font-extrabold">{job.company}</span> a bien été transmise avec toutes vos pièces jointes.
              </p>
              <p className="text-[11px] text-gray-400 font-medium pt-2">
                Vous recevrez un e-mail de confirmation à l'adresse {email}.
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-full bg-[#10E688] hover:bg-[#0fd57d] text-gray-950 font-extrabold py-3.5 px-6 rounded-2xl text-xs transition cursor-pointer shadow-[0_4px_12px_rgba(16,230,136,0.3)] block"
            >
              J'ai compris
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5 text-left">
            <div className="border-b border-gray-100 pb-3">
              <h3 className="text-lg font-extrabold text-gray-900 flex items-center gap-2">
                <i className="fa-solid fa-paper-plane text-emerald-500 text-sm"></i>
                {job.isSpontaneous ? "Candidature Spontanée" : "Candidature Rapide"}
              </h3>
              <p className="text-[11px] text-gray-500 mt-1 leading-snug">
                {job.isSpontaneous ? (
                  <>Envoyez-nous votre profil pour de futures opportunités.</>
                ) : (
                  <>Postuler pour le poste de <span className="font-extrabold text-gray-800">{selectedLang === "FR" ? job.titleFR : job.titleEN}</span> chez <span className="font-extrabold text-gray-800">{job.company}</span>.</>
                )}
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
                <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider block">Votre adresse e-mail *</label>
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

            {/* Case E-mail de réception de l'offre */}
            <div className="space-y-1.5 bg-emerald-50/50 border border-emerald-200/90 p-3 rounded-2xl">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                  <i className="fa-solid fa-envelope-open-text text-emerald-600"></i>
                  <span>E-mail de l'offre (Destinataire) *</span>
                </label>
                <span className="text-[9px] font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  Réception Candidature
                </span>
              </div>
              <input
                type="email"
                required
                placeholder="Ex. recrutement@entreprise.com"
                value={destinationEmail}
                onChange={(e) => setDestinationEmail(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl text-xs font-bold text-gray-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition shadow-2xs"
                disabled={loading}
              />
              <p className="text-[10px] text-gray-500 font-medium">
                Votre candidature et vos pièces jointes seront transmises directement à cette adresse.
              </p>
            </div>

            {/* Objet de la candidature / Poste souhaité */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider block">
                Objet de la candidature (ou Poste souhaité) *
              </label>
              <input
                type="text"
                required
                placeholder="Ex. Sauveteur Minier / Conducteur de Chargeuse..."
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition"
                disabled={loading}
              />
              <p className="text-[10px] text-gray-400 font-medium">
                Indiquez précisément l'intitulé du poste pour lequel vous postulez.
              </p>
            </div>

            {/* Section Sélection des CVs & Documents multiples */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider block">
                  Pièces jointes (CV Français, CV Anglais, Lettre, etc.) *
                </label>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                  {selectedExistingCvIds.length + newFiles.length} sélectionné(s)
                </span>
              </div>

              {resumes.length > 0 && (
                <div className="bg-gray-50 p-3 rounded-2xl border border-gray-200/80 space-y-2">
                  <p className="text-[11px] font-black text-gray-700 flex items-center gap-1.5">
                    <i className="fa-solid fa-folder-open text-emerald-500"></i>
                    Mes CVs enregistrés sur Facilité (Cochez pour joindre) :
                  </p>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                    {resumes.map((cv) => {
                      const isChecked = selectedExistingCvIds.includes(cv.id);
                      return (
                        <label
                          key={cv.id}
                          onClick={(e) => {
                            e.preventDefault();
                            if (!loading) toggleExistingCv(cv.id);
                          }}
                          className={`flex items-center gap-2 p-2 rounded-xl border transition cursor-pointer text-xs font-bold ${
                            isChecked
                              ? "bg-emerald-50 border-emerald-400 text-gray-900 shadow-xs"
                              : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50/80"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="accent-emerald-500 rounded"
                            disabled={loading}
                          />
                          <i className="fa-solid fa-file-pdf text-emerald-600 text-sm"></i>
                          <span className="truncate flex-1">{cv.title}</span>
                          <span className="text-[9px] text-gray-400 font-normal">
                            {new Date(cv.created_at).toLocaleDateString()}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-2xl p-4 text-center cursor-pointer hover:bg-gray-50 hover:border-emerald-400 transition animate-fade-in relative"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".pdf,.docx,.doc"
                  multiple
                  className="hidden"
                  disabled={loading}
                />
                <div className="space-y-1 text-gray-500">
                  <i className="fa-solid fa-cloud-arrow-up text-2xl text-emerald-500"></i>
                  <p className="text-xs font-extrabold text-gray-700">
                    Cliquez ici ou glissez pour joindre des documents
                  </p>
                  <p className="text-[10px] font-bold text-gray-400">
                    Vous pouvez joindre plusieurs fichiers (CV Français + Anglais, Lettres, Diplômes...)
                  </p>
                </div>
              </div>

              {newFiles.length > 0 && (
                <div className="space-y-1.5 pt-1 animate-fade-in">
                  <p className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">
                    Fichiers à importer ({newFiles.length}) :
                  </p>
                  {newFiles.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 bg-emerald-50/50 border border-emerald-200 rounded-xl text-xs font-extrabold text-gray-800 animate-fade-in"
                    >
                      <div className="flex items-center gap-2 truncate flex-1 pr-2">
                        <i className="fa-solid fa-file-lines text-emerald-600 text-sm"></i>
                        <span className="truncate">{file.name}</span>
                        <span className="text-[10px] text-gray-400 font-bold whitespace-nowrap">
                          ({(file.size / (1024 * 1024)).toFixed(2)} Mo)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(idx);
                        }}
                        disabled={loading}
                        className="w-6 h-6 rounded-lg bg-rose-100/80 text-rose-600 hover:bg-rose-200 transition flex items-center justify-center cursor-pointer"
                        title="Retirer ce fichier"
                      >
                        <i className="fa-solid fa-xmark text-xs"></i>
                      </button>
                    </div>
                  ))}
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
                  <span>{job.isSpontaneous ? "Soumettre ma candidature" : "Envoyer ma candidature"}</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

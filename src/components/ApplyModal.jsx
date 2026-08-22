"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
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
  
  const [currentUser, setCurrentUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
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
        setCurrentUser(session?.user || null);
        setAuthChecked(true);

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

          // Charger la liste des CVs existants — uniquement ceux avec un vrai
          // fichier. Le CV épinglé (is_pinned, point 9 — au plus un par
          // candidat) est trié en premier : la présélection ci-dessous reste
          // resumesList[0], mais c'est désormais un choix délibéré du
          // candidat plutôt que simplement "le plus récent".
          const { data: resumesList } = await supabase
            .from("resumes")
            .select("*")
            .eq("user_id", session.user.id)
            .not("file_url", "is", null)
            .order("is_pinned", { ascending: false })
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
        setAuthChecked(true);
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

  const returnUrl = typeof window !== "undefined"
    ? (window.location.pathname.startsWith("/offres/") ? `${window.location.pathname}?apply=1` : `/offres/${job.id}?apply=1`)
    : `/offres/${job.id}?apply=1`;

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

        {authChecked && !currentUser ? (
          <div className="text-center py-4 space-y-5">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto text-2xl shadow-xs border border-blue-100">
              <i className="fa-solid fa-user-lock"></i>
            </div>
            <div>
              <h3 className="text-lg font-black text-gray-900">Connexion ou Inscription requise</h3>
              <p className="text-xs text-gray-600 mt-1.5 max-w-sm mx-auto leading-relaxed">
                Pour postuler à l&apos;offre <strong className="text-gray-900">{job.titleFR || job.titleEN || job.title}</strong> chez <strong className="text-gray-900">{job.company}</strong>, veuillez vous connecter ou créer votre compte gratuitement.
              </p>
            </div>



            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 max-w-sm mx-auto">
              <Link
                href={`/login?redirect=${encodeURIComponent(returnUrl)}`}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md transition text-center flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-right-to-bracket"></i>
                <span>Se connecter</span>
              </Link>
              <Link
                href={`/register?redirect=${encodeURIComponent(returnUrl)}`}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow-md transition text-center flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-user-plus"></i>
                <span>Créer un compte</span>
              </Link>
            </div>
          </div>
        ) : success ? (
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
              <h3 className="text-base sm:text-lg font-black text-gray-900 flex items-center gap-2">
                <i className="fa-solid fa-paper-plane text-emerald-600 text-sm"></i>
                <span>{job.isSpontaneous ? "Candidature Spontanée" : "Candidature Rapide"}</span>
              </h3>
              <p className="text-xs text-gray-500 mt-0.5 truncate">
                {job.isSpontaneous
                  ? "Envoyez votre profil pour de futures opportunités"
                  : `${selectedLang === "FR" ? job.titleFR : job.titleEN} • ${job.company}`}
              </p>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs font-bold text-rose-700 flex items-center gap-2">
                <i className="fa-solid fa-triangle-exclamation"></i>
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Section Informations Personnelles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 block">Nom complet *</label>
                <input
                  type="text"
                  required
                  placeholder="Votre nom et prénom"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                  disabled={loading}
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 block">Votre e-mail *</label>
                <input
                  type="email"
                  required
                  placeholder="nom@exemple.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                  disabled={loading}
                />
              </div>
            </div>

            {/* E-mail destinataire de l'offre */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-700 block">E-mail du recruteur *</label>
              <input
                type="email"
                required
                value={destinationEmail}
                onChange={(e) => setDestinationEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:border-emerald-500 focus:bg-white transition font-mono"
                disabled={loading}
              />
            </div>

            {/* Objet du message */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-700 block">Objet *</label>
              <input
                type="text"
                required
                placeholder="Intitulé du poste"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                disabled={loading}
              />
            </div>

            {/* Documents & Pièces jointes */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-gray-700 block">Votre CV ou document *</label>
                {(selectedExistingCvIds.length + newFiles.length > 0) && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                    {selectedExistingCvIds.length + newFiles.length} sélectionné(s)
                  </span>
                )}
              </div>

              {resumes.length > 0 && (
                <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-200 space-y-1.5">
                  <p className="text-[11px] font-bold text-gray-600">CVs enregistrés sur votre profil :</p>
                  <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
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
                              ? "bg-emerald-50 border-emerald-400 text-emerald-950 shadow-2xs"
                              : "bg-white border-gray-200 text-gray-600 hover:bg-gray-100/60"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="accent-emerald-600 rounded"
                            disabled={loading}
                          />
                          <i className="fa-solid fa-file-pdf text-emerald-600 text-sm"></i>
                          <span className="truncate flex-1 flex items-center gap-1">
                            {cv.title}
                            {cv.is_pinned && <i className="fa-solid fa-thumbtack text-emerald-500 text-[10px]" title="CV épinglé"></i>}
                          </span>
                          <span className="text-[10px] text-gray-400 font-normal">
                            {new Date(cv.created_at).toLocaleDateString("fr-FR")}
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
                className="border-2 border-dashed border-gray-300 hover:border-emerald-500 rounded-2xl p-3.5 text-center cursor-pointer hover:bg-emerald-50/20 transition animate-fade-in"
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
                <div className="space-y-0.5 text-gray-500">
                  <i className="fa-solid fa-cloud-arrow-up text-xl text-emerald-600"></i>
                  <p className="text-xs font-bold text-gray-800">
                    Glissez votre CV ici ou cliquez pour parcourir
                  </p>
                  <p className="text-[10px] text-gray-400">PDF, DOCX jusqu'à 10 Mo</p>
                </div>
              </div>

              {newFiles.length > 0 && (
                <div className="space-y-1 pt-0.5 animate-fade-in">
                  {newFiles.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-950"
                    >
                      <div className="flex items-center gap-2 truncate flex-1 pr-2">
                        <i className="fa-solid fa-file-lines text-emerald-600 text-sm"></i>
                        <span className="truncate">{file.name}</span>
                        <span className="text-[10px] text-gray-500 font-normal">
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
                        className="w-5 h-5 rounded-md bg-rose-100 text-rose-600 hover:bg-rose-200 transition flex items-center justify-center cursor-pointer"
                        title="Retirer"
                      >
                        <i className="fa-solid fa-xmark text-[10px]"></i>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Message d'accompagnement */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-700 block">Message (facultatif)</label>
              <textarea
                rows="2"
                placeholder="Ajoutez un message pour le recruteur..."
                value={coverLetter}
                onChange={(e) => setCoverLetter(e.target.value)}
                className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition resize-none leading-relaxed"
                disabled={loading}
              />
            </div>

            {/* Bouton de Soumission */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-black py-3 px-4 rounded-xl text-xs sm:text-sm transition cursor-pointer flex items-center justify-center gap-2 shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
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

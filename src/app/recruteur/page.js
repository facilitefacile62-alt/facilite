/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase, handleGlobalSignOut, getSignedCvUrl } from "@/lib/supabase";
import { sendMessage } from "@/lib/messages";
import RoleBadge from "@/components/RoleBadge";

const EMPTY_OFFER = {
  title: "",
  company: "",
  location: "",
  contract_type: "CDI",
  salary_range: "",
  description: "",
};

export default function RecruteurDashboardPage() {
  const [userSession, setUserSession] = useState(null);
  const [activeTab, setActiveTab] = useState("offres"); // 'offres' | 'candidats'
  const [loading, setLoading] = useState(true);

  // --- Onglet Offres ---
  const [myOffers, setMyOffers] = useState([]);
  const [offerForm, setOfferForm] = useState(EMPTY_OFFER);
  const [editingOfferId, setEditingOfferId] = useState(null);
  const [savingOffer, setSavingOffer] = useState(false);

  // --- Onglet Candidats (CVthèque) ---
  const [candidates, setCandidates] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [signedCvUrl, setSignedCvUrl] = useState(null);
  const [loadingCvUrl, setLoadingCvUrl] = useState(false);
  const [contactingId, setContactingId] = useState(null);

  const [toast, setToast] = useState("");
  const triggerToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  useEffect(() => {
    async function loadRecruiterData() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          window.location.replace("/login");
          return;
        }
        setUserSession(session);

        const [{ data: offers, error: offersErr }, { data: candidatesData, error: candidatesErr }] = await Promise.all([
          supabase.from("job_offers").select("*").eq("recruiter_id", session.user.id).order("created_at", { ascending: false }),
          supabase.from("candidats_recherche").select("*"),
        ]);

        if (offersErr) console.error("Erreur chargement offres:", offersErr);
        else setMyOffers(offers || []);

        if (candidatesErr) console.error("Erreur chargement candidats:", candidatesErr);
        else setCandidates(candidatesData || []);
      } catch (err) {
        console.error("Exception chargement dashboard recruteur:", err);
      } finally {
        setLoading(false);
      }
    }

    loadRecruiterData();
  }, []);

  // --- Gestion des offres ---
  const handleOfferFieldChange = (field, value) => {
    setOfferForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleEditOffer = (offer) => {
    setEditingOfferId(offer.id);
    setOfferForm({
      title: offer.title || "",
      company: offer.company || "",
      location: offer.location || "",
      contract_type: offer.contract_type || "CDI",
      salary_range: offer.salary_range || "",
      description: offer.description || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancelEditOffer = () => {
    setEditingOfferId(null);
    setOfferForm(EMPTY_OFFER);
  };

  const handleSubmitOffer = async (e) => {
    e.preventDefault();
    if (!userSession?.user?.id) return;
    setSavingOffer(true);

    try {
      if (editingOfferId) {
        const { error } = await supabase
          .from("job_offers")
          .update({ ...offerForm, updated_at: new Date().toISOString() })
          .eq("id", editingOfferId)
          .eq("recruiter_id", userSession.user.id);

        if (error) {
          triggerToast("Erreur lors de la modification de l'offre.");
        } else {
          setMyOffers((prev) => prev.map((o) => (o.id === editingOfferId ? { ...o, ...offerForm } : o)));
          triggerToast("Offre mise à jour.");
          handleCancelEditOffer();
        }
      } else {
        const { data, error } = await supabase
          .from("job_offers")
          .insert({ ...offerForm, recruiter_id: userSession.user.id })
          .select()
          .single();

        if (error) {
          triggerToast("Erreur lors de la publication de l'offre.");
        } else {
          setMyOffers((prev) => [data, ...prev]);
          triggerToast("Offre publiée !");
          setOfferForm(EMPTY_OFFER);
        }
      }
    } catch (err) {
      console.error("Erreur sauvegarde offre:", err);
      triggerToast("Une erreur est survenue.");
    } finally {
      setSavingOffer(false);
    }
  };

  const handleDeleteOffer = async (offerId) => {
    if (!window.confirm("Supprimer définitivement cette offre ?")) return;

    const { error } = await supabase
      .from("job_offers")
      .delete()
      .eq("id", offerId)
      .eq("recruiter_id", userSession.user.id);

    if (error) {
      triggerToast("Erreur lors de la suppression.");
      return;
    }
    setMyOffers((prev) => prev.filter((o) => o.id !== offerId));
    if (editingOfferId === offerId) handleCancelEditOffer();
    triggerToast("Offre supprimée.");
  };

  // --- Gestion des candidats ---
  const handleOpenCandidateModal = async (candidate) => {
    setSelectedCandidate(candidate);
    setSignedCvUrl(null);

    if (candidate.cv_url) {
      setLoadingCvUrl(true);
      const url = await getSignedCvUrl(candidate.cv_url);
      setSignedCvUrl(url);
      setLoadingCvUrl(false);
    }
  };

  const handleContactCandidate = async (candidate) => {
    if (!userSession?.user?.id) return;
    setContactingId(candidate.id);

    const { error } = await sendMessage({
      senderId: userSession.user.id,
      receiverId: candidate.id,
      content: `Bonjour ${candidate.full_name || ""}, votre profil sur Facilite a retenu notre attention. Seriez-vous disponible pour échanger ?`.trim(),
    });

    setContactingId(null);

    if (error) {
      triggerToast("Impossible d'envoyer le message.");
      return;
    }
    window.location.href = "/messagerie";
  };

  const filteredCandidates = candidates.filter((c) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      (c.full_name || "").toLowerCase().includes(q) ||
      (c.headline || "").toLowerCase().includes(q) ||
      (Array.isArray(c.skills) ? c.skills.join(" ") : "").toLowerCase().includes(q);
    const matchesLocation =
      !locationFilter || (c.city || c.location || "").toLowerCase().includes(locationFilter.toLowerCase());
    return matchesSearch && matchesLocation;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF6F1] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-bold text-gray-700">Chargement de l'Espace Recruteur...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF6F1] font-sans flex flex-col justify-between">
      {/* Toast */}
      <div
        className={`fixed top-20 right-4 z-[700] bg-gray-900 text-white px-5 py-3 rounded-2xl shadow-2xl transition-all duration-300 transform ${
          toast ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0 pointer-events-none"
        }`}
      >
        <span className="text-sm font-semibold">{toast}</span>
      </div>

      {/* Header Nav */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-2">
              <img src="/logo.jpeg" alt="Logo Facilite" className="w-9 h-9 rounded-full object-cover shadow-sm border border-gray-200" />
              <span className="text-xl font-extrabold text-gray-900 tracking-tight">Facilite</span>
            </Link>
            <RoleBadge role="recruteur" />
          </div>

          <div className="flex items-center space-x-4">
            <Link
              href="/messagerie"
              className="text-xs font-bold text-gray-700 hover:text-emerald-700 bg-gray-100 hover:bg-emerald-50 px-3.5 py-2 rounded-xl transition flex items-center space-x-1.5"
            >
              <i className="fa-solid fa-comments"></i>
              <span>Messagerie</span>
            </Link>
            <button
              onClick={handleGlobalSignOut}
              className="text-xs font-bold text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-3.5 py-2 rounded-xl transition cursor-pointer"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        {/* Banner */}
        <div className="bg-gradient-to-r from-emerald-800 to-teal-900 rounded-3xl p-6 sm:p-8 text-white mb-8 shadow-xl relative overflow-hidden">
          <div className="relative z-10 max-w-2xl">
            <span className="text-xs font-extrabold text-emerald-300 uppercase tracking-widest block mb-2">
              Tableau de bord Recrutement
            </span>
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight mb-3">
              Offres & CVthèque
            </h1>
            <p className="text-sm text-emerald-100 font-medium leading-relaxed">
              Publiez vos offres d'emploi et recherchez les meilleurs talents parmi nos candidats.
            </p>
          </div>
        </div>

        {/* Onglets */}
        <div className="flex bg-white p-1.5 rounded-2xl border border-gray-200 shadow-xs mb-8 max-w-md">
          <button
            type="button"
            onClick={() => setActiveTab("offres")}
            className={`flex-1 py-2.5 px-4 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
              activeTab === "offres" ? "bg-emerald-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <span>📢 Mes Offres & Publication</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("candidats")}
            className={`flex-1 py-2.5 px-4 text-xs font-extrabold rounded-xl transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
              activeTab === "candidats" ? "bg-emerald-600 text-white shadow-sm" : "text-gray-500 hover:text-gray-900"
            }`}
          >
            <span>🔍 Recherche Candidats</span>
          </button>
        </div>

        {activeTab === "offres" ? (
          <div className="space-y-8">
            {/* Formulaire de publication */}
            <div className="bg-white rounded-3xl border border-gray-200 shadow-xs p-6 sm:p-8">
              <h2 className="text-lg font-extrabold text-gray-900 mb-1">
                {editingOfferId ? "Modifier l'offre" : "Publier une nouvelle offre"}
              </h2>
              <p className="text-xs text-gray-500 font-medium mb-6">
                {editingOfferId ? "Mettez à jour les informations puis enregistrez." : "Renseignez les détails du poste à pourvoir."}
              </p>

              <form onSubmit={handleSubmitOffer} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">Intitulé du poste</label>
                  <input
                    type="text"
                    required
                    value={offerForm.title}
                    onChange={(e) => handleOfferFieldChange("title", e.target.value)}
                    placeholder="Ex. Développeur Front-End React"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">Entreprise</label>
                  <input
                    type="text"
                    required
                    value={offerForm.company}
                    onChange={(e) => handleOfferFieldChange("company", e.target.value)}
                    placeholder="Ex. Facilite Corporation"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">Localisation</label>
                  <input
                    type="text"
                    required
                    value={offerForm.location}
                    onChange={(e) => handleOfferFieldChange("location", e.target.value)}
                    placeholder="Ex. Dakar, Sénégal"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">Type de contrat</label>
                  <select
                    value={offerForm.contract_type}
                    onChange={(e) => handleOfferFieldChange("contract_type", e.target.value)}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                  >
                    <option value="CDI">CDI</option>
                    <option value="CDD">CDD</option>
                    <option value="Stage">Stage</option>
                    <option value="Freelance">Freelance</option>
                    <option value="Alternance">Alternance</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">Salaire (optionnel)</label>
                  <input
                    type="text"
                    value={offerForm.salary_range}
                    onChange={(e) => handleOfferFieldChange("salary_range", e.target.value)}
                    placeholder="Ex. 300 000 - 450 000 FCFA / mois"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">Description du poste</label>
                  <textarea
                    required
                    rows={4}
                    value={offerForm.description}
                    onChange={(e) => handleOfferFieldChange("description", e.target.value)}
                    placeholder="Missions, profil recherché, avantages..."
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-emerald-500 focus:bg-white transition resize-none"
                  />
                </div>

                <div className="sm:col-span-2 flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={savingOffer}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm rounded-xl shadow-xs transition cursor-pointer disabled:opacity-60"
                  >
                    {savingOffer ? "Enregistrement..." : editingOfferId ? "Enregistrer les modifications" : "Publier l'offre"}
                  </button>
                  {editingOfferId && (
                    <button
                      type="button"
                      onClick={handleCancelEditOffer}
                      className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm rounded-xl transition cursor-pointer"
                    >
                      Annuler
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* Mes offres */}
            <div className="bg-white rounded-3xl border border-gray-200 shadow-xs overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-extrabold text-gray-900">Mes Offres ({myOffers.length})</h2>
              </div>
              {myOffers.length === 0 ? (
                <div className="p-8 text-center text-gray-400 italic text-xs">Aucune offre publiée pour le moment.</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {myOffers.map((offer) => (
                    <div key={offer.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h3 className="font-extrabold text-gray-900 text-sm">{offer.title}</h3>
                        <p className="text-xs text-gray-500 font-medium">
                          {offer.company} — {offer.location} · {offer.contract_type}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2 flex-shrink-0">
                        <button
                          onClick={() => handleEditOffer(offer)}
                          className="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl transition cursor-pointer"
                        >
                          Modifier
                        </button>
                        <button
                          onClick={() => handleDeleteOffer(offer.id)}
                          className="px-3.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-xs rounded-xl transition cursor-pointer"
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-extrabold text-gray-900">CVthèque ({filteredCandidates.length})</h2>
                <p className="text-xs text-gray-500 font-medium">Recherchez par nom, métier ou compétence</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative max-w-xs w-full">
                  <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-3.5 text-gray-400 text-xs"></i>
                  <input
                    type="text"
                    placeholder="Nom, métier, compétence..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                  />
                </div>
                <div className="relative max-w-xs w-full">
                  <i className="fa-solid fa-location-dot absolute left-3.5 top-3.5 text-gray-400 text-xs"></i>
                  <input
                    type="text"
                    placeholder="Localisation..."
                    value={locationFilter}
                    onChange={(e) => setLocationFilter(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCandidates.length === 0 ? (
                <div className="col-span-full text-center text-gray-400 italic text-xs py-8">Aucun candidat trouvé.</div>
              ) : (
                filteredCandidates.map((candidate) => (
                  <div
                    key={candidate.id}
                    className="border border-gray-200 rounded-2xl p-5 hover:shadow-md hover:border-emerald-300 transition cursor-pointer"
                    onClick={() => handleOpenCandidateModal(candidate)}
                  >
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-11 h-11 rounded-full bg-emerald-700 text-white font-extrabold flex items-center justify-center text-sm shadow-inner flex-shrink-0">
                        {(candidate.full_name || "C").charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-extrabold text-gray-900 text-sm truncate">{candidate.full_name || "Candidat"}</h3>
                        </div>
                        <RoleBadge role="candidat" />
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 font-semibold truncate mb-1">{candidate.headline || "Profil candidat"}</p>
                    <p className="text-[11px] text-gray-400 font-medium truncate">
                      {candidate.city || candidate.location || "Localisation non renseignée"}
                    </p>
                    {candidate.cv_url && (
                      <span className="inline-flex items-center gap-1 mt-2 text-[10px] font-extrabold text-emerald-600">
                        <i className="fa-solid fa-file-pdf"></i> CV disponible
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>

      {/* Modal Détails Candidat */}
      {selectedCandidate && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-gray-100 relative max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-full bg-emerald-800 text-white font-extrabold flex items-center justify-center text-base shadow-inner">
                  {(selectedCandidate.full_name || "C").charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-extrabold text-gray-900">{selectedCandidate.full_name || "Candidat"}</h3>
                    <RoleBadge role="candidat" />
                  </div>
                  <p className="text-xs text-gray-500 font-medium">{selectedCandidate.headline}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCandidate(null)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <span className="font-extrabold text-gray-500 uppercase tracking-wider block mb-1">À propos</span>
                <p className="text-gray-700 leading-relaxed font-medium bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                  {selectedCandidate.bio || "Aucune description complémentaire renseignée."}
                </p>
              </div>

              {Array.isArray(selectedCandidate.skills) && selectedCandidate.skills.length > 0 && (
                <div>
                  <span className="font-extrabold text-gray-500 uppercase tracking-wider block mb-1.5">Compétences</span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedCandidate.skills.map((skill, i) => (
                      <span key={i} className="px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded-lg font-bold text-[10px]">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedCandidate.cv_url && (
                <div className="pt-2">
                  <span className="font-extrabold text-gray-500 uppercase tracking-wider block mb-2">Curriculum Vitae</span>
                  {loadingCvUrl ? (
                    <p className="text-gray-400 italic">Chargement du CV sécurisé...</p>
                  ) : signedCvUrl ? (
                    <a
                      href={signedCvUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition shadow-xs"
                    >
                      <i className="fa-solid fa-file-pdf"></i>
                      <span>Ouvrir / Télécharger le CV</span>
                    </a>
                  ) : (
                    <p className="text-red-500 font-medium">Impossible de récupérer l'accès au CV.</p>
                  )}
                </div>
              )}
            </div>

            <div className="pt-6 border-t border-gray-100 mt-6 flex justify-end space-x-3">
              <button
                onClick={() => handleContactCandidate(selectedCandidate)}
                disabled={contactingId === selectedCandidate.id}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-60"
              >
                <i className="fa-solid fa-paper-plane"></i>
                <span>{contactingId === selectedCandidate.id ? "Envoi..." : "Contacter par Messagerie"}</span>
              </button>
              <button
                onClick={() => setSelectedCandidate(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-4 text-center text-xs font-medium text-gray-500">
        © 2026 Facilite - Espace Recruteur Sécurisé.
      </footer>
    </div>
  );
}

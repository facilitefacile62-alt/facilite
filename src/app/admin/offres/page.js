/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase, handleGlobalSignOut } from "@/lib/supabase";
import RoleBadge from "@/components/RoleBadge";

const EMPTY_OFFER = {
  title: "",
  company: "",
  location: "",
  contract_type: "CDI",
  salary_range: "",
  min_education_level: "Aucun",
  description: "",
  image_url: "",
  deadline: "",
};

export default function AdminOffresPage() {
  const router = useRouter();
  const [userSession, setUserSession] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);

  const [allOffers, setAllOffers] = useState([]);
  
  const [offerForm, setOfferForm] = useState(EMPTY_OFFER);
  const [offerImageFile, setOfferImageFile] = useState(null);
  const [offerImagePreview, setOfferImagePreview] = useState(null);
  const [savingOffer, setSavingOffer] = useState(false);
  const [isPosting, setIsPosting] = useState(false); // To show/hide the form

  const [toast, setToast] = useState("");
  const triggerToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  async function loadAdminData() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        window.location.replace("/login");
        return;
      }

      const { data: userRoleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        .single();

      if (!userRoleRow || userRoleRow.role !== "admin") {
        window.location.replace("/");
        return;
      }
      setUserRole(userRoleRow.role);
      setUserSession(session);

      // Fetch all offers
      const { data: offersData, error } = await supabase
        .from("job_offers")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error) {
        setAllOffers(offersData || []);
      }
    } catch (err) {
      console.error("Exception loading admin offres:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleOfferImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setOfferImageFile(file);
      setOfferImagePreview(URL.createObjectURL(file));
    }
  };

  const handleRemoveOfferImage = () => {
    setOfferImageFile(null);
    setOfferImagePreview(null);
    setOfferForm((prev) => ({ ...prev, image_url: "" }));
  };

  const handleSubmitOffer = async (e) => {
    e.preventDefault();
    if (!userSession?.user?.id) return;
    setSavingOffer(true);

    try {
      let imageUrl = offerForm.image_url || "";

      if (offerImageFile) {
        const ext = offerImageFile.name.split(".").pop().toLowerCase();
        const storagePath = `${userSession.user.id}/admin-offers-${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("job-offers")
          .upload(storagePath, offerImageFile, { contentType: offerImageFile.type });

        if (uploadError) {
          triggerToast("Erreur lors du téléversement de l'image.");
          console.error("Storage upload error:", uploadError);
          setSavingOffer(false);
          return;
        }

        const { data: publicUrlData } = supabase.storage.from("job-offers").getPublicUrl(storagePath);
        imageUrl = publicUrlData?.publicUrl || "";
      }

      const payload = { ...offerForm, image_url: imageUrl, deadline: offerForm.deadline || null, status: 'approved' }; // Direct approval for admin

      const { data, error } = await supabase
        .from("job_offers")
        .insert({ ...payload, recruiter_id: userSession.user.id })
        .select()
        .single();

      if (error) {
        triggerToast("Erreur lors de la publication de l'offre.");
        console.error(error);
      } else {
        setAllOffers((prev) => [data, ...prev]);
        triggerToast("Offre publiée avec succès !");
        setOfferForm(EMPTY_OFFER);
        setOfferImageFile(null);
        setOfferImagePreview(null);
        setIsPosting(false);
      }
    } catch (err) {
      triggerToast("Une erreur est survenue.");
      console.error(err);
    } finally {
      setSavingOffer(false);
    }
  };

  const handleToggleOfferActive = async (offer) => {
    const nextActive = !offer.is_active;

    const { error } = await supabase
      .from("job_offers")
      .update({ is_active: nextActive, updated_at: new Date().toISOString() })
      .eq("id", offer.id);

    if (error) {
      triggerToast("Erreur modification statut.");
      return;
    }
    setAllOffers((prev) => prev.map((o) => (o.id === offer.id ? { ...o, is_active: nextActive } : o)));
    triggerToast(nextActive ? "Offre réactivée." : "Offre désactivée.");
  };

  const handleDeleteOffer = async (offerId) => {
    if (!window.confirm("Archiver définitivement cette offre ?")) return;
    const { error } = await supabase.from("job_offers").update({ status: 'archived', is_active: false }).eq("id", offerId);
    
    if (error) {
      triggerToast("Erreur lors de l'archivage.");
      return;
    }
    setAllOffers((prev) => prev.map((o) => (o.id === offerId ? { ...o, status: 'archived', is_active: false } : o)));
    triggerToast("Offre archivée.");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF6F1] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-bold text-gray-700">Chargement des Offres...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF6F1] font-sans flex flex-col">
      {/* Toast */}
      {toast && (
        <div className="fixed top-20 right-4 z-[700] bg-gray-900 text-white px-5 py-3 rounded-2xl shadow-2xl animate-fade-in-down">
          <span className="text-sm font-semibold">{toast}</span>
        </div>
      )}

      {/* HEADER TIRE DU DASHBOARD ADMIN */}
      <header className="bg-white border-b border-gray-200 fixed top-0 left-0 right-0 z-50 h-16 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-2">
              <img src="/logo.jpeg" alt="Logo Facilite" className="w-9 h-9 rounded-full object-cover shadow-sm border border-gray-200" />
              <span className="text-xl font-extrabold text-gray-900 tracking-tight hidden sm:inline">Facilite</span>
            </Link>
            <RoleBadge role={userRole} />
          </div>
          <div className="flex items-center space-x-2 sm:space-x-4">
            <Link
              href="/admin"
              className="text-xs font-bold text-gray-700 hover:text-amber-700 bg-gray-100 hover:bg-amber-50 px-3 py-2 rounded-xl transition flex items-center space-x-1.5"
            >
              <i className="fa-solid fa-arrow-left"></i>
              <span className="hidden md:inline">Retour Admin</span>
            </Link>
            <button
              onClick={handleGlobalSignOut}
              className="text-xs font-bold text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-xl transition flex items-center space-x-1"
            >
              <i className="fa-solid fa-right-from-bracket"></i>
              <span className="hidden md:inline">Déconnexion</span>
            </button>
          </div>
        </div>
      </header>

      {/* CONTENU PRINCIPAL */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-8 flex-1 w-full">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
              Gestion des Offres d'Emploi
            </h1>
            <p className="text-sm text-gray-500 font-medium mt-1">Gérez le fil d'actualité et ajoutez de nouvelles offres.</p>
          </div>
          <button
            onClick={() => setIsPosting(!isPosting)}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-sm rounded-xl transition shadow-md"
          >
            {isPosting ? "Fermer le formulaire" : "+ Poster une offre"}
          </button>
        </div>

        {/* FORMULAIRE DE PUBLICATION */}
        {isPosting && (
          <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 sm:p-8 mb-8 animate-fade-in-down">
            <h2 className="text-lg font-extrabold text-gray-900 mb-6">Nouvelle Offre d'Emploi</h2>
            <form onSubmit={handleSubmitOffer} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Titre du poste *</label>
                  <input
                    type="text"
                    
                    value={offerForm.title}
                    onChange={(e) => setOfferForm({ ...offerForm, title: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:border-amber-500 transition"
                    placeholder="Ex: Développeur React"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Entreprise *</label>
                  <input
                    type="text"
                    
                    value={offerForm.company}
                    onChange={(e) => setOfferForm({ ...offerForm, company: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:border-amber-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Lieu *</label>
                  <input
                    type="text"
                    
                    value={offerForm.location}
                    onChange={(e) => setOfferForm({ ...offerForm, location: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:border-amber-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Type de contrat</label>
                  <select
                    value={offerForm.contract_type}
                    onChange={(e) => setOfferForm({ ...offerForm, contract_type: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:border-amber-500 transition"
                  >
                    <option value="CDI">CDI</option>
                    <option value="CDD">CDD</option>
                    <option value="Stage">Stage</option>
                    <option value="Freelance">Freelance</option>
                    <option value="Intérim">Intérim</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Date limite (optionnel)</label>
                  <input
                    type="date"
                    value={offerForm.deadline}
                    onChange={(e) => setOfferForm({ ...offerForm, deadline: e.target.value })}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:border-amber-500 transition"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Description *</label>
                <textarea
                  
                  rows={4}
                  value={offerForm.description}
                  onChange={(e) => setOfferForm({ ...offerForm, description: e.target.value })}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:border-amber-500 transition"
                  placeholder="Décrivez les missions, le profil recherché..."
                ></textarea>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-2">Image d'illustration (optionnel)</label>
                <div className="flex items-center space-x-4">
                  {(offerImagePreview || offerForm.image_url) && (
                    <div className="relative w-24 h-24 rounded-xl border-2 border-gray-100 overflow-hidden shrink-0">
                      <img src={offerImagePreview || offerForm.image_url} alt="Aperçu" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={handleRemoveOfferImage}
                        className="absolute top-1 right-1 w-6 h-6 bg-white/90 text-red-600 rounded-full flex items-center justify-center shadow-sm"
                      >
                        <i className="fa-solid fa-xmark text-xs"></i>
                      </button>
                    </div>
                  )}
                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      id="admin-offer-image"
                      onChange={handleOfferImageChange}
                      className="hidden"
                    />
                    <label
                      htmlFor="admin-offer-image"
                      className="inline-flex items-center justify-center px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition cursor-pointer border border-gray-200"
                    >
                      <i className="fa-solid fa-camera mr-2"></i> Choisir une image
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4 border-t border-gray-100">
                <button
                  type="submit"
                  disabled={savingOffer}
                  className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-extrabold rounded-xl transition shadow-md"
                >
                  {savingOffer ? "Publication en cours..." : "Publier l'offre"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* LISTE DES OFFRES */}
        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
           <div className="p-6 border-b border-gray-200 flex justify-between items-center">
             <div>
               <h2 className="text-lg font-extrabold text-gray-900">Toutes les offres ({allOffers.length})</h2>
               <p className="text-xs text-gray-500 font-medium mt-0.5">Offres dynamiques provenant de la base de données</p>
             </div>
           </div>
           
           {allOffers.length === 0 ? (
             <div className="p-12 text-center text-gray-400 italic text-sm">
               Aucune offre d'emploi trouvée dans la base de données.
             </div>
           ) : (
             <div className="divide-y divide-gray-100">
               {allOffers.map((offer) => (
                 <div key={offer.id} className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-gray-50 transition">
                   <div className="flex items-start space-x-4">
                     <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                       <i className="fa-solid fa-briefcase"></i>
                     </div>
                     <div>
                       <div className="flex flex-wrap items-center gap-2 mb-1">
                         <h3 className="text-sm font-extrabold text-gray-900">{offer.title}</h3>
                         {!offer.is_active && (
                           <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-600">Désactivée</span>
                         )}
                         {offer.status === 'archived' && (
                           <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600">Archivée</span>
                         )}
                       </div>
                       <p className="text-xs font-bold text-gray-600">{offer.company}</p>
                       <p className="text-[11px] text-gray-400 mt-1 flex items-center">
                         <i className="fa-solid fa-location-dot mr-1"></i> {offer.location}
                         <span className="mx-2">•</span>
                         <i className="fa-regular fa-clock mr-1"></i> Ajoutée le {new Date(offer.created_at).toLocaleDateString("fr-FR")}
                       </p>
                     </div>
                   </div>
                   <div className="flex items-center gap-2 shrink-0">
                     <button
                       onClick={() => handleToggleOfferActive(offer)}
                       className={`w-9 h-9 rounded-xl flex items-center justify-center transition border ${offer.is_active ? 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100' : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'}`}
                       title={offer.is_active ? "Désactiver" : "Activer"}
                     >
                       <i className={`fa-solid ${offer.is_active ? 'fa-eye' : 'fa-eye-slash'}`}></i>
                     </button>
                     <button
                       onClick={() => handleDeleteOffer(offer.id)}
                       disabled={offer.status === 'archived'}
                       className="w-9 h-9 rounded-xl bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 flex items-center justify-center transition disabled:opacity-50"
                       title="Archiver l'offre"
                     >
                       <i className="fa-regular fa-trash-can"></i>
                     </button>
                   </div>
                 </div>
               ))}
             </div>
           )}
        </div>
      </main>
    </div>
  );
}

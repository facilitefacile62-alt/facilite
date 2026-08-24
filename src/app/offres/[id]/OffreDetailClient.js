"use client";

import { useState, useEffect } from "react";
import { TexteAvecLiens } from "@/lib/liens";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import ApplyModal from "@/components/ApplyModal";
import BadgeDisplay from "@/components/BadgeDisplay";
import SocialShareButtons from "@/components/SocialShareButtons";
import OfferImageWatermark from "@/components/OfferImageWatermark";

export default function OffreDetailClient({ initialOffer }) {
  const router = useRouter();
  const [offer, setOffer] = useState(initialOffer);
  const [userId, setUserId] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [applyOpen, setApplyOpen] = useState(false);
  const [toast, setToast] = useState("");

  // Status states
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);

  // Form states
  const [title, setTitle] = useState(initialOffer.title || "");
  const [company, setCompany] = useState(initialOffer.company || "");
  const [location, setLocation] = useState(initialOffer.location || "");
  const [contractType, setContractType] = useState(initialOffer.contract_type || "CDI");
  const [minEducationLevel, setMinEducationLevel] = useState(initialOffer.min_education_level || "Aucun");
  const [salaryRange, setSalaryRange] = useState(initialOffer.salary_range || "");
  const [description, setDescription] = useState(initialOffer.description || "");
  const [imageUrl, setImageUrl] = useState(initialOffer.image_url || "");
  const [contactEmail, setContactEmail] = useState(initialOffer.contact_email || "");
  const [externalLink, setExternalLink] = useState(initialOffer.external_link || "");

  const [accessToken, setAccessToken] = useState(null);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  useEffect(() => {
    async function loadSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setUserId(session.user.id);
        setAccessToken(session.access_token);
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .single();
        if (roleData) {
          setUserRole(roleData.role);
        }
      }

      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        if (params.get("apply") === "1" || params.get("postuler") === "1") {
          setApplyOpen(true);
        }
      }
    }
    loadSession();
  }, []);

  const isOwner = userId && userId === offer.recruiter_id;
  const isAdmin = userRole === "admin";
  const canManage = isOwner || isAdmin;

  const [uploading, setUploading] = useState(false);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/png", "image/jpeg", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      alert("Format d'image non supporté (seuls PNG, JPEG et WebP sont acceptés).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("L'image est trop volumineuse (maximum 5 Mo).");
      return;
    }

    if (!userId) {
      alert("Session expirée. Veuillez vous reconnecter.");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop().toLowerCase();
      const storagePath = `${userId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("job-offers")
        .upload(storagePath, file, {
          upsert: true,
          contentType: file.type,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("job-offers")
        .getPublicUrl(storagePath);

      setImageUrl(publicUrlData?.publicUrl || "");
    } catch (err) {
      console.error("Erreur upload:", err);
      alert("Erreur lors du téléversement de l'image : " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    // Revert form states to match the current offer state
    setTitle(offer.title || "");
    setCompany(offer.company || "");
    setLocation(offer.location || "");
    setContractType(offer.contract_type || "CDI");
    setMinEducationLevel(offer.min_education_level || "Aucun");
    setSalaryRange(offer.salary_range || "");
    setDescription(offer.description || "");
    setImageUrl(offer.image_url || "");
    setContactEmail(offer.contact_email || "");
    setExternalLink(offer.external_link || "");
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!title.trim() || !company.trim() || !location.trim() || !description.trim()) {
      alert("Veuillez remplir tous les champs obligatoires (Titre, Entreprise, Localisation, Description).");
      return;
    }

    setSaving(true);
    const { data, error } = await supabase
      .from("job_offers")
      .update({
        title: title.trim(),
        company: company.trim(),
        location: location.trim(),
        contract_type: contractType,
        min_education_level: minEducationLevel,
        salary_range: salaryRange.trim() || null,
        description: description.trim(),
        image_url: imageUrl.trim() || null,
        contact_email: contactEmail.trim() || null,
        external_link: externalLink.trim() || null,
      })
      .eq("id", offer.id)
      .select()
      .single();

    if (error) {
      alert("Erreur lors de l'enregistrement de l'offre : " + error.message);
      setSaving(false);
      return;
    }

    // Attempt to trigger recalculation of semantic embeddings
    try {
      await fetch(`/api/recruteur/offres/${offer.id}/embedding`, {
        method: "POST",
        headers: accessToken ? {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        } : {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim()
        })
      });
    } catch (err) {
      console.error("Erreur recalcul embedding:", err);
    }

    setOffer(data);
    setIsEditing(false);
    setSaving(false);
    router.refresh();
  };

  const handleDelete = async () => {
    const confirmation = window.confirm("Êtes-vous sûr de vouloir supprimer / archiver cette offre d'emploi ?");
    if (!confirmation) return;

    setArchiving(true);
    const { data: success, error } = await supabase.rpc("archive_own_job_offer", {
      offer_id: offer.id,
    });

    if (error || !success) {
      alert("Erreur lors de la suppression de l'offre : " + (error?.message || "Échec de l'archivage"));
      setArchiving(false);
      return;
    }

    alert("L'offre d'emploi a été supprimée avec succès.");
    router.push("/offres");
  };

  return (
    <div className="min-h-screen bg-[#FAF6F1] font-sans flex flex-col">
      <header className="bg-white border-b border-gray-200 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center">
          <Link href="/offres" className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition">
            <i className="fa-solid fa-arrow-left"></i>
            <span className="text-sm font-bold">Toutes les offres</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8">
        <div className="bg-white rounded-3xl border border-gray-200 shadow-xs overflow-hidden">
          {/* S'il n'est pas en cours d'édition, on affiche l'image de l'offre (Style Facebook propre) */}
          {!isEditing && offer.image_url && (
            <div className="relative w-full rounded-2xl overflow-hidden bg-gray-900/90 dark:bg-black/90 flex items-center justify-center min-h-[260px] sm:min-h-[380px] max-h-[580px]">
              <img
                src={offer.image_url}
                alt={offer.title}
                className="w-full h-auto max-h-[580px] object-contain mx-auto block"
                loading="lazy"
              />
              <OfferImageWatermark />
            </div>
          )}

          <div className="p-6 sm:p-8">
            {isEditing ? (
              <div className="space-y-6">
                <h2 className="text-xl font-bold text-gray-900 border-b pb-3">Modifier l'offre d'emploi</h2>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Titre de l'offre *</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                      placeholder="Ex. Développeur Full-Stack"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Nom de l'entreprise *</label>
                    <input
                      type="text"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                      placeholder="Ex. Tech Solutions Inc."
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Localisation *</label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                      placeholder="Ex. Dakar, Sénégal"
                      required
                    />
                  </div>


                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Type de contrat</label>
                    <select
                      value={contractType}
                      onChange={(e) => setContractType(e.target.value)}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                    >
                      <option value="CDI">CDI</option>
                      <option value="CDD">CDD</option>
                      <option value="Stage">Stage</option>
                      <option value="Freelance">Freelance</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Niveau d'étude requis</label>
                    <select
                      value={minEducationLevel}
                      onChange={(e) => setMinEducationLevel(e.target.value)}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                    >
                      <option value="Aucun">Aucun exigé</option>
                      <option value="CM2">CM2</option>
                      <option value="Brevet">Brevet / BEPC</option>
                      <option value="BAC">BAC</option>
                      <option value="Licence">Licence / Bachelor</option>
                      <option value="Master">Master</option>
                      <option value="Doctorat">Doctorat</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Email de contact (optionnel)</label>
                    <input
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                      placeholder="Ex. contact@entreprise.com"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Lien de candidature externe (optionnel)</label>
                    <input
                      type="url"
                      value={externalLink}
                      onChange={(e) => setExternalLink(e.target.value)}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                      placeholder="Ex. https://entreprise.com/apply"
                    />
                  </div>
                </div>

                <div className="border border-gray-100 bg-gray-50/50 rounded-2xl p-4 space-y-4">
                  <label className="block text-xs font-bold text-gray-700">Affiche / Image de l'offre</label>
                  
                  {imageUrl ? (
                    <div className="flex items-center gap-4 bg-white p-3 rounded-xl border border-gray-100">
                      <img
                        src={imageUrl}
                        alt="Affiche de l'offre"
                        className="h-24 w-auto object-contain rounded-lg border bg-gray-50"
                      />
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-gray-800">Une image est actuellement définie</p>
                        <p className="text-[10px] text-gray-400 break-all max-w-md">{imageUrl}</p>
                        <div className="flex items-center gap-2 pt-1 flex-wrap">
                          <label className="cursor-pointer px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 hover:text-emerald-800 text-xs font-bold rounded-lg transition inline-flex items-center gap-1.5 border border-emerald-200/50">
                            {uploading ? (
                              <>
                                <i className="fa-solid fa-spinner animate-spin"></i>
                                Téléversement...
                              </>
                            ) : (
                              <>
                                <i className="fa-solid fa-rotate"></i>
                                Remplacer la photo
                              </>
                            )}
                            <input
                              type="file"
                              accept="image/png, image/jpeg, image/webp"
                              onChange={handleImageUpload}
                              disabled={uploading}
                              className="hidden"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => setImageUrl("")}
                            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 text-xs font-bold rounded-lg transition flex items-center gap-1.5 border border-rose-200/50"
                          >
                            <i className="fa-solid fa-trash text-sm"></i>
                            Supprimer cette photo
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white p-6 rounded-xl border border-gray-100 border-dashed text-center text-gray-500 py-8 flex flex-col items-center justify-center">
                      <i className="fa-regular fa-image text-4xl mb-3 text-gray-300"></i>
                      <p className="text-xs font-bold mb-1">Aucune image définie</p>
                      <p className="text-[10px] text-gray-400 mb-4">Ajoutez une image depuis votre ordinateur ou collez un lien ci-dessous</p>
                      <label className="cursor-pointer px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition inline-flex items-center gap-1.5 shadow-sm disabled:opacity-50">
                        {uploading ? (
                          <>
                            <i className="fa-solid fa-spinner animate-spin"></i>
                            Téléversement...
                          </>
                        ) : (
                          <>
                            <i className="fa-solid fa-upload"></i>
                            Téléverser une image
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/png, image/jpeg, image/webp"
                          onChange={handleImageUpload}
                          disabled={uploading}
                          className="hidden"
                        />
                      </label>
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 mb-1">Lien de l'image / affiche (optionnel)</label>
                    <input
                      type="text"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                      placeholder="Collez ici l'URL de votre image (ex. https://...)"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">Description de l'offre *</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={12}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:border-emerald-500 focus:bg-white transition whitespace-pre-wrap leading-relaxed font-sans"
                    placeholder="Saisissez la description complète de l'offre d'emploi..."
                    required
                  ></textarea>
                </div>

                <div className="flex items-center gap-3 pt-4 border-t">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition flex items-center gap-2 disabled:opacity-50"
                  >
                    {saving ? (
                      <>
                        <i className="fa-solid fa-spinner animate-spin"></i>
                        Enregistrement...
                      </>
                    ) : (
                      "Enregistrer"
                    )}
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={saving}
                    className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold rounded-xl transition disabled:opacity-50"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-start gap-4 mb-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider bg-blue-100 text-blue-700">
                      {offer.contract_type}
                    </span>
                    {offer.min_education_level && offer.min_education_level !== "Aucun" && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider bg-purple-100 text-purple-700">
                        🎓 {offer.min_education_level}
                      </span>
                    )}
                  </div>

                  {canManage && (
                    <div className="flex items-center gap-2 shrink-0 bg-gray-50 border border-gray-200 rounded-xl p-1 shadow-sm">
                      <button
                        onClick={() => setIsEditing(true)}
                        className="text-gray-400 hover:text-emerald-600 transition p-1.5 hover:bg-white rounded-lg"
                        title="Modifier l'offre"
                      >
                        <i className="fa-solid fa-pen text-sm"></i>
                      </button>
                      <button
                        onClick={handleDelete}
                        disabled={archiving}
                        className="text-gray-400 hover:text-rose-600 transition p-1.5 hover:bg-white rounded-lg disabled:opacity-50"
                        title="Supprimer l'offre"
                      >
                        <i className="fa-solid fa-trash text-sm"></i>
                      </button>
                    </div>
                  )}
                </div>

                <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-2">{offer.title}</h1>
                
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <p className="text-base font-bold text-gray-600">{offer.company}</p>
                  {offer.recruiterVerified && <BadgeDisplay badges={["verified_recruiter"]} />}
                </div>

                <div className="space-y-2 mb-6 text-sm text-gray-500 font-medium">
                  <div className="flex items-center gap-2">
                    <i className="fa-solid fa-location-dot text-emerald-600 w-4 text-center"></i>
                    <span>{offer.location}</span>
                  </div>
                  {offer.deadline && (
                    <div className="flex items-center gap-2 text-red-600 font-bold">
                      <i className="fa-regular fa-calendar-xmark text-red-600 w-4 text-center"></i>
                      <span>
                        Date limite : {new Date(offer.deadline).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                      </span>
                    </div>
                  )}
                  {offer.contact_email && (
                    <div className="flex items-center gap-2">
                      <i className="fa-solid fa-envelope text-emerald-600 w-4 text-center"></i>
                      <span>
                        Contact : <a href={`mailto:${offer.contact_email}`} className="text-emerald-700 hover:underline font-semibold">{offer.contact_email}</a>
                      </span>
                    </div>
                  )}
                  {offer.external_link && (
                    <div className="flex items-center gap-2">
                      <i className="fa-solid fa-link text-emerald-600 w-4 text-center"></i>
                      <span>
                        Lien externe : <a href={offer.external_link} target="_blank" rel="noopener noreferrer" className="text-emerald-700 hover:underline font-semibold">{offer.external_link}</a>
                      </span>
                    </div>
                  )}
                </div>

                {/* Toast Notification */}
                {toast && (
                  <div className="fixed top-20 right-4 z-[700] bg-gray-900 text-white px-5 py-3 rounded-2xl shadow-2xl animate-fade-in flex items-center gap-2">
                    <i className="fa-solid fa-circle-check text-emerald-400"></i>
                    <span className="text-sm font-semibold">{toast}</span>
                  </div>
                )}

                {/* Barre d'Actions Alignée : [ 👍 J'aime ] [ 📤 Partager ] [ ✈️ Postuler via Facilité ] [ 🔖 Enregistrer ] */}
                <SocialShareButtons
                  offer={{
                    ...offer,
                    titleFR: offer.title,
                    titleEN: offer.title,
                    description: offer.description,
                    descFR: offer.description,
                    contact_email: offer.contact_email,
                    recruiterEmail: offer.contact_email,
                    external_link: offer.external_link,
                    externalLink: offer.external_link,
                  }}
                  variant="feed"
                  onApply={() => setApplyOpen(true)}
                  onToast={(msg) => setToast(msg)}
                  className="my-6"
                />

                {/* Description de l'offre (Lisibilité 100% nette sans dégradé masquant) */}
                <div className="my-6 bg-gray-50/70 dark:bg-gray-800/40 p-5 rounded-2xl border border-gray-200/80 dark:border-gray-700">
                  <h3 className="text-xs font-black text-gray-900 dark:text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                    <i className="fa-solid fa-file-lines text-emerald-600"></i>
                    <span>Détails & Description du poste</span>
                  </h3>
                  
                  <div className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-line leading-relaxed font-normal">
                    {(() => {
                      const fullText = offer.description || "";
                      const shouldTruncate = fullText.length > 400;
                      const displayText = shouldTruncate && !isDescriptionExpanded
                        ? fullText.substring(0, 400) + "..."
                        : fullText;

                      return (
                        <>
                          {/* Sous-point 3 : les URL de la description
                              étaient rendues en texte nu, non cliquables, et
                              débordaient horizontalement de la carte (aucun
                              break-words sur cette page). TexteAvecLiens
                              conserve les sauts de ligne, rend chaque URL et
                              chaque e-mail cliquables, et coupe l'AFFICHAGE
                              sans jamais tronquer le href. */}
                          <TexteAvecLiens
                            texte={displayText}
                            className="block text-gray-900 dark:text-gray-100 leading-relaxed"
                          />
                          {shouldTruncate && (
                            <div className="pt-3">
                              <button
                                type="button"
                                onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                                className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-blue-600 dark:text-blue-400 font-extrabold text-xs rounded-xl shadow-xs border border-gray-200 dark:border-gray-700 transition cursor-pointer"
                              >
                                <span>{isDescriptionExpanded ? "Voir moins" : "... Voir plus"}</span>
                                <i className={`fa-solid ${isDescriptionExpanded ? "fa-chevron-up" : "fa-chevron-down"} text-[10px]`}></i>
                              </button>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Informations complémentaires (sous-points 2 et 3) :
                    documents à fournir, liens annexes, précisions
                    logistiques. Volontairement SÉPARÉ de la description et
                    de l'adresse de candidature — rien de ce qui est ici
                    n'est utilisé comme destination du bouton Postuler. */}
                {offer.additional_info && (
                  <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-5 sm:p-6 shadow-xs">
                    <h3 className="text-sm font-black text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-3">
                      <i className="fa-solid fa-circle-info text-blue-600"></i>
                      <span>Informations complémentaires</span>
                    </h3>
                    <TexteAvecLiens
                      texte={offer.additional_info}
                      className="block text-sm text-gray-800 dark:text-gray-200 leading-relaxed"
                    />
                  </div>
                )}

                {/* Modale de Candidature Rapide Facilité */}
                <ApplyModal
                  isOpen={applyOpen}
                  onClose={() => setApplyOpen(false)}
                  job={{
                    ...offer,
                    titleFR: offer.title,
                    titleEN: offer.title,
                    recruiterEmail: offer.contact_email,
                    contact_email: offer.contact_email,
                  }}
                  selectedLang="FR"
                  triggerToast={(msg) => {
                    setToast(msg);
                    setTimeout(() => setToast(""), 3500);
                  }}
                />
              </>
            )}
          </div>
        </div>
      </main>

      <footer className="bg-white border-t border-gray-200 py-4 text-center text-xs font-medium text-gray-500">
        © 2026 Facilite. Toutes les offres d'emploi.
      </footer>
    </div>
  );
}

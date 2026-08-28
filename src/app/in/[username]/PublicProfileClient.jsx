"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { supabase, getSignedAvatarUrl, getSignedCoverUrl } from "@/lib/supabase";

export default function PublicProfilePage() {
  const params = useParams();
  const router = useRouter();
  const username = params?.username;

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (!username) return;

    async function fetchPublicProfile() {
      setLoading(true);
      try {
        const decoded = decodeURIComponent(username).toLowerCase();

        // Toutes les lectures passent par la vue profils_publics, jamais par
        // la table profiles : la vue ne projette que les colonnes publiques
        // et ne renvoie que les profils dont le propriétaire a activé la
        // publication (is_public). La table, elle, reste privée.

        // 1. Recherche par slug
        let { data } = await supabase
          .rpc("get_profils_publics")
          .select("*")
          .eq("slug", decoded)
          .maybeSingle();

        // 2. Si pas trouvé par slug, recherche par ID
        if (!data) {
          const { data: idData } = await supabase
            .rpc("get_profils_publics")
            .select("*")
            .eq("id", decoded)
            .maybeSingle();
          data = idData;
        }

        // 3. Si pas trouvé, recherche partielle par full_name.
        // Le filtre .ilike est indispensable : un `.limit(1)` SANS filtre
        // renvoyait auparavant un profil arbitraire, affichant les données d'un
        // inconnu sous l'identité demandée. Si rien ne correspond désormais,
        // la page affiche "Profil introuvable".
        if (!data) {
          const { data: nameData } = await supabase
            .rpc("get_profils_publics")
            .select("*")
            .ilike("full_name", `%${decoded}%`)
            .limit(1);
          if (nameData && nameData.length > 0) {
            data = nameData[0];
          }
        }

        if (data) {
          // Résolution AVANT setLoading(false) : la garde "loading" plus bas
          // empêche déjà tout flash, autant en profiter pour ne jamais
          // afficher un chemin Storage brut ni relancer un second rendu.
          const [resolvedAvatarUrl, resolvedCoverUrl] = await Promise.all([
            getSignedAvatarUrl(data.avatar_url),
            getSignedCoverUrl(data.cover_url),
          ]);
          setProfile({
            ...data,
            avatar_url: resolvedAvatarUrl || data.avatar_url,
            cover_url: resolvedCoverUrl || data.cover_url,
          });
        }
      } catch (err) {
        console.error("Erreur chargement profil public:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchPublicProfile();
  }, [username]);

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF6F1] flex flex-col items-center justify-center p-6 font-sans">
        <div className="w-14 h-14 rounded-2xl bg-blue-600/10 text-blue-600 flex items-center justify-center text-2xl animate-spin mb-4">
          <i className="fa-solid fa-spinner"></i>
        </div>
        <p className="text-sm font-extrabold text-gray-700 tracking-tight">Chargement du profil public Facilité...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#FAF6F1] flex flex-col items-center justify-center p-6 font-sans text-center">
        <div className="w-20 h-20 rounded-3xl bg-gray-200/80 text-gray-500 flex items-center justify-center text-3xl mb-4 shadow-sm">
          <i className="fa-solid fa-user-slash"></i>
        </div>
        <h1 className="text-2xl font-black text-gray-900 tracking-tight mb-2">Profil introuvable</h1>
        <p className="text-xs text-gray-600 font-semibold max-w-md mb-6">
          Le profil public <span className="font-extrabold text-blue-600">"{username}"</span> n'existe pas encore ou a été modifié.
        </p>
        <Link
          href="/"
          className="px-6 py-3 bg-[#10E688] hover:bg-[#0ed37c] text-gray-900 font-extrabold rounded-2xl text-xs transition shadow-md flex items-center space-x-2"
        >
          <i className="fa-solid fa-house text-xs"></i>
          <span>Retourner à l'accueil Facilité</span>
        </Link>
      </div>
    );
  }

  const fullName = profile.full_name || "Membre Facilité";
  const headline = profile.headline || "Professionnel | Créateur de contenu";
  const city = profile.city || profile.location || "Sénégal";
  const bio = profile.bio || "Aucune biographie rédigée pour le moment.";
  const avatarUrl = profile.avatar_url;
  const coverUrl = profile.cover_url;
  const pinnedDetails = Array.isArray(profile.pinned_details) ? profile.pinned_details : [];
  const experiences = Array.isArray(profile.experiences) ? profile.experiences : [];
  const educations = Array.isArray(profile.educations) ? profile.educations : [];

  return (
    <div className="min-h-screen bg-[#FAF6F1] text-gray-900 font-sans pb-16">
      {/* HEADER NAV UNIFIÉ */}
      <header className="bg-white/95 backdrop-blur-md border-b border-gray-200/80 fixed top-0 left-0 right-0 z-50 h-16 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-3 group">
            <Image
              src="/logo.jpeg"
              alt="Logo Facilité"
              width={36}
              height={36}
              className="rounded-xl object-cover shadow-xs group-hover:scale-105 transition"
            />
            <span className="text-base font-black tracking-tight text-gray-900">
              Facilité<span className="text-[#10E688]">.sn</span>
            </span>
          </Link>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={handleCopyLink}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer flex items-center space-x-1.5 ${
                isCopied
                  ? "bg-emerald-600 text-white shadow-md"
                  : "bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200"
              }`}
            >
              <i className={`fa-solid ${isCopied ? "fa-check" : "fa-share-nodes"} text-xs`}></i>
              <span>{isCopied ? "Lien copié !" : "Partager profil"}</span>
            </button>

            <Link
              href="/importer-cv"
              className="px-4 py-2 bg-[#10E688] hover:bg-[#0ed37c] text-gray-900 font-extrabold rounded-xl text-xs transition shadow-sm"
            >
              Créer mon CV
            </Link>
          </div>
        </div>
      </header>

      {/* CONTENU PRINCIPAL DU PROFIL */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-16 space-y-6">
        
        {/* CARTE HERO : COUVERTURE & AVATAR */}
        <div className="bg-white rounded-3xl border border-gray-200/90 shadow-md overflow-hidden relative">
          
          {/* BANNIÈRE DE COUVERTURE */}
          <div className="h-44 sm:h-60 w-full relative bg-gradient-to-r from-blue-700 via-indigo-800 to-purple-900">
            {coverUrl ? (
              <Image
                src={coverUrl}
                alt="Couverture de profil"
                fill
                sizes="100vw"
                priority
                className="object-cover"
              />
            ) : (
              <div className="w-full h-full opacity-30 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]"></div>
            )}
            <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-md text-white text-[10px] font-bold px-3 py-1 rounded-full border border-white/20 flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Profil Public Certifié</span>
            </div>
          </div>

          {/* SÉPARATION AVATAR & INFOS CLÉS */}
          <div className="px-6 sm:px-8 pb-6 relative">
            <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between -mt-16 sm:-mt-20 mb-4 gap-4">
              
              {/* AVATAR */}
              <div className="relative">
                <div className="relative w-32 h-32 sm:w-36 sm:h-36 rounded-3xl border-4 border-white shadow-xl overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-black text-3xl flex items-center justify-center uppercase">
                  {avatarUrl ? (
                    <Image
                      src={avatarUrl}
                      alt={fullName}
                      fill
                      sizes="144px"
                      priority
                      className="object-cover"
                    />
                  ) : (
                    fullName.slice(0, 2)
                  )}
                </div>
                <span className="absolute bottom-2 right-2 w-5 h-5 bg-emerald-500 border-2 border-white rounded-full" title="En ligne"></span>
              </div>

              {/* ACTION CTAs */}
              <div className="flex items-center space-x-2.5 w-full sm:w-auto">
                <a
                  href={`mailto:${profile.contact_email || 'contact@facilite.sn'}`}
                  className="flex-1 sm:flex-none px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-2xl text-xs transition shadow-md flex items-center justify-center space-x-2"
                >
                  <i className="fa-solid fa-paper-plane text-xs"></i>
                  <span>Contacter</span>
                </a>

                {/* Le téléchargement public du CV a été retiré volontairement :
                    le bucket "resumes" est privé et réservé à son propriétaire.
                    Exposer le CV ici publierait nom, adresse, téléphone et date
                    de naissance à tout visiteur anonyme. */}
              </div>
            </div>

            {/* IDENTITÉ */}
            <div className="space-y-1.5">
              <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight flex items-center space-x-2">
                <span>{fullName}</span>
                <i className="fa-solid fa-circle-check text-blue-600 text-lg" title="Profil vérifié"></i>
              </h1>
              <p className="text-sm sm:text-base font-extrabold text-gray-700">{headline}</p>
              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 font-semibold pt-1">
                <span className="flex items-center space-x-1 text-[#1D4ED8] font-bold">
                  <i className="fa-solid fa-location-dot"></i>
                  <span>{city}</span>
                </span>
                <span>•</span>
                <span className="flex items-center space-x-1 text-gray-600">
                  <i className="fa-solid fa-building text-emerald-600"></i>
                  <span>Facilité</span>
                </span>
              </div>
            </div>

            {/* PILULÉS ÉPINGLÉES */}
            {pinnedDetails.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-4">
                {pinnedDetails.map((detail, idx) => (
                  <span
                    key={idx}
                    className="bg-blue-50/80 text-blue-700 font-bold text-xs px-3 py-1 rounded-xl border border-blue-100 flex items-center space-x-1.5"
                  >
                    <i className="fa-solid fa-[#1D4ED8] fa-circle-info text-[10px]"></i>
                    <span>{detail}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* DOUBLE COLONNE DÉTAILS DU PROFIL */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* COLONNE GAUCHE (BIO, EXPÉRIENCES, FORMATIONS) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* CARTE BIO / À PROPOS */}
            <div className="bg-white rounded-3xl border border-gray-200/90 p-6 shadow-xs space-y-3">
              <div className="flex items-center space-x-2.5 pb-2 border-b border-gray-100">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-sm font-bold">
                  <i className="fa-solid fa-[#1D4ED8] fa-[#1D4ED8] fa-user"></i>
                </div>
                <h2 className="text-base font-extrabold text-gray-900">À propos</h2>
              </div>
              <p className="text-xs sm:text-sm text-gray-700 font-medium leading-relaxed whitespace-pre-line">
                {bio}
              </p>
            </div>

            {/* CARTE EXPÉRIENCES PROFESSIONNELLES */}
            <div className="bg-white rounded-3xl border border-gray-200/90 p-6 shadow-xs space-y-4">
              <div className="flex items-center space-x-2.5 pb-2 border-b border-gray-100">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-sm font-bold">
                  <i className="fa-solid fa-briefcase"></i>
                </div>
                <h2 className="text-base font-extrabold text-gray-900">Expériences professionnelles</h2>
              </div>

              {experiences.length > 0 ? (
                <div className="space-y-4 divide-y divide-gray-100">
                  {experiences.map((exp, idx) => (
                    <div key={exp.id ?? idx} className="pt-4 first:pt-0 flex items-start space-x-4">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-extrabold text-xs flex items-center justify-center uppercase shadow-sm flex-shrink-0">
                        {exp.company ? exp.company.slice(0, 2) : "EX"}
                      </div>
                      <div className="flex-1 space-y-1">
                        <h3 className="text-sm font-extrabold text-gray-900">{exp.title}</h3>
                        <p className="text-xs font-bold text-gray-700">{exp.company} • <span className="font-semibold text-gray-500">{exp.employmentType}</span></p>
                        <p className="text-[11px] text-gray-400 font-medium">
                          {exp.startMonth} {exp.startYear} — {exp.isCurrent ? "Présent" : "Terminé"} • {exp.location}
                        </p>
                        {exp.skills && exp.skills.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1.5">
                            {exp.skills.map((sk, idx) => (
                              <span key={idx} className="bg-blue-50 text-blue-700 font-bold text-[10px] px-2 py-0.5 rounded-full border border-blue-100">
                                • {sk}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 font-semibold py-2">Aucune expérience enregistrée pour le moment.</p>
              )}
            </div>

            {/* CARTE FORMATION & DIPLÔMES */}
            <div className="bg-white rounded-3xl border border-gray-200/90 p-6 shadow-xs space-y-4">
              <div className="flex items-center space-x-2.5 pb-2 border-b border-gray-100">
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-sm font-bold">
                  <i className="fa-solid fa-graduation-cap"></i>
                </div>
                <h2 className="text-base font-extrabold text-gray-900">Formation & Diplômes</h2>
              </div>

              {educations.length > 0 ? (
                <div className="space-y-4 divide-y divide-gray-100">
                  {educations.map((edu, idx) => (
                    <div key={edu.id ?? idx} className="pt-4 first:pt-0 flex items-start space-x-4">
                      <div className="w-11 h-11 rounded-2xl bg-purple-100 text-purple-700 font-black text-xs flex items-center justify-center uppercase shadow-xs flex-shrink-0">
                        {edu.school ? edu.school.slice(0, 2) : "FD"}
                      </div>
                      <div className="flex-1 space-y-1">
                        <h3 className="text-sm font-extrabold text-gray-900">{edu.school}</h3>
                        <p className="text-xs font-bold text-gray-700">
                          {edu.degree} {edu.field ? `• ${edu.field}` : ""}
                        </p>
                        <p className="text-[11px] text-gray-400 font-medium">
                          {edu.startYear} — {edu.isCurrent ? "Présent" : edu.endYear}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 font-semibold py-2">Aucune formation enregistrée pour le moment.</p>
              )}
            </div>
          </div>

          {/* COLONNE DROITE (COORDONNÉES & RECOMMANDATIONS) */}
          <div className="space-y-6">
            
            {/* CARTE COORDONNÉES */}
            <div className="bg-white rounded-3xl border border-gray-200/90 p-6 shadow-xs space-y-4">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider">Coordonnées de contact</h3>
              
              <div className="space-y-3.5 text-xs">
                {profile.phone && (
                  <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                      <i className="fa-solid fa-phone"></i>
                    </div>
                    <div>
                      <span className="text-[10px] text-gray-400 font-bold block uppercase">Téléphone</span>
                      <span className="font-extrabold text-gray-900">{profile.phone}</span>
                    </div>
                  </div>
                )}

                {/* contact_email et non email : l'adresse de connexion du
                    compte n'est jamais exposée publiquement. */}
                {profile.contact_email && (
                  <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                      <i className="fa-solid fa-envelope"></i>
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] text-gray-400 font-bold block uppercase">E-mail</span>
                      <span className="font-extrabold text-gray-900 truncate block">{profile.contact_email}</span>
                    </div>
                  </div>
                )}

                {profile.website_url && (
                  <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                      <i className="fa-solid fa-globe"></i>
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] text-gray-400 font-bold block uppercase">Site Web</span>
                      <a href={profile.website_url} target="_blank" rel="noreferrer" className="font-extrabold text-blue-600 truncate block hover:underline">
                        {profile.website_url}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* BADGE CERTIFICATION FACILITÉ */}
            <div className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-3xl p-6 shadow-md space-y-2">
              <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-lg">
                <i className="fa-solid fa-shield-halved"></i>
              </div>
              <h3 className="text-base font-black tracking-tight">Membre Facilité</h3>
              <p className="text-xs text-emerald-100 font-medium leading-relaxed">
                Ce profil est certifié et optimisé grâce aux modèles et services professionnels Facilité.sn.
              </p>
            </div>

          </div>

        </div>

      </main>
    </div>
  );
}

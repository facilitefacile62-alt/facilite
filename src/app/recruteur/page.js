/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase, handleGlobalSignOut, getSignedCvUrl } from "@/lib/supabase";

export default function RecruteurDashboardPage() {
  const [userSession, setUserSession] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [signedCvUrl, setSignedCvUrl] = useState(null);
  const [loadingCvUrl, setLoadingCvUrl] = useState(false);

  useEffect(() => {
    async function loadRecruiterData() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          window.location.replace("/login");
          return;
        }
        setUserSession(session);

        // Charger la liste des candidats et candidatures reçues
        const { data: profilesData, error: profilesErr } = await supabase
          .from("profiles")
          .select("*")
          .order("updated_at", { ascending: false });

        if (profilesErr) {
          console.error("Erreur chargement candidats:", profilesErr);
        } else {
          setCandidates(profilesData || []);
        }
      } catch (err) {
        console.error("Exception chargement dashboard recruteur:", err);
      } finally {
        setLoading(false);
      }
    }

    loadRecruiterData();
  }, []);

  const handleOpenCandidateModal = async (candidate) => {
    setSelectedCandidate(candidate);
    setSignedCvUrl(null);

    if (candidate.resume_url) {
      setLoadingCvUrl(true);
      const url = await getSignedCvUrl(candidate.resume_url);
      setSignedCvUrl(url);
      setLoadingCvUrl(false);
    }
  };

  const filteredCandidates = candidates.filter((c) => {
    const q = searchQuery.toLowerCase();
    return (
      (c.full_name || "").toLowerCase().includes(q) ||
      (c.email || "").toLowerCase().includes(q) ||
      (c.title || "").toLowerCase().includes(q)
    );
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
      {/* Header Nav */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-2">
              <img src="/logo.jpeg" alt="Logo Facilite" className="w-9 h-9 rounded-full object-cover shadow-sm border border-gray-200" />
              <span className="text-xl font-extrabold text-gray-900 tracking-tight">Facilite</span>
            </Link>
            <span className="text-xs font-extrabold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-full uppercase tracking-wider">
              💼 Espace Recruteur
            </span>
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
        {/* Banner Section */}
        <div className="bg-gradient-to-r from-emerald-800 to-teal-900 rounded-3xl p-6 sm:p-8 text-white mb-8 shadow-xl relative overflow-hidden">
          <div className="relative z-10 max-w-2xl">
            <span className="text-xs font-extrabold text-emerald-300 uppercase tracking-widest block mb-2">
              Tableau de bord Recrutement
            </span>
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight mb-3">
              Gestion des Candidatures & Profils
            </h1>
            <p className="text-sm text-emerald-100 font-medium leading-relaxed">
              Consultez les candidatures reçues, visualisez les CV des candidats et échangez directement avec les meilleurs talents.
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Total Candidats</span>
              <span className="text-2xl font-extrabold text-gray-900">{candidates.length}</span>
            </div>
            <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center text-xl">
              <i className="fa-solid fa-users"></i>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">CV Disponibles</span>
              <span className="text-2xl font-extrabold text-emerald-600">
                {candidates.filter(c => c.resume_url).length}
              </span>
            </div>
            <div className="w-12 h-12 bg-blue-100 text-blue-700 rounded-2xl flex items-center justify-center text-xl">
              <i className="fa-solid fa-file-pdf"></i>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Candidatures IA</span>
              <span className="text-2xl font-extrabold text-purple-600">Actif</span>
            </div>
            <div className="w-12 h-12 bg-purple-100 text-purple-700 rounded-2xl flex items-center justify-center text-xl">
              <i className="fa-solid fa-robot"></i>
            </div>
          </div>
        </div>

        {/* Filter and Candidate List */}
        <div className="bg-white rounded-3xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="p-6 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-extrabold text-gray-900">Base de Candidats</h2>
              <p className="text-xs text-gray-500 font-medium">Recherchez et filtrez les profils disponibles</p>
            </div>
            <div className="relative max-w-xs w-full">
              <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-3.5 text-gray-400 text-xs"></i>
              <input
                type="text"
                placeholder="Rechercher par nom, email, titre..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-emerald-500 focus:bg-white transition"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-extrabold text-gray-500 uppercase tracking-wider">
                  <th className="py-4 px-6">Candidat</th>
                  <th className="py-4 px-6">Email</th>
                  <th className="py-4 px-6">Rôle</th>
                  <th className="py-4 px-6">CV</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs font-medium">
                {filteredCandidates.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-8 text-center text-gray-400 italic">
                      Aucun candidat trouvé.
                    </td>
                  </tr>
                ) : (
                  filteredCandidates.map((candidate) => (
                    <tr key={candidate.id} className="hover:bg-emerald-50/40 transition">
                      <td className="py-4 px-6 flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-full bg-emerald-700 text-white font-extrabold flex items-center justify-center text-xs shadow-inner">
                          {(candidate.full_name || "C").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-bold text-gray-900 block">{candidate.full_name || "Candidat Anonyme"}</span>
                          <span className="text-[10px] text-gray-400 font-normal">{candidate.title || "Profil Candidat"}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-gray-600">{candidate.email || "Non renseigné"}</td>
                      <td className="py-4 px-6">
                        <span className="inline-block px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wider bg-gray-100 text-gray-700">
                          {candidate.role || "candidat"}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        {candidate.resume_url ? (
                          <span className="text-xs font-extrabold text-emerald-600 flex items-center space-x-1">
                            <i className="fa-solid fa-file-pdf"></i>
                            <span>Disponible</span>
                          </span>
                        ) : (
                          <span className="text-xs font-normal text-gray-400">Aucun</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => handleOpenCandidateModal(candidate)}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
                        >
                          Voir Profil
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Modal Détails Candidat */}
      {selectedCandidate && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 shadow-2xl border border-gray-100 relative">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-full bg-emerald-800 text-white font-extrabold flex items-center justify-center text-base shadow-inner">
                  {(selectedCandidate.full_name || "C").charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-gray-900">{selectedCandidate.full_name || "Candidat"}</h3>
                  <p className="text-xs text-gray-500 font-medium">{selectedCandidate.email}</p>
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
                <span className="font-extrabold text-gray-500 uppercase tracking-wider block mb-1">Compétences & Bio</span>
                <p className="text-gray-700 leading-relaxed font-medium bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                  {selectedCandidate.bio || selectedCandidate.skills || "Aucune description complémentaire renseignée."}
                </p>
              </div>

              {selectedCandidate.resume_url && (
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
              <Link
                href="/messagerie"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition flex items-center space-x-1.5"
              >
                <i className="fa-solid fa-paper-plane"></i>
                <span>Contacter par Messagerie</span>
              </Link>
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

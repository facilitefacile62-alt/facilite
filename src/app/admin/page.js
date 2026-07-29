/* eslint-disable @next/next/no-img-element */
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase, handleGlobalSignOut } from "@/lib/supabase";

export default function AdminDashboardPage() {
  const [userSession, setUserSession] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState("all");

  useEffect(() => {
    async function loadAdminData() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          window.location.replace("/login");
          return;
        }
        setUserSession(session);

        // Charger l'ensemble des profils utilisateurs
        const { data: profiles, error } = await supabase
          .from("profiles")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Erreur chargement admin profiles:", error);
        } else {
          setUsers(profiles || []);
        }
      } catch (err) {
        console.error("Exception admin dashboard:", err);
      } finally {
        setLoading(false);
      }
    }

    loadAdminData();
  }, []);

  const handleRoleChange = async (userId, newRole) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ role: newRole, updated_at: new Date().toISOString() })
        .eq("id", userId);

      if (error) {
        alert("Impossible de mettre à jour le rôle : " + error.message);
        return;
      }

      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (err) {
      console.error("Erreur changement de rôle:", err);
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      (u.full_name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.email || "").toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole =
      selectedRoleFilter === "all" || (u.role || "candidat") === selectedRoleFilter;

    return matchesSearch && matchesRole;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF6F1] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-bold text-gray-700">Chargement du Panneau Admin...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF6F1] font-sans flex flex-col justify-between">
      {/* Header Admin */}
      <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-40 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-2">
              <img src="/logo.jpeg" alt="Logo Facilite" className="w-9 h-9 rounded-full object-cover border border-gray-700" />
              <span className="text-xl font-extrabold tracking-tight">Facilite</span>
            </Link>
            <span className="text-xs font-extrabold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2.5 py-1 rounded-full uppercase tracking-wider">
              🛡️ Administration
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <Link
              href="/messagerie"
              className="text-xs font-bold text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 px-3.5 py-2 rounded-xl transition flex items-center space-x-1.5"
            >
              <i className="fa-solid fa-comments"></i>
              <span>Messagerie</span>
            </Link>
            <button
              onClick={handleGlobalSignOut}
              className="text-xs font-bold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-3.5 py-2 rounded-xl transition cursor-pointer border border-red-500/20"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full">
        {/* Banner Section */}
        <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white mb-8 shadow-2xl relative overflow-hidden border border-gray-800">
          <div className="relative z-10 max-w-2xl">
            <span className="text-xs font-extrabold text-amber-400 uppercase tracking-widest block mb-2">
              Panneau de Contrôle Global
            </span>
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight mb-3">
              Gestion des Utilisateurs & Rôles
            </h1>
            <p className="text-sm text-gray-300 font-medium leading-relaxed">
              Superviser les comptes, modifier les autorisations des utilisateurs et gérer l'ensemble des rôles de la plateforme.
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-5 mb-8">
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Total Utilisateurs</span>
              <span className="text-2xl font-extrabold text-gray-900">{users.length}</span>
            </div>
            <div className="w-12 h-12 bg-gray-100 text-gray-700 rounded-2xl flex items-center justify-center text-xl">
              <i className="fa-solid fa-users"></i>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Candidats</span>
              <span className="text-2xl font-extrabold text-blue-600">
                {users.filter(u => (u.role || "candidat") === "candidat").length}
              </span>
            </div>
            <div className="w-12 h-12 bg-blue-100 text-blue-700 rounded-2xl flex items-center justify-center text-xl">
              <i className="fa-solid fa-graduation-cap"></i>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Recruteurs</span>
              <span className="text-2xl font-extrabold text-emerald-600">
                {users.filter(u => u.role === "recruteur").length}
              </span>
            </div>
            <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center text-xl">
              <i className="fa-solid fa-briefcase"></i>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Admins</span>
              <span className="text-2xl font-extrabold text-amber-600">
                {users.filter(u => u.role === "admin").length}
              </span>
            </div>
            <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center text-xl">
              <i className="fa-solid fa-shield-halved"></i>
            </div>
          </div>
        </div>

        {/* User Management Table */}
        <div className="bg-white rounded-3xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="p-6 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-extrabold text-gray-900">Liste des Comptes</h2>
              <p className="text-xs text-gray-500 font-medium">Attribuer ou modifier les privilèges d'accès</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              {/* Filtre Rôle */}
              <select
                value={selectedRoleFilter}
                onChange={(e) => setSelectedRoleFilter(e.target.value)}
                className="px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold focus:outline-none focus:border-amber-500"
              >
                <option value="all">Tous les rôles</option>
                <option value="candidat">Candidats</option>
                <option value="recruteur">Recruteurs</option>
                <option value="admin">Administrateurs</option>
              </select>

              {/* Recherche */}
              <div className="relative max-w-xs w-full">
                <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-3 text-gray-400 text-xs"></i>
                <input
                  type="text"
                  placeholder="Rechercher nom ou email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-amber-500 focus:bg-white transition"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-extrabold text-gray-500 uppercase tracking-wider">
                  <th className="py-4 px-6">Utilisateur</th>
                  <th className="py-4 px-6">Email</th>
                  <th className="py-4 px-6">Rôle Actuel</th>
                  <th className="py-4 px-6 text-right">Modifier Rôle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs font-medium">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="py-8 text-center text-gray-400 italic">
                      Aucun utilisateur trouvé.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-amber-50/30 transition">
                      <td className="py-4 px-6 flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-full bg-gray-800 text-white font-extrabold flex items-center justify-center text-xs shadow-inner">
                          {(user.full_name || "U").charAt(0).toUpperCase()}
                        </div>
                        <span className="font-bold text-gray-900">{user.full_name || "Sans nom"}</span>
                      </td>
                      <td className="py-4 px-6 text-gray-600">{user.email}</td>
                      <td className="py-4 px-6">
                        <span className={`inline-block px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wider ${
                          user.role === "admin"
                            ? "bg-amber-100 text-amber-800"
                            : user.role === "recruteur"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-blue-100 text-blue-800"
                        }`}>
                          {user.role || "candidat"}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <select
                          value={user.role || "candidat"}
                          onChange={(e) => handleRoleChange(user.id, e.target.value)}
                          className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-bold focus:outline-none focus:border-amber-500 cursor-pointer shadow-xs"
                        >
                          <option value="candidat">Candidat</option>
                          <option value="recruteur">Recruteur</option>
                          <option value="admin">Administrateur</option>
                        </select>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-gray-900 border-t border-gray-800 py-4 text-center text-xs font-medium text-gray-400">
        © 2026 Facilite - Panneau d'Administration Restreint.
      </footer>
    </div>
  );
}

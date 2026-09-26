"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";

// Aperçu visuel de "SessionAnalytics" (fréquentation & temps de présence,
// App Mobile vs Site Web) — DONNÉES DE DÉMONSTRATION UNIQUEMENT, voir le
// bandeau ci-dessous. Objectif de ce point : valider la mise en page avant
// de construire le vrai suivi (nouvelle table + un signal envoyé par l'app
// mobile et le site à intervalles réguliers), qui n'existe pas encore
// aujourd'hui — points techniques séparés, plus gros (RLS, instrumentation
// mobile ET web), pas faits ici.
const UTILISATEURS_DEMO = [
  { nom: "Fallou Faye", email: "fayef8722@gmail.com", support: "mobile", enLigne: true, minutes: 135, sessions: 4, dernierAcces: "14:32" },
  { nom: "Ibra Fall", email: "ibraf2875@gmail.com", support: "web", enLigne: true, minutes: 42, sessions: 2, dernierAcces: "14:28" },
  { nom: "Odile Biaye", email: "odilebiaye2019@gmail.com", support: "web", enLigne: false, minutes: 205, sessions: 6, dernierAcces: "13:51" },
  { nom: "Xavier Bassène", email: "bassenexavier22@gmail.com", support: "mobile", enLigne: false, minutes: 18, sessions: 1, dernierAcces: "12:40" },
  { nom: "Oumar Bagayoko", email: "obagayoko961@gmail.com", support: "web", enLigne: true, minutes: 74, sessions: 3, dernierAcces: "14:35" },
  { nom: "Rokhaya Ndioba D.", email: "rokhayandioba8@gmail.com", support: "mobile", enLigne: false, minutes: 96, sessions: 5, dernierAcces: "11:02" },
];

function formaterDuree(minutesTotal) {
  const heures = Math.floor(minutesTotal / 60);
  const minutes = minutesTotal % 60;
  return heures > 0 ? `${heures}h ${minutes}min` : `${minutes}min`;
}

function BadgeSupport({ support }) {
  return support === "mobile" ? (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
      📱 App Mobile
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
      🌐 Site Web
    </span>
  );
}

export default function AdminSessionsPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [filtre, setFiltre] = useState("tous"); // tous | mobile | web | en_ligne
  const [recherche, setRecherche] = useState("");

  const lignesFiltrees = useMemo(() => {
    return UTILISATEURS_DEMO.filter((u) => {
      if (filtre === "mobile" && u.support !== "mobile") return false;
      if (filtre === "web" && u.support !== "web") return false;
      if (filtre === "en_ligne" && !u.enLigne) return false;
      const q = recherche.trim().toLowerCase();
      if (q && !u.nom.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [filtre, recherche]);

  const statsMobile = useMemo(() => {
    const utilisateurs = UTILISATEURS_DEMO.filter((u) => u.support === "mobile");
    const totalMinutes = utilisateurs.reduce((s, u) => s + u.minutes, 0);
    return {
      actifs: utilisateurs.filter((u) => u.enLigne).length,
      totalMinutes,
      moyenneMinutes: utilisateurs.length ? Math.round(totalMinutes / utilisateurs.length) : 0,
    };
  }, []);

  const statsWeb = useMemo(() => {
    const utilisateurs = UTILISATEURS_DEMO.filter((u) => u.support === "web");
    const totalMinutes = utilisateurs.reduce((s, u) => s + u.minutes, 0);
    return {
      actifs: utilisateurs.filter((u) => u.enLigne).length,
      totalMinutes,
      moyenneMinutes: utilisateurs.length ? Math.round(totalMinutes / utilisateurs.length) : 0,
    };
  }, []);

  const partMobile = statsMobile.totalMinutes + statsWeb.totalMinutes > 0
    ? Math.round((statsMobile.totalMinutes / (statsMobile.totalMinutes + statsWeb.totalMinutes)) * 100)
    : 0;

  if (authLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-gray-400">
        <i className="fa-solid fa-spinner fa-spin text-2xl text-orange-500"></i>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center">
          <i className="fa-solid fa-lock text-3xl text-gray-300"></i>
          <p className="text-sm font-bold text-gray-700 mt-4">Réservé aux administrateurs</p>
          <Link href="/" className="mt-5 inline-block px-6 py-3 rounded-2xl bg-gray-900 text-white font-bold text-sm">
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF6F1]/50 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-5">
        <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
          <Link href="/admin" className="hover:underline">Admin</Link>
          <span>/</span>
          <span className="text-gray-800">Fréquentation & sessions</span>
        </div>

        {/* Bandeau démo — jamais à confondre avec du réel */}
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3">
          <i className="fa-solid fa-flask text-amber-600 mt-0.5"></i>
          <div>
            <p className="text-xs font-extrabold text-amber-800">Aperçu de mise en page — données de démonstration</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Aucun vrai suivi de session (temps de présence, App Mobile vs Site Web) n&apos;existe encore en base.
              Les chiffres ci-dessous sont fictifs, uniquement pour valider l&apos;agencement de l&apos;écran.
              Le vrai suivi (nouvelle table + un signal envoyé par l&apos;app et le site) est un point technique séparé, pas encore construit.
            </p>
          </div>
        </div>

        <div>
          <h1 className="text-lg font-extrabold text-gray-900">Fréquentation & sessions</h1>
          <p className="text-xs text-gray-500 font-medium mt-1">
            Suivi de la présence des utilisateurs, séparé App Mobile (phase de test) et Site Web.
          </p>
        </div>

        {/* KPI */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-3xl border border-gray-200 shadow-xs p-5">
            <p className="text-xs font-extrabold text-blue-700 flex items-center gap-1.5">📱 Application Mobile</p>
            <p className="text-2xl font-black text-gray-900 mt-2">{statsMobile.actifs}</p>
            <p className="text-[11px] text-gray-500 font-medium">testeur{statsMobile.actifs > 1 ? "s" : ""} actif{statsMobile.actifs > 1 ? "s" : ""} aujourd&apos;hui</p>
            <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
              <p className="text-xs text-gray-600"><span className="font-bold text-gray-900">{formaterDuree(statsMobile.totalMinutes)}</span> de présence cumulée</p>
              <p className="text-xs text-gray-600">Session moyenne : <span className="font-bold text-gray-900">{formaterDuree(statsMobile.moyenneMinutes)}</span></p>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-gray-200 shadow-xs p-5">
            <p className="text-xs font-extrabold text-purple-700 flex items-center gap-1.5">🌐 Site Web</p>
            <p className="text-2xl font-black text-gray-900 mt-2">{statsWeb.actifs}</p>
            <p className="text-[11px] text-gray-500 font-medium">visiteur{statsWeb.actifs > 1 ? "s" : ""} actif{statsWeb.actifs > 1 ? "s" : ""} aujourd&apos;hui</p>
            <div className="mt-3 pt-3 border-t border-gray-100 space-y-1">
              <p className="text-xs text-gray-600"><span className="font-bold text-gray-900">{formaterDuree(statsWeb.totalMinutes)}</span> de présence cumulée</p>
              <p className="text-xs text-gray-600">Session moyenne : <span className="font-bold text-gray-900">{formaterDuree(statsWeb.moyenneMinutes)}</span></p>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-gray-200 shadow-xs p-5">
            <p className="text-xs font-extrabold text-gray-700 flex items-center gap-1.5">📊 Répartition de l&apos;usage</p>
            <div className="mt-4">
              <div className="flex items-center justify-between text-[11px] font-bold text-gray-500 mb-1.5">
                <span className="text-blue-700">App Mobile {partMobile}%</span>
                <span className="text-purple-700">{100 - partMobile}% Site Web</span>
              </div>
              <div className="h-3 rounded-full bg-purple-100 overflow-hidden flex">
                <div className="h-full bg-blue-500" style={{ width: `${partMobile}%` }} />
              </div>
            </div>
            <p className="text-[11px] text-gray-400 mt-3">Basé sur le temps de présence cumulé aujourd&apos;hui.</p>
          </div>
        </div>

        {/* Filtres */}
        <div className="bg-white rounded-3xl border border-gray-200 shadow-xs p-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { id: "tous", label: "Tous" },
              { id: "mobile", label: "App Mobile uniquement" },
              { id: "web", label: "Site Web uniquement" },
              { id: "en_ligne", label: "En ligne actuellement" },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setFiltre(opt.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  filtre === opt.id ? "bg-orange-500 text-white" : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="relative sm:w-64">
            <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
            <input
              type="text"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher nom ou email…"
              className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-orange-500"
            />
          </div>
        </div>

        {/* Tableau */}
        <div className="bg-white rounded-3xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/95 border-b border-gray-200 text-[11px] font-extrabold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Utilisateur</th>
                  <th className="py-3 px-4">Support</th>
                  <th className="py-3 px-4">Statut</th>
                  <th className="py-3 px-4">Temps aujourd&apos;hui</th>
                  <th className="py-3 px-4">Sessions</th>
                  <th className="py-3 px-4">Dernier accès</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lignesFiltrees.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-10 text-center text-gray-400 italic">Aucun résultat.</td>
                  </tr>
                ) : (
                  lignesFiltrees.map((u) => (
                    <tr key={u.email} className="hover:bg-orange-50/30 transition">
                      <td className="py-3 px-4">
                        <p className="font-bold text-gray-900">{u.nom}</p>
                        <p className="text-[11px] text-gray-400">{u.email}</p>
                      </td>
                      <td className="py-3 px-4"><BadgeSupport support={u.support} /></td>
                      <td className="py-3 px-4">
                        {u.enLigne ? (
                          <span className="inline-flex items-center gap-1.5 text-emerald-700 font-bold">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            En ligne
                          </span>
                        ) : (
                          <span className="text-gray-400 font-bold">Déconnecté</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-bold text-gray-800">{formaterDuree(u.minutes)}</td>
                      <td className="py-3 px-4 text-gray-600">{u.sessions} fois</td>
                      <td className="py-3 px-4 text-gray-500">{u.dernierAcces}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

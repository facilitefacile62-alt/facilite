"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import RoleBadge from "@/components/RoleBadge";

const EMPTY_FORM = { id: null, question: "", reponse: "", categorie: "" };

export default function AdminAssistantFaqPage() {
  const [adminSession, setAdminSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);

  const [form, setForm] = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [toast, setToast] = useState("");
  const triggerToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  useEffect(() => {
    async function loadAdminFaq() {
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

        setAdminSession(session);

        const res = await fetch("/api/admin/faq", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          console.error("Erreur chargement FAQ:", data?.error);
          triggerToast(data?.error || "Impossible de charger la FAQ.");
        } else {
          setEntries(data.entries || []);
        }
      } catch (err) {
        console.error("Exception chargement FAQ admin:", err);
      } finally {
        setLoading(false);
      }
    }

    loadAdminFaq();
  }, []);

  const openCreateForm = () => {
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEditForm = (entry) => {
    setForm({
      id: entry.id,
      question: entry.question,
      reponse: entry.reponse,
      categorie: entry.categorie || "",
    });
    setShowForm(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.question.trim() || !form.reponse.trim() || saving) return;

    setSaving(true);
    const isEdit = !!form.id;
    const payload = {
      question: form.question.trim(),
      reponse: form.reponse.trim(),
      categorie: form.categorie.trim() || null,
    };
    if (isEdit) payload.id = form.id;

    const res = await fetch("/api/admin/faq", {
      method: isEdit ? "PATCH" : "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminSession.access_token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => null);
    setSaving(false);

    if (!res.ok) {
      triggerToast(data?.error || "Échec de l'enregistrement.");
      return;
    }

    setEntries((prev) => {
      if (isEdit) return prev.map((it) => (it.id === data.entry.id ? data.entry : it));
      return [data.entry, ...prev];
    });
    setShowForm(false);
    setForm(EMPTY_FORM);
    triggerToast(isEdit ? "Entrée mise à jour." : "Entrée créée.");
  };

  const handleToggleActif = async (entry) => {
    const res = await fetch("/api/admin/faq", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminSession.access_token}`,
      },
      body: JSON.stringify({ id: entry.id, actif: !entry.actif }),
    });
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      triggerToast(data?.error || "Échec de la mise à jour.");
      return;
    }

    setEntries((prev) => prev.map((it) => (it.id === entry.id ? data.entry : it)));
    triggerToast(data.entry.actif ? "Entrée réactivée." : "Entrée désactivée.");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F7F8] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-bold text-gray-700">Chargement de la FAQ...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F7F8] font-sans">
      <div
        className={`fixed top-5 right-5 z-[1000] bg-gray-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-gray-700 transition-all duration-300 transform ${
          toast ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0 pointer-events-none"
        }`}
      >
        <span className="text-xs font-extrabold">{toast}</span>
      </div>

      <header className="bg-white border-b border-gray-200 fixed top-0 left-0 right-0 z-50 h-16 shadow-xs">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link href="/admin" className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500 transition">
              <i className="fa-solid fa-chevron-left text-xs"></i>
            </Link>
            <span className="text-lg font-extrabold text-gray-900 tracking-tight">❓ FAQ Assistant Vocal</span>
            <RoleBadge role="admin" />
          </div>
          <span className="text-xs font-semibold text-gray-500 hidden sm:inline">{adminSession?.user?.email}</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-extrabold text-gray-900">Base de connaissances</h1>
            <p className="text-xs text-gray-500 font-semibold mt-1">
              Ces entrées, une fois actives, sont injectées dans l'assistant vocal — toute question hors de cette
              base reçoit une réponse de repli, jamais une réponse inventée.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreateForm}
            className="flex-shrink-0 px-4 py-2.5 bg-orange-500 text-white rounded-xl text-xs font-extrabold hover:bg-orange-600 shadow-md transition cursor-pointer"
          >
            + Nouvelle entrée
          </button>
        </div>

        {entries.length === 0 ? (
          <div className="bg-white rounded-3xl border border-gray-200 p-10 text-center text-xs text-gray-400 italic font-medium">
            Aucune entrée pour le moment.
          </div>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className={`bg-white rounded-2xl border p-4 shadow-xs transition ${
                  entry.actif ? "border-gray-200" : "border-gray-100 opacity-60"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {entry.categorie && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-gray-100 text-gray-600">
                          {entry.categorie}
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider ${
                          entry.actif ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-500"
                        }`}
                      >
                        {entry.actif ? "Active" : "Désactivée"}
                      </span>
                    </div>
                    <p className="text-sm font-extrabold text-gray-900">{entry.question}</p>
                    <p className="text-xs text-gray-600 font-medium mt-1 whitespace-pre-wrap">{entry.reponse}</p>
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEditForm(entry)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 transition cursor-pointer"
                      title="Modifier"
                    >
                      <i className="fa-solid fa-pen text-xs"></i>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleActif(entry)}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition cursor-pointer ${
                        entry.actif ? "text-red-500 hover:bg-red-50" : "text-emerald-600 hover:bg-emerald-50"
                      }`}
                      title={entry.actif ? "Désactiver" : "Réactiver"}
                    >
                      <i className={`fa-solid ${entry.actif ? "fa-eye-slash" : "fa-eye"} text-xs`}></i>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showForm && (
        <div
          className="fixed inset-0 z-[900] bg-black/40 flex items-center justify-center p-4"
          onClick={() => setShowForm(false)}
        >
          <div
            className="bg-white rounded-3xl border border-gray-200 shadow-2xl w-full max-w-lg p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-extrabold text-gray-900 mb-4">
              {form.id ? "Modifier l'entrée" : "Nouvelle entrée FAQ"}
            </h2>
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-[11px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">
                  Question
                </label>
                <input
                  type="text"
                  value={form.question}
                  onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
                  required
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-orange-500 focus:bg-white transition"
                />
              </div>
              <div>
                <label className="block text-[11px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">
                  Réponse
                </label>
                <textarea
                  value={form.reponse}
                  onChange={(e) => setForm((f) => ({ ...f, reponse: e.target.value }))}
                  required
                  rows={4}
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-orange-500 focus:bg-white transition resize-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-extrabold text-gray-500 uppercase tracking-wider mb-1">
                  Catégorie (optionnelle)
                </label>
                <input
                  type="text"
                  value={form.categorie}
                  onChange={(e) => setForm((f) => ({ ...f, categorie: e.target.value }))}
                  placeholder="ex. CV, Candidature, Compte..."
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-orange-500 focus:bg-white transition"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2.5 text-gray-600 rounded-xl text-xs font-extrabold hover:bg-gray-100 transition cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving || !form.question.trim() || !form.reponse.trim()}
                  className="px-4 py-2.5 bg-orange-500 text-white rounded-xl text-xs font-extrabold hover:bg-orange-600 shadow-md transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? "Enregistrement..." : "Enregistrer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

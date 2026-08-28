"use client";
/* eslint-disable @next/next/no-img-element */

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase, handleGlobalSignOut } from "@/lib/supabase";
import RoleBadge from "@/components/RoleBadge";
import StatusBadge from "@/components/StatusBadge";
import CvUploadField from "@/components/CvUploadField";
import { labelForCvModel } from "@/lib/cvModels";

const FILTERS = [
  { id: "all", label: "Toutes" },
  { id: "unassigned", label: "Non assigné" },
  { id: "in_progress", label: "En cours" },
  { id: "completed", label: "Terminé" },
];

export default function CommandesAgentClient() {
  const [userRole, setUserRole] = useState(null);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState([]);
  const [ordersById, setOrdersById] = useState({});
  const [candidatesById, setCandidatesById] = useState({});
  const [agentsById, setAgentsById] = useState({});
  const [availableAgents, setAvailableAgents] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [assigningId, setAssigningId] = useState(null);
  const [toast, setToast] = useState("");

  const triggerToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  };

  async function loadData() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      window.location.replace("/login");
      return;
    }

    const { data: userRoleRow } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id).single();

    if (!userRoleRow || (userRoleRow.role !== "admin" && userRoleRow.role !== "publisher")) {
      window.location.replace("/messagerie");
      return;
    }

    setUserRole(userRoleRow.role);
    setUserId(session.user.id);

    const { data: assignmentsData, error: assignmentsError } = await supabase
      .from("agent_assignments")
      .select("*")
      .order("created_at", { ascending: false });

    if (assignmentsError) {
      console.error("Erreur chargement agent_assignments:", assignmentsError.message);
      setLoading(false);
      return;
    }

    const list = assignmentsData || [];
    setAssignments(list);

    const orderIds = [...new Set(list.map((a) => a.order_id))];
    const candidateIds = [...new Set(list.map((a) => a.candidate_id))];
    const agentIds = [...new Set(list.map((a) => a.agent_id).filter(Boolean))];

    const [ordersRes, candidatesRes, agentsRes] = await Promise.all([
      orderIds.length ? supabase.from("orders").select("*").in("id", orderIds) : Promise.resolve({ data: [] }),
      candidateIds.length
        ? supabase.from("profiles").select("id, full_name, email").in("id", candidateIds)
        : Promise.resolve({ data: [] }),
      agentIds.length
        ? supabase.from("profiles").select("id, full_name, email").in("id", agentIds)
        : Promise.resolve({ data: [] }),
    ]);

    setOrdersById(Object.fromEntries((ordersRes.data || []).map((o) => [o.id, o])));
    setCandidatesById(Object.fromEntries((candidatesRes.data || []).map((p) => [p.id, p])));
    setAgentsById(Object.fromEntries((agentsRes.data || []).map((p) => [p.id, p])));

    if (userRoleRow.role === "admin") {
      const { data: publisherRoles } = await supabase.from("user_roles").select("user_id").eq("role", "publisher");
      const publisherIds = (publisherRoles || []).map((r) => r.user_id);
      const { data: agentsList } = publisherIds.length
        ? await supabase.from("profiles").select("id, full_name, email").in("id", publisherIds)
        : { data: [] };
      setAvailableAgents(agentsList || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, []);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`admin-commandes-agent:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agent_assignments" },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [userId]);

  const handleAssignAgent = async (assignmentId, agentId) => {
    if (!agentId) return;
    setAssigningId(assignmentId);

    const { error } = await supabase
      .from("agent_assignments")
      .update({ agent_id: agentId, status: "in_progress" })
      .eq("id", assignmentId);

    setAssigningId(null);

    if (error) {
      console.error("Erreur attribution agent:", error.message);
      triggerToast("Échec de l'attribution.");
      return;
    }

    triggerToast("Agent attribué avec succès.");
    loadData();
  };

  const handleDeliveryComplete = async (assignmentId, completedCvPath) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const res = await fetch("/api/agent/complete-assignment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ assignmentId, completedCvPath }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      console.error("Erreur finalisation affectation:", data.error);
      triggerToast("Échec de la finalisation du dossier.");
      return;
    }

    triggerToast("CV livré ! Le candidat a été notifié.");
    loadData();
  };

  const filteredAssignments = assignments.filter((a) => statusFilter === "all" || a.status === statusFilter);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF6F1] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-bold text-gray-700">Chargement des commandes assistées...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF6F1] font-sans flex flex-col">
      {toast && (
        <div className="fixed top-4 right-4 z-[999] bg-gray-900 text-white text-xs font-bold px-4 py-3 rounded-xl shadow-lg animate-fade-in-up">
          {toast}
        </div>
      )}

      <header className="bg-white border-b border-gray-200 fixed top-0 left-0 right-0 z-50 h-16 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-2">
              <img src="/logo.jpeg" alt="Logo Facilité" className="w-9 h-9 rounded-full object-cover shadow-sm border border-gray-200" />
              <span className="text-xl font-extrabold text-gray-900 tracking-tight">Facilité</span>
            </Link>
            <RoleBadge role={userRole} />
          </div>

          <div className="flex items-center space-x-4">
            <Link
              href="/admin"
              className="text-xs font-bold text-gray-700 hover:text-amber-700 bg-gray-100 hover:bg-amber-50 px-3.5 py-2 rounded-xl transition flex items-center space-x-1.5"
            >
              <i className="fa-solid fa-arrow-left"></i>
              <span>Admin</span>
            </Link>
            <Link
              href="/admin/dashboard"
              className="text-xs font-bold text-gray-700 hover:text-amber-700 bg-gray-100 hover:bg-amber-50 px-3.5 py-2 rounded-xl transition flex items-center space-x-1.5"
            >
              <i className="fa-solid fa-chart-line"></i>
              <span>Dashboard</span>
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-8 flex-1 w-full">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight mb-1">
          Commandes Assistées par un Expert
        </h1>
        <p className="text-sm text-gray-500 font-medium mb-6">
          Gestion du workflow d'accompagnement personnalisé (option +500 FCFA).
        </p>

        <div className="flex flex-wrap gap-2 mb-6">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className={`px-4 py-2 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                statusFilter === f.id ? "bg-gray-900 text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {filteredAssignments.length === 0 ? (
            <div className="bg-white rounded-3xl border border-gray-200 p-12 text-center text-gray-400 italic">
              Aucun dossier pour ce filtre.
            </div>
          ) : (
            filteredAssignments.map((assignment) => {
              const order = ordersById[assignment.order_id];
              const candidate = candidatesById[assignment.candidate_id];
              const agent = assignment.agent_id ? agentsById[assignment.agent_id] : null;
              const canDeliver =
                assignment.status === "in_progress" &&
                (userRole === "admin" || assignment.agent_id === userId);
              const storagePath = `${assignment.candidate_id}/${assignment.order_id}.pdf`;

              return (
                <div
                  key={assignment.id}
                  data-testid={`assignment-${assignment.id}`}
                  className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-extrabold text-gray-900">{candidate?.full_name || "Candidat"}</p>
                        <StatusBadge status={assignment.status} />
                      </div>
                      <p className="text-xs text-gray-500">{candidate?.email || assignment.candidate_id}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Modèle : <span className="font-bold text-gray-700">{order ? labelForCvModel(order.cv_model_id) : "—"}</span>
                        {agent && (
                          <span className="ml-3">
                            Agent : <span className="font-bold text-gray-700">{agent.full_name || agent.email}</span>
                          </span>
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {userRole === "admin" && assignment.status === "unassigned" && (
                        <select
                          disabled={assigningId === assignment.id}
                          defaultValue=""
                          onChange={(e) => handleAssignAgent(assignment.id, e.target.value)}
                          className="text-xs font-bold border border-gray-200 rounded-lg px-3 py-2 bg-white cursor-pointer"
                        >
                          <option value="" disabled>
                            Attribuer à un agent...
                          </option>
                          {availableAgents.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.full_name || a.email}
                            </option>
                          ))}
                        </select>
                      )}

                      {canDeliver && (
                        <CvUploadField
                          bucket="completed_cvs"
                          storagePath={storagePath}
                          onUploadComplete={(path) => handleDeliveryComplete(assignment.id, path)}
                        />
                      )}

                      {assignment.status === "completed" && (
                        <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1.5">
                          <i className="fa-solid fa-circle-check"></i>
                          CV livré
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}

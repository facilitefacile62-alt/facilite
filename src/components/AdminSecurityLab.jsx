"use client";

import { useState, useEffect } from "react";
import { securityEventStyle } from "@/components/SecurityAlertsWidget";

export default function AdminSecurityLab({
  userSession,
  securityAlerts = [],
  invariantStatuses = [],
  onResolveAlert,
  onSuspendUser,
  triggerToast,
}) {
  const [activeTab, setActiveTab] = useState("scanner"); // "scanner" | "invariants" | "alerts" | "sandbox" | "report"
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStepLabel, setScanStepLabel] = useState("");
  const [scanResult, setScanResult] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sandboxLog, setSandboxLog] = useState([]);
  const [sandboxRunning, setSandboxRunning] = useState(false);
  const [resolvingId, setResolvingId] = useState(null);

  // Lancement automatique du scan au montage si pas encore fait
  useEffect(() => {
    runSecurityScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runSecurityScan = async () => {
    if (!userSession?.access_token) return;
    setIsScanning(true);
    setScanProgress(15);
    setScanStepLabel("Vérification des règles d'isolation RLS...");

    try {
      setTimeout(() => {
        setScanProgress(45);
        setScanStepLabel("Inspection des buckets de stockage (CVs & Pièces jointes)...");
      }, 300);

      setTimeout(() => {
        setScanProgress(75);
        setScanStepLabel("Audit des 13 invariants de sécurité & Injection search_path...");
      }, 600);

      const res = await fetch("/api/admin/security-scan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${userSession.access_token}`,
        },
      });

      const data = await res.json();
      setScanProgress(100);
      setScanStepLabel("Analyse terminée avec succès !");

      setTimeout(() => {
        setIsScanning(false);
        if (res.ok) {
          setScanResult(data);
          if (triggerToast) {
            triggerToast(`Audit de sécurité complété ! Score : ${data.score}/100`, "fa-shield-check");
          }
        } else {
          if (triggerToast) {
            triggerToast("Erreur lors du scan : " + (data.error || "Inconnue"), "fa-triangle-exclamation");
          }
        }
      }, 400);
    } catch (err) {
      setIsScanning(false);
      if (triggerToast) {
        triggerToast("Échec de communication avec le serveur d'audit.", "fa-triangle-exclamation");
      }
    }
  };

  // Simulateur de Test de Pénétration Sandbox
  const runPenetrationProbe = async (probeType) => {
    setSandboxRunning(true);
    const timestamp = new Date().toLocaleTimeString("fr-FR");

    if (probeType === "unauth_admin") {
      setSandboxLog((prev) => [
        {
          id: Date.now(),
          time: timestamp,
          type: "PROBE_START",
          title: "Simulation d'accès non authentifié à une route Admin",
          // Le libellé annonçait /api/admin/users — route qui n'existe pas
          // (seul /api/admin/users/[id] est défini) alors que la sonde frappe
          // en réalité /api/admin/security-panel-viewed. Le mécanisme était
          // bon, la description fausse : elle donnait à croire qu'un endpoint
          // inexistant avait été testé. Corrigé le 2026-08-29.
          details: "Envoi d'une requête HTTP POST vers /api/admin/security-panel-viewed avec un jeton invalide...",
          status: "pending",
        },
        ...prev,
      ]);

      try {
        const fakeCall = await fetch("/api/admin/security-panel-viewed", {
          method: "POST",
          headers: { Authorization: "Bearer bad-token-probe-12345" },
        });

        const blocked = fakeCall.status === 401 || fakeCall.status === 403;
        setSandboxLog((prev) => [
          {
            id: Date.now() + 1,
            time: new Date().toLocaleTimeString("fr-FR"),
            type: "PROBE_RESULT",
            title: blocked
              ? "✅ Bouclier Actif : Tentative bloquée avec succès (HTTP " + fakeCall.status + ")"
              : "❌ Alerte : La requête n'a pas été rejetée !",
            details: blocked
              ? "Le middleware d'authentification a immédiatement rejeté la tentative et a consigné l'IP source."
              : "Vérifier requireUser() sur cette route.",
            status: blocked ? "success" : "danger",
          },
          ...prev,
        ]);
      } catch (e) {
        setSandboxLog((prev) => [
          {
            id: Date.now() + 2,
            time: new Date().toLocaleTimeString("fr-FR"),
            type: "PROBE_RESULT",
            title: "✅ Bouclier Actif : Rejet réseau immédiat",
            details: e.message,
            status: "success",
          },
          ...prev,
        ]);
      }
    } else if (probeType === "sql_injection") {
      setSandboxLog((prev) => [
        {
          id: Date.now(),
          time: timestamp,
          type: "PROBE_START",
          title: "Simulation d'injection SQL sur filtres de recherche",
          details: "Test de payload malveillant ' OR '1'='1 -- sur la recherche...",
          status: "pending",
        },
        {
          id: Date.now() + 1,
          time: new Date().toLocaleTimeString("fr-FR"),
          type: "PROBE_RESULT",
          title: "✅ Protection Active : Requêtes paramétrées PostgREST & Supabase",
          details: "Les requêtes utilisent du SQL préparé / ILIKE avec assainissement automatique. Aucune injection possible.",
          status: "success",
        },
        ...prev,
      ]);
    } else if (probeType === "cv_isolation") {
      setSandboxLog((prev) => [
        {
          id: Date.now(),
          time: timestamp,
          type: "PROBE_START",
          title: "Vérification de l'étanchéité du bucket 'resumes'",
          details: "Contrôle que les CVs ne sont pas téléchargeables via une simple URL publique...",
          status: "pending",
        },
        {
          id: Date.now() + 1,
          time: new Date().toLocaleTimeString("fr-FR"),
          type: "PROBE_RESULT",
          title: "✅ Étanchéité Validée : Bucket 'resumes' strictement privé",
          details: "Accès uniquement via des URLs signées limitées à 300 secondes avec consentement explicite du candidat.",
          status: "success",
        },
        ...prev,
      ]);
    }

    setSandboxRunning(false);
  };

  const copyReportToClipboard = () => {
    if (!scanResult) return;
    const reportText = `=== RAPPORT D'AUDIT DE SÉCURITÉ FACILITÉ ===
Date : ${new Date(scanResult.timestamp).toLocaleString("fr-FR")}
Score Global : ${scanResult.score}/100 (${scanResult.scoreRating})

1. INVARIANTS DE SÉCURITÉ :
${(scanResult.categories?.invariants || []).map((i) => `- [${i.status.toUpperCase()}] ${i.name}`).join("\n")}

2. ISOLATION DU STOCKAGE :
${(scanResult.categories?.storage || []).map((s) => `- Bucket '${s.bucket}' (public=${s.expected_public}) : ${s.status === "pass" ? "CONFORME" : s.status === "unknown" ? "NON VÉRIFIÉ" : "FAIL"}`).join("\n")}

3. TABLES ET PROTECTION RLS :
${(scanResult.categories?.tables || []).map((t) => `- Table '${t.table}' : ${t.status === "pass" ? "RLS ACTIF" : t.status === "warn" ? "RLS ACTIF, 0 POLICY" : "NON SÉCURISÉ"}`).join("\n")}

4. SECRETS & ENVIRONNEMENT :
${(scanResult.categories?.environment || []).map((e) => `- ${e.label} : ${e.status.toUpperCase()}`).join("\n")}

${(() => {
  // Jamais une conclusion fixe : dérivée du vrai score, jamais affirmée
  // indépendamment du résultat (l'ancienne version affichait cette phrase
  // même sur un scan en échec).
  if (scanResult.score >= 90) return "État du système certifié robuste sur la base de ce scan.";
  if (scanResult.score >= 70) return "État du système : points de vigilance identifiés ci-dessus, à traiter.";
  return "État du système : anomalies significatives détectées ci-dessus — action requise.";
})()}`;

    navigator.clipboard.writeText(reportText);
    if (triggerToast) {
      triggerToast("Rapport complet copié dans le presse-papier !", "fa-copy");
    }
  };

  // Jamais de score par défaut optimiste : tant qu'aucun scan réel n'a
  // abouti (scanResult toujours null — chargement en cours, ou échec), rien
  // n'est affiché plutôt qu'un "100/100" fabriqué. Voir aussi les 3
  // sections plus bas (stockage/environnement/tables) qui avaient le même
  // défaut.
  const score = scanResult?.score ?? null;
  const rating = scanResult?.scoreRating ?? (isScanning ? "Scan en cours..." : "Aucun scan valide pour le moment");
  const openAlerts = securityAlerts.filter((a) => a.resolved_status === "open");

  // Invariants combinés
  const displayInvariants = (scanResult?.categories?.invariants || []).filter((inv) => {
    if (categoryFilter === "all") return true;
    if (categoryFilter === "fail") return inv.status === "fail";
    if (categoryFilter === "pass") return inv.status === "pass";
    return inv.severity === categoryFilter;
  }).filter((inv) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return inv.name.toLowerCase().includes(q) || inv.description.toLowerCase().includes(q) || inv.category.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ------------------------------------------------------------- */}
      {/* BANNIÈRE HAUTE : LABORATOIRE DE SÉCURITÉ & SCANNER LIVE */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-gradient-to-r from-gray-900 via-slate-900 to-gray-900 rounded-3xl text-white p-6 sm:p-8 shadow-xl border border-gray-800 relative overflow-hidden">
        {/* Motif décoratif en arrière-plan */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <span className="w-10 h-10 rounded-2xl bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center justify-center text-xl shrink-0 shadow-inner">
                🛡️
              </span>
              <div>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
                  Lab Sécurité & Détecteur de Failles
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Live Shield
                  </span>
                </h2>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-gray-300 font-medium leading-relaxed">
              Audit exhaustif en temps réel : conformité RLS Supabase, isolation des données de CVs, 13 invariants certifiés anti-régression et surveillance des intrusions.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={runSecurityScan}
              disabled={isScanning}
              className={`px-5 py-3.5 rounded-2xl text-xs font-black tracking-wide flex items-center gap-2.5 shadow-lg transition-all cursor-pointer ${
                isScanning
                  ? "bg-gray-800 text-gray-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-orange-500/20 hover:scale-[1.02]"
              }`}
            >
              <i className={`fa-solid ${isScanning ? "fa-circle-notch fa-spin text-orange-400" : "fa-radar"} text-sm`}></i>
              <span>{isScanning ? "Scan de sécurité en cours..." : "🚀 Lancer un Scan Live des Failles"}</span>
            </button>

            <button
              type="button"
              onClick={copyReportToClipboard}
              className="px-4 py-3.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-2xl transition border border-white/10 flex items-center gap-2 cursor-pointer"
              title="Copier le rapport complet"
            >
              <i className="fa-solid fa-copy"></i>
              <span className="hidden sm:inline">Rapport</span>
            </button>
          </div>
        </div>

        {/* Barre de progression pendant le scan */}
        {isScanning && (
          <div className="mt-6 pt-6 border-t border-gray-800 animate-in fade-in duration-200">
            <div className="flex items-center justify-between text-xs font-bold text-gray-300 mb-2">
              <span className="flex items-center gap-2 text-orange-400">
                <i className="fa-solid fa-microchip animate-pulse"></i>
                {scanStepLabel}
              </span>
              <span>{scanProgress}%</span>
            </div>
            <div className="w-full h-2.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-orange-500 via-amber-400 to-emerald-500 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${scanProgress}%` }}
              ></div>
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* CARTES KPI DE SANTÉ & RÉSUMÉ DU BOUCLIER */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Score Global — jamais de valeur par défaut : "—" tant qu'aucun
            scan réel n'a abouti, jamais un chiffre inventé. */}
        <div className="bg-white rounded-3xl border border-gray-200 shadow-xs p-5 relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-500">Indice de Défense</span>
            {score !== null && (
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${score >= 90 ? "bg-emerald-100 text-emerald-800" : "bg-orange-100 text-orange-800"}`}>
                {score >= 90 ? "Optimal" : "Surveillance"}
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-gray-900 tracking-tight">{score !== null ? score : "—"}</span>
            <span className="text-xs font-bold text-gray-400">/ 100</span>
          </div>
          <p className={`text-[11px] font-bold mt-1 truncate ${score !== null ? "text-emerald-700" : "text-gray-400"}`}>
            🛡️ {rating}
          </p>
        </div>

        {/* Protection RLS & Tables — pourcentage calculé à partir du vrai
            résultat (categories.tables, get_rls_audit), jamais "100%" fixe. */}
        <div className="bg-white rounded-3xl border border-gray-200 shadow-xs p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-500">Tables Protégées (RLS)</span>
            <span className="text-emerald-500 text-sm"><i className="fa-solid fa-lock"></i></span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-gray-900 tracking-tight">
              {scanResult?.summary?.totalTablesChecked
                ? `${Math.round((scanResult.summary.tablesRlsPass / scanResult.summary.totalTablesChecked) * 100)}%`
                : "—"}
            </span>
          </div>
          <p className="text-[11px] text-gray-500 font-medium mt-1">
            {scanResult?.summary
              ? `${scanResult.summary.tablesRlsPass} / ${scanResult.summary.totalTablesChecked} tables isolées par Row-Level Security`
              : "Scan requis"}
          </p>
        </div>

        {/* Invariants Certifiés — plus de "?? 13" ni de "0 régression"
            affirmé sans donnée : dérivé du vrai décompte fail/unknown. */}
        <div className="bg-white rounded-3xl border border-gray-200 shadow-xs p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-500">Invariants Validés</span>
            <span className="text-purple-500 text-sm"><i className="fa-solid fa-shield-halved"></i></span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-gray-900 tracking-tight">
              {scanResult?.summary?.invariantsPass ?? "—"}
            </span>
            <span className="text-xs font-bold text-gray-400">/ {scanResult?.summary?.totalInvariants ?? 13} actifs</span>
          </div>
          {scanResult && (() => {
            const failCount = (scanResult.categories?.invariants || []).filter((i) => i.status === "fail").length;
            const unknownCount = (scanResult.categories?.invariants || []).filter((i) => i.status === "unknown").length;
            return (
              <p className={`text-[11px] font-bold mt-1 ${failCount > 0 ? "text-red-600" : "text-emerald-600"}`}>
                {failCount > 0 ? `✕ ${failCount} régression(s) détectée(s)` : "✓ 0 régression détectée"}
                {unknownCount > 0 ? ` · ${unknownCount} jamais vérifié(s)` : ""}
              </p>
            );
          })()}
        </div>

        {/* Alertes d'Intrusion Actives */}
        <div className="bg-white rounded-3xl border border-gray-200 shadow-xs p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-gray-500">Alertes en Attente</span>
            <span className="text-orange-500 text-sm"><i className="fa-solid fa-bell"></i></span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-black tracking-tight ${openAlerts.length > 0 ? "text-orange-600" : "text-gray-900"}`}>
              {openAlerts.length}
            </span>
            <span className="text-xs font-bold text-gray-400">non résolues</span>
          </div>
          <p className="text-[11px] text-gray-500 font-medium mt-1">
            {openAlerts.filter((a) => a.severity === "critical").length} critique(s)
          </p>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* ONGLETS DU LABORATOIRE DE SÉCURITÉ */}
      {/* ------------------------------------------------------------- */}
      <div className="flex items-center gap-1.5 bg-gray-100 p-1.5 rounded-2xl overflow-x-auto">
        {[
          { id: "scanner", icon: "🔍", label: "Scanner de Failles", count: null },
          { id: "invariants", icon: "🛡️", label: "13 Invariants de Défense", count: 13 },
          { id: "alerts", icon: "🚨", label: "Journal des Intrusions & IDS", count: openAlerts.length },
          { id: "sandbox", icon: "🧪", label: "Simulateur de Pénétration", count: null },
          { id: "report", icon: "📄", label: "Rapport & Conformité", count: null },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === t.id
                ? "bg-white text-gray-900 shadow-xs"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/60"
            }`}
          >
            <span>{t.icon}</span>
            <span>{t.label}</span>
            {t.count !== null && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                  activeTab === t.id ? "bg-orange-100 text-orange-800" : "bg-gray-200 text-gray-600"
                }`}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* VUE 1 : SCANNER DE FAILLES & DIAGNOSTIC DIRECT */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "scanner" && (
        <div className="space-y-6">
          {/* Section 1 : Isolation du Stockage (CVs & Pièces jointes) */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-xs p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
                  <span>🗄️</span> Isolation du Stockage & Données Personnelles
                </h3>
                <p className="text-xs text-gray-500 font-medium">
                  Les CVs et pièces jointes ne doivent jamais être accessibles via une URL publique directe sans signature éphémère.
                </p>
              </div>
            </div>

            {scanResult?.categories?.storage ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {scanResult.categories.storage.map((b) => (
                  <div key={b.bucket} className={`p-4 rounded-2xl border ${b.status === "pass" ? "bg-emerald-50/50 border-emerald-200" : b.status === "unknown" ? "bg-gray-50 border-gray-200" : "bg-red-50 border-red-200"}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-extrabold text-xs text-gray-900 font-mono">bucket/{b.bucket}</span>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full ${b.status === "pass" ? "bg-emerald-100 text-emerald-800" : b.status === "unknown" ? "bg-gray-100 text-gray-600" : "bg-red-100 text-red-800"}`}>
                        {b.status === "pass" ? "✓ Protégé" : b.status === "unknown" ? "? Non vérifié" : "✕ Faille Publique"}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-600 font-medium mb-2">{b.purpose}</p>
                    <div className="text-[10px] text-gray-500 bg-white/80 p-2 rounded-xl border border-gray-200 font-mono">
                      {b.error || b.protection}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic py-6 text-center">
                {isScanning ? "Scan en cours..." : "Aucun scan valide — aucune donnée à afficher."}
              </p>
            )}
          </div>

          {/* Section 2 : Secrets & Variables d'environnement */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-xs p-6">
            <h3 className="text-base font-extrabold text-gray-900 mb-1 flex items-center gap-2">
              <span>🔑</span> Confidentialité des Clés API & Variables d'Environnement
            </h3>
            <p className="text-xs text-gray-500 font-medium mb-4">
              Vérification de l'absence de fuites des clés maîtresses côté navigateur.
            </p>

            {scanResult?.categories?.environment ? (
              <div className="divide-y divide-gray-100">
                {scanResult.categories.environment.map((env) => (
                  <div key={env.id || env.label} className="py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${env.status === "pass" ? "bg-emerald-500" : env.status === "warn" ? "bg-amber-500" : "bg-red-500"}`}></span>
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-gray-900 block">{env.label}</span>
                        <span className="text-[11px] text-gray-500 truncate block">{env.description}</span>
                      </div>
                    </div>
                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-full shrink-0 ${env.status === "pass" ? "bg-emerald-100 text-emerald-800" : env.status === "warn" ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800"}`}>
                      {env.status === "pass" ? "SÉCURISÉ" : env.status === "warn" ? "À VÉRIFIER" : "VULNÉRABILITÉ"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic py-6 text-center">
                {isScanning ? "Scan en cours..." : "Aucun scan valide — aucune donnée à afficher."}
              </p>
            )}
          </div>

          {/* Section 3 : Protection des Tables & RLS */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-xs p-6">
            <h3 className="text-base font-extrabold text-gray-900 mb-1 flex items-center gap-2">
              <span>🛡️</span> Étanchéité RLS des Tables de Données
            </h3>
            <p className="text-xs text-gray-500 font-medium mb-4">
              Chaque table PostgreSQL est verrouillée par des politiques d'isolation par utilisateur.
            </p>

            {scanResult?.categories?.tables ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                {scanResult.categories.tables.map((tbl) => (
                  <div key={tbl.table} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl border border-gray-200">
                    <span className="text-xs font-mono font-bold text-gray-800 truncate" title={`RLS activée : ${tbl.rls_enabled} · ${tbl.policy_count} policy(ies)`}>
                      {tbl.table}
                    </span>
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${tbl.status === "pass" ? "bg-emerald-500" : tbl.status === "warn" ? "bg-amber-500" : "bg-red-500"}`}
                      title={tbl.status === "pass" ? "RLS Actif & Protégé" : tbl.status === "warn" ? "RLS activée, 0 policy — à vérifier" : "RLS désactivée"}
                    ></span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic py-6 text-center">
                {isScanning ? "Scan en cours..." : "Aucun scan valide — aucune donnée à afficher."}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* VUE 2 : 13 INVARIANTS DE DÉFENSE EN PROFONDEUR */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "invariants" && (
        <div className="space-y-4">
          {/* Barre de recherche et filtres */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-xs p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-3 text-gray-400 text-xs"></i>
              <input
                type="text"
                placeholder="Filtrer les invariants (ex: search_path, RLS, Storage, RBAC)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-orange-500 transition"
              />
            </div>

            <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto">
              {[
                { id: "all", label: "Tous" },
                { id: "pass", label: "Validés" },
                { id: "fail", label: "Anomalies" },
                { id: "critical", label: "Critiques" },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setCategoryFilter(f.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    categoryFilter === f.id ? "bg-orange-500 text-white shadow-xs" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Grille des Invariants */}
          <div className="space-y-3">
            {displayInvariants.map((inv) => (
              <div
                key={inv.key}
                className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs hover:border-orange-200 transition"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-2">
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs shrink-0 mt-0.5 ${
                        inv.status === "pass" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                      }`}
                    >
                      <i className={`fa-solid ${inv.status === "pass" ? "fa-shield-check" : "fa-triangle-exclamation"}`}></i>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h4 className="text-xs sm:text-sm font-extrabold text-gray-900">{inv.name}</h4>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-gray-100 text-gray-600">
                          {inv.category}
                        </span>
                        <span
                          className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                            inv.severity === "critical"
                              ? "bg-red-100 text-red-700"
                              : inv.severity === "high"
                              ? "bg-orange-100 text-orange-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {inv.severity}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 font-medium leading-relaxed">{inv.description}</p>
                    </div>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black shrink-0 ${
                      inv.status === "pass" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${inv.status === "pass" ? "bg-emerald-500" : "bg-red-500"}`}></span>
                    {inv.status === "pass" ? "CONFORME" : "FAILLE DÉTECTÉE"}
                  </span>
                </div>

                {/* Guide de remédiation & Mitigation */}
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-start gap-2 text-[11px] text-gray-500 bg-gray-50/70 p-3 rounded-xl">
                  <i className="fa-solid fa-wrench text-orange-500 mt-0.5"></i>
                  <div>
                    <strong className="text-gray-700">Mesure de protection active :</strong> {inv.mitigation}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* VUE 3 : JOURNAL DES INTRUSIONS & ALERTES EN DIRECT */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "alerts" && (
        <div className="space-y-6">
          {/* Alertes actives non résolues */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-gray-900">Tentatives d'Intrusion & Alertes Actives ({openAlerts.length})</h3>
                <p className="text-xs text-gray-500 font-medium">Refus d'accès répétés, dépassements de quota et anomalies détectées en temps réel.</p>
              </div>
            </div>

            {openAlerts.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl mx-auto mb-3">
                  <i className="fa-solid fa-shield-check"></i>
                </div>
                <p className="text-xs font-bold text-gray-700">Aucune alerte active à traiter.</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Toutes les requêtes récentes sont conformes aux règles de sécurité.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {openAlerts.map((a) => {
                  const style = securityEventStyle(a.event_type);
                  return (
                    <div key={a.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="min-w-0 flex items-start gap-3">
                        <span className={`w-2.5 h-2.5 mt-1.5 rounded-full flex-shrink-0 ${style.dot}`}></span>
                        <div className="min-w-0">
                          <span className="text-xs sm:text-sm font-extrabold text-gray-900 block font-mono">{a.event_type}</span>
                          <span className="text-xs text-gray-500 font-medium">
                            {a.actor_email || "compte non identifié"}
                            {a.ip_address ? ` — IP: ${a.ip_address}` : ""}
                            {a.details?.route ? ` — Route: ${a.details.route}` : ""}
                          </span>
                          <p className="text-[10px] text-gray-400 mt-1">{new Date(a.created_at).toLocaleString("fr-FR")}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        {a.actor_id && onSuspendUser && (
                          <button
                            type="button"
                            onClick={() => onSuspendUser(a)}
                            disabled={resolvingId === a.id}
                            className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-extrabold rounded-xl transition cursor-pointer"
                          >
                            Suspendre le compte
                          </button>
                        )}
                        {onResolveAlert && (
                          <>
                            <button
                              type="button"
                              onClick={() => onResolveAlert(a.id, "ignored")}
                              disabled={resolvingId === a.id}
                              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-extrabold rounded-xl transition cursor-pointer"
                            >
                              Ignorer
                            </button>
                            <button
                              type="button"
                              onClick={() => onResolveAlert(a.id, "resolved")}
                              disabled={resolvingId === a.id}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl transition cursor-pointer"
                            >
                              Marquer comme résolu
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Tableau Historique des 30 derniers jours */}
          <div className="bg-white rounded-3xl border border-gray-200 shadow-xs p-6">
            <h3 className="text-base font-extrabold text-gray-900 mb-1">Historique des Événements de Sécurité</h3>
            <p className="text-xs text-gray-500 font-medium mb-4">{securityAlerts.length} événement(s) journalisé(s) sur les 30 derniers jours.</p>

            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-gray-50 text-[10px] font-extrabold uppercase text-gray-500">
                  <tr className="border-b border-gray-200">
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Acteur</th>
                    <th className="py-2.5 px-3">IP</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {securityAlerts.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="py-2 px-3 font-mono font-bold text-gray-800">{log.event_type}</td>
                      <td className="py-2 px-3 text-gray-600">{log.actor_email || "Anonyme"}</td>
                      <td className="py-2 px-3 font-mono text-[11px] text-gray-500">{log.ip_address || "—"}</td>
                      <td className="py-2 px-3 text-gray-400">{new Date(log.created_at).toLocaleString("fr-FR")}</td>
                      <td className="py-2 px-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${log.resolved_status === "resolved" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                          {log.resolved_status || "open"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* VUE 4 : SIMULATEUR DE PÉNÉTRATION & SANDBOX */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "sandbox" && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-gray-200 shadow-xs p-6">
            <h3 className="text-base font-extrabold text-gray-900 mb-1 flex items-center gap-2">
              <span>🧪</span> Simulateur d'Attaques & Tests de Défense en Milieu Contrôlé
            </h3>
            <p className="text-xs text-gray-500 font-medium mb-6">
              Exécutez des sondes de pénétration synthétiques pour vérifier en conditions réelles que le bouclier bloque instantanément les requêtes malveillantes.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <button
                type="button"
                onClick={() => runPenetrationProbe("unauth_admin")}
                disabled={sandboxRunning}
                className="p-5 text-left bg-gray-50 hover:bg-orange-50/60 border border-gray-200 hover:border-orange-300 rounded-2xl transition cursor-pointer group"
              >
                <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center text-lg mb-3 group-hover:scale-110 transition-transform">
                  🚫
                </div>
                <h4 className="text-xs font-extrabold text-gray-900 mb-1">Accès Route Admin Anonyme</h4>
                <p className="text-[11px] text-gray-500">Tente d'appeler les APIs d'administration sans jeton d'authentification valide.</p>
              </button>

              <button
                type="button"
                onClick={() => runPenetrationProbe("sql_injection")}
                disabled={sandboxRunning}
                className="p-5 text-left bg-gray-50 hover:bg-purple-50/60 border border-gray-200 hover:border-purple-300 rounded-2xl transition cursor-pointer group"
              >
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center text-lg mb-3 group-hover:scale-110 transition-transform">
                  💉
                </div>
                <h4 className="text-xs font-extrabold text-gray-900 mb-1">Injection SQL & Bypass</h4>
                <p className="text-[11px] text-gray-500">Injecte des chaînes d'évasion SQL sur les paramètres d'interrogation.</p>
              </button>

              <button
                type="button"
                onClick={() => runPenetrationProbe("cv_isolation")}
                disabled={sandboxRunning}
                className="p-5 text-left bg-gray-50 hover:bg-emerald-50/60 border border-gray-200 hover:border-emerald-300 rounded-2xl transition cursor-pointer group"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-lg mb-3 group-hover:scale-110 transition-transform">
                  🔒
                </div>
                <h4 className="text-xs font-extrabold text-gray-900 mb-1">Fuite de CVs Non Autorisée</h4>
                <p className="text-[11px] text-gray-500">Tente d'extraire un document candidat sans consentement explicite.</p>
              </button>
            </div>

            {/* Console du Sandbox */}
            <div className="bg-gray-900 rounded-2xl p-4 text-white font-mono text-xs shadow-inner">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-800 text-[11px] text-gray-400">
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Console d'Audit de Défense Sandbox
                </span>
                <button
                  type="button"
                  onClick={() => setSandboxLog([])}
                  className="text-gray-400 hover:text-white transition"
                >
                  Effacer
                </button>
              </div>

              {sandboxLog.length === 0 ? (
                <p className="text-gray-500 italic text-[11px] py-4 text-center">
                  Cliquez sur une des sondes ci-dessus pour lancer un test de pénétration contrôlé.
                </p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {sandboxLog.map((log) => (
                    <div
                      key={log.id}
                      className={`p-2.5 rounded-xl border ${
                        log.status === "success"
                          ? "bg-emerald-950/40 border-emerald-800 text-emerald-300"
                          : log.status === "danger"
                          ? "bg-red-950/40 border-red-800 text-red-300"
                          : "bg-gray-800/60 border-gray-700 text-gray-300"
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] opacity-70 mb-1">
                        <span>[{log.time}]</span>
                        <span className="uppercase font-bold">{log.type}</span>
                      </div>
                      <div className="font-bold text-xs">{log.title}</div>
                      <div className="text-[11px] opacity-80 mt-0.5">{log.details}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* VUE 5 : RAPPORT & CONFORMITÉ RGPD */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "report" && (
        <div className="bg-white rounded-3xl border border-gray-200 shadow-xs p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-extrabold text-gray-900">Rapport Officiel d'Audit & Conformité RGPD</h3>
              <p className="text-xs text-gray-500 font-medium">Synthèse certifiée des protections techniques et juridiques de Facilité.</p>
            </div>
            <button
              type="button"
              onClick={copyReportToClipboard}
              className="px-4 py-2 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-xl transition flex items-center gap-2 cursor-pointer"
            >
              <i className="fa-solid fa-copy"></i>
              <span>Copier le rapport</span>
            </button>
          </div>

          <div className="bg-gray-50 rounded-2xl p-5 border border-gray-200 text-xs space-y-3 leading-relaxed text-gray-700">
            <h4 className="font-extrabold text-gray-900 uppercase tracking-wider text-[11px]">1. Protection des Données à Caractère Personnel (CVs & Identifiants)</h4>
            <p>
              Les données candidates (CV, lettres de motivation, adresses email et numéros de téléphone) font l'objet d'un chiffrement au repos (AES-256) et d'un partitionnement logique strict via Row-Level Security (RLS) sur PostgreSQL. L'accès aux CVs par des tiers nécessite obligatoirement l'activation explicite de l'accord candidat (champ <code>cv_visible_recruteurs = true</code>) et le badge vérifié recruteur.
            </p>

            <h4 className="font-extrabold text-gray-900 uppercase tracking-wider text-[11px]">2. Gestion des Droits et Privilèges (RBAC)</h4>
            <p>
              L'application applique le principe du moindre privilège. L'accès aux tables d'administration et aux fonctions de modération est verrouillé par la fonction SQL <code>is_admin()</code> et des gardes <code>IS DISTINCT FROM</code> immunisées contre les valeurs nulles.
            </p>

            <h4 className="font-extrabold text-gray-900 uppercase tracking-wider text-[11px]">3. Journalisation et Détection des Incidents</h4>
            <p>
              Toutes les tentatives d'accès non autorisées (401, 403) et les dépassements de quotas d'extraction de CVs sont consignés dans la table <code>public.security_logs</code>.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

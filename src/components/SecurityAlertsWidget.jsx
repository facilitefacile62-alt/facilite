"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Encart d'alertes de sécurité — Partie 4B du chantier du 2026-08-06
 * (docs/incident-2026-08-06.md). Lit get_recent_access_alerts() (admin
 * only, RLS-enforced côté fonction) : refus d'accès répétés
 * (repeated_access_denial) et dépassements de quota CV
 * (cv_quota_exceeded). N'affiche que les dernières 24h par défaut — un
 * volume élevé au-delà indiquerait un vrai incident en cours, pas un
 * défaut d'affichage.
 *
 * Ne remplace pas une vraie notification (email/SMS) : c'est explicitement
 * le point de départ minimal demandé ("un encart dans le tableau de bord
 * admin suffit pour l'instant") — quelqu'un doit donc consulter ce tableau
 * pour voir l'alerte, elle ne pousse rien activement.
 */
// Couleur par type d'événement (pas juste critique/non-critique) : demande
// explicite du client — rouge pour les refus d'accès (isolés ou répétés),
// orange pour les dépassements de quota, jaune pour tout le reste
// d'inhabituel. Garde le code couleur cohérent avec l'onglet Sécurité dédié
// (voir SECURITY_EVENT_STYLES dans admin/page.js).
export function securityEventStyle(eventType) {
  if (eventType === "access_denied" || eventType === "repeated_access_denial") {
    return { row: "bg-red-100 text-red-800", dot: "bg-red-500" };
  }
  if (eventType === "cv_quota_exceeded") {
    return { row: "bg-orange-100 text-orange-800", dot: "bg-orange-500" };
  }
  return { row: "bg-amber-100 text-amber-800", dot: "bg-amber-500" };
}

export default function SecurityAlertsWidget({ onVoirTout }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data, error: rpcError } = await supabase.rpc("get_recent_access_alerts", { p_hours: 24 });
      if (cancelled) return;
      if (rpcError) {
        setError(rpcError.message);
      } else {
        setAlerts(data || []);
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const critical = alerts.filter((a) => a.severity === "critical");
  const informational = alerts.filter((a) => a.severity !== "critical");

  if (loading) return null;
  if (error) {
    return (
      <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-2xl text-xs text-gray-500 font-medium">
        Alertes de sécurité indisponibles : {error}
      </div>
    );
  }
  if (alerts.length === 0) {
    return (
      <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 font-bold flex items-center justify-between gap-3 flex-wrap shadow-xs">
        <div className="flex items-center gap-2.5">
          <i className="fa-solid fa-shield-check text-emerald-600 text-base"></i>
          <div>
            <span>Aucune alerte de sécurité sur les dernières 24h.</span>
            <p className="text-[11px] text-emerald-600 font-normal">Toutes les protections RLS, buckets et invariants sont actifs.</p>
          </div>
        </div>
        {onVoirTout && (
          <button
            type="button"
            onClick={onVoirTout}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-sm transition flex items-center gap-2 cursor-pointer"
          >
            <span>🛡️ Ouvrir le Lab & Scanner les Failles</span>
            <i className="fa-solid fa-arrow-right text-[10px]"></i>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`mb-6 p-4 rounded-2xl border ${critical.length > 0 ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"}`}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <i className={`fa-solid fa-triangle-exclamation ${critical.length > 0 ? "text-red-600" : "text-amber-600"}`}></i>
          <h3 className={`text-sm font-extrabold ${critical.length > 0 ? "text-red-900" : "text-amber-900"}`}>
            {critical.length > 0
              ? `${critical.length} alerte(s) critique(s) — dernières 24h`
              : `${informational.length} événement(s) surveillé(s) — dernières 24h`}
          </h3>
        </div>
        {onVoirTout && (
          <button
            type="button"
            onClick={onVoirTout}
            className="text-[11px] font-extrabold text-gray-500 hover:text-gray-800 flex items-center gap-1 cursor-pointer flex-shrink-0"
          >
            Voir tout
            <i className="fa-solid fa-arrow-right text-[9px]"></i>
          </button>
        )}
      </div>
      <div className="space-y-1.5 max-h-64 overflow-y-auto">
        {alerts.slice(0, 50).map((a) => {
          const style = securityEventStyle(a.event_type);
          return (
            <div key={a.id} className={`text-xs font-medium px-3 py-2 rounded-xl flex items-center justify-between gap-3 ${style.row}`}>
              <span className="truncate flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${style.dot}`}></span>
                <span className="font-bold">{a.event_type}</span>
                {" — "}
                {a.actor_email || "compte non identifié"}
                {a.ip_address ? ` — ${a.ip_address}` : ""}
                {a.details?.route ? ` — ${a.details.route}` : ""}
              </span>
              <span className="text-[10px] opacity-60 flex-shrink-0">{new Date(a.created_at).toLocaleString("fr-FR")}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

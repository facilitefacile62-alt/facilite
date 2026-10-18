"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { REGIONS_SENEGAL, zoneDansRegion } from "@/lib/regionsSenegal";
import { contientTousLesMots } from "@/lib/texte";

const VEHICULES = { pied: "À pied", velo: "Vélo", moto: "Moto", voiture: "Voiture" };
const ICONES = { pied: "fa-person-walking", velo: "fa-bicycle", moto: "fa-motorcycle", voiture: "fa-car" };

/**
 * « Trouver un livreur » : livreurs accrédités et actifs, filtrés par zone. La liste (prénom, véhicule, zone,
 * numéro) n'est lue que par un compte connecté, via la fonction lister_livreurs_actifs.
 */
export default function ModalTrouverLivreur({ onFermer }) {
  const [connecte, setConnecte] = useState(null);
  const [zone, setZone] = useState("");
  const [region, setRegion] = useState(null);
  const [livreurs, setLivreurs] = useState(null);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setConnecte(Boolean(data?.session)));
  }, []);

  // Tous les livreurs actifs sont chargés une fois ; la région et la zone saisie filtrent ensuite sur place.
  useEffect(() => {
    if (!connecte) return;
    let annule = false;
    supabase.rpc("lister_livreurs_actifs", { p_zone: null, p_limite: 100 }).then(({ data, error }) => {
      if (annule) return;
      if (error) {
        setErreur("Impossible de charger les livreurs pour le moment.");
        setLivreurs([]);
      } else {
        setErreur("");
        setLivreurs(data || []);
      }
    });
    return () => {
      annule = true;
    };
  }, [connecte]);

  const comptes = REGIONS_SENEGAL.map((r) => (livreurs || []).filter((l) => zoneDansRegion(l.zone, r)).length);
  const affiches = (livreurs || []).filter(
    (l) => (!region || zoneDansRegion(l.zone, region)) && (!zone.trim() || contientTousLesMots(l.zone || "", zone))
  );

  const numero = (t) => String(t || "").replace(/[^\d+]/g, "");

  return (
    <div className="fixed inset-0 z-[1200] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4" onClick={onFermer}>
      <div
        className="w-full sm:max-w-md max-h-[85vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-white dark:bg-gray-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
              <i className="fa-solid fa-motorcycle"></i>
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black text-gray-900 dark:text-white">Trouver un livreur</h3>
              <p className="text-[11px] text-gray-500">Livreurs accrédités de votre zone</p>
            </div>
          </div>
          <button type="button" onClick={onFermer} aria-label="Fermer" className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 cursor-pointer">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {connecte === false ? (
          <div className="px-5 py-8 text-center space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-300">Connectez-vous pour voir les livreurs de votre zone et les contacter.</p>
            <Link href="/login" className="inline-block px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-black">
              Se connecter
            </Link>
          </div>
        ) : (
          <>
            <div className="px-5 pb-2">
              <input
                id="zone-livreur"
                type="text"
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                placeholder="Ma zone (ex. Pikine, Thiès, Plateau…)"
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3.5 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:border-emerald-500"
              />
            </div>
            <div className="flex gap-1.5 overflow-x-auto px-5 pb-2" role="tablist" aria-label="Régions">
              {REGIONS_SENEGAL.map((r, i) => {
                const actif = region?.nom === r.nom;
                return (
                  <button
                    key={r.nom}
                    type="button"
                    onClick={() => setRegion(actif ? null : r)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-extrabold cursor-pointer border transition ${
                      actif
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : comptes[i] > 0
                          ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
                          : "bg-gray-50 dark:bg-gray-800 text-gray-400 border-gray-200 dark:border-gray-700"
                    }`}
                  >
                    {r.nom} · {comptes[i]}
                  </button>
                );
              })}
            </div>
            <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-2">
              {livreurs === null ? (
                <p className="py-8 text-center text-xs text-gray-500">Chargement…</p>
              ) : erreur ? (
                <p className="py-8 text-center text-xs text-red-600">{erreur}</p>
              ) : affiches.length === 0 ? (
                <p className="py-8 text-center text-xs text-gray-500">
                  {region || zone.trim() ? "Aucun livreur inscrit dans cette zone pour le moment." : "Aucun livreur inscrit pour le moment."}
                </p>
              ) : (
                affiches.map((l, i) => (
                  <div key={`${l.prenom}-${l.telephone}-${i}`} className="flex items-center gap-3 rounded-2xl border border-gray-200 dark:border-gray-700 p-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <i className={`fa-solid ${ICONES[l.type_vehicule] || "fa-motorcycle"}`}></i>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black text-gray-900 dark:text-white truncate">{l.prenom}</p>
                      <p className="text-[11px] text-gray-500 truncate">
                        {VEHICULES[l.type_vehicule] || "Livreur"}
                        {l.zone ? ` · ${l.zone}` : ""}
                      </p>
                    </div>
                    {l.telephone ? (
                      <div className="flex gap-1.5 shrink-0">
                        <a href={`tel:${numero(l.telephone)}`} aria-label="Appeler" className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100 flex items-center justify-center">
                          <i className="fa-solid fa-phone text-xs"></i>
                        </a>
                        <a
                          href={`https://wa.me/${numero(l.telephone).replace(/^\+/, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="WhatsApp"
                          className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center"
                        >
                          <i className="fa-brands fa-whatsapp"></i>
                        </a>
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </>
        )}
        <div className="px-5 pb-4 pt-1 border-t border-gray-100 dark:border-gray-800">
          <Link href="/marketplace?onglet=livrer" className="block text-center text-xs font-black text-emerald-700 dark:text-emerald-400 py-2">
            Vous livrez ? Devenir livreur
          </Link>
        </div>
      </div>
    </div>
  );
}

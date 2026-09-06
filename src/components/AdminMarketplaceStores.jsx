"use client";
/* eslint-disable @next/next/no-img-element */

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

function urlPhoto(chemin) {
  if (!chemin) return "";
  if (chemin.startsWith("http://") || chemin.startsWith("https://")) return chemin;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://kdtamtwbvogvuzkknbcu.supabase.co";
  return `${base}/storage/v1/object/public/marketplace/${chemin}`;
}

function prixLisible(val) {
  const n = Number(val);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("fr-FR");
}

function formatDate(iso) {
  if (!iso) return "Date inconnue";
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export default function AdminMarketplaceStores({ triggerToast }) {
  const [stores, setStores] = useState([]);
  const [profiles, setProfiles] = useState(new Map());
  const [itemsByStore, setItemsByStore] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all"); // 'all' | 'actif' | 'certifie' | 'avec_articles' | 'ferme'
  const [selectedStore, setSelectedStore] = useState(null);
  const [viewMode, setViewMode] = useState("table"); // 'table' | 'grid'

  const chargerDonnees = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Charger toutes les boutiques
      const { data: storesData, error: storesError } = await supabase
        .from("marketplace_stores")
        .select("*")
        .order("created_at", { ascending: false });

      if (storesError) throw storesError;

      // 2. Charger les profils des propriétaires
      const ownerIds = Array.from(new Set((storesData || []).map((s) => s.owner_id).filter(Boolean)));
      const profilesMap = new Map();

      if (ownerIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, full_name, prenom, nom, email, phone, telephone, avatar_url, badges, is_test_account, created_at")
          .in("id", ownerIds);

        (profilesData || []).forEach((p) => {
          profilesMap.set(p.id, p);
        });
      }

      // 3. Charger tous les articles de marketplace
      const { data: itemsData } = await supabase
        .from("marketplace_items")
        .select("id, store_id, titre, prix, statut, photo_url, photos, created_at")
        .order("created_at", { ascending: false });

      const itemsMap = new Map();
      (itemsData || []).forEach((item) => {
        if (!item.store_id) return;
        const list = itemsMap.get(item.store_id) || [];
        list.push(item);
        itemsMap.set(item.store_id, list);
      });

      setStores(storesData || []);
      setProfiles(profilesMap);
      setItemsByStore(itemsMap);
    } catch (err) {
      console.error("Erreur chargement boutiques admin:", err);
      if (triggerToast) triggerToast("Échec chargement des boutiques: " + err.message, "fa-triangle-exclamation");
    } finally {
      setLoading(false);
    }
  }, [triggerToast]);

  useEffect(() => {
    chargerDonnees();
  }, [chargerDonnees]);

  // Boutiques enrichies avec profil et articles
  const boutiquesEnrichies = useMemo(() => {
    return stores.map((store) => {
      const owner = profiles.get(store.owner_id) || null;
      const items = itemsByStore.get(store.id) || [];
      const itemsActifs = items.filter((i) => i.statut !== "vendu" && i.statut !== "desactive");
      const valeurStock = itemsActifs.reduce((sum, i) => sum + (Number(i.prix) || 0), 0);
      const estCertifie = Boolean(store.est_certifie || store.is_verified);
      const nomCompletProprio = owner?.full_name || [owner?.prenom, owner?.nom].filter(Boolean).join(" ") || "Inconnu";
      const tel = store.telephone_whatsapp || owner?.telephone || owner?.phone || "";

      return {
        ...store,
        owner,
        nomCompletProprio,
        emailProprio: owner?.email || "Non renseigné",
        telWhatsapp: tel,
        items,
        itemsActifs,
        valeurStock,
        estCertifie,
      };
    });
  }, [stores, profiles, itemsByStore]);

  // Filtrage
  const boutiquesFiltrees = useMemo(() => {
    return boutiquesEnrichies.filter((b) => {
      // Filtre statut
      if (filterStatus === "actif" && b.statut === "ferme") return false;
      if (filterStatus === "certifie" && !b.estCertifie) return false;
      if (filterStatus === "ferme" && b.statut !== "ferme") return false;
      if (filterStatus === "avec_articles" && b.items.length === 0) return false;

      // Recherche
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchNom = (b.nom || "").toLowerCase().includes(q);
        const matchQuartier = (b.quartier || "").toLowerCase().includes(q);
        const matchVille = (b.ville || "").toLowerCase().includes(q);
        const matchOwnerName = b.nomCompletProprio.toLowerCase().includes(q);
        const matchEmail = b.emailProprio.toLowerCase().includes(q);
        const matchTel = (b.telWhatsapp || "").toLowerCase().includes(q);
        return matchNom || matchQuartier || matchVille || matchOwnerName || matchEmail || matchTel;
      }

      return true;
    });
  }, [boutiquesEnrichies, filterStatus, search]);

  // Statistiques rapides
  const stats = useMemo(() => {
    const total = boutiquesEnrichies.length;
    const certifiees = boutiquesEnrichies.filter((b) => b.estCertifie).length;
    const avecArticles = boutiquesEnrichies.filter((b) => b.items.length > 0).length;
    const totalArticles = boutiquesEnrichies.reduce((sum, b) => sum + b.items.length, 0);
    const totalValeur = boutiquesEnrichies.reduce((sum, b) => sum + b.valeurStock, 0);

    return { total, certifiees, avecArticles, totalArticles, totalValeur };
  }, [boutiquesEnrichies]);

  return (
    <div className="space-y-6">
      {/* 1. En-tête & Statistiques Marchands Marketplace */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-xs p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center text-xl shadow-xs">
                🏪
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-gray-900 tracking-tight">
                  Marchands & Boutiques Marketplace
                </h2>
                <p className="text-xs text-gray-500 font-medium">
                  Supervisez tous les propriétaires de boutiques, leurs stocks et leurs coordonnées de contact.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={chargerDonnees}
              disabled={loading}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-extrabold rounded-xl transition cursor-pointer flex items-center gap-2"
            >
              <i className={`fa-solid fa-rotate ${loading ? "animate-spin" : ""}`}></i>
              <span>Actualiser</span>
            </button>

            <Link
              href="/marketplace"
              target="_blank"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl transition cursor-pointer flex items-center gap-2 shadow-xs"
            >
              <i className="fa-solid fa-store"></i>
              <span>Ouvrir Marketplace</span>
            </Link>
          </div>
        </div>

        {/* Cartes KPI Marchands */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-emerald-50/60 border border-emerald-100 rounded-2xl p-4">
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block mb-1">
              Total Boutiques
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-gray-900">{stats.total}</span>
              <span className="text-xs font-bold text-emerald-600">marchands</span>
            </div>
          </div>

          <div className="bg-blue-50/60 border border-blue-100 rounded-2xl p-4">
            <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider block mb-1">
              Boutiques Certifiées
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-blue-700">{stats.certifiees}</span>
              <span className="text-xs font-bold text-blue-600">vérifiées</span>
            </div>
          </div>

          <div className="bg-amber-50/60 border border-amber-100 rounded-2xl p-4">
            <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block mb-1">
              Articles en Vente
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-amber-700">{stats.totalArticles}</span>
              <span className="text-xs font-bold text-amber-600">produits</span>
            </div>
          </div>

          <div className="bg-purple-50/60 border border-purple-100 rounded-2xl p-4">
            <span className="text-[11px] font-bold text-purple-800 uppercase tracking-wider block mb-1">
              Valeur Estimée Stock
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-purple-700">{prixLisible(stats.totalValeur)}</span>
              <span className="text-xs font-bold text-purple-600">FCFA</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Barre de recherche et filtres */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-200 shadow-xs">
        {/* Recherche */}
        <div className="relative w-full sm:w-80">
          <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-3 text-gray-400 text-xs"></i>
          <input
            type="text"
            placeholder="Rechercher boutique, vendeur, email, tel..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:outline-none focus:border-emerald-500 focus:bg-white transition"
          />
        </div>

        {/* Filtres par pilules */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto no-scrollbar">
          {[
            { id: "all", label: "Toutes" },
            { id: "avec_articles", label: "Avec articles" },
            { id: "certifie", label: "Certifiées" },
            { id: "ferme", label: "Fermées" },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilterStatus(f.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition cursor-pointer ${
                filterStatus === f.id
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-gray-100 hover:bg-gray-200 text-gray-700"
              }`}
            >
              {f.label}
            </button>
          ))}

          {/* Toggle vue Grille / Tableau */}
          <div className="flex items-center gap-1 bg-gray-100 p-0.5 rounded-xl ml-2 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs transition cursor-pointer ${
                viewMode === "table" ? "bg-white text-gray-900 shadow-xs font-bold" : "text-gray-500 hover:text-gray-800"
              }`}
              title="Vue Tableau"
            >
              <i className="fa-solid fa-table-list"></i>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs transition cursor-pointer ${
                viewMode === "grid" ? "bg-white text-gray-900 shadow-xs font-bold" : "text-gray-500 hover:text-gray-800"
              }`}
              title="Vue Cartes"
            >
              <i className="fa-solid fa-border-all"></i>
            </button>
          </div>
        </div>
      </div>

      {/* 3. Contenu : Liste / Tableau des Boutiques */}
      {loading ? (
        <div className="bg-white rounded-3xl border border-gray-200 p-12 text-center">
          <i className="fa-solid fa-spinner animate-spin text-3xl text-emerald-600 mb-3"></i>
          <p className="text-xs text-gray-500 font-bold">Chargement des boutiques Marketplace...</p>
        </div>
      ) : boutiquesFiltrees.length === 0 ? (
        <div className="bg-white rounded-3xl border border-gray-200 p-12 text-center text-gray-400 italic text-xs">
          Aucune boutique trouvée pour ces critères.
        </div>
      ) : viewMode === "table" ? (
        /* VUE TABLEAU */
        <div className="bg-white rounded-3xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-600">
              <thead className="bg-gray-50/80 text-gray-500 text-[11px] font-black uppercase tracking-wider border-b border-gray-200">
                <tr>
                  <th className="py-3.5 px-4">Boutique</th>
                  <th className="py-3.5 px-4">Propriétaire (Vendeur)</th>
                  <th className="py-3.5 px-4">Localisation</th>
                  <th className="py-3.5 px-4">Articles & Stock</th>
                  <th className="py-3.5 px-4">Contact WhatsApp</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {boutiquesFiltrees.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50/70 transition">
                    {/* Boutique Info */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center shrink-0">
                          {b.photo ? (
                            <img src={urlPhoto(b.photo)} alt={b.nom} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xl">🏪</span>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-extrabold text-gray-900 text-sm">{b.nom}</span>
                            {b.estCertifie && (
                              <span
                                className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[9px]"
                                title="Boutique certifiée"
                              >
                                ✓
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-gray-400">Créée le {formatDate(b.created_at)}</p>
                        </div>
                      </div>
                    </td>

                    {/* Vendeur / Propriétaire */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-xs font-bold shrink-0">
                          {b.owner?.avatar_url ? (
                            <img src={b.owner.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                          ) : (
                            <span>{b.nomCompletProprio.charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <span className="font-bold text-gray-900 block truncate">{b.nomCompletProprio}</span>
                          <span className="text-[10px] text-gray-500 block truncate">{b.emailProprio}</span>
                        </div>
                      </div>
                    </td>

                    {/* Localisation */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <i className="fa-solid fa-location-dot text-emerald-600 text-xs"></i>
                        <span className="font-medium text-gray-800">
                          {[b.quartier, b.ville].filter(Boolean).join(", ") || "Sénégal"}
                        </span>
                      </div>
                      {Number.isFinite(b.latitude) && Number.isFinite(b.longitude) && (
                        <a
                          href={`https://maps.google.com/?q=${b.latitude},${b.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-sky-600 hover:underline inline-flex items-center gap-1 mt-0.5"
                        >
                          <i className="fa-solid fa-arrow-up-right-from-square text-[8px]"></i>
                          <span>Voir sur Google Maps</span>
                        </a>
                      )}
                    </td>

                    {/* Articles & Stock */}
                    <td className="py-3.5 px-4">
                      <div>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <i className="fa-solid fa-box text-[9px]"></i>
                          {b.items.length} article{b.items.length > 1 ? "s" : ""}
                        </span>
                        {b.valeurStock > 0 && (
                          <p className="text-[10px] font-bold text-gray-500 mt-1">
                            Valeur : {prixLisible(b.valeurStock)} F
                          </p>
                        )}
                      </div>
                    </td>

                    {/* Contact WhatsApp */}
                    <td className="py-3.5 px-4">
                      {b.telWhatsapp ? (
                        <a
                          href={`https://wa.me/${b.telWhatsapp.replace(/[^0-9]/g, "")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-extrabold text-[11px] rounded-full border border-emerald-200 transition cursor-pointer"
                        >
                          <i className="fa-brands fa-whatsapp text-emerald-600"></i>
                          <span>{b.telWhatsapp}</span>
                        </a>
                      ) : (
                        <span className="text-gray-400 italic text-[11px]">Non renseigné</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedStore(b)}
                          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-xl transition cursor-pointer"
                        >
                          Détails
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* VUE GRILLE DE CARTES */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {boutiquesFiltrees.map((b) => (
            <div
              key={b.id}
              className="bg-white rounded-3xl border border-gray-200 shadow-xs p-5 hover:shadow-md transition flex flex-col justify-between"
            >
              <div>
                {/* En-tête de la carte */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center shrink-0">
                      {b.photo ? (
                        <img src={urlPhoto(b.photo)} alt={b.nom} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-2xl">🏪</span>
                      )}
                    </div>
                    <div>
                      <h3 className="font-extrabold text-gray-900 text-sm leading-tight flex items-center gap-1.5">
                        <span>{b.nom}</span>
                        {b.estCertifie && <span className="text-blue-600 text-xs">✓</span>}
                      </h3>
                      <p className="text-xs text-gray-500 font-medium">
                        {[b.quartier, b.ville].filter(Boolean).join(", ") || "Dakar, Sénégal"}
                      </p>
                    </div>
                  </div>

                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                    {b.items.length} art.
                  </span>
                </div>

                {/* Vendeur & Coordonnées */}
                <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 mb-3 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between text-gray-600">
                    <span className="font-bold text-gray-500">Vendeur :</span>
                    <span className="font-extrabold text-gray-900">{b.nomCompletProprio}</span>
                  </div>
                  <div className="flex items-center justify-between text-gray-600">
                    <span className="font-bold text-gray-500">Email :</span>
                    <span className="font-medium text-gray-800 truncate max-w-[150px]">{b.emailProprio}</span>
                  </div>
                  {b.telWhatsapp && (
                    <div className="flex items-center justify-between text-gray-600">
                      <span className="font-bold text-gray-500">WhatsApp :</span>
                      <span className="font-extrabold text-emerald-700">{b.telWhatsapp}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions Bas de Carte */}
              <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setSelectedStore(b)}
                  className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-xl transition cursor-pointer text-center"
                >
                  Voir la fiche
                </button>
                {b.telWhatsapp && (
                  <a
                    href={`https://wa.me/${b.telWhatsapp.replace(/[^0-9]/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center"
                    title="Contacter sur WhatsApp"
                  >
                    <i className="fa-brands fa-whatsapp"></i>
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 4. MODAL / FICHE DÉTAILLÉE DE LA BOUTIQUE */}
      {selectedStore && (
        <div
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-3xl border border-gray-200 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200 flex items-start justify-between gap-4 bg-gradient-to-r from-emerald-50/50 to-white">
              <div className="flex items-center gap-3.5">
                <div className="w-14 h-14 rounded-2xl bg-white border border-gray-200 shadow-xs overflow-hidden flex items-center justify-center shrink-0">
                  {selectedStore.photo ? (
                    <img src={urlPhoto(selectedStore.photo)} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl">🏪</span>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-gray-900">{selectedStore.nom}</h3>
                    {selectedStore.estCertifie && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800">
                        Certifiée
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 font-medium">
                    {[selectedStore.quartier, selectedStore.ville].filter(Boolean).join(", ") || "Sénégal"} · Créée le{" "}
                    {formatDate(selectedStore.created_at)}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedStore(null)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Coordonnées du Vendeur */}
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                <h4 className="text-xs font-black text-gray-500 uppercase tracking-wider mb-3">
                  Informations du Propriétaire
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-gray-400 block text-[10px] uppercase font-bold">Nom du vendeur</span>
                    <span className="font-extrabold text-gray-900">{selectedStore.nomCompletProprio}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px] uppercase font-bold">Email du compte</span>
                    <span className="font-medium text-gray-900">{selectedStore.emailProprio}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px] uppercase font-bold">Téléphone / WhatsApp</span>
                    <span className="font-extrabold text-emerald-700">
                      {selectedStore.telWhatsapp || "Non renseigné"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px] uppercase font-bold">ID Propriétaire</span>
                    <span className="font-mono text-[11px] text-gray-600">{selectedStore.owner_id}</span>
                  </div>
                </div>

                {selectedStore.telWhatsapp && (
                  <div className="mt-4 pt-3 border-t border-gray-200 flex gap-2">
                    <a
                      href={`https://wa.me/${selectedStore.telWhatsapp.replace(/[^0-9]/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl transition cursor-pointer flex items-center gap-2 shadow-xs"
                    >
                      <i className="fa-brands fa-whatsapp text-sm"></i>
                      <span>Discuter sur WhatsApp</span>
                    </a>
                  </div>
                )}
              </div>

              {/* Articles mis en vente par cette boutique */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-black text-gray-500 uppercase tracking-wider">
                    Articles en vente ({selectedStore.items.length})
                  </h4>
                  <span className="text-xs font-bold text-gray-600">
                    Valeur totale : {prixLisible(selectedStore.valeurStock)} FCFA
                  </span>
                </div>

                {selectedStore.items.length === 0 ? (
                  <div className="p-6 bg-gray-50 rounded-2xl text-center text-gray-400 italic text-xs">
                    Aucun article mis en ligne pour le moment.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-1">
                    {selectedStore.items.map((art) => (
                      <div
                        key={art.id}
                        className="p-3 bg-gray-50 rounded-2xl border border-gray-200 flex items-center gap-3"
                      >
                        <div className="w-12 h-12 rounded-xl bg-gray-200 overflow-hidden flex items-center justify-center shrink-0">
                          {art.photo_url || (art.photos && art.photos[0]) ? (
                            <img
                              src={urlPhoto(art.photo_url || art.photos[0])}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-lg">📦</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="font-extrabold text-gray-900 text-xs block truncate">{art.titre}</span>
                          <div className="flex items-center justify-between gap-2 mt-0.5">
                            <span className="text-xs font-black text-emerald-700">{prixLisible(art.prix)} F</span>
                            <span
                              className={`px-1.5 py-0.2 text-[9px] font-black rounded-md ${
                                art.statut === "en_stock"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-gray-200 text-gray-700"
                              }`}
                            >
                              {art.statut || "en stock"}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
              <span className="text-xs text-gray-500 font-medium">ID Boutique : {selectedStore.id}</span>
              <button
                type="button"
                onClick={() => setSelectedStore(null)}
                className="px-5 py-2 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

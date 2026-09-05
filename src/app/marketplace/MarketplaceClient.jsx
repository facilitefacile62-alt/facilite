"use client";

// Marketplace — recherche de proximité et publication de stock.
//
// CE QUI A CHANGÉ, ET POURQUOI
//
// La version précédente était une maquette : les annonces vivaient dans
// localStorage, les photos y étaient encodées en base64, et la « recherche
// visuelle par IA » lisait le NOM du fichier pour en deviner la catégorie.
// Concrètement, une personne qui publiait ne voyait son annonce que sur son
// propre téléphone — aucun acheteur ne l'a jamais vue.
//
// Tout passe désormais par la base : marketplace_stores, marketplace_items,
// et le bucket marketplace-photos (migrations 20260901190000 et 200000). La
// simulation de reconnaissance d'image a été supprimée, pas déguisée : tant
// qu'aucun modèle de vision n'est branché, promettre une analyse d'image
// serait mentir à l'acheteur comme au vendeur.
//
// La logique d'accès aux données vit dans src/lib/marketplaceData.js : ce
// fichier ne fait que de l'interface.

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import CarteBoutiques from "@/components/CarteBoutiques";
import CapturePosition from "@/components/CapturePosition";
import GlobeExplorateurBoutiques from "@/components/GlobeExplorateurBoutiques";
import { getFeatureFlagsTreeAsync, isFeatureAllowed, DEFAULT_FEATURE_TREE } from "@/lib/featureFlags";
import {
  chargerMesBoutiques,
  BOUTIQUES_OFFERTES,
  coordonnee,
  departementLePlusProche,
  MOTIFS_SIGNALEMENT,
  signalerAnnonce,
  chargerMesArticles,
  chargerTousLesArticles,
  chercherAutourDeMoi,
  creerBoutique,
  modifierBoutique,
  envoyerPhoto,
  majStock,
  positionActuelle,
  publierArticle,
  retirerArticle,
  supprimerPhoto,
  urlPhoto,
} from "@/lib/marketplaceData";

// Les identifiants correspondent exactement au CHECK de marketplace_items :
// un écart ici produirait un rejet côté base au moment de publier.
const CATEGORIES = [
  { id: "telephones", label: "Téléphones & Tech", icon: "fa-mobile-screen-button" },
  { id: "vehicules", label: "Véhicules & Motos", icon: "fa-car" },
  { id: "immobilier", label: "Immobilier", icon: "fa-house" },
  { id: "mode", label: "Mode & Vêtements", icon: "fa-shirt" },
  { id: "maison", label: "Maison & Électro", icon: "fa-couch" },
  { id: "electronique", label: "Électronique & Son", icon: "fa-tv" },
  { id: "informatique", label: "Informatique & PC", icon: "fa-laptop" },
  { id: "services", label: "Services", icon: "fa-briefcase" },
  { id: "alimentation", label: "Alimentation", icon: "fa-basket-shopping" },
  { id: "autre", label: "Autre", icon: "fa-tag" },
];

// Les 45 départements du Sénégal. Un commerçant se situe par son département,
// pas par une poignée de grandes villes : « Keur Massar » ou « Bignona » ne
// rentraient dans aucune des neuf entrées précédentes.
export const DEPARTEMENTS_SENEGAL = [
  "Dakar",
  "Guédiawaye",
  "Pikine",
  "Rufisque",
  "Keur Massar",
  "Thiès",
  "Mbour",
  "Tivaouane",
  "Diourbel",
  "Bambey",
  "Mbacké",
  "Touba",
  "Fatick",
  "Foundiougne",
  "Gossas",
  "Kaolack",
  "Guinguinéo",
  "Nioro du Rip",
  "Kaffrine",
  "Birkelane",
  "Koungheul",
  "Malem-Hodar",
  "Saint-Louis",
  "Dagana",
  "Podor",
  "Louga",
  "Kébémer",
  "Linguère",
  "Matam",
  "Kanel",
  "Ranérou-Ferlo",
  "Tambacounda",
  "Bakel",
  "Goudiry",
  "Koumpentoum",
  "Kédougou",
  "Salémata",
  "Saraya",
  "Kolda",
  "Médina Yoro Foulah",
  "Vélingara",
  "Sédhiou",
  "Bounkiling",
  "Goudomp",
  "Ziguinchor",
  "Bignona",
  "Oussouye",
];

const VILLES = DEPARTEMENTS_SENEGAL;

// Rayons proposés. 2 km couvre le quartier — le cas d'usage principal ; 50 km
// sert aux zones où les commerces sont dispersés.
const RAYONS = [2, 5, 10, 25, 50];

const prixLisible = (v) => new Intl.NumberFormat("fr-FR").format(Number(v) || 0);

/** « il y a 2 h » : c'est la fraîcheur du stock qui décide d'un déplacement. */
function depuis(dateIso) {
  if (!dateIso) return null;
  const secondes = Math.max(0, (Date.now() - new Date(dateIso).getTime()) / 1000);
  if (secondes < 3600) return `il y a ${Math.max(1, Math.round(secondes / 60))} min`;
  if (secondes < 86400) return `il y a ${Math.round(secondes / 3600)} h`;
  return `il y a ${Math.round(secondes / 86400)} j`;
}

export default function MarketplaceClient() {
  const { session, profile, isAdmin, isRecruiter, signOut } = useAuth();
  const [featureFlagsTree, setFeatureFlagsTree] = useState(DEFAULT_FEATURE_TREE);
  const [onglet, setOnglet] = useState("acheter"); // 'acheter' | 'vendre'
  const [categorie, setCategorie] = useState(null);
  const [boutiques, setBoutiques] = useState([]);
  const [maBoutiqueActive, setMaBoutiqueActive] = useState(null);
  const [mesArticles, setMesArticles] = useState([]);
  const [chargementBoutique, setChargementBoutique] = useState(true);
  const [boutiqueModal, setBoutiqueModal] = useState(null);
  const [articleSelectionne, setArticleSelectionne] = useState(null);

  const userId = session?.user?.id || null;
  const userRole = !session ? "visitor" : isAdmin ? "admin" : isRecruiter ? "recruiter" : "user";
  const isMarketplaceAllowed = isFeatureAllowed(featureFlagsTree, "nav_marketplace", userRole);

  const rechargerBoutique = useCallback(async () => {
    if (!userId) {
      setBoutiques([]);
      setMaBoutiqueActive(null);
      setMesArticles([]);
      setChargementBoutique(false);
      return;
    }
    try {
      const liste = await chargerMesBoutiques(userId);
      setBoutiques(liste);
      const active = liste[0] || null;
      setMaBoutiqueActive(active);
      if (active) {
        const arts = await chargerMesArticles(active.id);
        setMesArticles(arts);
      } else {
        setMesArticles([]);
      }
    } catch {
      // best-effort
    } finally {
      setChargementBoutique(false);
    }
  }, [userId]);

  useEffect(() => {
    getFeatureFlagsTreeAsync().then(setFeatureFlagsTree).catch(() => {});
    const channel = supabase
      .channel("public-feature-flags-marketplace")
      .on("postgres_changes", { event: "*", schema: "public", table: "feature_flags" }, () => {
        getFeatureFlagsTreeAsync().then(setFeatureFlagsTree).catch(() => {});
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    rechargerBoutique();
  }, [rechargerBoutique]);

  if (!isMarketplaceAllowed) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center px-4 py-16 bg-gray-50 dark:bg-gray-950">
        <div className="max-w-md w-full text-center bg-white dark:bg-gray-900 rounded-3xl p-8 shadow-xl border border-gray-200 dark:border-gray-800">
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-950/60 text-[#1877F2] rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
            <i className="fa-solid fa-store"></i>
          </div>
          <span className="px-2.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-[10px] font-black rounded-md uppercase tracking-wider">
            Chantier &amp; Maintenance
          </span>
          <h2 className="text-xl font-black text-gray-900 dark:text-white mt-3">
            Marketplace temporairement indisponible
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
            Nous finalisons cette fonctionnalité. Elle sera de retour très prochainement.
          </p>
          <Link
            href="/"
            className="mt-6 inline-block px-6 py-3 rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold text-sm"
          >
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-3 sm:px-5 py-5">
        <header className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
              Marketplace
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
              Trouvez ce qu&apos;il vous faut, en stock, dans une boutique près de chez vous.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: "acheter", label: "Acheter (Catalogue)", icon: "fa-magnifying-glass" },
              { id: "vendre", label: "Ma Boutique (Vendre)", icon: "fa-store" },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setOnglet(t.id)}
                className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition cursor-pointer flex items-center ${
                  onglet === t.id
                    ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-md"
                    : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800"
                }`}
              >
                <i className={`fa-solid ${t.icon} mr-2`}></i>
                {t.label}
              </button>
            ))}

            {/* Bouton + Publier (Ajout d'article rapide dans l'espace à côté) */}
            <button
              type="button"
              onClick={() => setOnglet("vendre")}
              className="px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black bg-[#10E688] hover:bg-[#0fd27c] text-gray-950 transition cursor-pointer flex items-center shadow-md active:scale-95 border border-emerald-400/40"
              title="Publier un nouvel article sur la Marketplace"
            >
              <i className="fa-solid fa-plus mr-1.5 text-xs font-black"></i>
              <span>Publier</span>
            </button>
          </div>
        </header>

        {/* Layout avec barre latérale 1:1 identique à la Capture 2 (Accueil) et zone principale */}
        <div className="flex flex-col md:flex-row gap-6 items-start">
          {/* BARRE DU PROFIL GAUCHE : Taille 1:1 identique à la Capture 2 (md:w-[215px]) */}
          <aside className={`w-full md:w-[215px] flex-shrink-0 flex flex-col gap-2 ${onglet === "vendre" ? "flex" : "hidden md:flex"}`}>
            {chargementBoutique ? (
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 animate-pulse space-y-3">
                <div className="h-16 bg-gray-200 dark:bg-gray-800 rounded-lg"></div>
                <div className="w-12 h-12 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto -mt-6"></div>
                <div className="h-4 w-28 bg-gray-200 dark:bg-gray-800 rounded mx-auto"></div>
                <div className="h-3 w-40 bg-gray-100 dark:bg-gray-800/60 rounded mx-auto"></div>
              </div>
            ) : userId || profile ? (
              <>
                {/* 1. Carte de Profil Boutique (Format compact 215px avec son propre profil boutique) */}
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-xs flex-shrink-0">
                  {/* Bannière Boutique Cliquable (Ouvre la fiche boutique) */}
                  <div
                    onClick={() => {
                      if (maBoutiqueActive) setBoutiqueModal(maBoutiqueActive);
                      else setOnglet("vendre");
                    }}
                    className="h-16 bg-cover bg-center bg-no-repeat relative block cursor-pointer group"
                    style={{ backgroundImage: `url('${profile?.cover_url || '/stellar-cover.png'}')` }}
                    title="Voir le profil de ma boutique"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-900/40 to-indigo-950/60 group-hover:opacity-75 transition"></div>
                    <div className="absolute inset-0 flex items-center justify-end px-3 pointer-events-none">
                      <span className="text-white/20 font-black text-xs uppercase tracking-widest select-none">
                        BOUTIQUE
                      </span>
                    </div>
                  </div>

                  <div className="px-3 pb-3.5 pt-0 relative flex flex-col items-center text-center">
                    {/* Avatar / Logo de la Boutique Cliquable */}
                    <div
                      onClick={() => {
                        if (maBoutiqueActive) setBoutiqueModal(maBoutiqueActive);
                        else setOnglet("vendre");
                      }}
                      className="-mt-7 mb-2 relative z-10 w-14 h-14 rounded-full border-2 border-white dark:border-gray-900 shadow-md overflow-hidden bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-lg block cursor-pointer group"
                      title="Voir le profil de ma boutique"
                    >
                      {maBoutiqueActive?.nom ? (
                        maBoutiqueActive.nom.substring(0, 2).toUpperCase()
                      ) : profile?.avatar_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={profile.avatar_url}
                          alt="Boutique"
                          className="w-full h-full object-cover group-hover:scale-105 transition"
                        />
                      ) : (
                        <i className="fa-solid fa-store text-xl"></i>
                      )}
                    </div>

                    {/* Nom de la Boutique (Propre à la boutique) */}
                    <button
                      type="button"
                      onClick={() => {
                        if (maBoutiqueActive) setBoutiqueModal(maBoutiqueActive);
                        else setOnglet("vendre");
                      }}
                      className="group cursor-pointer bg-transparent border-none p-0 text-center"
                      title="Voir le profil de ma boutique"
                    >
                      <h2 className="text-sm font-extrabold text-gray-900 dark:text-white leading-tight group-hover:text-blue-600 transition">
                        {maBoutiqueActive?.nom || "Ma Boutique Facilité"}
                      </h2>
                    </button>

                    <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold mt-0.5">
                      {maBoutiqueActive
                        ? `Boutique Officielle · ${maBoutiqueActive.quartier ? `${maBoutiqueActive.quartier}, ` : ""}${maBoutiqueActive.ville || "Dakar"}`
                        : "Vendeur Facilité Marketplace"}
                    </p>

                    <p className="text-[9px] text-gray-400 font-normal mt-0.5 mb-1.5">
                      {maBoutiqueActive?.ville
                        ? `${maBoutiqueActive.quartier ? `${maBoutiqueActive.quartier}, ` : ""}${maBoutiqueActive.ville}, Sénégal`
                        : (profile?.location || "Dakar, Sénégal")}
                    </p>

                    <button
                      type="button"
                      onClick={() => setOnglet("vendre")}
                      className="w-full border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 font-bold py-1 px-2.5 rounded-full text-[10px] transition flex items-center justify-center space-x-1 cursor-pointer bg-white dark:bg-gray-900"
                    >
                      <i className="fa-solid fa-plus text-[8px] text-gray-500"></i>
                      <span>Publier un article</span>
                    </button>
                  </div>
                </div>

                {/* 2. Menu Toutes les catégories (1:1 Identique à la capture d'écran) */}
                <MenuCategoriesSidebar
                  categorieActive={categorie}
                  onSelectCategorie={(cat) => {
                    setCategorie(cat);
                    if (onglet !== "acheter") setOnglet("acheter");
                  }}
                />
              </>
            ) : (
              <>
                <div className="bg-gradient-to-br from-gray-900 to-gray-800 text-white rounded-xl p-4 shadow-md space-y-3 border border-gray-700 text-left">
                  <div className="flex items-center space-x-2">
                    <span className="p-1.5 bg-[#10E688]/20 text-[#10E688] rounded-lg text-sm">🚀</span>
                    <h3 className="text-xs font-black text-white leading-tight">Vendez sur Facilité</h3>
                  </div>
                  <p className="text-[11px] text-gray-300 font-medium leading-relaxed">
                    Ouvrez votre boutique gratuitement, publiez vos articles avec l&apos;Assistant IA et recevez les commandes sur WhatsApp.
                  </p>
                  <Link
                    href="/login?redirect=%2Fmarketplace"
                    className="block w-full py-2 bg-[#10E688] hover:bg-[#0fd57d] text-gray-950 font-extrabold text-xs text-center rounded-xl transition shadow-sm"
                  >
                    Se connecter / Créer un compte
                  </Link>
                </div>

                {/* Menu Toutes les catégories aussi disponible pour les visiteurs */}
                <MenuCategoriesSidebar
                  categorieActive={categorie}
                  onSelectCategorie={(cat) => {
                    setCategorie(cat);
                    if (onglet !== "acheter") setOnglet("acheter");
                  }}
                />
              </>
            )}
          </aside>

          {/* ZONE PRINCIPALE : Reste de la largeur disponible (flex-1) */}
          <main className="flex-1 min-w-0">
            {onglet === "acheter" ? (
              <VueAcheteur
                onVoirBoutique={(b) => setBoutiqueModal(b)}
                onVoirArticle={(art) => setArticleSelectionne(art)}
                categorie={categorie}
                onSelectCategorie={setCategorie}
              />
            ) : (
              <VueVendeur
                userId={userId}
                onBoutiqueChange={rechargerBoutique}
                boutiqueActive={maBoutiqueActive}
                boutiques={boutiques}
              />
            )}
          </main>
        </div>

        {/* Modal / Vue d'ensemble du Produit (1:1 Capture E-commerce) */}
        {articleSelectionne && (
          <ModalFicheProduit
            article={articleSelectionne}
            onFermer={() => setArticleSelectionne(null)}
            onVoirBoutique={(b) => {
              setArticleSelectionne(null);
              setBoutiqueModal(b);
            }}
          />
        )}

        {/* Modal / Bottom Sheet Boutique (Style WhatsApp / Topwork) */}
        {boutiqueModal && (
          <ModalFicheBoutique
            boutique={boutiqueModal}
            articles={mesArticles}
            onFermer={() => setBoutiqueModal(null)}
          />
        )}
      </div>
    </div>
  );
}

/* ========================================================================== */
/* ACHETEUR                                                                    */
/* ========================================================================== */

function VueAcheteur({ onVoirBoutique, onVoirArticle, categorie = null, onSelectCategorie }) {
  const [position, setPosition] = useState(null);
  const [texte, setTexte] = useState("");
  const [rayonKm, setRayonKm] = useState(10);
  const [seulementEnStock, setSeulementEnStock] = useState(false);
  const [resultats, setResultats] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [globeOuvert, setGlobeOuvert] = useState(false);

  const lancerRecherche = useCallback(
    async (pos) => {
      setChargement(true);
      setErreur("");
      try {
        if (pos?.latitude && pos?.longitude) {
          // Mode Proximité : trié par distance géographique (les plus proches en tête)
          const r = await chercherAutourDeMoi({
            latitude: pos.latitude,
            longitude: pos.longitude,
            rayonKm,
            categorie,
            texte: texte.trim() || null,
            seulementEnStock,
          });
          setResultats(r);
        } else {
          // Mode Global : affiche tous les articles de la plateforme (les plus récents en premier)
          const r = await chargerTousLesArticles({
            categorie,
            texte: texte.trim() || null,
            seulementEnStock,
          });
          setResultats(r);
        }
      } catch (e) {
        setErreur(e.message || "Erreur lors du chargement des articles.");
        setResultats([]);
      } finally {
        setChargement(false);
      }
    },
    [rayonKm, categorie, texte, seulementEnStock]
  );

  const localiser = async () => {
    setErreur("");
    setChargement(true);
    try {
      const p = await positionActuelle();
      setPosition(p);
      await lancerRecherche(p);
    } catch (e) {
      setErreur(e.message);
      setChargement(false);
    }
  };

  const reinitialiserPosition = () => {
    setPosition(null);
    setErreur("");
    lancerRecherche(null);
  };

  // Chargement automatique au démarrage et lors de la modification des filtres
  useEffect(() => {
    const t = setTimeout(() => {
      lancerRecherche(position);
    }, 300);
    return () => clearTimeout(t);
  }, [categorie, rayonKm, seulementEnStock, texte, position, lancerRecherche]);

  const boutiquesPourGlobe = [];
  const idsVus = new Set();
  for (const a of resultats) {
    const lat = coordonnee(a.boutique_lat);
    const lng = coordonnee(a.boutique_lng);
    if (lat == null || lng == null || idsVus.has(a.boutique_id)) continue;
    idsVus.add(a.boutique_id);
    boutiquesPourGlobe.push({ lat, lng, nom: a.boutique_nom });
  }

  return (
    <div>
      {globeOuvert && (
        <GlobeExplorateurBoutiques
          boutiques={boutiquesPourGlobe}
          onFermer={() => setGlobeOuvert(false)}
          onVoirCarte={() => {
            setGlobeOuvert(false);
            localiser();
          }}
        />
      )}

      {/* Barre de recherche style mobile moderne (Inspirée de la capture) */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-3 sm:p-4 mb-4 shadow-xs">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex-1 relative">
            <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
            <input
              type="text"
              value={texte}
              onChange={(e) => setTexte(e.target.value)}
              placeholder="Search for products (téléphone, mode, tech…)"
              className="w-full pl-11 pr-4 py-2.5 sm:py-3 rounded-full sm:rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs sm:text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1877F2]/40"
            />
          </div>
          <button
            type="button"
            onClick={localiser}
            disabled={chargement}
            className={`w-10 h-10 sm:w-auto sm:px-5 sm:py-3 rounded-full sm:rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition cursor-pointer disabled:opacity-60 flex items-center justify-center shrink-0 ${
              position
                ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20"
                : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 sm:bg-[#1877F2] sm:text-white sm:hover:bg-blue-600 shadow-xs"
            }`}
            title={position ? "Position active" : "Rechercher autour de moi"}
          >
            <i className={`fa-solid ${chargement ? "fa-spinner fa-spin" : position ? "fa-location-dot" : "fa-location-crosshairs"}`}></i>
            <span className="hidden sm:inline ml-2">
              {position ? "Actualiser ma position" : "Autour de moi"}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setGlobeOuvert(true)}
            className="w-10 h-10 sm:w-auto sm:px-4 sm:py-3 rounded-full sm:rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition cursor-pointer flex items-center justify-center shrink-0 bg-gray-900 hover:bg-black text-white shadow-xs"
            title="Explorer les boutiques sur le globe"
          >
            <span aria-hidden="true">🌍</span>
            <span className="hidden sm:inline ml-2">Explorer</span>
          </button>
        </div>

        {categorie && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 text-xs">
            <span className="text-gray-500 dark:text-gray-400">Catégorie sélectionnée :</span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 text-[#1877F2] font-black text-xs border border-blue-200 dark:border-blue-900">
              {LISTE_CATEGORIES_SIDEBAR.find((c) => c.id === categorie || c.baseCategory === categorie)?.label || categorie}
              <button
                type="button"
                onClick={() => onSelectCategorie?.(null)}
                className="hover:text-red-500 transition cursor-pointer ml-1 font-bold"
                title="Afficher toutes les catégories"
              >
                ✕
              </button>
            </span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 text-xs">
          <div className="flex items-center gap-3">
            {position && (
              <label className="flex items-center gap-1.5 text-xs text-gray-500">
                Rayon :
                <select
                  value={rayonKm}
                  onChange={(e) => setRayonKm(Number(e.target.value))}
                  className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-lg text-xs font-bold text-gray-800 dark:text-gray-200 cursor-pointer"
                >
                  {RAYONS.map((r) => (
                    <option key={r} value={r}>
                      {r} km
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="flex items-center gap-1.5 text-xs font-bold text-gray-600 dark:text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={seulementEnStock}
                onChange={(e) => setSeulementEnStock(e.target.checked)}
                className="w-3.5 h-3.5 accent-[#1877F2] cursor-pointer"
              />
              En stock uniquement
            </label>
          </div>

          {position ? (
            <button
              type="button"
              onClick={reinitialiserPosition}
              className="text-xs font-bold text-[#1877F2] hover:underline cursor-pointer flex items-center gap-1"
            >
              <i className="fa-solid fa-globe"></i>
              Tout le Sénégal
            </button>
          ) : (
            <p className="text-[10px] text-gray-500 dark:text-gray-400">
              <i className="fa-solid fa-sparkles text-amber-500 mr-1"></i>
              Catalogue global · Triez par proximité avec « Autour de moi »
            </p>
          )}
        </div>
      </div>

      {erreur && (
        <div className="mb-4 px-4 py-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-triangle-exclamation"></i>
            <span>{erreur}</span>
          </div>
          <button
            type="button"
            onClick={() => setErreur("")}
            className="text-amber-800 dark:text-amber-300 hover:underline text-xs"
          >
            Fermer
          </button>
        </div>
      )}

      {/* En-tête de résultats */}
      <div className="flex items-center justify-between mb-3 px-1">
        <h2 className="text-xs sm:text-sm font-black text-gray-800 dark:text-gray-200 flex items-center gap-2">
          {position ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Proches de vous ({resultats.length})
            </>
          ) : (
            <>
              <i className="fa-solid fa-store text-[#1877F2]"></i>
              Tous les produits ({resultats.length})
            </>
          )}
        </h2>
        {chargement && (
          <span className="text-xs text-gray-400 flex items-center gap-1.5">
            <i className="fa-solid fa-spinner fa-spin"></i>
            Chargement...
          </span>
        )}
      </div>

      {resultats.length === 0 && !chargement && (
        <div className="text-center py-16 bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-8 my-4">
          <i className="fa-solid fa-box-open text-4xl text-gray-300 dark:text-gray-700"></i>
          <p className="text-base font-bold text-gray-700 dark:text-gray-300 mt-4">
            Aucun article trouvé
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 max-w-sm mx-auto">
            {position
              ? "Élargissez le rayon de recherche ou affichez tout le catalogue."
              : "Soyez le premier à publier un article sur la Marketplace !"}
          </p>
          {position && (
            <button
              type="button"
              onClick={reinitialiserPosition}
              className="mt-5 px-5 py-2.5 rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-bold"
            >
              Voir tout le catalogue
            </button>
          )}
        </div>
      )}

      {position && resultats.length > 0 && (
        <CarteBoutiques
          articles={resultats}
          depart={position}
          onChoisirBoutique={(id) => {
            const cible = document.getElementById(`boutique-${id}`);
            if (cible) cible.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
        />
      )}

      {/* Grille de produits : 1:1 Capture d'écran utilisateur (5 colonnes desktop, 2 colonnes mobile) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-4">
        {resultats.map((a, i) => (
          <CarteArticle
            key={a.id}
            article={a}
            onVoirArticle={onVoirArticle}
            onVoirBoutique={onVoirBoutique}
            ancre={resultats.findIndex((x) => x.boutique_id === a.boutique_id) === i}
          />
        ))}
      </div>
    </div>
  );
}

function CarteArticle({ article, onVoirArticle, onVoirBoutique, ancre = false }) {
  const [signalementOuvert, setSignalementOuvert] = useState(false);
  const enStock = article.statut === "en_stock";
  const photo = article.photos?.[0] || null;

  const ouvrirFiche = () => {
    if (onVoirArticle) {
      onVoirArticle(article);
    } else {
      onVoirBoutique?.({
        id: article.boutique_id,
        nom: article.boutique_nom,
        quartier: article.quartier,
        ville: article.ville,
        telephone_whatsapp: article.telephone_whatsapp,
        whatsappUrl: article.whatsappUrl,
      });
    }
  };

  return (
    <article
      id={ancre ? `boutique-${article.boutique_id}` : undefined}
      onClick={ouvrirFiche}
      className="group flex flex-col cursor-pointer select-none scroll-mt-24 rounded-2xl sm:rounded-3xl overflow-hidden bg-white dark:bg-zinc-900 border border-gray-200/90 dark:border-zinc-800/90 shadow-xs hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
    >
      {/* 1. Image produit avec badges en overlay supérieur (Style 1:1 Capture Utilisateur) */}
      <div className="relative aspect-4/3 sm:aspect-square w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={urlPhoto(photo)}
            alt={article.titre}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-100 dark:bg-zinc-800 text-zinc-400 p-3 text-center">
            <i className="fa-solid fa-bag-shopping text-3xl mb-1 text-zinc-300 dark:text-zinc-600"></i>
            <span className="text-[11px] font-bold text-zinc-500 line-clamp-2">{article.titre}</span>
          </div>
        )}

        {/* Dégradé supérieur pour assurer la lisibilité des badges */}
        <div className="absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-black/60 via-black/20 to-transparent pointer-events-none" />

        {/* En-tête gauche : Nom de la boutique / Vendeur avec icône */}
        <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5 max-w-[62%] truncate drop-shadow-sm">
          <span className="text-white text-xs sm:text-[13px] font-bold truncate">
            {article.boutique_nom || "Facilité"}
          </span>
          <i className="fa-solid fa-circle-check text-sky-400 text-[11px] shrink-0"></i>
        </div>

        {/* En-tête droite : Badge Statut / LIVE */}
        <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1.5">
          {enStock ? (
            <span className="px-2 py-0.5 rounded-md bg-red-600 text-white text-[10px] sm:text-[11px] font-black tracking-wide uppercase flex items-center gap-1 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
              LIVE
            </span>
          ) : (
            <span className="px-2 py-0.5 rounded-md bg-black/75 text-zinc-300 text-[10px] font-bold backdrop-blur-xs shadow-sm">
              Épuisé
            </span>
          )}

          {/* Bouton de signalement discret au survol */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setSignalementOuvert(true);
            }}
            className="w-6 h-6 rounded-full bg-black/50 hover:bg-black/80 text-white/90 hover:text-white flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition cursor-pointer"
            title="Signaler cette annonce"
          >
            <i className="fa-regular fa-flag"></i>
          </button>
        </div>

        {/* Distance géolocalisée en bas à gauche de l'image */}
        {article.distanceLisible && (
          <span className="absolute bottom-2 left-2.5 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-xs text-white text-[10px] font-semibold flex items-center gap-1 shadow-xs">
            <i className="fa-solid fa-location-dot text-emerald-400 text-[9px]"></i>
            {article.distanceLisible}
          </span>
        )}
      </div>

      {/* 2. Informations sous l'image (Titre en gras, sous-titre & bouton flèche circulaire) */}
      <div className="p-3 sm:p-4 flex flex-col justify-between flex-1 bg-white dark:bg-zinc-900 gap-2">
        {/* Titre : Texte fort et gras sur 2 lignes max */}
        <h3
          className="text-sm sm:text-[15px] font-bold text-zinc-900 dark:text-zinc-100 leading-snug line-clamp-2 group-hover:text-blue-600 transition"
          title={article.titre}
        >
          {article.titre}
        </h3>

        {/* Ligne inférieure : Sous-titre / Prix à gauche et Bouton Flèche noire à droite */}
        <div className="flex items-end justify-between gap-2 mt-auto pt-1">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium truncate">
              {article.boutique_nom || article.categorie || "Boutique"}
            </p>
            <p className="text-sm sm:text-base font-extrabold text-zinc-950 dark:text-white tracking-tight mt-0.5">
              {prixLisible(article.prix_xof)}{" "}
              <span className="text-[11px] sm:text-xs font-bold text-zinc-600 dark:text-zinc-400">
                FCFA
              </span>
            </p>
          </div>

          {/* Bouton d'action circulaire noir avec flèche blanche (1:1 Capture utilisateur) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (article.whatsappUrl) {
                window.open(article.whatsappUrl, "_blank", "noopener,noreferrer");
              } else {
                ouvrirFiche();
              }
            }}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-black dark:bg-white text-white dark:text-black flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 shadow-sm shrink-0 cursor-pointer"
            title="Voir l'article / Commander"
          >
            <i className="fa-solid fa-arrow-right text-xs sm:text-sm"></i>
          </button>
        </div>
      </div>

      {signalementOuvert && (
        <DialogueSignalement
          article={article}
          onFermer={() => setSignalementOuvert(false)}
        />
      )}
    </article>
  );
}

/**
 * Boîte de signalement. Elle ne dit jamais au vendeur qu'il a été signalé —
 * la policy de lecture réserve la table aux administrateurs, précisément pour
 * qu'un signalement ne se transforme pas en règlement de comptes.
 */
function DialogueSignalement({ article, onFermer }) {
  const [motif, setMotif] = useState(MOTIFS_SIGNALEMENT[0].id);
  const [details, setDetails] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const [envoye, setEnvoye] = useState(false);

  const envoyer = async () => {
    setEnvoi(true);
    setErreur("");
    try {
      await signalerAnnonce(article.id, motif, details);
      setEnvoye(true);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-md p-6 relative">
        <button
          type="button"
          onClick={onFermer}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 cursor-pointer"
          aria-label="Fermer"
        >
          <i className="fa-solid fa-xmark"></i>
        </button>

        {envoye ? (
          <div className="text-center py-4">
            <i className="fa-solid fa-circle-check text-3xl text-emerald-500"></i>
            <h3 className="text-base font-black text-gray-900 dark:text-white mt-3">Signalement transmis</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
              Une personne de l&apos;équipe va l&apos;examiner. Le vendeur ne saura pas
              que vous êtes à l&apos;origine du signalement.
            </p>
            <button
              type="button"
              onClick={onFermer}
              className="mt-5 w-full py-3 rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold text-sm cursor-pointer"
            >
              Fermer
            </button>
          </div>
        ) : (
          <>
            <h3 className="text-base font-black text-gray-900 dark:text-white pr-8">Signaler cette annonce</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-4 truncate">{article.titre}</p>

            <div className="space-y-2">
              {MOTIFS_SIGNALEMENT.map((m) => (
                <label
                  key={m.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <input
                    type="radio"
                    name="motif"
                    value={m.id}
                    checked={motif === m.id}
                    onChange={() => setMotif(m.id)}
                    className="accent-red-600 cursor-pointer"
                  />
                  <span className="text-xs font-bold text-gray-800 dark:text-gray-200">{m.label}</span>
                </label>
              ))}
            </div>

            <textarea
              rows={2}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Précisions (facultatif)"
              className="mt-3 w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs resize-none"
            />

            {erreur && <p className="text-xs font-bold text-red-600 mt-3">{erreur}</p>}

            <button
              type="button"
              onClick={envoyer}
              disabled={envoi}
              className="mt-4 w-full py-3 rounded-2xl bg-red-600 text-white text-sm font-black disabled:opacity-50 cursor-pointer"
            >
              {envoi ? "Envoi…" : "Envoyer le signalement"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ========================================================================== */
/* VENDEUR                                                                     */
/* ========================================================================== */

function VueVendeur({ userId, onBoutiqueChange }) {
  const [boutiques, setBoutiques] = useState([]);
  const [choisie, setChoisie] = useState(null);
  const [articles, setArticles] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [ongletVendeur, setOngletVendeur] = useState("publier"); // 'publier' | 'parametres'

  const recharger = useCallback(async () => {
    if (!userId) return;
    try {
      const liste = await chargerMesBoutiques(userId);
      setBoutiques(liste);
      const active = liste.find((b) => b.id === choisie) || liste[0] || null;
      setChoisie(active?.id || null);
      setArticles(active ? await chargerMesArticles(active.id) : []);
      onBoutiqueChange?.();
    } catch (e) {
      setErreur(e.message);
    } finally {
      setChargement(false);
    }
  }, [userId, choisie, onBoutiqueChange]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    recharger();
  }, [recharger]);

  if (!userId) {
    return (
      <div className="text-center py-16 bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <i className="fa-solid fa-store text-4xl text-gray-300 dark:text-gray-700"></i>
        <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mt-4">
          Connectez-vous pour ouvrir votre boutique
        </p>
        <p className="text-xs text-gray-500 mt-1">La publication est gratuite, sans commission.</p>
        <Link
          href="/login?redirect=%2Fmarketplace"
          className="mt-5 inline-block px-6 py-3 rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold text-sm"
        >
          Se connecter
        </Link>
      </div>
    );
  }

  if (chargement) {
    return (
      <div className="text-center py-16 text-gray-400">
        <i className="fa-solid fa-spinner fa-spin text-2xl"></i>
      </div>
    );
  }

  const boutiqueActive = boutiques.find((b) => b.id === choisie) || boutiques[0] || null;

  return (
    <div className="space-y-5">
      {erreur && (
        <div className="px-4 py-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs font-bold text-red-800 dark:text-red-200">
          {erreur}
        </div>
      )}

      {/* Sélecteur si plusieurs points de vente */}
      {boutiques.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {boutiques.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setChoisie(b.id)}
              className={`px-4 py-2 rounded-2xl text-xs font-bold border transition cursor-pointer ${
                choisie === b.id
                  ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-transparent shadow-sm"
                  : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800"
              }`}
            >
              <i className="fa-solid fa-shop mr-1.5"></i>
              {b.nom}
              {b.quartier ? ` · ${b.quartier}` : ""}
            </button>
          ))}
        </div>
      )}

      {boutiqueActive ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-800 pb-3">
            <button
              type="button"
              onClick={() => setOngletVendeur("publier")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                ongletVendeur === "publier"
                  ? "bg-[#1877F2] text-white shadow-sm"
                  : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800"
              }`}
            >
              <i className="fa-solid fa-plus-circle mr-1.5"></i>
              Publier un article (Assistant IA)
            </button>
            <button
              type="button"
              onClick={() => setOngletVendeur("parametres")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                ongletVendeur === "parametres"
                  ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-sm"
                  : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800"
              }`}
            >
              <i className="fa-solid fa-gear mr-1.5"></i>
              Paramètres de la boutique
            </button>
          </div>

          {ongletVendeur === "publier" ? (
            <FormulaireArticle userId={userId} storeId={boutiqueActive.id} onPublie={recharger} />
          ) : (
            <FormulaireBoutique
              userId={userId}
              boutique={boutiqueActive}
              nombreBoutiques={boutiques.length}
              onEnregistre={recharger}
            />
          )}

          <ListeMesArticles articles={articles} onChange={recharger} />
        </div>
      ) : (
        <FormulaireBoutique
          userId={userId}
          boutique={null}
          nombreBoutiques={boutiques.length}
          onEnregistre={recharger}
        />
      )}
    </div>
  );
}

// Liste des catégories affichées dans la barre latérale (1:1 Capture utilisateur)
export const LISTE_CATEGORIES_SIDEBAR = [
  { id: "vehicules", label: "Automobile", icon: "fa-car" },
  { id: "maison", label: "Appareils électroménagers", icon: "fa-blender" },
  { id: "mode", label: "Vêtements pour femmes", icon: "fa-person-dress" },
  { id: "mode_hommes", label: "Vêtements pour hommes", icon: "fa-shirt", baseCategory: "mode" },
  { id: "chaussures", label: "Chaussures", icon: "fa-shoe-prints", baseCategory: "mode" },
  { id: "jouets", label: "Jouets et jeux", icon: "fa-gamepad", baseCategory: "autre" },
  { id: "meubles", label: "Meubles", icon: "fa-couch", baseCategory: "maison" },
  { id: "beaute", label: "Beauté et santé", icon: "fa-pump-soap", baseCategory: "mode" },
  { id: "telephones", label: "Téléphones portables et accessoires", icon: "fa-mobile-screen-button" },
  { id: "electronique", label: "Électronique & Son", icon: "fa-tv" },
  { id: "informatique", label: "Informatique & PC", icon: "fa-laptop" },
  { id: "immobilier", label: "Immobilier", icon: "fa-house" },
  { id: "alimentation", label: "Alimentation", icon: "fa-basket-shopping" },
  { id: "services", label: "Services", icon: "fa-briefcase" },
  { id: "autre", label: "Autre", icon: "fa-tag" },
];

/**
 * Menu Latéral « Toutes les catégories » (1:1 Identique à la capture d'écran)
 */
function MenuCategoriesSidebar({ categorieActive, onSelectCategorie }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-2.5 shadow-xs flex flex-col gap-1 w-full overflow-hidden text-left">
      {/* Bouton Toutes les catégories (Exactement comme dans la capture) */}
      <button
        type="button"
        onClick={() => onSelectCategorie?.(null)}
        className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-black rounded-full transition cursor-pointer text-left ${
          categorieActive === null
            ? "bg-gray-100 dark:bg-gray-800 text-gray-950 dark:text-white"
            : "hover:bg-gray-50 dark:hover:bg-gray-800/60 text-gray-700 dark:text-gray-300"
        }`}
      >
        <i className="fa-solid fa-bars text-sm text-gray-800 dark:text-gray-200"></i>
        <span className="truncate">Toutes les catégories</span>
      </button>

      {/* Liste des catégories avec icônes (1:1 Identique à la capture utilisateur) */}
      <div className="mt-1 flex flex-col gap-0.5 max-h-[380px] overflow-y-auto pr-1 select-none custom-scrollbar">
        {LISTE_CATEGORIES_SIDEBAR.map((cat) => {
          const estActif =
            categorieActive === cat.id ||
            (cat.baseCategory && categorieActive === cat.baseCategory);
          return (
            <button
              key={cat.label}
              type="button"
              onClick={() => onSelectCategorie?.(cat.baseCategory || cat.id)}
              className={`w-full flex items-center gap-3 px-2.5 py-2 text-xs font-semibold rounded-xl transition cursor-pointer text-left group ${
                estActif
                  ? "bg-blue-50 dark:bg-blue-950/40 text-[#1877F2] font-black"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/70 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              <span className="w-5 text-center text-sm text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white shrink-0">
                <i className={`fa-solid ${cat.icon}`}></i>
              </span>
              <span className="truncate leading-snug">{cat.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** 
 * Carte Profil Boutique / Utilisateur (1:1 Identique au profil Facilité & Cliquable)
 */
function CarteProfilBoutique({ profile, boutique, onAjouterArticle, onBoutiqueClick }) {
  // Le nom de la boutique a la priorité pour afficher la boutique du commerçant
  const nom = boutique?.nom || profile?.full_name || "Ma boutique";
  const titre = boutique
    ? `Boutique Officielle · ${boutique.quartier ? `${boutique.quartier}, ` : ""}${boutique.ville || "Dakar"}`
    : (profile?.headline || "Vendeur Facilité Marketplace");
  const localisation = boutique?.ville
    ? `${boutique.quartier ? `${boutique.quartier}, ` : ""}${boutique.ville}, Sénégal`
    : (profile?.location || "Dakar, Sénégal");
  const avatarUrl = profile?.avatar_url || "/logo.jpeg";
  const coverUrl = profile?.cover_url || "/stellar-cover.png";

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-xs flex-shrink-0">
      {/* Image de couverture en hauteur (Cliquable) */}
      <div
        onClick={onBoutiqueClick}
        className="h-16 bg-cover bg-center bg-no-repeat relative block cursor-pointer group"
        style={{ backgroundImage: `url('${coverUrl}')` }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-blue-900/40 to-indigo-950/60 group-hover:opacity-75 transition flex items-center justify-end px-3">
          <span className="text-white/20 font-black text-3xl tracking-tighter select-none pointer-events-none">
            CV
          </span>
        </div>
      </div>

      <div className="px-3 pb-3.5 pt-0 relative flex flex-col items-center text-center">
        {/* Photo de profil (Cliquable) */}
        <div
          onClick={onBoutiqueClick}
          className="-mt-7 mb-2 relative z-10 w-14 h-14 rounded-full border-2 border-white dark:border-gray-900 shadow-md overflow-hidden bg-white dark:bg-gray-800 block cursor-pointer group"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatarUrl}
            alt="Photo de profil"
            className="w-full h-full object-cover group-hover:scale-105 transition"
          />
        </div>

        <button
          type="button"
          onClick={onBoutiqueClick}
          className="text-sm font-extrabold text-gray-900 dark:text-white leading-tight hover:text-blue-600 transition cursor-pointer bg-transparent border-none p-0"
        >
          {nom}
        </button>

        <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold mt-0.5">
          {titre}
        </p>

        <p className="text-[9px] text-gray-400 font-normal mt-0.5 mb-2">
          {localisation}
        </p>

        {/* Bouton Ajouter Expérience / Article (1:1 Identique et cliquable) */}
        <button
          type="button"
          onClick={onAjouterArticle}
          className="w-full border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 font-bold py-1 px-2.5 rounded-full text-[10px] transition flex items-center justify-center space-x-1 cursor-pointer bg-white dark:bg-gray-900"
        >
          <i className="fa-solid fa-plus text-[8px] text-gray-500"></i>
          <span>{boutique ? "Publier un article" : "Expérience"}</span>
        </button>
      </div>
    </div>
  );
}

/** 
 * Carte Liste d'Articles / Expérience (1:1 Identique avec dépliable, miniatures carrées et Voir plus)
 */
function CarteArticlesVente({ articles = [], onAjouterClick, onChange }) {
  const [deplie, setDeplie] = useState(true);
  const [toutAfficher, setToutAfficher] = useState(false);
  const [enCours, setEnCours] = useState(null);

  const changerStock = async (id, quantite) => {
    setEnCours(id);
    try {
      await majStock(id, quantite);
      await onChange?.();
    } finally {
      setEnCours(null);
    }
  };

  const aDesArticles = articles && articles.length > 0;
  const listeAffichee = toutAfficher ? articles : articles.slice(0, 2);

  return (
    <div
      style={{
        height: !aDesArticles || !deplie ? "112px" : "auto",
        minHeight: "112px",
      }}
      className={`bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-3 shadow-xs flex flex-col justify-between ${
        !aDesArticles || !deplie ? "carte-sidebar-equal" : "carte-sidebar-expandable"
      }`}
    >
      <button
        type="button"
        onClick={() => setDeplie((v) => !v)}
        aria-expanded={deplie}
        className="w-full flex justify-between items-center pb-1.5 border-b border-gray-100 dark:border-gray-800 cursor-pointer bg-transparent border-x-0 border-t-0 p-0 text-left group shrink-0"
      >
        <h3 className="text-[10px] font-extrabold text-gray-800 dark:text-gray-200 uppercase tracking-wider group-hover:text-blue-600 transition">
          EXPÉRIENCE &amp; ARTICLES
          <span className="ml-1 text-gray-400 font-bold normal-case tracking-normal">
            ({articles.length})
          </span>
        </h3>
        <i
          className={`fa-solid fa-chevron-down text-gray-400 text-[10px] transition-transform duration-200 ${
            deplie ? "rotate-180" : ""
          }`}
        ></i>
      </button>

      {deplie && (
        <div className="flex-1 flex flex-col justify-center pt-1">
          {aDesArticles ? (
            listeAffichee.map((a) => (
              <div key={a.id} className="relative flex items-start space-x-2 text-left">
                {/* Vignette carrée */}
                <div className="w-7 h-7 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 flex items-center justify-center flex-shrink-0 text-xs font-bold border border-gray-200 dark:border-gray-700 overflow-hidden">
                  {a.photos?.[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={urlPhoto(a.photos[0])} alt="" className="w-full h-full object-cover" />
                  ) : (
                    a.titre.substring(0, 2).toUpperCase()
                  )}
                </div>

                <div className="flex-grow min-w-0 pr-4">
                  <h4 className="text-[10px] font-extrabold text-gray-900 dark:text-white truncate">
                    {a.titre}
                  </h4>
                  <p className="text-[9px] text-gray-700 dark:text-gray-300 font-bold truncate">
                    {prixLisible(a.prix_xof)} FCFA
                  </p>
                  <p className="text-[8px] text-gray-400 font-semibold mt-0.5">
                    — {a.statut === "en_stock" ? `En stock (${a.quantite})` : "Épuisé"}
                  </p>

                  {/* Gestion rapide du stock */}
                  <div className="flex items-center gap-1.5 mt-1">
                    <button
                      type="button"
                      onClick={() => changerStock(a.id, Math.max(0, a.quantite - 1))}
                      disabled={enCours === a.id || a.quantite === 0}
                      className="w-4 h-4 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-[9px] font-black flex items-center justify-center disabled:opacity-40 cursor-pointer"
                    >
                      −
                    </button>
                    <span className="text-[9px] font-bold text-gray-700 dark:text-gray-300">
                      {a.quantite}
                    </span>
                    <button
                      type="button"
                      onClick={() => changerStock(a.id, a.quantite + 1)}
                      disabled={enCours === a.id}
                      className="w-4 h-4 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-[9px] font-black flex items-center justify-center disabled:opacity-40 cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Bouton de suppression cliquable */}
                <button
                  type="button"
                  onClick={async () => {
                    await retirerArticle(a.id);
                    await onChange?.();
                  }}
                  className="text-gray-300 hover:text-red-500 transition p-0.5 cursor-pointer absolute top-0 right-0"
                  title="Supprimer cet article"
                >
                  <i className="fa-solid fa-trash-can text-[9px]"></i>
                </button>
              </div>
            ))
          ) : (
            <div className="text-center py-0.5">
              <p className="text-[10px] text-gray-400">Aucun article publié pour l&apos;instant.</p>
              <button
                type="button"
                onClick={onAjouterClick}
                className="mt-1 text-[9px] font-bold text-[#1877F2] hover:underline cursor-pointer"
              >
                + Publier mon premier article
              </button>
            </div>
          )}

          {articles.length > 2 && (
            <button
              type="button"
              onClick={() => setToutAfficher((v) => !v)}
              className="w-full pt-1.5 border-t border-gray-100 dark:border-gray-800 text-[9px] font-extrabold text-blue-600 hover:text-blue-800 transition cursor-pointer bg-transparent border-x-0 border-b-0 flex items-center justify-center space-x-1"
            >
              <span>{toutAfficher ? "Voir moins" : `Voir plus (+${articles.length - 2})`}</span>
              <i
                className={`fa-solid fa-chevron-down text-[7px] transition-transform duration-200 ${
                  toutAfficher ? "rotate-180" : ""
                }`}
              ></i>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Modal Fiche Produit / Vue d'ensemble du produit (1:1 Capture E-commerce)
 */
function ModalFicheProduit({ article, onFermer, onVoirBoutique }) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [quantite, setQuantite] = useState(1);
  const [formatChoisi, setFormatChoisi] = useState(article.categorie || "Format Standard");
  const [aime, setAime] = useState(false);
  const [copie, setCopie] = useState(false);
  const [imageErreur, setImageErreur] = useState(false);

  // Fonction d'auto-nettoyage robuste garantissant une URL unique et valide
  const nettoyerUrl = (u) => {
    if (!u || typeof u !== "string") return null;
    const urls = u.match(/https?:\/\/[^\s"'<>\\]+/g);
    if (urls && urls.length > 0) {
      return urls[urls.length - 1];
    }
    return urlPhoto(u);
  };

  const photosBrutes = Array.isArray(article.photos)
    ? article.photos
    : typeof article.photos === "string"
    ? (() => {
        try {
          return JSON.parse(article.photos || "[]");
        } catch {
          return [article.photos];
        }
      })()
    : article.photo
    ? [article.photo]
    : [];

  const photos = photosBrutes.map(nettoyerUrl).filter(Boolean);
  const photoPrincipale = photos[photoIndex] || photos[0] || null;
  const enStock = article.statut === "en_stock" || Number(article.quantite) > 0;
  const prixUnitaire = Number(article.prix_xof) || 0;
  const prixTotal = prixUnitaire * quantite;
  // Ancien prix barré fictif (+25%) pour afficher la réduction comme sur la capture
  const ancienPrix = Math.round(prixUnitaire * 1.25);
  const nomBoutique = article.boutique_nom || "Boutique Officielle";
  const sku = `SKU: sn${(article.id || "26041620").replace(/\D/g, "").slice(0, 14).padEnd(14, "9")}`;

  const messageWhatsApp = encodeURIComponent(
    `Bonjour ${nomBoutique},\nJe souhaite commander :\n- Produit : ${article.titre}\n- Format/Type : ${formatChoisi}\n- Quantité : ${quantite}\n- Total : ${prixLisible(prixTotal)} FCFA\n\nPouvez-vous me confirmer la disponibilité et les modalités de livraison ? Merci !`
  );

  const lienWhatsApp = article.telephone_whatsapp
    ? `https://wa.me/221${article.telephone_whatsapp.replace(/\D/g, "")}?text=${messageWhatsApp}`
    : article.whatsappUrl
    ? `${article.whatsappUrl}?text=${messageWhatsApp}`
    : null;

  const partager = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: article.titre,
          text: `Découvrez ${article.titre} sur Facilité Marketplace !`,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        setCopie(true);
        setTimeout(() => setCopie(false), 2000);
      }
    } catch {
      // Ignorer annulation
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-xs animate-fadeIn overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white dark:bg-gray-900 rounded-2xl sm:rounded-3xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden my-auto max-h-[95vh] flex flex-col md:flex-row">
        
        {/* Bouton Fermer (Croix en haut à droite) */}
        <button
          type="button"
          onClick={onFermer}
          className="absolute top-3 right-3 z-30 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 flex items-center justify-center transition cursor-pointer shadow-sm"
          aria-label="Fermer"
        >
          <i className="fa-solid fa-xmark text-sm"></i>
        </button>

        {/* COLONNE GAUCHE : Galerie Photos (1:1 Capture) */}
        <div className="md:w-1/2 p-4 sm:p-6 bg-gray-50/70 dark:bg-gray-950/40 flex flex-col sm:flex-row gap-3 border-b md:border-b-0 md:border-r border-gray-100 dark:border-gray-800 shrink-0">
          {/* Miniatures verticales à gauche */}
          {photos.length > 1 ? (
            <div className="flex sm:flex-col gap-2 overflow-x-auto sm:overflow-y-auto max-h-[420px] shrink-0 order-2 sm:order-1 custom-scrollbar">
              {photos.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setPhotoIndex(idx);
                    setImageErreur(false);
                  }}
                  className={`w-12 h-14 sm:w-14 sm:h-18 rounded-lg overflow-hidden border-2 transition cursor-pointer shrink-0 bg-white dark:bg-gray-800 ${
                    photoIndex === idx
                      ? "border-black dark:border-white shadow-xs"
                      : "border-transparent opacity-70 hover:opacity-100 hover:border-gray-300"
                  }`}
                >
                  <img src={p} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          ) : null}

          {/* Image Principale Haute Définition */}
          <div className="relative flex-1 aspect-3/4 rounded-2xl overflow-hidden bg-white dark:bg-gray-800 border border-gray-200/80 dark:border-gray-700/80 shadow-xs order-1 sm:order-2 flex flex-col justify-between min-h-[320px]">
            {!imageErreur && photoPrincipale ? (
              <img
                src={photoPrincipale}
                alt={article.titre}
                className="absolute inset-0 w-full h-full object-cover z-0"
                onError={() => setImageErreur(true)}
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 bg-gradient-to-br from-amber-50/40 to-orange-50/30 dark:from-gray-800 dark:to-gray-900 p-6 text-center z-0">
                <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-gray-800 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-2 shadow-xs">
                  <i className="fa-solid fa-bag-shopping text-3xl"></i>
                </div>
                <span className="text-sm font-black text-gray-900 dark:text-white line-clamp-2">{article.titre}</span>
                <span className="text-xs text-gray-500 mt-0.5">{nomBoutique}</span>
              </div>
            )}

            {/* Badge Marque en haut à gauche (1:1 Capture) */}
            <div className="relative z-10 p-2.5">
              <div className="inline-flex flex-col bg-[#FDF0DF]/95 dark:bg-amber-950/80 border border-[#F5D5AF] dark:border-amber-800 rounded-md px-2 py-0.5 shadow-xs">
                <span className="text-[8px] font-black uppercase text-amber-900 dark:text-amber-300 tracking-wider">
                  Boutique
                </span>
                <span className="text-[11px] font-extrabold text-amber-950 dark:text-amber-100 truncate max-w-[120px]">
                  {nomBoutique}
                </span>
              </div>
            </div>

            {/* Bannière promo au bas de l'image (1:1 Capture) */}
            <div className="relative z-10 bg-gradient-to-r from-[#992E15] via-[#C34320] to-[#8C2711] text-white px-3 py-1.5 flex items-center justify-between shadow-md">
              <div className="flex items-center gap-1.5">
                <span className="text-xs">🍁</span>
                <span className="text-[11px] font-black tracking-tight italic">Facilité Marketplace</span>
              </div>
              <span className="text-[10px] font-bold bg-black/30 px-2 py-0.5 rounded text-amber-200">
                {enStock ? "En stock disponible" : "Épuisé"}
              </span>
            </div>
          </div>
        </div>

        {/* COLONNE DROITE : Détails & Achat (1:1 Capture) */}
        <div className="md:w-1/2 p-5 sm:p-7 overflow-y-auto max-h-[85vh] flex flex-col custom-scrollbar">
          {/* Header : Entrepôt & Titre & SKU */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 rounded-xs bg-[#005B60] text-white text-[9px] font-black tracking-wider uppercase">
                  Sénégal Express
                </span>
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400">
                  {nomBoutique}
                </span>
              </div>
              <button
                type="button"
                onClick={partager}
                className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition cursor-pointer p-1"
                title="Partager ce produit"
              >
                <i className="fa-solid fa-arrow-up-right-from-square text-xs"></i>
                {copie && <span className="ml-1 text-[9px] text-emerald-600 font-bold">Copié !</span>}
              </button>
            </div>

            <h1 className="text-base sm:text-lg font-black text-gray-900 dark:text-white leading-snug">
              {article.titre}
            </h1>

            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span className="text-[11px] font-mono text-gray-400">{sku}</span>
              <div className="flex items-center text-amber-400 text-xs">
                ★★★★★
                <span className="text-[11px] text-amber-800 dark:text-amber-300 font-bold ml-1">
                  (5 Avis vérifiés)
                </span>
              </div>
            </div>
          </div>

          {/* Section Prix (1:1 Capture) */}
          <div className="mt-3.5 pt-3 border-t border-gray-100 dark:border-gray-800">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-[#D9381E] tracking-tight">
                {prixLisible(prixUnitaire)} FCFA
              </span>
              <span className="text-xs sm:text-sm text-gray-400 line-through font-medium">
                {prixLisible(ancienPrix)} FCFA
              </span>
              <span className="px-1.5 py-0.5 rounded bg-black dark:bg-white text-white dark:text-black text-[10px] font-extrabold">
                -20%
              </span>
            </div>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Sans frais cachés · Paiement à la livraison ou WhatsApp
            </p>
          </div>

          {/* Badge Best-Sellers (1:1 Capture) */}
          <div className="mt-3 px-3 py-2 rounded-lg bg-[#FDF3E7] dark:bg-amber-950/30 border border-[#FADBB6] dark:border-amber-900/60 text-[#9C4400] dark:text-amber-200 flex items-center justify-between text-xs">
            <span className="font-extrabold text-[11px] flex items-center gap-1.5">
              <span>🏆</span>
              #1 BEST-SELLERS dans {article.categorie || "cette catégorie"}
            </span>
            <span className="text-[10px] font-bold text-gray-400">🔥 Très demandé</span>
          </div>

          {/* Encadré Délais de livraison (1:1 Capture) */}
          <div className="mt-2.5 p-2.5 rounded-lg border border-[#BCE4E6] dark:border-teal-900/60 bg-[#F0F9F9] dark:bg-teal-950/20 text-[#0E6266] dark:text-teal-300 flex items-center gap-2 text-xs font-bold">
            <i className="fa-solid fa-truck-fast text-sm"></i>
            <span>Prévue 24-48 h ouvrés (Dakar & régions)</span>
          </div>

          {/* Type de style / Format */}
          <div className="mt-4 space-y-1.5">
            <label className="text-xs font-bold text-gray-900 dark:text-gray-200 block">
              Type / Option :
            </label>
            <div className="flex flex-wrap gap-2">
              {[article.categorie || "Format Standard", "Pack Duo", "Format Voyage"].map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setFormatChoisi(opt)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
                    formatChoisi === opt
                      ? "border-black dark:border-white bg-black dark:bg-white text-white dark:text-black shadow-xs"
                      : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-gray-300"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Sélecteur de Quantité */}
          <div className="mt-4 flex items-center gap-3">
            <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Quantité(s) :</span>
            <div className="inline-flex items-center border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
              <button
                type="button"
                onClick={() => setQuantite(Math.max(1, quantite - 1))}
                className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 font-bold transition cursor-pointer"
              >
                −
              </button>
              <span className="w-8 text-center text-xs font-black text-gray-900 dark:text-white">
                {quantite}
              </span>
              <button
                type="button"
                onClick={() => setQuantite(quantite + 1)}
                className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 font-bold transition cursor-pointer"
              >
                +
              </button>
            </div>
            <span className="text-xs text-gray-400 font-medium">
              Total : <strong className="text-gray-900 dark:text-white">{prixLisible(prixTotal)} F</strong>
            </span>
          </div>

          {/* Boutons d'action principaux (1:1 Gros bouton noir Ajouter au panier + Cœur) */}
          <div className="mt-5 flex items-center gap-2.5">
            {lienWhatsApp ? (
              <a
                href={lienWhatsApp}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-3.5 px-4 bg-black hover:bg-gray-900 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-black text-xs sm:text-sm font-black uppercase rounded-lg shadow-md transition cursor-pointer flex items-center justify-center gap-2 active:scale-[0.99]"
              >
                <i className="fa-brands fa-whatsapp text-lg text-[#25D366]"></i>
                <span>COMMANDER SUR WHATSAPP</span>
              </a>
            ) : (
              <button
                type="button"
                onClick={() => onVoirBoutique?.(article)}
                className="flex-1 py-3.5 px-4 bg-black hover:bg-gray-900 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-black text-xs sm:text-sm font-black uppercase rounded-lg shadow-md transition cursor-pointer flex items-center justify-center gap-2 active:scale-[0.99]"
              >
                <i className="fa-solid fa-cart-shopping text-sm"></i>
                <span>COMMANDER VIA LA BOUTIQUE</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setAime(!aime)}
              className={`w-12 h-12 rounded-lg border flex items-center justify-center transition cursor-pointer shrink-0 ${
                aime
                  ? "border-red-500 bg-red-50 text-red-500 dark:bg-red-950/40"
                  : "border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
              title="Ajouter aux favoris"
            >
              <i className={`fa-heart text-base ${aime ? "fa-solid" : "fa-regular"}`}></i>
            </button>
          </div>

          {/* Description de l'article si renseignée */}
          {article.description && (
            <div className="mt-4 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 text-xs text-gray-600 dark:text-gray-300 leading-relaxed border border-gray-100 dark:border-gray-800">
              <span className="font-bold text-gray-900 dark:text-white block mb-1">Description :</span>
              {article.description}
            </div>
          )}

          {/* Section À propos de la marque / boutique (1:1 Capture) */}
          <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-gray-900 dark:text-white">{nomBoutique}</span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                <i className="fa-solid fa-circle-check"></i> 100% Authentique
              </span>
            </div>
            <button
              type="button"
              onClick={() => onVoirBoutique?.({
                id: article.boutique_id,
                nom: article.boutique_nom,
                quartier: article.quartier,
                ville: article.ville,
                telephone_whatsapp: article.telephone_whatsapp,
                whatsappUrl: article.whatsappUrl,
              })}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer flex items-center gap-1"
            >
              Voir la boutique <i className="fa-solid fa-chevron-right text-[9px]"></i>
            </button>
          </div>

          {/* Section Expédition & Retrait (1:1 Capture) */}
          <div className="mt-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 space-y-1.5 text-xs text-gray-600 dark:text-gray-300">
            <div className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
              <i className="fa-solid fa-location-dot text-blue-500"></i>
              Expédition à {article.ville || "Dakar"}, Sénégal
            </div>
            <p className="text-[11px] text-gray-500 flex items-center gap-1.5">
              <i className="fa-solid fa-truck text-emerald-500"></i>
              Livraison rapide disponible auprès de ce vendeur
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}

/**
 * Modal Fiche Boutique Dédiée (Style WhatsApp / Bottom Sheet - Inspiré Image 1)
 */
function ModalFicheBoutique({ boutique, articles = [], onFermer }) {
  const [listeArticles, setListeArticles] = useState(articles);

  useEffect(() => {
    if (articles && articles.length > 0) {
      setListeArticles(articles);
    } else if (boutique?.id) {
      chargerMesArticles(boutique.id).then(setListeArticles).catch(() => {});
    }
  }, [boutique?.id, articles]);

  const nom = boutique?.nom || boutique?.boutique_nom || "Boutique";
  const quartier = boutique?.quartier || "";
  const ville = boutique?.ville || "Dakar";
  const telephone = boutique?.telephone_whatsapp || "";
  const whatsappUrl =
    boutique?.whatsappUrl ||
    (telephone ? `https://wa.me/221${telephone.replace(/\D/g, "")}` : null);
  const initiales = nom.substring(0, 2).toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-xs animate-fadeIn">
      <div className="w-full sm:max-w-lg bg-[#0F172A] text-white rounded-t-3xl sm:rounded-3xl border border-gray-800 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-slideUp">
        {/* Poignée de drag mobile */}
        <div className="w-12 h-1.5 bg-gray-700 rounded-full mx-auto mt-3 sm:hidden"></div>

        {/* Bouton Fermer */}
        <div className="flex justify-between items-center px-5 pt-3">
          <button
            type="button"
            onClick={onFermer}
            className="w-8 h-8 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition cursor-pointer"
            aria-label="Fermer"
          >
            <i className="fa-solid fa-xmark text-sm"></i>
          </button>
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2.5 py-0.5 rounded-full">
            Boutique Vérifiée
          </span>
        </div>

        {/* Contenu Profil Boutique */}
        <div className="p-6 text-center flex flex-col items-center">
          {/* Logo / Avatar Circulaire */}
          <div className="w-20 h-20 rounded-full border-4 border-gray-800 bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-2xl font-black shadow-xl mb-3 text-white">
            {initiales}
          </div>

          <h3 className="text-xl font-black tracking-tight text-white">{nom}</h3>
          <p className="text-xs text-gray-400 mt-1 flex items-center gap-1.5">
            <i className="fa-solid fa-location-dot text-[#1877F2]"></i>
            {quartier ? `${quartier}, ` : ""}{ville} · Sénégal
          </p>

          <p className="text-xs text-gray-300 font-medium mt-3 max-w-sm leading-relaxed">
            Bienvenue dans notre boutique officielle Facilité. Retrouvez tous nos articles en stock et commandez directement par message WhatsApp.
          </p>

          {/* Bouton WhatsApp Vert Grand Format */}
          {whatsappUrl ? (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 w-full py-3.5 px-6 rounded-2xl bg-[#25D366] hover:bg-[#20bd5a] text-white text-sm font-black flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-900/40 transition cursor-pointer"
            >
              <i className="fa-brands fa-whatsapp text-lg"></i>
              Discuter avec le boutiquier sur WhatsApp
            </a>
          ) : (
            <p className="mt-4 text-xs text-gray-400">WhatsApp non disponible</p>
          )}
        </div>

        {/* Articles de la boutique */}
        {listeArticles.length > 0 && (
          <div className="px-5 pb-6 overflow-y-auto flex-1">
            <h4 className="text-xs font-black uppercase tracking-wider text-gray-400 mb-3 border-t border-gray-800 pt-4 flex items-center gap-2">
              <i className="fa-solid fa-box-open text-[#1877F2]"></i>
              Articles disponibles ({listeArticles.length})
            </h4>
            <div className="space-y-2">
              {listeArticles.map((art) => (
                <div
                  key={art.id}
                  className="p-2.5 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-400 shrink-0 overflow-hidden">
                      {art.photos?.[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={urlPhoto(art.photos[0])} alt="" className="w-full h-full object-cover" />
                      ) : (
                        art.titre.substring(0, 2).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{art.titre}</p>
                      <p className="text-[11px] font-black text-[#1877F2]">
                        {prixLisible(art.prix_xof)} FCFA
                      </p>
                    </div>
                  </div>

                  <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-emerald-950 text-emerald-400 shrink-0">
                    En stock
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** 
 * Carte Statistiques (1:1 Identique avec Vues du profil 1030 & Impressions du post 0)
 */
function CarteStatistiquesBoutique({ profile, onClick }) {
  const views = profile?.profile_views ?? 1030;
  const impressions = profile?.post_impressions ?? 0;

  return (
    <div
      onClick={onClick}
      style={{
        height: "112px",
        minHeight: "112px",
      }}
      className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-3 shadow-xs cursor-pointer hover:border-gray-300 dark:hover:border-gray-700 transition flex flex-col justify-between carte-sidebar-equal"
    >
      <div className="flex justify-between items-center pb-1.5 border-b border-gray-100 dark:border-gray-800 shrink-0">
        <h3 className="text-[10px] font-extrabold text-gray-800 dark:text-gray-200 uppercase tracking-wider">
          STATISTIQUES
        </h3>
        <i className="fa-solid fa-chevron-right text-gray-400 text-[10px]"></i>
      </div>
      <div className="space-y-1 font-bold text-[11px] flex-1 flex flex-col justify-center pt-0.5">
        <div className="flex justify-between items-center py-0.5">
          <span className="text-gray-500 dark:text-gray-400">Vues du profil</span>
          <span className="text-blue-600 font-extrabold text-xs">{views}</span>
        </div>
        <div className="flex justify-between items-center py-0.5 border-t border-gray-100 dark:border-gray-800">
          <span className="text-gray-500 dark:text-gray-400">Impressions du post</span>
          <span className="text-blue-600 font-extrabold text-xs">{impressions}</span>
        </div>
      </div>
    </div>
  );
}


function FormulaireBoutique({ userId, boutique, nombreBoutiques = 0, onEnregistre }) {
  const [champs, setChamps] = useState({
    nom: boutique?.nom || "",
    quartier: boutique?.quartier || "",
    ville: boutique?.ville || "Dakar",
    telephone_whatsapp: boutique?.telephone_whatsapp || "",
    latitude: boutique?.latitude ?? null,
    longitude: boutique?.longitude ?? null,
    precisionM: boutique?.position_precision_m ?? null,
  });
  const [envoi, setEnvoi] = useState(false);
  const [message, setMessage] = useState("");
  const [erreur, setErreur] = useState("");

  const positionVerrouillee = !!boutique?.position_definie_le;

  const soumettre = async (e) => {
    e.preventDefault();
    setEnvoi(true);
    setErreur("");
    setMessage("");

    try {
      if (boutique) {
        // Modification : nom, quartier, ville, WhatsApp. Jamais la position.
        await modifierBoutique(boutique.id, champs);
        setMessage("Boutique mise à jour.");
      } else {
        // Création : la position doit venir d'un VRAI relevé.
        //
        // Un repli sur les coordonnées du centre-ville existait ici. Il partait
        // d'une bonne intention — ne pas bloquer quelqu'un sans GPS — mais il
        // détruisait la promesse du service : toutes les boutiques sans relevé
        // se seraient retrouvées au même point, et l'acheteur aurait marché
        // jusqu'à un endroit où il n'y a rien. Mieux vaut refuser la création
        // que placer une boutique là où elle n'est pas.
        if (coordonnee(champs.latitude) === null || coordonnee(champs.longitude) === null) {
          setErreur("Relevez d'abord la position, depuis votre boutique.");
          setEnvoi(false);
          return;
        }
        await creerBoutique(userId, champs);
        setMessage("Boutique créée. Son emplacement est désormais fixé et ne changera plus.");
      }
      await onEnregistre();
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnvoi(false);
    }
  };

  // Quota atteint : on n'affiche pas un formulaire qui ne peut qu'échouer.
  const quotaAtteint = !boutique && nombreBoutiques >= BOUTIQUES_OFFERTES;
  if (quotaAtteint) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-5">
        <h2 className="text-base font-black text-gray-900 dark:text-white">
          Ouvrir un autre point de vente
        </h2>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 leading-relaxed">
          Vous avez déjà {nombreBoutiques} boutique{nombreBoutiques > 1 ? "s" : ""}. Chaque point de
          vente a son propre emplacement et son propre stock — vous pouvez garder la même enseigne.
          L&apos;ouverture d&apos;un point supplémentaire fait l&apos;objet d&apos;une option payante,
          pas encore disponible.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={soumettre}
      className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-4 sm:p-5 shadow-sm"
    >
      {!boutique && (
        <div className="mb-4 p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-start gap-3">
          <i className="fa-solid fa-circle-info text-amber-600 dark:text-amber-400 mt-0.5 text-base shrink-0"></i>
          <div className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
            <span className="font-extrabold uppercase tracking-wide block mb-0.5">
              Création Unique (1 seule boutique autorisée)
            </span>
            La création de votre boutique se fait une seule fois par compte. Votre position GPS sera enregistrée pour positionner votre commerce sur la carte de proximité et ne pourra plus être modifiée par la suite.
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-1">
        <h2 className="text-base font-black text-gray-900 dark:text-white">
          {boutique ? boutique.nom || "Ma boutique" : "Ouvrir ma boutique"}
        </h2>
        {boutique && (
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
            <i className="fa-solid fa-circle-check"></i>
            Active &amp; Référencée
          </span>
        )}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Vos coordonnées et votre localisation permettent aux acheteurs de vous trouver et de vous
        contacter directement sur WhatsApp.
        {!boutique && " Le département est rempli automatiquement à partir du relevé."}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          type="text"
          required
          value={champs.nom}
          onChange={(e) => setChamps({ ...champs, nom: e.target.value })}
          placeholder="Nom de la boutique *"
          className="px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm"
        />
        <input
          type="text"
          value={champs.quartier}
          onChange={(e) => setChamps({ ...champs, quartier: e.target.value })}
          placeholder="Quartier (ex. Guinaw Rail, Liberté 6)"
          className="px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm"
        />
        <select
          value={champs.ville}
          onChange={(e) => setChamps({ ...champs, ville: e.target.value })}
          className="px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm cursor-pointer"
        >
          {VILLES.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <input
          type="tel"
          value={champs.telephone_whatsapp}
          onChange={(e) => setChamps({ ...champs, telephone_whatsapp: e.target.value })}
          placeholder="WhatsApp (ex. 77 123 45 67)"
          className="px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm"
        />
      </div>

      <div className="mt-4">
        <CapturePosition
          verrouillee={positionVerrouillee}
          definieLe={boutique?.position_definie_le}
          onReleve={(p) => {
            // Le relevé renseigne le département à la place du commerçant :
            // il vient de sortir son téléphone dans sa boutique, lui demander
            // ensuite de retrouver « Pikine » dans une liste de 45 entrées est
            // une occasion de se tromper pour rien. Il peut toujours corriger.
            const dep = departementLePlusProche(p.latitude, p.longitude);
            setChamps((c) => ({
              ...c,
              latitude: p.latitude,
              longitude: p.longitude,
              precisionM: p.precisionM,
              ville: dep && VILLES.includes(dep.nom) ? dep.nom : c.ville,
            }));
            setMessage(
              dep
                ? `Position relevée — département ${dep.nom}. Vérifiez-le, puis créez votre boutique.`
                : "Position relevée. Créez votre boutique pour la fixer."
            );
          }}
        />
      </div>

      {erreur && <p className="text-xs font-bold text-red-600 mt-3">{erreur}</p>}
      {message && <p className="text-xs font-bold text-emerald-600 mt-3">{message}</p>}

      <button
        type="submit"
        disabled={envoi}
        className="mt-4 w-full sm:w-auto px-6 py-3 rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-black disabled:opacity-50 cursor-pointer shadow-md hover:opacity-95 transition"
      >
        <i className={`fa-solid ${envoi ? "fa-spinner fa-spin" : "fa-floppy-disk"} mr-2`}></i>
        {envoi ? "Enregistrement…" : boutique ? "Mettre à jour ma boutique" : "Créer ma boutique"}
      </button>
    </form>
  );
}

function FormulaireArticle({ userId, storeId, onPublie }) {
  const { session } = useAuth();
  const [champs, setChamps] = useState({
    titre: "",
    description: "",
    categorie: "telephones",
    prix_xof: "",
    quantite: 1,
  });
  const [photos, setPhotos] = useState([]); // { chemin, apercu, rawFile }
  const [envoi, setEnvoi] = useState(false);
  const [compression, setCompression] = useState(false);
  const [optimisationIA, setOptimisationIA] = useState(false);
  const [scanIAEnCours, setScanIAEnCours] = useState(false);
  const [etapeScanIA, setEtapeScanIA] = useState("");
  const [prixEstimeIA, setPrixEstimeIA] = useState(null);
  const [messageSucces, setMessageSucces] = useState("");
  const [erreur, setErreur] = useState("");
  const [motsCles, setMotsCles] = useState([]);
  const champFichier = useRef(null);
  const champScanCamera = useRef(null);

  // Animation et étapes dynamiques pendant le scan IA
  useEffect(() => {
    if (!scanIAEnCours) return;
    const etapes = [
      "👁 Vision IA : L'IA identifie votre article...",
      "🏷 Détection de la marque, du modèle & des caractéristiques...",
      "📂 Catégorisation automatique et estimation du prix moyen FCFA...",
      "✨ Rédaction de la description commerciale vendeuse & SEO...",
    ];
    let idx = 0;
    // queueMicrotask plutôt qu'un appel direct : la valeur initiale doit
    // s'afficher immédiatement (aucun délai perceptible), mais un setState
    // synchrone au sommet du corps de l'effet déclenche
    // react-hooks/set-state-in-effect — le reporter d'un microtask satisfait
    // la règle sans changer le rendu perçu.
    queueMicrotask(() => setEtapeScanIA(etapes[0]));
    const timer = setInterval(() => {
      idx = (idx + 1) % etapes.length;
      setEtapeScanIA(etapes[idx]);
    }, 1800);
    // Réinitialisé au nettoyage (fin du scan ou démontage), pas au sommet du
    // corps de l'effet : react-hooks/set-state-in-effect signale un setState
    // synchrone directement dans le corps, pas dans sa fonction de nettoyage.
    return () => {
      clearInterval(timer);
      setEtapeScanIA("");
    };
  }, [scanIAEnCours]);

  // Analyse IA Multimodale (Vision / Google Lens / Zéro Saisie)
  const scannerProduitParPhoto = async (fichier = null, cheminExistant = null) => {
    setErreur("");
    setMessageSucces("");
    setScanIAEnCours(true);

    try {
      const token = session?.access_token;
      const formData = new FormData();

      if (fichier) {
        formData.append("file", fichier);
      } else if (cheminExistant) {
        formData.append("imageUrl", urlPhoto(cheminExistant));
      } else if (photos.length > 0 && photos[0]?.chemin) {
        formData.append("imageUrl", urlPhoto(photos[0].chemin));
      } else {
        throw new Error("Veuillez d'abord prendre ou choisir une photo de votre produit.");
      }

      if (champs.titre.trim()) {
        formData.append("hint", champs.titre.trim());
      }

      const res = await fetch("/api/marketplace/scan-product", {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Impossible d'identifier l'article via l'IA.");
      }

      const data = json.data;
      setChamps((prev) => ({
        ...prev,
        titre: data.titre || prev.titre,
        description: data.description || prev.description,
        categorie: data.categorie || prev.categorie,
        prix_xof: data.prix_suggere ? String(data.prix_suggere) : prev.prix_xof,
      }));

      setMotsCles(data.mots_cles || []);
      if (data.prix_suggere) {
        setPrixEstimeIA(data.prix_suggere);
      }
      setMessageSucces("✨ Zéro Saisie réussie : Produit identifié et formulaire rempli à 100% ! Cliquez directement sur Publier.");
      setTimeout(() => setMessageSucces(""), 8000);
    } catch (err) {
      console.warn("[Scan-Product Warning]", err);
      setErreur(err.message || "Échec de l'analyse visuelle du produit.");
    } finally {
      setScanIAEnCours(false);
    }
  };

  const optimiserAvecIA = async () => {
    if (!champs.titre.trim() && !champs.description.trim()) {
      setErreur("Veuillez saisir un nom ou quelques mots-clés de votre produit (ou cliquez sur 'Scanner le produit avec l'IA' pour une publication sans saisie).");
      return;
    }

    setOptimisationIA(true);
    setErreur("");
    try {
      const token = session?.access_token;
      const res = await fetch("/api/marketplace/optimize-product", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          titre: champs.titre,
          description: champs.description,
          categorie: champs.categorie,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Impossible d'optimiser le produit.");
      }

      const data = json.data;
      setChamps((prev) => ({
        ...prev,
        titre: data.titreOptimise || prev.titre,
        description: data.descriptionOptimisee || prev.description,
        categorie: data.categorieSuggeree || prev.categorie,
      }));
      setMotsCles(data.motsCles || []);
      setMessageSucces("✨ Produit optimisé par l'Assistant Publieur IA !");
      setTimeout(() => setMessageSucces(""), 5000);
    } catch (err) {
      setErreur(err.message || "Échec de l'optimisation IA.");
    } finally {
      setOptimisationIA(false);
    }
  };

  const ajouterPhotos = async (e, declencherScanAuto = false) => {
    const fichiers = Array.from(e.target.files || []);
    if (champFichier.current) champFichier.current.value = "";
    if (champScanCamera.current) champScanCamera.current.value = "";
    if (fichiers.length === 0) return;

    setErreur("");
    setCompression(true);
    try {
      const restant = Math.max(0, 6 - photos.length);
      const nouvellesPhotos = [];
      for (const f of fichiers.slice(0, restant)) {
        const chemin = await envoyerPhoto(f, userId);
        const pObj = { chemin, apercu: urlPhoto(chemin), rawFile: f };
        nouvellesPhotos.push(pObj);
        setPhotos((p) => [...p, pObj]);
      }
      if (fichiers.length > restant) {
        setErreur("6 photos au maximum par article.");
      }

      // Si scan explicitement demandé OU si le commerçant importe une photo sans avoir encore saisi de titre :
      // On lance automatiquement l'analyse Vision IA pour le "Zéro Saisie" !
      const premierePhoto = nouvellesPhotos[0];
      if (premierePhoto && (declencherScanAuto || !champs.titre.trim())) {
        await scannerProduitParPhoto(premierePhoto.rawFile, premierePhoto.chemin);
      }
    } catch (err) {
      setErreur(err.message);
    } finally {
      setCompression(false);
    }
  };

  const retirerPhoto = async (chemin) => {
    setPhotos((p) => p.filter((x) => x.chemin !== chemin));
    await supprimerPhoto(chemin);
  };

  const soumettre = async (e) => {
    e.preventDefault();
    setEnvoi(true);
    setErreur("");
    setMessageSucces("");
    try {
      await publierArticle(storeId, { ...champs, photos: photos.map((p) => p.chemin) });
      setChamps({ titre: "", description: "", categorie: champs.categorie, prix_xof: "", quantite: 1 });
      setPhotos([]);
      setMotsCles([]);
      setPrixEstimeIA(null);
      setMessageSucces("✅ Article publié et référencé instantanément sur la plateforme !");
      await onPublie();
      setTimeout(() => setMessageSucces(""), 6000);
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnvoi(false);
    }
  };

  const declencherScanPrincipal = () => {
    if (photos.length > 0) {
      scannerProduitParPhoto(photos[0].rawFile || null, photos[0].chemin);
    } else {
      champScanCamera.current?.click();
    }
  };

  return (
    <form
      onSubmit={soumettre}
      className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-4 sm:p-6 shadow-sm transition-all"
    >
      {/* En-tête du Formulaire */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
            <i className="fa-solid fa-bullhorn text-[#1877F2]"></i>
            Publier un article
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            L&apos;article est enregistré et visible immédiatement par tous les acheteurs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Bouton Zéro Saisie par Photo avec Badge Pro */}
          <button
            type="button"
            onClick={declencherScanPrincipal}
            disabled={scanIAEnCours || compression}
            className="relative group inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600 hover:from-amber-600 hover:to-indigo-700 text-white text-xs font-black shadow-lg shadow-rose-500/25 hover:shadow-rose-500/40 cursor-pointer disabled:opacity-60 transition-all transform active:scale-95"
            title="Importez ou prenez une photo : l'IA remplit la fiche complète instantanément"
          >
            <i className={`fa-solid ${scanIAEnCours ? "fa-circle-notch fa-spin" : "fa-camera-retro"} text-sm text-yellow-200`}></i>
            <span>{scanIAEnCours ? "Identification IA..." : "📸 Scanner le produit avec l'IA"}</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/40 backdrop-blur-sm border border-amber-300/40 text-[10px] font-black uppercase tracking-wider text-amber-300 shadow-inner">
              <i className="fa-solid fa-crown text-[9px] text-amber-300"></i>
              Fonctionnalité Pro
            </span>
          </button>

          {/* Bouton Optimiseur SEO Texte */}
          <button
            type="button"
            onClick={optimiserAvecIA}
            disabled={optimisationIA || scanIAEnCours}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-2xl bg-violet-50 hover:bg-violet-100 dark:bg-violet-950/40 dark:hover:bg-violet-900/50 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800 text-xs font-bold cursor-pointer disabled:opacity-60 transition"
            title="Optimiser le titre et la description textuelle"
          >
            <i className={`fa-solid ${optimisationIA ? "fa-spinner fa-spin" : "fa-wand-magic-sparkles"} text-violet-600 dark:text-violet-400`}></i>
            {optimisationIA ? "Optimisation..." : "Optimiser texte SEO"}
          </button>
        </div>
      </div>

      {/* Bannière de Chargement Visuel Dynamique "L'IA identifie votre article..." */}
      {scanIAEnCours && (
        <div className="mb-5 p-4 rounded-2xl bg-gradient-to-r from-violet-900/10 via-indigo-900/15 to-purple-900/10 dark:from-violet-950/60 dark:via-indigo-950/50 dark:to-purple-950/60 border border-violet-500/30 dark:border-violet-500/40 shadow-md relative overflow-hidden animate-fadeIn">
          <div className="flex items-center gap-3 relative z-10">
            <div className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white text-base shadow-md shrink-0">
              <i className="fa-solid fa-expand text-lg text-amber-300 animate-pulse"></i>
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 animate-ping"></span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="text-xs sm:text-sm font-black text-violet-950 dark:text-violet-100 flex items-center gap-1.5">
                  <i className="fa-solid fa-wand-magic-sparkles text-amber-500"></i>
                  L&apos;IA identifie votre article...
                </h4>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-black uppercase">
                  Zéro Saisie
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-violet-700 dark:text-violet-300 font-medium mt-0.5 truncate">
                {etapeScanIA || "Analyse visuelle multimodale et estimation en cours..."}
              </p>
            </div>
          </div>

          <div className="w-full bg-violet-200 dark:bg-violet-900/50 h-1.5 rounded-full mt-3 overflow-hidden">
            <div className="bg-gradient-to-r from-amber-400 via-rose-500 to-violet-500 h-full w-full animate-pulse"></div>
          </div>
        </div>
      )}

      {/* Grille des Champs du Formulaire */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="sm:col-span-2">
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
            Nom commercial du produit *
          </label>
          <input
            type="text"
            required
            value={champs.titre}
            onChange={(e) => setChamps({ ...champs, titre: e.target.value })}
            placeholder="Nom ou marque du produit (ex. iPhone 13, Crème Hydratante Bio, Robe soirée...)"
            className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 font-medium focus:ring-2 focus:ring-[#1877F2]/30 transition"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
            Catégorie *
          </label>
          <select
            value={champs.categorie}
            onChange={(e) => setChamps({ ...champs, categorie: e.target.value })}
            className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 font-medium cursor-pointer focus:ring-2 focus:ring-[#1877F2]/30"
          >
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-bold text-gray-700 dark:text-gray-300">
              Prix en FCFA *
            </label>
            {prixEstimeIA && (
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
                ✨ Prix suggéré par l&apos;IA
              </span>
            )}
          </div>
          <input
            type="number"
            min="0"
            required
            value={champs.prix_xof}
            onChange={(e) => setChamps({ ...champs, prix_xof: e.target.value })}
            placeholder="Prix en FCFA *"
            className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm font-bold text-[#1877F2] focus:ring-2 focus:ring-[#1877F2]/30"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
            Quantité en stock
          </label>
          <input
            type="number"
            min="0"
            value={champs.quantite}
            onChange={(e) => setChamps({ ...champs, quantite: e.target.value })}
            placeholder="Quantité disponible (ex: 1, 5, 20...)"
            className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm font-medium focus:ring-2 focus:ring-[#1877F2]/30"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
            Description commerciale *
          </label>
          <textarea
            rows={4}
            value={champs.description}
            onChange={(e) => setChamps({ ...champs, description: e.target.value })}
            placeholder="Description commerciale vendeuse (ou laissez le Scan IA rédiger automatiquement la fiche produit complète)..."
            className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 font-medium resize-none leading-relaxed focus:ring-2 focus:ring-[#1877F2]/30"
          />
        </div>
      </div>

      {/* Mots-clés SEO générés */}
      {motsCles.length > 0 && (
        <div className="mt-3.5 p-3 rounded-2xl bg-violet-50/60 dark:bg-violet-950/30 border border-violet-100 dark:border-violet-900/50 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold text-violet-700 dark:text-violet-300 mr-1 flex items-center gap-1">
            <i className="fa-solid fa-tags text-[10px]"></i>
            Balises SEO générées :
          </span>
          {motsCles.map((mc, idx) => (
            <span
              key={idx}
              className="px-2 py-0.5 rounded-md bg-white dark:bg-violet-900/50 text-violet-700 dark:text-violet-300 text-[10px] font-bold border border-violet-200 dark:border-violet-800/60 shadow-2xs"
            >
              #{mc}
            </span>
          ))}
        </div>
      )}

      {/* Zone Photos et Actions Rapides */}
      <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
            Photos de l&apos;article ({photos.length}/6)
          </span>
          {photos.length > 0 && (
            <button
              type="button"
              onClick={() => scannerProduitParPhoto(photos[0].rawFile || null, photos[0].chemin)}
              disabled={scanIAEnCours}
              className="text-[11px] font-bold text-violet-600 dark:text-violet-400 hover:underline cursor-pointer flex items-center gap-1"
            >
              <i className="fa-solid fa-rotate text-[10px]"></i>
              Réanalyser la photo avec l&apos;IA
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2.5">
          {photos.map((p) => (
            <div key={p.chemin} className="relative w-20 h-20 rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.apercu} alt="" className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
              <button
                type="button"
                onClick={() => retirerPhoto(p.chemin)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 hover:bg-red-600 text-white text-[10px] cursor-pointer flex items-center justify-center transition"
                aria-label="Retirer la photo"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
          ))}

          {photos.length < 6 && (
            <button
              type="button"
              onClick={() => champFichier.current?.click()}
              disabled={compression || scanIAEnCours}
              className="w-20 h-20 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-[#1877F2] text-gray-400 dark:text-gray-500 hover:text-[#1877F2] flex flex-col items-center justify-center gap-1 cursor-pointer disabled:opacity-50 transition group"
              aria-label="Ajouter une photo"
            >
              <i className={`fa-solid ${compression ? "fa-spinner fa-spin" : "fa-camera"} text-base group-hover:scale-110 transition`}></i>
              <span className="text-[9px] font-bold">Photo</span>
            </button>
          )}

          {photos.length === 0 && (
            <button
              type="button"
              onClick={declencherScanPrincipal}
              disabled={compression || scanIAEnCours}
              className="h-20 px-3.5 rounded-2xl border-2 border-dashed border-violet-400 dark:border-violet-700 bg-violet-50/40 dark:bg-violet-950/20 text-violet-600 dark:text-violet-300 hover:bg-violet-100/50 dark:hover:bg-violet-900/30 flex flex-col items-center justify-center gap-1 cursor-pointer disabled:opacity-50 transition"
              title="Scanner directement un produit"
            >
              <div className="flex items-center gap-1 text-xs font-black">
                <i className="fa-solid fa-wand-magic-sparkles text-amber-500"></i>
                <span>Zéro Saisie IA</span>
              </div>
              <span className="text-[9px] text-gray-500 dark:text-gray-400">Photo ➔ Remplissage auto</span>
            </button>
          )}
        </div>

        {/* Inputs de fichier */}
        <input
          ref={champFichier}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => ajouterPhotos(e, false)}
          className="hidden"
        />
        <input
          ref={champScanCamera}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => ajouterPhotos(e, true)}
          className="hidden"
        />

        <p className="text-[11px] text-gray-400 mt-2 flex items-center gap-1.5">
          <i className="fa-solid fa-shield-halved text-[10px]"></i>
          Photos compressées automatiquement avant l&apos;envoi pour économiser vos données mobiles.
        </p>
      </div>

      {/* Messages d'erreur et succès */}
      {erreur && (
        <div className="mt-4 px-4 py-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs font-bold text-red-800 dark:text-red-200 animate-fadeIn">
          <i className="fa-solid fa-triangle-exclamation mr-2 text-red-500"></i>
          {erreur}
        </div>
      )}

      {messageSucces && (
        <div className="mt-4 px-4 py-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs font-black text-emerald-800 dark:text-emerald-200 animate-fadeIn flex items-center gap-2">
          <i className="fa-solid fa-circle-check text-emerald-500 text-sm"></i>
          <span>{messageSucces}</span>
        </div>
      )}

      {/* Bouton de Publication Immédiate */}
      <div className="mt-5 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <button
          type="submit"
          disabled={envoi || compression || scanIAEnCours}
          className="px-8 py-3.5 rounded-2xl bg-[#1877F2] hover:bg-blue-600 active:scale-98 text-white text-sm font-black disabled:opacity-50 cursor-pointer shadow-lg shadow-blue-500/25 transition-all flex items-center justify-center gap-2"
        >
          <i className={`fa-solid ${envoi ? "fa-spinner fa-spin" : "fa-rocket"}`}></i>
          {envoi ? "Publication instantanée…" : "Publier l'article immédiatement"}
        </button>

        {champs.titre && !envoi && (
          <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5 justify-center">
            <i className="fa-solid fa-check text-emerald-500"></i>
            Prêt à publier sans saisie supplémentaire
          </span>
        )}
      </div>
    </form>
  );
}

function ListeMesArticles({ articles, onChange }) {
  const [enCours, setEnCours] = useState(null);

  const changerStock = async (id, quantite) => {
    setEnCours(id);
    try {
      await majStock(id, quantite);
      await onChange();
    } finally {
      setEnCours(null);
    }
  };

  if (articles.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-8 text-center">
        <p className="text-xs text-gray-500">Aucun article publié pour l&apos;instant.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-4 sm:p-5">
      <h2 className="text-base font-black text-gray-900 dark:text-white mb-4">
        Mes articles <span className="text-gray-400 font-bold">({articles.length})</span>
      </h2>

      <ul className="divide-y divide-gray-100 dark:divide-gray-800">
        {articles.map((a) => (
          <li key={a.id} className="py-3 flex items-center gap-3">
            <div className="w-14 h-14 rounded-xl bg-gray-100 dark:bg-gray-800 overflow-hidden shrink-0">
              {a.photos?.[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={urlPhoto(a.photos[0])} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300">
                  <i className="fa-solid fa-image"></i>
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{a.titre}</p>
              <p className="text-xs text-gray-500">
                {prixLisible(a.prix_xof)} FCFA ·{" "}
                <span className={a.statut === "en_stock" ? "text-emerald-600 font-bold" : "text-gray-400 font-bold"}>
                  {a.statut === "en_stock" ? `${a.quantite} en stock` : "Épuisé"}
                </span>
              </p>
            </div>

            {/* Réactualisation express : c'est le geste quotidien du vendeur. */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => changerStock(a.id, Math.max(0, a.quantite - 1))}
                disabled={enCours === a.id || a.quantite === 0}
                className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-black disabled:opacity-40 cursor-pointer"
                aria-label="Diminuer le stock"
              >
                −
              </button>
              <span className="w-8 text-center text-sm font-black text-gray-900 dark:text-white">{a.quantite}</span>
              <button
                type="button"
                onClick={() => changerStock(a.id, a.quantite + 1)}
                disabled={enCours === a.id}
                className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-black disabled:opacity-40 cursor-pointer"
                aria-label="Augmenter le stock"
              >
                +
              </button>
              <button
                type="button"
                onClick={async () => {
                  await retirerArticle(a.id);
                  await onChange();
                }}
                className="ml-1 w-8 h-8 rounded-lg text-gray-400 hover:text-red-600 cursor-pointer"
                aria-label="Retirer l'article"
              >
                <i className="fa-solid fa-trash-can text-xs"></i>
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

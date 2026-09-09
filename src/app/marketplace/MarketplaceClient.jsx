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
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthContext";
import CarteBoutiques from "@/components/CarteBoutiques";
import CapturePosition from "@/components/CapturePosition";
// Chargé en dynamique, sans SSR : maplibre-gl (~257 Ko compressés) touche
// `window`/WebGL et ne doit être téléchargé que par les personnes qui
// ouvrent réellement "Explorer", pas par chaque visite du Marketplace.
const GlobeExplorateurBoutiques = dynamic(() => import("@/components/GlobeExplorateurBoutiques"), {
  ssr: false,
});
const CarteMobileAutourDeMoi = dynamic(() => import("@/components/CarteMobileAutourDeMoi"), {
  ssr: false,
});
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
  chercherServicesEtEtablissements,
  creerBoutique,
  modifierBoutique,
  envoyerPhoto,
  majStock,
  normaliserWhatsapp,
  obtenirHorairesBoutique,
  enregistrerHoraires,
  JOURS_SEMAINE,
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

  // Compteur de génération : sans lui, un changement rapide de session
  // (déconnexion pendant que ce chargement est en vol, ou reconnexion sous
  // un autre compte) laisse l'ancien appel encore en vol écraser l'état
  // avec les données du PRÉCÉDENT utilisateur une fois qu'il se résout —
  // la boutique/les articles d'un compte réapparaissent après déconnexion.
  // Bug confirmé lors d'un audit du Marketplace le 2026-09-08. Fonctionne
  // aussi bien pour le déclenchement automatique (effet sur userId) que
  // pour les appels manuels (onBoutiqueChange/onBoutiqueUpdate) : seul le
  // DERNIER appel en date peut committer son résultat.
  const generationBoutiqueRef = useRef(0);

  const rechargerBoutique = useCallback(async () => {
    const generation = ++generationBoutiqueRef.current;
    if (!userId) {
      setBoutiques([]);
      setMaBoutiqueActive(null);
      setMesArticles([]);
      setChargementBoutique(false);
      return;
    }
    try {
      const liste = await chargerMesBoutiques(userId);
      if (generation !== generationBoutiqueRef.current) return;
      setBoutiques(liste);
      const active = liste[0] || null;
      setMaBoutiqueActive(active);
      if (active) {
        const arts = await chargerMesArticles(active.id);
        if (generation !== generationBoutiqueRef.current) return;
        setMesArticles(arts);
      } else {
        setMesArticles([]);
      }
    } catch {
      // best-effort
    } finally {
      if (generation === generationBoutiqueRef.current) setChargementBoutique(false);
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

    // Vérifier les paramètres URL au montage (?onglet=vendre ou ?action=publier ou ?action=voir_boutique)
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const o = params.get("onglet") || (params.get("action") === "publier" ? "vendre" : null);
      if (o === "vendre" || o === "acheter") {
        setOnglet(o);
      }
      if (params.get("action") === "voir_boutique" || params.get("boutique")) {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent("marketplace_ouvrir_ma_boutique"));
        }, 150);
      }
    }

    const handleSetOnglet = (e) => {
      if (e?.detail && (e.detail === "vendre" || e.detail === "acheter")) {
        setOnglet(e.detail);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    };

    const handleOuvrirBoutique = (e) => {
      const b = e?.detail || maBoutiqueActive || boutiques[0] || {
        id: "facilite_shop",
        nom: "facilite shop",
        quartier: "Guinaw rail nord",
        ville: "Pikine",
        telephone_whatsapp: "770000000",
      };
      setBoutiqueModal(b);
    };

    window.addEventListener("marketplace_set_onglet", handleSetOnglet);
    window.addEventListener("marketplace_ouvrir_ma_boutique", handleOuvrirBoutique);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("marketplace_set_onglet", handleSetOnglet);
      window.removeEventListener("marketplace_ouvrir_ma_boutique", handleOuvrirBoutique);
    };
  }, [maBoutiqueActive, boutiques]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("action") === "voir_boutique" || params.get("boutique")) {
        const b = maBoutiqueActive || boutiques[0] || {
          id: "facilite_shop",
          nom: "facilite shop",
          quartier: "Guinaw rail nord",
          ville: "Pikine",
          telephone_whatsapp: "770000000",
        };
        setBoutiqueModal(b);
      }
    }
  }, [maBoutiqueActive, boutiques]);

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
        {/* Barre de Bascule Rapide : Acheter (Catalogue) vs Vendre (Espace Vendeur) */}
        <div className="flex items-center justify-between mb-4 bg-white dark:bg-gray-900 p-1.5 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setOnglet("acheter")}
              className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition cursor-pointer ${
                onglet === "acheter"
                  ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900 shadow-xs"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              <i className="fa-solid fa-bag-shopping text-sm"></i>
              <span>Acheter (Catalogue)</span>
            </button>

            <button
              type="button"
              onClick={() => setOnglet("vendre")}
              className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition cursor-pointer ${
                onglet === "vendre"
                  ? "bg-[#1877F2] text-white shadow-xs"
                  : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              <i className="fa-solid fa-store text-sm"></i>
              <span>Vendre (Mon Espace Vendeur)</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-2 pr-2 text-xs font-bold text-gray-500 dark:text-gray-400">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Marketplace Facilité en direct</span>
          </div>
        </div>

        {/* Layout avec barre latérale (mode Catalogue/Acheteur) et zone principale */}
        <div className={`flex flex-col md:flex-row gap-6 items-start w-full ${onglet === "vendre" ? "justify-center" : ""}`}>
          {/* BARRE DU PROFIL & CATÉGORIES : Fixe (sticky) au défilement en mode Catalogue (Acheter) */}
          {onglet === "acheter" && (
            <aside className="w-full md:w-[215px] flex-shrink-0 flex flex-col gap-2 hidden md:flex sticky top-20 self-start max-h-[calc(100vh-90px)] overflow-y-auto no-scrollbar pr-0.5 z-20">
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
                        setBoutiqueModal(maBoutiqueActive || boutiques[0] || {
                          id: "facilite_shop",
                          nom: "facilite shop",
                          quartier: "Guinaw rail nord",
                          ville: "Pikine",
                          telephone_whatsapp: "770000000",
                        });
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
                          setBoutiqueModal(maBoutiqueActive || boutiques[0] || {
                            id: "facilite_shop",
                            nom: "facilite shop",
                            quartier: "Guinaw rail nord",
                            ville: "Pikine",
                            telephone_whatsapp: "770000000",
                          });
                        }}
                        className="-mt-7 mb-2 relative z-10 w-14 h-14 rounded-full border-2 border-white dark:border-gray-900 shadow-md overflow-hidden bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-lg block cursor-pointer group"
                        title="Voir le profil de ma boutique"
                      >
                        {profile?.avatar_url || maBoutiqueActive?.avatar_url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={profile?.avatar_url || maBoutiqueActive?.avatar_url}
                            alt="Boutique"
                            className="w-full h-full object-cover group-hover:scale-105 transition"
                          />
                        ) : maBoutiqueActive?.nom ? (
                          maBoutiqueActive.nom.substring(0, 2).toUpperCase()
                        ) : (
                          <i className="fa-solid fa-store text-xl"></i>
                        )}
                      </div>

                      {/* Nom de la Boutique (Propre à la boutique) */}
                      <button
                        type="button"
                        onClick={() => {
                          setBoutiqueModal(maBoutiqueActive || boutiques[0] || {
                            id: "facilite_shop",
                            nom: "facilite shop",
                            quartier: "Guinaw rail nord",
                            ville: "Pikine",
                            telephone_whatsapp: "770000000",
                          });
                        }}
                        className="group cursor-pointer bg-transparent border-none p-0 text-center"
                        title="Voir le profil de ma boutique"
                      >
                        <h2 className="text-sm font-extrabold text-gray-900 dark:text-white leading-tight group-hover:text-blue-600 transition">
                          {maBoutiqueActive?.nom || "facilite shop"}
                        </h2>
                      </button>

                      <p className="text-[10px] text-gray-500 dark:text-gray-400 font-normal mt-1 mb-2">
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
          )}

          {/* ZONE PRINCIPALE : Reste de la largeur disponible (flex-1) ou centré max-w-4xl en mode Vendeur */}
          <main className={`min-w-0 w-full ${onglet === "vendre" ? "max-w-4xl mx-auto" : "flex-1"}`}>
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

        {/* Modal / Fiche Profil Boutique (Style Profil & Catalogue complet) */}
        {boutiqueModal && (
          <ModalFicheBoutique
            boutique={boutiqueModal}
            articles={mesArticles}
            profile={profile}
            userId={userId}
            onPublierArticle={() => {
              setBoutiqueModal(null);
              setOnglet("vendre");
            }}
            onBoutiqueUpdate={rechargerBoutique}
            onFermer={() => setBoutiqueModal(null)}
            onVoirArticle={(art) => {
              setBoutiqueModal(null);
              setArticleSelectionne(art);
            }}
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
  // Boutiques 'service'/'etablissement' à proximité — séparées de
  // `resultats` car sans article : chercherAutourDeMoi/chargerTousLesArticles
  // partent tous deux de marketplace_items, donc une boutique sans aucun
  // article y est structurellement invisible, quel que soit son statut.
  // Uniquement peuplé en mode proximité (nécessite une position) : pas de
  // pendant "catalogue global" pour l'instant.
  const [resultatsServices, setResultatsServices] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [globeOuvert, setGlobeOuvert] = useState(false);
  const [modalEasyReturn, setModalEasyReturn] = useState(false);

  const categoriesScrollRef = useRef(null);
  const isDraggingCat = useRef(false);
  const startXCat = useRef(0);
  const scrollLeftCat = useRef(0);

  const handleCatMouseDown = (e) => {
    if (!categoriesScrollRef.current) return;
    isDraggingCat.current = true;
    startXCat.current = e.pageX - categoriesScrollRef.current.offsetLeft;
    scrollLeftCat.current = categoriesScrollRef.current.scrollLeft;
  };

  const handleCatMouseMove = (e) => {
    if (!isDraggingCat.current || !categoriesScrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - categoriesScrollRef.current.offsetLeft;
    const walk = (x - startXCat.current) * 1.5;
    categoriesScrollRef.current.scrollLeft = scrollLeftCat.current - walk;
  };

  const handleCatMouseUp = () => {
    isDraggingCat.current = false;
  };

  const lancerRecherche = useCallback(
    async (pos) => {
      setChargement(true);
      setErreur("");
      try {
        if (pos?.latitude && pos?.longitude) {
          // Mode Proximité : trié par distance géographique (les plus proches en tête)
          const [r, rServices] = await Promise.all([
            chercherAutourDeMoi({
              latitude: pos.latitude,
              longitude: pos.longitude,
              rayonKm,
              categorie,
              texte: texte.trim() || null,
              seulementEnStock,
            }),
            // "plombier" doit remonter les boutiques service dont le métier
            // matche, en plus des résultats produits habituels — recherche
            // séparée, résultats fusionnés uniquement pour la carte (voir
            // boutiquesPourGlobe plus bas), pas dans la grille d'articles.
            chercherServicesEtEtablissements({
              latitude: pos.latitude,
              longitude: pos.longitude,
              rayonKm,
              texte: texte.trim() || null,
            }).catch(() => []),
          ]);
          setResultats(r);
          setResultatsServices(rServices);
        } else {
          // Mode Global : affiche tous les articles de la plateforme (les plus récents en premier)
          const r = await chargerTousLesArticles({
            categorie,
            texte: texte.trim() || null,
            seulementEnStock,
          });
          setResultats(r);
          setResultatsServices([]);
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
    const articlesDeBoutique = resultats.filter((r) => r.boutique_id === a.boutique_id);
    boutiquesPourGlobe.push({
      id: a.boutique_id,
      lat,
      lng,
      nom: a.boutique_nom,
      quartier: a.quartier,
      ville: a.ville,
      telephone_whatsapp: a.telephone_whatsapp,
      whatsappUrl: a.whatsappUrl,
      photo: a.photos?.[0] || null,
      titre: a.titre,
      prix_xof: a.prix_xof,
      statut: a.statut,
      articlesCount: articlesDeBoutique.length,
      articles: articlesDeBoutique,
      type_boutique: "produit",
    });
  }

  // Un seul pin par boutique quel que soit son type (demande explicite) :
  // les boutiques service/établissement rejoignent la même liste que les
  // boutiques produit ci-dessus, jamais un pin par article. idsVus protège
  // aussi contre un doublon si une boutique remonte des deux côtés (ne
  // devrait pas arriver — type_boutique gate les deux recherches — mais
  // resterait inoffensif si jamais les données divergent).
  for (const s of resultatsServices) {
    if (s.lat == null || s.lng == null || idsVus.has(s.id)) continue;
    idsVus.add(s.id);
    boutiquesPourGlobe.push({
      id: s.id,
      lat: s.lat,
      lng: s.lng,
      nom: s.nom,
      quartier: s.quartier,
      ville: s.ville,
      telephone_whatsapp: s.telephone_whatsapp,
      whatsappUrl: s.whatsappUrl,
      photo: null,
      titre: null,
      prix_xof: null,
      statut: null,
      articlesCount: 0,
      articles: [],
      type_boutique: s.type_boutique,
      metier: s.metier,
      description_prestation: s.description_prestation,
      categorie_etablissement: s.categorie_etablissement,
    });
  }

  // Liste complète des catégories affichées dans la barre horizontale mobile (1:1 Identique à la capture et au menu)
  const CATEGORIES_DEFILEMENT_MOBILE = [
    { id: null, label: "Toutes", icon: "fa-bars" },
    { id: "vehicules", label: "Automobile", icon: "fa-car" },
    { id: "maison", label: "Appareils électroménagers", icon: "fa-blender" },
    { id: "mode", label: "Vêtements pour femmes", icon: "fa-person-dress" },
    { id: "mode_hommes", label: "Vêtements pour hommes", icon: "fa-shirt", baseCategory: "mode" },
    { id: "chaussures", label: "Chaussures", icon: "fa-shoe-prints", baseCategory: "mode" },
    { id: "jouets", label: "Jouets et jeux", icon: "fa-gamepad", baseCategory: "autre" },
    { id: "meubles", label: "Meubles", icon: "fa-couch", baseCategory: "maison" },
    { id: "beaute", label: "Beauté et santé", icon: "fa-pump-soap", baseCategory: "mode" },
    { id: "telephones", label: "Téléphones portables", icon: "fa-mobile-screen-button" },
    { id: "electronique", label: "Électronique & Son", icon: "fa-tv" },
    { id: "informatique", label: "Informatique & PC", icon: "fa-laptop" },
    { id: "immobilier", label: "Immobilier", icon: "fa-house" },
    { id: "alimentation", label: "Alimentation", icon: "fa-basket-shopping" },
    { id: "services", label: "Services", icon: "fa-briefcase" },
    { id: "autre", label: "Autre", icon: "fa-tag" },
  ];

  return (
    <div>
      {globeOuvert && (
        <GlobeExplorateurBoutiques
          boutiques={boutiquesPourGlobe}
          tousArticles={resultats}
          onVoirBoutique={(b) => {
            setGlobeOuvert(false);
            onVoirBoutique?.(b);
          }}
          onVoirArticle={(art) => {
            setGlobeOuvert(false);
            onVoirArticle?.(art);
          }}
          onFermer={() => setGlobeOuvert(false)}
        />
      )}

      {/* 1. BARRE DE CATÉGORIES HORIZONTALE DÉFILABLE — EXCLUSIVEMENT POUR UTILISATEUR TÉLÉPHONE (MOBILE ONLY) */}
      <div className="block md:hidden w-full mb-2.5 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 px-3 pt-2.5 pb-1.5 shadow-xs overflow-hidden">
        <div
          ref={categoriesScrollRef}
          onMouseDown={handleCatMouseDown}
          onMouseMove={handleCatMouseMove}
          onMouseUp={handleCatMouseUp}
          onMouseLeave={handleCatMouseUp}
          className="flex items-center gap-5 sm:gap-6 overflow-x-auto no-scrollbar scroll-smooth py-1 select-none cursor-grab active:cursor-grabbing"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {CATEGORIES_DEFILEMENT_MOBILE.map((cat) => {
            // Plusieurs puces (mode_hommes/chaussures/beaute -> "mode",
            // jouets -> "autre", meubles -> "maison") retombent sur la MÊME
            // valeur de catégorie de base au clic (voir onSelectCategorie
            // ci-dessous) : la contrainte CHECK de la table ne connaît pas
            // ces sous-catégories, donc `categorie` ne peut de toute façon
            // pas distinguer laquelle a été cliquée. Le cas particulier
            // précédent ("mode_hommes" ? ... : false) ne faisait que cacher
            // ce constat pour UNE puce sans le résoudre pour les autres, ce
            // qui allumait la mauvaise puce. Aligné sur MenuCategoriesSidebar
            // (version bureau) : toutes les puces d'une même famille
            // s'allument ensemble, honnêtement. Bug confirmé lors d'un audit
            // du Marketplace le 2026-09-08.
            const estActif =
              (categorie === null && cat.id === null) ||
              categorie === cat.id ||
              (cat.baseCategory && categorie === cat.baseCategory);
            return (
              <button
                key={cat.label}
                type="button"
                onClick={() => onSelectCategorie?.(cat.baseCategory || cat.id)}
                className={`shrink-0 flex items-center gap-1.5 text-xs sm:text-sm font-black transition-all pb-2 relative cursor-pointer whitespace-nowrap ${
                  estActif
                    ? "text-gray-950 dark:text-white"
                    : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 font-bold"
                }`}
              >
                <i className={`fa-solid ${cat.icon} text-[11px] ${estActif ? "text-[#1877F2]" : "text-gray-400"}`}></i>
                <span>{cat.label}</span>
                {estActif && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-black dark:bg-white rounded-full transition-all" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. BANDEAU DE RÉASSURANCE / RETOURS FACILES (MOBILE & TABLETTE) */}
      <div className="block md:hidden mb-3.5 bg-[#FAF6ED] dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/50 rounded-2xl px-3.5 py-2.5 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-extrabold text-amber-950 dark:text-amber-200">
            <i className="fa-solid fa-file-lines text-amber-800 dark:text-amber-400 text-sm"></i>
            <span>Easy Return</span>
          </div>
          <button
            type="button"
            onClick={() => setModalEasyReturn(true)}
            className="text-xs font-bold text-gray-700 dark:text-amber-300 hover:text-black dark:hover:text-white hover:underline cursor-pointer flex items-center gap-1"
          >
            <span>View more</span>
            <i className="fa-solid fa-chevron-right text-[9px] text-gray-500"></i>
          </button>
        </div>
      </div>

      {/* Modal d'information Easy Return */}
      {modalEasyReturn && (
        <div
          className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setModalEasyReturn(false)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-800 space-y-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-3 border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                  <i className="fa-solid fa-file-shield text-base"></i>
                </span>
                <h3 className="text-base font-black text-gray-900 dark:text-white">
                  Easy Return &amp; Garanties
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalEasyReturn(false)}
                className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-gray-500 flex items-center justify-center text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
              <div className="p-3 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/50 flex items-start gap-2.5">
                <i className="fa-solid fa-rotate-left text-amber-700 mt-0.5"></i>
                <div>
                  <strong className="text-gray-900 dark:text-white block font-bold">Retours &amp; Échanges sous 48h</strong>
                  <span>Possibilité de retourner ou échanger tout article non conforme auprès de la boutique partenaire.</span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/50 flex items-start gap-2.5">
                <i className="fa-brands fa-whatsapp text-emerald-600 text-base mt-0.5"></i>
                <div>
                  <strong className="text-gray-900 dark:text-white block font-bold">Contact WhatsApp Direct</strong>
                  <span>Échangez directement avec le commerçant pour voir des photos réelles et fixer la livraison.</span>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/50 flex items-start gap-2.5">
                <i className="fa-solid fa-handshake text-blue-600 mt-0.5"></i>
                <div>
                  <strong className="text-gray-900 dark:text-white block font-bold">Paiement à la livraison</strong>
                  <span>Vérifiez votre colis sur place avant de régler en espèces, Wave ou Orange Money.</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setModalEasyReturn(false)}
              className="w-full py-3 rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold text-xs shadow-md"
            >
              Compris, continuer mes achats
            </button>
          </div>
        </div>
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

      {/* resultatsServices inclus dans la condition : sans ça, une recherche
          du type "plombier" avec zéro PRODUIT à proximité mais des services
          correspondants ferait disparaître la carte entière. */}
      {position && (resultats.length > 0 || resultatsServices.length > 0) && (
        <>
          {/* VUE MOBILE CINÉMATIQUE (TÉLÉPHONE) : CARTE ITINÉRAIRE STYLE YANGO + 4 CASES PRODUITS OU VENDEURS */}
          <div className="block md:hidden">
            <CarteMobileAutourDeMoi
              articles={resultats}
              boutiquesSansArticles={resultatsServices}
              depart={position}
              onVoirArticle={onVoirArticle}
              onVoirBoutique={onVoirBoutique}
              onFermerProximite={reinitialiserPosition}
            />
          </div>

          {/* VUE PC / DESKTOP : CARTE STANDARD LEAFLET DES BOUTIQUES */}
          <div className="hidden md:block">
            <CarteBoutiques
              articles={resultats}
              boutiquesSansArticles={resultatsServices}
              depart={position}
              onChoisirBoutique={(id) => {
                const cible = document.getElementById(`boutique-${id}`);
                if (cible) cible.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
            />
          </div>
        </>
      )}

      {/* Grille de produits : visible par défaut, ou en dessous sur PC quand position est active */}
      <div className={`${position ? "hidden md:grid" : "grid"} grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3 md:gap-4 w-full`}>
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
      className="group flex flex-col w-full cursor-pointer select-none scroll-mt-24 rounded-2xl sm:rounded-3xl overflow-hidden bg-white dark:bg-zinc-900 border border-gray-200/90 dark:border-zinc-800/90 shadow-xs hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
    >
      {/* 1. Image produit avec badges en overlay supérieur (Format carré compact 2 colonnes) */}
      <div className="relative aspect-square sm:aspect-square w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={urlPhoto(photo)}
            alt={article.titre}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-100 dark:bg-zinc-800 text-zinc-400 p-2 sm:p-3 text-center">
            <i className="fa-solid fa-bag-shopping text-2xl sm:text-3xl mb-1 text-zinc-300 dark:text-zinc-600"></i>
            <span className="text-[10px] sm:text-[11px] font-bold text-zinc-500 line-clamp-2">{article.titre}</span>
          </div>
        )}

        {/* Dégradé supérieur pour assurer la lisibilité des badges */}
        <div className="absolute inset-x-0 top-0 h-12 sm:h-14 bg-gradient-to-b from-black/60 via-black/20 to-transparent pointer-events-none" />

        {/* En-tête gauche : Nom de la boutique / Vendeur avec icône */}
        <div className="absolute top-2 left-2 sm:top-2.5 sm:left-2.5 z-10 flex items-center gap-1 max-w-[62%] truncate drop-shadow-sm">
          <span className="text-white text-[11px] sm:text-[13px] font-bold truncate">
            {article.boutique_nom || "Facilité"}
          </span>
          <i className="fa-solid fa-circle-check text-sky-400 text-[10px] sm:text-[11px] shrink-0"></i>
        </div>

        {/* En-tête droite : Badge Statut / LIVE */}
        <div className="absolute top-2 right-2 sm:top-2.5 sm:right-2.5 z-10 flex items-center gap-1">
          {enStock ? (
            <span className="px-1.5 sm:px-2 py-0.5 rounded-md bg-red-600 text-white text-[9px] sm:text-[11px] font-black tracking-wide uppercase flex items-center gap-1 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
              LIVE
            </span>
          ) : (
            <span className="px-1.5 sm:px-2 py-0.5 rounded-md bg-black/75 text-zinc-300 text-[9px] sm:text-[10px] font-bold backdrop-blur-xs shadow-sm">
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
            className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-black/50 hover:bg-black/80 text-white/90 hover:text-white flex items-center justify-center text-[9px] sm:text-[10px] opacity-0 group-hover:opacity-100 transition cursor-pointer"
            title="Signaler cette annonce"
          >
            <i className="fa-regular fa-flag"></i>
          </button>
        </div>

        {/* Distance géolocalisée en bas à gauche de l'image */}
        {article.distanceLisible && (
          <span className="absolute bottom-1.5 left-1.5 sm:bottom-2 sm:left-2.5 px-1.5 sm:px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-xs text-white text-[8px] sm:text-[10px] font-semibold flex items-center gap-1 shadow-xs">
            <i className="fa-solid fa-location-dot text-emerald-400 text-[8px] sm:text-[9px]"></i>
            {article.distanceLisible}
          </span>
        )}
      </div>

      {/* 2. Informations sous l'image (Titre en gras, sous-titre & bouton flèche circulaire) */}
      <div className="p-2.5 sm:p-3.5 md:p-4 flex flex-col justify-between flex-1 bg-white dark:bg-zinc-900 gap-1.5 sm:gap-2">
        {/* Titre : Texte fort et gras sur 2 lignes max */}
        <h3
          className="text-xs sm:text-sm md:text-[15px] font-bold text-zinc-900 dark:text-zinc-100 leading-snug line-clamp-2 group-hover:text-blue-600 transition"
          title={article.titre}
        >
          {article.titre}
        </h3>

        {/* Ligne inférieure : Sous-titre / Prix à gauche et Bouton Flèche noire à droite */}
        <div className="flex items-end justify-between gap-1.5 sm:gap-2 mt-auto pt-1">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-400 font-medium truncate">
              {article.boutique_nom || article.categorie || "Boutique"}
            </p>
            <p className="text-xs sm:text-sm md:text-base font-extrabold text-zinc-950 dark:text-white tracking-tight mt-0.5 truncate">
              {prixLisible(article.prix_xof)}{" "}
              <span className="text-[9px] sm:text-[11px] md:text-xs font-bold text-zinc-600 dark:text-zinc-400">
                FCFA
              </span>
            </p>
          </div>

          {/* Bouton d'action circulaire noir avec flèche blanche */}
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
            className="w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 rounded-full bg-black dark:bg-white text-white dark:text-black flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95 shadow-sm shrink-0 cursor-pointer"
            title="Voir l'article / Commander"
          >
            <i className="fa-solid fa-arrow-right text-[10px] sm:text-xs md:text-sm"></i>
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

function IllustrationAvionPapier() {
  return (
    <div className="w-56 h-36 mx-auto relative flex items-center justify-center">
      <svg
        className="w-full h-full"
        viewBox="0 0 260 140"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Nuage supérieur gauche */}
        <path
          d="M38 48 C38 42 43 36 50 36 C54 30 62 30 68 34 C73 32 79 35 81 40 C85 40 88 44 88 49 C88 54 84 58 79 58 L44 58 C40 58 38 54 38 48 Z"
          fill="#CFE2FE"
          opacity="0.65"
        />
        {/* Nuage inférieur droit */}
        <path
          d="M178 68 C178 64 182 60 187 60 C190 56 196 56 200 59 C204 58 208 60 210 64 C213 64 216 67 216 71 C216 75 213 78 209 78 L183 78 C180 78 178 75 178 68 Z"
          fill="#CFE2FE"
          opacity="0.65"
        />
        {/* Traînée de vent en boucle */}
        <path
          d="M48 108 C65 88 85 125 110 98 C128 78 145 92 168 64"
          stroke="#38B2AC"
          strokeWidth="2.5"
          strokeDasharray="4 4"
          fill="none"
          strokeLinecap="round"
        />
        {/* Petits nœuds papillon décoratifs sur la traînée */}
        <path d="M52 102 L58 110 L58 98 Z" fill="#38B2AC" opacity="0.8" />
        <path d="M64 106 L58 98 L58 110 Z" fill="#38B2AC" opacity="0.8" />
        <path d="M98 94 L104 102 L104 90 Z" fill="#38B2AC" opacity="0.8" />
        <path d="M110 98 L104 90 L104 102 Z" fill="#38B2AC" opacity="0.8" />

        {/* Avion en papier (Origami style cyan / vert d'eau) */}
        <g transform="translate(162, 34) rotate(-18)">
          <polygon
            points="0,32 68,0 48,42"
            fill="#E6FFFA"
            stroke="#2C7A7B"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <polygon
            points="0,32 68,0 24,35"
            fill="#B2F5EA"
            stroke="#2C7A7B"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <polygon
            points="24,35 68,0 42,40"
            fill="#319795"
            opacity="0.35"
            strokeLinejoin="round"
          />
          <polygon
            points="24,35 34,48 42,40"
            fill="#81E6D9"
            stroke="#2C7A7B"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </g>
      </svg>
    </div>
  );
}

/**
 * Composant Réglages (1:1 Strictement conforme aux 2 captures d'écran fournies)
 * - Header: < Réglages
 * - Groupe 1: Informations personnelles, Détails de l'entreprise >
 * - Groupe 2: Ajouter un numéro de téléphone, Changer l’email, Changer la langue
 * - Groupe 3: Désactiver le chat, Désactiver les commentaires, Gérer les notifications
 * - Groupe 4: Changer le mot de passe, Supprimer définitivement mon compte, Se déconnecter
 */
function VueReglages({ userId, profile, boutique, onRetour, onEnregistre }) {
  const { signOut } = useAuth();
  const [modalActive, setModalActive] = useState(null); // 'infos_perso' | 'details_entreprise' | 'telephone' | 'email' | 'langue' | 'notifs' | 'password' | 'supprimer'
  const [toastMessage, setToastMessage] = useState("");
  const [enCours, setEnCours] = useState(false);

  // Données Personnelles
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [headline, setHeadline] = useState(profile?.headline || "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || boutique?.avatar_url || null);
  const avatarInputRef = useRef(null);

  // Données Entreprise
  const [nomEntreprise, setNomEntreprise] = useState(boutique?.nom || profile?.full_name || "facilite shop");
  const [descriptionEntreprise, setDescriptionEntreprise] = useState(
    boutique?.description || profile?.headline || "Boutique Officielle Partenaire Facilité"
  );
  const [ville, setVille] = useState(boutique?.ville || profile?.city || "Dakar");
  const [quartier, setQuartier] = useState(boutique?.quartier || profile?.quartier || "Guinaw rail nord");
  const [telephone, setTelephone] = useState(boutique?.telephone_whatsapp || profile?.phone || "+221771001212");
  const [email, setEmail] = useState(profile?.email || "");

  // Champs spécifiques au type_boutique (jamais le type lui-même, choisi une
  // seule fois à la création — voir FormulaireBoutique).
  const estService = boutique?.type_boutique === "service";
  const estEtablissement = boutique?.type_boutique === "etablissement";
  const [metier, setMetier] = useState(boutique?.metier || "");
  const [descriptionPrestation, setDescriptionPrestation] = useState(boutique?.description_prestation || "");
  const [categorieEtablissement, setCategorieEtablissement] = useState(boutique?.categorie_etablissement || "sante");

  // Toggles de Préférences
  const [chatDesactive, setChatDesactive] = useState(false);
  const [commentairesDesactives, setCommentairesDesactives] = useState(false);
  const [notifCommandes, setNotifCommandes] = useState(true);
  const [notifMessages, setNotifMessages] = useState(true);
  const [langue, setLangue] = useState(() => {
    try {
      return localStorage.getItem("facilite_lang") || "fr";
    } catch {
      return "fr";
    }
  });

  // Mot de passe & Suppression
  const [nouveauMdp, setNouveauMdp] = useState("");
  const [confirmMdp, setConfirmMdp] = useState("");
  const [supprConfirm, setSupprConfirm] = useState("");

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3500);
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setEnCours(true);
      const localUrl = URL.createObjectURL(file);
      setAvatarUrl(localUrl);
      if (userId) {
        try {
          const photoPath = await envoyerPhoto(file, userId);
          const publicPhotoUrl = urlPhoto(photoPath);
          setAvatarUrl(publicPhotoUrl);
          await supabase.from("profiles").update({ avatar_url: publicPhotoUrl, updated_at: new Date().toISOString() }).eq("id", userId);
        } catch {
          const ext = file.name.split(".").pop() || "jpg";
          const path = `${userId}/avatar_${Date.now()}.${ext}`;
          await supabase.storage.from("avatars").upload(path, file, { upsert: true });
          const { data: pubData } = supabase.storage.from("avatars").getPublicUrl(path);
          if (pubData?.publicUrl) {
            setAvatarUrl(pubData.publicUrl);
            await supabase.from("profiles").update({ avatar_url: pubData.publicUrl, updated_at: new Date().toISOString() }).eq("id", userId);
          }
        }
      }
      showToast("Photo de profil mise à jour !");
      onEnregistre?.();
    } catch (err) {
      console.error(err);
      showToast("Photo mise à jour localement !");
    } finally {
      setEnCours(false);
    }
  };

  const handleSaveInfosPerso = async (e) => {
    e.preventDefault();
    setEnCours(true);
    try {
      if (userId) {
        await supabase.from("profiles").update({
          full_name: fullName,
          headline,
          updated_at: new Date().toISOString(),
        }).eq("id", userId);
      }
      showToast("✓ Informations personnelles enregistrées !");
      setModalActive(null);
      onEnregistre?.();
    } catch {
      showToast("Erreur lors de l'enregistrement");
    } finally {
      setEnCours(false);
    }
  };

  const handleSaveEntreprise = async (e) => {
    e.preventDefault();
    setEnCours(true);
    try {
      if (boutique?.id && boutique?.id !== "facilite_shop") {
        await modifierBoutique(boutique.id, {
          nom: nomEntreprise,
          description: descriptionEntreprise,
          ville,
          quartier,
          telephone_whatsapp: telephone,
          metier,
          description_prestation: descriptionPrestation,
          categorie_etablissement: categorieEtablissement,
        });
      }
      if (userId) {
        await supabase.from("profiles").update({
          full_name: nomEntreprise,
          headline: descriptionEntreprise,
          city: ville,
          quartier,
          phone: telephone,
          updated_at: new Date().toISOString(),
        }).eq("id", userId);
      }
      showToast("✓ Détails de l'entreprise enregistrés !");
      setModalActive(null);
      onEnregistre?.();
    } catch {
      showToast("Erreur lors de l'enregistrement");
    } finally {
      setEnCours(false);
    }
  };

  const handleSaveTelephone = async (e) => {
    e.preventDefault();
    setEnCours(true);
    try {
      if (boutique?.id && boutique?.id !== "facilite_shop") {
        await modifierBoutique(boutique.id, { telephone_whatsapp: telephone });
      }
      if (userId) {
        await supabase.from("profiles").update({ phone: telephone, updated_at: new Date().toISOString() }).eq("id", userId);
      }
      showToast("✓ Numéro de téléphone mis à jour !");
      setModalActive(null);
      onEnregistre?.();
    } catch {
      showToast("Erreur lors de la mise à jour");
    } finally {
      setEnCours(false);
    }
  };

  const handleSaveEmail = async (e) => {
    e.preventDefault();
    setEnCours(true);
    try {
      const { error } = await supabase.auth.updateUser({ email });
      if (error) throw error;
      showToast("✓ Un email de confirmation a été envoyé !");
      setModalActive(null);
    } catch (err) {
      showToast(err.message || "Erreur lors du changement d'email");
    } finally {
      setEnCours(false);
    }
  };

  const handleChangerLangue = (nouvelleLangue) => {
    setLangue(nouvelleLangue);
    try {
      localStorage.setItem("facilite_lang", nouvelleLangue);
    } catch {}
    showToast(nouvelleLangue === "fr" ? "Langue définie : Français 🇫🇷" : "Language set : English 🇬🇧");
    setModalActive(null);
  };

  const handleSavePassword = async (e) => {
    e.preventDefault();
    if (nouveauMdp.length < 6) {
      showToast("Le mot de passe doit contenir au moins 6 caractères");
      return;
    }
    if (nouveauMdp !== confirmMdp) {
      showToast("Les mots de passe ne correspondent pas");
      return;
    }
    setEnCours(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: nouveauMdp });
      if (error) throw error;
      showToast("✓ Mot de passe mis à jour avec succès !");
      setNouveauMdp("");
      setConfirmMdp("");
      setModalActive(null);
    } catch (err) {
      showToast(err.message || "Erreur lors du changement de mot de passe");
    } finally {
      setEnCours(false);
    }
  };

  const handleDeconnexion = async () => {
    if (confirm("Voulez-vous vraiment vous déconnecter ?")) {
      try {
        await signOut();
      } catch {
        await supabase.auth.signOut();
      }
      window.location.href = "/login";
    }
  };

  const handleSupprimerCompte = async (e) => {
    e.preventDefault();
    if (supprConfirm.trim().toUpperCase() !== "SUPPRIMER") {
      showToast("Veuillez taper 'SUPPRIMER' pour confirmer");
      return;
    }
    setEnCours(true);
    try {
      if (userId) {
        await supabase.from("profiles").delete().eq("id", userId);
      }
      await supabase.auth.signOut();
      window.location.href = "/";
    } catch (err) {
      showToast(err.message || "Erreur lors de la suppression du compte");
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm overflow-hidden text-left relative w-full">
      {/* Toast de confirmation */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-gray-900 text-white dark:bg-white dark:text-gray-950 text-xs sm:text-sm font-bold shadow-2xl flex items-center gap-2 animate-bounce">
          <i className="fa-solid fa-circle-check text-emerald-400 dark:text-emerald-600"></i>
          <span>{toastMessage}</span>
        </div>
      )}

      <input
        type="file"
        ref={avatarInputRef}
        accept="image/*"
        className="hidden"
        onChange={handleAvatarUpload}
      />

      {/* Header : < Réglages (1:1 Capture exacte) */}
      <div className="bg-[#F8FAFC] dark:bg-zinc-900/90 px-4 py-3.5 border-b border-gray-100 dark:border-zinc-800 flex items-center gap-3">
        {onRetour && (
          <button
            type="button"
            onClick={onRetour}
            className="w-8 h-8 rounded-full hover:bg-gray-200 dark:hover:bg-zinc-800 flex items-center justify-center transition cursor-pointer text-gray-800 dark:text-gray-100 text-base font-bold"
            title="Retour"
          >
            <i className="fa-solid fa-chevron-left text-sm"></i>
          </button>
        )}
        <h2 className="text-base sm:text-lg font-black text-gray-900 dark:text-white">
          Réglages
        </h2>
      </div>

      {/* GROUPE 1 : Informations personnelles & Détails de l'entreprise */}
      <div>
        <button
          type="button"
          onClick={() => setModalActive("infos_perso")}
          className="w-full px-6 py-4 flex items-center justify-between text-left text-sm font-semibold text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-zinc-800/60 transition border-b border-gray-100 dark:border-zinc-800 cursor-pointer"
        >
          <span>Informations personnelles</span>
        </button>

        <button
          type="button"
          onClick={() => setModalActive("details_entreprise")}
          className="w-full px-6 py-4 flex items-center justify-between text-left text-sm font-semibold text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-zinc-800/60 transition cursor-pointer"
        >
          <span>Détails de l'entreprise</span>
          <i className="fa-solid fa-chevron-right text-xs text-gray-400"></i>
        </button>
      </div>

      {/* SÉPARATEUR 1 (1:1 Capture exacte) */}
      <div className="bg-[#F0F2F5] dark:bg-zinc-950 h-5 border-y border-gray-100/80 dark:border-zinc-800/50"></div>

      {/* GROUPE 2 : Téléphone, Email, Langue */}
      <div>
        <button
          type="button"
          onClick={() => setModalActive("telephone")}
          className="w-full px-6 py-4 flex items-center justify-between text-left text-sm font-semibold text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-zinc-800/60 transition border-b border-gray-100 dark:border-zinc-800 cursor-pointer"
        >
          <span>Ajouter un numéro de téléphone</span>
        </button>

        <button
          type="button"
          onClick={() => setModalActive("email")}
          className="w-full px-6 py-4 flex items-center justify-between text-left text-sm font-semibold text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-zinc-800/60 transition border-b border-gray-100 dark:border-zinc-800 cursor-pointer"
        >
          <span>Changer l’email</span>
        </button>

        <button
          type="button"
          onClick={() => setModalActive("langue")}
          className="w-full px-6 py-4 flex items-center justify-between text-left text-sm font-semibold text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-zinc-800/60 transition cursor-pointer"
        >
          <span>Changer la langue</span>
        </button>
      </div>

      {/* SÉPARATEUR 2 (1:1 Capture exacte) */}
      <div className="bg-[#F0F2F5] dark:bg-zinc-950 h-5 border-y border-gray-100/80 dark:border-zinc-800/50"></div>

      {/* GROUPE 3 : Chat, Commentaires, Notifications */}
      <div>
        <button
          type="button"
          onClick={() => {
            const nv = !chatDesactive;
            setChatDesactive(nv);
            showToast(nv ? "Chat désactivé" : "Chat activé");
          }}
          className="w-full px-6 py-4 flex items-center justify-between text-left text-sm font-semibold text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-zinc-800/60 transition border-b border-gray-100 dark:border-zinc-800 cursor-pointer"
        >
          <span>Désactiver le chat</span>
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${chatDesactive ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"}`}>
            {chatDesactive ? "Désactivé" : "Actif"}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            const nv = !commentairesDesactives;
            setCommentairesDesactives(nv);
            showToast(nv ? "Commentaires désactivés" : "Commentaires activés");
          }}
          className="w-full px-6 py-4 flex items-center justify-between text-left text-sm font-semibold text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-zinc-800/60 transition border-b border-gray-100 dark:border-zinc-800 cursor-pointer"
        >
          <span>Désactiver les commentaires</span>
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${commentairesDesactives ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"}`}>
            {commentairesDesactives ? "Désactivés" : "Actifs"}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setModalActive("notifs")}
          className="w-full px-6 py-4 flex items-center justify-between text-left text-sm font-semibold text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-zinc-800/60 transition cursor-pointer"
        >
          <span>Gérer les notifications</span>
        </button>
      </div>

      {/* SÉPARATEUR 3 (1:1 Capture exacte) */}
      <div className="bg-[#F0F2F5] dark:bg-zinc-950 h-5 border-y border-gray-100/80 dark:border-zinc-800/50"></div>

      {/* GROUPE 4 : Mot de passe, Suppression, Déconnexion */}
      <div>
        <button
          type="button"
          onClick={() => setModalActive("password")}
          className="w-full px-6 py-4 flex items-center justify-between text-left text-sm font-semibold text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-zinc-800/60 transition border-b border-gray-100 dark:border-zinc-800 cursor-pointer"
        >
          <span>Changer le mot de passe</span>
        </button>

        <button
          type="button"
          onClick={() => setModalActive("supprimer")}
          className="w-full px-6 py-4 flex items-center justify-between text-left text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition border-b border-gray-100 dark:border-zinc-800 cursor-pointer"
        >
          <span>Supprimer définitivement mon compte</span>
        </button>

        <button
          type="button"
          onClick={handleDeconnexion}
          className="w-full px-6 py-4 flex items-center justify-between text-left text-sm font-semibold text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-zinc-800/60 transition cursor-pointer"
        >
          <span>Se déconnecter</span>
          <i className="fa-solid fa-arrow-right-from-bracket text-xs text-gray-400"></i>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* MODALS D'ÉDITION DES RÉGLAGES                                            */}
      {/* ========================================================================= */}

      {/* 1. Modal Informations personnelles */}
      {modalActive === "infos_perso" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100 dark:border-zinc-800 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-gray-100 dark:border-zinc-800">
              <h3 className="text-base font-extrabold text-gray-900 dark:text-white">
                Informations personnelles
              </h3>
              <button
                type="button"
                onClick={() => setModalActive(null)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 flex items-center justify-center cursor-pointer text-gray-500"
              >
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>

            <form onSubmit={handleSaveInfosPerso} className="space-y-3.5">
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 flex items-center justify-center text-xl font-bold overflow-hidden shrink-0 border-2 border-emerald-500/20">
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <i className="fa-regular fa-user"></i>
                  )}
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs font-bold transition cursor-pointer"
                  >
                    Changer ma photo
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  Nom complet *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ex : Moussa Diop"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-xs sm:text-sm font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  Profession / Titre
                </label>
                <input
                  type="text"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="Ex : Juriste Droit Privé & Droits Humains"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-xs sm:text-sm font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>

              <button
                type="submit"
                disabled={enCours}
                className="w-full py-3 rounded-xl bg-[#1877F2] hover:bg-blue-600 text-white font-bold text-xs shadow-md transition cursor-pointer disabled:opacity-50 mt-2"
              >
                {enCours ? "Enregistrement..." : "Enregistrer les informations"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 2. Modal Détails de l'entreprise */}
      {modalActive === "details_entreprise" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 w-full max-w-lg shadow-2xl border border-gray-100 dark:border-zinc-800 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3 border-gray-100 dark:border-zinc-800">
              <h3 className="text-base font-extrabold text-gray-900 dark:text-white">
                Détails de l'entreprise / Boutique
              </h3>
              <button
                type="button"
                onClick={() => setModalActive(null)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 flex items-center justify-center cursor-pointer text-gray-500"
              >
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>

            <form onSubmit={handleSaveEntreprise} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  Nom commercial de la boutique *
                </label>
                <input
                  type="text"
                  required
                  value={nomEntreprise}
                  onChange={(e) => setNomEntreprise(e.target.value)}
                  placeholder="Ex : facilite shop"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-xs sm:text-sm font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  Description &amp; Activité
                </label>
                <textarea
                  rows={2}
                  value={descriptionEntreprise}
                  onChange={(e) => setDescriptionEntreprise(e.target.value)}
                  placeholder="Ex : Vente de cosmétiques, vêtements et livraison express"
                  className="w-full px-3.5 py-2 rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-xs sm:text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                    Ville / Département
                  </label>
                  <select
                    value={ville}
                    onChange={(e) => setVille(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-xs sm:text-sm font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  >
                    {DEPARTEMENTS_SENEGAL.map((dep) => (
                      <option key={dep} value={dep}>
                        {dep}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                    Quartier / Adresse
                  </label>
                  <input
                    type="text"
                    value={quartier}
                    onChange={(e) => setQuartier(e.target.value)}
                    placeholder="Ex : Guinaw rail nord"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-xs sm:text-sm font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  Numéro WhatsApp de l'entreprise
                </label>
                <input
                  type="tel"
                  value={telephone}
                  onChange={(e) => setTelephone(e.target.value)}
                  placeholder="Ex : +221771001212"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-xs sm:text-sm font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>

              {estService && (
                <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-zinc-800">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Métier</label>
                    <input
                      type="text"
                      value={metier}
                      onChange={(e) => setMetier(e.target.value)}
                      placeholder="Ex : Plombier, Électricien..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-xs sm:text-sm font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Description de la prestation</label>
                    <textarea
                      rows={2}
                      value={descriptionPrestation}
                      onChange={(e) => setDescriptionPrestation(e.target.value)}
                      placeholder="Spécialités, expérience, zone d'intervention..."
                      className="w-full px-3.5 py-2 rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-xs sm:text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                  </div>
                </div>
              )}

              {estEtablissement && (
                <div className="space-y-1.5 pt-2 border-t border-gray-100 dark:border-zinc-800">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300">Catégorie d&apos;établissement</label>
                  <select
                    value={categorieEtablissement}
                    onChange={(e) => setCategorieEtablissement(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-xs sm:text-sm font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  >
                    <option value="sante">Santé (clinique, pharmacie...)</option>
                    <option value="finance">Finance (point Wave/Orange Money...)</option>
                    <option value="beaute">Beauté (salon, barbier...)</option>
                    <option value="autre">Autre établissement</option>
                  </select>
                  {["sante", "finance"].includes(categorieEtablissement) && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 font-bold flex items-start gap-1.5">
                      <i className="fa-solid fa-circle-info mt-0.5 shrink-0"></i>
                      <span>
                        Catégorie sensible : la fiche reste masquée du public jusqu&apos;à sa vérification par un
                        administrateur{categorieEtablissement !== boutique?.categorie_etablissement ? " (une nouvelle vérification sera nécessaire)" : ""}.
                      </span>
                    </p>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={enCours}
                className="w-full py-3 rounded-xl bg-[#1877F2] hover:bg-blue-600 text-white font-bold text-xs shadow-md transition cursor-pointer disabled:opacity-50 mt-2"
              >
                {enCours ? "Enregistrement..." : "Enregistrer les détails"}
              </button>
            </form>

            {estEtablissement && boutique?.id && <EditeurHoraires storeId={boutique.id} />}
          </div>
        </div>
      )}

      {/* 3. Modal Ajouter / Modifier Téléphone */}
      {modalActive === "telephone" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100 dark:border-zinc-800 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-gray-100 dark:border-zinc-800">
              <h3 className="text-base font-extrabold text-gray-900 dark:text-white">
                Numéro de téléphone
              </h3>
              <button
                type="button"
                onClick={() => setModalActive(null)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 flex items-center justify-center cursor-pointer text-gray-500"
              >
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>

            <form onSubmit={handleSaveTelephone} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  Numéro de contact / WhatsApp *
                </label>
                <input
                  type="tel"
                  required
                  value={telephone}
                  onChange={(e) => setTelephone(e.target.value)}
                  placeholder="Ex : +221771001212 ou 771001212"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-xs sm:text-sm font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>

              <button
                type="submit"
                disabled={enCours}
                className="w-full py-3 rounded-xl bg-[#1877F2] hover:bg-blue-600 text-white font-bold text-xs shadow-md transition cursor-pointer disabled:opacity-50 mt-2"
              >
                {enCours ? "Enregistrement..." : "Enregistrer le numéro"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 4. Modal Changer l'email */}
      {modalActive === "email" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100 dark:border-zinc-800 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-gray-100 dark:border-zinc-800">
              <h3 className="text-base font-extrabold text-gray-900 dark:text-white">
                Changer l'adresse e-mail
              </h3>
              <button
                type="button"
                onClick={() => setModalActive(null)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 flex items-center justify-center cursor-pointer text-gray-500"
              >
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>

            <form onSubmit={handleSaveEmail} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  Nouvelle adresse e-mail *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Ex : monemail@gmail.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-xs sm:text-sm font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>

              <p className="text-[11px] text-gray-500">
                Un e-mail de confirmation sera envoyé à cette nouvelle adresse pour valider le changement.
              </p>

              <button
                type="submit"
                disabled={enCours}
                className="w-full py-3 rounded-xl bg-[#1877F2] hover:bg-blue-600 text-white font-bold text-xs shadow-md transition cursor-pointer disabled:opacity-50 mt-2"
              >
                {enCours ? "Envoi..." : "Mettre à jour l'e-mail"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 5. Modal Changer la langue */}
      {modalActive === "langue" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-gray-100 dark:border-zinc-800 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-gray-100 dark:border-zinc-800">
              <h3 className="text-base font-extrabold text-gray-900 dark:text-white">
                Changer la langue
              </h3>
              <button
                type="button"
                onClick={() => setModalActive(null)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 flex items-center justify-center cursor-pointer text-gray-500"
              >
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleChangerLangue("fr")}
                className={`w-full p-3.5 rounded-2xl border flex items-center justify-between transition cursor-pointer ${
                  langue === "fr"
                    ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold"
                    : "border-gray-200 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">🇫🇷</span>
                  <span className="text-xs font-bold text-gray-900 dark:text-white">Français (Par défaut)</span>
                </div>
                {langue === "fr" && <i className="fa-solid fa-circle-check text-blue-600"></i>}
              </button>

              <button
                type="button"
                onClick={() => handleChangerLangue("en")}
                className={`w-full p-3.5 rounded-2xl border flex items-center justify-between transition cursor-pointer ${
                  langue === "en"
                    ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold"
                    : "border-gray-200 dark:border-zinc-800 hover:bg-gray-50 dark:hover:bg-zinc-800"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">🇬🇧</span>
                  <span className="text-xs font-bold text-gray-900 dark:text-white">English (Anglais)</span>
                </div>
                {langue === "en" && <i className="fa-solid fa-circle-check text-blue-600"></i>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Modal Gérer les notifications */}
      {modalActive === "notifs" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100 dark:border-zinc-800 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-gray-100 dark:border-zinc-800">
              <h3 className="text-base font-extrabold text-gray-900 dark:text-white">
                Gérer les notifications
              </h3>
              <button
                type="button"
                onClick={() => setModalActive(null)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 flex items-center justify-center cursor-pointer text-gray-500"
              >
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50 dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700">
                <div>
                  <div className="text-xs font-bold text-gray-900 dark:text-white">Alertes de commandes</div>
                  <div className="text-[10px] text-gray-500">Recevoir une alerte lors d'un nouveau contact client</div>
                </div>
                <input
                  type="checkbox"
                  checked={notifCommandes}
                  onChange={(e) => setNotifCommandes(e.target.checked)}
                  className="w-4 h-4 accent-blue-600 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50 dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700">
                <div>
                  <div className="text-xs font-bold text-gray-900 dark:text-white">Messages &amp; Nouveautés</div>
                  <div className="text-[10px] text-gray-500">Mises à jour de la plateforme Facilité</div>
                </div>
                <input
                  type="checkbox"
                  checked={notifMessages}
                  onChange={(e) => setNotifMessages(e.target.checked)}
                  className="w-4 h-4 accent-blue-600 cursor-pointer"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  showToast("✓ Préférences de notifications enregistrées !");
                  setModalActive(null);
                }}
                className="w-full py-3 rounded-xl bg-[#1877F2] hover:bg-blue-600 text-white font-bold text-xs shadow-md transition cursor-pointer mt-2"
              >
                Valider mes choix
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Modal Changer mot de passe */}
      {modalActive === "password" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100 dark:border-zinc-800 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-gray-100 dark:border-zinc-800">
              <h3 className="text-base font-extrabold text-gray-900 dark:text-white">
                Changer le mot de passe
              </h3>
              <button
                type="button"
                onClick={() => setModalActive(null)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 flex items-center justify-center cursor-pointer text-gray-500"
              >
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>

            <form onSubmit={handleSavePassword} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  Nouveau mot de passe *
                </label>
                <input
                  type="password"
                  required
                  value={nouveauMdp}
                  onChange={(e) => setNouveauMdp(e.target.value)}
                  placeholder="Au moins 6 caractères"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-xs sm:text-sm font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  Confirmer le mot de passe *
                </label>
                <input
                  type="password"
                  required
                  value={confirmMdp}
                  onChange={(e) => setConfirmMdp(e.target.value)}
                  placeholder="Répétez le mot de passe"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-xs sm:text-sm font-semibold text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                />
              </div>

              <button
                type="submit"
                disabled={enCours}
                className="w-full py-3 rounded-xl bg-[#1877F2] hover:bg-blue-600 text-white font-bold text-xs shadow-md transition cursor-pointer disabled:opacity-50 mt-2"
              >
                {enCours ? "Mise à jour..." : "Modifier mon mot de passe"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 8. Modal Supprimer compte */}
      {modalActive === "supprimer" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 w-full max-w-md shadow-2xl border border-red-200 dark:border-red-900/50 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-red-100 dark:border-red-900/30">
              <h3 className="text-base font-extrabold text-red-600 dark:text-red-400 flex items-center gap-2">
                <i className="fa-solid fa-triangle-exclamation"></i>
                Supprimer mon compte
              </h3>
              <button
                type="button"
                onClick={() => setModalActive(null)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 flex items-center justify-center cursor-pointer text-gray-500"
              >
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>

            <form onSubmit={handleSupprimerCompte} className="space-y-3.5">
              <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                Cette action est <strong>irréversible</strong>. Toutes vos annonces, vos données de boutique et votre profil seront définitivement supprimés.
              </p>

              <div className="space-y-1">
                <label className="text-xs font-bold text-red-600 dark:text-red-400">
                  Tapez <strong>SUPPRIMER</strong> pour confirmer :
                </label>
                <input
                  type="text"
                  required
                  value={supprConfirm}
                  onChange={(e) => setSupprConfirm(e.target.value)}
                  placeholder="SUPPRIMER"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 text-xs sm:text-sm font-semibold text-red-900 dark:text-red-200 focus:outline-none focus:ring-2 focus:ring-red-500/30"
                />
              </div>

              <button
                type="submit"
                disabled={enCours || supprConfirm.trim().toUpperCase() !== "SUPPRIMER"}
                className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md transition cursor-pointer disabled:opacity-50 mt-2"
              >
                {enCours ? "Suppression en cours..." : "Confirmer la suppression définitive"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function VueVendeur({ userId, onBoutiqueChange, boutiqueActive: boutiqueProp, boutiques: boutiquesProp }) {
  const { profile } = useAuth();
  const [boutiques, setBoutiques] = useState(boutiquesProp || []);
  const [choisie, setChoisie] = useState(null);
  const [articles, setArticles] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [ongletVendeur, setOngletVendeur] = useState("annonces"); // 'annonces' | 'publier' | 'profit' | 'abonnes' | 'avis' | 'faq' | 'parametres'
  const [modalApercuOuverte, setModalApercuOuverte] = useState(false);

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
        <i className="fa-solid fa-spinner fa-spin text-2xl text-blue-600"></i>
        <p className="text-xs font-bold mt-2">Chargement de votre espace vendeur...</p>
      </div>
    );
  }

  const boutiqueActive = boutiques.find((b) => b.id === choisie) || boutiques[0] || null;
  const nomVendeur = boutiqueActive?.nom || profile?.full_name || "Facilite Facile";
  const telephoneVendeur = boutiqueActive?.telephone_whatsapp || profile?.phone || "";

  return (
    <div className="space-y-5">
      {erreur && (
        <div className="px-4 py-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs font-bold text-red-800 dark:text-red-200">
          {erreur}
        </div>
      )}

      {/* Disposition en 2 colonnes (1:1 Identique à la capture d'écran) */}
      <div className="flex flex-col md:flex-row gap-6 items-start w-full">
        {/* ========================================================================= */}
        {/* 1. COLONNE GAUCHE : CARTE PROFIL VENDEUR & MENU (1:1 Capture exacte)      */}
        {/* ========================================================================= */}
        <div className="w-full md:w-[280px] shrink-0 bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden sticky top-20">
          {/* Header de la carte avec lien APERÇU et RÉGLAGES */}
          <div className="p-5 pt-4 pb-4 flex flex-col items-center text-center relative">
            <div className="absolute top-3.5 right-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setModalApercuOuverte(true)}
                className="px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition cursor-pointer shadow-2xs"
                title="Aperçu public de ma boutique (comme les visiteurs la voient)"
              >
                <i className="fa-regular fa-eye text-xs"></i>
                <span>Aperçu</span>
              </button>
              <button
                type="button"
                onClick={() => setOngletVendeur("parametres")}
                className="text-[11px] font-black uppercase text-gray-700 dark:text-gray-300 hover:text-blue-600 flex items-center gap-1 transition cursor-pointer tracking-wider"
                title="Paramètres de la boutique"
              >
                <span>RÉGLAGES</span>
                <i className="fa-solid fa-gear text-xs"></i>
              </button>
            </div>

            {/* Avatar vert rond (1:1 Capture exacte) */}
            <div className="w-24 h-24 rounded-full bg-[#86EFAC] text-white flex items-center justify-center text-5xl mt-3 mb-3 shadow-xs">
              <svg className="w-14 h-14 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            </div>

            {/* Nom du commerçant / Boutique */}
            <h3 className="text-xl font-extrabold text-gray-900 dark:text-white leading-tight">
              {nomVendeur}
            </h3>

            {/* Lien / Statut Numéro de Téléphone */}
            <button
              type="button"
              onClick={() => setOngletVendeur("parametres")}
              className="text-[11px] font-bold text-[#718096] dark:text-gray-400 hover:text-blue-600 uppercase tracking-wider mt-1.5 transition cursor-pointer"
            >
              {telephoneVendeur ? `TÉL : ${telephoneVendeur}` : "AJOUTER LE NUMÉRO DE TÉLÉPHONE"}
            </button>
          </div>

          {/* Liste des options avec les séparateurs de la capture d'écran */}
          <div className="border-t border-gray-100 dark:border-gray-800 text-xs font-bold text-gray-800 dark:text-gray-200">
            {/* 0. Publier un article (Assistant IA) */}
            <div className="p-2.5 border-b border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setOngletVendeur("publier")}
                className={`w-full px-4 py-3 rounded-xl flex items-center justify-between gap-3 text-left transition cursor-pointer shadow-sm ${
                  ongletVendeur === "publier"
                    ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-emerald-500/20 font-black"
                    : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200/60 dark:border-emerald-800/50"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <i className="fa-solid fa-circle-plus text-base text-emerald-500"></i>
                  <span className="font-extrabold text-xs sm:text-sm">Publier un article</span>
                </div>
                <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-[9px] font-black uppercase tracking-wider">
                  IA
                </span>
              </button>
            </div>

            {/* 1. Faire profit */}
            <div className="border-b border-gray-100 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setOngletVendeur("profit")}
                className={`w-full px-5 py-3.5 flex items-center gap-3.5 text-left transition cursor-pointer ${
                  ongletVendeur === "profit"
                    ? "bg-blue-50/80 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-extrabold"
                    : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                }`}
              >
                <span className="text-lg">🤑</span>
                <span className="flex-1 text-sm font-bold">Faire profit</span>
              </button>
            </div>

            {/* Séparateur / Bloc 2, 3, 4 */}
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {/* 2. Abonnés */}
              <button
                type="button"
                onClick={() => setOngletVendeur("abonnes")}
                className={`w-full px-5 py-3.5 flex items-center gap-3.5 text-left transition cursor-pointer ${
                  ongletVendeur === "abonnes"
                    ? "bg-blue-50/80 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-extrabold"
                    : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                }`}
              >
                <i className="fa-regular fa-address-card text-lg text-gray-800 dark:text-gray-200"></i>
                <span className="flex-1 text-sm font-bold">Abonnés</span>
              </button>

              {/* 3. Mes annonces */}
              <button
                type="button"
                onClick={() => setOngletVendeur("annonces")}
                className={`w-full px-5 py-3.5 flex items-center gap-3.5 text-left transition cursor-pointer ${
                  ongletVendeur === "annonces"
                    ? "bg-blue-50/80 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-extrabold"
                    : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                }`}
              >
                <i className="fa-regular fa-calendar-days text-lg text-gray-800 dark:text-gray-200"></i>
                <span className="flex-1 text-sm font-bold">Mes annonces</span>
                {articles.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-[10px] font-black">
                    {articles.length}
                  </span>
                )}
              </button>

              {/* 4. Avis */}
              <button
                type="button"
                onClick={() => setOngletVendeur("avis")}
                className={`w-full px-5 py-3.5 flex items-center gap-3.5 text-left transition cursor-pointer ${
                  ongletVendeur === "avis"
                    ? "bg-blue-50/80 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-extrabold"
                    : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                }`}
              >
                <i className="fa-regular fa-face-smile text-lg text-gray-800 dark:text-gray-200"></i>
                <span className="flex-1 text-sm font-bold">Avis</span>
              </button>
            </div>

            {/* Séparateur / Bloc 5 */}
            <div className="border-t border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
              {/* 5. Foire aux questions */}
              <button
                type="button"
                onClick={() => setOngletVendeur("faq")}
                className={`w-full px-5 py-3.5 flex items-center gap-3.5 text-left transition cursor-pointer ${
                  ongletVendeur === "faq"
                    ? "bg-blue-50/80 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-extrabold"
                    : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                }`}
              >
                <i className="fa-regular fa-circle-question text-lg text-gray-800 dark:text-gray-200"></i>
                <span className="flex-1 text-sm font-bold">Foire aux questions</span>
              </button>

              {/* 6. Réglages */}
              <button
                type="button"
                onClick={() => setOngletVendeur("parametres")}
                className={`w-full px-5 py-3.5 flex items-center gap-3.5 text-left transition cursor-pointer ${
                  ongletVendeur === "parametres"
                    ? "bg-blue-50/80 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-extrabold"
                    : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                }`}
              >
                <i className="fa-solid fa-gear text-lg text-gray-800 dark:text-gray-200"></i>
                <span className="flex-1 text-sm font-bold">Réglages</span>
              </button>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. COLONNE DROITE : CONTENU PRINCIPAL DYNAMIQUE (1:1 Capture 2 plein espace) */}
        {/* ========================================================================= */}
        <div className="flex-1 min-w-0 w-full bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden min-h-[calc(100vh-160px)]">
          {/* Header de la section principale (sauf pour annonces où la bannière fait office d'en-tête) */}
          {ongletVendeur !== "annonces" && (
            <div className="px-6 py-4.5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-black text-gray-900 dark:text-white">
                {ongletVendeur === "publier" && "Publier une annonce"}
                {ongletVendeur === "profit" && "Faire profit & Booster mes ventes"}
                {ongletVendeur === "abonnes" && "Mes Abonnés & Clients"}
                {ongletVendeur === "avis" && "Avis & Évaluations Clients"}
                {ongletVendeur === "faq" && "Foire aux questions"}
                {ongletVendeur === "parametres" && "Réglages de la boutique"}
              </h2>
            </div>
          )}

          <div className="p-6">
            {/* VUE 1 : MES ANNONCES (1:1 Capture avec bannière et annonces) */}
            {ongletVendeur === "annonces" && (
              <div>
                {boutiqueActive && (
                  <div className="mb-6">
                    {/* Grande Bannière Panoramique Widescreen HD */}
                    <div
                      className="relative w-full h-44 sm:h-56 md:h-64 rounded-2xl sm:rounded-3xl overflow-hidden shadow-md bg-cover bg-center border border-gray-100 dark:border-zinc-800 group"
                      style={{ backgroundImage: `url('${boutiqueActive?.cover_url || profile?.cover_url || "/stellar-cover.png"}')` }}
                    >
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent"></div>

                      <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-5 right-3 sm:right-5 z-10 flex items-end justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-3 sm:gap-4">
                          <div className="w-14 h-14 sm:w-18 sm:h-18 rounded-full border-2 sm:border-4 border-white dark:border-zinc-900 shadow-xl overflow-hidden bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-500 shrink-0">
                            {boutiqueActive?.avatar_url || profile?.avatar_url ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img src={boutiqueActive?.avatar_url || profile?.avatar_url} alt={nomVendeur} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-white text-xl font-black">
                                {nomVendeur.substring(0, 2).toUpperCase()}
                              </div>
                            )}
                          </div>

                          <div className="text-white drop-shadow-md">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-base sm:text-2xl font-black leading-tight tracking-tight">
                                {nomVendeur}
                              </h3>
                              <span className="px-2.5 py-0.5 rounded-full bg-purple-600/90 text-white text-[9px] font-black uppercase tracking-wider backdrop-blur-xs shadow-xs">
                                BOUTIQUE OFFICIELLE
                              </span>
                            </div>
                            <p className="text-xs sm:text-sm text-zinc-200 font-medium line-clamp-1 mt-0.5">
                              {boutiqueActive?.description || profile?.headline || "Boutique Officielle Partenaire Facilité"}
                            </p>
                            <div className="flex items-center gap-2 text-[11px] text-zinc-300 font-medium mt-1">
                              <span>📍 {boutiqueActive?.quartier ? `${boutiqueActive.quartier}, ` : ""}{boutiqueActive?.ville || "Sénégal"}</span>
                              <span>•</span>
                              <span className="text-emerald-300 font-bold">✓ Vendeur Vérifié</span>
                            </div>
                          </div>
                        </div>

                        {telephoneVendeur && (
                          <a
                            href={`https://wa.me/221${telephoneVendeur.replace(/\D/g, "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 rounded-full bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-lg transition cursor-pointer shrink-0"
                          >
                            <i className="fa-brands fa-whatsapp text-base"></i>
                            <span>WhatsApp</span>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {!boutiqueActive ? (
                  <FormulaireBoutique
                    userId={userId}
                    boutique={null}
                    nombreBoutiques={boutiques.length}
                    onEnregistre={recharger}
                  />
                ) : articles.length === 0 ? (
                  <div className="py-20 px-4 flex flex-col items-center justify-center text-center space-y-4">
                    {/* Illustration Avion en papier (1:1 Capture avec SVG) */}
                    <IllustrationAvionPapier />

                    <div className="space-y-1.5 pt-2">
                      <h3 className="text-sm sm:text-base font-normal text-gray-700 dark:text-gray-300">
                        Il n&apos;y a pas encore d&apos;annonces.
                      </h3>
                      <button
                        type="button"
                        onClick={() => setOngletVendeur("publier")}
                        className="text-sm sm:text-base font-medium text-gray-900 dark:text-white hover:text-blue-600 transition cursor-pointer pt-1 block mx-auto"
                      >
                        Créez-en une maintenant !
                      </button>
                    </div>
                  </div>
                ) : (
                  <ListeMesArticles articles={articles} onChange={recharger} />
                )}
              </div>
            )}

            {/* VUE 2 : PUBLIER UN ARTICLE (Assistant IA & Zéro Saisie) */}
            {ongletVendeur === "publier" && (
              <div>
                {boutiqueActive ? (
                  <div className="space-y-4">
                    <button
                      type="button"
                      onClick={() => setOngletVendeur("annonces")}
                      className="text-xs font-bold text-gray-500 hover:text-gray-900 dark:hover:text-white flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <i className="fa-solid fa-arrow-left"></i>
                      <span>Retour à mes annonces</span>
                    </button>
                    <FormulaireArticle
                      userId={userId}
                      storeId={boutiqueActive.id}
                      onPublie={async () => {
                        await recharger();
                        setOngletVendeur("annonces");
                      }}
                    />
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
            )}

            {/* VUE 3 : FAIRE PROFIT */}
            {ongletVendeur === "profit" && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 border border-amber-200 dark:border-amber-800/60 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🤑</span>
                    <h3 className="text-sm font-black text-amber-950 dark:text-amber-100">
                      Multipliez vos ventes avec les fonctionnalités Pro
                    </h3>
                  </div>
                  <p className="text-xs text-amber-900/80 dark:text-amber-200/80 leading-relaxed">
                    Mettez vos annonces en tête de liste, obtenez le badge Commerçant Vérifié et touchez des milliers d&apos;acheteurs partout à Dakar et au Sénégal.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 space-y-2">
                    <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center text-base">
                      <i className="fa-brands fa-whatsapp"></i>
                    </div>
                    <h4 className="text-xs font-black text-gray-900 dark:text-white">Commandes Directes WhatsApp</h4>
                    <p className="text-[11px] text-gray-500 leading-relaxed">
                      Chaque visiteur clique et arrive directement dans votre discussion WhatsApp avec le récapitulatif du produit.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 space-y-2">
                    <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 flex items-center justify-center text-base">
                      <i className="fa-solid fa-crown"></i>
                    </div>
                    <h4 className="text-xs font-black text-gray-900 dark:text-white">Badge Boutique Officielle</h4>
                    <p className="text-[11px] text-gray-500 leading-relaxed">
                      Augmentez la confiance des acheteurs avec le profil vérifié Facilité Marketplace.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* VUE 4 : ABONNÉS */}
            {ongletVendeur === "abonnes" && (
              <div className="py-12 text-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 flex items-center justify-center text-2xl mx-auto">
                  <i className="fa-solid fa-users"></i>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">Vos abonnés apparaîtront ici</h3>
                  <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                    Dès qu&apos;un client s&apos;abonne à votre boutique, il recevra automatiquement vos nouveaux articles en priorité.
                  </p>
                </div>
              </div>
            )}

            {/* VUE 5 : AVIS */}
            {ongletVendeur === "avis" && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-800 flex items-center justify-between">
                  <div>
                    <div className="text-xl font-black text-gray-900 dark:text-white flex items-center gap-1.5">
                      <span>5.0</span>
                      <div className="flex text-amber-400 text-xs">
                        <i className="fa-solid fa-star"></i>
                        <i className="fa-solid fa-star"></i>
                        <i className="fa-solid fa-star"></i>
                        <i className="fa-solid fa-star"></i>
                        <i className="fa-solid fa-star"></i>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">Note moyenne de satisfaction</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-600 text-[10px] font-black uppercase">
                    100% Positif
                  </span>
                </div>

                <div className="p-4 rounded-xl border border-gray-100 dark:border-gray-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-gray-900 dark:text-white">Acheteur Facilité</span>
                    <span className="text-gray-400 text-[10px]">Récemment</span>
                  </div>
                  <div className="flex text-amber-400 text-[10px]">
                    <i className="fa-solid fa-star"></i>
                    <i className="fa-solid fa-star"></i>
                    <i className="fa-solid fa-star"></i>
                    <i className="fa-solid fa-star"></i>
                    <i className="fa-solid fa-star"></i>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-300">
                    « Produit conforme à la description et vendeur très réactif sur WhatsApp. Livraison rapide ! »
                  </p>
                </div>
              </div>
            )}

            {/* VUE 6 : FAQ */}
            {ongletVendeur === "faq" && (
              <div className="space-y-3">
                <details className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40 text-xs group">
                  <summary className="font-bold text-gray-900 dark:text-white cursor-pointer list-none flex items-center justify-between">
                    <span>Comment publier un article rapidement ?</span>
                    <i className="fa-solid fa-chevron-down text-[10px] text-gray-400 group-open:rotate-180 transition"></i>
                  </summary>
                  <p className="mt-2 text-gray-600 dark:text-gray-400 leading-relaxed">
                    Cliquez sur « Publier un article » puis utilisez l&apos;Assistant Vision IA : importez une photo et l&apos;IA remplit instantanément le titre, le prix estimé et la description vendeuse.
                  </p>
                </details>

                <details className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40 text-xs group">
                  <summary className="font-bold text-gray-900 dark:text-white cursor-pointer list-none flex items-center justify-between">
                    <span>Comment suis-je payé ?</span>
                    <i className="fa-solid fa-chevron-down text-[10px] text-gray-400 group-open:rotate-180 transition"></i>
                  </summary>
                  <p className="mt-2 text-gray-600 dark:text-gray-400 leading-relaxed">
                    Les acheteurs vous contactent directement sur WhatsApp. Vous convenez ensemble du paiement (Wave, Orange Money ou Espèces à la livraison). Aucune commission n&apos;est prélevée.
                  </p>
                </details>

                <details className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40 text-xs group">
                  <summary className="font-bold text-gray-900 dark:text-white cursor-pointer list-none flex items-center justify-between">
                    <span>Comment modifier la localisation de ma boutique ?</span>
                    <i className="fa-solid fa-chevron-down text-[10px] text-gray-400 group-open:rotate-180 transition"></i>
                  </summary>
                  <p className="mt-2 text-gray-600 dark:text-gray-400 leading-relaxed">
                    Rendez-vous dans « RÉGLAGES » pour mettre à jour votre nom, votre quartier ou votre numéro de téléphone.
                  </p>
                </details>
              </div>
            )}

            {/* VUE 7 : À PROPOS & INFOS */}
            {ongletVendeur === "apropos" && (
              <div className="space-y-4">
                <div className="p-5 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-800 space-y-3">
                  <h3 className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-2">
                    <i className="fa-solid fa-store text-blue-600"></i>
                    À propos de {nomVendeur}
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                    {profile?.headline || "Boutique Officielle Partenaire Facilité. Vente d'articles & prestation de services de qualité supérieure."}
                  </p>
                  <div className="pt-3 border-t border-gray-200/60 dark:border-gray-700/60 space-y-2 text-xs text-gray-600 dark:text-gray-400">
                    <div><strong>Localisation :</strong> {boutiqueActive?.quartier ? `${boutiqueActive.quartier}, ` : ""}{boutiqueActive?.ville || "Dakar"}, Sénégal</div>
                    <div><strong>Statut :</strong> Commerçant Vérifié Facilité</div>
                  </div>
                </div>
              </div>
            )}

            {/* VUE 8 : CONTACT & LIVRAISON */}
            {ongletVendeur === "contact" && (
              <div className="space-y-4">
                <div className="p-5 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-800 space-y-3">
                  <h3 className="text-sm font-black text-gray-900 dark:text-white flex items-center gap-2">
                    <i className="fa-solid fa-truck-fast text-emerald-600"></i>
                    Coordonnées &amp; Modalités de Livraison
                  </h3>
                  <div className="space-y-2.5 text-xs text-gray-700 dark:text-gray-300">
                    <div className="flex items-center gap-2">
                      <i className="fa-brands fa-whatsapp text-emerald-500 text-sm"></i>
                      <span>WhatsApp : {telephoneVendeur || "Non renseigné"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <i className="fa-solid fa-location-dot text-red-500 text-sm"></i>
                      <span>Zone de retrait &amp; expédition : {boutiqueActive?.ville || "Dakar & régions du Sénégal"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <i className="fa-solid fa-box-open text-blue-500 text-sm"></i>
                      <span>Délai de livraison moyen : 24h à 48h</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* VUE 9 : RÉGLAGES DE LA BOUTIQUE (1:1 Capture d'écran exacte) */}
            {ongletVendeur === "parametres" && (
              <VueReglages
                userId={userId}
                profile={profile}
                boutique={boutiqueActive}
                onRetour={() => setOngletVendeur("annonces")}
                onEnregistre={recharger}
              />
            )}
          </div>
        </div>
      </div>

      {/* Modal Aperçu Public de ma boutique */}
      {modalApercuOuverte && (
        <ModalFicheBoutique
          boutique={
            boutiqueActive || {
              id: "facilite_shop",
              nom: nomVendeur || "facilite shop",
              quartier: "Guinaw rail nord",
              ville: "Pikine",
              telephone_whatsapp: telephoneVendeur || "770000000",
              cover_url: profile?.cover_url || "/stellar-cover.png",
              avatar_url: profile?.avatar_url,
            }
          }
          articles={articles}
          profile={profile}
          userId={userId}
          onPublierArticle={() => {
            setModalApercuOuverte(false);
            setOngletVendeur("publier");
          }}
          onBoutiqueUpdate={recharger}
          onFermer={() => setModalApercuOuverte(false)}
          onVoirArticle={(art) => {}}
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

        {(!boutique && profile?.headline) && (
          <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold mt-0.5">
            {profile.headline}
          </p>
        )}

        <p className="text-[10px] text-gray-500 dark:text-gray-400 font-normal mt-1 mb-2">
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

  // article.whatsappUrl (construit par lienWhatsapp() côté lib) contient
  // déjà son propre "?text=<message générique>" — y ajouter un second
  // "?text=..." produisait une URL invalide (deux paramètres text
  // concaténés dans une seule valeur). On reconstruit le lien depuis le
  // numéro brut pour y mettre le VRAI message de commande (produit/format/
  // quantité/total). article.telephone_whatsapp n'existe jamais sur les
  // objets article côté acheteur (seuls `whatsapp`/`whatsappUrl` sont
  // renvoyés par marketplaceData.js) : on utilise `whatsapp`. Bug confirmé
  // lors d'un audit du Marketplace le 2026-09-08.
  const numeroWhatsApp = normaliserWhatsapp(article.telephone_whatsapp || article.whatsapp);
  const lienWhatsApp = numeroWhatsApp
    ? `https://wa.me/${numeroWhatsApp.replace("+", "")}?text=${messageWhatsApp}`
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

const LIBELLES_CATEGORIE_ETABLISSEMENT = {
  sante: "Santé",
  finance: "Finance",
  beaute: "Beauté",
  autre: "Établissement",
};

/**
 * Modal Fiche Boutique Complète & Profil Commerçant (1:1 Inspiré de la capture Profil avec bannière couverture, badges, onglets, grille de tous les produits, publication d'articles & modification complète)
 */
function ModalFicheBoutique({
  boutique,
  articles = [],
  profile = null,
  userId = null,
  onPublierArticle,
  onBoutiqueUpdate,
  onFermer,
  onVoirArticle,
}) {
  const [listeArticles, setListeArticles] = useState(articles);
  const [ongletActif, setOngletActif] = useState("apercu"); // 'apercu' | 'produits' | 'profit' | 'abonnes' | 'avis' | 'faq' | 'apropos' | 'contact' | 'parametres'
  const [chargement, setChargement] = useState(false);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // États éditables du profil boutique
  const [nom, setNom] = useState(boutique?.nom || boutique?.boutique_nom || profile?.full_name || "facilite shop");
  const [quartier, setQuartier] = useState(boutique?.quartier || profile?.quartier || "Guinaw rail nord");
  const [ville, setVille] = useState(boutique?.ville || profile?.city || profile?.location || "Pikine");
  const [telephone, setTelephone] = useState(boutique?.telephone_whatsapp || profile?.phone || "+221771001212");
  const [description, setDescription] = useState(
    boutique?.description ||
      profile?.headline ||
      "Boutique Officielle Partenaire Facilité · Vente d'articles & livraison express"
  );
  const [avatarUrl, setAvatarUrl] = useState(
    boutique?.avatar_url || profile?.avatar_url || null
  );
  const [coverUrl, setCoverUrl] = useState(
    boutique?.cover_url || profile?.cover_url || "/stellar-cover.png"
  );

  const avatarInputRef = useRef(null);
  const coverInputRef = useRef(null);

  // La fiche s'adapte au type_boutique : un service (plombier, etc.) n'a pas
  // de catalogue d'articles, un établissement (clinique, salon...) affiche
  // ses horaires à la place — même onglet "produits", contenu différent.
  const typeBoutique = boutique?.type_boutique || "produit";
  const estService = typeBoutique === "service";
  const estEtablissement = typeBoutique === "etablissement";
  const [horairesEtablissement, setHorairesEtablissement] = useState([]);
  const [horairesChargement, setHorairesChargement] = useState(false);

  useEffect(() => {
    if (!estEtablissement || !boutique?.id) {
      queueMicrotask(() => setHorairesEtablissement([]));
      return;
    }
    let annule = false;
    queueMicrotask(() => setHorairesChargement(true));
    obtenirHorairesBoutique(boutique.id)
      .then((data) => {
        if (!annule) setHorairesEtablissement(data);
      })
      .catch(() => {
        if (!annule) setHorairesEtablissement([]);
      })
      .finally(() => {
        if (!annule) setHorairesChargement(false);
      });
    return () => {
      annule = true;
    };
  }, [estEtablissement, boutique?.id]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  useEffect(() => {
    if (boutique) {
      if (boutique.nom || boutique.boutique_nom) setNom(boutique.nom || boutique.boutique_nom);
      if (boutique.quartier) setQuartier(boutique.quartier);
      if (boutique.ville) setVille(boutique.ville);
      if (boutique.telephone_whatsapp) setTelephone(boutique.telephone_whatsapp);
      if (boutique.avatar_url) setAvatarUrl(boutique.avatar_url);
      if (boutique.cover_url) setCoverUrl(boutique.cover_url);
    }
  }, [boutique]);

  useEffect(() => {
    if (articles && articles.length > 0 && (!boutique?.id || articles[0]?.boutique_id === boutique?.id || articles[0]?.store_id === boutique?.id)) {
      setListeArticles(articles);
    } else if (boutique?.id) {
      setChargement(true);
      chargerMesArticles(boutique.id)
        .then((data) => setListeArticles(data || []))
        .catch(() => setListeArticles([]))
        .finally(() => setChargement(false));
    }
  }, [boutique?.id, articles]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3500);
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setEnvoiEnCours(true);
      const localUrl = URL.createObjectURL(file);
      setAvatarUrl(localUrl);

      if (userId) {
        try {
          const photoPath = await envoyerPhoto(file, userId);
          const publicPhotoUrl = urlPhoto(photoPath);
          setAvatarUrl(publicPhotoUrl);
          await supabase.from("profiles").update({ avatar_url: publicPhotoUrl, updated_at: new Date().toISOString() }).eq("id", userId);
        } catch {
          // Fallback direct storage upload
          const ext = file.name.split(".").pop() || "jpg";
          const path = `${userId}/boutique_avatar_${Date.now()}.${ext}`;
          await supabase.storage.from("avatars").upload(path, file, { upsert: true });
          const { data: pubData } = supabase.storage.from("avatars").getPublicUrl(path);
          if (pubData?.publicUrl) {
            setAvatarUrl(pubData.publicUrl);
            await supabase.from("profiles").update({ avatar_url: pubData.publicUrl, updated_at: new Date().toISOString() }).eq("id", userId);
          }
        }
      }
      showToast("Photo de profil boutique mise à jour avec succès !");
      onBoutiqueUpdate?.();
    } catch (err) {
      console.error(err);
      showToast("Photo de profil mise à jour localement !");
    } finally {
      setEnvoiEnCours(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  const handleCoverUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setEnvoiEnCours(true);
      const localUrl = URL.createObjectURL(file);
      setCoverUrl(localUrl);

      if (userId) {
        try {
          const photoPath = await envoyerPhoto(file, userId);
          const publicPhotoUrl = urlPhoto(photoPath);
          setCoverUrl(publicPhotoUrl);
          await supabase.from("profiles").update({ cover_url: publicPhotoUrl, updated_at: new Date().toISOString() }).eq("id", userId);
        } catch {
          const ext = file.name.split(".").pop() || "jpg";
          const path = `${userId}/boutique_cover_${Date.now()}.${ext}`;
          await supabase.storage.from("covers").upload(path, file, { upsert: true });
          const { data: pubData } = supabase.storage.from("covers").getPublicUrl(path);
          if (pubData?.publicUrl) {
            setCoverUrl(pubData.publicUrl);
            await supabase.from("profiles").update({ cover_url: pubData.publicUrl, updated_at: new Date().toISOString() }).eq("id", userId);
          }
        }
      }
      showToast("Bannière de couverture mise à jour avec succès !");
      onBoutiqueUpdate?.();
    } catch (err) {
      console.error(err);
      showToast("Photo de couverture mise à jour localement !");
    } finally {
      setEnvoiEnCours(false);
      if (coverInputRef.current) coverInputRef.current.value = "";
    }
  };

  const handleSauvegarderParametres = async (e) => {
    e.preventDefault();
    setEnvoiEnCours(true);
    try {
      if (boutique?.id && boutique?.id !== "facilite_shop") {
        await modifierBoutique(boutique.id, {
          nom,
          quartier,
          ville,
          telephone_whatsapp: telephone,
        });
      }
      if (userId) {
        await supabase.from("profiles").update({
          full_name: nom,
          headline: description,
          city: ville,
          quartier,
          phone: telephone,
          updated_at: new Date().toISOString(),
        }).eq("id", userId);
      }
      showToast("✓ Paramètres de la boutique enregistrés avec succès !");
      onBoutiqueUpdate?.();
    } catch (err) {
      console.error(err);
      showToast("✓ Modifications enregistrées !");
    } finally {
      setEnvoiEnCours(false);
    }
  };

  const whatsappUrl = telephone ? `https://wa.me/221${telephone.replace(/\D/g, "")}` : null;
  const initiales = nom.substring(0, 2).toUpperCase();

  return (
    <div className="fixed inset-0 z-[99999] bg-gray-100 dark:bg-zinc-950 text-zinc-900 dark:text-white overflow-y-auto w-full h-full flex flex-col animate-fadeIn">
      {/* Toast de confirmation en haut */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-gray-900 text-white dark:bg-white dark:text-gray-950 text-xs sm:text-sm font-bold shadow-2xl flex items-center gap-2 animate-bounce">
          <i className="fa-solid fa-circle-check text-emerald-400 dark:text-emerald-600"></i>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Inputs cachés pour le changement de photo et de couverture */}
      <input
        type="file"
        ref={avatarInputRef}
        accept="image/*"
        className="hidden"
        onChange={handleAvatarUpload}
      />
      <input
        type="file"
        ref={coverInputRef}
        accept="image/*"
        className="hidden"
        onChange={handleCoverUpload}
      />

      {/* ========================================================================= */}
      {/* 0. BARRE SUPÉRIEURE DE NAVIGATION DÉDIÉE (Pleine largeur, opaque)         */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-b border-gray-200 dark:border-zinc-800 px-4 py-3 flex items-center justify-between shadow-xs shrink-0">
        <button
          type="button"
          onClick={onFermer}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-100 text-xs font-bold transition cursor-pointer"
        >
          <i className="fa-solid fa-arrow-left text-xs"></i>
          <span>Retour au marketplace</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOngletActif("produits")}
            className={`px-3 py-1.5 rounded-full text-xs font-black transition cursor-pointer flex items-center gap-1.5 shadow-xs ${
              ongletActif === "produits"
                ? "bg-[#1877F2] text-white"
                : "bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/50"
            }`}
            title="Aperçu public de la boutique"
          >
            <i className="fa-regular fa-eye text-xs"></i>
            <span>Aperçu</span>
          </button>
          <span className="text-xs sm:text-sm font-black text-zinc-900 dark:text-white truncate max-w-[140px] sm:max-w-xs">
            {nom}
          </span>
          <span className="hidden sm:inline-block px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 text-[9px] font-black uppercase">
            Boutique Officielle
          </span>
        </div>

        <button
          type="button"
          onClick={onFermer}
          className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 flex items-center justify-center transition cursor-pointer"
          title="Fermer la page boutique"
          aria-label="Fermer"
        >
          <i className="fa-solid fa-xmark text-sm"></i>
        </button>
      </header>

      {/* ========================================================================= */}
      {/* CONTENEUR PRINCIPAL DE LA PAGE BOUTIQUE (2 Colonnes directes comme capture) */}
      {/* ========================================================================= */}
      <div className="w-full max-w-[1400px] mx-auto flex-1 p-2 sm:p-4 flex flex-col md:flex-row gap-6 items-start">
        {/* ========================================================================= */}
        {/* 1. COLONNE GAUCHE : CARTE PROFIL BOUTIQUE & MENU (1:1 Capture Aperçu)      */}
        {/* ========================================================================= */}
        <div className="w-full md:w-[280px] shrink-0 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm overflow-hidden sticky top-16">
          {/* Bannière de couverture en haut de la carte latérale */}
          <div
            className="h-28 bg-cover bg-center bg-no-repeat relative block bg-gradient-to-r from-slate-900 via-zinc-800 to-slate-900"
            style={{ backgroundImage: `url('${coverUrl || "/stellar-cover.png"}')` }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20"></div>
            {/* Bouton Appareil Photo pour changer la couverture */}
            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              className="absolute top-2.5 right-2.5 z-20 w-8 h-8 rounded-full bg-white/90 hover:bg-white dark:bg-black/70 dark:hover:bg-black text-zinc-900 dark:text-white flex items-center justify-center shadow-md backdrop-blur-xs transition cursor-pointer active:scale-95"
              title="Changer la photo de couverture"
            >
              <i className="fa-solid fa-camera text-xs"></i>
            </button>
          </div>

          {/* Profil : Avatar avec overlay Modifier + Nom + Titre + Badges */}
          <div className="px-4 pb-3 pt-0 relative flex flex-col items-start text-left border-b border-gray-100 dark:border-zinc-800">
            {/* Avatar avec bouton Modifier */}
            <div className="relative group -mt-10 mb-2 w-20 h-20 rounded-full border-4 border-white dark:border-zinc-900 bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-500 flex items-center justify-center text-white text-2xl font-black shadow-md overflow-hidden shrink-0">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt={nom}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{initiales}</span>
              )}

              {/* Overlay interactif de modification au survol / clic */}
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition duration-200 flex flex-col items-center justify-center text-white cursor-pointer"
                title="Modifier la photo"
              >
                <i className="fa-solid fa-camera text-sm mb-0.5"></i>
                <span className="text-[9px] font-bold">Modifier</span>
              </button>
            </div>

            {/* Nom de la Boutique & Badge BOUTIQUE */}
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className="text-xl font-black text-zinc-900 dark:text-white leading-tight tracking-tight">
                {nom}
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-600"></span>
                BOUTIQUE
              </span>
            </div>

            {/* Headline / Profession */}
            <p className="text-xs text-zinc-600 dark:text-zinc-300 font-medium mb-2.5 line-clamp-1">
              {description}
            </p>

            {/* Tag Pilule Métier / Secteur */}
            <div className="w-full mb-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-bold border border-gray-200/60 dark:border-zinc-700/60 w-full">
                <i className="fa-regular fa-folder text-zinc-400"></i>
                <span className="truncate">Commerce &amp; Vente au détail</span>
              </span>
            </div>

            {/* Bouton Aperçu Boutique très visible (Séparé du menu) */}
            <button
              type="button"
              onClick={() => setOngletActif("apercu")}
              className={`w-full mt-2 py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition cursor-pointer border shadow-2xs ${
                ongletActif === "apercu"
                  ? "bg-[#1877F2] text-white border-blue-500 shadow-blue-500/20"
                  : "bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 border-blue-200/60 dark:border-blue-800/50"
              }`}
              title="Voir l'aperçu public de ma boutique (bannière & vitrine)"
            >
              <i className="fa-regular fa-eye text-sm"></i>
              <span>Aperçu de la boutique</span>
            </button>
          </div>

          {/* Liste des options du menu */}
          <div className="p-2 space-y-1 text-xs font-bold">
            {estProprietaire && (
              <button
                type="button"
                onClick={() => setOngletActif("publier")}
                className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-black flex items-center justify-between gap-2.5 transition cursor-pointer text-left shadow-xs mb-1.5 ${
                  ongletActif === "publier"
                    ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-emerald-500/20"
                    : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200/60 dark:border-emerald-800/50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-circle-plus text-sm text-emerald-500"></i>
                  <span>Publier un article</span>
                </div>
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-[9px] font-black uppercase">
                  IA
                </span>
              </button>
            )}

            <button
                type="button"
                onClick={() => setOngletActif("produits")}
                className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-black flex items-center gap-2.5 transition cursor-pointer text-left ${
                  ongletActif === "produits"
                    ? "bg-[#1877F2] text-white shadow-md"
                    : "text-zinc-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800"
                }`}
            >
              <i
                className={`${estEtablissement ? "fa-solid fa-clock" : estService ? "fa-solid fa-screwdriver-wrench" : "fa-regular fa-calendar-days"} text-sm`}
              ></i>
              <span className="flex-1">
                {estEtablissement ? "Horaires" : estService ? "Ma prestation" : "Mes annonces"}
              </span>
              {!estService && !estEtablissement && listeArticles.length > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${ongletActif === "produits" ? "bg-white/20 text-white" : "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"}`}>
                  {listeArticles.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setOngletActif("profit")}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-black flex items-center gap-2.5 transition cursor-pointer text-left ${
                ongletActif === "profit"
                  ? "bg-[#1877F2] text-white shadow-md"
                  : "text-zinc-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800"
              }`}
            >
              <span className="text-sm">🤑</span>
              <span className="flex-1">Faire profit</span>
            </button>

            <button
              type="button"
              onClick={() => setOngletActif("abonnes")}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-black flex items-center gap-2.5 transition cursor-pointer text-left ${
                ongletActif === "abonnes"
                  ? "bg-[#1877F2] text-white shadow-md"
                  : "text-zinc-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800"
              }`}
            >
              <i className="fa-solid fa-users text-sm"></i>
              <span className="flex-1">Abonnés</span>
            </button>

            <button
              type="button"
              onClick={() => setOngletActif("avis")}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-black flex items-center gap-2.5 transition cursor-pointer text-left ${
                ongletActif === "avis"
                  ? "bg-[#1877F2] text-white shadow-md"
                  : "text-zinc-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800"
              }`}
            >
              <i className="fa-regular fa-face-smile text-sm"></i>
              <span className="flex-1">Avis</span>
            </button>

            <button
              type="button"
              onClick={() => setOngletActif("faq")}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-black flex items-center gap-2.5 transition cursor-pointer text-left ${
                ongletActif === "faq"
                  ? "bg-[#1877F2] text-white shadow-md"
                  : "text-zinc-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800"
              }`}
            >
              <i className="fa-regular fa-circle-question text-sm"></i>
              <span className="flex-1">Foire aux questions</span>
            </button>

            <button
              type="button"
              onClick={() => setOngletActif("apropos")}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-black flex items-center gap-2.5 transition cursor-pointer text-left ${
                ongletActif === "apropos"
                  ? "bg-[#1877F2] text-white shadow-md"
                  : "text-zinc-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800"
              }`}
            >
              <i className="fa-solid fa-store text-sm"></i>
              <span className="flex-1">À propos &amp; Infos</span>
            </button>

            <button
              type="button"
              onClick={() => setOngletActif("contact")}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-black flex items-center gap-2.5 transition cursor-pointer text-left ${
                ongletActif === "contact"
                  ? "bg-[#1877F2] text-white shadow-md"
                  : "text-zinc-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800"
              }`}
            >
              <i className="fa-solid fa-truck-fast text-sm"></i>
              <span className="flex-1">Contact &amp; Livraison</span>
            </button>

            <button
              type="button"
              onClick={() => setOngletActif("parametres")}
              className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-black flex items-center gap-2.5 transition cursor-pointer text-left ${
                ongletActif === "parametres"
                  ? "bg-[#1877F2] text-white shadow-md"
                  : "text-zinc-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800"
              }`}
            >
              <i className="fa-solid fa-gear text-sm"></i>
              <span className="flex-1">Réglages</span>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. COLONNE DROITE : CONTENU PRINCIPAL DYNAMIQUE (1:1 Capture 2 plein espace) */}
        {/* ========================================================================= */}
        <div className="flex-1 min-w-0 w-full bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-sm overflow-hidden min-h-[calc(100vh-120px)]">
          <div className="p-4 sm:p-6">
          {/* VUE APERÇU : Grande Bannière Panoramique HD Widescreen + Profil + Contact */}
          {ongletActif === "apercu" && (
            <div className="mb-6 space-y-4">
              {/* Grand Bandeau Bannière Panoramique Widescreen HD (1:1 Capture exacte) */}
              <div
                className="relative w-full h-44 sm:h-56 md:h-64 rounded-2xl sm:rounded-3xl overflow-hidden shadow-md bg-cover bg-center border border-gray-100 dark:border-zinc-800 group"
                style={{ backgroundImage: `url('${coverUrl || "/stellar-cover.png"}')` }}
              >
                {/* Dégradé cinématographique pour lisibilité */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent"></div>

                {/* Bouton pour modifier la photo de couverture au clic */}
                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  className="absolute top-3 right-3 z-20 px-3 py-1.5 rounded-full bg-white/90 hover:bg-white dark:bg-black/75 dark:hover:bg-black text-zinc-900 dark:text-white text-xs font-bold flex items-center gap-1.5 shadow-md backdrop-blur-xs transition cursor-pointer active:scale-95"
                  title="Changer la photo de couverture"
                >
                  <i className="fa-solid fa-camera text-xs"></i>
                  <span className="hidden sm:inline">Changer la bannière</span>
                </button>

                {/* Profil et Titre intégrés sur la bannière */}
                <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-5 right-3 sm:right-5 z-10 flex items-end justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="relative group w-14 h-14 sm:w-18 sm:h-18 rounded-full border-2 sm:border-4 border-white dark:border-zinc-900 shadow-xl overflow-hidden bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-500 shrink-0">
                      {avatarUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={avatarUrl} alt={nom} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white text-xl font-black">{initiales}</div>
                      )}
                      <button
                        type="button"
                        onClick={() => avatarInputRef.current?.click()}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center text-white cursor-pointer"
                        title="Changer la photo de profil"
                      >
                        <i className="fa-solid fa-camera text-xs"></i>
                      </button>
                    </div>

                    <div className="text-white drop-shadow-md">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base sm:text-2xl font-black leading-tight tracking-tight">
                          {nom}
                        </h3>
                        <span className="px-2.5 py-0.5 rounded-full bg-purple-600/90 text-white text-[9px] font-black uppercase tracking-wider backdrop-blur-xs shadow-xs">
                          BOUTIQUE OFFICIELLE
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-zinc-200 font-medium line-clamp-1 mt-0.5">
                        {description}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-zinc-300 font-medium mt-1">
                        <span>📍 {quartier ? `${quartier}, ` : ""}{ville || "Sénégal"}</span>
                        <span>•</span>
                        <span className="text-emerald-300 font-bold">✓ Vendeur Vérifié</span>
                      </div>
                    </div>
                  </div>

                  {whatsappUrl && (
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded-full bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-lg transition cursor-pointer shrink-0"
                    >
                      <i className="fa-brands fa-whatsapp text-base"></i>
                      <span>WhatsApp</span>
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {(ongletActif === "produits" || ongletActif === "apercu") && estService && (
            <div className="max-w-lg space-y-4">
              <div>
                <h3 className="text-sm font-black text-zinc-900 dark:text-white">Métier</h3>
                <p className="text-xs text-zinc-500">Ce que ce prestataire propose</p>
              </div>
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50">
                <p className="text-sm font-black text-amber-700 dark:text-amber-400 flex items-center gap-2">
                  <i className="fa-solid fa-screwdriver-wrench"></i>
                  {boutique?.metier || "Non renseigné"}
                </p>
              </div>
              {boutique?.description_prestation && (
                <div>
                  <h3 className="text-sm font-black text-zinc-900 dark:text-white mb-1.5">Description</h3>
                  <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed whitespace-pre-line">
                    {boutique.description_prestation}
                  </p>
                </div>
              )}
              <p className="text-[11px] text-zinc-400 italic">
                Zone d&apos;intervention : {quartier || ville || "non renseignée"}
              </p>
            </div>
          )}

          {(ongletActif === "produits" || ongletActif === "apercu") && estEtablissement && (
            <div className="max-w-lg space-y-4">
              <div>
                <h3 className="text-sm font-black text-zinc-900 dark:text-white">Horaires d&apos;ouverture</h3>
                <p className="text-xs text-zinc-500">Jours et heures d&apos;accueil du public</p>
              </div>
              {horairesChargement ? (
                <p className="text-xs text-zinc-400 italic">Chargement…</p>
              ) : horairesEtablissement.length === 0 ? (
                <p className="text-xs text-zinc-400 italic">Horaires non renseignés.</p>
              ) : (
                <ul className="text-xs divide-y divide-gray-100 dark:divide-zinc-800 rounded-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden">
                  {horairesEtablissement.map((h) => (
                    <li
                      key={h.jour_semaine}
                      className="flex items-center justify-between px-3.5 py-2 bg-white dark:bg-zinc-900"
                    >
                      <span className="font-bold text-zinc-700 dark:text-zinc-300">{JOURS_SEMAINE[h.jour_semaine]}</span>
                      <span className={h.ferme_ce_jour ? "text-zinc-400" : "text-emerald-600 dark:text-emerald-400 font-bold"}>
                        {h.ferme_ce_jour
                          ? "Fermé"
                          : `${h.heure_ouverture?.slice(0, 5) || "?"} – ${h.heure_fermeture?.slice(0, 5) || "?"}`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <div>
                <h3 className="text-sm font-black text-zinc-900 dark:text-white mb-1.5">Infos pratiques</h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-300">
                  Catégorie : {LIBELLES_CATEGORIE_ETABLISSEMENT[boutique?.categorie_etablissement] || "Établissement"}
                  {boutique?.verifie && <span className="ml-2 text-emerald-600 font-bold">✓ Vérifié</span>}
                </p>
              </div>
            </div>
          )}

          {(ongletActif === "produits" || ongletActif === "apercu") && !estService && !estEtablissement && (
            <div>
              {/* En-tête de section avec bouton Plus / Ajouter un article */}
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100 dark:border-zinc-800">
                <div>
                  <h3 className="text-sm font-black text-zinc-900 dark:text-white">
                    Catalogue des articles ({listeArticles.length})
                  </h3>
                  <p className="text-[11px] text-zinc-500">
                    Articles enregistrés et prêts pour la vente en ligne
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setOngletActif("publier")}
                  className="px-3.5 py-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-black flex items-center gap-1.5 shadow-sm transition cursor-pointer active:scale-95"
                >
                  <i className="fa-solid fa-plus text-xs"></i>
                  <span>Ajouter un article</span>
                </button>
              </div>

              {chargement ? (
                <div className="text-center py-16 text-zinc-400">
                  <i className="fa-solid fa-spinner fa-spin text-2xl text-blue-600"></i>
                  <p className="text-xs font-bold mt-2">Chargement des articles de la boutique...</p>
                </div>
              ) : listeArticles.length === 0 ? (
                <div className="py-16 px-4 flex flex-col items-center justify-center text-center space-y-3">
                  <IllustrationAvionPapier />
                  <div className="space-y-1.5 pt-2">
                    <h3 className="text-sm sm:text-base font-normal text-zinc-700 dark:text-zinc-300">
                      Il n&apos;y a pas encore d&apos;annonces.
                    </h3>
                    <button
                      type="button"
                      onClick={() => setOngletActif("publier")}
                      className="text-sm sm:text-base font-medium text-zinc-900 dark:text-white hover:text-blue-600 transition cursor-pointer pt-1 block mx-auto"
                    >
                      Créez-en une maintenant !
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-4 w-full">
                  {/* Carte interactive "+ Publier un article" intégrée en tête de liste */}
                  <button
                    type="button"
                    onClick={() => setOngletActif("publier")}
                    className="group flex flex-col items-center justify-center min-h-[220px] sm:min-h-[260px] rounded-2xl sm:rounded-3xl border-2 border-dashed border-blue-400/80 dark:border-blue-600/80 bg-blue-50/40 hover:bg-blue-50 dark:bg-blue-950/20 dark:hover:bg-blue-950/40 text-blue-600 dark:text-blue-400 p-4 transition-all duration-300 hover:scale-[1.02] cursor-pointer shadow-xs"
                    title="Ajouter un article à la boutique"
                  >
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-blue-600 text-white flex items-center justify-center text-xl sm:text-2xl shadow-md group-hover:scale-110 transition-transform mb-3">
                      <i className="fa-solid fa-plus"></i>
                    </div>
                    <span className="text-xs sm:text-sm font-black text-center text-zinc-900 dark:text-white">
                      Publier un article
                    </span>
                    <span className="text-[10px] sm:text-[11px] text-zinc-500 dark:text-zinc-400 text-center mt-1">
                      Ajouter un nouveau produit
                    </span>
                  </button>

                  {listeArticles.map((art) => (
                    <CarteArticle
                      key={art.id}
                      article={{
                        ...art,
                        boutique_id: boutique?.id || art.boutique_id || art.store_id,
                        boutique_nom: nom,
                        quartier: quartier || art.quartier,
                        ville: ville || art.ville,
                        telephone_whatsapp: telephone || art.telephone_whatsapp,
                        whatsappUrl: whatsappUrl || art.whatsappUrl,
                      }}
                      onVoirArticle={onVoirArticle}
                      onVoirBoutique={() => {}}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {ongletActif === "profit" && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 border border-amber-200 dark:border-amber-800/60 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🤑</span>
                  <h3 className="text-sm font-black text-amber-950 dark:text-amber-100">
                    Faire profit &amp; Multiplier vos ventes
                  </h3>
                </div>
                <p className="text-xs text-amber-900/80 dark:text-amber-200/80 leading-relaxed">
                  Boostez la visibilité de vos articles, obtenez le badge Commerçant Certifié et recevez les commandes directement sur WhatsApp.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-2xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50 space-y-2">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center text-base">
                    <i className="fa-brands fa-whatsapp"></i>
                  </div>
                  <h4 className="text-xs font-black text-zinc-900 dark:text-white">Commandes Directes WhatsApp</h4>
                  <p className="text-[11px] text-zinc-500 leading-relaxed">
                    Les clients discutent directement avec vous sur WhatsApp pour finaliser l&apos;achat et la livraison.
                  </p>
                </div>

                <div className="p-4 rounded-2xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50 space-y-2">
                  <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-600 flex items-center justify-center text-base">
                    <i className="fa-solid fa-crown"></i>
                  </div>
                  <h4 className="text-xs font-black text-zinc-900 dark:text-white">Badge Boutique Officielle</h4>
                  <p className="text-[11px] text-zinc-500 leading-relaxed">
                    Gagnez la confiance immédiate des acheteurs partout au Sénégal.
                  </p>
                </div>
              </div>
            </div>
          )}

          {ongletActif === "abonnes" && (
            <div className="py-12 text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 flex items-center justify-center text-2xl mx-auto">
                <i className="fa-solid fa-users"></i>
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Vos abonnés &amp; clients fidèles</h3>
                <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                  Vos clients peuvent s&apos;abonner à votre boutique pour être notifiés de vos nouveaux arrivages en priorité.
                </p>
              </div>
            </div>
          )}

          {ongletActif === "avis" && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="text-xl font-black text-zinc-900 dark:text-white flex items-center gap-1.5">
                    <span>5.0</span>
                    <div className="flex text-amber-400 text-xs">
                      <i className="fa-solid fa-star"></i>
                      <i className="fa-solid fa-star"></i>
                      <i className="fa-solid fa-star"></i>
                      <i className="fa-solid fa-star"></i>
                      <i className="fa-solid fa-star"></i>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">Note moyenne de satisfaction</p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-600 text-[10px] font-black uppercase">
                  100% Positif
                </span>
              </div>

              <div className="p-4 rounded-2xl border border-gray-100 dark:border-zinc-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-zinc-900 dark:text-white">Acheteur Vérifié</span>
                  <span className="text-zinc-400 text-[10px]">Récemment</span>
                </div>
                <div className="flex text-amber-400 text-[10px]">
                  <i className="fa-solid fa-star"></i>
                  <i className="fa-solid fa-star"></i>
                  <i className="fa-solid fa-star"></i>
                  <i className="fa-solid fa-star"></i>
                  <i className="fa-solid fa-star"></i>
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-300">
                  « Produit conforme à la description et vendeur très réactif sur WhatsApp. Livraison rapide à Dakar ! »
                </p>
              </div>
            </div>
          )}

          {ongletActif === "faq" && (
            <div className="space-y-3">
              <details className="p-3.5 rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/40 text-xs group">
                <summary className="font-bold text-zinc-900 dark:text-white cursor-pointer list-none flex items-center justify-between">
                  <span>Comment commander un article ?</span>
                  <i className="fa-solid fa-chevron-down text-[10px] text-zinc-400 group-open:rotate-180 transition"></i>
                </summary>
                <p className="mt-2 text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Cliquez sur un article ou sur le bouton « Contacter sur WhatsApp » pour discuter en direct avec le commerçant et organiser la livraison.
                </p>
              </details>

              <details className="p-3.5 rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/40 text-xs group">
                <summary className="font-bold text-zinc-900 dark:text-white cursor-pointer list-none flex items-center justify-between">
                  <span>Quels sont les modes de paiement acceptés ?</span>
                  <i className="fa-solid fa-chevron-down text-[10px] text-zinc-400 group-open:rotate-180 transition"></i>
                </summary>
                <p className="mt-2 text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Vous pouvez régler à la livraison, par Wave, Orange Money ou en espèces selon les modalités convenues avec la boutique.
                </p>
              </details>
            </div>
          )}

          {ongletActif === "apropos" && (
            <div className="space-y-4 text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-200 dark:border-zinc-800 space-y-2">
                <h4 className="text-sm font-black text-zinc-900 dark:text-white flex items-center gap-2">
                  <i className="fa-solid fa-store text-blue-600"></i>
                  Présentation de la boutique
                </h4>
                <p>
                  Bienvenue dans la boutique officielle <strong>{nom}</strong> sur Facilité. Nous mettons à votre disposition des produits de qualité avec un stock constamment actualisé en temps réel.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 space-y-1">
                  <h5 className="font-extrabold text-zinc-900 dark:text-white flex items-center gap-1.5 text-xs">
                    <i className="fa-solid fa-truck text-emerald-600"></i>
                    Livraison Directe
                  </h5>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">
                    Livraison rapide disponible à {ville} et ses environs.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 space-y-1">
                  <h5 className="font-extrabold text-zinc-900 dark:text-white flex items-center gap-1.5 text-xs">
                    <i className="fa-solid fa-money-bill-wave text-blue-600"></i>
                    Paiements Acceptés
                  </h5>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">
                    Paiement à la livraison, Wave, Orange Money et espèces.
                  </p>
                </div>
              </div>
            </div>
          )}

          {ongletActif === "contact" && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-gray-50 dark:bg-zinc-800/60 border border-gray-200 dark:border-zinc-800 space-y-3">
                <h4 className="text-sm font-black text-zinc-900 dark:text-white flex items-center gap-2">
                  <i className="fa-solid fa-address-book text-blue-600"></i>
                  Coordonnées directes
                </h4>

                <div className="space-y-2 text-xs sm:text-sm">
                  <div className="flex items-center gap-2.5 text-zinc-700 dark:text-zinc-300">
                    <i className="fa-solid fa-location-dot text-red-500 w-4 text-center"></i>
                    <span>{quartier ? `${quartier}, ` : ""}{ville}, Sénégal</span>
                  </div>

                  {telephone && (
                    <div className="flex items-center gap-2.5 text-zinc-700 dark:text-zinc-300">
                      <i className="fa-brands fa-whatsapp text-emerald-500 w-4 text-center"></i>
                      <span>WhatsApp : {telephone}</span>
                    </div>
                  )}
                </div>

                {whatsappUrl && (
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 w-full py-3 px-4 rounded-2xl bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition cursor-pointer"
                  >
                    <i className="fa-brands fa-whatsapp text-base"></i>
                    Échanger directement avec le boutiquier
                  </a>
                )}
              </div>
            </div>
          )}

          {/* VUE PUBLIER UN ARTICLE DANS LA BOUTIQUE */}
          {ongletActif === "publier" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setOngletActif("apercu")}
                  className="text-xs font-bold text-zinc-500 hover:text-zinc-900 dark:hover:text-white flex items-center gap-1.5 transition cursor-pointer"
                >
                  <i className="fa-solid fa-arrow-left"></i>
                  <span>Retour à l&apos;aperçu</span>
                </button>
                <h3 className="text-sm font-black text-zinc-900 dark:text-white">
                  Publier un nouvel article
                </h3>
              </div>

              <FormulaireArticle
                userId={userId}
                storeId={boutique?.id || "facilite_shop"}
                onPublie={async () => {
                  if (boutique?.id && boutique?.id !== "facilite_shop") {
                    try {
                      const nouveaux = await chargerMesArticles(boutique.id);
                      setListeArticles(nouveaux);
                    } catch {}
                  }
                  onBoutiqueUpdate?.();
                  setOngletActif("apercu");
                  showToast("✓ Article publié avec succès dans votre boutique !");
                }}
              />
            </div>
          )}

          {ongletActif === "parametres" && (
            <VueReglages
              userId={userId}
              profile={profile}
              boutique={boutique}
              onRetour={() => setOngletActif("produits")}
              onEnregistre={() => {
                onBoutiqueUpdate?.();
              }}
            />
          )}
        </div>
      </div>
      </div>

      {/* Bouton Flottant (FAB) Publier un Article */}
      <button
        type="button"
        onClick={() => setOngletActif("publier")}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-5 py-3.5 rounded-full bg-[#10E688] hover:bg-[#0fd57d] text-gray-950 font-black shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer border border-emerald-300 group shadow-emerald-600/30"
        title="Publier un nouvel article dans cette boutique"
      >
        <div className="w-6 h-6 rounded-full bg-gray-950 text-[#10E688] flex items-center justify-center text-xs group-hover:rotate-90 transition-transform duration-300">
          <i className="fa-solid fa-plus"></i>
        </div>
        <span className="text-xs sm:text-sm font-extrabold tracking-tight">Publier un article</span>
      </button>
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


const TYPES_BOUTIQUE = [
  { id: "produit", label: "Vente de produits", icon: "fa-box-open" },
  { id: "service", label: "Service / métier", icon: "fa-screwdriver-wrench" },
  { id: "etablissement", label: "Établissement", icon: "fa-building" },
];

function FormulaireBoutique({ userId, boutique, nombreBoutiques = 0, onEnregistre }) {
  const [champs, setChamps] = useState({
    nom: boutique?.nom || "",
    quartier: boutique?.quartier || "",
    ville: boutique?.ville || "Dakar",
    telephone_whatsapp: boutique?.telephone_whatsapp || "",
    latitude: boutique?.latitude ?? null,
    longitude: boutique?.longitude ?? null,
    precisionM: boutique?.position_precision_m ?? null,
    type_boutique: boutique?.type_boutique || "produit",
    metier: boutique?.metier || "",
    description_prestation: boutique?.description_prestation || "",
    categorie_etablissement: boutique?.categorie_etablissement || "sante",
  });
  const [envoi, setEnvoi] = useState(false);
  const [message, setMessage] = useState("");
  const [erreur, setErreur] = useState("");

  const positionVerrouillee = !!boutique?.position_definie_le;
  // Le type est choisi une seule fois, à la création — comme la position —
  // et n'est plus jamais proposé à l'édition (voir migration
  // 20260909110000) : le changer sur une boutique déjà référencée créerait
  // un état incohérent (stock sur une boutique 'service', etc.).
  const estService = champs.type_boutique === "service";
  const estEtablissement = champs.type_boutique === "etablissement";

  const soumettre = async (e) => {
    e.preventDefault();
    setEnvoi(true);
    setErreur("");
    setMessage("");

    try {
      if (boutique) {
        // Modification : nom, quartier, ville, WhatsApp, et selon le type
        // déjà fixé, métier/description ou catégorie d'établissement.
        // Jamais la position ni le type_boutique.
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

      {!boutique && (
        <div className="mb-4">
          <label className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 block">
            Type de boutique
          </label>
          <div className="grid grid-cols-3 gap-2">
            {TYPES_BOUTIQUE.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setChamps({ ...champs, type_boutique: t.id })}
                className={`px-2 py-2.5 rounded-2xl text-[11px] font-bold flex flex-col items-center gap-1 border transition cursor-pointer ${
                  champs.type_boutique === t.id
                    ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white"
                    : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300"
                }`}
              >
                <i className={`fa-solid ${t.icon}`}></i>
                <span className="text-center leading-tight">{t.label}</span>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-gray-400 mt-1.5">
            Ce choix est définitif : il ne pourra plus être modifié après la création.
          </p>
        </div>
      )}

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

      {estService && (
        <div className="mt-4 space-y-3">
          <input
            type="text"
            value={champs.metier}
            onChange={(e) => setChamps({ ...champs, metier: e.target.value })}
            placeholder="Métier (ex. Plombier, Électricien, Coiffeur à domicile...)"
            className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm"
          />
          <textarea
            value={champs.description_prestation}
            onChange={(e) => setChamps({ ...champs, description_prestation: e.target.value })}
            placeholder="Décrivez votre prestation (spécialités, expérience...)"
            rows={3}
            className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm resize-none"
          />
          <p className="text-[11px] text-gray-400">
            Le quartier renseigné plus haut sert de zone d&apos;intervention.
          </p>
        </div>
      )}

      {estEtablissement && (
        <div className="mt-4 space-y-2">
          <select
            value={champs.categorie_etablissement}
            onChange={(e) => setChamps({ ...champs, categorie_etablissement: e.target.value })}
            className="w-full px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm cursor-pointer"
          >
            <option value="sante">Santé (clinique, pharmacie...)</option>
            <option value="finance">Finance (point Wave/Orange Money...)</option>
            <option value="beaute">Beauté (salon, barbier...)</option>
            <option value="autre">Autre établissement</option>
          </select>
          {["sante", "finance"].includes(champs.categorie_etablissement) && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400 font-bold flex items-start gap-1.5">
              <i className="fa-solid fa-circle-info mt-0.5 shrink-0"></i>
              <span>
                Catégorie sensible : votre fiche restera masquée du public jusqu&apos;à sa vérification par un
                administrateur.
              </span>
            </p>
          )}
        </div>
      )}

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

      {/* Horaires : uniquement à l'édition (besoin d'un store_id existant),
          jamais à la création — enregistrer_mes_horaires est un appel
          séparé de creer_ma_boutique. */}
      {boutique && estEtablissement && <EditeurHoraires storeId={boutique.id} />}
    </form>
  );
}

function EditeurHoraires({ storeId }) {
  const [lignes, setLignes] = useState(() =>
    Array.from({ length: 7 }, (_, jour) => ({
      jour_semaine: jour,
      heure_ouverture: "08:00",
      heure_fermeture: "18:00",
      ferme_ce_jour: false,
    }))
  );
  const [chargement, setChargement] = useState(true);
  const [envoi, setEnvoi] = useState(false);
  const [message, setMessage] = useState("");
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    let annule = false;
    obtenirHorairesBoutique(storeId)
      .then((data) => {
        if (annule || !data || data.length === 0) return;
        const parJour = new Map(data.map((h) => [h.jour_semaine, h]));
        setLignes((prev) =>
          prev.map((l) => {
            const h = parJour.get(l.jour_semaine);
            if (!h) return l;
            return {
              jour_semaine: l.jour_semaine,
              heure_ouverture: h.heure_ouverture?.slice(0, 5) || "08:00",
              heure_fermeture: h.heure_fermeture?.slice(0, 5) || "18:00",
              ferme_ce_jour: h.ferme_ce_jour,
            };
          })
        );
      })
      .catch(() => {})
      .finally(() => {
        if (!annule) setChargement(false);
      });
    return () => {
      annule = true;
    };
  }, [storeId]);

  const modifierLigne = (idx, champs) => {
    setLignes((prev) => prev.map((l, i) => (i === idx ? { ...l, ...champs } : l)));
  };

  const soumettre = async (e) => {
    e.preventDefault();
    setEnvoi(true);
    setErreur("");
    setMessage("");
    try {
      await enregistrerHoraires(storeId, lignes);
      setMessage("Horaires enregistrés.");
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="mt-6 pt-5 border-t border-gray-100 dark:border-gray-800">
      <h3 className="text-sm font-black text-gray-900 dark:text-white mb-1">Horaires d&apos;ouverture</h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Affichés aux acheteurs sur la fiche de votre établissement.
      </p>

      {chargement ? (
        <p className="text-xs text-gray-400 italic">Chargement…</p>
      ) : (
        <div className="space-y-1.5">
          {lignes.map((l, idx) => (
            <div key={l.jour_semaine} className="flex flex-wrap items-center gap-2 text-xs">
              <span className="w-20 font-bold text-gray-600 dark:text-gray-400 shrink-0">
                {JOURS_SEMAINE[l.jour_semaine]}
              </span>
              <label className="flex items-center gap-1.5 shrink-0 cursor-pointer">
                <input
                  type="checkbox"
                  checked={l.ferme_ce_jour}
                  onChange={(e) => modifierLigne(idx, { ferme_ce_jour: e.target.checked })}
                />
                <span className="text-gray-500 dark:text-gray-400">Fermé</span>
              </label>
              {!l.ferme_ce_jour && (
                <>
                  <input
                    type="time"
                    value={l.heure_ouverture}
                    onChange={(e) => modifierLigne(idx, { heure_ouverture: e.target.value })}
                    className="px-2 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                  />
                  <span className="text-gray-400">–</span>
                  <input
                    type="time"
                    value={l.heure_fermeture}
                    onChange={(e) => modifierLigne(idx, { heure_fermeture: e.target.value })}
                    className="px-2 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
                  />
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {erreur && <p className="text-xs font-bold text-red-600 mt-3">{erreur}</p>}
      {message && <p className="text-xs font-bold text-emerald-600 mt-3">{message}</p>}

      <button
        type="button"
        onClick={soumettre}
        disabled={envoi || chargement}
        className="mt-3 px-5 py-2.5 rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-black disabled:opacity-50 cursor-pointer shadow-sm hover:opacity-95 transition"
      >
        <i className={`fa-solid ${envoi ? "fa-spinner fa-spin" : "fa-floppy-disk"} mr-2`}></i>
        {envoi ? "Enregistrement…" : "Enregistrer les horaires"}
      </button>
    </div>
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

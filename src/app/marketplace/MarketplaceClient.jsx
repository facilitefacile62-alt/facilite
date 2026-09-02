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
import { getFeatureFlagsTreeAsync, isFeatureAllowed, DEFAULT_FEATURE_TREE } from "@/lib/featureFlags";
import {
  chargerMaBoutique,
  coordonnee,
  MOTIFS_SIGNALEMENT,
  signalerAnnonce,
  chargerMesArticles,
  chercherAutourDeMoi,
  enregistrerBoutique,
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
  const { session, isAdmin, isRecruiter } = useAuth();
  const [featureFlagsTree, setFeatureFlagsTree] = useState(DEFAULT_FEATURE_TREE);

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

  const userId = session?.user?.id || null;
  const userRole = !session ? "visitor" : isAdmin ? "admin" : isRecruiter ? "recruiter" : "user";
  const isMarketplaceAllowed = isFeatureAllowed(featureFlagsTree, "nav_marketplace", userRole);

  const [onglet, setOnglet] = useState("acheter");

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
      <div className="max-w-6xl mx-auto px-3 sm:px-5 py-5">
        <header className="mb-5">
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
            Marketplace
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
            Trouvez ce qu&apos;il vous faut, en stock, dans une boutique près de chez vous.
          </p>
        </header>

        <div className="flex gap-2 mb-5">
          {[
            { id: "acheter", label: "Acheter", icon: "fa-magnifying-glass" },
            { id: "vendre", label: "Vendre", icon: "fa-store" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setOnglet(t.id)}
              className={`px-5 py-2.5 rounded-2xl text-sm font-bold transition cursor-pointer ${
                onglet === t.id
                  ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-md"
                  : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-800"
              }`}
            >
              <i className={`fa-solid ${t.icon} mr-2`}></i>
              {t.label}
            </button>
          ))}
        </div>

        {onglet === "acheter" ? <VueAcheteur /> : <VueVendeur userId={userId} />}
      </div>
    </div>
  );
}

/* ========================================================================== */
/* ACHETEUR                                                                    */
/* ========================================================================== */

function VueAcheteur() {
  const [position, setPosition] = useState(null);
  const [texte, setTexte] = useState("");
  const [categorie, setCategorie] = useState(null);
  const [rayonKm, setRayonKm] = useState(10);
  const [seulementEnStock, setSeulementEnStock] = useState(false);
  const [resultats, setResultats] = useState([]);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");
  const [aCherche, setACherche] = useState(false);

  const lancerRecherche = useCallback(
    async (pos) => {
      const p = pos || position;
      if (!p) return;
      setChargement(true);
      setErreur("");
      try {
        const r = await chercherAutourDeMoi({
          latitude: p.latitude,
          longitude: p.longitude,
          rayonKm,
          categorie,
          texte: texte.trim() || null,
          seulementEnStock,
        });
        setResultats(r);
        setACherche(true);
      } catch (e) {
        setErreur(e.message);
        setResultats([]);
      } finally {
        setChargement(false);
      }
    },
    [position, rayonKm, categorie, texte, seulementEnStock]
  );

  const localiser = async () => {
    setErreur("");
    setChargement(true);
    try {
      const p = await positionActuelle();
      setPosition(p);
      await lancerRecherche(p);
    } catch (e) {
      // Sans position, aucun tri par proximité n'a de sens : on le dit au lieu
      // d'afficher une liste dans un ordre arbitraire qui ferait croire à une
      // pertinence géographique.
      setErreur(e.message);
      setChargement(false);
    }
  };

  // Une fois la position connue, tout changement de filtre relance la requête.
  // Le tri par distance est fait par la base : filtrer ici supposerait d'avoir
  // déjà téléchargé tout le catalogue.
  useEffect(() => {
    if (!position) return;
    const t = setTimeout(() => {
      lancerRecherche(position);
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categorie, rayonKm, seulementEnStock, texte, position]);

  return (
    <div>
      <div className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-4 sm:p-5 mb-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
            <input
              type="text"
              value={texte}
              onChange={(e) => setTexte(e.target.value)}
              placeholder="Que cherchez-vous ? (téléphone, ventilateur, ciment…)"
              className="w-full pl-11 pr-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#1877F2]/40"
            />
          </div>
          <button
            type="button"
            onClick={localiser}
            disabled={chargement}
            className="px-5 py-3 rounded-2xl bg-[#1877F2] text-white text-sm font-bold whitespace-nowrap disabled:opacity-60 cursor-pointer"
          >
            <i className={`fa-solid ${chargement ? "fa-spinner fa-spin" : "fa-location-crosshairs"} mr-2`}></i>
            {position ? "Actualiser" : "Autour de moi"}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-4">
          <button
            type="button"
            onClick={() => setCategorie(null)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition cursor-pointer ${
              categorie === null
                ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-transparent"
                : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700"
            }`}
          >
            Toutes
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategorie(categorie === c.id ? null : c.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition cursor-pointer ${
                categorie === c.id
                  ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-transparent"
                  : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700"
              }`}
            >
              <i className={`fa-solid ${c.icon} mr-1.5`}></i>
              {c.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
          <label className="flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-400">
            Rayon
            <select
              value={rayonKm}
              onChange={(e) => setRayonKm(Number(e.target.value))}
              className="px-3 py-1.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-bold cursor-pointer"
            >
              {RAYONS.map((r) => (
                <option key={r} value={r}>
                  {r} km
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={seulementEnStock}
              onChange={(e) => setSeulementEnStock(e.target.checked)}
              className="w-4 h-4 accent-[#1877F2] cursor-pointer"
            />
            En stock uniquement
          </label>
        </div>
      </div>

      {erreur && (
        <div className="mb-4 px-4 py-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs font-bold text-amber-900 dark:text-amber-200">
          <i className="fa-solid fa-triangle-exclamation mr-2"></i>
          {erreur}
        </div>
      )}

      {!position && !erreur && (
        <div className="text-center py-16">
          <i className="fa-solid fa-location-dot text-4xl text-gray-300 dark:text-gray-700"></i>
          <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mt-4">
            Activez votre position pour voir les boutiques proches
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            Elle sert uniquement à trier les résultats par distance. Elle n&apos;est pas enregistrée.
          </p>
        </div>
      )}

      {position && aCherche && resultats.length === 0 && !chargement && (
        <div className="text-center py-16">
          <i className="fa-solid fa-store-slash text-4xl text-gray-300 dark:text-gray-700"></i>
          <p className="text-sm font-bold text-gray-700 dark:text-gray-300 mt-4">
            Aucun article trouvé dans ce rayon
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            Élargissez le rayon, ou retirez le filtre « en stock ».
          </p>
        </div>
      )}

      {resultats.length > 0 && (
        <CarteBoutiques
          articles={resultats}
          depart={position}
          onChoisirBoutique={(id) => {
            // La carte situe, la liste détaille : cliquer un point amène au
            // premier article de cette boutique plutôt que d'ouvrir une fiche
            // par-dessus la carte.
            const cible = document.getElementById(`boutique-${id}`);
            if (cible) cible.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {resultats.map((a, i) => (
          <CarteArticle
            key={a.id}
            article={a}
            // Ancre posée sur le PREMIER article de chaque boutique : c'est là
            // que la carte fait défiler.
            ancre={resultats.findIndex((x) => x.boutique_id === a.boutique_id) === i}
          />
        ))}
      </div>
    </div>
  );
}

function CarteArticle({ article, ancre = false }) {
  const [signalementOuvert, setSignalementOuvert] = useState(false);
  const enStock = article.statut === "en_stock";
  const photo = article.photos?.[0] || null;

  return (
    <article
      id={ancre ? `boutique-${article.boutique_id}` : undefined}
      className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col scroll-mt-24"
    >
      <div className="relative aspect-4/3 bg-gray-100 dark:bg-gray-800">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt={article.titre} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-700">
            <i className="fa-solid fa-image text-3xl"></i>
          </div>
        )}
        <span
          className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wide ${
            enStock ? "bg-emerald-500 text-white" : "bg-gray-700 text-white"
          }`}
        >
          {enStock ? "En stock" : "Épuisé"}
        </span>
        <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/70 text-white text-[10px] font-black">
          <i className="fa-solid fa-location-dot mr-1"></i>
          {article.distanceLisible}
        </span>
      </div>

      <div className="p-4 flex-1 flex flex-col">
        <h3 className="text-sm font-black text-gray-900 dark:text-white leading-snug line-clamp-2">
          {article.titre}
        </h3>
        <p className="text-lg font-black text-[#1877F2] mt-1">{prixLisible(article.prix_xof)} FCFA</p>

        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          <i className="fa-solid fa-shop mr-1.5"></i>
          {article.boutique_nom}
          {article.quartier ? ` · ${article.quartier}` : ""}
        </p>
        {/* La fraîcheur est ce qui justifie — ou non — un déplacement. */}
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
          Stock confirmé {depuis(article.maj_le)}
        </p>

        {article.whatsappUrl ? (
          <a
            href={article.whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 w-full py-2.5 rounded-2xl bg-[#25D366] text-white text-xs font-black text-center transition hover:brightness-95"
          >
            <i className="fa-brands fa-whatsapp mr-2"></i>
            Contacter la boutique
          </a>
        ) : (
          <p className="mt-4 text-[11px] text-gray-400 text-center">Aucun contact renseigné</p>
        )}

        {/* Volontairement discret : le signalement doit être trouvable sans
            concurrencer le bouton de contact. Une annonce honnête est la
            règle, pas l'exception. */}
        <button
          type="button"
          onClick={() => setSignalementOuvert(true)}
          className="mt-2 w-full text-[11px] font-semibold text-gray-400 hover:text-red-600 transition cursor-pointer"
        >
          <i className="fa-regular fa-flag mr-1.5"></i>
          Signaler cette annonce
        </button>
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

function VueVendeur({ userId }) {
  const [boutique, setBoutique] = useState(null);
  const [articles, setArticles] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");

  // Aucun setState synchrone ici : le premier geste est un `return` ou un
  // `await`. Sans cette précaution, React signale des rendus en cascade — et
  // il a raison, l'effet redéclencherait un rendu avant même la requête.
  // Le cas « non connecté » n'a pas besoin de toucher à l'état : le rendu
  // renvoie l'écran de connexion avant de regarder `chargement`.
  const recharger = useCallback(async () => {
    if (!userId) return;
    try {
      const b = await chargerMaBoutique(userId);
      setBoutique(b);
      setArticles(b ? await chargerMesArticles(b.id) : []);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setChargement(false);
    }
  }, [userId]);

  useEffect(() => {
    // La règle ne peut pas voir que `recharger` n'écrit rien avant son premier
    // `await` : elle signale tout appel à une fonction contenant un setState.
    // Même dérogation que les autres pages du dépôt qui chargent leurs données
    // au montage (admin/dashboard, boite-a-idees…).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    recharger();
  }, [recharger]);

  if (!userId) {
    return (
      <div className="text-center py-16 bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800">
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

  return (
    <div className="space-y-5">
      {erreur && (
        <div className="px-4 py-3 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs font-bold text-red-800 dark:text-red-200">
          {erreur}
        </div>
      )}

      <FormulaireBoutique userId={userId} boutique={boutique} onEnregistre={recharger} />

      {boutique && (
        <>
          <FormulaireArticle userId={userId} storeId={boutique.id} onPublie={recharger} />
          <ListeMesArticles articles={articles} onChange={recharger} />
        </>
      )}
    </div>
  );
}

function FormulaireBoutique({ userId, boutique, onEnregistre }) {
  const [champs, setChamps] = useState({
    nom: boutique?.nom || "",
    quartier: boutique?.quartier || "",
    ville: boutique?.ville || "Dakar",
    telephone_whatsapp: boutique?.telephone_whatsapp || "",
    latitude: boutique?.latitude ?? null,
    longitude: boutique?.longitude ?? null,
  });
  const [envoi, setEnvoi] = useState(false);
  const [message, setMessage] = useState("");
  const [erreur, setErreur] = useState("");

  const capturerPosition = async () => {
    setErreur("");
    try {
      const p = await positionActuelle();
      setChamps((c) => ({ ...c, latitude: p.latitude, longitude: p.longitude }));
      setMessage("Position de la boutique enregistrée.");
    } catch (e) {
      setErreur(e.message);
    }
  };

  const soumettre = async (e) => {
    e.preventDefault();
    setEnvoi(true);
    setErreur("");
    setMessage("");
    try {
      await enregistrerBoutique(userId, champs);
      setMessage("Boutique enregistrée.");
      await onEnregistre();
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnvoi(false);
    }
  };

  // `coordonnee` et non Number.isFinite(Number(...)) : sans relevé GPS, les
  // champs valent null, et Number(null) vaut 0 — l'écran annonçait « Boutique
  // localisée » avant toute capture, et la boutique partait à 0°/0°.
  const positionnee = coordonnee(champs.latitude) !== null && coordonnee(champs.longitude) !== null;

  return (
    <form
      onSubmit={soumettre}
      className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-4 sm:p-5"
    >
      <h2 className="text-base font-black text-gray-900 dark:text-white mb-1">
        {boutique ? "Ma boutique" : "Ouvrir ma boutique"}
      </h2>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        La position est enregistrée une seule fois : tous vos articles en héritent.
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
          placeholder="Quartier (ex. Liberté 6)"
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

      <div className="flex flex-wrap items-center gap-3 mt-3">
        <button
          type="button"
          onClick={capturerPosition}
          className="px-4 py-2.5 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-xs font-bold cursor-pointer"
        >
          <i className="fa-solid fa-location-crosshairs mr-2"></i>
          {positionnee ? "Mettre à jour la position" : "Enregistrer ma position *"}
        </button>
        {positionnee && (
          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
            <i className="fa-solid fa-check mr-1"></i>
            Boutique localisée
          </span>
        )}
      </div>

      {erreur && <p className="text-xs font-bold text-red-600 mt-3">{erreur}</p>}
      {message && <p className="text-xs font-bold text-emerald-600 mt-3">{message}</p>}

      <button
        type="submit"
        disabled={envoi || !positionnee}
        className="mt-4 w-full sm:w-auto px-6 py-3 rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-black disabled:opacity-50 cursor-pointer"
      >
        {envoi ? "Enregistrement…" : boutique ? "Mettre à jour" : "Créer ma boutique"}
      </button>
      {!positionnee && (
        <p className="text-[11px] text-gray-400 mt-2">
          Sans position, votre boutique ne peut pas apparaître dans les recherches de proximité.
        </p>
      )}
    </form>
  );
}

function FormulaireArticle({ userId, storeId, onPublie }) {
  const [champs, setChamps] = useState({
    titre: "",
    description: "",
    categorie: "telephones",
    prix_xof: "",
    quantite: 1,
  });
  const [photos, setPhotos] = useState([]); // { chemin, apercu }
  const [envoi, setEnvoi] = useState(false);
  const [compression, setCompression] = useState(false);
  const [erreur, setErreur] = useState("");
  const champFichier = useRef(null);

  const ajouterPhotos = async (e) => {
    // La FileList est vidée dès que le champ est réinitialisé : on la copie
    // avant tout traitement asynchrone, sinon la lecture échoue en silence.
    const fichiers = Array.from(e.target.files || []);
    if (champFichier.current) champFichier.current.value = "";
    if (fichiers.length === 0) return;

    setErreur("");
    setCompression(true);
    try {
      const restant = Math.max(0, 6 - photos.length);
      for (const f of fichiers.slice(0, restant)) {
        const chemin = await envoyerPhoto(f, userId);
        setPhotos((p) => [...p, { chemin, apercu: urlPhoto(chemin) }]);
      }
      if (fichiers.length > restant) {
        setErreur("6 photos au maximum par article.");
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
    try {
      await publierArticle(storeId, { ...champs, photos: photos.map((p) => p.chemin) });
      setChamps({ titre: "", description: "", categorie: champs.categorie, prix_xof: "", quantite: 1 });
      setPhotos([]);
      await onPublie();
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <form
      onSubmit={soumettre}
      className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-4 sm:p-5"
    >
      <h2 className="text-base font-black text-gray-900 dark:text-white mb-4">Ajouter un article</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          type="text"
          required
          value={champs.titre}
          onChange={(e) => setChamps({ ...champs, titre: e.target.value })}
          placeholder="Titre de l'article *"
          className="px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm sm:col-span-2"
        />
        <select
          value={champs.categorie}
          onChange={(e) => setChamps({ ...champs, categorie: e.target.value })}
          className="px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm cursor-pointer"
        >
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
        <input
          type="number"
          min="0"
          required
          value={champs.prix_xof}
          onChange={(e) => setChamps({ ...champs, prix_xof: e.target.value })}
          placeholder="Prix en FCFA *"
          className="px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm"
        />
        <input
          type="number"
          min="0"
          value={champs.quantite}
          onChange={(e) => setChamps({ ...champs, quantite: e.target.value })}
          placeholder="Quantité en stock"
          className="px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm"
        />
        <textarea
          rows={2}
          value={champs.description}
          onChange={(e) => setChamps({ ...champs, description: e.target.value })}
          placeholder="Description (facultatif)"
          className="px-4 py-3 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm sm:col-span-2 resize-none"
        />
      </div>

      <div className="mt-4">
        <div className="flex flex-wrap gap-2">
          {photos.map((p) => (
            <div key={p.chemin} className="relative w-20 h-20 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.apercu} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => retirerPhoto(p.chemin)}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 text-white text-[10px] cursor-pointer"
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
              disabled={compression}
              className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700 text-gray-400 flex items-center justify-center cursor-pointer disabled:opacity-50"
              aria-label="Ajouter une photo"
            >
              <i className={`fa-solid ${compression ? "fa-spinner fa-spin" : "fa-camera"}`}></i>
            </button>
          )}
        </div>
        <input
          ref={champFichier}
          type="file"
          accept="image/*"
          multiple
          onChange={ajouterPhotos}
          className="hidden"
        />
        <p className="text-[11px] text-gray-400 mt-2">
          Les photos sont compressées sur votre téléphone avant l&apos;envoi, pour économiser vos données.
        </p>
      </div>

      {erreur && <p className="text-xs font-bold text-red-600 mt-3">{erreur}</p>}

      <button
        type="submit"
        disabled={envoi || compression}
        className="mt-4 w-full sm:w-auto px-6 py-3 rounded-2xl bg-[#1877F2] text-white text-sm font-black disabled:opacity-50 cursor-pointer"
      >
        {envoi ? "Publication…" : "Publier l'article"}
      </button>
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

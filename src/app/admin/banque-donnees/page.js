"use client";

/**
 * Banque d'information — vue administrateur consolidée des candidats, des
 * offres et des commandes.
 *
 * Garde-fou central (incident du 2026-08-18) : cette page n'utilise QUE le
 * client Supabase du navigateur, scopé par la session de l'administrateur.
 * Jamais service_role, jamais de route serveur qui l'utiliserait. La RLS
 * fait donc l'intégralité du contrôle d'accès :
 *
 *   - public.resumes, policy « Un admin lit tous les CV » :
 *     can_admin_read_document(user_id, auth.uid()), qui n'accepte qu'une
 *     ligne document_access_requests au statut 'approved' non expirée.
 *
 * Conséquence directe : la liste des documents d'un candidat revient vide
 * tant que celui-ci n'a pas donné son accord. La page n'a aucun moyen de
 * contourner ça, et n'essaie pas d'en avoir un — elle propose seulement de
 * créer une demande motivée. C'est la seule voie d'accès.
 *
 * EXCEPTION délibérée, onglet « Banque de CV » (2026-09-03) : banque_cv
 * n'accorde RIEN à authenticated, même en lecture (RLS activée, zéro
 * policy — voir 20260903120000_banque_cv.sql). Ce ne sont pas des CV de
 * candidats consentants comme resumes, ce sont des CV importés par un
 * admin sans compte associé : le régime de protection est plus strict, pas
 * plus permissif. Le client Supabase du navigateur ne PEUT PAS lire cette
 * table quel que soit le rôle de la personne connectée — la garantie tient
 * à l'absence totale de grant, pas à une policy contournable. Cet onglet
 * passe donc par /api/admin/banque-cv/*, seule voie d'accès possible,
 * jamais par une exception au principe ci-dessus.
 */

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import BanqueCvTab from "@/components/BanqueCvTab";

const ONGLETS = [
  { cle: "candidats", libelle: "Candidats", icone: "fa-users" },
  { cle: "offres", libelle: "Offres", icone: "fa-briefcase" },
  { cle: "commandes", libelle: "Commandes", icone: "fa-receipt" },
  { cle: "transport", libelle: "Transport", icone: "fa-bus" },
  { cle: "banque_cv", libelle: "Banque de CV", icone: "fa-file-lines" },
];

const PAR_PAGE = 25;

// Miroir exact du CHECK de public.transport_routes : une valeur ajoutee ici
// sans migration correspondante ferait echouer l'enregistrement en base.
const MODES_TRANSPORT = [
  { cle: "tata", libelle: "Tata" },
  { cle: "ter", libelle: "TER" },
  { cle: "brt", libelle: "BRT" },
  { cle: "vtc", libelle: "VTC" },
  { cle: "car_rapide", libelle: "Car rapide" },
];

const LIGNE_VIDE = {
  id: null, mode: "tata", ligne: "", operateur: "", origine: "", destination: "",
  arrets: [], zones: [], tarif_min: "", tarif_max: "", description: "", actif: true,
};

const ETIQUETTES_LIVRAISON = {
  delivered: { texte: "déposé", classe: "bg-emerald-50 text-[#047857] border-emerald-200" },
  pending_replacement: { texte: "en attente du candidat", classe: "bg-amber-50 text-amber-800 border-amber-200" },
  approved: { texte: "accepté", classe: "bg-emerald-50 text-[#047857] border-emerald-200" },
  refused: { texte: "refusé", classe: "bg-red-50 text-red-700 border-red-200" },
};

/**
 * Complétude du profil, sur les champs qui servent réellement au matching
 * et à la lisibilité d'une candidature. Volontairement calculée côté
 * navigateur sur les colonnes déjà chargées : une colonne générée en base
 * serait à maintenir à chaque évolution du formulaire de profil.
 */
// `headline` est proscrite par scripts/check-invariants.mjs (colonne de
// profils considérée obsolète, au même titre que role et user_type) : le
// prebuild casse le build si une requête sur profiles la sollicite.
const CHAMPS_COMPLETUDE = ["full_name", "bio", "city", "education_level", "skills", "experiences"];

function calculerCompletude(profil) {
  let remplis = 0;
  for (const champ of CHAMPS_COMPLETUDE) {
    const v = profil?.[champ];
    if (Array.isArray(v) ? v.length > 0 : v !== null && v !== undefined && String(v).trim() !== "") {
      remplis += 1;
    }
  }
  return Math.round((remplis / CHAMPS_COMPLETUDE.length) * 100);
}

export default function BanqueDonneesPage() {
  const [statut, setStatut] = useState("verification"); // verification | refuse | pret
  const [ongletActif, setOngletActif] = useState("candidats");
  const [recherche, setRecherche] = useState("");
  const [page, setPage] = useState(0);
  const [chargement, setChargement] = useState(false);

  const [candidats, setCandidats] = useState([]);
  const [offres, setOffres] = useState([]);
  const [commandes, setCommandes] = useState([]);
  const [total, setTotal] = useState(0);

  const [candidatOuvert, setCandidatOuvert] = useState(null);
  const [documentsCandidat, setDocumentsCandidat] = useState([]);
  const [demandesCandidat, setDemandesCandidat] = useState([]);
  const [motifDemande, setMotifDemande] = useState("");
  const [envoiDemande, setEnvoiDemande] = useState(false);
  const [message, setMessage] = useState(null);

  const [lignesTransport, setLignesTransport] = useState([]);
  const [ligneEditee, setLigneEditee] = useState(null);
  const [enregistrementLigne, setEnregistrementLigne] = useState(false);

  const [livraisons, setLivraisons] = useState([]);
  const [fichierLivraison, setFichierLivraison] = useState(null);
  const [titreLivraison, setTitreLivraison] = useState("");
  const [noteLivraison, setNoteLivraison] = useState("");
  const [envoiLivraison, setEnvoiLivraison] = useState(false);

  // --- Contrôle du statut administrateur -----------------------------------
  // Même RPC que /admin (admin/page.js) : une seule définition du statut
  // admin dans toute l'application.
  useEffect(() => {
    let annule = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        if (!annule) setStatut("refuse");
        return;
      }
      const { data, error } = await supabase.rpc("is_admin", { check_user_id: session.user.id });
      if (annule) return;
      setStatut(!error && data === true ? "pret" : "refuse");
    })();
    return () => {
      annule = true;
    };
  }, []);

  // --- Chargement de l'onglet actif ----------------------------------------
  const charger = useCallback(async () => {
    if (statut !== "pret") return;
    // La Banque de CV gère son propre chargement (routes /api/admin/banque-cv/*,
    // banque_cv n'étant lisible par aucun rôle authenticated) : la sortir
    // d'ici évite qu'un changement d'onglet ne déclenche par erreur la
    // requête « commandes » du dernier bloc else ci-dessous.
    if (ongletActif === "banque_cv") {
      setChargement(false);
      return;
    }
    setChargement(true);
    const debut = page * PAR_PAGE;
    const fin = debut + PAR_PAGE - 1;
    const filtre = recherche.trim();

    try {
      if (ongletActif === "candidats") {
        let q = supabase
          .from("profiles")
          .select(
            "id, full_name, email, city, country, education_level, bio, skills, experiences, is_public, created_at",
            { count: "exact" }
          )
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .range(debut, fin);
        if (filtre) q = q.or(`full_name.ilike.%${filtre}%,city.ilike.%${filtre}%,email.ilike.%${filtre}%`);
        const { data, count, error } = await q;
        if (error) throw error;
        setCandidats(data || []);
        setTotal(count || 0);
      } else if (ongletActif === "offres") {
        let q = supabase
          .from("job_offers")
          .select("id, title, company, location, contract_type, status, is_active, deadline, view_count, created_at", {
            count: "exact",
          })
          .order("created_at", { ascending: false })
          .range(debut, fin);
        if (filtre) q = q.or(`title.ilike.%${filtre}%,company.ilike.%${filtre}%`);
        const { data, count, error } = await q;
        if (error) throw error;
        // `expiree` est calculé ici et non au rendu : lire l'horloge pendant
        // le rendu rend le composant impur (react-hooks/purity) et le
        // résultat changerait d'un re-rendu à l'autre sans raison visible.
        const maintenant = Date.now();
        setOffres(
          (data || []).map((o) => ({
            ...o,
            expiree: o.deadline ? new Date(o.deadline).getTime() < maintenant : false,
          }))
        );
        setTotal(count || 0);
      } else if (ongletActif === "transport") {
        // Un admin voit aussi les lignes desactivees (policy
        // « Un admin lit toutes les lignes »), pour pouvoir les reactiver.
        let q = supabase
          .from("transport_routes")
          .select(
            "id, mode, ligne, operateur, origine, destination, arrets, zones, tarif_min, tarif_max, description, actif, updated_at",
            { count: "exact" }
          )
          .order("updated_at", { ascending: false })
          .range(debut, fin);
        if (filtre) q = q.or(`origine.ilike.%${filtre}%,destination.ilike.%${filtre}%,ligne.ilike.%${filtre}%`);
        const { data, count, error } = await q;
        if (error) throw error;
        setLignesTransport(data || []);
        setTotal(count || 0);
      } else {
        const { data, count, error } = await supabase
          .from("orders")
          .select("id, amount, currency, payment_status, payment_method, created_at", { count: "exact" })
          .order("created_at", { ascending: false })
          .range(debut, fin);
        if (error) throw error;
        setCommandes(data || []);
        setTotal(count || 0);
      }
    } catch (err) {
      setMessage({ type: "erreur", texte: `Chargement impossible : ${err.message}` });
    } finally {
      setChargement(false);
    }
  }, [statut, ongletActif, page, recherche]);

  // Synchronisation avec une source externe (la base) au changement
  // d'onglet, de page ou de recherche — le cas d'usage explicitement prévu
  // par useEffect. La règle react-hooks/set-state-in-effect vise les
  // cascades de rendu ; ici l'écriture d'état est le résultat d'un aller-
  // retour réseau, pas d'un calcul dérivable du rendu précédent.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    charger();
  }, [charger]);

  // --- Fiche candidat ------------------------------------------------------
  const ouvrirCandidat = async (candidat) => {
    setCandidatOuvert(candidat);
    setDocumentsCandidat([]);
    setDemandesCandidat([]);
    setLivraisons([]);
    setMotifDemande("");
    setFichierLivraison(null);
    setTitreLivraison("");
    setNoteLivraison("");

    // Ce SELECT ne ramène que ce que la RLS autorise. Une liste vide veut
    // dire « aucun accès accordé », pas « aucun document » — les deux cas
    // sont volontairement indiscernables ici.
    const { data: docs } = await supabase
      .from("resumes")
      .select("id, title, type, created_at, updated_at")
      .eq("user_id", candidat.id)
      .order("updated_at", { ascending: false });
    setDocumentsCandidat(docs || []);

    const { data: demandes } = await supabase
      .from("document_access_requests")
      .select("id, reason, status, expires_at, created_at")
      .eq("candidate_id", candidat.id)
      .order("created_at", { ascending: false });
    // Comme pour les offres, l'horloge est lue ici plutôt qu'au rendu.
    const maintenant = Date.now();
    setDemandesCandidat(
      (demandes || []).map((d) => ({
        ...d,
        acces_actif: d.status === "approved" && new Date(d.expires_at).getTime() > maintenant,
      }))
    );

    // Journal des livraisons : la policy ne laisse voir que celles faites par
    // cet administrateur, ce qui suffit à son propre suivi.
    const { data: livrs } = await supabase
      .from("document_deliveries")
      .select("id, title, status, note, created_at, decided_at")
      .eq("candidate_id", candidat.id)
      .order("created_at", { ascending: false });
    setLivraisons(livrs || []);
  };

  const demanderAcces = async () => {
    const motif = motifDemande.trim();
    if (motif.length < 15) {
      setMessage({ type: "erreur", texte: "Le motif doit être explicite — au moins 15 caractères. Le candidat le lit avant de décider." });
      return;
    }
    setEnvoiDemande(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { error } = await supabase.from("document_access_requests").insert({
        admin_id: session.user.id,
        candidate_id: candidatOuvert.id,
        reason: motif,
        status: "pending",
      });
      if (error) throw error;
      setMessage({ type: "succes", texte: "Demande envoyée. Le candidat décide ; l'accès n'est ouvert qu'après son accord." });
      setMotifDemande("");
      await ouvrirCandidat(candidatOuvert);
    } catch (err) {
      setMessage({ type: "erreur", texte: `Envoi impossible : ${err.message}` });
    } finally {
      setEnvoiDemande(false);
    }
  };

  // --- Livraison d'un document au candidat ---------------------------------
  // Deux temps : le fichier part d'abord dans <candidat>/livraisons/ (policy
  // Storage « Un admin depose un document livre »), puis la RPC
  // livrer_document décide seule, selon le quota du candidat, entre un dépôt
  // immédiat et une demande de remplacement. Le client ne tranche jamais :
  // il ne fait qu'afficher ce que la base a décidé.
  const livrerDocument = async () => {
    const fichier = fichierLivraison;
    const titre = titreLivraison.trim();
    if (!fichier) {
      setMessage({ type: "erreur", texte: "Choisissez le fichier à livrer." });
      return;
    }
    if (titre.length < 3) {
      setMessage({ type: "erreur", texte: "Donnez un titre au document — c'est ce que le candidat verra." });
      return;
    }

    setEnvoiLivraison(true);
    try {
      const nomSur = fichier.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const chemin = `${candidatOuvert.id}/livraisons/${Date.now()}-${nomSur}`;

      const { error: erreurDepot } = await supabase.storage
        .from("resumes")
        .upload(chemin, fichier, { upsert: false, contentType: fichier.type || undefined });
      if (erreurDepot) throw erreurDepot;

      const { data, error } = await supabase.rpc("livrer_document", {
        p_candidate_id: candidatOuvert.id,
        p_title: titre,
        p_file_path: chemin,
        p_file_name: fichier.name,
        p_note: noteLivraison.trim() || null,
      });
      if (error) throw error;

      setMessage(
        data?.statut === "delivered"
          ? { type: "succes", texte: "Document déposé. Il apparaît dès maintenant dans l'espace du candidat, qui a été notifié." }
          : {
              type: "succes",
              texte:
                "Espace documentaire du candidat plein. Une demande lui a été envoyée : c'est lui qui choisit quel document céder la place, ou qui refuse. Rien n'est déposé avant sa réponse.",
            }
      );
      setFichierLivraison(null);
      setTitreLivraison("");
      setNoteLivraison("");
      await ouvrirCandidat(candidatOuvert);
    } catch (err) {
      setMessage({ type: "erreur", texte: `Livraison impossible : ${err.message}` });
    } finally {
      setEnvoiLivraison(false);
    }
  };

  // --- Lignes de transport --------------------------------------------------
  //
  // L'ecriture passe par des RPC SECURITY DEFINER, jamais par un INSERT ou un
  // UPDATE direct : l'invariant 1 interdit tout GRANT UPDATE/DELETE a
  // `authenticated`, liste blanche volontairement vide. Le controle du role
  // admin est fait dans la fonction elle-meme, cote base.
  const enregistrerLigne = async () => {
    const l = ligneEditee;
    if (!l?.origine?.trim() || !l?.destination?.trim()) {
      setMessage({ type: "erreur", texte: "Origine et destination sont obligatoires." });
      return;
    }
    setEnregistrementLigne(true);
    try {
      const { error } = await supabase.rpc("enregistrer_ligne_transport", {
        p_id: l.id,
        p_mode: l.mode,
        p_ligne: l.ligne?.trim() || null,
        p_operateur: l.operateur?.trim() || null,
        p_origine: l.origine.trim(),
        p_destination: l.destination.trim(),
        p_arrets: l.arrets || [],
        p_zones: l.zones || [],
        // Champ texte vide -> NULL, jamais 0 : un tarif inconnu et un trajet
        // gratuit ne veulent pas dire la meme chose pour la personne qui lit.
        p_tarif_min: l.tarif_min === "" || l.tarif_min == null ? null : Number(l.tarif_min),
        p_tarif_max: l.tarif_max === "" || l.tarif_max == null ? null : Number(l.tarif_max),
        p_description: l.description?.trim() || null,
        p_actif: l.actif !== false,
      });
      if (error) throw error;
      setMessage({ type: "succes", texte: l.id ? "Ligne mise a jour." : "Ligne ajoutee." });
      setLigneEditee(null);
      await charger();
    } catch (err) {
      setMessage({ type: "erreur", texte: `Enregistrement impossible : ${err.message}` });
    } finally {
      setEnregistrementLigne(false);
    }
  };

  const supprimerLigne = async (ligne) => {
    const nom = [ligne.ligne, `${ligne.origine} vers ${ligne.destination}`].filter(Boolean).join(" — ");
    if (!window.confirm(`Supprimer definitivement la ligne « ${nom} » ? Cette action est irreversible.`)) return;
    try {
      const { error } = await supabase.rpc("supprimer_ligne_transport", { p_id: ligne.id });
      if (error) throw error;
      setMessage({ type: "succes", texte: "Ligne supprimee." });
      if (ligneEditee?.id === ligne.id) setLigneEditee(null);
      await charger();
    } catch (err) {
      setMessage({ type: "erreur", texte: `Suppression impossible : ${err.message}` });
    }
  };

  // --- Rendu ---------------------------------------------------------------
  if (statut === "verification") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F0F2F5]">
        <p className="text-sm font-bold text-gray-500">
          <i className="fa-solid fa-circle-notch fa-spin mr-2"></i>Vérification des droits…
        </p>
      </div>
    );
  }

  if (statut === "refuse") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F0F2F5] p-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 max-w-md text-center">
          <i className="fa-solid fa-lock text-3xl text-gray-400 mb-4"></i>
          <h1 className="text-lg font-black text-gray-900 mb-2">Accès réservé</h1>
          <p className="text-sm text-gray-600 mb-5">La banque d&apos;information est réservée aux administrateurs.</p>
          <Link href="/" className="inline-block bg-[#047857] text-white font-extrabold text-xs px-5 py-2.5 rounded-xl">
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    );
  }

  const nbPages = Math.max(1, Math.ceil(total / PAR_PAGE));

  return (
    <div className="min-h-screen bg-[#F0F2F5] py-6 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">
        <header className="mb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-black text-gray-900">Banque d&apos;information</h1>
              <p className="text-xs text-gray-500 font-medium mt-1">
                Candidats, offres et commandes. Les documents restent soumis à l&apos;accord du candidat.
              </p>
            </div>
            <Link href="/admin" className="text-xs font-extrabold text-[#047857] hover:underline">
              <i className="fa-solid fa-arrow-left mr-1.5"></i>Administration
            </Link>
          </div>
        </header>

        {message && (
          <div
            className={`mb-4 rounded-xl border p-3 text-xs font-bold flex items-start gap-2.5 ${
              message.type === "erreur"
                ? "bg-red-50 border-red-200 text-red-800"
                : "bg-emerald-50 border-emerald-200 text-[#047857]"
            }`}
          >
            <i className={`fa-solid ${message.type === "erreur" ? "fa-triangle-exclamation" : "fa-circle-check"} mt-0.5`}></i>
            <span className="flex-1">{message.texte}</span>
            <button type="button" onClick={() => setMessage(null)} className="opacity-60 hover:opacity-100" aria-label="Fermer">
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="flex flex-wrap items-center gap-1 border-b border-gray-100 px-3 pt-3">
            {ONGLETS.map((o) => (
              <button
                key={o.cle}
                type="button"
                onClick={() => {
                  setOngletActif(o.cle);
                  setPage(0);
                  setCandidatOuvert(null);
                }}
                className={`px-4 py-2.5 rounded-t-xl text-xs font-extrabold transition ${
                  ongletActif === o.cle ? "bg-[#ECFDF5] text-[#047857]" : "text-gray-500 hover:text-gray-800"
                }`}
              >
                <i className={`fa-solid ${o.icone} mr-2`}></i>
                {o.libelle}
              </button>
            ))}
          </div>

          <div className={`p-3 border-b border-gray-100 flex flex-wrap items-center gap-3 ${ongletActif === "banque_cv" ? "hidden" : ""}`}>
            {ongletActif !== "commandes" && ongletActif !== "banque_cv" && (
              <input
                type="search"
                value={recherche}
                onChange={(e) => {
                  setRecherche(e.target.value);
                  setPage(0);
                }}
                placeholder={ongletActif === "candidats" ? "Nom, ville ou e-mail" : "Intitulé ou entreprise"}
                className="flex-1 min-w-[200px] text-xs font-medium border border-gray-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#10E688]"
              />
            )}
            {ongletActif !== "banque_cv" && (
              <span className="text-[11px] font-bold text-gray-400 tabular-nums">
                {chargement ? "chargement…" : `${total} résultat${total > 1 ? "s" : ""}`}
              </span>
            )}
            {ongletActif === "transport" && (
              <button
                type="button"
                onClick={() => setLigneEditee({ ...LIGNE_VIDE })}
                className="ml-auto bg-[#047857] hover:bg-[#036448] text-white font-extrabold text-xs px-3.5 py-2 rounded-xl"
              >
                <i className="fa-solid fa-plus mr-1.5"></i>Nouvelle ligne
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            {ongletActif === "candidats" && (
              <TableCandidats lignes={candidats} onOuvrir={ouvrirCandidat} ouvert={candidatOuvert} />
            )}
            {ongletActif === "offres" && <TableOffres lignes={offres} />}
            {ongletActif === "banque_cv" && <BanqueCvTab />}
            {ongletActif === "commandes" && <TableCommandes lignes={commandes} />}
            {ongletActif === "transport" && (
              <TableTransport
                lignes={lignesTransport}
                onEditer={(l) =>
                  setLigneEditee({
                    ...l,
                    tarif_min: l.tarif_min ?? "",
                    tarif_max: l.tarif_max ?? "",
                    arrets: Array.isArray(l.arrets) ? l.arrets : [],
                    zones: Array.isArray(l.zones) ? l.zones : [],
                  })
                }
                onSupprimer={supprimerLigne}
                editee={ligneEditee}
              />
            )}
          </div>

          {nbPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="text-xs font-extrabold px-3 py-2 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed text-[#047857]"
              >
                <i className="fa-solid fa-chevron-left mr-1.5"></i>Précédent
              </button>
              <span className="text-[11px] font-bold text-gray-400 tabular-nums">
                page {page + 1} sur {nbPages}
              </span>
              <button
                type="button"
                disabled={page + 1 >= nbPages}
                onClick={() => setPage((p) => p + 1)}
                className="text-xs font-extrabold px-3 py-2 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed text-[#047857]"
              >
                Suivant<i className="fa-solid fa-chevron-right ml-1.5"></i>
              </button>
            </div>
          )}
        </div>

        {ongletActif === "transport" && ligneEditee && (
          <FormulaireLigne
            ligne={ligneEditee}
            setLigne={setLigneEditee}
            onEnregistrer={enregistrerLigne}
            enregistrement={enregistrementLigne}
            onFermer={() => setLigneEditee(null)}
          />
        )}

        {candidatOuvert && (
          <FicheCandidat
            candidat={candidatOuvert}
            documents={documentsCandidat}
            demandes={demandesCandidat}
            motif={motifDemande}
            setMotif={setMotifDemande}
            onDemander={demanderAcces}
            livraisons={livraisons}
            fichierLivraison={fichierLivraison}
            setFichierLivraison={setFichierLivraison}
            titreLivraison={titreLivraison}
            setTitreLivraison={setTitreLivraison}
            noteLivraison={noteLivraison}
            setNoteLivraison={setNoteLivraison}
            onLivrer={livrerDocument}
            envoiLivraison={envoiLivraison}
            envoi={envoiDemande}
            onFermer={() => setCandidatOuvert(null)}
          />
        )}
      </div>
    </div>
  );
}

function TableCandidats({ lignes, onOuvrir, ouvert }) {
  if (!lignes.length) {
    return <p className="p-8 text-center text-xs font-bold text-gray-400">Aucun candidat.</p>;
  }
  return (
    <table className="w-full text-left min-w-[720px]">
      <thead>
        <tr className="text-[10px] uppercase tracking-wider text-gray-400 border-b border-gray-100">
          <th className="px-4 py-3 font-bold">Candidat</th>
          <th className="px-4 py-3 font-bold">Ville</th>
          <th className="px-4 py-3 font-bold">Niveau</th>
          <th className="px-4 py-3 font-bold">Complétude</th>
          <th className="px-4 py-3 font-bold">Inscrit</th>
          <th className="px-4 py-3 font-bold"></th>
        </tr>
      </thead>
      <tbody>
        {lignes.map((c) => {
          const completude = calculerCompletude(c);
          return (
            <tr
              key={c.id}
              className={`border-b border-gray-50 text-xs ${ouvert?.id === c.id ? "bg-[#ECFDF5]" : "hover:bg-gray-50"}`}
            >
              <td className="px-4 py-3">
                <p className="font-extrabold text-gray-900">{c.full_name || "(sans nom)"}</p>
                <p className="text-[11px] text-gray-400 font-medium">{c.email}</p>
              </td>
              <td className="px-4 py-3 text-gray-600 font-medium">{c.city || c.country || "—"}</td>
              <td className="px-4 py-3 text-gray-600 font-medium">{c.education_level || "—"}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className={`h-full ${completude >= 70 ? "bg-[#10E688]" : completude >= 40 ? "bg-amber-400" : "bg-gray-300"}`}
                      style={{ width: `${completude}%` }}
                    ></div>
                  </div>
                  <span className="text-[11px] font-bold text-gray-500 tabular-nums">{completude}%</span>
                </div>
              </td>
              <td className="px-4 py-3 text-gray-500 font-medium tabular-nums">
                {c.created_at ? String(c.created_at).slice(0, 10) : "—"}
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  type="button"
                  onClick={() => onOuvrir(c)}
                  className="text-[11px] font-extrabold text-[#047857] hover:underline"
                >
                  Ouvrir
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function TableOffres({ lignes }) {
  if (!lignes.length) {
    return <p className="p-8 text-center text-xs font-bold text-gray-400">Aucune offre.</p>;
  }
  return (
    <table className="w-full text-left min-w-[720px]">
      <thead>
        <tr className="text-[10px] uppercase tracking-wider text-gray-400 border-b border-gray-100">
          <th className="px-4 py-3 font-bold">Offre</th>
          <th className="px-4 py-3 font-bold">Lieu</th>
          <th className="px-4 py-3 font-bold">Statut</th>
          <th className="px-4 py-3 font-bold">Échéance</th>
          <th className="px-4 py-3 font-bold">Vues</th>
        </tr>
      </thead>
      <tbody>
        {lignes.map((o) => {
          const expiree = o.expiree === true;
          return (
            <tr key={o.id} className="border-b border-gray-50 text-xs hover:bg-gray-50">
              <td className="px-4 py-3">
                <p className="font-extrabold text-gray-900">{o.title}</p>
                <p className="text-[11px] text-gray-400 font-medium">{o.company}</p>
              </td>
              <td className="px-4 py-3 text-gray-600 font-medium">{o.location || "—"}</td>
              <td className="px-4 py-3">
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                    o.status === "active" && !expiree
                      ? "bg-emerald-50 text-[#047857] border-emerald-200"
                      : "bg-gray-100 text-gray-500 border-gray-200"
                  }`}
                >
                  {expiree ? "expirée" : o.status || (o.is_active ? "active" : "inactive")}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-500 font-medium tabular-nums">
                {o.deadline ? String(o.deadline).slice(0, 10) : "—"}
              </td>
              <td className="px-4 py-3 text-gray-500 font-medium tabular-nums">{o.view_count ?? 0}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function TableCommandes({ lignes }) {
  if (!lignes.length) {
    return <p className="p-8 text-center text-xs font-bold text-gray-400">Aucune commande.</p>;
  }
  return (
    <table className="w-full text-left min-w-[560px]">
      <thead>
        <tr className="text-[10px] uppercase tracking-wider text-gray-400 border-b border-gray-100">
          <th className="px-4 py-3 font-bold">Date</th>
          <th className="px-4 py-3 font-bold">Montant</th>
          <th className="px-4 py-3 font-bold">Statut</th>
          <th className="px-4 py-3 font-bold">Moyen</th>
        </tr>
      </thead>
      <tbody>
        {lignes.map((o) => (
          <tr key={o.id} className="border-b border-gray-50 text-xs hover:bg-gray-50">
            <td className="px-4 py-3 text-gray-500 font-medium tabular-nums">
              {o.created_at ? String(o.created_at).slice(0, 10) : "—"}
            </td>
            <td className="px-4 py-3 font-extrabold text-gray-900 tabular-nums">
              {o.amount} {o.currency || "XOF"}
            </td>
            <td className="px-4 py-3">
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                  o.payment_status === "paid"
                    ? "bg-emerald-50 text-[#047857] border-emerald-200"
                    : o.payment_status === "failed"
                      ? "bg-red-50 text-red-700 border-red-200"
                      : "bg-gray-100 text-gray-500 border-gray-200"
                }`}
              >
                {o.payment_status}
              </span>
            </td>
            <td className="px-4 py-3 text-gray-600 font-medium">{o.payment_method || "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TableTransport({ lignes, onEditer, onSupprimer, editee }) {
  if (!lignes.length) {
    return (
      <p className="p-8 text-center text-xs font-bold text-gray-400">
        Aucune ligne enregistrée. L&apos;assistant ne proposera aucun itinéraire tant que rien n&apos;est saisi — il ne
        doit jamais en inventer.
      </p>
    );
  }
  return (
    <table className="w-full text-left min-w-[820px]">
      <thead>
        <tr className="text-[10px] uppercase tracking-wider text-gray-400 border-b border-gray-100">
          <th className="px-4 py-3 font-bold">Ligne</th>
          <th className="px-4 py-3 font-bold">Mode</th>
          <th className="px-4 py-3 font-bold">Trajet</th>
          <th className="px-4 py-3 font-bold">Arrêts</th>
          <th className="px-4 py-3 font-bold">Tarif</th>
          <th className="px-4 py-3 font-bold">État</th>
          <th className="px-4 py-3 font-bold"></th>
        </tr>
      </thead>
      <tbody>
        {lignes.map((l) => {
          const arrets = Array.isArray(l.arrets) ? l.arrets : [];
          const geolocalises = arrets.filter((a) => a?.lat != null && a?.lng != null).length;
          return (
            <tr
              key={l.id}
              className={`border-b border-gray-50 text-xs ${editee?.id === l.id ? "bg-[#ECFDF5]" : "hover:bg-gray-50"}`}
            >
              <td className="px-4 py-3">
                <p className="font-extrabold text-gray-900">{l.ligne || "—"}</p>
                <p className="text-[11px] text-gray-400 font-medium">{l.operateur || "opérateur non précisé"}</p>
              </td>
              <td className="px-4 py-3 text-gray-600 font-medium">
                {MODES_TRANSPORT.find((m) => m.cle === l.mode)?.libelle || l.mode}
              </td>
              <td className="px-4 py-3 text-gray-600 font-medium">
                {l.origine} → {l.destination}
              </td>
              <td className="px-4 py-3 text-gray-500 font-medium tabular-nums">
                {arrets.length}
                {/* Un arrêt sans coordonnées est invisible pour la recherche
                    par proximité : le signaler ici évite de croire la ligne
                    exploitable alors qu'elle ne remontera jamais. */}
                {geolocalises < arrets.length && (
                  <span className="ml-1.5 text-[10px] font-black text-amber-700">
                    {arrets.length - geolocalises} sans GPS
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-gray-600 font-medium tabular-nums">
                {l.tarif_min == null && l.tarif_max == null
                  ? "—"
                  : l.tarif_min === l.tarif_max
                    ? `${l.tarif_min} XOF`
                    : `${l.tarif_min ?? "?"}–${l.tarif_max ?? "?"} XOF`}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                    l.actif
                      ? "bg-emerald-50 text-[#047857] border-emerald-200"
                      : "bg-gray-100 text-gray-500 border-gray-200"
                  }`}
                >
                  {l.actif ? "active" : "désactivée"}
                </span>
              </td>
              <td className="px-4 py-3 text-right whitespace-nowrap">
                <button
                  type="button"
                  onClick={() => onEditer(l)}
                  className="text-[11px] font-extrabold text-[#047857] hover:underline"
                >
                  Modifier
                </button>
                <button
                  type="button"
                  onClick={() => onSupprimer(l)}
                  className="ml-3 text-[11px] font-extrabold text-red-600 hover:underline"
                >
                  Supprimer
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function FormulaireLigne({ ligne, setLigne, onEnregistrer, enregistrement, onFermer }) {
  const champ = (cle, valeur) => setLigne({ ...ligne, [cle]: valeur });

  const majArret = (i, cle, valeur) => {
    const arrets = [...(ligne.arrets || [])];
    arrets[i] = { ...arrets[i], [cle]: valeur };
    setLigne({ ...ligne, arrets });
  };

  return (
    <div className="mt-4 bg-white rounded-2xl border border-gray-200 p-5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <h2 className="text-base font-black text-gray-900">
          {ligne.id ? "Modifier la ligne" : "Nouvelle ligne de transport"}
        </h2>
        <button type="button" onClick={onFermer} className="text-gray-400 hover:text-gray-700" aria-label="Fermer">
          <i className="fa-solid fa-xmark text-lg"></i>
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="tr-mode" className="block text-[11px] uppercase tracking-wider font-bold text-gray-400 mb-1">
            Mode
          </label>
          <select
            id="tr-mode"
            value={ligne.mode}
            onChange={(e) => champ("mode", e.target.value)}
            className="w-full text-xs font-medium border border-gray-200 rounded-xl px-3.5 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#10E688]"
          >
            {MODES_TRANSPORT.map((m) => (
              <option key={m.cle} value={m.cle}>
                {m.libelle}
              </option>
            ))}
          </select>
        </div>
        <ChampTexte id="tr-ligne" libelle="Numéro / nom de ligne" valeur={ligne.ligne} onChange={(v) => champ("ligne", v)} placeholder="ex. 12" />
        <ChampTexte id="tr-op" libelle="Opérateur" valeur={ligne.operateur} onChange={(v) => champ("operateur", v)} placeholder="ex. Dakar Dem Dikk" />
        <ChampTexte id="tr-org" libelle="Origine *" valeur={ligne.origine} onChange={(v) => champ("origine", v)} placeholder="ex. Petersen" />
        <ChampTexte id="tr-dest" libelle="Destination *" valeur={ligne.destination} onChange={(v) => champ("destination", v)} placeholder="ex. Diamniadio" />
        <ChampTexte
          id="tr-zones"
          libelle="Zones desservies (séparées par une virgule)"
          valeur={(ligne.zones || []).join(", ")}
          onChange={(v) => champ("zones", v.split(",").map((z) => z.trim()).filter(Boolean))}
          placeholder="Pikine, Guédiawaye"
        />
        <ChampTexte id="tr-tmin" libelle="Tarif minimum (XOF)" valeur={ligne.tarif_min} onChange={(v) => champ("tarif_min", v)} placeholder="laisser vide si inconnu" />
        <ChampTexte id="tr-tmax" libelle="Tarif maximum (XOF)" valeur={ligne.tarif_max} onChange={(v) => champ("tarif_max", v)} placeholder="laisser vide si inconnu" />
      </div>

      <div className="mt-3">
        <label htmlFor="tr-desc" className="block text-[11px] uppercase tracking-wider font-bold text-gray-400 mb-1">
          Description
        </label>
        <textarea
          id="tr-desc"
          value={ligne.description || ""}
          onChange={(e) => champ("description", e.target.value)}
          rows={2}
          placeholder="Fréquence, horaires connus, particularités du trajet."
          className="w-full text-xs font-medium border border-gray-200 rounded-xl px-3.5 py-2.5 resize-y focus:outline-none focus:ring-2 focus:ring-[#10E688]"
        />
      </div>

      <div className="mt-4 border-t border-gray-100 pt-4">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-[11px] uppercase tracking-wider font-bold text-gray-400">Arrêts</h3>
          <button
            type="button"
            onClick={() =>
              setLigne({
                ...ligne,
                arrets: [...(ligne.arrets || []), { nom: "", lat: "", lng: "", ordre: (ligne.arrets || []).length + 1 }],
              })
            }
            className="text-[11px] font-extrabold text-[#047857] hover:underline"
          >
            + Ajouter un arrêt
          </button>
        </div>
        <p className="text-[11px] text-gray-500 font-medium mb-3 leading-relaxed">
          Les coordonnées GPS sont ce qui permet de répondre « quelle ligne part d&apos;où je suis ». Un arrêt sans
          latitude ni longitude reste affiché mais ne sera jamais trouvé par la recherche de proximité.
        </p>

        {(ligne.arrets || []).length === 0 ? (
          <p className="text-xs text-gray-400 font-medium italic">Aucun arrêt saisi.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {(ligne.arrets || []).map((a, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <input
                  type="text"
                  value={a?.nom || ""}
                  onChange={(e) => majArret(i, "nom", e.target.value)}
                  placeholder="Nom de l'arrêt"
                  aria-label={`Nom de l'arrêt ${i + 1}`}
                  className="col-span-5 text-xs font-medium border border-gray-200 rounded-lg px-2.5 py-2"
                />
                <input
                  type="text"
                  inputMode="decimal"
                  value={a?.lat ?? ""}
                  onChange={(e) => majArret(i, "lat", e.target.value)}
                  placeholder="Latitude"
                  aria-label={`Latitude de l'arrêt ${i + 1}`}
                  className="col-span-3 text-xs font-medium border border-gray-200 rounded-lg px-2.5 py-2 tabular-nums"
                />
                <input
                  type="text"
                  inputMode="decimal"
                  value={a?.lng ?? ""}
                  onChange={(e) => majArret(i, "lng", e.target.value)}
                  placeholder="Longitude"
                  aria-label={`Longitude de l'arrêt ${i + 1}`}
                  className="col-span-3 text-xs font-medium border border-gray-200 rounded-lg px-2.5 py-2 tabular-nums"
                />
                <button
                  type="button"
                  onClick={() =>
                    setLigne({ ...ligne, arrets: (ligne.arrets || []).filter((_, j) => j !== i) })
                  }
                  aria-label={`Retirer l'arrêt ${i + 1}`}
                  className="col-span-1 text-gray-400 hover:text-red-600"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4">
        <label className="flex items-center gap-2 text-xs font-bold text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={ligne.actif !== false}
            onChange={(e) => champ("actif", e.target.checked)}
            className="accent-[#10E688]"
          />
          <span>Ligne active (visible des candidats et de l&apos;assistant)</span>
        </label>
        <button
          type="button"
          onClick={onEnregistrer}
          disabled={enregistrement}
          className="ml-auto bg-[#047857] hover:bg-[#036448] disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold text-xs px-4 py-2.5 rounded-xl"
        >
          {enregistrement ? "Enregistrement…" : ligne.id ? "Mettre à jour" : "Ajouter la ligne"}
        </button>
      </div>
    </div>
  );
}

function ChampTexte({ id, libelle, valeur, onChange, placeholder }) {
  return (
    <div>
      <label htmlFor={id} className="block text-[11px] uppercase tracking-wider font-bold text-gray-400 mb-1">
        {libelle}
      </label>
      <input
        id={id}
        type="text"
        value={valeur ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full text-xs font-medium border border-gray-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#10E688]"
      />
    </div>
  );
}

function FicheCandidat({
  candidat, documents, demandes, motif, setMotif, onDemander, envoi, onFermer,
  livraisons, fichierLivraison, setFichierLivraison, titreLivraison, setTitreLivraison,
  noteLivraison, setNoteLivraison, onLivrer, envoiLivraison,
}) {
  const demandeEnCours = demandes.find((d) => d.status === "pending");
  const accesActif = demandes.find((d) => d.acces_actif === true);

  return (
    <div className="mt-4 bg-white rounded-2xl border border-gray-200 p-5">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-base font-black text-gray-900">{candidat.full_name || "(sans nom)"}</h2>
          <p className="text-xs text-gray-500 font-medium">{candidat.email}</p>
        </div>
        <button type="button" onClick={onFermer} className="text-gray-400 hover:text-gray-700" aria-label="Fermer la fiche">
          <i className="fa-solid fa-xmark text-lg"></i>
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 mb-5">
        <Info libelle="Ville" valeur={candidat.city || candidat.country} />
        <Info libelle="Niveau d'études" valeur={candidat.education_level} />
        <Info libelle="Complétude du profil" valeur={`${calculerCompletude(candidat)} %`} />
        <Info libelle="Profil public" valeur={candidat.is_public ? "oui" : "non"} />
        <Info libelle="Inscrit le" valeur={candidat.created_at ? String(candidat.created_at).slice(0, 10) : null} />
      </div>

      <h3 className="text-[11px] uppercase tracking-wider font-bold text-gray-400 mb-2">Documents</h3>

      {documents.length > 0 ? (
        <ul className="flex flex-col gap-2 mb-4">
          {documents.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 border border-gray-100 rounded-xl px-3.5 py-2.5">
              <div>
                <p className="text-xs font-extrabold text-gray-900">{d.title}</p>
                <p className="text-[11px] text-gray-400 font-medium">
                  {d.type || "document"} · mis à jour le {String(d.updated_at || d.created_at).slice(0, 10)}
                </p>
              </div>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-50 text-[#047857] border border-emerald-200">
                accès accordé
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mb-4 rounded-xl bg-gray-50 border border-gray-200 p-4">
          <p className="text-xs font-bold text-gray-700 mb-1">
            <i className="fa-solid fa-lock mr-2 text-gray-400"></i>Aucun document consultable
          </p>
          <p className="text-[11px] text-gray-500 font-medium leading-relaxed">
            Soit ce candidat n&apos;a déposé aucun document, soit il n&apos;a pas accordé l&apos;accès. Les deux cas sont
            volontairement indiscernables : l&apos;absence d&apos;autorisation ne doit rien révéler.
          </p>
        </div>
      )}

      {accesActif ? (
        <p className="text-[11px] font-bold text-[#047857]">
          <i className="fa-solid fa-circle-check mr-1.5"></i>
          Accès accordé jusqu&apos;au {String(accesActif.expires_at).slice(0, 10)}.
        </p>
      ) : demandeEnCours ? (
        <p className="text-[11px] font-bold text-amber-700">
          <i className="fa-solid fa-hourglass-half mr-1.5"></i>
          Demande envoyée le {String(demandeEnCours.created_at).slice(0, 10)}, en attente de la réponse du candidat.
        </p>
      ) : (
        <div className="border-t border-gray-100 pt-4">
          <label htmlFor="motif-acces" className="block text-[11px] uppercase tracking-wider font-bold text-gray-400 mb-2">
            Demander l&apos;accès — motif lu par le candidat
          </label>
          <textarea
            id="motif-acces"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            rows={2}
            placeholder="Expliquez pourquoi vous avez besoin de consulter ces documents."
            className="w-full text-xs font-medium border border-gray-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#10E688] resize-y"
          />
          <button
            type="button"
            onClick={onDemander}
            disabled={envoi}
            className="mt-2.5 bg-[#047857] hover:bg-[#036448] disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold text-xs px-4 py-2.5 rounded-xl"
          >
            {envoi ? "Envoi…" : "Envoyer la demande"}
          </button>
        </div>
      )}

      {/* Livraison — indépendante du consentement de lecture : déposer un
          document chez quelqu'un ne suppose pas d'avoir le droit de lire les
          siens. Les deux blocs ne se conditionnent donc pas l'un l'autre. */}
      <div className="border-t border-gray-100 mt-5 pt-4">
        <h3 className="text-[11px] uppercase tracking-wider font-bold text-gray-400 mb-1">Livrer un document</h3>
        <p className="text-[11px] text-gray-500 font-medium mb-3 leading-relaxed">
          Le fichier est déposé dans l&apos;espace de ce candidat. S&apos;il a déjà 5 documents importés, il n&apos;est
          rien déposé : une demande lui est envoyée pour qu&apos;il choisisse lui-même quel document céder la place.
        </p>

        <div className="flex flex-col gap-2.5">
          <input
            id="livraison-titre"
            type="text"
            value={titreLivraison}
            onChange={(e) => setTitreLivraison(e.target.value)}
            placeholder="Titre visible par le candidat — ex. « CV rédigé par Facilité »"
            className="w-full text-xs font-medium border border-gray-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#10E688]"
          />
          <input
            id="livraison-fichier"
            type="file"
            accept=".pdf,.doc,.docx"
            onChange={(e) => setFichierLivraison(e.target.files?.[0] || null)}
            className="w-full text-xs font-medium text-gray-600 file:mr-3 file:py-2 file:px-3.5 file:rounded-lg file:border-0 file:text-xs file:font-extrabold file:bg-[#ECFDF5] file:text-[#047857] hover:file:bg-emerald-100"
          />
          <textarea
            id="livraison-note"
            value={noteLivraison}
            onChange={(e) => setNoteLivraison(e.target.value)}
            rows={2}
            placeholder="Note pour le candidat (facultatif)"
            className="w-full text-xs font-medium border border-gray-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#10E688] resize-y"
          />
          <button
            type="button"
            onClick={onLivrer}
            disabled={envoiLivraison}
            className="self-start bg-[#10E688] hover:bg-[#0ed37c] disabled:opacity-50 disabled:cursor-not-allowed text-gray-950 font-extrabold text-xs px-4 py-2.5 rounded-xl"
          >
            <i className="fa-solid fa-paper-plane mr-2"></i>
            {envoiLivraison ? "Envoi…" : "Livrer le document"}
          </button>
        </div>

        {livraisons.length > 0 && (
          <>
            <h3 className="text-[11px] uppercase tracking-wider font-bold text-gray-400 mt-5 mb-2">
              Historique des livraisons
            </h3>
            <ul className="flex flex-col gap-2">
              {livraisons.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 border border-gray-100 rounded-xl px-3.5 py-2.5">
                  <div>
                    <p className="text-xs font-extrabold text-gray-900">{l.title}</p>
                    <p className="text-[11px] text-gray-400 font-medium">
                      livré le {String(l.created_at).slice(0, 10)}
                      {l.decided_at ? ` · réponse le ${String(l.decided_at).slice(0, 10)}` : ""}
                    </p>
                  </div>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${ETIQUETTES_LIVRAISON[l.status].classe}`}>
                    {ETIQUETTES_LIVRAISON[l.status].texte}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

function Info({ libelle, valeur }) {
  return (
    <div className="rounded-xl bg-gray-50 border border-gray-100 px-3.5 py-2.5">
      <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">{libelle}</p>
      <p className="text-xs font-extrabold text-gray-900 mt-0.5">{valeur || "—"}</p>
    </div>
  );
}

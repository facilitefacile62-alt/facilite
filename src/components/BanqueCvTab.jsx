"use client";

// Onglet « Banque de CV » — /admin/banque-donnees.
//
// Distinct de l'onglet « Candidats » : ici, l'admin importe des CV obtenus
// par d'autres canaux (recommandation, salon de l'emploi...), sans compte
// candidat associé. Toute la lecture et l'écriture passent par
// /api/admin/banque-cv/* — banque_cv n'accorde rien au client du navigateur,
// même admin (voir la doctrine en tête de page.js et
// 20260903120000_banque_cv.sql). Ce composant ne fait jamais
// supabase.from("banque_cv"), volontairement : ça échouerait de toute façon,
// et l'écrire laisserait croire qu'un accès direct existe.
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

const CATEGORIES = [
  { id: "informatique_numerique", label: "Informatique & Numérique" },
  { id: "comptabilite_finance", label: "Comptabilité & Finance" },
  { id: "commerce_vente", label: "Commerce & Vente" },
  { id: "marketing_communication", label: "Marketing & Communication" },
  { id: "rh_administration", label: "RH & Administration" },
  { id: "btp_ingenierie", label: "BTP & Ingénierie" },
  { id: "sante", label: "Santé" },
  { id: "education_formation", label: "Éducation & Formation" },
  { id: "logistique_transport", label: "Logistique & Transport" },
  { id: "juridique", label: "Juridique" },
  { id: "hotellerie_restauration", label: "Hôtellerie & Restauration" },
  { id: "agriculture_environnement", label: "Agriculture & Environnement" },
  { id: "artisanat_metiers_manuels", label: "Artisanat & Métiers manuels" },
  { id: "autre", label: "Autre" },
];
const LIBELLE_CATEGORIE = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.label]));

const COULEUR_VERDICT = {
  "Excellente adéquation": "bg-emerald-100 text-emerald-800 border-emerald-200",
  "Forte adéquation": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Adéquation modérée": "bg-amber-50 text-amber-800 border-amber-200",
  "Adéquation partielle": "bg-gray-100 text-gray-600 border-gray-200",
};

// Une couleur par secteur : badge de la carte ET fond de la vignette de
// repli (CV sans aperçu généré — DOCX, ou rendu PDF ayant échoué à
// l'import). "degrade" sert uniquement à cette vignette de repli.
const COULEUR_CATEGORIE = {
  informatique_numerique: { badge: "bg-indigo-100 text-indigo-800 border-indigo-200", degrade: "from-indigo-500 to-indigo-700" },
  comptabilite_finance: { badge: "bg-emerald-100 text-emerald-800 border-emerald-200", degrade: "from-emerald-500 to-emerald-700" },
  commerce_vente: { badge: "bg-orange-100 text-orange-800 border-orange-200", degrade: "from-orange-500 to-orange-700" },
  marketing_communication: { badge: "bg-pink-100 text-pink-800 border-pink-200", degrade: "from-pink-500 to-pink-700" },
  rh_administration: { badge: "bg-purple-100 text-purple-800 border-purple-200", degrade: "from-purple-500 to-purple-700" },
  btp_ingenierie: { badge: "bg-amber-100 text-amber-800 border-amber-200", degrade: "from-amber-500 to-amber-700" },
  sante: { badge: "bg-rose-100 text-rose-800 border-rose-200", degrade: "from-rose-500 to-rose-700" },
  education_formation: { badge: "bg-sky-100 text-sky-800 border-sky-200", degrade: "from-sky-500 to-sky-700" },
  logistique_transport: { badge: "bg-teal-100 text-teal-800 border-teal-200", degrade: "from-teal-500 to-teal-700" },
  juridique: { badge: "bg-slate-100 text-slate-800 border-slate-200", degrade: "from-slate-500 to-slate-700" },
  hotellerie_restauration: { badge: "bg-yellow-100 text-yellow-800 border-yellow-200", degrade: "from-yellow-500 to-yellow-600" },
  agriculture_environnement: { badge: "bg-lime-100 text-lime-800 border-lime-200", degrade: "from-lime-600 to-lime-800" },
  artisanat_metiers_manuels: { badge: "bg-stone-100 text-stone-800 border-stone-200", degrade: "from-stone-500 to-stone-700" },
  autre: { badge: "bg-gray-100 text-gray-600 border-gray-200", degrade: "from-gray-400 to-gray-600" },
};
const COULEUR_CATEGORIE_DEFAUT = { badge: "bg-gray-100 text-gray-600 border-gray-200", degrade: "from-gray-400 to-gray-600" };

function initialesDe(nom) {
  const mots = (nom || "").trim().split(/\s+/).filter(Boolean);
  if (mots.length === 0) return "?";
  if (mots.length === 1) return mots[0].slice(0, 2).toUpperCase();
  return (mots[0][0] + mots[mots.length - 1][0]).toUpperCase();
}

async function jeton() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || null;
}

export default function BanqueCvTab() {
  // --- Référentiel des niveaux d'étude, pour l'affichage (lecture publique
  // par policy — indépendant du verrou de banque_cv). ---
  const [libellesNiveaux, setLibellesNiveaux] = useState({});
  useEffect(() => {
    supabase
      .from("niveaux_etudes")
      .select("code, libelle")
      .then(({ data }) => {
        if (data) setLibellesNiveaux(Object.fromEntries(data.map((n) => [n.code, n.libelle])));
      });
  }, []);

  // --- Recherche du candidat idéal ---
  const [poste, setPoste] = useState("");
  const [categorieRecherche, setCategorieRecherche] = useState("");
  const [rechercheEnCours, setRechercheEnCours] = useState(false);
  const [resultats, setResultats] = useState(null);
  const [erreurRecherche, setErreurRecherche] = useState("");

  const rechercher = async (e) => {
    e.preventDefault();
    if (poste.trim().length < 2) return;
    setRechercheEnCours(true);
    setErreurRecherche("");
    setResultats(null);
    try {
      const token = await jeton();
      const res = await fetch("/api/admin/banque-cv/rechercher", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ poste: poste.trim(), categorie: categorieRecherche || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Recherche impossible.");
      setResultats(data.candidats || []);
    } catch (err) {
      setErreurRecherche(err.message);
    } finally {
      setRechercheEnCours(false);
    }
  };

  // --- Import (un seul, ou groupé — les deux appellent la même route) ---
  const [modeImport, setModeImport] = useState("un"); // "un" | "plusieurs"
  const [fichierCv, setFichierCv] = useState(null);
  const [fichierLettre, setFichierLettre] = useState(null);
  const [nomSaisi, setNomSaisi] = useState("");
  const [importEnCours, setImportEnCours] = useState(false);
  const [messageImport, setMessageImport] = useState(null); // { type: 'ok'|'erreur', texte }
  const champCv = useRef(null);
  const champLettre = useRef(null);

  /**
   * Un seul appel réseau, réutilisé par l'import simple et par l'import
   * groupé : c'est la MÊME route, avec la MÊME analyse, quel que soit le
   * nombre de fichiers déposés en une fois.
   */
  const importerUnFichier = async (fichier, nom) => {
    const token = await jeton();
    const form = new FormData();
    form.append("cv", fichier);
    if (nom?.trim()) form.append("nom", nom.trim());
    const res = await fetch("/api/admin/banque-cv/importer", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Import impossible.");
    return data.cv;
  };

  const importer = async (e) => {
    e.preventDefault();
    if (!fichierCv) return;
    setImportEnCours(true);
    setMessageImport(null);
    try {
      const token = await jeton();
      const form = new FormData();
      form.append("cv", fichierCv);
      if (fichierLettre) form.append("lettre", fichierLettre);
      if (nomSaisi.trim()) form.append("nom", nomSaisi.trim());

      const res = await fetch("/api/admin/banque-cv/importer", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import impossible.");

      if (data.cv.statut === "erreur") {
        setMessageImport({
          type: "erreur",
          texte: `CV enregistré, mais l'analyse a échoué : ${data.cv.erreur_analyse || "erreur inconnue"}. Le fichier reste consultable.`,
        });
      } else {
        setMessageImport({
          type: "ok",
          texte: `« ${data.cv.nom_complet || "CV"} » importé et classé en ${LIBELLE_CATEGORIE[data.cv.categorie] || data.cv.categorie}.`,
        });
      }

      setFichierCv(null);
      setFichierLettre(null);
      setNomSaisi("");
      if (champCv.current) champCv.current.value = "";
      if (champLettre.current) champLettre.current.value = "";
      chargerPage(0, { remplacer: true });
    } catch (err) {
      setMessageImport({ type: "erreur", texte: err.message });
    } finally {
      setImportEnCours(false);
    }
  };

  // --- Import groupé ---
  //
  // Un fichier à la fois, séquentiellement — pas en parallèle. Deux raisons :
  // chaque import prend déjà 5 à 15 s (extraction + Gemini + embedding), et
  // envoyer 40 requêtes à la fois saturerait le quota IA dédié et le rate
  // limit de la route en quelques secondes au lieu de les répartir sur toute
  // la session. Sans lettre de motivation : deviner quel fichier va avec quel
  // CV par similarité de nom serait le genre d'invention que ce projet
  // refuse ailleurs — qui veut associer une lettre le fait un CV à la fois,
  // dans le formulaire simple.
  const [fichiersGroupe, setFichiersGroupe] = useState([]); // File[]
  const [etatsGroupe, setEtatsGroupe] = useState([]); // { nom, statut: 'attente'|'analyse'|'ok'|'erreur', message }
  const [groupeEnCours, setGroupeEnCours] = useState(false);
  const champGroupe = useRef(null);

  const choisirFichiersGroupe = (e) => {
    const fichiers = Array.from(e.target.files || []);
    if (champGroupe.current) champGroupe.current.value = "";
    setFichiersGroupe(fichiers);
    setEtatsGroupe(fichiers.map((f) => ({ nom: f.name, statut: "attente", message: "" })));
  };

  const lancerImportGroupe = async () => {
    if (fichiersGroupe.length === 0) return;
    setGroupeEnCours(true);
    // Drapeau LOCAL, pas relu depuis l'état React : setEtatsGroupe est
    // asynchrone, le lire juste après l'avoir appelé renverrait encore
    // l'ancienne valeur dans la même itération.
    let quotaAtteint = false;
    for (let i = 0; i < fichiersGroupe.length && !quotaAtteint; i++) {
      setEtatsGroupe((prev) => prev.map((e, idx) => (idx === i ? { ...e, statut: "analyse" } : e)));
      try {
        const cv = await importerUnFichier(fichiersGroupe[i], null);
        setEtatsGroupe((prev) =>
          prev.map((e, idx) =>
            idx === i
              ? {
                  ...e,
                  statut: cv.statut === "erreur" ? "erreur" : "ok",
                  message:
                    cv.statut === "erreur"
                      ? cv.erreur_analyse || "Analyse échouée, fichier conservé."
                      : `${cv.nom_complet || "Sans nom"} — ${LIBELLE_CATEGORIE[cv.categorie] || cv.categorie}`,
                }
              : e
          )
        );
      } catch (err) {
        // Un CV en moins ne doit jamais bloquer les suivants — sauf le quota
        // épuisé : dans ce cas précis, continuer enverrait N requêtes pour
        // rien, chacune refusée avec le même message.
        if (/quota/i.test(err.message)) quotaAtteint = true;
        setEtatsGroupe((prev) => prev.map((e, idx) => (idx === i ? { ...e, statut: "erreur", message: err.message } : e)));
      }
    }
    setGroupeEnCours(false);
    chargerPage(0, { remplacer: true });
  };

  // --- Liste des CV déjà importés — défilement continu (accumulation des
  // pages de 24 chargées au fur et à mesure), pas de clic "page suivante".
  // `liste` grandit au fil du scroll ; un changement de recherche/catégorie
  // repart de zéro (vidée puis rechargée), jamais un ajout au résultat
  // précédent.
  const [liste, setListe] = useState([]);
  const [totalListe, setTotalListe] = useState(0);
  const [pageChargee, setPageChargee] = useState(-1); // dernière page effectivement reçue
  const [categorieListe, setCategorieListe] = useState("");
  const [rechercheNomSaisie, setRechercheNomSaisie] = useState("");
  const [rechercheNomListe, setRechercheNomListe] = useState("");
  const [chargementListe, setChargementListe] = useState(true); // premier chargement / changement de filtre
  const [chargementPageSuivante, setChargementPageSuivante] = useState(false);
  const [suppressionEnCours, setSuppressionEnCours] = useState(null);
  const sentinelleRef = useRef(null);

  // Débounce : un appel réseau par pause de frappe, pas un par lettre tapée.
  useEffect(() => {
    const delai = setTimeout(() => setRechercheNomListe(rechercheNomSaisie), 350);
    return () => clearTimeout(delai);
  }, [rechercheNomSaisie]);

  const chargerPage = useCallback(
    async (page, { remplacer }) => {
      if (remplacer) setChargementListe(true);
      else setChargementPageSuivante(true);
      try {
        const token = await jeton();
        const params = new URLSearchParams({ page: String(page) });
        if (categorieListe) params.set("categorie", categorieListe);
        if (rechercheNomListe.trim()) params.set("q", rechercheNomListe.trim());
        const res = await fetch(`/api/admin/banque-cv?${params}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await res.json();
        if (res.ok) {
          setListe((prev) => (remplacer ? data.cvs || [] : [...prev, ...(data.cvs || [])]));
          setTotalListe(data.total || 0);
          setPageChargee(page);
        }
      } finally {
        setChargementListe(false);
        setChargementPageSuivante(false);
      }
    },
    [categorieListe, rechercheNomListe]
  );

  // Filtre changé (catégorie ou recherche) : on repart de la page 0, jamais
  // un ajout à l'ancien résultat.
  useEffect(() => {
    chargerPage(0, { remplacer: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chargerPage change déjà avec categorieListe/rechercheNomListe, le déclaration ici suffit
  }, [categorieListe, rechercheNomListe]);

  const encoreDesPages = liste.length < totalListe;

  // Défilement continu : une sentinelle invisible en bas de la grille charge
  // la page suivante dès qu'elle entre dans le viewport — pas de bouton ni
  // de clic requis, juste continuer à descendre dans la page.
  useEffect(() => {
    const cible = sentinelleRef.current;
    if (!cible) return;
    const observateur = new IntersectionObserver(
      (entrees) => {
        if (entrees[0].isIntersecting && encoreDesPages && !chargementListe && !chargementPageSuivante) {
          chargerPage(pageChargee + 1, { remplacer: false });
        }
      },
      { rootMargin: "600px" } // déclenche avant que la sentinelle soit réellement visible, pour un chargement fluide
    );
    observateur.observe(cible);
    return () => observateur.disconnect();
  }, [encoreDesPages, chargementListe, chargementPageSuivante, pageChargee, chargerPage]);

  const supprimer = async (id) => {
    setSuppressionEnCours(id);
    try {
      const token = await jeton();
      const res = await fetch(`/api/admin/banque-cv?id=${id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        // Retrait local plutôt qu'un rechargement complet : avec le
        // défilement continu, recharger depuis la page 0 ferait perdre tout
        // ce qui a déjà été accumulé par le scroll.
        setListe((prev) => prev.filter((c) => c.id !== id));
        setTotalListe((prev) => Math.max(0, prev - 1));
      }
    } finally {
      setSuppressionEnCours(null);
    }
  };

  // --- Détail d'un CV, avec accès au fichier d'origine ---
  //
  // La liste n'affiche qu'un résumé tronqué (line-clamp-2) : pour juger un
  // profil, l'admin doit pouvoir lire l'analyse complète ET rouvrir le
  // document tel qu'il a été déposé — l'IA peut se tromper, le fichier
  // original reste la référence.
  const [detail, setDetail] = useState(null); // { ...cv, urlCv, urlLettre }
  const [detailChargement, setDetailChargement] = useState(false);
  const [detailErreur, setDetailErreur] = useState("");

  const ouvrirDetail = async (id) => {
    setDetail({ id }); // ouvre immédiatement le panneau, avec un état de chargement
    setDetailChargement(true);
    setDetailErreur("");
    try {
      const token = await jeton();
      const res = await fetch(`/api/admin/banque-cv/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Chargement impossible.");
      setDetail(data.cv);
    } catch (err) {
      setDetailErreur(err.message);
    } finally {
      setDetailChargement(false);
    }
  };

  return (
    <div className="p-4 space-y-6">
      {/* --- Recherche --- */}
      <section className="bg-gray-50 rounded-2xl border border-gray-200 p-4">
        <h3 className="text-sm font-black text-gray-900 mb-1">Trouver le candidat idéal</h3>
        <p className="text-[11px] text-gray-500 mb-3">
          Tapez un intitulé de poste : la recherche compare le sens du poste au parcours réel de
          chaque CV de la banque, puis explique le classement.
        </p>
        <form onSubmit={rechercher} className="flex flex-wrap gap-2">
          <input
            type="text"
            value={poste}
            onChange={(e) => setPoste(e.target.value)}
            placeholder="Ex. Comptable senior avec expérience en audit"
            className="flex-1 min-w-[240px] text-xs font-medium border border-gray-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#10E688]"
          />
          <select
            value={categorieRecherche}
            onChange={(e) => setCategorieRecherche(e.target.value)}
            className="text-xs font-bold border border-gray-200 rounded-xl px-3 py-2.5 cursor-pointer"
          >
            <option value="">Toutes catégories</option>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
          <button
            type="submit"
            disabled={rechercheEnCours || poste.trim().length < 2}
            className="bg-[#047857] hover:bg-[#036448] disabled:opacity-50 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl cursor-pointer"
          >
            {rechercheEnCours ? (
              <><i className="fa-solid fa-spinner fa-spin mr-1.5"></i>Analyse…</>
            ) : (
              <><i className="fa-solid fa-magnifying-glass mr-1.5"></i>Chercher</>
            )}
          </button>
        </form>

        {erreurRecherche && (
          <p className="text-[11px] font-bold text-red-600 mt-3">{erreurRecherche}</p>
        )}

        {resultats && resultats.length === 0 && !erreurRecherche && (
          <p className="text-[11px] text-gray-500 mt-3">Aucun CV de la banque ne correspond à ce poste pour l&apos;instant.</p>
        )}

        {resultats && resultats.length > 0 && (
          <ul className="mt-4 space-y-3">
            {resultats.map((r, i) => (
              <li key={r.id} className="bg-white rounded-xl border border-gray-200 p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {i === 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-[#047857] text-white text-[9px] font-black uppercase">
                          Candidat idéal
                        </span>
                      )}
                      <span className="text-sm font-black text-gray-900 truncate">
                        {r.nomComplet || "Nom non renseigné"}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full border text-[9px] font-black ${COULEUR_VERDICT[r.diagnostic.verdict] || "bg-gray-100 text-gray-600 border-gray-200"}`}>
                        {r.diagnostic.verdict}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {LIBELLE_CATEGORIE[r.categorie] || r.categorie || "Non catégorisé"}
                      {r.niveauEtudeCode ? ` · ${libellesNiveaux[r.niveauEtudeCode] || r.niveauEtudeCode}` : ""}
                      {r.anneesExperience != null ? ` · ${r.anneesExperience} an${r.anneesExperience > 1 ? "s" : ""} d'expérience` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-lg font-black text-[#047857] tabular-nums">{r.diagnostic.score}%</span>
                </div>

                <p className="text-xs text-gray-700 mt-2 leading-relaxed">{r.diagnostic.texte}</p>

                {r.pointsForts.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {r.pointsForts.map((pf, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                        {pf}
                      </span>
                    ))}
                  </div>
                )}
                {r.diagnostic.pointsAVerifier.length > 0 && (
                  <p className="text-[11px] text-amber-700 mt-2">
                    <i className="fa-solid fa-circle-question mr-1"></i>
                    À vérifier : {r.diagnostic.pointsAVerifier.join(" · ")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* --- Import --- */}
      <section className="bg-gray-50 rounded-2xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-black text-gray-900">Importer des CV</h3>
          <div className="flex gap-1 bg-white rounded-lg border border-gray-200 p-0.5">
            <button
              type="button"
              onClick={() => setModeImport("un")}
              className={`text-[11px] font-bold px-2.5 py-1 rounded-md cursor-pointer ${modeImport === "un" ? "bg-gray-900 text-white" : "text-gray-500"}`}
            >
              Un CV
            </button>
            <button
              type="button"
              onClick={() => setModeImport("plusieurs")}
              className={`text-[11px] font-bold px-2.5 py-1 rounded-md cursor-pointer ${modeImport === "plusieurs" ? "bg-gray-900 text-white" : "text-gray-500"}`}
            >
              Plusieurs CV
            </button>
          </div>
        </div>
        <p className="text-[11px] text-gray-500 mb-3">
          L&apos;analyse prend quelques secondes par CV : le classement en catégorie s&apos;appuie
          sur le texte réel, jamais sur son seul nom de fichier.
        </p>

        {modeImport === "un" ? (
        <>
        <form onSubmit={importer} className="space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <label className="flex items-center gap-2 text-xs font-bold text-gray-700 border border-gray-200 rounded-xl px-3.5 py-2.5 cursor-pointer bg-white">
              <i className="fa-solid fa-file-pdf text-gray-400"></i>
              <span className="truncate">{fichierCv ? fichierCv.name : "CV (PDF, DOCX ou image) *"}</span>
              <input
                ref={champCv}
                type="file"
                accept=".pdf,.docx,image/*"
                required
                onChange={(e) => setFichierCv(e.target.files?.[0] || null)}
                className="hidden"
              />
            </label>
            <label className="flex items-center gap-2 text-xs font-bold text-gray-700 border border-gray-200 rounded-xl px-3.5 py-2.5 cursor-pointer bg-white">
              <i className="fa-solid fa-envelope-open-text text-gray-400"></i>
              <span className="truncate">{fichierLettre ? fichierLettre.name : "Lettre de motivation (facultatif)"}</span>
              <input
                ref={champLettre}
                type="file"
                accept=".pdf,.docx,image/*"
                onChange={(e) => setFichierLettre(e.target.files?.[0] || null)}
                className="hidden"
              />
            </label>
          </div>
          <input
            type="text"
            value={nomSaisi}
            onChange={(e) => setNomSaisi(e.target.value)}
            placeholder="Nom du candidat (facultatif — deviné depuis le CV si vide)"
            className="w-full text-xs font-medium border border-gray-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#10E688]"
          />
          <button
            type="submit"
            disabled={!fichierCv || importEnCours}
            className="bg-gray-900 hover:bg-black disabled:opacity-50 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl cursor-pointer"
          >
            {importEnCours ? (
              <><i className="fa-solid fa-spinner fa-spin mr-1.5"></i>Analyse en cours, quelques secondes…</>
            ) : (
              <><i className="fa-solid fa-upload mr-1.5"></i>Importer et analyser</>
            )}
          </button>
        </form>

        {messageImport && (
          <p className={`text-[11px] font-bold mt-3 ${messageImport.type === "ok" ? "text-emerald-700" : "text-red-600"}`}>
            {messageImport.texte}
          </p>
        )}
        </>
        ) : (
        <div className="space-y-2.5">
          <label className="flex items-center gap-2 text-xs font-bold text-gray-700 border border-dashed border-gray-300 rounded-xl px-3.5 py-4 cursor-pointer bg-white justify-center">
            <i className="fa-solid fa-folder-open text-gray-400"></i>
            <span>
              {fichiersGroupe.length > 0
                ? `${fichiersGroupe.length} fichier${fichiersGroupe.length > 1 ? "s" : ""} sélectionné${fichiersGroupe.length > 1 ? "s" : ""}`
                : "Sélectionner plusieurs CV (PDF, DOCX ou image)"}
            </span>
            <input
              ref={champGroupe}
              type="file"
              accept=".pdf,.docx,image/*"
              multiple
              onChange={choisirFichiersGroupe}
              className="hidden"
            />
          </label>
          <p className="text-[11px] text-gray-400">
            Un fichier à la fois, dans l&apos;ordre. Sans lettre de motivation associée — pour en
            joindre une à un CV précis, utilisez « Un CV ».
          </p>

          {etatsGroupe.length > 0 && (
            <ul className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden bg-white max-h-64 overflow-y-auto">
              {etatsGroupe.map((e, idx) => (
                <li key={idx} className="px-3 py-2 flex items-center gap-2.5">
                  <span className="shrink-0 w-4 text-center">
                    {e.statut === "attente" && <i className="fa-regular fa-circle text-gray-300 text-[10px]"></i>}
                    {e.statut === "analyse" && <i className="fa-solid fa-spinner fa-spin text-[#1877F2] text-[10px]"></i>}
                    {e.statut === "ok" && <i className="fa-solid fa-circle-check text-emerald-600 text-[10px]"></i>}
                    {e.statut === "erreur" && <i className="fa-solid fa-circle-exclamation text-red-600 text-[10px]"></i>}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold text-gray-800 truncate">{e.nom}</p>
                    {e.message && (
                      <p className={`text-[10px] truncate ${e.statut === "erreur" ? "text-red-600" : "text-gray-500"}`}>
                        {e.message}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={lancerImportGroupe}
            disabled={fichiersGroupe.length === 0 || groupeEnCours}
            className="bg-gray-900 hover:bg-black disabled:opacity-50 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl cursor-pointer"
          >
            {groupeEnCours ? (
              <>
                <i className="fa-solid fa-spinner fa-spin mr-1.5"></i>
                Import {etatsGroupe.filter((e) => e.statut === "ok" || e.statut === "erreur").length}/{etatsGroupe.length}…
              </>
            ) : (
              <><i className="fa-solid fa-upload mr-1.5"></i>Importer {fichiersGroupe.length || ""} CV</>
            )}
          </button>
        </div>
        )}
      </section>

      {/* --- Galerie --- */}
      <section>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <h3 className="text-sm font-black text-gray-900">
            Contenu de la banque <span className="text-gray-400 font-bold">({totalListe})</span>
          </h3>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="relative">
              <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-[11px] text-gray-400"></i>
              <input
                type="text"
                value={rechercheNomSaisie}
                onChange={(e) => setRechercheNomSaisie(e.target.value)}
                placeholder="Chercher un nom…"
                className="text-xs font-medium bg-white border border-gray-200 rounded-full pl-9 pr-4 py-2.5 w-44 focus:outline-none focus:ring-2 focus:ring-[#10E688] shadow-xs"
              />
            </div>
            <select
              value={categorieListe}
              onChange={(e) => setCategorieListe(e.target.value)}
              className="text-xs font-bold bg-white border border-gray-200 rounded-full px-4 py-2.5 cursor-pointer shadow-xs"
            >
              <option value="">Toutes catégories</option>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>

        {chargementListe ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-gray-200 bg-gray-50 animate-pulse aspect-[3/4]" />
            ))}
          </div>
        ) : liste.length === 0 ? (
          <p className="text-[11px] text-gray-500">Aucun CV importé pour l&apos;instant.</p>
        ) : (
          <>
            {/* Une seule grille continue, sans en-tête de section par
                catégorie : un regroupement par catégorie laissait des
                rangées incomplètes (une catégorie avec peu de CV ne remplit
                jamais toute la largeur) — la catégorie de chaque CV reste
                visible via son badge sur la carte. */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {liste.map((c) => (
                <CarteCv
                  key={c.id}
                  cv={c}
                  onOuvrir={() => ouvrirDetail(c.id)}
                  onSupprimer={() => supprimer(c.id)}
                  suppressionEnCours={suppressionEnCours === c.id}
                />
              ))}
            </div>

            {/* Sentinelle de défilement continu : pas de bouton "page
                suivante", la page suivante charge d'elle-même en descendant. */}
            <div ref={sentinelleRef} className="h-1" />
            {chargementPageSuivante && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 mt-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="rounded-2xl border border-gray-200 bg-gray-50 animate-pulse aspect-[3/4]" />
                ))}
              </div>
            )}
            {!encoreDesPages && (
              <p className="text-center text-[11px] text-gray-400 mt-6">
                {totalListe} CV{totalListe > 1 ? "s" : ""} — fin de la liste.
              </p>
            )}
          </>
        )}
      </section>

      {detail && (
        <PanneauDetailCv
          detail={detail}
          chargement={detailChargement}
          erreur={detailErreur}
          libellesNiveaux={libellesNiveaux}
          onFermer={() => setDetail(null)}
        />
      )}
    </div>
  );
}

/**
 * Carte visuelle d'un CV — aperçu en haut (vraie vignette de la 1ère page
 * si générée à l'import, sinon un visuel de repli propre : dégradé coloré
 * par secteur + initiales, jamais un simple fichier/icône générique). Toute
 * la carte ouvre le détail, sauf le bouton supprimer (stopPropagation) qui
 * reste dans son coin plutôt que superposé sur toute la zone cliquable.
 */
function CarteCv({ cv, onOuvrir, onSupprimer, suppressionEnCours }) {
  const couleur = COULEUR_CATEGORIE[cv.categorie] || COULEUR_CATEGORIE_DEFAUT;

  return (
    <div
      onClick={onOuvrir}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOuvrir();
        }
      }}
      className="group bg-white rounded-2xl border border-gray-200 overflow-hidden cursor-pointer transition hover:shadow-lg hover:-translate-y-0.5 flex flex-col"
    >
      <div className="relative aspect-[3/4] bg-gray-50">
        {cv.apercuUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- vignette d'un fichier privé signé, pas un asset à optimiser par next/image
          <img
            src={cv.apercuUrl}
            alt={`Aperçu du CV de ${cv.nom_complet || "candidat"}`}
            className="absolute inset-0 w-full h-full object-cover object-top"
          />
        ) : (
          <div className={`absolute inset-0 bg-gradient-to-br ${couleur.degrade} flex flex-col items-center justify-center gap-2 px-4 text-center`}>
            <span className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-white text-lg font-black">
              {initialesDe(cv.nom_complet)}
            </span>
            <i className="fa-solid fa-file-lines text-white/50 text-sm"></i>
          </div>
        )}

        {cv.statut === "erreur" && (
          <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-red-600 text-white text-[9px] font-black uppercase shadow-sm">
            Analyse échouée
          </span>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSupprimer();
          }}
          disabled={suppressionEnCours}
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 backdrop-blur text-gray-500 hover:text-red-600 hover:bg-white cursor-pointer disabled:opacity-40 shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition"
          aria-label="Retirer ce CV"
        >
          <i className={`fa-solid ${suppressionEnCours ? "fa-spinner fa-spin" : "fa-trash-can"} text-[11px]`}></i>
        </button>
      </div>

      <div className="p-3 flex-1 flex flex-col">
        <p className="text-xs font-black text-gray-900 truncate">{cv.nom_complet || "Nom non renseigné"}</p>
        <span className={`inline-block w-fit mt-1.5 px-2 py-0.5 rounded-full border text-[9px] font-black uppercase ${couleur.badge}`}>
          {LIBELLE_CATEGORIE[cv.categorie] || "Non catégorisé"}
        </span>
        <p className="text-[11px] text-gray-500 mt-2 leading-snug line-clamp-2 flex-1">
          {cv.resume_profil || cv.erreur_analyse || "—"}
        </p>
        <p className="text-[10px] font-bold text-[#047857] mt-2.5 pt-2 border-t border-gray-100 flex items-center gap-1.5">
          <i className="fa-solid fa-eye"></i>Voir le CV complet
        </p>
      </div>
    </div>
  );
}

/** Panneau plein écran : analyse complète + accès au fichier d'origine. */
function PanneauDetailCv({ detail, chargement, erreur, libellesNiveaux, onFermer }) {
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      onClick={onFermer}
    >
      <div
        className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onFermer}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 cursor-pointer"
          aria-label="Fermer"
        >
          <i className="fa-solid fa-xmark"></i>
        </button>

        {chargement ? (
          <div className="py-16 text-center text-gray-400">
            <i className="fa-solid fa-spinner fa-spin text-2xl"></i>
          </div>
        ) : erreur ? (
          <p className="text-sm font-bold text-red-600 pr-8">{erreur}</p>
        ) : (
          <>
            <h3 className="text-lg font-black text-gray-900 pr-8">{detail.nom_complet || "Nom non renseigné"}</h3>
            <div className="flex items-center gap-2 flex-wrap mt-2">
              <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-[10px] font-black uppercase">
                {LIBELLE_CATEGORIE[detail.categorie] || "Non catégorisé"}
              </span>
              {detail.niveau_etude_code && (
                <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-[10px] font-bold">
                  {libellesNiveaux[detail.niveau_etude_code] || detail.niveau_etude_code}
                </span>
              )}
              {detail.annees_experience != null && (
                <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-[10px] font-bold">
                  {detail.annees_experience} an{detail.annees_experience > 1 ? "s" : ""} d&apos;expérience
                </span>
              )}
            </div>

            {/* Fichiers d'origine EN PREMIER : l'analyse peut se tromper, le
                document déposé reste la référence pour trancher. */}
            <div className="flex flex-wrap gap-2 mt-4">
              {detail.urlCv ? (
                <a
                  href={detail.urlCv}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 rounded-xl bg-gray-900 hover:bg-black text-white text-xs font-black cursor-pointer"
                >
                  <i className="fa-solid fa-file-pdf mr-1.5"></i>
                  Voir le CV complet
                </a>
              ) : (
                <span className="text-[11px] text-gray-400 italic">Fichier CV indisponible.</span>
              )}
              {detail.urlLettre && (
                <a
                  href={detail.urlLettre}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-black cursor-pointer"
                >
                  <i className="fa-solid fa-envelope-open-text mr-1.5"></i>
                  Voir la lettre
                </a>
              )}
            </div>

            {detail.statut === "erreur" && (
              <p className="text-[11px] font-bold text-red-600 mt-4">
                <i className="fa-solid fa-triangle-exclamation mr-1"></i>
                Analyse échouée : {detail.erreur_analyse || "erreur inconnue"}. Le fichier reste consultable
                ci-dessus.
              </p>
            )}

            {detail.resume_profil && (
              <div className="mt-4">
                <h4 className="text-[11px] font-black text-gray-500 uppercase tracking-wider mb-1.5">Synthèse</h4>
                <p className="text-xs text-gray-700 leading-relaxed">{detail.resume_profil}</p>
              </div>
            )}

            {detail.competences?.length > 0 && (
              <div className="mt-4">
                <h4 className="text-[11px] font-black text-gray-500 uppercase tracking-wider mb-1.5">Compétences</h4>
                <div className="flex flex-wrap gap-1.5">
                  {detail.competences.map((comp, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold">
                      {comp}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {detail.points_forts?.length > 0 && (
              <div className="mt-4">
                <h4 className="text-[11px] font-black text-gray-500 uppercase tracking-wider mb-1.5">Points forts</h4>
                <ul className="space-y-1">
                  {detail.points_forts.map((pf, i) => (
                    <li key={i} className="text-xs text-gray-700 leading-relaxed flex gap-1.5">
                      <i className="fa-solid fa-check text-emerald-600 mt-0.5 text-[10px]"></i>
                      <span>{pf}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

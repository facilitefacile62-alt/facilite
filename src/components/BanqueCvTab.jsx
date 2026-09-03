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
      chargerListe();
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
    chargerListe();
  };

  // --- Liste des CV déjà importés ---
  const [liste, setListe] = useState([]);
  const [totalListe, setTotalListe] = useState(0);
  const [pageListe, setPageListe] = useState(0);
  const [categorieListe, setCategorieListe] = useState("");
  const [rechercheNomSaisie, setRechercheNomSaisie] = useState("");
  const [rechercheNomListe, setRechercheNomListe] = useState("");
  const [chargementListe, setChargementListe] = useState(true);
  const [suppressionEnCours, setSuppressionEnCours] = useState(null);

  // Débounce : un appel réseau par pause de frappe, pas un par lettre tapée.
  useEffect(() => {
    const delai = setTimeout(() => {
      setPageListe(0);
      setRechercheNomListe(rechercheNomSaisie);
    }, 350);
    return () => clearTimeout(delai);
  }, [rechercheNomSaisie]);

  const chargerListe = useCallback(async () => {
    setChargementListe(true);
    try {
      const token = await jeton();
      const params = new URLSearchParams({ page: String(pageListe) });
      if (categorieListe) params.set("categorie", categorieListe);
      if (rechercheNomListe.trim()) params.set("q", rechercheNomListe.trim());
      const res = await fetch(`/api/admin/banque-cv?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (res.ok) {
        setListe(data.cvs || []);
        setTotalListe(data.total || 0);
      }
    } finally {
      setChargementListe(false);
    }
  }, [pageListe, categorieListe, rechercheNomListe]);

  useEffect(() => {
    chargerListe();
  }, [chargerListe]);

  const supprimer = async (id) => {
    setSuppressionEnCours(id);
    try {
      const token = await jeton();
      await fetch(`/api/admin/banque-cv?id=${id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      chargerListe();
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

      {/* --- Liste --- */}
      <section>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <h3 className="text-sm font-black text-gray-900">
            Contenu de la banque <span className="text-gray-400 font-bold">({totalListe})</span>
          </h3>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="relative">
              <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400"></i>
              <input
                type="text"
                value={rechercheNomSaisie}
                onChange={(e) => setRechercheNomSaisie(e.target.value)}
                placeholder="Chercher un nom…"
                className="text-xs font-medium border border-gray-200 rounded-xl pl-8 pr-3 py-2 w-40 focus:outline-none focus:ring-2 focus:ring-[#10E688]"
              />
            </div>
            <select
              value={categorieListe}
              onChange={(e) => {
                setCategorieListe(e.target.value);
                setPageListe(0);
              }}
              className="text-xs font-bold border border-gray-200 rounded-xl px-3 py-2 cursor-pointer"
            >
              <option value="">Toutes catégories</option>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>

        {chargementListe ? (
          <p className="text-[11px] text-gray-400">Chargement…</p>
        ) : liste.length === 0 ? (
          <p className="text-[11px] text-gray-500">Aucun CV importé pour l&apos;instant.</p>
        ) : (
          <ul className="divide-y divide-gray-100 border border-gray-200 rounded-2xl overflow-hidden">
            {liste.map((c, idx) => {
              // Sans filtre de catégorie, la liste est déjà triée
              // catégorie puis nom (voir la route) : un en-tête apparaît
              // simplement quand la catégorie change d'une ligne à l'autre —
              // pas de requête supplémentaire, le classement retombe du tri.
              const categoriePrecedente = idx > 0 ? liste[idx - 1].categorie : undefined;
              const debutDeGroupe = !categorieListe && c.categorie !== categoriePrecedente;
              return (
                <li key={c.id}>
                  {debutDeGroupe && (
                    <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100">
                      <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">
                        {LIBELLE_CATEGORIE[c.categorie] || "Non catégorisé"}
                      </span>
                    </div>
                  )}
                  <div
                    onClick={() => ouvrirDetail(c.id)}
                    className="p-3 flex items-start gap-3 bg-white hover:bg-gray-50 cursor-pointer transition"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black text-gray-900 truncate">{c.nom_complet || "Nom non renseigné"}</span>
                        {c.statut === "erreur" ? (
                          <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-700 text-[9px] font-black uppercase">
                            Analyse échouée
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[9px] font-black uppercase">
                            {LIBELLE_CATEGORIE[c.categorie] || "Non catégorisé"}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">
                        {c.resume_profil || c.erreur_analyse || "—"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        supprimer(c.id);
                      }}
                      disabled={suppressionEnCours === c.id}
                      className="shrink-0 w-8 h-8 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 cursor-pointer disabled:opacity-40"
                      aria-label="Retirer ce CV"
                    >
                      <i className={`fa-solid ${suppressionEnCours === c.id ? "fa-spinner fa-spin" : "fa-trash-can"} text-xs`}></i>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {totalListe > 24 && (
          <div className="flex items-center justify-center gap-3 mt-3">
            <button
              type="button"
              onClick={() => setPageListe((p) => Math.max(0, p - 1))}
              disabled={pageListe === 0}
              className="text-xs font-bold px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40 cursor-pointer"
            >
              Précédent
            </button>
            <button
              type="button"
              onClick={() => setPageListe((p) => p + 1)}
              disabled={(pageListe + 1) * 24 >= totalListe}
              className="text-xs font-bold px-3 py-1.5 rounded-lg border border-gray-200 disabled:opacity-40 cursor-pointer"
            >
              Suivant
            </button>
          </div>
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

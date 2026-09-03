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

  // --- Import ---
  const [fichierCv, setFichierCv] = useState(null);
  const [fichierLettre, setFichierLettre] = useState(null);
  const [nomSaisi, setNomSaisi] = useState("");
  const [importEnCours, setImportEnCours] = useState(false);
  const [messageImport, setMessageImport] = useState(null); // { type: 'ok'|'erreur', texte }
  const champCv = useRef(null);
  const champLettre = useRef(null);

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

  // --- Liste des CV déjà importés ---
  const [liste, setListe] = useState([]);
  const [totalListe, setTotalListe] = useState(0);
  const [pageListe, setPageListe] = useState(0);
  const [categorieListe, setCategorieListe] = useState("");
  const [chargementListe, setChargementListe] = useState(true);
  const [suppressionEnCours, setSuppressionEnCours] = useState(null);

  const chargerListe = useCallback(async () => {
    setChargementListe(true);
    try {
      const token = await jeton();
      const params = new URLSearchParams({ page: String(pageListe) });
      if (categorieListe) params.set("categorie", categorieListe);
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
  }, [pageListe, categorieListe]);

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
        <h3 className="text-sm font-black text-gray-900 mb-1">Importer un CV</h3>
        <p className="text-[11px] text-gray-500 mb-3">
          L&apos;analyse prend quelques secondes : le classement en catégorie s&apos;appuie sur le
          texte réel du CV, jamais sur son seul nom de fichier.
        </p>
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
      </section>

      {/* --- Liste --- */}
      <section>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <h3 className="text-sm font-black text-gray-900">
            Contenu de la banque <span className="text-gray-400 font-bold">({totalListe})</span>
          </h3>
          <select
            value={categorieListe}
            onChange={(e) => {
              setCategorieListe(e.target.value);
              setPageListe(0);
            }}
            className="ml-auto text-xs font-bold border border-gray-200 rounded-xl px-3 py-2 cursor-pointer"
          >
            <option value="">Toutes catégories</option>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>

        {chargementListe ? (
          <p className="text-[11px] text-gray-400">Chargement…</p>
        ) : liste.length === 0 ? (
          <p className="text-[11px] text-gray-500">Aucun CV importé pour l&apos;instant.</p>
        ) : (
          <ul className="divide-y divide-gray-100 border border-gray-200 rounded-2xl overflow-hidden">
            {liste.map((c) => (
              <li key={c.id} className="p-3 flex items-start gap-3 bg-white">
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
                  onClick={() => supprimer(c.id)}
                  disabled={suppressionEnCours === c.id}
                  className="shrink-0 w-8 h-8 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 cursor-pointer disabled:opacity-40"
                  aria-label="Retirer ce CV"
                >
                  <i className={`fa-solid ${suppressionEnCours === c.id ? "fa-spinner fa-spin" : "fa-trash-can"} text-xs`}></i>
                </button>
              </li>
            ))}
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
    </div>
  );
}

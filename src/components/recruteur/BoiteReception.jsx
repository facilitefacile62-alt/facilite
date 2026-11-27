"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { chargerNiveauxEtudes, comparerNiveaux } from "@/lib/niveauxEtudes";
import { STATUTS_CHOISISSABLES, STATUTS_CANDIDATURE, infoStatut } from "@/lib/statutsCandidature";
import { etatNiveau, filtrerEtTrier, libelleNiveau } from "@/lib/boiteReception";
import LecteurCv from "@/components/recruteur/LecteurCv";

// Boîte de réception par offre : les candidatures de MES offres approuvées (la base ne renvoie rien d'autre).
export const apiBoite = {
  async listerOffres() {
    const { data, error } = await supabase.rpc("boite_mes_offres");
    if (error) throw new Error(error.message);
    return data || [];
  },
  async listerCandidatures(offreId) {
    const { data, error } = await supabase.rpc("boite_candidatures", { p_offre: offreId });
    if (error) throw new Error(error.message);
    return data || [];
  },
  async changerStatut(id, statut) {
    const { error } = await supabase.rpc("changer_statut_candidature", { p_candidature: id, p_statut: statut });
    if (error) throw new Error(error.message);
  },
  async enregistrerNote(id, note) {
    const { error } = await supabase.rpc("enregistrer_note_candidature", { p_candidature: id, p_note: note });
    if (error) throw new Error(error.message);
  },
  async ouvrirCv(id) {
    const { data: s } = await supabase.auth.getSession();
    const res = await fetch(`/api/recruteur/candidatures/${id}/cv`, {
      method: "POST",
      headers: { Authorization: `Bearer ${s?.session?.access_token || ""}` },
    });
    const corps = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(corps.error || "Impossible d'ouvrir le CV.");
    return corps;
  },
  chargerNiveaux: () => chargerNiveauxEtudes(),
};

const CLE_AUCUNE = "aucune";
const cle = (offreId) => (offreId === null ? "spontanees" : offreId);
const dateCourte = (d) => (d ? new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "");

function BadgeCorrespondance({ score, niveau }) {
  const classe =
    score === null || score === undefined
      ? "bg-gray-100 text-gray-500 border-gray-200"
      : score >= 75
        ? "bg-emerald-100 text-emerald-800 border-emerald-200"
        : score >= 50
          ? "bg-amber-100 text-amber-800 border-amber-200"
          : "bg-red-100 text-red-800 border-red-200";
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold border whitespace-nowrap ${classe}`}>
        Correspondance {score === null || score === undefined ? "—" : `${score} %`}
      </span>
      {niveau === "insuffisant" && (
        <span className="px-2 py-1 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200 whitespace-nowrap">Niveau en dessous</span>
      )}
      {niveau === "suffisant" && (
        <span className="px-2 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">Niveau atteint</span>
      )}
    </span>
  );
}

function CarteCandidature({ c, niveaux, occupe, onStatut, onCv, onNote, onEntretien, entretienEnCours }) {
  const [panneau, setPanneau] = useState("");
  const [note, setNote] = useState(c.note || "");
  const info = infoStatut(c.statut);
  const niveau = etatNiveau(c, niveaux, comparerNiveaux);
  const bouton = "px-3 py-2 rounded-xl text-[11px] font-extrabold cursor-pointer disabled:opacity-60";
  const options = STATUTS_CHOISISSABLES.some((s) => s.valeur === c.statut) ? STATUTS_CHOISISSABLES : [info, ...STATUTS_CHOISISSABLES];

  return (
    <article className="border border-gray-200 rounded-2xl p-4 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-sm font-extrabold text-gray-900 break-words">{c.nom}</h4>
          <p className="text-[11px] text-gray-500 font-medium">
            Reçue le {dateCourte(c.recue_le)} · {libelleNiveau(niveaux, c.niveau_code) || "Niveau non renseigné"}
          </p>
          {c.email && <p className="text-[11px] text-gray-500 break-all">{c.email}</p>}
        </div>
        <span className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold border whitespace-nowrap ${info.classe}`}>{info.recruteur}</span>
      </div>

      <div className="mt-2">
        <BadgeCorrespondance score={c.score} niveau={niveau} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" disabled={!c.a_un_cv || occupe} onClick={() => onCv(c)} className={`${bouton} bg-emerald-600 text-white`}>
          {c.a_un_cv ? "Voir le CV" : "Pas de CV"}
        </button>
        {c.lettre && (
          <button type="button" onClick={() => setPanneau(panneau === "lettre" ? "" : "lettre")} className={`${bouton} bg-gray-100 text-gray-700`} aria-expanded={panneau === "lettre"}>
            Lettre
          </button>
        )}
        <button type="button" onClick={() => setPanneau(panneau === "note" ? "" : "note")} className={`${bouton} bg-gray-100 text-gray-700`} aria-expanded={panneau === "note"}>
          {c.note ? "Ma note ✓" : "Note"}
        </button>
        {onEntretien && (
          <button type="button" disabled={entretienEnCours} onClick={() => onEntretien(c)} className={`${bouton} bg-blue-50 text-blue-700`}>
            {entretienEnCours ? "Création…" : "Entretien vidéo"}
          </button>
        )}
        <label className="ml-auto flex items-center gap-1.5 text-[11px] font-bold text-gray-500">
          Statut
          <select
            value={c.statut}
            disabled={occupe}
            onChange={(e) => onStatut(c, e.target.value)}
            className="px-2.5 py-2 bg-white border border-gray-300 rounded-lg text-[11px] font-bold text-gray-800"
          >
            {options.map((s) => (
              <option key={s.valeur} value={s.valeur}>
                {s.recruteur}
              </option>
            ))}
          </select>
        </label>
      </div>

      {panneau === "lettre" && <p className="mt-3 text-xs text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-xl p-3">{c.lettre}</p>}
      {panneau === "note" && (
        <div className="mt-3 space-y-2">
          <textarea
            value={note}
            maxLength={2000}
            rows={3}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note privée — le candidat ne la voit jamais."
            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800"
          />
          <button type="button" disabled={occupe} onClick={() => onNote(c, note)} className={`${bouton} bg-gray-900 text-white`}>
            Enregistrer la note
          </button>
        </div>
      )}
    </article>
  );
}

export default function BoiteReception({ api = apiBoite, onEntretien = null, entretienEnCoursId = null, toast = () => {} }) {
  const [offres, setOffres] = useState(null);
  const [selection, setSelection] = useState(CLE_AUCUNE);
  const [candidatures, setCandidatures] = useState(null);
  const [niveaux, setNiveaux] = useState([]);
  const [erreur, setErreur] = useState("");
  const [occupe, setOccupe] = useState(null);
  const [recherche, setRecherche] = useState("");
  const [filtres, setFiltres] = useState({ statut: "", niveauMin: "", scoreMin: 0, tri: "date" });
  const [cvOuvert, setCvOuvert] = useState(null);

  useEffect(() => {
    let vivant = true;
    api
      .listerOffres()
      .then((l) => vivant && setOffres(l))
      .catch(() => vivant && setErreur("Impossible de charger vos offres. Rechargez la page."));
    Promise.resolve(api.chargerNiveaux())
      .then((n) => vivant && setNiveaux(n || []))
      .catch(() => {});
    return () => {
      vivant = false;
    };
  }, [api]);

  const ouvrirOffre = useCallback(
    async (offreId) => {
      setSelection(offreId);
      setCandidatures(null);
      setErreur("");
      try {
        setCandidatures(await api.listerCandidatures(offreId));
      } catch {
        setErreur("Impossible de charger les candidatures de cette offre.");
        setCandidatures([]);
      }
    },
    [api]
  );

  const maj = (id, champs) => setCandidatures((l) => (l || []).map((c) => (c.candidature_id === id ? { ...c, ...champs } : c)));

  const changerStatut = async (c, statut) => {
    const avant = c.statut;
    setOccupe(c.candidature_id);
    maj(c.candidature_id, { statut });
    try {
      await api.changerStatut(c.candidature_id, statut);
      toast("Statut mis à jour.");
    } catch {
      maj(c.candidature_id, { statut: avant });
      toast("Impossible de mettre à jour le statut.");
    } finally {
      setOccupe(null);
    }
  };

  const enregistrerNote = async (c, note) => {
    setOccupe(c.candidature_id);
    try {
      await api.enregistrerNote(c.candidature_id, note);
      maj(c.candidature_id, { note: note.trim() || null });
      toast("Note enregistrée.");
    } catch {
      toast("Impossible d'enregistrer la note.");
    } finally {
      setOccupe(null);
    }
  };

  const voirCv = async (c) => {
    setOccupe(c.candidature_id);
    try {
      const cv = await api.ouvrirCv(c.candidature_id);
      setCvOuvert({ titre: c.nom, cv });
      if (c.statut === "pending") maj(c.candidature_id, { statut: "viewed" });
    } catch (err) {
      toast(err.message || "Impossible d'ouvrir le CV.");
    } finally {
      setOccupe(null);
    }
  };

  const offresAffichees = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return (offres || []).filter((o) => !q || `${o.titre} ${o.societe || ""}`.toLowerCase().includes(q));
  }, [offres, recherche]);

  const offreChoisie = (offres || []).find((o) => cle(o.offre_id) === cle(selection)) || null;
  const visibles = useMemo(() => filtrerEtTrier(candidatures, filtres, niveaux), [candidatures, filtres, niveaux]);
  const champ = "px-2.5 py-2 bg-white border border-gray-200 rounded-xl text-[11px] font-bold text-gray-700 min-w-0";

  return (
    <section className="bg-white rounded-3xl border border-gray-200 shadow-xs overflow-hidden text-left">
      <div className="p-4 sm:p-6 border-b border-gray-200">
        <h2 className="text-lg font-extrabold text-gray-900">Boîte de réception</h2>
        <p className="text-xs text-gray-500 font-medium">Les candidatures de vos offres approuvées. Chaque ouverture de CV est enregistrée.</p>
      </div>

      {erreur && <p className="px-4 sm:px-6 py-3 text-xs font-bold text-red-600">{erreur}</p>}

      <div className="grid lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* Liste des offres (masquée sur téléphone quand une offre est ouverte) */}
        <div className={`${selection === CLE_AUCUNE ? "block" : "hidden"} lg:block border-b lg:border-b-0 lg:border-r border-gray-200 p-3 min-w-0`}>
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Chercher une offre"
            aria-label="Chercher une offre"
            className="w-full mb-3 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800"
          />
          {offres === null && !erreur && <p className="text-xs text-gray-400 text-center py-6">Chargement…</p>}
          {offres !== null && offresAffichees.length === 0 && <p className="text-xs text-gray-400 italic text-center py-6">Aucune offre.</p>}
          <ul className="space-y-2 lg:max-h-[70vh] lg:overflow-y-auto">
            {offresAffichees.map((o) => {
              const actif = cle(o.offre_id) === cle(selection);
              const approuvee = o.statut_offre === "approved";
              return (
                <li key={cle(o.offre_id)}>
                  <button
                    type="button"
                    disabled={!approuvee}
                    onClick={() => ouvrirOffre(o.offre_id)}
                    className={`w-full text-left rounded-2xl border p-3 cursor-pointer disabled:cursor-default ${actif ? "border-emerald-500 bg-emerald-50" : "border-gray-200 hover:bg-gray-50"}`}
                  >
                    <span className="block text-xs font-extrabold text-gray-900 break-words">{o.titre}</span>
                    {o.societe && <span className="block text-[11px] text-gray-500 truncate">{o.societe}</span>}
                    <span className="mt-1.5 flex flex-wrap gap-1.5 text-[10px] font-extrabold">
                      {approuvee ? (
                        <>
                          <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">{o.total} candidature{o.total > 1 ? "s" : ""}</span>
                          {o.nouvelles > 0 && <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">{o.nouvelles} nouvelle{o.nouvelles > 1 ? "s" : ""}</span>}
                          {(!o.active || o.archivee) && <span className="px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">Clôturée</span>}
                        </>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{o.statut_offre === "pending_review" ? "En attente de modération" : "Non publiée"}</span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Candidatures de l'offre choisie */}
        <div className={`${selection === CLE_AUCUNE ? "hidden" : "block"} lg:block p-3 sm:p-4 min-w-0 bg-gray-50`}>
          {selection === CLE_AUCUNE ? (
            <p className="text-xs text-gray-400 italic text-center py-12">Choisissez une offre pour voir ses candidatures.</p>
          ) : (
            <>
              <button type="button" onClick={() => setSelection(CLE_AUCUNE)} className="lg:hidden mb-3 text-xs font-extrabold text-emerald-700 cursor-pointer">
                ← Toutes mes offres
              </button>
              <h3 className="text-sm font-extrabold text-gray-900 break-words">{offreChoisie?.titre}</h3>
              {offreChoisie && (
                <p className="text-[11px] text-gray-500 font-medium mb-3">
                  {offreChoisie.total} candidature{offreChoisie.total > 1 ? "s" : ""} · {offreChoisie.preselectionnees} présélectionnée{offreChoisie.preselectionnees > 1 ? "s" : ""} ·{" "}
                  {offreChoisie.refusees} refusée{offreChoisie.refusees > 1 ? "s" : ""}
                </p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                <select aria-label="Filtrer par statut" className={champ} value={filtres.statut} onChange={(e) => setFiltres({ ...filtres, statut: e.target.value })}>
                  <option value="">Tous les statuts</option>
                  {STATUTS_CANDIDATURE.map((s) => (
                    <option key={s.valeur} value={s.valeur}>
                      {s.recruteur}
                    </option>
                  ))}
                </select>
                <select aria-label="Niveau minimum" className={champ} value={filtres.niveauMin} onChange={(e) => setFiltres({ ...filtres, niveauMin: e.target.value })}>
                  <option value="">Tous les niveaux</option>
                  {niveaux
                    .filter((n) => n.comparable && n.code !== "AUCUN")
                    .map((n) => (
                      <option key={n.code} value={n.code}>
                        Au moins {n.libelle}
                      </option>
                    ))}
                </select>
                <select aria-label="Correspondance minimum" className={champ} value={filtres.scoreMin} onChange={(e) => setFiltres({ ...filtres, scoreMin: Number(e.target.value) })}>
                  <option value={0}>Toute correspondance</option>
                  <option value={50}>50 % et plus</option>
                  <option value={75}>75 % et plus</option>
                </select>
                <select aria-label="Trier" className={champ} value={filtres.tri} onChange={(e) => setFiltres({ ...filtres, tri: e.target.value })}>
                  <option value="date">Plus récentes</option>
                  <option value="correspondance">Meilleure correspondance</option>
                  <option value="niveau">Niveau le plus élevé</option>
                  <option value="statut">Par statut</option>
                </select>
              </div>
              {candidatures === null && <p className="text-xs text-gray-400 text-center py-8">Chargement…</p>}
              {candidatures !== null && visibles.length === 0 && (
                <p className="text-xs text-gray-400 italic text-center py-8">
                  {candidatures.length === 0 ? "Aucune candidature pour cette offre." : "Aucune candidature ne correspond à ces filtres."}
                </p>
              )}
              <div className="space-y-3">
                {visibles.map((c) => (
                  <CarteCandidature
                    key={c.candidature_id}
                    c={c}
                    niveaux={niveaux}
                    occupe={occupe === c.candidature_id}
                    onStatut={changerStatut}
                    onCv={voirCv}
                    onNote={enregistrerNote}
                    onEntretien={onEntretien && selection !== null ? (x) => onEntretien({ id: x.candidature_id }) : null}
                    entretienEnCours={entretienEnCoursId === c.candidature_id}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {cvOuvert && <LecteurCv titre={cvOuvert.titre} cv={cvOuvert.cv} onFermer={() => setCvOuvert(null)} />}
    </section>
  );
}

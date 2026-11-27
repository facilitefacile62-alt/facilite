// Tri et filtres de la boîte de réception d'une offre (fonctions pures, testées à part).

/** « suffisant », « insuffisant », « inconnu » ou « non_applicable » — `comparer` est comparerNiveaux (src/lib/niveauxEtudes.js). */
export function etatNiveau(candidature, niveaux, comparer) {
  if (!niveaux?.length || !comparer) return "inconnu";
  return comparer(niveaux, candidature.niveau_code, candidature.niveau_exige_code).statut;
}

function rang(niveaux, code) {
  const n = (niveaux || []).find((x) => x.code === code);
  return n && n.comparable && n.rang !== null && n.rang !== undefined ? n.rang : null;
}

export function libelleNiveau(niveaux, code) {
  return (niveaux || []).find((x) => x.code === code)?.libelle || null;
}

export function filtrerEtTrier(candidatures, { statut = "", niveauMin = "", scoreMin = 0, tri = "date" } = {}, niveaux = []) {
  const seuil = niveauMin ? rang(niveaux, niveauMin) : null;
  const retenues = (candidatures || []).filter((c) => {
    if (statut && c.statut !== statut) return false;
    if (scoreMin && !(Number(c.score) >= scoreMin)) return false;
    if (seuil !== null) {
      const r = rang(niveaux, c.niveau_code);
      if (r === null || r < seuil) return false;
    }
    return true;
  });
  const date = (c) => new Date(c.recue_le).getTime();
  const comparateurs = {
    date: (a, b) => date(b) - date(a),
    correspondance: (a, b) => (b.score ?? -1) - (a.score ?? -1) || date(b) - date(a),
    niveau: (a, b) => (rang(niveaux, b.niveau_code) ?? -1) - (rang(niveaux, a.niveau_code) ?? -1) || date(b) - date(a),
    statut: (a, b) => String(a.statut).localeCompare(String(b.statut)) || date(b) - date(a),
  };
  return [...retenues].sort(comparateurs[tri] || comparateurs.date);
}

// Lecture des réponses de l'analyse d'un CV — logique PURE, sans import : testable seule (les appels réseau sont dans scanDocument.ts).

/** « Septembre 2018 - Juin 2021 » → début 2018, fin 2021 ; « 2021 » → fin 2021 ; « 2023 - Présent » → début 2023, en cours. */
export function anneesDeDates(dates: string): { debut?: string; fin?: string; enCours: boolean } {
  const annees = dates.match(/\d{4}/g) ?? [];
  const enCours = /présent|present|en cours|aujourd/i.test(dates);
  if (annees.length === 0) return { enCours };
  if (annees.length === 1) return enCours ? { debut: annees[0], enCours } : /^\s*\d{4}\s*$/.test(dates) ? { fin: annees[0], enCours } : { debut: annees[0], enCours };
  return { debut: annees[0], fin: enCours ? undefined : annees[annees.length - 1], enCours };
}

/** Une liste de textes lue dans une réponse du serveur : un tableau de chaînes, ou { detail: [...] } ; chaînes vides et doublons retirés. */
export function listeDeTextes(source: unknown, max = 60): string[] {
  const brut: unknown[] = Array.isArray(source) ? source : Array.isArray((source as { detail?: unknown } | null)?.detail) ? ((source as { detail: unknown[] }).detail) : [];
  const vus = new Set<string>();
  const resultat: string[] = [];
  for (const v of brut) {
    const t = typeof v === 'string' ? v.trim() : '';
    const cle = t.toLowerCase();
    if (t && t.length <= 200 && !vus.has(cle)) {
      vus.add(cle);
      resultat.push(t);
    }
    if (resultat.length >= max) break;
  }
  return resultat;
}

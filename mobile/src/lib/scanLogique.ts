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

export type LangueExtraite = { name: string; level: string };
export type ExperienceExtraite = {
  title: string;
  company: string;
  location?: string;
  startYear?: string;
  endYear?: string;
  isCurrent?: boolean;
};
// Même forme que profiles.educations (voir profilChamps.ts) : une formation lue sur le CV s'affiche telle quelle sur le site.
export type FormationExtraite = {
  school: string;
  degree: string;
  field?: string;
  startYear?: string;
  endYear?: string;
  isCurrent?: boolean;
};

export type DonneesExtraites = {
  fullName: string;
  headline: string;
  bio: string;
  city: string;
  phone: string;
  email: string;
  languages: LangueExtraite[];
  experiences: ExperienceExtraite[];
  educations: FormationExtraite[];
  skills: string[];
  interests: string[];
  degrade: boolean;
};

function texte(source: unknown, cles: string[]): string {
  if (!source || typeof source !== 'object') return '';
  for (const cle of cles) {
    const v = (source as Record<string, unknown>)[cle];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

export function mapperChampsExtraits(fields: Record<string, unknown>): Omit<DonneesExtraites, 'degrade'> {
  const etatCivil = fields.etat_civil;
  const contacts = fields.contacts;

  const fullName = texte(etatCivil, ['nom']) || texte(fields, ['fullName', 'name']);
  const headline = texte(etatCivil, ['titre_professionnel']) || texte(fields, ['title', 'jobTitle']);
  const bio = texte(fields, ['profil_professionnel']) || texte(fields, ['bio', 'summary']);
  const city = texte(contacts, ['localisation']) || texte(fields, ['city', 'location']);
  const phone = texte(contacts, ['telephone']) || texte(fields, ['phone', 'telephone']);
  const email = texte(contacts, ['email']) || texte(fields, ['email']);

  const languesDetail = (fields.langues as Record<string, unknown> | undefined)?.detail;
  const languesBrutes: unknown[] = Array.isArray(languesDetail)
    ? languesDetail
    : Array.isArray(fields.languages)
      ? (fields.languages as unknown[])
      : [];
  const languages: LangueExtraite[] = languesBrutes
    .map((l): LangueExtraite => {
      if (typeof l === 'string') {
        const [nomLangue, niveau] = l.split(/[-:(]/).map((s) => s.trim());
        return { name: nomLangue || l, level: niveau || '' };
      }
      return { name: texte(l, ['name', 'langue']), level: texte(l, ['level', 'niveau']) };
    })
    .filter((l) => l.name);

  const expBrutes: unknown[] = Array.isArray(fields.experiences_professionnelles)
    ? (fields.experiences_professionnelles as unknown[])
    : Array.isArray(fields.experiences)
      ? (fields.experiences as unknown[])
      : [];
  const experiences: ExperienceExtraite[] = expBrutes
    .map((x): ExperienceExtraite | null => {
      if (!x || typeof x !== 'object') return null;
      const dates = texte(x, ['dates']);
      const annees = anneesDeDates(dates);
      const title = texte(x, ['poste', 'title']);
      if (!title) return null;
      return {
        title,
        company: texte(x, ['entreprise', 'company']),
        location: texte(x, ['localisation', 'location']) || undefined,
        // Une seule année lue sur une expérience : c'est son année de début.
        startYear: annees.debut || annees.fin || texte(x, ['startYear']) || undefined,
        endYear: annees.debut ? annees.fin : undefined,
        isCurrent: annees.enCours,
      };
    })
    .filter((x): x is ExperienceExtraite => x !== null);

  const formationsBrutes: unknown[] = Array.isArray(fields.formations) ? (fields.formations as unknown[]) : Array.isArray(fields.educations) ? (fields.educations as unknown[]) : [];
  const educations: FormationExtraite[] = formationsBrutes
    .map((f): FormationExtraite | null => {
      if (!f || typeof f !== 'object') return null;
      const school = texte(f, ['etablissement', 'établissement', 'school', 'institution']);
      const degree = texte(f, ['diplome', 'diplôme', 'degree']);
      if (!school && !degree) return null;
      const annees = anneesDeDates(texte(f, ['dates', 'periode', 'période']));
      return {
        school,
        degree,
        field: texte(f, ['domaine', 'field']) || undefined,
        startYear: annees.debut,
        endYear: annees.fin,
        isCurrent: annees.enCours,
      };
    })
    .filter((f): f is FormationExtraite => f !== null);

  // Compétences : savoir-faire, outils informatiques et qualités personnelles lus sur le CV (sans doublon).
  const skills = listeDeTextes([
    ...listeDeTextes(fields.competences_cles_hard_skills),
    ...listeDeTextes(fields.competences_informatiques),
    ...listeDeTextes(fields.qualites_personnelles),
    ...listeDeTextes(fields.skills),
  ]);
  const interests = listeDeTextes(fields.centres_d_interet ?? fields.interests);

  return { fullName, headline, bio, city, phone, email, languages, experiences, educations, skills, interests };
}

// Rubriques issues du CV (langues, expériences, formation, compétences, centres d'intérêt) — logique PURE, sans import : testable seule.
//
// Ces cinq rubriques viennent d'un CV scanné ou importé et s'affichent en lecture seule. Un nouveau CV ne les remplace jamais en silence : un écran
// demande confirmation, et l'ancienne version reste récupérable (voir la migration 20261025140000_profil_cv_versions.sql).

export type Rubrique = 'languages' | 'experiences' | 'educations' | 'skills' | 'interests';
export type Rubriques = Record<Rubrique, unknown[]>;

export const RUBRIQUES: { cle: Rubrique; titre: string; singulier: string; pluriel: string }[] = [
  { cle: 'languages', titre: 'Langues', singulier: 'langue', pluriel: 'langues' },
  { cle: 'experiences', titre: 'Expériences', singulier: 'expérience', pluriel: 'expériences' },
  { cle: 'educations', titre: 'Formation', singulier: 'formation', pluriel: 'formations' },
  { cle: 'skills', titre: 'Compétences', singulier: 'compétence', pluriel: 'compétences' },
  { cle: 'interests', titre: "Centres d'intérêt", singulier: "centre d'intérêt", pluriel: "centres d'intérêt" },
];

// Valeurs par DÉFAUT d'exemple de la base (479 profils sur 533 ne les ont jamais changées) : ce ne sont pas des données de la personne.
const LANGUE_PAR_DEFAUT = { name: 'Français', level: 'Principal / Courant' };
const COMPETENCES_PAR_DEFAUT = ['Gestion de projet', 'Développement Web', 'Stratégie Digitale'];

const liste = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const memeTexte = (a: unknown, b: string) => typeof a === 'string' && a.trim() === b;

/** Les cinq rubriques réellement saisies : les valeurs par défaut d'exemple et les lignes vides sont retirées. */
export function rubriquesReelles(source: Record<string, unknown> | null | undefined): Rubriques {
  const s = source ?? {};
  const langues = liste(s.languages).filter((l) => {
    const nom = l && typeof l === 'object' ? (l as Record<string, unknown>).name : null;
    return typeof nom === 'string' && nom.trim() !== '';
  });
  const langueSeuleParDefaut =
    langues.length === 1 &&
    memeTexte((langues[0] as Record<string, unknown>).name, LANGUE_PAR_DEFAUT.name) &&
    memeTexte((langues[0] as Record<string, unknown>).level, LANGUE_PAR_DEFAUT.level);
  const competences = liste(s.skills);
  const competencesParDefaut = competences.length === COMPETENCES_PAR_DEFAUT.length && COMPETENCES_PAR_DEFAUT.every((c, i) => memeTexte(competences[i], c));
  return {
    languages: langueSeuleParDefaut ? [] : langues,
    experiences: liste(s.experiences),
    educations: liste(s.educations),
    skills: competencesParDefaut ? [] : competences,
    interests: liste(s.interests),
  };
}

export const rubriquesVides = (r: Rubriques): boolean => RUBRIQUES.every((x) => r[x.cle].length === 0);

/** « 3 langues », « 1 formation », « aucune compétence ». */
export function texteCompte(n: number, singulier: string, pluriel: string): string {
  if (n <= 0) return `aucune ${singulier}`;
  return `${n} ${n > 1 ? pluriel : singulier}`;
}

export type Changement = { cle: Rubrique; titre: string; avant: number; apres: number; gardee: boolean; texte: string };

/** Ce qui change à l'écran de confirmation : une ligne par rubrique. Une rubrique que le nouveau CV ne contient pas est GARDÉE telle quelle. */
export function changements(avant: Rubriques, apres: Rubriques): Changement[] {
  return RUBRIQUES.map((r) => {
    const a = avant[r.cle].length;
    const n = apres[r.cle].length;
    const gardee = n === 0;
    const texte = gardee
      ? `${r.titre} : le CV n'en contient pas, les vôtres sont gardées`
      : a === 0
        ? `${r.titre} : ${texteCompte(n, r.singulier, r.pluriel)} ajouté${n > 1 ? 'es' : 'e'}`
        : `${r.titre} : ${a} → ${n}`;
    return { cle: r.cle, titre: r.titre, avant: a, apres: n, gardee, texte };
  });
}

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** « 25 octobre 2026 à 14:32 » (sans dépendre d'Intl, absent ou partiel selon l'appareil). */
export function dateHeureFr(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const deux = (n: number) => String(n).padStart(2, '0');
  return `${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()} à ${deux(d.getHours())}:${deux(d.getMinutes())}`;
}

export type VersionCv = { id: string; creeLe: string; motif: string } & Rubriques;

/** Une ligne de profil_cv_versions → une version ; illisible → null. */
export function lireVersionCv(ligne: unknown): VersionCv | null {
  if (!ligne || typeof ligne !== 'object') return null;
  const l = ligne as Record<string, unknown>;
  if (typeof l.id !== 'string' || typeof l.created_at !== 'string') return null;
  return {
    id: l.id,
    creeLe: l.created_at,
    motif: typeof l.motif === 'string' ? l.motif : '',
    languages: liste(l.languages),
    experiences: liste(l.experiences),
    educations: liste(l.educations),
    skills: liste(l.skills),
    interests: liste(l.interests),
  };
}

/** « 3 langues · 2 expériences · 1 formation » : ce que contient une ancienne version (les rubriques vides sont omises). */
export function resumeVersion(v: Rubriques): string {
  const parties = RUBRIQUES.filter((r) => v[r.cle].length > 0).map((r) => texteCompte(v[r.cle].length, r.singulier, r.pluriel));
  return parties.length ? parties.join(' · ') : 'Aucune information';
}

export const titreMotifVersion = (motif: string): string => (motif === 'avant_restauration' ? 'Avant un retour en arrière' : 'Avant un nouveau CV');

// CV déjà enregistrés sur Facilité (créés sur le site ou importés) → données des rubriques du profil — logique PURE, sans import externe : testable seule.
// Un CV importé a déjà été analysé : on relit tel quel `extractedFields` avec le lecteur du scanner. Un CV créé sur le site garde ses données dans
// `content` (prénom, expériences, formations, compétences, langues, loisirs…) : un petit lecteur le met dans la même forme.
import { anneesDeDates, listeDeTextes, mapperChampsExtraits, type DonneesExtraites } from './scanLogique';

export type CvEnregistre = { id: string; title: string | null; type: string; created_at: string | null; content: unknown };

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const liste = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const txt = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const nom = (v: unknown): string => (typeof v === 'string' ? v : txt(obj(v).name));

/**
 * Le CV est-il l'EXEMPLE du créateur de CV du site, jamais rempli par la personne ?
 *  - l'exemple d'ouverture du créateur : prénom « Macoumba », nom « Samake », premier poste « ENTREPRENEURE » chez « AZMA Collection » ;
 *  - l'exemple des tests automatiques : premier poste « Conseiller Clientèle » (avec ou sans accent correct) et première compétence « Gestion de la relation client ».
 * Il faut que TOUS les repères d'un exemple soient là : un vrai CV qui garde par hasard un seul d'entre eux n'est pas écarté.
 */
export function estCvExemple(content: unknown): boolean {
  const c = obj(content);
  const premiereExp = obj(liste(c.experiences)[0]);
  const exempleCreateur =
    txt(c.firstName) === 'Macoumba' && txt(c.lastName) === 'Samake' && txt(premiereExp.title) === 'ENTREPRENEURE' && txt(premiereExp.employer) === 'AZMA Collection';
  // Le titre des CV de test est enregistré avec un accent mal encodé (« ClientÃ¨le ») : on ne compare que le début du mot, sans l'accent.
  const exempleTests = /^Conseiller Client/.test(txt(premiereExp.title)) && nom(liste(c.skills)[0]) === 'Gestion de la relation client';
  return exempleCreateur || exempleTests;
}

function depuisCvCree(content: unknown): DonneesExtraites {
  const c = obj(content);
  const periode = (debut: unknown, fin: unknown, enCours: boolean) => {
    const d = anneesDeDates(txt(debut));
    const f = anneesDeDates(txt(fin));
    return { startYear: d.debut ?? d.fin, endYear: enCours ? undefined : (f.fin ?? f.debut) };
  };
  const languages = liste(c.languages)
    .map((l) => ({ name: txt(obj(l).name), level: txt(obj(l).level) }))
    .filter((l) => l.name);
  const experiences = liste(c.experiences)
    .map((x) => {
      const o = obj(x);
      const enCours = o.current === true;
      return { title: txt(o.title), company: txt(o.employer), location: txt(o.city) || undefined, ...periode(o.startDate, o.endDate, enCours), isCurrent: enCours };
    })
    .filter((x) => x.title);
  const educations = liste(c.educations)
    .map((e) => {
      const o = obj(e);
      const enCours = o.current === true;
      return { school: txt(o.school), degree: txt(o.degree), ...periode(o.startDate, o.endDate, enCours), isCurrent: enCours };
    })
    .filter((e) => e.school || e.degree);
  return {
    fullName: [txt(c.firstName), txt(c.lastName)].filter(Boolean).join(' '),
    headline: txt(c.jobTitle),
    bio: txt(c.profile),
    city: txt(c.city),
    phone: txt(c.phone),
    email: txt(c.email),
    languages,
    experiences,
    educations,
    skills: listeDeTextes([...liste(c.skills).map(nom), ...liste(c.itSkills).map(nom), ...liste(c.qualities).map(nom)]),
    interests: listeDeTextes(liste(c.hobbies).map(nom)),
    degrade: false,
  };
}

function depuisCvImporte(content: unknown): DonneesExtraites | null {
  const champs = obj(obj(content).extractedFields);
  if (Object.keys(champs).length === 0) return null;
  return { ...mapperChampsExtraits(champs), degrade: false };
}

export const aDesRubriques = (d: DonneesExtraites): boolean =>
  d.languages.length + d.experiences.length + d.educations.length + d.skills.length + d.interests.length > 0;

export type CvUtilisable = { ok: true; donnees: DonneesExtraites } | { ok: false; raison: 'exemple' | 'vide' | 'type' };

/** Ce CV peut-il servir à mettre le profil à jour ? Les CV d'exemple du créateur et les CV sans aucune rubrique sont écartés. */
export function cvUtilisable(cv: CvEnregistre): CvUtilisable {
  if (cv.type === 'created') {
    if (estCvExemple(cv.content)) return { ok: false, raison: 'exemple' };
    const d = depuisCvCree(cv.content);
    return aDesRubriques(d) ? { ok: true, donnees: d } : { ok: false, raison: 'vide' };
  }
  if (cv.type === 'imported') {
    const d = depuisCvImporte(cv.content);
    return d && aDesRubriques(d) ? { ok: true, donnees: d } : { ok: false, raison: 'vide' };
  }
  return { ok: false, raison: 'type' };
}

export const libelleTypeCv = (type: string): string => (type === 'created' ? 'CV créé sur Facilité' : 'CV importé');

/** « 3 langues · 2 expériences » : ce que contient le CV (rubriques vides omises). */
export function resumeContenuCv(d: DonneesExtraites): string {
  const plur = (n: number, s: string, p: string) => `${n} ${n > 1 ? p : s}`;
  const parties = [
    d.languages.length ? plur(d.languages.length, 'langue', 'langues') : '',
    d.experiences.length ? plur(d.experiences.length, 'expérience', 'expériences') : '',
    d.educations.length ? plur(d.educations.length, 'formation', 'formations') : '',
    d.skills.length ? plur(d.skills.length, 'compétence', 'compétences') : '',
    d.interests.length ? plur(d.interests.length, "centre d'intérêt", "centres d'intérêt") : '',
  ].filter(Boolean);
  return parties.join(' · ');
}

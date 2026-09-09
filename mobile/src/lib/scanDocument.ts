import { supabase } from '@/lib/supabase';

// Client mobile pour les deux endpoints réels déjà utilisés par
// src/app/profil/page.js (handleImportAndParseCv) côté web — aucune route
// API n'est créée ici, seulement appelée depuis l'app native. Même ordre
// de priorité que le web : on vérifie TOUJOURS d'abord si le document est
// une pièce d'identité (CNI/passeport, endpoint 100% éphémère, rien
// stocké) avant de tenter l'extraction CV générique — une pièce
// d'identité ne doit jamais atteindre /api/parse-document.
//
// Volontairement permissif sur le type de fichier envoyé (photo OU PDF/
// Word) : c'est le serveur (Gemini) qui décide de la nature du document,
// pas un filtre client — cohérent avec le choix produit déjà fait pour ce
// bouton côté web (aucune restriction de type avant l'appel), important
// pour des utilisateurs qui ne savent pas toujours lire les instructions
// de format.
const SITE_URL = 'https://ffacilite.com';

export type ResultatScanIdentite = {
  isIdentityDocument: boolean;
  nom?: string;
  prenom?: string;
  quartier?: string;
  error?: string;
};

export type LangueExtraite = { name: string; level: string };
export type ExperienceExtraite = {
  title: string;
  company: string;
  location?: string;
  startYear?: string;
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
  degrade: boolean;
};

async function enteteAuth(): Promise<Record<string, string> | undefined> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

function construireFormData(uri: string, nomFichier: string, type: string): FormData {
  const formData = new FormData();
  // Forme spécifique à React Native (pas la Blob web standard) — acceptée
  // par le FormData polyfill RN pour un fichier local via son URI.
  formData.append('file', { uri, name: nomFichier, type } as unknown as Blob);
  return formData;
}

export async function scannerPieceIdentite(
  uri: string,
  nomFichier: string,
  type: string
): Promise<ResultatScanIdentite> {
  const headers = await enteteAuth();
  const reponse = await fetch(`${SITE_URL}/api/profil/scan-identity-document`, {
    method: 'POST',
    headers,
    body: construireFormData(uri, nomFichier, type),
  });
  const resultat = await reponse.json().catch(() => ({}));
  if (!reponse.ok) {
    return { isIdentityDocument: false, error: resultat?.error || "Erreur lors de l'analyse du document." };
  }
  return resultat;
}

function texte(source: unknown, cles: string[]): string {
  if (!source || typeof source !== 'object') return '';
  for (const cle of cles) {
    const v = (source as Record<string, unknown>)[cle];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

function mapperChampsExtraits(fields: Record<string, unknown>): Omit<DonneesExtraites, 'degrade'> {
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
      const anneeMatch = dates.match(/\d{4}/);
      const title = texte(x, ['poste', 'title']);
      if (!title) return null;
      return {
        title,
        company: texte(x, ['entreprise', 'company']),
        location: texte(x, ['localisation', 'location']) || undefined,
        startYear: anneeMatch?.[0] || texte(x, ['startYear']) || undefined,
        isCurrent: /présent|present|en cours/i.test(dates),
      };
    })
    .filter((x): x is ExperienceExtraite => x !== null);

  return { fullName, headline, bio, city, phone, email, languages, experiences };
}

export async function analyserDocument(
  uri: string,
  nomFichier: string,
  type: string
): Promise<{ ok: true; donnees: DonneesExtraites } | { ok: false; erreur: string }> {
  const headers = await enteteAuth();
  const reponse = await fetch(`${SITE_URL}/api/parse-document`, {
    method: 'POST',
    headers,
    body: construireFormData(uri, nomFichier, type),
  });
  const resultat = await reponse.json().catch(() => ({}));
  if (!reponse.ok || resultat?.success === false) {
    return {
      ok: false,
      erreur: resultat?.error || "L'analyse du document a échoué. Réessayez ou saisissez vos informations manuellement.",
    };
  }
  const fields = (resultat.fields || resultat.data || {}) as Record<string, unknown>;
  return { ok: true, donnees: { ...mapperChampsExtraits(fields), degrade: Boolean(resultat.degraded) } };
}

import { Platform } from 'react-native';
import { mapperChampsExtraits, type DonneesExtraites } from '@/lib/scanLogique';

// Les types et la lecture des champs extraits (réutilisés pour les CV déjà enregistrés sur Facilité) vivent dans scanLogique.ts.
export type { DonneesExtraites, ExperienceExtraite, FormationExtraite, LangueExtraite } from '@/lib/scanLogique';
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

async function enteteAuth(): Promise<Record<string, string> | undefined> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

async function construireFormData(uri: string, nomFichier: string, type: string): Promise<FormData> {
  const formData = new FormData();
  if (Platform.OS === 'web') {
    // Navigateur (aperçu web) : la forme { uri, name, type } n'y existe pas,
    // il faut un vrai Blob.
    const blob = await (await fetch(uri)).blob();
    formData.append('file', blob, nomFichier);
    return formData;
  }
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
    body: await construireFormData(uri, nomFichier, type),
  });
  const resultat = await reponse.json().catch(() => ({}));
  if (!reponse.ok) {
    return { isIdentityDocument: false, error: resultat?.error || "Erreur lors de l'analyse du document." };
  }
  return resultat;
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
    body: await construireFormData(uri, nomFichier, type),
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

import * as DocumentPicker from 'expo-document-picker';

import { supabase } from '@/lib/supabase';
import { SITE_URL } from '@/lib/webEcrans';

// Candidature rapide (maquettes 08 « Candidature Rapide » et 09
// « Candidature Envoyée »). Port natif de src/components/ApplyModal.jsx :
// aucune route n'est créée, on appelle la même `/api/postuler` que le site,
// avec le jeton de session en Bearer et le même FormData. C'est la route qui
// fait le travail — envoi de l'e-mail au recruteur, copie dans la
// messagerie, enregistrement de la candidature, règles métier.
//
// Règle métier relayée par la route ET vérifiée ici avant d'ouvrir le
// formulaire : un e-mail CONFIRMÉ est obligatoire pour candidater. Un compte
// créé par téléphone n'en a pas.

export type CvEnregistre = {
  id: string;
  titre: string;
  creeLe: string;
};

export type ContexteCandidature = {
  nomComplet: string;
  email: string;
  emailConfirme: boolean;
  cvs: CvEnregistre[];
};

export type OffrePourCandidature = {
  id: string;
  titre: string;
  entreprise: string;
  contactEmail?: string;
};

/** « 29/08/2026 » sous chaque CV de la liste. */
export function dateCourte(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export async function chargerContexteCandidature(userId: string): Promise<ContexteCandidature> {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData.session?.user;

  const { data: profil } = await supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle();

  // Seuls les CV qui ont un vrai fichier (comme le site), le CV épinglé
  // d'abord, puis les plus récents.
  const { data: lignes } = await supabase
    .from('resumes')
    .select('id, title, created_at')
    .eq('user_id', userId)
    .not('file_url', 'is', null)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false });

  const meta = user?.user_metadata as { full_name?: string } | undefined;
  return {
    nomComplet: profil?.full_name || meta?.full_name || (user?.email ? user.email.split('@')[0] : ''),
    email: user?.email ?? '',
    emailConfirme: Boolean(user?.email_confirmed_at),
    cvs: (lignes ?? []).map((l) => ({ id: l.id as string, titre: (l.title as string) || 'CV', creeLe: l.created_at as string })),
  };
}

/** Candidature déjà envoyée sur CETTE offre : évite de remplir le formulaire pour rien. */
export async function dejaPostule(userId: string, offreId: string): Promise<boolean> {
  const { count } = await supabase
    .from('candidatures')
    .select('id', { count: 'exact', head: true })
    .eq('job_offer_id', offreId)
    .eq('user_id', userId);
  return (count ?? 0) > 0;
}

export type FichierLocal = { uri: string; nom: string; type: string };

const TAILLE_MAX_O = 10 * 1024 * 1024; // PDF, DOCX jusqu'à 10 Mo, comme la maquette

/** Sélecteur de fichier PDF / Word. Renvoie null si l'utilisateur ferme sans choisir. */
export async function choisirFichierCv(): Promise<FichierLocal | null> {
  const choix = await DocumentPicker.getDocumentAsync({
    type: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (choix.canceled || !choix.assets?.length) return null;
  const f = choix.assets[0];
  if (typeof f.size === 'number' && f.size > TAILLE_MAX_O) {
    throw new Error('Fichier trop lourd : 10 Mo maximum.');
  }
  return { uri: f.uri, nom: f.name || 'cv.pdf', type: f.mimeType || 'application/pdf' };
}

export async function envoyerCandidature(champs: {
  offre: OffrePourCandidature;
  nomComplet: string;
  email: string;
  emailRecruteur: string;
  objet: string;
  message: string;
  cvExistantsIds: string[];
  nouveauxFichiers: FichierLocal[];
}): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const jeton = data.session?.access_token;
  if (!jeton) throw new Error('Votre session a expiré. Veuillez vous reconnecter.');

  const formData = new FormData();
  formData.append('jobId', champs.offre.id);
  formData.append('jobTitle', champs.offre.titre);
  formData.append('subject', champs.objet.trim());
  formData.append('company', champs.offre.entreprise);
  formData.append('fullName', champs.nomComplet.trim());
  formData.append('email', champs.email.trim());
  formData.append('coverLetter', champs.message.trim());
  if (champs.emailRecruteur.trim()) formData.append('recruiterEmail', champs.emailRecruteur.trim());

  champs.cvExistantsIds.forEach((id) => formData.append('existingCvIds', id));
  champs.nouveauxFichiers.forEach((f) => {
    // Forme propre à React Native pour un fichier local (pas la Blob web).
    formData.append('cvFiles', { uri: f.uri, name: f.nom, type: f.type } as unknown as Blob);
  });
  // Compatibilité avec les anciens champs au singulier lus par la route.
  if (champs.cvExistantsIds.length > 0) formData.append('existingCvId', champs.cvExistantsIds[0]);
  if (champs.nouveauxFichiers.length > 0) {
    const f = champs.nouveauxFichiers[0];
    formData.append('cvFile', { uri: f.uri, name: f.nom, type: f.type } as unknown as Blob);
  }

  const reponse = await fetch(`${SITE_URL}/api/postuler`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${jeton}` },
    body: formData,
  });
  const resultat = await reponse.json().catch(() => ({}));

  if (!reponse.ok || !resultat?.success) {
    const err = resultat?.error;
    const message =
      typeof err === 'object' && err !== null
        ? err.message || "Une erreur est survenue lors de l'envoi."
        : err || "Une erreur est survenue lors de l'envoi.";
    throw new Error(String(message));
  }
}

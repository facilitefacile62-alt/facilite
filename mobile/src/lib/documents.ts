import * as DocumentPicker from 'expo-document-picker';

import { supabase } from '@/lib/supabase';

// Documents du profil (maquettes « Profil — Documents » 37 et
// « Visionneuse PDF » 39). Mêmes conventions que le site
// (src/app/profil/page.js), vérifiées ligne à ligne :
// - table `public.resumes` : title, type (« CV », « Lettre de motivation »…),
//   file_url, created_at ; RLS par propriétaire.
// - bucket PRIVÉ `resumes`, chemin `${userId}/cvs/${horodatage}.${ext}` —
//   l'URL n'est jamais publique, elle est signée à la demande.
// - suppression via la fonction SECURITY DEFINER `delete_own_resume`, qui
//   renvoie le chemin de stockage à retirer ensuite.

const BUCKET = 'resumes';
const DUREE_URL_SIGNEE_S = 300;

export type DocumentProfil = {
  id: string;
  titre: string;
  categorie: string | null;
  chemin: string | null;
  creeLe: string;
  /** Seule la pièce d'identité est une image ; tout le reste est un PDF. */
  estImage: boolean;
};

type LigneResume = {
  id: string;
  title: string | null;
  type: string | null;
  file_url: string | null;
  created_at: string;
};

function extension(nom: string): string {
  const m = /\.([a-z0-9]+)(?:\?|$)/i.exec(nom || '');
  return m ? m[1].toLowerCase() : '';
}

export function estFichierImage(nomOuChemin: string): boolean {
  return ['jpg', 'jpeg', 'png', 'webp', 'heic', 'gif'].includes(extension(nomOuChemin));
}

/** « PDF » ou « PHOTO » — la pastille de la maquette 37. */
export function badgeDocument(d: DocumentProfil): string {
  return d.estImage ? 'PHOTO' : 'PDF';
}

/** "05/09/2026" — format court sous le nom du document. */
export function dateLisible(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const jj = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${jj}/${mm}/${d.getFullYear()}`;
}

function versDocument(r: LigneResume): DocumentProfil {
  const chemin = r.file_url ?? null;
  const titre = r.title || 'Document';
  return {
    id: r.id,
    titre,
    categorie: r.type ?? null,
    chemin,
    creeLe: r.created_at,
    estImage: estFichierImage(titre) || (chemin ? estFichierImage(chemin) : false),
  };
}

export async function chargerMesDocuments(userId: string): Promise<DocumentProfil[]> {
  const { data, error } = await supabase
    .from('resumes')
    .select('id, title, type, file_url, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as LigneResume[]).map(versDocument);
}

/**
 * URL consultable d'un document. Le bucket est privé : on signe le chemin.
 * Les anciennes lignes peuvent contenir une URL complète ou un base64 de
 * secours (voir le site) — dans ce cas on la renvoie telle quelle.
 */
export async function urlDocument(chemin: string | null): Promise<string | null> {
  if (!chemin) return null;
  if (/^(https?:|data:)/.test(chemin)) return chemin;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(chemin, DUREE_URL_SIGNEE_S);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function supprimerDocument(id: string): Promise<void> {
  const { data: chemin, error } = await supabase.rpc('delete_own_resume', { resume_id: id });
  if (error) throw new Error(error.message);
  if (typeof chemin === 'string' && chemin && !/^(https?:|data:)/.test(chemin)) {
    // Échec de nettoyage du fichier : la ligne est déjà supprimée, le
    // document n'apparaît plus. On ne fait pas échouer l'action pour ça.
    await supabase.storage.from(BUCKET).remove([chemin]).catch(() => {});
  }
}

// Décodage base64 sans dépendre d'atob : sa présence n'est pas garantie
// dans Hermes selon les versions, et expo-file-system n'est pas installé.
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function decoderBase64(b64: string): Uint8Array {
  const propre = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const octets = new Uint8Array((propre.length * 3) >> 2);
  let n = 0;
  for (let i = 0; i < propre.length; i += 4) {
    const a = ALPHABET.indexOf(propre[i]);
    const b = ALPHABET.indexOf(propre[i + 1]);
    const c = ALPHABET.indexOf(propre[i + 2]);
    const d = ALPHABET.indexOf(propre[i + 3]);
    octets[n++] = (a << 2) | (b >> 4);
    if (c >= 0) octets[n++] = ((b & 15) << 4) | (c >> 2);
    if (d >= 0) octets[n++] = ((c & 3) << 6) | d;
  }
  return octets.subarray(0, n);
}

async function fichierEnOctets(uri: string): Promise<Uint8Array> {
  const reponse = await fetch(uri);
  const blob = await reponse.blob();
  const base64 = await new Promise<string>((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onerror = () => reject(new Error('Lecture du fichier impossible.'));
    lecteur.onload = () => resolve(String(lecteur.result ?? '').split(',')[1] ?? '');
    lecteur.readAsDataURL(blob);
  });
  if (!base64) throw new Error('Fichier vide.');
  return decoderBase64(base64);
}

const TAILLE_MAX_O = 10 * 1024 * 1024; // 10 Mo, comme le site

/**
 * Ajout d'un document depuis le téléphone. Renvoie null si l'utilisateur
 * a simplement fermé le sélecteur.
 */
export async function ajouterDocument(userId: string): Promise<DocumentProfil | null> {
  const choix = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'image/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (choix.canceled || !choix.assets?.length) return null;

  const fichier = choix.assets[0];
  if (typeof fichier.size === 'number' && fichier.size > TAILLE_MAX_O) {
    throw new Error('Fichier trop lourd : 10 Mo maximum.');
  }

  const nom = fichier.name || 'document';
  const ext = extension(nom) || (fichier.mimeType === 'application/pdf' ? 'pdf' : 'jpg');
  const chemin = `${userId}/cvs/${Date.now()}.${ext}`;
  const octets = await fichierEnOctets(fichier.uri);

  const { error: errEnvoi } = await supabase.storage.from(BUCKET).upload(chemin, octets, {
    contentType: fichier.mimeType || (ext === 'pdf' ? 'application/pdf' : 'image/jpeg'),
    upsert: true,
  });
  if (errEnvoi) throw new Error(errEnvoi.message);

  const { data, error } = await supabase
    .from('resumes')
    .insert({
      user_id: userId,
      title: nom,
      // La classification automatique (CV / lettre) est faite par une route
      // serveur côté site ; ici on enregistre le document sans deviner sa
      // nature plutôt que de lui coller une étiquette fausse.
      type: 'imported',
      file_url: chemin,
      content: { fileName: nom, uploadedAt: new Date().toISOString() },
    })
    .select('id, title, type, file_url, created_at')
    .single();
  if (error) throw new Error(error.message);
  return versDocument(data as LigneResume);
}

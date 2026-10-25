import { supabase } from '@/lib/supabase';
import { SITE_URL } from '@/lib/webEcrans';

// « Informations du compte » — client des routes /api/compte/* du site (mêmes routes, mêmes règles, mêmes phrases que sur le site et dans Locaux).
// Ce fichier n'applique AUCUNE règle et n'écrit JAMAIS e-mail ou téléphone dans une table : il transmet les gestes au serveur et affiche ce qu'il répond.

export type Canal = 'email' | 'telephone';

export type EtatCompte = {
  email: string | null;
  emailVerifie: boolean;
  telephone: string | null;
  telephoneVerifie: boolean;
  peutDissocierEmail: boolean;
  peutDissocierTelephone: boolean;
  telephoneActif: boolean;
};

export type ReponseCompte = {
  ok: boolean;
  message?: string;
  code?: string;
  etat?: EtatCompte;
  autorisation?: string;
  dejaVerifie?: boolean;
  envoyeA?: string;
  evenements?: { libelle: string; moyen: string | null; reussi: boolean; date: string }[];
};

const PANNE = 'Impossible pour le moment. Rien n\'a été changé. Réessayez plus tard ou contactez-nous.';

async function appeler(chemin: string, corps?: Record<string, unknown>): Promise<ReponseCompte> {
  const { data } = await supabase.auth.getSession();
  const jeton = data.session?.access_token;
  if (!jeton) return { ok: false, message: 'Votre session a expiré. Reconnectez-vous.' };
  try {
    const reponse = await fetch(`${SITE_URL}/api/compte/${chemin}`, {
      method: corps ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${jeton}`, ...(corps ? { 'Content-Type': 'application/json' } : {}) },
      ...(corps ? { body: JSON.stringify(corps) } : {}),
    });
    const donnees = (await reponse.json().catch(() => ({}))) as ReponseCompte;
    return { ...donnees, ok: reponse.ok && donnees.ok !== false, message: donnees.message ?? (reponse.ok ? undefined : PANNE) };
  } catch {
    return { ok: false, message: PANNE };
  }
}

export const lireEtatCompte = () => appeler('etat');
export const lireActiviteCompte = () => appeler('activite');
export const envoyerPreuve = (canal: Canal) => appeler('preuve/envoyer', { canal });
export const verifierPreuve = (canal: Canal, code: string) => appeler('preuve/verifier', { canal, code });
export const demanderChangement = (canal: Canal, valeur: string, autorisation: string) => appeler('changer/demander', { canal, valeur, autorisation });
export const confirmerChangement = (canal: Canal, code: string, autorisation: string) => appeler('changer/confirmer', { canal, code, autorisation });
export const dissocierMoyen = (canal: Canal, autorisation: string) => appeler('dissocier', { canal, autorisation });

// Textes de l'écran : ceux du site (src/app/informations-compte/InformationsCompte.jsx et src/lib/compte/messages.js). Un test vérifie qu'ils restent identiques.
export const NOMS: Record<Canal, { le: string; titre: string; phrase: string; changer: string; retirer: string; champ: string; saisie: string }> = {
  email: {
    le: "l'adresse e-mail",
    titre: 'Adresse e-mail',
    phrase: "Cette adresse sert à vous connecter et à protéger votre compte. Personne d'autre ne la voit.",
    changer: "Changer d'adresse e-mail",
    retirer: "Dissocier l'e-mail",
    champ: 'Nouvelle adresse e-mail',
    saisie: 'exemple@gmail.com',
  },
  telephone: {
    le: 'le numéro',
    titre: 'Téléphone',
    phrase: "Ce numéro sert à vous connecter et à protéger votre compte. Personne d'autre ne le voit.",
    changer: 'Changer de téléphone',
    retirer: 'Dissocier le téléphone',
    champ: 'Nouveau numéro',
    saisie: '77 123 45 67',
  },
};

export const SUPPORT_PERDU = {
  titre: "Je n'ai plus accès",
  phrase: "Nous allons vous aider. Rien ne change tant que nous n'avons pas vérifié que c'est bien vous.",
  informations: ['Votre nom', "L'ancien numéro ou l'ancienne adresse e-mail (même si vous ne les avez plus)", 'La date approximative de création de votre compte', "Une photo de votre pièce d'identité"],
};

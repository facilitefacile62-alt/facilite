// Interrupteurs de fonctionnalités : les MÊMES que ceux du site (table feature_flags,
// Administration → Fonctionnalités). L'administrateur coupe ou ouvre une fonction depuis le site et
// l'application suit, sans nouveau build. Les valeurs par défaut ci-dessous reprennent celles du site
// (src/lib/featureFlags.js) : elles servent tant que la table n'est pas chargée, ou si elle est
// injoignable — une fonction en pause (voyages, IA) reste donc coupée.
import { useEffect, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

type Roles = { user?: boolean; recruiter?: boolean; visitor?: boolean };
type Interrupteur = { enabled: boolean; roles: Roles };

const TOUS: Roles = { user: true, recruiter: true, visitor: true };
const CONNECTES: Roles = { user: true, recruiter: true, visitor: false };
const actif = (roles: Roles = TOUS): Interrupteur => ({ enabled: true, roles });
const coupe = (roles: Roles = TOUS): Interrupteur => ({ enabled: false, roles });

// Seuls les interrupteurs qui ont un équivalent dans l'application sont listés. Un identifiant
// inconnu est AUTORISÉ (comme sur le site).
const PAR_DEFAUT: Record<string, Interrupteur> = {
  nav_offres: actif(),
  nav_extracteur: actif(),
  nav_messagerie: actif(),
  nav_marketplace: actif(),
  nav_marketplace_livreur: actif(CONNECTES),
  nav_marketplace_voyages: coupe(CONNECTES),
  nav_plus_fonctionnalites: actif(),
  nav_plus_recrutement_spontane: actif(),
  feat_diagnostic_cv: actif(),
  feat_voice_assistant: coupe({ user: false, recruiter: false, visitor: false }),
  feat_marketplace_ia: coupe(),
};

let etat: Record<string, Interrupteur> = { ...PAR_DEFAUT };
let charge = false;
const abonnes = new Set<() => void>();
let canal: ReturnType<typeof supabase.channel> | null = null;

function diffuser() {
  abonnes.forEach((cb) => cb());
}

async function charger() {
  const { data, error } = await supabase.from('feature_flags').select('id, enabled, roles');
  if (error || !data) return; // injoignable : on garde l'état courant (valeurs par défaut au départ)
  const suivant = { ...PAR_DEFAUT };
  for (const ligne of data as { id: string; enabled: boolean; roles: Roles | null }[]) {
    // Comme sur le site : une ligne ne remplace que les interrupteurs que l'application connaît.
    if (suivant[ligne.id] || ligne.id in PAR_DEFAUT) {
      suivant[ligne.id] = {
        enabled: typeof ligne.enabled === 'boolean' ? ligne.enabled : suivant[ligne.id].enabled,
        roles: { ...suivant[ligne.id].roles, ...(ligne.roles ?? {}) },
      };
    }
  }
  etat = suivant;
  charge = true;
  diffuser();
}

function assurerCanal() {
  if (canal) return;
  canal = supabase
    .channel('feature-flags-app')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'feature_flags' }, () => {
      void charger();
    })
    .subscribe();
}

type Role = 'admin' | 'recruiter' | 'user' | 'visitor';

/** Vrai si la fonctionnalité est ouverte pour ce rôle (l'administrateur a toujours accès à tout). */
export function fonctionnaliteAutorisee(id: string, role: Role, instantane: Record<string, Interrupteur> = etat): boolean {
  if (role === 'admin') return true;
  const f = instantane[id];
  if (!f) return true;
  if (!f.enabled) return false;
  return f.roles?.[role] !== false;
}

// L'état des interrupteurs est gardé DANS l'état du composant (et pas seulement dans la variable du
// module) : sinon le compilateur React ne voit aucune dépendance qui change et conserve l'ancien
// affichage quand l'administrateur coupe ou ouvre un interrupteur sur le site.
function useInstantane(): Record<string, Interrupteur> {
  const [instantane, setInstantane] = useState(etat);
  useEffect(() => {
    const cb = () => setInstantane(etat);
    abonnes.add(cb);
    assurerCanal();
    if (charge) cb();
    else void charger();
    return () => {
      abonnes.delete(cb);
    };
  }, []);
  return instantane;
}

function useRole(): Role {
  const { user, isAdmin, isRecruiter } = useAuth();
  return !user ? 'visitor' : isAdmin ? 'admin' : isRecruiter ? 'recruiter' : 'user';
}

/** Hook : l'interrupteur `id` est-il ouvert pour l'utilisateur courant ? Suit les changements en direct. */
export function useFonctionnalite(id: string): boolean {
  const instantane = useInstantane();
  return fonctionnaliteAutorisee(id, useRole(), instantane);
}

/** Pour une liste d'éléments associés chacun à un interrupteur : renvoie un prédicat « visible ? ». */
export function useFonctionnalites(): (id: string | undefined) => boolean {
  const instantane = useInstantane();
  const role = useRole();
  return (id) => (id ? fonctionnaliteAutorisee(id, role, instantane) : true);
}

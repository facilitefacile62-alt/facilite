// Interrupteurs de fonctionnalités : les MÊMES que ceux du site (table feature_flags,
// Administration → Fonctionnalités). L'administrateur coupe ou ouvre une fonction depuis le site et
// l'application suit, sans nouveau build. Les valeurs par défaut ci-dessous reprennent celles du site
// (src/lib/featureFlags.js) : elles servent tant que la table n'est pas chargée, ou si elle est
// injoignable — une fonction en pause (voyages, IA) reste donc coupée.
import { useEffect, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import { PAR_DEFAUT, fonctionnaliteAutorisee as autorisee, tousAutorises, type Interrupteur, type Role, type Roles } from '@/lib/featureFlagsLogique';
import { supabase } from '@/lib/supabase';

/** Vrai si la fonctionnalité est ouverte pour ce rôle (l'administrateur a toujours accès à tout). Sans instantané fourni : l'état courant. */
export function fonctionnaliteAutorisee(id: string, role: Role, instantane: Record<string, Interrupteur> = etat): boolean {
  return autorisee(id, role, instantane);
}

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
export function useFonctionnalites(): (id: string | string[] | undefined) => boolean {
  const instantane = useInstantane();
  const role = useRole();
  // Plusieurs interrupteurs : tous doivent être ouverts (ex. un interrupteur partagé avec le site ET un interrupteur propre à l'application).
  return (id) => tousAutorises(id, role, instantane);
}

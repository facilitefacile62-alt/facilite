import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

// Stories déjà vues, mémorisées sur l'appareil (aucune colonne en base : c'est une préférence locale).
// Non vue = anneau vert ; vue = anneau gris. Le magasin est partagé entre la rangée du fil et l'en-tête
// (petits cercles près du logo) pour qu'ils restent d'accord, sans doublon.
const CLE = 'FACILITE_STORIES_VUES_V1';

let vues = new Set<string>();
let charge = false;
const abonnes = new Set<() => void>();

function diffuser() {
  abonnes.forEach((cb) => cb());
}

async function charger() {
  try {
    const brut = await AsyncStorage.getItem(CLE);
    const liste = brut ? (JSON.parse(brut) as string[]) : [];
    vues = new Set([...liste, ...vues]);
  } catch {
    // Stockage illisible : on repart d'une liste vide, sans gravité.
  }
  // Connecté : on y ajoute les stories vues enregistrées sur le compte (autre appareil, nouvelle installation).
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      const { data: lignes } = await supabase.from('stories_vues').select('story_id');
      if (lignes?.length) vues = new Set([...vues, ...lignes.map((l) => l.story_id as string)]);
    }
  } catch {
    // Hors connexion : la mémoire locale suffit.
  }
  charge = true;
  diffuser();
}

/** Marque une story comme vue (mémorisé tout de suite en local). */
export function marquerStoryVue(id: string): void {
  if (vues.has(id)) return;
  vues = new Set(vues).add(id);
  diffuser();
  AsyncStorage.setItem(CLE, JSON.stringify([...vues])).catch(() => {});
  // Et sur le compte, si l'utilisateur est connecté (sans bloquer ni échouer si le réseau manque).
  supabase.auth
    .getSession()
    .then(({ data }) => (data.session ? supabase.rpc('marquer_story_vue', { p_story_id: id }) : null))
    .catch(() => {});
}

/** Les identifiants des stories vues ; se met à jour dès qu'une story est marquée vue. */
export function useStoriesVues(): Set<string> {
  const [etat, setEtat] = useState(vues);
  useEffect(() => {
    const cb = () => setEtat(vues);
    abonnes.add(cb);
    if (charge) cb();
    else void charger();
    return () => {
      abonnes.delete(cb);
    };
  }, []);
  return etat;
}

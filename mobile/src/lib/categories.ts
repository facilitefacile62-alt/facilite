import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

// Arbre des catégories de « Publier un produit » : 9 catégories, leurs sous-catégories et leurs types, stockés en base
// (table categories, lue par la fonction lister_categories) — jamais écrits en dur dans l'application.
export type Categorie = { id: string; parentId: string | null; libelle: string; icone: string; ordre: number };

let cache: Categorie[] | null = null;
let enCours: Promise<Categorie[]> | null = null;

export async function chargerCategories(): Promise<Categorie[]> {
  if (cache) return cache;
  if (!enCours) {
    enCours = Promise.resolve(supabase.rpc('lister_categories'))
      .then(({ data, error }) => {
        if (error) throw new Error(error.message);
        cache = ((data ?? []) as { id: string; parent_id: string | null; libelle: string; icone: string; ordre: number }[]).map((c) => ({
          id: c.id,
          parentId: c.parent_id,
          libelle: c.libelle,
          icone: c.icone,
          ordre: c.ordre,
        }));
        return cache;
      })
      .finally(() => {
        enCours = null;
      });
  }
  return enCours;
}

/** L'arbre, chargé une fois : `null` pendant le chargement, `[]` si la base est injoignable. */
export function useCategories(): Categorie[] | null {
  const [liste, setListe] = useState<Categorie[] | null>(cache);
  useEffect(() => {
    if (cache) return;
    let annule = false;
    chargerCategories()
      .then((l) => {
        if (!annule) setListe(l);
      })
      .catch(() => {
        if (!annule) setListe([]);
      });
    return () => {
      annule = true;
    };
  }, []);
  return liste;
}

export const racinesDe = (liste: Categorie[]) => liste.filter((c) => c.parentId === null);
export const enfantsDe = (liste: Categorie[], id: string) => liste.filter((c) => c.parentId === id);
export const trouver = (liste: Categorie[], id: string | null | undefined) => (id ? liste.find((c) => c.id === id) ?? null : null);

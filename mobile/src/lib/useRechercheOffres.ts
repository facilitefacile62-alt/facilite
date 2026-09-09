import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

// Recherche pour recherche.tsx — reproduction de
// design_handoff_facilite/pages/04-recherche.html. job_offers n'a pas de
// colonne "secteur" : les catégories populaires sont donc de vrais
// filtres par mot-clé sur title/description (approximatif mais réel),
// pas une simple liste décorative.
export type ResultatRecherche = {
  id: string;
  logoBg: string;
  logo: string;
  titre: string;
  entreprise: string;
  localisation: string;
};

const CLE_RECHERCHES_RECENTES = 'FACILITE_RECHERCHES_RECENTES_V1';
const NB_RECHERCHES_RECENTES = 4;

const TEINTES = ['#2563EB', '#10B981', '#F59E0B'];

function initiales(nom: string): string {
  const mots = nom.trim().split(/\s+/).filter(Boolean);
  if (mots.length === 0) return 'FA';
  if (mots.length === 1) return mots[0].slice(0, 2).toUpperCase();
  return (mots[0][0] + mots[1][0]).toUpperCase();
}

function teinte(id: string): string {
  let somme = 0;
  for (let i = 0; i < id.length; i++) somme += id.charCodeAt(i);
  return TEINTES[somme % TEINTES.length];
}

export function useRechercheOffres(requete: string) {
  const [resultats, setResultats] = useState<ResultatRecherche[] | null>(null);

  useEffect(() => {
    const q = requete.trim();
    if (!q) {
      // setState différé : corps de l'effet, pas un callback d'un système
      // externe — exigé par la règle react-hooks correspondante.
      queueMicrotask(() => setResultats(null));
      return;
    }

    let annule = false;
    const t = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from('job_offers')
          .select('id, title, company, location')
          .eq('is_active', true)
          .or(`title.ilike.%${q}%,company.ilike.%${q}%,description.ilike.%${q}%`)
          .limit(20);

        if (annule) return;
        if (error || !data) {
          setResultats([]);
          return;
        }

        setResultats(
          data.map((o) => ({
            id: o.id,
            logoBg: teinte(o.id),
            logo: initiales(o.company || ''),
            titre: o.title || 'Offre',
            entreprise: o.company || 'Entreprise',
            localisation: o.location || 'Sénégal',
          }))
        );
      } catch (err) {
        console.error('Exception recherche offres:', err);
        if (!annule) setResultats([]);
      }
    }, 300);

    return () => {
      annule = true;
      clearTimeout(t);
    };
  }, [requete]);

  return resultats;
}

/** Historique réel des dernières recherches effectuées (persisté sur l'appareil). */
export function useRecherchesRecentes() {
  const [recherches, setRecherches] = useState<string[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(CLE_RECHERCHES_RECENTES)
      .then((brut) => {
        if (brut) setRecherches(JSON.parse(brut));
      })
      .catch(() => {});
  }, []);

  function enregistrerRecherche(texte: string) {
    const q = texte.trim();
    if (!q) return;
    setRecherches((prev) => {
      const suivant = [q, ...prev.filter((r) => r.toLowerCase() !== q.toLowerCase())].slice(
        0,
        NB_RECHERCHES_RECENTES
      );
      AsyncStorage.setItem(CLE_RECHERCHES_RECENTES, JSON.stringify(suivant)).catch(() => {});
      return suivant;
    });
  }

  return { recherches, enregistrerRecherche };
}

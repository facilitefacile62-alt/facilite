import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

// Fil d'offres réel — remplace les données de démonstration de
// (tabs)/index.tsx. Mêmes champs que ceux réellement lus côté web
// (src/app/page.js: getInitialOffers) : title, company, location,
// contract_type, image_url — job_offers n'a pas de colonne logo/couleur,
// ces deux-là sont dérivées ici, comme le fait déjà HomeClient.jsx côté web
// (bg-blue-100 text-blue-700 par défaut) quand une offre n'a pas de logo.
export type OffreReelle = {
  id: string;
  entreprise: string;
  logoTeinte: string;
  logoInitiales: string;
  date: string;
  titre: string;
  localisation: string;
  contrat: string;
  posterUri?: string;
};

const TEINTES = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500'];

function initiales(nom: string): string {
  const mots = nom.trim().split(/\s+/).filter(Boolean);
  if (mots.length === 0) return 'FA';
  if (mots.length === 1) return mots[0].slice(0, 2).toUpperCase();
  return (mots[0][0] + mots[1][0]).toUpperCase();
}

function dateRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const heures = Math.floor(diffMs / 3_600_000);
  if (heures < 1) return "à l'instant";
  if (heures < 24) return `il y a ${heures} h`;
  const jours = Math.floor(heures / 24);
  return `il y a ${jours} j`;
}

export function useOffresReelles(limite = 20) {
  const [offres, setOffres] = useState<OffreReelle[] | null>(null); // null = chargement en cours
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    let annule = false;

    async function charger() {
      try {
        const { data, error } = await supabase
          .from('job_offers')
          .select('id, title, company, location, contract_type, image_url, created_at')
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(limite);

        if (error || !data) {
          if (!annule) setErreur(true);
          return;
        }

        const mapped: OffreReelle[] = data.map((o, idx) => ({
          id: o.id,
          entreprise: o.company || 'Entreprise',
          logoTeinte: TEINTES[idx % TEINTES.length],
          logoInitiales: initiales(o.company || ''),
          date: dateRelative(o.created_at),
          titre: o.title || 'Offre',
          localisation: o.location || 'Sénégal',
          contrat: o.contract_type || 'CDI',
          posterUri: o.image_url || undefined,
        }));

        if (!annule) setOffres(mapped);
      } catch (err) {
        console.error('Exception chargement des offres réelles:', err);
        if (!annule) setErreur(true);
      }
    }

    charger();
    return () => {
      annule = true;
    };
  }, [limite]);

  return { offres, erreur };
}

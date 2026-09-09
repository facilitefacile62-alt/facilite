import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

// Fiche détaillée d'une offre — pendant "une seule offre" de
// useOffresReelles.ts, mêmes conventions (logo dérivé, date relative).
//
// job_offers n'a pas de colonne "compétences requises" (skillChips du
// handoff) ni de indicateur "remote" fiable — plutôt que d'inventer ces
// deux informations, l'écran les omet honnêtement (voir offre/[id].tsx).
// "Candidats" est en revanche une vraie donnée : compte réel sur
// candidatures.job_offer_id, pas une valeur simulée.
export type OffreDetail = {
  id: string;
  titre: string;
  entreprise: string;
  localisation: string;
  contrat: string;
  salaire: string;
  description: string;
  posted: string;
  logoBg: string;
  logo: string;
  applicantsCount: number;
};

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

function dateRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const heures = Math.floor(diffMs / 3_600_000);
  if (heures < 1) return "à l'instant";
  if (heures < 24) return `il y a ${heures} h`;
  const jours = Math.floor(heures / 24);
  return `il y a ${jours} j`;
}

export function useOffreDetail(id: string | undefined) {
  const [offre, setOffre] = useState<OffreDetail | null>(null);
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    if (!id) return;
    let annule = false;

    async function charger() {
      try {
        const [{ data, error }, { count }] = await Promise.all([
          supabase
            .from('job_offers')
            .select('id, title, company, location, contract_type, salary_range, description, created_at')
            .eq('id', id)
            .single(),
          supabase
            .from('candidatures')
            .select('id', { count: 'exact', head: true })
            .eq('job_offer_id', id),
        ]);

        if (error || !data) {
          if (!annule) setErreur(true);
          return;
        }

        if (!annule) {
          setOffre({
            id: data.id,
            titre: data.title || 'Offre',
            entreprise: data.company || 'Entreprise',
            localisation: data.location || 'Sénégal',
            contrat: data.contract_type || 'CDI',
            salaire: data.salary_range || 'Non précisé',
            description: data.description || 'Aucune description fournie pour cette offre.',
            posted: dateRelative(data.created_at),
            logoBg: teinte(data.id),
            logo: initiales(data.company || ''),
            applicantsCount: count ?? 0,
          });
        }
      } catch (err) {
        console.error('Exception chargement de la fiche offre:', err);
        if (!annule) setErreur(true);
      }
    }

    charger();
    return () => {
      annule = true;
    };
  }, [id]);

  return { offre, erreur };
}

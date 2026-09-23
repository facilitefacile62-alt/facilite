import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getPrimaryOfferImage } from '@/lib/offerMedia';

export type OffreReelle = {
  id: string;
  entreprise: string;
  logoTeinte: string;
  logoInitiales: string;
  date: string;
  titre: string;
  localisation: string;
  contrat: string;
  salaire?: string;
  posterUri?: string;
  rawImage?: unknown;
  description?: string;
  contactEmail?: string;
  contactPhone?: string;
  externalLink?: string;
  deadline?: string;
};

const TEINTES = ['bg-blue-600', 'bg-emerald-600', 'bg-purple-600', 'bg-indigo-600', 'bg-amber-600', 'bg-rose-600'];

function initiales(nom: string): string {
  const mots = nom.trim().split(/\s+/).filter(Boolean);
  if (mots.length === 0) return 'FA';
  if (mots.length === 1) return mots[0].slice(0, 2).toUpperCase();
  return (mots[0][0] + mots[1][0]).toUpperCase();
}

function dateRelative(iso: string): string {
  if (!iso) return "Récemment";
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return minutes <= 1 ? "à l'instant" : `il y a ${minutes} min`;
  const heures = Math.floor(diffMs / 3_600_000);
  if (heures < 24) return `il y a ${heures} h`;
  const jours = Math.floor(heures / 24);
  if (jours < 30) return `il y a ${jours} j`;
  const mois = Math.floor(jours / 30);
  return `il y a ${mois} mois`;
}

export function useOffresReelles(limite = 30) {
  const [offres, setOffres] = useState<OffreReelle[] | null>(null);
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    let annule = false;

    async function charger() {
      try {
        const { data, error } = await supabase
          .from('job_offers')
          .select('id, title, company, location, contract_type, salary_range, description, contact_email, contact_phone, external_link, deadline, image_url, created_at')
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
          salaire: o.salary_range || undefined,
          posterUri: getPrimaryOfferImage(o.image_url),
          rawImage: o.image_url,
          description: o.description || undefined,
          contactEmail: o.contact_email || undefined,
          contactPhone: o.contact_phone || undefined,
          externalLink: o.external_link || undefined,
          deadline: o.deadline || undefined,
        }));

        if (!annule) {
          setOffres(mapped);
          setErreur(false);
        }
      } catch (err) {
        console.error('Exception chargement des offres réelles:', err);
        if (!annule) setErreur(true);
      }
    }

    charger();

    // Abonnement temps réel pour synchroniser immédiatement toute modification/nouvelle offre du site
    const channel = supabase
      .channel('realtime_job_offers_mobile')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_offers' }, () => {
        charger();
      })
      .subscribe();

    return () => {
      annule = true;
      supabase.removeChannel(channel);
    };
  }, [limite]);

  return { offres, erreur };
}

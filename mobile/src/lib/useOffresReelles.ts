import { useCallback, useEffect, useId, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getPrimaryOfferImage } from '@/lib/offerMedia';

// Disponible / expirée — même règle que le site (src/lib/offerExpiration.js,
// isOfferExpired) : une offre est EXPIRÉE si son statut est explicitement
// clos, OU si is_active vaut false (hors brouillon), OU si sa date limite est
// passée (la journée de la date limite reste valable jusqu'à minuit).
//
// Avant cet alignement l'app ne filtrait que sur is_active : 184 offres
// « disponibles » dont 73 avaient déjà dépassé leur date limite (relevé du
// 09/10/2026), et un compteur « Clôturées » écrit en dur à 0. Le filtre est
// posé côté serveur pour que la pagination reste juste ; le statut explicite
// est vérifié en plus après lecture (toutes les offres sont « approved »
// aujourd'hui, c'est une garde pour la suite).
export type EtatOffres = 'disponibles' | 'expirees';

const STATUTS_CLOS = ['expired', 'closed', 'archive', 'archived', 'expiree', 'expirée'];

/** « 2026-10-09 » : date du jour de l'appareil (colonne deadline de type date). */
export function aujourdhuiISO(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const jj = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${jj}`;
}

function statutClos(statut: unknown): boolean {
  return STATUTS_CLOS.includes(String(statut ?? '').toLowerCase().trim());
}

// Le constructeur de requête de supabase-js est générique et son typage
// s'emballe dès qu'on le passe à travers une fonction (TS2589) : on ne s'en
// sert ici que pour chaîner deux filtres identiques des deux côtés.
function appliquerEtat(requete: any, etat: EtatOffres): any {
  const aujourdhui = aujourdhuiISO();
  return etat === 'disponibles'
    ? requete.eq('is_active', true).or(`deadline.is.null,deadline.gte.${aujourdhui}`)
    : requete.or(`is_active.eq.false,deadline.lt.${aujourdhui}`);
}

/** Nombre réel d'offres disponibles / expirées (aucune ligne transférée). */
export async function compterOffres(etat: EtatOffres): Promise<number | null> {
  const { count, error } = await appliquerEtat(
    supabase.from('job_offers').select('id', { count: 'exact', head: true }),
    etat
  );
  return error ? null : (count ?? 0);
}

export type OffreReelle = {
  id: string;
  entreprise: string;
  logoTeinte: string;
  logoInitiales: string;
  date: string;
  dateFormatee: string;
  titre: string;
  localisation: string;
  contrat: string;
  salaire?: string;
  posterUri?: string;
  rawImage?: unknown;
  description?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactWhatsapp?: string;
  externalLink?: string;
  applicationUrl?: string;
  applicationEmail?: string;
  deadline?: string;
  listingType?: string;
  sector?: string;
  positionsCount?: number;
  viewCount?: number;
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

export function useOffresReelles(limite = 30, etat: EtatOffres = 'disponibles') {
  const [offres, setOffres] = useState<OffreReelle[] | null>(null);
  const [erreur, setErreur] = useState(false);
  // Incrémenté par recharger() : force une nouvelle lecture sans changer la
  // limite (tirer pour actualiser, bouton Réessayer).
  const [version, setVersion] = useState(0);
  const recharger = useCallback(() => setVersion((v) => v + 1), []);
  // Un nom de canal PAR instance du hook. L'Accueil et l'onglet Offres l'utilisent tous les deux : avec un nom
  // commun, supabase.channel() renvoie le canal déjà abonné et .on() lève « cannot add postgres_changes callbacks
  // after subscribe() » à l'ouverture du second onglet (plantage constaté le 24/09/2026 sur tablette), et la
  // fermeture de l'un coupait aussi le temps réel de l'autre.
  const idInstance = useId().replace(/[^a-zA-Z0-9]/g, '');

  useEffect(() => {
    let annule = false;

    async function charger() {
      try {
        const { data: lignes, error } = await appliquerEtat(
          supabase
            .from('job_offers')
            .select('id, title, company, location, contract_type, salary_range, description, contact_email, contact_phone, contact_whatsapp, external_link, application_url, application_email, deadline, image_url, created_at, listing_type, view_count, status'),
          etat
        )
          .order('created_at', { ascending: false })
          .limit(limite);
        const data = ((lignes ?? []) as Array<Record<string, any>>).filter((o) => {
          if (String(o.status ?? '').toLowerCase().trim() === 'draft') return false;
          return etat === 'expirees' ? true : !statutClos(o.status);
        });

        if (error || !lignes) {
          if (!annule) setErreur(true);
          return;
        }

        const mapped: OffreReelle[] = data.map((o, idx) => ({
          id: o.id,
          entreprise: o.company || 'Entreprise',
          logoTeinte: TEINTES[idx % TEINTES.length],
          logoInitiales: initiales(o.company || ''),
          date: dateRelative(o.created_at),
          dateFormatee: o.created_at ? new Date(o.created_at).toLocaleDateString('fr-FR') : 'Récemment',
          titre: o.title || 'Offre',
          localisation: o.location || 'Sénégal',
          contrat: o.contract_type || 'CDI',
          salaire: o.salary_range || undefined,
          posterUri: getPrimaryOfferImage(o.image_url),
          rawImage: o.image_url,
          description: o.description || undefined,
          contactEmail: o.contact_email || undefined,
          contactPhone: o.contact_phone || undefined,
          contactWhatsapp: o.contact_whatsapp || undefined,
          externalLink: o.external_link || undefined,
          applicationUrl: o.application_url || undefined,
          applicationEmail: o.application_email || undefined,
          deadline: o.deadline || undefined,
          listingType: o.listing_type || 'offre_emploi',
          // job_offers n'a PAS de colonnes sector / category / positions_count (erreur 42703 constatée
          // le 24/09/2026 : la base refusait toute la requête, d'où « Impossible de charger les offres »).
          sector: 'Opportunité',
          viewCount: o.view_count || 0,
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
      .channel(`realtime_job_offers_mobile_${idInstance}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_offers' }, () => {
        charger();
      })
      .subscribe();

    return () => {
      annule = true;
      supabase.removeChannel(channel);
    };
  }, [limite, etat, version, idInstance]);

  return { offres, erreur, recharger };
}

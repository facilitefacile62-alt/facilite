import { Text } from 'react-native';

import { CarteLigne, ListeCartes } from '@/components/CarteProfil';
import EcranRubriqueCv from '@/components/EcranRubriqueCv';
import { useAuth } from '@/context/AuthContext';
import { rubriquesReelles } from '@/lib/rubriquesCvLogique';

type ExperienceProfil = {
  id?: string;
  title: string;
  company: string;
  location?: string;
  startMonth?: string;
  startYear?: string;
  endMonth?: string;
  endYear?: string;
  isCurrent?: boolean;
};

/** Période lisible ("Jan 2021 — Jan 2022" / "2021 — Présent"), comme sur le site (profil/page.js, PublicProfileClient.jsx). */
function periodeLisible(x: ExperienceProfil): string {
  const debut = [x.startMonth, x.startYear].filter(Boolean).join(' ');
  const fin = x.isCurrent ? 'Présent' : [x.endMonth, x.endYear].filter(Boolean).join(' ') || 'Terminé';
  if (!debut) return fin === 'Présent' ? 'Présent' : '';
  return `${debut} — ${fin}`;
}

// Expériences professionnelles — LECTURE SEULE : elles viennent du CV scanné ou importé (profiles.experiences, voir src/app/profil/page.js et
// src/app/in/[username]/PublicProfileClient.jsx côté web). Pour les changer, on met à jour le CV.
export default function ProfilExperiencesScreen() {
  const { profile } = useAuth();
  const experiences = rubriquesReelles(profile).experiences as ExperienceProfil[];

  return (
    <EcranRubriqueCv titre="Expériences professionnelles" cle="experiences" vide={experiences.length === 0}>
      <ListeCartes>
        {experiences.map((x, i) => (
          <CarteLigne
            key={x.id ?? i}
            icone="briefcase-outline"
            titre={x.title}
            sous={`${x.company}${x.location ? ` • ${x.location}` : ''} · ${x.isCurrent ? 'En cours' : 'Terminé'}`}
            enfants={periodeLisible(x) ? <Text style={{ fontSize: 11.5, marginTop: 2, color: 'rgba(0,0,0,0.4)' }}>{periodeLisible(x)}</Text> : null}
          />
        ))}
      </ListeCartes>
    </EcranRubriqueCv>
  );
}

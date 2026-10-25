import { Text } from 'react-native';

import { CarteLigne, ListeCartes } from '@/components/CarteProfil';
import EcranRubriqueCv from '@/components/EcranRubriqueCv';
import { useAuth } from '@/context/AuthContext';
import { periodeFormation, type Formation } from '@/lib/profilChamps';
import { rubriquesReelles } from '@/lib/rubriquesCvLogique';

// Formation — LECTURE SEULE : elle vient du CV scanné ou importé (profiles.educations,
// [{ school, degree, field, startYear, endYear, isCurrent }], même forme que le site : voir handleAddEducation dans src/app/profil/page.js).
export default function ProfilFormationScreen() {
  const { profile } = useAuth();
  const formations = rubriquesReelles(profile).educations as Formation[];

  return (
    <EcranRubriqueCv titre="Formation" cle="educations" vide={formations.length === 0}>
      <ListeCartes>
        {formations.map((f, i) => (
          <CarteLigne
            key={String(f.id ?? i)}
            icone="school-outline"
            titre={f.school || f.degree}
            sous={f.school ? [f.degree, f.field].filter(Boolean).join(' - ') : f.field}
            enfants={periodeFormation(f) ? <Text style={{ fontSize: 11.5, marginTop: 2, color: 'rgba(0,0,0,0.4)' }}>{periodeFormation(f)}</Text> : null}
          />
        ))}
      </ListeCartes>
    </EcranRubriqueCv>
  );
}

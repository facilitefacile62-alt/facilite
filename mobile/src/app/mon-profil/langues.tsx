import { CarteLigne, ListeCartes, PASTILLE_CERTIFIE } from '@/components/CarteProfil';
import EcranRubriqueCv from '@/components/EcranRubriqueCv';
import { useAuth } from '@/context/AuthContext';
import { rubriquesReelles } from '@/lib/rubriquesCvLogique';

type LangueProfil = { id?: string; name: string; level: string };

// Langues — LECTURE SEULE : elles viennent du CV scanné ou importé (profiles.languages, [{ name, level }]). La langue d'exemple de la base
// (« Français — Principal / Courant ») n'est pas une donnée de la personne : elle n'est jamais affichée (voir rubriquesCvLogique.ts).
// « Principal » reste une convention d'affichage sur la première langue.
export default function ProfilLanguesScreen() {
  const { profile } = useAuth();
  const langues = rubriquesReelles(profile).languages as LangueProfil[];

  return (
    <EcranRubriqueCv titre="Langues" cle="languages" vide={langues.length === 0}>
      <ListeCartes>
        {langues.map((l, i) => (
          <CarteLigne
            key={l.id ?? i}
            icone="globe-outline"
            titre={l.name}
            sous={l.level || undefined}
            badgeTitre={i === 0 ? { ...PASTILLE_CERTIFIE, texte: 'Principal' } : undefined}
          />
        ))}
      </ListeCartes>
    </EcranRubriqueCv>
  );
}

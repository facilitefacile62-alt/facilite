import EcranLangue from '@/components/EcranLangue';

// Depuis les Paramètres (utilisateur connecté) : retour vers les Paramètres. Cette page est volontairement HORS du
// groupe (auth), dont le garde de navigation renvoie un utilisateur connecté à l'accueil (c'était le bug « la page se
// ferme »).
export default function LangueParametresScreen() {
  return <EcranLangue repli="/mon-profil/parametres" />;
}

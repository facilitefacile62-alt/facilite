import { Redirect } from 'expo-router';

// L'écriture d'e-mail vit maintenant DANS la messagerie (bouton « Écrire », page 18 des maquettes) : cet ancien
// chemin y renvoie, pour que d'éventuels liens existants continuent de fonctionner.
export default function EcrireEmailRedirection() {
  return <Redirect href="/messages?ecrire=1" />;
}

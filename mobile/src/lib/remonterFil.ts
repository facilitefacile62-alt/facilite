// Petite passerelle entre le bouton « remonter » (flèche rouge du bouton « + ») et le fil d'actualité de
// l'Accueil : le bouton demande, le fil — s'il est affiché — remonte en haut par un défilement doux.
const abonnes = new Set<() => void>();

export function demanderRemontee(): void {
  abonnes.forEach((cb) => cb());
}

export function surRemontee(cb: () => void): () => void {
  abonnes.add(cb);
  return () => {
    abonnes.delete(cb);
  };
}

// Guidage « Démarrer » : à partir du tracé de l'itinéraire et de la position de la personne, dit quelle direction prendre
// (« Dans 120 m, tournez à droite »), la distance restante, et si on s'est écarté du trajet. Logique pure, sans réseau.
// Le tracé vient de /api/marketplace/itineraire (suite de points [latitude, longitude]) : les virages sont déduits des
// changements de cap le long du tracé — jamais inventés : sans virage net, on dit « Continuez tout droit ».

export type PointTrace = [number, number];

export type TypeVirage = 'droite-legere' | 'droite' | 'gauche-legere' | 'gauche' | 'demi-tour';
export type Virage = { index: number; distanceM: number; type: TypeVirage };

export type EtatGuidage = {
  /** Distance restante jusqu'à l'arrivée, en mètres. */
  restantM: number;
  /** Écart entre la position et le tracé, en mètres. */
  ecartM: number;
  /** Plus de 50 m du tracé : il faut recalculer l'itinéraire. */
  horsTrace: boolean;
  /** À moins de 25 m de l'arrivée. */
  arrive: boolean;
  /** Prochain virage (null : tout droit jusqu'à l'arrivée). */
  prochain: { type: TypeVirage; distanceM: number } | null;
  /** Le virage d'après, s'il est proche (moins de 300 m du prochain) : « Puis ↰ ». */
  ensuite: TypeVirage | null;
  /** Direction à prendre, sans distance (« Tournez à droite », « Continuez tout droit »). */
  instruction: string;
  /** Phrase prête à afficher. */
  consigne: string;
};

const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export function distanceM(a: PointTrace, b: PointTrace): number {
  const dLat = rad(b[0] - a[0]);
  const dLng = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Cap (0 = nord, 90 = est) du point a vers le point b, en degrés. */
export function cap(a: PointTrace, b: PointTrace): number {
  const y = Math.sin(rad(b[1] - a[1])) * Math.cos(rad(b[0]));
  const x = Math.cos(rad(a[0])) * Math.sin(rad(b[0])) - Math.sin(rad(a[0])) * Math.cos(rad(b[0])) * Math.cos(rad(b[1] - a[1]));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

function ecartAngle(depuis: number, vers: number): number {
  return ((vers - depuis + 540) % 360) - 180; // -180..180 : positif = vers la droite
}

function cumuls(points: PointTrace[]): number[] {
  const c = [0];
  for (let i = 1; i < points.length; i++) c.push(c[i - 1] + distanceM(points[i - 1], points[i]));
  return c;
}

function typeDe(delta: number): TypeVirage | null {
  const a = Math.abs(delta);
  if (a < 30) return null;
  const droite = delta > 0;
  if (a < 60) return droite ? 'droite-legere' : 'gauche-legere';
  if (a < 150) return droite ? 'droite' : 'gauche';
  return 'demi-tour';
}

/** Virages du tracé : changement de cap d'au moins 30° mesuré sur ~20 m de part et d'autre ; virages voisins (< 25 m) fusionnés. */
export function extraireVirages(points: PointTrace[]): Virage[] {
  if (points.length < 3) return [];
  const c = cumuls(points);
  const bruts: { index: number; distanceM: number; delta: number }[] = [];
  for (let i = 1; i < points.length - 1; i++) {
    let avant = i - 1;
    while (avant > 0 && c[i] - c[avant] < 20) avant--;
    let apres = i + 1;
    while (apres < points.length - 1 && c[apres] - c[i] < 20) apres++;
    const delta = ecartAngle(cap(points[avant], points[i]), cap(points[i], points[apres]));
    if (typeDe(delta)) bruts.push({ index: i, distanceM: c[i], delta });
  }
  const fusion: typeof bruts = [];
  for (const v of bruts) {
    const dernier = fusion[fusion.length - 1];
    if (dernier && v.distanceM - dernier.distanceM < 25) {
      if (Math.abs(v.delta) > Math.abs(dernier.delta)) fusion[fusion.length - 1] = v;
    } else fusion.push(v);
  }
  return fusion.map((v) => ({ index: v.index, distanceM: v.distanceM, type: typeDe(v.delta) as TypeVirage }));
}

export function distanceLisible(m: number): string {
  if (m < 1000) return `${Math.max(10, Math.round(m / 10) * 10)} m`;
  return `${(m / 1000).toFixed(1).replace('.', ',')} km`;
}

const PHRASE: Record<TypeVirage, string> = {
  'droite-legere': 'serrez légèrement à droite',
  droite: 'tournez à droite',
  'gauche-legere': 'serrez légèrement à gauche',
  gauche: 'tournez à gauche',
  'demi-tour': 'faites demi-tour',
};

/** Position le long du tracé (distance depuis le départ) et écart au tracé, par projection sur le segment le plus proche. */
function projeter(points: PointTrace[], c: number[], pos: PointTrace): { along: number; ecart: number } {
  let meilleur = { along: 0, ecart: Infinity };
  const kLat = 111320;
  const kLng = 111320 * Math.cos(rad(pos[0]));
  for (let i = 0; i < points.length - 1; i++) {
    const ax = (points[i][1] - pos[1]) * kLng;
    const ay = (points[i][0] - pos[0]) * kLat;
    const bx = (points[i + 1][1] - pos[1]) * kLng;
    const by = (points[i + 1][0] - pos[0]) * kLat;
    const dx = bx - ax;
    const dy = by - ay;
    const long2 = dx * dx + dy * dy;
    const t = long2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / long2));
    const px = ax + t * dx;
    const py = ay + t * dy;
    const ecart = Math.hypot(px, py);
    if (ecart < meilleur.ecart) meilleur = { along: c[i] + t * (c[i + 1] - c[i]), ecart };
  }
  return meilleur;
}

export function etatGuidage(points: PointTrace[], position: { latitude: number; longitude: number }, virages?: Virage[]): EtatGuidage | null {
  if (points.length < 2) return null;
  const c = cumuls(points);
  const total = c[c.length - 1];
  const { along, ecart } = projeter(points, c, [position.latitude, position.longitude]);
  const restantM = Math.max(0, total - along);
  const liste = virages ?? extraireVirages(points);
  const suivant = liste.find((v) => v.distanceM > along + 5);
  const arrive = restantM < 25;
  const horsTrace = ecart > 50;
  const prochain = suivant ? { type: suivant.type, distanceM: Math.max(0, suivant.distanceM - along) } : null;
  const apres = suivant ? liste.find((v) => v.distanceM > suivant.distanceM + 5) : undefined;
  const ensuite = apres && suivant && apres.distanceM - suivant.distanceM < 300 ? apres.type : null;
  const majuscule = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
  const instruction = arrive ? 'Vous êtes arrivé' : horsTrace ? 'Nouveau calcul du trajet…' : prochain ? majuscule(PHRASE[prochain.type]) : 'Continuez tout droit';
  let consigne: string;
  if (arrive) consigne = 'Vous êtes arrivé';
  else if (horsTrace) consigne = 'Vous vous êtes écarté du trajet : nouveau calcul…';
  else if (prochain && prochain.distanceM < 30) consigne = PHRASE[prochain.type].charAt(0).toUpperCase() + PHRASE[prochain.type].slice(1);
  else if (prochain) consigne = `Dans ${distanceLisible(prochain.distanceM)}, ${PHRASE[prochain.type]}`;
  else consigne = `Continuez tout droit · arrivée dans ${distanceLisible(restantM)}`;
  return { restantM, ecartM: ecart, horsTrace, arrive, prochain, ensuite, instruction, consigne };
}

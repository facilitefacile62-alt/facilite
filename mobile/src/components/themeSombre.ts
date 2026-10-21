// Mode sombre : table de correspondance clair → sombre, appliquée à la création de chaque élément (voir
// src/theme-jsx/jsx-runtime.js). L'application a été dessinée en clair, avec ses couleurs écrites dans les classes
// (« bg-white », « text-[#1A1A1A] »…) et dans les styles (« backgroundColor: '#fff' »…) : plutôt que de réécrire
// ~900 usages, le mode sombre REMPLACE ces couleurs quand il est actif. En mode clair, rien n'est touché.
//
// IMPORTANT : ce fichier est dans src/components pour que Tailwind (NativeWind) lise les classes sombres ci-dessous
// — une classe arbitraire comme `bg-[#1B2129]` n'existe à l'exécution que si elle est écrite en toutes lettres dans le
// code. Ne pas les construire par concaténation.

let sombre = false;
export const estSombre = () => sombre;
export function fixerSombre(valeur: boolean) {
  sombre = valeur;
}

// ---- Classes ------------------------------------------------------------------------------------------------
const CLASSES: Record<string, string> = {
  // fonds
  'bg-white': 'bg-[#1B2129]',
  'bg-[#F2F0EA]': 'bg-[#0E1217]',
  'bg-[#FAF6F1]': 'bg-[#0E1217]',
  'bg-[#F8F6F1]': 'bg-[#0E1217]',
  'bg-[#F7F3EC]': 'bg-[#0E1217]',
  'bg-[#f7faf9]': 'bg-[#0E1217]',
  'bg-[#E8E4DA]': 'bg-[#232B34]',
  'bg-[#E4DED2]': 'bg-[#232B34]',
  'bg-[#E6DFD0]': 'bg-[#232B34]',
  'bg-[#D9D2C3]': 'bg-[#232B34]',
  'bg-[#F7F7F5]': 'bg-[#1B2129]',
  'bg-gray-50': 'bg-[#1B2129]',
  'bg-gray-100': 'bg-[#232B34]',
  'bg-[#d7f2ea]': 'bg-[#0F3D33]',
  'bg-[#D7F2EA]': 'bg-[#0F3D33]',
  'bg-[#D1FAE5]': 'bg-[#0F3D33]',
  'bg-[#e8f8f1]': 'bg-[#0F3D33]',
  'bg-emerald-50': 'bg-[#0C2F28]',
  'bg-[#dbe8fc]': 'bg-[#13294B]',
  'bg-[#e6f0fd]': 'bg-[#13294B]',
  'bg-[#eaf1fb]': 'bg-[#13294B]',
  'bg-[#EEF2FF]': 'bg-[#13294B]',
  'bg-[#FEF3C7]': 'bg-[#3B2F10]',
  'bg-[#fdf1d9]': 'bg-[#3B2F10]',
  'bg-amber-50': 'bg-[#3B2F10]',
  'bg-red-50': 'bg-[#3A1517]',
  'bg-[#EDE9FE]': 'bg-[#2A1F4A]',
  'bg-black/10': 'bg-white/10',
  'bg-black/[0.06]': 'bg-white/[0.08]',
  'bg-black/[0.08]': 'bg-white/[0.08]',
  // textes
  'text-[#1A1A1A]': 'text-[#EDEFF1]',
  'text-[#111]': 'text-[#EDEFF1]',
  'text-[#0B0D10]': 'text-[#EDEFF1]',
  'text-black': 'text-[#EDEFF1]',
  'text-gray-500': 'text-[#9AA3AF]',
  'text-gray-600': 'text-[#AEB6C2]',
  'text-gray-700': 'text-[#CBD2DA]',
  'text-black/35': 'text-white/35',
  'text-black/40': 'text-white/40',
  'text-black/45': 'text-white/45',
  'text-black/50': 'text-white/50',
  'text-black/55': 'text-white/55',
  'text-black/60': 'text-white/60',
  'text-black/70': 'text-white/70',
  'text-[#047857]': 'text-[#34D399]',
  'text-[#0d3b34]': 'text-[#6EE7B7]',
  'text-[#0B3D2A]': 'text-[#6EE7B7]',
  'text-emerald-800': 'text-emerald-300',
  'text-[#B45309]': 'text-amber-300',
  'text-amber-700': 'text-amber-300',
  'text-red-700': 'text-red-300',
  'text-red-600': 'text-red-400',
  'text-[#0369A1]': 'text-sky-300',
  'text-[#44403C]': 'text-[#D6D3D1]',
  'text-[#7C3AED]': 'text-[#A78BFA]',
  'text-blue-600': 'text-blue-400',
  'text-[#2563EB]': 'text-[#60A5FA]',
  // bordures
  'border-black/10': 'border-white/10',
  'border-black/[0.05]': 'border-white/[0.06]',
  'border-black/[0.06]': 'border-white/[0.08]',
  'border-black/[0.07]': 'border-white/[0.08]',
  'border-black/[0.08]': 'border-white/[0.08]',
  'border-gray-300': 'border-[#3A424D]',
  'border-gray-200': 'border-[#2A323C]',
  'border-gray-100': 'border-[#2A323C]',
  'border-red-200': 'border-red-900',
  'border-red-100': 'border-red-900',
  'border-emerald-200': 'border-emerald-800',
  'border-amber-200': 'border-amber-800',
  'border-[#F2F0EA]': 'border-[#0E1217]',
};

function classeSombre(jeton: string): string {
  const i = jeton.lastIndexOf(':');
  const prefixe = i === -1 ? '' : jeton.slice(0, i + 1);
  const base = i === -1 ? jeton : jeton.slice(i + 1);
  const remplace = CLASSES[base];
  return remplace ? prefixe + remplace : jeton;
}

const memoClasses = new Map<string, string>();
function remplacerClasses(classes: string): string {
  const connu = memoClasses.get(classes);
  if (connu !== undefined) return connu;
  const resultat = classes.split(/\s+/).map(classeSombre).join(' ');
  memoClasses.set(classes, resultat);
  return resultat;
}

// ---- Couleurs des styles --------------------------------------------------------------------------------------
const norm = (c: string) => c.trim().toUpperCase();

const FONDS: Record<string, string> = {
  '#FFFFFF': '#1B2129', '#FFF': '#1B2129', WHITE: '#1B2129',
  '#F2F0EA': '#0E1217', '#FAF6F1': '#0E1217',
  '#E3DBCC': '#171D24',
  '#F5F6F7': '#161C23', '#F3F4F6': '#1F262E',
  '#E8E4DA': '#232B34', '#EFEDE7': '#232B34', '#EEECE7': '#232B34', '#F0EEE8': '#232B34', '#E4DED2': '#232B34', '#EAE3D2': '#232B34',
  '#E6DFD0': '#232B34', '#D9D2C3': '#232B34', '#D3CAB9': '#2A323C',
  '#E5E7EB': '#2A323C',
  '#F7F7F5': '#1B2129', '#F7F6F2': '#1B2129', '#F8F6F1': '#1B2129', '#F7F3EC': '#1B2129',
  '#D1FAE5': '#0F3D33', '#D7F2EA': '#0F3D33', '#ECFDF5': '#0C2F28', '#F3FBF7': '#0C2F28', '#E8F8F1': '#0F3D33', '#C4F3DD': '#0F3D33', '#CFE8DB': '#0F3D33',
  '#FEF3C7': '#3B2F10', '#FDF1D9': '#3B2F10',
  '#DBEAFE': '#13294B', '#DBE8FC': '#13294B', '#E6F0FD': '#13294B', '#EAF1FB': '#13294B', '#EEF2FF': '#13294B', '#E6EEFD': '#13294B', '#D8E3F5': '#13294B',
  '#EDE9FE': '#2A1F4A', '#EDE7FB': '#2A1F4A',
  '#FEE2E2': '#3A1517', '#FEF2F2': '#3A1517', '#FBE7E7': '#3A1517', '#E1EAFB': '#13294B',
};
const TEXTES: Record<string, string> = {
  '#1A1A1A': '#EDEFF1', '#111': '#EDEFF1', '#111111': '#EDEFF1', '#111827': '#EDEFF1', '#000': '#EDEFF1', '#000000': '#EDEFF1', '#0B0D10': '#EDEFF1',
  BLACK: '#EDEFF1',
  '#374151': '#D1D5DB', '#4B5563': '#AEB6C2', '#6B7280': '#9AA3AF',
  '#047857': '#34D399', '#059669': '#34D399',
  '#0D3B34': '#6EE7B7', '#0B3D2A': '#6EE7B7', '#064E3B': '#6EE7B7',
  '#B45309': '#FBBF24', '#92400E': '#FBBF24', '#D97706': '#FBBF24',
  '#1D4ED8': '#93C5FD', '#2563EB': '#60A5FA',
  '#B91C1C': '#F87171', '#DC2626': '#F87171',
  '#7C3AED': '#A78BFA', '#0369A1': '#7DD3FC', '#44403C': '#D6D3D1',
};
const BORDURES: Record<string, string> = {
  '#E5E7EB': '#2F3742', '#E5E2DC': '#2F3742', '#D9D6CE': '#2F3742', '#D4D1C9': '#2F3742', '#E4E0D8': '#2F3742',
  '#FFFFFF': '#2F3742', '#FFF': '#2F3742', '#D1D5DB': '#3A424D',
  '#F2F0EA': '#0E1217',
};

const RGBA_NOIR = /^rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*([\d.]+)\s*\)$/i;

function couleurTexte(c: string): string {
  const m = RGBA_NOIR.exec(c);
  if (m) return `rgba(255,255,255,${m[1]})`;
  return TEXTES[norm(c)] ?? c;
}
function couleurFond(c: string): string {
  return FONDS[norm(c)] ?? c;
}
function couleurBordure(c: string): string {
  const m = RGBA_NOIR.exec(c);
  if (m) return `rgba(255,255,255,${m[1]})`;
  return BORDURES[norm(c)] ?? c;
}

/** Couleur de fond de secours d'un écran (options de navigation), en mode actif. */
export const fondSombre = couleurFond;

const CLES_TEXTE = new Set(['color', 'textDecorationColor']);
const CLES_FOND = new Set(['backgroundColor']);

function styleSombre(style: unknown): unknown {
  if (!style || typeof style !== 'object') return style;
  if (Array.isArray(style)) {
    let change = false;
    const sortie = style.map((s) => {
      const r = styleSombre(s);
      if (r !== s) change = true;
      return r;
    });
    return change ? sortie : style;
  }
  const source = style as Record<string, unknown>;
  let sortie: Record<string, unknown> | null = null;
  for (const cle of Object.keys(source)) {
    const valeur = source[cle];
    if (typeof valeur !== 'string') continue;
    let remplace = valeur;
    if (CLES_FOND.has(cle)) remplace = couleurFond(valeur);
    else if (CLES_TEXTE.has(cle)) remplace = couleurTexte(valeur);
    else if (/BorderColor$|^borderColor$|Border.*Color$/.test(cle) || cle === 'borderColor') remplace = couleurBordure(valeur);
    if (remplace !== valeur) {
      if (!sortie) sortie = { ...source };
      sortie[cle] = remplace;
    }
  }
  return sortie ?? style;
}

/**
 * Applique le mode sombre aux propriétés d'un élément : className (et variantes « …ClassName »), style (et variantes
 * « …Style »), couleur d'icône (`color`) et couleur de texte indicatif (`placeholderTextColor`).
 */
export function propsSombres<T extends Record<string, unknown> | null | undefined>(props: T): T {
  if (!props) return props;
  let sortie: Record<string, unknown> | null = null;
  for (const cle of Object.keys(props)) {
    const valeur = (props as Record<string, unknown>)[cle];
    let remplace: unknown = valeur;
    if (typeof valeur === 'string') {
      if (cle === 'className' || cle.endsWith('ClassName')) remplace = remplacerClasses(valeur);
      else if (cle === 'color') remplace = couleurTexte(valeur);
      else if (cle === 'placeholderTextColor') remplace = couleurTexte(valeur);
    } else if (valeur && typeof valeur === 'object' && (cle === 'style' || cle.endsWith('Style'))) {
      remplace = styleSombre(valeur);
    }
    if (remplace !== valeur) {
      if (!sortie) sortie = { ...(props as Record<string, unknown>) };
      sortie[cle] = remplace;
    }
  }
  return (sortie ?? props) as T;
}

// Logique PURE des mises à jour de l'application : comparaison de versions et choix de l'adresse de téléchargement. Aucun import : testable seule.
//
// La dernière version publiée est lue dans https://ffacilite.com/app-version.json (fichier du site, public/app-version.json). Pour annoncer une mise à
// jour : y mettre la nouvelle version (et l'adresse du Play Store, de l'App Store ou de la page de l'APK), puis publier le site. Tant que la version du
// fichier n'est pas PLUS RÉCENTE que celle installée, rien ne s'affiche (tuile du menu grisée, aucun bandeau dans le fil).

export type Plateforme = 'android' | 'ios' | 'web';
export type CanalMaj = { version?: string; url?: string };
export type ConfigMaj = { android?: CanalMaj; ios?: CanalMaj; apk?: CanalMaj };
export type InfoMaj = { version: string; url: string };

const VERSION = /^\d+(\.\d+){0,3}$/;

/** -1 si a < b, 0 si égales, 1 si a > b ; compare chaque nombre (« 1.10.0 » est plus récent que « 1.9.0 »). Une version illisible vaut 0. */
export function comparerVersions(a: string, b: string): number {
  const lire = (v: string) => (VERSION.test(String(v ?? '').trim()) ? String(v).trim().split('.').map(Number) : [0]);
  const x = lire(a);
  const y = lire(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const p = x[i] ?? 0;
    const q = y[i] ?? 0;
    if (p !== q) return p < q ? -1 : 1;
  }
  return 0;
}

const canal = (c: unknown): CanalMaj => {
  if (!c || typeof c !== 'object') return {};
  const o = c as Record<string, unknown>;
  return {
    version: typeof o.version === 'string' && VERSION.test(o.version.trim()) ? o.version.trim() : undefined,
    url: typeof o.url === 'string' && /^https:\/\//i.test(o.url.trim()) ? o.url.trim() : undefined,
  };
};

/** Lit le fichier du site ; tout ce qui n'est pas une version valide ou une adresse https est écarté. null si le fichier est illisible. */
export function lireConfigMaj(brut: unknown): ConfigMaj | null {
  if (!brut || typeof brut !== 'object') return null;
  const o = brut as Record<string, unknown>;
  return { android: canal(o.android), ios: canal(o.ios), apk: canal(o.apk) };
}

/**
 * Mise à jour disponible pour CET appareil, ou null.
 * - Android : l'adresse du Play Store si elle est renseignée, sinon la page de téléchargement de l'APK.
 * - iPhone : l'adresse de l'App Store.
 * Il faut une version plus récente que celle installée ET une adresse https : sinon rien (la tuile reste grisée).
 */
export function miseAJourDisponible(versionInstallee: string, config: ConfigMaj | null, plateforme: Plateforme): InfoMaj | null {
  if (!config) return null;
  let version: string | undefined;
  let url: string | undefined;
  if (plateforme === 'android') {
    version = config.android?.url ? config.android.version : config.apk?.version;
    url = config.android?.url || config.apk?.url;
    // Play Store : sa version fait foi ; si elle manque, on retombe sur celle de l'APK.
    if (!version) version = config.apk?.version;
  } else if (plateforme === 'ios') {
    version = config.ios?.version;
    url = config.ios?.url;
  }
  if (!version || !url) return null;
  return comparerVersions(version, versionInstallee) > 0 ? { version, url } : null;
}

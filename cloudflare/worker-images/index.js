// Worker Cloudflare « facilite-images » : sert les images PUBLIQUES du site depuis le bucket R2 « facilite-images » (liaison R2 nommée IMAGES).
//
//   GET /<bucket>/<chemin du fichier>      bucket ∈ job-offers, marketplace-photos, stories-media (les mêmes noms que sur Supabase Storage)
//   GET /_sante                            { ok: true, r2: true } : vérifie que le Worker tourne et que la liaison R2 est branchée
//
// Fonctionnement :
//   1. Le fichier est dans R2 : il est servi (lecture partielle « Range » et validation « If-None-Match » prises en charge), cache navigateur d'un an.
//   2. Il n'y est pas encore (fichier ajouté sur Supabase après l'export) : le Worker le récupère UNE fois chez Supabase (adresse publique, 25 Mo maximum, images/audio/vidéo
//      seulement), le range dans R2 puis le sert. C'est le « rattrapage » : aucune opération en masse, une requête par fichier nouveau.
//   3. Absent partout : 404 (mis en cache 60 s seulement).
//
// Sécurité : lecture seule (GET, HEAD) ; liste fixe de buckets (jamais avatars, covers, banque-cv ni aucun document privé) ; aucun secret (la liaison R2 est interne) ;
// chemins refusés s'ils contiennent « .. », une barre oblique inverse ou des caractères de contrôle. Aucune suppression nulle part.
const SUPABASE_PUBLIC = "https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public";
const BUCKETS = new Set(["job-offers", "marketplace-photos", "stories-media"]);
const TAILLE_MAX = 25 * 1024 * 1024;
const CACHE_LONG = "public, max-age=31536000, immutable";
const CACHE_ABSENT = "public, max-age=60";
const COMMUNS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Expose-Headers": "ETag, Content-Length, Content-Range, Accept-Ranges",
  "X-Content-Type-Options": "nosniff",
  "Cross-Origin-Resource-Policy": "cross-origin",
  "Content-Security-Policy": "default-src 'none'; sandbox",
};

function repondre(corps, statut, extra = {}) {
  const h = new Headers(COMMUNS);
  for (const [k, v] of Object.entries(extra)) h.set(k, v);
  return new Response(corps, { status: statut, headers: h });
}
const introuvable = () => repondre("Introuvable", 404, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": CACHE_ABSENT });

/** « /<bucket>/<clé> » → { bucket, cle } ou null si le chemin est refusé. */
function lireChemin(pathname) {
  let decode;
  try {
    decode = decodeURIComponent(pathname.slice(1));
  } catch {
    return null;
  }
  if (!decode || decode.length > 600 || decode.includes("\\") || /[\u0000-\u001f\u007f]/.test(decode)) return null;
  const segments = decode.split("/");
  if (segments.some((s) => s === ".." || s === "." || s === "")) return null;
  const [bucket, ...reste] = segments;
  if (!BUCKETS.has(bucket) || reste.length === 0) return null;
  return { bucket, cle: decode };
}

function enTetesDepuisR2(objet, statut, taille, plage) {
  const h = new Headers(COMMUNS);
  if (typeof objet.writeHttpMetadata === "function") objet.writeHttpMetadata(h);
  if (!h.get("Content-Type")) h.set("Content-Type", "application/octet-stream");
  h.set("ETag", objet.httpEtag);
  h.set("Cache-Control", CACHE_LONG);
  h.set("Accept-Ranges", "bytes");
  if (statut === 206 && plage) {
    h.set("Content-Range", `bytes ${plage.debut}-${plage.fin}/${objet.size}`);
    h.set("Content-Length", String(plage.fin - plage.debut + 1));
  } else if (statut === 200) {
    h.set("Content-Length", String(taille));
  }
  return h;
}

function plageServie(objet) {
  const r = objet.range;
  if (!r) return null;
  if (typeof r.suffix === "number") return { debut: Math.max(0, objet.size - r.suffix), fin: objet.size - 1 };
  const debut = r.offset ?? 0;
  const longueur = r.length ?? objet.size - debut;
  return { debut, fin: Math.min(objet.size - 1, debut + longueur - 1) };
}

function depuisR2(objet, requete) {
  const tete = requete.method === "HEAD";
  if (!("body" in objet)) {
    // Condition de lecture non remplie (If-None-Match identique) : rien à renvoyer.
    return new Response(null, { status: 304, headers: enTetesDepuisR2(objet, 304, 0, null) });
  }
  const plage = plageServie(objet);
  const partiel = plage !== null && (plage.debut !== 0 || plage.fin !== objet.size - 1);
  const statut = partiel ? 206 : 200;
  return new Response(tete ? null : objet.body, { status: statut, headers: enTetesDepuisR2(objet, statut, objet.size, plage) });
}

async function recuperer(chemin, url, requete, env, ctx) {
  let amont;
  try {
    amont = await fetch(`${SUPABASE_PUBLIC}${url.pathname}`, { headers: { "User-Agent": "facilite-images-worker" } });
  } catch {
    return repondre("Source indisponible", 502, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
  }
  const type = amont.headers.get("content-type") || "";
  const annonce = Number(amont.headers.get("content-length") || 0);
  if (!amont.ok || !/^(image|audio|video)\//i.test(type) || annonce > TAILLE_MAX) return introuvable();
  const octets = await amont.arrayBuffer();
  if (octets.byteLength > TAILLE_MAX) return introuvable();
  // Rangement dans R2 en arrière-plan : la réponse part tout de suite, les demandes suivantes viendront de R2.
  ctx.waitUntil(env.IMAGES.put(chemin.cle, octets, { httpMetadata: { contentType: type, cacheControl: CACHE_LONG } }).catch(() => {}));
  const h = new Headers(COMMUNS);
  h.set("Content-Type", type);
  h.set("Cache-Control", CACHE_LONG);
  h.set("Accept-Ranges", "bytes");
  h.set("Content-Length", String(octets.byteLength));
  return new Response(requete.method === "HEAD" ? null : octets, { status: 200, headers: h });
}

const travailleur = {
  async fetch(requete, env, ctx) {
    const url = new URL(requete.url);
    if (requete.method === "OPTIONS") {
      return repondre(null, 204, { "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS", "Access-Control-Allow-Headers": "Range, If-None-Match", "Access-Control-Max-Age": "86400" });
    }
    if (requete.method !== "GET" && requete.method !== "HEAD") return repondre("Methode non autorisee", 405, { Allow: "GET, HEAD, OPTIONS", "Content-Type": "text/plain; charset=utf-8" });
    if (url.pathname === "/_sante") {
      return repondre(JSON.stringify({ ok: true, r2: Boolean(env && env.IMAGES) }), 200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    }
    const chemin = lireChemin(url.pathname);
    if (!chemin) return introuvable();
    if (!env || !env.IMAGES) return repondre("Liaison R2 absente", 500, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });

    const objet = await env.IMAGES.get(chemin.cle, { range: requete.headers, onlyIf: requete.headers });
    if (objet) return depuisR2(objet, requete);
    return recuperer(chemin, url, requete, env, ctx);
  },
};

export default travailleur;

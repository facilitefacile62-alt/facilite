const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * Worker Cloudflare « facilite-images » (cloudflare/worker-images/index.js) : testé sans réseau, avec un faux bucket R2 en mémoire et un faux fetch vers Supabase.
 */
const worker = () => import("../../cloudflare/worker-images/index.js");
const SUPABASE = "https://ocfhzwwjvljintabxxlg.supabase.co/storage/v1/object/public";
const CORPS = Buffer.from("0123456789abcdefghij"); // 20 octets
const ETAG = '"abc123"';

/** Faux R2 : get(key, { range, onlyIf }) comme le vrai (objet sans body si la condition n'est pas remplie). */
function fauxR2(objets = {}) {
  const r2 = {
    objets,
    gets: [],
    puts: [],
    async get(cle, options = {}) {
      r2.gets.push(cle);
      const o = r2.objets[cle];
      if (!o) return null;
      const base = { size: o.corps.length, httpEtag: ETAG, writeHttpMetadata: (h) => { h.set("Content-Type", o.type); } };
      if (options.onlyIf && options.onlyIf.get("If-None-Match") === ETAG) return base;
      const m = /^bytes=(\d+)-(\d*)$/.exec(options.range?.get("Range") || "");
      if (m) {
        const debut = Number(m[1]);
        const fin = m[2] === "" ? o.corps.length - 1 : Number(m[2]);
        return { ...base, range: { offset: debut, length: fin - debut + 1 }, body: new Blob([o.corps.subarray(debut, fin + 1)]).stream() };
      }
      return { ...base, body: new Blob([o.corps]).stream() };
    },
    async put(cle, octets, options) {
      r2.puts.push({ cle, octets: Buffer.from(octets), options });
      r2.objets[cle] = { corps: Buffer.from(octets), type: options.httpMetadata.contentType };
    },
  };
  return r2;
}
const contexte = () => {
  const attentes = [];
  return { attentes, waitUntil: (p) => attentes.push(p) };
};
async function appeler(r2, requete, ctx = contexte(), fetchFaux = null) {
  const m = await worker();
  // Selon le chargeur de test, le module par défaut est enveloppé une fois de plus.
  const w = typeof m.default?.fetch === "function" ? m.default : m.default.default;
  const ancien = globalThis.fetch;
  const appels = [];
  globalThis.fetch = async (url, options) => {
    appels.push(String(url));
    if (!fetchFaux) throw new Error("fetch inattendu : " + url);
    return fetchFaux(String(url), options);
  };
  try {
    const reponse = await w.fetch(requete, r2 ? { IMAGES: r2 } : {}, ctx);
    await Promise.all(ctx.attentes);
    return { reponse, appels };
  } finally {
    globalThis.fetch = ancien;
  }
}
const GET = (chemin, entetes = {}, methode = "GET") => new Request("https://facilite-images.ffacilite.workers.dev" + chemin, { method: methode, headers: entetes });
const texte = async (r) => Buffer.from(await r.arrayBuffer());

test.describe("Worker facilite-images : lecture depuis R2", () => {
  test("un fichier présent dans R2 est servi : 200, bon type, cache d'un an, CORS, ETag, aucun appel à Supabase", async () => {
    const r2 = fauxR2({ "job-offers/admin-posters/a-w1280.webp": { corps: CORPS, type: "image/webp" } });
    const { reponse, appels } = await appeler(r2, GET("/job-offers/admin-posters/a-w1280.webp"));
    expect(reponse.status).toBe(200);
    expect((await texte(reponse)).equals(CORPS)).toBe(true);
    expect(reponse.headers.get("Content-Type")).toBe("image/webp");
    expect(reponse.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
    expect(reponse.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(reponse.headers.get("ETag")).toBe(ETAG);
    expect(reponse.headers.get("Content-Length")).toBe("20");
    expect(reponse.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(reponse.headers.get("Accept-Ranges")).toBe("bytes");
    expect(appels).toEqual([]);
  });
  test("HEAD : mêmes en-têtes, pas de corps", async () => {
    const r2 = fauxR2({ "stories-media/s.jpg": { corps: CORPS, type: "image/jpeg" } });
    const { reponse } = await appeler(r2, GET("/stories-media/s.jpg", {}, "HEAD"));
    expect(reponse.status).toBe(200);
    expect(reponse.headers.get("Content-Length")).toBe("20");
    expect((await texte(reponse)).length).toBe(0);
  });
  test("lecture partielle (Range) : 206 avec Content-Range", async () => {
    const r2 = fauxR2({ "job-offers/u/audio.mp3": { corps: CORPS, type: "audio/mpeg" } });
    const { reponse } = await appeler(r2, GET("/job-offers/u/audio.mp3", { Range: "bytes=2-5" }));
    expect(reponse.status).toBe(206);
    expect(reponse.headers.get("Content-Range")).toBe("bytes 2-5/20");
    expect(reponse.headers.get("Content-Length")).toBe("4");
    expect((await texte(reponse)).toString()).toBe("2345");
  });
  test("validation If-None-Match identique : 304 sans corps", async () => {
    const r2 = fauxR2({ "marketplace-photos/p.png": { corps: CORPS, type: "image/png" } });
    const { reponse } = await appeler(r2, GET("/marketplace-photos/p.png", { "If-None-Match": ETAG }));
    expect(reponse.status).toBe(304);
    expect((await texte(reponse)).length).toBe(0);
  });
  test("clés encodées (espaces, accents) : la clé R2 est décodée", async () => {
    const r2 = fauxR2({ "job-offers/a b/é.webp": { corps: CORPS, type: "image/webp" } });
    const { reponse } = await appeler(r2, GET("/job-offers/a%20b/%C3%A9.webp"));
    expect(reponse.status).toBe(200);
    expect(r2.gets).toEqual(["job-offers/a b/é.webp"]);
  });
});

test.describe("Worker facilite-images : premier accès à un fichier absent de R2 (rattrapage)", () => {
  const upstream = (corps, type = "image/webp", statut = 200, entetes = {}) => async () => new Response(corps, { status: statut, headers: { "content-type": type, ...entetes } });

  test("récupéré UNE fois chez Supabase (adresse publique, chemin conservé), servi, puis rangé dans R2 avec type et cache", async () => {
    const r2 = fauxR2();
    const { reponse, appels } = await appeler(r2, GET("/job-offers/nouveau%20fichier-w960.webp"), contexte(), upstream(CORPS));
    expect(reponse.status).toBe(200);
    expect((await texte(reponse)).equals(CORPS)).toBe(true);
    expect(appels).toEqual([`${SUPABASE}/job-offers/nouveau%20fichier-w960.webp`]);
    expect(r2.puts).toHaveLength(1);
    expect(r2.puts[0].cle).toBe("job-offers/nouveau fichier-w960.webp");
    expect(r2.puts[0].options.httpMetadata).toEqual({ contentType: "image/webp", cacheControl: "public, max-age=31536000, immutable" });
    // La demande suivante vient de R2 : plus aucun appel à Supabase.
    const suivante = await appeler(r2, GET("/job-offers/nouveau%20fichier-w960.webp"));
    expect(suivante.reponse.status).toBe(200);
    expect(suivante.appels).toEqual([]);
  });
  test("absent chez Supabase aussi : 404 mis en cache 60 s, rien rangé", async () => {
    const r2 = fauxR2();
    const { reponse } = await appeler(r2, GET("/job-offers/inconnu.webp"), contexte(), upstream("{}", "application/json", 404));
    expect(reponse.status).toBe(404);
    expect(reponse.headers.get("Cache-Control")).toBe("public, max-age=60");
    expect(r2.puts).toEqual([]);
  });
  test("contenu qui n'est pas image/audio/vidéo, ou trop gros (> 25 Mo) : 404, rien rangé", async () => {
    for (const [type, entetes] of [["text/html", {}], ["image/png", { "content-length": String(30 * 1024 * 1024) }]]) {
      const r2 = fauxR2();
      const { reponse } = await appeler(r2, GET("/job-offers/x.png"), contexte(), upstream("<html>", type, 200, entetes));
      expect(reponse.status).toBe(404);
      expect(r2.puts).toEqual([]);
    }
  });
  test("Supabase injoignable : 502 sans cache, rien rangé", async () => {
    const r2 = fauxR2();
    const { reponse } = await appeler(r2, GET("/job-offers/x.png"), contexte(), async () => {
      throw new Error("réseau");
    });
    expect(reponse.status).toBe(502);
    expect(reponse.headers.get("Cache-Control")).toBe("no-store");
    expect(r2.puts).toEqual([]);
  });
});

test.describe("Worker facilite-images : refus et garde-fous", () => {
  test("buckets non publics ou inconnus (avatars, covers, banque-cv, facilite-media, facilite-images…) : 404, AUCUNE lecture R2, AUCUN appel Supabase", async () => {
    for (const bucket of ["avatars", "covers", "banque-cv", "resumes", "chat-attachments", "facilite-media", "facilite-images", "invoices"]) {
      const r2 = fauxR2({ [`${bucket}/x.png`]: { corps: CORPS, type: "image/png" } });
      const { reponse, appels } = await appeler(r2, GET(`/${bucket}/x.png`));
      expect(reponse.status, bucket).toBe(404);
      expect(r2.gets, bucket).toEqual([]);
      expect(appels, bucket).toEqual([]);
    }
  });
  test("chemins dangereux ou incomplets : 404 (.., barre inverse, caractères de contrôle, sans clé, double barre, racine)", async () => {
    for (const chemin of ["/job-offers/../avatars/x.png", "/job-offers/%2e%2e/covers/x.png", "/job-offers/a%5Cb.png", "/job-offers/a%00b.png", "/job-offers", "/job-offers/", "/job-offers//x.png", "/", "/%E0%A4%A"]) {
      const r2 = fauxR2();
      const { reponse, appels } = await appeler(r2, GET(chemin));
      expect(reponse.status, chemin).toBe(404);
      expect(r2.gets, chemin).toEqual([]);
      expect(appels, chemin).toEqual([]);
    }
  });
  test("méthodes d'écriture refusées (405) ; OPTIONS répond pour CORS", async () => {
    const r2 = fauxR2();
    for (const m of ["POST", "PUT", "DELETE", "PATCH"]) {
      const { reponse } = await appeler(r2, new Request("https://x.workers.dev/job-offers/a.png", { method: m, body: m === "DELETE" ? undefined : "x" }));
      expect(reponse.status, m).toBe(405);
    }
    const { reponse } = await appeler(r2, new Request("https://x.workers.dev/job-offers/a.png", { method: "OPTIONS" }));
    expect(reponse.status).toBe(204);
    expect(reponse.headers.get("Access-Control-Allow-Methods")).toBe("GET, HEAD, OPTIONS");
    expect(r2.puts).toEqual([]);
  });
  test("/_sante indique si la liaison R2 est branchée ; sans liaison, une image répond 500 sans cache", async () => {
    const ok = await appeler(fauxR2(), GET("/_sante"));
    expect(await ok.reponse.json()).toEqual({ ok: true, r2: true });
    const sans = await appeler(null, GET("/_sante"));
    expect(await sans.reponse.json()).toEqual({ ok: true, r2: false });
    const image = await appeler(null, GET("/job-offers/a.png"));
    expect(image.reponse.status).toBe(500);
    expect(image.reponse.headers.get("Cache-Control")).toBe("no-store");
  });
  test("code : lecture seule (aucune suppression), aucun secret, une seule écriture (rattrapage), liaison IMAGES", () => {
    const code = fs.readFileSync(path.join(__dirname, "../../cloudflare/worker-images/index.js"), "utf8").split(/\r?\n/).filter((l) => !l.trim().startsWith("//")).join("\n");
    expect(code).not.toMatch(/\.delete\(|\.list\(|createMultipartUpload|SECRET|TOKEN|Authorization|process\.env|SERVICE_ROLE/i);
    expect((code.match(/\.put\(/g) || []).length).toBe(1);
    expect(code).toContain("env.IMAGES");
    expect(code).toContain('new Set(["job-offers", "marketplace-photos", "stories-media"])');
  });
});

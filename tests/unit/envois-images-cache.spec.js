const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const { televerserImagePubliee, CACHE_UN_AN } = require("../../src/lib/imagePubliee.js");

/**
 * Envois d'images publiques (affiches, logo, bannière, audio) : WebP, cache d'un an, variantes 480/960 px.
 * Le nom « -w1280.webp » n'est employé que si -w480 et -w960 existent (le navigateur n'a aucun repli sur un srcset en 404).
 */
const lire = (p) => fs.readFileSync(path.join(__dirname, "../..", p), "utf8").replace(/\r\n/g, "\n");

/** Faux client Supabase : enregistre chaque dépôt et chaque retrait ; `echecs` liste les chemins qui doivent échouer. */
function fauxClient(echecs = []) {
  const depots = [];
  const retraits = [];
  const supabase = {
    storage: {
      from: (bucket) => ({
        upload: async (chemin, corps, options) => {
          depots.push({ bucket, chemin, corps, options });
          return echecs.some((e) => chemin.endsWith(e)) ? { error: { message: "refus" } } : { error: null };
        },
        remove: async (chemins) => {
          retraits.push(...chemins);
          return { error: null };
        },
        getPublicUrl: (chemin) => ({ data: { publicUrl: `https://exemple.test/${bucket}/${chemin}` } }),
      }),
    },
  };
  return { supabase, depots, retraits };
}
const webp = { type: "image/webp", name: "a.webp" };
const options = (surcharges = {}) => ({ preparer: async () => webp, redimensionner: async (_f, l) => ({ type: "image/webp", largeur: l }), ...surcharges });

test.describe("televerserImagePubliee", () => {
  test("affiche : variantes 480 et 960 d'abord, principal « -w1280.webp » ensuite, cache d'un an partout", async () => {
    const { supabase, depots } = fauxClient();
    const r = await televerserImagePubliee(supabase, "job-offers", "u/offers-1-0", { name: "x.jpg" }, options());
    expect(depots.map((d) => d.chemin)).toEqual(["u/offers-1-0-w480.webp", "u/offers-1-0-w960.webp", "u/offers-1-0-w1280.webp"]);
    for (const d of depots) {
      expect(d.bucket).toBe("job-offers");
      expect(d.options.cacheControl).toBe("31536000");
      expect(d.options.contentType).toBe("image/webp");
    }
    expect(CACHE_UN_AN).toBe("31536000");
    expect(r).toEqual({ url: "https://exemple.test/job-offers/u/offers-1-0-w1280.webp", chemin: "u/offers-1-0-w1280.webp" });
  });

  test("une variante refusée : variantes déjà déposées retirées, dépôt simple sans « -w1280 »", async () => {
    const { supabase, depots, retraits } = fauxClient(["-w960.webp"]);
    const r = await televerserImagePubliee(supabase, "job-offers", "u/o", { name: "x.jpg" }, options());
    expect(retraits).toEqual(["u/o-w480.webp"]);
    expect(depots[depots.length - 1].chemin).toBe("u/o.webp");
    expect(r.url).toBe("https://exemple.test/job-offers/u/o.webp");
    expect(depots.some((d) => d.chemin.endsWith("-w1280.webp"))).toBe(false);
  });

  test("le principal refusé après les variantes : les variantes sont retirées, puis dépôt simple", async () => {
    const { supabase, retraits } = fauxClient(["-w1280.webp"]);
    const r = await televerserImagePubliee(supabase, "job-offers", "u/o", { name: "x.jpg" }, options());
    expect(retraits).toEqual(["u/o-w480.webp", "u/o-w960.webp"]);
    expect(r.chemin).toBe("u/o.webp");
  });

  test("variante impossible à produire : aucun « -w1280 », un seul dépôt", async () => {
    const { supabase, depots } = fauxClient();
    const r = await televerserImagePubliee(supabase, "job-offers", "u/o", { name: "x.jpg" }, options({ redimensionner: async () => null }));
    expect(depots.map((d) => d.chemin)).toEqual(["u/o.webp"]);
    expect(depots[0].options.cacheControl).toBe("31536000");
    expect(r.chemin).toBe("u/o.webp");
  });

  test("logo et bannière (variantes: false) : un seul fichier, cache d'un an", async () => {
    const { supabase, depots } = fauxClient();
    const r = await televerserImagePubliee(supabase, "job-offers", "u/branding/logo-1", { name: "l.png" }, options({ variantes: false }));
    expect(depots.map((d) => d.chemin)).toEqual(["u/branding/logo-1.webp"]);
    expect(depots[0].options.cacheControl).toBe("31536000");
    expect(r.chemin).toBe("u/branding/logo-1.webp");
  });

  test("navigateur sans WebP (JPEG renvoyé) : dépôt simple en .jpg, sans variantes", async () => {
    const { supabase, depots } = fauxClient();
    await televerserImagePubliee(supabase, "job-offers", "u/o", { name: "x.jpg" }, options({ preparer: async () => ({ type: "image/jpeg", name: "a.jpg" }) }));
    expect(depots.map((d) => d.chemin)).toEqual(["u/o.jpg"]);
    expect(depots[0].options.contentType).toBe("image/jpeg");
  });

  test("dépôt impossible : url null, rien d'inventé", async () => {
    const { supabase } = fauxClient([".webp", ".jpg"]);
    expect(await televerserImagePubliee(supabase, "job-offers", "u/o", { name: "x.jpg" }, options())).toEqual({ url: null, chemin: null });
  });
});

test.describe("les trois chemins d'envoi", () => {
  test("recruteur et admin des offres : affiches par televerserImagePubliee ; logo et bannière aussi (sans variantes)", () => {
    const recruteur = lire("src/app/recruteur/page.js");
    const admin = lire("src/app/admin/offres/page.js");
    expect(recruteur).toContain('import { televerserImagePubliee } from "@/lib/imagePubliee";');
    expect(admin).toContain('import { televerserImagePubliee } from "@/lib/imagePubliee";');
    expect(recruteur).toContain("`${userSession.user.id}/offers-${Date.now()}-${i}`");
    expect(admin).toContain("`${userSession.user.id}/admin-offers-${Date.now()}-${i}`");
    expect(recruteur).toContain("{ largeurMax: 512, variantes: false }");
    expect(recruteur).toContain("bannerFile, { variantes: false }");
  });
  test("envoi audio : cache d'un an (un audio ne se convertit pas en image)", () => {
    expect(lire("src/components/SelecteurAudioOffre.jsx")).toContain('contentType: file.type || "audio/mpeg", cacheControl: "31536000"');
  });
  test("routes serveur et page détail : cache d'un an sur les affiches (extraction : principal et variantes), détail par le helper", () => {
    const extraction = lire("src/app/api/admin/extract-job-poster/route.js");
    expect((extraction.match(/cacheControl: "31536000"/g) || []).length).toBe(2);
    expect(lire("src/app/api/admin/generate-job-poster/route.js")).toContain('cacheControl: "31536000"');
    expect(lire("src/app/offres/[id]/OffreDetailClient.js")).toContain("televerserImagePubliee(supabase, \"job-offers\"");
  });
  test("plus aucun envoi direct vers « job-offers » sans cache dans le code du site", () => {
    const fichiers = [];
    const parcourir = (dossier) => {
      for (const e of fs.readdirSync(path.join(__dirname, "../..", dossier), { withFileTypes: true })) {
        const rel = `${dossier}/${e.name}`;
        if (e.isDirectory()) parcourir(rel);
        else if (/\.(js|jsx)$/.test(e.name)) fichiers.push(rel);
      }
    };
    parcourir("src");
    const fautifs = fichiers.filter((f) => {
      const code = lire(f);
      return /from\("job-offers"\)\s*\.upload\(/.test(code.replace(/\n\s*/g, "")) && !/cacheControl/.test(code);
    });
    expect(fautifs).toEqual([]);
  });
});

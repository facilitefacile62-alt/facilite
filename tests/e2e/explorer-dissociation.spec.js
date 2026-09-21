const { test, expect } = require("@playwright/test");

/**
 * Explorer — dissociation des boutiques superposées. Localhost uniquement,
 * Supabase entièrement simulé (aucune requête vers la base réelle ni vers
 * ffacilite.com).
 *
 * Coordonnées : boutique réelle de Guinaw Rail Nord (lecture publique de
 * marketplace_stores, quartier + coordonnées seulement) ; les autres
 * boutiques sont placées à moins de 1 m d'elle (écarts de l'ordre de 5e-6°),
 * et la position "Vous êtes ici" est exactement la même.
 */

const GUINAW = { latitude: 14.75573, longitude: -17.38425 };
const DIALOGUE = '[role="dialog"][aria-label*="Snap Map"]';

function boutiquesQuasiConfondues(n) {
  return Array.from({ length: n }).map((_, i) => ({
    id: `aaaaaaaa-0000-0000-0000-0000000000${String(i).padStart(2, "0")}`,
    titre: `Article ${i}`,
    prix_xof: 1000 * (i + 1),
    photos: [],
    boutique_id: `bbbbbbbb-0000-0000-0000-0000000000${String(i).padStart(2, "0")}`,
    boutique_nom: `Boutique ${i}`,
    boutique_lat: GUINAW.latitude + ((i * 7) % 5 - 2) * 0.000005,
    boutique_lng: GUINAW.longitude + ((i * 3) % 5 - 2) * 0.000005,
    quartier: "Guinaw Rail Nord",
    ville: "Pikine",
    telephone_whatsapp: null,
    whatsapp: null,
    statut: "en_stock",
    distance_km: 0,
    boutique_avatar_config: null,
    boutique_owner_id: null,
  }));
}

async function ouvrirExplorer(page, n, { ici = GUINAW } = {}) {
  await page.route("**/rest/v1/**", async (route) => {
    const url = route.request().url();
    const corps = url.includes("/rpc/rechercher_articles_proches") ? boutiquesQuasiConfondues(n) : [];
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(corps) });
  });
  await page.goto(`/marketplace?lat=${ici.latitude}&lng=${ici.longitude}&explorer=1`);
  const explorer = page.locator(DIALOGUE);
  await expect(explorer).toBeVisible({ timeout: 90_000 });
  await expect(explorer.locator(".snap-custom-icon .avatar-boutique-zoom-scale")).toHaveCount(n, { timeout: 60_000 });
  await expect(explorer.locator(".snap-custom-moi")).toHaveCount(1, { timeout: 60_000 });
  await page.waitForTimeout(2500); // fin du centrage animé + recalcul de la dissociation
  return explorer;
}

// Mesures DOM (coordonnées relatives au conteneur de la carte).
function mesurer(page) {
  return page.evaluate((dialogue) => {
    const cont = document.querySelector(`${dialogue} .leaflet-container`);
    const cr = cont.getBoundingClientRect();
    const centre = (r) => ({ cx: r.left + r.width / 2 - cr.left, cy: r.top + r.height / 2 - cr.top, w: r.width, h: r.height });
    const avatars = [...cont.querySelectorAll(".snap-custom-icon .avatar-boutique-zoom-scale")].map((el) => centre(el.getBoundingClientRect()));
    const moi = cont.querySelector(".snap-custom-moi");
    let zonesIci = [];
    let pointBadgeIci = null;
    if (moi) {
      const badge = [...moi.querySelectorAll("div")].find((d) => d.children.length === 0 && d.textContent.trim() === "Vous êtes ici");
      const rond = moi.querySelector(".marqueur-decale-contenu .w-12");
      // Parties VISIBLES (avatar rond + pastille) : la boîte de l'icône,
      // transparente, reste à la vraie coordonnée.
      zonesIci = [rond, badge]
        .filter(Boolean)
        .map((el) => {
          const r = el.getBoundingClientRect();
          return { gauche: r.left - cr.left, haut: r.top - cr.top, droite: r.right - cr.left, bas: r.bottom - cr.top };
        });
      const rb = badge.getBoundingClientRect();
      pointBadgeIci = { x: rb.left + rb.width / 2, y: rb.top + rb.height / 2 };
    }
    const traits = [...cont.querySelectorAll(".trait-rappel")].filter((t) => t.dataset.actif === "1").length;
    const dansLaCarte = pointBadgeIci ? document.elementFromPoint(pointBadgeIci.x, pointBadgeIci.y) : null;
    return {
      avatars,
      zonesIci,
      traits,
      badgeIciAuDessus: Boolean(dansLaCarte && dansLaCarte.closest(".snap-custom-moi")),
    };
  }, DIALOGUE);
}

function distanceMinAvatars(avatars) {
  let min = Infinity;
  for (let i = 0; i < avatars.length; i++) {
    for (let j = i + 1; j < avatars.length; j++) {
      min = Math.min(min, Math.hypot(avatars[i].cx - avatars[j].cx, avatars[i].cy - avatars[j].cy));
    }
  }
  return min;
}

// Distance du centre d'un avatar (cercle de rayon w/2) à la boîte du badge "ici".
function recouvrementAvecIci(avatar, boite) {
  const px = Math.max(boite.gauche, Math.min(avatar.cx, boite.droite));
  const py = Math.max(boite.haut, Math.min(avatar.cy, boite.bas));
  return avatar.w / 2 - Math.hypot(avatar.cx - px, avatar.cy - py); // > 0 = recouvrement
}

test.describe("Explorer — dissociation des boutiques quasi confondues", () => {
  test.setTimeout(240_000);

  for (let n = 1; n <= 10; n++) {
    test(`${n} boutique(s) à Guinaw Rail Nord + "Vous êtes ici" au même point`, async ({ page }) => {
      const erreurs = [];
      page.on("pageerror", (e) => erreurs.push(e.message));
      await ouvrirExplorer(page, n);
      const m = await mesurer(page);

      // Groupe = n boutiques + "Vous êtes ici" : tous déplacés, tous reliés.
      expect.soft(m.traits, "traits de rappel affichés").toBe(n + 1);
      if (n >= 2) {
        const w = Math.max(...m.avatars.map((a) => a.w));
        expect.soft(distanceMinAvatars(m.avatars), "distance mini entre avatars").toBeGreaterThanOrEqual(w - 1.5);
      }
      for (const a of m.avatars) {
        for (const zone of m.zonesIci) {
          expect.soft(recouvrementAvecIci(a, zone), "recouvrement avec le badge Vous êtes ici").toBeLessThanOrEqual(1);
        }
      }
      expect.soft(m.badgeIciAuDessus, "badge Vous êtes ici au-dessus des autres marqueurs").toBe(true);
      expect.soft(erreurs.filter((e) => e.includes("_leaflet_pos"))).toEqual([]);
    });
  }

  test('"Vous êtes ici" éloigné : une boutique seule n\'a aucun trait, 5 boutiques quasi confondues en ont 5', async ({ page }) => {
    const ailleurs = { latitude: GUINAW.latitude + 0.05, longitude: GUINAW.longitude + 0.05 };
    const explorer = await ouvrirExplorer(page, 5, { ici: ailleurs });
    // 5 boutiques regroupées, "ici" seul : 5 traits.
    const m = await mesurer(page);
    expect(m.traits).toBe(5);
    expect(distanceMinAvatars(m.avatars)).toBeGreaterThanOrEqual(Math.max(...m.avatars.map((a) => a.w)) - 1.5);
    await expect(explorer).toBeVisible();
  });

  test("après un zoom, aucun recouvrement et rien ne change entre la fin du geste et le relâchement", async ({ page }) => {
    const explorer = await ouvrirExplorer(page, 6);
    const zoomAvant = explorer.getByLabel("Zoom avant");

    for (const etape of [1, 2]) {
      await zoomAvant.click();
      await page.waitForTimeout(90); // laisse passer le premier cadre d'animation

      // Un cadre par requestAnimationFrame pendant 1,1 s (animation ~0,25 s
      // puis zoomend puis recalculs différés).
      const cadres = await page.evaluate(async (dialogue) => {
        const cont = document.querySelector(`${dialogue} .leaflet-container`);
        const sortie = [];
        const debut = performance.now();
        await new Promise((resolve) => {
          const boucle = () => {
            const cr = cont.getBoundingClientRect();
            const av = [...cont.querySelectorAll(".snap-custom-icon .avatar-boutique-zoom-scale")].map((el) => {
              const r = el.getBoundingClientRect();
              return { cx: r.left + r.width / 2 - cr.left, cy: r.top + r.height / 2 - cr.top, w: r.width };
            });
            const gx = av.reduce((s, a) => s + a.cx, 0) / av.length;
            const gy = av.reduce((s, a) => s + a.cy, 0) / av.length;
            sortie.push({
              t: performance.now() - debut,
              forme: av.map((a) => ({ dx: a.cx - gx, dy: a.cy - gy, w: a.w })),
            });
            if (performance.now() - debut < 1100) requestAnimationFrame(boucle);
            else resolve();
          };
          requestAnimationFrame(boucle);
        });
        return sortie;
      }, DIALOGUE);

      const derniere = cadres[cadres.length - 1].forme;
      let ecartMax = 0;
      let ecartTaille = 0;
      for (const c of cadres) {
        c.forme.forEach((f, i) => {
          ecartMax = Math.max(ecartMax, Math.hypot(f.dx - derniere[i].dx, f.dy - derniere[i].dy));
          // La taille suit une transition CSS de 150 ms : on ne compare qu'après.
          if (c.t >= 150) ecartTaille = Math.max(ecartTaille, Math.abs(f.w - derniere[i].w));
        });
      }
      expect(ecartMax, `zoom n°${etape} : écart de forme (px) entre un cadre du geste et l'état final`).toBeLessThanOrEqual(1.5);
      expect(ecartTaille, `zoom n°${etape} : écart de taille d'avatar (px)`).toBeLessThanOrEqual(0.6);

      const m = await mesurer(page);
      expect(distanceMinAvatars(m.avatars), `zoom n°${etape} : distance mini`).toBeGreaterThanOrEqual(Math.max(...m.avatars.map((a) => a.w)) - 1.5);
    }
  });

  test("survol et clic d'un avatar dissocié : la bulle de LA BONNE boutique s'ouvre", async ({ page }) => {
    const explorer = await ouvrirExplorer(page, 6);
    const avatars = explorer.locator(".snap-custom-icon .avatar-boutique-zoom-scale");
    const bulle = page.locator(".carte-bulle-produits-popup");
    const nomDuMarqueur = (locator) =>
      locator.evaluate((el) => el.closest(".snap-marker-pin").querySelector("span.font-extrabold").textContent.trim());

    // Les étiquettes de nom (larges, au-dessus de chaque avatar) des marqueurs
    // voisins peuvent couvrir le centre de certains avatars : on ne cible que
    // ceux dont le centre appartient bien à leur propre marqueur.
    const libres = await avatars.evaluateAll((els) =>
      els
        .map((el, i) => {
          const r = el.getBoundingClientRect();
          const dessus = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return dessus && dessus.closest(".snap-marker-pin") === el.closest(".snap-marker-pin") ? i : -1;
        })
        .filter((i) => i >= 0)
    );
    expect(libres.length, "avatars dont le centre est libre").toBeGreaterThanOrEqual(3);

    for (const i of libres.slice(0, 2)) {
      const cible = avatars.nth(i);
      const nom = await nomDuMarqueur(cible);
      await cible.hover();
      await expect(bulle, "survol de l'avatar n°" + i).toBeVisible({ timeout: 5000 });
      await expect(bulle).toContainText(nom);
      await page.mouse.move(5, 5);
      await expect(bulle).toBeHidden({ timeout: 5000 });
    }

    // Simple clic : la bulle reste épinglée après avoir quitté l'avatar.
    const cible = avatars.nth(libres[2]);
    const nom = await nomDuMarqueur(cible);
    await cible.click();
    await page.waitForTimeout(500);
    await page.mouse.move(5, 5);
    await page.waitForTimeout(700);
    await expect(bulle).toBeVisible();
    await expect(bulle).toContainText(nom);
  });
});

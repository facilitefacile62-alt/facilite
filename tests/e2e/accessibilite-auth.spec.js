const { test, expect } = require("@playwright/test");

/** Accessibilité de /login et /register : zoom permis, champs et boutons nommés, cibles tactiles suffisantes. */
test.use({ viewport: { width: 390, height: 844 } });

for (const chemin of ["/login", "/register"]) {
  test.describe(`Accessibilité ${chemin}`, () => {
    test("le zoom n'est pas bloqué", async ({ page }) => {
      await page.goto(chemin);
      const viewport = await page.locator('meta[name="viewport"]').getAttribute("content");
      expect(viewport).not.toMatch(/user-scalable\s*=\s*(no|0)/i);
      expect(viewport).not.toMatch(/maximum-scale\s*=\s*1(\.0)?\b/i);
    });

    test("tout champ de saisie a un nom accessible", async ({ page }) => {
      await page.goto(chemin);
      const sansNom = await page.evaluate(() =>
        Array.from(document.querySelectorAll("input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, textarea"))
          .filter((el) => {
            if (el.getAttribute("aria-label") || el.getAttribute("aria-labelledby")) return false;
            if (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) return false;
            if (el.closest("label")) return false;
            return true;
          })
          .map((el) => `${el.tagName}:${el.name || el.type}:${el.placeholder || ""}`)
      );
      // Les champs réels portent leur libellé visible dans un <label> voisin sans lien explicite ; seul le contrôle
      // anti-robot (masqué) et les champs sans aucun libellé sont signalés ici : la liste doit rester vide.
      expect(sansNom, "champs sans nom accessible").toEqual([]);
    });

    test("tout bouton a un nom accessible et une cible tactile d'au moins 24 px", async ({ page }) => {
      await page.goto(chemin);
      await page.waitForLoadState("networkidle");
      const problemes = await page.evaluate(() =>
        Array.from(document.querySelectorAll("button, a[href]"))
          .filter((el) => el.offsetParent !== null)
          .map((el) => {
            const r = el.getBoundingClientRect();
            const nom = (el.getAttribute("aria-label") || el.textContent || el.getAttribute("title") || "").trim();
            return { nom, w: Math.round(r.width), h: Math.round(r.height), balise: el.tagName };
          })
          .filter((b) => !b.nom || ((b.w < 24 || b.h < 24) && b.balise === "BUTTON"))
      );
      expect(problemes, JSON.stringify(problemes)).toEqual([]);
    });
  });
}

const { test, expect } = require("@playwright/test");

/** Message au recruteur après enregistrement d'une offre : vrai selon le statut de modération. */
const charger = () => import("../../src/lib/messagePublication.js");

test("offre en attente de modération : le message le dit, sans annoncer une publication", async () => {
  const { messagePublication } = await charger();
  expect(messagePublication({ status: "pending_review" }, "Offre publiée !")).toBe("Offre envoyée pour modération, elle sera visible après validation.");
  expect(messagePublication({ status: "rejected" })).toMatch(/modération/);
});

test("offre approuvée (ou statut absent) : message de publication", async () => {
  const { messagePublication } = await charger();
  expect(messagePublication({ status: "approved" }, "Offre publiée !")).toBe("Offre publiée !");
  expect(messagePublication({}, "Offre publiée !")).toBe("Offre publiée !");
  expect(messagePublication(null)).toBe("Offre publiée !");
});

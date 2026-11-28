const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

const racine = path.resolve(__dirname, "../..");
const lire = (p) => fs.readFileSync(path.join(racine, p), "utf-8").replace(/\r\n/g, "\n");

test("plus de relance « candidature toujours en cours d'examen » ; les deux autres tâches de 08 h 00 restent", () => {
  const cron = lire("src/app/api/cron/reminders/route.js");
  expect(cron).not.toContain('from("candidatures")');
  expect(cron).not.toContain("remindStalePendingCandidatures");
  expect(cron).not.toMatch(/subject: .*en cours d'examen/);
  expect(cron).toContain("remindAbandonedCvDrafts(admin)");
  expect(cron).toContain('rpc("souhaiter_anniversaires")');
});

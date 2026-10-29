const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * Rechargement économe des listes d'offres (accueil et page Offres) : planificateur testé avec une horloge simulée, et branchement dans les deux écrans.
 */
const lire = (p) => fs.readFileSync(path.join(__dirname, "../..", p), "utf8").replace(/\r\n/g, "\n");
const planificateur = () => import("../../src/lib/rafraichissementAccueil.js");

/** Horloge simulée : minuteries et temps maîtrisés. */
function horloge() {
  const h = {
    t: 0,
    file: [],
    suivant: 1,
    setTimeout(f, ms) {
      const id = h.suivant++;
      h.file.push({ id, at: h.t + ms, f });
      return id;
    },
    clearTimeout(id) {
      h.file = h.file.filter((x) => x.id !== id);
    },
    maintenant: () => h.t,
    avancer(ms) {
      const fin = h.t + ms;
      for (;;) {
        const prochain = h.file.filter((x) => x.at <= fin).sort((a, b) => a.at - b.at || a.id - b.id)[0];
        if (!prochain) break;
        h.file = h.file.filter((x) => x !== prochain);
        h.t = prochain.at;
        prochain.f();
      }
      h.t = fin;
    },
  };
  return h;
}
const S = 1000;

async function creer(options = {}) {
  const { creerRafraichissement } = await planificateur();
  const h = horloge();
  const etat = { visible: true, charges: 0 };
  const r = creerRafraichissement({ charger: () => void (etat.charges += 1), estVisible: () => etat.visible, maintenant: h.maintenant, minuteur: h, ...options });
  return { h, etat, r };
}
const cacher = ({ etat, r }) => {
  etat.visible = false;
  r.surVisibilite();
};
const afficher = ({ etat, r }) => {
  etat.visible = true;
  r.surVisibilite();
};

test.describe("rafraîchissement économe", () => {
  test("onglet visible : un chargement au départ, puis un seul toutes les 5 minutes (avant : 1 par minute)", async () => {
    const c = await creer();
    c.r.demarrer();
    expect(c.etat.charges).toBe(1);
    c.h.avancer(299 * S);
    expect(c.etat.charges).toBe(1);
    c.h.avancer(1 * S);
    expect(c.etat.charges).toBe(2);
    c.h.avancer(300 * S);
    expect(c.etat.charges).toBe(3);
    c.h.avancer(3600 * S);
    expect(c.etat.charges).toBe(3 + 12);
  });
  test("onglet caché une heure : AUCUNE requête (avant : 60)", async () => {
    const c = await creer();
    c.r.demarrer();
    cacher(c);
    c.h.avancer(3600 * S);
    expect(c.etat.charges).toBe(1);
  });
  test("ouvert directement en arrière-plan : un chargement au départ (comme avant), puis rien", async () => {
    const c = await creer();
    c.etat.visible = false;
    c.r.demarrer();
    c.h.avancer(3600 * S);
    expect(c.etat.charges).toBe(1);
  });
  test("rafale d'événements temps réel : UN seul chargement, 5 secondes après le dernier", async () => {
    const c = await creer();
    c.r.demarrer();
    for (let i = 0; i < 6; i++) {
      c.r.surChangement();
      c.h.avancer(1 * S);
    }
    expect(c.etat.charges).toBe(1);
    c.h.avancer(3 * S);
    expect(c.etat.charges).toBe(1);
    c.h.avancer(2 * S);
    expect(c.etat.charges).toBe(2);
  });
  test("événement pendant que l'onglet est caché : aucune requête ; une seule au retour, même si le dernier chargement date de moins d'une minute", async () => {
    const c = await creer();
    c.r.demarrer();
    cacher(c);
    c.r.surChangement();
    c.r.surChangement();
    c.h.avancer(20 * S);
    expect(c.etat.charges).toBe(1);
    afficher(c);
    expect(c.etat.charges).toBe(2);
    afficher(c);
    expect(c.etat.charges).toBe(2);
  });
  test("événement en attente quand l'onglet se cache : la liste est marquée et se recharge au retour, sans requête cachée", async () => {
    const c = await creer();
    c.r.demarrer();
    c.r.surChangement();
    c.h.avancer(2 * S);
    cacher(c);
    c.h.avancer(10 * S);
    expect(c.etat.charges).toBe(1);
    afficher(c);
    expect(c.etat.charges).toBe(2);
  });
  test("retour d'onglet sans événement : recharge seulement si la liste a plus d'une minute", async () => {
    const c = await creer();
    c.r.demarrer();
    cacher(c);
    c.h.avancer(30 * S);
    afficher(c);
    expect(c.etat.charges).toBe(1);
    cacher(c);
    c.h.avancer(120 * S);
    afficher(c);
    expect(c.etat.charges).toBe(2);
  });
  test("après un retour d'onglet, le sondage lent repart", async () => {
    const c = await creer();
    c.r.demarrer();
    cacher(c);
    c.h.avancer(1000 * S);
    afficher(c);
    const apres = c.etat.charges;
    c.h.avancer(300 * S);
    expect(c.etat.charges).toBe(apres + 1);
  });
  test("mode page Offres (sans sondage, sans rechargement pour ancienneté) : un événement regroupé, rien d'autre, même après une longue absence", async () => {
    const c = await creer({ intervalleVisibleMs: null, ecartMinimalMs: null });
    c.r.demarrer();
    c.h.avancer(3600 * S);
    expect(c.etat.charges).toBe(1);
    cacher(c);
    c.h.avancer(3600 * S);
    afficher(c);
    expect(c.etat.charges).toBe(1);
    c.r.surChangement();
    c.r.surChangement();
    c.h.avancer(5 * S);
    expect(c.etat.charges).toBe(2);
  });
  test("arreter() annule tout : sondage et attente en cours", async () => {
    const c = await creer();
    c.r.demarrer();
    c.r.surChangement();
    c.r.arreter();
    c.h.avancer(3600 * S);
    expect(c.etat.charges).toBe(1);
    c.r.surChangement();
    afficher(c);
    c.h.avancer(3600 * S);
    expect(c.etat.charges).toBe(1);
  });
});

test.describe("branchement dans l'accueil et la page Offres", () => {
  test("accueil : plus de sondage à 60 secondes, planificateur utilisé, nettoyage à la sortie", () => {
    const code = lire("src/app/HomeClient.jsx");
    expect(code).not.toContain("setInterval(loadDynamicJobs, 60000)");
    expect(code).toContain("creerRafraichissement({");
    expect(code).toContain("rafraichissement.demarrer();");
    expect(code).toContain("rafraichissement.surChangement();");
    expect(code).toContain("rafraichissement.surVisibilite();");
    expect(code).toContain("rafraichissement.arreter();");
    expect(code).not.toMatch(/postgres_changes[\s\S]{0,200}\(\) => \{\s*loadDynamicJobs\(\);/);
  });
  test("page Offres : événements regroupés et différés en onglet caché, sans sondage", () => {
    const code = lire("src/app/offres/OffresClient.jsx");
    expect(code).toContain("intervalleVisibleMs: null,");
    expect(code).toContain("ecartMinimalMs: null,");
    expect(code).toContain("rafraichissement.demarrer();");
    expect(code).toContain("rafraichissement.surChangement();");
    expect(code).toContain("rafraichissement.arreter();");
    expect(code).not.toMatch(/postgres_changes[\s\S]{0,200}\(\) => \{\s*loadData\(\);/);
  });
});

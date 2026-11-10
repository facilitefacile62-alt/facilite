const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * Page « Établissements ouverts près de moi » : chaque établissement propose « Itinéraire » et « Démarrer » (Google Maps, par les coordonnées),
 * en plus du bouton « Appeler » qui existait déjà.
 */
const lire = (p) => fs.readFileSync(path.join(__dirname, "../..", p), "utf8").replace(/\r\n/g, "\n");
const lib = () => import("../../src/lib/itineraire.js");

test("coordonnées : valides seulement (latitude -90..90, longitude -180..180) ; texte, vide et hors bornes refusés", async () => {
  const { coordonnees } = await lib();
  expect(coordonnees(14.7167, -17.4677)).toBe("14.7167,-17.4677");
  expect(coordonnees("14.75", "-17.39")).toBe("14.75,-17.39");
  expect(coordonnees(0, 0)).toBe("0,0");
  for (const [a, b] of [[null, 1], [1, null], ["", ""], ["abc", 1], [91, 0], [0, 181], [undefined, undefined], [NaN, 1]]) {
    expect(coordonnees(a, b), `${a},${b}`).toBeNull();
  }
});

test("« Itinéraire » : lien Google Maps vers les coordonnées de l'établissement, en voiture, avec le départ si on le connaît", async () => {
  const { lienItineraire } = await lib();
  const e = { latitude: 14.7547, longitude: -17.3906 };
  expect(lienItineraire(e)).toBe("https://www.google.com/maps/dir/?api=1&destination=14.7547,-17.3906&travelmode=driving");
  expect(lienItineraire(e, { latitude: 14.69, longitude: -17.44 })).toBe(
    "https://www.google.com/maps/dir/?api=1&origin=14.69,-17.44&destination=14.7547,-17.3906&travelmode=driving"
  );
  // Départ invalide : ignoré (Google Maps prend alors la position actuelle).
  expect(lienItineraire(e, { latitude: "x", longitude: 1 })).toBe("https://www.google.com/maps/dir/?api=1&destination=14.7547,-17.3906&travelmode=driving");
  expect(lienItineraire(e, null)).toBe("https://www.google.com/maps/dir/?api=1&destination=14.7547,-17.3906&travelmode=driving");
});

test("« Démarrer » : même trajet avec le guidage lancé (dir_action=navigate)", async () => {
  const { lienDemarrer, lienItineraire } = await lib();
  const e = { latitude: 14.7547, longitude: -17.3906 };
  expect(lienDemarrer(e)).toBe(`${lienItineraire(e)}&dir_action=navigate`);
  expect(lienDemarrer(e, { latitude: 14.69, longitude: -17.44 })).toContain("origin=14.69,-17.44");
  expect(lienDemarrer(e, { latitude: 14.69, longitude: -17.44 })).toMatch(/&dir_action=navigate$/);
});

test("établissement sans coordonnées : aucun lien (pas de bouton), jamais « undefined » ni « null » dans l'adresse", async () => {
  const { lienItineraire, lienDemarrer } = await lib();
  for (const e of [{}, { latitude: null, longitude: null }, { latitude: 14.7 }, null, undefined]) {
    expect(lienItineraire(e)).toBeNull();
    expect(lienDemarrer(e)).toBeNull();
  }
  const url = lienItineraire({ latitude: 14.7, longitude: -17.4 });
  expect(url).not.toMatch(/undefined|null|NaN/);
});

test("la page affiche Itinéraire et Démarrer pour chaque établissement (liens externes sûrs), sans retirer « Appeler »", () => {
  const p = lire("src/app/etablissements/page.js");
  expect(p).toContain('import { lienDemarrer, lienItineraire } from "@/lib/itineraire";');
  expect(p).toContain("lienItineraire(e, position) && (");
  expect(p).toContain("href={lienItineraire(e, position)}");
  expect(p).toContain("href={lienDemarrer(e, position)}");
  expect(p).toContain('data-testid="lien-itineraire"');
  expect(p).toContain('data-testid="lien-demarrer"');
  expect((p.match(/target="_blank"\s+rel="noopener noreferrer"/g) || []).length).toBeGreaterThanOrEqual(2);
  expect(p).toContain("href={`tel:${e.telephone}`}"); // « Appeler » reste
  // Aucun appel réseau ni enregistrement ajouté pour l'itinéraire.
  expect(fs.readFileSync(path.join(__dirname, "../../src/lib/itineraire.js"), "utf8")).not.toMatch(/fetch\(|supabase|localStorage/);
});

test("la carte des boutiques : Itinéraire et Démarrer restent sur la carte du site (trajet tracé, carte cadrée), sans ouvrir Google Maps", () => {
  const g = lire("src/components/GlobeExplorateurBoutiques.jsx");
  expect(g).toContain('["data-itineraire", "data-demarrer"]');
  expect(g).toContain("cadrer: true");
  expect(g).toContain("itineraireCibleProp || itineraireCible.cadrer");
  const i = g.indexOf('data-itineraire="${');
  const bulle = g.slice(i, i + 1200);
  expect(bulle).toContain("data-demarrer=");
  expect(bulle).not.toContain("google.com/maps");
  expect(g).not.toContain("lienDemarrer");
});

test("application mobile : « Démarrer » à côté d'« Itinéraire » dans le carrousel de la carte, trajet tracé dans l'application (jamais Google Maps)", () => {
  const c = lire("mobile/src/components/CarteLeaflet.tsx");
  expect(c).toContain('data-act="demarrer:');
  expect(c).toContain('data-act="itineraire:');
  const a = lire("mobile/src/app/marketplace/autour.tsx");
  expect(a).toContain("id.startsWith('itineraire:') || id.startsWith('demarrer:')");
  expect(a).toContain("calculerItineraire(position, arrivee)");
  expect(a).toContain("carte?.centrer(position.latitude, position.longitude, 18)");
  expect(a).not.toMatch(/google\.com\/maps|Linking\.openURL/);
});

test("application : la croix de la bulle ramène la carte à la vue d'avant le zoom (dézoom)", () => {
  const c = lire("mobile/src/components/CarteLeaflet.tsx");
  expect(c).toContain("window.memoriserVue = function");
  expect(c).toContain("window.restaurerVue = function");
  expect(c).toContain("if (!vueAvant) vueAvant =");
  const a = lire("mobile/src/app/marketplace/autour.tsx");
  expect(a).toMatch(/carte\?\.memoriserVue\(\);\n\s+setSelection\(id\);/);
  expect(a).toMatch(/if \(id === 'fermer'\) \{\n\s+setSelection\(null\);\n\s+carte\?\.restaurerVue\(\)/);
});

// ── Guidage « Démarrer » (application) : direction à prendre, comme Google Maps ──
test("guidage : virage à droite détecté, consigne avec distance, tout droit sinon, arrivée, écart au tracé", async () => {
  const g = await import("../../mobile/src/lib/guidage.ts");
  const lat0 = 14.7, lng0 = -17.4;
  const dLat = (m) => m / 111320;
  const dLng = (m) => m / (111320 * Math.cos((lat0 * Math.PI) / 180));
  // 200 m vers le nord, puis 200 m vers l'est : un virage à DROITE à 200 m.
  const pts = [];
  for (let m = 0; m <= 200; m += 25) pts.push([lat0 + dLat(m), lng0]);
  for (let m = 25; m <= 200; m += 25) pts.push([lat0 + dLat(200), lng0 + dLng(m)]);
  const virages = g.extraireVirages(pts);
  expect(virages.length).toBe(1);
  expect(virages[0].type).toBe("droite");
  expect(Math.round(virages[0].distanceM / 10) * 10).toBe(200);

  const depart = g.etatGuidage(pts, { latitude: lat0, longitude: lng0 });
  expect(depart.consigne).toBe("Dans 200 m, tournez à droite");
  expect(Math.round(depart.restantM / 10) * 10).toBe(400);
  const proche = g.etatGuidage(pts, { latitude: lat0 + dLat(180), longitude: lng0 });
  expect(proche.consigne).toBe("Tournez à droite");
  const apres = g.etatGuidage(pts, { latitude: lat0 + dLat(200), longitude: lng0 + dLng(80) });
  expect(apres.prochain).toBeNull();
  expect(apres.consigne).toMatch(/^Continuez tout droit · arrivée dans 1[12]0 m$/);
  const fin = g.etatGuidage(pts, { latitude: lat0 + dLat(200), longitude: lng0 + dLng(195) });
  expect(fin.arrive).toBe(true);
  expect(fin.consigne).toBe("Vous êtes arrivé");
  const loin = g.etatGuidage(pts, { latitude: lat0 + dLat(100), longitude: lng0 + dLng(150) });
  expect(loin.horsTrace).toBe(true);
  expect(g.etatGuidage([[1, 1]], { latitude: 1, longitude: 1 })).toBeNull();
});

test("guidage : virage à gauche et ligne droite sans virage", async () => {
  const g = await import("../../mobile/src/lib/guidage.ts");
  const dLat = (m) => m / 111320;
  const dLng = (m) => m / (111320 * Math.cos((14.7 * Math.PI) / 180));
  const gauche = [];
  for (let m = 0; m <= 100; m += 25) gauche.push([14.7 + dLat(m), -17.4]);
  for (let m = 25; m <= 100; m += 25) gauche.push([14.7 + dLat(100), -17.4 - dLng(m)]);
  expect(g.extraireVirages(gauche)[0].type).toBe("gauche");
  const droit = [0, 50, 100, 150, 200].map((m) => [14.7 + dLat(m), -17.4]);
  expect(g.extraireVirages(droit)).toEqual([]);
  expect(g.etatGuidage(droit, { latitude: 14.7, longitude: -17.4 }).consigne).toMatch(/^Continuez tout droit · arrivée dans 200 m$/);
  expect(g.distanceLisible(1460)).toBe("1,5 km");
});

test("application : « Démarrer » dans la bulle d'une boutique lance le guidage dans l'application (suivi GPS, consigne, Arrêter), sans Google Maps", () => {
  const c = lire("mobile/src/components/CarteLeaflet.tsx");
  expect(c).toContain("pb-action2");
  expect(c).toContain("action2?:");
  const a = lire("mobile/src/app/marketplace/autour.tsx");
  expect(a).toContain("action2: { id: 'demarrer', libelle: 'Démarrer'");
  expect(a).toContain("if (id === 'demarrer') {");
  expect(a).toContain("Location.watchPositionAsync(");
  expect(a).toContain("etatGuidage(trajet.points as PointTrace[]");
  expect(lire("mobile/src/components/GuidageNavigation.tsx")).toContain('accessibilityLabel="Arrêter le guidage"');
  expect(a).toContain("consigne?.horsTrace"); // recalcul si écart
  expect(a).not.toMatch(/google\.com\/maps|Linking\.openURL/);
});

test("application : pastille sur Profil = nombre de dossiers (candidatures) reçus non consultés, mise à jour en direct", async () => {
  const n = lire("mobile/src/lib/notifications.ts");
  expect(n).toContain("export async function compterCandidaturesNonLues");
  expect(n).toMatch(/\.eq\('type', 'candidature'\)\s+\.eq\('is_read', false\)/);
  const h = lire("mobile/src/lib/useCompteursNonLus.ts");
  expect(h).toContain("candidatures: number");
  expect(h).toContain("compterCandidaturesNonLues().catch(() => 0)"); // un échec vaut 0, jamais une erreur d'écran
  expect(h).toContain("table: 'notifications'");
  for (const f of ["FaciliteBottomBar", "MarketplaceBottomBar"]) {
    expect(lire(`mobile/src/components/${f}.tsx`)).toContain("e.id === 'profil' ? <PastilleCompteur valeur={compteurs.candidatures} />");
  }
  const { libellePastille } = await import("../../mobile/src/lib/notifications.ts").catch(() => ({ libellePastille: null }));
  if (libellePastille) {
    expect(libellePastille(1)).toBe("1");
    expect(libellePastille(0)).toBeNull();
    expect(libellePastille(12)).toBe("9+");
  }
});

test("guidage façon Google : « Puis » le virage suivant, instruction sans distance, heure d'arrivée", async () => {
  const g = await import("../../mobile/src/lib/guidage.ts");
  const dLat = (m) => m / 111320;
  const dLng = (m) => m / (111320 * Math.cos((14.7 * Math.PI) / 180));
  // nord 100 m, est 100 m, nord 100 m : deux virages (droite puis gauche) à 100 m d'écart.
  const pts = [];
  for (let m = 0; m <= 100; m += 25) pts.push([14.7 + dLat(m), -17.4]);
  for (let m = 25; m <= 100; m += 25) pts.push([14.7 + dLat(100), -17.4 + dLng(m)]);
  for (let m = 25; m <= 100; m += 25) pts.push([14.7 + dLat(100 + m), -17.4 + dLng(100)]);
  const e = g.etatGuidage(pts, { latitude: 14.7, longitude: -17.4 });
  expect(e.prochain.type).toBe("droite");
  expect(e.ensuite).toBe("gauche");
  expect(e.instruction).toBe("Tournez à droite");
  const fin = g.etatGuidage(pts, { latitude: 14.7 + dLat(200), longitude: -17.4 + dLng(100) });
  expect(fin.ensuite).toBeNull();
  expect(g.etatGuidage(pts, { latitude: 14.7 + dLat(150), longitude: -17.4 + dLng(100) }).instruction).toBe("Continuez tout droit");
  const c = lire("mobile/src/components/GuidageNavigation.tsx");
  for (const t of ["Puis", "Recentrer", "km/h", "Arrêter le guidage", "heureArrivee(minutes)"]) expect(c).toContain(t);
  const a = lire("mobile/src/app/marketplace/autour.tsx");
  expect(a).toContain("<GuidageNavigation");
  expect(a).toContain("(sombre || guidage != null)"); // carte sombre pendant le guidage, comme Google la nuit
  expect(a).toContain("display: guidage ? 'none' : 'flex'"); // la recherche et le carrousel s'effacent
  expect(a).toContain("p.coords.speed"); // vitesse réelle du GPS
  expect(a).not.toMatch(/google\.com\/maps|Linking\.openURL/);
});

test("guidage : trait cyan épais bordé de blanc (sans recadrage) et flèche du véhicule orientée dans le sens de la marche", () => {
  const c = lire("mobile/src/components/CarteLeaflet.tsx");
  expect(c).toContain("navigation?: boolean");
  expect(c).toContain("color: '#22D3EE', weight: 4");
  expect(c).toContain("window.majVehicule = function");
  expect(c).toContain("rotate(' + (capDeg || 0) + 'deg)");
  const a = lire("mobile/src/app/marketplace/autour.tsx");
  expect(a).toContain("navigation: guidage != null");
  expect(a).toContain("carte?.vehicule(positionLive.latitude, positionLive.longitude, nordHaut ? capVehicule.current : 0)");
  expect(a).toContain("carte?.vehicule(null)"); // la flèche disparaît à l'arrêt
});

test("guidage : la carte pivote selon le cap (direction de la marche vers le haut) et le suivi GPS a un relevé de secours", () => {
  const c = lire("mobile/src/components/CarteLeaflet.tsx");
  expect(c).toContain("window.pivoter = function");
  expect(c).toContain("rotate(' + (-rotation) + 'deg) scale(2)");
  expect(c).toContain("((capDeg + decalageDoigts - rotation + 540) % 360) - 180"); // plus court chemin, pas de tour complet
  expect(c).toContain("overflow: hidden");
  const a = lire("mobile/src/app/marketplace/autour.tsx");
  expect(a).toContain("carte?.pivoter(nordHaut ? 0 : capVehicule.current);");
  expect(a).toContain("carte?.vehicule(positionLive.latitude, positionLive.longitude, nordHaut ? capVehicule.current : 0)"); // flèche droite : c'est la carte qui tourne
  expect(a).toContain("carte?.pivoter(null)"); // carte droite à l'arrêt
  expect(a).toContain("Location.Accuracy.High");
  expect(a).toContain("getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })"); // secours si le suivi continu est muet
  expect(a).toContain("p.coords.heading");
});

test("guidage : flèche de navigation (plus de voiture), rotation à deux doigts, bulles des boutiques retirées pendant le guidage", () => {
  const c = lire("mobile/src/components/CarteLeaflet.tsx");
  expect(c).not.toContain('viewBox="0 0 34 52"'); // la voiture est retirée
  expect(c).toContain('d="M12 2 L20 21 L12 17 L4 21 Z"'); // flèche
  expect(c).toContain("translateY(' + Math.round(window.innerHeight * 0.2)");
  expect(c).toContain("angleDoigts(e.touches)"); // rotation à deux doigts
  expect(c).toContain("decalageDoigts -= d");
  const n = lire("mobile/src/components/GuidageNavigation.tsx");
  expect(n).toContain("Mettre le nord en haut");
  const a = lire("mobile/src/app/marketplace/autour.tsx");
  expect(a).toContain("onBoussole={() => setNordHaut((v) => !v)}");
  expect(a).toMatch(/carrouselAvantGuidage\.current = carrousel;\s+setCarrousel\(false\)/);
  expect(a).toContain("carte?.pivoter(nordHaut ? 0 : capVehicule.current, true)"); // Recentrer annule la rotation à la main
});

test("guidage : la carte se déplace au doigt (corrigé de la rotation), arrête de suivre la personne, et « Recentrer » la reprend", () => {
  const c = lire("mobile/src/components/CarteLeaflet.tsx");
  expect(c).toContain("carte.panBy([-lx, -ly], { animate: false })");
  expect(c).toContain("envoyer('carte-deplacee')");
  expect(c).toContain("carte.dragging.disable()");
  expect(c).toContain("carte.dragging.enable()");
  const a = lire("mobile/src/app/marketplace/autour.tsx");
  expect(a).toContain("if (id === 'carte-deplacee') {");
  expect(a).toContain("if (suivi) carte?.centrer(positionLive.latitude, positionLive.longitude, 18)");
  expect(a).toMatch(/setSuivi\(true\);\s+if \(p\) carte\?\.centrer/);
});

test("guidage : plus de ronds de boutiques ni de recadrage sur les boutiques — la carte reste au niveau de la rue", () => {
  const a = lire("mobile/src/app/marketplace/autour.tsx");
  expect(a).toContain("marqueurs={guidage ? [] : marqueurs}");
  expect(a).toContain("ajuster={!guidage && !selection");
});

test("guidage : traits et flèche compensent l'agrandissement x2 de la carte (rendu 8/13 px, flèche 52 px au lieu de 16/26 et 88 px)", () => {
  const c = lire("mobile/src/components/CarteLeaflet.tsx");
  expect(c).toContain("weight: 6.5");
  expect(c).toContain("iconSize: [26, 26], iconAnchor: [13, 13]");
  expect(c).toContain("scale(2)");
});

test("guidage : le zoom ne peut pas descendre sous le niveau de la rue (pas de vue de toute la région)", () => {
  const c = lire("mobile/src/components/CarteLeaflet.tsx");
  expect(c).toContain("carte.setMinZoom(16)");
  expect(c).toContain("carte.setMinZoom(0)"); // levé à l'arrêt du guidage
  expect(c).toContain("if (carte.getZoom() < 17) carte.setZoom(17");
});

// ── Trajets alternatifs (« raccourcis ») ──
test("alternatives : demande à OpenRouteService (seulement si voulues) et lecture du trajet principal + 2 alternatives", async () => {
  const { corpsItineraire, extraireTrajets } = await import("../../src/lib/itineraireAlternatives.js");
  const d = { lat: 14.75, lng: -17.39 }, a = { lat: 14.76, lng: -17.4 };
  expect(corpsItineraire(d, a, false)).toEqual({ coordinates: [[-17.39, 14.75], [-17.4, 14.76]] }); // sans alternatives : demande inchangée
  expect(corpsItineraire(d, a, true).alternative_routes).toEqual({ target_count: 3, share_factor: 0.6, weight_factor: 1.4 });
  const f = (km, s, coords) => ({ geometry: { coordinates: coords }, properties: { summary: { distance: km * 1000, duration: s } } });
  const donnees = { features: [f(5, 600, [[-17.4, 14.7], [-17.39, 14.71]]), f(5.4, 660, [[-17.4, 14.7], [-17.38, 14.72]]), f(6, 720, [[-17.4, 14.7], [-17.37, 14.73]]), f(7, 800, [[-17.4, 14.7], [-17.36, 14.74]])] };
  const t = extraireTrajets(donnees);
  expect(t.principal).toEqual({ points: [[14.7, -17.4], [14.71, -17.39]], distance_km: 5, duree_min: 10 });
  expect(t.alternatives.length).toBe(2); // au plus 2
  expect(t.alternatives[0].duree_min).toBe(11);
  expect(extraireTrajets({ features: [] })).toBeNull();
  expect(extraireTrajets({ features: [{ geometry: { coordinates: [[1, 1]] } }] })).toBeNull();
  expect(extraireTrajets({ features: [f(1, 60, [[-17.4, 14.7], [-17.39, 14.71]])] }).alternatives).toEqual([]);
});

test("alternatives : la route du site ne renvoie les alternatives que sur demande et retente sans elles si le fournisseur refuse", () => {
  const r = lire("src/app/api/marketplace/itineraire/route.js");
  expect(r).toContain("corps?.alternatives === true");
  expect(r).toContain("if (!reponse.ok && veutAlternatives) reponse = await demander(false)");
  expect(r).toContain("...(veutAlternatives ? { alternatives: trajets.alternatives } : {})");
  expect(r).toContain("points: principal.points"); // réponse inchangée pour les autres appelants
});

test("alternatives (application) : libellés de différence et échange du trajet choisi", async () => {
  const m = await import("../../mobile/src/lib/alternatives.ts");
  expect(m.libelleDifference(10, 10)).toBe("Même durée");
  expect(m.libelleDifference(10, 12)).toBe("2 min plus long");
  expect(m.libelleDifference(10, 8)).toBe("2 min plus court");
  expect(m.libelleDifference(null, 8)).toBe("Autre trajet");
  const principal = { points: [[1, 1], [2, 2]], distanceKm: 5, dureeMin: 10, approximatif: false, profil: "voiture", alternatives: [{ points: [[1, 1], [3, 3]], distanceKm: 6, dureeMin: 11 }, { points: [[1, 1], [4, 4]], distanceKm: 7, dureeMin: 12 }] };
  const e = m.echangerAlternative(principal, 0);
  expect(e.points).toEqual([[1, 1], [3, 3]]);
  expect(e.dureeMin).toBe(11);
  expect(e.alternatives[0].dureeMin).toBe(10); // l'ancien principal devient une alternative
  expect(e.alternatives[1].dureeMin).toBe(12);
  expect(m.echangerAlternative(principal, 9)).toBe(principal); // index inconnu : rien ne change
  const c = lire("mobile/src/components/CarteLeaflet.tsx");
  expect(c).toContain("envoyer('alternative:' + i)");
  expect(lire("mobile/src/app/marketplace/autour.tsx")).toContain("id.startsWith('alternative:')");
});

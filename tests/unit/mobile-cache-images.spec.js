const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

/**
 * Application : images publiques par le Worker (repli Supabase), copie de la liste des offres sur le téléphone, aucun fichier privé sur le disque,
 * bouton « Vider le cache ». Logique pure testée directement ; le reste par lecture du code.
 */
const racine = path.join(__dirname, "../..");
const lire = (p) => fs.readFileSync(path.join(racine, p), "utf8").replace(/\r\n/g, "\n");
const images = () => import("../../mobile/src/lib/imagesPubliques.ts");
const liste = () => import("../../mobile/src/lib/cacheListeLogique.ts");
const HOTE = "https://facilite-images.facilitefacile62.workers.dev";
const REF = "ocfhzwwjvljintabxxlg";
const sb = (bucket, nom) => `https://${REF}.supabase.co/storage/v1/object/public/${bucket}/${nom}`;

test.describe("imagesPubliques : Worker au lieu de Supabase", () => {
  test("interrupteur : absent ou invalide = fermé, toutes les adresses restent inchangées", async () => {
    const { lireHote, adresseImage, candidatsImage } = await images();
    for (const v of [undefined, null, "", "http://x.workers.dev", "https://x.workers.dev/chemin", "javascript:alert(1)", "https://"]) expect(lireHote(v)).toBe("");
    expect(lireHote(`${HOTE}/`)).toBe(HOTE);
    const u = sb("job-offers", "a/poster-1-w1280.webp");
    expect(adresseImage(u, "")).toBe(u);
    expect(candidatsImage(u, 480, "")).toEqual([u]);
  });
  test("seuls les 3 buckets publics du projet de production sont remplacés ; avatars, covers, CV, autres projets : jamais", async () => {
    const { adresseImage } = await images();
    expect(adresseImage(sb("job-offers", "x.jpg"), HOTE)).toBe(`${HOTE}/job-offers/x.jpg`);
    expect(adresseImage(sb("marketplace-photos", "u/p.png"), HOTE)).toBe(`${HOTE}/marketplace-photos/u/p.png`);
    expect(adresseImage(sb("stories-media", "s.webp"), HOTE)).toBe(`${HOTE}/stories-media/s.webp`);
    for (const b of ["avatars", "covers", "banque-cv", "resumes", "chat-attachments", "marketplace-videos", "aide-videos"]) expect(adresseImage(sb(b, "x"), HOTE)).toBe(sb(b, "x"));
    const autre = "https://autreprojet12345678901.supabase.co/storage/v1/object/public/job-offers/x.jpg";
    expect(adresseImage(autre, HOTE)).toBe(autre);
    expect(adresseImage("https://ffacilite.com/affiche.webp", HOTE)).toBe("https://ffacilite.com/affiche.webp");
  });
  test("repli : adresse du Worker -> adresse Supabase d'origine (opération inverse exacte)", async () => {
    const { adresseImage, adresseSupabase } = await images();
    for (const u of [sb("job-offers", "a b/x-w1280.webp"), sb("stories-media", "s.jpg"), sb("marketplace-photos", "z/1.png")]) expect(adresseSupabase(adresseImage(u, HOTE), HOTE)).toBe(u);
  });
  test("variantes -w480 / -w960 : seulement pour une affiche « -w1280.webp » déjà servie par le Worker", async () => {
    const { adresseVariante } = await images();
    expect(adresseVariante(`${HOTE}/job-offers/p-w1280.webp`, 480, HOTE)).toBe(`${HOTE}/job-offers/p-w480.webp`);
    expect(adresseVariante(`${HOTE}/job-offers/p-w1280.webp`, 960, HOTE)).toBe(`${HOTE}/job-offers/p-w960.webp`);
    expect(adresseVariante(`${HOTE}/job-offers/ancienne.jpeg`, 480, HOTE)).toBeNull();
    expect(adresseVariante("https://externe.example/p-w1280.webp", 480, HOTE)).toBeNull(); // image externe : jamais de variante
    expect(adresseVariante(sb("job-offers", "p-w1280.webp"), 480, HOTE)).toBeNull(); // pas encore sur le Worker
  });
  test("ordre des essais : variante, image entière sur le Worker, puis Supabase en dernier recours ; sans doublon", async () => {
    const { candidatsImage } = await images();
    const u = sb("job-offers", "p-w1280.webp");
    expect(candidatsImage(u, 480, HOTE)).toEqual([`${HOTE}/job-offers/p-w480.webp`, `${HOTE}/job-offers/p-w1280.webp`, u]);
    expect(candidatsImage(u, undefined, HOTE)).toEqual([`${HOTE}/job-offers/p-w1280.webp`, u]);
    const vieille = sb("job-offers", "ancienne.jpeg");
    expect(candidatsImage(vieille, 480, HOTE)).toEqual([`${HOTE}/job-offers/ancienne.jpeg`, vieille]);
    expect(candidatsImage("https://ffacilite.com/a.webp", 480, HOTE)).toEqual(["https://ffacilite.com/a.webp"]);
    expect(candidatsImage("", 480, HOTE)).toEqual([]);
  });
});

const ligne = (id, extra = {}) => ({ id, title: `Offre ${id}`, company: "ACME", created_at: `2026-10-${String(10 + Number(id.replace(/\D/g, "") || 0)).padStart(2, "0")}T10:00:00Z`, deadline: null, status: "approved", description: "d", is_active: true, ...extra });
const AUJ = "2026-10-30";

test.describe("cacheListeLogique : copie de la liste sur le téléphone", () => {
  test("lecture de la copie : valide, vieille (> 7 jours), illisible, venue du futur, lignes sans identifiant", async () => {
    const { lireCopie, serialiser, estFraiche, DUREE_FRAICHE_MS, DUREE_MAX_MS } = await liste();
    const t0 = 1_800_000_000_000;
    const ok = lireCopie(serialiser([ligne("1"), { titre: "sans id" }], t0), t0 + 1000);
    expect(ok.lignes.map((l) => l.id)).toEqual(["1"]);
    expect(estFraiche(ok, t0 + DUREE_FRAICHE_MS - 1)).toBe(true);
    expect(estFraiche(ok, t0 + DUREE_FRAICHE_MS + 1)).toBe(false);
    expect(lireCopie(serialiser([ligne("1")], t0), t0 + DUREE_MAX_MS + 1)).toBeNull();
    expect(lireCopie(serialiser([ligne("1")], t0 + 10 * 60_000), t0)).toBeNull();
    for (const brut of [null, undefined, "", "pas du json", "{}", '{"enregistreLe":"x","lignes":[]}', '{"enregistreLe":1,"lignes":"non"}']) expect(lireCopie(brut, t0)).toBeNull();
  });
  test("règle d'état : disponibles / expirées, brouillon exclu, statut clos exclu, la journée de la date limite reste valable", async () => {
    const { correspondEtat } = await liste();
    expect(correspondEtat(ligne("1"), "disponibles", AUJ)).toBe(true);
    expect(correspondEtat(ligne("1", { deadline: AUJ }), "disponibles", AUJ)).toBe(true);
    expect(correspondEtat(ligne("1", { deadline: "2026-10-29" }), "disponibles", AUJ)).toBe(false);
    expect(correspondEtat(ligne("1", { deadline: "2026-10-29" }), "expirees", AUJ)).toBe(true);
    expect(correspondEtat(ligne("1", { is_active: false }), "disponibles", AUJ)).toBe(false);
    expect(correspondEtat(ligne("1", { is_active: false }), "expirees", AUJ)).toBe(true);
    expect(correspondEtat(ligne("1", { status: "draft" }), "disponibles", AUJ)).toBe(false);
    expect(correspondEtat(ligne("1", { status: "draft", is_active: false }), "expirees", AUJ)).toBe(false);
    expect(correspondEtat(ligne("1", { status: "closed" }), "disponibles", AUJ)).toBe(false);
  });
  test("INSERT : une offre complète s'ajoute en tête, la liste reste triée et limitée ; aucune relecture", async () => {
    const { appliquerChangement } = await liste();
    const base = [ligne("2"), ligne("1")];
    const r = appliquerChangement(base, { type: "INSERT", nouveau: ligne("5") }, "disponibles", AUJ, 2);
    expect(r.recharger).toBe(false);
    expect(r.lignes.map((l) => l.id)).toEqual(["5", "2"]);
  });
  test("UPDATE : fusion avec la ligne connue (les grosses colonnes absentes du message sont conservées) ; colonnes hors liste jamais gardées", async () => {
    const { appliquerChangement } = await liste();
    const base = [ligne("2", { description: "longue description" })];
    const recu = { id: "id2", title: "Nouveau titre", is_active: true, colonne_secrete: "x" };
    const r = appliquerChangement([{ ...base[0], id: "id2" }], { type: "UPDATE", nouveau: recu }, "disponibles", AUJ, 30);
    expect(r.recharger).toBe(false);
    expect(r.lignes[0]).toMatchObject({ id: "id2", title: "Nouveau titre", description: "longue description" });
    expect(r.lignes[0].colonne_secrete).toBeUndefined();
    expect(r.lignes[0].is_active).toBeUndefined();
  });
  test("UPDATE qui sort l'offre de l'état (désactivée, date dépassée) : retirée de la liste ; DELETE : retirée par identifiant", async () => {
    const { appliquerChangement } = await liste();
    const base = [ligne("2"), ligne("1")];
    const a = appliquerChangement(base, { type: "UPDATE", nouveau: { ...ligne("2"), is_active: false } }, "disponibles", AUJ, 30);
    expect(a.lignes.map((l) => l.id)).toEqual(["1"]);
    const b = appliquerChangement(base, { type: "UPDATE", nouveau: { ...ligne("2"), deadline: "2026-10-01" } }, "disponibles", AUJ, 30);
    expect(b.lignes.map((l) => l.id)).toEqual(["1"]);
    const c = appliquerChangement(base, { type: "DELETE", ancien: { id: "2" } }, "disponibles", AUJ, 30);
    expect(c.lignes.map((l) => l.id)).toEqual(["1"]);
    expect(appliquerChangement(base, { type: "DELETE", ancien: {} }, "disponibles", AUJ, 30).recharger).toBe(true);
  });
  test("ligne reçue incomplète pour une offre inconnue (colonnes lourdes non envoyées), ou message vide : on relit la liste", async () => {
    const { appliquerChangement } = await liste();
    const base = [ligne("1")];
    expect(appliquerChangement(base, { type: "UPDATE", nouveau: { id: "inconnue", status: "approved", is_active: true } }, "disponibles", AUJ, 30).recharger).toBe(true);
    expect(appliquerChangement(base, { type: "INSERT", nouveau: null }, "disponibles", AUJ, 30).recharger).toBe(true);
  });
  test("une offre passée en brouillon ou non visible n'est jamais ajoutée ; l'état « expirées » reçoit celles qui expirent", async () => {
    const { appliquerChangement } = await liste();
    const r = appliquerChangement([ligne("1")], { type: "INSERT", nouveau: ligne("7", { status: "draft" }) }, "disponibles", AUJ, 30);
    expect(r.lignes.map((l) => l.id)).toEqual(["1"]);
    const e = appliquerChangement([], { type: "UPDATE", nouveau: ligne("3", { is_active: false }) }, "expirees", AUJ, 30);
    expect(e.recharger).toBe(false);
    expect(e.lignes.map((l) => l.id)).toEqual(["3"]);
  });
  test("les colonnes conservées sont celles que la requête demande (aucune donnée en plus sur le téléphone)", async () => {
    const { COLONNES_OFFRES, projeter } = await liste();
    expect(COLONNES_OFFRES).toContain("image_url");
    expect(COLONNES_OFFRES.join()).not.toMatch(/user_id|owner|email_perso|password|token|secret|recruiter_id/i);
    expect(Object.keys(projeter({ id: "1", title: "t", autre: 1, is_active: true }))).toEqual(["id", "title"]);
  });
});

test.describe("code de l'application : vie privée, cache disque, bouton", () => {
  const prive = ["mobile/src/app/chat/[id].tsx", "mobile/src/app/document.tsx", "mobile/src/components/ApercuDocument.tsx", "mobile/src/components/AvatarProfil.tsx"];
  test("images privées (pièces jointes, documents, avatars signés) : cache en MÉMOIRE seulement, jamais sur le disque", () => {
    for (const f of prive) {
      const code = lire(f);
      expect(code, f).toContain('cachePolicy="memory"');
      expect(code, f).not.toMatch(/cachePolicy="(disk|memory-disk)"/);
      expect(code, f).not.toContain("ImagePublique");
    }
    expect(lire("mobile/src/components/ImagePublique.tsx")).toContain('cachePolicy="disk"');
    for (const f of ["mobile/src/app/mon-profil/achat-cv-apercu.tsx", "mobile/src/app/mon-profil/achat-cv-payer.tsx", "mobile/src/components/CatalogueCv.tsx"]) {
      expect(lire(f), f).toMatch(/cachePolicy="none"/);
    }
  });
  test("ImagePublique n'est utilisé que pour les 3 buckets publics (offres, Marketplace, stories), jamais pour un fichier signé", () => {
    for (const f of prive) expect(lire(f)).not.toContain("ImagePublique");
    expect(lire("mobile/src/lib/imagesPubliques.ts")).toContain("job-offers|marketplace-photos|stories-media");
  });
  test("la copie de la liste ne contient que des offres publiques ; l'adresse du Worker n'est jamais enregistrée (remplacement à l'affichage seulement)", () => {
    const hook = lire("mobile/src/lib/useOffresReelles.ts");
    expect(hook).not.toMatch(/adresseImage|imagesPubliques/);
    expect(hook).toContain("ecrireCopieLocale(etat, limite, data)");
    expect(lire("mobile/src/lib/offerMedia.ts")).not.toMatch(/workers\.dev|imagesPubliques/);
  });
  test("le premier affichage vient de la copie ; la lecture réseau est sautée si elle est fraîche ; « tirer pour actualiser » force la lecture", () => {
    const hook = lire("mobile/src/lib/useOffresReelles.ts");
    expect(hook).toContain("version === 0 ? await lireCopieLocale(etat, limite) : null");
    expect(hook).toContain("if (estFraiche(copie, Date.now())) return;");
    expect(hook).toContain("rechargerPlusTard");
    expect(hook).toContain("COLONNES_OFFRES.join(', ')");
  });
  test("« Vider le cache » : images (disque + mémoire) et copies de listes ; la clé de copie commence par le préfixe effacé", async () => {
    const code = lire("mobile/src/lib/cacheImages.ts");
    expect(code).toContain("Image.clearDiskCache()");
    expect(code).toContain("Image.clearMemoryCache()");
    expect(code).toContain("PREFIXE_COPIES_LISTES = 'FACILITE_OFFRES_V1_'");
    expect(code).toContain("200 * 1024 * 1024");
    const { cleCacheOffres } = await liste();
    expect(cleCacheOffres("disponibles", 30).startsWith("FACILITE_OFFRES_V1_")).toBe(true);
    const ecran = lire("mobile/src/app/mon-profil/parametres.tsx");
    expect(ecran).toContain("t('Vider le cache')");
    expect(ecran).toContain("viderCache()");
    expect(lire("mobile/src/app/_layout.tsx")).toContain("configurerCacheImages();");
  });
  test("aucune nouvelle dépendance : package.json de l'application inchangé", () => {
    const pkg = JSON.parse(lire("mobile/package.json"));
    expect(Object.keys(pkg.dependencies)).not.toEqual(expect.arrayContaining(["expo-file-system", "expo-updates", "react-native-mmkv"]));
  });
});

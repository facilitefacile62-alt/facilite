// Chiffrement / déchiffrement d'un gros fichier par blocs (AES-256-GCM, clé dérivée d'une phrase secrète par scrypt). Aucun binaire externe.
//
//   node chiffrement.mjs chiffrer   <entree> <sortie.enc>     (phrase secrète : variable d'environnement EXPORT_PASSPHRASE)
//   node chiffrement.mjs dechiffrer <entree.enc> <sortie>     (idem ; affiche l'empreinte SHA-256 du contenu clair)
//
// Format : « FACEXP1 » + sel (16) + paramètres scrypt, puis une suite de blocs [longueur (4) | iv (12) | tag (16) | données chiffrées].
// Chaque bloc a son propre IV (préfixe aléatoire + compteur) et son propre tag : un bloc modifié, retiré ou réordonné est refusé.
// La phrase secrète ne s'écrit nulle part : ni dans le fichier, ni dans la console.
import crypto from "node:crypto";
import fs from "node:fs";

const MAGIE = Buffer.from("FACEXP1\n");
const BLOC = 4 * 1024 * 1024;
const SCRYPT = { N: 1 << 15, r: 8, p: 1, maxmem: 128 * 1024 * 1024 };

export function cle(phrase, sel) {
  return crypto.scryptSync(phrase, sel, 32, SCRYPT);
}
// IV d'un bloc : 4 octets aléatoires propres au fichier + compteur sur 8 octets ; le compteur est aussi lié au tag (données additionnelles).
const ivDuBloc = (prefixe, i) => {
  const iv = Buffer.alloc(12);
  prefixe.copy(iv, 0);
  iv.writeBigUInt64BE(BigInt(i), 4);
  return iv;
};
const aad = (i, dernier) => Buffer.from(`${i}:${dernier ? 1 : 0}`);

export async function chiffrer(entree, sortie, phrase) {
  const sel = crypto.randomBytes(16);
  const prefixe = crypto.randomBytes(4);
  const k = cle(phrase, sel);
  const taille = fs.statSync(entree).size;
  const dest = fs.openSync(sortie, "w");
  fs.writeSync(dest, Buffer.concat([MAGIE, sel, prefixe]));
  const src = fs.openSync(entree, "r");
  const tampon = Buffer.alloc(BLOC);
  let lus = 0;
  let i = 0;
  do {
    const n = fs.readSync(src, tampon, 0, BLOC, lus);
    lus += n;
    const dernier = lus >= taille;
    const c = crypto.createCipheriv("aes-256-gcm", k, ivDuBloc(prefixe, i));
    c.setAAD(aad(i, dernier));
    const donnees = Buffer.concat([c.update(tampon.subarray(0, n)), c.final()]);
    const entete = Buffer.alloc(4);
    entete.writeUInt32BE(donnees.length);
    fs.writeSync(dest, Buffer.concat([entete, c.getAuthTag(), donnees]));
    i += 1;
    if (dernier) break;
  } while (true);
  fs.closeSync(src);
  fs.closeSync(dest);
  return { blocs: i, octets_clairs: taille };
}

/** Déchiffre vers `sortie` (ou seulement l'empreinte si sortie est null). Renvoie { sha256, octets }. Lève une erreur au moindre bloc altéré. */
export async function dechiffrer(entree, sortie, phrase) {
  const fd = fs.openSync(entree, "r");
  const fin = fs.fstatSync(fd).size;
  const entete = Buffer.alloc(MAGIE.length + 16 + 4);
  fs.readSync(fd, entete, 0, entete.length, 0);
  if (!entete.subarray(0, MAGIE.length).equals(MAGIE)) throw new Error("Fichier inconnu (en-tête invalide).");
  const sel = entete.subarray(MAGIE.length, MAGIE.length + 16);
  const prefixe = entete.subarray(MAGIE.length + 16);
  const k = cle(phrase, sel);
  const dest = sortie ? fs.openSync(sortie, "w") : null;
  const empreinte = crypto.createHash("sha256");
  let pos = entete.length;
  let i = 0;
  let octets = 0;
  while (pos < fin) {
    const e = Buffer.alloc(4 + 16);
    fs.readSync(fd, e, 0, 20, pos);
    const longueur = e.readUInt32BE(0);
    const tag = e.subarray(4, 20);
    const donnees = Buffer.alloc(longueur);
    fs.readSync(fd, donnees, 0, longueur, pos + 20);
    pos += 20 + longueur;
    const d = crypto.createDecipheriv("aes-256-gcm", k, ivDuBloc(prefixe, i));
    d.setAAD(aad(i, pos >= fin));
    d.setAuthTag(tag);
    let clair;
    try {
      clair = Buffer.concat([d.update(donnees), d.final()]);
    } catch {
      throw new Error(`Bloc ${i} refusé : mauvaise phrase secrète, fichier altéré ou tronqué.`);
    }
    empreinte.update(clair);
    octets += clair.length;
    if (dest) fs.writeSync(dest, clair);
    i += 1;
  }
  fs.closeSync(fd);
  if (dest) fs.closeSync(dest);
  return { sha256: empreinte.digest("hex"), octets };
}

export function sha256Fichier(chemin) {
  const h = crypto.createHash("sha256");
  const fd = fs.openSync(chemin, "r");
  const t = Buffer.alloc(BLOC);
  let n;
  while ((n = fs.readSync(fd, t, 0, BLOC, null)) > 0) h.update(t.subarray(0, n));
  fs.closeSync(fd);
  return h.digest("hex");
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}`) {
  const [, , action, entree, sortie] = process.argv;
  const phrase = process.env.EXPORT_PASSPHRASE;
  if (!phrase || phrase.length < 12) {
    console.error("EXPORT_PASSPHRASE absente ou trop courte (12 caractères minimum).");
    process.exit(1);
  }
  if (action === "chiffrer") {
    const r = await chiffrer(entree, sortie, phrase);
    console.log(`Chiffré : ${r.blocs} bloc(s), ${r.octets_clairs} octets clairs.`);
  } else if (action === "dechiffrer") {
    const r = await dechiffrer(entree, sortie || null, phrase);
    console.log(`Déchiffré : ${r.octets} octets, SHA-256 ${r.sha256}`);
  } else {
    console.error("Usage : chiffrer <entree> <sortie.enc> | dechiffrer <entree.enc> [sortie]");
    process.exit(1);
  }
}

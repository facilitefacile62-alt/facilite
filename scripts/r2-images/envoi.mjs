// Envoi des images PUBLIQUES du site vers le bucket R2 « facilite-images », à partir des copies LOCALES de l'export (aucun téléchargement depuis Supabase),
// puis vérification SHA-256 fichier par fichier. Ce module ne contient aucune clé : le client S3 lui est fourni.
//
// Garde-fous (testés) :
//   - le bucket est FIXE (BUCKET_R2) : aucun autre bucket du compte (facilite-media, par exemple) n'est jamais nommé ;
//   - aucune suppression (ni DeleteObject, ni vidage), aucune liste des buckets : seulement dépôt, lecture et liste de « facilite-images » ;
//   - le manifeste de l'export donne l'empreinte SHA-256 attendue de chaque fichier ; un fichier local qui ne la respecte pas n'est PAS envoyé.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand } from "@aws-sdk/client-s3";

export const BUCKET_R2 = "facilite-images";
export const BUCKETS_SUPABASE = ["job-offers", "marketplace-photos", "stories-media"];
const CACHE = "public, max-age=31536000, immutable";

const TYPES = {
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};
export const typeContenu = (chemin) => TYPES[path.extname(chemin).toLowerCase()] || "application/octet-stream";

const sha256 = (octets) => crypto.createHash("sha256").update(octets).digest("hex");

/** Fichiers à envoyer : entrées du manifeste des buckets publics, avec empreinte (donc téléchargées et vérifiées lors de l'export). */
export function planifier(dossierStockage, manifeste) {
  const fichiers = [];
  let sansEmpreinte = 0;
  for (const e of manifeste) {
    if (!BUCKETS_SUPABASE.includes(e.bucket)) continue;
    if (!e.sha256) {
      sansEmpreinte += 1;
      continue;
    }
    fichiers.push({ bucket: e.bucket, chemin: e.chemin, cle: `${e.bucket}/${e.chemin}`, octets: e.octets, sha256: e.sha256, local: path.join(dossierStockage, e.bucket, ...e.chemin.split("/")) });
  }
  return { fichiers, sansEmpreinte };
}

/** Relit chaque fichier LOCAL et compare à l'empreinte du manifeste. Aucun accès réseau. */
export function verifierSource(plan) {
  const ecarts = [];
  for (const f of plan.fichiers) {
    try {
      const contenu = fs.readFileSync(f.local);
      if (contenu.length !== f.octets || sha256(contenu) !== f.sha256) ecarts.push({ cle: f.cle, raison: "empreinte ou taille différente du manifeste" });
    } catch {
      ecarts.push({ cle: f.cle, raison: "fichier local introuvable" });
    }
  }
  return ecarts;
}

const estAbsent = (e) => e?.name === "NotFound" || e?.name === "NoSuchKey" || e?.$metadata?.httpStatusCode === 404;

async function enParallele(elements, parallele, tache) {
  const file = [...elements];
  await Promise.all(
    Array.from({ length: Math.max(1, parallele) }, async () => {
      for (let x = file.shift(); x; x = file.shift()) await tache(x);
    }),
  );
}

async function avecReprises(operation, essais = 4) {
  let derniere;
  for (let i = 1; i <= essais; i++) {
    try {
      return await operation();
    } catch (e) {
      derniere = e;
      if (estAbsent(e) || i === essais) throw e;
      await new Promise((r) => setTimeout(r, Number(process.env.R2IMG_ATTENTE_MS ?? 500) * 2 ** (i - 1)));
    }
  }
  throw derniere;
}

/** Dépose les fichiers absents de R2 (ou différents) ; un fichier déjà présent, de même taille et de même empreinte, est sauté. Renvoie des compteurs. */
export async function envoyer({ client, plan, parallele = 6 }) {
  const c = { deposes: 0, sautes: 0, echecs: [] };
  await enParallele(plan.fichiers, parallele, async (f) => {
    try {
      try {
        const tete = await avecReprises(() => client.send(new HeadObjectCommand({ Bucket: BUCKET_R2, Key: f.cle })));
        if (Number(tete.ContentLength) === f.octets && tete.Metadata?.sha256 === f.sha256) {
          c.sautes += 1;
          return;
        }
      } catch (e) {
        if (!estAbsent(e)) throw e;
      }
      const corps = fs.readFileSync(f.local);
      await avecReprises(() =>
        client.send(new PutObjectCommand({ Bucket: BUCKET_R2, Key: f.cle, Body: corps, ContentLength: corps.length, ContentType: typeContenu(f.chemin), CacheControl: CACHE, Metadata: { sha256: f.sha256 } })),
      );
      c.deposes += 1;
    } catch (e) {
      c.echecs.push({ cle: f.cle, erreur: String(e?.name || e?.message || e).slice(0, 80) });
    }
  });
  return c;
}

/** Relit chaque objet dans R2 et compare son SHA-256 et sa taille à ceux du manifeste ; compte aussi les objets présents dans R2 mais absents du plan. */
export async function verifierR2({ client, plan, parallele = 6 }) {
  const parBucket = {};
  for (const b of BUCKETS_SUPABASE) parBucket[b] = { attendus: 0, identiques: 0, differents: 0, manquants: 0, en_trop: 0 };
  const problemes = [];
  await enParallele(plan.fichiers, parallele, async (f) => {
    const s = parBucket[f.bucket];
    s.attendus += 1;
    try {
      const reponse = await avecReprises(() => client.send(new GetObjectCommand({ Bucket: BUCKET_R2, Key: f.cle })));
      const octets = Buffer.from(await reponse.Body.transformToByteArray());
      if (octets.length === f.octets && sha256(octets) === f.sha256) s.identiques += 1;
      else {
        s.differents += 1;
        problemes.push({ cle: f.cle, raison: "contenu différent" });
      }
    } catch (e) {
      if (estAbsent(e)) {
        s.manquants += 1;
        problemes.push({ cle: f.cle, raison: "absent de R2" });
      } else {
        s.differents += 1;
        problemes.push({ cle: f.cle, raison: `lecture impossible (${String(e?.name || e).slice(0, 40)})` });
      }
    }
  });
  // Objets en trop : listés par bucket, puis comparés aux clés attendues.
  const attendues = new Set(plan.fichiers.map((f) => f.cle));
  for (const b of BUCKETS_SUPABASE) {
    let jeton;
    do {
      const page = await avecReprises(() => client.send(new ListObjectsV2Command({ Bucket: BUCKET_R2, Prefix: `${b}/`, ContinuationToken: jeton })));
      for (const o of page.Contents || []) if (!attendues.has(o.Key)) parBucket[b].en_trop += 1;
      jeton = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (jeton);
  }
  const conforme = Object.values(parBucket).every((s) => s.differents === 0 && s.manquants === 0 && s.identiques === s.attendus);
  return { parBucket, problemes, conforme };
}

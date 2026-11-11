// Estimation de l'egress (données sortant de Supabase) qu'un export va consommer, AVANT de rien exporter. Lecture seule : quelques requêtes de comptage et la liste des fichiers
// (noms, tailles, dates) ; aucun fichier ni aucune ligne de données n'est téléchargé. Les fonctions de calcul sont PURES (testées sans connexion).
//
//   EXPORT_DB_URL=… node scripts/export-production/estimer.mjs --mode=Leger|Complet [--avec-images-publiques] [--baseline=<etat.json>]
//   node scripts/export-production/estimer.mjs --reprise=<dossier clair>       (reprise : calcul sur le disque, aucune connexion)
//
// Calibrage (export du 29/10/2026, mesuré) : base 13,36 Mo envoyés (texte non compressé : c'est ce que reçoit pg_dump, la compression se fait ensuite chez vous)
// pour 31,17 Mo de tables et index ; structure.sql 0,74 Mo ; stockage 734,2 Mo ; pic constaté sur la page Usage : environ 0,8 Go.
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { bucketsDansLaPortee, calculerDelta, sommeOctets } from "./delta.mjs";

export const QUOTA_EGRESS_OCTETS = 5 * 1000 ** 3; // 5 Go du plan gratuit, comptés en 1000^3 par prudence
export const FACTEUR_BASE = 0.5; // volume envoyé ≈ 43 % de la taille des tables + index (mesuré) ; 0,5 = marge de prudence
export const STRUCTURE_OCTETS = 1 * 1048576; // structure.sql : 0,74 Mo mesuré
export const DIVERS_OCTETS = 1 * 1048576; // métadonnées, requêtes de vérification, comptages de l'estimation
export const OCTETS_PAR_LIGNE_LISTE = 150; // une ligne de la liste des fichiers (bucket, nom, taille, date, etag)

const MO = 1048576;
export const fmtMo = (n) => `${(n / MO).toFixed(n < 10 * MO ? 1 : 0).replace(".", ",")} Mo`;
export const fmtPct = (x) => `${(x * 100).toFixed(x < 0.1 ? 1 : 0).replace(".", ",")} %`;

/**
 * Estimation pour un mode. `objets` = fichiers de la PORTÉE (déjà filtrés : buckets privés, ou tous) sous la forme { bucket, chemin, octets, updated_at?, etag? } ;
 * `bucketsPortee` = noms des buckets de la portée ; `etat` = état du dernier export (ou null : aucune référence, tout serait téléchargé).
 */
export function estimerEgress({ mode, avecImagesPubliques = false, tailleRelationsOctets, objets = [], bucketsPortee = [], etat = null }) {
  const base = Math.round(tailleRelationsOctets * FACTEUR_BASE);
  const r = { mode, avecImagesPubliques, base: { relations: tailleRelationsOctets, estime: base }, structure: STRUCTURE_OCTETS, divers: DIVERS_OCTETS, stockage: null, liste: 0 };
  if (mode === "Complet") {
    const delta = calculerDelta(objets, etat);
    const parBucket = bucketsPortee.map((bucket) => {
      const dans = objets.filter((o) => o.bucket === bucket);
      const aTel = delta.aTelecharger.filter((o) => o.bucket === bucket);
      const ref = delta.inchanges.filter((o) => o.bucket === bucket);
      return { bucket, total: { n: dans.length, octets: sommeOctets(dans) }, aTelecharger: { n: aTel.length, octets: sommeOctets(aTel) }, references: { n: ref.length, octets: sommeOctets(ref) } };
    });
    r.stockage = {
      buckets: parBucket,
      avecReference: Boolean(etat),
      nouveaux: delta.nouveaux.length,
      modifies: delta.modifies.length,
      supprimes: delta.supprimes.filter((b) => bucketsPortee.includes(b.bucket)).length,
      aTelechargerN: delta.aTelecharger.length,
      aTelechargerOctets: sommeOctets(delta.aTelecharger),
      referencesN: delta.inchanges.length,
      referencesOctets: sommeOctets(delta.inchanges),
      totalN: objets.length,
      totalOctets: sommeOctets(objets),
    };
    r.liste = objets.length * OCTETS_PAR_LIGNE_LISTE;
  }
  r.total = base + STRUCTURE_OCTETS + DIVERS_OCTETS + (r.stockage?.aTelechargerOctets ?? 0) + r.liste;
  r.partQuota = r.total / QUOTA_EGRESS_OCTETS;
  return r;
}

/** Texte de l'estimation, une ligne par élément (affiché avant la demande de confirmation). */
export function formaterEstimation(e) {
  const l = [];
  l.push("ESTIMATION DE L'EGRESS DE CET EXPORT (rien n'est exporté tant que vous n'avez pas confirmé)");
  l.push(`Mode : ${e.mode}${e.mode === "Complet" ? (e.avecImagesPubliques ? " (buckets privés + images publiques)" : " (buckets privés seulement ; images publiques déjà dans R2)") : " (base de données seulement, aucun fichier de stockage)"}`);
  l.push(`  Base de données, comptes inclus : environ ${fmtMo(e.base.estime)}   (tables et index : ${fmtMo(e.base.relations)} x ${String(FACTEUR_BASE).replace(".", ",")} ; mesuré le 29/10 : 13,4 Mo)`);
  l.push(`  Structure et métadonnées        : environ ${fmtMo(e.structure + e.divers)}`);
  if (e.stockage) {
    const s = e.stockage;
    if (s.avecReference) {
      l.push(`  Fichiers de stockage            : environ ${fmtMo(s.aTelechargerOctets)}   (${s.aTelechargerN} fichier(s) à télécharger : ${s.nouveaux} nouveau(x), ${s.modifies} modifié(s) ; ${s.referencesN} inchangé(s) NON retéléchargés, ${fmtMo(s.referencesOctets)} évités)`);
    } else {
      l.push(`  Fichiers de stockage            : environ ${fmtMo(s.aTelechargerOctets)}   (${s.aTelechargerN} fichiers : AUCUNE référence d'un export précédent, tout est téléchargé)`);
    }
    for (const b of s.buckets) l.push(`      ${b.bucket.padEnd(18)} ${String(b.aTelecharger.n).padStart(5)} / ${String(b.total.n).padStart(5)} fichiers à télécharger, ${fmtMo(b.aTelecharger.octets).padStart(9)} sur ${fmtMo(b.total.octets)}`);
    if (s.supprimes > 0) l.push(`      ${s.supprimes} fichier(s) du dernier export n'existent plus (ils restent dans les archives précédentes)`);
    l.push(`  Liste des fichiers (lecture)    : environ ${fmtMo(e.liste)}`);
  }
  l.push(`  TOTAL ESTIMÉ                    : environ ${fmtMo(e.total)}, soit ${fmtPct(e.partQuota)} du quota gratuit de 5 Go par mois`);
  if (e.stockage && !e.stockage.avecReference) l.push("  Astuce : donnez une référence (-Reference <ancienne archive .tar.enc>) pour ne télécharger que les fichiers nouveaux ou modifiés.");
  l.push("  (Estimation prudente ; la page Usage de Supabase peut afficher un peu plus à cause des unités et des requêtes de vérification.)");
  return l;
}

/** Lecture seule : taille des tables, buckets de la portée, liste des fichiers de la portée (Complet seulement). `client` : tout objet avec query(sql, params). */
export async function mesurer(client, { mode, avecImagesPubliques = false }) {
  await client.query("SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY");
  const { rows: t } = await client.query(
    "SELECT COALESCE(sum(pg_total_relation_size(c.oid)),0)::bigint AS octets FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind IN ('r','p') AND n.nspname IN ('public','auth','storage')",
  );
  const r = { tailleRelationsOctets: Number(t[0].octets), bucketsPortee: [], objets: [] };
  if (mode === "Complet") {
    const { rows: b } = await client.query("SELECT id FROM storage.buckets ORDER BY id");
    r.bucketsPortee = bucketsDansLaPortee(b.map((x) => x.id), { mode, avecImagesPubliques });
    if (r.bucketsPortee.length > 0) {
      const { rows } = await client.query(
        "SELECT bucket_id, name, COALESCE((metadata->>'size')::bigint, 0) AS size, updated_at, metadata->>'eTag' AS etag FROM storage.objects WHERE bucket_id = ANY($1) ORDER BY bucket_id, name",
        [r.bucketsPortee],
      );
      r.objets = rows.map((o) => ({ bucket: o.bucket_id, chemin: o.name, octets: Number(o.size), updated_at: o.updated_at ? new Date(o.updated_at).toISOString() : null, etag: o.etag ?? null }));
    }
  }
  return r;
}

/** Estimation d'une REPRISE, calculée sur le disque (manifeste de l'export interrompu) : aucune connexion. null si le manifeste n'existe pas. */
export function estimerReprise(dossierClair) {
  const manifeste = path.join(dossierClair, "stockage", "manifeste-stockage.json");
  if (!fs.existsSync(manifeste)) return null;
  const entrees = JSON.parse(fs.readFileSync(manifeste, "utf8"));
  const reste = entrees.filter((e) => !e.sha256 && e.statut !== "inchange");
  const octets = sommeOctets(reste);
  return { fichiers: reste.length, octets, total: octets + DIVERS_OCTETS + entrees.length * OCTETS_PAR_LIGNE_LISTE };
}

async function main() {
  const args = process.argv.slice(2);
  const valeur = (nom) => args.find((a) => a.startsWith(`--${nom}=`))?.slice(nom.length + 3);
  const reprise = valeur("reprise");
  if (reprise) {
    const e = estimerReprise(reprise);
    if (e) {
      console.log("ESTIMATION DE L'EGRESS DE CETTE REPRISE (rien n'est téléchargé tant que vous n'avez pas confirmé)");
      console.log("  La base de données n'est PAS refaite (dump conservé).");
      console.log(`  Fichiers à retélécharger : ${e.fichiers} (${fmtMo(e.octets)}), les fichiers déjà présents et vérifiés ne sont pas redemandés.`);
      console.log(`  TOTAL ESTIMÉ : environ ${fmtMo(e.total)}, soit ${fmtPct(e.total / QUOTA_EGRESS_OCTETS)} du quota gratuit de 5 Go par mois`);
      return;
    }
    console.log("  Pas de manifeste dans ce dossier : l'estimation est faite comme pour un nouvel export des fichiers.");
  }
  const mode = valeur("mode");
  if (!["Leger", "Complet"].includes(mode)) {
    console.error("Usage : --mode=Leger|Complet [--avec-images-publiques] [--baseline=<etat.json>]");
    process.exit(1);
  }
  if (!process.env.EXPORT_DB_URL) {
    console.error("EXPORT_DB_URL absente (adresse de connexion à la base).");
    process.exit(1);
  }
  const avecImagesPubliques = args.includes("--avec-images-publiques");
  let etat = null;
  const fichierBaseline = valeur("baseline");
  if (fichierBaseline) {
    try {
      etat = JSON.parse(fs.readFileSync(fichierBaseline, "utf8"));
    } catch {
      console.error("Etat du dernier export illisible : arret par prudence.");
      process.exit(1);
    }
  }
  const client = new pg.Client({ connectionString: process.env.EXPORT_DB_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const m = await mesurer(client, { mode, avecImagesPubliques });
    const est = estimerEgress({ mode, avecImagesPubliques, tailleRelationsOctets: m.tailleRelationsOctets, objets: m.objets, bucketsPortee: m.bucketsPortee, etat });
    for (const ligne of formaterEstimation(est)) console.log(ligne);
  } finally {
    await client.end();
  }
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}`) await main();

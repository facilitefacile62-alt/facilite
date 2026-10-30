// Portée des modes d'export (Leger / Complet) et calcul des fichiers à télécharger (nouveaux ou modifiés depuis le dernier export). Fonctions PURES : aucun accès réseau ni disque.
//
// Leger   : base de données seulement, aucun fichier de stockage.
// Complet : base + fichiers des buckets PRIVÉS (avatars, covers, banque-cv, resumes, chat-attachments, invoices…). Les 3 buckets publics (job-offers, marketplace-photos,
//           stories-media) sont déjà copiés dans R2 : exclus par défaut, inclus avec -AvecImagesPubliques.
// En mode Complet, un fichier n'est téléchargé que s'il est NOUVEAU ou MODIFIÉ par rapport à l'état du dernier export (nom, taille, date de modification, empreinte de contenu
// connue) ; les autres sont seulement « référencés » : le manifeste les décrit, l'archive qui les contient est celle du dernier export où ils ont été téléchargés.
export const MODES = ["Leger", "Complet"];
export const BUCKETS_PUBLICS = ["job-offers", "marketplace-photos", "stories-media"];

/** Buckets exportés par un mode, parmi ceux qui existent. Leger : aucun. */
export function bucketsDansLaPortee(bucketsExistants, { mode, avecImagesPubliques = false }) {
  if (!MODES.includes(mode)) throw new Error(`Mode inconnu : ${mode} (Leger ou Complet).`);
  if (mode === "Leger") return [];
  return [...bucketsExistants].filter((b) => avecImagesPubliques || !BUCKETS_PUBLICS.includes(b)).sort();
}

const heure = (v) => {
  const t = v ? new Date(v).getTime() : NaN;
  return Number.isFinite(t) ? t : null;
};

/**
 * Compare les objets actuels du stockage (bucket, chemin, octets, updated_at?, etag?) à l'état du dernier export (liste de { bucket, chemin, octets, sha256?, updated_at?, etag?, archive? }).
 * Règles : absent de l'état, ou sans empreinte (jamais téléchargé correctement) → nouveau ; taille différente → modifié ; date de modification plus récente que celle de l'état → modifié ;
 * etag différent (quand les deux sont connus) → modifié ; sinon inchangé. Un fichier de l'état qui n'existe plus → supprimé (il reste dans les archives précédentes).
 * Sans état (null) : tout est nouveau.
 */
export function calculerDelta(objets, etat) {
  const base = new Map((etat?.fichiers || []).map((f) => [`${f.bucket}\0${f.chemin}`, f]));
  const vus = new Set();
  const r = { nouveaux: [], modifies: [], inchanges: [], supprimes: [] };
  for (const o of objets) {
    const cle = `${o.bucket}\0${o.chemin}`;
    vus.add(cle);
    const b = base.get(cle);
    if (!b || !b.sha256) r.nouveaux.push(o);
    else if (Number(b.octets) !== Number(o.octets)) r.modifies.push(o);
    else if (heure(o.updated_at) !== null && heure(b.updated_at) !== null && heure(o.updated_at) > heure(b.updated_at)) r.modifies.push(o);
    else if (o.etag && b.etag && o.etag !== b.etag) r.modifies.push(o);
    else r.inchanges.push({ ...o, base: b });
  }
  for (const [cle, b] of base) if (!vus.has(cle)) r.supprimes.push(b);
  r.aTelecharger = [...r.nouveaux, ...r.modifies];
  return r;
}

export const sommeOctets = (liste) => liste.reduce((s, f) => s + Number(f.octets || 0), 0);

/** État initial à partir du manifeste d'un export précédent (entrées { bucket, chemin, octets, sha256 }) : sert de référence pour le premier export incrémental. */
export function etatDepuisManifeste(manifeste, { archive, date = new Date().toISOString(), buckets = null }) {
  return {
    version: 1,
    date,
    archive,
    fichiers: manifeste
      .filter((e) => e.sha256 && !e.statut && (!buckets || buckets.includes(e.bucket)))
      .map((e) => ({ bucket: e.bucket, chemin: e.chemin, octets: e.octets, sha256: e.sha256, updated_at: e.updated_at ?? null, etag: e.etag ?? null, archive })),
  };
}

/**
 * Nouvel état après un export Complet réussi. `manifeste` = celui du nouvel export (entrées téléchargées avec sha256 ; entrées « inchange » qui portent déjà l'archive d'origine).
 * Les buckets HORS de la portée de cet export gardent leurs entrées (basculer -AvecImagesPubliques ne fait rien perdre) ; les fichiers disparus des buckets exportés sont retirés.
 */
export function fusionnerEtat(ancienEtat, manifeste, { archive, date = new Date().toISOString(), buckets }) {
  const horsPortee = (ancienEtat?.fichiers || []).filter((f) => !buckets.includes(f.bucket));
  const nouveaux = manifeste
    .filter((e) => buckets.includes(e.bucket) && e.sha256 && e.statut !== "echec" && e.statut !== "absent_source")
    .map((e) => ({
      bucket: e.bucket,
      chemin: e.chemin,
      octets: e.octets,
      sha256: e.sha256,
      updated_at: e.updated_at ?? null,
      etag: e.etag ?? null,
      archive: e.statut === "inchange" ? e.archive : archive,
    }));
  return { version: 1, date, archive, fichiers: [...horsPortee, ...nouveaux] };
}

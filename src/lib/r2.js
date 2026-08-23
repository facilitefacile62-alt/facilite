import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Cloudflare R2 (compatible S3) — usage non spécifié à l'écriture de ce
 * fichier : traité par défaut comme un stockage de documents personnels,
 * donc privé. Jamais de R2_PUBLIC_URL ici — uniquement des URLs signées et
 * temporaires (upload ET lecture), à la charge de l'appelant de vérifier
 * que l'utilisateur a le droit d'accéder à la clé demandée avant d'appeler
 * ces fonctions (ce module ne fait aucune vérification d'autorisation).
 */
function getR2Client() {
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error("Configuration R2 manquante (R2_ENDPOINT/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY).");
  }

  return new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });
}

/**
 * URL signée temporaire pour déposer un fichier privé (PUT direct depuis le
 * client, sans jamais transiter par notre serveur ni exposer les
 * identifiants R2). expiresIn en secondes, 3600 (1h) par défaut.
 */
export async function createR2UploadUrl(key, { contentType, expiresIn = 3600 } = {}) {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) throw new Error("Configuration R2 manquante (R2_BUCKET_NAME).");

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType || undefined,
  });

  return getSignedUrl(getR2Client(), command, { expiresIn });
}

/**
 * URL signée temporaire pour lire un fichier privé (GET direct). Seule
 * façon de récupérer un objet du bucket : jamais de lien public construit
 * à partir de R2_PUBLIC_URL.
 */
export async function createR2DownloadUrl(key, { expiresIn = 3600 } = {}) {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) throw new Error("Configuration R2 manquante (R2_BUCKET_NAME).");

  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(getR2Client(), command, { expiresIn });
}

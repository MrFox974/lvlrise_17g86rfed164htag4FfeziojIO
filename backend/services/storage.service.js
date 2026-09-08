/**
 * Accès au stockage objet (S3) pour les fichiers envoyés par les utilisateurs.
 *
 * Le dépôt se fait par URL signée, directement du navigateur vers S3 : le
 * fichier ne transite pas par la Lambda, ce qui contourne la limite de 6 Mo de
 * charge utile et permet d'envoyer une photo de téléphone sans la compresser.
 *
 * La suppression au bout de 7 jours n'est pas gérée ici : c'est une règle de
 * cycle de vie du bucket, déclarée dans serverless.yml. Elle s'applique donc
 * même si l'application ne tourne plus.
 */
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const BUCKET = (process.env.UPLOADS_BUCKET || '').trim();
const REGION = process.env.AWS_REGION || 'eu-west-3';

/** Validité de l'URL de dépôt : le temps de choisir un fichier et de l'envoyer. */
const PUT_URL_TTL_SECONDS = 15 * 60;

let client = null;
function getClient() {
  if (!client) client = new S3Client({ region: REGION });
  return client;
}

function isConfigured() {
  return !!BUCKET;
}

function assertConfigured() {
  if (!BUCKET) {
    throw new Error('Le stockage des fichiers n\'est pas configuré sur le serveur (UPLOADS_BUCKET).');
  }
}

/**
 * Clé d'objet cloisonnée par utilisateur, avec un suffixe aléatoire : deux
 * fichiers du même nom envoyés à la même seconde ne s'écrasent pas.
 */
function buildKey(userId, filename) {
  const safe = String(filename || 'fichier')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(-80);
  const random = Math.random().toString(36).slice(2, 10);
  return `uploads/${userId}/${Date.now()}-${random}-${safe}`;
}

/** URL signée pour déposer le fichier (PUT direct depuis le navigateur). */
async function createUploadUrl(key, contentType) {
  assertConfigured();
  return getSignedUrl(
    getClient(),
    new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType }),
    { expiresIn: PUT_URL_TTL_SECONDS }
  );
}

/** Vérifie que l'objet existe bien et retourne sa taille réelle. */
async function headObject(key) {
  assertConfigured();
  const result = await getClient().send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
  return { size: result.ContentLength || 0, contentType: result.ContentType || '' };
}

/** Récupère l'objet complet en mémoire, pour extraction du texte. */
async function getObjectBuffer(key) {
  assertConfigured();
  const result = await getClient().send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  const chunks = [];
  for await (const chunk of result.Body) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function deleteObject(key) {
  if (!BUCKET || !key) return;
  try {
    await getClient().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch (error) {
    // La règle de cycle de vie finira le travail : un échec ici n'est pas bloquant.
    console.warn('[storage] suppression impossible', key, error.message);
  }
}

module.exports = {
  isConfigured,
  assertConfigured,
  buildKey,
  createUploadUrl,
  headObject,
  getObjectBuffer,
  deleteObject,
  BUCKET,
};

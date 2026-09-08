/**
 * Cycle de vie des fichiers joints : dépôt, extraction du texte, expiration.
 *
 * Ce n'est jamais le fichier qui part au modèle, mais le texte qu'on en tire.
 * Trois chemins d'extraction selon le type :
 *   - texte / markdown / csv : lecture directe ;
 *   - PDF : extraction de la couche texte. Un PDF scanné n'en a pas — on le dit
 *     plutôt que de renvoyer une chaîne vide qui donnerait des cartes inventées ;
 *   - image : lecture par le modèle de vision, qui transcrit ce qui est écrit.
 *     C'est le chemin de la photo de cours ou de manuel.
 */
const { Op } = require('sequelize');
const OpenAI = require('openai').default;
const Upload = require('../models/Upload');
const storage = require('./storage.service');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const VISION_MODEL = 'gpt-4o';

/** Types acceptés. Tout le reste est refusé à la demande d'URL, pas après le dépôt. */
const ACCEPTED_MIME = new Set([
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/heic',
  'image/heif',
]);

/** 20 Mo : au-delà, une photo n'apporte plus rien et un PDF devrait être découpé. */
const MAX_FILE_BYTES = 20 * 1024 * 1024;

/** Garde-fou de coût : texte retenu par fichier. */
const MAX_TEXT_PER_FILE = 60000;
/** Et pour l'ensemble des fichiers d'une même génération. */
const MAX_TEXT_TOTAL = 120000;

function isAcceptedMime(mimeType) {
  return ACCEPTED_MIME.has(String(mimeType || '').toLowerCase());
}

function assertAcceptable(mimeType, sizeBytes) {
  if (!isAcceptedMime(mimeType)) {
    const error = new Error(
      'Format non pris en charge. Formats acceptés : PDF, image (JPEG, PNG, WebP, HEIC), texte, Markdown, CSV.'
    );
    error.status = 400;
    throw error;
  }
  if (Number(sizeBytes) > MAX_FILE_BYTES) {
    const error = new Error(`Fichier trop volumineux (maximum ${MAX_FILE_BYTES / 1024 / 1024} Mo).`);
    error.status = 400;
    throw error;
  }
}

/** Crée la ligne en base et l'URL de dépôt. */
async function createPendingUpload(userId, { filename, mimeType, sizeBytes }) {
  storage.assertConfigured();
  assertAcceptable(mimeType, sizeBytes);

  const key = storage.buildKey(userId, filename);
  const expiresAt = new Date(Date.now() + Upload.RETENTION_DAYS * 24 * 3600 * 1000);

  const upload = await Upload.create({
    user_id: userId,
    storage_key: key,
    filename: String(filename || 'fichier').slice(0, 255),
    mime_type: String(mimeType).toLowerCase(),
    size_bytes: Number(sizeBytes) || 0,
    status: 'pending',
    expires_at: expiresAt,
  });

  const uploadUrl = await storage.createUploadUrl(key, upload.mime_type);
  return { upload, uploadUrl };
}

function cleanText(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function extractFromPdf(buffer) {
  // On vise la bibliothèque directement plutôt que le point d'entrée du
  // paquet : celui-ci exécute un mode debug qui lit un PDF de test lorsque
  // `module.parent` est absent, et ce dossier de tests est exclu du paquet
  // Lambda (limite de 250 Mo).
  const parse = require('pdf-parse/lib/pdf-parse.js');
  const data = await parse(buffer);
  const text = cleanText(data?.text);
  if (!text) {
    throw new Error(
      'Ce PDF ne contient pas de texte sélectionnable (document scanné). '
      + 'Photographiez les pages : les images sont lues par reconnaissance de texte.'
    );
  }
  return text;
}

/**
 * Signes qu'on a reçu une description de l'image au lieu de sa transcription.
 * C'est le mode d'échec le plus pénible : la réponse est courte, plausible, et
 * produirait des cartes inventées si on la laissait passer.
 */
const META_DESCRIPTION_PATTERNS = [
  /^(l['’ ]?image|la photo|le document|cette image|ce document|il s['’]agit)/i,
  /^(je ne (peux|suis) pas|désolé|impossible de)/i,
  /^(voici|ce texte|le texte (présent|visible))/i,
];

/**
 * Au-delà de cette longueur, le texte est forcément une vraie transcription :
 * on cesse d'appliquer l'heuristique de description. Sans ce plafond, une page
 * qui commencerait par « Le document unique… » serait rejetée à tort.
 */
const META_CHECK_MAX_CHARS = 600;

/**
 * Une page de texte photographiée contient au bas mot quelques centaines de
 * caractères. En dessous, ce n'est pas une transcription : c'est un commentaire,
 * un refus, ou une lecture qui a échoué.
 */
const MIN_IMAGE_TEXT_CHARS = 150;

const VISION_SYSTEM_PROMPT = 'Tu es un moteur de transcription. Tu restitues INTÉGRALEMENT '
  + 'et mot à mot le texte présent sur une image de document (page de livre, cours, '
  + 'notes manuscrites, schéma).\n\n'
  + 'Règles absolues :\n'
  + '- Tu ne décris JAMAIS l\'image. Tu ne dis jamais « ce document présente… ». '
  + 'Tu écris uniquement le texte lu.\n'
  + '- La photo peut être prise de travers, à l\'envers, ou pivotée à 90 ou 180 degrés : '
  + 'lis le texte dans son orientation, quelle qu\'elle soit, sans le signaler.\n'
  + '- Tu transcris TOUT le texte visible, y compris les titres, les notes de bas de page '
  + 'et les colonnes partiellement visibles sur les bords.\n'
  + '- Tu conserves les paragraphes et les titres. Pour un tableau ou un schéma, tu '
  + 'restitues les libellés et leur organisation.\n'
  + '- Aucun commentaire, aucune introduction, aucune conclusion.\n'
  + '- Si et seulement si l\'image ne contient réellement aucun texte, réponds exactement : VIDE';

async function callVision(buffer, mimeType, filename, insist = false) {
  const base64 = buffer.toString('base64');
  const instruction = insist
    ? `Transcris mot à mot TOUT le texte de cette image (${filename}). L'image est `
      + 'probablement pivotée : lis-la dans le bon sens. Ne décris pas l\'image, '
      + 'écris uniquement son texte.'
    : `Transcris intégralement le texte de ce document (${filename}).`;

  const completion = await openai.chat.completions.create(
    {
      model: VISION_MODEL,
      messages: [
        { role: 'system', content: VISION_SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: instruction },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}`, detail: 'high' } },
          ],
        },
      ],
      // Une page dense de livre dépasse largement 4 000 jetons une fois
      // transcrite : trop court, la transcription serait coupée en plein texte.
      max_tokens: 8000,
      temperature: 0,
    },
    { timeout: 3 * 60 * 1000 }
  );

  return cleanText(completion.choices?.[0]?.message?.content);
}

/**
 * Les motifs sont ancrés en début de texte et ne s'appliquent qu'aux réponses
 * courtes : une transcription qui contiendrait ces mots plus loin dans la page
 * reste parfaitement valide.
 */
function looksLikeDescription(text) {
  if (!text || text.length > META_CHECK_MAX_CHARS) return false;
  const head = text.slice(0, 200);
  return META_DESCRIPTION_PATTERNS.some((re) => re.test(head));
}

/**
 * Toutes les photos ne sont pas des pages de texte : on photographie aussi un
 * objet, un lieu, une œuvre, un schéma sans légende, pour demander « qu'est-ce
 * que c'est ? ». Faute de texte à transcrire, l'image est alors décrite.
 *
 * La description n'est PAS un repli commode pour une page mal lue : c'est
 * précisément le mode d'échec qui avait produit des cartes inventées. Le prompt
 * impose donc de répondre TEXTE_ILLISIBLE devant un document dont le texte n'a
 * pas pu être lu — auquel cas le dépôt échoue, comme avant.
 */
const DESCRIPTION_SYSTEM_PROMPT = 'Tu décris le contenu visuel d\'une image, factuellement.\n\n'
  + 'Règles absolues :\n'
  + '- Si l\'image est un document écrit (page, cours, notes, capture de texte) dont le '
  + 'texte n\'a pas pu être lu, réponds EXACTEMENT : TEXTE_ILLISIBLE. Ne décris pas.\n'
  + '- Sinon, décris ce qui est représenté : nature de la chose (objet, animal, plante, '
  + 'lieu, œuvre, schéma, appareil), son nom précis si tu le reconnais, ses éléments '
  + 'visibles, leur disposition, les inscriptions éventuelles.\n'
  + '- Tu t\'en tiens à ce qui est visible. Aucune interprétation, aucune supposition '
  + 'sur le contexte, aucun conseil.\n'
  + '- Si tu n\'es pas certain de l\'identification, dis-le en un mot plutôt que de trancher.\n'
  + '- Texte suivi, sans titre ni liste à puces.';

/** En deçà, la description n'apprend rien qui puisse fonder une carte. */
const MIN_IMAGE_DESCRIPTION_CHARS = 120;

async function describeImage(buffer, mimeType, filename) {
  const base64 = buffer.toString('base64');
  const completion = await openai.chat.completions.create(
    {
      model: VISION_MODEL,
      messages: [
        { role: 'system', content: DESCRIPTION_SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: `Décris précisément ce que montre cette image (${filename}).` },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}`, detail: 'high' } },
          ],
        },
      ],
      max_tokens: 900,
      temperature: 0,
    },
    { timeout: 3 * 60 * 1000 }
  );

  return cleanText(completion.choices?.[0]?.message?.content);
}

/**
 * @returns {Promise<{ text: string, kind: 'text'|'description' }>} le texte lu
 *   sur l'image, ou à défaut la description de ce qu'elle montre.
 */
async function extractFromImage(buffer, mimeType, filename) {
  let text = await callVision(buffer, mimeType, filename, false);

  // Réponse manifestement trop courte ou qui parle de l'image au lieu de la
  // lire : on relance une fois en insistant sur l'orientation, qui est la cause
  // habituelle (page de livre photographiée de côté).
  if (!text || text === 'VIDE' || text.length < MIN_IMAGE_TEXT_CHARS || looksLikeDescription(text)) {
    const retry = await callVision(buffer, mimeType, filename, true);
    if (retry && retry.length > text.length) text = retry;
  }

  const readable = text
    && text !== 'VIDE'
    && text.length >= MIN_IMAGE_TEXT_CHARS
    && !looksLikeDescription(text);
  if (readable) return { text, kind: 'text' };

  // Pas de texte exploitable. Reste à savoir si l'image ne portait pas de texte
  // du tout — auquel cas la décrire répond à la demande — ou si c'est un
  // document mal photographié, qu'on refuse comme avant.
  // Une description qui échoue ne change rien au verdict : c'est le message sur
  // la lecture du texte qui doit remonter, pas une panne de la passe de secours.
  let description = '';
  try {
    description = await describeImage(buffer, mimeType, filename);
  } catch (error) {
    console.warn('[uploads] description de l\'image impossible :', error.message);
  }
  if (
    description
    && description !== 'TEXTE_ILLISIBLE'
    && description.length >= MIN_IMAGE_DESCRIPTION_CHARS
  ) {
    return { text: description, kind: 'description' };
  }

  if (!text || text === 'VIDE') {
    throw new Error(
      'Aucun texte n\'a pu être lu sur cette image. Vérifiez qu\'elle est nette, '
      + 'bien éclairée et que le texte occupe l\'essentiel du cadre.'
    );
  }

  // Dernier filet : plutôt que de transmettre 71 caractères au générateur — qui
  // comblerait le vide en inventant —, on refuse et on explique.
  throw new Error(
    `Seuls ${text.length} caractères ont pu être lus sur cette image : c'est trop peu `
    + 'pour en tirer des cartes fiables. Reprenez la photo bien à plat, cadrée sur le '
    + 'texte et dans le bon sens de lecture.'
  );
}

/**
 * Confirme le dépôt : lit le fichier, en extrait le texte et marque la ligne
 * prête. Appelé par le navigateur une fois le PUT terminé.
 */
async function completeUpload(userId, uploadId) {
  const upload = await Upload.findOne({ where: { id: uploadId, user_id: userId } });
  if (!upload) {
    const error = new Error('Fichier introuvable.');
    error.status = 404;
    throw error;
  }
  if (upload.status === 'ready') return upload;

  try {
    // On se fie à la taille réelle de l'objet, pas à celle annoncée par le client.
    const head = await storage.headObject(upload.storage_key);
    if (head.size === 0) throw new Error('Le fichier reçu est vide.');
    if (head.size > MAX_FILE_BYTES) {
      throw new Error(`Fichier trop volumineux (maximum ${MAX_FILE_BYTES / 1024 / 1024} Mo).`);
    }

    const buffer = await storage.getObjectBuffer(upload.storage_key);
    const mime = upload.mime_type;

    let text;
    let contentKind = 'text';
    if (mime === 'application/pdf') {
      text = await extractFromPdf(buffer);
    } else if (mime.startsWith('image/')) {
      const read = await extractFromImage(buffer, mime, upload.filename);
      text = read.text;
      contentKind = read.kind;
    } else {
      text = cleanText(buffer.toString('utf8'));
      if (!text) throw new Error('Le fichier ne contient aucun texte.');
    }

    const truncated = text.length > MAX_TEXT_PER_FILE ? text.slice(0, MAX_TEXT_PER_FILE) : text;

    await upload.update({
      status: 'ready',
      size_bytes: head.size,
      extracted_text: truncated,
      extracted_chars: truncated.length,
      content_kind: contentKind,
      error: null,
    });
    return upload;
  } catch (error) {
    await upload.update({ status: 'error', error: error.message });
    // Le fichier ne servira à rien : autant libérer la place tout de suite.
    await storage.deleteObject(upload.storage_key);
    throw error;
  }
}

/**
 * Texte combiné des fichiers d'une génération, dans l'ordre demandé.
 * Les fichiers non prêts ou appartenant à quelqu'un d'autre sont ignorés.
 */
async function getCombinedText(userId, uploadIds) {
  const ids = (Array.isArray(uploadIds) ? uploadIds : [])
    .map((id) => parseInt(id, 10))
    .filter((id) => Number.isInteger(id));
  if (ids.length === 0) return '';

  const uploads = await Upload.findAll({
    where: { id: { [Op.in]: ids }, user_id: userId, status: 'ready' },
  });
  if (uploads.length === 0) return '';

  // On respecte l'ordre d'envoi plutôt que celui de la base.
  const byId = new Map(uploads.map((u) => [u.id, u]));
  const parts = [];
  let total = 0;
  for (const id of ids) {
    const upload = byId.get(id);
    if (!upload?.extracted_text) continue;
    const remaining = MAX_TEXT_TOTAL - total;
    if (remaining <= 0) break;
    const body = upload.extracted_text.slice(0, remaining);
    total += body.length;
    // Une description d'image est annoncée comme telle : le modèle ne doit pas
    // la citer comme s'il s'agissait du texte du document.
    const label = upload.content_kind === 'description'
      ? `${upload.filename} (description de l'image, aucun texte à lire dessus)`
      : upload.filename;
    parts.push(`--- ${label} ---\n${body}`);
  }

  return parts.join('\n\n');
}

async function listUploads(userId, ids) {
  const where = { user_id: userId };
  if (Array.isArray(ids) && ids.length > 0) where.id = { [Op.in]: ids };
  return Upload.findAll({ where, order: [['created_at', 'DESC']], limit: 50 });
}

async function deleteUpload(userId, uploadId) {
  const upload = await Upload.findOne({ where: { id: uploadId, user_id: userId } });
  if (!upload) return false;
  await storage.deleteObject(upload.storage_key);
  await upload.destroy();
  return true;
}

/**
 * Supprime les fichiers arrivés à expiration. La règle de cycle de vie du
 * bucket fait déjà le ménage côté stockage ; ceci nettoie les lignes en base et
 * rattrape les objets qu'elle n'aurait pas encore traités.
 */
async function purgeExpired(now = new Date()) {
  const expired = await Upload.findAll({
    where: { expires_at: { [Op.lt]: now } },
    limit: 200,
  });
  if (expired.length === 0) return 0;

  for (const upload of expired) {
    await storage.deleteObject(upload.storage_key);
    await upload.destroy();
  }
  return expired.length;
}

/**
 * Vue transmise au navigateur. Le texte extrait n'est pas renvoyé en entier (il
 * peut peser des dizaines de kilo-octets), mais un début suffit à vérifier d'un
 * coup d'œil que le bon document a été lu — et non une description de l'image.
 */
const PREVIEW_CHARS = 400;

function summarize(upload) {
  return {
    id: upload.id,
    filename: upload.filename,
    mime_type: upload.mime_type,
    size_bytes: upload.size_bytes,
    status: upload.status,
    extracted_chars: upload.extracted_chars,
    content_kind: upload.content_kind,
    preview: upload.extracted_text ? upload.extracted_text.slice(0, PREVIEW_CHARS) : null,
    error: upload.error,
    expires_at: upload.expires_at,
  };
}

module.exports = {
  createPendingUpload,
  extractFromImage, // exporté pour les tests
  completeUpload,
  getCombinedText,
  listUploads,
  deleteUpload,
  purgeExpired,
  summarize,
  isAcceptedMime,
  ACCEPTED_MIME,
  MAX_FILE_BYTES,
  RETENTION_DAYS: Upload.RETENTION_DAYS,
};

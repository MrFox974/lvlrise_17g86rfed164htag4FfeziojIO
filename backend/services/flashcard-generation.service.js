/**
 * Génération d'une collection de flashcards complète à partir d'un sujet.
 *
 * Déroulé : un appel de plan (nom, description, groupes) puis un appel par
 * groupe pour les cartes. Ce découpage évite qu'un seul appel très long soit
 * coupé par la limite de sortie du modèle, et permet de sauver le travail déjà
 * fait si un groupe échoue.
 *
 * Contrainte structurante : le texte doit TENIR SUR LA CARTE. Elle est portée à
 * trois niveaux, du plus souhaitable au plus contraignant :
 *   1. le prompt annonce les limites en caractères ;
 *   2. une passe de reformulation reprend les cartes trop longues ;
 *   3. en dernier recours, `fitText` coupe à une fin de phrase.
 * Les deux derniers filets sont indispensables : un modèle dépasse régulièrement
 * une consigne de longueur, et une carte qui déborde est inutilisable.
 */
const OpenAI = require('openai').default;
const {
  FRONT_MAX_CHARS,
  BACK_MAX_CHARS,
  fitText,
  normalizeCard,
} = require('../utils/flashcard-limits');
const {
  parseJsonBlock, // réexporté depuis utils/llm-output pour les tests
  wasTruncated,
  isTransientError,
  getRetryDelayMs,
} = require('../utils/llm-output');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MODEL = 'gpt-4o';

/** Bornes du nombre de cartes demandé. */
const MIN_CARDS = 5;
const MAX_CARDS = 100;
const DEFAULT_CARDS = 30;

/** Un groupe trop petit n'a pas d'intérêt, trop gros il perd sa cohérence. */
const MIN_CARDS_PER_GROUP = 4;
const MAX_CARDS_PER_GROUP = 12;
const MAX_GROUPS = 10;

const CALL_TIMEOUT_MS = 3 * 60 * 1000;
const MAX_ATTEMPTS = 3;

// Extraits de documents envoyés au modèle. Le plan a besoin d'une vue large
// pour découper le sujet ; chaque groupe reçoit moins, mais l'extrait est
// répété à chaque appel — au-delà, le coût par collection s'envole.
const PLAN_SOURCE_MAX_CHARS = 24000;
const GROUP_SOURCE_MAX_CHARS = 16000;

const LEVELS = {
  debutant: 'débutant — notions de base, vocabulaire fondamental, aucun prérequis',
  intermediaire: 'intermédiaire — mécanismes, relations entre notions, cas concrets',
  avance: 'avancé — subtilités, exceptions, cas limites, articulation avec des sujets voisins',
};

async function callModel({ system, prompt, maxTokens, temperature = 0.7, itemName = 'appel' }) {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const completion = await openai.chat.completions.create(
        {
          model: MODEL,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: prompt },
          ],
          response_format: { type: 'json_object' },
          temperature,
          max_tokens: maxTokens,
        },
        { timeout: CALL_TIMEOUT_MS }
      );

      if (wasTruncated(completion)) {
        // La sortie a été coupée : le JSON est forcément incomplet, inutile de
        // tenter de le réparer.
        throw new Error(`${itemName} : réponse tronquée par la limite de sortie.`);
      }
      const raw = completion.choices?.[0]?.message?.content;
      if (!raw) throw new Error(`${itemName} : réponse vide du modèle.`);
      return parseJsonBlock(raw);
    } catch (error) {
      lastError = error;
      if (attempt < MAX_ATTEMPTS && isTransientError(error)) {
        const waitMs = getRetryDelayMs(error, attempt);
        console.warn(`[flashcards] ${itemName} : ${error.message} — nouvelle tentative dans ${waitMs}ms`);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }
      throw error;
    }
  }

  throw lastError;
}

const CARD_RULES = `RÈGLES DE RÉDACTION DES CARTES (impératives) :
- Une carte = UNE seule notion. Jamais deux questions ni deux idées sur la même carte.
- Recto : une question directe et autoportante, ${FRONT_MAX_CHARS} caractères MAXIMUM.
  Elle doit se comprendre seule, sans le titre du groupe ni la carte précédente.
- Verso : la réponse seule, ${BACK_MAX_CHARS} caractères MAXIMUM. Pas de reformulation
  de la question, pas de phrase d'introduction, pas de « Il s'agit de… ».
- Ces limites sont des contraintes d'affichage : au-delà, le texte déborde de la
  carte à l'écran. Une réponse riche doit être SCINDÉE en plusieurs cartes.
- Pas de markdown, pas de listes à puces, pas de sauts de ligne : du texte simple.
- Varie les formulations : définition, cause, conséquence, comparaison, exemple,
  date, chiffre clé, contre-exemple. Évite d'enchaîner dix « Qu'est-ce que… ? ».
- Exactitude factuelle absolue. Si un point est incertain, choisis une autre carte
  plutôt que d'inventer.`;

/**
 * Une ligne de lexique : un terme court, un séparateur, une définition.
 * Le terme est limité à six mots pour ne pas confondre avec une phrase de prose
 * contenant un deux-points (« Voici le principe : … »).
 */
const ENTRY_LINE = /^([^\s:–—\t][^:–—\t]{0,58})\s*[:–—\t]\s*(\S.{2,})$/;

function isEntryLine(line) {
  const match = ENTRY_LINE.exec(line);
  if (!match) return false;
  return match[1].trim().split(/\s+/).length <= 6;
}

/**
 * Le document est-il une liste d'entrées (lexique, glossaire, tableau de
 * vocabulaire) plutôt qu'un texte suivi ?
 *
 * Cette décision commande la manière de rédiger les cartes ; la laisser à
 * l'appréciation du modèle rendrait le résultat imprévisible d'une génération à
 * l'autre. On tranche donc ici, et la consigne envoyée est alors affirmative.
 *
 * Les seuils sont volontairement prudents : quatre entrées au minimum et une
 * nette majorité de lignes conformes, sinon un texte suivi ponctué de
 * deux-points serait pris pour un lexique.
 */
function looksLikeEntryList(sourceText) {
  const lines = String(sourceText || '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 3);
  if (lines.length < 4) return false;

  const entries = lines.filter(isEntryLine).length;
  return entries >= 4 && entries / lines.length >= 0.6;
}

/** Consignes appliquées à un document reconnu comme liste d'entrées. */
const ENTRY_LIST_RULES = `
LES DOCUMENTS FOURNIS SONT UNE LISTE D'ENTRÉES (prioritaire sur les règles ci-dessus) :
- Une carte par entrée, dans l'ordre du document. N'en omets aucune, n'en ajoute aucune.
- Au recto : le terme exact tel qu'il est écrit, SEUL. Pas « Que signifie X ? ».
- Au verso : sa définition telle que donnée, en conservant les mots du document.
- NE VARIE PAS les formulations : ici la régularité est recherchée, pas la diversité.
- Ne scinde JAMAIS une entrée en plusieurs cartes. Si une définition dépasse la
  limite, resserre-la en gardant le sens et les termes clés.
- N'invente rien : tout ce que tu écris figure dans les documents.`;

/** Consignes appliquées à un document en texte suivi. */
const PROSE_SOURCE_RULES = `
FIDÉLITÉ AUX DOCUMENTS FOURNIS (prioritaire sur les règles ci-dessus) :
- N'invente aucune carte : tout ce que tu écris doit se trouver dans les documents.
- Couvre les notions réellement présentes dans le texte, pas ce que tu sais du sujet
  par ailleurs. Si le texte ne dit rien d'un point, ne fais pas de carte dessus.
- Conserve les termes, chiffres, dates et noms propres exactement tels qu'ils sont écrits.
- Les règles générales de rédaction ci-dessus s'appliquent normalement.`;

/** Bloc de consignes adapté à la nature du document fourni. */
function buildSourceRules(sourceText) {
  if (!sourceText) return '';
  return looksLikeEntryList(sourceText) ? ENTRY_LIST_RULES : PROSE_SOURCE_RULES;
}

/**
 * Bloc de contexte issu des fichiers joints.
 * Quand l'utilisateur fournit ses propres documents, ils font autorité : les
 * cartes doivent porter sur CE contenu, pas sur ce que le modèle sait par
 * ailleurs du sujet.
 */
function buildSourceBlock(sourceText, maxChars) {
  const text = String(sourceText || '').trim();
  if (!text) return '';
  const excerpt = text.length > maxChars ? `${text.slice(0, maxChars)}\n[…document tronqué…]` : text;
  return `\n\nDOCUMENTS FOURNIS PAR L'UTILISATEUR (source de référence) :\n"""\n${excerpt}\n"""\n`
    + 'Les cartes doivent porter sur le contenu de ces documents. N\'ajoute des '
    + 'connaissances extérieures que si elles sont indispensables à la compréhension.\n';
}

/** Étape 1 : nom, description et découpage en groupes. */
async function generatePlan(subject, cardCount, level, language, sourceText = '') {
  const groupCount = Math.max(
    1,
    Math.min(MAX_GROUPS, Math.round(cardCount / ((MIN_CARDS_PER_GROUP + MAX_CARDS_PER_GROUP) / 2)))
  );

  const system = 'Tu conçois des jeux de révision par répétition espacée. Tu structures '
    + 'un sujet en groupes cohérents et progressifs, sans recouvrement entre eux.';

  const prompt = `Sujet demandé :\n"""\n${subject}\n"""\n`
    + buildSourceBlock(sourceText, PLAN_SOURCE_MAX_CHARS)
    + `\nNiveau visé : ${LEVELS[level] || LEVELS.intermediaire}.\n`
    + `Langue des cartes : ${language}.\n\n`
    + `Conçois le plan d'une collection de ${cardCount} cartes réparties en `
    + `${groupCount} groupe(s).\n\n`
    + 'Contraintes :\n'
    + `- chaque groupe contient entre ${MIN_CARDS_PER_GROUP} et ${MAX_CARDS_PER_GROUP} cartes ;\n`
    + `- la somme des « cardCount » doit valoir exactement ${cardCount} ;\n`
    + '- progression du plus fondamental au plus spécifique ;\n'
    + '- aucun recouvrement : deux groupes ne traitent jamais la même notion ;\n'
    + (sourceText && looksLikeEntryList(sourceText)
      ? '- les documents fournis SONT une liste d\'entrées : prévois une carte par '
        + 'entrée et regroupe-les par thème ou par ordre d\'apparition, sans en omettre ;\n'
      : '')
    + (sourceText && !looksLikeEntryList(sourceText)
      ? '- les documents fournis font foi : épouse LEUR découpage (parties, sections, '
        + 'titres) au lieu d\'en inventer un autre ;\n'
      : '')
    + '- « focus » : une phrase indiquant ce que le groupe doit couvrir ;\n'
    + '- « name » : titre court et descriptif de la collection (60 caractères max).\n\n'
    + 'Réponds UNIQUEMENT par un objet JSON :\n'
    + '{"name":"…","description":"…","groups":[{"title":"…","focus":"…","cardCount":8}]}';

  const plan = await callModel({
    system,
    prompt,
    maxTokens: 1500,
    temperature: 0.5,
    itemName: 'Plan de la collection',
  });

  const rawGroups = Array.isArray(plan.groups) ? plan.groups : [];
  if (rawGroups.length === 0) throw new Error('Le plan renvoyé ne contient aucun groupe.');

  // Le modèle respecte rarement la somme demandée : on la renormalise, sinon la
  // collection sort avec un nombre de cartes différent de celui demandé.
  const asked = rawGroups.map((g) => Math.max(1, Number(g.cardCount) || 0));
  const sum = asked.reduce((a, b) => a + b, 0) || 1;
  let remaining = cardCount;
  const groups = rawGroups.slice(0, MAX_GROUPS).map((g, i, arr) => {
    const isLast = i === arr.length - 1;
    const share = isLast
      ? remaining
      : Math.max(1, Math.min(MAX_CARDS_PER_GROUP, Math.round((asked[i] / sum) * cardCount)));
    remaining -= share;
    return {
      title: String(g.title || `Groupe ${i + 1}`).trim().slice(0, 120),
      focus: String(g.focus || '').trim().slice(0, 300),
      cardCount: Math.max(0, share),
    };
  }).filter((g) => g.cardCount > 0);

  return {
    name: String(plan.name || subject).trim().slice(0, 120),
    description: String(plan.description || '').trim().slice(0, 500) || null,
    groups,
  };
}

/** Étape 2 : les cartes d'un groupe. */
async function generateGroupCards({ subject, collectionName, group, level, language, existingFronts, sourceText = '' }) {
  const system = 'Tu rédiges des cartes de révision. Tu es concis à l\'extrême : '
    + 'chaque carte tient dans un espace d\'affichage fixe, et un dépassement rend '
    + 'la carte inutilisable.';

  // On rappelle les questions déjà produites : sans ça, les groupes se recouvrent
  // et la collection contient des doublons déguisés.
  const alreadyAsked = existingFronts.length > 0
    ? `\n\nQuestions DÉJÀ posées dans cette collection (n'en produis aucune équivalente) :\n`
      + existingFronts.slice(-40).map((f) => `- ${f}`).join('\n')
    : '';

  const prompt = `Collection : « ${collectionName} »\n`
    + `Sujet global : ${subject}\n`
    + `Niveau : ${LEVELS[level] || LEVELS.intermediaire}\n`
    + `Langue : ${language}\n`
    + buildSourceBlock(sourceText, GROUP_SOURCE_MAX_CHARS)
    + `\nGroupe à traiter : « ${group.title} »\n`
    + (group.focus ? `Périmètre : ${group.focus}\n` : '')
    + `\nProduis EXACTEMENT ${group.cardCount} cartes pour ce groupe.\n\n`
    + `${CARD_RULES}`
    + buildSourceRules(sourceText)
    + `${alreadyAsked}\n\n`
    + 'Réponds UNIQUEMENT par un objet JSON :\n'
    + '{"cards":[{"front":"…","back":"…"}]}';

  // ~1,9 jeton par mot en français ; une carte pèse au plus ~90 jetons, plus la
  // structure JSON. On prévoit large pour ne pas déclencher de troncature.
  const maxTokens = Math.min(8000, group.cardCount * 140 + 600);

  const data = await callModel({
    system,
    prompt,
    maxTokens,
    temperature: 0.7,
    itemName: `Groupe « ${group.title} »`,
  });

  return Array.isArray(data.cards) ? data.cards : [];
}

/**
 * Passe de reformulation : une seule tentative pour ramener les cartes trop
 * longues sous la limite, en conservant le sens. Ce qui dépasse encore est coupé
 * par `fitText` à l'appel suivant.
 */
async function shortenCards(cards, language) {
  if (cards.length === 0) return [];

  const system = 'Tu raccourcis des cartes de révision sans en altérer le sens ni '
    + 'l\'exactitude. Tu ne réponds jamais par une carte plus longue que la limite.';

  const prompt = `Ces cartes dépassent la place disponible à l'écran. Reformule-les `
    + `en ${language}, plus court, sans perdre d'information essentielle.\n\n`
    + `Limites STRICTES : recto ${FRONT_MAX_CHARS} caractères, verso ${BACK_MAX_CHARS} caractères.\n`
    + 'Supprime les formules creuses, les reprises de la question dans la réponse et '
    + 'les précisions accessoires. Garde le même ordre et le même nombre de cartes.\n\n'
    + `Cartes :\n${JSON.stringify({ cards }, null, 1)}\n\n`
    + 'Réponds UNIQUEMENT par : {"cards":[{"front":"…","back":"…"}]}';

  try {
    const data = await callModel({
      system,
      prompt,
      maxTokens: Math.min(8000, cards.length * 160 + 400),
      temperature: 0.3,
      itemName: 'Reformulation des cartes trop longues',
    });
    return Array.isArray(data.cards) ? data.cards : [];
  } catch (error) {
    // Échec non bloquant : `fitText` prendra le relais.
    console.warn('[flashcards] reformulation impossible :', error.message);
    return [];
  }
}

/** Clé de déduplication : deux questions ne diffèrent souvent que par la ponctuation. */
function frontKey(front) {
  return String(front)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Met les cartes brutes d'un groupe en état d'être enregistrées : rejet des
 * cartes vides, déduplication, puis mise aux dimensions de la carte.
 *
 * `seen` est partagé entre les groupes d'une même collection et enrichi ici :
 * c'est ce qui empêche deux groupes de poser la même question.
 *
 * @returns {{ accepted: Array<{front,back}>, duplicates: number, shortened: number, truncated: number }}
 */
async function prepareCards(rawCards, seen, language) {
  const accepted = [];
  const tooLong = [];
  let duplicates = 0;
  let shortened = 0;
  let truncated = 0;

  for (const raw of rawCards) {
    const card = normalizeCard(raw?.front, raw?.back);
    if (card.tooShort) continue;

    const key = frontKey(card.front);
    if (!key || seen.has(key)) { duplicates += 1; continue; }
    seen.add(key);

    if (card.frontTooLong || card.backTooLong) tooLong.push(card);
    else accepted.push({ front: card.front, back: card.back });
  }

  if (tooLong.length > 0) {
    const rewritten = await shortenCards(
      tooLong.map((c) => ({ front: c.front, back: c.back })),
      language
    );
    tooLong.forEach((original, i) => {
      const candidate = normalizeCard(
        rewritten[i]?.front || original.front,
        rewritten[i]?.back || original.back
      );
      if (!candidate.frontTooLong && !candidate.backTooLong) shortened += 1;
      else truncated += 1;
      accepted.push({
        front: fitText(candidate.front, FRONT_MAX_CHARS),
        back: fitText(candidate.back, BACK_MAX_CHARS),
      });
    });
  }

  return { accepted, duplicates, shortened, truncated };
}

/** Borne le nombre de cartes demandé aux valeurs acceptées. */
function clampCardCount(cardCount) {
  return Math.max(MIN_CARDS, Math.min(MAX_CARDS, Number(cardCount) || DEFAULT_CARDS));
}

function assertConfigured() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('La génération par IA n\'est pas configurée sur le serveur.');
  }
}

/**
 * Génère une collection complète en une passe, tout en mémoire.
 * Le job serveur (jobs/flashcard-generation-job.js) préfère piloter
 * `generatePlan` et `generateGroupCards` lui-même pour enregistrer les cartes
 * au fur et à mesure ; cette fonction reste le chemin simple, utilisée par les
 * tests et par tout appel synchrone.
 */
async function generateCollection({ subject, cardCount, level = 'intermediaire', language = 'français', sourceText = '' }) {
  assertConfigured();

  const requested = clampCardCount(cardCount);
  const plan = await generatePlan(subject, requested, level, language, sourceText);

  const seen = new Set();
  const existingFronts = [];
  const groups = [];
  const stats = { requested, generated: 0, duplicates: 0, shortened: 0, truncated: 0, failedGroups: [] };

  for (const group of plan.groups) {
    let rawCards = [];
    try {
      rawCards = await generateGroupCards({
        subject,
        collectionName: plan.name,
        group,
        level,
        language,
        existingFronts,
        sourceText,
      });
    } catch (error) {
      // Un groupe perdu ne condamne pas la collection : on garde les autres.
      console.error(`[flashcards] groupe « ${group.title} » échoué :`, error.message);
      stats.failedGroups.push(group.title);
      continue;
    }

    const prepared = await prepareCards(rawCards, seen, language);
    stats.duplicates += prepared.duplicates;
    stats.shortened += prepared.shortened;
    stats.truncated += prepared.truncated;

    if (prepared.accepted.length > 0) {
      groups.push({ title: group.title, cards: prepared.accepted });
      prepared.accepted.forEach((c) => existingFronts.push(c.front));
      stats.generated += prepared.accepted.length;
    }
  }

  if (stats.generated === 0) {
    throw new Error('Aucune carte n\'a pu être générée pour ce sujet. Reformulez votre demande.');
  }

  return { name: plan.name, description: plan.description, groups, stats };
}

module.exports = {
  generateCollection,
  // Réutilisé par la génération de carte à l'unité, qui est soumise aux mêmes
  // contraintes d'affichage.
  shortenCards,
  callModel,
  // Pilotage pas à pas, utilisé par le job serveur pour enregistrer les cartes
  // au fil de l'eau plutôt qu'à la toute fin.
  generatePlan,
  generateGroupCards,
  prepareCards,
  clampCardCount,
  assertConfigured,
  MIN_CARDS,
  MAX_CARDS,
  DEFAULT_CARDS,
  LEVELS,
  // exportés pour les tests
  parseJsonBlock, // réexporté depuis utils/llm-output pour les tests
  frontKey,
};

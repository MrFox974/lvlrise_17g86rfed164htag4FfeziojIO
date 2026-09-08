/**
 * Génération d'UNE carte (ou de quelques propositions) à partir d'une demande
 * libre : un mot, une description qui cherche son mot, une question.
 *
 * Trois usages, distingués par le modèle lui-même car l'utilisateur ne les
 * déclare pas :
 *   1. TERME       — « carthésien » : orthographe corrigée, puis définition ;
 *   2. RECHERCHE   — « quelqu'un de très lucide et rationnel » : plusieurs mots
 *                    candidats, une carte chacun, l'utilisateur écarte le reste ;
 *   3. EXPLICATION — « explique-moi la dette technique » : une à trois cartes.
 *
 * Ce qui distingue cette génération de celle d'une collection : rien n'est
 * enregistré ici. Les propositions repartent au navigateur, qui les soumet à
 * l'utilisateur ; seules celles qu'il garde deviennent des cartes.
 */
const {
  FRONT_MAX_CHARS,
  BACK_MAX_CHARS,
  fitText,
  normalizeCard,
} = require('../utils/flashcard-limits');
const { callModel, shortenCards, assertConfigured } = require('./flashcard-generation.service');

/** Au-delà, l'utilisateur ne trie plus, il subit. */
const MAX_PROPOSALS = 6;

/** Extrait des documents joints transmis au modèle. */
const SOURCE_MAX_CHARS = 20000;

/**
 * Contenu attendu au verso, niveau par niveau. C'est la seule différence de
 * fond entre les trois niveaux : la définition elle-même ne change pas, ce qui
 * l'accompagne change.
 */
const LEVEL_RULES = {
  debutant:
    '- DÉBUTANT : la définition seule, en une ou deux phrases simples. '
    + 'Ni exemple, ni synonyme, ni référence. Rien d\'autre que le sens du terme.',
  intermediaire:
    '- INTERMÉDIAIRE : la définition, PUIS une phrase d\'exemple qui emploie le terme, '
    + 'PUIS deux ou trois synonymes. Forme : « Définition. Ex. : … Syn. : …, … »',
  avance:
    '- AVANCÉ : la définition, une phrase d\'exemple, deux ou trois synonymes, PUIS une '
    + 'référence courte (auteur, œuvre, discipline, étymologie) qui situe le terme. '
    + 'Forme : « Définition. Ex. : … Syn. : …, … Réf. : … » '
    + 'La référence doit être vraie et vérifiable : dans le doute, cite la discipline '
    + 'ou l\'origine du mot plutôt qu\'un auteur incertain.',
};

function levelRule(level) {
  return LEVEL_RULES[level] || LEVEL_RULES.intermediaire;
}

const SYSTEM_PROMPT = 'Tu rédiges des cartes de révision par répétition espacée. '
  + 'Tu es exact et concis : chaque carte tient dans un espace d\'affichage fixe, et '
  + 'un dépassement la rend inutilisable. Tu n\'inventes jamais une définition, une '
  + 'référence ou une source.';

/** Bloc décrivant les documents joints, quand il y en a. */
function buildSourceBlock(sourceText) {
  const text = String(sourceText || '').trim();
  if (!text) return '';
  const excerpt = text.length > SOURCE_MAX_CHARS
    ? `${text.slice(0, SOURCE_MAX_CHARS)}\n[…document tronqué…]`
    : text;
  return '\n\nDOCUMENTS FOURNIS PAR L\'UTILISATEUR (source de référence) :\n'
    + `"""\n${excerpt}\n"""\n`;
}

/** Consignes propres au cas « documents joints ». */
const SOURCE_RULES = `
AVEC DES DOCUMENTS JOINTS (prioritaire) :
- Ils font foi. Définis ou explique À PARTIR d'eux, avec leurs termes, leurs chiffres
  et leurs exemples, sans plaquer ce que tu sais du sujet par ailleurs.
- Si un document est une description d'image, tu le sais : c'est ce que MONTRE la
  photo, pas un texte à citer. Traite-la comme une observation, pas comme une source
  écrite.
- NUANCE : n'ajoute une réserve QUE si les documents comportent une erreur factuelle,
  une faute manifeste ou une information fausse SUR CE QUI EST DEMANDÉ. Dans ce cas,
  et dans ce cas seulement, mets la correction dans « notice » et rédige la carte
  d'après le fait exact. Un document correct ne se commente pas : « notice » reste
  alors null. Ne signale ni le style, ni la mise en page, ni ce qui manque.`;

function buildPrompt({ query, level, language, sourceText }) {
  return `Demande de l'utilisateur :\n"""\n${query}\n"""\n`
    + buildSourceBlock(sourceText)
    + `\nLangue des cartes : ${language}.\n\n`
    + 'ÉTAPE 1 — Reconnais la nature de la demande :\n'
    + '- « terme » : c\'est un mot, une locution ou un terme, éventuellement mal '
    + 'orthographié ou mal accentué. Corrige-le silencieusement (et note la correction '
    + 'dans « correction » si tu l\'as modifié), puis produis UNE seule carte.\n'
    + '- « recherche » : la demande DÉCRIT une notion sans la nommer (« quelqu\'un de '
    + 'très lucide et rationnel »). Propose alors de 3 à 5 termes candidats, du plus '
    + 'juste au moins juste, UNE carte par terme. C\'est l\'utilisateur qui choisira.\n'
    + '- « explication » : la demande est une question ou réclame une explication. '
    + 'Produis 1 à 3 cartes qui y répondent, chacune sur une seule idée.\n\n'
    + 'ÉTAPE 2 — Rédige les cartes :\n'
    + `- Recto : le terme exact et seul (cas « terme » et « recherche »), ${FRONT_MAX_CHARS} `
    + 'caractères maximum. Pas de « Que signifie… ? ». Pour une explication, une question '
    + 'directe et autoportante.\n'
    + `- Verso : ${BACK_MAX_CHARS} caractères MAXIMUM, tout compris. C'est une contrainte `
    + 'd\'affichage : au-delà, le texte déborde de la carte. Resserre plutôt que de couper.\n'
    + '- Pas de markdown, pas de liste à puces, pas de saut de ligne.\n'
    + '- Exactitude absolue. Si tu n\'es pas sûr d\'un point, n\'en parle pas.\n\n'
    + 'CONTENU DU VERSO SELON LE NIVEAU DEMANDÉ :\n'
    + `${levelRule(level)}\n`
    + (sourceText ? SOURCE_RULES : '')
    + '\n\n« hint » : trois à six mots situant la proposition (« sens courant », '
    + '« registre soutenu », « en philosophie »…), pour aider à choisir entre plusieurs '
    + 'candidats. Null s\'il n\'y a qu\'une carte.\n\n'
    + 'Réponds UNIQUEMENT par un objet JSON :\n'
    + '{"intent":"terme|recherche|explication","correction":null,"notice":null,'
    + '"proposals":[{"term":"…","front":"…","back":"…","hint":null}]}';
}

function cleanLabel(value, max) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!text || text.toLowerCase() === 'null') return null;
  return text.slice(0, max);
}

/**
 * Ramène les propositions aux dimensions de la carte : une passe de
 * reformulation pour celles qui débordent, puis une coupe nette pour ce qui
 * dépasse encore. L'ordre des propositions est conservé — c'est celui du plus
 * juste au moins juste, et l'utilisateur trie dessus.
 */
async function fitProposals(rawProposals, language) {
  const candidates = [];
  for (const raw of rawProposals) {
    const card = normalizeCard(raw?.front, raw?.back);
    if (!card.front || !card.back) continue;
    candidates.push({
      term: cleanLabel(raw?.term, 120) || fitText(card.front, 120),
      hint: cleanLabel(raw?.hint, 60),
      front: card.front,
      back: card.back,
      tooLong: card.frontTooLong || card.backTooLong,
    });
  }

  const tooLong = candidates.filter((c) => c.tooLong);
  if (tooLong.length > 0) {
    const rewritten = await shortenCards(
      tooLong.map((c) => ({ front: c.front, back: c.back })),
      language
    );
    tooLong.forEach((card, i) => {
      if (rewritten[i]?.front) card.front = String(rewritten[i].front);
      if (rewritten[i]?.back) card.back = String(rewritten[i].back);
    });
  }

  return candidates.slice(0, MAX_PROPOSALS).map((c) => ({
    term: c.term,
    hint: c.hint,
    front: fitText(c.front, FRONT_MAX_CHARS),
    back: fitText(c.back, BACK_MAX_CHARS),
  }));
}

/**
 * Propositions de cartes pour une demande unitaire.
 *
 * @param {string} query demande brute de l'utilisateur
 * @param {'debutant'|'intermediaire'|'avance'} level
 * @param {string} language
 * @param {string} [sourceText] texte des documents joints
 * @returns {Promise<{intent: string, correction: ?string, notice: ?string,
 *   proposals: Array<{term: string, hint: ?string, front: string, back: string}>}>}
 */
async function generateCardProposals({ query, level, language, sourceText = '' }) {
  assertConfigured();

  const data = await callModel({
    system: SYSTEM_PROMPT,
    prompt: buildPrompt({ query, level, language, sourceText }),
    maxTokens: 2000,
    temperature: 0.4,
    itemName: 'Carte à l\'unité',
  });

  const rawProposals = Array.isArray(data.proposals) ? data.proposals : [];
  const proposals = await fitProposals(rawProposals, language);

  if (proposals.length === 0) {
    throw new Error(
      'Aucune carte n\'a pu être rédigée pour cette demande. Précisez le mot ou la '
      + 'notion recherchée.'
    );
  }

  return {
    intent: ['terme', 'recherche', 'explication'].includes(data.intent) ? data.intent : 'terme',
    correction: cleanLabel(data.correction, 200),
    notice: cleanLabel(data.notice, 400),
    proposals,
  };
}

module.exports = {
  generateCardProposals,
  MAX_PROPOSALS,
  // exportés pour les tests
  buildPrompt,
  fitProposals,
  LEVEL_RULES,
};

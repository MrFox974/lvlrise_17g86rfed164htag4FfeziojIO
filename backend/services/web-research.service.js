/**
 * Recherche web : le dossier de faits récents qui sert de source aux cartes.
 *
 * Pourquoi ce détour plutôt qu'une simple instruction « utilise des données à
 * jour » : le modèle qui rédige les cartes ne connaît le monde que jusqu'à sa
 * date d'entraînement. Sur un sujet mouvant (version d'un logiciel, dirigeant,
 * loi, record, prix), il produit avec assurance des faits périmés. On sépare
 * donc les deux métiers : ici on RÉCOLTE des faits datés et sourcés, ailleurs on
 * les MET EN CARTES. Le dossier produit rejoint alors le prompt de génération au
 * même titre qu'un document joint par l'utilisateur, ce qui réutilise les
 * consignes de fidélité déjà en place.
 *
 * L'outil de recherche est celui de l'API OpenAI (`web_search`) : c'est le
 * fournisseur qui interroge le web, aucune requête ne part d'ici.
 *
 * Le contenu récolté vient du web : c'est une DONNÉE, jamais une consigne. Le
 * bloc inséré dans le prompt le dit explicitement (voir buildResearchBlock dans
 * flashcard-generation.service.js), au cas où une page contiendrait une
 * instruction destinée au modèle.
 */
const OpenAI = require('openai').default;
const { isTransientError, getRetryDelayMs } = require('../utils/llm-output');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Modèle chargé de la récolte. Il doit accepter l'outil de recherche web, ce qui
 * ne dépend pas du modèle qui rédige les cartes : les deux sont réglables
 * séparément.
 */
const RESEARCH_MODEL = process.env.WEB_SEARCH_MODEL || 'gpt-4o';

/**
 * Noms successifs du même outil chez le fournisseur : `web_search` aujourd'hui,
 * `web_search_preview` sur les modèles plus anciens. On tente dans l'ordre et on
 * retient le premier accepté — sans quoi un changement de modèle suffirait à
 * faire tomber la fonctionnalité.
 */
const TOOL_TYPES = (process.env.WEB_SEARCH_TOOL || 'web_search,web_search_preview')
  .split(',')
  .map((t) => t.trim())
  .filter(Boolean);

const CALL_TIMEOUT_MS = 3 * 60 * 1000;
const MAX_ATTEMPTS = 3;
const MAX_OUTPUT_TOKENS = 4000;

/** Taille du dossier conservée. Au-delà, il est répété à chaque groupe et le coût s'envole. */
const MAX_RESEARCH_CHARS = 9000;

/** En deçà, la récolte n'a rien trouvé d'exploitable : autant le dire. */
const MIN_RESEARCH_CHARS = 300;

/** Nombre de sources rapportées à l'utilisateur. */
const MAX_SOURCES = 12;

/** La recherche est-elle utilisable sur ce serveur ? */
function isAvailable() {
  return Boolean(process.env.OPENAI_API_KEY) && process.env.FLASHCARD_WEB_SEARCH !== 'off';
}

/** Date du jour en clair : le modèle doit savoir ce que « récent » veut dire. */
function today(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

/**
 * Texte de la réponse. `output_text` est fourni par le SDK ; le repli parcourt
 * la sortie structurée, ce qui vaut aussi pour un client simulé en test.
 */
function extractText(response) {
  if (typeof response?.output_text === 'string' && response.output_text.trim()) {
    return response.output_text.trim();
  }
  const parts = [];
  for (const item of response?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === 'string') parts.push(content.text);
    }
  }
  return parts.join('\n').trim();
}

/**
 * Pages effectivement citées, dédoublonnées par URL. Ce sont elles qu'on montre
 * à l'utilisateur : une carte d'actualité sans source vérifiable ne vaut pas
 * grand-chose.
 */
function extractSources(response) {
  const seen = new Set();
  const sources = [];
  for (const item of response?.output || []) {
    for (const content of item?.content || []) {
      for (const annotation of content?.annotations || []) {
        if (annotation?.type !== 'url_citation' || !annotation.url) continue;
        if (seen.has(annotation.url)) continue;
        seen.add(annotation.url);
        sources.push({
          title: String(annotation.title || annotation.url).slice(0, 200),
          url: String(annotation.url).slice(0, 500),
        });
        if (sources.length >= MAX_SOURCES) return sources;
      }
    }
  }
  return sources;
}

/** Un outil refusé par le modèle : inutile de réessayer à l'identique. */
function isToolRejection(error) {
  const status = error?.status || error?.response?.status;
  const message = String(error?.message || '').toLowerCase();
  if (status !== 400 && status !== 404 && status !== 422) return false;
  return message.includes('tool') || message.includes('web_search') || message.includes('unsupported');
}

/** Un appel, avec ses tentatives sur erreur passagère. */
async function callWithTool(toolType, prompt) {
  let lastError = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await openai.responses.create(
        {
          model: RESEARCH_MODEL,
          tools: [{ type: toolType }],
          // Pas de `tool_choice` forcé : le fournisseur ne l'accepte pas sous ce
          // nom pour tous les outils, et un refus ferait tomber la recherche
          // entière. L'obligation de chercher passe par la consigne, et
          // l'absence de source citée est détectée à la sortie.
          input: prompt,
          max_output_tokens: MAX_OUTPUT_TOKENS,
        },
        { timeout: CALL_TIMEOUT_MS }
      );
    } catch (error) {
      lastError = error;
      if (isToolRejection(error)) throw error;
      if (attempt < MAX_ATTEMPTS && isTransientError(error)) {
        const waitMs = getRetryDelayMs(error, attempt);
        console.warn(`[web-research] ${error.message} — nouvelle tentative dans ${waitMs}ms`);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

/** Consigne de récolte. Le format demandé est de la prose datée, pas du JSON. */
function buildPrompt({ subject, language, level, date }) {
  return `Nous sommes le ${date}. Recherche sur le web l'état ACTUEL des connaissances `
    + `sur le sujet suivant, en vue de rédiger des cartes de révision.\n\n`
    + `Sujet :\n"""\n${subject}\n"""\n\n`
    + `Niveau visé : ${level || 'intermédiaire'}.\n`
    + `Rédige le dossier en ${language || 'français'}.\n\n`
    + 'Ce qui est attendu :\n'
    + '- les faits susceptibles d\'avoir changé récemment : chiffres, versions, dates, '
    + 'personnes en poste, décisions, records, prix, état de l\'art ;\n'
    + '- chaque fait sur sa propre ligne, précédé de sa date ou de sa période entre '
    + 'parenthèses, par exemple « (mars 2026) … » ;\n'
    + '- les valeurs exactes, jamais arrondies ni « environ » quand la source donne un chiffre ;\n'
    + '- ce qui a changé par rapport à la situation antérieure, quand c\'est notable.\n\n'
    + 'Ce qui est interdit :\n'
    + '- écrire un fait que la recherche n\'a pas confirmé ; s\'il y a doute, ne pas l\'écrire ;\n'
    + '- présenter une information ancienne comme actuelle ; en cas de sources contradictoires, '
    + 'retenir la plus récente et le signaler ;\n'
    + '- écrire des cartes : ici on récolte, la mise en cartes vient après ;\n'
    + '- toute mise en forme markdown (pas de titres #, pas de gras).\n\n'
    + 'Si la recherche ne renvoie rien d\'exploitable sur ce sujet, réponds exactement : '
    + 'AUCUNE INFORMATION RÉCENTE TROUVÉE.';
}

/** Coupe le dossier à une fin de ligne pour ne pas laisser un fait à moitié. */
function limitLength(text, maxChars = MAX_RESEARCH_CHARS) {
  if (text.length <= maxChars) return text;
  const window = text.slice(0, maxChars);
  const cut = window.lastIndexOf('\n');
  return (cut > maxChars * 0.5 ? window.slice(0, cut) : window).trimEnd();
}

/**
 * Récolte les faits récents sur un sujet.
 *
 * Ne lève pas d'exception sur un résultat vide : une recherche infructueuse ne
 * doit pas faire échouer la génération, elle doit être SIGNALÉE. L'appelant
 * regarde `status` et le rapporte à l'utilisateur.
 *
 * @param {{subject: string, language?: string, level?: string, now?: Date}} params
 * @returns {Promise<{status: 'ok'|'unsourced'|'empty', text: string, sources: Array<{title: string, url: string}>, model: string, tool: string|null, at: string}>}
 */
async function researchSubject({ subject, language = 'français', level, now = new Date() }) {
  if (!isAvailable()) {
    throw new Error('La recherche web n\'est pas configurée sur le serveur.');
  }
  if (!String(subject || '').trim()) {
    throw new Error('Sujet manquant pour la recherche web.');
  }

  const prompt = buildPrompt({ subject: String(subject).trim(), language, level, date: today(now) });

  let response = null;
  let usedTool = null;
  let lastError = null;
  for (const toolType of TOOL_TYPES) {
    try {
      response = await callWithTool(toolType, prompt);
      usedTool = toolType;
      break;
    } catch (error) {
      lastError = error;
      if (!isToolRejection(error)) throw error;
      console.warn(`[web-research] outil « ${toolType} » refusé : ${error.message}`);
    }
  }
  if (!response) {
    throw lastError || new Error('Aucun outil de recherche web accepté par le modèle.');
  }

  const raw = extractText(response);
  const at = now.toISOString();
  if (raw.length < MIN_RESEARCH_CHARS || /AUCUNE INFORMATION R[ÉE]CENTE TROUV[ÉE]E/i.test(raw)) {
    return { status: 'empty', text: '', sources: [], model: RESEARCH_MODEL, tool: usedTool, at };
  }

  // Aucune page citée : le modèle a probablement répondu de mémoire. Le dossier
  // reste le meilleur élément disponible, mais il est rapporté comme non sourcé
  // plutôt que présenté comme le fruit d'une recherche.
  const sources = extractSources(response);
  return {
    status: sources.length > 0 ? 'ok' : 'unsourced',
    text: limitLength(raw),
    sources,
    model: RESEARCH_MODEL,
    tool: usedTool,
    at,
  };
}

module.exports = {
  researchSubject,
  isAvailable,
  // exportés pour les tests
  extractText,
  extractSources,
  isToolRejection,
  limitLength,
  buildPrompt,
  MAX_RESEARCH_CHARS,
  MIN_RESEARCH_CHARS,
  TOOL_TYPES,
  RESEARCH_MODEL,
};

/**
 * Cohérence entre le recto et le verso d'une carte.
 *
 * Une carte peut être bien écrite, tenir dans ses limites, et rester
 * inutilisable : le verso reprend la question sans y répondre, la question
 * renvoie à un contexte que la carte ne porte pas (« selon le texte… »), ou le
 * recto pose deux questions pour une seule réponse. Le modèle produit ces
 * cartes régulièrement et rien ne les arrêtait jusqu'ici.
 *
 * Ce module ne fait que DÉTECTER, sans appel réseau, et se veut à haute
 * précision : un faux positif coûte une carte correcte réécrite pour rien, donc
 * chaque règle est volontairement étroite. La réparation, elle, est confiée au
 * modèle (voir `repairCards` dans flashcard-generation.service.js).
 */

/** Mots trop fréquents pour dire quoi que ce soit du contenu d'une carte. */
const STOP_WORDS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'da', 'au', 'aux', 'a', 'et', 'ou', 'que',
  'qui', 'quoi', 'quel', 'quelle', 'quels', 'quelles', 'est', 'ce', 'cet', 'cette', 'ces', 'son',
  'sa', 'ses', 'leur', 'leurs', 'en', 'dans', 'pour', 'par', 'sur', 'avec', 'sans', 'il', 'elle',
  'ils', 'elles', 'on', 'se', 'sont', 'etre', 'ete', 'avoir', 'as', 'ai', 'y', 'ne', 'pas', 'plus',
  'comment', 'pourquoi', 'quand', 'ou', 'combien', 'the', 'of', 'is', 'are', 'to', 'in', 'what',
]);

/** Réponses qui n'en sont pas. */
const PLACEHOLDER = /^(n\s*\/?\s*a|nc|na|inconnu|inconnue|non renseigne|aucun|aucune|idem|id\.|voir ci-dessus|voir plus haut|voir le texte|voir le document|cf\.?|\?+|-+|\.+|…)$/i;

/**
 * La question renvoie à un contexte absent de la carte. En révision, la carte
 * est seule à l'écran : « selon le texte » ne désigne alors plus rien.
 * Formulations retenues au mot près — « dans le cas de la photosynthèse » est
 * parfaitement légitime, « dans ce cas » ne l'est pas.
 */
const CONTEXT_PATTERNS = [
  /\bselon (?:le|ce|les|ces) (?:texte|document|documents|extrait|cours|chapitre|passage)\b/i,
  /\bd['’]apres (?:le|ce|les|ces) (?:texte|document|documents|extrait|cours|passage)\b/i,
  /\bdans (?:le|ce|les|ces) (?:texte|document|documents|extrait|passage)\b/i,
  /\bdans ce (?:cas|contexte)\b/i,
  /\bci-(?:dessus|dessous)\b/i,
  /\b(?:comme )?(?:vu|vue|mentionne|mentionnee|evoque|evoquee|cite|citee) (?:plus haut|precedemment|ci-avant)\b/i,
  /\b(?:carte|question) precedente\b/i,
  /\baccording to the (?:text|document|passage)\b/i,
  /\bin this (?:case|context|passage)\b/i,
];

/** Un verso qui interroge au lieu de répondre. */
const INTERROGATIVE_START = /^(qu['’]|que\b|quel|quelle|quels|quelles|comment|pourquoi|ou\b|quand\b|combien|est-ce|qui\b|what|why|how|when|where)/i;

/** Une consigne vaut une question : « Cite trois causes… » est un recto valable. */
const IMPERATIVE_START = /^(cite|citez|nomme|nommez|donne|donnez|definis|definissez|explique|expliquez|enumere|enumerez|indique|indiquez|complete|completez|traduis|traduisez|calcule|calculez|decris|decrivez|associe|associez|list|name|define|explain)\b/i;

/** Minuscules sans accents : la comparaison porte sur le sens, pas la typographie. */
function fold(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/**
 * Mots porteurs de sens d'un texte, dans l'ordre, doublons compris.
 * Un jeton de moins de trois lettres n'apporte rien — sauf s'il porte un
 * chiffre, car « 6 » ou « 42 » est souvent toute la réponse.
 */
function contentTokens(text) {
  return fold(text)
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((w) => w && !STOP_WORDS.has(w) && (w.length > 2 || /[0-9]/.test(w)));
}

/** Mots porteurs de sens d'un texte, dédoublonnés. */
function contentWords(text) {
  return new Set(contentTokens(text));
}

/**
 * Caractères qui portent une information à eux seuls : une formule, un
 * pourcentage, une date. Leur apparition au verso interdit de conclure que
 * celui-ci n'ajoute rien, même quand le nettoyage des mots l'a vidé.
 */
function hasOwnNotation(front, back) {
  const notation = /[0-9=+×÷/%°<>^$£€]/g;
  const inFront = new Set(String(front || '').match(notation) || []);
  return (String(back || '').match(notation) || []).some((ch) => !inFront.has(ch));
}

/** Texte comparable mot à mot, ponctuation et accents effacés. */
function canonical(text) {
  return fold(text).replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Le verso n'ajoute-t-il rien à la question ?
 *
 * Le défaut le plus fréquent, et le plus coûteux en révision : le verso
 * reformule le recto. On le mesure sur les mots porteurs de sens du verso —
 * aucun mot nouveau, ou une part de nouveauté si faible que la réponse se
 * réduit à la question reformulée.
 *
 * Deux garde-fous contre les faux positifs, car une carte correcte réécrite
 * pour rien coûte un appel et parfois du sens :
 *   - une notation propre au verso (chiffre, formule, pourcentage) suffit à le
 *     sauver, même si le nettoyage des mots l'a vidé (« Aire = π × r² ») ;
 *   - la part de nouveauté n'est jugée qu'à partir de trois mots, une réponse
 *     brève (« Paris », « 1789 ») étant légitimement pauvre en mots.
 */
function answerAddsNothing(front, back) {
  const backTokens = contentTokens(back);
  if (backTokens.length === 0) return !hasOwnNotation(front, back);
  if (hasOwnNotation(front, back)) return false;

  const frontWords = contentWords(front);
  const novel = new Set(backTokens.filter((w) => !frontWords.has(w)));
  if (novel.size === 0) return true;
  return backTokens.length >= 3 && novel.size / backTokens.length <= 0.34;
}

/**
 * Défauts d'une carte, sous forme de codes.
 *
 * @param {{front: string, back: string}} card
 * @param {{entryList?: boolean}} [options] `entryList` : le recto est un terme
 *   nu (lexique, glossaire), pas une question — les règles de forme du recto ne
 *   s'appliquent alors pas.
 * @returns {string[]} codes, dans l'ordre de gravité décroissante
 */
function auditCard(card, options = {}) {
  const { entryList = false } = options;
  const front = String(card?.front || '').trim();
  const back = String(card?.back || '').trim();
  const issues = [];

  if (!front || !back || PLACEHOLDER.test(back) || PLACEHOLDER.test(front)) {
    issues.push('placeholder');
    // Rien d'autre à dire d'une carte vide de réponse.
    return issues;
  }

  if (answerAddsNothing(front, back)) issues.push('echo');

  if (back.endsWith('?') && INTERROGATIVE_START.test(back)) issues.push('answer-is-question');

  const contextIn = (text) => CONTEXT_PATTERNS.some((re) => re.test(fold(text)));
  if (contextIn(front) || contextIn(back)) issues.push('context');

  // Deux points d'interrogation : deux questions, une seule réponse possible.
  if (/\?[^?]*\?/.test(front)) issues.push('multi');

  // Un recto affirmatif se révise mal : on le signale, sans le condamner.
  if (!entryList
    && !front.includes('?')
    && !IMPERATIVE_START.test(fold(front))
    && /[.!]$/.test(front)
    && front.split(/\s+/).length >= 5) {
    issues.push('no-question');
  }

  return issues;
}

/**
 * Défauts qui rendent la carte inutilisable : si la réécriture échoue, mieux
 * vaut la carte en moins que la carte fausse.
 */
const BLOCKING_ISSUES = new Set(['placeholder', 'echo', 'answer-is-question', 'context', 'multi']);

/** Vrai si l'un des défauts interdit de conserver la carte en l'état. */
function isBlocking(issues) {
  return (issues || []).some((code) => BLOCKING_ISSUES.has(code));
}

/** Libellés envoyés au modèle pour qu'il sache quoi corriger. */
const ISSUE_LABELS = {
  placeholder: 'le verso ne contient aucune réponse réelle',
  echo: 'le verso reprend la question sans y répondre',
  'answer-is-question': 'le verso est une question au lieu d\'une réponse',
  context: 'la question renvoie à un contexte que la carte ne porte pas (« selon le texte », « ci-dessus »)',
  multi: 'le recto pose deux questions pour une seule réponse',
  'no-question': 'le recto est une affirmation, pas une question',
};

module.exports = {
  auditCard,
  isBlocking,
  answerAddsNothing,
  contentTokens,
  contentWords,
  canonical,
  BLOCKING_ISSUES,
  ISSUE_LABELS,
};

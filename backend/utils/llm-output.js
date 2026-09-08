/**
 * Traitement des réponses de modèle de langage.
 *
 * Trois pièges reviennent systématiquement quand on génère du contenu long, et
 * ils sont traités ici une fois pour toutes :
 *
 *  1. le JSON n'est pas toujours du JSON — le modèle l'entoure de texte ou de
 *     ```json, et une réponse coupée par la limite de sortie n'est pas
 *     réparable : mieux vaut une erreur explicite qu'un « Unexpected end of
 *     JSON input » ;
 *  2. une réponse coupée à `max_tokens` s'arrête au milieu d'une phrase, et ce
 *     texte part tel quel dans le document si personne ne le détecte ;
 *  3. toutes les erreurs ne se valent pas : réessayer un 429 a du sens,
 *     réessayer une clé d'API invalide ne fait que perdre du temps.
 */

/**
 * Extrait le premier objet JSON équilibré d'une réponse de modèle.
 * Le balayage tient compte des chaînes et des échappements : une accolade dans
 * une valeur textuelle ne fausse pas le comptage.
 */
function parseJsonBlock(raw) {
  const text = String(raw || '');
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const candidate = fenced ? fenced[1] : text;

  const start = candidate.indexOf('{');
  if (start === -1) throw new Error('Réponse du modèle sans objet JSON.');

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < candidate.length; i += 1) {
    const ch = candidate[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return JSON.parse(candidate.slice(start, i + 1));
    }
  }
  throw new Error('Réponse du modèle : JSON incomplet (sortie probablement tronquée).');
}

/**
 * Coupe un texte tronqué à la dernière fin de paragraphe, pour ne pas laisser
 * une phrase en suspens. Si la coupe ferait perdre plus de la moitié du texte,
 * on préfère garder l'ensemble : mieux vaut une phrase inachevée qu'un
 * paragraphe amputé.
 */
function trimToLastParagraph(text) {
  const value = String(text || '');
  const cut = value.lastIndexOf('\n\n');
  return cut > value.length * 0.5 ? value.slice(0, cut).trimEnd() : value.trimEnd();
}

/** Vrai si la réponse a été coupée par la limite de sortie du modèle. */
function wasTruncated(completion) {
  return completion?.choices?.[0]?.finish_reason === 'length';
}

/**
 * Erreurs qui méritent une nouvelle tentative : surcharge du fournisseur,
 * coupure réseau, temps d'attente dépassé. Une erreur d'authentification ou de
 * requête mal formée, elle, se reproduira à l'identique.
 */
function isTransientError(error) {
  const status = error?.status || error?.response?.status;
  if (status === 429 || (status >= 500 && status < 600)) return true;
  if (status >= 400 && status < 500) return false;

  const message = String(error?.message || '').toLowerCase();
  return message.includes('timeout')
    || message.includes('econnreset')
    || message.includes('etimedout')
    || message.includes('econnrefused')
    || message.includes('socket hang up')
    || message.includes('network');
}

/**
 * Délai avant nouvelle tentative : on respecte l'en-tête `retry-after` du
 * fournisseur quand il est présent, sinon repli exponentiel.
 */
function getRetryDelayMs(error, attempt) {
  const header = error?.headers?.['retry-after'] ?? error?.response?.headers?.['retry-after'];
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds * 1000, 30000);
  return Math.min(1000 * 2 ** (attempt - 1), 15000);
}

module.exports = {
  parseJsonBlock,
  trimToLastParagraph,
  wasTruncated,
  isTransientError,
  getRetryDelayMs,
};

#!/usr/bin/env node
/**
 * Vérifie les utilitaires de traitement des réponses de modèle, partagés par le
 * générateur de collections de flashcards et celui de la Bibliothèque.
 *
 * Usage : node scripts/test-llm-output.js
 */
const {
  parseJsonBlock,
  trimToLastParagraph,
  wasTruncated,
  isTransientError,
  getRetryDelayMs,
} = require('../utils/llm-output');

let failures = 0;

function assert(label, condition, detail = '') {
  if (!condition) failures += 1;
  console.log(`${condition ? '✓' : '✗'} ${label}${condition ? '' : `\n   ${detail}`}`);
}

console.log('\n— Extraction du JSON —');
assert('objet nu', parseJsonBlock('{"a":1}').a === 1);
assert('précédé de texte', parseJsonBlock('Voici le plan :\n{"a":2}').a === 2);
assert('bloc ```json', parseJsonBlock('```json\n{"a":3}\n```').a === 3);
assert('bloc ``` sans langage', parseJsonBlock('```\n{"a":4}\n```').a === 4);
assert('objets imbriqués', parseJsonBlock('{"a":{"b":{"c":5}}}').a.b.c === 5);
assert('accolade dans une chaîne', parseJsonBlock('{"t":"} piège {","v":6}').v === 6);
assert('guillemet échappé', parseJsonBlock('{"t":"il dit \\"oui\\"","v":7}').v === 7);
assert('texte après l\'objet ignoré', parseJsonBlock('{"a":8} et voilà !').a === 8);

let threw = null;
try { parseJsonBlock('{"a":1'); } catch (e) { threw = e.message; }
assert('JSON tronqué → message explicite', /incomplet/i.test(threw || ''), threw);
threw = null;
try { parseJsonBlock('aucun json ici'); } catch (e) { threw = e.message; }
assert('aucun objet → message explicite', /sans objet JSON/i.test(threw || ''), threw);

console.log('\n— Coupe d\'un texte tronqué —');
const paragraphs = 'Premier paragraphe complet.\n\nDeuxième paragraphe complet.\n\nTroisième coupé au mil';
assert(
  'revient à la dernière fin de paragraphe',
  trimToLastParagraph(paragraphs) === 'Premier paragraphe complet.\n\nDeuxième paragraphe complet.',
  JSON.stringify(trimToLastParagraph(paragraphs))
);
// Coupe précoce : le seul « \n\n » est en tout début de texte. Y revenir
// jetterait l'essentiel du contenu — on préfère garder la phrase inachevée.
const earlyBreak = 'Titre\n\nUn très long paragraphe qui constitue la quasi-totalité du contenu produit '
  + 'par le modèle et qui se trouve coupé net à la toute fin de la géné';
assert(
  'ne sacrifie pas plus de la moitié du texte',
  trimToLastParagraph(earlyBreak) === earlyBreak.trimEnd(),
  JSON.stringify(trimToLastParagraph(earlyBreak).slice(0, 60))
);
assert('texte sans paragraphe conservé', trimToLastParagraph('une seule ligne') === 'une seule ligne');

console.log('\n— Détection de troncature —');
assert('finish_reason length', wasTruncated({ choices: [{ finish_reason: 'length' }] }) === true);
assert('finish_reason stop', wasTruncated({ choices: [{ finish_reason: 'stop' }] }) === false);
assert('réponse absente', wasTruncated(undefined) === false);

console.log('\n— Classement des erreurs —');
assert('429 → à réessayer', isTransientError({ status: 429 }) === true);
assert('500 → à réessayer', isTransientError({ status: 503 }) === true);
assert('401 → définitive', isTransientError({ status: 401 }) === false);
assert('400 → définitive', isTransientError({ status: 400 }) === false);
assert('timeout → à réessayer', isTransientError(new Error('Request timeout')) === true);
assert('ECONNRESET → à réessayer', isTransientError(new Error('read ECONNRESET')) === true);
assert('erreur métier → définitive', isTransientError(new Error('sujet invalide')) === false);

console.log('\n— Délai avant nouvelle tentative —');
assert('repli exponentiel', getRetryDelayMs({}, 1) === 1000 && getRetryDelayMs({}, 3) === 4000);
assert('plafonné à 15 s', getRetryDelayMs({}, 20) === 15000);
assert(
  'respecte retry-after',
  getRetryDelayMs({ headers: { 'retry-after': '7' } }, 1) === 7000
);
assert(
  'retry-after plafonné à 30 s',
  getRetryDelayMs({ headers: { 'retry-after': '600' } }, 1) === 30000
);

console.log(`\n${failures === 0 ? 'Tout est bon.' : `${failures} vérification(s) en échec.`}\n`);
process.exitCode = failures === 0 ? 0 : 1;

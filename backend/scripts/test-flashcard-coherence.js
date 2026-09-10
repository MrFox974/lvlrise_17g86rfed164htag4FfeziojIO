#!/usr/bin/env node
/**
 * Cohérence recto/verso : ce que le code détecte, répare, écarte — et ce qu'il
 * laisse tranquille.
 *
 * Deux volets :
 *   1. la détection seule (utils/flashcard-coherence), sans aucun appel ;
 *   2. le trajet complet dans `prepareCards`, modèle simulé : réparation,
 *      abandon, et surtout appariement par identifiant — une carte omise par le
 *      modèle ne doit JAMAIS recoller le recto de l'une au verso de l'autre.
 *
 * Portée : ce script prouve la mécanique. Il ne prouve pas que GPT-4o écrit des
 * cartes cohérentes, ce qui ne se vérifie que sur un appel réel.
 *
 * Usage : node scripts/test-flashcard-coherence.js
 */
const path = require('path');
const Module = require('module');

/** Réponse du modèle simulé, remplacée par chaque scénario. */
let handler = () => { throw new Error('Aucun modèle simulé pour ce prompt'); };
const prompts = [];

class FakeOpenAI {
  constructor() {
    this.chat = { completions: { create: (params) => this.respond(params) } };
  }
  async respond(params) {
    const prompt = params.messages[1].content;
    prompts.push(prompt);
    const payload = await handler(prompt);
    return { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(payload) } }] };
  }
}

const originalLoad = Module._load;
Module._load = function patched(request, parent, isMain) {
  if (request === 'openai') { const s = FakeOpenAI; s.default = FakeOpenAI; return s; }
  return originalLoad.call(this, request, parent, isMain);
};

process.env.OPENAI_API_KEY = 'test-key';
const B = path.join(__dirname, '..');
const { auditCard, isBlocking, answerAddsNothing } = require(path.join(B, 'utils', 'flashcard-coherence'));
const generation = require(path.join(B, 'services', 'flashcard-generation.service'));
const { FRONT_MAX_CHARS, BACK_MAX_CHARS } = require(path.join(B, 'utils', 'flashcard-limits'));

let failures = 0;
function assert(label, cond, detail = '') {
  if (!cond) failures += 1;
  console.log(`${cond ? '✓' : '✗'} ${label}${cond ? '' : `\n   ${detail}`}`);
}

const long = (n) => 'a'.repeat(n);

(async () => {
  console.log('— 1. Cartes saines : rien ne doit être signalé —');
  const saines = [
    ['Qu\'est-ce que la photosynthèse ?', 'Conversion de la lumière en énergie chimique par les plantes.'],
    ['Quelle est la capitale de l\'Australie ?', 'Canberra'],
    ['En quelle année la Révolution française commence-t-elle ?', '1789'],
    ['Quelle est la formule de l\'aire d\'un cercle ?', 'Aire = π × r²'],
    ['Combien de côtés a un hexagone ?', 'Six'],
    ['Qui a écrit Les Misérables ?', 'Victor Hugo'],
    ['Cite deux gaz à effet de serre.', 'Le dioxyde de carbone et le méthane.'],
  ];
  for (const [front, back] of saines) {
    const issues = auditCard({ front, back });
    assert(`« ${front.slice(0, 40)}… » acceptée`, issues.length === 0, `signalée : ${issues.join(', ')}`);
  }

  console.log('\n— 2. Cartes fautives : chaque défaut est nommé —');
  const fautives = [
    ['echo', 'Quel est le rôle de la mitochondrie ?', 'Le rôle de la mitochondrie est un rôle mitochondrial.'],
    ['echo', 'Qu\'est-ce que l\'inflation ?', 'L\'inflation est l\'inflation.'],
    ['context', 'Selon le texte, quel est le rôle du narrateur ?', 'Il observe sans juger.'],
    ['context', 'Dans ce cas, que se passe-t-il ?', 'La réaction s\'arrête.'],
    ['answer-is-question', 'Quel est le rôle de l\'ADN ?', 'Quel est le rôle de l\'ADN dans la cellule ?'],
    ['multi', 'Quelle est la cause ? Quelle est la conséquence ?', 'La sécheresse a réduit les récoltes.'],
    ['placeholder', 'Que signifie API ?', 'N/A'],
    ['no-question', 'La mitochondrie produit l\'énergie de la cellule.', 'Elle fabrique l\'ATP par respiration.'],
  ];
  for (const [code, front, back] of fautives) {
    const issues = auditCard({ front, back });
    assert(`« ${front.slice(0, 38)}… » → ${code}`, issues.includes(code), `obtenu : ${issues.join(', ') || 'rien'}`);
  }

  console.log('\n— 3. Gravité : ce qui condamne la carte et ce qui ne la condamne pas —');
  assert('un verso qui reprend la question condamne la carte', isBlocking(['echo']));
  assert('une question sans contexte condamne la carte', isBlocking(['context']));
  assert('un recto affirmatif ne condamne pas la carte', !isBlocking(['no-question']));
  assert('un verso vide est une non-réponse', answerAddsNothing('Qu\'est-ce que le PIB ?', ''));

  console.log('\n— 4. Lexique : le recto est un terme, pas une question —');
  assert(
    'terme nu accepté en mode liste',
    auditCard({ front: 'Antigène', back: 'Molécule reconnue comme étrangère par le système immunitaire.' }, { entryList: true }).length === 0
  );
  assert(
    'affirmation acceptée en mode liste',
    !auditCard({ front: 'Le complément est un ensemble de protéines du sang.', back: 'Il détruit les membranes bactériennes.' }, { entryList: true }).includes('no-question')
  );

  console.log('\n— 5. Réparation : la carte fautive revient corrigée —');
  handler = (prompt) => {
    if (!prompt.includes('defauts')) throw new Error(`Prompt inattendu : ${prompt.slice(0, 60)}`);
    return { cards: [{ id: 1, front: 'Quel est le rôle de la mitochondrie ?', back: 'Produire l\'ATP de la cellule par respiration cellulaire.' }] };
  };
  let seen = new Set();
  let prepared = await generation.prepareCards(
    [
      { front: 'Quel est le rôle de la mitochondrie ?', back: 'Le rôle de la mitochondrie est un rôle mitochondrial.' },
      { front: 'Où se déroule la glycolyse ?', back: 'Dans le cytoplasme de la cellule.' },
    ],
    seen,
    'français'
  );
  assert('les deux cartes sont conservées', prepared.accepted.length === 2, JSON.stringify(prepared));
  assert('la carte fautive est comptée comme réparée', prepared.repaired === 1, JSON.stringify(prepared));
  assert(
    'le verso réparé répond à la question',
    prepared.accepted.some((c) => c.back.includes('ATP')),
    JSON.stringify(prepared.accepted)
  );
  assert('la carte saine est intacte', prepared.accepted.some((c) => c.back === 'Dans le cytoplasme de la cellule.'));

  console.log('\n— 6. Carte irréparable : écartée, et sa question redevient libre —');
  handler = () => ({ cards: [{ id: 1, drop: true }] });
  seen = new Set();
  prepared = await generation.prepareCards(
    [{ front: 'Que signifie cet acronyme ?', back: 'N/A' }, { front: 'Que mesure le PIB ?', back: 'La production intérieure annuelle d\'un pays.' }],
    seen,
    'français'
  );
  assert('la carte sans réponse est écartée', prepared.accepted.length === 1, JSON.stringify(prepared.accepted));
  assert('l\'abandon est compté', prepared.dropped === 1, JSON.stringify(prepared));
  assert(
    'la question écartée ne bloque plus la collection',
    !seen.has(generation.frontKey('Que signifie cet acronyme ?'))
  );

  console.log('\n— 7. Réparation impossible : le défaut bénin ne fait pas perdre la carte —');
  handler = () => { throw new Error('service indisponible'); };
  seen = new Set();
  prepared = await generation.prepareCards(
    [{ front: 'La mitochondrie produit l\'énergie de la cellule.', back: 'Elle fabrique l\'ATP par respiration cellulaire.' }],
    seen,
    'français'
  );
  assert('carte au recto affirmatif conservée', prepared.accepted.length === 1, JSON.stringify(prepared));
  assert('aucun abandon', prepared.dropped === 0, JSON.stringify(prepared));

  console.log('\n— 8. Appariement par identifiant : le décalage silencieux est impossible —');
  // Le piège : le modèle renvoie les cartes dans un autre ordre. Apparié par
  // position, le recto de l'une recevrait le verso de l'autre.
  handler = (prompt) => {
    if (!prompt.includes('dépassent la place')) throw new Error('Prompt inattendu');
    return {
      cards: [
        { id: 2, front: 'Que mesure le PIB ?', back: 'La production intérieure annuelle.' },
        { id: 1, front: 'Qu\'est-ce que l\'inflation ?', back: 'La hausse générale des prix.' },
      ],
    };
  };
  seen = new Set();
  prepared = await generation.prepareCards(
    [
      { front: `Qu'est-ce que l'inflation ? ${long(FRONT_MAX_CHARS)}`, back: `Hausse des prix. ${long(BACK_MAX_CHARS)}` },
      { front: `Que mesure le PIB ? ${long(FRONT_MAX_CHARS)}`, back: `Production du pays. ${long(BACK_MAX_CHARS)}` },
    ],
    seen,
    'français',
    { audit: false }
  );
  const inflation = prepared.accepted.find((c) => c.front.includes('inflation'));
  const pib = prepared.accepted.find((c) => c.front.includes('PIB'));
  assert('la carte inflation garde SON verso', inflation?.back.includes('prix'), JSON.stringify(prepared.accepted));
  assert('la carte PIB garde SON verso', pib?.back.includes('production'), JSON.stringify(prepared.accepted));

  console.log('\n— 9. Carte omise par le modèle : les autres ne glissent pas —');
  handler = () => ({ cards: [{ id: 2, front: 'Que mesure le PIB ?', back: 'La production intérieure annuelle.' }] });
  seen = new Set();
  prepared = await generation.prepareCards(
    [
      { front: `Qu'est-ce que l'inflation ? ${long(FRONT_MAX_CHARS)}`, back: `Hausse générale des prix. ${long(BACK_MAX_CHARS)}` },
      { front: `Que mesure le PIB ? ${long(FRONT_MAX_CHARS)}`, back: `Production du pays. ${long(BACK_MAX_CHARS)}` },
    ],
    seen,
    'français',
    { audit: false }
  );
  const inflation2 = prepared.accepted.find((c) => c.front.includes('inflation'));
  assert(
    'la carte non reformulée garde son propre verso',
    inflation2 && inflation2.back.startsWith('Hausse générale des prix'),
    JSON.stringify(prepared.accepted)
  );

  console.log('\n— 10. Sans identifiant mais au bon compte : l\'ordre reste exploitable —');
  handler = () => ({
    cards: [
      { front: 'Qu\'est-ce que l\'inflation ?', back: 'La hausse générale des prix.' },
      { front: 'Que mesure le PIB ?', back: 'La production intérieure annuelle.' },
    ],
  });
  seen = new Set();
  prepared = await generation.prepareCards(
    [
      { front: `Qu'est-ce que l'inflation ? ${long(FRONT_MAX_CHARS)}`, back: `Hausse. ${long(BACK_MAX_CHARS)}` },
      { front: `Que mesure le PIB ? ${long(FRONT_MAX_CHARS)}`, back: `Production. ${long(BACK_MAX_CHARS)}` },
    ],
    seen,
    'français',
    { audit: false }
  );
  assert('les deux reformulations sont retenues', prepared.shortened === 2, JSON.stringify(prepared));
  assert(
    'appariement positionnel correct',
    prepared.accepted.find((c) => c.front.includes('inflation'))?.back.includes('prix'),
    JSON.stringify(prepared.accepted)
  );

  console.log('\n— 11. Audit coupé : aucun appel de réparation —');
  const before = prompts.length;
  handler = () => { throw new Error('la réparation ne devrait pas être appelée'); };
  seen = new Set();
  prepared = await generation.prepareCards(
    [{ front: 'Qu\'est-ce que l\'inflation ?', back: 'L\'inflation est l\'inflation.' }],
    seen,
    'français',
    { audit: false }
  );
  assert('la carte fautive passe telle quelle', prepared.accepted.length === 1);
  assert('aucun appel au modèle', prompts.length === before, `${prompts.length - before} appel(s)`);

  console.log(failures === 0 ? '\nTout est bon.' : `\n${failures} vérification(s) en échec.`);
  process.exitCode = failures === 0 ? 0 : 1;
})();

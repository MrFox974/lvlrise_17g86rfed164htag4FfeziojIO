#!/usr/bin/env node
/**
 * Vérifie le générateur de collection sans appeler OpenAI : le client est
 * remplacé par un modèle simulé qui produit exprès les cas pénibles du monde
 * réel (cartes trop longues, doublons, groupe en échec, sortie tronquée).
 *
 * Usage : node scripts/test-flashcard-generation.js
 */
const path = require('path');
const Module = require('module');

// ── Modèle simulé ────────────────────────────────────────────────────────────
let scenario = 'nominal';
const calls = [];

class FakeOpenAI {
  constructor() {
    this.chat = { completions: { create: (params) => this.respond(params) } };
  }

  async respond(params) {
    const prompt = params.messages[1].content;
    calls.push(prompt.slice(0, 40));

    if (prompt.includes('Conçois le plan')) {
      return json({
        name: 'Révolution française',
        description: 'Les repères essentiels de 1789 à 1799.',
        // Somme volontairement fausse (9 au lieu de 12) : le service doit la renormaliser.
        groups: [
          { title: 'Les causes', focus: 'Crise financière et sociale', cardCount: 5 },
          { title: 'Les grandes dates', focus: 'Chronologie 1789-1799', cardCount: 4 },
        ],
      });
    }

    if (prompt.includes('Reformule-les')) {
      // Le raccourcissement réussit pour la première carte, échoue pour la seconde.
      return json({
        cards: [
          { front: 'Que se passe-t-il le 14 juillet 1789 ?', back: 'La prise de la Bastille.' },
          {
            front: 'Question encore beaucoup trop longue '.repeat(4),
            back: 'Réponse toujours interminable qui ne rentre pas. '.repeat(6),
          },
        ],
      });
    }

    if (prompt.includes('Les causes')) {
      if (scenario === 'groupe-en-echec') {
        const err = new Error('service indisponible');
        err.status = 503;
        throw err;
      }
      return json({
        cards: [
          { front: 'Quelle crise financière précède 1789 ?', back: 'Le déficit de l\'État.' },
          // Doublon exact du précédent (ponctuation différente).
          { front: 'quelle crise financiere precede 1789', back: 'Le déficit.' },
          // Trop longue : doit passer par la reformulation.
          {
            front: 'Peux-tu expliquer en détail ce qu\'il se passe le 14 juillet 1789 à Paris et pourquoi cet événement précis est devenu le symbole de la Révolution française ?',
            back: 'La prise de la Bastille, forteresse royale et prison d\'État, par les Parisiens insurgés.',
          },
          // Trop longue ET non réparable : doit être coupée proprement.
          {
            front: 'Deuxième question excessivement longue '.repeat(4),
            back: 'Première phrase courte. Puis une seconde phrase nettement plus longue qui fait déborder la carte au-delà de toute limite raisonnable et continue encore.',
          },
          // Vide : doit être ignorée.
          { front: '', back: '' },
        ],
      });
    }

    if (prompt.includes('Les grandes dates')) {
      if (scenario === 'sortie-tronquee') {
        return { choices: [{ finish_reason: 'length', message: { content: '{"cards":[{"front":"Q' } }] };
      }
      return json({
        cards: [
          { front: 'Quand la Bastille est-elle prise ?', back: '14 juillet 1789.' },
          { front: 'Quand la royauté est-elle abolie ?', back: '21 septembre 1792.' },
        ],
      });
    }

    throw new Error('Prompt inattendu dans le test');
  }
}

function json(obj) {
  return { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(obj) } }] };
}

// Interception du require('openai') avant le chargement du service.
const originalLoad = Module._load;
Module._load = function patched(request, parent, isMain) {
  if (request === 'openai') {
    const stub = FakeOpenAI;
    stub.default = FakeOpenAI;
    return stub;
  }
  return originalLoad.call(this, request, parent, isMain);
};

process.env.OPENAI_API_KEY = 'test-key';
const service = require(path.join(__dirname, '..', 'services', 'flashcard-generation.service'));
const limits = require(path.join(__dirname, '..', 'utils', 'flashcard-limits'));

// ── Vérifications ────────────────────────────────────────────────────────────
let failures = 0;

function assert(label, condition, detail = '') {
  if (!condition) failures += 1;
  console.log(`${condition ? '✓' : '✗'} ${label}${condition ? '' : `\n   ${detail}`}`);
}

(async () => {
  console.log('\n— Extraction JSON robuste —');
  assert('objet nu', service.parseJsonBlock('{"a":1}').a === 1);
  assert('entouré de texte', service.parseJsonBlock('Voici :\n{"a":2}\nvoilà.').a === 2);
  assert('bloc ```json', service.parseJsonBlock('```json\n{"a":3}\n```').a === 3);
  assert(
    'accolade dans une chaîne',
    service.parseJsonBlock('{"a":"} piège {","b":4}').b === 4
  );
  let threw = false;
  try { service.parseJsonBlock('{"a":'); } catch { threw = true; }
  assert('JSON tronqué → erreur explicite', threw);

  console.log('\n— Coupe intelligente (fitText) —');
  const long = 'Première phrase courte. Seconde phrase beaucoup plus longue qui dépasse la limite fixée.';
  const cut = limits.fitText(long, 40);
  assert(`coupe à la fin de phrase (${cut.length} car.)`, cut === 'Première phrase courte.', cut);
  const noSentence = 'un texte sans aucune ponctuation terminale qui doit être coupé au mot';
  const cut2 = limits.fitText(noSentence, 30);
  assert(`coupe au mot entier (${cut2.length} car.)`, cut2.length <= 30 && cut2.endsWith('…'), cut2);
  assert('texte court inchangé', limits.fitText('Court.', 50) === 'Court.');

  console.log('\n— Génération nominale —');
  scenario = 'nominal';
  const result = await service.generateCollection({ subject: 'La Révolution française', cardCount: 12 });

  console.log(`   collection : « ${result.name} » — ${result.stats.generated} cartes en ${result.groups.length} groupes`);
  const allCards = result.groups.flatMap((g) => g.cards);

  const overflowing = allCards.filter(
    (c) => c.front.length > limits.FRONT_MAX_CHARS || c.back.length > limits.BACK_MAX_CHARS
  );
  assert(
    `AUCUNE carte ne déborde (${allCards.length} cartes vérifiées)`,
    overflowing.length === 0,
    overflowing.map((c) => `${c.front.length}/${c.back.length} → ${c.front.slice(0, 50)}`).join('\n   ')
  );
  assert('doublon éliminé', result.stats.duplicates === 1, `duplicates=${result.stats.duplicates}`);
  assert('carte vide ignorée', allCards.every((c) => c.front && c.back));
  assert('carte reformulée comptée', result.stats.shortened === 1, `shortened=${result.stats.shortened}`);
  assert('carte coupée en dernier recours comptée', result.stats.truncated === 1, `truncated=${result.stats.truncated}`);
  assert(
    'reformulation réussie conservée telle quelle',
    allCards.some((c) => c.back === 'La prise de la Bastille.')
  );
  // La reformulation ayant renvoyé un texte encore trop long, c'est CE texte qui
  // est coupé (et non l'original) : on vérifie l'invariant, pas une chaîne exacte.
  const rescued = allCards.filter((c) => c.back.endsWith('.') || c.back.endsWith('…'));
  assert(
    'coupe de secours terminée proprement',
    rescued.length === allCards.length,
    allCards.filter((c) => !rescued.includes(c)).map((c) => c.back).join(' | ')
  );
  assert('pas de saut de ligne dans les cartes', allCards.every((c) => !/\n/.test(c.front + c.back)));

  console.log('\n— Un groupe en échec ne perd pas le reste —');
  scenario = 'groupe-en-echec';
  const partial = await service.generateCollection({ subject: 'La Révolution française', cardCount: 12 });
  assert('collection produite malgré l\'échec', partial.stats.generated > 0, JSON.stringify(partial.stats));
  assert('groupe en échec signalé', partial.stats.failedGroups.length === 1, JSON.stringify(partial.stats.failedGroups));

  console.log('\n— Sortie tronquée par la limite du modèle —');
  scenario = 'sortie-tronquee';
  const truncated = await service.generateCollection({ subject: 'La Révolution française', cardCount: 12 });
  assert(
    'groupe tronqué signalé, cartes valides gardées',
    truncated.stats.failedGroups.length === 1 && truncated.stats.generated > 0,
    JSON.stringify(truncated.stats)
  );

  console.log('\n— Bornes du nombre de cartes —');
  assert('plancher', service.MIN_CARDS === 5);
  assert('plafond', service.MAX_CARDS === 100);

  console.log(`\n${failures === 0 ? 'Tout est bon.' : `${failures} vérification(s) en échec.`}\n`);
  process.exitCode = failures === 0 ? 0 : 1;
})().catch((e) => {
  console.error('Erreur du script :', e);
  process.exitCode = 1;
});

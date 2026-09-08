#!/usr/bin/env node
/**
 * Vérifie la génération d'une carte à l'unité sans appeler OpenAI : le client
 * est remplacé par un modèle simulé, et l'on contrôle d'une part ce qui lui est
 * demandé (niveau, documents, règle de nuance), d'autre part ce que le service
 * fait de sa réponse (mise aux dimensions de la carte, ordre des propositions).
 *
 * Portée : ce script prouve le cheminement des consignes et le traitement de la
 * réponse. Il ne prouve pas le comportement du modèle lui-même.
 *
 * Usage : node scripts/test-single-card-generation.js
 */
const path = require('path');
const Module = require('module');

let reply = { proposals: [] };
let shortenReply = null;
const prompts = [];

class FakeOpenAI {
  constructor() {
    this.chat = { completions: { create: (params) => this.respond(params) } };
  }

  async respond(params) {
    const prompt = params.messages[1].content;
    prompts.push(prompt);
    if (prompt.includes('Reformule-les')) {
      return json(shortenReply || { cards: [] });
    }
    return json(reply);
  }
}

function json(o) {
  return { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(o) } }] };
}

const originalLoad = Module._load;
Module._load = function patched(request, parent, isMain) {
  if (request === 'openai') { const s = FakeOpenAI; s.default = FakeOpenAI; return s; }
  return originalLoad.call(this, request, parent, isMain);
};

process.env.OPENAI_API_KEY = 'test-key';
const B = path.join(__dirname, '..');
const service = require(path.join(B, 'services', 'flashcard-single-card.service'));
const { FRONT_MAX_CHARS, BACK_MAX_CHARS } = require(path.join(B, 'utils', 'flashcard-limits'));

let failures = 0;
function assert(label, cond, detail = '') {
  if (!cond) failures += 1;
  console.log(`${cond ? '✓' : '✗'} ${label}${cond ? '' : `\n   ${detail}`}`);
}

async function generate(options) {
  prompts.length = 0;
  return service.generateCardProposals({
    query: 'carthésien',
    level: 'intermediaire',
    language: 'français',
    ...options,
  });
}

(async () => {
  console.log('\n— Ce qui est demandé au modèle —');
  reply = {
    intent: 'terme',
    correction: 'cartésien',
    notice: null,
    proposals: [{ term: 'cartésien', front: 'cartésien', back: 'Qui procède avec méthode et rigueur.', hint: null }],
  };

  let r = await generate({ level: 'debutant' });
  assert('niveau débutant : la définition seule', /DÉBUTANT/.test(prompts[0]) && /définition seule/.test(prompts[0]), prompts[0].slice(0, 200));
  assert('débutant : ni exemple ni référence demandés', !/INTERMÉDIAIRE|AVANCÉ/.test(prompts[0]));

  await generate({ level: 'intermediaire' });
  assert('niveau intermédiaire : exemple et synonymes', /Ex\. :/.test(prompts[0]) && /Syn\. :/.test(prompts[0]));
  assert('intermédiaire : pas de référence exigée', !/Réf\. :/.test(prompts[0]));

  await generate({ level: 'avance' });
  assert('niveau avancé : référence en plus', /Réf\. :/.test(prompts[0]) && /Ex\. :/.test(prompts[0]) && /Syn\. :/.test(prompts[0]));

  assert('les trois cas d\'usage sont décrits', /« terme »/.test(prompts[0]) && /« recherche »/.test(prompts[0]) && /« explication »/.test(prompts[0]));
  assert('les limites d\'affichage sont annoncées', prompts[0].includes(String(FRONT_MAX_CHARS)) && prompts[0].includes(String(BACK_MAX_CHARS)));

  console.log('\n— Documents joints —');
  await generate({ sourceText: 'La lucidité est la qualité de qui voit clair.' });
  assert('le texte des documents est transmis', /voit clair/.test(prompts[0]));
  assert('les documents font foi', /font foi/.test(prompts[0]));
  assert(
    'la nuance est conditionnée à une erreur, pas systématique',
    /QUE si les documents comportent une erreur/.test(prompts[0]),
    prompts[0].slice(-600)
  );
  assert('une description d\'image est traitée comme telle', /description d'image/.test(prompts[0]));

  await generate({});
  assert('sans document, aucune consigne de fidélité inutile', !/font foi/.test(prompts[0]));

  console.log('\n— La correction d\'orthographe remonte —');
  assert('correction conservée', r.correction === 'cartésien', String(r.correction));
  assert('intention reconnue', r.intent === 'terme', r.intent);
  assert('« null » textuel neutralisé', r.notice === null, String(r.notice));

  console.log('\n— Recherche d\'un mot : plusieurs propositions, dans l\'ordre —');
  reply = {
    intent: 'recherche',
    correction: null,
    notice: null,
    proposals: [
      { term: 'cartésien', front: 'cartésien', back: 'Qui raisonne avec méthode.', hint: 'sens courant' },
      { term: 'rationnel', front: 'rationnel', back: 'Qui se fonde sur la raison.', hint: null },
      { term: 'lucide', front: 'lucide', back: 'Qui voit les choses telles qu\'elles sont.', hint: null },
    ],
  };
  r = await generate({ query: 'quelqu\'un de très lucide et rationnel' });
  assert('les trois propositions sont rendues', r.proposals.length === 3, String(r.proposals.length));
  assert(
    'l\'ordre du modèle est conservé',
    r.proposals.map((p) => p.term).join(',') === 'cartésien,rationnel,lucide',
    r.proposals.map((p) => p.term).join(',')
  );
  assert('l\'indice de choix est conservé', r.proposals[0].hint === 'sens courant', String(r.proposals[0].hint));

  console.log('\n— Plus de propositions que raisonnable —');
  reply = {
    intent: 'recherche',
    proposals: Array.from({ length: 12 }, (_, i) => ({
      term: `terme ${i}`,
      front: `terme ${i}`,
      back: `Définition numéro ${i} du terme.`,
    })),
  };
  r = await generate({});
  assert(
    'la liste est bornée',
    r.proposals.length === service.MAX_PROPOSALS,
    `${r.proposals.length} proposition(s)`
  );

  console.log('\n— Une carte trop longue est reformulée —');
  const longBack = `${'Une définition interminable qui déborde de la carte. '.repeat(12)}`;
  reply = {
    intent: 'terme',
    proposals: [{ term: 'cartésien', front: 'cartésien', back: longBack }],
  };
  shortenReply = { cards: [{ front: 'cartésien', back: 'Qui procède avec méthode et rigueur.' }] };
  r = await generate({});
  assert('la reformulation a été demandée', prompts.some((p) => /Reformule-les/.test(p)));
  assert('le texte reformulé est retenu', r.proposals[0].back === 'Qui procède avec méthode et rigueur.', r.proposals[0].back);

  console.log('\n— Reformulation infructueuse : la carte est coupée, pas rejetée —');
  shortenReply = { cards: [] };
  r = await generate({});
  assert('le verso tient dans la carte', r.proposals[0].back.length <= BACK_MAX_CHARS, `${r.proposals[0].back.length} caractères`);
  // La coupe tombe sur une fin de phrase, ou à défaut sur un mot entier suivi
  // de points de suspension : jamais au milieu d'un mot.
  assert('la coupe respecte la phrase', /[.!?…]$/.test(r.proposals[0].back), r.proposals[0].back.slice(-40));

  console.log('\n— Réponse inexploitable —');
  reply = { intent: 'terme', proposals: [] };
  shortenReply = null;
  let error = null;
  try { await generate({}); } catch (e) { error = e.message; }
  assert('une réponse vide devient une erreur explicite', /Aucune carte/.test(error || ''), String(error));

  console.log(`\n${failures === 0 ? 'Tout est bon.' : `${failures} vérification(s) en échec.`}\n`);
  process.exitCode = failures === 0 ? 0 : 1;
})().catch((e) => { console.error('Erreur du script :', e); process.exitCode = 1; });

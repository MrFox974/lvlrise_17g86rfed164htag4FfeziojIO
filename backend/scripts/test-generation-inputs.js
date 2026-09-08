#!/usr/bin/env node
/**
 * Vérifie ce qui parvient réellement au modèle : niveau demandé, documents
 * joints, consignes de fidélité. Le modèle est simulé et ses prompts capturés.
 *
 * Portée : ce script prouve le cheminement et le contenu des consignes. Il ne
 * prouve pas le comportement de GPT-4o lui-même, qui ne peut se vérifier que
 * sur un appel réel.
 *
 * Usage : node scripts/test-generation-inputs.js
 */
const path = require('path');
const Module = require('module');

const prompts = [];

class FakeOpenAI {
  constructor() {
    this.chat = { completions: { create: (p) => this.respond(p) } };
  }
  async respond(params) {
    const prompt = params.messages[1].content;
    const text = typeof prompt === 'string' ? prompt : JSON.stringify(prompt);
    prompts.push(text);
    if (text.includes('Conçois le plan')) {
      return json({
        name: 'Collection',
        description: 'Description.',
        groups: [{ title: 'Groupe A', focus: 'Sujet', cardCount: 4 }],
      });
    }
    return json({ cards: [{ front: 'Question de test valable ?', back: 'Réponse de test.' }] });
  }
}
function json(o) { return { choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(o) } }] }; }

const originalLoad = Module._load;
Module._load = function patched(request, parent, isMain) {
  if (request === 'openai') { const s = FakeOpenAI; s.default = FakeOpenAI; return s; }
  return originalLoad.call(this, request, parent, isMain);
};

process.env.OPENAI_API_KEY = 'test-key';
const B = path.join(__dirname, '..');
const flashcards = require(path.join(B, 'services', 'flashcard-generation.service'));
const markdown = require(path.join(B, 'services', 'markdown-generation.service'));

let failures = 0;
function assert(label, cond, detail = '') {
  if (!cond) failures += 1;
  console.log(`${cond ? '✓' : '✗'} ${label}${cond ? '' : `\n   ${detail}`}`);
}

const GLOSSAIRE = `Lexique d'immunologie
Antigène : molécule reconnue comme étrangère par le système immunitaire.
Anticorps : protéine produite par les lymphocytes B pour neutraliser un antigène.
Lymphocyte T : cellule immunitaire qui détruit les cellules infectées.
Phagocytose : ingestion d'un pathogène par une cellule immunitaire.`;

(async () => {
  console.log('\n— 1. Le niveau atteint les prompts —');
  const attendus = {
    debutant: 'notions de base',
    intermediaire: 'mécanismes, relations entre notions',
    avance: 'subtilités, exceptions, cas limites',
  };

  for (const [niveau, marqueur] of Object.entries(attendus)) {
    prompts.length = 0;
    await flashcards.generateCollection({ subject: 'La photosynthèse', cardCount: 10, level: niveau });
    const plan = prompts.find((p) => p.includes('Conçois le plan'));
    const cartes = prompts.find((p) => p.includes('Produis EXACTEMENT'));
    assert(`« ${niveau} » présent dans le plan`, plan.includes(marqueur), plan.slice(0, 160));
    assert(`« ${niveau} » présent à la rédaction`, cartes.includes(marqueur), cartes.slice(0, 160));
    // Les niveaux ne doivent pas fuiter les uns dans les autres.
    const autres = Object.entries(attendus).filter(([k]) => k !== niveau).map(([, v]) => v);
    assert(
      `aucun autre niveau dans le prompt de « ${niveau} »`,
      autres.every((a) => !cartes.includes(a))
    );
  }

  prompts.length = 0;
  await flashcards.generateCollection({ subject: 'Test', cardCount: 10, level: 'inconnu' });
  assert(
    'niveau inconnu → repli sur intermédiaire',
    prompts.find((p) => p.includes('Produis EXACTEMENT')).includes(attendus.intermediaire)
  );

  console.log('\n— 2. Liste de mots : consignes de fidélité —');
  prompts.length = 0;
  await flashcards.generateCollection({
    subject: 'Fais des cartes sur ce lexique',
    cardCount: 10,
    sourceText: GLOSSAIRE,
  });
  const planSrc = prompts.find((p) => p.includes('Conçois le plan'));
  const cartesSrc = prompts.find((p) => p.includes('Produis EXACTEMENT'));

  assert('le lexique est transmis au plan', planSrc.includes('Antigène'), planSrc.slice(0, 200));
  assert('le lexique est transmis à la rédaction', cartesSrc.includes('Phagocytose'));
  assert('bloc de consignes liste présent', cartesSrc.includes('SONT UNE LISTE D\'ENTRÉES'));
  assert('une carte par entrée demandée', cartesSrc.includes('Une carte par entrée'));
  assert(
    'consigne de non-variation pour les listes',
    cartesSrc.includes('NE VARIE PAS les formulations')
  );
  assert('interdiction de scinder une entrée', cartesSrc.includes('Ne scinde JAMAIS une entrée'));
  assert(
    'recto = le terme seul, pas « Que signifie X ? »',
    cartesSrc.includes('Pas « Que signifie X ? »')
  );
  assert('interdiction d\'inventer', cartesSrc.includes('N\'invente rien'));
  assert('le plan prévoit une carte par entrée', planSrc.includes('une carte par\n        entrée') || planSrc.includes('une carte par entrée'));

  console.log('\n— 2 bis. Détection liste vs texte suivi (décidée par le code) —');

  // Texte réel de la photo envoyée par l'utilisateur : de la prose dense.
  const PROSE = `à équidistance devant les deux seaux, pendant qu'une autre personne tient
le cheval en face afin qu'il puisse observer la scène. Ensuite, il faut pointer
avec l'index le seau contenant la nourriture en tendant le bras vers celui-ci,
sans le toucher pour autant. Il suffit alors de regarder si le cheval se dirige
spontanément vers le seau indiqué. L'idéal est de répéter une petite dizaine
de fois l'exercice, en alternant la place des seaux, afin de voir si le cheval suit
le geste à chaque fois. On appelle « compétences de haut niveau » les capacités
cognitives complexes, historiquement réservées aux humains, voire aux grands singes.`;

  const TABLEAU = `Antigène\tmolécule reconnue comme étrangère
Anticorps\tprotéine produite par les lymphocytes B
Lymphocyte T\tcellule qui détruit les cellules infectées
Phagocytose\tingestion d'un pathogène par une cellule`;

  const PROSE_AVEC_DEUX_POINTS = `Le principe est simple : le cheval doit choisir.
On observe alors son comportement, et voici ce qui se passe généralement dans ce
type d'expérience menée sur des animaux de ferme depuis une quinzaine d'années.
La conclusion des chercheurs est nette : les barrières tombent une à une.`;

  async function reglesPour(source) {
    prompts.length = 0;
    await flashcards.generateCollection({ subject: 'Sujet', cardCount: 10, sourceText: source });
    return prompts.find((p) => p.includes('Produis EXACTEMENT'));
  }

  let p2 = await reglesPour(GLOSSAIRE);
  assert('lexique « terme : définition » → règles de liste',
    p2.includes('SONT UNE LISTE D\'ENTRÉES'), p2.slice(-400));

  p2 = await reglesPour(TABLEAU);
  assert('tableau à tabulations → règles de liste',
    p2.includes('SONT UNE LISTE D\'ENTRÉES'), p2.slice(-400));

  p2 = await reglesPour(PROSE);
  assert('extrait de livre → règles de texte suivi',
    !p2.includes('SONT UNE LISTE D\'ENTRÉES') && p2.includes('FIDÉLITÉ AUX DOCUMENTS'),
    p2.slice(-400));
  assert('texte suivi : variété conservée', p2.includes('Varie les formulations'));

  p2 = await reglesPour(PROSE_AVEC_DEUX_POINTS);
  assert('prose ponctuée de deux-points non prise pour un lexique',
    !p2.includes('SONT UNE LISTE D\'ENTRÉES'), p2.slice(-400));

  console.log('\n— 3. Sans document : la consigne de variété reste la règle —');
  prompts.length = 0;
  await flashcards.generateCollection({ subject: 'La photosynthèse', cardCount: 10 });
  const cartesSansSrc = prompts.find((p) => p.includes('Produis EXACTEMENT'));
  assert('aucun bloc lié aux documents', !cartesSansSrc.includes('FIDÉLITÉ AUX DOCUMENTS') && !cartesSansSrc.includes('LISTE D\'ENTRÉES'));
  assert('variété demandée', cartesSansSrc.includes('Varie les formulations'));
  assert(
    'aucune mention de documents fournis',
    !cartesSansSrc.includes('DOCUMENTS FOURNIS PAR L\'UTILISATEUR')
  );

  console.log('\n— 4. Bibliothèque : les documents atteignent les trois étapes —');
  prompts.length = 0;
  await markdown.generateStructure('Un parcours sur l\'immunologie', 'knowledge', GLOSSAIRE);
  const structure = prompts[prompts.length - 1];
  assert('structure : documents transmis', structure.includes('Antigène'), structure.slice(0, 200));
  assert(
    'structure : les documents font autorité',
    structure.includes('DOCUMENTS FOURNIS PAR L\'UTILISATEUR')
  );

  const struct = {
    name: 'Immunologie',
    chapters: [{ title: 'Chap 1. Bases', sections: [{ title: 'Part 1. Antigènes' }] }],
  };
  prompts.length = 0;
  await markdown.generateChapterContent('Immunologie', struct, 0, [], 'knowledge', GLOSSAIRE);
  assert('chapitre : documents transmis', prompts[0].includes('Antigène'), prompts[0].slice(0, 200));

  prompts.length = 0;
  await markdown.generateSectionContent(
    'Immunologie', struct, 'Chap 1. Bases', 'contenu', 'Part 1. Antigènes', [], 'knowledge', GLOSSAIRE
  );
  assert('sous-chapitre : documents transmis', prompts[0].includes('Antigène'), prompts[0].slice(0, 200));

  prompts.length = 0;
  await markdown.generateStructure('Un parcours sur l\'immunologie', 'knowledge');
  assert(
    'Bibliothèque sans document : aucun bloc source',
    !prompts[prompts.length - 1].includes('DOCUMENTS FOURNIS PAR L\'UTILISATEUR')
  );

  console.log(`\n${failures === 0 ? 'Tout est bon.' : `${failures} vérification(s) en échec.`}\n`);
  // Sortie explicite : withTimeoutAndRetry laisse des minuteurs de plusieurs
  // minutes armés, qui maintiendraient le processus en vie inutilement.
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => { console.error('Erreur du script :', e); process.exit(1); });

#!/usr/bin/env node
/**
 * Vérifie la lecture des images de documents, sans appeler OpenAI.
 *
 * Le cas de référence est un échec réel : la photo d'une page de livre prise
 * de côté avait produit 71 caractères — une description de l'image au lieu de
 * sa transcription. Le générateur avait alors comblé le vide en inventant des
 * cartes hors sujet. Ces vérifications garantissent qu'un tel résultat est
 * désormais refusé plutôt que transmis.
 *
 * Usage : node scripts/test-upload-extraction.js
 */
const path = require('path');
const Module = require('module');

let visionReplies = [];
let visionCalls = [];

class FakeOpenAI {
  constructor() {
    this.chat = { completions: { create: (p) => this.respond(p) } };
  }
  async respond(params) {
    const userContent = params.messages[1].content;
    visionCalls.push(userContent[0].text);
    const reply = visionReplies.shift() ?? '';
    return { choices: [{ finish_reason: 'stop', message: { content: reply } }] };
  }
}

const originalLoad = Module._load;
Module._load = function patched(request, parent, isMain) {
  if (request === 'openai') { const s = FakeOpenAI; s.default = FakeOpenAI; return s; }
  return originalLoad.call(this, request, parent, isMain);
};

process.env.OPENAI_API_KEY = 'test-key';
process.env.UPLOADS_BUCKET = 'bucket-de-test';

const uploadService = require(path.join(__dirname, '..', 'services', 'upload.service'));

let failures = 0;
function assert(label, cond, detail = '') {
  if (!cond) failures += 1;
  console.log(`${cond ? '✓' : '✗'} ${label}${cond ? '' : `\n   ${detail}`}`);
}

async function extract(replies) {
  visionReplies = [...replies];
  visionCalls = [];
  try {
    const read = await uploadService.extractFromImage(
      Buffer.from('image-factice'),
      'image/jpeg',
      'photo.jpg'
    );
    return { text: read.text, kind: read.kind, error: null, calls: visionCalls.length };
  } catch (error) {
    return { text: null, kind: null, error: error.message, calls: visionCalls.length };
  }
}

const PAGE = 'Ils nous attribuent des états mentaux et des intentions. On appelle « compétences '
  + 'de haut niveau » les capacités cognitives complexes, historiquement réservées aux humains. '
  + 'C\'est ce qui pour beaucoup était censé établir une limite entre l\'humain et l\'animal. Or, '
  + 'les barrières sont en train de tomber. Ces compétences commencent à être investiguées chez '
  + 'les animaux de ferme, dont le cheval.';

/** Description d'objet renvoyée par la passe de description, assez fournie. */
const OBJET = 'Un astrolabe planisphérique en laiton posé sur un socle de bois. Le disque '
  + 'gravé porte des graduations en degrés et un réseau d\'étoiles ; une alidade mobile '
  + 'traverse le centre. Aucune inscription lisible en dehors des chiffres.';

(async () => {
  console.log('\n— Le cas qui a échoué en production —');
  // 71 caractères décrivant l'image : exactement ce qui s'était produit.
  const description = 'L\'image montre une page de livre en français, pivotée de 90°.';
  // Les deux transcriptions échouent, puis la passe de description reconnaît un
  // document illisible : le dépôt est refusé, comme avant.
  let r = await extract([description, description, 'TEXTE_ILLISIBLE']);
  assert(
    'une description de l\'image est refusée',
    r.error !== null,
    `texte accepté : ${JSON.stringify(r.text)}`
  );
  assert('l\'erreur explique quoi faire', /photo|cadr|sens/i.test(r.error || ''), r.error);
  assert('une seconde tentative a été faite', r.calls === 3, `${r.calls} appel(s)`);
  assert(
    'la relance insiste sur l\'orientation',
    /pivot/i.test(visionCalls[1] || ''),
    visionCalls[1]
  );

  console.log('\n— La relance rattrape une première lecture ratée —');
  r = await extract([description, PAGE]);
  assert('le texte de la seconde tentative est retenu', r.text === PAGE, r.error || r.text);
  assert('retenu comme une transcription', r.kind === 'text', r.kind);

  console.log('\n— Transcription correcte du premier coup —');
  r = await extract([PAGE]);
  assert('acceptée', r.text === PAGE, r.error);
  assert('aucune relance inutile', r.calls === 1, `${r.calls} appel(s)`);

  console.log('\n— Photo d\'un objet, sans texte à lire —');
  // Le pendant du cas précédent : rien à transcrire, mais quelque chose à voir.
  // La description permet alors de définir ou d'expliquer ce qui est montré.
  r = await extract(['VIDE', 'VIDE', OBJET]);
  assert('la description est retenue', r.text === OBJET, r.error);
  assert('elle est annoncée comme telle', r.kind === 'description', r.kind);

  console.log('\n— Une description trop maigre ne sauve pas un dépôt —');
  r = await extract(['VIDE', 'VIDE', 'Une photo floue.']);
  assert('refusée', r.error !== null, r.text);

  console.log('\n— Autres réponses inexploitables —');
  r = await extract(['VIDE', 'VIDE', 'TEXTE_ILLISIBLE']);
  assert('réponse VIDE refusée', r.error !== null, r.text);
  r = await extract(['', '', '']);
  assert('réponse vide refusée', r.error !== null, r.text);
  r = await extract(['Je ne peux pas lire cette image.', 'Désolé, image illisible.', 'TEXTE_ILLISIBLE']);
  assert('refus du modèle intercepté', r.error !== null, r.text);
  r = await extract(['Le cheval mange.', 'Le cheval mange.', 'TEXTE_ILLISIBLE']);
  assert(
    'transcription trop courte refusée',
    r.error !== null && /caractères/.test(r.error),
    r.error || r.text
  );

  console.log('\n— Texte court commençant par une formule de description —');
  r = await extract(['Ce document présente une expérience menée sur des chevaux de ferme.',
    'Ce document présente une expérience menée sur des chevaux de ferme.',
    'TEXTE_ILLISIBLE']);
  assert('début en « ce document » refusé', r.error !== null, r.text);

  console.log('\n— Pas de faux positif sur une vraie transcription —');
  // Une page entière qui parle d'orientation, de documents ou d'images doit
  // passer : l'heuristique ne s'applique qu'aux réponses courtes et en tête.
  const longPage = `${PAGE} ${PAGE} L'orientation spatiale du cheval et l'image mentale qu'il `
    + 'se construit sont au cœur de ce document de recherche.';
  r = await extract([longPage]);
  assert(
    'page longue mentionnant « image » et « orientation » acceptée',
    r.text === longPage,
    r.error
  );
  assert('aucune relance déclenchée', r.calls === 1, `${r.calls} appel(s)`);

  console.log(`\n${failures === 0 ? 'Tout est bon.' : `${failures} vérification(s) en échec.`}\n`);
  process.exitCode = failures === 0 ? 0 : 1;
})().catch((e) => { console.error('Erreur du script :', e); process.exitCode = 1; });

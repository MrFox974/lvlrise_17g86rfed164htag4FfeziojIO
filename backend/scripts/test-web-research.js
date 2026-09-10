#!/usr/bin/env node
/**
 * Recherche web : ce qui est demandé au modèle, ce qui est retenu de sa réponse,
 * et ce qui arrive quand la recherche ne donne rien.
 *
 * Le fournisseur est simulé : ce script prouve le cheminement (consigne, choix
 * de l'outil, extraction du texte et des sources, cas dégradés). Il ne prouve
 * pas la qualité d'une vraie recherche, qui ne se vérifie que sur un appel réel.
 *
 * Usage : node scripts/test-web-research.js
 */
const path = require('path');
const Module = require('module');

const calls = [];
/** Réponse du fournisseur simulé, remplacée par chaque scénario. */
let handler = () => { throw new Error('Aucune réponse simulée'); };

class FakeOpenAI {
  constructor() {
    this.responses = { create: (params) => this.respond(params) };
  }
  async respond(params) {
    calls.push(params);
    return handler(params);
  }
}

const originalLoad = Module._load;
Module._load = function patched(request, parent, isMain) {
  if (request === 'openai') { const s = FakeOpenAI; s.default = FakeOpenAI; return s; }
  return originalLoad.call(this, request, parent, isMain);
};

process.env.OPENAI_API_KEY = 'test-key';
const B = path.join(__dirname, '..');
const research = require(path.join(B, 'services', 'web-research.service'));

let failures = 0;
function assert(label, cond, detail = '') {
  if (!cond) failures += 1;
  console.log(`${cond ? '✓' : '✗'} ${label}${cond ? '' : `\n   ${detail}`}`);
}

/** Réponse du fournisseur : un texte, et les pages qu'il dit avoir citées. */
function answer(text, urls = []) {
  return {
    output: [
      {
        content: [
          {
            type: 'output_text',
            text,
            annotations: urls.map((url) => ({ type: 'url_citation', url, title: `Titre de ${url}` })),
          },
        ],
      },
    ],
  };
}

/** Un dossier plausible : des faits datés, assez long pour être jugé exploitable. */
const DOSSIER = [
  '(mars 2026) La version 22 est la version courante, publiée le 3 mars 2026.',
  '(février 2026) Le seuil réglementaire passe de 40 % à 45 % pour les installations neuves.',
  '(janvier 2026) Trois pays supplémentaires ont ratifié le texte, portant le total à dix-sept.',
  '(décembre 2025) Le comité de normalisation a publié son rapport annuel sur l\'application.',
  '(novembre 2025) Le budget consacré au dispositif atteint 4,2 milliards d\'euros.',
  'Auparavant, la version 21 tenait ce rôle depuis 2024, avec un seuil de 40 % et douze pays.',
].join('\n');

(async () => {
  console.log('— 1. La consigne dit ce qu\'on attend —');
  handler = () => answer(DOSSIER, ['https://exemple.org/a']);
  const now = new Date('2026-03-10T09:00:00Z');
  const result = await research.researchSubject({ subject: 'Norme XYZ', language: 'français', level: 'avance', now });
  const prompt = calls[0].input;
  assert('la date du jour est donnée au modèle', prompt.includes('2026-03-10'), prompt.slice(0, 120));
  assert('le sujet est transmis', prompt.includes('Norme XYZ'));
  assert('la langue est transmise', prompt.includes('français'));
  assert('chaque fait doit être daté', /date ou de sa période/.test(prompt));
  assert('inventer est interdit', /que la recherche n'a pas confirmé/.test(prompt));
  assert('la rédaction des cartes n\'est pas demandée ici', /ici on récolte/.test(prompt));
  assert('l\'outil de recherche est joint à l\'appel', calls[0].tools?.[0]?.type === 'web_search', JSON.stringify(calls[0].tools));

  console.log('\n— 2. Ce qui est retenu de la réponse —');
  assert('statut « ok » quand des pages sont citées', result.status === 'ok', JSON.stringify(result.status));
  assert('le dossier est conservé', result.text.includes('version 22'));
  assert('la source est rapportée', result.sources[0]?.url === 'https://exemple.org/a', JSON.stringify(result.sources));
  assert('la source porte un titre', Boolean(result.sources[0]?.title));

  console.log('\n— 3. Sources dédoublonnées —');
  calls.length = 0;
  handler = () => answer(DOSSIER, ['https://a.org', 'https://a.org', 'https://b.org']);
  const dedup = await research.researchSubject({ subject: 'Sujet', now });
  assert('une URL répétée n\'est comptée qu\'une fois', dedup.sources.length === 2, JSON.stringify(dedup.sources));

  console.log('\n— 4. Aucune page citée : le dossier est signalé comme non sourcé —');
  handler = () => answer(DOSSIER, []);
  const unsourced = await research.researchSubject({ subject: 'Sujet', now });
  assert('statut « unsourced »', unsourced.status === 'unsourced', unsourced.status);
  assert('le texte reste disponible', unsourced.text.length > 0);

  console.log('\n— 5. Recherche infructueuse : dit, pas inventé —');
  handler = () => answer('AUCUNE INFORMATION RÉCENTE TROUVÉE');
  const empty = await research.researchSubject({ subject: 'Sujet introuvable', now });
  assert('statut « empty »', empty.status === 'empty', empty.status);
  assert('aucun texte retourné', empty.text === '');

  handler = () => answer('Trois mots seulement.');
  const tooShort = await research.researchSubject({ subject: 'Sujet', now });
  assert('réponse trop courte traitée comme vide', tooShort.status === 'empty', tooShort.status);

  console.log('\n— 6. Outil refusé : on essaie le nom suivant —');
  calls.length = 0;
  handler = (params) => {
    if (params.tools[0].type === 'web_search') {
      const error = new Error('Unsupported tool type: web_search');
      error.status = 400;
      throw error;
    }
    return answer(DOSSIER, ['https://c.org']);
  };
  const fallback = await research.researchSubject({ subject: 'Sujet', now });
  assert('le second nom d\'outil est tenté', calls.length === 2, `${calls.length} appel(s)`);
  assert('l\'outil retenu est rapporté', fallback.tool === 'web_search_preview', String(fallback.tool));
  assert('le dossier est bien récolté', fallback.status === 'ok');

  console.log('\n— 7. Une erreur qui n\'est pas un refus d\'outil remonte telle quelle —');
  calls.length = 0;
  handler = () => { const error = new Error('Invalid API key'); error.status = 401; throw error; };
  let raised = null;
  try {
    await research.researchSubject({ subject: 'Sujet', now });
  } catch (error) {
    raised = error;
  }
  assert('l\'erreur est propagée', raised?.status === 401, String(raised));
  assert('aucun second outil tenté sur une erreur d\'authentification', calls.length === 1, `${calls.length} appel(s)`);

  console.log('\n— 8. Dossier trop long : coupé à une fin de ligne —');
  const lines = Array.from({ length: 600 }, (_, i) => `(mars 2026) Fait numéro ${i} sur le sujet étudié.`).join('\n');
  const cut = research.limitLength(lines);
  assert('la taille est bornée', cut.length <= research.MAX_RESEARCH_CHARS, String(cut.length));
  assert('aucune ligne laissée à moitié', lines.split('\n').includes(cut.split('\n').pop()), cut.split('\n').pop());

  console.log('\n— 9. Interrupteur serveur —');
  process.env.FLASHCARD_WEB_SEARCH = 'off';
  assert('coupée par la configuration', research.isAvailable() === false);
  delete process.env.FLASHCARD_WEB_SEARCH;
  assert('disponible avec une clé d\'API', research.isAvailable() === true);

  console.log(failures === 0 ? '\nTout est bon.' : `\n${failures} vérification(s) en échec.`);
  process.exitCode = failures === 0 ? 0 : 1;
})();

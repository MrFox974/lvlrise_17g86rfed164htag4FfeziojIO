/**
 * Service onboarding IA : conversation, parsing des réponses, génération de contenu.
 * Garde-fous : l'assistant reste strictement concentré sur la configuration et refuse
 * les demandes hors-sujet, obscènes ou inappropriées.
 */

const OpenAI = require('openai').default;
const Domain = require('../models/Domain');
const User = require('../models/User');
const TodoItem = require('../models/TodoItem');
const FlashcardDeck = require('../models/FlashcardDeck');
const FlashcardChapter = require('../models/FlashcardChapter');
const Flashcard = require('../models/Flashcard');
const Note = require('../models/Note');
const MarkdownDomain = require('../models/MarkdownDomain');
const MarkdownChapter = require('../models/MarkdownChapter');
const MarkdownSection = require('../models/MarkdownSection');
const Routine = require('../models/Routine');
const OnboardingSession = require('../models/OnboardingSession');
const markdownGenerationService = require('./markdown-generation.service');

const DAYS_FR_TO_EN = {
  lundi: 'monday',
  mardi: 'tuesday',
  mercredi: 'wednesday',
  jeudi: 'thursday',
  vendredi: 'friday',
  samedi: 'saturday',
  dimanche: 'sunday',
};

const STEP_KEYS = [
  'intro',
  'metier_actuel',
  'passion',
  'temps_semaine',
  'domaines_perso_3',
  'domaine_perso_resume',
  'domaine_pro_1',
  'domaine_pro_resume',
  'gauges',
  'autre_chose',
  'fin',
];

const STEP_MESSAGES = {
  intro: 'Bonjour ! Je vais vous aider à configurer votre espace d\'apprentissage personnalisé. C\'est rapide et ça va vraiment faire la différence pour votre routine.\n\nPour commencer, dites-moi simplement ce qui vous motive dans la vie ?',
  metier_actuel: "Merci.\n\nEt dans votre vie professionnelle, que faites-vous actuellement ?",
  passion: "Super !\n\nEt côté passions, qu'est-ce qui vous anime en dehors du travail ?",
  temps_semaine: null,
  domaines_perso_3: "Génial ! Maintenant, si vous deviez choisir 1 à 3 domaines pour votre développement personnel, lesquels seraient-ils ?\n\nCes derniers sont ceux que vous souhaiteriez apprendre (ex : La rhétorique, la philosophie, L'équitation...)\n\nVous pouvez les séparer par des virgules.",
  domaine_perso_resume: null,
  domaine_pro_1: "Parfait ! Et pour votre développement professionnel, quel domaine souhaitez-vous maîtriser ?",
  domaine_pro_resume: null,
  gauges: null,
  autre_chose: "Presque terminé ! Y a-t-il autre chose que vous aimeriez partager ? (C'est optionnel)",
  fin: "Parfait ! Nous paramétrons maintenant votre espace pour qu'il soit parfaitement adapté à vos besoins.",
};

const MSG_DOMAINE_PERSO_RESUME_ASK_MODIF = "Quel domaine souhaitez-vous modifier et quel mot en 1 mot ? (Ex : « le 2ème, sagesse » ou « philosophie → sagesse »)";
const MSG_DOMAINE_PERSO_RESUME_RAPPEL = "Je dois pouvoir mettre 1 mot sur le concept, bien qu'il sera traité dans son ensemble. Indiquez quel domaine modifier et le mot en 1 mot.";
const MSG_DOMAINE_PRO_RESUME_ASK_MODIF = "Quel mot en 1 mot souhaitez-vous pour illustrer ce domaine ?";
const MSG_DOMAINE_PRO_RESUME_RAPPEL = "Je dois pouvoir mettre 1 mot sur le concept, bien qu'il sera traité dans son ensemble. Indiquez le mot en 1 mot.";

const SYSTEM_PROMPT = `Tu es un assistant IA de configuration pour une application d'apprentissage personnalisée. Tu restes STRICTEMENT concentré sur la discussion et l'objectif de paramétrage. Tu poses des questions pour comprendre les buts, métier, passions, domaines d'apprentissage et disponibilités de l'utilisateur.

RÈGLES IMPORTANTES :
- Tu ne réponds qu'aux questions liées à la configuration et à l'apprentissage.
- Si l'utilisateur pose une question hors-sujet, obscène, ou te demande de te comporter d'une manière inappropriée, tu refuses poliment et reviens au paramétrage : "Je reste concentré sur la configuration de votre espace. Pouvez-vous répondre à la question posée ?"
- Tu ne génères pas de contenu offensant, illégal ou inapproprié.
- Tu utilises un ton professionnel et bienveillant.`;

const FLASHCARD_SYSTEM = `Tu es un expert pédagogique. Tu génères des paires question/réponse pour des flashcards éducatives.
Le contenu doit porter UNIQUEMENT sur le domaine/sujet demandé.
Utilise tes connaissances réelles : définitions, concepts, faits pertinents.
IMPORTANT : La réponse doit être TRÈS COURTE (max 125 caractères). Elle doit tenir DANS la carte sans déborder. Une phrase courte, synthétique, mémorisable. Pas de liste, pas de paragraphe.
Format strict : QUESTION: [ta question] REPONSE: [ta réponse en 1 phrase courte]`;

const BIBLIOTHEQUE_SYSTEM = `Tu es un expert et auteur pédagogique. Tu génères du contenu éducatif ULTRA-DENSE, FACTUEL, TRÈS APPROFONDI et structuré en MARKDOWN.
Le contenu doit porter UNIQUEMENT sur le domaine/sujet demandé (ex: Rhétorique, Histoire, Relations positives, Développement web).
Utilise tes connaissances approfondies : définitions très précises et détaillées, concepts clés très développés (chaque concept expliqué en 300-500 caractères minimum), nombreux exemples concrets très détaillés (10-20 exemples par section, chaque exemple 300-400 caractères), faits historiques ou théoriques pertinents avec contexte complet, analyses approfondies avec plusieurs perspectives, descriptions étape par étape détaillées.
Base-toi sur des savoirs réels et reconnus dans ce champ. Pas de mention d'application, de configuration ou de paramétrage.

RÈGLES STRICTES :
- Format titres : ## Chap N. Titre du chapitre (ex: "## Chap 1. Les Fondements") et ### Part N. Titre (ex: "### Part 1. Introduction").
- Format Markdown PUR : utilise UNIQUEMENT ## pour titres principaux, ### pour sous-titres, **texte** pour gras, *texte* pour italique, - pour listes, paragraphes séparés par ligne vide. JAMAIS de balises HTML (<h2>, <p>, <strong>, etc.). UNIQUEMENT du Markdown pur.
- Ne pas répéter le titre dans le contenu après l'avoir mis en en-tête.
- Chapitres : PARCOURS COHÉRENT, chaque chapitre approfondit le précédent. Pas de rupture.
- Sous-chapitres (Part) : cohérents entre eux et avec le chapitre. Titre descriptif (jamais "Section X").
- Ne pas répéter le nom du domaine dans les titres.
- CONTENU ULTRA-DENSE : chaque section doit contenir des informations factuelles très substantielles, des définitions très précises et détaillées (300-500 caractères par définition), de nombreux exemples concrets très détaillés (10-20 exemples minimum, 300-400 caractères chacun), des développements très approfondis, des analyses complètes avec plusieurs perspectives, des contextes historiques/théoriques complets. Chaque paragraphe doit faire au minimum 200-300 caractères. Pas de remplissage vide, uniquement du contenu éducatif de très haute qualité et très approfondi.`;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function isInvalidContent(text) {
  if (!text || typeof text !== 'string') return true;
  const lower = text.toLowerCase();
  // Vérifier les messages de refus
  if (
    lower.includes('je reste concentré') ||
    lower.includes('répondez à la question posée') ||
    lower.includes('configuration de votre espace')
  ) return true;
  // Contenu trop court
  if (text.trim().length < 500) return true;
  // Placeholders explicites (toujours rejeter)
  if (
    lower.includes('contenu éducatif à compléter') ||
    lower.includes('contenu éducatif sur ce sous-thème')
  ) return true;
  // "à compléter" seul : rejeter seulement si le contenu est court (sinon peut être une phrase valide)
  if (lower.includes('à compléter') && text.trim().length < 2000) return true;
  // Vérifier si le contenu contient plusieurs chapitres (## Chap) - cela ne devrait pas arriver dans une section
  const chapterMatches = text.match(/^##\s+Chap\s+\d+/gm);
  if (chapterMatches && chapterMatches.length > 1) {
    return true; // Plusieurs chapitres détectés dans une section
  }
  return false;
}

/**
 * Validation légère pour le contenu des flashcards (courtes Q/R).
 * Ne pas utiliser isInvalidContent ici (seuil 500 car. rejetterait tout).
 */
function isInvalidFlashcardContent(text) {
  if (!text || typeof text !== 'string') return true;
  const t = text.trim();
  if (t.length < 5) return true;
  const lower = t.toLowerCase();
  if (lower.includes('je reste concentré') || lower.includes('configuration de votre espace')) return true;
  if (lower.includes('question de révision') && t.length < 50) return true;
  if (lower.includes('réponse éducative') && lower.includes('complétez selon')) return true;
  return false;
}

/**
 * Convertit une chaîne de durée en minutes : "1h20" -> 80, "60min" -> 60, "1h" -> 60.
 */
function parseDurationToMinutes(text) {
  if (!text || typeof text !== 'string') return null;
  const t = text.trim().toLowerCase();
  const hMatch = t.match(/(\d+)\s*h(?:eures?)?\s*(\d+)?\s*(?:min|m)?/i) || t.match(/(\d+)\s*h(?:eures?)?/i);
  if (hMatch) {
    const heures = parseInt(hMatch[1], 10) || 0;
    const minutes = parseInt(hMatch[2], 10) || 0;
    return Math.min(480, Math.max(0, heures * 60 + minutes));
  }
  const minMatch = t.match(/(\d+)\s*(?:min|minutes?|m)\b/i);
  if (minMatch) return Math.min(480, Math.max(0, parseInt(minMatch[1], 10)));
  const numMatch = t.match(/(\d+)/);
  if (numMatch) return Math.min(480, Math.max(0, parseInt(numMatch[1], 10)));
  return null;
}

/**
 * Parse une réponse contenant des minutes par jour (ex: "lundi 30 mardi 1h20" ou "1h20" pour un seul jour).
 * @param {string} text
 * @param {string} expectedDay - 'monday' | 'tuesday' etc. si on attend un seul jour
 * @returns {{ minutes: number, parsed: Record<string, number> } | null}
 */
function parseMinutesFromText(text, expectedDay = null) {
  if (!text || typeof text !== 'string') return null;
  const t = text.trim().toLowerCase();
  const numbers = t.match(/\d+/g);
  if (!numbers || numbers.length === 0) return null;

  const result = {};
  const dayPatterns = [
    { fr: 'lundi', en: 'monday' },
    { fr: 'mardi', en: 'tuesday' },
    { fr: 'mercredi', en: 'wednesday' },
    { fr: 'jeudi', en: 'thursday' },
    { fr: 'vendredi', en: 'friday' },
    { fr: 'samedi', en: 'saturday' },
    { fr: 'dimanche', en: 'sunday' },
  ];

  let numIndex = 0;
  for (const { fr, en } of dayPatterns) {
    const idx = t.indexOf(fr);
    if (idx !== -1) {
      const afterDay = t.slice(idx + fr.length);
      const timeMatch = afterDay.match(/^\s*[:=]?\s*(\d+)\s*(?:h|heures?)\s*(\d+)?\s*(?:min|m)?/i)
        || afterDay.match(/^\s*[:=]?\s*(\d+)\s*(?:min|minutes?|m)\b/i)
        || afterDay.match(/^\s*[:=]?\s*(\d+)/);
      if (timeMatch) {
        let mins;
        if (timeMatch[2] != null) mins = parseInt(timeMatch[1], 10) * 60 + (parseInt(timeMatch[2], 10) || 0);
        else if (/min|m\b/i.test(afterDay)) mins = parseInt(timeMatch[1], 10);
        else mins = parseInt(timeMatch[1], 10);
        result[en] = Math.min(480, Math.max(0, mins));
      } else if (numbers[numIndex]) {
        result[en] = Math.min(480, Math.max(0, parseInt(numbers[numIndex++], 10)));
      }
    }
  }

  if (Object.keys(result).length > 0) return { parsed: result, minutes: result[expectedDay] ?? result[Object.keys(result)[0]] };

  const single = parseDurationToMinutes(t) ?? Math.min(480, Math.max(0, parseInt(numbers[0], 10)));
  if (expectedDay) return { parsed: { [expectedDay]: single }, minutes: single };
  return { parsed: {}, minutes: single };
}

/**
 * Détermine les jours manquants dans responses.temps_per_day
 */
function getMissingDays(responses) {
  const temps = responses.temps_per_day || {};
  const all = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  return all.filter((d) => temps[d] == null || temps[d] === '');
}

/**
 * Prochaine étape après avoir reçu une réponse.
 */
function getNextStep(stepIndex, responses, rawAnswer) {
  const key = STEP_KEYS[stepIndex];
  if (!key) return stepIndex;

  if (key === 'temps_semaine') {
    try {
      const parsed = typeof rawAnswer === 'string' ? JSON.parse(rawAnswer) : rawAnswer;
      if (parsed && typeof parsed === 'object') {
        const temps = {};
        const dayMap = { lundi: 'monday', mardi: 'tuesday', mercredi: 'wednesday', jeudi: 'thursday', vendredi: 'friday', samedi: 'saturday', dimanche: 'sunday' };
        for (const [fr, en] of Object.entries(dayMap)) {
          const val = parsed[fr] || parsed[en];
          if (val != null) {
            const mins = typeof val === 'number' ? val : parseDurationToMinutes(String(val));
            if (mins != null) temps[en] = Math.min(480, Math.max(0, mins));
          }
        }
        if (Object.keys(temps).length > 0) {
          responses.temps_per_day = temps;
          return STEP_KEYS.indexOf('domaines_perso_3');
        }
      }
    } catch (e) {
      const parsed = parseMinutesFromText(rawAnswer);
      if (parsed && parsed.parsed) {
        responses.temps_per_day = parsed.parsed;
        const missing = getMissingDays(responses);
        if (missing.length === 0) return STEP_KEYS.indexOf('domaines_perso_3');
      }
    }
    return stepIndex;
  }

  if (key === 'metier_actuel') {
    responses.metier_actuel = (rawAnswer || '').trim().slice(0, 200);
    return stepIndex + 1;
  }
  if (key === 'passion') {
    responses.passion = (rawAnswer || '').trim().slice(0, 500);
    return stepIndex + 1;
  }
  if (key === 'domaines_perso_3') {
    const parts = (rawAnswer || '').split(/[,;]\s*/).map((s) => s.trim()).filter(Boolean);
    const domains = parts.slice(0, 3).map((p) => cleanDomainName(p.slice(0, 100)));
    responses.domaines_perso = domains.length > 0 ? domains : (responses.domaines_perso || []);
    return STEP_KEYS.indexOf('domaine_perso_resume');
  }

  if (key === 'domaine_perso_resume') {
    const ans = (rawAnswer || '').trim().toLowerCase();
    const labels = responses.domaines_perso_labels || [];
    const state = responses.domaine_perso_resume_state || 'awaiting_confirmation';

    if (state === 'awaiting_confirmation') {
      if (/^(oui|ok|c'est bon|parfait|valider|validé|yes)$/i.test(ans.replace(/[.!?]/g, '').trim())) {
        delete responses.domaine_perso_resume_state;
        return STEP_KEYS.indexOf('domaine_pro_1');
      }
      const modConfirm = parseDomainModification(rawAnswer, responses.domaines_perso || [], labels);
      if (modConfirm) {
        const newLabels = [...labels];
        newLabels[modConfirm.index] = modConfirm.word;
        responses.domaines_perso_labels = newLabels;
        responses._customMessage = buildDomaineResumeMessage(newLabels, responses.domaines_perso || [], true) + '\n\nEst-ce bon pour vous ? (Si je dois modifier, dites-le moi)';
        return stepIndex;
      }
      if (/^(non|pas bon|pas bien|c'est pas bon|modifier|non merci)$/i.test(ans.replace(/[.!?]/g, '').trim()) || ans.length < 3) {
        responses.domaine_perso_resume_state = 'awaiting_modification';
        responses._customMessage = MSG_DOMAINE_PERSO_RESUME_ASK_MODIF;
        return stepIndex;
      }
    }

    if (state === 'awaiting_modification') {
      const mod = parseDomainModification(rawAnswer, responses.domaines_perso || [], labels);
      if (mod) {
        const newLabels = [...labels];
        newLabels[mod.index] = mod.word;
        responses.domaines_perso_labels = newLabels;
        responses.domaine_perso_resume_state = 'awaiting_confirmation';
        responses._customMessage = buildDomaineResumeMessage(newLabels, responses.domaines_perso || [], true) + '\n\nEst-ce bon pour vous ? (Si je dois modifier, dites-le moi)';
        return stepIndex;
      }
      responses._customMessage = MSG_DOMAINE_PERSO_RESUME_RAPPEL;
      return stepIndex;
    }
    return stepIndex;
  }

  if (key === 'domaine_pro_1') {
    responses.domaine_pro = cleanDomainName((rawAnswer || '').trim().slice(0, 200));
    return STEP_KEYS.indexOf('domaine_pro_resume');
  }

  if (key === 'domaine_pro_resume') {
    const ans = (rawAnswer || '').trim().toLowerCase();
    const state = responses.domaine_pro_resume_state || 'awaiting_confirmation';

    if (state === 'awaiting_confirmation') {
      if (/^(oui|ok|c'est bon|parfait|valider|validé|yes)$/i.test(ans.replace(/[.!?]/g, '').trim())) {
        delete responses.domaine_pro_resume_state;
        return STEP_KEYS.indexOf('gauges');
      }
      const wordPro = parseOneWordModification(rawAnswer);
      if (wordPro) {
        responses.domaine_pro_label = wordPro;
        responses._customMessage = `Parfait ! Voici le mot qui illustre votre domaine pro : **${wordPro}**\n\nEst-ce bon pour vous ? (Si je dois modifier, dites-le moi)`;
        return stepIndex;
      }
      if (/^(non|pas bon|pas bien|c'est pas bon|modifier|non merci)$/i.test(ans.replace(/[.!?]/g, '').trim()) || ans.length < 3) {
        responses.domaine_pro_resume_state = 'awaiting_modification';
        responses._customMessage = MSG_DOMAINE_PRO_RESUME_ASK_MODIF;
        return stepIndex;
      }
    }

    if (state === 'awaiting_modification') {
      const word = parseOneWordModification(rawAnswer);
      if (word) {
        responses.domaine_pro_label = word;
        responses.domaine_pro_resume_state = 'awaiting_confirmation';
        responses._customMessage = `Parfait ! Voici le mot qui illustre votre domaine pro : **${word}**\n\nEst-ce bon pour vous ? (Si je dois modifier, dites-le moi)`;
        return stepIndex;
      }
      responses._customMessage = MSG_DOMAINE_PRO_RESUME_RAPPEL;
      return stepIndex;
    }
    return stepIndex;
  }
  if (key === 'autre_chose') {
    responses.autre_chose = (rawAnswer || '').trim().slice(0, 1000);
    return STEP_KEYS.indexOf('fin');
  }

  return stepIndex + 1;
}

/**
 * Nettoie le nom d'un domaine : enlève "de façon générale", "en général", etc.
 */
function cleanDomainName(name) {
  if (!name || typeof name !== 'string') return name;
  return name
    .replace(/\s*(de\s+façon\s+générale|en\s+général|généralement|de\s+manière\s+générale)\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Construit le message de résumé des domaines perso en 1 mot.
 * @param {string[]} labels - Mots en 1 par domaine
 * @param {string[]} domains - Noms complets des domaines (optionnel, pour ordre)
 * @param {boolean} isUpdate - Si true, pas d'intro "Parfait ! Afin de..."
 */
function buildDomaineResumeMessage(labels, domains, isUpdate = false) {
  const ordinals = ['Premier', 'Deuxième', 'Troisième'];
  const lines = labels.map((label, i) => `-> ${ordinals[i]} domaine : ${label}`).join('\n');
  if (isUpdate) return lines;
  return `Parfait ! Afin de gérer au mieux vos compétences, je résume chacun de vos domaines en 1 mot :\n\n${lines}\n\nEst-ce bon pour vous ? (Si je dois modifier, dites-le moi)`;
}

/**
 * Parse une modification utilisateur pour les domaines perso.
 * Accepte : "le 2ème sagesse", "2 : sagesse", "philosophie -> sagesse", "2, sagesse"
 * @returns {{ index: number, word: string } | null}
 */
function parseDomainModification(text, domains, labels) {
  if (!text || typeof text !== 'string') return null;
  const t = text.trim();
  if (t.length < 2) return null;
  const parts = t.split(/[,;:→>\-]+/).map((s) => s.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  let index = -1;
  let word = '';
  const numMatch = parts[0].match(/(\d)(?:er|ème|e)?/i) || parts[0].match(/^(\d)$/);
  if (numMatch) {
    index = Math.max(0, parseInt(numMatch[1], 10) - 1);
    word = parts.slice(1).join(' ').trim().split(/\s+/)[0];
  } else {
    const domainLower = parts[0].toLowerCase();
    index = domains.findIndex((d) => d.toLowerCase().includes(domainLower) || domainLower.includes(d.toLowerCase()));
    word = parts.slice(1).join(' ').trim().split(/\s+/)[0];
  }
  if (index < 0 || index >= domains.length) return null;
  if (!word || word.length > 50) return null;
  return { index, word: word.slice(0, 50) };
}

/**
 * Parse une modification pour le domaine pro : extrait 1 mot.
 * @returns {string | null}
 */
function parseOneWordModification(text) {
  if (!text || typeof text !== 'string') return null;
  const t = text.trim();
  if (!t || t.length > 50) return null;
  const firstWord = t.split(/\s+/)[0];
  if (firstWord && /^[a-zA-ZÀ-ÿ0-9-]+$/.test(firstWord)) return firstWord;
  if (/^[a-zA-ZÀ-ÿ0-9\s-]+$/.test(t)) return t.trim().split(/\s+/)[0] || t.trim();
  return null;
}

/**
 * Génère 1 mot par domaine via OpenAI (ou fallback sur le premier mot du nom).
 */
async function generateDomainLabelsOneWord(domains) {
  if (!domains || domains.length === 0) return [];
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: "Tu dois résumer chaque domaine d'apprentissage en exactement 1 mot (un seul mot, pas de phrase). Réponds UNIQUEMENT avec les mots séparés par des virgules, rien d'autre. Ex: rhétorique, philosophie, équitation",
        },
        {
          role: 'user',
          content: `Résume chaque domaine en 1 mot : ${domains.join(', ')}`,
        },
      ],
      max_tokens: 60,
    });
    const text = (completion.choices[0]?.message?.content || '').trim();
    const words = text.split(/[,;]/).map((s) => s.trim().split(/\s+/)[0]).filter(Boolean).slice(0, domains.length);
    if (words.length === domains.length) return words;
  } catch (err) {
    console.error('generateDomainLabelsOneWord:', err);
  }
  return domains.map((d) => d.split(/\s+/)[0] || d).slice(0, 30);
}

/**
 * Vérifie si une réponse utilisateur est hors-sujet ou inappropriée (garde-fous).
 * Retourne true si la réponse semble appropriée, false si on doit refuser.
 */
async function isResponseAppropriate(userMessage, context = '') {
  if (!userMessage || userMessage.trim().length < 2) return true;
  try {
    const sys = `Tu es un modérateur pour une application de configuration d'apprentissage.
La question posée à l'utilisateur est : "${context}"
L'utilisateur a répondu : "${userMessage.slice(0, 300)}"

Accepte TOUTE réponse pertinente : temps (30, 1h20, 60min, 1h), métier, passion, domaine, liste de domaines, etc.
Réponds UNIQUEMENT "OK" si la réponse est adaptée à la question posée.
Réponds "REFUSE" UNIQUEMENT si le message est obscène, insultant ou demande quelque chose d'inapproprié.`;
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: 'Cette réponse est-elle appropriée ? Réponds OK ou REFUSE.' },
      ],
      max_tokens: 10,
    });
    const text = (completion.choices[0]?.message?.content || '').trim().toUpperCase();
    if (text.includes('REFUSE')) return false;
    return true;
  } catch (err) {
    console.error('onboarding-ai isResponseAppropriate:', err);
    return true;
  }
}

/**
 * Génère du contenu markdown éducatif sur un domaine (bibliothèque).
 * @param {string} domainName - Le domaine (ex: Rhétorique, Histoire)
 * @param {string} prompt - Consigne détaillée (chapitre, section, etc.)
 * @param {number} minChars
 */
async function generateMarkdownContent(domainName, prompt, minChars = 3000) {
  const sys = `${BIBLIOTHEQUE_SYSTEM}\n\nDomaine : "${domainName}". ${prompt}\n\nGénère du contenu Markdown PUR structuré, ULTRA-DENSE, FACTUEL et BIEN FORMATÉ.\n\n⚠️ CRITIQUE : Utilise UNIQUEMENT du Markdown pur. JAMAIS de balises HTML.\n\nRÈGLES FORMAT : ## pour titre principal, ### pour sous-titres, paragraphes séparés par ligne vide, listes avec -, **gras**, *italique*. UNIQUEMENT Markdown pur.\n\nLONGUEUR MINIMALE ABSOLUE : ${minChars} CARACTÈRES. Chaque paragraphe au minimum 200-400 caractères. Pas de remplissage vide.`;
  // Prompt utilisateur structuré en 3 parties pour inciter le modèle à produire beaucoup de contenu
  const structuredUser = `Domaine : ${domainName}. Consigne : ${prompt}

Structure OBLIGATOIRE ton contenu en 3 parties (avec ### Part 1., ### Part 2., ### Part 3. ou des sous-titres similaires) :
1) DÉFINITIONS ET CONCEPTS : définitions précises (300-600 caractères chacune), concepts clés développés (300-700 caractères chacun). Au moins 3-5 définitions et 2-4 concepts.
2) EXEMPLES ET CAS CONCRETS : nombreux exemples détaillés (10-20 exemples, 300-500 caractères chacun), cas concrets, applications pratiques.
3) ANALYSES ET PERSPECTIVES : analyses approfondies, plusieurs points de vue, contextes historiques ou théoriques, synthèse.

EXIGENCE ABSOLUE : MINIMUM ${minChars} CARACTÈRES de contenu réel. Rédige chaque partie de façon ULTRA-DENSE. Pas de balises HTML, uniquement Markdown (##, ###, **, *, -, paragraphes).`;
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: structuredUser },
      ],
      max_tokens: 8192,
    });
    let content = (completion.choices[0]?.message?.content || '').trim();
    // Nettoyer le contenu AVANT validation (HTML → Markdown, etc.)
    content = content
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '## $1\n\n')
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
      .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n')
      .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
      .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
      .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
      .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
      .replace(/<ul[^>]*>/gi, '')
      .replace(/<\/ul>/gi, '\n')
      .replace(/<ol[^>]*>/gi, '')
      .replace(/<\/ol>/gi, '\n')
      .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
      .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<hr\s*\/?>/gi, '\n\n---\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+$/gm, '')
      .trim();

    if (isInvalidContent(content)) {
      // Un seul retry avec un prompt plus simple et objectif réduit
      const retryMinChars = Math.min(minChars, 6000);
      const retryUser = `Écris un texte éducatif en Markdown sur le domaine "${domainName}". Règles : titre avec ##, sous-titres avec ###, paragraphes denses. Minimum ${retryMinChars} caractères. Pas de HTML, uniquement Markdown. Contenu factuel avec définitions et exemples.`;
      const retryComp = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: `${BIBLIOTHEQUE_SYSTEM}\n\nGénère du contenu Markdown PUR. Domaine : "${domainName}". Minimum ${retryMinChars} caractères.` },
          { role: 'user', content: retryUser },
        ],
        max_tokens: 8192,
      });
      content = (retryComp.choices[0]?.message?.content || '').trim();
      content = content
        .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '## $1\n\n')
        .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
        .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
        .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n')
        .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
        .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
        .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
        .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
        .replace(/<ul[^>]*>/gi, '')
        .replace(/<\/ul>/gi, '\n')
        .replace(/<ol[^>]*>/gi, '')
        .replace(/<\/ol>/gi, '\n')
        .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
        .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<hr\s*\/?>/gi, '\n\n---\n\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]+$/gm, '')
        .trim();
      if (isInvalidContent(content)) {
        throw new Error('Contenu invalide généré');
      }
    }

    // Boucle pour atteindre le minimum de caractères avec plusieurs appels si nécessaire
    let attempts = 0;
    const maxAttempts = 15; // Maximum 15 appels supplémentaires pour générer du contenu ultra-dense (30k+ caractères)
    while (content.length < minChars && attempts < maxAttempts) {
      attempts++;
      const remaining = minChars - content.length;
      const more = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: `${BIBLIOTHEQUE_SYSTEM}\n\nDomaine : "${domainName}". Tu DOIS ajouter du contenu en Markdown pur (##, ###, **, *, -). JAMAIS de balises HTML. Continue de façon dense et factuelle.` },
          { role: 'user', content: `Tu DOIS ajouter au moins ${Math.min(6000, remaining + 1500)} caractères de contenu réel sur "${domainName}".

Étapes : 1) Énumère mentalement 5 à 10 sous-points à traiter (définitions, exemples, concepts, analyses). 2) Rédige chaque sous-point en 300-600 caractères. 3) Utilise uniquement Markdown (## ou ### pour titres, paragraphes, listes avec -). Pas de HTML.

Dernier passage du contenu actuel :
---
${content.slice(-3500)}
---

Continue IMMÉDIATEMENT après ce passage. Ajoute définitions détaillées, exemples concrets (5-10), développements de concepts, analyses. Le tout en Markdown pur, très dense.` },
        ],
        max_tokens: 4096,
      });
      let extra = (more.choices[0]?.message?.content || '').trim();
      
      // Nettoyer le HTML du contenu supplémentaire
      extra = extra
        .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '## $1\n\n')
        .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
        .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
        .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n')
        .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
        .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
        .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
        .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
        .replace(/<ul[^>]*>/gi, '')
        .replace(/<\/ul>/gi, '\n')
        .replace(/<ol[^>]*>/gi, '')
        .replace(/<\/ol>/gi, '\n')
        .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
        .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<hr\s*\/?>/gi, '\n\n---\n\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\n{3,}/g, '\n\n')
        .replace(/[ \t]+$/gm, '')
        .trim();
      
      if (!extra || isInvalidContent(extra)) {
        // Seuil minimum utilisable : le controller exige 5000 pour un chapitre, 3000 pour une section
        const minUsableChars = minChars >= 15000 ? 5000 : 3000;
        if (content.length >= minUsableChars) {
          // On a assez de contenu valide pour créer le chapitre/section, on sort avec ce qu'on a
          break;
        }
        if (attempts >= maxAttempts) {
          throw new Error('Impossible de générer suffisamment de contenu valide');
        }
        // Une continuation invalide : on réessaie une fois au lieu de faire échouer toute la génération
        continue;
      }
      content += '\n\n' + extra;
    }
    
    // Vérification finale : si on n'a toujours pas assez de contenu, on fait un dernier appel
    if (content.length < minChars * 0.8) {
      const toAdd = Math.min(6000, minChars - content.length + 1500);
      const final = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: `${BIBLIOTHEQUE_SYSTEM}\n\nDomaine : "${domainName}". Tu DOIS ajouter du contenu en Markdown pur. Enrichis avec exemples, définitions, analyses.` },
          { role: 'user', content: `Ajoute au moins ${toAdd} caractères de contenu réel sur "${domainName}". Contenu à enrichir : définitions supplémentaires (300-500 caractères chacune), 5-15 exemples concrets détaillés (300-500 caractères chacun), développements de concepts, analyses avec plusieurs perspectives. Format : Markdown uniquement (### pour sous-titres, paragraphes denses, listes avec -). Pas de HTML.

Fin du contenu actuel :
---
${content.slice(-4500)}
---

Rédige la suite en Markdown pur, très dense.` },
        ],
        max_tokens: 4096,
      });
      let finalContent = (final.choices[0]?.message?.content || '').trim();
      
      // Nettoyer le HTML du contenu final
      if (finalContent) {
        finalContent = finalContent
          .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '## $1\n\n')
          .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
          .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
          .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n')
          .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
          .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
          .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
          .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
          .replace(/<ul[^>]*>/gi, '')
          .replace(/<\/ul>/gi, '\n')
          .replace(/<ol[^>]*>/gi, '')
          .replace(/<\/ol>/gi, '\n')
          .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
          .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<hr\s*\/?>/gi, '\n\n---\n\n')
          .replace(/<[^>]+>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\n{3,}/g, '\n\n')
          .replace(/[ \t]+$/gm, '')
          .trim();
        
        if (finalContent && !isInvalidContent(finalContent)) {
          content += '\n\n' + finalContent;
        }
      }
    }

    const minUsableReturn = minChars >= 15000 ? 5000 : 3000;
    if (content.length < minUsableReturn) {
      throw new Error('Impossible de générer suffisamment de contenu valide');
    }
    return content;
  } catch (err) {
    console.error('generateMarkdownContent:', err);
    throw err;
  }
}

const MAX_GENERATION_MS = 60 * 60 * 1000; // 1 h : au-delà, mode accéléré pour finir rapidement
const GRACE_FINISH_MS = 30 * 1000;

/**
 * Lance la génération en arrière-plan. Met à jour OnboardingSession.generation_progress.
 * Si la création prend + de 10 min, on passe en mode accéléré pour finir rapidement.
 */
async function runGenerationJob(userId) {
  const session = await OnboardingSession.findOne({ where: { user_id: userId } });
  if (!session || session.status !== 'generating') return;
  
  // Vérifier si la génération a été annulée
  const checkCancelled = async () => {
    const currentSession = await OnboardingSession.findOne({ where: { user_id: userId } });
    return currentSession?.generation_cancelled === true;
  };

  const startTime = Date.now();
  const isTimeUp = () => Date.now() - startTime > MAX_GENERATION_MS;
  const isRushMode = () => isTimeUp();

  const responses = session.responses || {};
  const domainsPerso = responses.domaines_perso || ['Histoire', 'Réthorique', 'Relations'];
  const domainPro = responses.domaine_pro || 'Travail';
  const tempsPerDay = responses.temps_per_day || { monday: 30, tuesday: 30, wednesday: 30, thursday: 30, friday: 30, saturday: 60, sunday: 60 };

  const totalSteps = 12;
  let step = 0;
  const log = [];

  const addLog = (message, status = 'done') => {
    log.push({ message, status, at: new Date().toISOString() });
  };

  const updateProgress = async (s, p, logMsg) => {
    if (logMsg) addLog(logMsg, 'done');
    await session.update({
      generation_step: s,
      generation_progress: Math.round(p),
      generation_log: log,
    });
  };

  try {
    addLog('Démarrage de la configuration…', 'running');
    await session.update({ generation_log: log });
    
    // Vérifier si annulé avant de continuer
    if (await checkCancelled()) {
      addLog('Génération annulée par l\'utilisateur.', 'error');
      await session.update({
        status: 'completed',
        generation_step: 'cancelled',
        generation_log: log,
      });
      return;
    }

    await updateProgress('domains', (++step / totalSteps) * 100, `Création des domaines (${domainsPerso.join(', ')} + ${domainPro})…`);
    
    // Vérifier si annulé
    if (await checkCancelled()) {
      addLog('Génération annulée par l\'utilisateur.', 'error');
      await session.update({
        status: 'completed',
        generation_step: 'cancelled',
        generation_log: log,
      });
      return;
    }

    const maxPos = await Domain.max('position', { where: { user_id: userId } });
    let position = (maxPos ?? -1) + 1;

    for (const name of domainsPerso) {
      await Domain.create({
        user_id: userId,
        name: name.slice(0, 100),
        type: 'perso',
        minutes_per_day: tempsPerDay,
        position: position++,
      });
    }
    await Domain.create({
      user_id: userId,
      name: domainPro.slice(0, 100),
      type: 'pro',
      minutes_per_day: tempsPerDay,
      position: position++,
    });

    await updateProgress('flashcards', (++step / totalSteps) * 100, 'Génération des flashcards…');
    
    // Vérifier si annulé
    if (await checkCancelled()) {
      addLog('Génération annulée par l\'utilisateur.', 'error');
      await session.update({
        status: 'completed',
        generation_step: 'cancelled',
        generation_log: log,
      });
      return;
    }

    const numFlashcards = isRushMode() ? 2 : 5;
    const firstDomain = domainsPerso[0] || 'Apprentissage';
    if (isRushMode()) addLog('Mode accéléré : contenu réduit pour terminer rapidement.', 'running');

    addLog(`Création de la collection de révision…`, 'running');
    await session.update({ generation_log: log });
    const deckPos = await FlashcardDeck.max('position', { where: { user_id: userId } });
    const deck = await FlashcardDeck.create({
      user_id: userId,
      name: 'Collection de révision',
      description: 'Cartes de révision pour vos domaines d\'apprentissage',
      position: (deckPos ?? -1) + 1,
    });
    const chPos = await FlashcardChapter.max('position', { where: { deck_id: deck.id } });
    const chapter = await FlashcardChapter.create({
      deck_id: deck.id,
      title: 'Groupe de révision',
      position: (chPos ?? -1) + 1,
    });
    for (let i = 0; i < numFlashcards; i++) {
        addLog(`Création de la carte ${i + 1}/${numFlashcards}…`, 'running');
        await session.update({ generation_log: log });
        if (isRushMode()) {
          try {
            const comp = await openai.chat.completions.create({
              model: 'gpt-4o-mini',
              messages: [
                { role: 'system', content: FLASHCARD_SYSTEM },
                { role: 'user', content: `Domaine : ${firstDomain}. Une question et sa réponse courte. Format : QUESTION: [question] REPONSE: [réponse max 125 car]` },
              ],
              max_tokens: 120,
            });
            const txt = (comp.choices[0]?.message?.content || '').trim();
            const qMatch = txt.match(/(?:QUESTION|Question)\s*:\s*([\s\S]+?)(?=(?:REPONSE|Réponse)\s*:|$)/i);
            const rMatch = txt.match(/(?:REPONSE|Réponse)\s*:\s*([\s\S]+)$/i);
            let front = (qMatch ? qMatch[1].trim().replace(/\s+/g, ' ').slice(0, 300) : 'Quel concept en ' + firstDomain + ' ?');
            let back = (rMatch ? rMatch[1].trim().replace(/\s+/g, ' ').slice(0, 125) : 'À compléter.');
            const cardPos = await Flashcard.max('position', { where: { deck_id: deck.id } });
            await Flashcard.create({
              deck_id: deck.id,
              chapter_id: chapter.id,
              front: front.slice(0, 500),
              back: back.slice(0, 1000),
              position: (cardPos ?? -1) + 1,
            });
          } catch (rushE) {
            const cardPos = await Flashcard.max('position', { where: { deck_id: deck.id } });
            await Flashcard.create({
              deck_id: deck.id,
              chapter_id: chapter.id,
              front: 'Quel concept clé en ' + firstDomain + ' ?',
              back: 'À compléter selon vos connaissances en ' + firstDomain + '.',
              position: (cardPos ?? -1) + 1,
            });
          }
          addLog(`Carte ${i + 1} créée.`, 'done');
          await session.update({ generation_log: log });
          continue;
        }
        const userPrompt = `Domaine : "${firstDomain}". Génère exactement UNE paire question/réponse sur ce thème uniquement.
- Question : une vraie question de révision (définition, concept, fait) sur ${firstDomain}. Pas de question générique.
- Réponse : une phrase courte et factuelle (max 125 caractères), pas de liste.
Exemple pour "Rhétorique" : QUESTION: Qu'est-ce qu'une métaphore en rhétorique ? REPONSE: Figure de style qui rapproche deux éléments sans mot de comparaison explicite.
Format strict : QUESTION: [ta question] REPONSE: [ta réponse courte]`;
        let front = '';
        let back = '';
        try {
          const comp = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: FLASHCARD_SYSTEM },
              { role: 'user', content: userPrompt },
            ],
            max_tokens: 180,
          });
          const txt = (comp.choices[0]?.message?.content || '').trim();
          if (isInvalidFlashcardContent(txt)) throw new Error('Contenu flashcard invalide');
          const qMatch = txt.match(/(?:QUESTION|Question)\s*:\s*([\s\S]+?)(?=(?:REPONSE|Réponse)\s*:|$)/i);
          const rMatch = txt.match(/(?:REPONSE|Réponse)\s*:\s*([\s\S]+)$/i);
          front = (qMatch ? qMatch[1].trim().replace(/\s+/g, ' ').slice(0, 300) : txt.split(/(?:REPONSE|Réponse)\s*:/i)[0].trim().slice(0, 300)) || '';
          back = (rMatch ? rMatch[1].trim().replace(/\s+/g, ' ').slice(0, 125) : txt.split(/(?:REPONSE|Réponse)\s*:/i)[1]?.trim().slice(0, 125)) || '';
          if (isInvalidFlashcardContent(front) || isInvalidFlashcardContent(back)) throw new Error('Q/R invalides');
          const cardPos = await Flashcard.max('position', { where: { deck_id: deck.id } });
          await Flashcard.create({
            deck_id: deck.id,
            chapter_id: chapter.id,
            front: front.slice(0, 500),
            back: back.slice(0, 1000),
            position: (cardPos ?? -1) + 1,
          });
        } catch (e) {
          console.error('Flashcard gen:', e);
          try {
            const retryComp = await openai.chat.completions.create({
              model: 'gpt-4o-mini',
              messages: [
                { role: 'system', content: FLASHCARD_SYSTEM },
                { role: 'user', content: `Domaine : ${firstDomain}. Donne UNE question concrète et sa réponse courte (1 phrase, max 125 car). Format : QUESTION: [question] REPONSE: [réponse]` },
              ],
              max_tokens: 180,
            });
            const txt = (retryComp.choices[0]?.message?.content || '').trim();
            const qMatch = txt.match(/(?:QUESTION|Question)\s*:\s*([\s\S]+?)(?=(?:REPONSE|Réponse)\s*:|$)/i);
            const rMatch = txt.match(/(?:REPONSE|Réponse)\s*:\s*([\s\S]+)$/i);
            front = (qMatch ? qMatch[1].trim().replace(/\s+/g, ' ').slice(0, 300) : 'Quel concept clé en ' + firstDomain + ' ?');
            back = (rMatch ? rMatch[1].trim().replace(/\s+/g, ' ').slice(0, 125) : 'À compléter selon vos connaissances en ' + firstDomain + '.');
          } catch (retryErr) {
            console.error('Flashcard retry:', retryErr);
            front = 'Quel concept ou fait important en ' + firstDomain + ' ?';
            back = 'À compléter selon vos connaissances en ' + firstDomain + '.';
          }
          const cardPos = await Flashcard.max('position', { where: { deck_id: deck.id } });
          await Flashcard.create({
            deck_id: deck.id,
            chapter_id: chapter.id,
            front: front.slice(0, 500),
            back: back.slice(0, 1000),
            position: (cardPos ?? -1) + 1,
          });
        }
        addLog(`Carte ${i + 1} créée.`, 'done');
        await session.update({ generation_log: log });
      }
      addLog('Collection de révision terminée.', 'done');
      await session.update({ generation_log: log });

    await updateProgress('todos', (++step / totalSteps) * 100, 'Création des tâches à réaliser…');
    
    // Vérifier si annulé
    if (await checkCancelled()) {
      addLog('Génération annulée par l\'utilisateur.', 'error');
      await session.update({
        status: 'completed',
        generation_step: 'cancelled',
        generation_log: log,
      });
      return;
    }

    const todoDefaults = [
      { name: `Tâche liée à ${domainPro}`, tag: 'important', progress: 0 },
      { name: `Objectif personnel : ${domainsPerso[0] || 'Apprentissage'}`, tag: 'à faire', progress: 0 },
    ];
    const todoPos = await TodoItem.max('position', { where: { user_id: userId } });
    let todoPosition = (todoPos ?? -1) + 1;
    for (const t of todoDefaults) {
      await TodoItem.create({
        user_id: userId,
        name: t.name,
        tag: t.tag,
        progress: t.progress,
        position: todoPosition++,
      });
    }

    await updateProgress('note', (++step / totalSteps) * 100, 'Création de la note personnalisée…');

    const noteContent = `**Note personnalisée**\n\nDomaine pro : ${domainPro}\nDomaines perso : ${domainsPerso.join(', ')}\n\n${responses.autre_chose || 'Espace pour vos notes.'}`;
    await Note.create({
      user_id: userId,
      title: 'Ma note personnalisée',
      content: noteContent.slice(0, 5000),
    });

    await updateProgress('routines', (++step / totalSteps) * 100, 'Création des routines…');

    const routineLabels = [
      `Matin : révision ${domainsPerso[0] || 'apprentissage'}`,
      `Pause méridienne : lecture`,
      `Soir : récap ${domainPro}`,
      `Fin de journée : planification`,
    ];
    const routinePos = await Routine.max('position', { where: { user_id: userId } });
    let routinePosition = (routinePos ?? -1) + 1;
    for (let i = 0; i < 4; i++) {
      await Routine.create({
        user_id: userId,
        label: routineLabels[i] || `Routine ${i + 1}`,
        position: routinePosition++,
        day_of_week: (i % 7),
      });
    }

    const progressAtBibliothequeStart = (step / totalSteps) * 100; // ~50%
    await updateProgress('bibliotheque', progressAtBibliothequeStart, 'Génération du contenu de la bibliothèque…');
    
    // Vérifier si annulé
    if (await checkCancelled()) {
      addLog('Génération annulée par l\'utilisateur.', 'error');
      await session.update({
        status: 'completed',
        generation_step: 'cancelled',
        generation_log: log,
      });
      return;
    }

    // Un seul domaine de bibliothèque généré lors de l'onboarding (firstDomain).
    // Même génération que Productivité > Markdown > Générer avec IA : structure → chapitres → sections
    const domainName = firstDomain;
    const domainDescription = domainName;
    const formationMode = markdownGenerationService.inferFormationMode(domainDescription);
    addLog(`Création du domaine de la bibliothèque : "${domainName}"…`, 'running');
    await session.update({ generation_log: log });

    const mdPos = await MarkdownDomain.max('position', { where: { user_id: userId } });
    const mdDomain = await MarkdownDomain.create({
      user_id: userId,
      name: domainName,
      description: 'Contenu personnalisé sur ' + domainName,
      position: (mdPos ?? -1) + 1,
    });
    addLog('Domaine "' + domainName + '" créé.', 'done');
    await session.update({ generation_log: log });

    let structure = await markdownGenerationService.generateStructure(domainDescription, formationMode);
    if (!structure || !structure.chapters?.length) {
      addLog('Structure échouée, nouvelle tentative…', 'running');
      structure = await markdownGenerationService.generateStructure(domainDescription, formationMode);
    }
    if (!structure || !structure.chapters?.length) {
      addLog('Utilisation de la structure de secours…', 'running');
      structure = markdownGenerationService.getFallbackStructure(domainDescription);
    }

    if (isRushMode()) {
      structure = {
        name: structure.name,
        description: structure.description,
        chapters: structure.chapters.slice(0, 1).map((ch) => ({
          title: ch.title,
          sections: (ch.sections || []).slice(0, 1),
        })),
      };
      addLog('Mode accéléré : structure réduite (1 chapitre, 1 section).', 'running');
    }

    await mdDomain.update({ name: structure.name, description: structure.description });

    // Progression fine pendant la bibliothèque : 50% → 100% selon structure + chapitres + sections
    const totalBibliothequeSteps =
      1 +
      structure.chapters.length +
      structure.chapters.reduce((acc, c) => acc + (c.sections || []).length, 0);
    let bibliothequeStep = 0;
    const updateBibliothequeProgress = async (label) => {
      bibliothequeStep += 1;
      const p = progressAtBibliothequeStart + ((100 - progressAtBibliothequeStart) * bibliothequeStep) / totalBibliothequeSteps;
      await session.update({
        generation_step: label,
        generation_progress: Math.round(Math.min(99, p)),
        generation_log: log,
      });
    };

    bibliothequeStep += 1;
    await session.update({
      generation_step: 'Structure',
      generation_progress: Math.round(progressAtBibliothequeStart + ((100 - progressAtBibliothequeStart) * bibliothequeStep) / totalBibliothequeSteps),
      generation_log: log,
    });

    const previousChaptersWithSections = [];
    for (let i = 0; i < structure.chapters.length; i++) {
      // Vérifier si annulé avant chaque chapitre
      if (await checkCancelled()) {
        addLog('Génération annulée par l\'utilisateur.', 'error');
        await session.update({
          status: 'completed',
          generation_step: 'cancelled',
          generation_log: log,
        });
        return;
      }
      
      const ch = structure.chapters[i];
      addLog(`Génération chapitre ${i + 1}/${structure.chapters.length} : ${ch.title}…`, 'running');
      await session.update({ generation_log: log });

      let chResult;
      if (isRushMode()) {
        chResult = {
          title: ch.title,
          content: '## ' + ch.title + '\n\nIntroduction au domaine. Complétez selon vos recherches.',
        };
      } else {
        chResult = await markdownGenerationService.generateChapterContent(
          structure.name || domainName,
          structure,
          i,
          previousChaptersWithSections,
          formationMode
        );
      }

      if (!chResult?.content) {
        addLog(`Avertissement : chapitre ${i + 1} non créé (génération vide).`, 'running');
        continue;
      }

      await updateBibliothequeProgress(`Chapitre ${i + 1}/${structure.chapters.length}`);

      const chContent = chResult.content;
      const chPos = await MarkdownChapter.max('position', { where: { domain_id: mdDomain.id } });
      const chapter = await MarkdownChapter.create({
        domain_id: mdDomain.id,
        title: chResult.title || ch.title,
        content: chContent,
        position: (chPos ?? -1) + 1,
      });

      const sections = ch.sections || [];
      const previousSectionsInChapter = [];
      const chapterSectionsForContext = [];

      for (let j = 0; j < sections.length; j++) {
        // Vérifier si annulé avant chaque section
        if (await checkCancelled()) {
          addLog('Génération annulée par l\'utilisateur.', 'error');
          await session.update({
            status: 'completed',
            generation_step: 'cancelled',
            generation_log: log,
          });
          return;
        }
        
        addLog(`Génération sous-chapitre ${j + 1}/${sections.length} du chapitre ${i + 1}…`, 'running');
        await session.update({ generation_log: log });

        let secResult;
        if (isRushMode()) {
          secResult = null;
        } else {
          secResult = await markdownGenerationService.generateSectionContent(
            structure.name || domainName,
            structure,
            chResult.title || ch.title,
            chContent,
            sections[j].title,
            previousSectionsInChapter,
            formationMode
          );
        }

        // Toujours créer la section, même si la génération a échoué (contenu minimal retourné)
        if (secResult) {
          const secPos = await MarkdownSection.max('position', { where: { chapter_id: chapter.id } });
          await MarkdownSection.create({
            chapter_id: chapter.id,
            title: secResult.title,
            content: secResult.content,
            position: (secPos ?? -1) + 1,
          });
          previousSectionsInChapter.push({ title: secResult.title, content: secResult.content });
          chapterSectionsForContext.push({ title: secResult.title, content: secResult.content });
          
          // Vérifier si c'est un contenu minimal (génération échouée)
          if (secResult.content.includes('Contenu à compléter selon vos recherches')) {
            addLog(`Sous-chapitre ${j + 1} créé avec contenu minimal (génération partiellement échouée)`, 'running');
          } else {
            addLog(`Sous-chapitre ${j + 1} créé avec succès`, 'done');
          }
        } else {
          // Si secResult est null (ne devrait pas arriver avec le nouveau code), créer quand même une section vide
          addLog(`Avertissement : sous-chapitre ${j + 1} non créé (génération vide). Création d'une section vide.`, 'running');
          const secPos = await MarkdownSection.max('position', { where: { chapter_id: chapter.id } });
          await MarkdownSection.create({
            chapter_id: chapter.id,
            title: sections[j].title,
            content: `### ${sections[j].title}\n\nContenu à compléter selon vos recherches sur ce sujet.`,
            position: (secPos ?? -1) + 1,
          });
          previousSectionsInChapter.push({ title: sections[j].title, content: '' });
          chapterSectionsForContext.push({ title: sections[j].title, content: '' });
        }
        await updateBibliothequeProgress(`Sous-ch. ${j + 1}/${sections.length}`);
      }

      previousChaptersWithSections.push({
        title: chResult.title || ch.title,
        content: chContent,
        sections: chapterSectionsForContext,
      });
      addLog(`Chapitre ${i + 1} créé.`, 'done');
      await session.update({ generation_log: log });
    }

    addLog('Configuration terminée avec succès.', 'done');
    await session.update({
      status: 'completed',
      generation_progress: 100,
      generation_step: 'done',
      generation_log: log,
    });
    
    // Mettre onboarding_completed_at seulement maintenant que la génération est vraiment terminée
    const user = await User.findByPk(userId);
    if (user && !user.onboarding_completed_at) {
      await user.update({ onboarding_completed_at: new Date() });
    }
  } catch (err) {
    console.error('runGenerationJob error:', err);
    addLog(`Erreur : ${err.message}`, 'error');
    await session.update({
      generation_step: 'error',
      status: 'completed',
      generation_log: log,
    });
    
    // Mettre onboarding_completed_at même en cas d'erreur pour éviter que l'utilisateur reste bloqué
    const user = await User.findByPk(userId);
    if (user && !user.onboarding_completed_at) {
      await user.update({ onboarding_completed_at: new Date() });
    }
  }
}

module.exports = {
  STEP_KEYS,
  STEP_MESSAGES,
  parseMinutesFromText,
  getMissingDays,
  getNextStep,
  isResponseAppropriate,
  runGenerationJob,
  generateMarkdownContent,
  cleanDomainName,
  generateDomainLabelsOneWord,
  buildDomaineResumeMessage,
};

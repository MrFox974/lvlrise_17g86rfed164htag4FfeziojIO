/**
 * Service onboarding IA : conversation, parsing des réponses, génération de contenu.
 * Garde-fous : l'assistant reste strictement concentré sur la configuration et refuse
 * les demandes hors-sujet, obscènes ou inappropriées.
 */

const OpenAI = require('openai').default;
const User = require('../models/User');
const TodoItem = require('../models/TodoItem');
const FlashcardDeck = require('../models/FlashcardDeck');
const FlashcardChapter = require('../models/FlashcardChapter');
const Flashcard = require('../models/Flashcard');
const Routine = require('../models/Routine');
const OnboardingSession = require('../models/OnboardingSession');

const STEP_KEYS = [
  'intro',
  'metier_actuel',
  'passion',
  'domaines_perso_3',
  'domaine_perso_resume',
  'domaine_pro_1',
  'domaine_pro_resume',
  'autre_chose',
  'fin',
];

const STEP_MESSAGES = {
  intro: 'Bonjour ! Je vais vous aider à configurer votre espace d\'apprentissage personnalisé. C\'est rapide et ça va vraiment faire la différence pour votre routine.\n\nPour commencer, dites-moi simplement ce qui vous motive dans la vie ?',
  metier_actuel: "Merci.\n\nEt dans votre vie professionnelle, que faites-vous actuellement ?",
  passion: "Super !\n\nEt côté passions, qu'est-ce qui vous anime en dehors du travail ?",
  domaines_perso_3: "Génial ! Maintenant, si vous deviez choisir 1 à 3 domaines pour votre développement personnel, lesquels seraient-ils ?\n\nCes derniers sont ceux que vous souhaiteriez apprendre (ex : La rhétorique, la philosophie, L'équitation...)\n\nVous pouvez les séparer par des virgules.",
  domaine_perso_resume: null,
  domaine_pro_1: "Parfait ! Et pour votre développement professionnel, quel domaine souhaitez-vous maîtriser ?",
  domaine_pro_resume: null,
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
/**
 * Prochaine étape après avoir reçu une réponse.
 */
function getNextStep(stepIndex, responses, rawAnswer) {
  const key = STEP_KEYS[stepIndex];
  if (!key) return stepIndex;

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
        return STEP_KEYS.indexOf('autre_chose');
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
/**
 * Génère `count` paires question/réponse sur un sujet, en un seul appel.
 * Ne rejette jamais : en cas d'échec ou de contenu invalide, complète avec des
 * cartes à compléter par l'utilisateur, pour que l'onboarding aboutisse.
 */
async function generateFlashcardPairs(subject, count) {
  const fallback = (i) => ({
    front: `Quel concept clé en ${subject} ? (${i + 1})`,
    back: `À compléter selon vos connaissances en ${subject}.`,
  });

  let pairs = [];
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: FLASHCARD_SYSTEM },
        {
          role: 'user',
          content: `Sujet : "${subject}". Génère exactement ${count} paires question/réponse de révision sur ce sujet uniquement.
- Question : une vraie question de révision (définition, concept, fait). Pas de question générique.
- Réponse : une phrase courte et factuelle, 125 caractères maximum, sans liste.
Une paire par ligne, format strict :
QUESTION: [question] REPONSE: [réponse]`,
        },
      ],
      max_tokens: 160 * count,
    });

    const text = (completion.choices[0]?.message?.content || '').trim();
    if (isInvalidFlashcardContent(text)) throw new Error('Contenu flashcard invalide');

    const re = /(?:QUESTION|Question)\s*:\s*([\s\S]+?)(?:REPONSE|Réponse)\s*:\s*([^\n]+)/gi;
    let match;
    while ((match = re.exec(text)) !== null && pairs.length < count) {
      const front = match[1].trim().replace(/\s+/g, ' ').slice(0, 300);
      const back = match[2].trim().replace(/\s+/g, ' ').slice(0, 125);
      if (!front || !back) continue;
      if (isInvalidFlashcardContent(front) || isInvalidFlashcardContent(back)) continue;
      pairs.push({ front, back });
    }
  } catch (err) {
    console.error('generateFlashcardPairs:', err);
  }

  while (pairs.length < count) pairs.push(fallback(pairs.length));
  return pairs;
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

  // Une étape par collection à créer, plus les to-do et les routines.
  const totalSteps = domainsPerso.filter(Boolean).length + (domainPro ? 1 : 0) + 2;
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

  /** Clôt la session si l'utilisateur a annulé ; l'appelant s'arrête alors. */
  const bailIfCancelled = async () => {
    if (!(await checkCancelled())) return false;
    addLog("Génération annulée par l'utilisateur.", 'error');
    await session.update({
      status: 'completed',
      generation_step: 'cancelled',
      generation_log: log,
    });
    return true;
  };

  try {
    addLog('Démarrage de la configuration…', 'running');
    await session.update({ generation_log: log });

    if (await bailIfCancelled()) return;

    // Une collection de flashcards par sujet retenu pendant l'entretien :
    // les sujets perso, puis le sujet pro.
    const subjects = [
      ...domainsPerso.map((name) => ({ name, kind: 'perso' })),
      { name: domainPro, kind: 'pro' },
    ].filter((s) => s.name);

    const cardsPerDeck = isRushMode() ? 2 : 5;
    if (isRushMode()) addLog('Mode accéléré : contenu réduit pour terminer rapidement.', 'running');

    for (const subject of subjects) {
      await updateProgress(
        'flashcards',
        (++step / totalSteps) * 100,
        `Collection « ${subject.name} »…`
      );
      if (await bailIfCancelled()) return;

      const deckPos = await FlashcardDeck.max('position', { where: { user_id: userId } });
      const deck = await FlashcardDeck.create({
        user_id: userId,
        name: subject.name.slice(0, 255),
        description: `Cartes de révision — ${subject.name}`,
        position: (deckPos ?? -1) + 1,
      });
      const chPos = await FlashcardChapter.max('position', { where: { deck_id: deck.id } });
      const chapter = await FlashcardChapter.create({
        deck_id: deck.id,
        title: 'Bases',
        position: (chPos ?? -1) + 1,
      });

      const pairs = await generateFlashcardPairs(subject.name, cardsPerDeck);
      let cardPosition = 0;
      for (const pair of pairs) {
        await Flashcard.create({
          deck_id: deck.id,
          chapter_id: chapter.id,
          front: pair.front.slice(0, 500),
          back: pair.back.slice(0, 1000),
          position: cardPosition++,
        });
      }
      addLog(`Collection « ${subject.name} » : ${pairs.length} cartes.`, 'done');
      await session.update({ generation_log: log });
    }

    await updateProgress('todos', (++step / totalSteps) * 100, 'Création des tâches à réaliser…');
    if (await bailIfCancelled()) return;

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

    await updateProgress('routines', (++step / totalSteps) * 100, 'Création des routines…');

    const routineLabels = [
      `Matin : révision ${domainsPerso[0] || 'apprentissage'}`,
      'Pause méridienne : lecture',
      `Soir : récap ${domainPro}`,
      'Fin de journée : planification',
    ];
    const routinePos = await Routine.max('position', { where: { user_id: userId } });
    let routinePosition = (routinePos ?? -1) + 1;
    for (let i = 0; i < routineLabels.length; i++) {
      await Routine.create({
        user_id: userId,
        label: routineLabels[i],
        position: routinePosition++,
        day_of_week: i % 7,
      });
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
  getNextStep,
  isResponseAppropriate,
  runGenerationJob,
  cleanDomainName,
  generateDomainLabelsOneWord,
  buildDomaineResumeMessage,
};

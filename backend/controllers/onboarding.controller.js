const User = require('../models/User');
const OnboardingSession = require('../models/OnboardingSession');
const onboardingAiService = require('../services/onboarding-ai.service');
const { isLambda, invokeWorkerAsync } = require('../utils/invoke-worker');
const TodoItem = require('../models/TodoItem');
const Routine = require('../models/Routine');
const FlashcardDeck = require('../models/FlashcardDeck');
const FlashcardChapter = require('../models/FlashcardChapter');
const Flashcard = require('../models/Flashcard');
/**
 * POST /api/onboarding/quick-start
 * Pré-configuration « commencer rapidement » : une collection de flashcards,
 * une semaine de routines et quelques tâches, de quoi voir l'application
 * remplie sans passer par l'entretien.
 */
exports.quickStart = async (req, res) => {
  try {
    const userId = req.user_id;
    if (!userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(401).json({ error: 'Session invalide ou compte supprimé. Reconnectez-vous.' });
    }

    // ─── Flashcards : collection Réthorique + 3 groupes + 3 cartes/groupe ───
    const deckCount = await FlashcardDeck.count({ where: { user_id: userId } });
    if (deckCount === 0) {
      const deckPos = await FlashcardDeck.max('position', { where: { user_id: userId } });
      const deck = await FlashcardDeck.create({
        user_id: userId,
        name: 'Réthorique',
        description: 'Collection pour maîtriser les bases de la rhétorique : ethos, pathos, logos, figures de style et structure du discours.',
        position: (deckPos ?? -1) + 1,
      });

      const chapters = [
        {
          title: 'Chapitre 1. Réthorique',
          cards: [
            { front: 'Quels sont les trois modes de persuasion selon Aristote ?', back: "L'ethos (crédibilité), le pathos (émotions) et le logos (argumentation logique)." },
            { front: "Qu'est-ce que l'ethos ?", back: "L'ethos désigne la crédibilité et le caractère de l'orateur ; le public doit lui faire confiance." },
            { front: "Qu'est-ce que le pathos ?", back: 'Le pathos vise à toucher les émotions du public pour le convaincre ou le persuader.' },
          ],
        },
        {
          title: 'Chapitre 2. Réthorique',
          cards: [
            { front: "Qu'est-ce qu'une métaphore ?", back: 'Une figure de style qui établit une comparaison implicite (ex. : « Cette femme est un soleil »).' },
            { front: "Qu'est-ce qu'une antithèse ?", back: 'Figure qui oppose deux idées ou deux termes dans une même phrase pour souligner un contraste.' },
            { front: "Qu'est-ce que l'anaphore ?", back: "Répétition d'un même mot ou groupe de mots en début de phrase ou de vers." },
          ],
        },
        {
          title: 'Chapitre 3. Réthorique',
          cards: [
            { front: "Quelle est la structure classique d'un discours ?", back: 'Exorde (introduction), narration (exposé des faits), argumentation, péroraison (conclusion).' },
            { front: "À quoi sert l'exorde ?", back: "À capter l'attention, établir la crédibilité et annoncer le sujet du discours." },
            { front: "Qu'est-ce que la péroraison ?", back: "La conclusion du discours, qui résume les arguments et appelle à l'action ou à l'émotion." },
          ],
        },
      ];

      let chapterPosition = 0;
      let cardPosition = 0;
      for (const ch of chapters) {
        const chapter = await FlashcardChapter.create({
          deck_id: deck.id,
          title: ch.title,
          position: chapterPosition++,
        });
        for (const card of ch.cards) {
          await Flashcard.create({
            deck_id: deck.id,
            chapter_id: chapter.id,
            front: card.front,
            back: card.back,
            position: cardPosition++,
          });
        }
      }
    }

    // ─── Routines : une base pour chaque jour de la semaine ────────────────
    const routineCount = await Routine.count({ where: { user_id: userId } });
    if (routineCount === 0) {
      const routineLabels = ['Réviser 10 cartes', 'Lecture 20 min', 'Planifier la journée'];
      const routinePos = await Routine.max('position', { where: { user_id: userId } });
      let position = (routinePos ?? -1) + 1;
      // day_of_week : 0 = lundi … 6 = dimanche.
      for (let day = 0; day < 7; day++) {
        for (const label of routineLabels) {
          await Routine.create({
            user_id: userId,
            label,
            day_of_week: day,
            position: position++,
          });
        }
      }
    }

    // ─── 3 tâches To Do (tags et états d'avancement différents) ────────────
    const todoCount = await TodoItem.count({ where: { user_id: userId } });
    if (todoCount === 0) {
      const defaultTodos = [
        { name: 'Finaliser le rapport trimestriel', tag: 'absolue', progress: 70 },
        { name: 'Préparer la présentation client', tag: 'important', progress: 30 },
        { name: "Idée : atelier d'équipe sur la rétro", tag: 'idée', progress: 0 },
      ];
      const todoPos = await TodoItem.max('position', { where: { user_id: userId } });
      let position = (todoPos ?? -1) + 1;
      for (const t of defaultTodos) {
        await TodoItem.create({
          user_id: userId,
          name: t.name,
          tag: t.tag,
          progress: t.progress,
          position: position++,
        });
      }
    }

    await user.update({ onboarding_completed_at: new Date() });

    res.status(201).json({ success: true, message: 'Pré-configuration quick start créée.' });
  } catch (error) {
    console.error('Erreur lors du quick start onboarding:', error);
    res.status(500).json({
      error: 'Erreur serveur',
      details: error.message,
    });
  }
};

/**
 * GET /api/onboarding/status
 * Retourne si l'utilisateur doit voir l'onboarding (pas de domaines) ou le home.
 * Si la génération est en cours, on redirige vers /home avec popup.
 */
exports.getStatus = async (req, res) => {
  try {
    const userId = req.user_id;
    if (!userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }
    const user = await User.findByPk(userId, { attributes: ['onboarding_completed_at'] });
    const session = await OnboardingSession.findOne({ where: { user_id: userId } });
    
    console.log('[getStatus] userId:', userId);
    console.log('[getStatus] user.onboarding_completed_at:', user?.onboarding_completed_at);
    console.log('[getStatus] session:', session ? { id: session.id, status: session.status, user_id: session.user_id } : 'null');
    
    const isGenerating = !!session && session.status === 'generating';
    console.log('[getStatus] isGenerating:', isGenerating);
    
    // Si onboarding_completed_at existe ET qu'il n'y a pas de génération en cours, alors l'onboarding est terminé
    if (user?.onboarding_completed_at && !isGenerating) {
      console.log('[getStatus] Onboarding terminé (onboarding_completed_at existe et pas de génération)');
      return res.json({ needsOnboarding: false, isGenerating: false });
    }
    
    // Sinon, vérifier le reste
    const deckCount = await FlashcardDeck.count({ where: { user_id: userId } });
    const needsOnboarding = deckCount === 0 && !isGenerating;
    console.log('[getStatus] deckCount:', deckCount, 'needsOnboarding:', needsOnboarding);
    res.json({ needsOnboarding, isGenerating });
  } catch (error) {
    console.error('Erreur getStatus onboarding:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

/**
 * GET /api/onboarding/ai-session
 * Récupère ou crée la session IA, retourne l'étape actuelle et les données.
 */
exports.getAiSession = async (req, res) => {
  try {
    const userId = req.user_id;
    if (!userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }
    let session = await OnboardingSession.findOne({ where: { user_id: userId } });
    if (!session) {
      session = await OnboardingSession.create({
        user_id: userId,
        step_index: 0,
        responses: {},
        status: 'in_progress',
      });
    }
    const key = onboardingAiService.STEP_KEYS[session.step_index];
    let message = onboardingAiService.STEP_MESSAGES[key];
    const responses = session.responses || {};

    if (key === 'domaine_perso_resume' && message == null) {
      if (responses.domaines_perso_labels) {
        message = onboardingAiService.buildDomaineResumeMessage(
          responses.domaines_perso_labels,
          responses.domaines_perso || [],
          false
        );
      } else if (responses.domaines_perso && responses.domaines_perso.length > 0) {
        const labels = await onboardingAiService.generateDomainLabelsOneWord(responses.domaines_perso);
        responses.domaines_perso_labels = labels;
        await session.update({ responses: { ...responses, domaines_perso_labels: labels } });
        message = onboardingAiService.buildDomaineResumeMessage(labels, responses.domaines_perso, false);
      }
    }
    if (key === 'domaine_pro_resume' && message == null && responses.domaine_pro) {
      if (responses.domaine_pro_label) {
        message = `Parfait ! Afin de gérer au mieux vos compétences, je résume votre domaine professionnel en 1 mot :\n\n-> **${responses.domaine_pro_label}**\n\nEst-ce bon pour vous ? (Si je dois modifier, dites-le moi)`;
      } else {
        const labels = await onboardingAiService.generateDomainLabelsOneWord([responses.domaine_pro]);
        const label = labels[0] || responses.domaine_pro.split(/\s+/)[0] || responses.domaine_pro;
        responses.domaine_pro_label = label;
        await session.update({ responses: { ...responses, domaine_pro_label: label } });
        message = `Parfait ! Afin de gérer au mieux vos compétences, je résume votre domaine professionnel en 1 mot :\n\n-> **${label}**\n\nEst-ce bon pour vous ? (Si je dois modifier, dites-le moi)`;
      }
    }

    const domainsPerso = (responses.domaines_perso || []).map((d) => onboardingAiService.cleanDomainName(d));

    res.json({
      stepIndex: session.step_index,
      stepKey: key,
      message,
      responses: session.responses,
      domainsPersoCount: domainsPerso.length,
      status: session.status,
    });
  } catch (error) {
    console.error('Erreur getAiSession:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

/**
 * POST /api/onboarding/ai-step
 * Soumet une réponse utilisateur, avance l'étape, retourne la prochaine.
 */
exports.postAiStep = async (req, res) => {
  try {
    const userId = req.user_id;
    if (!userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }
    const { answer } = req.body;
    const session = await OnboardingSession.findOne({ where: { user_id: userId } });
    if (!session || session.status !== 'in_progress') {
      return res.status(400).json({ error: 'Session invalide ou terminée' });
    }

    const responses = JSON.parse(JSON.stringify(session.responses || {}));
    const nextIndex = onboardingAiService.getNextStep(session.step_index, responses, answer);

    let message = responses._customMessage || onboardingAiService.STEP_MESSAGES[onboardingAiService.STEP_KEYS[nextIndex]];
    delete responses._customMessage;

    if (onboardingAiService.STEP_KEYS[nextIndex] === 'domaine_perso_resume' && !responses.domaines_perso_labels) {
      responses.domaines_perso_labels = await onboardingAiService.generateDomainLabelsOneWord(responses.domaines_perso || []);
      message = onboardingAiService.buildDomaineResumeMessage(responses.domaines_perso_labels, responses.domaines_perso || [], false);
    }
    if (onboardingAiService.STEP_KEYS[nextIndex] === 'domaine_pro_resume' && responses.domaine_pro && !responses.domaine_pro_label) {
      const labels = await onboardingAiService.generateDomainLabelsOneWord([responses.domaine_pro]);
      responses.domaine_pro_label = labels[0] || responses.domaine_pro.split(/\s+/)[0] || responses.domaine_pro;
      message = `Parfait ! Afin de gérer au mieux vos compétences, je résume votre domaine professionnel en 1 mot :\n\n-> **${responses.domaine_pro_label}**\n\nEst-ce bon pour vous ? (Si je dois modifier, dites-le moi)`;
    }

    await session.update({ step_index: nextIndex, responses });

    const key = onboardingAiService.STEP_KEYS[nextIndex];
    const domainsPerso = (responses.domaines_perso || []).map((d) => onboardingAiService.cleanDomainName(d));

    res.json({
      stepIndex: nextIndex,
      stepKey: key,
      message,
      responses,
      domainsPersoCount: domainsPerso.length,
    });
  } catch (error) {
    console.error('Erreur postAiStep:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

/**
 * POST /api/onboarding/ai-complete
 * Termine la conversation, lance la génération en arrière-plan.
 */
exports.postAiComplete = async (req, res) => {
  try {
    const userId = req.user_id;
    if (!userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }
    const { answer } = req.body;

    const session = await OnboardingSession.findOne({ where: { user_id: userId } });
    if (!session || session.status !== 'in_progress') {
      return res.status(400).json({ error: 'Session invalide' });
    }

    const responses = { ...(session.responses || {}) };
    if (answer != null && answer !== '') {
      responses.autre_chose = String(answer).trim().slice(0, 1000);
    }
    await session.update({
      responses,
      status: 'generating',
      generation_progress: 0,
      generation_step: 'starting',
      generation_started_at: new Date(),
      generation_cancelled: false,
    });
    
    console.log('[postAiComplete] Session mise à jour avec status=generating pour userId:', userId);
    console.log('[postAiComplete] Session après update:', await OnboardingSession.findOne({ where: { user_id: userId } }));

    // NE PAS mettre onboarding_completed_at ici !
    // En prod (Lambda) : invoker une 2e invocation pour que la génération continue après fermeture du navigateur.
    // En local : setImmediate dans le même processus.
    if (isLambda()) {
      invokeWorkerAsync({ internal: 'run-onboarding-generation', userId }).catch((err) =>
        console.error('Invoke worker run-onboarding-generation:', err)
      );
    } else {
      setImmediate(() => {
        onboardingAiService.runGenerationJob(userId).catch((err) => {
          console.error('Generation job error:', err);
        });
      });
    }

    res.status(200).json({
      success: true,
      message: 'Génération en cours',
      redirectTo: '/home',
    });
  } catch (error) {
    console.error('Erreur postAiComplete:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

/**
 * GET /api/onboarding/generation-status
 * Retourne la progression réelle de la génération.
 */
exports.getGenerationStatus = async (req, res) => {
  try {
    const userId = req.user_id;
    if (!userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }
    const user = await User.findByPk(userId, { attributes: ['onboarding_completed_at'] });
    if (user?.onboarding_completed_at) {
      return res.json({ progress: 100, step: 'done', completed: true, log: [] });
    }
    const session = await OnboardingSession.findOne({ where: { user_id: userId } });
    if (!session) {
      return res.json({ progress: 0, step: null, completed: true, log: [] });
    }
    if (session.status !== 'generating') {
      return res.json({ progress: 100, step: 'done', completed: true, log: [] });
    }
    res.json({
      progress: session.generation_progress ?? 0,
      step: session.generation_step,
      completed: false,
      log: session.generation_log || [],
    });
  } catch (error) {
    console.error('Erreur getGenerationStatus:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

/**
 * POST /api/onboarding/cancel-generation
 * Annule la génération en cours. Si < 1 minute, ne compte pas dans le quota.
 */
exports.cancelGeneration = async (req, res) => {
  try {
    const userId = req.user_id;
    if (!userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }
    
    const session = await OnboardingSession.findOne({ where: { user_id: userId } });
    if (!session || session.status !== 'generating') {
      return res.status(400).json({ error: 'Aucune génération en cours' });
    }
    
    if (session.generation_cancelled) {
      return res.status(400).json({ error: 'Génération déjà annulée' });
    }
    
    const startedAt = session.generation_started_at || session.updated_at;
    const durationMs = Date.now() - new Date(startedAt).getTime();
    const durationMinutes = durationMs / (1000 * 60);
    const countsAsGeneration = durationMinutes >= 1;
    
    // Marquer comme annulé
    await session.update({
      generation_cancelled: true,
      status: 'completed',
      generation_step: 'cancelled',
      generation_log: [
        ...(session.generation_log || []),
        {
          message: `Génération annulée par l'utilisateur${countsAsGeneration ? ' (compte dans le quota)' : ' (ne compte pas dans le quota, < 1 min)'}.`,
          status: 'error',
          at: new Date().toISOString(),
        },
      ],
    });
    
    res.json({
      success: true,
      message: 'Génération annulée',
      countsAsGeneration,
      durationMinutes: Math.round(durationMinutes * 10) / 10,
    });
  } catch (error) {
    console.error('Erreur cancelGeneration:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

/**
 * POST /api/onboarding/resume-generation
 * Reprend la génération de l'onboarding depuis le point d'arrêt.
 */
exports.resumeGeneration = async (req, res) => {
  try {
    const userId = req.user_id;
    if (!userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }
    
    const session = await OnboardingSession.findOne({ where: { user_id: userId } });
    if (!session) {
      return res.status(404).json({ error: 'Session d\'onboarding introuvable' });
    }
    
    // Vérifier que la génération est en erreur ou bloquée
    if (session.status === 'generating' && !session.generation_cancelled) {
      // Si la génération est toujours en cours, vérifier si elle est vraiment bloquée
      const startedAt = session.generation_started_at || session.updated_at;
      const durationMs = Date.now() - new Date(startedAt).getTime();
      const durationMinutes = durationMs / (1000 * 60);
      
      // Si la génération a démarré il y a plus de 20 minutes et n'est pas terminée, considérer comme bloquée
      if (durationMinutes < 20 && session.generation_progress < 100) {
        return res.status(400).json({ 
          error: 'La génération est toujours en cours. Attendez quelques instants ou annulez-la d\'abord.' 
        });
      }
    }
    
    if (session.status === 'completed' && session.generation_progress === 100) {
      return res.status(400).json({ error: 'La génération est déjà terminée' });
    }
    
    if (session.generation_cancelled) {
      return res.status(400).json({ error: 'La génération a été annulée. Vous devez recommencer l\'onboarding.' });
    }
    
    // Réinitialiser le statut pour reprendre
    const log = session.generation_log || [];
    log.push({
      message: 'Reprise de la génération depuis le point d\'arrêt...',
      status: 'running',
      at: new Date().toISOString(),
    });
    
    await session.update({
      status: 'generating',
      generation_cancelled: false,
      generation_log: log,
      generation_started_at: new Date(), // Redémarrer le timer
    });
    
    // Relancer la génération en arrière-plan (local = setImmediate, Lambda = invoke async)
    if (isLambda()) {
      invokeWorkerAsync({ internal: 'run-onboarding-generation', userId }).catch((err) =>
        console.error('Invoke worker run-onboarding-generation (resume):', err)
      );
    } else {
      setImmediate(() => {
        onboardingAiService.runGenerationJob(userId).catch((err) => {
          console.error('Erreur lors de la reprise de la génération:', err);
        });
      });
    }

    res.json({
      success: true,
      message: 'Reprise de la génération démarrée',
    });
  } catch (error) {
    console.error('Erreur resumeGeneration:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

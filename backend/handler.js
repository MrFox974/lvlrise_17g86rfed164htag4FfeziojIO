// handler.js (Lambda)
const serverless = require('serverless-http');
const app = require('./app');

const serverlessHandler = serverless(app, {
  binary: ['image/*', 'application/pdf'],
});

// Le cron des notifications a son propre point d'entrée : voir scheduler.js.

module.exports.handler = async (event, context) => {
  try {
    // Invocation interne (worker) : pas de requestContext = payload custom (Lambda Invoke), pas une requête HTTP
    if (event && !event.requestContext && event.internal === 'run-flashcard-generation' && event.jobId != null) {
      await app.dbReadyPromise;
      const { runFlashcardGenerationJob } = require('./jobs/flashcard-generation-job');
      await runFlashcardGenerationJob(Number(event.jobId));
      return { statusCode: 200, body: '' };
    }
    if (event && !event.requestContext && event.internal === 'run-flashcard-single-card' && event.jobId != null) {
      await app.dbReadyPromise;
      const { runFlashcardSingleCardJob } = require('./jobs/flashcard-single-card-job');
      await runFlashcardSingleCardJob(Number(event.jobId));
      return { statusCode: 200, body: '' };
    }
    if (event && !event.requestContext && event.internal === 'run-flashcard-complete' && event.jobId != null) {
      await app.dbReadyPromise;
      const { runFlashcardCompleteJob } = require('./jobs/flashcard-complete-job');
      await runFlashcardCompleteJob(Number(event.jobId));
      return { statusCode: 200, body: '' };
    }
    if (event && !event.requestContext && event.internal === 'run-onboarding-generation' && event.userId != null) {
      await app.dbReadyPromise;
      const onboardingAiService = require('./services/onboarding-ai.service');
      await onboardingAiService.runGenerationJob(Number(event.userId));
      return { statusCode: 200, body: '' };
    }

    await app.dbReadyPromise;
    const result = await serverlessHandler(event, context);
    return result;
  } catch (error) {
    console.error('Lambda handler error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message,
      }),
    };
  }
};

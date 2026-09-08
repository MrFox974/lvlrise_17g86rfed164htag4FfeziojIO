/**
 * Utilitaire pour lancer le job de génération en arrière-plan.
 * - En local : pas d'invocation (le controller utilise setImmediate).
 * - En Lambda : invoque la même fonction en async pour que le job continue après la 202.
 */

const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');

const isLambda = () => !!process.env.AWS_LAMBDA_FUNCTION_NAME;

/**
 * Invoque la même Lambda en asynchrone (InvocationType: Event).
 * Ne bloque pas ; le job s'exécutera dans une nouvelle invocation.
 * @param {{ internal: string, domainId?: number, userId?: number }} payload
 */
async function invokeWorkerAsync(payload) {
  if (!isLambda()) return;
  const functionName = process.env.AWS_LAMBDA_FUNCTION_NAME;
  if (!functionName) return;

  const client = new LambdaClient({ region: process.env.AWS_REGION || 'eu-west-3' });
  await client.send(
    new InvokeCommand({
      FunctionName: functionName,
      InvocationType: 'Event',
      Payload: JSON.stringify(payload),
    })
  );
}

module.exports = { isLambda, invokeWorkerAsync };

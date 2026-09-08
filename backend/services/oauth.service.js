/**
 * Service OAuth pour Google et Apple.
 * Vérifie les tokens et récupère les infos utilisateur.
 */
const { OAuth2Client } = require('google-auth-library');
const verifyAppleIdToken = require('verify-apple-id-token').default;

/**
 * Vérifie le token Google ID et retourne les claims (sub, email, name, picture)
 * @param {string} idToken - Token ID Google
 * @returns {Promise<{ sub: string, email?: string, name?: string, picture?: string }>}
 */
async function verifyGoogleToken(idToken) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId || !clientId.trim()) {
    throw new Error('GOOGLE_CLIENT_ID doit être défini pour la connexion Google.');
  }

  const client = new OAuth2Client(clientId);
  const ticket = await client.verifyIdToken({
    idToken,
    audience: clientId,
  });

  const payload = ticket.getPayload();
  return {
    sub: payload.sub,
    email: payload.email,
    email_verified: payload.email_verified,
    name: payload.name,
    given_name: payload.given_name,
    family_name: payload.family_name,
    picture: payload.picture,
  };
}

/**
 * Vérifie le token Apple identityToken et retourne les claims
 * @param {string} idToken - Apple identityToken (JWT)
 * @param {string} [userName] - Nom complet fourni par Apple (première connexion uniquement)
 * @returns {Promise<{ sub: string, email?: string, email_verified?: boolean }>}
 */
async function verifyAppleToken(idToken, userName = null) {
  const clientId = process.env.APPLE_CLIENT_ID;
  if (!clientId || !clientId.trim()) {
    throw new Error('APPLE_CLIENT_ID doit être défini pour la connexion Apple.');
  }

  const jwtClaims = await verifyAppleIdToken({
    idToken,
    clientId,
  });

  return {
    sub: jwtClaims.sub,
    email: jwtClaims.email,
    email_verified: jwtClaims.email_verified,
    // Apple fournit le nom uniquement à la première connexion côté client
    name: userName || null,
  };
}

module.exports = {
  verifyGoogleToken,
  verifyAppleToken,
};

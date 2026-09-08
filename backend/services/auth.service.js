const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const EmailVerificationToken = require('../models/EmailVerificationToken');
const PendingRegistration = require('../models/PendingRegistration');
const crypto = require('crypto');
const { verifyGoogleToken, verifyAppleToken } = require('./oauth.service');
const emailService = require('./email.service');

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
const SALT_ROUNDS = 10;

class AuthService {
  /**
   * Inscription : stocke en attente jusqu'à vérification email.
   * L'utilisateur n'est créé qu'au clic sur le lien. Permet de réessayer si le mail n'arrive pas.
   * @param {string} username
   * @param {string} email
   * @param {string} password
   * @returns {{ success: boolean, email: string, username: string }}
   */
  async register(username, email, password) {
    const emailTrimmed = email.toLowerCase().trim();
    const usernameTrimmed = username.trim();

    // Compte déjà vérifié → erreur
    const existingVerified = await User.findOne({
      where: { email: emailTrimmed, email_verified: true },
    });
    if (existingVerified) {
      throw new Error('Un compte existe déjà avec cette adresse email.');
    }

    // Ancien utilisateur non vérifié → suppression pour permettre une nouvelle inscription
    const existingUnverified = await User.findOne({
      where: { email: emailTrimmed, email_verified: false },
    });
    if (existingUnverified) {
      await EmailVerificationToken.destroy({ where: { user_id: existingUnverified.id } });
      await existingUnverified.destroy();
    }

    // Vérifier unicité du username (User + PendingRegistration sauf même email)
    const usernameInUser = await User.findOne({ where: { username: usernameTrimmed } });
    if (usernameInUser) {
      throw new Error('Ce nom d\'utilisateur est déjà pris.');
    }
    const usernameInPending = await PendingRegistration.findOne({
      where: { username: usernameTrimmed },
    });
    if (usernameInPending && usernameInPending.email !== emailTrimmed) {
      throw new Error('Ce nom d\'utilisateur est déjà pris.');
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const existing = await PendingRegistration.findOne({ where: { email: emailTrimmed } });
    if (existing) {
      await existing.update({
        username: usernameTrimmed,
        password: hashedPassword,
        token,
        expires_at: expiresAt,
      });
    } else {
      await PendingRegistration.create({
        email: emailTrimmed,
        username: usernameTrimmed,
        password: hashedPassword,
        token,
        expires_at: expiresAt,
      });
    }

    await emailService.sendVerificationEmail(emailTrimmed, usernameTrimmed, token).catch((err) => {
      console.error('[Auth] Erreur envoi email vérification:', err);
    });

    return { success: true, email: emailTrimmed, username: usernameTrimmed };
  }

  /**
   * Vérifie l'adresse email via token : crée l'utilisateur, envoie bienvenue, crée la session
   * @param {string} token
   * @returns {{ user: object, accessToken: string, refreshToken: string }}
   */
  async verifyEmail(token) {
    if (!token || typeof token !== 'string') {
      throw new Error('Token de vérification invalide.');
    }

    const tokenTrimmed = token.trim();

    // 1. Inscription en attente (nouveau flux)
    const pending = await PendingRegistration.findOne({
      where: { token: tokenTrimmed },
    });

    if (pending) {
      if (new Date() > new Date(pending.expires_at)) {
        await pending.destroy();
        throw new Error('Token expiré. Demandez un nouvel email de vérification.');
      }

      const finalUsername = await this.generateUniqueUsername(pending.username);
      const user = await User.create({
        username: finalUsername,
        email: pending.email,
        password: pending.password,
        email_verified: true,
        email_verified_at: new Date(),
      });
      await pending.destroy();

      await emailService.sendWelcomeEmail(user.email, user.username).catch((err) => {
        console.error('[Auth] Erreur envoi email bienvenue:', err);
      });

      const { accessToken, refreshToken } = await this.createTokens(user.id);
      await this.saveRefreshToken(user.id, refreshToken);

      return {
        user: { id: user.id, username: user.username, email: user.email, subscription_plan: user.subscription_plan || 'free', auth_provider: user.auth_provider || 'local', email_verified: true },
        accessToken,
        refreshToken,
      };
    }

    // 2. Ancien flux (EmailVerificationToken) — rétrocompatibilité
    const record = await EmailVerificationToken.findOne({
      where: { token: tokenTrimmed },
      include: [{ model: User }],
    });

    if (!record || !record.user) {
      throw new Error('Token invalide ou expiré. Demandez un nouvel email de vérification.');
    }

    if (new Date() > new Date(record.expires_at)) {
      await record.destroy();
      throw new Error('Token expiré. Demandez un nouvel email de vérification.');
    }

    const user = record.user;
    await user.update({
      email_verified: true,
      email_verified_at: new Date(),
    });
    await record.destroy();

    await emailService.sendWelcomeEmail(user.email, user.username).catch((err) => {
      console.error('[Auth] Erreur envoi email bienvenue:', err);
    });

    const { accessToken, refreshToken } = await this.createTokens(user.id);
    await this.saveRefreshToken(user.id, refreshToken);

    return {
      user: { id: user.id, username: user.username, email: user.email, subscription_plan: user.subscription_plan || 'free', auth_provider: user.auth_provider || 'local', email_verified: true },
      accessToken,
      refreshToken,
    };
  }

  /**
   * Renvoie un email de vérification
   * @param {string} email
   */
  async resendVerificationEmail(email) {
    const emailTrimmed = (email || '').toLowerCase().trim();
    if (!emailTrimmed) {
      throw new Error('L\'email est requis.');
    }

    // 1. Inscription en attente (nouveau flux)
    const pending = await PendingRegistration.findOne({ where: { email: emailTrimmed } });
    if (pending) {
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await pending.update({ token, expires_at: expiresAt });
      await emailService.sendVerificationEmail(pending.email, pending.username, token).catch((err) => {
        console.error('[Auth] Erreur renvoi email vérification:', err);
      });
      return { success: true, message: 'Un nouvel email de vérification a été envoyé.' };
    }

    // 2. Ancien flux (utilisateur non vérifié)
    const user = await User.findOne({ where: { email: emailTrimmed } });
    if (!user) {
      throw new Error('Aucune inscription en attente pour cette adresse. Inscrivez-vous d\'abord.');
    }

    if (user.email_verified) {
      throw new Error('Cette adresse email est déjà vérifiée. Vous pouvez vous connecter.');
    }

    await EmailVerificationToken.destroy({ where: { user_id: user.id } });
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await EmailVerificationToken.create({ user_id: user.id, token, expires_at: expiresAt });
    await emailService.sendVerificationEmail(user.email, user.username, token).catch((err) => {
      console.error('[Auth] Erreur renvoi email vérification:', err);
    });

    return { success: true, message: 'Un nouvel email de vérification a été envoyé.' };
  }

  /**
   * Connexion d'un utilisateur
   * @param {string} email
   * @param {string} password
   * @returns {{ user: object, accessToken: string, refreshToken: string }}
   */
  async login(email, password) {
    const user = await User.findOne({
      where: { email: email.toLowerCase().trim() },
    });
    if (!user) {
      throw new Error('Email ou mot de passe incorrect.');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new Error('Email ou mot de passe incorrect.');
    }

    const emailVerified = !!user.email_verified;
    if (!emailVerified) {
      throw new Error('Vérifiez votre adresse email pour vous connecter. Consultez votre boîte de réception.');
    }

    const { accessToken, refreshToken } = await this.createTokens(user.id);
    await this.saveRefreshToken(user.id, refreshToken);

    return {
      user: { id: user.id, username: user.username, email: user.email, subscription_plan: user.subscription_plan || 'free', auth_provider: user.auth_provider || 'local' },
      accessToken,
      refreshToken,
    };
  }

  /**
   * Connexion ou inscription via Google
   * @param {string} idToken - Token ID Google
   * @returns {{ user: object, accessToken: string, refreshToken: string }}
   */
  async loginWithGoogle(idToken) {
    const payload = await verifyGoogleToken(idToken);
    const googleId = payload.sub;
    const email = payload.email ? payload.email.toLowerCase().trim() : null;

    if (!email) {
      throw new Error('Google n\'a pas fourni d\'email. Assurez-vous d\'autoriser l\'accès à votre adresse email.');
    }

    let user = await User.findOne({
      where: { google_id: googleId },
    });

    if (user) {
      const { accessToken, refreshToken } = await this.createTokens(user.id);
      await this.saveRefreshToken(user.id, refreshToken);
      return {
        user: { id: user.id, username: user.username, email: user.email, subscription_plan: user.subscription_plan || 'free', auth_provider: user.auth_provider || 'local' },
        accessToken,
        refreshToken,
      };
    }

    user = await User.findOne({
      where: { email },
    });

    let isNewUser = false;
    if (user) {
      if (user.auth_provider && user.auth_provider !== 'google') {
        throw new Error(`Cet email est déjà utilisé avec une connexion ${user.auth_provider}. Connectez-vous avec votre mot de passe ou ${user.auth_provider}.`);
      }
      await user.update({ google_id: googleId, auth_provider: 'google' });
    } else {
      isNewUser = true;
      const username = await this.generateUniqueUsername(payload.name || email.split('@')[0]);
      user = await User.create({
        username,
        email,
        password: null,
        auth_provider: 'google',
        google_id: googleId,
        email_verified: true,
      });
    }

    const { accessToken, refreshToken } = await this.createTokens(user.id);
    await this.saveRefreshToken(user.id, refreshToken);
    return {
      user: { id: user.id, username: user.username, email: user.email, subscription_plan: user.subscription_plan || 'free', auth_provider: user.auth_provider || 'local' },
      accessToken,
      refreshToken,
      isNewUser,
    };
  }

  /**
   * Connexion ou inscription via Apple
   * @param {string} idToken - Apple identityToken
   * @param {string} [userName] - Nom complet (fourni par Apple à la première connexion uniquement)
   * @returns {{ user: object, accessToken: string, refreshToken: string }}
   */
  async loginWithApple(idToken, userName = null) {
    const payload = await verifyAppleToken(idToken, userName);
    const appleId = payload.sub;
    const email = payload.email ? payload.email.toLowerCase().trim() : null;

    if (!email) {
      throw new Error('Apple n\'a pas fourni d\'email. Assurez-vous d\'autoriser le partage de votre adresse email.');
    }

    let user = await User.findOne({
      where: { apple_id: appleId },
    });

    if (user) {
      const { accessToken, refreshToken } = await this.createTokens(user.id);
      await this.saveRefreshToken(user.id, refreshToken);
      return {
        user: { id: user.id, username: user.username, email: user.email, subscription_plan: user.subscription_plan || 'free', auth_provider: user.auth_provider || 'local' },
        accessToken,
        refreshToken,
      };
    }

    user = await User.findOne({
      where: { email },
    });

    let isNewUser = false;
    if (user) {
      if (user.auth_provider && user.auth_provider !== 'apple') {
        throw new Error(`Cet email est déjà utilisé avec une connexion ${user.auth_provider}. Connectez-vous avec votre mot de passe ou ${user.auth_provider}.`);
      }
      await user.update({ apple_id: appleId, auth_provider: 'apple' });
    } else {
      isNewUser = true;
      const baseName = userName || payload.name || email.split('@')[0];
      const username = await this.generateUniqueUsername(baseName);
      user = await User.create({
        username,
        email,
        password: null,
        auth_provider: 'apple',
        apple_id: appleId,
        email_verified: true,
      });
    }

    const { accessToken, refreshToken } = await this.createTokens(user.id);
    await this.saveRefreshToken(user.id, refreshToken);
    return {
      user: { id: user.id, username: user.username, email: user.email, subscription_plan: user.subscription_plan || 'free', auth_provider: user.auth_provider || 'local' },
      accessToken,
      refreshToken,
      isNewUser,
    };
  }

  /**
   * Génère un username unique à partir d'un nom de base
   * @private
   */
  async generateUniqueUsername(baseName) {
    const sanitized = (baseName || 'user')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 20) || 'user';
    let username = sanitized;
    let suffix = 0;
    while (true) {
      const existing = await User.findOne({ where: { username } });
      if (!existing) return username;
      suffix += 1;
      username = `${sanitized}${suffix}`.slice(0, 100);
    }
  }

  /**
   * Rafraîchit le token d'accès à partir du refresh token (cookie ou body)
   * @param {string} refreshToken
   * @returns {{ accessToken: string }}
   */
  async refresh(refreshToken) {
    if (!refreshToken) {
      throw new Error('Refresh token manquant.');
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
      throw new Error('Refresh token expiré ou invalide.');
    }

    const user = await User.findByPk(decoded.user_id);
    if (!user || user.refresh_token !== refreshToken) {
      throw new Error('Refresh token invalide.');
    }

    const { accessToken, refreshToken: newRefreshToken } = await this.createTokens(user.id);
    await this.saveRefreshToken(user.id, newRefreshToken);

    return {
      accessToken,
      refreshToken: newRefreshToken,
    };
  }

  /**
   * Crée les tokens JWT
   * @private
   */
  async createTokens(userId) {
    const secret = process.env.JWT_SECRET;
    const refreshSecret = process.env.JWT_REFRESH_SECRET;
    if (!secret || typeof secret !== 'string' || !secret.trim()) {
      throw new Error('JWT_SECRET doit être défini dans les variables d\'environnement (Lambda ou serverless.yml).');
    }
    if (!refreshSecret || typeof refreshSecret !== 'string' || !refreshSecret.trim()) {
      throw new Error('JWT_REFRESH_SECRET doit être défini dans les variables d\'environnement (Lambda ou serverless.yml).');
    }
    const accessToken = jwt.sign(
      { user_id: userId },
      secret,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );
    const refreshToken = jwt.sign(
      { user_id: userId, jti: crypto.randomBytes(16).toString('hex') },
      refreshSecret,
      { expiresIn: REFRESH_TOKEN_EXPIRY }
    );
    return { accessToken, refreshToken };
  }

  /**
   * Sauvegarde le refresh token en base
   * @private
   */
  async saveRefreshToken(userId, refreshToken) {
    await User.update(
      { refresh_token: refreshToken },
      { where: { id: userId } }
    );
  }

  /**
   * Change le mot de passe de l'utilisateur
   * @param {number} userId
   * @param {string} currentPassword
   * @param {string} newPassword
   */
  async changePassword(userId, currentPassword, newPassword) {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('Utilisateur non trouvé.');
    }

    if (!user.password || (user.auth_provider && user.auth_provider !== 'local')) {
      throw new Error('Les comptes connectés via Google ou Apple n\'ont pas de mot de passe à modifier.');
    }

    const isCurrentValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentValid) {
      throw new Error('Mot de passe actuel incorrect.');
    }

    const passwordRules = [
      (p) => p.length >= 8,
      (p) => /[A-Z]/.test(p),
      (p) => /[a-z]/.test(p),
      (p) => /\d/.test(p),
      (p) => /[!@#$%^&*(),.?":{}|<>]/.test(p),
    ];
    for (const rule of passwordRules) {
      if (!rule(newPassword)) {
        throw new Error('Le nouveau mot de passe ne respecte pas les critères de sécurité.');
      }
    }

    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await user.update({ password: hashedPassword });
  }

  /**
   * Supprime définitivement le compte utilisateur et toutes ses données.
   * Résilie l'abonnement (passage à free) si l'utilisateur avait un plan payant.
   * @param {number} userId
   */
  async deleteAccount(userId) {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('Utilisateur non trouvé.');
    }

    // Résilier l'abonnement si payant
    if (user.subscription_plan && user.subscription_plan !== 'free') {
      await user.update({ subscription_plan: 'free' });
    }

    // Suppression en cascade via les FK (Domain, Routine, TodoItem, Note, etc.)
    await user.destroy();
  }
}

module.exports = new AuthService();

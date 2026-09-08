const nodemailer = require('nodemailer');

/**
 * Service d'envoi d'emails via SMTP (vérification, bienvenue)
 * Nécessite : SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, FRONTEND_URL
 */
class EmailService {
  constructor() {
    this.transporter = null;
    this.enabled = false;
    this._init();
  }

  _init() {
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT || 587;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const from = process.env.SMTP_FROM || user;

    if (!host || !user || !pass) {
      console.warn('[Email] SMTP non configuré (SMTP_HOST, SMTP_USER, SMTP_PASS requis). Les emails ne seront pas envoyés.');
      return;
    }

    try {
      const portNum = Number(port);
      const isSecure = portNum === 465;
      this.transporter = nodemailer.createTransport({
        host,
        port: portNum,
        secure: isSecure,
        requireTLS: !isSecure && portNum === 587,
        auth: { user: (user || '').trim(), pass: (pass || '').trim() },
        tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
      });
      this.from = from;
      this.enabled = true;
      console.log('[Email] Service SMTP initialisé.');
    } catch (err) {
      console.error('[Email] Erreur init SMTP:', err.message);
    }
  }

  _getFrontendUrl() {
    const url = (process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'http://localhost:5173').trim().replace(/\/$/, '');
    return url;
  }

  /**
   * Envoie l'email de vérification d'adresse
   * @param {string} to - Adresse email
   * @param {string} username - Nom d'utilisateur
   * @param {string} token - Token de vérification
   */
  async sendVerificationEmail(to, username, token) {
    if (!this.enabled || !this.transporter) {
      console.warn('[Email] SMTP désactivé, email de vérification non envoyé à', to);
      return;
    }

    const verifyUrl = `${this._getFrontendUrl()}/verify-email?token=${encodeURIComponent(token)}`;
    const subject = 'Vérifiez votre adresse email — LvlRise';
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#faf9f6;">
  <div style="max-width:480px;margin:0 auto;padding:32px 24px;">
    <h1 style="color:#1e293b;font-size:1.5rem;margin-bottom:8px;">Bienvenue sur LvlRise</h1>
    <p style="color:#64748b;font-size:1rem;line-height:1.6;margin-bottom:24px;">
      Bonjour ${username || 'utilisateur'},<br><br>
      Pour activer votre compte et accéder à toutes les fonctionnalités, vérifiez votre adresse email en cliquant sur le bouton ci-dessous.
    </p>
    <a href="${verifyUrl}" style="display:inline-block;padding:14px 28px;background:#0d9488;color:#fff;text-decoration:none;font-weight:600;border-radius:12px;font-size:1rem;">Vérifier l'adresse mail</a>
    <p style="color:#94a3b8;font-size:0.875rem;margin-top:24px;">
      Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>
      <a href="${verifyUrl}" style="color:#0d9488;word-break:break-all;">${verifyUrl}</a>
    </p>
    <p style="color:#94a3b8;font-size:0.75rem;margin-top:32px;">Ce lien expire sous 24 heures. L'équipe LvlRise</p>
  </div>
</body>
</html>
`;

    await this.transporter.sendMail({
      from: this.from,
      to,
      subject,
      html,
      text: `Bonjour ${username || 'utilisateur'}, vérifiez votre adresse email en visitant : ${verifyUrl}`,
    });
    console.log('[Email] Email de vérification envoyé à', to);
  }

  /**
   * Envoie l'email de bienvenue après vérification
   * @param {string} to - Adresse email
   * @param {string} username - Nom d'utilisateur
   */
  async sendWelcomeEmail(to, username) {
    if (!this.enabled || !this.transporter) {
      console.warn('[Email] SMTP désactivé, email de bienvenue non envoyé à', to);
      return;
    }

    const subject = 'Bienvenue sur LvlRise — Tout ce que vous pouvez faire';
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#faf9f6;">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px;">
    <h1 style="color:#1e293b;font-size:1.5rem;margin-bottom:8px;">Bienvenue sur LvlRise, ${username || 'utilisateur'} !</h1>
    <p style="color:#64748b;font-size:1rem;line-height:1.6;margin-bottom:24px;">
      Votre adresse email est vérifiée. Voici un rappel des fonctionnalités pour structurer votre apprentissage :
    </p>
    <ul style="color:#475569;font-size:0.95rem;line-height:1.8;padding-left:20px;">
      <li><strong>Apprentissage</strong> — Objectifs perso et pro, jauges de progression en minutes par jour ou par semaine</li>
      <li><strong>Routines</strong> — Suivez vos habitudes quotidiennes et votre taux d'accomplissement</li>
      <li><strong>To-do list</strong> — Priorisez vos tâches (urgence, important, projet, idée)</li>
      <li><strong>Productivité</strong> — Bibliothèque Markdown, Flashcards (répétition espacée SM-2), notes rapides</li>
      <li><strong>Assistant IA</strong> — Sur les plans payants : assistance vocale et rapports hebdomadaires</li>
    </ul>
    <a href="${this._getFrontendUrl()}/home" style="display:inline-block;padding:14px 28px;background:#0d9488;color:#fff;text-decoration:none;font-weight:600;border-radius:12px;font-size:1rem;">Accéder à mon espace</a>
    <p style="color:#94a3b8;font-size:0.75rem;margin-top:32px;">L'équipe LvlRise</p>
  </div>
</body>
</html>
`;

    await this.transporter.sendMail({
      from: this.from,
      to,
      subject,
      html,
      text: `Bienvenue sur LvlRise ! Récapitulatif : Apprentissage, Routines, To-do, Productivité (Markdown, Flashcards, Notes), Assistant IA sur plans payants. Accédez à votre espace : ${this._getFrontendUrl()}/home`,
    });
    console.log('[Email] Email de bienvenue envoyé à', to);
  }
}

module.exports = new EmailService();

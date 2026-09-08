# Vérification d'adresse email

## Variables d'environnement requises

Pour activer l'envoi des emails de vérification et de bienvenue, configurez les variables suivantes dans `backend/.env` (et dans `serverless.yml` ou AWS pour la production) :

| Variable | Description | Exemple |
|----------|-------------|---------|
| `SMTP_HOST` | Serveur SMTP (envoi uniquement) | `smtp.gmail.com` |
| `SMTP_PORT` | Port SMTP (587 TLS, 465 SSL) | `587` |
| `SMTP_USER` | Utilisateur SMTP | `votre@email.com` |
| `SMTP_PASS` | Mot de passe ou mot de passe d'application | `xxxx xxxx xxxx xxxx` |
| `SMTP_FROM` | Adresse expéditrice affichée | `noreply@lvlrise.com` |
| `FRONTEND_URL` | URL du frontend (liens dans les emails) | `https://lvlrise.com` |

**Note :** IMAP et POP ne sont pas nécessaires. Seul SMTP sert à envoyer les emails.

### Exemples de fournisseurs

- **Gandi.net** : `SMTP_HOST=mail.gandi.net`, `SMTP_PORT=587`, `SMTP_USER=no-reply@lvlrise.com`, mot de passe défini à la création de la boîte. TLS activé automatiquement. **Attention** : Gandi peut bloquer les connexions depuis AWS Lambda (IP dynamiques). Si l'authentification échoue (535), préférer Brevo ou Amazon SES.
- **Gmail** : `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, mot de passe d'application (2FA requis)
- **Brevo (ex-Sendinblue)** : `SMTP_HOST=smtp-relay.brevo.com`, `SMTP_PORT=587`, clé SMTP dans Paramètres > Clés SMTP & API. Fonctionne bien depuis Lambda.
- **SendGrid** : Créer une clé API SMTP
- **Mailgun** : Utiliser les identifiants SMTP fournis

Si les variables SMTP ne sont pas configurées, les emails ne seront pas envoyés mais l'inscription continuera de fonctionner (les utilisateurs pourront demander un renvoi d'email).

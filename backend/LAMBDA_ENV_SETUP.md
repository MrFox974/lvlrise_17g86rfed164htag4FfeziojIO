# Configuration des Variables d'Environnement pour AWS Lambda

## Problème

Si vous voyez l'erreur `connect ECONNREFUSED 127.0.0.1:5432` en production Lambda, cela signifie que les variables d'environnement de la base de données ne sont pas configurées correctement dans AWS.

## Solution : Configurer les Variables dans AWS Lambda

### Option 1 : Via la Console AWS (Recommandé pour débuter)

1. Allez dans la **Console AWS** → **Lambda**
2. Sélectionnez votre fonction Lambda (ex: `backend-lambda-dev-api`)
3. Allez dans l'onglet **Configuration** → **Variables d'environnement**
4. Cliquez sur **Modifier**
5. Ajoutez les variables suivantes avec vos valeurs de production :

```
DATABASE_NAME=votre_nom_de_base
DATABASE_USER=votre_utilisateur
DATABASE_PASSWORD=votre_mot_de_passe
DATABASE_HOST=votre-endpoint-rds.xxxxx.eu-west-3.rds.amazonaws.com
DATABASE_PORT=5432
CORS_ORIGIN=https://votre-domaine-amplify.amplifyapp.com
JWT_SECRET=votre_secret_jwt
JWT_REFRESH_SECRET=votre_refresh_secret
OPENAI_API_KEY=votre_cle_openai
STRIPE_SECRET_KEY=votre_cle_stripe (si utilisé)
TELEGRAM_BOT_TOKEN=votre_token (si utilisé)
TELEGRAM_CHAT_ID=votre_chat_id (si utilisé)
```

6. Cliquez sur **Enregistrer**

### Option 2 : Via SSM Parameter Store (Recommandé pour la sécurité)

Pour les valeurs sensibles (mots de passe, clés API), utilisez AWS Systems Manager Parameter Store :

1. **Créer les paramètres dans SSM** :
   ```bash
   aws ssm put-parameter --name "/starter-project/database/password" --value "votre_mot_de_passe" --type "SecureString" --region eu-west-3
   aws ssm put-parameter --name "/starter-project/database/host" --value "votre-endpoint-rds.xxxxx.eu-west-3.rds.amazonaws.com" --type "String" --region eu-west-3
   # ... etc pour les autres variables
   ```

2. **Modifier `serverless.yml`** pour référencer SSM :
   ```yaml
   environment:
     DATABASE_PASSWORD: ${ssm:/starter-project/database/password}
     DATABASE_HOST: ${ssm:/starter-project/database/host}
     # ... etc
   ```

3. **Donner les permissions à Lambda** :
   Ajoutez la politique IAM `AmazonSSMReadOnlyAccess` au rôle d'exécution Lambda.

### Option 3 : Définir les Variables Locales Avant le Déploiement

Si vous déployez depuis votre machine locale, vous pouvez définir les variables d'environnement avant de lancer `serverless deploy` :

**Windows PowerShell** :
```powershell
$env:DATABASE_HOST="votre-endpoint-rds.xxxxx.eu-west-3.rds.amazonaws.com"
$env:DATABASE_NAME="votre_nom_de_base"
$env:DATABASE_USER="votre_utilisateur"
$env:DATABASE_PASSWORD="votre_mot_de_passe"
# ... etc
serverless deploy
```

**Linux/Mac** :
```bash
export DATABASE_HOST="votre-endpoint-rds.xxxxx.eu-west-3.rds.amazonaws.com"
export DATABASE_NAME="votre_nom_de_base"
export DATABASE_USER="votre_utilisateur"
export DATABASE_PASSWORD="votre_mot_de_passe"
# ... etc
serverless deploy
```

## Vérification

Après configuration, testez votre Lambda :
- Les logs ne doivent plus afficher `connect ECONNREFUSED 127.0.0.1:5432`
- La connexion à RDS doit fonctionner (vérifiez les logs CloudWatch)

## Notes Importantes

- ⚠️ **Ne jamais committer** les valeurs réelles dans `serverless.yml` ou `.env`
- 🔐 Utilisez **SSM Parameter Store** ou **Secrets Manager** pour les secrets en production
- 🌍 Le `DATABASE_HOST` doit être l'**endpoint RDS complet**, pas `localhost`
- 🔒 RDS nécessite **SSL** : le code active automatiquement SSL si `DATABASE_HOST` ≠ `localhost`

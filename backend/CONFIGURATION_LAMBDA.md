# Configuration des Variables d'Environnement Lambda - GUIDE RAPIDE

## ⚠️ PROBLÈME ACTUEL

Lambda essaie de se connecter à `localhost` (127.0.0.1:5432) au lieu de votre instance RDS PostgreSQL.

## ✅ SOLUTION IMMÉDIATE (5 minutes)

### Étape 1 : Ouvrir la Console AWS Lambda

1. Allez sur https://console.aws.amazon.com/lambda/
2. Sélectionnez la région **eu-west-3** (en haut à droite)
3. Cliquez sur votre fonction Lambda : **`backend-lambda-dev-api`**

### Étape 2 : Configurer les Variables d'Environnement

1. Dans l'onglet **Configuration**, cliquez sur **Variables d'environnement**
2. Cliquez sur **Modifier**
3. Cliquez sur **Ajouter une variable d'environnement** pour chaque variable ci-dessous :

#### Variables OBLIGATOIRES (Base de données) :

```
DATABASE_HOST = votre-endpoint-rds.xxxxx.eu-west-3.rds.amazonaws.com
DATABASE_NAME = starter_db (ou le nom de votre base)
DATABASE_USER = postgres (ou votre utilisateur)
DATABASE_PASSWORD = votre_mot_de_passe_postgresql
DATABASE_PORT = 5432
```

#### Variables OBLIGATOIRES (Authentification) :

```
JWT_SECRET = votre_secret_jwt_long_et_aleatoire
JWT_REFRESH_SECRET = votre_refresh_secret_long_et_aleatoire
```

#### Variables OBLIGATOIRES (Frontend) :

```
CORS_ORIGIN = https://votre-domaine-amplify.amplifyapp.com
```

#### Variables OPTIONNELLES (selon vos besoins) :

```
OPENAI_API_KEY = sk-... (si vous utilisez la génération IA)
STRIPE_SECRET_KEY = sk_... (si vous utilisez Stripe)
TELEGRAM_BOT_TOKEN = ... (si vous utilisez Telegram)
TELEGRAM_CHAT_ID = ... (si vous utilisez Telegram)
```

### Étape 3 : Enregistrer

1. Cliquez sur **Enregistrer**
2. Attendez quelques secondes que la configuration soit appliquée

### Étape 4 : Tester

1. Testez votre API Lambda
2. Vérifiez les logs CloudWatch - vous ne devriez plus voir `ECONNREFUSED 127.0.0.1:5432`

## 🔍 Comment trouver votre endpoint RDS ?

1. Allez sur https://console.aws.amazon.com/rds/
2. Sélectionnez votre instance PostgreSQL
3. Dans l'onglet **Connectivité et sécurité**, copiez l'**Endpoint** (ex: `xxx.xxxxx.eu-west-3.rds.amazonaws.com`)

## 🔍 Comment trouver votre URL Amplify ?

1. Allez sur https://console.aws.amazon.com/amplify/
2. Sélectionnez votre application
3. L'URL est affichée en haut (ex: `https://main.xxxxx.amplifyapp.com`)

## ⚠️ IMPORTANT

- **Ne jamais** mettre de valeurs réelles dans `serverless.yml` ou dans le code
- Les variables d'environnement dans Lambda sont **sécurisées** et ne sont pas visibles dans le code
- Pour les secrets sensibles, considérez utiliser **AWS Secrets Manager** ou **SSM Parameter Store** (voir `LAMBDA_ENV_SETUP.md`)

## 📝 Alternative : Définir les Variables Avant le Déploiement

Si vous déployez depuis votre machine locale, vous pouvez définir les variables d'environnement avant de lancer `serverless deploy` :

**Windows PowerShell** :
```powershell
$env:DATABASE_HOST="votre-endpoint-rds.xxxxx.eu-west-3.rds.amazonaws.com"
$env:DATABASE_NAME="starter_db"
$env:DATABASE_USER="postgres"
$env:DATABASE_PASSWORD="votre_mot_de_passe"
# ... etc pour les autres variables
serverless deploy
```

**Linux/Mac** :
```bash
export DATABASE_HOST="votre-endpoint-rds.xxxxx.eu-west-3.rds.amazonaws.com"
export DATABASE_NAME="starter_db"
export DATABASE_USER="postgres"
export DATABASE_PASSWORD="votre_mot_de_passe"
# ... etc pour les autres variables
serverless deploy
```

Mais la **solution recommandée** est de configurer directement dans la console AWS Lambda (plus simple et plus sécurisé).

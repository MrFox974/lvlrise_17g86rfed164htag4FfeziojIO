# LvlRise — Guide complet

LvlRise tient sur trois modules, et rien d'autre :

- **FlashCards** — collections de cartes révisées en répétition espacée (SM-2),
  créées à la main, importées depuis un texte ou générées par IA ;
- **Routines** — habitudes quotidiennes, planifiées par jour de la semaine ;
- **To-do list** — tâches priorisées par tag, avec une note attachable à chacune.

La vue d'ensemble (`/home`) agrège les trois : un cadran des révisions du jour ou
de la semaine, les tâches prioritaires et l'avancement des routines.

Ce document explique comment **configurer et déployer** l'application, comment
**mettre en place les serveurs AWS** (Lambda, Amplify, RDS PostgreSQL), et
détaille la **structure du projet**.

---

## Sommaire

1. [Créer et déployer un site en partant de ce starter](#1-créer-et-déployer-un-site-en-partant-de-ce-starter)
2. [Mise en place des serveurs AWS (Lambda, Amplify, RDS)](#2-mise-en-place-des-serveurs-aws-lambda-amplify-rds)
3. [Structure détaillée du projet](#3-structure-détaillée-du-projet)

---

## 1. Créer et déployer un site en partant de ce starter

### 1.1 Prérequis

- **Node.js** 18+
- **Git**
- **Compte AWS** (pour Amplify, Lambda, RDS)
- **Compte GitHub** (déploiement backend via Actions, frontend lié à Amplify)

### 1.2 Cloner et préparer le projet

```bash
git clone <URL_DE_TON_REPO> mon-projet
cd mon-projet
```

Le projet est **monorepo** : un seul dépôt avec dossiers `frontend/` et `backend/`.

### 1.3 Configuration locale

#### Frontend

1. Copier le fichier d’exemple d’environnement :
   ```bash
   cd frontend
   cp .env.example .env
   ```
2. Éditer `frontend/.env` :
   - `VITE_PROTOCOLE=http`
   - `VITE_SERVER_HOST=localhost`
   - `VITE_SERVER_PORT=8080`
3. Installer et lancer :
   ```bash
   npm install
   npm run dev
   ```
   → L’app est disponible sur `http://localhost:5173`.

#### Backend

1. Copier le fichier d’exemple :
   ```bash
   cd backend
   cp .env.example .env
   ```
2. Remplir `backend/.env` (voir [Variables d’environnement](#variables-denvironnement-récapitulatif)) :
   - `DATABASE_*` pour Postgres (local ou Docker)
   - `CORS_ORIGIN=http://localhost:5173`
   - `JWT_SECRET` et `JWT_REFRESH_SECRET` (chaînes aléatoires)
3. Lancer le serveur :
   ```bash
   npm install
   npm run dev
   ```
   → API sur `http://localhost:8080`.

#### Base de données locale (optionnel)

Pour développer sans RDS :

```bash
# À la racine du projet
docker-compose up -d
```

Postgres écoute sur `localhost:5432` avec `POSTGRES_USER=postgres`, `POSTGRES_DB=starter_db`. Adapter `backend/.env` en conséquence.

### 1.4 Déployer en production (vue d’ensemble)

1. **RDS** : créer une instance PostgreSQL, noter host, port, user, password, DB name.
2. **Lambda** : configurer `backend/serverless.yml` et les secrets GitHub, puis déployer via GitHub Actions (voir partie 2).
3. **Amplify** : connecter le repo, définir `appRoot: frontend`, renseigner les variables `VITE_*` et l’URL du backend (voir partie 2).
4. **CORS** : dans le backend (Lambda), `CORS_ORIGIN` doit être **exactement** l’URL de l’app Amplify (sans slash final).

Le détail de chaque service AWS est dans la [partie 2](#2-mise-en-place-des-serveurs-aws-lambda-amplify-rds).

---

## 2. Mise en place des serveurs AWS (Lambda, Amplify, RDS)

Tout doit être dans **la même région AWS** (ex. `eu-west-3` ou `eu-south-1`) pour limiter la latence et les coûts.

---

### 2.1 RDS PostgreSQL

#### Où configurer

- **Console AWS** : barre de recherche → **RDS** → **Bases de données** → **Créer une base de données**.

#### Paramétrage recommandé

| Paramètre | Valeur type | Où le retrouver / note |
|-----------|--------------|-------------------------|
| Moteur | **PostgreSQL** | Choisir la version supportée (ex. 15 ou 16) |
| Modèle | **Offre gratuite** ou instance selon besoin | Tarification |
| Identifiant d’instance | `mon-db-postgres` (ex.) | Nom affiché dans la console |
| Identifiant principal / utilisateur | `postgres` (ou autre) | À réutiliser dans `DATABASE_USER` |
| Mot de passe | À définir et **sauvegarder** | → `DATABASE_PASSWORD` |
| Base par défaut | `starter_db` (ou autre) | → `DATABASE_NAME` |
| Accès public | **Oui** si besoin de connexion hors VPC (ex. Lambda sans VPC) | Configuration supplémentaire |
| VPC / sous-réseau | Par défaut ou même VPC que Lambda si vous mettez Lambda dans un VPC | Réseau |
| Groupe de sécurité | Créer ou utiliser un SG autorisant le **port 5432** en entrée depuis les IP/sources nécessaires (ex. Lambda, ou `0.0.0.0/0` pour tests uniquement) | EC2 > Groupes de sécurité |

> **Sécurité** : en production, préférer Lambda et RDS dans le même VPC et limiter l’accès 5432 au SG de la Lambda. Pour des tests, l’accès public + SG ouvert peut suffire.

#### Infos à récupérer après création

Dans la console RDS, en cliquant sur l’instance :

- **Endpoint** (ex. `mon-db.xxxxx.eu-west-3.rds.amazonaws.com`) → `DATABASE_HOST`
- **Port** (souvent `5432`) → `DATABASE_PORT`
- Utilisateur / mot de passe / nom de base déjà définis → `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME`

#### SSL

Le backend active le SSL pour RDS dès que `DATABASE_HOST` n’est pas `localhost` (voir `backend/config/database.js`). Aucune config supplémentaire côté app en général.

*[À compléter avec vos screens RDS si besoin : capture de la page « Connexion et sécurité », « Endpoint », « Groupe de sécurité ».]*

---

### 2.2 Lambda (backend Node.js)

Le backend est déployé avec **Serverless Framework** en **Lambda** exposée via **Lambda Function URL** (pas API Gateway).

#### Fichiers concernés

- `backend/serverless.yml` : service, région, variables d’environnement, fonction et `url: true`
- `backend/handler.js` : point d’entrée Lambda (serverless-http)
- `.github/workflows/deploy-backend.yml` : déploiement automatique sur push `main` si `backend/**` change

#### Contenu type de `serverless.yml`

```yaml
service: backend-lambda

provider:
  name: aws
  runtime: nodejs18.x
  region: eu-west-3          # même région que RDS / Amplify
  stage: dev
  environment:
    NODE_ENV: production
    DATABASE_NAME: <VOTRE_DB_NAME>
    DATABASE_USER: <VOTRE_DB_USER>
    DATABASE_PASSWORD: <VOTRE_DB_PASSWORD>
    DATABASE_HOST: <VOTRE_ENDPOINT_RDS>    # ex. xxx.eu-west-3.rds.amazonaws.com
    DATABASE_PORT: 5432
    CORS_ORIGIN: https://main.xxxxx.amplifyapp.com   # URL Amplify SANS slash final
    JWT_SECRET: <VOTRE_JWT_SECRET>
    JWT_REFRESH_SECRET: <VOTRE_JWT_REFRESH_SECRET>
    # Autres variables utiles (STRIPE_SECRET_KEY, etc.)

functions:
  api:
    handler: handler.handler
    url: true
```

#### Variables à renseigner dans `provider.environment`

| Variable | Description | Où la prendre |
|----------|-------------|----------------|
| `DATABASE_NAME` | Nom de la base Postgres | RDS (paramètre « Base de données » ou défaut) |
| `DATABASE_USER` | Utilisateur Postgres | RDS (identifiant principal) |
| `DATABASE_PASSWORD` | Mot de passe Postgres | RDS (mot de passe défini à la création) |
| `DATABASE_HOST` | Endpoint RDS | RDS → onglet « Connexion et sécurité » → Endpoint |
| `DATABASE_PORT` | Port (souvent 5432) | RDS |
| `CORS_ORIGIN` | Origine autorisée (frontend) | URL exacte de l’app Amplify, **sans** slash final (ex. `https://main.xxxxx.amplifyapp.com`) |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Secrets pour les tokens | Chaînes aléatoires sécurisées (jamais en dur dans un repo public) |
| `GOOGLE_CLIENT_ID` | Connexion Google | Client ID OAuth 2.0 (Google Cloud Console). Optionnel : sans cela, le bouton « Continuer avec Google » n'apparaît pas. |
| `APPLE_CLIENT_ID` | Connexion Apple | Services ID Sign in with Apple (Apple Developer). Optionnel : sans cela, le bouton « Continuer avec Apple » n'apparaît pas. |

**OAuth (Google / Apple)** : Pour activer la connexion sociale, configurer `GOOGLE_CLIENT_ID` et `APPLE_CLIENT_ID` dans le backend (`.env` / `serverless.yml`), et `VITE_GOOGLE_CLIENT_ID` / `VITE_APPLE_CLIENT_ID` dans le frontend (`.env` / Amplify). Voir [Google Cloud Console](https://console.cloud.google.com/apis/credentials) et [Apple Developer](https://developer.apple.com/account/resources/identifiers/list/serviceId) pour créer les identifiants.

**Bonnes pratiques** : ne pas committer de mots de passe en clair. Utiliser AWS Secrets Manager ou SSM Parameter Store et les référencer dans `serverless.yml` (ex. `DATABASE_PASSWORD: ${ssm:/mon-app/db-password}`).

#### CORS (backend)

- CORS est géré **dans l’app Express** (`backend/app.js`), pas dans la console AWS.
- `CORS_ORIGIN` doit être **exactement** l’origine du frontend (ex. l’URL Amplify).
- **Ne pas** activer une « réponse CORS » sur la Lambda Function URL dans la console si Express envoie déjà les en-têtes CORS (risque de doublon `Access-Control-Allow-Origin`).

#### Déploiement via GitHub Actions

Le workflow `.github/workflows/deploy-backend.yml` :

- se déclenche sur **push sur `main`** quand des fichiers sous `backend/**` changent ;
- exécute les étapes dans le répertoire `backend/` ;
- utilise **OIDC** pour s’authentifier à AWS (pas de clés en dur).

À configurer côté AWS et GitHub :

1. **IAM** : créer un rôle avec une trust policy autorisant GitHub OIDC à assumer ce rôle (Fournisseur OIDC : `token.actions.githubusercontent.com`, public pour ton repo/organisation).
2. Donner à ce rôle les droits nécessaires (déploiement Lambda, création de Function URL, CloudFormation, logs, etc.).
3. Dans le workflow, `role-to-assume` doit être l’ARN de ce rôle (ex. `arn:aws:iam::616421593714:role/official_github_deploy`).
4. `aws-region` dans le workflow doit être la même que `provider.region` dans `serverless.yml`.

Après un push sur `main` modifiant `backend/`, le déploiement se lance. À la fin, Serverless affiche l’**URL de la Function** (ex. `https://xxxxx.lambda-url.eu-west-3.on.aws/`). C’est cette URL qui sert de base pour le frontend en prod.

*[À compléter avec vos screens Lambda si besoin : capture « Configuration » > Variables d’environnement, « URL de la fonction ».]*

---

### 2.3 Amplify (frontend React)

#### Où configurer

- **Console AWS** → **Amplify** → **Créer une application** → **Hosting d’application** → branchement au repo **GitHub** (même repo que le backend, ou repo frontend dédié).

#### Paramétrage du build

Le build est piloté par **`amplify.yml` à la racine du dépôt** :

```yaml
version: 1
applications:
  - appRoot: frontend
    frontend:
      phases:
        preBuild:
          commands:
            - npm ci
        build:
          commands:
            - npm run build
          env:
            - VITE_PROTOCOLE: $VITE_PROTOCOLE
            - VITE_SERVER_HOST: $VITE_SERVER_HOST
            - VITE_SERVER_PORT: $VITE_SERVER_PORT
      artifacts:
        baseDirectory: dist
        files:
          - '**/*'
      cache:
        paths:
          - node_modules/**/*
```

- **`appRoot: frontend`** : Amplify exécute tout (npm, build) dans le dossier `frontend/`.
- **`artifacts.baseDirectory: dist`** : sortie du build Vite = `frontend/dist`.
- Les variables **`VITE_*`** sont injectées au **build** via `env`. Leurs **valeurs réelles** se définissent dans la **console Amplify** (App > Paramètres > Variables d’environnement), pas dans le fichier.

#### Variables à renseigner dans la console Amplify

| Variable | Description | Valeur en production |
|----------|-------------|----------------------|
| `VITE_PROTOCOLE` | Schéma (http/https) | `https` |
| `VITE_SERVER_HOST` | Host du backend | **Sans** préfixe `https://`. Pour une Lambda Function URL, utiliser uniquement le host, ex. `xxxxx.lambda-url.eu-west-3.on.aws` |
| `VITE_SERVER_PORT` | Port du backend | En général **vide** ou `443` pour HTTPS (le frontend n’ajoute pas `:443` dans l’URL). Pour une Function URL, laisser vide ou `443`. |

Le fichier `frontend/utils/api.js` construit `baseURL` à partir de ces variables. Si `VITE_SERVER_PORT` est vide ou 80/443, l’URL est `https://<host>` sans port.

#### Redirect SPA (routes React)

Pour que les routes gérées par React (ex. `/about`) renvoient `index.html` en cas de 404 :

- **Console Amplify** → ton app → **Hosting** → **Rewrites and redirects** → **Manage redirects**
- Ajouter une règle : source ` /<<*>> `, type **404**, cible ` /index.html ` (ou équivalent selon la doc Amplify du moment).

*[À compléter avec vos screens Amplify si besoin : capture « Build settings » (amplify.yml), « Variables d’environnement », « Rewrites and redirects ».]*

---

### 2.4 Lien Frontend ↔ Backend (CORS et variables)

- **Frontend (Amplify)** appelle le backend via l’URL construite avec `VITE_PROTOCOLE`, `VITE_SERVER_HOST`, `VITE_SERVER_PORT` (voir `frontend/utils/api.js`).
- **Backend (Lambda)** n’accepte que l’origine définie dans `CORS_ORIGIN`. Elle doit être **exactement** l’URL de l’app Amplify (ex. `https://main.xxxxx.amplifyapp.com`), **sans** slash final.
- En local : frontend `http://localhost:5173`, backend `CORS_ORIGIN=http://localhost:5173`.

---

### 2.5 Variables d’environnement — récapitulatif

| Contexte | Fichier / lieu | Variables principales |
|----------|----------------|------------------------|
| **Backend local** | `backend/.env` (copié depuis `.env.example`) | `DATABASE_*`, `PORT`, `HOST`, `CORS_ORIGIN`, `JWT_SECRET`, `JWT_REFRESH_SECRET` |
| **Backend prod (Lambda)** | `serverless.yml` → `provider.environment` (ou Secrets Manager / SSM) | Mêmes noms ; valeurs réelles pour RDS, CORS (URL Amplify), JWT, etc. |
| **Frontend local** | `frontend/.env` (copié depuis `.env.example`) | `VITE_PROTOCOLE`, `VITE_SERVER_HOST`, `VITE_SERVER_PORT` |
| **Frontend prod** | Console Amplify (Variables d’environnement) + `amplify.yml` → `env` | `VITE_PROTOCOLE`, `VITE_SERVER_HOST`, `VITE_SERVER_PORT` (ou vides selon la logique dans `api.js`) |

---

## 3. Structure détaillée du projet

### 3.1 Arborescence

```
(racine)
├── .github/
│   └── workflows/
│       └── deploy-backend.yml    # Déploiement Lambda sur push main (backend/**)
├── .cursor/
│   └── rules/                    # Règles Cursor (conventions, architecture, déploiement)
├── amplify.yml                   # Config build Amplify (appRoot: frontend, env VITE_*)
├── docker-compose.yml            # Postgres local (optionnel)
├── README.md
├── README_V2.md                  # Ce guide
│
├── backend/
│   ├── config/
│   │   └── database.js           # Sequelize + connexion Postgres (SSL si RDS)
│   ├── controllers/
│   │   └── test.controller.js    # Logique HTTP (req/res)
│   ├── middlewares/
│   │   └── authMiddlewares.js    # (ex.) Auth JWT
│   ├── models/
│   │   └── Test.js               # Modèle Sequelize
│   ├── router/
│   │   └── test.route.js         # Routes Express → controllers
│   ├── services/                 # (optionnel) Logique métier réutilisable
│   ├── app.js                    # Express : CORS, JSON, routes, erreurs, init DB
│   ├── handler.js                # Point d’entrée Lambda (serverless-http)
│   ├── server.js                 # Lancement local (npm run dev)
│   ├── serverless.yml            # Déploiement Lambda + variables d’env
│   ├── .env.example
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── components/           # Composants réutilisables (Layout, ErrorBoundary, etc.)
    │   │   └── skeletons/        # Skeletons de chargement
    │   ├── pages/                # Pages / vues par route (home, about, …)
    │   ├── loaders/              # Loaders React Router (données pour les routes)
    │   ├── hooks/                # Hooks personnalisés (optionnel)
    │   ├── router.jsx            # createBrowserRouter, routes, loaders, errorElement
    │   ├── App.jsx               # Composant racine
    │   ├── main.jsx              # Point d’entrée + RouterProvider
    │   └── index.css             # Styles globaux (Tailwind)
    ├── utils/
    │   └── api.js                # Axios (baseURL depuis VITE_*), interceptors (token, refresh)
    ├── index.html
    ├── vite.config.js
    ├── .env.example
    └── package.json
```

### 3.2 Rôle des dossiers et fichiers clés

#### Racine

| Élément | Rôle |
|--------|------|
| `amplify.yml` | Définit comment Amplify build le frontend (`appRoot`, `env`, `artifacts`) |
| `docker-compose.yml` | Postgres local pour le dev (port 5432) |
| `.github/workflows/deploy-backend.yml` | Pipeline de déploiement du backend vers Lambda sur push `main` |

#### Backend

| Dossier / fichier | Rôle |
|-------------------|------|
| `config/database.js` | Connexion Sequelize (Postgres), SSL si host ≠ localhost, `connectToDB` / `connectModels` |
| `controllers/` | Fonctions (req, res) : appels services/models, renvoi JSON ou erreurs |
| `router/` | Définition des routes Express et enchaînement vers les controllers |
| `models/` | Modèles Sequelize (tables, champs) |
| `middlewares/` | Middlewares Express (ex. vérification JWT) |
| `app.js` | Création de l’app Express : CORS depuis `CORS_ORIGIN`, `express.json()`, montage des routes sous `/api`, middleware d’erreur global, appel non bloquant à `connectToDB` / `connectModels` |
| `handler.js` | Export de la Lambda : `serverless(app)` → un seul point d’entrée pour la Function URL |
| `server.js` | Démarrage du serveur en local (`app.listen(PORT)`) |
| `serverless.yml` | Description du service Lambda, région, variables d’environnement, fonction avec `url: true` |

#### Frontend

| Dossier / fichier | Rôle |
|-------------------|------|
| `utils/api.js` | Instance Axios avec `baseURL` dérivée de `VITE_PROTOCOLE`, `VITE_SERVER_HOST`, `VITE_SERVER_PORT` ; interceptors pour token et refresh |
| `loaders/` | Fonctions de loader React Router : appels API (via `api.js`), retour des données pour chaque route |
| `router.jsx` | `createBrowserRouter` : association route → composant, → loader, → `errorElement` |
| `pages/` | Composants de page affichés selon la route |
| `components/` | Layout, ErrorBoundary, skeletons, etc. |
| `App.jsx` | Racine UI (peut contenir outlet ou layout commun) |
| `main.jsx` | Montage de l’app + `RouterProvider` avec le router |

### 3.3 Flux de données typique

1. **Navigation** : React Router affiche une route et déclenche son **loader**.
2. **Loader** : appelle `api.get(...)` (ou `api.post(...)`), donc `frontend/utils/api.js` → URL construite avec les `VITE_*`.
3. **Requête HTTP** : vers l’URL de la Lambda (prod) ou `http://localhost:8080` (local). En-tête `Origin` = URL du frontend (Amplify ou localhost).
4. **Backend** : Express reçoit la requête, CORS vérifie `Origin` grâce à `CORS_ORIGIN`, puis la route (ex. `/api/test/getAll`) est traitée par le **router** → **controller** → **modèle** (Sequelize) → réponses JSON.
5. **Frontend** : le loader reçoit la réponse, les données sont fournies au composant via `useLoaderData()`, et la page s’affiche.

### 3.4 Conventions de nommage (rappel)

- **Backend** : fichiers en `kebab-case.js` (ex. `test.controller.js`), fonctions en `camelCase`, modèles en `PascalCase`.
- **Frontend** : composants et fichiers de composants en `PascalCase.jsx`, hooks en `usePascalCase`, utilitaires en `camelCase.js`.
- **Variables d’env** : `UPPER_SNAKE_CASE` ; préfixe `VITE_` pour celles exposées au frontend (build Vite).

---

*Ce README_V2 peut être enrichi avec des captures d’écran de la console AWS (RDS, Lambda, Amplify) pour illustrer chaque étape (endpoint, variables, redirects, etc.).*

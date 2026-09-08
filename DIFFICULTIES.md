# Récap des problèmes rencontrés et solutions (chronologique)

Ce fichier liste les problèmes rencontrés lors du déploiement (Amplify, Lambda, RDS) et la solution appliquée pour chacun. À supprimer quand tu n’en as plus besoin.

---

## 1. Connexion de la base de données (Lambda → RDS)

**Problème :** La Lambda doit pouvoir joindre RDS Postgres.

**Solutions :**
- **Réseau :** Si RDS est publiquement accessible : dans le Security Group de RDS, règle entrante sur le port **5432**, source **0.0.0.0/0** (ou au minimum la sortie Lambda). Si RDS est privé : mettre la Lambda dans le même VPC que RDS et autoriser le SG de la Lambda dans le SG de RDS sur 5432.
- **Variables d’env :** Vérifier dans `serverless.yml` que `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USER`, `DATABASE_PASSWORD` correspondent à l’instance RDS.
- **Workflow :** Le déploiement backend se fait via GitHub Actions (workflow à la **racine** du repo : `.github/workflows/deploy-backend.yml`), avec `defaults.run.working-directory: backend`.

---

## 2. CORS – Origin undefined / "Not allowed by CORS"

**Problème :** En Lambda, logs du type `Origin: undefined` et erreur "Not allowed by CORS".

**Solution :**
- **Côté config :** Mettre `CORS_ORIGIN` **sans slash final** dans `serverless.yml` (ex. `https://main.xxx.amplifyapp.com` et pas `.../`), car le navigateur envoie l’origine sans slash.
- **Côté code (optionnel) :** Dans `app.js`, normaliser l’origine (trim + suppression du slash final) et accepter les requêtes sans en-tête `Origin` (health checks, curl, etc.) via une logique du type `isOriginAllowed(origin) => !origin || origin === allowedOrigin`.

---

## 3. CORS – Header "Access-Control-Allow-Origin" en double

**Problème :** Erreur du navigateur : *"The 'Access-Control-Allow-Origin' header contains multiple values 'https://... , https://...'"*.

**Solution :** Un seul endroit doit envoyer les headers CORS.
- **Dans le code :** Supprimer le middleware CORS personnalisé dans `app.js` et garder **uniquement** le middleware `cors()` (éviter de dupliquer avec un middleware custom qui pose les mêmes headers).
- **Dans AWS :** Désactiver / supprimer la config CORS de la **Lambda Function URL** (Console Lambda → Configuration → Function URL → Edit → CORS), pour que seul Express pose les headers CORS.

---

## 4. Front qui ne s’affiche plus (local)

**Problème :** Le front ne “s’allume” plus en local.

**Solutions :**
- Lancer le **frontend** dans un terminal séparé : `cd frontend` puis `npm run dev` (le back tourne avec `npm run dev` dans `backend/`).
- Si la racine `/` affiche un contenu vide : ajouter une route index qui redirige vers `/home` (ex. `<Route index element={<Navigate to="/home" replace />} />` dans le router).
- Si le CSS pose souci avec Tailwind v4 : n’utiliser que `@import "tailwindcss"` dans `index.css`, sans les anciennes directives `@tailwind base/components/utilities` (syntaxe v3).

---

## 5. 404 sur Amplify pour /home, /about (rechargement ou accès direct)

**Problème :** En ouvrant ou en rechargeant une URL comme `https://xxx.amplifyapp.com/home`, la réponse est **404**.

**Solution :** Règle de redirect/rewrite **dans la console Amplify** (pas dans le repo).  
**Hosting** → **Rewrites and redirects** → **Manage redirects** → éditeur JSON, ajouter :

```json
[
  {
    "source": "/<<*>>",
    "status": "404",
    "target": "/index.html",
    "condition": null
  }
]
```

Enregistrer. Ainsi, toute requête qui renverrait un 404 sert `index.html`, et React Router gère `/`, `/home`, `/about`, etc.

---

## 6. TypeError: r.map is not a function (Home)

**Problème :** Le front reçoit `{ tests: { … } }` (objet) et appelle `tests.map()` → erreur "map is not a function".

**Solutions :**
- **Backend :** Renvoyer `tests` comme **tableau** dans la réponse (ex. `res.json({ tests: [ ... ] })`). Si tu utilises la BDD, `Test.findAll()` renvoie déjà un tableau.
- **Loader :** S’assurer que le composant reçoit toujours un tableau : `const tests = Array.isArray(data.tests) ? data.tests : [];` puis `return { tests };`.
- **Composant Home :** Pour la colonne “User ID / Name”, utiliser `test.name || test.user_id || '-'` pour gérer les deux structures (mock et BDD).

---

## 7. Connexion RDS depuis la Lambda : "no pg_hba.conf entry ... no encryption"

**Problème :** En Lambda, erreur du type *"no pg_hba.conf entry for host 'x.x.x.x', user 'postgres', database 'postgres', no encryption"*.

**Solution :** RDS impose une connexion **chiffrée**. Dans `backend/config/database.js`, activer SSL quand le host n’est pas localhost :

```js
const useSSL = DB_HOST && !DB_HOST.includes('localhost');
// ...
dialectOptions: useSSL
  ? { ssl: { require: true, rejectUnauthorized: false } }
  : {},
```

En local on reste sans SSL, en prod (RDS) la connexion passe en SSL.

---

## 8. Rendre la base RDS accessible depuis Internet (pour Lambda ou DBeaver)

**Problème :** Besoin d’accéder à RDS depuis l’extérieur (Lambda sans VPC, ou client type DBeaver).

**Solutions (choix “sans VPC”) :**
- **RDS :** Modifier l’instance → **Connectivity** → cocher **Publicly accessible**.
- **Security Group :** Sur le SG de l’instance RDS, règle entrante **PostgreSQL / 5432**, source **0.0.0.0/0** (à restreindre en prod si besoin).
- **Réseau :** L’instance doit être dans un subnet public (avec route vers une Internet Gateway).

---

## 9. Connexion à la base avec DBeaver

**Problème :** Se connecter à RDS Postgres depuis DBeaver.

**Solution :**  
Nouvelle connexion PostgreSQL, renseigner Host (ex. `database-postgres.xxx.rds.amazonaws.com`), Port **5432**, Database **postgres**, User / Password. Cocher **Use SSL** (RDS impose le chiffrement) et autoriser le certificat si DBeaver le propose. Vérifier que RDS est publiquement accessible et que le SG autorise le port 5432 depuis ton IP (ou 0.0.0.0/0 pour test).

---

## 10. Avec ou sans VPC ?

**Résumé :**
- **Sans VPC :** Lambda par défaut (hors VPC), RDS **public**, SG RDS ouvert sur 5432 (ex. 0.0.0.0/0). Plus simple à mettre en place.
- **Avec VPC :** Lambda et RDS dans le **même VPC**, RDS **privé**, SG RDS autorisant le port 5432 depuis le Security Group de la Lambda. Plus sécurisé pour la prod.

---

*Document généré à partir des échanges de la session. Tu peux supprimer ce fichier quand tu n’en as plus besoin.*

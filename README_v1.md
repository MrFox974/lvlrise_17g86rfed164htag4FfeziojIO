# StarterProject (Starter)

## Démarrage rapide (local)

### Frontend
- **Créer ton env local** : copie `frontend/.env.example` → `frontend/.env.local` puis remplis.
- **Installer / lancer** :

```bash
cd frontend
npm install
npm run dev
```

### Backend
- **Créer ton env local** : copie `backend/.env.example` → `backend/.env` puis remplis.
- **Installer / lancer** :

```bash
cd backend
npm install
npm run dev
```

## Variables d’environnement (règle simple)
- **Jamais commit** : `backend/.env`, `frontend/.env.local`, `node_modules/`
- **À committer** : `backend/.env.example`, `frontend/.env.example`
- **Prod backend (Lambda/Serverless)** : variables dans `serverless.yml` / AWS (runtime `process.env`)
- **Prod frontend (Amplify)** : variables `VITE_*` dans Amplify (build-time `import.meta.env`)

## Règles Cursor
Ce projet embarque des règles dans `.cursor/rules/` pour guider l’IA et garder un code cohérent.

# Sommaire :

-	[ Créer un projet de A à Z ](#1-créer-un-projet-de-a-à-z)
-	[Les packages de base]()
-	[Le projet "TheStarter"]()
-	[Installer le frontend (React) sur Amplify]()
-	[Installer le backend (Nodejs) sur Lambda]()
-	[Installer la base de données sur RDS MySQL]()

## 1. Créer un projet de A à Z
### 1.	Créer le backend (Node JS)
A l'intérieur de ce dernier on va initialiser un nouveau projet vite.
npm create vite@latest . -- --template react
```
Normalement, il devrait te demander quelques infos et de l'instaler. Tu suis la procédure.
enfin, le démarer.
Les dossiers et fichier suivant devrait se créer :
```
> /node_modules
> /public
> /src
.gitignore
eslint.config.js
index.html
package-lock.json
package.json
README.md
vite.config.js
```
Enfin, si ce n'est pas encore fait, tu le demarre avec :
```
npm run dev
```
Voici le retour qui indique tout à bien fonctionner !
```
> frontend@0.0.0 dev
> vite
> VITE v7.2.7  ready in 314 ms
> ➜  Local:   http://localhost:5173/
> ➜  Network: use --host to expose
> ➜  press h + enter to show help
```
Et voilà frontend créé !

###  3.	Ménage dans le frontend (React JS)
Il serait intéressent de supprimer ce qui ne nous interesse pas comme :
```
README.md
public/vite.svg
source/assets
App.css
```
et voilà le projet peut commencer à être bien propre !

###  4.	Installer TailwindCSS

TailwindCSS va vous permettre de gérer plus facilement les classes et le responsive.
Voici comment l'installer :
```
npm install tailwindcss @tailwindcss/vite
```
Maintenant, dans ```vite.config.js``` tu modifies le contenu de ça... :

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
})
```

à ça :
```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
})
```
Ensuite, dans ```src/index.css``` tu mets :
```css
@import "tailwindcss";
/* global index.css */ 
@tailwind base;
@tailwind components;
@tailwind utilities;

/* add the code bellow */ 
@layer utilities {
      /* Hide scrollbar for Chrome, Safari and Opera */
      .no-scrollbar::-webkit-scrollbar {
          display: none;
      }
     /* Hide scrollbar for IE, Edge and Firefox */
      .no-scrollbar {
          -ms-overflow-style: none;  /* IE and Edge */
          scrollbar-width: none;  /* Firefox */
    }
  }
```
Pour terminé, tu fais en sorte que ```index.html``` capte le ```index.css``` en rajoutant une ligne dans les meta:
```html
<link href="/src/index.css" rel="stylesheet">
```
Et on test dans ```App.jsx``` par exemple en faisant :
```js
import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <div>
        <p className='text-red-500'>Hello world</p>
      </div>
    </>
  )
}

export default App
```
Et voilà ! Tu as une base solid pour commencer la programmation. Mais on va aller encore plus loins. Et créer un projet fiable, scalable sur AWS.

###  5.	La gestion des routes côté frontend est très important pour avoir plusieurs pages et mieux gérer la structure du site.
Pour cela nous installons ```react-dom-router```
```
npm install react-router-dom
```
Nous modifions notre App.jsx pour avoir un code propre minimum grâce à react-router-dom et mieux gérer les pages :
```jsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "../public/pages/Home/Home" //Nous créons dans "public" un nouveau dossier "pages" qui contiens toutes les pages du site

function App() {

  return (

    <Router>
      <Routes>
        <Route path="/home" element={<Home/>}/>
      </Routes>
    </Router>

  )
}

export default App
```
Nous sommes enfin prêt pour commencer à travailler sérieusement !

## 2. Créer les packages de bases

Voici la liste des packages importants à avoir selon moi :
```json
"dependencies": {
    "@tailwindcss/vite": "^4.1.13",
    "axios": "^1.12.2",
    "bcryptjs": "^3.0.3",
    "cookie-parser": "^1.4.7",
    "cors": "^2.8.5",
    "dotenv": "^17.2.2",
    "express": "^5.1.0",
    "jsonwebtoken": "^9.0.2",
    "mysql2": "^3.15.0",
    "nodemon": "^3.1.10",
    "sequelize": "^6.37.7",
    "serverless-http": "^4.0.0",
    "tailwindcss": "^4.1.13"
  }
```
et le code pour les installer tous d'un coup ! (On ne prend pas en compte ```express``` et ```tailwindcss``` déjà préalablement installés.

```
npm install axios bcryptjs cookie-parser cors dotenv jsonwebtoken mysql mysql2 sequelize serverless-http
npm install --save-dev nodemon
```

## 2. Le projet "TheStarter"

Le projet TheStarter est basé sur le dépot/le code minimum nécessaire pour débuter un gros projet qui sera lancé sur AWS lambda, amplify et RDS MySQL
Tu peux le télécharger, créer 2 reposetory github, un premier ```frontend``` et le second ```backend```.

## 3. Installer le frontend (React) sur Amplify
###  1.	Création d'un rôle
Pour commencer un projet sur amplify, il faut d'abord au mieux créer un une personne.

1. Vous allez sur votre console/tableau de bord AWS et on tape dans la barre de recherche ```IAM```,
2. puis on va dans ```> personnes``` puis ```créer un utilisateur```.
3. On lui créer un ```Nom d'utilisateur```, ```[suivant]```, ```Attacher directement des politiques``` et
4. on selectionne ``` AdministratorAccess ```.

C'est ce qui va nous permettre de faire pas mal de création et modification, on suit les étapes restente et on fait ```créer un utilisateur```.

###  2.	Amplify
Nous allons désormer dans la barre de rechercher et on tape ```Amplify```.
1. On clique sur ```Créer une nouvelle application```.
2. On clique sur ```GitHub```. (On va lier notre dossier frontend de github avec amplify)
3. On suit les quelques dernières étapes sans soucis et c'est good !

Voilà c'est déployé !
C'est pas le plus compliqué hélas.

## 4. Installer le backend (Nodejs) sur Lambda
C'est maintenant que le rôle IAM/personne créer avec les autorisations va nous servir. Autrement, ça ne fonctionnera pas.
1. Va dans IAM,
2. trouve ton rôle/personne et va dans l'onglet ```Informations d'identification de sécurité```
3. puis ```Créer une clé d'accès```
4. seletionne ```Interface de ligne de commande (CLI)``` ainsi que ``` Je comprends la recommandation ci-dessus et... ``` puis ```suivant```.
5. Vous devez noter/garder 3 éléments très importants :
   1. Access Key ID
   2. Secret Access Key
   3. La Région (La région dans laquelle vous souhtaier situer le serveur (ex: eu-west-1). Généralement c'est en haut à droite)

6. Tu va dans ton dossier ```backend``` dans github. Tu vas au niveau du code. Tu vas dans ```settings```, ```secrets and variables```, selectionne ```>actions```, puis ```New repository secret``` et la tu note les 3 éléments importants sous la forme suivante :
   1. ```AWS_ACCESS_KEY_ID```
   2. ```AWS_SECRET_ACCESS_KEY```
   3. ```AWS_REGION```

et voilà. Le fichier ```.github/workflows/deploy.yml``` est déjà pré-configuré. Il faut simplement connecté ton projet backend à ton github (ce qui est déjà fait normalement, tu entre les éléments important et c'est bon !

Ah et dernière chose, tu as certe un fichier ```.env``` dans lequel tu as tes variables d'environnement local. Mais ceux qui seront inhérent à lambda doivent être renseigner dans ```serverless.yml``` (je t'invite à y jetter un oeil afin de comprendre l'organisation des variables d'environnement)


## 5. Installer la base de données sur RDS MySQL

Là, c'est le plus compliqué !

1. Déjà on note dans la barre de recherche RDS et on selectionne ```Aurora et RDS```.
2. On va dans ```Bases de données```
3. ```Création facile``` et on selectionne ```MySQL```.
4. Important, on selectionne ```Offre gratuite```
5. Puis on remplie les autres données ```Identifiant d'instance de base de données ```(invente), ```Identifiant principal```. Pour ```Gestion des informations d’identification``` tu met ```Autogéré```, tu créés un ```mot de passe```.
6. ```Configuration supplémentaire``` > ```Accès publique```
7. et tu fait ```créer la base de donnée```.
8. Tu selectionne ta base.
9. Désormais tu peux normalement t'y connecter à distance ```MySQL Workbench```. Tu as toutes les infos.
10. Ces infos tu dois une fois de plus les renseigner dans les variables d'environnement de ```serverless.yml```.



Veille à ce qu'ils (amplify, lambda et RDS) soient tous dans la même région stratégique.

Donc ensuite je crois qu'il faut le relier à un ```VPC``` (réseau privé virtuel dans le cloud). Puis le lié à un ```groupe de sécurité``` (EC2). Cela permet de configurer les ```règles entrantes``` afin d'autoriser en type ```MYSQL/Aurora``` et source ```0.0.0.0/0``` afin de pouvoir s'y connecter.






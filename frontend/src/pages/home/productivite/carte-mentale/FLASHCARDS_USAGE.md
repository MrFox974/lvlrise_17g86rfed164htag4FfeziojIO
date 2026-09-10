# Flashcards – Instructions d'usage

## Raccourcis clavier (mode Review)

- **Espace** : afficher/masquer la réponse
- **1** : Encore (à revoir rapidement)
- **2** : Difficile
- **3** : Bien
- **4** : Facile

## Import de cartes

1. Cliquer sur **Import** (page collections ou dans une collection).
2. Coller du texte au format :
   - `Q: question A: réponse`
   - `question - réponse` (tiret entouré d'espaces)
   - `question[tab]réponse`
   - Ou lignes alternées : ligne 1 = question, ligne 2 = réponse.
3. Vérifier les paires détectées.
4. Choisir la collection cible si plusieurs collections.
5. Cliquer **Importer**.

## Algorithme SM-2+

- **Encore** : learning steps 1 min → 10 min → 1 jour ; en review, retour à 1 min.
- **Difficile / Bien / Facile** : intervalles SM-2 (1j, 6j, puis I×EF).
- Le temps de réponse est mesuré ; > 30 s dégrade d’un cran la note.
- Si "Encore", un champ optionnel permet de noter pourquoi on s’est trompé.

## Ajuster l’algorithme

- Backend : `backend/services/spaced-repetition.service.js`
- Constantes : `LEARNING_STEP_MINUTES`, `RESPONSE_TIME_DEGRADE_SEC`

## Ajouter des cartes dans une collection

Deux boutons, deux gestes distincts.

### « + cartes » — un lot tiré d'un sujet

1. Le sujet de la collection est proposé par défaut ; l'ajuster pour cibler autre chose.
2. Joindre des documents au besoin (PDF, photo, texte) : ils font alors autorité.
3. Choisir le nombre de cartes et le niveau (débutant / intermédiaire / avancé).
4. Choisir où ranger les cartes : groupes automatiques (déduits du sujet), sans groupe,
   ou un groupe existant.
5. Activer **Rechercher sur le web** si le sujet demande des informations à jour
   (voir plus bas).

### « + carte » — une carte sur un mot précis

Une bascule **IA** (étoile) / **Manuel** (main qui écrit) :

- **Manuel** : recto, verso, groupe. Rien d'autre.
- **IA** : une demande libre, dont la nature est reconnue toute seule —
  - un mot (même mal orthographié) : orthographe corrigée, puis définition ;
  - une description qui cherche son mot (« quelqu'un de très lucide et rationnel ») :
    plusieurs termes candidats, qu'on écarte d'un glissement vers la gauche ;
  - une question, ou un document accompagné d'une demande d'explication.

Le niveau commande le contenu du verso : **débutant** la définition seule,
**intermédiaire** y ajoute exemple et synonymes, **avancé** une référence.

Rien n'entre dans la collection sans validation : les propositions s'affichent, on
écarte ce qu'on ne veut pas, puis on valide le reste.

## Contenu récent : la recherche web

Un interrupteur **Rechercher sur le web** dans la fenêtre de génération (collection ou
lot de cartes). Il n'a d'intérêt que sur un sujet qui bouge : versions d'un logiciel,
chiffres, prix, lois, classements, dirigeants, état de l'art.

Ce qu'il change : avant d'écrire la moindre carte, le serveur récolte un dossier de
faits **datés et sourcés** (outil de recherche du fournisseur d'IA), puis les cartes se
tiennent à ce dossier pour tout ce qui a pu changer — et mentionnent la date du fait,
pour ne pas devenir fausses en silence. Les pages consultées sont affichées à la fin de
la génération.

Sans cet interrupteur, les cartes reposent sur les connaissances du modèle, arrêtées à
sa date d'entraînement : très bien pour la photosynthèse ou les temps de l'espagnol,
insuffisant pour tout ce qui date.

Trois cas dégradés, chacun annoncé à la fin de la génération plutôt que passé sous
silence : recherche indisponible sur le serveur, aucune information récente trouvée,
aucune page citée (faits à vérifier avant de s'y fier). Dans les trois cas les cartes
sont produites quand même : un dossier manquant ne fait pas perdre la génération.

- Backend : `backend/services/web-research.service.js`
- Réglages serveur : `FLASHCARD_WEB_SEARCH`, `WEB_SEARCH_MODEL`, `WEB_SEARCH_TOOL`
  (voir `backend/.env.example`)
- Vérifications hors ligne : `npm run test:web-research`

## Cohérence entre la question et la réponse

Une carte dont le verso ne répond pas au recto est inutilisable, même si les deux
phrases sont justes. Trois filets, du plus souhaitable au plus contraignant :

1. le prompt l'exige et le montre sur des exemples ;
2. une détection sans appel réseau (`backend/utils/flashcard-coherence.js`) repère les
   défauts classiques : verso qui reformule la question, question qui renvoie à un
   document absent de l'écran (« selon le texte »), verso qui pose une question, recto
   qui en pose deux, réponse vide de sens ;
3. les cartes fautives repartent au modèle pour réparation ; celles qui résistent sont
   écartées, et leur nombre est annoncé à la fin de la génération.

Un défaut plus discret est traité au passage : lors des reformulations, chaque carte
porte un identifiant. Sans lui, une carte omise par le modèle décalait toutes les
suivantes et recollait le recto de l'une au verso de l'autre.

- Réglage serveur : `FLASHCARD_COHERENCE_AUDIT=off` pour couper la passe de réparation
  (moins d'appels, plus de cartes bancales)
- Vérifications hors ligne : `npm run test:coherence`

## Générations en arrière-plan

Toutes les générations (collection, lot de cartes, carte à l'unité) tournent sur le
serveur : la fenêtre peut être fermée et l'application quittée, une notification push
avertit quand c'est prêt. À la réouverture, la fenêtre retrouve le travail en cours —
et, pour « + carte », les propositions qui attendent encore d'être validées.

- Backend : `backend/jobs/flashcard-generation-job.js`,
  `backend/jobs/flashcard-single-card-job.js`
- Vérifications hors ligne : `npm run test:flashcards`, `npm run test:single-card`,
  `npm run test:uploads`, `npm run test:coherence`, `npm run test:web-research`,
  `npm run test:inputs`

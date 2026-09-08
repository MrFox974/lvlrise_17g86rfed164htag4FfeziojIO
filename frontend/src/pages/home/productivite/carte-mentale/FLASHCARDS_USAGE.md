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

## Générations en arrière-plan

Toutes les générations (collection, lot de cartes, carte à l'unité) tournent sur le
serveur : la fenêtre peut être fermée et l'application quittée, une notification push
avertit quand c'est prêt. À la réouverture, la fenêtre retrouve le travail en cours —
et, pour « + carte », les propositions qui attendent encore d'être validées.

- Backend : `backend/jobs/flashcard-generation-job.js`,
  `backend/jobs/flashcard-single-card-job.js`
- Vérifications hors ligne : `npm run test:flashcards`, `npm run test:single-card`,
  `npm run test:uploads`

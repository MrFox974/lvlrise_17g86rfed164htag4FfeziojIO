#!/usr/bin/env node
/**
 * Seed : crée un deck de démo avec des cartes pour un utilisateur.
 * Usage: node scripts/seed-flashcards.js
 * Env: SEED_USER_ID=2 pour forcer l'utilisateur (optionnel)
 */
require('dotenv').config();

const { sequelize, connectToDB } = require('../config/database');
require('../models/FlashcardDeck');
require('../models/Flashcard');

const DEMO_DECK = {
  name: 'BPJEPS Hippologie',
  description: 'Exemple de deck pour la préparation au BPJEPS.',
};

const DEMO_CARDS = [
  { front: "Qu'est-ce qu'un cheval à sang chaud ?", back: 'Cheval sélectionné pour la vitesse et l\'endurance (pur-sang, arabe).' },
  { front: 'Quel est le nom scientifique du cheval ?', back: 'Equus caballus.' },
  { front: "Quelle est la durée de gestation d'une jument ?", back: 'Environ 11 mois (330-345 jours).' },
  { front: 'Combien de dents a un cheval adulte ?', back: 'Entre 36 et 44 selon le sexe (hongre 40, mâle 44, femelle 36).' },
  { front: "C'est quoi le garrot ?", back: 'Point le plus haut du dos, entre l\'encolure et le dos, utilisé pour mesurer la taille.' },
];

async function seed() {
  try {
    await connectToDB();

    let userId = parseInt(process.env.SEED_USER_ID, 10);
    if (Number.isNaN(userId)) {
      const [rows] = await sequelize.query(
        'SELECT id FROM "user" ORDER BY id ASC LIMIT 1'
      );
      const firstUser = rows?.[0];
      userId = firstUser?.id;
    }

    if (!userId) {
      console.log('Aucun utilisateur trouvé. Créez un compte ou définissez SEED_USER_ID=2');
      process.exit(1);
    }

    const FlashcardDeck = sequelize.model('flashcard_deck');
    const Flashcard = sequelize.model('flashcard');

    const existing = await FlashcardDeck.findOne({
      where: { user_id: userId, name: DEMO_DECK.name },
    });
    if (existing) {
      console.log(`Deck "${DEMO_DECK.name}" existe déjà pour l'utilisateur ${userId}.`);
      process.exit(0);
    }

    const maxPos = await FlashcardDeck.max('position', { where: { user_id: userId } });
    const deck = await FlashcardDeck.create({
      user_id: userId,
      name: DEMO_DECK.name,
      description: DEMO_DECK.description,
      position: (maxPos ?? -1) + 1,
    });

    await Flashcard.bulkCreate(
      DEMO_CARDS.map((c, i) => ({
        deck_id: deck.id,
        front: c.front,
        back: c.back,
        position: i,
      }))
    );

    console.log(`Deck "${DEMO_DECK.name}" créé avec ${DEMO_CARDS.length} cartes.`);
    process.exit(0);
  } catch (error) {
    console.error('Erreur seed flashcards:', error);
    process.exit(1);
  }
}

seed();

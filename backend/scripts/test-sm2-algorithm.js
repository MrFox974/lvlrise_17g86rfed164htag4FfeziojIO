#!/usr/bin/env node
/**
 * Vérification manuelle de l'algorithme SM-2+
 * Usage: node scripts/test-sm2-algorithm.js
 */
const s = require('../services/spaced-repetition.service');

console.log('=== Test SM-2+ ===\n');

// Carte nouvelle, Again
let card = { ease_factor: 2.5, interval_days: 0, repetitions: 0, lapses: 0 };
let r = s.computeNextReview(card, 1);
console.log('Nouvelle carte, Again:', r);

// Carte nouvelle, Good
card = { ease_factor: 2.5, interval_days: 0, repetitions: 0 };
r = s.computeNextReview(card, 3);
console.log('Nouvelle carte, Bien:', r);

// Deuxième succès
card = { ease_factor: 2.5, interval_days: 1, repetitions: 1 };
r = s.computeNextReview(card, 3);
console.log('2e succès, Bien:', r);

// Lapse (échec en review)
card = { ease_factor: 2.5, interval_days: 6, repetitions: 2 };
r = s.computeNextReview(card, 1);
console.log('Échec en review (lapse):', r);

// getNextReviewDate
const d = s.getNextReviewDate(0.007); // ~10 min
console.log('\nProchaine date (10 min):', d.toISOString());

console.log('\n=== OK ===');

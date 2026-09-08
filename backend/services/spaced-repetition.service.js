/**
 * Service de répétition espacée - SM-2 amélioré
 * SM-2 : Piotr Wozniak 1987. Anki adapte avec 4 choix de réponse.
 *
 * Qualité de réponse (q) : 1 à 4 (Again, Hard, Good, Easy)
 * - Again (1) : learning steps 1m, 10m, 1j puis reset si échec en review
 * - Hard/Good/Easy : SM-2 classique avec intervales gradués
 *
 * Amélioration SM-2+ :
 * - responseTimeSec : si trop long (> seuil), dégrader d'un cran la note effective
 * - confidence : structure prête pour V2 (slider)
 */
const LEARNING_STEP_MINUTES = [1, 10, 60 * 24]; // 1min, 10min, 1 jour
const RESPONSE_TIME_DEGRADE_SEC = 30; // Au-delà de 30s, considérer comme plus difficile

class SpacedRepetitionService {
  /**
   * Retourne le step d'apprentissage courant (0, 1, 2) ou -1 si gradué
   * Step 0: 1 min, Step 1: 10 min, Step 2: 1 jour
   */
  _getLearningStep(card) {
    const interval = parseFloat(card.interval_days) || 0;
    if (interval >= 1) return -1; // Graduated
    const oneMin = 1 / (24 * 60);
    const tenMin = 10 / (24 * 60);
    if (interval <= oneMin * 1.5) return 0;
    if (interval <= tenMin * 1.5) return 1;
    return 2; // 1 jour en learning
  }

  /**
   * Ajuste la qualité effective selon le temps de réponse
   * @param {number} quality - 1 à 4
   * @param {number|null} responseTimeSec
   * @returns {number} qualité effective (1 à 4)
   */
  adjustQualityByResponseTime(quality, responseTimeSec) {
    if (quality === 1) return 1; // Again reste Again
    if (responseTimeSec == null || responseTimeSec <= RESPONSE_TIME_DEGRADE_SEC) {
      return quality;
    }
    return Math.max(1, quality - 1);
  }

  /**
   * Calcule le prochain intervalle et le nouvel ease_factor selon la qualité de réponse.
   * @param {Object} card - { ease_factor, interval_days, repetitions, lapses }
   * @param {number} quality - 1 à 4 (Again=1, Hard=2, Good=3, Easy=4)
   * @param {number|null} responseTimeSec - temps de réponse en secondes (optionnel)
   * @returns {{ nextIntervalDays: number, easeFactor: number, repetitions: number, lapses: number, reason: string }}
   */
  computeNextReview(card, quality, responseTimeSec = null) {
    const qEffective = this.adjustQualityByResponseTime(quality, responseTimeSec);
    const q = Math.max(1, Math.min(4, Math.round(qEffective)));
    let ef = parseFloat(card.ease_factor) || 2.5;
    let interval = parseFloat(card.interval_days) || 0;
    let repetitions = card.repetitions || 0;
    let lapses = card.lapses || 0;

    // EF' = EF - 0.8 + 0.28q - 0.02q² (formule SM-2)
    const newEf = ef - 0.8 + 0.28 * q - 0.02 * q * q;
    ef = Math.max(1.1, Math.min(2.5, newEf));

    let reason = '';

    // Échec (Again)
    if (q === 1) {
      const step = this._getLearningStep(card);
      if (step === 0) {
        // Step 0 (1 min) : passer à 10 min
        repetitions = 0;
        interval = LEARNING_STEP_MINUTES[1] / (24 * 60);
        reason = 'Prochaine tentative dans 10 min';
      } else if (step === 1) {
        // Step 1 (10 min) : retour à 1 min
        repetitions = 0;
        interval = LEARNING_STEP_MINUTES[0] / (24 * 60);
        reason = 'Revoir dans 1 min';
      } else {
        // Step 2 ou gradué : lapse, retour à 1 min
        lapses += 1;
        repetitions = 0;
        interval = LEARNING_STEP_MINUTES[0] / (24 * 60);
        reason = 'Carte à retravailler — revue dans 1 min';
      }
    } else {
      repetitions += 1;
      if (repetitions === 1) {
        interval = 1;
        reason = 'Première réussite — revue demain';
      } else if (repetitions === 2) {
        interval = 6;
        reason = 'Intervalle 6 jours';
      } else {
        const prevInterval = interval >= 1 ? interval : 1;
        interval = Math.round(prevInterval * ef * 10) / 10;
        interval = Math.max(1, interval);
        reason = `Intervalle ${interval} jours (facteur ${ef.toFixed(1)})`;
      }
    }

    return {
      nextIntervalDays: interval,
      easeFactor: ef,
      repetitions,
      lapses,
      reason,
    };
  }

  /**
   * Retourne la date de prochaine révision
   * @param {number} intervalDays - peut être décimal (< 1 = minutes)
   */
  getNextReviewDate(intervalDays) {
    const d = new Date();
    const days = parseFloat(intervalDays) || 0;
    if (days < 1) {
      const minutes = days * 24 * 60;
      d.setTime(d.getTime() + minutes * 60 * 1000);
    } else {
      d.setDate(d.getDate() + Math.round(days));
    }
    return d;
  }
}

module.exports = new SpacedRepetitionService();

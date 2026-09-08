/**
 * Contenu thématique des particules par slide.
 * Chaque particule conserve les mêmes propriétés CSS (position, taille, opacité, animation).
 */

/** Chiffres et formules mathématiques */
const MATH_CONTENT = [
  'π', 'e', '√2', '∑', '∫', 'φ', '∞', 'ℕ', 'x²', '∂', '∇', 'ℂ', '±', '√', 'Ω',
];

/** Mots érudits issus de la philosophie (ordre adapté aux tailles de particules) */
const PHILO_CONTENT = [
  'noûs', 'epistèmè', 'logos', 'dikaiosyne', 'ethos', 'phronesis', 'eudaimonia',
  'sophia', 'ataraxie', 'arété', 'aletheia', 'épochè', 'katharsis', 'praxis', 'metanoia',
];

/** Symboles SVG : paix, amour, relations */
const PEACE_SVG = (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
  </svg>
);

const HEART_SVG = (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
  </svg>
);

const FAVORITE_SVG = (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

const GROUP_SVG = (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
  </svg>
);

const PEACE_DOVE_SVG = (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
    <path d="M12 3c-1.1 0-2 .9-2 2 0 .74.4 1.38 1 1.72V7h-1c-1.1 0-2 .9-2 2s.9 2 2 2h1v1c-1.1 0-2 .9-2 2s.9 2 2 2h1v1c0 1.1.9 2 2 2s2-.9 2-2v-1h1c1.1 0 2-.9 2-2s-.9-2-2-2h-1V9h1c1.1 0 2-.9 2-2s-.9-2-2-2h-1V6.72c.6-.34 1-.98 1-1.72 0-1.1-.9-2-2-2zm0 2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1z" />
  </svg>
);

const PEOPLE_SVG = (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
  </svg>
);

const CONNECT_SVG = (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
  </svg>
);

/** Symboles SVG pour la slide 3 (paix, amour, relations) */
const SYMBOL_SVG_CONTENT = [
  PEACE_SVG,
  HEART_SVG,
  PEOPLE_SVG,
  FAVORITE_SVG,
  GROUP_SVG,
  PEACE_DOVE_SVG,
  HEART_SVG,
  CONNECT_SVG,
  HEART_SVG,
  PEACE_SVG,
  PEOPLE_SVG,
  FAVORITE_SVG,
  HEART_SVG,
  PEACE_DOVE_SVG,
  GROUP_SVG,
];

export const PARTICLE_CONTENT = {
  math: MATH_CONTENT,
  philo: PHILO_CONTENT,
  symbols: SYMBOL_SVG_CONTENT,
};

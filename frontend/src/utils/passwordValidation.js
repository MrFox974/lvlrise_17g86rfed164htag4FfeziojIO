const MIN_LENGTH = 8;

/**
 * Règles de validation du mot de passe
 * @returns {Array<{ label: string, test: (p: string) => boolean }>}
 */
export const PASSWORD_RULES = [
  { label: 'Au moins 8 caractères', test: (p) => p.length >= MIN_LENGTH },
  { label: 'Au moins une majuscule', test: (p) => /[A-Z]/.test(p) },
  { label: 'Au moins une minuscule', test: (p) => /[a-z]/.test(p) },
  { label: 'Au moins un chiffre', test: (p) => /\d/.test(p) },
  { label: 'Au moins un caractère spécial (!@#$%^&*)', test: (p) => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
];

/**
 * Vérifie si le mot de passe est entièrement valide
 */
export const isPasswordValid = (password) => PASSWORD_RULES.every((r) => r.test(password));

/**
 * Parse du texte collé pour extraire des paires Q/R (heuristique)
 * Formats supportés:
 * - "Q: question A: réponse" ou "Q: ... A: ..."
 * - "question - réponse" (séparateur " - " ou " – ")
 * - "question\tRéponse" (tab)
 * - Lignes alternées (ligne 1 = Q, ligne 2 = A)
 */
const SEPARATORS = [
  { regex: /^\s*Q:\s*(.+?)\s+A:\s*(.+)\s*$/i, groups: [1, 2] },
  { regex: /^(.+?)\s+[-–—]\s+(.+)\s*$/, groups: [1, 2] },
  { regex: /^(.+?)\t(.+)\s*$/, groups: [1, 2] },
];

/**
 * @param {string} text - Texte collé par l'utilisateur
 * @returns {{ front: string, back: string }[]} - Paires Q/R suggérées
 */
export function parseImportText(text) {
  if (!text || typeof text !== 'string') return [];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const pairs = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    let front = '';
    let back = '';
    let found = false;

    for (const { regex, groups } of SEPARATORS) {
      const m = line.match(regex);
      if (m) {
        front = (m[groups[0]] || '').trim();
        back = (m[groups[1]] || '').trim();
        found = true;
        break;
      }
    }

    if (found && front && back) {
      pairs.push({ front, back });
    } else if (i + 1 < lines.length) {
      // Lignes alternées: ligne courante = Q, suivante = A
      front = line;
      back = (lines[i + 1] || '').trim();
      if (front && back) {
        pairs.push({ front, back });
        i += 1;
      }
    }
    i += 1;
  }

  return pairs;
}

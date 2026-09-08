/**
 * Service de génération de domaines Markdown par IA.
 * PROCÉDÉ SÉQUENTIEL :
 * - Appel 1 : Crée la structure
 * - Appel 2 : Chapitre 1 (contexte : structure)
 * - Appel 3 : Sous-chap 1.1 (contexte : structure + chapitre 1)
 * - Appel 4 : Sous-chap 1.2 (contexte : structure + chapitre 1 + sous-chap 1.1)
 * - Appel 5 : Sous-chap 1.3 (contexte : structure + chapitre 1 + sous-chap 1.1 + 1.2)
 * - Appel 6 : Chapitre 2 (contexte : structure + chapitre 1 + sections 1.1 à 1.3)
 * - etc.
 * 1 appel = plusieurs milliers de tokens par sous-chapitre (max_tokens: 16384).
 */

const OpenAI = require('openai').default;
const {
  parseJsonBlock,
  trimToLastParagraph,
  wasTruncated,
  isTransientError,
  getRetryDelayMs,
} = require('../utils/llm-output');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const OUTPUT_MAX_TOKENS = 16384;
const MIN_CHARS_SECTION = 6000;
const MIN_CHARS_CHAPTER = 8000;

// Timeout et retry pour les générations
const SECTION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes par sous-chapitre
const MAX_RETRIES = 3; // Maximum 3 relancements

/**
 * Wrapper avec timeout et retry pour les générations de contenu.
 * Si la génération prend plus de timeoutMs, elle est annulée et relancée.
 * Maximum maxRetries relancements avant d'abandonner.
 * @param {Function} generatorFn - Fonction async qui génère le contenu
 * @param {number} timeoutMs - Timeout en millisecondes
 * @param {number} maxRetries - Nombre maximum de retries
 * @param {string} itemName - Nom de l'élément (pour les logs)
 * @returns {Promise<any>} - Résultat de la génération ou null si échec après retries
 */
async function withTimeoutAndRetry(generatorFn, timeoutMs, maxRetries, itemName = 'élément') {
  let lastError = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Créer une promesse avec timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Timeout: ${itemName} dépasse ${timeoutMs / 1000 / 60} minutes`)), timeoutMs);
      });
      
      // Race entre la génération et le timeout
      const result = await Promise.race([
        generatorFn(),
        timeoutPromise,
      ]);
      
      // Si on arrive ici, la génération a réussi
      return result;
    } catch (error) {
      lastError = error;
      const isTimeout = error.message?.includes('Timeout');
      // « Contenu trop court » et troncature viennent de nos propres contrôles :
      // une nouvelle tentative a de bonnes chances de donner autre chose.
      const isOwnCheck = error.message?.includes('trop court')
        || error.message?.includes('tronqué');
      const worthRetrying = isTimeout || isOwnCheck || isTransientError(error);

      if (attempt < maxRetries && worthRetrying) {
        // Repli exponentiel, en respectant `retry-after` sur un 429 : relancer
        // immédiatement un fournisseur saturé ne fait qu'aggraver la saturation.
        const waitMs = isTimeout || isOwnCheck ? 1000 : getRetryDelayMs(error, attempt + 1);
        console.warn(`${itemName}: ${error.message} — relance ${attempt + 1}/${maxRetries} dans ${waitMs}ms`);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
        continue;
      }

      if (!worthRetrying) {
        // Clé invalide, quota épuisé, requête refusée : réessayer deux fois de
        // plus ne ferait que retarder l'échec de plusieurs minutes.
        console.error(`${itemName}: erreur définitive (${error.message}). Abandon immédiat.`);
        return null;
      }

      console.error(`${itemName}: échec après ${maxRetries + 1} tentatives. Abandon.`);
      return null;
    }
  }
  
  return null;
}

/**
 * Règles de mise en forme pour le contenu généré.
 * Compatibles avec l'éditeur riche (TipTap) et la vue lecture (marked).
 */
const FORMATTING_RULES = `
MISE EN FORME (avec parcimonie - ne pas abuser) :
- **gras** : pour les termes importants, concepts clés, définitions principales (1-3 par paragraphe max).
- *italique* : pour l'emphasis discrète, titres d'œuvres, termes techniques.
- > Citation : pour les citations d'auteurs, études, sources (1-2 par section max).
- <mark>surlignage</mark> : pour les points cruciaux à retenir (1-2 par section max).
- [texte du lien](https://url-sourcée.com) : liens sourcés vers des ressources fiables (wikipedia.org, sites officiels, articles académiques). 1-3 liens par section max. URLs réelles et pertinentes.`;

/** Extrait des documents joints envoyé au modèle, par appel. */
const SOURCE_MAX_CHARS = 20000;

/**
 * Bloc de contexte issu des fichiers joints par l'utilisateur.
 * Quand il fournit ses propres documents (cours, polycopié, photos de manuel),
 * ceux-ci font autorité : le parcours doit porter sur CE contenu, et non sur ce
 * que le modèle sait par ailleurs du sujet.
 */
function buildSourceBlock(sourceText) {
  const text = String(sourceText || '').trim();
  if (!text) return '';
  const excerpt = text.length > SOURCE_MAX_CHARS
    ? `${text.slice(0, SOURCE_MAX_CHARS)}\n[…document tronqué…]`
    : text;
  return `\n\nDOCUMENTS FOURNIS PAR L'UTILISATEUR (source de référence) :\n"""\n${excerpt}\n"""\n`
    + 'Appuie-toi en priorité sur ces documents : ils décrivent le programme à '
    + 'couvrir. Complète par des connaissances extérieures uniquement lorsque '
    + 'c\'est nécessaire à la compréhension, jamais pour t\'en écarter.\n';
}

const STRUCTURE_JSON_SCHEMA = `
{
  "titre": "string - titre du parcours",
  "description": "string - présentation générale",
  "chapitres": [
    {
      "ordre": 1,
      "titre": "Chap 1. Titre du chapitre",
      "sous_chapitres": [
        { "ordre": 1, "titre": "Part 1. Titre du sous-chapitre" },
        { "ordre": 2, "titre": "Part 2. Titre" }
      ]
    }
  ]
}
`;

const ONE_SHOT_JSON_SCHEMA = `
{
  "titre": "string",
  "description": "string",
  "chapitres": [
    {
      "ordre": 1,
      "titre": "Chap 1. Titre",
      "contenu": "string",
      "sous_chapitres": [
        { "ordre": 1, "titre": "Part 1. Titre", "contenu": "string" }
      ]
    }
  ]
}
`;

function htmlToMarkdown(html) {
  if (!html || typeof html !== 'string') return '';
  // Protéger <mark> avant le strip des balises (surlignage conservé pour la vue lecture)
  let out = html.replace(/<mark[^>]*>([\s\S]*?)<\/mark>/gi, '__MARK_START__$1__MARK_END__');
  out = out
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '## $1\n\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
    .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n')
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
    .replace(/<ul[^>]*>/gi, '')
    .replace(/<\/ul>/gi, '\n')
    .replace(/<ol[^>]*>/gi, '')
    .replace(/<\/ol>/gi, '\n')
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<hr\s*\/?>/gi, '\n\n---\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/__MARK_START__([\s\S]*?)__MARK_END__/g, '<mark>$1</mark>')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+$/gm, '')
    .trim();
  return out;
}

function normalizeContent(content) {
  if (!content || typeof content !== 'string') return '';
  const trimmed = content.trim();
  if (trimmed.length < 200) return '';
  if (trimmed.includes('<') && trimmed.includes('>')) {
    return htmlToMarkdown(trimmed);
  }
  return trimmed;
}

/**
 * Déduit le type de formation souhaité à partir de la description utilisateur.
 * - skill : acquisition d'une compétence (comment faire, tutoriel, maîtriser, pratique...)
 * - knowledge : acquisition de connaissances (histoire, philosophie, concepts, théorie...)
 * @param {string} domainDescription - Description du domaine/formation
 * @returns {'skill'|'knowledge'}
 */
function inferFormationMode(domainDescription) {
  if (!domainDescription || typeof domainDescription !== 'string') return 'knowledge';
  const text = domainDescription.toLowerCase().trim();
  const skillIndicators = [
    /\bcomment\s+faire\b/,
    /\bapprendre\s+à\b/,
    /\btutoriel\b/,
    /\bmaîtriser\b/,
    /\bpratique\b/,
    /\bétape\s*par\s*étape\b/,
    /\btechnique\s+pour\b/,
    /\bméthode\s+pour\b/,
    /\bsavoir\s+faire\b/,
    /\bcompétence\b/,
    /\bformation\s+comment\b/,
  ];
  const knowledgeIndicators = [
    /\bl'?histoire\s+de\b/,
    /\bla\s+philosophie\s+(de|du)\b/,
    /\bformation\s+sur\s+(le|la|les|un)\b/,
    /\bcomprendre\s+(le|la|les)\b/,
    /\bintroduction\s+à\b/,
    /\bfondements\s+(de|du)\b/,
    /\bthéorie\s+(de|du)\b/,
    /\bconcept\s+(de|du)\b/,
  ];
  const hasSkill = skillIndicators.some((re) => re.test(text));
  const hasKnowledge = knowledgeIndicators.some((re) => re.test(text));
  if (hasSkill && !hasKnowledge) return 'skill';
  if (hasKnowledge && !hasSkill) return 'knowledge';
  return hasSkill ? 'skill' : 'knowledge';
}

async function generateStructure(domainDescription, formationMode = 'knowledge', sourceText = '') {
  const isSkill = formationMode === 'skill';
  const modeInstruction = isSkill
    ? `TYPE DE PARCOURS : Formation "comment faire" (acquisition d'une COMPÉTENCE). La structure doit prévoir des parties dédiées aux exemples pratiques, mises en situation et éventuellement "pièges à éviter" ou "erreurs courantes".`
    : `TYPE DE PARCOURS : Formation sur les CONNAISSANCES (concepts, histoire, philosophie, théorie). Chaque sous-chapitre = un thème ou concept distinct.`;

  const prompt = `Tu es un expert en ingénierie pédagogique. Crée la STRUCTURE d'un programme de formation sur :

"${domainDescription}"
${buildSourceBlock(sourceText)}
${modeInstruction}

RÈGLES :
- Jusqu'à 5 chapitres, jusqu'à 5 sous-chapitres par chapitre
- Chaque sous-chapitre = un thème distinct
- Pas de contenu, uniquement la structure (titres)

SCHÉMA JSON :
${STRUCTURE_JSON_SCHEMA}

Réponds UNIQUEMENT avec le JSON valide.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'Tu génères des structures en JSON valide uniquement.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
    });
    if (wasTruncated(completion)) {
      // Une structure coupée net donne un JSON invalide : mieux vaut le dire que
      // de laisser remonter un « Unexpected end of JSON input » incompréhensible.
      throw new Error('Structure tronquée par la limite de sortie du modèle.');
    }
    const raw = completion.choices[0]?.message?.content;
    if (!raw) return null;
    const parsed = parseJsonBlock(raw);
    if (!parsed.chapitres?.length) return null;
    return {
      name: (parsed.titre || domainDescription.slice(0, 80)).trim(),
      description: (parsed.description || domainDescription).trim(),
      chapters: parsed.chapitres.map((ch, i) => ({
        title: (ch.titre || `Chap ${i + 1}`).trim(),
        sections: (ch.sous_chapitres || []).map((sc, j) => ({
          title: (sc.titre || `Part ${j + 1}`).trim(),
        })),
      })),
    };
  } catch (err) {
    console.error('generateStructure:', err);
    return null;
  }
}

/**
 * Formate la structure en bloc texte pour les prompts.
 */
function formatStructureForContext(structure) {
  const lines = [
    `Programme : ${structure.name}`,
    `Description : ${structure.description}`,
    '',
    'Structure du parcours :',
    ...structure.chapters.map((ch, i) => {
      const secTitles = (ch.sections || []).map(s => s.title).join(', ');
      return `  Chapitre ${i + 1} : ${ch.title} → [${secTitles}]`;
    }),
  ];
  return lines.join('\n');
}

/**
 * Structure de secours si generateStructure échoue.
 * 5 chapitres × 5 sections max. Permet des appels séquentiels (pas de one-shot).
 */
function getFallbackStructure(domainDescription) {
  const name = domainDescription.length > 80 ? domainDescription.slice(0, 80).trim() + '...' : domainDescription.trim();
  return {
    name: name || 'Programme',
    description: domainDescription.trim(),
    chapters: [
      { title: 'Chap 1. Introduction et fondements', sections: [{ title: 'Part 1. Contexte et définitions' }, { title: 'Part 2. Origines et enjeux' }, { title: 'Part 3. Cadre général' }, { title: 'Part 4. Objectifs' }, { title: 'Part 5. Enjeux' }] },
      { title: 'Chap 2. Développement principal', sections: [{ title: 'Part 1. Concepts clés' }, { title: 'Part 2. Méthodes et approches' }, { title: 'Part 3. Applications pratiques' }, { title: 'Part 4. Exemples' }, { title: 'Part 5. Synthèse' }] },
      { title: 'Chap 3. Approfondissements', sections: [{ title: 'Part 1. Analyses détaillées' }, { title: 'Part 2. Cas d\'étude' }, { title: 'Part 3. Perspectives' }, { title: 'Part 4. Débats' }, { title: 'Part 5. Ouvertures' }] },
      { title: 'Chap 4. Méthodologie', sections: [{ title: 'Part 1. Méthodes' }, { title: 'Part 2. Outils' }, { title: 'Part 3. Pratiques' }, { title: 'Part 4. Recommandations' }, { title: 'Part 5. Pièges à éviter' }] },
      { title: 'Chap 5. Synthèse et conclusion', sections: [{ title: 'Part 1. Bilan' }, { title: 'Part 2. Débats actuels' }, { title: 'Part 3. Pistes de réflexion' }, { title: 'Part 4. Pour aller plus loin' }, { title: 'Part 5. Conclusion' }] },
    ],
  };
}

/**
 * Instructions pédagogiques pour le mode "compétence" (comment faire) : exemples, discussion, contre-exemples.
 */
const SKILL_MODE_INSTRUCTIONS = `
EXEMPLES ET PÉDAGOGIE (formation "comment faire") :
- Utilise des exemples concrets dès que c'est utile pour illustrer une idée ou une étape ; mets-en plusieurs quand le sujet le justifie, sans surcharger.
- Privilégie les exemples plutôt que des affirmations générales : les exemples doivent porter le sens.
- Pour chaque exemple (ou groupe d'exemples), discute brièvement : ce qu'il illustre, pourquoi c'est pertinent, ce qu'on en retient.
- Quand c'est pertinent, inclus des contre-exemples ou des pratiques à éviter : erreurs courantes, pièges, et pourquoi les éviter.
- Là où ça aide vraiment la compréhension, tu peux enchaîner 2 exemples à la suite en les expliquant en détail (contexte, étapes, résultat, pièges).
`;

/**
 * Instructions pour le mode "connaissances" : plus théorique, moins procédural.
 */
const KNOWLEDGE_MODE_INSTRUCTIONS = `
PÉDAGOGIE (formation sur les connaissances) :
- Privilégie définitions, contexte, histoire, débats et théories. Les exemples sont illustratifs plutôt que procéduraux.
- Chaque concept : définition claire + contexte + analyse. Pas besoin d'exemples pas à pas en grand nombre.
`;

/**
 * Appel 2, 6, 10... : Génère le chapitre N.
 * Contexte : structure + chapitres précédents (avec leurs sections).
 * Avec timeout de 5min et retry (max 3) pour garantir la fin de la génération.
 * @param {string} [formationMode='knowledge'] - 'skill' (comment faire) ou 'knowledge' (connaissances)
 */
async function generateChapterContent(domainName, structure, chapterIndex, previousChaptersWithSections = [], formationMode = 'knowledge', sourceText = '') {
  const ch = structure.chapters[chapterIndex];
  if (!ch) return null;
  const sectionTitles = (ch.sections || []).map(s => s.title).join(', ');
  const isSkill = formationMode === 'skill';
  const modeBlock = isSkill ? SKILL_MODE_INSTRUCTIONS : KNOWLEDGE_MODE_INSTRUCTIONS;

  const structureBlock = formatStructureForContext(structure);
  const previousContext = previousChaptersWithSections.length > 0
    ? `CONTEXTE (contenu déjà rédigé - fais suite logique) :\n${previousChaptersWithSections.map((pc, idx) => {
        const secs = (pc.sections || []).map(s => `  - ${s.title}: [${(s.content || '').length} caractères]`).join('\n');
        return `Chapitre ${idx + 1} - ${pc.title}:\n${(pc.content || '').slice(-2500)}\nSous-chapitres: ${(pc.sections || []).map(s => s.title).join(', ')}\n`;
      }).join('\n---\n')}`
    : 'C\'est le premier chapitre.';

  const numSections = (ch.sections || []).length;
  const sectionsList = (ch.sections || []).map((s, idx) => `${idx + 1}. ${s.title}`).join('\n');

  const prompt = `Tu es un auteur de manuels pédagogiques. Tu rédiges des textes LONG et DÉTAILLÉS AU MAXIMUM.
${buildSourceBlock(sourceText)}
STRUCTURE DU PROGRAMME :
---
${structureBlock}
---

${previousContext}

TÂCHE : Rédige le Chapitre ${chapterIndex + 1} : "${ch.title}".
Sous-chapitres à couvrir (${numSections} au total) : ${sectionTitles}

IMPÉRATIF : DÉTAILLE AU MAXIMUM. 8000+ caractères.

RÈGLES :
1. LONGUEUR MINIMALE : 8000 caractères. DÉTAILLE AU MAXIMUM.
2. Structure : ## ${ch.title} puis EXACTEMENT ${numSections} ### sous-sections correspondant aux sous-chapitres suivants :
${sectionsList}
3. Chaque sous-section : 2-4 paragraphes développés, exemples concrets. IMPORTANT : Ne mentionne QUE ces ${numSections} sous-sections, pas plus.
4. Cohérent avec la structure et le contenu précédent
5. Interdit : résumés, "etc.", conclusions hâtives, mentionner un nombre différent de sous-sections
${modeBlock}
${FORMATTING_RULES}`;

  // Fonction de génération interne (même prompt à chaque retry)
  const generateFn = async () => {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'Tu produis du contenu DÉTAILLÉ AU MAXIMUM. 8000+ caractères. Les réponses courtes sont INTERDITES.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 16384,
      temperature: 0.3,
    });
    let raw = (completion.choices[0]?.message?.content || '').trim();
    // Réponse coupée à max_tokens : elle s'arrête au milieu d'une phrase. On
    // revient à la dernière fin de paragraphe plutôt que de publier un texte
    // interrompu net dans le document.
    if (wasTruncated(completion)) {
      console.warn(`[markdown] chapitre "${ch.title}" tronqué par la limite de sortie, coupe au dernier paragraphe.`);
      raw = trimToLastParagraph(raw);
    }
    let text = normalizeContent(raw);
    if (text.length < 500) {
      throw new Error('Contenu généré trop court (< 500 caractères)');
    }
    if (text.length < MIN_CHARS_CHAPTER) {
      text = await expandIfTooShort(domainName, ch.title, text, MIN_CHARS_CHAPTER, 'chapitre');
    }
    return { title: ch.title, content: text };
  };

  // Utiliser le wrapper avec timeout et retry
  const result = await withTimeoutAndRetry(
    generateFn,
    SECTION_TIMEOUT_MS, // Même timeout de 5min pour les chapitres
    MAX_RETRIES,
    `Chapitre "${ch.title}"`
  );

  if (!result) {
    console.error(`generateChapterContent: échec après ${MAX_RETRIES + 1} tentatives pour "${ch.title}"`);
    // Retourner un contenu minimal pour ne pas bloquer la génération
    return {
      title: ch.title,
      content: `## ${ch.title}\n\nContenu à compléter selon vos recherches sur ce sujet.`,
    };
  }

  return result;
}

/**
 * Passe d'expansion si le contenu est trop court.
 */
async function expandIfTooShort(domainName, title, content, minChars, contentType = 'sous-chapitre') {
  if (content.length >= minChars) return content;
  const toAdd = minChars - content.length;
  const prompt = `Le ${contentType} suivant est TROP COURT (${content.length} caractères). Il DOIT faire au moins ${minChars} caractères.

Texte actuel (fin) :
---
${content.slice(-3000)}
---

TÂCHE : Produis UNIQUEMENT une SUITE à ajouter. Tu dois écrire AU MOINS ${toAdd} caractères supplémentaires.
- DÉTAILLE AU MAXIMUM : chaque idée en profondeur
- Ne répète pas le texte ci-dessus
- Continue naturellement le développement
- Ajoute : exemples détaillés, analyses, cas concrets, définitions
- Format Markdown
${FORMATTING_RULES}
- Ne t'arrête PAS avant d'avoir atteint ${minChars} caractères au total (ton ajout = ${toAdd}+ caractères)`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: `Tu prolonges un texte pédagogique. Tu DOIS produire au minimum ${toAdd} caractères. DÉTAILLE AU MAXIMUM. Les réponses courtes sont INACCEPTABLES.` },
        { role: 'user', content: prompt },
      ],
      max_tokens: OUTPUT_MAX_TOKENS,
      temperature: 0.4,
    });
    const added = normalizeContent((completion.choices[0]?.message?.content || '').trim());
    if (added.length >= 500) return content + '\n\n' + added;
  } catch (e) {
    console.warn('expandIfTooShort:', e.message);
  }
  return content;
}

/**
 * Appel 3, 4, 5, 7, 8... : Génère le sous-chapitre M du chapitre N.
 * Contexte : structure + chapitre N + sous-chapitres 1 à M-1 du chapitre N.
 * Avec timeout de 5min et retry (max 3) pour garantir la fin de la génération.
 * @param {string} [formationMode='knowledge'] - 'skill' (comment faire) ou 'knowledge' (connaissances)
 */
async function generateSectionContent(domainName, structure, chapterTitle, chapterContent, sectionTitle, previousSectionsInChapter = [], formationMode = 'knowledge', sourceText = '') {
  const MAX_TOKENS = 16384;
  const isSkill = formationMode === 'skill';
  const modeBlock = isSkill ? SKILL_MODE_INSTRUCTIONS : KNOWLEDGE_MODE_INSTRUCTIONS;

  const structureBlock = formatStructureForContext(structure);

  const chapterContext = `CHAPITRE DONT CE SOUS-CHAPITRE FAIT PARTIE :
---
## ${chapterTitle}
${(chapterContent || '').slice(-4000)}
---`;

  const previousSectionsBlock = previousSectionsInChapter.length > 0
    ? `SOUS-CHAPITRES DÉJÀ RÉDIGÉS (fais suite logique) :
${previousSectionsInChapter.map((s, i) => `### ${s.title} (extrait fin) :\n${(s.content || '').slice(-1500)}`).join('\n---\n')}`
    : 'Ce sous-chapitre ouvre le chapitre.';

  const prompt = `Tu es un auteur de manuels pédagogiques. Tu rédiges des textes TRÈS LONG et DÉTAILLÉS AU MAXIMUM.
${buildSourceBlock(sourceText)}
STRUCTURE DU PROGRAMME :
---
${structureBlock}
---

${chapterContext}

${previousSectionsBlock}

TÂCHE : Rédige le sous-chapitre "${sectionTitle}" du chapitre "${chapterTitle}".
Ce sous-chapitre traite spécifiquement de : ${sectionTitle}.

IMPÉRATIF : DÉTAILLE AU MAXIMUM. Chaque notion = plusieurs paragraphes.

RÈGLES STRICTES :
1. DÉTAILLÉ AU MAXIMUM : chaque idée = plusieurs paragraphes. Pas de survol.
2. LONGUEUR : 8000-12000 caractères. Objectif : plusieurs milliers de tokens. Les résumés sont INTERDITS.
3. Structure : ### ${sectionTitle} puis au moins 6 #### sous-parties. Chaque sous-partie = 2-4 paragraphes.
4. Chaque concept : définition + exemples (dates, noms, chiffres) + analyse.
5. Cohérent avec la structure, le chapitre et les sous-chapitres précédents
${modeBlock}
${FORMATTING_RULES}`;

  // Fonction de génération interne (même prompt à chaque retry)
  const generateFn = async () => {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'Tu produis du contenu DÉTAILLÉ AU MAXIMUM. Chaque notion = plusieurs paragraphes approfondis. 8000+ caractères minimum. Les réponses courtes ou superficielles sont INTERDITES.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: MAX_TOKENS,
      temperature: 0.3,
    });
    let raw = (completion.choices[0]?.message?.content || '').trim();
    if (wasTruncated(completion)) {
      console.warn(`[markdown] sous-chapitre "${sectionTitle}" tronqué par la limite de sortie, coupe au dernier paragraphe.`);
      raw = trimToLastParagraph(raw);
    }
    let text = normalizeContent(raw);
    if (text.length < 500) {
      throw new Error('Contenu généré trop court (< 500 caractères)');
    }
    if (text.length < MIN_CHARS_SECTION) {
      text = await expandIfTooShort(domainName, sectionTitle, text, MIN_CHARS_SECTION, 'sous-chapitre');
    }
    return { title: sectionTitle, content: text };
  };

  // Utiliser le wrapper avec timeout et retry
  const result = await withTimeoutAndRetry(
    generateFn,
    SECTION_TIMEOUT_MS,
    MAX_RETRIES,
    `Sous-chapitre "${sectionTitle}"`
  );

  if (!result) {
    console.error(`generateSectionContent: échec après ${MAX_RETRIES + 1} tentatives pour "${sectionTitle}"`);
    // Retourner un contenu minimal pour ne pas bloquer la génération
    return {
      title: sectionTitle,
      content: `### ${sectionTitle}\n\nContenu à compléter selon vos recherches sur ce sujet.`,
    };
  }

  return result;
}

async function generateDomainOneShot(domainDescription) {
  const prompt = `Tu es un expert pédagogue. Génère un parcours de formation sur :

"${domainDescription}"

RÈGLES : 3 à 4 chapitres, 3 à 4 sous-chapitres par chapitre. Contenu Markdown détaillé.
Schéma JSON :
${ONE_SHOT_JSON_SCHEMA}

Réponds UNIQUEMENT avec le JSON valide.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'Tu génères des formations en JSON valide.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.6,
      max_tokens: OUTPUT_MAX_TOKENS,
      response_format: { type: 'json_object' },
    });
    // La génération « one-shot » produit tout le parcours d'un coup : c'est le
    // cas où la limite de sortie est le plus souvent atteinte.
    if (wasTruncated(completion)) {
      throw new Error('Parcours tronqué par la limite de sortie du modèle.');
    }
    const raw = completion.choices[0]?.message?.content;
    if (!raw) return null;
    const parsed = parseJsonBlock(raw);
    if (!parsed.chapitres?.length) return null;
    const name = (parsed.titre || parsed.name || domainDescription.slice(0, 100)).trim();
    const description = (parsed.description || domainDescription).trim();
    const chapters = [];
    for (const ch of parsed.chapitres) {
      const chContent = normalizeContent(ch.contenu);
      const chTitle = (ch.titre || `Chap ${ch.ordre || chapters.length + 1}`).trim();
      const sections = [];
      if (ch.sous_chapitres && Array.isArray(ch.sous_chapitres)) {
        for (const sc of ch.sous_chapitres) {
          const scContent = normalizeContent(sc.contenu);
          if (scContent.length >= 200) {
            sections.push({ title: (sc.titre || `Part ${sc.ordre || sections.length + 1}`).trim(), content: scContent });
          }
        }
      }
      chapters.push({ title: chTitle, content: chContent || '', sections });
    }
    return chapters.length ? { name, description, chapters } : null;
  } catch (err) {
    console.error('generateDomainOneShot:', err);
    return null;
  }
}

async function generateSingleChapter(domainName, chapterIndex, previousTitles = []) {
  const context = previousTitles.length ? `Chapitres : ${previousTitles.join(', ')}. Fais suite.` : '';
  const prompt = `Chapitre COMPLET sur "${domainName}". ${context}
## Chap ${chapterIndex}. [Titre]
Puis au moins 5 ### sous-sections, chacune avec 2-3 paragraphes.
LONGUEUR MINIMALE : 8000 caractères. Réponses courtes INTERDITES.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'Contenu LONG (8000+ caractères). Jamais de résumé.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: OUTPUT_MAX_TOKENS,
      temperature: 0.3,
    });
    let content = normalizeContent((completion.choices[0]?.message?.content || '').trim());
    if (content.length < 500) return null;
    if (content.length < MIN_CHARS_CHAPTER) {
      const titleMatch = content.match(/^##\s+(.+?)$/m);
      const title = titleMatch ? titleMatch[1].trim() : `Chap ${chapterIndex}`;
      content = await expandIfTooShort(domainName, title, content, MIN_CHARS_CHAPTER, 'chapitre');
    }
    const titleMatch = content.match(/^##\s+(.+?)$/m);
    const rawTitle = titleMatch ? titleMatch[1].trim().replace(/^Chap\s*\d+\s*[.:]\s*/i, '').trim() : '';
    const title = rawTitle || 'Chap ' + chapterIndex;
    const contentWithoutTitle = titleMatch ? content.replace(/^##\s+.+?\n+/m, '').trim() : content;
    return { title: `Chap ${chapterIndex}. ${title}`, content: contentWithoutTitle };
  } catch (err) {
    console.error('generateSingleChapter:', err);
    return null;
  }
}

async function generateSingleSection(domainName, chapterTitle, sectionIndex) {
  const prompt = `Sous-chapitre COMPLET pour "${chapterTitle}" (domaine : "${domainName}").
### Part ${sectionIndex}. [Titre]
Puis au moins 6 #### sous-parties, chacune 2-3 paragraphes.
LONGUEUR MINIMALE : 8000 caractères. Réponses courtes INTERDITES.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'Contenu LONG (8000+ caractères). Jamais de résumé.' },
        { role: 'user', content: prompt },
      ],
      max_tokens: OUTPUT_MAX_TOKENS,
      temperature: 0.3,
    });
    let content = normalizeContent((completion.choices[0]?.message?.content || '').trim());
    if (content.length < 500) return null;
    const titleMatch = content.match(/^###\s+(.+?)$/m);
    const title = titleMatch ? titleMatch[1].trim() : `Part ${sectionIndex}`;
    if (content.length < MIN_CHARS_SECTION) {
      content = await expandIfTooShort(domainName, title, content, MIN_CHARS_SECTION, 'sous-chapitre');
    }
    const finalTitle = title.replace(/^Part\s*\d+\s*[.:]\s*/i, '').trim() || `Part ${sectionIndex}`;
    const contentWithoutTitle = titleMatch ? content.replace(/^###\s+.+?\n+/m, '').trim() : content;
    return { title: `Part ${sectionIndex}. ${finalTitle}`, content: contentWithoutTitle };
  } catch (err) {
    console.error('generateSingleSection:', err);
    return null;
  }
}

module.exports = {
  inferFormationMode,
  generateStructure,
  getFallbackStructure,
  generateChapterContent,
  generateSectionContent,
  generateDomainOneShot,
  generateSingleChapter,
  generateSingleSection,
  htmlToMarkdown,
  normalizeContent,
};

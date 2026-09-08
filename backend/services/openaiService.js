const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Génère un domaine complet avec chapitres et sous-chapitres structurés.
 * 
 * @param {string} description - Description du domaine à créer
 * @returns {Promise<{name: string, description: string, chapters: Array}>}
 */
/**
 * Crée une promesse qui rejette après un délai donné
 */
function timeoutPromise(ms, message) {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), ms);
  });
}

/**
 * Génère un domaine complet en générant chaque chapitre et sous-chapitre séparément
 * pour garantir une densité élevée (~15k caractères par section) et la précision factuelle
 */
async function generateDomainInChapters(description) {
  // Étape 1 : Générer la structure globale (nom, description, titres des chapitres)
  const structurePrompt = `Crée la structure d'un programme complet de formation sur le sujet suivant :

${description}

Génère UNIQUEMENT la structure avec :
- Un nom de domaine descriptif et accrocheur
- Une description du domaine (2-3 phrases)
- Les titres de 4 chapitres minimum (format : "Chap 1. Titre", "Chap 2. Titre", etc.)
- Pour chaque chapitre, les titres de 3 sous-chapitres minimum (format : "Part 1. Titre", "Part 2. Titre", etc.)

FORMAT JSON :
{
  "name": "Nom du domaine",
  "description": "Description",
  "chapters": [
    {
      "title": "Chap 1. Titre",
      "sections": [
        { "title": "Part 1. Titre" },
        { "title": "Part 2. Titre" },
        { "title": "Part 3. Titre" }
      ]
    }
  ]
}`;

  const structureResponse = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: 'Tu es un expert en création de programmes de formation structurés et pédagogiques.' },
      { role: 'user', content: structurePrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.7,
    max_tokens: 4096,
  });

  const structureData = JSON.parse(structureResponse.choices[0]?.message?.content || '{}');
  
  if (!structureData.name || !structureData.chapters || !Array.isArray(structureData.chapters)) {
    throw new Error('Impossible de générer la structure du domaine');
  }

  // Étape 2 : Générer le contenu de chaque chapitre et chaque sous-chapitre séparément
  const chapters = [];
  
  for (let chapterIdx = 0; chapterIdx < structureData.chapters.length; chapterIdx++) {
    const chapterStructure = structureData.chapters[chapterIdx];
    
    // Générer le contenu du chapitre principal
    const chapterSystemPrompt = `Tu es un expert pédagogique et un chercheur rigoureux. Tu crées du contenu de formation COMPLET, DENSE et FACTUEL.

EXIGENCES ABSOLUES :
- Le contenu DOIT faire environ 15 000 caractères (sans HTML), avec une tolérance entre 13 000 et 20 000 caractères
- Toutes les informations doivent être FACTUELLES et VÉRIFIABLES
- Évite les généralités vagues, privilégie les détails précis et concrets
- Utilise des exemples réels, des données vérifiables, des concepts bien établis
- Si tu mentionnes des dates, des chiffres, des noms, assure-toi qu'ils sont corrects
- Structure le contenu avec du HTML valide (h2, h3, p, ul, li, blockquote, strong, em)
- Le contenu doit être pédagogique, progressif et approfondi`;

    const chapterPrompt = `Génère le contenu COMPLET et ULTRA-DENSE du chapitre suivant d'un programme de formation :

CHAPITRE : ${chapterStructure.title}

CONTEXTE DU DOMAINE : ${structureData.name}
DESCRIPTION : ${structureData.description}

⚠️ EXIGENCE ABSOLUE - LONGUEUR MINIMALE : 
Le contenu DOIT faire AU MINIMUM 15 000 caractères de texte (sans HTML). C'est une exigence CRITIQUE et NON-NÉGOCIABLE.

EXIGENCES CRITIQUES :
1. LONGUEUR : AU MINIMUM 15 000 caractères (sans HTML), idéalement entre 15 000 et 20 000 caractères
2. DENSITÉ MAXIMALE : Chaque paragraphe doit être TRÈS riche en informations détaillées. Pas de phrases courtes ou vagues.
3. VÉRACITÉ : Toutes les informations doivent être factuelles et vérifiables
4. DÉTAILS EXTRÊMES : Inclus des explications TRÈS approfondies, des exemples concrets TRÈS détaillés (12-15 exemples minimum), des contextes historiques/théoriques COMPLETS
5. STRUCTURE : Utilise HTML pour formater (h2 pour les grandes sections, h3 pour les sous-sections, p pour les paragraphes, ul/li pour les listes, blockquote pour les citations importantes)

POUR ATTEINDRE 15 000 CARACTÈRES MINIMUM, développe en profondeur :
- Des explications TRÈS approfondies sur chaque concept clé (chaque explication doit faire 300-500 caractères minimum)
- De nombreux exemples concrets et TRÈS détaillés (12-15 minimum, chaque exemple 300-400 caractères)
- Des contextes historiques, théoriques ou pratiques COMPLETS et vérifiables
- Des analyses approfondies avec plusieurs perspectives documentées
- Des développements sur les implications pratiques et théoriques
- Des comparaisons détaillées avec d'autres concepts ou approches
- Des descriptions étape par étape TRÈS détaillées pour les processus complexes
- Des références à des théories, modèles ou pratiques établies avec explications

IMPORTANT : Chaque paragraphe doit faire au minimum 200-300 caractères. Le contenu doit être TRÈS dense en informations utiles.

FORMAT JSON :
{
  "content": "<h2>Introduction</h2><p>Contenu dense et complet...</p><h3>Sous-section</h3><p>Plus de contenu...</p>"
}`;

    const chapterResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: chapterSystemPrompt },
        { role: 'user', content: chapterPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.6, // Réduire la température pour plus de précision
      max_tokens: 16384, // Maximum pour gpt-4o
    });

    const chapterData = JSON.parse(chapterResponse.choices[0]?.message?.content || '{}');
    const chapterContent = chapterData.content || '';

    // Générer le contenu de chaque sous-chapitre séparément
    const sections = [];
    for (let sectionIdx = 0; sectionIdx < chapterStructure.sections.length; sectionIdx++) {
      const sectionStructure = chapterStructure.sections[sectionIdx];
      
      const sectionSystemPrompt = `Tu es un expert pédagogique et un chercheur rigoureux. Tu crées du contenu de formation COMPLET, ULTRA-DENSE et FACTUEL.

⚠️ EXIGENCE ABSOLUE CRITIQUE :
- Le contenu DOIT faire AU MINIMUM 15 000 caractères de texte (sans HTML)
- C'est une exigence NON-NÉGOCIABLE : si le contenu fait moins de 15 000 caractères, il sera REJETÉ
- Chaque paragraphe doit faire au minimum 200-300 caractères
- Chaque explication de concept doit faire 300-500 caractères minimum
- Chaque exemple doit faire 300-400 caractères minimum
- Tu DOIS inclure 12-15 exemples détaillés minimum

AUTRES EXIGENCES ABSOLUES :
- Toutes les informations doivent être FACTUELLES et VÉRIFIABLES
- Évite les généralités vagues, privilégie les détails précis et concrets
- Utilise des exemples réels, des données vérifiables, des concepts bien établis
- Si tu mentionnes des dates, des chiffres, des noms, assure-toi qu'ils sont corrects
- Structure le contenu avec du HTML valide (h2, h3, p, ul, li, blockquote, strong, em)
- Le contenu doit être pédagogique, progressif et TRÈS approfondi
- DÉVELOPPE chaque idée en profondeur, ne laisse aucune explication superficielle`;

      const sectionPrompt = `Génère le contenu COMPLET et ULTRA-DENSE du sous-chapitre suivant :

SOUS-CHAPITRE : ${sectionStructure.title}

CONTEXTE :
- Domaine : ${structureData.name}
- Chapitre parent : ${chapterStructure.title}
- Position : Part ${sectionIdx + 1} sur ${chapterStructure.sections.length}

⚠️ EXIGENCE ABSOLUE - LONGUEUR MINIMALE : 
Le contenu DOIT faire AU MINIMUM 15 000 caractères de texte (sans HTML). C'est une exigence CRITIQUE et NON-NÉGOCIABLE.
Si le contenu fait moins de 15 000 caractères, il sera REJETÉ et tu devras recommencer.

EXIGENCES CRITIQUES :
1. LONGUEUR : AU MINIMUM 15 000 caractères (sans HTML), idéalement entre 15 000 et 20 000 caractères
2. DENSITÉ MAXIMALE : Chaque paragraphe doit être TRÈS riche en informations détaillées. Pas de phrases courtes ou vagues. Développe chaque idée en profondeur.
3. VÉRACITÉ : Toutes les informations doivent être factuelles et vérifiables
4. DÉTAILS EXTRÊMES : Inclus des explications TRÈS approfondies, des exemples concrets TRÈS détaillés (12-15 exemples minimum), des contextes historiques/théoriques COMPLETS
5. STRUCTURE : Utilise HTML pour formater (h2 pour les grandes sections, h3 pour les sous-sections, p pour les paragraphes, ul/li pour les listes, blockquote pour les citations importantes)

POUR ATTEINDRE 15 000 CARACTÈRES MINIMUM, tu DOIS développer CHAQUE point suivant en profondeur :

1. INTRODUCTION DÉTAILLÉE (1500-2000 caractères) :
   - Contexte historique et évolution du concept
   - Importance et pertinence dans le domaine
   - Vue d'ensemble des aspects qui seront couverts

2. EXPLICATIONS APPROFONDIES (4000-5000 caractères) :
   - Définitions précises et détaillées de chaque concept clé
   - Explications théoriques approfondies avec plusieurs perspectives
   - Mécanismes, processus et principes sous-jacents expliqués en détail

3. EXEMPLES CONCRETS ET DÉTAILLÉS (4000-5000 caractères) :
   - 12 à 15 exemples réels et détaillés avec contexte complet
   - Chaque exemple doit faire 300-400 caractères minimum
   - Inclus des cas d'usage pratiques, des applications réelles, des scénarios détaillés

4. CONTEXTES ET ANALYSES (3000-4000 caractères) :
   - Contextes historiques complets et vérifiables
   - Analyses comparatives avec d'autres approches ou concepts
   - Perspectives multiples sur le sujet

5. IMPLICATIONS ET APPLICATIONS (2000-3000 caractères) :
   - Implications pratiques détaillées
   - Applications concrètes dans différents contextes
   - Avantages, limites et considérations importantes

6. CONCLUSION SYNTHÉTIQUE (500-1000 caractères) :
   - Synthèse des points clés
   - Points à retenir

IMPORTANT CRITIQUE : 
- Chaque paragraphe doit faire au minimum 200-300 caractères
- Ne pas utiliser de phrases courtes ou vagues
- Développe chaque idée avec des détails précis, des explications approfondies, des exemples concrets
- Le contenu doit être TRÈS dense en informations utiles
- COMPTE les caractères : tu DOIS atteindre au minimum 15 000 caractères de texte réel

FORMAT JSON :
{
  "content": "<h2>Introduction</h2><p>Contenu dense et complet...</p><h3>Sous-section</h3><p>Plus de contenu...</p>"
}`;

      const sectionResponse = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: sectionSystemPrompt },
          { role: 'user', content: sectionPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.6, // Réduire la température pour plus de précision
        max_tokens: 16384, // Maximum pour gpt-4o
      });

      const sectionData = JSON.parse(sectionResponse.choices[0]?.message?.content || '{}');
      const sectionContent = sectionData.content || '';

      sections.push({
        title: sectionStructure.title,
        content: sectionContent,
      });
    }

    chapters.push({
      title: chapterStructure.title,
      content: chapterContent,
      sections,
    });
  }

  return {
    name: structureData.name,
    description: structureData.description || '',
    chapters,
  };
}

async function generateDomainWithAI(description) {
  const GENERATION_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes en millisecondes
  
  try {
    // Créer la promesse de génération avec timeout de 10 minutes
    // Note : Pour générer 4 chapitres × 3 sous-chapitres avec ~15k caractères chacun,
    // on génère chaque chapitre et sous-chapitre séparément pour garantir la densité
    const generationPromise = generateDomainInChapters(description);

    // Appliquer le timeout : si la génération prend plus de 10 minutes, on arrête
    const parsed = await Promise.race([
      generationPromise,
      timeoutPromise(
        GENERATION_TIMEOUT_MS,
        'La génération a pris plus de 10 minutes et a été interrompue pour éviter un timeout.'
      ),
    ]);

    // Validation de la structure
    if (!parsed.name || !parsed.chapters || !Array.isArray(parsed.chapters)) {
      throw new Error('Structure de réponse invalide : nom ou chapitres manquants');
    }

    if (parsed.chapters.length < 4) {
      throw new Error(`Nombre de chapitres insuffisant : ${parsed.chapters.length} au lieu de 4 minimum`);
    }

    // Valider chaque chapitre et sous-chapitre
    for (let i = 0; i < parsed.chapters.length; i++) {
      const chapter = parsed.chapters[i];
      if (!chapter.title || !chapter.content) {
        throw new Error(`Chapitre ${i + 1} incomplet : titre ou contenu manquant`);
      }

      const chapterContentLength = chapter.content.replace(/<[^>]*>/g, '').length;
      if (chapterContentLength < 15000 || chapterContentLength > 20000) {
        throw new Error(
          `Chapitre "${chapter.title}" : contenu de ${chapterContentLength} caractères (attendu : MINIMUM 15 000 caractères, idéalement 15 000-20 000). Le contenu est TROP COURT. Il doit être BEAUCOUP plus développé avec : des explications TRÈS approfondies (chaque concept expliqué en 300-500 caractères), des exemples concrets TRÈS détaillés (12-15 minimum, chaque exemple 300-400 caractères), des contextes historiques/théoriques COMPLETS, des analyses approfondies, des descriptions étape par étape détaillées. Chaque paragraphe doit faire au minimum 200-300 caractères.`
        );
      }

      if (!chapter.sections || !Array.isArray(chapter.sections)) {
        throw new Error(`Chapitre "${chapter.title}" : sections manquantes ou invalides`);
      }

      if (chapter.sections.length < 3) {
        throw new Error(
          `Chapitre "${chapter.title}" : ${chapter.sections.length} sous-chapitres au lieu de 3 minimum`
        );
      }

      for (let j = 0; j < chapter.sections.length; j++) {
        const section = chapter.sections[j];
        if (!section.title || !section.content) {
          throw new Error(`Sous-chapitre ${j + 1} du chapitre "${chapter.title}" incomplet`);
        }

        const sectionContentLength = section.content.replace(/<[^>]*>/g, '').length;
        if (sectionContentLength < 15000 || sectionContentLength > 20000) {
          throw new Error(
            `Sous-chapitre "${section.title}" : contenu de ${sectionContentLength} caractères (attendu : MINIMUM 15 000 caractères, idéalement 15 000-20 000). Le contenu est TROP COURT. Il doit être BEAUCOUP plus développé avec : des explications TRÈS approfondies (chaque concept expliqué en 300-500 caractères), des exemples concrets TRÈS détaillés (12-15 minimum, chaque exemple 300-400 caractères), des contextes historiques/théoriques COMPLETS, des analyses approfondies, des descriptions étape par étape détaillées. Chaque paragraphe doit faire au minimum 200-300 caractères.`
          );
        }
      }
    }

    return parsed;
  } catch (error) {
    console.error('Erreur lors de la génération avec OpenAI:', error);
    throw new Error(`Erreur de génération IA : ${error.message}`);
  }
}

module.exports = {
  generateDomainWithAI,
};

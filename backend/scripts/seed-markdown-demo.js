#!/usr/bin/env node
/**
 * Injecte un contenu "démo" riche (HTML) dans un chapitre Markdown existant.
 *
 * Usage:
 *   node scripts/seed-markdown-demo.js
 *
 * Cherche un chapitre dont le titre correspond à TARGET_CHAPTER_TITLE (insensible à la casse).
 * Met à jour son champ `content` + crée/maj 2 sections pour la démo.
 */
require('dotenv').config();

const { sequelize, connectModels } = require('../config/database');
const MarkdownChapter = require('../models/MarkdownChapter');
const MarkdownSection = require('../models/MarkdownSection');
require('../models/MarkdownDomain');
require('../models/associations');

const TARGET_CHAPTER_TITLE = 'jeue(u';

const DEMO_CHAPTER_HTML = [
  '<h2>Bienvenue dans la démo</h2>',
  '<p>Ce chapitre contient un exemple de <strong>mise en forme</strong> “éditeur riche” (WYSIWYG).</p>',
  '<p>Tu peux tester : <code>gras</code>, <em>italique</em>, listes, citations, blocs note, et blocs de code.</p>',
  '',
  '<h3>Citation</h3>',
  '<blockquote>',
  '<p>« La simplicité est la sophistication suprême. »</p>',
  '<p>— Léonard de Vinci</p>',
  '</blockquote>',
  '',
  '<h3>Bloc note (callout)</h3>',
  '<blockquote data-type="note">',
  '<p><strong>Note</strong> : ce bloc sert à mettre en avant une idée, une astuce ou un rappel important.</p>',
  '<ul>',
  '<li>Astuce : utilise les titres (H2/H3) pour structurer.</li>',
  '<li>Astuce : un bloc de code pour les exemples.</li>',
  '</ul>',
  '</blockquote>',
  '',
  '<h3>Bloc de code</h3>',
  '<p>Exemple JavaScript (bloc de code) :</p>',
  '<pre><code class="language-js">const sum = (a, b) =&gt; a + b;\n\nconsole.log(sum(2, 3)); // 5</code></pre>',
  '',
  '<h3>Listes</h3>',
  '<p>Checklist rapide :</p>',
  '<ol>',
  '<li>Créer un domaine</li>',
  '<li>Créer un chapitre</li>',
  '<li>Écrire le contenu avec l’éditeur riche</li>',
  '</ol>',
  '<p>Points clés :</p>',
  '<ul>',
  '<li>Un paragraphe = une idée</li>',
  '<li>Les blocs note pour attirer l’œil</li>',
  '<li>Les citations pour mettre en valeur</li>',
  '</ul>',
].join('');

const DEMO_SECTIONS = [
  {
    title: 'Sous-partie — Exemple visuel',
    content: [
      '<p>Cette section montre un exemple de contenu avec un <strong>titre</strong>, une citation et du code.</p>',
      '<blockquote><p>« Ce qui se conçoit bien s’énonce clairement. »</p></blockquote>',
      '<pre><code class="language-bash">npm run dev</code></pre>',
    ].join(''),
  },
  {
    title: 'Sous-partie — Bloc note',
    content: [
      '<blockquote data-type="note">',
      '<p><strong>Rappel</strong> : garde tes chapitres courts et scindés en sections.</p>',
      '</blockquote>',
      '<p>Ensuite, étoffe progressivement.</p>',
    ].join(''),
  },
];

async function seed() {
  try {
    console.log('Connexion à la base de données...');
    await sequelize.authenticate();
    await connectModels({ force: false });

    const chapters = await MarkdownChapter.findAll({
      attributes: ['id', 'title', 'domain_id'],
      order: [['id', 'DESC']],
      limit: 500,
    });

    const target = chapters.find((c) => (c.title || '').trim().toLowerCase() === TARGET_CHAPTER_TITLE.toLowerCase());

    if (!target) {
      console.error(`Chapitre cible introuvable: "${TARGET_CHAPTER_TITLE}".`);
      console.error('Chapitres disponibles (les 20 derniers):');
      chapters.slice(0, 20).forEach((c) => console.error(`- [${c.id}] ${c.title}`));
      process.exit(1);
      return;
    }

    console.log(`Chapitre trouvé: [${target.id}] "${target.title}" (domain_id=${target.domain_id})`);
    await target.update({ content: DEMO_CHAPTER_HTML });
    console.log('Contenu du chapitre mis à jour.');

    for (const section of DEMO_SECTIONS) {
      const existing = await MarkdownSection.findOne({
        where: {
          chapter_id: target.id,
          title: section.title,
        },
      });

      if (existing) {
        await existing.update({ content: section.content });
        console.log(`Section mise à jour: "${section.title}"`);
      } else {
        await MarkdownSection.create({
          chapter_id: target.id,
          title: section.title,
          content: section.content,
        });
        console.log(`Section créée: "${section.title}"`);
      }
    }

    console.log('Seed terminé avec succès.');
    process.exit(0);
  } catch (error) {
    console.error('Erreur seed markdown demo:', error);
    process.exit(1);
  }
}

seed();


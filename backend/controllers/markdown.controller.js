const { Op } = require('sequelize');
const MarkdownDomain = require('../models/MarkdownDomain');
const MarkdownChapter = require('../models/MarkdownChapter');
const MarkdownSection = require('../models/MarkdownSection');
const User = require('../models/User');
const planRestrictionsService = require('../services/planRestrictionsService');
const markdownGenerationService = require('../services/markdown-generation.service');
const { isLambda, invokeWorkerAsync } = require('../utils/invoke-worker');
const { runDomainGenerationJob, runDomainGenerationResumeJob } = require('../jobs/markdown-generation-job');

/**
 * Liste des domaines Markdown avec chapitres et sections.
 * Pas d'order dans les include (compatibilité Sequelize/PostgreSQL en prod).
 */
exports.getAllDomains = async (req, res) => {
  try {
    // Vérifier que user_id est défini
    if (!req.user_id) {
      console.error('getAllDomains: req.user_id est undefined');
      return res.status(401).json({ error: 'Non authentifié' });
    }

    // console.log(`getAllDomains: Récupération des domaines pour user_id=${req.user_id}`); // Désactivé pour réduire les logs

    const domains = await MarkdownDomain.findAll({
      where: { user_id: req.user_id },
      order: [['position', 'ASC'], ['created_at', 'DESC']],
      include: [
        {
          model: MarkdownChapter,
          as: 'chapters',
          required: false,
          include: [
            {
              model: MarkdownSection,
              as: 'sections',
              required: false,
            },
          ],
        },
      ],
    });

    // console.log(`getAllDomains: ${domains.length} domaines trouvés`); // Désactivé pour réduire les logs

    const sorted = domains.map((d) => {
      const data = d.toJSON ? d.toJSON() : d;
      if (Array.isArray(data.chapters)) {
        data.chapters = [...data.chapters].sort(
          (a, b) => (a.position ?? 0) - (b.position ?? 0) || (new Date(b.created_at) - new Date(a.created_at))
        );
        data.chapters.forEach((ch) => {
          if (Array.isArray(ch.sections)) {
            ch.sections = [...ch.sections].sort(
              (a, b) => (a.position ?? 0) - (b.position ?? 0) || (new Date(b.created_at) - new Date(a.created_at))
            );
          }
        });
      }
      return data;
    });

    res.json({ domains: sorted });
  } catch (error) {
    console.error('Erreur lors de la récupération des domaines markdown:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({ 
      error: 'Erreur serveur', 
      details: process.env.NODE_ENV === 'production' ? undefined : error.message,
      stack: process.env.NODE_ENV === 'production' ? undefined : error.stack,
    });
  }
};

exports.createDomain = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Le nom du domaine est requis' });
    }

    // Vérification des restrictions du plan
    const restriction = await planRestrictionsService.canCreateMarkdownDomain(req.user_id);
    if (!restriction.allowed) {
      return res.status(403).json({
        error: `Limite atteinte pour votre plan ${restriction.plan}. Vous avez ${restriction.current}/${restriction.limit} domaines. Passez à un plan supérieur pour créer plus de domaines.`,
        restriction: {
          current: restriction.current,
          limit: restriction.limit,
          plan: restriction.plan,
        },
      });
    }

    const maxPos = await MarkdownDomain.max('position', {
      where: { user_id: req.user_id },
    });
    const position = (maxPos ?? -1) + 1;

    const domain = await MarkdownDomain.create({
      user_id: req.user_id,
      name: String(name).trim(),
      description: description ? String(description).trim() : null,
      position,
    });

    res.status(201).json({ domain });
  } catch (error) {
    console.error('Erreur lors de la création du domaine:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

exports.updateDomain = async (req, res) => {
  try {
    const { id } = req.params;
    const domain = await MarkdownDomain.findOne({
      where: { id, user_id: req.user_id },
    });
    if (!domain) {
      return res.status(404).json({ error: 'Domaine introuvable' });
    }

    const { name, description, position, is_public } = req.body;
    if (name !== undefined) domain.name = String(name).trim();
    if (description !== undefined) domain.description = description ? String(description).trim() : null;
    if (position !== undefined && typeof position === 'number') domain.position = position;
    if (is_public !== undefined && typeof is_public === 'boolean') domain.is_public = is_public;
    await domain.save();

    res.json({ domain });
  } catch (error) {
    console.error('Erreur lors de la mise à jour du domaine:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

exports.deleteDomain = async (req, res) => {
  try {
    const { id } = req.params;
    const domain = await MarkdownDomain.findOne({
      where: { id, user_id: req.user_id },
    });
    if (!domain) {
      return res.status(404).json({ error: 'Domaine introuvable' });
    }
    await domain.destroy();
    res.status(204).send();
  } catch (error) {
    console.error('Erreur lors de la suppression du domaine:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

/**
 * Liste des domaines publics partagés (avec recherche par mots-clés).
 */
exports.getPublicDomains = async (req, res) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const where = { is_public: true };
    if (search) {
      const terms = search.split(/\s+/).filter(Boolean);
      if (terms.length > 0) {
        where[Op.and] = terms.map((term) => ({
          [Op.or]: [
            { name: { [Op.iLike]: `%${term}%` } },
            { description: { [Op.iLike]: `%${term}%` } },
          ],
        }));
      }
    }

    const domains = await MarkdownDomain.findAll({
      where,
      order: [['updated_at', 'DESC']],
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'username'],
          required: true,
        },
        {
          model: MarkdownChapter,
          as: 'chapters',
          required: false,
          include: [
            {
              model: MarkdownSection,
              as: 'sections',
              required: false,
            },
          ],
        },
      ],
    });

    const sorted = domains.map((d) => {
      const data = d.toJSON ? d.toJSON() : d;
      data.isOwn = Number(d.user_id) === Number(req.user_id);
      if (Array.isArray(data.chapters)) {
        data.chapters = [...data.chapters].sort(
          (a, b) => (a.position ?? 0) - (b.position ?? 0) || (new Date(b.created_at) - new Date(a.created_at))
        );
        data.chapters.forEach((ch) => {
          if (Array.isArray(ch.sections)) {
            ch.sections = [...ch.sections].sort(
              (a, b) => (a.position ?? 0) - (b.position ?? 0) || (new Date(b.created_at) - new Date(a.created_at))
            );
          }
        });
      }
      return data;
    });

    res.json({ domains: sorted });
  } catch (error) {
    console.error('Erreur lors de la récupération des domaines publics:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

/**
 * Mettre à jour la visibilité (privé/public) d'un domaine.
 */
exports.setDomainVisibility = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_public } = req.body;
    if (typeof is_public !== 'boolean') {
      return res.status(400).json({ error: 'is_public doit être un booléen' });
    }
    const domain = await MarkdownDomain.findOne({
      where: { id, user_id: req.user_id },
    });
    if (!domain) {
      return res.status(404).json({ error: 'Domaine introuvable' });
    }
    domain.is_public = is_public;
    await domain.save();
    res.json({ domain });
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la visibilité:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

/**
 * Importer un domaine public (copie complète, indépendante de l'original).
 */
exports.importDomain = async (req, res) => {
  try {
    const { id } = req.params;
    const source = await MarkdownDomain.findOne({
      where: { id, is_public: true },
      include: [
        { model: User, as: 'user', attributes: ['username'], required: true },
        {
          model: MarkdownChapter,
          as: 'chapters',
          required: false,
          include: [{ model: MarkdownSection, as: 'sections', required: false }],
        },
      ],
    });

    if (!source) {
      return res.status(404).json({ error: 'Domaine public introuvable' });
    }
    if (Number(source.user_id) === Number(req.user_id)) {
      return res.status(400).json({ error: 'Vous ne pouvez pas importer votre propre domaine' });
    }

    const restriction = await planRestrictionsService.canImportDomain(req.user_id);
    if (!restriction.allowed) {
      return res.status(403).json({
        error: `Limite d'imports de domaines atteinte pour votre plan ${restriction.plan}. Vous avez ${restriction.current}/${restriction.limit} imports. Passez à un plan supérieur pour en importer plus.`,
        restriction: {
          current: restriction.current,
          limit: restriction.limit,
          plan: restriction.plan,
        },
      });
    }

    const creatorUsername = source.user?.username || 'inconnu';
    const maxPos = await MarkdownDomain.max('position', { where: { user_id: req.user_id } });
    const position = (maxPos ?? -1) + 1;

    const newDomain = await MarkdownDomain.create({
      user_id: req.user_id,
      name: `${source.name} (par @${creatorUsername})`,
      description: source.description,
      position,
      is_public: false,
      imported_from_domain_id: source.id,
    });

    const sourceData = source.toJSON ? source.toJSON() : source;
    const chapters = Array.isArray(sourceData.chapters)
      ? [...sourceData.chapters].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      : [];

    for (const ch of chapters) {
      const newChapter = await MarkdownChapter.create({
        domain_id: newDomain.id,
        title: ch.title,
        content: ch.content ?? null,
        position: ch.position ?? 0,
      });
      const sections = Array.isArray(ch.sections)
        ? [...ch.sections].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        : [];
      for (const sec of sections) {
        await MarkdownSection.create({
          chapter_id: newChapter.id,
          title: sec.title,
          content: sec.content ?? '',
          position: sec.position ?? 0,
        });
      }
    }

    const domain = await MarkdownDomain.findByPk(newDomain.id, {
      include: [
        {
          model: MarkdownChapter,
          as: 'chapters',
          required: false,
          include: [{ model: MarkdownSection, as: 'sections', required: false }],
        },
      ],
    });

    res.status(201).json({ domain: domain?.toJSON ? domain.toJSON() : domain });
  } catch (error) {
    console.error('Erreur lors de l\'import du domaine:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

exports.createChapter = async (req, res) => {
  try {
    const { domainId } = req.params;
    const { title, content } = req.body;

    const domain = await MarkdownDomain.findOne({
      where: { id: domainId, user_id: req.user_id },
    });
    if (!domain) {
      return res.status(404).json({ error: 'Domaine introuvable' });
    }
    if (!title || !String(title).trim()) {
      return res.status(400).json({ error: 'Le titre du chapitre est requis' });
    }

    // Vérification des restrictions du plan
    const restriction = await planRestrictionsService.canCreateMarkdownChapter(req.user_id, domainId);
    if (!restriction.allowed) {
      return res.status(403).json({
        error: `Limite atteinte pour votre plan ${restriction.plan}. Ce domaine a déjà ${restriction.current}/${restriction.limit} chapitres. Passez à un plan supérieur pour créer plus de chapitres.`,
        restriction: {
          current: restriction.current,
          limit: restriction.limit,
          plan: restriction.plan,
        },
      });
    }

    const maxPos = await MarkdownChapter.max('position', { where: { domain_id: domainId } });
    const position = (maxPos ?? -1) + 1;

    const chapter = await MarkdownChapter.create({
      domain_id: domainId,
      title: String(title).trim(),
      content: content ? String(content).trim() : null,
      position,
    });

    res.status(201).json({ chapter });
  } catch (error) {
    console.error('Erreur lors de la création du chapitre:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

exports.updateChapter = async (req, res) => {
  try {
    const { domainId, chapterId } = req.params;
    const domain = await MarkdownDomain.findOne({
      where: { id: domainId, user_id: req.user_id },
    });
    if (!domain) {
      return res.status(404).json({ error: 'Domaine introuvable' });
    }

    const chapter = await MarkdownChapter.findOne({
      where: { id: chapterId, domain_id: domainId },
    });
    if (!chapter) {
      return res.status(404).json({ error: 'Chapitre introuvable' });
    }

    const { title, content, position } = req.body;
    if (title !== undefined) chapter.title = String(title).trim();
    if (content !== undefined) chapter.content = content ? String(content).trim() : null;
    if (position !== undefined && typeof position === 'number') chapter.position = position;
    await chapter.save();

    res.json({ chapter });
  } catch (error) {
    console.error('Erreur lors de la mise à jour du chapitre:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

exports.deleteChapter = async (req, res) => {
  try {
    const { domainId, chapterId } = req.params;
    const domain = await MarkdownDomain.findOne({
      where: { id: domainId, user_id: req.user_id },
    });
    if (!domain) {
      return res.status(404).json({ error: 'Domaine introuvable' });
    }

    const chapter = await MarkdownChapter.findOne({
      where: { id: chapterId, domain_id: domainId },
    });
    if (!chapter) {
      return res.status(404).json({ error: 'Chapitre introuvable' });
    }
    await chapter.destroy();
    res.status(204).send();
  } catch (error) {
    console.error('Erreur lors de la suppression du chapitre:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

/**
 * Réorganiser les chapitres d'un domaine
 */
exports.reorderChapters = async (req, res) => {
  try {
    const { domainId } = req.params;
    const { chapter_ids } = req.body;

    const domain = await MarkdownDomain.findOne({
      where: { id: domainId, user_id: req.user_id },
    });
    if (!domain) {
      return res.status(404).json({ error: 'Domaine introuvable' });
    }

    if (!Array.isArray(chapter_ids)) {
      return res.status(400).json({ error: 'chapter_ids doit être un tableau' });
    }

    const chapterIds = chapter_ids.map((id) => (typeof id === 'number' ? id : parseInt(String(id), 10)));
    if (chapterIds.some((n) => isNaN(n))) {
      return res.status(400).json({ error: 'chapter_ids contient des valeurs invalides' });
    }

    // Vérifier que tous les chapitres appartiennent au domaine
    const chapters = await MarkdownChapter.findAll({
      where: {
        id: { [Op.in]: chapterIds },
        domain_id: domainId,
      },
    });

    if (chapters.length !== chapterIds.length) {
      return res.status(400).json({ error: 'Certains chapitres sont introuvables ou n\'appartiennent pas au domaine' });
    }

    // Mettre à jour les positions
    const updates = chapterIds.map((chapterId, index) => {
      return MarkdownChapter.update(
        { position: index },
        { where: { id: chapterId, domain_id: domainId } }
      );
    });

    await Promise.all(updates);

    // Récupérer les chapitres mis à jour avec leurs sections
    const updatedChapters = await MarkdownChapter.findAll({
      where: { domain_id: domainId },
      order: [['position', 'ASC'], ['created_at', 'DESC']],
      include: [
        {
          model: MarkdownSection,
          as: 'sections',
          required: false,
        },
      ],
    });

    const sorted = updatedChapters.map((ch) => {
      const data = ch.toJSON ? ch.toJSON() : ch;
      if (Array.isArray(data.sections)) {
        data.sections = [...data.sections].sort(
          (a, b) => (a.position ?? 0) - (b.position ?? 0) || (new Date(b.created_at) - new Date(a.created_at))
        );
      }
      return data;
    });

    res.json({ chapters: sorted });
  } catch (error) {
    console.error('Erreur lors de la réorganisation des chapitres:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

exports.createSection = async (req, res) => {
  try {
    const { domainId, chapterId } = req.params;
    const { title, content } = req.body;

    const domain = await MarkdownDomain.findOne({
      where: { id: domainId, user_id: req.user_id },
    });
    if (!domain) {
      return res.status(404).json({ error: 'Domaine introuvable' });
    }

    const chapter = await MarkdownChapter.findOne({
      where: { id: chapterId, domain_id: domainId },
    });
    if (!chapter) {
      return res.status(404).json({ error: 'Chapitre introuvable' });
    }
    if (!title || !String(title).trim()) {
      return res.status(400).json({ error: 'Le titre de la section est requis' });
    }

    // Vérification des restrictions du plan
    const restriction = await planRestrictionsService.canCreateMarkdownSection(req.user_id, chapterId);
    if (!restriction.allowed) {
      return res.status(403).json({
        error: `Limite atteinte pour votre plan ${restriction.plan}. Ce chapitre a déjà ${restriction.current}/${restriction.limit} sous-chapitres. Passez à un plan supérieur pour créer plus de sous-chapitres.`,
        restriction: {
          current: restriction.current,
          limit: restriction.limit,
          plan: restriction.plan,
        },
      });
    }

    const maxPos = await MarkdownSection.max('position', { where: { chapter_id: chapterId } });
    const position = (maxPos ?? -1) + 1;

    const section = await MarkdownSection.create({
      chapter_id: chapterId,
      title: String(title).trim(),
      content: content ? String(content).trim() : '',
      position,
    });

    res.status(201).json({ section });
  } catch (error) {
    console.error('Erreur lors de la création de la section:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

exports.updateSection = async (req, res) => {
  try {
    const { domainId, chapterId, sectionId } = req.params;
    if (String(sectionId).toLowerCase() === 'reorder') {
      return res.status(400).json({
        error: 'Utiliser PUT .../sections/reorder pour réordonner les sections.',
      });
    }
    const domain = await MarkdownDomain.findOne({
      where: { id: domainId, user_id: req.user_id },
    });
    if (!domain) {
      return res.status(404).json({ error: 'Domaine introuvable' });
    }

    const chapter = await MarkdownChapter.findOne({
      where: { id: chapterId, domain_id: domainId },
    });
    if (!chapter) {
      return res.status(404).json({ error: 'Chapitre introuvable' });
    }

    const section = await MarkdownSection.findOne({
      where: { id: sectionId, chapter_id: chapterId },
    });
    if (!section) {
      return res.status(404).json({ error: 'Section introuvable' });
    }

    const { title, content, new_chapter_id } = req.body;
    if (title !== undefined) section.title = String(title).trim();
    if (content !== undefined) section.content = String(content).trim();
    
    // Permettre de changer le chapitre parent
    if (new_chapter_id !== undefined && new_chapter_id !== chapterId) {
      const newChapter = await MarkdownChapter.findOne({
        where: { id: new_chapter_id, domain_id: domainId },
      });
      if (!newChapter) {
        return res.status(404).json({ error: 'Nouveau chapitre introuvable' });
      }
      section.chapter_id = new_chapter_id;
    }
    
    await section.save();

    res.json({ section });
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la section:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

exports.deleteSection = async (req, res) => {
  try {
    const { domainId, chapterId, sectionId } = req.params;
    const domain = await MarkdownDomain.findOne({
      where: { id: domainId, user_id: req.user_id },
    });
    if (!domain) {
      return res.status(404).json({ error: 'Domaine introuvable' });
    }

    const chapter = await MarkdownChapter.findOne({
      where: { id: chapterId, domain_id: domainId },
    });
    if (!chapter) {
      return res.status(404).json({ error: 'Chapitre introuvable' });
    }

    const section = await MarkdownSection.findOne({
      where: { id: sectionId, chapter_id: chapterId },
    });
    if (!section) {
      return res.status(404).json({ error: 'Section introuvable' });
    }
    await section.destroy();
    res.status(204).send();
  } catch (error) {
    console.error('Erreur lors de la suppression de la section:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

/**
 * Liste toutes les sections avec filtres (domaine, chapitre, date)
 */
exports.getAllSections = async (req, res) => {
  try {
    const { domain_id, chapter_id, sort = 'created_at', order = 'desc' } = req.query;

    const include = [
      {
        model: MarkdownChapter,
        as: 'chapter',
        required: true,
        include: [
          {
            model: MarkdownDomain,
            as: 'domain',
            required: true,
            where: { user_id: req.user_id },
          },
        ],
      },
    ];

    if (domain_id) {
      include[0].include[0].where = { ...include[0].include[0].where, id: domain_id };
    }
    if (chapter_id) {
      include[0].where = { id: chapter_id };
    }

    const validSort = ['created_at', 'updated_at', 'title'].includes(sort) ? sort : 'created_at';
    const validOrder = order === 'asc' ? 'ASC' : 'DESC';

    const sections = await MarkdownSection.findAll({
      include,
      order: [[validSort, validOrder]],
    });

    res.json({ sections });
  } catch (error) {
    console.error('Erreur lors de la récupération des sections:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

/**
 * Réorganiser les sections d'un chapitre
 */
exports.reorderSections = async (req, res) => {
  try {
    const { domainId, chapterId } = req.params;
    const { section_ids } = req.body;

    const domain = await MarkdownDomain.findOne({
      where: { id: domainId, user_id: req.user_id },
    });
    if (!domain) {
      return res.status(404).json({ error: 'Domaine introuvable' });
    }

    const chapter = await MarkdownChapter.findOne({
      where: { id: chapterId, domain_id: domainId },
    });
    if (!chapter) {
      return res.status(404).json({ error: 'Chapitre introuvable' });
    }

    if (!Array.isArray(section_ids)) {
      return res.status(400).json({ error: 'section_ids doit être un tableau' });
    }

    const sectionIds = section_ids.map((id) => (typeof id === 'number' ? id : parseInt(String(id), 10)));
    if (sectionIds.some((n) => isNaN(n))) {
      return res.status(400).json({ error: 'section_ids contient des valeurs invalides' });
    }

    // Vérifier que toutes les sections appartiennent au chapitre
    const sections = await MarkdownSection.findAll({
      where: {
        id: { [Op.in]: sectionIds },
        chapter_id: chapterId,
      },
    });

    if (sections.length !== sectionIds.length) {
      return res.status(400).json({ error: 'Certaines sections sont introuvables ou n\'appartiennent pas au chapitre' });
    }

    // Mettre à jour les positions
    const updates = sectionIds.map((sectionId, index) => {
      return MarkdownSection.update(
        { position: index },
        { where: { id: sectionId, chapter_id: chapterId } }
      );
    });

    await Promise.all(updates);

    // Récupérer les sections mises à jour
    const updatedSections = await MarkdownSection.findAll({
      where: { chapter_id: chapterId },
      order: [['position', 'ASC'], ['created_at', 'DESC']],
    });

    res.json({ sections: updatedSections });
  } catch (error) {
    console.error('Erreur lors de la réorganisation des sections:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

/**
 * Génère un domaine complet avec l'IA (chapitres + sous-chapitres).
 */
/**
 * Récupère l'état de progression de la génération d'un domaine
 */
exports.getDomainGenerationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const domain = await MarkdownDomain.findOne({
      where: { id, user_id: req.user_id },
      attributes: ['id', 'name', 'generation_status', 'generation_progress', 'generation_step', 'generation_log'],
    });
    
    if (!domain) {
      return res.status(404).json({ error: 'Domaine introuvable' });
    }
    
    res.json({
      domain_id: domain.id,
      name: domain.name,
      generation_status: domain.generation_status,
      generation_progress: domain.generation_progress,
      generation_step: domain.generation_step,
      generation_log: domain.generation_log || [],
    });
  } catch (error) {
    console.error('Erreur lors de la récupération du statut de génération:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

/**
 * POST /api/markdown/domains/:id/cancel-generation
 * Annule la génération en cours d'un domaine. Si < 1 minute, ne compte pas dans le quota.
 */
exports.cancelDomainGeneration = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user_id;
    if (!userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }
    
    const domain = await MarkdownDomain.findOne({
      where: { id, user_id: userId },
    });
    
    if (!domain) {
      return res.status(404).json({ error: 'Domaine introuvable' });
    }
    
    if (domain.generation_status !== 'generating') {
      return res.status(400).json({ error: 'Aucune génération en cours pour ce domaine' });
    }
    
    if (domain.generation_cancelled) {
      return res.status(400).json({ error: 'Génération déjà annulée' });
    }
    
    const startedAt = domain.generation_started_at || domain.created_at;
    const durationMs = Date.now() - new Date(startedAt).getTime();
    const durationMinutes = durationMs / (1000 * 60);
    const countsAsGeneration = durationMinutes >= 1;
    
    // Marquer comme annulé
    await domain.update({
      generation_cancelled: true,
      generation_status: null,
      generation_step: 'cancelled',
      generation_log: [
        ...(domain.generation_log || []),
        {
          message: `Génération annulée par l'utilisateur${countsAsGeneration ? ' (compte dans le quota)' : ' (ne compte pas dans le quota, < 1 min)'}.`,
          status: 'error',
          at: new Date().toISOString(),
        },
      ],
    });
    
    res.json({
      success: true,
      message: 'Génération annulée',
      countsAsGeneration,
      durationMinutes: Math.round(durationMinutes * 10) / 10,
    });
  } catch (error) {
    console.error('Erreur cancelDomainGeneration:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

/**
 * POST /api/markdown/domains/:id/resume-generation
 * Reprend la génération d'un domaine depuis le point d'arrêt.
 */
exports.resumeDomainGeneration = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user_id;
    if (!userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }
    
    const domain = await MarkdownDomain.findOne({
      where: { id, user_id: userId },
    });
    
    if (!domain) {
      return res.status(404).json({ error: 'Domaine introuvable' });
    }
    
    // Vérifier que la génération est en erreur ou bloquée
    if (domain.generation_status === 'generating' && !domain.generation_cancelled) {
      // Si la génération est toujours en cours, vérifier si elle est vraiment bloquée
      const startedAt = domain.generation_started_at || domain.created_at;
      const durationMs = Date.now() - new Date(startedAt).getTime();
      const durationMinutes = durationMs / (1000 * 60);
      
      // Si la génération a démarré il y a plus de 20 minutes et n'est pas terminée, considérer comme bloquée
      if (durationMinutes < 20 && domain.generation_progress < 100) {
        return res.status(400).json({ 
          error: 'La génération est toujours en cours. Attendez quelques instants ou annulez-la d\'abord.' 
        });
      }
    }
    
    if (domain.generation_status === null && domain.generation_progress === 100) {
      return res.status(400).json({ error: 'La génération est déjà terminée' });
    }
    
    if (domain.generation_cancelled) {
      return res.status(400).json({ error: 'La génération a été annulée. Vous devez créer un nouveau domaine.' });
    }
    
    // Réinitialiser le statut pour reprendre
    const log = domain.generation_log || [];
    log.push({
      message: 'Reprise de la génération depuis le point d\'arrêt...',
      status: 'running',
      at: new Date().toISOString(),
    });
    
    await domain.update({
      generation_status: 'generating',
      generation_cancelled: false,
      generation_log: log,
      generation_started_at: new Date(), // Redémarrer le timer
    });
    
    // En prod (Lambda) : invoker une 2e invocation pour que la reprise continue après fermeture du navigateur.
    // En local : setImmediate dans le même processus.
    if (isLambda()) {
      invokeWorkerAsync({ internal: 'run-domain-generation-resume', domainId: domain.id }).catch((err) =>
        console.error('Invoke worker run-domain-generation-resume:', err)
      );
    } else {
      setImmediate(() => runDomainGenerationResumeJob(domain.id));
    }

    res.json({
      success: true,
      message: 'Reprise de la génération démarrée',
    });
  } catch (error) {
    console.error('Erreur resumeDomainGeneration:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

exports.generateDomainWithAI = async (req, res) => {
  let domain = null;
  try {
    console.log('generateDomainWithAI appelé avec:', req.body);
    const { description } = req.body;
    if (!description || !String(description).trim()) {
      return res.status(400).json({ error: 'La description du domaine est requise' });
    }

    // Vérification des restrictions du plan pour les générations IA
    let restriction;
    try {
      restriction = await planRestrictionsService.canGenerateDomainWithAI(req.user_id);
    } catch (restrictionErr) {
      console.error('Erreur lors de la vérification des restrictions:', restrictionErr);
      return res.status(500).json({ 
        error: 'Erreur lors de la vérification des restrictions', 
        details: restrictionErr.message 
      });
    }
    
    if (!restriction.allowed) {
      return res.status(403).json({
        error: `Limite de générations IA atteinte pour votre plan ${restriction.plan}. Vous avez utilisé ${restriction.current}/${restriction.limit} générations. Passez à un plan supérieur pour générer plus de domaines avec l'IA.`,
        restriction: {
          current: restriction.current,
          limit: restriction.limit,
          plan: restriction.plan,
        },
      });
    }

    // Utiliser la même méthodologie que l'onboarding
    const domainDescription = String(description).trim();
    
    // Extraire le nom du domaine depuis la description
    const domainName = domainDescription.length > 100 
      ? domainDescription.slice(0, 100) 
      : domainDescription;

    // Créer le domaine
    const maxPos = await MarkdownDomain.max('position', {
      where: { user_id: req.user_id },
    });
    const position = (maxPos ?? -1) + 1;

    // Fichiers joints : ils serviront de source de référence à la rédaction.
    const uploadIds = Array.isArray(req.body?.uploadIds)
      ? req.body.uploadIds.map((id) => parseInt(id, 10)).filter(Number.isInteger).slice(0, 10)
      : [];

    domain = await MarkdownDomain.create({
      user_id: req.user_id,
      name: domainName,
      description: domainDescription,
      position,
      upload_ids: uploadIds,
      is_public: false,
      generation_status: 'generating',
      generation_progress: 0,
      generation_step: 'initialisation',
      generation_log: [{ message: 'Démarrage de la génération...', status: 'running', at: new Date().toISOString() }],
      generation_started_at: new Date(),
      generation_cancelled: false,
    });
    
    // Retourner immédiatement le domaine avec son ID pour permettre le polling
    res.status(202).json({ 
      domain: {
        id: domain.id,
        name: domain.name,
        generation_status: domain.generation_status,
        generation_progress: domain.generation_progress,
        generation_step: domain.generation_step,
      },
      message: 'Génération démarrée. Utilisez GET /api/markdown/domains/:id/generation-status pour suivre la progression.'
    });

    // En prod (Lambda) : invoker une 2e invocation pour que la génération continue après fermeture du navigateur.
    // En local : setImmediate dans le même processus.
    if (isLambda()) {
      invokeWorkerAsync({ internal: 'run-domain-generation', domainId: domain.id }).catch((err) =>
        console.error('Invoke worker run-domain-generation:', err)
      );
    } else {
      setImmediate(() => runDomainGenerationJob(domain.id));
    }
    return;
  } catch (error) {
    console.error('Erreur lors de la génération du domaine avec IA:', error);
    console.error('Stack trace:', error.stack);

    try {
      if (domain && domain.id) {
        const log = domain.generation_log || [];
        log.push({ 
          message: `Erreur : ${error.message}`, 
          status: 'error', 
          at: new Date().toISOString() 
        });
        await domain.update({
          generation_status: 'error',
          generation_step: 'error',
          generation_log: log,
        });
      }
    } catch (updateErr) {
      console.error('Erreur lors de la mise à jour du statut d\'erreur:', updateErr);
    }
    
    res.status(500).json({ 
      error: 'Erreur lors de la génération', 
      details: error.message,
      domain_id: domain?.id || null,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};


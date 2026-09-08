const { Op } = require('sequelize');
const Debate = require('../models/Debate');
const DebateNode = require('../models/DebateNode');
const DebateArgument = require('../models/DebateArgument');

/** Étapes de l'outil, dans l'ordre : la progression d'un nœud va de 0 à 5. */
const STEP_COUNT = 5;

const SIDES = ['pour', 'contre'];
const POSITIONS = ['pour', 'nuance', 'contre'];
const VERDICTS = ['verifie', 'nuance', 'faux'];

const clean = (value, max) => {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (!text) return null;
  return max ? text.slice(0, max) : text;
};

const cleanTags = (tags) => {
  if (!Array.isArray(tags)) return [];
  return tags
    .map((t) => clean(t, 60))
    .filter(Boolean)
    .slice(0, 12);
};

const serializeArgument = (arg) => ({
  id: arg.id,
  node_id: arg.node_id,
  side: arg.side,
  text: arg.text,
  tags: Array.isArray(arg.tags) ? arg.tags : [],
  source: arg.source || '',
  support: arg.support || '',
  date: arg.date_label || '',
  verdict: arg.verdict || null,
  note: arg.note || '',
  position: arg.position,
  created_at: arg.created_at,
  updated_at: arg.updated_at,
});

const serializeNode = (node, { withArguments = true } = {}) => ({
  id: node.id,
  debate_id: node.debate_id,
  title: node.title,
  kind: node.kind,
  step_done: node.step_done,
  opinion: node.opinion || '',
  side: node.side || null,
  position: node.position,
  arguments_count: Array.isArray(node.arguments) ? node.arguments.length : 0,
  ...(withArguments && Array.isArray(node.arguments)
    ? { arguments: node.arguments.map(serializeArgument) }
    : {}),
});

const serializeDebate = (debate, { withArguments = true } = {}) => {
  const nodes = Array.isArray(debate.nodes) ? debate.nodes : [];
  const general = nodes.find((n) => n.kind === 'general') || null;
  const subs = nodes.filter((n) => n.kind !== 'general');
  return {
    id: debate.id,
    title: debate.title,
    question: debate.question,
    desc: {
      termes: debate.desc_termes || '',
      limites: debate.desc_limites || '',
      tensions: debate.desc_tensions || '',
    },
    created_at: debate.created_at,
    updated_at: debate.updated_at,
    general: general ? serializeNode(general, { withArguments }) : null,
    subs: subs.map((n) => serializeNode(n, { withArguments })),
  };
};

/** Charge un débat de l'utilisateur avec ses nœuds (et, au besoin, ses arguments). */
const findDebate = async (id, userId, { withArguments = true } = {}) =>
  Debate.findOne({
    where: { id, user_id: userId },
    include: [
      {
        model: DebateNode,
        as: 'nodes',
        required: false,
        ...(withArguments
          ? {
              include: [
                {
                  model: DebateArgument,
                  as: 'arguments',
                  required: false,
                },
              ],
            }
          : {}),
      },
    ],
    order: [
      [{ model: DebateNode, as: 'nodes' }, 'position', 'ASC'],
      [{ model: DebateNode, as: 'nodes' }, 'id', 'ASC'],
      ...(withArguments
        ? [
            [
              { model: DebateNode, as: 'nodes' },
              { model: DebateArgument, as: 'arguments' },
              'position',
              'ASC',
            ],
            [
              { model: DebateNode, as: 'nodes' },
              { model: DebateArgument, as: 'arguments' },
              'id',
              'ASC',
            ],
          ]
        : []),
    ],
  });

/** Le nœud n'est accessible que via son débat : on vérifie le propriétaire au passage. */
const findNode = async (nodeId, userId) =>
  DebateNode.findOne({ where: { id: nodeId, user_id: userId } });

exports.getAll = async (req, res) => {
  try {
    const debates = await Debate.findAll({
      where: { user_id: req.user_id },
      include: [
        {
          model: DebateNode,
          as: 'nodes',
          required: false,
          include: [{ model: DebateArgument, as: 'arguments', required: false, attributes: ['id'] }],
        },
      ],
      order: [
        ['updated_at', 'DESC'],
        [{ model: DebateNode, as: 'nodes' }, 'position', 'ASC'],
        [{ model: DebateNode, as: 'nodes' }, 'id', 'ASC'],
      ],
    });

    res.json({ debates: debates.map((d) => serializeDebate(d, { withArguments: false })) });
  } catch (error) {
    console.error('Erreur lors de la récupération des débats:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const debate = await findDebate(req.params.id, req.user_id);
    if (!debate) return res.status(404).json({ error: 'Débat introuvable' });
    res.json({ debate: serializeDebate(debate) });
  } catch (error) {
    console.error('Erreur lors de la récupération du débat:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

exports.create = async (req, res) => {
  try {
    const title = clean(req.body?.title, 255);
    if (!title) return res.status(400).json({ error: 'Le titre est obligatoire' });

    const debate = await Debate.create({
      user_id: req.user_id,
      title,
      question: clean(req.body?.question, 255) || 'Pour ou contre ?',
      desc_termes: clean(req.body?.desc?.termes) || null,
      desc_limites: clean(req.body?.desc?.limites) || null,
      desc_tensions: clean(req.body?.desc?.tensions) || null,
    });

    // La question centrale existe dès la création : sans elle, un débat neuf
    // n'aurait nulle part où capter le premier argument.
    await DebateNode.create({
      debate_id: debate.id,
      user_id: req.user_id,
      title,
      kind: 'general',
      position: 0,
    });

    const full = await findDebate(debate.id, req.user_id);
    res.status(201).json({ debate: serializeDebate(full) });
  } catch (error) {
    console.error('Erreur lors de la création du débat:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const debate = await Debate.findOne({ where: { id: req.params.id, user_id: req.user_id } });
    if (!debate) return res.status(404).json({ error: 'Débat introuvable' });

    const updates = {};
    if (req.body?.title !== undefined) {
      const title = clean(req.body.title, 255);
      if (!title) return res.status(400).json({ error: 'Le titre est obligatoire' });
      updates.title = title;
    }
    if (req.body?.question !== undefined) {
      updates.question = clean(req.body.question, 255) || 'Pour ou contre ?';
    }
    if (req.body?.desc) {
      if (req.body.desc.termes !== undefined) updates.desc_termes = clean(req.body.desc.termes);
      if (req.body.desc.limites !== undefined) updates.desc_limites = clean(req.body.desc.limites);
      if (req.body.desc.tensions !== undefined) updates.desc_tensions = clean(req.body.desc.tensions);
    }

    await debate.update(updates);

    // Renommer le débat renomme la question centrale : elle n'a jamais de titre propre.
    if (updates.title) {
      await DebateNode.update(
        { title: updates.title },
        { where: { debate_id: debate.id, kind: 'general' } }
      );
    }

    const full = await findDebate(debate.id, req.user_id);
    res.json({ debate: serializeDebate(full) });
  } catch (error) {
    console.error('Erreur lors de la mise à jour du débat:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const debate = await Debate.findOne({ where: { id: req.params.id, user_id: req.user_id } });
    if (!debate) return res.status(404).json({ error: 'Débat introuvable' });

    // Les cascades SQL ne sont pas garanties selon l'ordre de création des tables :
    // on supprime explicitement les arguments, puis les nœuds, puis le débat.
    const nodes = await DebateNode.findAll({ where: { debate_id: debate.id }, attributes: ['id'] });
    const nodeIds = nodes.map((n) => n.id);
    if (nodeIds.length) {
      await DebateArgument.destroy({ where: { node_id: { [Op.in]: nodeIds } } });
      await DebateNode.destroy({ where: { id: { [Op.in]: nodeIds } } });
    }
    await debate.destroy();

    res.json({ success: true });
  } catch (error) {
    console.error('Erreur lors de la suppression du débat:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

exports.createNode = async (req, res) => {
  try {
    const debate = await Debate.findOne({ where: { id: req.params.id, user_id: req.user_id } });
    if (!debate) return res.status(404).json({ error: 'Débat introuvable' });

    const title = clean(req.body?.title, 255);
    if (!title) return res.status(400).json({ error: 'Le titre est obligatoire' });

    const count = await DebateNode.count({ where: { debate_id: debate.id } });
    const node = await DebateNode.create({
      debate_id: debate.id,
      user_id: req.user_id,
      title,
      kind: 'sub',
      position: count,
    });

    await Debate.update({ updated_at: new Date() }, { where: { id: debate.id }, silent: true });

    res.status(201).json({ node: serializeNode(node, { withArguments: false }) });
  } catch (error) {
    console.error('Erreur lors de la création du sous-débat:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

exports.updateNode = async (req, res) => {
  try {
    const node = await findNode(req.params.nodeId, req.user_id);
    if (!node) return res.status(404).json({ error: 'Nœud de débat introuvable' });

    const updates = {};
    if (req.body?.title !== undefined && node.kind !== 'general') {
      const title = clean(req.body.title, 255);
      if (!title) return res.status(400).json({ error: 'Le titre est obligatoire' });
      updates.title = title;
    }
    if (req.body?.step_done !== undefined) {
      const step = Number(req.body.step_done);
      if (!Number.isFinite(step) || step < 0 || step > STEP_COUNT) {
        return res.status(400).json({ error: 'Étape invalide' });
      }
      // La progression ne recule pas : rouvrir une étape passée ne fait pas
      // perdre le travail déjà fait sur les suivantes.
      updates.step_done = Math.max(node.step_done, Math.round(step));
    }
    if (req.body?.opinion !== undefined) {
      updates.opinion = clean(req.body.opinion);
    }
    if (req.body?.side !== undefined) {
      const side = clean(req.body.side, 10);
      if (side && !POSITIONS.includes(side)) {
        return res.status(400).json({ error: 'Position invalide' });
      }
      updates.side = side;
    }

    await node.update(updates);
    await Debate.update({ updated_at: new Date() }, { where: { id: node.debate_id }, silent: true });

    res.json({ node: serializeNode(node, { withArguments: false }) });
  } catch (error) {
    console.error('Erreur lors de la mise à jour du nœud de débat:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

exports.deleteNode = async (req, res) => {
  try {
    const node = await findNode(req.params.nodeId, req.user_id);
    if (!node) return res.status(404).json({ error: 'Nœud de débat introuvable' });
    if (node.kind === 'general') {
      return res.status(400).json({ error: 'La question centrale ne peut pas être supprimée' });
    }

    await DebateArgument.destroy({ where: { node_id: node.id } });
    await node.destroy();

    res.json({ success: true });
  } catch (error) {
    console.error('Erreur lors de la suppression du sous-débat:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

exports.createArgument = async (req, res) => {
  try {
    const node = await findNode(req.params.nodeId, req.user_id);
    if (!node) return res.status(404).json({ error: 'Nœud de débat introuvable' });

    const text = clean(req.body?.text);
    if (!text) return res.status(400).json({ error: "L'argument ne peut pas être vide" });

    const side = clean(req.body?.side, 10) || 'pour';
    if (!SIDES.includes(side)) return res.status(400).json({ error: 'Camp invalide' });

    const verdict = clean(req.body?.verdict, 10);
    if (verdict && !VERDICTS.includes(verdict)) {
      return res.status(400).json({ error: 'Verdict invalide' });
    }

    const count = await DebateArgument.count({ where: { node_id: node.id } });
    const argument = await DebateArgument.create({
      node_id: node.id,
      user_id: req.user_id,
      side,
      text,
      tags: cleanTags(req.body?.tags),
      source: clean(req.body?.source, 255),
      support: clean(req.body?.support, 100),
      date_label: clean(req.body?.date, 40),
      verdict: verdict || null,
      note: clean(req.body?.note),
      position: count,
    });

    // Capter un argument, c'est avoir franchi la première étape.
    if (node.step_done < 1) await node.update({ step_done: 1 });
    await Debate.update({ updated_at: new Date() }, { where: { id: node.debate_id }, silent: true });

    res.status(201).json({ argument: serializeArgument(argument) });
  } catch (error) {
    console.error("Erreur lors de la création de l'argument:", error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

exports.updateArgument = async (req, res) => {
  try {
    const argument = await DebateArgument.findOne({
      where: { id: req.params.argumentId, user_id: req.user_id },
    });
    if (!argument) return res.status(404).json({ error: 'Argument introuvable' });

    const updates = {};
    if (req.body?.text !== undefined) {
      const text = clean(req.body.text);
      if (!text) return res.status(400).json({ error: "L'argument ne peut pas être vide" });
      updates.text = text;
    }
    if (req.body?.side !== undefined) {
      const side = clean(req.body.side, 10);
      if (!SIDES.includes(side)) return res.status(400).json({ error: 'Camp invalide' });
      updates.side = side;
    }
    if (req.body?.tags !== undefined) updates.tags = cleanTags(req.body.tags);
    if (req.body?.source !== undefined) updates.source = clean(req.body.source, 255);
    if (req.body?.support !== undefined) updates.support = clean(req.body.support, 100);
    if (req.body?.date !== undefined) updates.date_label = clean(req.body.date, 40);
    if (req.body?.verdict !== undefined) {
      const verdict = clean(req.body.verdict, 10);
      if (verdict && !VERDICTS.includes(verdict)) {
        return res.status(400).json({ error: 'Verdict invalide' });
      }
      updates.verdict = verdict;
    }
    if (req.body?.note !== undefined) updates.note = clean(req.body.note);

    await argument.update(updates);

    const node = await DebateNode.findOne({ where: { id: argument.node_id } });
    if (node) {
      await Debate.update({ updated_at: new Date() }, { where: { id: node.debate_id }, silent: true });
    }

    res.json({ argument: serializeArgument(argument) });
  } catch (error) {
    console.error("Erreur lors de la mise à jour de l'argument:", error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

exports.deleteArgument = async (req, res) => {
  try {
    const argument = await DebateArgument.findOne({
      where: { id: req.params.argumentId, user_id: req.user_id },
    });
    if (!argument) return res.status(404).json({ error: 'Argument introuvable' });

    await argument.destroy();
    res.json({ success: true });
  } catch (error) {
    console.error("Erreur lors de la suppression de l'argument:", error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

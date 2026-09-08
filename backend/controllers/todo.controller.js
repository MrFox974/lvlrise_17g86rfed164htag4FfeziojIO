const TodoItem = require('../models/TodoItem');
const TodoGroup = require('../models/TodoGroup');
const { Op } = require('sequelize');
const planRestrictionsService = require('../services/planRestrictionsService');

const TAGS = ['absolue', 'important', 'à faire', 'idée', 'projet'];
const VALID_PROGRESS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
const DEFAULT_GROUP = 'Main';
const MAX_GROUP_NAME = 100;

/** Nom de groupe utilisable, ou chaîne vide si l'entrée n'en contient pas. */
function normalizeGroupName(value) {
  return typeof value === 'string' ? value.trim().slice(0, MAX_GROUP_NAME) : '';
}

/**
 * Enregistre un groupe s'il n'existe pas encore, et renvoie la ligne.
 * « Main » n'est jamais stocké : il existe toujours.
 */
async function ensureGroup(userId, name) {
  const clean = normalizeGroupName(name);
  if (!clean || clean === DEFAULT_GROUP) return null;
  const existing = await TodoGroup.findOne({ where: { user_id: userId, name: clean } });
  if (existing) return existing;
  const maxPos = await TodoGroup.max('position', { where: { user_id: userId } });
  try {
    return await TodoGroup.create({
      user_id: userId,
      name: clean,
      position: (maxPos ?? -1) + 1,
    });
  } catch {
    // Course entre deux onglets sur la contrainte d'unicité : le groupe existe,
    // c'est tout ce qui compte.
    return TodoGroup.findOne({ where: { user_id: userId, name: clean } });
  }
}

/**
 * Liste ordonnée des groupes : « Main » d'abord, puis les groupes enregistrés.
 * Les groupes hérités, déduits des tâches d'avant la table `todo_group`, sont
 * enregistrés au passage pour ne plus dépendre de l'existence d'une tâche.
 */
async function listGroupNames(userId, derivedNames = []) {
  const rows = await TodoGroup.findAll({
    where: { user_id: userId },
    order: [['position', 'ASC'], ['id', 'ASC']],
  });
  const known = new Set(rows.map((r) => r.name));
  const missing = derivedNames
    .map(normalizeGroupName)
    .filter((n) => n && n !== DEFAULT_GROUP && !known.has(n));

  const added = [];
  for (const name of [...new Set(missing)]) {
    const created = await ensureGroup(userId, name);
    if (created) added.push(created.name);
  }

  return [DEFAULT_GROUP, ...rows.map((r) => r.name), ...added];
}

exports.getGroups = async (req, res) => {
  try {
    const userId = req.user_id;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });
    res.json({ groups: await listGroupNames(userId) });
  } catch (error) {
    console.error('Erreur getGroups todos:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

/**
 * Crée un groupe vide. Il reste visible tant qu'il n'est pas supprimé, même
 * sans aucune tâche, et sur tous les appareils.
 */
exports.createGroup = async (req, res) => {
  try {
    const userId = req.user_id;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });

    const name = normalizeGroupName(req.body?.name);
    if (!name) return res.status(400).json({ error: 'Le nom du groupe est requis' });
    if (name === DEFAULT_GROUP) {
      return res.status(400).json({ error: 'Le groupe Main existe déjà' });
    }

    await ensureGroup(userId, name);
    res.status(201).json({ group: name, groups: await listGroupNames(userId) });
  } catch (error) {
    console.error('Erreur createGroup todos:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

exports.getAll = async (req, res) => {
  try {
    const userId = req.user_id;
    if (!userId) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const active = await TodoItem.findAll({
      where: { user_id: userId, completed_at: null },
      order: [['position', 'ASC']],
    });
    const historique = await TodoItem.findAll({
      where: { user_id: userId, completed_at: { [Op.ne]: null } },
      order: [['completed_at', 'DESC']],
    });

    const derived = [...active, ...historique].map((t) => t.group_name).filter(Boolean);

    res.json({
      active: active.map((t) => ({
        id: t.id,
        name: t.name,
        tag: t.tag,
        progress: t.progress,
        position: t.position,
        group_name: t.group_name || DEFAULT_GROUP,
      })),
      historique: historique.map((t) => ({
        id: t.id,
        name: t.name,
        tag: t.tag,
        progress: t.progress,
        completed_at: t.completed_at,
        group_name: t.group_name || DEFAULT_GROUP,
      })),
      groups: await listGroupNames(userId, derived),
    });
  } catch (error) {
    console.error('Erreur getAll todos:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

exports.create = async (req, res) => {
  try {
    const userId = req.user_id;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });

    const { name, tag, groupName } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Le nom est requis' });
    }

    // Vérification des restrictions du plan
    const restriction = await planRestrictionsService.canCreateTodo(userId);
    if (!restriction.allowed) {
      return res.status(403).json({
        error: `Limite de tâches atteinte pour votre plan ${restriction.plan}. Vous avez ${restriction.current}/${restriction.limit} tâches. Passez à un plan supérieur pour créer plus de tâches.`,
        restriction: {
          current: restriction.current,
          limit: restriction.limit,
          plan: restriction.plan,
        },
      });
    }

    const tagVal = TAGS.includes(tag) ? tag : 'à faire';
    const safeGroupName = normalizeGroupName(groupName) || DEFAULT_GROUP;
    // Une tâche créée dans un groupe encore inconnu (import, ancien appareil)
    // fait exister ce groupe pour de bon.
    await ensureGroup(userId, safeGroupName);

    const maxPos = await TodoItem.max('position', {
      where: { user_id: userId, completed_at: null },
    });
    const position = (maxPos ?? -1) + 1;

    const todo = await TodoItem.create({
      user_id: userId,
      name: name.trim(),
      tag: tagVal,
      progress: 0,
      position,
      group_name: safeGroupName,
    });

    res.status(201).json({
      todo: {
        id: todo.id,
        name: todo.name,
        tag: todo.tag,
        progress: todo.progress,
        position: todo.position,
        group_name: todo.group_name || DEFAULT_GROUP,
      },
    });
  } catch (error) {
    console.error('Erreur create todo:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

exports.updateProgress = async (req, res) => {
  try {
    const userId = req.user_id;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });

    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'ID invalide' });

    let progress = parseInt(req.body.progress, 10);
    if (Number.isNaN(progress) || !VALID_PROGRESS.includes(progress)) {
      progress = Math.min(100, Math.max(0, Math.round(progress / 10) * 10));
    }

    const todo = await TodoItem.findOne({ where: { id, user_id: userId } });
    if (!todo) return res.status(404).json({ error: 'Tâche non trouvée' });

    const completedAt = progress >= 100 ? new Date() : null;
    await todo.update({ progress, completed_at: completedAt });

    res.json({
      todo: {
        id: todo.id,
        name: todo.name,
        tag: todo.tag,
        progress: todo.progress,
        completed_at: todo.completed_at,
        // Renvoyé pour que le client range la tâche terminée dans l'historique
        // de son propre groupe, et non dans celui par défaut.
        group_name: todo.group_name || DEFAULT_GROUP,
      },
    });
  } catch (error) {
    console.error('Erreur updateProgress todo:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const userId = req.user_id;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });

    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'ID invalide' });

    const todo = await TodoItem.findOne({ where: { id, user_id: userId } });
    if (!todo) return res.status(404).json({ error: 'Tâche non trouvée' });

    await todo.destroy();
    res.json({ success: true });
  } catch (error) {
    console.error('Erreur delete todo:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

exports.renameGroup = async (req, res) => {
  try {
    const userId = req.user_id;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });

    const { fromName, toName } = req.body || {};
    const source = normalizeGroupName(fromName);
    const safeTarget = normalizeGroupName(toName);

    if (!source || !safeTarget) {
      return res.status(400).json({ error: 'Les noms de groupe sont requis' });
    }

    if (source === DEFAULT_GROUP) {
      return res.status(400).json({ error: 'Le groupe Main ne peut pas être renommé' });
    }

    await TodoItem.update(
      { group_name: safeTarget },
      { where: { user_id: userId, group_name: source } }
    );

    // Le groupe suit ses tâches : il garde sa place dans la liste, sauf si le
    // nouveau nom est déjà pris — auquel cas les deux groupes fusionnent.
    const existingTarget =
      safeTarget === DEFAULT_GROUP
        ? null
        : await TodoGroup.findOne({ where: { user_id: userId, name: safeTarget } });
    const sourceRow = await TodoGroup.findOne({ where: { user_id: userId, name: source } });

    if (sourceRow && (existingTarget || safeTarget === DEFAULT_GROUP)) {
      await sourceRow.destroy();
    } else if (sourceRow) {
      await sourceRow.update({ name: safeTarget });
    } else {
      await ensureGroup(userId, safeTarget);
    }

    res.json({
      success: true,
      fromName: source,
      toName: safeTarget,
      groups: await listGroupNames(userId),
    });
  } catch (error) {
    console.error('Erreur renameGroup todo:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

exports.clearGroup = async (req, res) => {
  try {
    const userId = req.user_id;
    if (!userId) return res.status(401).json({ error: 'Non authentifié' });

    const source = normalizeGroupName(req.body?.groupName);

    if (!source) {
      return res.status(400).json({ error: 'Le nom du groupe est requis' });
    }

    if (source === DEFAULT_GROUP) {
      return res.status(400).json({ error: 'Le groupe Main ne peut pas être supprimé' });
    }

    await TodoItem.update(
      { group_name: DEFAULT_GROUP },
      { where: { user_id: userId, group_name: source } }
    );
    await TodoGroup.destroy({ where: { user_id: userId, name: source } });

    res.json({
      success: true,
      groupName: source,
      reassignedTo: DEFAULT_GROUP,
      groups: await listGroupNames(userId),
    });
  } catch (error) {
    console.error('Erreur clearGroup todo:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

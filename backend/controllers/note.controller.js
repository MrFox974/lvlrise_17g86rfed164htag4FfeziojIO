const Note = require('../models/Note');
const TodoItem = require('../models/TodoItem');
const { Op } = require('sequelize');
const planRestrictionsService = require('../services/planRestrictionsService');

exports.getAll = async (req, res) => {
  try {
    const { sort = 'updated_at', order = 'desc' } = req.query;
    const validSort = ['created_at', 'updated_at', 'title'].includes(sort)
      ? sort
      : 'updated_at';
    const validOrder = order === 'asc' ? 'ASC' : 'DESC';

    const notes = await Note.findAll({
      where: { user_id: req.user_id },
      order: [[validSort, validOrder]],
      include: [
        {
          model: TodoItem,
          as: 'todoItem',
          attributes: ['id', 'name', 'tag'],
        },
      ],
    });

    const payload = notes.map((note) => ({
      id: note.id,
      title: note.title,
      content: note.content,
      created_at: note.created_at,
      updated_at: note.updated_at,
      todo_item_id: note.todo_item_id,
      todo: note.todoItem
        ? {
            id: note.todoItem.id,
            name: note.todoItem.name,
            tag: note.todoItem.tag,
          }
        : null,
    }));

    res.json({ notes: payload });
  } catch (error) {
    console.error('Erreur lors de la récupération des notes:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    const note = await Note.findOne({
      where: { id, user_id: req.user_id },
      include: [
        {
          model: TodoItem,
          as: 'todoItem',
          attributes: ['id', 'name', 'tag'],
        },
      ],
    });
    if (!note) {
      return res.status(404).json({ error: 'Note introuvable' });
    }
    res.json({
      note: {
        id: note.id,
        title: note.title,
        content: note.content,
        created_at: note.created_at,
        updated_at: note.updated_at,
        todo_item_id: note.todo_item_id,
        todo: note.todoItem
          ? {
              id: note.todoItem.id,
              name: note.todoItem.name,
              tag: note.todoItem.tag,
            }
          : null,
      },
    });
  } catch (error) {
    console.error('Erreur lors de la récupération de la note:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

exports.getByTodo = async (req, res) => {
  try {
    const { todoId } = req.params;
    const id = parseInt(todoId, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'ID de tâche invalide' });
    }

    const note = await Note.findOne({
      where: { user_id: req.user_id, todo_item_id: id },
      include: [
        {
          model: TodoItem,
          as: 'todoItem',
          attributes: ['id', 'name', 'tag'],
        },
      ],
    });

    if (!note) {
      return res.status(404).json({ error: 'Aucune note liée à cette tâche' });
    }

    res.json({
      note: {
        id: note.id,
        title: note.title,
        content: note.content,
        created_at: note.created_at,
        updated_at: note.updated_at,
        todo_item_id: note.todo_item_id,
        todo: note.todoItem
          ? {
              id: note.todoItem.id,
              name: note.todoItem.name,
              tag: note.todoItem.tag,
            }
          : null,
      },
    });
  } catch (error) {
    console.error('Erreur lors de la récupération de la note liée à la tâche:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { title, content, todoItemId } = req.body;
    if (!title || !String(title).trim()) {
      return res.status(400).json({ error: 'Le titre est requis' });
    }

    let todoItem = null;
    if (todoItemId !== undefined && todoItemId !== null) {
      const parsedTodoId = parseInt(todoItemId, 10);
      if (Number.isNaN(parsedTodoId)) {
        return res.status(400).json({ error: 'ID de tâche lié invalide' });
      }
      todoItem = await TodoItem.findOne({
        where: { id: parsedTodoId, user_id: req.user_id },
      });
      if (!todoItem) {
        return res
          .status(404)
          .json({ error: 'Tâche liée introuvable pour cette note' });
      }
    }

    const restriction = await planRestrictionsService.canCreateNote(req.user_id);
    if (!restriction.allowed) {
      return res.status(403).json({
        error: `Limite de notes atteinte pour votre plan ${restriction.plan}. Vous avez ${restriction.current}/${restriction.limit} notes. Passez à un plan supérieur pour créer plus de notes.`,
        restriction: {
          current: restriction.current,
          limit: restriction.limit,
          plan: restriction.plan,
        },
      });
    }

    const note = await Note.create({
      user_id: req.user_id,
      title: String(title).trim(),
      content: content ? String(content).trim() : '',
      todo_item_id: todoItem ? todoItem.id : null,
    });

    res.status(201).json({
      note: {
        id: note.id,
        title: note.title,
        content: note.content,
        created_at: note.created_at,
        updated_at: note.updated_at,
        todo_item_id: note.todo_item_id,
        todo: todoItem
          ? {
              id: todoItem.id,
              name: todoItem.name,
              tag: todoItem.tag,
            }
          : null,
      },
    });
  } catch (error) {
    console.error('Erreur lors de la création de la note:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const note = await Note.findOne({
      where: { id, user_id: req.user_id },
      include: [
        {
          model: TodoItem,
          as: 'todoItem',
          attributes: ['id', 'name', 'tag'],
        },
      ],
    });
    if (!note) {
      return res.status(404).json({ error: 'Note introuvable' });
    }

    const { title, content } = req.body;
    if (title !== undefined) note.title = String(title).trim();
    if (content !== undefined) note.content = String(content).trim();
    await note.save();

    res.json({
      note: {
        id: note.id,
        title: note.title,
        content: note.content,
        created_at: note.created_at,
        updated_at: note.updated_at,
        todo_item_id: note.todo_item_id,
        todo: note.todoItem
          ? {
              id: note.todoItem.id,
              name: note.todoItem.name,
              tag: note.todoItem.tag,
            }
          : null,
      },
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la note:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    const note = await Note.findOne({
      where: { id, user_id: req.user_id },
    });
    if (!note) {
      return res.status(404).json({ error: 'Note introuvable' });
    }
    await note.destroy();
    res.status(204).send();
  } catch (error) {
    console.error('Erreur lors de la suppression de la note:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

exports.unlinkFromTodo = async (req, res) => {
  try {
    const { id } = req.params;
    const note = await Note.findOne({
      where: { id, user_id: req.user_id },
    });
    if (!note) {
      return res.status(404).json({ error: 'Note introuvable' });
    }

    note.todo_item_id = null;
    await note.save();

    res.json({
      note: {
        id: note.id,
        title: note.title,
        content: note.content,
        created_at: note.created_at,
        updated_at: note.updated_at,
        todo_item_id: note.todo_item_id,
        todo: null,
      },
    });
  } catch (error) {
    console.error('Erreur lors du délien de la note de la tâche:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

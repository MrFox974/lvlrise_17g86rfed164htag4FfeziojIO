import api from '../../utils/api';

export const fetchTodos = async (options = {}) => {
  try {
    const { data } = await api.get('/api/todos', { signal: options.signal });
    return data;
  } catch (error) {
    if (error?.name === 'AbortError' || error?.code === 'ERR_CANCELED') {
      throw error;
    }
    console.error('Erreur fetchTodos:', error);
    throw error;
  }
};

export const createTodo = async (name, tag, groupName) => {
  try {
    const { data } = await api.post('/api/todos', { name, tag, groupName });
    return data.todo;
  } catch (error) {
    console.error('Erreur createTodo:', error);
    throw error;
  }
};

export const updateTodoProgress = async (id, progress) => {
  try {
    const { data } = await api.patch(`/api/todos/${id}/progress`, { progress });
    return data.todo;
  } catch (error) {
    console.error('Erreur updateTodoProgress:', error);
    throw error;
  }
};

export const deleteTodo = async (id) => {
  try {
    await api.delete(`/api/todos/${id}`);
  } catch (error) {
    console.error('Erreur deleteTodo:', error);
    throw error;
  }
};

/**
 * Crée un groupe vide. Il reste visible tant qu'il n'est pas supprimé, même
 * sans tâche — c'est ce qui le distingue d'un simple libellé porté par une tâche.
 */
export const createTodoGroup = async (name) => {
  try {
    const { data } = await api.post('/api/todos/groups', { name });
    return data.groups || [];
  } catch (error) {
    console.error('Erreur createTodoGroup:', error);
    throw error;
  }
};

export const fetchTodoGroups = async () => {
  try {
    const { data } = await api.get('/api/todos/groups');
    return data.groups || [];
  } catch (error) {
    console.error('Erreur fetchTodoGroups:', error);
    throw error;
  }
};

export const renameTodoGroup = async (fromName, toName) => {
  try {
    const { data } = await api.patch('/api/todos/group/rename', { fromName, toName });
    return data;
  } catch (error) {
    console.error('Erreur renameTodoGroup:', error);
    throw error;
  }
};

export const clearTodoGroup = async (groupName) => {
  try {
    const { data } = await api.patch('/api/todos/group/clear', { groupName });
    return data;
  } catch (error) {
    console.error('Erreur clearTodoGroup:', error);
    throw error;
  }
};

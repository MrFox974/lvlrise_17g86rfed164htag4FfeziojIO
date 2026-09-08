import api from '../../utils/api';

export const fetchNotes = async (params = {}) => {
  try {
    const { data } = await api.get('/api/notes', { params });
    return data.notes || [];
  } catch (error) {
    console.error('Erreur lors de fetchNotes:', error);
    throw error;
  }
};

export const fetchNote = async (id) => {
  try {
    const { data } = await api.get(`/api/notes/${id}`);
    return data.note;
  } catch (error) {
    console.error('Erreur lors de fetchNote:', error);
    throw error;
  }
};

export const fetchNoteByTodo = async (todoId) => {
  try {
    const { data } = await api.get(`/api/notes/by-todo/${todoId}`);
    return data.note;
  } catch (error) {
    if (error?.response?.status === 404) {
      return null;
    }
    console.error('Erreur lors de fetchNoteByTodo:', error);
    throw error;
  }
};

export const createNote = async (title, content = '', todoItemId) => {
  try {
    const payload = {
      title: title.trim(),
      content: content.trim() || '',
    };
    if (todoItemId !== undefined && todoItemId !== null) {
      payload.todoItemId = todoItemId;
    }
    const { data } = await api.post('/api/notes', payload);
    return data.note;
  } catch (error) {
    console.error('Erreur lors de createNote:', error);
    throw error;
  }
};

export const updateNote = async (id, { title, content }) => {
  try {
    const { data } = await api.put(`/api/notes/${id}`, {
      ...(title !== undefined && { title: title.trim() }),
      ...(content !== undefined && { content: content.trim() }),
    });
    return data.note;
  } catch (error) {
    console.error('Erreur lors de updateNote:', error);
    throw error;
  }
};

export const deleteNote = async (id) => {
  try {
    await api.delete(`/api/notes/${id}`);
  } catch (error) {
    console.error('Erreur lors de deleteNote:', error);
    throw error;
  }
};

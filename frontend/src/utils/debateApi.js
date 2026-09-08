import api from '../../utils/api';

export const fetchDebates = async () => {
  try {
    const { data } = await api.get('/api/debates');
    return data.debates || [];
  } catch (error) {
    console.error('Erreur lors de fetchDebates:', error);
    throw error;
  }
};

export const fetchDebate = async (id) => {
  try {
    const { data } = await api.get(`/api/debates/${id}`);
    return data.debate;
  } catch (error) {
    console.error('Erreur lors de fetchDebate:', error);
    throw error;
  }
};

export const createDebate = async ({ title, question, desc }) => {
  try {
    const { data } = await api.post('/api/debates', { title, question, desc });
    return data.debate;
  } catch (error) {
    console.error('Erreur lors de createDebate:', error);
    throw error;
  }
};

export const updateDebate = async (id, { title, question, desc }) => {
  try {
    const { data } = await api.put(`/api/debates/${id}`, {
      ...(title !== undefined && { title }),
      ...(question !== undefined && { question }),
      ...(desc !== undefined && { desc }),
    });
    return data.debate;
  } catch (error) {
    console.error('Erreur lors de updateDebate:', error);
    throw error;
  }
};

export const deleteDebate = async (id) => {
  try {
    await api.delete(`/api/debates/${id}`);
  } catch (error) {
    console.error('Erreur lors de deleteDebate:', error);
    throw error;
  }
};

export const createDebateNode = async (debateId, title) => {
  try {
    const { data } = await api.post(`/api/debates/${debateId}/nodes`, { title });
    return data.node;
  } catch (error) {
    console.error('Erreur lors de createDebateNode:', error);
    throw error;
  }
};

export const updateDebateNode = async (nodeId, { title, step_done, opinion, side }) => {
  try {
    const { data } = await api.put(`/api/debate-nodes/${nodeId}`, {
      ...(title !== undefined && { title }),
      ...(step_done !== undefined && { step_done }),
      ...(opinion !== undefined && { opinion }),
      ...(side !== undefined && { side }),
    });
    return data.node;
  } catch (error) {
    console.error('Erreur lors de updateDebateNode:', error);
    throw error;
  }
};

export const deleteDebateNode = async (nodeId) => {
  try {
    await api.delete(`/api/debate-nodes/${nodeId}`);
  } catch (error) {
    console.error('Erreur lors de deleteDebateNode:', error);
    throw error;
  }
};

export const createDebateArgument = async (nodeId, payload) => {
  try {
    const { data } = await api.post(`/api/debate-nodes/${nodeId}/arguments`, payload);
    return data.argument;
  } catch (error) {
    console.error('Erreur lors de createDebateArgument:', error);
    throw error;
  }
};

export const updateDebateArgument = async (argumentId, payload) => {
  try {
    const { data } = await api.put(`/api/debate-arguments/${argumentId}`, payload);
    return data.argument;
  } catch (error) {
    console.error('Erreur lors de updateDebateArgument:', error);
    throw error;
  }
};

export const deleteDebateArgument = async (argumentId) => {
  try {
    await api.delete(`/api/debate-arguments/${argumentId}`);
  } catch (error) {
    console.error('Erreur lors de deleteDebateArgument:', error);
    throw error;
  }
};

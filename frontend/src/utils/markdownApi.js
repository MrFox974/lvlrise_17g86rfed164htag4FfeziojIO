import api from '../../utils/api';

export const fetchDomains = async () => {
  try {
    const { data } = await api.get('/api/markdown/domains');
    return data.domains || [];
  } catch (error) {
    console.error('Erreur lors de fetchMarkdownDomains:', error);
    throw error;
  }
};

export const createDomain = async (name, description = '') => {
  try {
    const { data } = await api.post('/api/markdown/domains', {
      name: name.trim(),
      description: description.trim() || undefined,
    });
    return data.domain;
  } catch (error) {
    console.error('Erreur lors de createMarkdownDomain:', error);
    throw error;
  }
};

/**
 * Lance la génération d'un parcours.
 * @param {string} description
 * @param {number[]} [uploadIds] fichiers joints servant de source de référence
 */
export const generateDomainWithAI = async (description, uploadIds = []) => {
  try {
    const { data } = await api.post('/api/markdown/domains/generate', {
      description: description.trim(),
      uploadIds,
    });
    return data.domain;
  } catch (error) {
    console.error('Erreur lors de generateDomainWithAI:', error);
    throw error;
  }
};

export const getDomainGenerationStatus = async (domainId) => {
  try {
    const { data } = await api.get(`/api/markdown/domains/${domainId}/generation-status`);
    return data;
  } catch (error) {
    console.error('Erreur lors de getDomainGenerationStatus:', error);
    throw error;
  }
};

/**
 * Annule la génération en cours d'un domaine. Si < 1 minute, ne compte pas dans le quota.
 * @param {number} domainId - ID du domaine
 * @returns {Promise<{ success: boolean, message: string, countsAsGeneration: boolean, durationMinutes: number }>}
 */
export const cancelDomainGeneration = async (domainId) => {
  try {
    const { data } = await api.post(`/api/markdown/domains/${domainId}/cancel-generation`);
    return data;
  } catch (error) {
    console.error('Erreur lors de l\'annulation de la génération du domaine:', error);
    throw error;
  }
};

/**
 * Reprend la génération d'un domaine depuis le point d'arrêt.
 * @param {number} domainId - ID du domaine
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export const resumeDomainGeneration = async (domainId) => {
  try {
    const { data } = await api.post(`/api/markdown/domains/${domainId}/resume-generation`);
    return data;
  } catch (error) {
    console.error('Erreur lors de la reprise de la génération du domaine:', error);
    throw error;
  }
};

export const fetchPublicDomains = async (search = '') => {
  try {
    const params = search.trim() ? { search: search.trim() } : {};
    const { data } = await api.get('/api/markdown/domains/public', { params });
    return data.domains || [];
  } catch (error) {
    console.error('Erreur lors de fetchPublicDomains:', error);
    throw error;
  }
};

export const importDomain = async (domainId) => {
  try {
    const { data } = await api.post(`/api/markdown/domains/${domainId}/import`);
    return data.domain;
  } catch (error) {
    console.error('Erreur lors de importDomain:', error);
    throw error;
  }
};

export const setDomainVisibility = async (domainId, isPublic) => {
  try {
    const { data } = await api.put(`/api/markdown/domains/${domainId}/visibility`, {
      is_public: isPublic,
    });
    return data.domain;
  } catch (error) {
    console.error('Erreur lors de setDomainVisibility:', error);
    throw error;
  }
};

export const updateDomain = async (id, { name, description, position }) => {
  try {
    const { data } = await api.put(`/api/markdown/domains/${id}`, {
      ...(name !== undefined && { name: name.trim() }),
      ...(description !== undefined && { description }),
      ...(position !== undefined && { position }),
    });
    return data.domain;
  } catch (error) {
    console.error('Erreur lors de updateMarkdownDomain:', error);
    throw error;
  }
};

export const deleteDomain = async (id) => {
  try {
    await api.delete(`/api/markdown/domains/${id}`);
  } catch (error) {
    console.error('Erreur lors de deleteMarkdownDomain:', error);
    throw error;
  }
};

export const createChapter = async (domainId, title, content = '') => {
  try {
    const { data } = await api.post(`/api/markdown/domains/${domainId}/chapters`, {
      title: title.trim(),
      content: content.trim() || undefined,
    });
    return data.chapter;
  } catch (error) {
    console.error('Erreur lors de createMarkdownChapter:', error);
    throw error;
  }
};

export const updateChapter = async (domainId, chapterId, { title, content }) => {
  try {
    const { data } = await api.put(
      `/api/markdown/domains/${domainId}/chapters/${chapterId}`,
      {
        ...(title !== undefined && { title: title.trim() }),
        ...(content !== undefined && { content: content.trim() || null }),
      }
    );
    return data.chapter;
  } catch (error) {
    console.error('Erreur lors de updateMarkdownChapter:', error);
    throw error;
  }
};

export const deleteChapter = async (domainId, chapterId) => {
  try {
    await api.delete(`/api/markdown/domains/${domainId}/chapters/${chapterId}`);
  } catch (error) {
    console.error('Erreur lors de deleteMarkdownChapter:', error);
    throw error;
  }
};

export const reorderChapters = async (domainId, chapterIds) => {
  try {
    const { data } = await api.put(`/api/markdown/domains/${domainId}/chapters/reorder`, {
      chapter_ids: chapterIds,
    });
    return data.chapters || [];
  } catch (error) {
    console.error('Erreur lors de reorderChapters:', error);
    throw error;
  }
};

export const reorderDomains = async (domainIds) => {
  try {
    // Note: Cette API n'existe pas encore côté backend, mais on peut l'ajouter si nécessaire
    // Pour l'instant, on utilise updateDomain pour chaque domaine avec sa nouvelle position
    const updates = domainIds.map((domainId, index) =>
      api.put(`/api/markdown/domains/${domainId}`, { position: index })
    );
    await Promise.all(updates);
    return await fetchDomains();
  } catch (error) {
    console.error('Erreur lors de reorderDomains:', error);
    throw error;
  }
};

export const createSection = async (domainId, chapterId, title, content = '') => {
  try {
    const { data } = await api.post(
      `/api/markdown/domains/${domainId}/chapters/${chapterId}/sections`,
      { title: title.trim(), content: content.trim() || '' }
    );
    return data.section;
  } catch (error) {
    console.error('Erreur lors de createMarkdownSection:', error);
    throw error;
  }
};

export const updateSection = async (domainId, chapterId, sectionId, { title, content, new_chapter_id }) => {
  try {
    const { data } = await api.put(
      `/api/markdown/domains/${domainId}/chapters/${chapterId}/sections/${sectionId}`,
      {
        ...(title !== undefined && { title: title.trim() }),
        ...(content !== undefined && { content: content.trim() }),
        ...(new_chapter_id !== undefined && { new_chapter_id }),
      }
    );
    return data.section;
  } catch (error) {
    console.error('Erreur lors de updateMarkdownSection:', error);
    throw error;
  }
};

export const deleteSection = async (domainId, chapterId, sectionId) => {
  try {
    await api.delete(
      `/api/markdown/domains/${domainId}/chapters/${chapterId}/sections/${sectionId}`
    );
  } catch (error) {
    console.error('Erreur lors de deleteMarkdownSection:', error);
    throw error;
  }
};

export const fetchSections = async (params = {}) => {
  try {
    const { data } = await api.get('/api/markdown/sections', { params });
    return data.sections || [];
  } catch (error) {
    console.error('Erreur lors de fetchMarkdownSections:', error);
    throw error;
  }
};

export const reorderSections = async (domainId, chapterId, sectionIds) => {
  try {
    const { data } = await api.put(
      `/api/markdown/domains/${domainId}/chapters/${chapterId}/sections/reorder`,
      {
        section_ids: sectionIds,
      }
    );
    return data.sections || [];
  } catch (error) {
    console.error('Erreur lors de reorderSections:', error);
    throw error;
  }
};

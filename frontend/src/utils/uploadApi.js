import axios from 'axios';
import api from '../../utils/api';

/** Formats acceptés et limites, tels que définis par le serveur. */
export const fetchUploadConfig = async () => {
  try {
    const { data } = await api.get('/api/uploads/config');
    return data;
  } catch (error) {
    console.error('Erreur lors de fetchUploadConfig:', error);
    return { enabled: false, accepted_mime: [], max_file_bytes: 0, retention_days: 7 };
  }
};

/**
 * Envoie un fichier en trois temps : demande d'URL signée, dépôt direct sur le
 * stockage, puis confirmation qui déclenche l'extraction du texte.
 *
 * Le dépôt ne passe pas par l'API : c'est ce qui permet d'envoyer une photo de
 * téléphone sans buter sur la limite de charge utile du serveur.
 *
 * @param {File} file
 * @param {(percent: number) => void} [onProgress]
 * @returns {Promise<object>} le fichier, avec son texte extrait
 */
export const uploadFile = async (file, onProgress) => {
  const { data } = await api.post('/api/uploads/presign', {
    filename: file.name,
    mimeType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
  });

  // axios direct (et non l'instance `api`) : l'URL signée n'accepte aucun
  // en-tête d'authentification supplémentaire, la signature serait invalidée.
  await axios.put(data.upload_url, file, {
    headers: { 'Content-Type': data.content_type },
    onUploadProgress: (event) => {
      if (onProgress && event.total) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    },
  });

  const { data: completed } = await api.post(`/api/uploads/${data.upload.id}/complete`);
  return completed.upload;
};

export const listUploads = async () => {
  const { data } = await api.get('/api/uploads');
  return data.uploads || [];
};

export const deleteUpload = async (id) => {
  await api.delete(`/api/uploads/${id}`);
};

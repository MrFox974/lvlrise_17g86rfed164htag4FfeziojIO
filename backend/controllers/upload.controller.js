const uploadService = require('../services/upload.service');
const storage = require('../services/storage.service');

/**
 * POST /api/uploads/presign
 * Body: { filename, mimeType, sizeBytes }
 *
 * Retourne une URL signée : le navigateur dépose ensuite le fichier
 * directement sur le stockage, sans passer par la Lambda (limite de 6 Mo).
 */
exports.presign = async (req, res) => {
  try {
    if (!storage.isConfigured()) {
      return res.status(503).json({
        error: 'L\'envoi de fichiers n\'est pas encore activé sur le serveur.',
      });
    }

    const { filename, mimeType, sizeBytes } = req.body || {};
    if (!filename || !mimeType) {
      return res.status(400).json({ error: 'filename et mimeType sont requis' });
    }

    const { upload, uploadUrl } = await uploadService.createPendingUpload(req.user_id, {
      filename,
      mimeType,
      sizeBytes,
    });

    res.status(201).json({
      upload: uploadService.summarize(upload),
      upload_url: uploadUrl,
      // Le navigateur doit renvoyer exactement ce type, sinon la signature est refusée.
      content_type: upload.mime_type,
    });
  } catch (error) {
    if (error.status === 400) return res.status(400).json({ error: error.message });
    console.error('Erreur presign upload:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

/**
 * POST /api/uploads/:id/complete
 * Confirme le dépôt et déclenche l'extraction du texte.
 */
exports.complete = async (req, res) => {
  try {
    const upload = await uploadService.completeUpload(req.user_id, parseInt(req.params.id, 10));
    res.json({ upload: uploadService.summarize(upload) });
  } catch (error) {
    if (error.status === 404) return res.status(404).json({ error: error.message });
    // L'extraction a échoué : le message explique quoi faire (PDF scanné, image
    // illisible…), il est destiné à être affiché tel quel.
    res.status(422).json({ error: error.message });
  }
};

/** GET /api/uploads — fichiers encore disponibles pour cet utilisateur. */
exports.list = async (req, res) => {
  try {
    const uploads = await uploadService.listUploads(req.user_id);
    res.json({
      uploads: uploads.map(uploadService.summarize),
      retention_days: uploadService.RETENTION_DAYS,
    });
  } catch (error) {
    console.error('Erreur liste uploads:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

/** DELETE /api/uploads/:id */
exports.remove = async (req, res) => {
  try {
    const deleted = await uploadService.deleteUpload(req.user_id, parseInt(req.params.id, 10));
    if (!deleted) return res.status(404).json({ error: 'Fichier introuvable' });
    res.status(204).send();
  } catch (error) {
    console.error('Erreur suppression upload:', error);
    res.status(500).json({ error: 'Erreur serveur', details: error.message });
  }
};

/** GET /api/uploads/config — formats et limites, pour l'interface. */
exports.getConfig = (req, res) => {
  res.json({
    enabled: storage.isConfigured(),
    accepted_mime: Array.from(uploadService.ACCEPTED_MIME),
    max_file_bytes: uploadService.MAX_FILE_BYTES,
    retention_days: uploadService.RETENTION_DAYS,
  });
};

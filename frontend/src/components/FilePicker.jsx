import { useState, useCallback, useRef, useEffect } from 'react';
import { fetchUploadConfig, uploadFile, deleteUpload } from '../utils/uploadApi';

const MIME_LABELS = {
  'application/pdf': 'PDF',
  'text/plain': 'Texte',
  'text/markdown': 'Markdown',
  'text/csv': 'CSV',
};

function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
}

function fileLabel(upload) {
  if (upload.mime_type?.startsWith('image/')) return 'Image';
  return MIME_LABELS[upload.mime_type] || 'Fichier';
}

/**
 * Sélecteur de fichiers pour les générations : documents ou photo prise sur le
 * moment.
 *
 * Deux entrées distinctes plutôt qu'une seule : sur mobile, l'attribut
 * `capture` ouvre directement l'appareil photo, alors qu'un champ de fichiers
 * classique ouvre l'explorateur. Les fusionner priverait de l'un ou de l'autre.
 *
 * L'extraction du texte a lieu côté serveur à la fin de l'envoi ; un fichier
 * illisible (PDF scanné, photo floue) est signalé ici avec la marche à suivre,
 * et n'est pas transmis au générateur.
 */
function FilePicker({ uploads, onChange, disabled = false, maxFiles = 5 }) {
  const [config, setConfig] = useState(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const fileInput = useRef(null);
  const cameraInput = useRef(null);

  useEffect(() => {
    fetchUploadConfig().then(setConfig);
  }, []);

  const handleFiles = useCallback(
    async (fileList) => {
      const files = Array.from(fileList || []);
      if (files.length === 0) return;

      const room = maxFiles - uploads.length;
      if (room <= 0) {
        setError(`Maximum ${maxFiles} fichiers.`);
        return;
      }

      setBusy(true);
      setError('');
      const added = [];
      for (const file of files.slice(0, room)) {
        setProgress(0);
        try {
          added.push(await uploadFile(file, setProgress));
        } catch (err) {
          const message = err.response?.data?.error || `Envoi impossible : ${file.name}`;
          setError(message);
        }
      }
      if (added.length > 0) onChange([...uploads, ...added]);
      setBusy(false);
      setProgress(0);
    },
    [uploads, onChange, maxFiles]
  );

  const handleRemove = useCallback(
    async (upload) => {
      onChange(uploads.filter((u) => u.id !== upload.id));
      deleteUpload(upload.id).catch(() => {});
    },
    [uploads, onChange]
  );

  if (config && !config.enabled) return null;

  const accept = config?.accepted_mime?.join(',') || 'application/pdf,image/*,text/plain';

  return (
    <div className="mb-4">
      <span className="block text-sm font-medium text-[var(--om-text)] mb-1.5">
        Documents source <span className="font-normal text-[var(--om-muted)]">(optionnel)</span>
      </span>

      {uploads.length > 0 && (
        <ul className="flex flex-col gap-1.5 mb-2">
          {uploads.map((upload) => (
            <li
              key={upload.id}
              className="px-3 py-2 rounded-[10px] border border-[var(--om-line)] bg-[var(--om-surface-2)] text-sm"
            >
              <div className="flex items-center gap-2">
                <span className="flex-1 min-w-0">
                  <span className="block truncate text-[var(--om-text)]">{upload.filename}</span>
                  <span className="text-xs text-[var(--om-muted)]">
                    {fileLabel(upload)} · {formatSize(upload.size_bytes)}
                    {upload.extracted_chars > 0 && ` · ${upload.extracted_chars.toLocaleString('fr-FR')} caractères lus`}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => handleRemove(upload)}
                  disabled={disabled || busy}
                  aria-label={`Retirer ${upload.filename}`}
                  className="p-1 text-[var(--om-muted)] hover:text-[var(--om-danger)] disabled:opacity-50"
                >
                  ✕
                </button>
              </div>

              {/* Ce qui a réellement été lu. Sans cet aperçu, une lecture ratée
                  ne se voit qu'après coup, sur des cartes hors sujet. */}
              {upload.preview && (
                <details className="mt-1.5">
                  <summary className="text-xs text-[var(--om-accent)] cursor-pointer select-none">
                    Vérifier le texte lu
                  </summary>
                  <p className="mt-1 text-xs text-[var(--om-muted)] bg-[var(--om-surface)] rounded p-2 max-h-28 overflow-y-auto whitespace-pre-wrap">
                    {upload.preview}
                    {upload.extracted_chars > upload.preview.length && ' […]'}
                  </p>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={disabled || busy || uploads.length >= maxFiles}
          className="flex-1 px-3 py-2 rounded-[10px] border border-dashed border-[var(--om-line)] text-sm text-[var(--om-muted)] hover:border-[var(--om-accent)] hover:text-[var(--om-accent)] disabled:opacity-50 transition-colors"
        >
          📎 Ajouter un fichier
        </button>
        <button
          type="button"
          onClick={() => cameraInput.current?.click()}
          disabled={disabled || busy || uploads.length >= maxFiles}
          className="flex-1 px-3 py-2 rounded-[10px] border border-dashed border-[var(--om-line)] text-sm text-[var(--om-muted)] hover:border-[var(--om-accent)] hover:text-[var(--om-accent)] disabled:opacity-50 transition-colors"
        >
          📷 Prendre une photo
        </button>
      </div>

      <input
        ref={fileInput}
        type="file"
        multiple
        accept={accept}
        className="hidden"
        onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
      />
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
      />

      {busy && (
        <p className="text-xs text-[var(--om-muted)] mt-2" role="status">
          Envoi et lecture du document… {progress > 0 && `${progress}%`}
        </p>
      )}
      {error && <p className="text-xs text-[var(--om-danger)] mt-2" role="alert">{error}</p>}
      {!busy && !error && config && (
        <p className="text-xs text-[var(--om-muted)] mt-2">
          PDF, images et fichiers texte. Les documents sont supprimés
          automatiquement au bout de {config.retention_days} jours.
        </p>
      )}
    </div>
  );
}

export default FilePicker;

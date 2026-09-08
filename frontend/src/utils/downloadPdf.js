import html2pdf from 'html2pdf.js';
import { marked } from 'marked';

function looksLikeHtml(str) {
  if (!str || !str.trim()) return false;
  const t = str.trim();
  return t.startsWith('<') && (t.includes('</') || t.endsWith('>'));
}

function contentToHtml(content) {
  if (!content || !content.trim()) return '';
  try {
    if (looksLikeHtml(content)) return content.trim();
    const parsed = marked.parse(content, { async: false });
    return typeof parsed === 'string' ? parsed : String(parsed);
  } catch {
    return content;
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Télécharge le contenu (titre + corps HTML/Markdown) en PDF A4.
 * Marges et police adaptées à la lecture.
 */
export async function downloadContentAsPdf(title, content, filename = 'document.pdf') {
  const htmlContent = contentToHtml(content);
  const safeTitle = escapeHtml(title || 'Sans titre');

  const wrapper = document.createElement('div');
  wrapper.style.cssText = [
    'padding: 10mm 12mm;',
    'font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;',
    'font-size: 12pt;',
    'line-height: 1.6;',
    'color: var(--om-text);',
    'max-width: 100%;',
    'box-sizing: border-box;',
  ].join(' ');

  wrapper.innerHTML = [
    `<h1 style="font-size: 18pt; font-weight: 700; margin: 0 0 1em; color: var(--om-text);">${safeTitle}</h1>`,
    '<div class="pdf-body" style="font-size: 12pt; line-height: 1.6;">',
    htmlContent,
    '</div>',
  ].join('');

  // Styles de base pour le contenu rendu (listes, paragraphes, etc.)
  const style = document.createElement('style');
  style.textContent = `
    .pdf-body p { margin: 0.8em 0; color: #475569; }
    .pdf-body h1 { font-size: 16pt; font-weight: 700; margin: 1.2em 0 0.5em; }
    .pdf-body h2 { font-size: 14pt; font-weight: 700; margin: 1em 0 0.4em; }
    .pdf-body h3 { font-size: 12pt; font-weight: 600; margin: 0.8em 0 0.3em; }
    .pdf-body ul, .pdf-body ol { margin: 0.6em 0; padding-left: 1.5em; }
    .pdf-body li { margin: 0.25em 0; }
    .pdf-body code { background: #f1f5f9; padding: 0.15em 0.4em; border-radius: 4px; font-size: 0.9em; }
    .pdf-body pre { background: #f1f5f9; padding: 1em; border-radius: 8px; overflow-x: auto; margin: 0.8em 0; font-size: 10pt; }
    .pdf-body blockquote { border-left: 3px solid var(--om-accent); padding-left: 1em; margin: 0.8em 0; color: #475569; font-style: italic; }
    .pdf-body a { color: var(--om-accent); text-decoration: underline; }
  `;
  wrapper.appendChild(style);

  document.body.appendChild(wrapper);

  const opts = {
    margin: [8, 8, 8, 8],
    filename: filename.replace(/\.pdf$/i, '') + '.pdf',
    pageFormat: 'a4',
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
  };

  try {
    await html2pdf().set(opts).from(wrapper).save();
  } finally {
    document.body.removeChild(wrapper);
  }
}

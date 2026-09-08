/**
 * Destination des cartes dans la collection.
 *
 * Trois réponses possibles, et non deux : hors groupe, dans un groupe existant,
 * ou — pour une génération en lot seulement — dans des groupes que le sujet
 * dicte et que la génération crée au passage. Ce dernier choix n'a aucun sens
 * pour une carte à l'unité, d'où `allowAuto`.
 *
 * @param {'auto'|'none'|string} value
 * @param {Array<{id: number|string, title: string}>} chapters groupes existants
 * @param {boolean} [allowAuto] propose « groupes automatiques »
 */
function ChapterSelect({ value, onChange, chapters = [], disabled = false, allowAuto = false, id = 'card-chapter' }) {
  return (
    <>
      <label htmlFor={id} className="block text-sm font-medium text-[var(--om-text)] mb-1.5">
        Ranger les cartes
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full px-3 py-2 rounded-[10px] border border-[var(--om-line)] text-[var(--om-text)] mb-4 bg-[var(--om-surface)] disabled:opacity-60"
      >
        {allowAuto && <option value="auto">Groupes automatiques (selon le sujet)</option>}
        <option value="none">Sans groupe</option>
        {chapters.map((chapter) => (
          <option key={chapter.id} value={String(chapter.id)}>
            {chapter.title}
          </option>
        ))}
      </select>
    </>
  );
}

export default ChapterSelect;

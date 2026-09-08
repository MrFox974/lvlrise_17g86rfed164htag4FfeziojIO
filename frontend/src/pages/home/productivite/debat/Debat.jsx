import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useLoaderData, useNavigate, useParams } from 'react-router-dom';
import { useDemoMode, useDemoBasePath } from '../../../../hooks/useDemoMode';
import Timer from '../../../../components/Timer';
import { ConfirmDelete } from '../../../../components/Flashcards';
import {
  fetchDebates,
  fetchDebate,
  createDebate,
  updateDebate,
  deleteDebate,
  createDebateNode,
  updateDebateNode,
  deleteDebateNode,
  createDebateArgument,
  updateDebateArgument,
  deleteDebateArgument,
} from '../../../../utils/debateApi';
import {
  fetchDemoDebates,
  fetchDemoDebate,
  createDemoDebate,
  updateDemoDebate,
  deleteDemoDebate,
  createDemoDebateNode,
  updateDemoDebateNode,
  deleteDemoDebateNode,
  createDemoDebateArgument,
  updateDemoDebateArgument,
  deleteDemoDebateArgument,
} from '../../../../utils/demoApi';

const STEPS = [
  { key: 'captation', label: 'Captation' },
  { key: 'recherche', label: 'Recherche / Vérification' },
  { key: 'relecture', label: 'Relecture' },
  { key: 'oral', label: 'Explication orale du concept' },
  { key: 'opinion', label: "Construire son opinion" },
];

const PLANS = ['Factuel', 'Perso'];
/**
 * Natures d'avant la bascule vers « Perso ». Elles ne sont plus proposées, mais
 * restent reconnues : les tags sont réécrits à chaque enregistrement, et sans
 * cette liste un argument classé « Conceptuel » perdrait sa nature à la première
 * modification — sans que rien ne le signale.
 */
const LEGACY_PLANS = ['Conceptuel', 'Normatif'];
const isPlanTag = (t) => PLANS.includes(t) || LEGACY_PLANS.includes(t);
const THEMES = [
  'Économique', 'Juridique', 'Politique', 'Social', 'Moral', 'Scientifique',
  'Philosophique', 'Historique', 'Écologique', 'Culturel', 'Technique', 'Géopolitique',
];
const SUPPORTS = [
  'YouTube', 'Article de presse', 'Article scientifique', 'Étude', 'Rapport', 'Podcast', 'Livre',
  'Documentaire', 'Conférence', 'Interview', 'Débat TV', 'Réseaux sociaux', 'Texte de loi',
  'Statistiques officielles', 'Blog', 'Cours',
];
const VERDICTS = {
  verifie: { label: 'Vérifié', color: 'var(--om-success)', bg: 'var(--om-success-soft)' },
  nuance: { label: 'Nuance', color: 'var(--om-nuance)', bg: 'var(--om-nuance-soft)' },
  faux: { label: 'Faux', color: 'var(--om-danger)', bg: 'var(--om-danger-soft)' },
};

/** Éclaircit une couleur sémantique pour un usage en fin trait de bordure : les
 * tokens --om-success/warning/danger sont pensés pour du texte, trop sourds
 * en simple liseré. */
const brighten = (color) => `color-mix(in oklch, ${color} 65%, white)`;

const chipStyle = (active, tone) => ({
  borderColor: active ? (tone ? brighten(tone) : 'var(--om-accent)') : 'var(--om-line)',
  background: active ? (tone ? `color-mix(in oklch, ${tone} 18%, var(--om-surface))` : 'var(--om-accent-soft)') : 'transparent',
  color: active ? tone || 'var(--om-text)' : 'var(--om-muted)',
});

function argCountOf(node) {
  if (!node) return 0;
  return Array.isArray(node.arguments) ? node.arguments.length : node.arguments_count ?? 0;
}

function segments(done, current) {
  return STEPS.map((s, i) => ({
    key: s.key,
    bg: i < done ? 'var(--om-accent)' : i === current ? 'var(--om-accent-soft)' : 'var(--om-track)',
  }));
}

function Modal({ onClose, children, wide }) {
  return (
    <div
      className="fixed inset-0 z-[220] flex items-end md:items-center justify-center p-3 md:p-6"
      role="dialog"
      aria-modal="true"
    >
      <div className="om-scrim fixed inset-0" onClick={onClose} />
      <div
        className={`om-card no-scrollbar relative z-10 w-full ${wide ? 'max-w-lg' : 'max-w-md'} max-h-[92vh] overflow-y-auto p-5 flex flex-col gap-4 animate-om-pop`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function ModalHeader({ label, onClose }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="om-kicker">{label}</span>
      <button type="button" onClick={onClose} className="om-icon-btn w-8 h-8" aria-label="Fermer">
        <i className="ph ph-x text-[14px]" aria-hidden />
      </button>
    </div>
  );
}

/** `row` garde les puces sur une seule ligne, défilable horizontalement : sur les
 * douze plans de discussion, un retour à la ligne mangerait la moitié du composeur. */
function ChipGroup({ items, isActive, tone, onPick, label, custom, onCustomChange, customPlaceholder, row }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <span className="om-label">{label}</span>}
      <div className={row ? 'no-scrollbar flex flex-nowrap gap-1.5 overflow-x-auto' : 'flex flex-wrap gap-1.5'}>
        {items.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onPick(t)}
            className={row ? 'om-chip flex-shrink-0' : 'om-chip'}
            style={chipStyle(isActive(t), typeof tone === 'function' ? tone(t) : tone)}
          >
            {t}
          </button>
        ))}
      </div>
      {onCustomChange && (
        <input
          type="text"
          value={custom}
          onChange={(e) => onCustomChange(e.target.value)}
          placeholder={customPlaceholder}
          className="om-input mt-1"
        />
      )}
    </div>
  );
}

/** Modale « Source en cours » : renseigne la source par défaut pour les prochains arguments captés. */
function SourceModal({ initial, onSave, onClose }) {
  const [name, setName] = useState(initial.name);
  const [type, setType] = useState(SUPPORTS.includes(initial.support) ? initial.support : '');
  const [custom, setCustom] = useState(SUPPORTS.includes(initial.support) ? '' : initial.support);
  const [date, setDate] = useState(initial.date);

  return (
    <Modal onClose={onClose}>
      <ModalHeader label="Source en cours" onClose={onClose} />
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Auteur, média, titre…"
        className="om-input"
      />
      <ChipGroup
        label="Type de source"
        items={SUPPORTS}
        isActive={(t) => type === t && !custom.trim()}
        onPick={(t) => {
          setType(t);
          setCustom('');
        }}
        custom={custom}
        onCustomChange={setCustom}
        customPlaceholder="Ou saisis un autre type…"
      />
      <div className="flex flex-col gap-1.5">
        <span className="om-label">Date</span>
        <input
          type="text"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          placeholder="MM/AAAA"
          className="om-input !w-32 tabular-nums"
        />
      </div>
      <button
        type="button"
        onClick={() => onSave({ name: name.trim(), support: custom.trim() || type || 'Type à définir', date: date.trim() })}
        className="om-btn om-btn-primary w-full"
      >
        <i className="ph-bold ph-check text-[15px]" aria-hidden />Utiliser cette source
      </button>
    </Modal>
  );
}

/** Modale d'édition d'un argument capté : camp, nature, thèmes, source et — hors captation — verdict. */
function EditArgumentModal({ arg, showVerdict, onSave, onDelete, onClose }) {
  const [text, setText] = useState(arg.text);
  const [side, setSide] = useState(arg.side);
  const [plan, setPlan] = useState(arg.tags.find(isPlanTag) || '');
  const [themesSel, setThemesSel] = useState(arg.tags.filter((t) => THEMES.includes(t)));
  const [source, setSource] = useState(arg.source);
  const [support, setSupport] = useState(arg.support || SUPPORTS[0]);
  const [date, setDate] = useState(arg.date);
  const [verdict, setVerdict] = useState(arg.verdict);
  const [note, setNote] = useState(arg.note);

  const toggleTheme = (t) => setThemesSel((s) => (s.includes(t) ? s.filter((v) => v !== t) : [...s, t]));

  return (
    <Modal onClose={onClose} wide>
      <ModalHeader label="Modifier l'argument" onClose={onClose} />
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="L'argument, dans tes mots…"
        className="om-textarea resize-none"
      />
      <div className="flex flex-col gap-1.5">
        <span className="om-label">Camp</span>
        <div className="om-segment">
          {['pour', 'contre'].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSide(s)}
              className="om-segment-item"
              data-active={side === s}
            >
              {s === 'pour' ? 'Pour' : 'Contre'}
            </button>
          ))}
        </div>
      </div>
      <ChipGroup
        label="Nature"
        items={PLANS}
        isActive={(t) => plan === t}
        onPick={(t) => setPlan((p) => (p === t ? '' : t))}
      />
      <ChipGroup
        label="Plan de discussion"
        items={THEMES}
        isActive={(t) => themesSel.includes(t)}
        onPick={toggleTheme}
      />
      <div className="flex flex-col gap-1.5">
        <span className="om-label">Source</span>
        <input
          type="text"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="Auteur, média, étude…"
          className="om-input"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSupport(SUPPORTS[(SUPPORTS.indexOf(support) + 1) % SUPPORTS.length])}
            className="om-select flex-1 text-left flex items-center justify-between"
          >
            {support}
            <i className="ph ph-arrows-clockwise text-[13px] text-[var(--om-muted)]" aria-hidden />
          </button>
          <input
            type="text"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            placeholder="MM/AAAA"
            className="om-input !w-28 tabular-nums"
          />
        </div>
      </div>
      {showVerdict && (
        <div className="flex flex-col gap-1.5">
          <span className="om-label">Vérification</span>
          <div className="flex flex-wrap gap-1.5">
            {[{ key: null, label: 'Non vérifié', tone: null }, ...Object.entries(VERDICTS).map(([key, v]) => ({ key, label: v.label, tone: v.color }))].map(
              (c) => (
                <button
                  key={c.key ?? 'none'}
                  type="button"
                  onClick={() => setVerdict(c.key)}
                  className="om-chip"
                  style={chipStyle(verdict === c.key, c.tone)}
                >
                  {c.label}
                </button>
              )
            )}
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Ce que dit la source…"
            className="om-textarea resize-none"
          />
        </div>
      )}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onDelete}
          className="om-icon-btn w-[46px] h-[46px] border-[var(--om-danger)] bg-[var(--om-danger-soft)] text-[var(--om-danger)]"
          aria-label="Supprimer l'argument"
        >
          <i className="ph ph-trash text-[16px]" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() =>
            onSave({
              text: text.trim() || arg.text,
              side,
              tags: [plan, ...themesSel].filter(Boolean),
              source: source.trim() || 'Source à renseigner',
              support,
              date: date.trim() || '—',
              verdict,
              note,
            })
          }
          className="om-btn om-btn-primary flex-1"
        >
          <i className="ph-bold ph-check text-[15px]" aria-hidden />Enregistrer
        </button>
      </div>
    </Modal>
  );
}

const TIMER_STORAGE_KEY = 'timer_state';
const STEP_STORAGE_KEY = 'debat_step_by_node';

/**
 * Dernière étape ouverte pour un nœud.
 *
 * Distinct de `step_done`, qui retient l'étape la plus avancée atteinte : on peut
 * être remonté relire la captation d'un débat déjà mené jusqu'à l'oral, et vouloir
 * reprendre là. C'est de l'état de vue, pas de la progression — d'où le
 * localStorage plutôt qu'une colonne en base, comme pour le minuteur.
 */
function loadStepFor(nodeId, fallback) {
  try {
    const map = JSON.parse(localStorage.getItem(STEP_STORAGE_KEY) || '{}');
    const saved = map[String(nodeId)];
    return Number.isInteger(saved) && saved >= 0 && saved <= 4 ? saved : fallback;
  } catch {
    return fallback;
  }
}

function saveStepFor(nodeId, step) {
  try {
    const map = JSON.parse(localStorage.getItem(STEP_STORAGE_KEY) || '{}');
    map[String(nodeId)] = step;
    localStorage.setItem(STEP_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Stockage indisponible (navigation privée) : on perd juste la reprise.
  }
}

const SOURCE_STORAGE_KEY = 'debat_source_by_node';
const EMPTY_SOURCE = { name: '', support: 'Article de presse', date: '' };

const sourceIsEmpty = (src) =>
  !src.name.trim() && !src.date.trim() && src.support === EMPTY_SOURCE.support;

/**
 * Dernière source renseignée pour un nœud.
 *
 * On dépouille rarement une source d'une seule traite : on ferme l'app, on y
 * revient, et retrouver la barre vide oblige à ressaisir titre, support et date
 * avant de pouvoir capter le moindre argument. Comme l'étape en cours, c'est de
 * l'état de séance et non du contenu de débat — d'où le localStorage plutôt
 * qu'une colonne en base.
 */
function loadSourceFor(nodeId) {
  try {
    const map = JSON.parse(localStorage.getItem(SOURCE_STORAGE_KEY) || '{}');
    const saved = map[String(nodeId)];
    if (!saved || typeof saved !== 'object') return EMPTY_SOURCE;
    // Le support peut être saisi librement dans la modale : on accepte toute
    // chaîne non vide, pas seulement celles de SUPPORTS.
    const support = typeof saved.support === 'string' && saved.support.trim()
      ? saved.support
      : EMPTY_SOURCE.support;
    return {
      name: typeof saved.name === 'string' ? saved.name : '',
      support,
      date: typeof saved.date === 'string' ? saved.date : '',
    };
  } catch {
    return EMPTY_SOURCE;
  }
}

function saveSourceFor(nodeId, source) {
  try {
    const map = JSON.parse(localStorage.getItem(SOURCE_STORAGE_KEY) || '{}');
    // Une source vidée ne laisse pas d'entrée derrière elle : la carte ne doit
    // pas grossir d'un enregistrement par débat simplement ouvert.
    if (sourceIsEmpty(source)) delete map[String(nodeId)];
    else map[String(nodeId)] = source;
    localStorage.setItem(SOURCE_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Stockage indisponible : la source vaut pour la session en cours, c'est tout.
  }
}

const DRAFT_STORAGE_KEY = 'debat_draft_by_node';
const SIDES = ['pour', 'nuance', 'contre'];
const EMPTY_DRAFT = {
  draft: '', tag: PLANS[0], selected: null, research: '', rPlans: [], opinion: null, side: null,
};

/**
 * Saisies en cours d'un nœud, non encore envoyées.
 *
 * Un argument qu'on est en train de formuler, une note de vérification, une
 * opinion à moitié écrite : rien de tout cela n'est enregistré tant qu'on n'a
 * pas tranché (Pour/Contre, un verdict, « Valider mon avis »). Or l'outil invite
 * précisément à sortir en cours de route — attraper un mot dans les flashcards,
 * vérifier une source — et revenir. Perdre sa phrase à ce moment-là, c'est
 * perdre le fil du raisonnement, pas seulement quelques caractères.
 *
 * `opinion` et `side` valent `null` tant qu'ils n'ont pas divergé de ce qui est
 * enregistré côté serveur : un simple passage à la dernière étape ne doit pas
 * figer une copie qui masquerait ensuite la version en base.
 */
function loadDraftFor(nodeId) {
  try {
    const map = JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY) || '{}');
    const saved = map[String(nodeId)];
    if (!saved || typeof saved !== 'object') return EMPTY_DRAFT;
    return {
      draft: typeof saved.draft === 'string' ? saved.draft : '',
      tag: PLANS.includes(saved.tag) ? saved.tag : PLANS[0],
      selected: saved.selected ?? null,
      research: typeof saved.research === 'string' ? saved.research : '',
      rPlans: Array.isArray(saved.rPlans) ? saved.rPlans.filter((t) => THEMES.includes(t)) : [],
      opinion: typeof saved.opinion === 'string' ? saved.opinion : null,
      side: SIDES.includes(saved.side) ? saved.side : null,
    };
  } catch {
    return EMPTY_DRAFT;
  }
}

function saveDraftFor(nodeId, value, committed) {
  const pending = {
    ...value,
    opinion: value.opinion === (committed.opinion || '') ? null : value.opinion,
    side: value.side === (committed.side || null) ? null : value.side,
  };
  const empty = !pending.draft.trim()
    && !pending.research.trim()
    && pending.rPlans.length === 0
    && pending.selected == null
    && pending.tag === PLANS[0]
    && pending.opinion === null
    && pending.side === null;
  try {
    const map = JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY) || '{}');
    if (empty) delete map[String(nodeId)];
    else map[String(nodeId)] = pending;
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Stockage indisponible : les saisies valent pour la session en cours.
  }
}

function clearDraftFor(nodeId) {
  try {
    const map = JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY) || '{}');
    delete map[String(nodeId)];
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* rien à nettoyer */
  }
}

/** Aperçu du minuteur global dans le header : reflète l'état de <Timer/> sans le
 * dupliquer — simple lecture de son localStorage, à 0 tant qu'il n'est pas lancé. */
function TimerBadge({ onClick }) {
  const readState = () => {
    try {
      const raw = localStorage.getItem(TIMER_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };
  const [state, setState] = useState(readState);

  useEffect(() => {
    const id = setInterval(() => setState(readState()), 300);
    return () => clearInterval(id);
  }, []);

  const running = !!state?.isRunning;
  const ms = running ? Math.max(0, state.remainingMsTotal ?? 0) : 0;
  const totalSec = Math.floor(ms / 1000);
  const p = (n) => String(n).padStart(2, '0');
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const label = h > 0 ? `${p(h)}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;

  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 flex-shrink-0 transition-colors"
      style={{
        border: `1px solid ${running ? 'var(--om-accent)' : 'transparent'}`,
        background: running ? 'var(--om-accent-soft)' : 'var(--om-surface-2)',
        color: running ? 'var(--om-accent)' : 'var(--om-muted)',
      }}
      aria-label="Ouvrir le minuteur"
    >
      <span className="text-[12px] font-medium tabular-nums">{label}</span>
      <i className={`${running ? 'ph-fill ph-pause' : 'ph-fill ph-play'} text-[13px]`} aria-hidden />
    </button>
  );
}

function TimerModal({ onClose }) {
  return (
    <Modal onClose={onClose}>
      <ModalHeader label="Session focus" onClose={onClose} />
      <Timer />
    </Modal>
  );
}

/** Bulle d'argument : alignée pour/contre, avec anneau de vérification hors captation. */
function ArgumentBubble({ arg, isSelected, showRing, canSelect, canEditOnTap, onTap }) {
  const pour = arg.side === 'pour';
  const sideColor = pour ? 'var(--om-pour)' : 'var(--om-contre)';
  const v = arg.verdict ? VERDICTS[arg.verdict] : null;
  const ring = isSelected
    ? '0 0 0 2px var(--om-accent), var(--om-shadow)'
    : showRing && v
      ? `0 0 0 1.5px ${brighten(v.color)}, var(--om-shadow)`
      : 'var(--om-shadow)';
  return (
    <div
      onClick={onTap}
      className="w-[92%] rounded-[18px] px-3.5 py-3 flex flex-col gap-2 transition-shadow"
      style={{
        alignSelf: pour ? 'flex-start' : 'flex-end',
        background: pour ? 'var(--om-pour-soft)' : 'var(--om-contre-soft)',
        boxShadow: ring,
        cursor: canSelect || canEditOnTap ? 'pointer' : 'default',
      }}
    >
      <div className="flex items-start gap-2">
        <span className="flex-1 min-w-0 text-[13.5px] leading-relaxed text-[var(--om-text)]">{arg.text}</span>
        <span
          className="flex-shrink-0 text-[10.5px] font-medium uppercase tracking-wider pt-0.5"
          style={{ color: sideColor }}
        >
          {pour ? 'Pour' : 'Contre'}
        </span>
      </div>
      {arg.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {arg.tags.map((t) => (
            <span key={t} className="rounded-full px-2.5 py-0.5 text-[10.5px] font-medium bg-[var(--om-surface-2)] text-[var(--om-muted)]">
              {t}
            </span>
          ))}
        </div>
      )}
      {showRing && arg.note && <p className="text-xs leading-snug italic text-[var(--om-muted)]">{arg.note}</p>}
      <div className="flex items-center justify-between gap-2.5 border-t pt-2" style={{ borderColor: 'var(--om-line)' }}>
        <span className="text-[10.5px] truncate text-[var(--om-muted)]">{arg.source}</span>
        <span className="flex-shrink-0 text-[10.5px] tabular-nums text-[var(--om-muted)]">
          {arg.support} · {arg.date}
        </span>
      </div>
    </div>
  );
}

function NodeProgress({ done }) {
  return (
    <div className="flex gap-1 flex-1">
      {segments(done, -1).map((s) => (
        <span key={s.key} className="flex-1 h-1.5 rounded-full transition-colors" style={{ background: s.bg }} />
      ))}
    </div>
  );
}

/** Ligne slidable vers la gauche pour révéler la suppression, comme les collections FlashCards. */
function SwipeRow({ radius = 20, onOpen, onRequestDelete, children }) {
  const [swiping, setSwiping] = useState(false);
  const [offset, setOffset] = useState(0);
  const [ignoreClick, setIgnoreClick] = useState(false);
  const startX = useRef(0);

  const start = (clientX) => {
    startX.current = clientX;
    setSwiping(true);
    setOffset(0);
    setIgnoreClick(false);
  };
  const move = (clientX) => {
    const diff = startX.current - clientX;
    if (diff > 0) setOffset(Math.min(diff, 100));
  };
  const end = () => {
    if (swiping && offset > 50) {
      onRequestDelete();
      setIgnoreClick(true);
    }
    setSwiping(false);
    setOffset(0);
  };

  return (
    <div
      className="relative overflow-hidden"
      style={{ touchAction: 'manipulation', borderRadius: radius }}
      onTouchStart={(e) => start(e.touches[0].clientX)}
      onTouchMove={(e) => swiping && move(e.touches[0].clientX)}
      onTouchEnd={end}
      onMouseDown={(e) => start(e.clientX)}
      onMouseMove={(e) => swiping && move(e.clientX)}
      onMouseUp={end}
      onMouseLeave={() => swiping && end()}
    >
      <div
        className="absolute right-0 top-0 bottom-0 flex items-center justify-center bg-[var(--om-danger)] text-[var(--om-on-danger)] px-6 cursor-pointer z-0 transition-transform duration-300 ease-out"
        style={{
          minWidth: 100,
          borderRadius: radius,
          transform: `translateX(${offset > 0 ? '0' : '100%'})`,
          opacity: offset > 0 ? 1 : 0,
          pointerEvents: offset > 0 ? 'auto' : 'none',
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onRequestDelete();
          setSwiping(false);
          setOffset(0);
        }}
      >
        <span className="text-sm font-medium">Supprimer</span>
      </div>
      <div
        role="button"
        tabIndex={0}
        className="relative z-10 transition-transform duration-300 ease-out"
        style={{ transform: `translateX(-${offset}px)` }}
        onClick={() => {
          if (ignoreClick) {
            setIgnoreClick(false);
            return;
          }
          if (offset > 0) return;
          onOpen?.();
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** Vue liste : tous les débats de l'utilisateur. */
function DebateList({ debates, onCreate, onOpen, onDeleteDebate }) {
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [question, setQuestion] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="text-[17px] md:text-[19px] font-medium tracking-[-0.01em] text-[var(--om-text)]">Débats</h1>
          <p className="text-xs text-[var(--om-muted)]">Cinq étapes pour te forger ton propre avis.</p>
        </div>
        <button type="button" onClick={() => setShowCreate((s) => !s)} className="om-btn om-btn-primary flex-shrink-0">
          <i className="ph ph-plus text-[14px]" aria-hidden />Nouveau
        </button>
      </div>

      {showCreate && (
        <div className="om-card mb-4 p-4 flex flex-col gap-2.5 animate-om-pop">
          <span className="om-kicker">Nouveau débat</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Le féminisme, le nucléaire, l'IA…"
            className="om-input"
          />
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="La question posée — Pour ou contre ?"
            className="om-input"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                if (!title.trim()) return;
                onCreate({ title, question });
                setTitle('');
                setQuestion('');
                setShowCreate(false);
              }}
              className="om-btn om-btn-primary"
            >
              Créer le débat
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="om-btn om-btn-ghost">
              Annuler
            </button>
          </div>
        </div>
      )}

      {debates.length === 0 ? (
        <div className="om-card-dashed text-center py-10 px-4">
          <p className="text-sm text-[var(--om-text)] mb-1">Aucun débat encore.</p>
          <p className="text-xs text-[var(--om-muted)]">Crée-en un pour commencer à te forger un avis.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {debates.map((d) => {
            const done = d.general?.step_done ?? 0;
            const argCount = argCountOf(d.general);
            const stateLabel = done === 5 ? 'Avis forgé' : done === 0 ? 'À ouvrir' : 'En cours';
            const stateIcon = done === 5 ? 'ph-fill ph-check-circle' : done === 0 ? 'ph ph-circle-dashed' : 'ph ph-hourglass-medium';
            return (
              <SwipeRow key={d.id} radius={20} onOpen={() => onOpen(d.id)} onRequestDelete={() => setConfirmDelete(d)}>
                <div className="om-card p-4 text-left flex flex-col gap-3 hover:border-[var(--om-accent)] transition-colors cursor-pointer">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex flex-col gap-0.5">
                      <span className="text-[15px] md:text-base font-medium text-[var(--om-text)]">{d.title}</span>
                      <span className="text-xs text-[var(--om-muted)]">{d.question}</span>
                    </div>
                    <span
                      className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium bg-[var(--om-surface-2)]"
                      style={{ color: done === 5 ? 'var(--om-success)' : 'var(--om-muted)' }}
                    >
                      <i className={stateIcon} style={{ fontSize: 12 }} aria-hidden />
                      {stateLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <NodeProgress done={done} />
                    <span className="text-xs font-medium tabular-nums text-[var(--om-muted)] flex-shrink-0">{done}/5</span>
                  </div>
                  <span className="text-[11.5px] text-[var(--om-muted)]">
                    {d.subs?.length || 0} sous-débat{(d.subs?.length || 0) === 1 ? '' : 's'} · {argCount} argument{argCount === 1 ? '' : 's'} capté{argCount === 1 ? '' : 's'}
                  </span>
                </div>
              </SwipeRow>
            );
          })}
        </div>
      )}

      <ConfirmDelete
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && onDeleteDebate(confirmDelete.id)}
        title="Supprimer le débat ?"
        message={`« ${confirmDelete?.title || ''} » sera supprimé avec ses sous-débats et tous les arguments captés. Cette action est irréversible.`}
      />
    </div>
  );
}

/** Vue détail : cadrage du débat, question centrale et sous-débats. */
function DebateDetail({ debate, onBack, onOpenNode, onCreateSub, onUpdateDesc, onDelete, onDeleteSub }) {
  const [showDesc, setShowDesc] = useState(false);
  const [showSub, setShowSub] = useState(false);
  const [newSub, setNewSub] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDeleteSub, setConfirmDeleteSub] = useState(null);

  const desc = debate.desc || {};
  const general = debate.general;
  const subs = debate.subs || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--om-accent)]">
          <i className="ph ph-arrow-left text-[14px]" aria-hidden />Retour aux débats
        </button>
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="om-icon-btn w-8 h-8 text-[var(--om-danger)]"
          aria-label="Supprimer le débat"
        >
          <i className="ph ph-trash text-[15px]" aria-hidden />
        </button>
      </div>

      <div className="mb-4">
        <h1 className="text-[17px] md:text-[19px] font-medium tracking-[-0.01em] text-[var(--om-text)]">{debate.title}</h1>
        <p className="text-xs text-[var(--om-muted)]">{debate.question}</p>
      </div>

      {/* Descriptif intégré à la page, sans carte : pour ne pas se confondre avec
          la section « Débat général » ci-dessous, qui reste seule surélevée. */}
      <div className="mb-5">
        <button
          type="button"
          onClick={() => setShowDesc((s) => !s)}
          className="w-full flex items-center gap-3 py-1 text-left"
        >
          <span className="w-9 h-9 flex-shrink-0 rounded-full bg-[var(--om-accent-soft)] text-[var(--om-accent)] inline-flex items-center justify-center">
            <i className="ph ph-scroll text-[17px]" aria-hidden />
          </span>
          <span className="flex-1 min-w-0 flex flex-col gap-0.5">
            <span className="om-kicker">Descriptif</span>
            <span className="text-sm text-[var(--om-text)]">Termes, limites et tensions du débat</span>
          </span>
          <i
            className="ph ph-caret-down text-[var(--om-muted)] transition-transform"
            style={{ fontSize: 16, transform: showDesc ? 'rotate(180deg)' : 'rotate(0deg)' }}
            aria-hidden
          />
        </button>
        {showDesc && (
          <div className="pt-3.5 pl-[3px] flex flex-col gap-3.5">
            {[
              { key: 'termes', label: 'Termes' },
              { key: 'limites', label: 'Limites' },
              { key: 'tensions', label: 'Tensions actuelles' },
            ].map((b) => (
              <div key={b.key} className="flex flex-col gap-1.5">
                <span className="om-label">{b.label}</span>
                <textarea
                  defaultValue={desc[b.key] || ''}
                  onBlur={(e) => onUpdateDesc({ [b.key]: e.target.value })}
                  rows={2}
                  placeholder="À définir."
                  className="om-textarea resize-none"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <span className="block om-label mb-2">Débat général</span>
      {general && (
        <button
          type="button"
          onClick={() => onOpenNode(general)}
          className="om-card p-4 w-full text-left flex flex-col gap-3 mb-4 relative overflow-hidden hover:border-[var(--om-accent)] transition-colors"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-[15px] md:text-base font-medium text-[var(--om-text)]">La question centrale</span>
              <span className="text-xs text-[var(--om-muted)]">
                {argCountOf(general)} argument{argCountOf(general) === 1 ? '' : 's'} ·{' '}
                {general.step_done === 5 ? 'avis forgé' : `étape ${general.step_done + 1} : ${STEPS[Math.min(general.step_done, 4)].label.toLowerCase()}`}
              </span>
            </div>
            <span className="flex-shrink-0 w-8 h-8 rounded-full border border-[var(--om-accent)] text-[var(--om-accent)] inline-flex items-center justify-center">
              <i className="ph ph-arrow-right text-[15px]" aria-hidden />
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <NodeProgress done={general.step_done} />
            <span className="text-xs font-medium tabular-nums text-[var(--om-muted)]">{general.step_done}/5</span>
          </div>
        </button>
      )}

      <div className="flex items-center justify-between mb-2">
        <span className="om-label">Sous-débats</span>
        <span className="text-[11.5px] text-[var(--om-muted)]">{subs.length} en cours</span>
      </div>
      <div className="flex flex-col gap-2.5">
        {subs.map((s) => (
          <SwipeRow key={s.id} radius={16} onOpen={() => onOpenNode(s)} onRequestDelete={() => setConfirmDeleteSub(s)}>
            <div className="om-card-sm p-3.5 w-full text-left flex flex-col gap-2.5 hover:border-[var(--om-accent)] transition-colors cursor-pointer">
              <div className="flex items-center gap-2.5">
                <span className="flex-1 min-w-0 text-sm font-medium text-[var(--om-text)]">{s.title}</span>
                <span className="text-xs font-medium tabular-nums" style={{ color: s.step_done === 5 ? 'var(--om-success)' : 'var(--om-muted)' }}>
                  {s.step_done}/5
                </span>
              </div>
              <NodeProgress done={s.step_done} />
            </div>
          </SwipeRow>
        ))}
        {showSub && (
          <div className="om-card-sm p-3 flex gap-2 animate-om-pop">
            <input
              type="text"
              value={newSub}
              onChange={(e) => setNewSub(e.target.value)}
              placeholder="Titre du sous-débat"
              className="om-input flex-1"
            />
            <button
              type="button"
              onClick={() => {
                if (!newSub.trim()) return;
                onCreateSub(newSub);
                setNewSub('');
                setShowSub(false);
              }}
              className="om-btn om-btn-primary"
            >
              Créer
            </button>
          </div>
        )}
        <button type="button" onClick={() => setShowSub((s) => !s)} className="om-card-dashed w-full py-3 text-sm font-medium text-[var(--om-muted)] hover:text-[var(--om-accent)] transition-colors">
          + Ajouter un sous-débat
        </button>
      </div>

      <ConfirmDelete
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={onDelete}
        title="Supprimer le débat ?"
        message={`« ${debate.title} » sera supprimé avec ses sous-débats et tous les arguments captés. Cette action est irréversible.`}
      />
      <ConfirmDelete
        isOpen={!!confirmDeleteSub}
        onClose={() => setConfirmDeleteSub(null)}
        onConfirm={() => confirmDeleteSub && onDeleteSub(confirmDeleteSub.id)}
        title="Supprimer le sous-débat ?"
        message={`« ${confirmDeleteSub?.title || ''} » sera supprimé avec tous ses arguments captés. Cette action est irréversible.`}
      />
    </div>
  );
}

/** Vue étapes : le cœur de l'outil, cinq étapes pour capter, vérifier, relire, expliquer puis trancher. */
function DebateSteps({ node, onBack, onGoStep, onAddArgument, onUpdateArgument, onDeleteArgument, onFinish }) {
  const [step, setStep] = useState(() => loadStepFor(node.id, Math.min(node.step_done, 4)));
  const stepKey = STEPS[step].key;
  const filterable = stepKey === 'oral' || stepKey === 'opinion';
  const canSelect = stepKey === 'recherche';
  const showRing = stepKey !== 'captation';
  const listRef = useRef(null);
  const listEndRef = useRef(null);

  useEffect(() => {
    saveStepFor(node.id, step);
  }, [node.id, step]);

  const [showTimer, setShowTimer] = useState(false);
  const [showSrc, setShowSrc] = useState(false);
  const [editingArg, setEditingArg] = useState(null);

  const [curSource, setCurSource] = useState(() => loadSourceFor(node.id));
  useEffect(() => {
    saveSourceFor(node.id, curSource);
  }, [node.id, curSource]);
  // Une seule lecture au montage : ensuite c'est l'état React qui fait foi.
  const [restored] = useState(() => loadDraftFor(node.id));
  const [draft, setDraft] = useState(restored.draft);
  const [tag, setTag] = useState(restored.tag);

  // L'argument visé a pu être supprimé entre-temps : sans ce contrôle, la note
  // de vérification reviendrait sans rien à quoi l'accrocher.
  const [selected, setSelected] = useState(
    (node.arguments || []).some((a) => a.id === restored.selected) ? restored.selected : null
  );
  const [research, setResearch] = useState(restored.research);
  const [rPlans, setRPlans] = useState(restored.rPlans);

  // L'enregistrement en cours ne se reprend pas : on le laisse hors du brouillon.
  const [recording, setRecording] = useState(false);

  const [opinion, setOpinion] = useState(restored.opinion ?? node.opinion ?? '');
  const [side, setSide] = useState(restored.side ?? node.side ?? null);

  useEffect(() => {
    saveDraftFor(
      node.id,
      { draft, tag, selected, research, rPlans, opinion, side },
      { opinion: node.opinion, side: node.side }
    );
  }, [node.id, node.opinion, node.side, draft, tag, selected, research, rPlans, opinion, side]);

  const [searchQ, setSearchQ] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [fVerdict, setFVerdict] = useState([]);
  const [fPlan, setFPlan] = useState([]);
  const [fTheme, setFTheme] = useState([]);

  const all = useMemo(() => node.arguments || [], [node.arguments]);

  const filtered = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    return all.filter((a) => {
      if (q && !`${a.text} ${a.source} ${(a.tags || []).join(' ')}`.toLowerCase().includes(q)) return false;
      if (fVerdict.length && !fVerdict.includes(a.verdict || 'aucun')) return false;
      if (fPlan.length && !(a.tags || []).some((t) => fPlan.includes(t))) return false;
      if (fTheme.length && !(a.tags || []).some((t) => fTheme.includes(t))) return false;
      return true;
    });
  }, [all, searchQ, fVerdict, fPlan, fTheme]);

  const args = filterable ? filtered : all;
  const filtersOn = fVerdict.length + fPlan.length + fTheme.length > 0 || searchQ.trim().length > 0;

  const tallies = {
    verifie: all.filter((a) => a.verdict === 'verifie').length,
    nuance: all.filter((a) => a.verdict === 'nuance').length,
    faux: all.filter((a) => a.verdict === 'faux').length,
  };

  // La liste est le seul élément qui défile : on la ramène en bas sans toucher
  // au défilement de la page, qui n'existe plus en plein écran.
  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => {
      const el = listRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, []);

  const goStep = (i) => {
    setStep(i);
    setSelected(null);
    setSearchQ('');
    setFilterOpen(false);
    onGoStep(i);
    scrollToEnd();
  };

  const handleAdd = async (s) => {
    const text = draft.trim();
    if (!text) return;
    await onAddArgument({
      side: s,
      text,
      tags: [tag],
      source: curSource.name.trim() || 'Source à renseigner',
      support: curSource.support,
      date: curSource.date.trim() || '—',
    });
    setDraft('');
    scrollToEnd();
  };

  const handleFinish = () => {
    if (!side || !opinion.trim()) return;
    // L'avis rejoint la base : garder un brouillon le masquerait au retour.
    clearDraftFor(node.id);
    onFinish({ side, opinion: opinion.trim() });
  };

  const applyVerdict = async (kind) => {
    if (!selected) return;
    const arg = all.find((a) => a.id === selected);
    if (!arg) return;
    await onUpdateArgument(selected, {
      verdict: kind,
      note: research.trim() || arg.note,
      tags: [...(arg.tags || []).filter(isPlanTag), ...rPlans],
    });
    setResearch('');
    setRPlans([]);
    setSelected(null);
  };

  const toggleIn = (list, setList, value) =>
    setList((s) => (s.includes(value) ? s.filter((v) => v !== value) : [...s, value]));

  const stepHint =
    stepKey === 'recherche'
      ? 'Touche un argument, écris ce que dit la source, puis tranche : vérifié, à nuancer ou faux.'
      : stepKey === 'relecture'
        ? 'Relis la carte du débat : ce qui tient, ce qui vacille, ce qui tombe.'
        : stepKey === 'oral'
          ? "Reformule le concept à voix haute, sans lire tes notes. Ce que tu n'arrives pas à dire, tu ne l'as pas encore compris."
          : '';

  const clock = filtersOn ? `${args.length}/${all.length}` : null;

  return (
    // Mode plein écran : les étapes sont une session de travail, comme la révision
    // des flashcards. Sans le header global ni le dock, l'en-tête ci-dessous est
    // le seul repère fixe et la liste devient le seul élément qui défile.
    <div className="fixed inset-0 z-[180] bg-[var(--om-bg)] flex flex-col overflow-hidden">
      <div
        className="flex-shrink-0 px-4 md:px-6 lg:px-8 pb-2.5"
        style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}
      >
        <div className="max-w-3xl mx-auto flex flex-col gap-2.5">
          <div className="flex items-center gap-2.5">
            <button type="button" onClick={onBack} className="om-icon-btn w-[34px] h-[34px] flex-shrink-0" aria-label="Quitter les étapes">
              <i className="ph ph-arrow-left text-[16px]" aria-hidden />
            </button>
            {/* Titre du nœud et étape courante sur deux niveaux : une seule bande
                au lieu des deux qu'il fallait avant. */}
            <div className="flex-1 min-w-0 flex flex-col">
              <span className="text-[11px] tracking-[0.1em] uppercase text-[var(--om-muted)] truncate">{node.title}</span>
              <span className="text-[15px] font-medium text-[var(--om-accent)] truncate leading-tight">{STEPS[step].label}</span>
            </div>
            <TimerBadge onClick={() => setShowTimer(true)} />
          </div>
          <div className="flex gap-1.5">
            {STEPS.map((s, i) => (
              <button key={s.key} type="button" onClick={() => goStep(i)} className="flex-1 py-1" aria-label={s.label}>
                <span
                  className="block w-full h-1.5 rounded-full transition-colors"
                  style={{ background: i < step ? 'var(--om-accent)' : i === step ? 'var(--om-accent-hover)' : 'var(--om-track)' }}
                />
              </button>
            ))}
          </div>
        </div>
      </div>

      {filterable && (
        <div className="flex-shrink-0 px-4 md:px-6 lg:px-8 pb-2">
          <div className="max-w-3xl mx-auto flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0 flex items-center gap-2 rounded-full px-3 py-2 bg-[var(--om-surface-2)]">
              <i className="ph ph-magnifying-glass text-[14px] text-[var(--om-muted)]" aria-hidden />
              <input
                type="text"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Rechercher un argument…"
                className="flex-1 min-w-0 bg-transparent outline-none text-sm text-[var(--om-text)]"
              />
            </div>
            <button
              type="button"
              onClick={() => setFilterOpen((s) => !s)}
              className="om-icon-btn w-[38px] h-[38px]"
              style={filtersOn || filterOpen ? { borderColor: 'var(--om-accent)', background: 'var(--om-accent-soft)', color: 'var(--om-accent)' } : {}}
              aria-label="Filtrer"
            >
              <i className="ph ph-funnel text-[16px]" aria-hidden />
            </button>
          </div>
          {filterOpen && (
            <div className="om-card-sm p-3.5 flex flex-col gap-3">
              <ChipGroup
                row
                label="Vérification"
                items={[
                  { key: 'verifie', label: 'Vérifiés', tone: 'var(--om-success)' },
                  { key: 'nuance', label: 'À nuancer', tone: 'var(--om-nuance)' },
                  { key: 'faux', label: 'Écartés', tone: 'var(--om-danger)' },
                  { key: 'aucun', label: 'Non vérifiés', tone: null },
                ].map((c) => c.key)}
                isActive={(k) => fVerdict.includes(k)}
                tone={(k) => ({ verifie: 'var(--om-success)', nuance: 'var(--om-nuance)', faux: 'var(--om-danger)' }[k])}
                onPick={(k) => toggleIn(fVerdict, setFVerdict, k)}
              />
              <ChipGroup row label="Nature" items={PLANS} isActive={(t) => fPlan.includes(t)} onPick={(t) => toggleIn(fPlan, setFPlan, t)} />
              <ChipGroup row label="Plan de discussion" items={THEMES} isActive={(t) => fTheme.includes(t)} onPick={(t) => toggleIn(fTheme, setFTheme, t)} />
              <button
                type="button"
                onClick={() => {
                  setFVerdict([]);
                  setFPlan([]);
                  setFTheme([]);
                  setSearchQ('');
                }}
                className="self-start text-xs font-medium text-[var(--om-accent)]"
              >
                Tout afficher
              </button>
            </div>
          )}
          {filtersOn && <span className="text-xs text-[var(--om-muted)] pl-1">{clock} argument{args.length === 1 ? '' : 's'}</span>}
          </div>
        </div>
      )}

      <div ref={listRef} className="no-scrollbar flex-1 min-h-0 overflow-y-auto px-4 md:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto flex flex-col gap-2.5 py-1">
        {stepHint && <p className="text-xs leading-relaxed text-[var(--om-muted)]">{stepHint}</p>}
        {args.map((a) => (
          <ArgumentBubble
            key={a.id}
            arg={a}
            isSelected={selected === a.id}
            showRing={showRing}
            canSelect={canSelect}
            canEditOnTap={stepKey === 'captation'}
            onTap={
              canSelect
                ? () => {
                    setSelected((s) => (s === a.id ? null : a.id));
                    setRPlans(selected === a.id ? [] : (a.tags || []).filter((t) => THEMES.includes(t)));
                  }
                : stepKey === 'captation'
                  ? () => setEditingArg(a)
                  : undefined
            }
          />
        ))}
        {args.length === 0 && (
          <div className="om-card-dashed text-center py-7 px-4">
            <p className="text-sm text-[var(--om-text)] mb-1">{filtersOn ? 'Aucun argument ne correspond.' : 'Aucun argument capté.'}</p>
            <p className="text-xs text-[var(--om-muted)]">
              {filtersOn ? 'Élargis la recherche ou retire un filtre.' : 'Écris ce que tu entends ou ce que tu lis, puis classe-le pour ou contre.'}
            </p>
          </div>
        )}
        <div ref={listEndRef} />
        </div>
      </div>

      <div
        className="flex-shrink-0 px-4 md:px-6 lg:px-8 pt-2"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        <div className="om-card p-4 max-w-3xl mx-auto flex flex-col gap-3">
        {stepKey === 'captation' && (
          <>
            <button
              type="button"
              onClick={() => setShowSrc(true)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[var(--om-surface-2)] text-left"
            >
              <i className="ph ph-bookmark-simple text-[13px] text-[var(--om-muted)] flex-shrink-0" aria-hidden />
              <span className="flex-1 min-w-0 text-[11.5px] truncate" style={{ color: curSource.name.trim() ? 'var(--om-text)' : 'var(--om-muted)' }}>
                {curSource.name.trim() || 'Définir la source en cours…'}
              </span>
              <span className="flex-shrink-0 text-[10.5px] text-[var(--om-muted)] tabular-nums">
                {curSource.support} · {curSource.date.trim() || '—'}
              </span>
              <i className="ph ph-pencil-simple text-[12px] text-[var(--om-muted)] flex-shrink-0" aria-hidden />
            </button>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              placeholder="Écrivez un argument…"
              className="om-textarea resize-none"
            />
            <div className="flex items-center gap-2.5">
              <span className="om-label flex-shrink-0">#tag</span>
              <div className="om-segment flex-1">
                {PLANS.map((t) => (
                  <button key={t} type="button" onClick={() => setTag(t)} className="om-segment-item flex-1" data-active={tag === t}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => handleAdd('pour')}
                disabled={!draft.trim()}
                className="om-btn flex-1 justify-center border"
                style={{ borderColor: 'var(--om-pour)', background: 'var(--om-pour-soft)', color: 'var(--om-text)' }}
              >
                <i className="ph ph-thumbs-up text-[16px]" aria-hidden />Pour
              </button>
              <button
                type="button"
                onClick={() => handleAdd('contre')}
                disabled={!draft.trim()}
                className="om-btn flex-1 justify-center border"
                style={{ borderColor: 'var(--om-contre)', background: 'var(--om-contre-soft)', color: 'var(--om-text)' }}
              >
                <i className="ph ph-thumbs-down text-[16px]" aria-hidden />Contre
              </button>
            </div>
          </>
        )}

        {stepKey === 'recherche' && (
          <>
            <div className="flex items-center gap-2">
              <i className="ph ph-cursor-click text-[14px] flex-shrink-0" style={{ color: selected ? 'var(--om-accent)' : 'var(--om-muted)' }} aria-hidden />
              <span className="flex-1 min-w-0 text-xs" style={{ color: selected ? 'var(--om-accent)' : 'var(--om-muted)' }}>
                {selected ? 'Argument sélectionné — applique ton verdict.' : 'Sélectionne un argument à vérifier.'}
              </span>
              {selected && (
                <button
                  type="button"
                  onClick={() => {
                    const arg = all.find((a) => a.id === selected);
                    if (arg) setEditingArg(arg);
                  }}
                  className="om-icon-btn w-[30px] h-[30px] border-[var(--om-accent)] text-[var(--om-accent)]"
                  aria-label="Modifier l'argument sélectionné"
                >
                  <i className="ph ph-pencil-simple text-[14px]" aria-hidden />
                </button>
              )}
            </div>
            <textarea
              value={research}
              onChange={(e) => setResearch(e.target.value)}
              rows={2}
              placeholder="Écrivez le résultat d'une recherche…"
              className="om-textarea resize-none"
            />
            <ChipGroup row label="Plan de discussion" items={THEMES} isActive={(t) => rPlans.includes(t)} onPick={(t) => toggleIn(rPlans, setRPlans, t)} />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => applyVerdict('verifie')}
                disabled={!selected}
                className="om-btn flex-1 min-w-0 !px-2 justify-center gap-1.5 bg-[var(--om-success-soft)] text-[var(--om-success)] border-transparent"
              >
                <i className="ph-bold ph-check text-[14px]" aria-hidden />Vérifié
              </button>
              <button
                type="button"
                onClick={() => applyVerdict('nuance')}
                disabled={!selected}
                className="om-btn flex-1 min-w-0 !px-2 justify-center gap-1.5 bg-[var(--om-nuance-soft)] text-[var(--om-nuance)] border-transparent"
              >
                <i className="ph ph-scales text-[14px]" aria-hidden />Nuance
              </button>
              <button
                type="button"
                onClick={() => applyVerdict('faux')}
                disabled={!selected}
                className="om-btn flex-1 min-w-0 !px-2 justify-center gap-1.5 bg-[var(--om-danger-soft)] text-[var(--om-danger)] border-transparent"
              >
                <i className="ph ph-x text-[14px]" aria-hidden />Faux
              </button>
            </div>
          </>
        )}

        {stepKey === 'relecture' && (
          <>
            <div className="flex items-center justify-center gap-4">
              <span className="text-xs font-medium tabular-nums" style={{ color: 'var(--om-success)' }}>
                {tallies.verifie} vérifié{tallies.verifie > 1 ? 's' : ''}
              </span>
              <span className="text-xs font-medium tabular-nums" style={{ color: 'var(--om-nuance)' }}>
                {tallies.nuance} à nuancer
              </span>
              <span className="text-xs font-medium tabular-nums" style={{ color: 'var(--om-danger)' }}>
                {tallies.faux} écarté{tallies.faux > 1 ? 's' : ''}
              </span>
            </div>
            {/* Flèche calée à droite, hors du flux : le libellé reste centré. */}
            <button type="button" onClick={() => goStep(Math.min(step + 1, 4))} className="om-btn om-btn-primary w-full justify-center relative">
              <i className="ph ph-microphone text-[17px]" aria-hidden />Passer à l&apos;oral
              <i className="ph ph-arrow-right absolute right-5 text-[16px]" aria-hidden />
            </button>
          </>
        )}

        {stepKey === 'oral' && (
          <>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setRecording((r) => !r)}
                className="w-12 h-12 flex-shrink-0 rounded-full border inline-flex items-center justify-center"
                style={{
                  borderColor: 'var(--om-accent)',
                  background: recording ? 'var(--om-accent)' : 'transparent',
                  color: recording ? 'var(--om-on-accent)' : 'var(--om-accent)',
                }}
                aria-label="Basculer l'explication orale"
              >
                <i className="ph-fill ph-microphone text-[20px]" aria-hidden />
              </button>
              <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                <span className="text-sm font-medium text-[var(--om-text)]">{recording ? 'Explication en cours…' : 'Explique à voix haute'}</span>
                <span className="text-xs text-[var(--om-muted)]">
                  {recording ? 'Appuie pour arrêter quand tu as terminé.' : 'Une minute suffit pour savoir si tu as compris.'}
                </span>
              </div>
            </div>
            <button type="button" onClick={() => goStep(Math.min(step + 1, 4))} className="om-btn om-btn-primary w-full justify-center relative">
              <i className="ph ph-lightbulb-filament text-[17px]" aria-hidden />Construire mon opinion
              <i className="ph ph-arrow-right absolute right-5 text-[16px]" aria-hidden />
            </button>
          </>
        )}

        {stepKey === 'opinion' && (
          <>
            <textarea
              value={opinion}
              onChange={(e) => setOpinion(e.target.value)}
              rows={3}
              placeholder="Je suis pour/contre principalement parce que…"
              className="om-textarea resize-none"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSide('pour')}
                className="om-btn flex-1 min-w-0 !px-2 justify-center gap-1.5 border"
                style={{
                  borderColor: 'var(--om-pour)',
                  background: side === 'pour' ? 'var(--om-pour)' : 'var(--om-pour-soft)',
                  color: side === 'pour' ? 'var(--om-on-accent)' : 'var(--om-pour)',
                  opacity: side && side !== 'pour' ? 0.45 : 1,
                }}
              >
                <i className="ph ph-thumbs-up text-[15px]" aria-hidden />Pour
              </button>
              <button
                type="button"
                onClick={() => setSide('nuance')}
                className="om-btn flex-1 min-w-0 !px-2 justify-center gap-1.5 border"
                style={{
                  borderColor: 'var(--om-nuance)',
                  background: side === 'nuance' ? 'var(--om-nuance)' : 'var(--om-nuance-soft)',
                  color: side === 'nuance' ? 'var(--om-on-accent)' : 'var(--om-nuance)',
                  opacity: side && side !== 'nuance' ? 0.45 : 1,
                }}
              >
                <i className="ph ph-scales text-[15px]" aria-hidden />Nuance
              </button>
              <button
                type="button"
                onClick={() => setSide('contre')}
                className="om-btn flex-1 min-w-0 !px-2 justify-center gap-1.5 border"
                style={{
                  borderColor: 'var(--om-contre)',
                  background: side === 'contre' ? 'var(--om-contre)' : 'var(--om-contre-soft)',
                  color: side === 'contre' ? 'var(--om-on-accent)' : 'var(--om-contre)',
                  opacity: side && side !== 'contre' ? 0.45 : 1,
                }}
              >
                <i className="ph ph-thumbs-down text-[15px]" aria-hidden />Contre
              </button>
            </div>
            <button
              type="button"
              onClick={handleFinish}
              disabled={!side || !opinion.trim()}
              className="om-btn om-btn-primary w-full justify-center"
            >
              <i className="ph-bold ph-check text-[16px]" aria-hidden />Valider mon avis
            </button>
          </>
        )}
        </div>
      </div>

      {showTimer && <TimerModal onClose={() => setShowTimer(false)} />}
      {showSrc && (
        <SourceModal
          initial={curSource}
          onSave={(v) => {
            setCurSource(v);
            setShowSrc(false);
          }}
          onClose={() => setShowSrc(false)}
        />
      )}
      {editingArg && (
        <EditArgumentModal
          arg={editingArg}
          showVerdict={showRing}
          onSave={async (payload) => {
            await onUpdateArgument(editingArg.id, payload);
            setEditingArg(null);
          }}
          onDelete={async () => {
            await onDeleteArgument(editingArg.id);
            setSelected(null);
            setEditingArg(null);
          }}
          onClose={() => setEditingArg(null)}
        />
      )}
    </div>
  );
}

function DebateDone({ node, onBack, onReplay }) {
  const all = node.arguments || [];
  const tallies = {
    verifie: all.filter((a) => a.verdict === 'verifie').length,
    nuance: all.filter((a) => a.verdict === 'nuance').length,
    faux: all.filter((a) => a.verdict === 'faux').length,
  };
  const side = node.side;
  const finalLabel = side === 'contre' ? 'Plutôt contre' : side === 'nuance' ? 'Position nuancée' : 'Plutôt pour';
  const finalIcon = side === 'contre' ? 'ph ph-thumbs-down' : side === 'nuance' ? 'ph ph-scales' : 'ph ph-thumbs-up';
  const finalBg = side === 'contre' ? 'var(--om-contre-soft)' : side === 'nuance' ? 'var(--om-nuance-soft)' : 'var(--om-pour-soft)';
  const finalColor = side === 'contre' ? 'var(--om-contre)' : side === 'nuance' ? 'var(--om-nuance)' : 'var(--om-pour)';

  return (
    <div className="flex flex-col gap-5 max-w-lg mx-auto">
      <div className="flex flex-col items-center gap-3 text-center pt-4">
        <span className="relative w-[70px] h-[70px] inline-flex items-center justify-center rounded-full border border-[var(--om-accent)] text-[var(--om-accent)]">
          <i className="ph-bold ph-check text-[28px]" aria-hidden />
        </span>
        <span className="om-kicker">Avis forgé</span>
        <h1 className="text-lg font-medium tracking-[-0.02em] text-[var(--om-text)]">{node.title}</h1>
        <span className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium" style={{ background: finalBg, color: finalColor }}>
          <i className={finalIcon} style={{ fontSize: 15 }} aria-hidden />
          {finalLabel}
        </span>
      </div>

      <div className="om-card p-4 flex flex-col gap-2">
        <span className="om-label">Ce que je retiens</span>
        <p className="text-sm leading-relaxed text-[var(--om-text)]">{node.opinion || 'Aucune conclusion écrite.'}</p>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {[
          { value: all.length, label: 'Captés', color: 'var(--om-text)' },
          { value: tallies.verifie, label: 'Vérifiés', color: 'var(--om-success)' },
          { value: tallies.nuance, label: 'Nuancés', color: 'var(--om-nuance)' },
          { value: tallies.faux, label: 'Écartés', color: 'var(--om-danger)' },
        ].map((s) => (
          <div key={s.label} className="om-card-sm flex flex-col items-center gap-1 py-3 px-2">
            <span className="text-xl font-medium tabular-nums" style={{ color: s.color }}>
              {s.value}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-[var(--om-muted)] text-center">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="om-card p-4 flex flex-col gap-3">
        <span className="om-label">Les cinq étapes</span>
        {STEPS.map((s) => (
          <div key={s.key} className="flex items-center gap-2.5">
            <span className="w-[22px] h-[22px] flex-shrink-0 rounded-full bg-[var(--om-accent-soft)] text-[var(--om-accent)] inline-flex items-center justify-center">
              <i className="ph-bold ph-check text-[12px]" aria-hidden />
            </span>
            <span className="flex-1 min-w-0 text-sm text-[var(--om-text)]">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2.5">
        <button type="button" onClick={onBack} className="om-btn om-btn-primary w-full justify-center">
          Retour au débat
        </button>
        <button type="button" onClick={onReplay} className="om-btn om-btn-ghost w-full justify-center">
          Revoir les arguments
        </button>
      </div>
    </div>
  );
}

function Debat() {
  const navigate = useNavigate();
  const { debateId } = useParams();
  const loaderData = useLoaderData();
  const isDemo = useDemoMode();
  const basePath = useDemoBasePath();

  const { debates: initialDebates = [], debate: initialDebate } = loaderData || {};
  const [debates, setDebates] = useState(initialDebates);
  const [debate, setDebate] = useState(initialDebate);
  const [screen, setScreen] = useState('detail');
  const [activeNodeId, setActiveNodeId] = useState(null);

  useEffect(() => {
    setDebates(initialDebates);
  }, [initialDebates]);
  useEffect(() => {
    setDebate(initialDebate);
    setScreen('detail');
    setActiveNodeId(null);
  }, [initialDebate]);

  const api = useMemo(
    () =>
      isDemo
        ? {
            fetchDebates: fetchDemoDebates,
            fetchDebate: fetchDemoDebate,
            createDebate: createDemoDebate,
            updateDebate: updateDemoDebate,
            deleteDebate: deleteDemoDebate,
            createDebateNode: createDemoDebateNode,
            updateDebateNode: updateDemoDebateNode,
            deleteDebateNode: deleteDemoDebateNode,
            createDebateArgument: createDemoDebateArgument,
            updateDebateArgument: updateDemoDebateArgument,
            deleteDebateArgument: deleteDemoDebateArgument,
          }
        : {
            fetchDebates,
            fetchDebate,
            createDebate,
            updateDebate,
            deleteDebate,
            createDebateNode,
            updateDebateNode,
            deleteDebateNode,
            createDebateArgument,
            updateDebateArgument,
            deleteDebateArgument,
          },
    [isDemo]
  );

  const goToList = () => navigate(`${basePath}/productivite/debat`);
  const goToDebate = (id) => navigate(`${basePath}/productivite/debat/${id}`);

  const handleCreateDebate = async ({ title, question }) => {
    const created = await api.createDebate({ title, question });
    setDebates((d) => [created, ...d]);
    goToDebate(created.id);
  };

  const handleDeleteDebateById = async (id) => {
    await api.deleteDebate(id);
    setDebates((d) => d.filter((x) => String(x.id) !== String(id)));
    if (debate && String(debate.id) === String(id)) goToList();
  };

  const handleDeleteDebate = () => handleDeleteDebateById(debate.id);

  const handleUpdateDesc = async (partial) => {
    const updated = await api.updateDebate(debate.id, { desc: { ...debate.desc, ...partial } });
    setDebate((d) => ({ ...d, desc: updated?.desc || { ...d.desc, ...partial } }));
  };

  const handleCreateSub = async (title) => {
    const node = await api.createDebateNode(debate.id, title);
    setDebate((d) => ({ ...d, subs: [...(d.subs || []), { ...node, arguments: node.arguments || [] }] }));
  };

  const handleDeleteSub = async (nodeId) => {
    await api.deleteDebateNode(nodeId);
    setDebate((d) => (d ? { ...d, subs: (d.subs || []).filter((n) => String(n.id) !== String(nodeId)) } : d));
    if (activeNodeId && String(activeNodeId) === String(nodeId)) {
      setActiveNodeId(null);
      setScreen('detail');
    }
  };

  const findActiveNode = (d) => {
    if (!d || !activeNodeId) return null;
    if (String(d.general?.id) === String(activeNodeId)) return d.general;
    return (d.subs || []).find((n) => String(n.id) === String(activeNodeId)) || null;
  };

  const patchNode = (nodeId, patch) => {
    setDebate((d) => {
      if (!d) return d;
      if (String(d.general?.id) === String(nodeId)) {
        return { ...d, general: { ...d.general, ...patch } };
      }
      return {
        ...d,
        subs: (d.subs || []).map((n) => (String(n.id) === String(nodeId) ? { ...n, ...patch } : n)),
      };
    });
  };

  const handleGoStep = async (i) => {
    if (!activeNodeId) return;
    const node = findActiveNode(debate);
    if (!node || i <= node.step_done) return;
    const updated = await api.updateDebateNode(activeNodeId, { step_done: i });
    patchNode(activeNodeId, { step_done: updated?.step_done ?? i });
  };

  const handleAddArgument = async (payload) => {
    const arg = await api.createDebateArgument(activeNodeId, payload);
    setDebate((d) => {
      const applyTo = (node) =>
        String(node.id) === String(activeNodeId)
          ? { ...node, step_done: Math.max(node.step_done, 1), arguments: [...(node.arguments || []), arg] }
          : node;
      if (!d) return d;
      return {
        ...d,
        general: d.general ? applyTo(d.general) : d.general,
        subs: (d.subs || []).map(applyTo),
      };
    });
  };

  const patchArgument = (argumentId, patch) => {
    setDebate((d) => {
      if (!d) return d;
      const applyTo = (node) => ({
        ...node,
        arguments: (node.arguments || []).map((a) => (String(a.id) === String(argumentId) ? { ...a, ...patch } : a)),
      });
      return {
        ...d,
        general: d.general ? applyTo(d.general) : d.general,
        subs: (d.subs || []).map(applyTo),
      };
    });
  };

  const handleUpdateArgument = async (argumentId, payload) => {
    const updated = await api.updateDebateArgument(argumentId, payload);
    patchArgument(argumentId, updated || payload);
  };

  const handleDeleteArgument = async (argumentId) => {
    await api.deleteDebateArgument(argumentId);
    setDebate((d) => {
      if (!d) return d;
      const applyTo = (node) => ({
        ...node,
        arguments: (node.arguments || []).filter((a) => String(a.id) !== String(argumentId)),
      });
      return {
        ...d,
        general: d.general ? applyTo(d.general) : d.general,
        subs: (d.subs || []).map(applyTo),
      };
    });
  };

  const handleFinish = async ({ side, opinion }) => {
    const updated = await api.updateDebateNode(activeNodeId, { side, opinion, step_done: 5 });
    patchNode(activeNodeId, { side: updated?.side ?? side, opinion: updated?.opinion ?? opinion, step_done: 5 });
    setScreen('done');
  };

  if (!debateId) {
    return (
      <div className="px-4 md:px-6 lg:px-8 pt-1 pb-6 max-w-3xl mx-auto">
        <DebateList debates={debates} onCreate={handleCreateDebate} onOpen={goToDebate} onDeleteDebate={handleDeleteDebateById} />
      </div>
    );
  }

  if (!debate) {
    return (
      <div className="px-4 md:px-6 lg:px-8 pt-1 pb-6 max-w-3xl mx-auto">
        <button type="button" onClick={goToList} className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--om-accent)] mb-4">
          <i className="ph ph-arrow-left text-[14px]" aria-hidden />Retour aux débats
        </button>
        <div className="om-card-dashed text-center py-10 px-4">
          <p className="text-sm text-[var(--om-text)]">Débat introuvable.</p>
        </div>
      </div>
    );
  }

  const activeNode = findActiveNode(debate);

  return (
    <div className="px-4 md:px-6 lg:px-8 pt-1 pb-6 max-w-3xl mx-auto">
      {screen === 'detail' && (
        <DebateDetail
          debate={debate}
          onBack={goToList}
          onOpenNode={(node) => {
            setActiveNodeId(node.id);
            setScreen('steps');
          }}
          onCreateSub={handleCreateSub}
          onUpdateDesc={handleUpdateDesc}
          onDelete={handleDeleteDebate}
          onDeleteSub={handleDeleteSub}
        />
      )}
      {screen === 'steps' && activeNode && (
        <DebateSteps
          key={activeNode.id}
          node={activeNode}
          onBack={() => setScreen('detail')}
          onGoStep={handleGoStep}
          onAddArgument={handleAddArgument}
          onUpdateArgument={handleUpdateArgument}
          onDeleteArgument={handleDeleteArgument}
          onFinish={handleFinish}
        />
      )}
      {screen === 'done' && activeNode && (
        <DebateDone node={activeNode} onBack={() => setScreen('detail')} onReplay={() => setScreen('steps')} />
      )}
    </div>
  );
}

export default Debat;

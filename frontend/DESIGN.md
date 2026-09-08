# Nocturne — système de design LvlRise

Toutes les pages suivent ces conventions. Tout est défini dans `src/index.css`.

## Thèmes

Deux thèmes, portés par `data-theme` sur `<html>` : `dark` (défaut) et `light`.
Le choix est persisté dans `localStorage` sous `lvlrise-theme`, appliqué avant le
premier paint par un script inline dans `index.html` (pas de flash), et exposé par
`useTheme()` (`src/hooks/useTheme.jsx`). Il se change depuis le menu mobile et
depuis Paramètres → Apparence.

## Tokens

N'écrivez jamais une couleur en dur. Utilisez ces variables :

| Token | Rôle |
| --- | --- |
| `--om-bg` | fond de page |
| `--om-surface` | carte, dock, panneau de modale |
| `--om-surface-2` | surface enfoncée : champ, tuile, ligne de menu survolée |
| `--om-text` / `--om-muted` | texte principal / secondaire |
| `--om-line` | filet de 1px |
| `--om-track` | piste d'une jauge ou d'un anneau |
| `--om-accent` / `--om-accent-hover` / `--om-accent-soft` | accent, son survol, son fond |
| `--om-on-accent` | texte posé sur un aplat d'accent |
| `--om-perso` / `--om-pro` / `--om-pro-strong` | les deux séries perso/pro ; `-strong` quand c'est du texte |
| `--om-shadow` / `--om-shadow-lg` | ombres |
| `--om-scrim` / `--om-scrim-solid` | voiles de modale |
| `--om-danger`, `--om-success`, `--om-warning` (+ `-soft`, `-strong`) | états uniquement |
| `--om-tag-*` | priorités des tâches (`src/lib/tags.js`) |

Les anciens noms (`--accent`, `--border`, `--text-primary`, …) restent des alias
vers ces tokens : le code existant hérite du thème sans réécriture. Les nouveaux
écrans utilisent directement le vocabulaire `--om-*`.

## Une seule famille chromatique

Le violet porte toute l'interface. Perso et Pro sont deux **valeurs** de cette
famille, jamais deux teintes. Rouge, vert et ambre ne servent qu'à signaler un
état (erreur, succès, avertissement) — jamais à décorer ni à catégoriser. Seule
exception assumée : « urgence absolue » sort de la famille, parce qu'une urgence
doit se lire d'un coup d'œil.

## Formes et échelle

- **Cartes** : rayon 20 px (`.om-card`) ou 16 px (`.om-card-sm`), fond `--om-surface`,
  `--om-shadow`, **pas de bordure**. `.om-card-outline` quand un filet est nécessaire.
- **Contrôles** : pilules (`border-radius: 999px`). Champs et lignes de menu : 10 px.
- **Graisses** : 500 au maximum. La hiérarchie vient du kicker, de la taille et de
  la couleur — pas du gras.
- **Kicker** (`.om-kicker`) : 11 px, capitales, interlettrage `.1em`, `--om-muted`.
  C'est lui qui titre les cartes, pas un `<h3>` en gras.
- **Chiffres** : `.om-metric` (500, `-0.03em`, `tabular-nums`).

## Primitives disponibles

`.om-card` `.om-card-sm` `.om-card-outline` `.om-card-quiet` `.om-card-dashed`
`.om-halo` `.om-kicker` `.om-title` `.om-metric`
`.om-btn` + `.om-btn-primary` / `-solid` / `-ghost` / `-quiet` / `-danger`
`.om-icon-btn` (+ `.om-icon-btn-accent`) `.om-segment` `.om-segment-quiet`
`.om-segment-item[data-active]` `.om-chip[data-active]`
`.om-input` `.om-label` `.om-track` `.om-fill`
`.om-dock` `.om-dock-item[data-active]` `.om-dock-center` `.om-dock-fade`
`.om-scrim` `.om-sep`

Animations : `om-pop` (entrée de modale), `om-breathe` (halo), `om-rise`, `om-ring`.

## Icônes

Phosphor (`@phosphor-icons/web`), importé dans `main.jsx`. Contour par défaut
(`ph ph-…`), plein pour l'état actif (`ph-fill ph-…`), `ph-bold` pour les coches.

## Navigation

- **Mobile** : en-tête avec l'avatar et le prénom, puis dock bas (`AppDock`) —
  Vue · Cartes · [cerveau] · Routines · To do. Le cerveau sert d'accès rapide
  aux trois modules.
- **Desktop** : navigation dans l'en-tête, cerveau en bouton flottant.
- Les pages réservent `pb-28` sur mobile pour que rien ne passe sous le dock.

## Gouttière de page

`px-4 md:px-6 lg:px-8 pt-1 pb-6`, titre à gauche (17/19 px) avec une ligne de
contexte en dessous — pas de gros titre centré.

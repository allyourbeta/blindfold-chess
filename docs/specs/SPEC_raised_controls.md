# SPEC_raised_controls.md — one raised control style, app-wide

Written 2026-10-23 00:05 PT by Claude (planner). Executor: Claude Code. One phase, one commit.
Visual target: `docs/targets/raised-controls.html` (approved by Ashish). Match it.
Design reference: the design-language skill's raised-control rule ("light from above": darker bottom edge + subtle top-light gradient, one border, one shadow, two radii). Read `~/.claude/skills/design-language/SKILL.md` if present; this spec wins where they differ.

## What Ashish will SEE change
1. Every button and toggle on every screen looks raised: soft top-to-bottom shading, 1px border, a 2px darker bottom edge, a faint shadow.
2. Two fills only. OFF / secondary = warm stone. ON / selected / primary = amber. Destructive (Remove) = the existing danger red, same construction.
3. One corner radius (12px, `rounded-xl`) for every rectangular control. Pills (Menu/Back) stay fully round. `big` and `random` sizes drop from `rounded-2xl` to `rounded-xl`.
4. An unselected segment (e.g. "Black") now looks exactly like Reset. Selected segments, selected palette pieces and "on" castling toggles look exactly like a primary button.
5. Pressed state: the button moves down 1px and the bottom edge thins to 1px (feels pushed).
6. Dark mode gets the same construction with dark-theme colours.
7. UNCHANGED: sizes, labels, layout, positions, the board, list rows and cards in the Endgame Lab (they stay cards), icon-only header controls (theme toggle, favorite star) stay flat icons.

## Environment facts checked (source zip 2026-10-22 23:42)
- `src/components/ui/Button.tsx`: cva; variants `primary` (`bg-bg-primary … shadow-sm`), `secondary` (`bg-bg-surface-alt … border border-border-emphasis`), `destructive`, `ghost`; sizes `default/sm/chooser/icon/keypadPiece/keypadKey/keypadRow` (rounded-xl), `big` and `random` (rounded-2xl). Base string includes `disabled:opacity-50`.
- `src/components/ui/SegmentedControl.tsx:28-32`: own classes, selected `bg-bg-primary`, unselected `bg-bg-surface border-border-default`.
- Raw `<button>`s outside Button: `SetupBoard.tsx` (palette, `rounded-lg`), `BoardPanel.tsx` (rotate "White's view"), `SetupScreen.tsx` (Menu pill, castling toggles ~line 223), `MenuScreen.tsx` (theme toggle, settings chips), `GameSettingsPanel.tsx`, `PlayScreen.tsx`, `EndgamesHome.tsx` (Favorites/size rows — cards), `EndgameCard.tsx` (cards), `EndgamesPosition.tsx` (star), `EndgamesHeader.tsx` (pill). `src/maia-spike/` is a dev page: leave it.
- Theme: `src/index.css` — `@theme` tokens (`--color-bg-surface-alt: #efe9df`, `--color-bg-primary: var(--color-amber-500)`, `--color-border-emphasis: var(--color-stone-300)`), dark overrides under `:root.dark` (line 96), `@layer base` at 122, `@custom-variant dark`.
- `PHONE_USABLE` in `tests/e2e/helpers.ts`. `public/sw.js:3` `CACHE_NAME = 'blindfold-chess-v66'`.

## Implementation (decided)
1. **Tokens** in `src/index.css`, light and `:root.dark`: `--raised-off-top`, `--raised-off-bottom`, `--raised-off-border`, `--raised-off-edge`, `--raised-on-top`, `--raised-on-bottom`, `--raised-on-border`, `--raised-on-edge`, `--raised-danger-*` (same four), `--raised-shadow`. Light values from the target; dark values: same hues darker (off ≈ `#3a332d`→`#2b2622`, edge `#1c1814`; on keeps amber, edge darker). No hex outside index.css.
2. **Three classes** in `@layer components`: `.raised` (off), `.raised-on` (on/primary), `.raised-danger`. Each: `background: linear-gradient(top, bottom)`, `border: 1px solid border`, `border-bottom: 2px solid edge`, `box-shadow: var(--raised-shadow)`, `rounded-xl` not included (radius stays in size variants). `:active:not(:disabled)` → `translate-y: 1px; border-bottom-width: 1px`. Hover → slightly lighter gradient (one step), same construction.
3. **Button.tsx**: `primary` → `raised-on text-text-on-primary`; `secondary` → `raised text-text-primary`; `destructive` → `raised-danger text-text-on-dark`; `ghost` unchanged. `big`/`random` radius → `rounded-xl`. Keep all sizes' heights.
4. **SegmentedControl**: selected → `raised-on`, unselected → `raised`. Remove its own bg/border classes.
5. **Raw buttons**: palette pieces (selected `raised-on`, else `raised`, `rounded-xl`), castling toggles (on/off), menu settings chips (`raised`), Menu/Back pills (`raised`, keep `rounded-full`), BoardPanel rotate ("White's view") → `raised`, anything in `GameSettingsPanel`/`PlayScreen` that is a control → `raised`/`raised-on` as appropriate.
6. **Explicitly flat**, marked with `data-flat="<reason>"`: board squares (`square`), Endgame Lab list rows and `EndgameCard` (`card`), theme toggle and favorite star (`icon`), the move-ticker toggle if it's a button (`ticker`). Nothing else may be flat.
7. Do not change any height, padding, label, or layout.

## The mechanical check (checklist rule 11 — the rule becomes a test)
New `tests/e2e/raised-controls.spec.ts`, chromium, at `PHONE_USABLE`, light AND dark mode. Visit: menu (settings open), setup, play (after one move, More menu open), game-over panel (resign), lab home, a size list, a position. On each, every visible `button` must either:
- have computed `border-bottom-width` = 2px AND a `background-image` containing `linear-gradient`, or
- carry `data-flat` with one of: `square`, `card`, `icon`, `ticker`.
Print offenders as `screen: label (classes)`. Must be red on old code (expect most buttons), green after.
Also a unit/grep check in the same spec or `npm run lint` script: no file in `src/` (except `index.css` and `maia-spike/`) contains `rounded-2xl` on a button, and `SegmentedControl.tsx` contains no `bg-bg-surface`.

## Other tests
- Existing `button-fit`, `endgames-tap-targets`, `play-layout` must stay green unchanged (no size changes allowed).
- Screenshot setup, menu, play, lab position at `PHONE_USABLE` in light and dark; compare setup (light) to the target.

## Housekeeping
- `CACHE_NAME` → `blindfold-chess-v67`.
- `CLAUDE.md`: one line under design — "Every control uses `.raised` / `.raised-on` / `.raised-danger` (via Button or SegmentedControl). A button that must be flat carries `data-flat`; `raised-controls.spec.ts` enforces it."
- `tenzing backlog add blindfold-chess "One raised control style app-wide"` at start, `done` in the commit. If Tenzing fails, note it and continue.

## Tiers
- `raised-controls.spec.ts` red then green; `button-fit`, `endgames-tap-targets`, `play-layout`, `setup-position` once. Run `npm run build` before targeted Playwright runs.
- Full `npm run test:all` once at the end.

## Done means
- One commit, `git add -A`, no push. Revert incidental `qa/*.png` changes.
- Report: start/end SHA; offender count on old code; every element given `data-flat` and why; full-suite counts; the screenshots.
- UNVERIFIED: real iPhone, both themes.

## Pre-answered
- Make cards/list rows raised too? No. They stay cards.
- Make icon-only header buttons raised? No. `data-flat="icon"`.
- Change keypad key sizes while you're there? No.
- The keypadRow 36px issue? Out of scope; leave it.
- A control you can't classify? Make it raised, and list it in the report.
- A failure this change can't touch? Report it with output. Never call it stale.

# SPEC_final_polish.md — text contrast, taller O-O/O-O-O/delete keys, in-app creator unlock

Written 2026-10-23 15:10 PT by Claude (planner). Executor: Claude Code. One phase, one commit.
This is the last planned round for this app. Keep it exactly in scope.

## NO QUESTIONS
Never stop to ask. Take the defaults named here; where none is named, take the simplest option that keeps current behaviour, and log it. Never `git push`, never deploy. If `tenzing` fails, skip it and list the commands in the report.

## What Ashish will SEE change
1. **Text contrast (approved mockup, light mode):** amber text one shade darker (`amber-600` #d97706 → `amber-700` #b45309): titles ("Endgame Lab", "Position Setup", "BLINDFOLDE", "Blindfolde"), the status line, accent messages in the log. Grey helper text one shade darker (`stone-400` #a8a29e → `stone-500` #78716c): setting explanations, counts, codes like E283, the build line, "No moves yet". Amber BUTTONS do not change.
2. **Dark mode:** grey helper text one shade lighter (`stone-500` → `stone-400`), so it passes too. Nothing else in dark mode changes unless the check below still fails (then see Pre-answered).
3. **Game keypad, portrait only:** O-O, O-O-O and the delete key grow from 36px to 44px tall. The message log gives up those 8px. Landscape (`shortscape`) unchanged.
4. **Hidden creator unlock:** tapping the build line at the bottom of the menu 5 times within 3 seconds opens the same password prompt as `#creator` (or, if already unlocked, the same "Lock this device?" confirm). Nothing visible changes for anyone.

## Environment facts checked (source zip 2026-10-23 14:38, HEAD 73d63b9)
- Tokens, `src/index.css`: light `--color-text-muted: var(--color-stone-400)` (67), `--color-text-accent: var(--color-amber-600)` (68); dark (`:root.dark`) `--color-text-secondary: var(--color-stone-400)` (131), `--color-text-muted: var(--color-stone-500)` (132). `--color-bg-primary-hover: var(--color-amber-600)` (60) — a button token, leave it. Palette: `stone-400 #a8a29e`, `stone-500 #78716c`, `stone-600 #57534e`, `amber-600 #d97706`, `amber-700 #b45309`.
- Audit: contrast is check F in `tests/e2e/auditChecks.ts:118-119` / `auditChecksDom.ts:181-245`; currently reported as non-blocking ("Needs Ashish", 1553 findings in `docs/AUDIT_FINDINGS.md`, all F).
- Keys: `src/components/ui/Button.tsx:52` `keypadRow: "h-9 whitespace-nowrap rounded-xl px-2 text-base"`. Audit height exemption: `tests/e2e/auditChecks.ts:42-47,82` `SIZE_36_LABELS = new Set(["O-O", "O-O-O", "Undo last entry"])`.
- Creator unlock: `src/App.tsx:43-63` `handleCreatorHash` (prompt, `useCreator.getState().unlock`, confirm-to-lock). Build line: `src/components/screens/MenuScreen.tsx:246` `<p className="mt-auto pt-4 text-center text-sm text-text-muted">build … · …</p>`.
- Raised check allows `data-flat` reasons `["square", "card", "icon", "ticker"]` (`tests/e2e/raised-controls.spec.ts:11`).
- `play-layout.spec.ts` asserts the log ≥ 3 lines at `PHONE_USABLE`.
- `public/sw.js:3` `CACHE_NAME = 'blindfold-chess-v69'`.

## Implementation (decided)
1. **Contrast:** change the three token lines above to the new steps. No component edits for colour. Then make audit check F **blocking** (same as A–E): any F finding fails the walk. Keep the existing board-label exemption.
2. **Keys:** `keypadRow` → `"h-11 shortscape:h-9 whitespace-nowrap rounded-xl px-2 text-base"`. In `auditChecks.ts`, drop the unconditional 36px floor for those three labels; they get 36px only under `shortscape` (the existing shortscape rule already covers it). Keep the ticker's 36px exemption.
3. **Unlock:** extract the body of `handleCreatorHash` into `promptCreatorUnlock()` (exported from a small module, e.g. `src/state/creatorPrompt.ts`); the hash handler calls it. In `MenuScreen`, render the build line as a `<button type="button" data-flat="stamp">` with the same text and text classes plus `min-h-11 w-full` (44px hit box), no visible button styling, `aria-label` omitted (its text is its label). Count taps: 5 within 3000 ms → `promptCreatorUnlock()`, then reset. Add `"stamp"` to `ALLOWED_FLAT`.

## Tests (write first, red on old code — checklist rule 5)
1. Audit walk: all viewports/themes pass with F blocking. Red on old code (F findings), green after. Update `docs/AUDIT_FINDINGS.md` to show zero.
2. Keys: at `PHONE_USABLE`, O-O, O-O-O, "Undo last entry" heights ≥ 44px; at 742×393 landscape they are still 36px. `play-layout.spec.ts` stays green (log ≥ 3 lines). Red first.
3. Unlock (chromium, real taps): stub `window.prompt` via `page.addInitScript` to record calls and return null. Tap the build line 4 times → no prompt. Tap 5 times quickly → prompt called once. Tap 5 times spread over 4 s → no prompt. `#creator` still works (existing test, or add one).
4. `raised-controls`, `button-fit`, `endgames-tap-targets` stay green.

## Housekeeping
- `CACHE_NAME` → `blindfold-chess-v70`.
- `CLAUDE.md`: under the creator section, one line: "Unlock on any device, including the installed app: tap the build line on the menu 5 times."
- `tenzing backlog add blindfold-chess "Final polish: contrast, keypad row height, in-app unlock"` at start, `done` in the commit.

## Tiers
- Targeted: `audit-walk`, `play-layout`, new unlock test, `raised-controls`. `npm run build` before each targeted run.
- Full `npm run test:all` once at the end.

## Done means
- One commit, `git add -A`, no push, clean tree. Revert incidental `qa/*.png` changes.
- Report: start/end SHA; F findings before/after; any token that needed a second step and why; key heights before/after; full-suite counts.
- UNVERIFIED: real iPhone.

## Pre-answered
- A text pair still fails after the token change (e.g. accent on the beige `bg-surface-alt`)? Move that token one more step in the same palette (`amber-800`, `stone-600`; dark: `stone-300`) and re-run. Never introduce a new hue. List it in the report.
- A failure on white text over amber (primary buttons)? `text-on-primary` is stone-900 already; if anything still fails, report it, don't recolour buttons.
- Log falls below 3 lines somewhere after the key change? Keep the keys at 44px and report the viewport; do not shrink anything else.
- A failure this change can't touch? Report it with output. Never call it stale.

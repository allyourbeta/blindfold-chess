# Kickoff prompt — Blindfold Chess Phase 1

Run from the project root:

```
claude --model claude-sonnet-5 --dangerously-skip-permissions
```

Then paste:

---

Read SPEC_phase1_port.md in full before writing any code.

Then read public/index.html end to end. It is the entire current app and the
source of truth for existing behaviour. Several behaviours in it are
deliberate bug fixes that are easy to destroy by accident; the spec lists
them.

Work through the spec in order. Do not skip Section 0.

Rules, restated because they are non-negotiable:

- No file over 300 lines.
- Components hold no game logic. Services are pure functions with no React,
  no window, no localStorage.
- localStorage is touched in exactly one file.
- Do not add a runtime dependency that is not named in the spec without
  asking first.
- Do not implement Maia or any second engine. That is Phase 2.
- Do not add a backend, a database, or any login.

Prefer scripted solutions over manual steps throughout. If something can be
generated, generate it.

Work against the acceptance checklist in Section 11 and do not report done
until every box holds.

After changes: npm run test:all

---

## Overnight variant

```
caffeinate -dis claude --model claude-sonnet-5 --dangerously-skip-permissions
```

Plug in, lid open.

Resume a dead run:

```
claude --continue --model claude-sonnet-5 --dangerously-skip-permissions
```

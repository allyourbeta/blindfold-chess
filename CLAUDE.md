# blindfold-chess

## Backlog format (read by Tenzing)

`docs/BACKLOG.md` is read by Tenzing, so its format is a contract.

- Every backlog item is a markdown task-list line ending with a permanent ID:
  `- [ ] Some item ^bc-1a2b3c`
- The ID is `^` + this project's two-letter prefix + `-` + SIX lowercase
  base32 chars (a-z, 2-7). This project's prefix is: `bc`
- When you ADD an item, generate a new ID and append it. Check the file first;
  IDs must be unique within the repo.
- When you EDIT an item, keep its ID unchanged. Rewording is fine.
- When you COMPLETE an item, change `[ ]` to `[x]`. Keep the ID and the line.
- Never remove, reuse, or renumber an ID.
- Keep items at the top level of a list. Nested task items are not tracked.
- Do not add priority, estimates, or scheduling here. Those live in Tenzing.

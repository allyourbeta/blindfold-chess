import { describe, it, expect } from "vitest";
import { Chess } from "chess.js";
import {
  computeEntryState,
  PIECE_LETTERS,
  FILE_LETTERS,
  RANK_DIGITS,
  type Tap,
  type LegalMove,
  type PieceLetter,
} from "./entry";
import { useGameStore } from "@/state/gameStore";

/**
 * Property test for AUDIT.md's finding: a keypad entry that names a piece
 * and a destination the position doesn't allow for THAT piece must be
 * rejected, never silently replayed as a different piece's legal move to
 * the same square (the "bishop eats the pawn's e5" bug). The example-based
 * tests in entry.test.ts cover cases we already knew about; this covers the
 * general shape by construction instead of by memory.
 *
 * FALSIFIER: this suite goes red if, for any generated position, a
 * completed keypad entry (a) resolves to a move whose piece or destination
 * differs from what was tapped, (b) resolves to something chess.js does not
 * consider legal, (c) produces neither resolved/invalid/disambiguation/
 * promotionPending ("silently nothing"), or (d) an entry marked `invalid`
 * changes the board when submitted through the store.
 */

// Independent of entry.ts's own PIECE_CHAR map — re-derived here so a bug in
// that map (e.g. a mixed-up letter) can't cancel itself out against the
// assertion.
const EXPECTED_PIECE: Record<PieceLetter, LegalMove["piece"]> = {
  K: "k",
  Q: "q",
  R: "r",
  B: "b",
  N: "n",
  P: "p",
};

function toLegalMoves(chess: Chess): LegalMove[] {
  return chess.moves({ verbose: true }).map((m) => ({
    san: m.san,
    piece: m.piece,
    from: m.from,
    to: m.to,
    promotion: m.promotion,
  }));
}

// Deterministic PRNG (mulberry32) so the walk is reproducible across runs —
// Math.random() would make a failure here appear only sometimes.
function mulberry32(seed: number) {
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** A short random walk from the start position, seeded for reproducibility. */
function randomWalkFens(seed: number, count: number, maxPlies: number): string[] {
  const rng = mulberry32(seed);
  const fens: string[] = [];
  for (let i = 0; i < count; i++) {
    const chess = new Chess();
    const plies = 1 + Math.floor(rng() * maxPlies);
    for (let p = 0; p < plies; p++) {
      const moves = chess.moves();
      if (moves.length === 0) break;
      chess.move(moves[Math.floor(rng() * moves.length)]);
    }
    fens.push(chess.fen());
  }
  return fens;
}

function enPassantFen(): string {
  const chess = new Chess();
  for (const m of ["e4", "a6", "e5", "d5"]) chess.move(m);
  return chess.fen();
}

const FIXED_FENS = [
  // Promotion available, single pawn.
  "7k/4P3/8/8/8/8/8/4K3 w - - 0 1",
  // Promotion available, two pawns can promote onto the same square.
  "4r2k/3P1P2/8/8/8/8/8/4K3 w - - 0 1",
  // En passant available (exd6).
  enPassantFen(),
  // Both castles available.
  "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1",
  // Two knights able to reach one square (standard SAN disambiguation).
  "4k3/8/8/8/8/1N3N2/8/4K3 w - - 0 1",
  // AUDIT.md's case: bishop c3 can reach e5, pawn a2 cannot — "e5" typed
  // with the pawn key must reject, never silently play Be5.
  "4k3/8/8/8/8/2B5/P7/4K3 w - - 0 1",
];

const RANDOM_FENS = randomWalkFens(0xc0ffee, 12, 14);
const ALL_FENS = [...FIXED_FENS, ...RANDOM_FENS];

// Every piece key (incl. pawn) x every file x every rank, plus both castles.
function allCompletedEntries(): Tap[][] {
  const entries: Tap[][] = [];
  for (const piece of PIECE_LETTERS) {
    for (const file of FILE_LETTERS) {
      for (const rank of RANK_DIGITS) {
        entries.push([
          { kind: "piece", value: piece },
          { kind: "file", value: file },
          { kind: "rank", value: rank },
        ]);
      }
    }
  }
  entries.push([{ kind: "castle", value: "O-O" }]);
  entries.push([{ kind: "castle", value: "O-O-O" }]);
  return entries;
}

const ENTRIES = allCompletedEntries();

describe("move integrity property: every completed keypad entry resolves correctly, rejects cleanly, or keeps narrowing", () => {
  for (const fen of ALL_FENS) {
    describe(`position ${fen}`, () => {
      const chess = new Chess(fen);
      const legalSans = new Set(chess.moves());
      const legalMoves = toLegalMoves(chess);

      // Classified up front (collection phase, synchronous) so the store
      // check below doesn't depend on the per-entry `it`s below having run
      // first — vitest happens to run a file's tests in declaration order,
      // but that's not a property this test should lean on.
      const classified = ENTRIES.map((taps) => ({ taps, state: computeEntryState(legalMoves, taps) }));
      const invalidTapsFound = classified
        .filter((c) => c.state.invalid !== null)
        .map((c) => ({ taps: c.taps, san: c.state.invalid as string }));

      for (const { taps, state } of classified) {
        const label = taps.map((t) => t.value).join(",");
        it(`"${label}"`, () => {
          if (state.resolved) {
            // Resolved SAN must be one chess.js actually considers legal...
            expect(legalSans.has(state.resolved.san)).toBe(true);
            // ...for exactly the piece and destination that were tapped.
            const lastTap = taps[taps.length - 1];
            if (lastTap.kind === "castle") {
              expect(state.resolved.san).toBe(lastTap.value);
            } else {
              const pieceTap = taps[0];
              if (pieceTap.kind === "piece") {
                expect(state.resolved.piece).toBe(EXPECTED_PIECE[pieceTap.value]);
              }
              const fileTap = taps.find((t) => t.kind === "file");
              const rankTap = taps.find((t) => t.kind === "rank");
              expect(state.resolved.to).toBe(`${fileTap!.value}${rankTap!.value}`);
            }
            return;
          }

          // Not resolved: must be an explicit rejection or an explicit
          // chooser, never a silent no-op the player can't hear.
          const stillNarrowing = state.disambiguation !== null || state.promotionPending;
          expect(state.invalid !== null || stillNarrowing).toBe(true);

          if (state.invalid !== null) {
            invalidTapsFound.push({ taps, san: state.invalid });
          }
        });
      }

      // The store half: an `invalid` entry must leave the position
      // completely untouched when actually submitted, not just when
      // inspected via the pure function. Sampled (not exhaustive — most of
      // the ~390 entries per position are invalid, and a full store
      // round-trip per one would blow the "few seconds" budget) but spread
      // across the position's invalid entries rather than clustered at the
      // start.
      it("invalid entries leave the store's position untouched when submitted", () => {
        expect(invalidTapsFound.length).toBeGreaterThan(0);
        const sampleSize = Math.min(10, invalidTapsFound.length);
        const stride = Math.max(1, Math.floor(invalidTapsFound.length / sampleSize));
        for (let i = 0; i < invalidTapsFound.length; i += stride) {
          const { san } = invalidTapsFound[i];
          const fresh = new Chess(fen);
          useGameStore.setState({
            chess: fresh,
            fen: fresh.fen(),
            turn: fresh.turn(),
            playerColor: fresh.turn(),
            gameOverFlag: false,
          });

          useGameStore.getState().submitKeypadMove(san);

          expect(useGameStore.getState().chess.fen()).toBe(fen);
        }
      });
    });
  }
});

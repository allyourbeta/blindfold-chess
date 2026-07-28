import { describe, it, expect } from "vitest";
import { Chess } from "chess.js";
import {
  computeEntryState,
  type Tap,
  type LegalMove,
  type PieceLetter,
  type FileLetter,
  type RankDigit,
  type CastleValue,
} from "./entry";
import { interpretDualTap } from "./dual";

function legalMoves(fen?: string): LegalMove[] {
  const chess = fen ? new Chess(fen) : new Chess();
  return chess.moves({ verbose: true }).map((m) => ({
    san: m.san,
    piece: m.piece,
    from: m.from,
    to: m.to,
    promotion: m.promotion,
  }));
}

const piece = (value: PieceLetter): Tap => ({ kind: "piece", value });
const file = (value: FileLetter): Tap => ({ kind: "file", value });
const rank = (value: RankDigit): Tap => ({ kind: "rank", value });
const castle = (value: CastleValue): Tap => ({ kind: "castle", value });

describe("computeEntryState: start position", () => {
  const moves = legalMoves();

  it("enables only pieces that have a legal move, and no castle keys", () => {
    const state = computeEntryState(moves, []);
    expect(state.enabled.pieces).toEqual({ K: false, Q: false, R: false, B: false, N: true, P: true });
    expect(state.enabled.castleKingside).toBe(false);
    expect(state.enabled.castleQueenside).toBe(false);
  });

  it("disables every rank until a file has been chosen", () => {
    const state = computeEntryState(moves, []);
    for (const enabled of Object.values(state.enabled.ranks)) expect(enabled).toBe(false);

    const afterFile = computeEntryState(moves, [file("e")]);
    expect(afterFile.enabled.ranks["3"]).toBe(true);
    expect(afterFile.enabled.ranks["4"]).toBe(true);
  });

  it("shows an empty preview before any tap", () => {
    expect(computeEntryState(moves, []).preview).toBe("");
  });
});

describe("computeEntryState: pawn moves", () => {
  it("resolves e,4 to e4", () => {
    const state = computeEntryState(legalMoves(), [file("e"), rank("4")]);
    expect(state.resolved?.san).toBe("e4");
    expect(state.preview).toBe("e 4");
  });

  it("shows a live preview mid-entry", () => {
    const state = computeEntryState(legalMoves(), [file("e")]);
    expect(state.preview).toBe("e _");
    expect(state.resolved).toBeNull();
  });
});

describe("computeEntryState: piece moves", () => {
  it("NEVER completes a partial entry: piece+file waits for the rank even when unique", () => {
    // The bug this replaces: N,f auto-submitted Nf3, so "knight f4" was
    // unstateable — the app answered a move the player never made.
    const state = computeEntryState(legalMoves(), [piece("N"), file("f")]);
    expect(state.resolved).toBeNull();
    expect(state.invalid).toBeNull();
  });

  it("a completed illegal knight move is rejected, not substituted", () => {
    const state = computeEntryState(legalMoves(), [piece("N"), file("c"), rank("4")]);
    expect(state.resolved).toBeNull();
    expect(state.invalid).toBe("Nc4");
  });

  it("waits for the rank when piece+file still matches more than one legal move", () => {
    // Knight on d4 reaches two different squares in file f: f3 and f5.
    const moves = legalMoves("4k3/8/8/8/3N4/8/8/4K3 w - - 0 1");
    const afterFile = computeEntryState(moves, [piece("N"), file("f")]);
    expect(afterFile.resolved).toBeNull();
    expect(afterFile.candidates.map((c) => c.san).sort()).toEqual(["Nf3", "Nf5"]);

    const resolved = computeEntryState(moves, [piece("N"), file("f"), rank("3")]);
    expect(resolved.resolved?.san).toBe("Nf3");
  });

  it("never enables a rank that no candidate move can reach", () => {
    const moves = legalMoves("4k3/8/8/8/3N4/8/8/4K3 w - - 0 1");
    const state = computeEntryState(moves, [piece("N"), file("f")]);
    expect(state.enabled.ranks["3"]).toBe(true);
    expect(state.enabled.ranks["5"]).toBe(true);
    expect(state.enabled.ranks["7"]).toBe(false);
  });
});

describe("computeEntryState: disambiguation", () => {
  it("offers file-disambiguated labels when two knights share a destination file", () => {
    // Knights on b3 and f3 both reach d2 and d4.
    const moves = legalMoves("4k3/8/8/8/8/1N3N2/8/4K3 w - - 0 1");
    const afterFile = computeEntryState(moves, [piece("N"), file("d")]);
    expect(afterFile.resolved).toBeNull();
    expect(afterFile.disambiguation).toBeNull(); // rank not chosen yet — still narrowing, not ambiguous-and-done

    const state = computeEntryState(moves, [piece("N"), file("d"), rank("2")]);
    expect(state.resolved).toBeNull();
    expect(state.disambiguation?.slice().sort()).toEqual(["Nbd2", "Nfd2"]);
  });

  it("offers rank-disambiguated labels when two knights share a destination file and origin file", () => {
    // Knights on b1 and b3 both reach d2.
    const moves = legalMoves("4k3/8/8/8/8/1N6/8/1N2K3 w - - 0 1");
    const state = computeEntryState(moves, [piece("N"), file("d"), rank("2")]);
    expect(state.disambiguation?.slice().sort()).toEqual(["N1d2", "N3d2"]);
  });

  it("plays the tapped disambiguated move by looking it up in candidates, never constructing SAN by hand", () => {
    const moves = legalMoves("4k3/8/8/8/8/1N3N2/8/4K3 w - - 0 1");
    const state = computeEntryState(moves, [piece("N"), file("d"), rank("2")]);
    const chosen = state.candidates.find((c) => c.san === "Nbd2");
    expect(chosen?.from).toBe("b3");
  });
});

describe("computeEntryState: pawn captures by destination", () => {
  it("resolves the destination square d5 to the capture exd5 when only the e-pawn can go there", () => {
    // White pawn e4, black pawn d5 — tapping the DESTINATION names the move.
    const moves = legalMoves("rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3");
    const state = computeEntryState(moves, [file("d"), rank("5")]);
    expect(state.resolved?.san).toBe("exd5");
  });

  it("two pawns reaching one square is a standard SAN disambiguation, like two knights", () => {
    // White pawns a4 and c4, black pawn b5: axb5 or cxb5.
    const moves = legalMoves("rnbqkbnr/p1pppppp/8/1p6/P1P5/8/1P1PPPPP/RNBQKBNR w KQkq b6 0 3");
    const state = computeEntryState(moves, [file("b"), rank("5")]);
    expect(state.resolved).toBeNull();
    expect(state.disambiguation).toEqual(["axb5", "cxb5"]);
  });
});

describe("computeEntryState: promotion", () => {
  const moves = legalMoves("7k/4P3/8/8/8/8/8/4K3 w - - 0 1");

  it("sets promotionPending once the destination square is complete", () => {
    const state = computeEntryState(moves, [file("e"), rank("8")]);
    expect(state.promotionPending).toBe(true);
    expect(state.resolved).toBeNull();
    expect(state.candidates.map((c) => c.promotion).sort()).toEqual(["b", "n", "q", "r"]);
  });

  it("choosing Q plays e8=Q, carrying check exactly as chess.js emits it", () => {
    const state = computeEntryState(moves, [file("e"), rank("8")]);
    expect(state.candidates.find((c) => c.promotion === "q")?.san).toBe("e8=Q+");
    expect(state.candidates.find((c) => c.promotion === "n")?.san).toBe("e8=N");
  });
});

describe("computeEntryState: castling", () => {
  it("enables castle keys exactly when O-O/O-O-O are legal", () => {
    const both = legalMoves("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
    const bothState = computeEntryState(both, []);
    expect(bothState.enabled.castleKingside).toBe(true);
    expect(bothState.enabled.castleQueenside).toBe(true);

    const kingsideOnly = legalMoves("r3k2r/8/8/8/8/8/8/4K2R w Kkq - 0 1");
    const kingsideState = computeEntryState(kingsideOnly, []);
    expect(kingsideState.enabled.castleKingside).toBe(true);
    expect(kingsideState.enabled.castleQueenside).toBe(false);
  });

  it("resolves a tapped castle key immediately", () => {
    const moves = legalMoves("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
    const state = computeEntryState(moves, [castle("O-O")]);
    expect(state.resolved?.san).toBe("O-O");
  });
});

describe("computeEntryState: undo", () => {
  it("returns to the previous state exactly when the last tap is removed", () => {
    const moves = legalMoves("4k3/8/8/8/8/1N3N2/8/4K3 w - - 0 1");
    const taps: Tap[] = [piece("N"), file("d")];
    const before = computeEntryState(moves, taps);

    const afterExtraTap = computeEntryState(moves, [...taps, rank("2")]);
    expect(afterExtraTap.disambiguation).not.toBeNull();

    const undone = computeEntryState(moves, taps);
    expect(undone).toEqual(before);
  });
});

describe("pawn key", () => {
  it("P commits a pawn entry without consuming a file: P,e,4 plays e4", () => {
    const state = computeEntryState(legalMoves(), [
      { kind: "piece", value: "P" },
      { kind: "file", value: "e" },
      { kind: "rank", value: "4" },
    ]);
    expect(state.resolved?.san).toBe("e4");
  });

  it("P is enabled at the start position alongside the knight", () => {
    const state = computeEntryState(legalMoves(), []);
    expect(state.enabled.pieces.P).toBe(true);
    expect(state.enabled.pieces.N).toBe(true);
  });
});

describe("dual keys", () => {
  const PUSH_OR_CAPTURE: LegalMove[] = [
    { san: "e5", piece: "p", from: "e4", to: "e5" },
    { san: "e4", piece: "p", from: "e3", to: "e4" },
    { san: "exd5", piece: "p", from: "e4", to: "d5" },
    { san: "Nf3", piece: "n", from: "g1", to: "f3" },
  ];

  it("reads a dual tap as a file when only the file reading is legal", () => {
    expect(interpretDualTap(PUSH_OR_CAPTURE, [], "e", "5")).toBe("file");
  });

  it("reads a dual tap as a rank when only the rank reading is legal", () => {
    const taps: Tap[] = [{ kind: "file", value: "e" }];
    expect(interpretDualTap(PUSH_OR_CAPTURE, taps, "a", "5")).toBe("rank");
  });

  it("a dual key is never two-way: with the destination file set, the tap is the rank", () => {
    const taps: Tap[] = [{ kind: "file", value: "e" }];
    expect(interpretDualTap(PUSH_OR_CAPTURE, taps, "d", "4")).toBe("rank");
  });

  it("returns none when neither reading can extend the entry", () => {
    const taps: Tap[] = [{ kind: "piece", value: "N" }];
    expect(interpretDualTap(PUSH_OR_CAPTURE, taps, "a", "1")).toBe("none");
  });
});

describe("dual keys: strict alternation", () => {
  it("second tap on the same key is the rank: d,4 plays d4", () => {
    const taps: Tap[] = [{ kind: "file", value: "d" }];
    expect(interpretDualTap(legalMoves(), taps, "d", "4")).toBe("rank");
  });

  it("assisted still dims a rank no move can reach: e then rank 5 at the start", () => {
    const state = computeEntryState(legalMoves(), [{ kind: "file", value: "e" }]);
    expect(state.enabled.ranks["5"]).toBe(false);
  });
});

describe("strict mode", () => {
  it("lights every piece and castle key at entry start regardless of the position", () => {
    // Kings-only position: assisted would dim nearly everything.
    const moves = legalMoves("4k3/8/8/8/8/8/8/4K3 w - - 0 1");
    const state = computeEntryState(moves, [], "strict");
    for (const enabled of Object.values(state.enabled.pieces)) expect(enabled).toBe(true);
    expect(state.enabled.castleKingside).toBe(true);
    expect(state.enabled.castleQueenside).toBe(true);
  });

  it("never resolves early: N,f stays open even when Nf3 is the only knight-to-f move", () => {
    const state = computeEntryState(legalMoves(), [piece("N"), file("f")], "strict");
    expect(state.resolved).toBeNull();
    expect(state.invalid).toBeNull();
  });

  it("resolves only on a complete entry: N,f,3 plays Nf3", () => {
    const state = computeEntryState(legalMoves(), [piece("N"), file("f"), rank("3")], "strict");
    expect(state.resolved?.san).toBe("Nf3");
  });

  it("flags a complete entry that matches nothing as invalid with its SAN text", () => {
    const state = computeEntryState(legalMoves(), [piece("N"), file("f"), rank("6")], "strict");
    expect(state.resolved).toBeNull();
    expect(state.invalid).toBe("Nf6");
  });

  it("flags an unreachable pawn destination as invalid with its square", () => {
    const state = computeEntryState(legalMoves(), [piece("P"), file("e"), rank("5")], "strict");
    expect(state.invalid).toBe("e5");
  });

  it("keeps SAN disambiguation even in strict — notation's own requirement", () => {
    const moves = legalMoves("4k3/8/8/8/8/1N3N2/8/4K3 w - - 0 1");
    const state = computeEntryState(moves, [piece("N"), file("d"), rank("2")], "strict");
    expect(state.disambiguation).toEqual(["Nbd2", "Nfd2"]);
  });

  it("strict dual reading ignores the position: after N, the a1 key reads as its file", () => {
    const moves = legalMoves();
    expect(interpretDualTap(moves, [piece("N")], "a", "1", "strict")).toBe("file");
  });

  it("strict same-file rule still holds: second tap on the pawn's own key is the rank", () => {
    expect(interpretDualTap(legalMoves(), [file("d")], "d", "4", "strict")).toBe("rank");
  });
});

describe("strict mode: piece-first", () => {
  it("square keys are dead until a piece starts the entry", () => {
    const state = computeEntryState(legalMoves(), [], "strict");
    for (const enabled of Object.values(state.enabled.files)) expect(enabled).toBe(false);
    for (const enabled of Object.values(state.enabled.ranks)) expect(enabled).toBe(false);
  });

  it("the pawn key opens the files: P then e then 4 plays e4", () => {
    const afterP = computeEntryState(legalMoves(), [piece("P")], "strict");
    expect(afterP.enabled.files.e).toBe(true);
    const state = computeEntryState(legalMoves(), [piece("P"), file("e"), rank("4")], "strict");
    expect(state.resolved?.san).toBe("e4");
  });

  it("a dual tap at entry start reads as nothing in strict", () => {
    expect(interpretDualTap(legalMoves(), [], "a", "1", "strict")).toBe("none");
  });
});

describe("promotion with two source pawns", () => {
  it("asks WHICH pawn via the SAN chooser instead of guessing", () => {
    // Black rook on e8; white pawns d7 and f7 — dxe8 and fxe8 both promote.
    const moves = legalMoves("4r2k/3P1P2/8/8/8/8/8/4K3 w - - 0 1");
    const state = computeEntryState(moves, [piece("P"), file("e"), rank("8")], "strict");
    expect(state.promotionPending).toBe(false);
    expect(state.resolved).toBeNull();
    expect(state.disambiguation?.length).toBe(8);
    expect(state.disambiguation).toContain("dxe8=Q+");
    expect(state.disambiguation).toContain("fxe8=Q+");
  });
});

describe("illegal entries are never reinterpreted", () => {
  it("Nc4 from the start position is invalid, and is NOT the SAN of any legal move", () => {
    const moves = legalMoves();
    const state = computeEntryState(moves, [piece("N"), file("c"), rank("4")], "strict");
    expect(state.resolved).toBeNull();
    expect(state.invalid).toBe("Nc4");
    // The keypad submits `invalid` verbatim; an exact match against the legal
    // list is the only thing that may play it. This asserts the premise that
    // makes the exact path safe: no legal move is spelled "Nc4" here.
    expect(moves.map((m) => m.san)).not.toContain("Nc4");
  });

  it("Nf4 likewise — the neighbouring legal knight moves must not absorb it", () => {
    const moves = legalMoves();
    const state = computeEntryState(moves, [piece("N"), file("f"), rank("4")], "strict");
    expect(state.invalid).toBe("Nf4");
    expect(moves.map((m) => m.san)).toEqual(expect.arrayContaining(["Nf3", "Nh3"]));
    expect(moves.map((m) => m.san)).not.toContain("Nf4");
  });
});

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
  interpretDualTap,
  dualTapOptions,
} from "./entry";

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
  it("auto-submits Nf3 once piece+file already narrows to one legal move", () => {
    const state = computeEntryState(legalMoves(), [piece("N"), file("f")]);
    expect(state.resolved?.san).toBe("Nf3");
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

describe("computeEntryState: pawn captures", () => {
  it("narrows e,d to the exd-file capture and resolves it", () => {
    // White pawn e4, black pawn d5 — only one legal e-file-to-d-file capture.
    const moves = legalMoves("rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3");
    const afterFiles = computeEntryState(moves, [file("e"), file("d")]);
    expect(afterFiles.resolved?.san).toBe("exd5");
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

  it("flags the genuinely two-way pawn tap: after e, the d4 key is both exd-capture and rank 4", () => {
    const taps: Tap[] = [{ kind: "file", value: "e" }];
    expect(interpretDualTap(PUSH_OR_CAPTURE, taps, "d", "4")).toBe("both");
    expect(dualTapOptions(PUSH_OR_CAPTURE, taps, "d", "4")).toEqual(["exd5", "e4"]);
  });

  it("returns none when neither reading can extend the entry", () => {
    const taps: Tap[] = [{ kind: "piece", value: "N" }];
    expect(interpretDualTap(PUSH_OR_CAPTURE, taps, "a", "1")).toBe("none");
  });
});

describe("dual keys: same-file pawn pushes", () => {
  it("second tap on the pawn's own key reads as the rank, so d,4 plays d4 without a chooser", () => {
    const moves = legalMoves();
    const taps: Tap[] = [{ kind: "file", value: "d" }];
    expect(interpretDualTap(moves, taps, "d", "4")).toBe("rank");
  });

  it("the pawn's own file is not a capture target: files.e goes dead after tapping e at the start", () => {
    const state = computeEntryState(legalMoves(), [{ kind: "file", value: "e" }]);
    expect(state.enabled.files.e).toBe(false);
  });

  it("the e5 key is fully dead after e at the start: no e-file capture, no rank-5 push", () => {
    expect(interpretDualTap(legalMoves(), [{ kind: "file", value: "e" }], "e", "5")).toBe("none");
  });
});

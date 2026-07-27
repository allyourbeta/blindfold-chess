/**
 * Fixed positions for gates 3 and 4, and a varied set for the ~20-move
 * inference benchmark. Gate 3 positions were pre-validated against the real
 * model in Python before being wired up here -- see the spike report for
 * those numbers next to what the page shows.
 */

export interface ObviousMovePosition {
  label: string;
  fen: string;
  /** The move a strong human would play essentially every time, for the human judging the gate to compare against. */
  expectedUci: string;
  expectedDescription: string;
}

export const GATE_3_POSITIONS: ObviousMovePosition[] = [
  {
    label: "Free queen (white to move)",
    fen: "4k3/8/8/8/3q4/8/3Q4/4K3 w - - 0 1",
    expectedUci: "d2d4",
    expectedDescription: "Qxd4, capturing the undefended black queen",
  },
  {
    label: "Free queen (black to move)",
    fen: "4k3/8/5n2/3Q4/8/8/8/4K3 b - - 0 1",
    expectedUci: "f6d5",
    expectedDescription: "Nxd5, capturing the undefended white queen",
  },
  {
    label: "Forced recapture (black to move)",
    fen: "r1bqkb1r/ppp2ppp/2n5/3nN3/8/2N5/PPPP1PPP/R1BQKB1R b KQkq - 0 6",
    expectedUci: "c6e5",
    expectedDescription: "Nxe5, recapturing the knight White just took",
  },
];

export const STARTPOS_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/** ~20 varied real-game-shaped positions for the inference benchmark. */
export const BENCHMARK_FENS: string[] = [
  STARTPOS_FEN,
  "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2",
  "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2",
  "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3",
  "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3",
  "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
  "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/2P2N2/PP1P1PPP/RNBQK2R b KQkq - 0 4",
  "rnbqkb1r/pp1p1ppp/2p2n2/4p3/3PP3/8/PPP2PPP/RNBQKBNR w KQkq - 0 4",
  "rnbqkb1r/pp1p1ppp/2p2n2/4P3/3P4/8/PPP2PPP/RNBQKBNR b KQkq - 0 4",
  "r1bqkb1r/ppp2ppp/2n2n2/3pp3/3PP3/2N2N2/PPP2PPP/R1BQKB1R w KQkq - 0 5",
  "r1bqkb1r/ppp2ppp/2n2n2/3pN3/3P4/2N5/PPP2PPP/R1BQKB1R b KQkq - 0 5",
  "r1bqkb1r/ppp2ppp/2n5/3pN3/3Pn3/2N5/PPP2PPP/R1BQKB1R w KQkq - 0 6",
  "8/8/4k3/8/4K3/8/8/8 w - - 0 1",
  "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1",
  "r3k2r/pppq1ppp/2n1bn2/2bpp3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w kq - 4 8",
  "r3k2r/pppq1ppp/2n1bn2/2bpp3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 b kq - 4 8",
  "2kr3r/ppp2ppp/2n1bn2/2bpp3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 6 9",
  "5rk1/ppp2ppp/2n2n2/2bpp3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 8 10",
  "r1b1k2r/ppppqppp/2n2n2/2b1p3/2B1P3/2NP1N2/PPP1QPPP/R1B2RK1 b kq - 6 7",
  "rnbqkbnr/pp3ppp/2p5/3pp3/3PP3/8/PPP2PPP/RNBQKBNR w KQkq - 0 4",
];

// The fixed list of real external pages/games the catalog is sourced from.
// See SPEC_endgames_catalog.md Part 1 and the completion report for why
// each host was chosen.

export const WIKI_PAGES = [
  "Lucena position",
  "Philidor position",
  "King and pawn versus king endgame",
  "Rook and pawn versus rook endgame",
  "Opposition (chess)",
  "Two knights endgame",
  "Wrong bishop",
  "Rook and bishop versus rook endgame",
  "Queen versus rook endgame",
  "Queen and pawn versus queen endgame",
  "Opposite-colored bishops endgame",
  "Bishop and knight checkmate",
  "Fortress (chess)",
  "Pawnless chess endgame",
  "Zugzwang",
  "Chess endgame",
];

export const WIKIBOOKS_PAGES = [
  "Chess/The_Endgame/Pawn_Endings",
  "Chess/The_Endgame/King_and_Two_Major_Pieces_vs._King",
  "Chess/The_Endgame/Minor_Piece_endings",
  "Chess/The_Endgame/Endgame_Studies_and_Puzzles",
];

export const CHESSBASE_PAGES = [
  { url: "https://en.chessbase.com/post/riddle-karpov-hort-1979", title: "ChessBase: Riddle - Karpov-Hort, 1979" },
  {
    url: "https://en.chessbase.com/post/riddle-solved-spielmann-could-have-drawn",
    title: "ChessBase: Riddle solved - Spielmann could have drawn",
  },
];

// Single real games, fetched as their own PGN (game index is always 0).
export const LICHESS_GAMES = [
  { gameId: "ZAMs9lOM", title: "Byrne vs. Fischer, \"Game of the Century\", 1956" },
  { gameId: "cRUVwDc4", title: "Anderssen vs. Kieseritzky, \"Immortal Game\", 1851" },
  { gameId: "QVae8hXv", title: "Kasparov vs. The World, 1999" },
];

// Real tournament/match PGN collections -- every game in each file is scanned.
export const PGNMENTOR_FILES = [
  { path: "events/NewYork1924.pgn", title: "PGN Mentor: New York 1924" },
  { path: "events/WorldChamp1972.pgn", title: "PGN Mentor: World Championship 1972" },
  { path: "events/WorldChamp2021.pgn", title: "PGN Mentor: World Championship 2021" },
  { path: "events/WorldChamp1927.pgn", title: "PGN Mentor: World Championship 1927" },
  { path: "events/Hastings1895.pgn", title: "PGN Mentor: Hastings 1895" },
];

// Real games played on Lichess by a public, named account, bulk-exported.
// Separate host budget from both PGN Mentor and the single-game exports
// above -- the 9-16 piece buckets have almost no non-PGN-Mentor supply
// otherwise, which would force PGN Mentor's share over the 40% cap.
//
// `until` pins the export to games before a fixed timestamp recorded when
// this list was written (2026-10-07), so a later re-run of build.mjs
// fetches the exact same 150 games instead of "the 150 most recent as of
// whenever this happens to run" -- the account's games before that instant
// never change in retrospect.
export const LICHESS_BULK_EXPORTS = [
  {
    username: "DrNykterstein",
    max: 150,
    until: 1791394056000,
    title: "Lichess games: DrNykterstein (Magnus Carlsen)",
  },
];

// A one-shot Stockfish evaluation in its own OS process. The npm
// `stockfish` package's multithreaded WASM build can only be initialized
// once per process (a second `initEngine()` call throws), so running N
// evaluations in parallel means N *processes*, each with exactly one
// engine -- which is also what SPEC_endgames_catalog.md's speed section
// asks for ("one Stockfish process per CPU core minus one, each at 1
// thread"), not N engine instances inside one process.
import initEngine from "stockfish";

const [fen, depthArg] = process.argv.slice(2);
const depth = Number(depthArg) || 16;

const engine = await initEngine();
engine.sendCommand("setoption name Threads value 1");
let score = null;
await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error("stockfish timeout")), 30000);
  engine.listener = (line) => {
    const m = /score (cp|mate) (-?\d+)/.exec(line);
    if (m) score = m[1] === "mate" ? (Number(m[2]) > 0 ? 100000 : -100000) : Number(m[2]);
    if (line.startsWith("bestmove")) {
      clearTimeout(timeout);
      resolve();
    }
  };
  engine.sendCommand(`position fen ${fen}`);
  engine.sendCommand(`go depth ${depth}`);
});
process.stdout.write(JSON.stringify({ score }));
process.exit(0);

import type { MaiaMoveProbability } from "../adapter/protocol";

export interface GateResult {
  label: string;
  fen: string;
  moves: MaiaMoveProbability[];
  expectedUci?: string;
  expectedDescription?: string;
}

function MoveRow({ move, isExpected }: { move: MaiaMoveProbability; isExpected: boolean }) {
  return (
    <li className={`flex justify-between gap-4 font-mono text-sm ${isExpected ? "text-green-400" : "text-neutral-200"}`}>
      <span>{move.uci}</span>
      <span>{(move.probability * 100).toFixed(2)}%</span>
    </li>
  );
}

export function GatePanel({ title, results, topN }: { title: string; results: GateResult[]; topN: number }) {
  return (
    <section className="space-y-4 rounded-lg border border-neutral-700 p-4">
      <h2 className="text-lg font-semibold text-neutral-100">{title}</h2>
      {results.length === 0 && <p className="text-sm text-neutral-500">Load a model and run gates to see results.</p>}
      {results.map((r) => (
        <div key={r.fen} className="space-y-1">
          <p className="text-sm text-neutral-300">
            {r.label}
            {r.expectedDescription && (
              <span className="text-neutral-500"> &mdash; expected: {r.expectedDescription}</span>
            )}
          </p>
          <p className="font-mono text-xs text-neutral-500">{r.fen}</p>
          <ol className="space-y-0.5">
            {r.moves.slice(0, topN).map((m) => (
              <MoveRow key={m.uci} move={m} isExpected={m.uci === r.expectedUci} />
            ))}
          </ol>
        </div>
      ))}
    </section>
  );
}

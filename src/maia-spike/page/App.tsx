import { useCallback, useRef, useState } from "react";
import { MaiaSpikeAdapter } from "../adapter/maiaSpikeAdapter";
import { ManifestPanel, MODELS } from "./ManifestPanel";
import { MeasurementsPanel, type Measurements } from "./MeasurementsPanel";
import { GatePanel, type GateResult } from "./GatePanel";
import { BENCHMARK_FENS, GATE_3_POSITIONS, STARTPOS_FEN } from "./testPositions";

type Status = "idle" | "downloading" | "running" | "done" | "error";

export function App() {
  const [modelId, setModelId] = useState(MODELS[0].id);
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [measurements, setMeasurements] = useState<Measurements>({});
  const [gate3, setGate3] = useState<GateResult[]>([]);
  const [gate4, setGate4] = useState<GateResult[]>([]);
  const adapterRef = useRef<MaiaSpikeAdapter | null>(null);

  const run = useCallback(async () => {
    setStatus("downloading");
    setError(null);
    setMeasurements({});
    setGate3([]);
    setGate4([]);

    adapterRef.current?.dispose();
    const adapter = new MaiaSpikeAdapter();
    adapterRef.current = adapter;

    try {
      const model = MODELS.find((m) => m.id === modelId)!;
      const loadTimings = await adapter.load({ id: model.id, url: `/maia/models/${model.file}` }, (loaded, total) =>
        setProgress({ loaded, total }),
      );
      setMeasurements((m) => ({ ...m, downloadMs: loadTimings.downloadMs, sessionCreateMs: loadTimings.sessionCreateMs }));
      setStatus("running");

      // First inference, timed separately from the warm benchmark below.
      const first = await adapter.evaluate(STARTPOS_FEN);
      setMeasurements((m) => ({ ...m, firstInferenceMs: first.timings.inferenceMs }));
      setGate4([{ label: "Start position", fen: STARTPOS_FEN, moves: first.evaluation.moves }]);

      // Gate 3: obvious-move sanity.
      const gate3Results: GateResult[] = [];
      for (const pos of GATE_3_POSITIONS) {
        const result = await adapter.evaluate(pos.fen);
        gate3Results.push({
          label: pos.label,
          fen: pos.fen,
          moves: result.evaluation.moves,
          expectedUci: pos.expectedUci,
          expectedDescription: pos.expectedDescription,
        });
        setGate3([...gate3Results]);
      }

      // Warm benchmark over ~20 varied positions.
      const benchmarkMs: number[] = [];
      for (const fen of BENCHMARK_FENS) {
        const result = await adapter.evaluate(fen);
        benchmarkMs.push(result.timings.inferenceMs ?? 0);
        setMeasurements((m) => ({ ...m, benchmarkMs: [...benchmarkMs] }));
      }

      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }, [modelId]);

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6 text-neutral-100">
      <header>
        <h1 className="text-2xl font-bold">Maia spike &mdash; lab bench</h1>
        <p className="text-sm text-neutral-400">
          Not part of the app. Proves the encoding and measures cost before anything gets built into the game. See{" "}
          <code>SPEC_maia_spike.md</code>.
        </p>
      </header>

      <ManifestPanel selectedModelId={modelId} onSelect={setModelId} disabled={status === "downloading" || status === "running"} />

      <button
        type="button"
        onClick={run}
        disabled={status === "downloading" || status === "running"}
        className="rounded bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
      >
        {status === "idle" || status === "done" || status === "error" ? "Load model and run gates" : "Running…"}
      </button>

      {progress && status === "downloading" && (
        <p className="text-sm text-neutral-400">
          Downloading: {(progress.loaded / 1e6).toFixed(1)} / {(progress.total / 1e6).toFixed(1)} MB
        </p>
      )}
      {error && <p className="rounded border border-red-700 bg-red-950 p-3 text-sm text-red-300">{error}</p>}

      <MeasurementsPanel measurements={measurements} />
      <GatePanel title="Gate 3: obvious-move sanity" results={gate3} topN={5} />
      <GatePanel title="Gate 4: nonsense detection (top 10 from start position)" results={gate4} topN={10} />
    </main>
  );
}

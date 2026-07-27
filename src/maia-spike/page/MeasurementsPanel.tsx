import { useEffect, useState } from "react";

export interface Measurements {
  downloadMs?: number;
  sessionCreateMs?: number;
  firstInferenceMs?: number;
  benchmarkMs?: number[];
}

function fmt(ms: number | undefined): string {
  if (ms === undefined) return "—";
  return `${ms.toFixed(1)} ms`;
}

function median(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function MeasurementsPanel({ measurements }: { measurements: Measurements }) {
  const benchmark = measurements.benchmarkMs ?? [];
  const med = median(benchmark);
  const min = benchmark.length ? Math.min(...benchmark) : undefined;
  const max = benchmark.length ? Math.max(...benchmark) : undefined;

  const memoryInfo = (performance as Performance & { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } })
    .memory;

  return (
    <section className="space-y-3 rounded-lg border border-neutral-700 p-4">
      <h2 className="text-lg font-semibold text-neutral-100">Measurements</h2>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-sm text-neutral-200 sm:grid-cols-3">
        <dt className="text-neutral-400">Cold download</dt>
        <dd className="col-span-1 sm:col-span-2">{fmt(measurements.downloadMs)}</dd>
        <dt className="text-neutral-400">Session creation</dt>
        <dd className="col-span-1 sm:col-span-2">{fmt(measurements.sessionCreateMs)}</dd>
        <dt className="text-neutral-400">First inference</dt>
        <dd className="col-span-1 sm:col-span-2">{fmt(measurements.firstInferenceMs)}</dd>
        <dt className="text-neutral-400">
          Median inference ({benchmark.length}/{20})
        </dt>
        <dd className="col-span-1 sm:col-span-2">
          {fmt(med)} {min !== undefined && max !== undefined ? `(min ${fmt(min)}, max ${fmt(max)})` : ""}
        </dd>
      </dl>
      <div className="text-sm text-neutral-400">
        {memoryInfo ? (
          <p>
            JS heap: {(memoryInfo.usedJSHeapSize / 1e6).toFixed(1)} MB used /{" "}
            {(memoryInfo.jsHeapSizeLimit / 1e6).toFixed(1)} MB limit
          </p>
        ) : (
          <p>performance.memory unavailable (Chrome-only API; expected on iOS Safari)</p>
        )}
        <StorageEstimate />
      </div>
    </section>
  );
}

function StorageEstimate() {
  const [estimate, setEstimate] = useState<{ usage?: number; quota?: number } | null>(null);
  useEffect(() => {
    if (!navigator.storage?.estimate) return;
    navigator.storage.estimate().then(setEstimate).catch(() => setEstimate(null));
  }, []);
  if (!navigator.storage?.estimate) return <p>navigator.storage.estimate() unavailable</p>;
  if (!estimate) return <p>Loading storage estimate&hellip;</p>;
  return (
    <p>
      Storage: {((estimate.usage ?? 0) / 1e6).toFixed(1)} MB used / {((estimate.quota ?? 0) / 1e6).toFixed(1)} MB
      quota
    </p>
  );
}

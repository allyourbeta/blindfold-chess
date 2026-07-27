const MODELS = [
  { id: "maia_kdd_1900", label: "Maia 1900 (primary)", file: "maia_kdd_1900.onnx" },
  { id: "maia_kdd_1800", label: "Maia 1800 (secondary)", file: "maia_kdd_1800.onnx" },
];

export function ManifestPanel({
  selectedModelId,
  onSelect,
  disabled,
}: {
  selectedModelId: string;
  onSelect: (id: string) => void;
  disabled: boolean;
}) {
  return (
    <section className="space-y-3 rounded-lg border border-neutral-700 p-4">
      <h2 className="text-lg font-semibold text-neutral-100">Model</h2>
      <p className="text-sm text-neutral-400">
        Full manifest (source, sha256, opset, shapes) is in <code>MODELS.md</code>. These are the classic
        per-rating lc0 Maia models, not CSSLab&apos;s newer elo-conditioned frontend model &mdash; see{" "}
        <code>CREDITS.md</code>.
      </p>
      <div className="flex gap-4">
        {MODELS.map((m) => (
          <label key={m.id} className="flex items-center gap-2 text-sm text-neutral-200">
            <input
              type="radio"
              name="model"
              value={m.id}
              checked={selectedModelId === m.id}
              disabled={disabled}
              onChange={() => onSelect(m.id)}
            />
            {m.label}
          </label>
        ))}
      </div>
    </section>
  );
}

export { MODELS };

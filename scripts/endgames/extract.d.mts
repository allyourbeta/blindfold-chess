export function extractFromRecipe(extract: {
  kind: string;
  [key: string]: unknown;
}): Promise<{ placement: string; sideToMove: "w" | "b"; result?: string | null }>;

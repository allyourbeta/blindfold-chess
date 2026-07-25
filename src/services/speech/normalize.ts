const NUMBER_WORDS: Record<string, string> = {
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
};

const NATO_LETTERS: Record<string, string> = {
  alpha: "a",
  bravo: "b",
  charlie: "c",
  delta: "d",
  echo: "e",
  foxtrot: "f",
  golf: "g",
  hotel: "h",
};

/**
 * Lowercases, converts number words to digits and NATO phonetic-alphabet
 * words to file letters, then collapses whitespace. Deliberately small —
 * mishearing fixes belong in match.ts's fuzzy scoring, not here.
 */
export function normalizeTranscript(raw: string): string {
  const withWordsExpanded = raw
    .toLowerCase()
    .replace(/[a-z]+/g, (word) => NUMBER_WORDS[word] ?? NATO_LETTERS[word] ?? word);
  return withWordsExpanded.replace(/\s+/g, " ").trim();
}

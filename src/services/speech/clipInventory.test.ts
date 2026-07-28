import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CLIP_IDS } from "./phrase";

/**
 * Three lists are hand-maintained in three places and must agree: the ids
 * the code can emit (CLIP_IDS), the .wav files on disk, and sw.js's precache
 * array. This does NOT verify a clip *sounds* right — the "eff" bug (a
 * correctly-named, wrongly-recorded file) is invisible to an inventory
 * check; only listening catches that. This is inventory-only, on purpose.
 */

const audioDir = fileURLToPath(new URL("../../../public/audio", import.meta.url));
const swJsPath = fileURLToPath(new URL("../../../public/sw.js", import.meta.url));

const wavIds = new Set(
  readdirSync(audioDir)
    .filter((f) => f.endsWith(".wav"))
    .map((f) => f.replace(/\.wav$/, "")),
);

const clipIds = new Set<string>(CLIP_IDS);

function parseSwAudioClips(): Set<string> {
  const text = readFileSync(swJsPath, "utf8");
  const arrayLiteral = text.match(/const AUDIO_CLIPS = \[([\s\S]*?)\]\s*\.map/);
  if (!arrayLiteral) throw new Error("Could not find AUDIO_CLIPS array literal in public/sw.js");
  return new Set(Array.from(arrayLiteral[1].matchAll(/'([^']+)'/g), (m) => m[1]));
}

describe("clip inventory: CLIP_IDS, public/audio/*.wav, and sw.js's precache list agree", () => {
  // FALSIFIER: goes red if CLIP_IDS names a clip id (something the app can
  // try to play) that has no public/audio/<id>.wav file on disk.
  it("every id in CLIP_IDS has a .wav file in public/audio/", () => {
    const missingFiles = [...clipIds].filter((id) => !wavIds.has(id));
    expect(missingFiles).toEqual([]);
  });

  // FALSIFIER: goes red if public/audio/ contains a .wav file whose name is
  // not in CLIP_IDS — this is the orphan direction, the one that let three
  // dead clips survive the removal of voice input.
  it("every .wav file in public/audio/ has a matching id in CLIP_IDS", () => {
    const orphanedFiles = [...wavIds].filter((id) => !clipIds.has(id));
    expect(orphanedFiles).toEqual([]);
  });

  // FALSIFIER: goes red if sw.js's hand-maintained AUDIO_CLIPS array (parsed
  // out of the file's actual text, not retyped here) ever lists an id
  // CLIP_IDS doesn't have, or is missing one CLIP_IDS does — either way sw.js
  // would precache something wrong: a dead URL, or a live clip never cached.
  it("sw.js's AUDIO_CLIPS array matches CLIP_IDS exactly", () => {
    const swIds = parseSwAudioClips();
    expect([...swIds].sort()).toEqual([...clipIds].sort());
  });
});

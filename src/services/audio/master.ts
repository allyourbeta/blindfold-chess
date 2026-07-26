/**
 * One shared output gain for every app sound — tones and word clips alike.
 * Slight headroom (0.85) so briefly overlapping sources can't sum past 1.0
 * and clip, which on a phone speaker comes out as crackle and static.
 */
let node: GainNode | null = null;
let owner: AudioContext | null = null;

export function getOutputNode(ctx: AudioContext): AudioNode {
  if (!node || owner !== ctx) {
    node = ctx.createGain();
    node.gain.value = 0.85;
    node.connect(ctx.destination);
    owner = ctx;
  }
  return node;
}

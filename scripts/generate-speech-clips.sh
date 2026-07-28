#!/usr/bin/env bash
# Generates every spoken-move audio clip with the macOS `say` command and
# converts each to a web-friendly 16-bit PCM WAV. Clip ids match the
# SpokenPart/ClipId type in src/services/chess/san.ts — do not rename one
# without updating the other.
#
# Usage: bash scripts/generate-speech-clips.sh

set -euo pipefail

VOICE="Tessa (Enhanced)"

# Slower than the default. These are mostly single syllables, and the file
# letters are the hardest part of any phrase — they need the extra room.
RATE=155

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT_DIR="$SCRIPT_DIR/../public/audio"
mkdir -p "$OUT_DIR"

if ! command -v say >/dev/null 2>&1; then
  echo "error: the 'say' command is only available on macOS." >&2
  exit 1
fi
if ! command -v afconvert >/dev/null 2>&1; then
  echo "error: 'afconvert' not found (part of macOS Core Audio tools)." >&2
  exit 1
fi

# id:spoken text — id is also the output filename (id.wav).
CLIPS=(
  "king:king" "queen:queen" "rook:rook" "bishop:bishop" "knight:knight" "pawn:pawn"
  "a:Ay" "b:Bee" "c:See" "d:Dee" "e:e" "f:ef" "g:Jee" "h:Aitch"
  # NATO file names — used when the "Say files as" setting is set to NATO.
  # b/c/d/e/g are the classic confusable E-set; these are not confusable.
  "nato-a:Alpha" "nato-b:Bravo" "nato-c:Charlie" "nato-d:Delta"
  "nato-e:Echo" "nato-f:Foxtrot" "nato-g:Golf" "nato-h:Hotel"
  "1:one" "2:two" "3:three" "4:four" "5:five" "6:six" "7:seven" "8:eight"
  "takes:takes" "from:from" "check:check" "checkmate:checkmate"
  "castles-kingside:castles kingside" "castles-queenside:castles queenside"
  "promotes-to:promotes to" "en-passant:en passant"
  "stalemate:stalemate" "draw:draw"
  # Spoken move rejections — built from clips so Tessa says them too, rather
  # than falling through to the browser's default synthesiser.
  "not-legal:is not legal"
)

echo "Generating ${#CLIPS[@]} clips with voice '$VOICE' at ${RATE}wpm into $OUT_DIR ..."

for entry in "${CLIPS[@]}"; do
  id="${entry%%:*}"
  text="${entry#*:}"
  aiff="$OUT_DIR/$id.aiff"
  wav="$OUT_DIR/$id.wav"

  say -v "$VOICE" -r "$RATE" -o "$aiff" "$text"
  afconvert -f WAVE -d LEI16@22050 "$aiff" "$wav"
  rm -f "$aiff"
  echo "  $id.wav <- \"$text\""
done

echo "Done. $(ls "$OUT_DIR"/*.wav | wc -l | tr -d ' ') clips in $OUT_DIR."

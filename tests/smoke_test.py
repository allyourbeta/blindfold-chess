#!/usr/bin/env python3
"""Browser and packaging smoke tests for Blindfold Chess Trainer.

Run from the project root:
    python3 tests/smoke_test.py

The browser tests use Playwright with an installed Chromium. They intercept the two
CDN dependencies with small deterministic stubs, so the suite does not require an
internet connection and tests the app's own UI/state-management logic.
"""

from __future__ import annotations

import json
import os
import subprocess
import struct
import sys
from pathlib import Path

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    sync_playwright = None

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
CHESS_URL = "https://cdnjs.cloudflare.com/ajax/libs/chess.js/0.10.3/chess.min.js"
STOCKFISH_URL = "https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js"
INDEX_HTML = (PUBLIC / "index.html").read_text()

CHESS_STUB = r"""
class Chess {
  constructor(fen) {
    this._history = [];
    this.load(fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  }
  load(fen) {
    if (typeof fen !== 'string') return false;
    const fields = fen.trim().split(/\s+/);
    if (fields.length !== 6 || !/^[wb]$/.test(fields[1])) return false;
    const rows = fields[0].split('/');
    if (rows.length !== 8) return false;
    for (const row of rows) {
      let count = 0;
      for (const ch of row) count += /[1-8]/.test(ch) ? Number(ch) : /[prnbqkPRNBQK]/.test(ch) ? 1 : 99;
      if (count !== 8) return false;
    }
    this._fen = fields.join(' ');
    this._turn = fields[1];
    this._history = [];
    return true;
  }
  fen() { return this._fen; }
  turn() { return this._turn; }
  _setTurn(turn) {
    const fields = this._fen.split(/\s+/);
    fields[1] = turn;
    this._fen = fields.join(' ');
    this._turn = turn;
  }
  move(input) {
    let from = this._turn === 'w' ? 'e2' : 'e7';
    let to = this._turn === 'w' ? 'e4' : 'e5';
    let san = this._turn === 'w' ? 'e4' : 'e5';
    let promotion;
    if (typeof input === 'object') {
      from = input.from;
      to = input.to;
      promotion = input.promotion;
      const key = from + to + (promotion || '');
      const map = { e2e4: 'e4', e7e5: 'e5', g1f3: 'Nf3', b8c6: 'Nc6' };
      san = map[key] || to;
    } else if (typeof input === 'string') {
      const cleaned = input.replace(/[+#]/g, '');
      const map = {
        e4: ['e2','e4','e4'], e5: ['e7','e5','e5'],
        Nf3: ['g1','f3','Nf3'], Nc6: ['b8','c6','Nc6'],
        'O-O': [this._turn === 'w' ? 'e1' : 'e8', this._turn === 'w' ? 'g1' : 'g8', 'O-O']
      };
      if (map[cleaned]) [from,to,san] = map[cleaned];
      else if (/^[NBRQK]?[a-h]?[1-8]?x?[a-h][1-8](=[NBRQ])?$/.test(cleaned)) {
        to = cleaned.match(/[a-h][1-8]/g).slice(-1)[0];
        san = input;
      } else return null;
    } else return null;
    this._history.push({ fen: this._fen, turn: this._turn, move: { from, to, san, promotion } });
    this._setTurn(this._turn === 'w' ? 'b' : 'w');
    return { from, to, san, promotion, captured: undefined, piece: san.startsWith('N') ? 'n' : 'p' };
  }
  undo() {
    const item = this._history.pop();
    if (!item) return null;
    this._fen = item.fen;
    this._turn = item.turn;
    return item.move;
  }
  moves(options) {
    const sans = this._turn === 'w' ? ['e4','Nf3'] : ['e5','Nc6'];
    if (!options || !options.verbose) return sans;
    return sans.map(san => ({
      san,
      piece: san.startsWith('N') ? 'n' : 'p',
      from: san === 'e4' ? 'e2' : san === 'e5' ? 'e7' : san === 'Nf3' ? 'g1' : 'b8',
      to: san.slice(-2),
      captured: undefined
    }));
  }
  in_checkmate() { return false; }
  in_stalemate() { return false; }
  in_threefold_repetition() { return false; }
  insufficient_material() { return false; }
  in_draw() { return false; }
}
"""


def stockfish_stub(delay_ms: int = 30) -> str:
    return f"""
self.onmessage = function(event) {{
  const cmd = String(event.data || '');
  if (cmd === 'uci') self.postMessage('uciok');
  else if (cmd === 'isready') self.postMessage('readyok');
  else if (cmd.startsWith('go ')) setTimeout(() => self.postMessage('bestmove e7e5'), {delay_ms});
}};
"""



def route_dependencies(page, *, first_engine_request_fails: bool = False, delay_ms: int = 30):
    attempts = {"engine": 0}

    def chess_route(route):
        route.fulfill(status=200, content_type="application/javascript", headers={"Access-Control-Allow-Origin": "*"}, body=CHESS_STUB)

    def engine_route(route):
        attempts["engine"] += 1
        if first_engine_request_fails and attempts["engine"] == 1:
            route.fulfill(status=503, content_type="text/plain", headers={"Access-Control-Allow-Origin": "*"}, body="temporary failure")
        else:
            route.fulfill(status=200, content_type="application/javascript", headers={"Access-Control-Allow-Origin": "*"}, body=stockfish_stub(delay_ms))

    page.route(CHESS_URL, chess_route)
    page.route(STOCKFISH_URL, engine_route)
    return attempts


def assert_static_project() -> None:
    required = [
        PUBLIC / "index.html",
        PUBLIC / "manifest.json",
        PUBLIC / "sw.js",
        PUBLIC / "icons/icon-192.png",
        PUBLIC / "icons/icon-512.png",
        PUBLIC / "icons/icon-maskable-512.png",
        PUBLIC / "icons/apple-touch-icon.png",
    ]
    missing = [str(path.relative_to(ROOT)) for path in required if not path.is_file()]
    assert not missing, f"Missing required files: {missing}"

    expected_sizes = {
        "icon-192.png": (192, 192),
        "icon-512.png": (512, 512),
        "icon-maskable-512.png": (512, 512),
        "apple-touch-icon.png": (180, 180),
    }
    for name, size in expected_sizes.items():
        data = (PUBLIC / "icons" / name).read_bytes()
        assert data[:8] == b"\x89PNG\r\n\x1a\n", f"{name} is not a PNG"
        width, height = struct.unpack(">II", data[16:24])
        assert (width, height) == size, f"{name}: expected {size}, got {(width, height)}"

    manifest = json.loads((PUBLIC / "manifest.json").read_text())
    icon_paths = {item["src"] for item in manifest["icons"]}
    assert "/icons/icon-192.png" in icon_paths
    assert "/icons/icon-512.png" in icon_paths
    assert "/icons/icon-maskable-512.png" in icon_paths

    html = (PUBLIC / "index.html").read_text()
    inline = html.rsplit("<script>", 1)[1].split("</script>", 1)[0]
    temp = ROOT / ".tmp-inline-check.js"
    temp.write_text(inline)
    try:
        subprocess.run(["node", "--check", str(temp)], check=True, capture_output=True, text=True)
    finally:
        temp.unlink(missing_ok=True)

    assert "PIECE_BASE" not in html, "Board pieces should not depend on remote images"
    assert "Promise.allSettled" in (PUBLIC / "sw.js").read_text(), "Service worker should tolerate CDN install failures"


def wait_engine_ready(page) -> None:
    page.wait_for_function("document.getElementById('startBtn').textContent.includes('New Game')")
    assert page.locator("#startBtn").is_enabled()
    assert page.locator("#setupBtn").is_enabled()


def test_normal_game(browser) -> None:
    page = browser.new_page()
    route_dependencies(page)
    page.set_content(INDEX_HTML, wait_until="domcontentloaded")
    wait_engine_ready(page)

    page.click("#startBtn")
    assert page.locator("#play").evaluate("el => el.classList.contains('visible')")
    page.fill("#moveInput", "e4")
    page.press("#moveInput", "Enter")
    page.wait_for_function("document.getElementById('moveList').textContent.includes('e5')")
    assert "1. e4 e5" in page.locator("#moveList").inner_text()

    page.click("button:has-text('Menu')")
    page.click("#setupBtn")
    assert page.locator("#setup").evaluate("el => el.classList.contains('visible')")
    # Remove the rook from h1. Castling rights should automatically lose K.
    page.locator(".square.interactive").nth(63).click()
    page.click("#setupPlayBtn")
    page.fill("#moveInput", "fen")
    page.press("#moveInput", "Enter")
    messages = page.locator("#messages").inner_text()
    assert " w Qkq - 0 1" in messages, messages
    page.close()


def test_retry_restores_start_action(browser) -> None:
    page = browser.new_page()
    attempts = route_dependencies(page, first_engine_request_fails=True)
    page.set_content(INDEX_HTML, wait_until="domcontentloaded")
    page.wait_for_function("document.getElementById('startBtn').textContent.includes('Retry')")
    assert page.locator("#setupBtn").is_disabled()
    page.click("#startBtn")
    wait_engine_ready(page)
    assert attempts["engine"] == 2
    page.click("#startBtn")
    assert page.locator("#play").evaluate("el => el.classList.contains('visible')")
    page.close()


def test_abort_during_engine_search(browser) -> None:
    page = browser.new_page()
    route_dependencies(page, delay_ms=500)
    page.set_content(INDEX_HTML, wait_until="domcontentloaded")
    wait_engine_ready(page)
    page.click("#startBtn")
    page.fill("#moveInput", "e4")
    page.press("#moveInput", "Enter")
    page.wait_for_function("document.getElementById('thinkingMsg') !== null")
    page.click("#resignBtn")
    page.wait_for_timeout(700)
    assert page.locator("#moveList").inner_text().strip() == "1. e4"
    assert "You resigned" in page.locator("#gameOverText").inner_text()
    page.close()


def test_new_game_during_engine_search(browser) -> None:
    page = browser.new_page()
    route_dependencies(page, delay_ms=500)
    page.set_content(INDEX_HTML, wait_until="domcontentloaded")
    wait_engine_ready(page)
    page.click("#startBtn")
    page.fill("#moveInput", "e4")
    page.press("#moveInput", "Enter")
    page.wait_for_function("document.getElementById('thinkingMsg') !== null")
    page.click("#newGameBtn")
    page.wait_for_function("document.getElementById('moveList').textContent.includes('No moves yet')")
    page.wait_for_timeout(700)
    assert "No moves yet" in page.locator("#moveList").inner_text()
    page.close()


def main() -> int:
    assert_static_project()
    if sync_playwright is None:
        print("PASS: static checks")
        print("SKIP: browser tests (install Playwright to run them)")
        return 0

    with sync_playwright() as pw:
        launch_args = {"headless": True}
        chromium_path = os.environ.get("CHROMIUM_PATH")
        if chromium_path:
            launch_args["executable_path"] = chromium_path
        elif Path("/usr/bin/chromium").exists():
            launch_args["executable_path"] = "/usr/bin/chromium"
            launch_args["args"] = ["--no-sandbox"]
        browser = pw.chromium.launch(**launch_args)
        try:
            test_normal_game(browser)
            test_retry_restores_start_action(browser)
            test_abort_during_engine_search(browser)
            test_new_game_during_engine_search(browser)
        finally:
            browser.close()
    print("PASS: static checks and 4 browser smoke tests")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

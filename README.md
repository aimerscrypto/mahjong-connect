# Mahjong Connect

A polished, fully playable Mahjong Connect browser game — built as a 2D-art portfolio piece.
Every pixel of art (42 tile faces, the chibi dragon, logo, UI kit, background scene) is
hand-authored vector art generated in code: inline SVG, CSS gradients and canvas.
No images, no frameworks, no build step.

- **Play:** `docs/index.html`
- **Art presentation sheet:** `docs/assets.html` — every asset with *PNG 2×*, *SVG* and *Download all as ZIP*.

## Features
- Classic connect rule: match identical tiles joined by a path with at most two turns (0-1 BFS over cell × direction).
- 14 × 10 board (70 pairs), deals verified solvable by an actual play-out; auto-shuffle if you ever get stuck.
- 12 levels with shrinking timers and gravity variants (down, left, up, right, to-center, apart).
- Modes: Daily Game (seeded by date — everyone gets the same board), Classic, Classic Relaxed.
- Combo scoring, time bonus, stars, Hint / Shuffle / Firecracker power-ups.
- Friendly dragon mascot whose eyes follow your cursor and reacts to play.
- All sound and music synthesised with WebAudio.

## Run locally
ES modules need a local web server (opening the file directly will not work):

```bash
cd docs
python3 -m http.server 8000
# then open http://localhost:8000
```

## Structure
```
docs/
  index.html        game
  assets.html       art presentation sheet
  css/              tokens.css (design tokens) · ui.css (UI kit) · game.css · assets.css
  js/               main · game · board · pathfinding · tiles · dragon · logo · ui · icons
                    art · background · fx · audio · export · util
```

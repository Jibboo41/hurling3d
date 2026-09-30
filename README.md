# Hurling 3D

A browser-based 3D hurling game built with [Three.js](https://threejs.org/) (vendored in `vendor/`, no build step).

## Run

```sh
python3 -m http.server 8765
```

Then open <http://127.0.0.1:8765/>. (Any static file server works; ES modules can't be loaded from `file://`.)

## Play

7-a-side, 5-minute match. You play as the **Maroons** attacking the right-hand goal against the AI **Sky Blues**.

| Key | Action |
| --- | --- |
| W A S D / Arrows | Move |
| Shift | Sprint |
| Space (hold & release) | Lofted strike — over the bar for a point (1) |
| X (hold & release) | Low drive — under the bar for a goal (3) |
| E | Hand pass to a teammate |
| Space (without the ball) | Hook / tackle the ball carrier |
| Q | Switch to the player nearest the sliotar |
| C | Toggle camera (behind / broadcast) |
| P / Esc | Pause |

While charging a strike, the power bar shows whether the shot is on target and a ring marks where it will land.
Scores use GAA notation: `goals-points (total)`.

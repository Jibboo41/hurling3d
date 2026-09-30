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
| Tab / Shift+Tab | Cycle through your outfield players |
| T | Toggle auto-switch (on by default) |
| C | Toggle camera (behind / broadcast) |
| P / Esc | Pause |

While charging a strike, the power bar shows whether the shot is on target and a ring marks where it will land.
The camera follows the sliotar. When your controlled player is off screen, an arrow at the screen edge points to them.

Every player has attributes — **speed, striking, passing, tackling, stamina** (and **keeping** for goalies) — shown on the player card. They affect run speed, shot power/accuracy, pass accuracy, tackle success, how quickly players tire (sprinting drains the energy bar) and save chance. Hand-passing switches control to the receiver.

Players animate their pickups: a jumping catch for high balls, a one-handed reach for mid-height ones, a crouching hurley scoop to lift the sliotar off the ground (also used for frees), and a full-stretch dive for keeper saves. Expect turf spray, dust, blinks and strike sparks too.

Scores use GAA notation: `goals-points (total)`.

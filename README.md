# Arc Light Pinball

A neon arcade pinball table in the browser. Charge the plunger, time the flippers, and chain bumper hits before the ball drains.

## Play

```bash
npm install
npm run dev
```

Open the printed local URL (default `http://127.0.0.1:4821`).

Production build:

```bash
npm run build
npm run preview
```

## Controls

| Action | Keys | Touch |
| --- | --- | --- |
| Left flipper | `Z`, `←`, left shift | Left |
| Right flipper | `X`, `→`, right shift | Right |
| Both flippers | Shift | — |
| Plunge | Hold `Space` or `↓`, then release | Plunge |
| Start | `Enter` / `Space` / Press Start | Press Start |

## Rules

- 3 balls per game.
- Pop bumpers, slingshots, standup targets, and A-R-C rollovers all score.
- Complete A-R-C to raise play multiplier (up to 4×).
- Hit the left target bank or the right standup to light **kickback** in the left outlane.
- Skill shot: immediately after launch, roll the lit A-R-C lane.
- Extra ball at 50,000 points.

High score is stored in this browser (`localStorage`).

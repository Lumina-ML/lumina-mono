# Screenshots & Demo Media

Placeholder for the visual assets called out in `docs/MVP-Roadmap.md` §MVP-3.
Once captured, drop files under `docs/screenshots/` and reference them
from the top-level `README.md`.

## Recommended captures

The hero shot should tell the MVP story in one frame. Suggested minimum:

| File | What it shows | Capture recipe |
|------|---------------|----------------|
| `hero-overview.png`            | Workspace Overview after the demo cards have been clicked once | Login → workspace home → click `Try it` on the **Sweep** card → land on the Sweep detail page → go back to home and screenshot |
| `run-detail.png`               | Run detail with metric charts populated | From the home, click **Try it** on the **Basic** card → land on the first run → screenshot |
| `trace-waterfall.png`          | Trace detail with span waterfall | Click **Try it** on the **Trace** card → land on the trace → screenshot |
| `evaluation-detail.png`        | Evaluation detail with linked dataset + model artifacts | Click **Try it** on the **Evaluation** card → land on the evaluation → screenshot |
| `artifact-detail.png`          | Artifact detail with versions + lineage | Click **Try it** on the **Artifacts** card → land on the artifact → screenshot |
| `demo-banner.png`              | Project list page with the "Try our demo project" banner visible | Visit `/projects` on a fresh install before dismissing the banner |

All captures should be at 2× device pixel ratio and cropped to the
content frame (no chrome). Recommended width: ~1440px.

## Demo video

A 3-minute walkthrough covering: (1) install + first boot, (2) one
demo card click, (3) navigating from run detail to metric chart, (4)
resetting demo data, (5) inviting a teammate. Drop the file at
`docs/screenshots/demo.mp4` and reference it from the top-level
README.

If you can't record video, the static captures above are an acceptable
substitute — link the gallery instead of an embedded player.

## How to capture

1. Run `docker compose up` from the repo root.
2. Wait for the banner: `Lumina server ready`.
3. Open `http://localhost:3000` and sign in.
4. Run through each "Try it" card so the demo project is populated.
5. Use OS screenshot tooling (macOS: `Cmd+Shift+4`; Linux: `gnome-screenshot`).
6. Save into `docs/screenshots/` using the names above.

For the demo video, macOS users can use QuickTime Player → File →
New Screen Recording (then trim with `Cmd+T`). Linux: `ffmpeg -f x11grab`.

## Why this lives outside `apps/dashboard/`

The screenshots are project-wide marketing material, not dashboard
source. The top-level `SCREENSHOTS.md` keeps the recipe discoverable
without polluting the dashboard workspace.
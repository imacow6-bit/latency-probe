# ALFRED

**Autonomous Lifestyle Framework for Responsive Environments and Devices**

A single static web page that acts as a fictional JARVIS-style AI-assistant
display for filming — a glowing concentric-ring "core", live-looking telemetry
(weather, clock, memory, CPU, network, heartbeat), and a spacebar-driven
playback rig so an operator can make ALFRED "speak" pre-recorded lines on cue.

No frameworks, no build step, **zero external requests** — it runs deployed on
a host *or* straight from a local copy, fully offline.

## Controls

| Key | Action |
| --- | --- |
| **Space** | Play the next voice line in the sequence (wraps at the end) |
| **Backspace** | Replay the previous line |
| **R** | Reset the sequence to the start |
| **F** | Toggle fullscreen |
| **H** | Hide/show the operator overlay (counter + hints) |
| **Esc** | Exit fullscreen |

The cursor auto-hides after a couple of seconds of no movement. A tiny
`current / total` phrase counter sits at the bottom for the operator; press
**H** to hide it before rolling camera.

## Audio

Put numbered voice lines in [`audio/`](audio/) — `01.mp3`, `02.mp3`, … — and
they play in order on each spacebar press. See [`audio/README.md`](audio/README.md)
for naming rules and tips on generating the voice. No audio yet? Run
`python3 audio/make-placeholders.py` for a few test tones (the page also runs
fine with no audio at all).

## Display / filming setup

Designed for a **portrait** screen — the layout is a fixed `1080 × 1920`
canvas that auto-scales to fit whatever window or monitor it's on, so it looks
right on a rotated display. Pair it with the "smoked acrylic in front of a
black-background monitor" trick for the floating-hologram look; dim the room and
add an edge LED strip for extra glow.

## Running it

**Deployed (Vercel):** point Vercel at this repo — it's a static site, no build
config needed. `vercel.json` is included.

**Locally (offline on set):** clone or download the repo, then either:

```bash
# option A — a tiny local server (most reliable)
npx serve .
#   or
python3 -m http.server 8000
```

Then open the printed URL.

**Option B — just double-click `index.html`.** It's built to work from
`file://` too (relative paths, `loadedmetadata` fallback for audio probing),
though a local server is the most predictable if a browser gets fussy about
`file://` autoplay.

## Files

```
index.html   markup / HUD structure
styles.css   all styling + animations
app.js       scaling, audio rig, telemetry, keyboard
audio/       numbered voice lines (+ placeholder generator)
vercel.json  static-host config
```

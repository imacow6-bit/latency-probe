# ALFRED

**Autonomous Lifestyle Framework for Responsive Environments and Devices**

A single static web page that acts as a fictional JARVIS-style AI-assistant
display for filming. It's built **portrait-native** for a vertical wall
monitor: an architectural HUD with a large animated "neural iris" core,
live-looking telemetry (weather, clock, memory, CPU, network, heartbeat), and a
spacebar-driven playback rig so an operator can make ALFRED "speak" pre-recorded
lines on cue.

No frameworks, no build step, **zero external requests** — it runs deployed on
a host *or* straight from a local copy, fully offline.

## States

ALFRED isn't a static dashboard — it has modes, and the screen visibly changes
between them:

| State | Look |
| --- | --- |
| **IDLE / STANDBY** | Slow breathing core, dim waveform shimmer, calm telemetry |
| **LISTENING** | Outer targeting ring brightens, a pulse expands outward |
| **PROCESSING** | Rings spin up, a radar sweep rotates over the core |
| **SPEAKING** | Core brightens, waveform goes reactive, the transcript line appears, CPU climbs |

Each **Space** press runs the full cinematic sequence — *listening → processing
→ speaking* — then settles back to idle. That lead-in is what makes ALFRED feel
alive on camera; if you want an instant response instead, the audio plays as
soon as the SPEAKING state begins.

## Controls

| Key | Action |
| --- | --- |
| **Space** | Speak the next line (runs the listening → processing → speaking sequence) |
| **Backspace** | Speak the previous line |
| **R** | Reset to the start (idle) |
| **1 / 2 / 3 / 4** | Force a state — Idle / Listening / Processing / Speaking (rehearsal) |
| **O** | Cycle screen rotation — Auto / 0° / 90° / 270° |
| **F** | Toggle fullscreen |
| **H** | Hide/show the operator overlay (counter + hints) |
| **Esc** | Exit fullscreen |

The cursor auto-hides after a couple of seconds. A tiny `current / total` phrase
counter sits at the bottom for the operator — press **H** to hide it before
rolling camera.

## Audio & transcripts

Put numbered voice lines in [`audio/`](audio/) — `01.mp3`, `02.mp3`, … — and
they play in order. See [`audio/README.md`](audio/README.md) for naming rules and
tips on generating the voice. No audio yet? Run
`python3 audio/make-placeholders.py` for a few test tones — the state sequence
works even with no audio at all.

On-screen captions live in [`transcripts.js`](transcripts.js): line _N_ there
pairs with `audio/0N.mp3` and appears in the dialogue zone while ALFRED speaks.
Edit that array to match your lines, or leave it empty for no captions.

## Display / filming setup

Built for a **portrait** monitor. The layout is a native `9:16` composition
sized in container units, so it renders at the screen's real resolution (crisp
at 1080×1920 *or* a higher-res panel) and fills the display edge-to-edge.

**Rotation is handled for you.** If the OS is still outputting landscape to a
physically rotated monitor, the page detects the landscape signal and renders
itself rotated 90° so it appears upright on the sideways screen — no OS display
settings needed. Press **O** to cycle rotation modes (Auto / 0° / 90° / 270°) if
your monitor is turned the opposite way. Rotating the display in the OS instead
also works — the page then just renders normally.

For the cleanest look on set:

- Press **F** for **fullscreen** (hides browser chrome, address bar, taskbar)
  and **H** to hide the operator overlay.
- Pair it with the "smoked acrylic in front of a black-background monitor" trick
  for the floating-hologram look; dim the room and add an edge LED strip for glow.

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
index.html      HUD structure (header, diagnostics, core, dialogue, footer)
styles.css      styling, framing, animations, per-state overrides
app.js          state machine, audio rig, telemetry, keyboard
transcripts.js  on-screen caption lines (editable)
audio/          numbered voice lines (+ placeholder generator)
vercel.json     static-host config
```

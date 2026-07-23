# ALFRED audio

Drop numbered voice lines here. ALFRED plays them **in order** each time the
operator presses **SPACEBAR**.

## Naming

```
audio/
  01.mp3
  02.mp3
  03.mp3
  ...
```

- Zero-padded, two digits: `01`, `02`, … `10`, `11` …
- The sequence stops at the **first missing number** (so no gaps).
- Accepted extensions, in priority order: **`.mp3`**, `.wav`, `.m4a`, `.ogg`.
  (If both `01.mp3` and `01.wav` exist, the `.mp3` wins.)
- Reorder or swap lines by renaming files — no code changes needed.

## Placeholders (optional)

Want the rig to make noise before you have real lines? Generate three
placeholder tones:

```bash
python3 audio/make-placeholders.py     # writes 01.wav, 02.wav, 03.wav here
```

Delete them once you add real audio, or just drop `01.mp3`, `02.mp3`, …
alongside them — the `.mp3` files take priority. With no audio at all, the
page still runs fine; it just shows a small "no audio found" note for the
operator.

## Making the voice lines

Easiest path is a TTS service (e.g. ElevenLabs) with a posh/butler voice —
export MP3s and name them as above. Recording a real voice works too.

Suggested opening lines for a JARVIS-style butler:

1. "Good evening. All systems are online and functioning within normal parameters."
2. "The residence is secure. Environmental controls are set to your preference."
3. "Current conditions are seventy-two degrees and partly cloudy. A pleasant evening ahead."
4. "Shall I run the morning briefing?"

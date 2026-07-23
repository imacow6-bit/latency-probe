#!/usr/bin/env python3
"""Generate placeholder tone files (01.wav, 02.wav, 03.wav) in this folder so
ALFRED's spacebar rig works before you have real voice lines.

Usage:
    python3 audio/make-placeholders.py

Delete the generated .wav files (or just drop real 01.mp3, 02.mp3 ...
alongside them — .mp3 takes priority) once you have your actual audio.
"""
import math
import os
import struct
import wave

HERE = os.path.dirname(os.path.abspath(__file__))


def tone(name, seconds, freqs, vol=0.28):
    rate = 44100
    n = int(rate * seconds)
    path = os.path.join(HERE, name)
    w = wave.open(path, "w")
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(rate)
    frames = bytearray()
    for i in range(n):
        t = i / rate
        s = sum(math.sin(2 * math.pi * f * t) for f in freqs) / len(freqs)
        env = min(1.0, t / 0.03, (seconds - t) / 0.08)  # fade in/out
        frames += struct.pack("<h", int(max(-1, min(1, s * env * vol)) * 32767))
    w.writeframes(bytes(frames))
    w.close()
    print("wrote", name)


if __name__ == "__main__":
    tone("01.wav", 1.2, [330, 440])
    tone("02.wav", 1.6, [392, 494, 587])
    tone("03.wav", 1.0, [262, 349])
    print("Done. Open the page and press SPACE to hear the placeholders.")

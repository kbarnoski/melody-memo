# 17024-inkpressure

**Status:** demoable. Loads fast, the primary action plays Karel's real recording and the calligraphic ink stroke visibly swells and thins with his dynamics, and it degrades to a live-envelope fallback when note analysis is unavailable.

## The one question

Can you **see the weight of Karel's touch** — the physical dynamic pressure of his real piano playing — as living **ink under variable pressure**: a calligraphic line that swells black-heavy where he leans in and thins to a dry hair where he lifts, with the harmony *not* the subject?

This is deliberately a **non-chord** piece. The subject is **dynamics / velocity / the weight of touch**, not consonance or tension. Nothing here is "about the chord."

## How it works

- His real recording plays (one decoded `AudioBufferSourceNode`, routed only through `createSafeMaster` — no synth, no oscillator, no noise, no `Math.random` in the audio path).
- The animation walks his **per-note velocities** from `loadTrackAnalysis` against playback time and builds a **recency-weighted dynamic-pressure envelope** `P`: notes in the last ~1.7 s are averaged with an exponential recency weight (τ ≈ 0.5 s). Velocities are normalized whether the source is 0..1 or 0..127.
- One inline-**SVG** calligraphic brush self-propels left-to-right (time → path length). Its **half-width and darkness track `P`** — forte presses a thick, near-black ink body; pianissimo thins to a pale dry hair; a full lift decays to a hairline and scatters a few specks of light. Width is *geometry* (a variable-width filled-ribbon `<path>`), so the swell/thin reads even with the sound off.
- The ink is layered for recency: a low-opacity **settled body** (the whole stroke) under a heavy, dark **wet tail** (the recent ~150 points). A restrained **violet** accent fades in *only* at peak weight (`P > ~0.72`).
- **Velocity spread** (recency-weighted std-dev) widens the brush's flourish/tremor — a wide dynamic range makes a more expressive, varied stroke; a flat even touch makes a steady even line. **Note density** steers the pen's turns, and pauses slow it — echoing calligraphy, where pressure, speed and pauses are inseparable from the mark.
- The live `safeMaster.analyser` (RMS) adds only a subtle tremor/pulse to the **wet tip**, so it feels locked to the sound; the *structure* (weight) is his note velocities, not the FFT.
- Rendering stays cheap: three ribbon `<path>` nodes plus a blurred bleed underlay and ~20 scatter dots, all mutated per frame via refs and a group `transform` — never thousands of re-rendered React nodes.

Palette: charcoal/graphite ink on a **cool** pale ground, one restrained violet at peak weight. Ink-on-cool-ground — not warm/ember, not bright-cosmic, not a near-black typographic manuscript.

## Named references

- **Calliphony: A Calligraphy-Driven Interface for Real-Time Generative Music Performance** (arXiv 2608.03040, Aug 2026) — "the subtle dynamics of pressure, speed, pauses and turns are inseparable from the final written form." This piece runs that fusion in reverse: his touch writes the line.
- **"Visualising Pianists' Touch: Transcribing Expressive Piano Performance from Audio to Piano Key Motion"** (CHI 2026) — transcribes touch, timing and dynamic control from audio; MIDI/velocity alone misses the full expressive gesture.
- The **2026 finding** that velocity **spread / standard deviation** is the clearest positive marker of expressive performance quality — here it drives the calligraphic flourish, so a wider dynamic range literally makes a more expressive stroke.

## Degrade & safety

- **Analysis null / empty notes** → the pressure envelope is derived from the live analyser RMS instead, and a `live-envelope fallback` badge appears. The line still swells and thins, just from loudness rather than transcribed velocity.
- **`prefers-reduced-motion`** → slower draw, no wet-tip tremor, gentler meander. No strobe or flicker anywhere; all transitions are smoothed.
- Full teardown on unmount: source stopped, master disconnected, rAF cancelled, `AudioContext` closed.

## Honest caveats

- Velocity is a *transcription* of touch from audio, not a direct pressure sensor, so the CHI-2026 point stands: it approximates the gesture rather than capturing every nuance of it.
- The pen's meander/turns are a legibility aid (they keep the stroke on-paper and give it calligraphic life); density and spread modulate them, but the *load-bearing* channel is width/darkness = pressure. Read the width first.
- Loudness-based fallback conflates dynamics with sustain and pedal, so it is a coarser read of "weight" than his transcribed velocities.
- With sound muted the width contour still reads, but the wet-tip tremor (the only FFT-driven element) goes quiet — by design.

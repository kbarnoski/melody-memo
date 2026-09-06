# Nodal Figure

**Status:** demoable

_What if you could SEE the consonance of Karel's chords as a single drawn figure — a harmonograph whose symmetry LOCKS into a clean closed loop when his harmony is consonant, and frays into a slowly-drifting open web when it's tense — rendered as living SVG vector ink you can perturb with a fingertip?_

## The one idea

The centre of the screen holds one evolving **harmonograph** — a parametric curve traced by summed decaying sinusoids:

```
x(t) = Σ Aᵢ · sin(fᵢ·t + φᵢ) · e^(−dᵢ·t)
y(t) = Σ Bᵢ · sin(gᵢ·t + ψᵢ) · e^(−dᵢ·t)
```

The pendulum frequency ratios `fᵢ:gᵢ` are read from the **just-intonation intervals of the chord sounding in Karel's real recording**, walked against playback time. Each active scale degree maps to a small-integer ratio: unison 1:1, minor third 6:5, major third 5:4, perfect fifth 3:2, major seventh 15:8, and so on.

- **Consonant chords** resolve to simple small-integer ratios → the summed curve is periodic → it retraces **one clean, closed, symmetric loop**.
- **Dissonant / extended / altered chords** push the ratios toward irrational detunings (a dissonance scalar drives a per-voice detune) → the figure **never closes**, precessing into an open lacework and fraying faster (higher damping).

That visible _"does it close or drift"_ read literally visualizes the consonance of his harmony, moment to moment. Consonance is also surfaced as a live percentage and a `closing` / `drifting` label.

## What honestly makes it new

This lab already has `291-harmonograph`, so harmonograph itself is **not** claimed as a lab-first. The honest framing:

> the first piece where the harmonograph's frequency ratios **are** the just-intonation intervals of Karel's sounding chord — so the figure's closure literally visualizes the consonance of his real recording — and the first rendered as **live SVG vector ink** (real `<svg>` `<path>` elements rebuilt each frame), not canvas or WebGL.

## Subsystems (≥3)

1. **Catalog loader/decoder** — `loadRealTrackBuffer` fetches + decodes one of Karel's real takes (Welcome Home / Snowflake). No synthesis of any kind; his recording is the only sound source.
2. **FFT / RMS engine** — reads `safeMaster.analyser` byte spectrum each frame; RMS energy drives traced-point count (~640–1600, capped for phones), stroke weight, opacity and the centre glow.
3. **Time-matched chord tracker** — walks `analysis.chords[]` against `ctx.currentTime − startTime` to find the sounding chord; degrades to a slow default progression (with a notice) when a take has no published analysis.
4. **Just-intonation ratio → harmonograph engine** — a heuristic chord-symbol reader derives the interval set + a sensory-dissonance scalar, mapped to per-axis pendulums whose detuning decides closure vs. drift.
5. **SVG vector renderer** — three layered `<path>` elements (main + two fading ghost-trail frames) plus a glow circle, their `d` rebuilt imperatively each `requestAnimationFrame`.
6. **Touch / pointer perturbation** — a fingertip or pointer drag nudges the pendulum phases (x) and damping (y); the perturbation decays back when released, so you feel like you're bending the standing wave.

## Palette & house style

Luminous **cool cyan→violet vector light** (hue compressed into ~178–288°) on the dark Resonance ground — bright drawn light, never warm/ember, never a multi-hue starfield, never dim typography. The chord root sets hue via `pitchClassHue` (remapped into the cool band); minor chords cool and desaturate. All chrome uses semantic tokens (`foreground` / `muted-foreground` / `primary` / `destructive` / `border` / `accent`), Geist sans + mono only, no film grain, no strobe — the figure evolves by slow precession.

## Audio safety

Every audible node terminates at `createSafeMaster(ctx).input`; nothing touches `ctx.destination` directly. Full teardown on unmount and on Stop: cancel RAF, stop + disconnect the source, `master.disconnect()`, `ctx.close()`, and pointer handlers are React-managed so they detach with the element.

## Named references

- **Ernst Chladni's _Klangfiguren_** (1787) — sand scattered on a bowed plate settling along the nodal lines of a standing wave; the original picture of "sound made visible."
- **The Victorian harmonograph** — coupled pendulums drawing the Lissajous figures of musical intervals, closing cleanly for simple ratios and precessing for complex ones.
- **VectraSynth (2026)** — a browser tool generating real-time audio-reactive SVG art from "contour lines tracing 2D standing-wave fields," the contemporary evidence that real-time generative SVG is a live 2026 frontier.

## Degrade paths

- Audio fails to load → on-brand `text-destructive` notice, clean teardown.
- No published analysis → fallback progression + a muted notice; the figure still traces.
- SVG is universally supported; guards prevent any unhandled throw.

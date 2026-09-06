# TENSE THREAD — tonal tension as a physical force on a hanging web of light

**Status:** demoable

## Why open this

Because you can *watch Karel's harmony pull on something.* A suspended web of
luminous filaments hangs in a dark space and plays one of his real piano takes.
When the harmony is consonant the web relaxes into a calm pearl-silver shimmer;
when it tenses, the web is stretched taut, sheared, set trembling, and reddened —
so the whole track becomes one long-form tension arc you can literally see breathe.

## What it does

- Plays **one of Karel's real catalog takes** (Welcome Home / Snowflake), chosen
  from a small selector. Single `AudioBufferSourceNode` → the shared ear-safety
  master (`createSafeMaster`). Zero synthesis, zero oscillators, nothing to
  `ctx.destination`.
- Renders a three.js **web / veil**: an indexed net of ~3,500 vertices
  (`NX·NY = 76·46`) drawn as line segments plus additive glowing points, sharing
  one position + color buffer.
- Camera **orbits** the web. Pointer-drag is the baseline steering; mouse wheel
  zooms; DeviceOrientation (gyro) is a bonus that no-ops if unavailable.

## The tension mapping (the heart of it)

Each animation frame computes a continuous **tonal-tension scalar `tension ∈ [0,1]`**
from the harmony sounding *right now*:

1. **Active pitch-classes.** Binary-search the time-sorted `notes[]` for the last
   onset at/behind the playhead, then walk backward a bounded window collecting the
   notes still sounding (`time ≤ play ≤ time + duration`). Add the current chord's
   root from the chord tracker. This is the *actual* sounding harmony, not a guess.
2. **Circle-of-fifths embedding.** Each pitch-class `pc` is placed at angle
   `((pc·7) mod 12)·30°` on the circle of fifths.
3. **Angular spread = tension.** We take the resultant-vector length `R` of those
   unit vectors and use the **circular variance `1 − R`**. A tight cluster on the
   circle of fifths (a consonant, closely-related set) → `R ≈ 1` → low tension. A
   wide spread (tritones, clusters, remote pitch-classes all sounding at once) →
   `R ≈ 0` → high tension.
4. **Quality bump.** Minor / diminished chords add a small tension bump; very
   sparse sets (1–2 notes) are scaled down so a lone note reads as calm.
5. **Smoothing.** The scalar glides toward its target with a ~0.3s time constant
   (`1 − exp(−dt/τ)`), so it never snaps.

That scalar then drives the **force and the color**:

- **Force (geometry).** Tension stretches vertices outward along both axes, pulls
  the hanging catenary sag flat (taut), applies a lateral **shear**, corkscrews the
  sheet with a `|v|`-weighted **twist**, and adds high-frequency **tremble** that
  grows as `tension²`.
- **Color.** `computeTensionColor` travels **pearl/silver → violet → red**, with the
  destructive red bled in (via a `smoothstep`) *only* above ~0.6 tension. Per-vertex,
  filaments under high local **strain** are mixed hotter/redder, so the sheared
  regions glow where the force is greatest.
- **RMS** (from `master.analyser` time-domain data) breathes the whole web (scale +
  point-glow + line opacity). **Spectral bands** (frequency data folded into `NY`
  rows) ripple individual rows of filaments.

## Named references

- **Herremans & Chew — "A Computational Model of Tonal Tension"** (the Tonal
  Interval Space tonal-tension model). Our circle-of-fifths circular-variance
  measure is a cheap, honest cousin of TIV-space tension: both read tension from
  where the sounding pitch-classes sit in a fifths-based geometry.
- **arXiv 2511.19342** (Nov 2025) — explicit tonal-tension conditioning for music
  generation; the same "tension as a controllable continuous scalar" framing.

## Limitations (honest)

- The tension measure is **not full TIV space.** Real Tonal Interval Vectors weight
  all six interval classes in a 6-D space; we use only the circle-of-fifths angle
  (one of those six dimensions) plus a minor/dim bump. It captures fifths-spread
  dissonance well and is cheap per frame, but it will read some voicings (e.g.
  wide-but-consonant open spacings vs. tight clusters) less precisely than the real
  model.
- **Analysis-dependent.** Tension is only truly harmonic when `loadTrackAnalysis`
  returns data. Without it, the piece falls back to a **spectral-brightness proxy**
  (centroid → tension) — it still moves and reads as "busier = tenser", but it is no
  longer literally tonal tension. The HUD says which source is live.
- **Note-window heuristics.** Active-note collection walks a bounded backward window
  (96 notes / 6s) and treats a note as sounding until `time + duration`; pedal
  sustain and release tails aren't modeled, so very dense passages may under- or
  over-count the held set slightly.
- **No pitch tracking of the audio itself.** Tension comes from the pre-computed
  analysis timeline synced to playback position, not from real-time pitch detection
  of the waveform — so if analysis timing drifts from the recording, tension drifts
  with it.
- **CPU per-frame vertex work.** ~3,500 vertices updated on the CPU each frame is
  smooth on a laptop/modern phone but is the main cost; very old devices may drop
  frames. A vertex shader would move this to the GPU (deliberately left on the CPU
  here for legibility).
- Rendering degrades to an on-brand notice if WebGL is unavailable (audio keeps
  playing); audio-load failures surface in `text-destructive`.

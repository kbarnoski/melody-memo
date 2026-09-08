# 17088 · voice loom

**Status:** demoable prototype — autonomous playback, Canvas2D, Karel's real catalog only.

## The one question

What if the counterpoint inside Karel's real piano recording were **woven** — each
independent voice a thread on a loom, so when two voices move against each other
(contrary motion) the weave crosses and tightens, and when they move together
(parallel) the threads run straight and calm?

This is a voice-leading / stream-separation piece. It takes Karel's already-recorded
polyphony — the note roll from `/api/recordings/[id]/analysis` — and separates it,
causally, into independent moving melodic lines, rendering the *texture* of their
interaction as a woven fabric. In ~15 seconds with the sound off you should be able to
see that these are separate voices, and *when* they move together versus against each
other.

## How the causal voice assigner works

Playback is driven by `playhead = ctx.currentTime - startTime`. Each frame we advance an
index pointer over the time-sorted note roll, consuming only notes with
`note.time <= playhead` — **past and present only, no look-ahead**. This causal discipline
is the point: the same algorithm would run on a live performance.

- **Clustering.** Notes whose onsets fall within a ~40 ms window are collected as one
  chord. A cluster is flushed (assigned) only once it is provably closed — the playhead
  has passed its window, or a later note has appeared — so it stays causal and complete.
- **Assignment.** The cluster is sorted high → low and matched to up to five active voices
  so as to **minimise pitch movement while preferring no voice-crossing** — the highest
  note goes to a high voice, and with spare voices we may skip a voice to reach a closer
  pitch match as long as order is preserved. This is the horizontal/vertical
  integration–segregation principle of Cambouropoulos' voice-separation algorithm for
  symbolic music.
- **Birth / death.** More notes than active voices spawns a new voice — a fresh thread
  enters the warp. A voice that receives no note for more than ~1.6 s goes dormant, frays
  its thread out over ~1.1 s, and frees its slot.

## How the motion detector works

After each cluster assignment, the two most-active voices (largest pitch deltas) are
compared by the **sign** of their movement:

- same sign → **parallel** (threads keep their gap, calm)
- opposite sign → **contrary** (threads converge and cross)
- one held → **oblique**

The rendered weave reflects this directly: where two threads cross in pitch they
interlace over-under (alternating, so it reads as a true weave) and a knot marks the
crossing. The per-frame crossing density plus the motion type drive the undulation
amplitude — contrapuntally busy, contrary passages visibly tighten and knot; parallel
passages lie flat. The topmost living voice is drawn in the single violet accent.

Degradation: if the buffer fails to load, an on-brand `text-destructive` error shows and
nothing plays. If the analysis is null, audio still plays and the weave glow is derived
from the `safeMaster` analyser (a note reads "no note analysis — audio only").

## References

- E. Cambouropoulos — voice-separation for symbolic music via horizontal (pitch-proximity)
  and vertical (synchrony / no-crossing) integration and segregation principles.
- A. S. Bregman — *Auditory Scene Analysis: The Perceptual Organization of Sound* (MIT
  Press, 1990) — auditory streaming, the perceptual basis for hearing polyphony as
  separate lines.

## Tags

- **input:** autonomous (press Play, it runs itself) + a track selector; Play/Pause
  transport. No pointer-drag, no keyboard driver.
- **output:** Canvas2D only (no WebGL / three.js / WebGPU / SVG).
- **technique:** causal, cluster-based voice-leading assignment with a per-frame
  contrary/parallel/oblique motion detector; over-under interlace weave whose tightness
  encodes contrapuntal activity.
- **palette:** warm-neutral ink — parchment-dark ground, threads graphite → sepia →
  pale-gold, one violet accent for the soprano voice.
- **audio:** Karel's real catalog only (default "Bath"), one `AudioBufferSourceNode`
  through `createSafeMaster`, never `ctx.destination`, zero synthesis.

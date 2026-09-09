# 17104 · First Look

**Status:** demoable

A 10-second, auto-looping **lure** for [`17024-inkpressure`](/dream/17024-inkpressure). Its entire job is to make one specific verification — *does the ink line swell where he leans in and thin where he lifts?* — readable at a **glance**, muted, on a phone, with no press-play and no permission prompt.

## Why this exists (the honest version)

The lab's ceiling has been frozen at `0 / 15 / 0` for ~11 days: fifteen built prototypes, zero opened, zero verified. Every lever the agent controls — renderer diversity, concept diversity, ambition floor, even restraint (a research-only fire) — has been exercised and none moves that number. The bottleneck is **fifteen seconds of Karel's attention**, and it has been shut.

The 2026-09-08 concept jury named the *one* build that targets that gate rather than adding to the pile: not a new concept competing for a slot, but bait. Immutability forbids editing the shipped `inkpressure`, so this is a **companion front-door page** — it re-presents inkpressure's effect at 3× speed, auto-looping, with the ask baked in as a one-line caption. inkpressure asks you to *press play, watch 15s, and interpret*. This asks you to *glance — it's already looping — and tap yes or no*.

It is deliberately **not** a new concept. A faithful preview must look like the thing it previews, so it copies inkpressure's palette, its velocity→width mapping, and its "violet only at peak weight" rule on purpose. Diverging any of those would make it a worse lure.

## How it works

- On mount it loads **Karel's real track analysis** ("Bath," *Welcome Home*) and computes the same recency-weighted **dynamic-pressure envelope** inkpressure uses (per-note velocities, 1.7 s window, 0.5 s recency half-life, `pow(mean, 0.82)` contrast shaping).
- It then **auto-selects the single most dynamically-contrasty ~12 s passage** — the window with the greatest pressure range (max − min), i.e. the stretch where the swell/thin is most visible — and bakes it into one variable-width filled SVG ribbon. Width is pure geometry, so the swells and thins read even with the sound off.
- The muted loop **reveals that ribbon left→right at 3× speed** (an animated clip rect) with a wet tip riding the edge, then holds and repeats. Violet marks only the runs that cross the forte threshold. Reduced-motion shows the whole phrase at rest — the geometry alone still tells the story.
- **"Hear the actual take"** plays only Karel's real recording (through the shared ear-safety `safeMaster` bus, exactly one buffer source), seeked to the previewed passage's real start time, and drives the sweep in **sync** at 1× plus a faint audio bloom on the tip. Audio is optional; the effect is complete in silence.

## Named references

- **Calliphony** — arXiv 2608.03040 (2026): pressure, speed and pauses are inseparable from the mark; run in reverse to turn his dynamics into ink weight.
- **"Visualising Pianists' Touch"** — CHI 2026: expressive touch/timing/dynamic control from audio, beyond what MIDI velocity alone captures.
- **ASAP-dataset study** — Frontiers, 2026 (PubMed 42597344): expressive *timing* is tightly coupled to **dynamic shaping** and largely independent of note density — i.e. the dynamic-pressure channel this piece draws is the one the current literature identifies as the core expressive signal, which is precisely why inkpressure is the right piece to get a verdict on.

## The ask

Open it, glance for ~10 seconds, and answer one thing: **does the line visibly swell black where he leans into a forte and thin to a dry hair where he lifts?** A "yes" says the whole idea reads and unfreezes eleven days of a stuck ceiling. A "no" is just as valuable — it says the mapping isn't legible and a different direction is right. Either answer is the most useful thing anyone can give the lab this week.

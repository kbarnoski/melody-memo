# 16992 · vaultloom

**Status:** demoable

## Concept

What if Karel's harmony wove *architecture* — literal Xenakis ruled-surface vaults
lofting into being over the length of a piece, so the finished space is the shape of
the whole performance? This prototype is deliberately about musical **form over
time**, not the consonance of a single chord. As one of Karel's real takes plays,
each section or strong chord change lofts a new **ruled-surface vault**: a
hyperbolic-paraboloid saddle panel built from a family of *straight generatrix
lines* strung between a ground arc and a raised, inset apex arc. Successive vaults
nest further out and higher, so minute four is a materially bigger nave than minute
one, and the accreted built space *is* the piece. Slender colonnade pillars are
secondary — they mark where each vault lands. You look around the growing nave by
tilting your phone (gyro primary); pointer-drag is only a fallback when the gyro is
denied.

The distinguishing bet of this version: the **ruled surface is the star**. Every
vault is a curved sheet swept from straight lines, and we render both the
translucent stone shell *and* the straight generatrices over it, so the Xenakis
"curve made of straight lines" idea stays visually legible rather than implied.

## How it works

- **Ruled surfaces.** For each vault we take two guide curves — `ground(u)` (an arc
  at radius `Rg`, on the floor) and `apex(u)` (an arc at a smaller radius `Ra`,
  raised to height `H` and angularly skewed by `twist`). For every `u` the straight
  generatrix connects `ground(u)` → `apex(u)`; sampling `v` along that line builds a
  `BufferGeometry` grid. Because the two guide arcs are skew, the swept surface is a
  hyperbolic paraboloid — the Philips Pavilion element.
- **Growth over time.** All vaults share ONE shell geometry and ONE line geometry.
  Each vertex carries `aStart` (its collapsed position, flat on the ground arc),
  `aEnd` (its full ruled-surface position), and `aBirth` (when it should loft, with
  an along-arc offset so a growth front sweeps `u` 0→1). A single global
  `uGrowFront` uniform advances in piece-seconds; the vertex shader lofts each vault
  via `mix(aStart, aEnd, smoothstep(aBirth, aBirth+uLoft, uGrowFront))`. This is
  allocation-free, coherent, and instantly replayable — no per-frame geometry
  rebuilds, no per-vault JS timers.
- **Audio breath.** A shared world-space field `sin(dot(worldPos, dir) - uAudioPhase)`
  driven by the master RMS pulses the whole structure coherently, with no per-vertex
  state.
- **Auto-demo.** On the first Play, a ~20s compressed pass lofts the first several
  vaults quickly (so the growth reads at once), then `uGrowFront` hands off to the
  real playhead and continues in real time. Growth is monotonic, so the finished
  space persists once the take loops.

## Mapping

| Musical feature | Architectural response |
| --- | --- |
| New section / strong chord change | Lofts a new vault, nested one course further out **and** higher |
| Chord **root** (pitch-class) | Hue, via `pitchClassHue` remapped into a cool cyan→violet limestone band |
| **Minor / diminished** mode | Cooler, **steeper** and darker saddle (more height, more twist, lower lightness) |
| **Bass** energy (low notes near birth) | Vault **span / mass** — wider arc, greater width |
| **Treble** energy (live) | Brightness of the **filigree generatrix lines** |
| Master **RMS** (live) | Coherent world-space breath pulsing the whole nave |
| Running **course index** | Later vaults sit further out and higher, so the nave grows across the piece |

## Inputs, audio, palette

- **Input:** device-orientation gyro tilt to look around is primary; if the gyro is
  denied or never reports within ~1.4s, pointer-drag becomes the fallback, and the
  camera slowly auto-orbits when idle.
- **Audio:** Karel's real catalog only (Welcome Home + Snowflake), one
  `AudioBufferSource`, everything through the shared ear-safety master
  (`createSafeMaster`) — zero synthesis, never `ctx.destination`. Visuals are driven
  from `master.analyser`.
- **Renderer:** three.js standard `WebGLRenderer` (not WebGPU).
- **Palette:** cool mineral / cathedral stone — a limestone-grey ground under cool
  cyan→violet light. No near-dark, no warm ember, no bright cosmic. No film grain /
  noise overlay; atmosphere comes from emissive lines, a rim glow on the growth
  front, and exponential fog.

## References

- **Iannis Xenakis, *Metastaseis* (1954) → the Philips Pavilion (1958).** Xenakis
  derived the pavilion's vaults directly from the string glissandi of *Metastaseis*:
  a glissando is a straight line in pitch-time, and a family of them sweeps a ruled
  hyperbolic-paraboloid surface. That is the exact geometric move this prototype
  makes musical section → built vault.
- **Codrops, *Exploring Procedural Geometry with Three.js and WebGPU* (2026-08-11).**
  The single-global-growth-front technique — advancing one uniform to drive an
  allocation-free, replayable lofting animation over a static baked geometry — is
  borrowed from this article and adapted here to a standard WebGL renderer.

## Caveats / rough edges

- **Vault placement is concentric, not free-form.** All vaults share a forward-facing
  arc centered on +z at increasing radius/height. This reads clearly as a growing
  apse/nave, but it is a simplification: real cathedral naves are a corridor of bays,
  not nested arcs. A future pass could walk vaults *down* a nave axis instead of
  fanning them concentrically.
- **Bass→span uses an analysis-time proxy** (count of low notes near each vault's
  birth), not live low-frequency energy per vault; the live bands feed breath and
  filigree brightness. Structural mass is therefore fixed once a vault is planned.
- **Gyro mapping is rate-based for yaw** (tilt to pan) and eased-absolute for pitch;
  it is not a true head-tracked absolute orientation, so it can drift. Idle
  auto-orbit masks this when you set the phone down.
- **Section labels** come from `summary.sections` distributed evenly across the
  duration (the analysis gives labels, not exact timings), so the HUD section name is
  approximate. With no analysis at all, vaults fall back to an even timed cadence and
  generic phrase labels.
- **No bloom.** Emissive lines + rim glow carry the luminosity to stay cheap; on very
  bright takes the additive generatrices can slightly wash into the fog at distance.

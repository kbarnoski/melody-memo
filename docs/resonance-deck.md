# Resonance -- Pitch Deck

---

## SLIDE 1: Title

**Resonance**

*Every musical idea deserves to be understood.*

AI-powered musical analysis platform

Karel Barnoski | February 2026

---

## SLIDE 2: The Problem

**Musicians capture ideas. Then forget them.**

- Hundreds of recordings pile up unnamed in phone folders
- "What key was that in?" "What were those chords?"
- No way to search, compare, or develop ideas without picking up the instrument again
- Creative output goes unanalyzed, undeveloped, lost

*The gap between capturing an idea and understanding it is where songs go to die.*

---

## SLIDE 3: The Solution

**Resonance makes every recording self-aware.**

Upload a musical recording. Resonance transcribes it, detects the key, chords, tempo, and progressions -- then gives you an AI music theory coach to help develop it.

---

## SLIDE 4: How It Works

**1. Upload** -- Drag and drop your recordings (M4A, MP3, WAV)

**2. Analyze** -- AI transcribes notes, detects key, chords, tempo, progressions

**3. Understand** -- Teaching summary breaks down sections, harmony, and relearning tips

**4. Develop** -- Chat with AI about your music: "How do I extend this into a full piece?"

---

## SLIDE 5: Product -- What's Shipped

**Smart Library** -- Search, tag, and organize recordings with full metadata

**AI Analysis** -- Key, tempo, chords, progressions, MIDI export from any recording

**Teaching Summaries** -- AI-generated section breakdowns and relearning tips

**Music Theory Chat** -- Per-recording, comparison, and library-wide AI conversations

**Insights Dashboard** -- Musical DNA, harmonic tendencies, cross-recording patterns

**Visual Tools** -- Waveform player, chord timeline, piano roll, 8-mode WebGL visualizer

---

## SLIDE 6: Insights -- Your Musical DNA

**See patterns across your entire creative output.**

- Favorite keys and chord vocabulary
- Harmonic tendencies: "Jazz-influenced" / "Minor-key driven" / "Diatonic"
- Recurring progressions across recordings
- Similar recording pairs by key, tempo, and chord overlap
- AI-generated library clusters and standout pieces

---

## SLIDE 7: Compare -- Side by Side

**Put any two recordings head to head.**

- Metrics comparison: key, tempo, time signature, chords
- Full analysis displayed side by side
- AI comparison chat: "Could these be sections of the same song?"

---

## SLIDE 8: Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, TypeScript, Tailwind, shadcn/ui |
| AI | Claude (Anthropic) via Vercel AI SDK |
| Audio Intelligence | Spotify Basic Pitch, tonal.js |
| Backend | Supabase (Auth, PostgreSQL, Storage) |
| Audio Processing | ffmpeg (ALAC transcoding, streaming) |
| Visualization | WebGL (8 custom shaders), wavesurfer.js |
| Hosting | Vercel (serverless) |

---

## SLIDE 9: Roadmap -- Big Swings

### NOW (Q1 2026) -- Foundation [DONE]
- Full analysis pipeline (key, chords, tempo, progressions)
- AI teaching summaries and per-recording chat
- Library with tags, collections, search
- Compare page with AI comparison chat
- Insights dashboard with Musical DNA
- Sharing via public links

### NEXT (Q2-Q3 2026) -- Intelligence
- In-browser recording -- record directly, no upload needed
- Multi-instrument support -- guitar, vocals, ensemble
- Harmonic search -- "find all recordings in D minor with a ii-V-I"
- Version tracking -- link recordings as iterations of the same idea
- Practice mode -- slow down, loop sections, A/B comparison with playback

### LATER (Q4 2026 - 2027) -- Platform
- Collaboration -- share with bandmates, teachers, producers with annotation
- AI arrangement -- generate bass lines, counter-melodies, accompaniment parts
- Song builder -- stitch recordings into full arrangements with transitions
- Mobile app -- native iOS/Android with on-device recording and analysis
- DAW export -- export as stems to Logic, Ableton, GarageBand

### FUTURE (2027+) -- Ecosystem
- Live transcription -- real-time chord/key display as you play
- Style DNA matching -- "your harmonic language is closest to Bill Evans meets Radiohead"
- Community library -- discover and learn from other musicians' harmonic ideas
- Music education platform -- structured courses built around your own recordings
- API for developers -- audio analysis as a service

---

## SLIDE 10: North Star Vision

**The musical brain you've always wanted.**

Imagine picking up your instrument. You play something -- 30 seconds, two minutes, whatever comes out. Before you even set it down:

- The chords appear on screen in real time
- The app recognizes this is a variation of something you played three months ago
- It suggests: "This is in the same harmonic family as your piece 'Late November.' Try modulating to Eb at bar 8 -- here's how it would sound."
- It generates a bass line, a string arrangement, and a drum pattern that fit your style
- Your teacher gets notified: "Karel explored tritone substitutions for the first time today"

**Resonance becomes the AI co-composer that knows your entire musical history, understands your harmonic vocabulary, anticipates where you want to go, and helps you get there.**

Not a DAW. Not a notation app. Not a practice tool.

*The creative partner that turns every idea into its best possible version.*

---

## SLIDE 11: About the Builder

**Karel Barnoski**

Design Director at Workday. 15+ years leading UX for enterprise products at Workday, GE, and Kodak. BFA Illustration and MFA Computer Graphics from Rochester Institute of Technology, with classical training from Barnstone Studios.

Founder of 2octave, an audio design studio specializing in product sonification -- creating award-winning sounds for products ranging from digital cameras to kitchen appliances. Published in UX Magazine on the science of sound in product design.

Pianist and composer. Released "Welcome Home," a solo piano album self-produced during quarantine. Music on Spotify and SoundCloud.

Resonance exists because Karel is both the designer and the user -- a musician who records hundreds of ideas and needed a better way to understand and develop them.

*"Sound is perceived very much in the same way as any other stimuli. By manipulating sound, you can affect the user's perception of an experience."*

---

## SLIDE 12: Try It

**https://getresonance.vercel.app**

Karel Barnoski

Spotify | SoundCloud | LinkedIn

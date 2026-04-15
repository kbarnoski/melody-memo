// Rebuild the Welcome Home culmination with vibes from all 13 tracks.
// Deletes the old culmination journey, generates a new one with a richer
// multi-track story + phase arc that builds toward a grand finale, and
// attaches it to the Welcome Home path.

import { createClient } from "@supabase/supabase-js";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import { readFileSync } from "node:fs";
import { randomUUID, randomInt } from "node:crypto";

const env = readFileSync(".env.local", "utf-8");
const getEnv = (name) => {
  const line = env.split("\n").find((l) => l.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).trim() : undefined;
};

const supabase = createClient(getEnv("NEXT_PUBLIC_SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"));
const anthropic = createAnthropic({ apiKey: getEnv("ANTHROPIC_API_KEY") });
const model = anthropic("claude-sonnet-4-5-20250929");

const USER_ID = "8d9f4d41-88de-45ea-a3af-5b241d105256";
const output = JSON.parse(readFileSync("scripts/welcome-home-output.json", "utf-8"));

// ─── Inline vibe detection (identical to the main builder) ───
function isMinorKey(key) { if (!key) return false; return /minor|min|\bm\b/i.test(key); }
function isMajorKey(key) { if (!key) return false; return /major|maj/i.test(key) || (!isMinorKey(key) && /^[A-G][#b]?$/.test(key.trim())); }
function countExtensions(chords) { return chords.filter((c) => /7|9|11|13|sus|add|maj7|min7|dim|aug/i.test(c.chord)).length; }
function uniqueChordCount(chords) { return new Set(chords.map((c) => c.chord)).size; }
function averageChordDuration(chords) { if (!chords.length) return 0; return chords.reduce((s, c) => s + c.duration, 0) / chords.length; }

function detectVibe(analysis) {
  const tempo = analysis.tempo ?? 100;
  const key = analysis.key_signature;
  const chords = analysis.chords ?? [];
  const unique = uniqueChordCount(chords);
  const extensions = countExtensions(chords);
  const avgDuration = averageChordDuration(chords);
  const minor = isMinorKey(key);
  const major = isMajorKey(key);
  const scores = { melancholic: 0, intense: 0, dreamy: 0, mystical: 0, chaotic: 0, hypnotic: 0, flowing: 0, transcendent: 0 };
  if (minor) scores.melancholic += 3;
  if (tempo < 90) scores.melancholic += 2;
  if (tempo < 70) scores.melancholic += 1;
  if (avgDuration > 2) scores.melancholic += 1;
  if (tempo > 130) scores.intense += 3;
  if (tempo > 150) scores.intense += 1;
  if (extensions > chords.length * 0.3) scores.intense += 1;
  const chromaticChords = chords.filter((c) => /dim|aug|alt|\+|#|b/.test(c.chord)).length;
  if (chromaticChords > 3) scores.intense += 2;
  if (major) scores.dreamy += 2;
  if (tempo >= 80 && tempo <= 120) scores.dreamy += 2;
  if (extensions > chords.length * 0.4) scores.dreamy += 2;
  const unusualChords = chords.filter((c) => /dim|aug|alt|sus|#|b5/.test(c.chord)).length;
  if (unusualChords > 2) scores.mystical += 2;
  if (unusualChords > 5) scores.mystical += 1;
  if (unique > 8) scores.mystical += 1;
  if (minor) scores.mystical += 1;
  if (unique > 10) scores.chaotic += 2;
  if (unique > 15) scores.chaotic += 1;
  if (avgDuration < 1.5 && chords.length > 10) scores.chaotic += 2;
  if (tempo > 120) scores.chaotic += 1;
  if (unique <= 4 && chords.length > 6) scores.hypnotic += 3;
  if (unique <= 6 && chords.length > 10) scores.hypnotic += 1;
  if (avgDuration > 1.5) scores.hypnotic += 1;
  if (tempo >= 80 && tempo <= 120) scores.hypnotic += 1;
  if (tempo >= 85 && tempo <= 115) scores.flowing += 2;
  if (avgDuration >= 1.5 && avgDuration <= 3) scores.flowing += 2;
  if (unique >= 4 && unique <= 10) scores.flowing += 1;
  if (major) scores.transcendent += 2;
  if (tempo < 90) scores.transcendent += 2;
  if (extensions > chords.length * 0.3) scores.transcendent += 1;
  if (avgDuration > 2) scores.transcendent += 1;
  let topMood = "flowing"; let topScore = -1;
  for (const [m, s] of Object.entries(scores)) if (s > topScore) { topScore = s; topMood = m; }
  return { mood: topMood, scores };
}

// ─── Schemas (same as main builder, slightly relaxed) ───
const themeSchema = z.object({
  visualVocabulary: z.object({
    environments: z.array(z.string()).min(6).max(10),
    entities: z.array(z.string()).min(6).max(10),
    textures: z.array(z.string()).min(6).max(10),
    atmospheres: z.array(z.string()).min(6).max(10),
  }),
  shaderCategories: z.array(z.enum(["Cosmic", "Elemental", "Organic", "Visionary", "Geometry", "Dark", "3D Worlds"])).min(2).max(3),
  palette: z.object({ primary: z.string(), secondary: z.string(), accent: z.string(), glow: z.string() }),
  voice: z.enum(["shimmer", "nova", "fable", "alloy", "echo", "onyx", "ash", "ballad", "coral", "sage", "verse", "marin", "cedar"]),
  poetryImagery: z.string(),
  poetryMood: z.enum(["melancholic", "intense", "dreamy", "mystical", "chaotic", "hypnotic", "flowing", "transcendent"]),
  ambientTheme: z.enum(["default", "abyss", "ocean", "forest", "sacred", "machine", "pain", "heaven", "desert", "storm"]),
});
const phaseSchema = z.object({
  aiPrompt: z.string().min(20).describe("Rich 25–45 word visual scene prompt"),
  poetryMood: z.string(),
  guidancePhrases: z.array(z.string()).max(3),
});
const journeySchema = z.object({
  name: z.string(),
  subtitle: z.string(),
  description: z.string(),
  phases: z.array(phaseSchema).length(6),
});

const TEMPLATE_PHASES = [
  { id: "threshold", start: 0.00, end: 0.10, shaderOpacity: 0.60, denoisingRange: [0.3, 0.5], targetFps: 0.5, bloomIntensity: 0.2, chromaticAberration: 0.0, colorTemperature: 0.1, vignette: 0.35, poetryIntervalSeconds: 10, intensityMultiplier: 0.4, ambientLayers: { wind: 0.2, rain: 0, drone: 0.4, chime: 0.2, fire: 0 }, filmGrain: 0.03, particleDensity: 0.03, halation: 0.03 },
  { id: "expansion", start: 0.10, end: 0.26, shaderOpacity: 0.60, denoisingRange: [0.4, 0.65], targetFps: 1, bloomIntensity: 0.45, chromaticAberration: 0.03, colorTemperature: 0.15, vignette: 0.25, poetryIntervalSeconds: 7, intensityMultiplier: 0.75, ambientLayers: { wind: 0.4, rain: 0.2, drone: 0.7, chime: 0.4, fire: 0 }, filmGrain: 0.06, particleDensity: 0.06, halation: 0.06 },
  { id: "transcendence", start: 0.26, end: 0.48, shaderOpacity: 0.60, denoisingRange: [0.6, 0.85], targetFps: 2, bloomIntensity: 0.9, chromaticAberration: 0.08, colorTemperature: 0.35, vignette: 0.1, poetryIntervalSeconds: 5, intensityMultiplier: 1.0, ambientLayers: { wind: 0.7, rain: 0.5, drone: 1.0, chime: 0.8, fire: 0.3 }, filmGrain: 0.1, particleDensity: 0.1, halation: 0.12 },
  { id: "illumination", start: 0.48, end: 0.65, shaderOpacity: 0.60, denoisingRange: [0.4, 0.6], targetFps: 1, bloomIntensity: 0.55, chromaticAberration: 0.04, colorTemperature: 0.2, vignette: 0.2, poetryIntervalSeconds: 8, intensityMultiplier: 0.85, ambientLayers: { wind: 0.35, rain: 0.15, drone: 0.6, chime: 0.6, fire: 0.1 }, filmGrain: 0.05, particleDensity: 0.05, halation: 0.07 },
  { id: "return", start: 0.65, end: 0.82, shaderOpacity: 0.60, denoisingRange: [0.25, 0.45], targetFps: 0.5, bloomIntensity: 0.35, chromaticAberration: 0.05, colorTemperature: 0, vignette: 0.25, poetryIntervalSeconds: 10, intensityMultiplier: 0.6, ambientLayers: { wind: 0.25, rain: 0.1, drone: 0.4, chime: 0.35, fire: 0 }, filmGrain: 0.04, particleDensity: 0.03, halation: 0.04 },
  { id: "integration", start: 0.82, end: 1.0, shaderOpacity: 0.60, denoisingRange: [0.2, 0.35], targetFps: 0.5, bloomIntensity: 0.25, chromaticAberration: 0.0, colorTemperature: -0.05, vignette: 0.3, poetryIntervalSeconds: 15, intensityMultiplier: 0.4, ambientLayers: { wind: 0.15, rain: 0, drone: 0.25, chime: 0.2, fire: 0 }, filmGrain: 0.02, particleDensity: 0.02, halation: 0.03 },
];

async function getTracksWithVibes() {
  const results = [];
  for (const entry of output.journeys) {
    const { data: analysis } = await supabase
      .from("analyses")
      .select("*")
      .eq("recording_id", entry.recordingId)
      .maybeSingle();
    if (!analysis) continue;
    const vibe = detectVibe(analysis);
    const parts = [];
    if (analysis.key_signature) parts.push(`Key ${analysis.key_signature}`);
    if (analysis.tempo) parts.push(`${Math.round(analysis.tempo)} BPM`);
    parts.push(`mood: ${vibe.mood}`);
    results.push({
      title: entry.cleanTitle,
      recordingId: entry.recordingId,
      vibe: vibe.mood,
      musical: parts.join(", "),
    });
  }
  return results;
}

async function main() {
  console.log("Gathering track vibes…");
  const tracks = await getTracksWithVibes();
  console.log(`Got ${tracks.length} tracks with analysis.\n`);

  const vibeLine = tracks.map((t) => `  • ${t.title} — ${t.vibe} (${t.musical})`).join("\n");
  const moodCounts = {};
  for (const t of tracks) moodCounts[t.vibe] = (moodCounts[t.vibe] ?? 0) + 1;
  const moodSummary = Object.entries(moodCounts).sort((a, b) => b[1] - a[1]).map(([m, n]) => `${m} ×${n}`).join(", ");

  const story = `The culmination of Welcome Home by Karel Barnoski — a grand finale that weaves together the emotional threads of all 13 tracks into one maximalist journey. Not a single theme. Not a quiet room. A collage of every feeling the album contained, integrated and interwoven, building toward a place of incredible infinite spirit. A place that feels at once like heaven and like home — where all your prior experiences collapse into a single vast radiant knowing.

The album's thirteen songs, each with its own vibe:
${vibeLine}

Dominant moods across the album: ${moodSummary}.

This is not a "return to stillness" journey. This is a GRAND FINALE. It should build and build — each phase layering in more textures, more color, more light, more motion — until the final phase is a full integration of dream and earth and sky and body, a heavenly home where every previous journey's image bleeds through at once. Think: Gustav Klimt meets Hilma af Klint meets James Turrell meets a cathedral you've walked toward your whole life.

Core directives:
— Weave vibes from multiple tracks into single phases. Don't sit on one mood.
— Build intensity consistently from threshold → transcendence. No dips.
— The "transcendence" phase should be the most maximalist, saturated, interwoven, and overwhelming — a collage of everything the album touched.
— "Illumination" and "return" should NOT retreat into minimalism. They should stay LUSH and warm, translating the grand finale into felt sense.
— "Integration" is homecoming — infinite spirit at rest, a doorway of light standing open in a vast field of color, dreamlike but settled.
— Warm color palette dominant (amber, gold, rose, violet) with cool accents (cobalt, pale green) so the interweaving reads as collage not monotone.
— References to prior-journey elements: water (Bath), knives of light (The Knife), rolling waves of time (Rolling), isolation softened into belonging (Isolation/Quarantine), celebratory movement (Playa/All Together), rebirth cycles (Rebound/Interplay).

Feel: awe, gratitude, homecoming, "every path was leading here", the moment after a long journey when your whole life turns to gold.`;

  const musicalContext = `Album: Welcome Home — 13 tracks across multiple keys, tempos, and moods. At playback the track is randomly picked from the 13 so every replay surprises. Tracks span ${moodSummary}. The visual arc must feel universal to the album, not tied to any one song's mood — treat it as "all of it at once".`;

  console.log("Generating grand theme…");
  const { object: theme } = await generateObject({
    model,
    schema: themeSchema,
    mode: "tool",
    maxTokens: 3500,
    prompt: `You are designing the visual theme for the GRAND CULMINATION of an album called Welcome Home.

${story}

${musicalContext}

Generate a rich, maximalist theme that can hold the weight of 13 tracks' worth of emotional material integrated at once. Visual vocabulary must be lush, specific, and varied — environments that feel sacred and warm, entities that suggest infinite spirit and interwoven dream-logic, textures that carry both dream softness and radiant heat, atmospheres that modulate from amber to rose to cobalt across the journey.

Return every field as its proper type (arrays as arrays, not strings).`,
    temperature: 0.9,
  });

  console.log("Generating grand phase arc…");
  const { object: journeyAi } = await generateObject({
    model,
    schema: journeySchema,
    mode: "tool",
    maxTokens: 4500,
    prompt: `Design the GRAND CULMINATION journey of Welcome Home.

${story}

Visual world we're working in: ${theme.visualVocabulary.environments.slice(0, 4).join(", ")}, ${theme.visualVocabulary.textures.slice(0, 4).join(", ")}, ${theme.visualVocabulary.atmospheres.slice(0, 4).join(", ")}. Mood: ${theme.poetryMood}.

Generate exactly 6 phases in order, following the BUILD-TO-GRAND-FINALE curve — each phase should feel MORE intense and layered than the last until transcendence, then stay lush through illumination and return, landing at integration as infinite spirit at rest:

1. Threshold (0–10%) — first stepping through the doorway, all 13 tracks' colors faintly visible at the edges
2. Expansion (10–26%) — multiple phase-vibes interleaving, color fields beginning to layer
3. Transcendence (26–48%) — the GRAND FINALE: full collage of every track's feeling, maximalist, radiant, interwoven, overwhelming in the best way
4. Illumination (48–65%) — the radiance resolves into clarity but stays lush, warm, luminous
5. Return (65–82%) — carrying the whole album inside you, walking home through gold and rose
6. Integration (82–100%) — HOMECOMING: a luminous threshold standing open in a vast warm field, heaven and home at once, infinite spirit at rest

EACH phase's aiPrompt MUST:
— be 25 to 45 words long
— reference multiple textures/atmospheres/entities from the theme vocabulary
— build on the previous phase's intensity
— avoid monotony — variety of color, light direction, spatial scale
— mention specific warm colors (amber, gold, rose, violet) and maybe one cool accent
— never default to "a single door" or "a single light" — this is a multi-element collage journey

guidancePhrases should feel grateful and homecoming, 2–3 short lines each.

IMPORTANT: phases must be an array of 6 objects.`,
    temperature: 0.85,
  });

  const phases = TEMPLATE_PHASES.map((tpl, i) => ({
    ...tpl,
    shaderModes: [],
    aiPrompt: journeyAi.phases[i].aiPrompt + ", no text no signatures no watermarks no letters no writing",
    aiPromptModifiers: {},
    poetryMood: journeyAi.phases[i].poetryMood,
    guidancePhrases: journeyAi.phases[i].guidancePhrases,
    voice: theme.voice,
    palette: theme.palette,
  }));

  const augmentedTheme = {
    ...theme,
    isCulmination: true,
    randomTrackPool: output.journeys.map((j) => j.recordingId),
  };

  const newToken = randomUUID().replace(/-/g, "").slice(0, 16);
  const row = {
    user_id: USER_ID,
    recording_id: null,
    name: journeyAi.name,
    subtitle: journeyAi.subtitle,
    description: journeyAi.description,
    story_text: story,
    realm_id: "custom",
    phases,
    theme: augmentedTheme,
    share_token: newToken,
    playback_seed: String(randomInt(0, 4294967296)),
    creator_name: "Karel Barnoski",
    audio_reactive: false,
    is_public: false,
  };

  const { data: newJourney, error } = await supabase.from("journeys").insert(row).select("id").single();
  if (error) { console.error("Insert failed:", error); process.exit(1); }
  console.log(`✓ New culmination ${newJourney.id} — "${journeyAi.name}"`);

  // Attach the new culmination to the path and capture the old id
  const { data: pathRow } = await supabase
    .from("journey_paths")
    .select("id, culmination_journey_id")
    .eq("id", output.pathId)
    .single();
  const oldCulmId = pathRow?.culmination_journey_id ?? null;

  await supabase
    .from("journey_paths")
    .update({ culmination_journey_id: newJourney.id })
    .eq("id", output.pathId);
  console.log(`✓ Path now points to new culmination`);

  // Remove the old culmination row so it doesn't clutter the DB / selector
  if (oldCulmId) {
    const { error: delErr } = await supabase
      .from("journeys")
      .delete()
      .eq("id", oldCulmId);
    console.log(delErr ? `⚠ old culmination delete failed: ${delErr.message}` : `✓ deleted old culmination ${oldCulmId}`);
  }

  console.log(`\n  Name: ${journeyAi.name}`);
  console.log(`  Subtitle: ${journeyAi.subtitle}`);
  console.log(`  Share token: ${newToken}`);
}

main().catch((err) => { console.error(err); process.exit(1); });

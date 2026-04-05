import { U, SMOOTH_NOISE, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG =
  U +
  SMOOTH_NOISE +
  VISIONARY_PALETTE +
  ROT2 +
  `
// Zodiac — Slow-rotating constellation map with connected star
// patterns, subtle orbital motion, ancient celestial cartography.

// Hash for star placement
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

// Star with cross-shaped diffraction spikes
float starGlow(vec2 uv, vec2 pos, float size, float brightness) {
  vec2 d = uv - pos;
  float r = length(d);

  // Core
  float core = exp(-r * r / (size * size * 2.0)) * brightness;

  // Diffraction spikes — 4 rays
  float angle = atan(d.y, d.x);
  float spikes = pow(abs(cos(angle * 2.0)), 32.0);
  float spikeGlow = exp(-r / (size * 4.0)) * spikes * brightness * 0.3;

  return core + spikeGlow;
}

// Constellation line between two stars
float constellationLine(vec2 uv, vec2 a, vec2 b, float t) {
  vec2 pa = uv - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  float d = length(pa - ba * h);

  // Thin glowing line
  float line = exp(-d * d * 8000.0);

  // Traveling pulse along the line
  float pulse = sin(h * 12.0 - t * 2.0) * 0.5 + 0.5;
  pulse = smoothstep(0.3, 0.8, pulse);

  return line * (0.3 + pulse * 0.7);
}

// Orbital ring — faint circular path
float orbitalRing(vec2 uv, float radius, float t) {
  float r = length(uv);
  float ring = exp(-pow((r - radius) / 0.003, 2.0));

  // Dashed pattern
  float a = atan(uv.y, uv.x);
  float dashes = smoothstep(0.3, 0.5, sin(a * 20.0 + t * 0.2));

  return ring * dashes * 0.3;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.1;

  float paletteShift = u_amplitude * 0.15;

  // Slow rotation of the entire celestial sphere
  float rotation = t * 0.08;
  vec2 rotUV = uv * rot2(rotation);

  vec3 color = vec3(0.01, 0.01, 0.025);

  // ── Background star dust — faint Milky Way ──
  float dust = snoise(rotUV * 3.0 + t * 0.01) * 0.5 + 0.5;
  dust *= snoise(rotUV * 6.0 + vec2(20.0)) * 0.5 + 0.5;
  dust = smoothstep(0.2, 0.6, dust) * 0.05;
  color += vec3(0.15, 0.12, 0.2) * dust;

  // ── Dense background star field ──
  for (int layer = 0; layer < 3; layer++) {
    float fl = float(layer);
    float density = 40.0 + fl * 30.0;
    vec2 suv = rotUV * density;
    vec2 id = floor(suv);
    vec2 f = fract(suv) - 0.5;

    float h = hash(id + fl * 100.0);
    float isStar = step(0.88 - fl * 0.03, h);
    float radius = 0.03 + 0.04 * fract(h * 17.0);
    float brightness = (0.3 + 0.7 * (1.0 - fl / 3.0));
    float twinkle = 0.6 + 0.4 * sin(u_time * (1.5 + h * 5.0) + h * 80.0);

    float s = isStar * smoothstep(radius, 0.0, length(f)) * brightness * twinkle;

    // Vary star color by hash
    vec3 sCol = mix(vec3(0.8, 0.85, 1.2), vec3(1.1, 0.9, 0.7), fract(h * 7.0));
    color += sCol * s * (0.3 + u_treble * 0.4);
  }

  // ── Constellation stars — bright named stars ──
  // Place 12 major stars in a zodiac arrangement
  float totalStars = 0.0;
  float totalLines = 0.0;

  vec2 starPositions[12];
  for (int i = 0; i < 12; i++) {
    float fi = float(i);
    float angle = fi * 0.5236 + rotation * 0.5;
    float radius = 0.3 + 0.1 * sin(fi * 2.3 + t * 0.05);
    // Wobble
    radius += 0.02 * sin(t * 0.2 + fi * 1.7);
    starPositions[i] = vec2(cos(angle), sin(angle)) * radius;
  }

  // Draw constellation lines between adjacent stars
  for (int i = 0; i < 11; i++) {
    totalLines += constellationLine(uv, starPositions[i], starPositions[i + 1], t);
  }
  // Wrap: last star connects back to first
  totalLines += constellationLine(uv, starPositions[11], starPositions[0], t);
  // Cross-connections for more interesting patterns
  totalLines += constellationLine(uv, starPositions[0], starPositions[4], t) * 0.5;
  totalLines += constellationLine(uv, starPositions[3], starPositions[8], t) * 0.5;
  totalLines += constellationLine(uv, starPositions[6], starPositions[10], t) * 0.5;
  totalLines += constellationLine(uv, starPositions[1], starPositions[7], t) * 0.4;
  totalLines += constellationLine(uv, starPositions[5], starPositions[11], t) * 0.4;

  // Draw the constellation stars
  for (int i = 0; i < 12; i++) {
    float fi = float(i);
    float size = 0.012 + 0.006 * sin(fi * 3.1 + t * 0.1);
    float brightness = 0.8 + 0.2 * sin(fi * 2.7 + u_time * 0.3);
    brightness *= (0.8 + u_bass * 0.5);
    totalStars += starGlow(uv, starPositions[i], size, brightness);
  }

  // ── Orbital rings ──
  float rings = 0.0;
  rings += orbitalRing(uv, 0.25, t);
  rings += orbitalRing(uv, 0.4, t * 0.7);
  rings += orbitalRing(uv, 0.55, t * 0.5);

  // ── Colors ──
  // Constellation lines — faint blue-silver
  vec3 lineCol = palette(
    totalLines * 0.5 + t * 0.02 + paletteShift,
    vec3(0.4, 0.45, 0.6),
    vec3(0.15, 0.15, 0.25),
    vec3(0.3, 0.3, 0.8),
    vec3(0.1, 0.15, 0.35)
  );

  // Star color — warm gold to white
  vec3 starCol = palette(
    totalStars + t * 0.03 + paletteShift + 0.3,
    vec3(0.9, 0.85, 0.7),
    vec3(0.15, 0.1, 0.05),
    vec3(0.3, 0.25, 0.1),
    vec3(0.0, 0.05, 0.1)
  );

  // Ring color — faint cyan
  vec3 ringCol = palette(
    rings + t * 0.01 + paletteShift + 0.6,
    vec3(0.3, 0.4, 0.45),
    vec3(0.1, 0.15, 0.2),
    vec3(0.2, 0.5, 0.6),
    vec3(0.1, 0.2, 0.3)
  );

  // Compose
  color += lineCol * totalLines * (0.4 + u_mid * 0.3);
  color += ringCol * rings;
  color += starCol * totalStars;

  // Central glow — faint celestial center
  float centerGlow = exp(-length(uv) * 3.0) * 0.08;
  color += vec3(0.2, 0.18, 0.3) * centerGlow * (0.5 + u_amplitude * 0.5);

  // Vignette
  float vignette = 1.0 - smoothstep(0.5, 1.2, length(uv));
  color *= (0.75 + 0.25 * vignette);

  gl_FragColor = vec4(color, 1.0);
}
`;

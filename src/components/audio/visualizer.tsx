"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { X, Eye, Flame, Zap, Droplets, Orbit, Diamond, Sparkles, Waves } from "lucide-react";

type VisualizerMode = "mandala" | "cosmos" | "neon" | "liquid" | "sacred" | "ethereal" | "fractal" | "warp";

interface VisualizerProps {
  audioElement: HTMLAudioElement | null;
  onClose: () => void;
}

const audioNodeCache = new WeakMap<
  HTMLAudioElement,
  { ctx: AudioContext; analyser: AnalyserNode }
>();

// Uniform header — declared but unused (pure ambient, no audio reactivity)
const U = `
precision mediump float;
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_bass;
uniform float u_mid;
uniform float u_treble;
uniform float u_amplitude;
`;

// Smooth value noise with quintic interpolation — no grid artifacts
const SMOOTH_NOISE = `
vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453);
}
float snoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(mix(dot(hash2(i), f),
                 dot(hash2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
             mix(dot(hash2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
                 dot(hash2(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 6; i++) { v += a * snoise(p); p = rot * p * 2.0; a *= 0.5; }
  return v;
}
`;

// 1. MANDALA — flowing kaleidoscopic symmetry with constant transformation
const MANDALA_FRAG = U + SMOOTH_NOISE + `
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.15;

  // Continuous rotation
  float rot = t * 0.2;
  uv = mat2(cos(rot), -sin(rot), sin(rot), cos(rot)) * uv;

  float angle = atan(uv.y, uv.x);
  float radius = length(uv);

  // Kaleidoscopic fold — morphing symmetry count
  float foldCount = 6.0 + 2.0 * sin(t * 0.12);
  float foldedAngle = mod(angle, 6.28318 / foldCount);
  foldedAngle = abs(foldedAngle - 3.14159 / foldCount);
  vec2 kUV = vec2(cos(foldedAngle), sin(foldedAngle)) * radius;

  // Flowing domain-warped pattern through the kaleidoscope
  vec2 q = vec2(fbm(kUV * 3.0 + t * 0.4), fbm(kUV * 3.0 + vec2(5.2, 1.3) - t * 0.3));
  vec2 r = vec2(fbm(kUV * 2.5 + 2.0 * q + t * 0.2), fbm(kUV * 2.5 + 2.0 * q + vec2(3.0, 7.0) - t * 0.25));
  float flow = fbm(kUV * 2.0 + 2.0 * r + t * 0.15);

  // 4 breathing rings modulated by the flow
  float rings = 0.0;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float ringR = 0.1 + fi * 0.2 + 0.08 * sin(t * 0.35 + fi * 2.0);
    float ringW = 0.04 + 0.02 * sin(t * 0.25 + fi);
    float ring = exp(-pow((radius - ringR) / ringW, 2.0));
    ring *= 0.5 + 0.5 * flow;
    rings += ring * (0.3 - fi * 0.03);
  }

  // Spiraling tendrils
  float spiral = sin(angle * 6.0 + log(radius + 0.01) * 4.0 - t * 1.2);
  spiral = smoothstep(0.3, 0.7, spiral * 0.5 + 0.5) * 0.2 * smoothstep(1.2, 0.05, radius);

  // Pulsing center bloom
  float bloom = exp(-radius * 2.5) * (0.4 + 0.2 * sin(t * 0.5));

  float pattern = rings + spiral + flow * 0.2;

  // Vivid evolving color — shifts through the spectrum
  float hue = fract(flow * 0.2 + radius * 0.15 + t * 0.04);
  float hue2 = fract(0.5 + length(q) * 0.15 - t * 0.03);
  float sat = 0.55 + 0.2 * sin(t * 0.2 + radius * 3.0);
  float val = pattern * 0.5 + 0.12 + bloom;
  val = clamp(val, 0.0, 1.0);

  vec3 color = mix(
    hsv2rgb(vec3(hue, sat, val)),
    hsv2rgb(vec3(hue2, sat * 0.8, val * 0.9)),
    0.35 * smoothstep(0.0, 0.7, radius)
  );

  // Warm center light
  color += bloom * vec3(1.0, 0.8, 0.4) * 0.3;

  // Never fully black
  color += 0.025;

  gl_FragColor = vec4(color, 1.0);
}
`;

// 2. COSMOS — slowly traveling through a starfield with subtle deep color
const COSMOS_FRAG = U + SMOOTH_NOISE + `
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.04;

  vec3 color = vec3(0.003, 0.002, 0.008);

  // Travel direction — gentle forward drift through space
  // Stars stream outward from center creating parallax motion
  float angle = atan(uv.y, uv.x);
  float radius = length(uv);

  // Multiple star layers at different speeds (parallax depth)
  for (int layer = 0; layer < 3; layer++) {
    float fl = float(layer);
    float speed = 0.3 + fl * 0.4; // deeper layers move slower
    float scale = 30.0 + fl * 20.0;
    float starSize = 0.0018 - fl * 0.0003;
    float bright = 0.5 - fl * 0.12;

    // Offset UVs to create outward streaming motion
    // Stars move radially outward from center
    vec2 streamUV = uv;
    float drift = t * speed;
    // Logarithmic radial expansion — stars accelerate as they pass you
    float logR = log(radius + 0.1) + drift;
    streamUV = vec2(cos(angle), sin(angle)) * exp(mod(logR, 2.5) - 1.5);

    // Tile the streaming space for stars
    vec2 cell = floor(streamUV * scale);
    for (int dx = -1; dx <= 1; dx++) {
      for (int dy = -1; dy <= 1; dy++) {
        vec2 neighbor = cell + vec2(float(dx), float(dy));
        vec2 h = sin(neighbor * vec2(127.1, 311.7)) * 43758.5453;
        vec2 starPos = (neighbor + 0.5 + 0.35 * sin(h.yx)) / scale;
        float d = length(streamUV - starPos);
        float exists = step(0.72, fract(sin(dot(neighbor, vec2(41.7, 89.3))) * 2745.3));
        float b = smoothstep(starSize, 0.0, d) * exists;
        float twinkle = 0.7 + 0.3 * sin(t * 5.0 + dot(neighbor, vec2(73.1, 39.7)));
        float starHue = fract(dot(neighbor, vec2(17.3, 53.7)) * 0.001);
        vec3 sc = mix(vec3(0.8, 0.85, 1.0), vec3(1.0, 0.8, 0.6), starHue);
        color += b * twinkle * sc * bright;
      }
    }
  }

  // Subtle deep-field color washes drifting by
  vec2 washUV = uv + vec2(t * 0.5, t * 0.2);
  float wash = fbm(washUV * 0.6);
  wash = smoothstep(-0.1, 0.5, wash) * smoothstep(0.9, 0.3, wash);
  float phase = t * 0.3;
  vec3 washColor = mix(
    vec3(0.02, 0.03, 0.06),
    vec3(0.05, 0.01, 0.04),
    sin(phase) * 0.5 + 0.5
  );
  color += wash * washColor * 0.5;

  // Occasional nebula wisps passing through
  float wisp = fbm(uv * 1.5 + vec2(t * 0.8, t * 0.3));
  wisp = pow(max(wisp, 0.0), 3.0) * 0.15;
  vec3 wispColor = mix(vec3(0.04, 0.02, 0.08), vec3(0.02, 0.05, 0.06), sin(phase * 0.7) * 0.5 + 0.5);
  color += wisp * wispColor;

  gl_FragColor = vec4(color, 1.0);
}
`;

// 3. NEON — perfectly smooth infinite tunnel, no audio
const NEON_FRAG = U + `
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.3;

  float angle = atan(uv.y, uv.x);
  float radius = length(uv);
  float tunnel = 0.3 / (radius + 0.001);

  float z = tunnel + t * 0.8;
  float a = angle / 3.14159;

  // Smooth grid
  float rings = abs(fract(z * 2.0) - 0.5);
  float radials = abs(fract(a * 4.0) - 0.5);

  float ringGlow = smoothstep(0.08, 0.0, rings);
  float radialGlow = smoothstep(0.1, 0.0, radials);
  float grid = ringGlow + radialGlow * 0.5;

  // Smooth hue cycling
  float hue = fract(a * 0.5 + t * 0.05);
  vec3 neonColor;
  neonColor.r = abs(sin(hue * 6.28)) * 0.7 + 0.2;
  neonColor.g = abs(sin((hue + 0.33) * 6.28)) * 0.5;
  neonColor.b = abs(sin((hue + 0.66) * 6.28)) * 0.8 + 0.1;

  float fog = smoothstep(0.0, 3.0, tunnel);

  vec3 color = neonColor * grid * fog;

  // Evolving bg glow
  float bgHue = fract(t * 0.025);
  vec3 bgColor = vec3(
    0.03 * abs(sin(bgHue * 6.28)),
    0.02 * abs(sin((bgHue + 0.33) * 6.28)),
    0.05 * abs(sin((bgHue + 0.66) * 6.28))
  );
  color += bgColor * fog * 0.7;
  color += smoothstep(0.5, 0.0, radius) * 0.08;

  gl_FragColor = vec4(color, 1.0);
}
`;

// 5. LIQUID — deep domain-warped organic flow
const LIQUID_FRAG = U + SMOOTH_NOISE + `
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float t = u_time * 0.06;

  // Triple domain warp for deep organic movement
  vec2 q = vec2(fbm(uv * 2.0 + t * 0.7), fbm(uv * 2.0 + vec2(5.2, 1.3) + t * 0.5));
  vec2 r = vec2(fbm(uv * 2.0 + 4.0 * q + vec2(1.7, 9.2) + t * 0.3),
                fbm(uv * 2.0 + 4.0 * q + vec2(8.3, 2.8) + t * 0.4));
  float f = fbm(uv * 2.0 + 4.0 * r);

  // Evolving palette
  float cycle = t * 0.5;
  vec3 c1 = vec3(0.12 + 0.08 * sin(cycle), 0.03, 0.18 + 0.1 * cos(cycle));
  vec3 c2 = vec3(0.35, 0.1 + 0.05 * sin(cycle * 0.7), 0.02);
  vec3 c3 = vec3(0.5, 0.3, 0.5 + 0.1 * cos(cycle * 1.1));
  vec3 c4 = vec3(0.05, 0.18 + 0.08 * sin(cycle * 0.5), 0.3);

  vec3 color = mix(c1, c2, clamp(f * f * 2.0, 0.0, 1.0));
  color = mix(color, c3, clamp(length(q) * 0.7, 0.0, 1.0));
  color = mix(color, c4, clamp(length(r) * 0.5, 0.0, 1.0));

  // Smooth metallic highlights
  float ridge = abs(f - 0.5) * 2.0;
  float highlight = pow(ridge, 4.0) * 1.2;
  vec3 hlColor = mix(vec3(0.5, 0.25, 0.7), vec3(0.25, 0.5, 0.8), sin(cycle * 0.4) * 0.5 + 0.5);
  color += highlight * hlColor * 0.35;

  color *= 0.85;

  gl_FragColor = vec4(color, 1.0);
}
`;

// 5. SACRED — pure line geometry, no circles, zoomed out
const SACRED_FRAG = U + `
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  // Zoom out
  uv *= 1.8;
  float t = u_time * 0.08;

  float radius = length(uv);
  float angle = atan(uv.y, uv.x);

  float pattern = 0.0;

  // Multi-layered rotating line lattice — hexagonal grid at different scales
  for (int layer = 0; layer < 3; layer++) {
    float fl = float(layer);
    float layerRot = t * (0.04 + fl * 0.015) * (mod(fl, 2.0) == 0.0 ? 1.0 : -1.0);
    float scale = 3.0 + fl * 2.5;
    float cr = cos(layerRot);
    float sr = sin(layerRot);
    vec2 ruv = mat2(cr, -sr, sr, cr) * uv;

    // 3 sets of parallel lines at 60-degree angles = hexagonal lattice
    for (int i = 0; i < 3; i++) {
      float lineAngle = float(i) * 1.0472; // 60 degrees
      float c2 = cos(lineAngle);
      float s2 = sin(lineAngle);
      float proj = dot(ruv, vec2(c2, s2));
      float lineDist = abs(fract(proj * scale) - 0.5);
      pattern += smoothstep(0.04, 0.0, lineDist) * (0.18 - fl * 0.03);
    }
  }

  // Golden spiral arms — pure curves, no fill
  for (int arm = 0; arm < 3; arm++) {
    float fa = float(arm);
    float spiralAngle = angle - log(radius + 0.001) * 1.618 - t * 0.2 + fa * 2.094;
    float spiralLine = sin(spiralAngle * 10.0);
    pattern += smoothstep(0.06, 0.0, abs(spiralLine)) * smoothstep(2.5, 0.05, radius) * 0.12;
  }

  // Radial lines — Metatron's cube spokes
  for (int i = 0; i < 12; i++) {
    float lineAngle = float(i) * 0.5236 + t * 0.025;
    float diff = abs(sin(angle - lineAngle));
    pattern += smoothstep(0.01, 0.0, diff) * smoothstep(2.5, 0.0, radius) * 0.06;
  }

  // Subtle expanding wave rings — just a few, thin
  float wave = sin(radius * 8.0 - t * 1.2) * 0.5 + 0.5;
  wave = smoothstep(0.42, 0.5, wave) * smoothstep(3.0, 0.0, radius) * 0.08;
  pattern += wave;

  // Sacred palette — gold, violet, evolving
  float hue = fract(0.1 + radius * 0.04 + t * 0.02 + angle * 0.015);
  float sat = 0.35 + 0.2 * sin(t * 0.12 + radius * 1.5);
  float val = pattern * 0.85 + 0.02;

  // Central golden glow
  float glow = smoothstep(1.5, 0.0, radius) * 0.12;
  vec3 color = hsv2rgb(vec3(hue, sat, clamp(val, 0.0, 1.0)));
  color += glow * vec3(1.0, 0.88, 0.55);

  // Soft base — never fully dark
  color += 0.015;

  gl_FragColor = vec4(color, 1.0);
}
`;

// 6. ETHEREAL — wide god rays through flowing mist, zoomed out
const ETHEREAL_FRAG = U + SMOOTH_NOISE + `
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float t = u_time * 0.04;

  // Wandering light source — moves more broadly across the scene
  vec2 lightPos = vec2(0.5 + 0.3 * sin(t * 0.3), 0.35 + 0.2 * cos(t * 0.2));
  vec2 delta = uv - lightPos;
  float dist = length(delta);
  float lightAngle = atan(delta.y, delta.x);

  // Wide volumetric god rays — zoomed out, broader beams
  float rays = 0.0;
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    float rayAngle = fi * 0.7854 + t * 0.06;
    float diff = abs(mod(lightAngle - rayAngle + 3.14159, 6.28318) - 3.14159);
    float ray = smoothstep(0.25 + 0.1 * sin(t * 0.2 + fi * 1.2), 0.0, diff);
    ray *= smoothstep(2.0, 0.0, dist);
    // Noise breaks up the rays organically
    float rayTex = fbm(vec2(lightAngle * 1.5 + fi * 2.5, dist * 3.0 - t * 1.0));
    ray *= 0.4 + rayTex * 0.6;
    rays += ray * 0.1;
  }

  // Wide flowing mist layers — lower frequency for zoomed-out feel
  float mist1 = fbm(uv * 2.0 + t * vec2(0.2, 0.06));
  float mist2 = fbm(uv * 1.5 - t * vec2(0.1, 0.1) + vec2(10.0, 5.0));
  float mist = mist1 * 0.55 + mist2 * 0.45;

  // Light color cycles warm golden to cool silver
  float phase = t * 0.2;
  vec3 lightColor = mix(
    vec3(1.0, 0.88, 0.6),
    vec3(0.7, 0.65, 1.0),
    sin(phase) * 0.5 + 0.5
  );
  vec3 mistColor = mix(
    vec3(0.06, 0.03, 0.1),
    vec3(0.03, 0.05, 0.08),
    mist
  );

  vec3 color = mistColor;
  color += rays * lightColor * 0.7;
  color += mist * 0.06 * lightColor;

  // Broad soft halo around light source
  float halo = exp(-dist * 2.5) * 0.15;
  color += halo * lightColor;

  // Drifting particles / fireflies
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    vec2 pPos = vec2(
      0.5 + 0.35 * sin(t * (0.15 + fi * 0.07) + fi * 2.5),
      0.5 + 0.3 * cos(t * (0.12 + fi * 0.06) + fi * 1.8)
    );
    float d = length(uv - pPos);
    float pGlow = exp(-d * 12.0) * (0.08 + 0.04 * sin(t * 1.5 + fi * 3.0));
    vec3 pColor = mix(lightColor, vec3(0.6, 0.8, 1.0), fi * 0.25);
    color += pGlow * pColor;
  }

  gl_FragColor = vec4(color, 1.0);
}
`;

// 7. FRACTAL — Multiple blooming Julia sets across the screen
const FRACTAL_FRAG = U + `
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

vec3 julia(vec2 z, vec2 c) {
  float iter = 0.0;
  for (int i = 0; i < 80; i++) {
    if (dot(z, z) > 256.0) break;
    z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
    iter += 1.0;
  }
  float smoothIter = iter;
  if (dot(z, z) > 256.0) {
    smoothIter = iter - log2(log2(dot(z, z))) + 4.0;
  }
  float inside = step(79.5, iter);
  return vec3(smoothIter, inside, atan(z.y, z.x));
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.06;

  vec3 color = vec3(0.0);

  // 5 blooms scattered wide across the screen
  for (int bloom = 0; bloom < 5; bloom++) {
    float fb = float(bloom);

    // Drifting centers spread wide
    vec2 center = vec2(
      sin(t * (0.1 + fb * 0.04) + fb * 1.9) * (0.35 + fb * 0.08),
      cos(t * (0.08 + fb * 0.05) + fb * 2.7) * (0.3 + fb * 0.07)
    );

    vec2 localUV = (uv - center) * 0.8;

    // Faster rotation per bloom, alternating direction
    float rot = t * 0.15 * (mod(fb, 2.0) == 0.0 ? 1.0 : -1.0);
    localUV = mat2(cos(rot), -sin(rot), sin(rot), cos(rot)) * localUV;

    // Each bloom offset in phase — faster morphing
    float cAngle = t * 0.35 + fb * 1.2566;
    vec2 c = vec2(0.7885 * cos(cAngle), 0.7885 * sin(cAngle));

    vec3 result = julia(localUV, c);
    float smoothIter = result.x;
    float inside = result.y;
    float zAngle = result.z;

    float colorVal = smoothIter * 0.08;
    // Skip greens: remap into blues, purples, magentas, reds, oranges
    float hue = fract(0.55 + fract(colorVal + t * 0.05 + fb * 0.15) * 0.65);
    float hue2 = fract(0.55 + fract(colorVal * 0.4 + t * 0.07 + 0.33 + fb * 0.1) * 0.65);
    float sat = 0.8 + 0.15 * sin(colorVal * 2.0 + t * 0.5);
    float val = (1.0 - inside) * (0.5 + 0.45 * sin(colorVal * 3.0 + t * 0.4));
    val = max(val, 0.0);

    vec3 bloomColor = mix(
      hsv2rgb(vec3(hue, sat, val)),
      hsv2rgb(vec3(hue2, sat * 0.9, val * 0.9)),
      0.35
    );

    // Interior — nearly black
    float insideHue = fract(0.55 + fract(zAngle * 0.16 + t * 0.04 + fb * 0.2) * 0.65);
    float insideVal = 0.01;
    bloomColor = mix(bloomColor, hsv2rgb(vec3(insideHue, 0.5, insideVal)), inside);

    // Hot edge glow
    float edge = (1.0 - inside) * exp(-smoothIter * 0.03);
    bloomColor += edge * 0.4 * hsv2rgb(vec3(fract(0.55 + fract(t * 0.03 + fb * 0.12) * 0.65), 0.5, 1.0));

    // Wide soft falloff
    float dist = length(uv - center);
    float falloff = smoothstep(1.2, 0.05, dist);

    color += bloomColor * falloff * 0.7;
  }

  // Boost contrast — crush darks, punch brights
  color = pow(color, vec3(0.9));
  color = min(color, vec3(0.85));

  gl_FragColor = vec4(color, 1.0);
}
`;

// 8. WARP — Infinite Mandelbrot zoom, continuously diving into the boundary
const WARP_FRAG = U + `
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}
void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.05;

  // Continuous zoom — exponentially increasing, loops smoothly
  float zoomPhase = t * 0.1;
  float zoomCycle = mod(zoomPhase, 1.0);
  // Smooth zoom with ease so the reset isn't jarring
  float zoomLevel = pow(2.0, 3.0 + zoomCycle * 10.0);

  // Deep boundary points with infinite detail
  vec2 target1 = vec2(-0.7435669, 0.1314023);
  vec2 target2 = vec2(-0.1011, 0.9563);
  vec2 target3 = vec2(-1.25066, 0.02012);
  vec2 target4 = vec2(-0.745428, 0.113009);

  float which = mod(floor(zoomPhase), 4.0);
  vec2 center;
  if (which < 1.0) center = target1;
  else if (which < 2.0) center = target2;
  else if (which < 3.0) center = target3;
  else center = target4;

  // Slow rotation as we dive
  float rot = t * 0.08;
  uv = mat2(cos(rot), -sin(rot), sin(rot), cos(rot)) * uv;

  vec2 c = center + uv / zoomLevel;

  // Mandelbrot iteration
  vec2 z = vec2(0.0);
  float iter = 0.0;
  for (int i = 0; i < 100; i++) {
    if (dot(z, z) > 256.0) break;
    z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
    iter += 1.0;
  }

  // Smooth iteration count
  float smoothIter = iter;
  if (dot(z, z) > 256.0) {
    smoothIter = iter - log2(log2(dot(z, z))) + 4.0;
  }

  float inside = step(99.5, iter);

  // Rich banded coloring — shifts with zoom depth for tunnel effect
  float colorVal = smoothIter * 0.05 + zoomCycle * 0.5;
  float hue = fract(0.55 + fract(colorVal + t * 0.04) * 0.65);
  float hue2 = fract(0.55 + fract(colorVal * 0.5 + t * 0.06 + 0.3) * 0.65);
  float sat = 0.75 + 0.15 * sin(colorVal * 2.5 + t * 0.5);
  float val = (1.0 - inside) * (0.45 + 0.4 * sin(colorVal * 4.0 + t * 0.4));
  val = max(val, 0.0);

  vec3 color = mix(
    hsv2rgb(vec3(hue, sat, val)),
    hsv2rgb(vec3(hue2, sat * 0.9, val * 0.85)),
    0.3
  );

  // Hot edge glow at the boundary
  float edge = (1.0 - inside) * exp(-smoothIter * 0.025);
  float edgeHue = fract(0.55 + fract(t * 0.03 + 0.7) * 0.65);
  color += edge * 0.35 * hsv2rgb(vec3(edgeHue, 0.5, 1.0));

  // Interior — black
  color *= (1.0 - inside);

  // Cap brightness
  color = min(color, vec3(0.85));

  gl_FragColor = vec4(color, 1.0);
}
`;

const VERTEX_SHADER = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

function createShaderProgram(gl: WebGLRenderingContext, fragSource: string): WebGLProgram | null {
  const vs = gl.createShader(gl.VERTEX_SHADER)!;
  gl.shaderSource(vs, VERTEX_SHADER);
  gl.compileShader(vs);
  if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
    console.error("Vertex shader:", gl.getShaderInfoLog(vs));
    return null;
  }

  const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
  gl.shaderSource(fs, fragSource);
  gl.compileShader(fs);
  if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
    console.error("Fragment shader:", gl.getShaderInfoLog(fs));
    return null;
  }

  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error("Program link:", gl.getProgramInfoLog(prog));
    return null;
  }

  return prog;
}

const SHADERS: Record<VisualizerMode, string> = {
  mandala: MANDALA_FRAG,
  cosmos: COSMOS_FRAG,
  neon: NEON_FRAG,
  liquid: LIQUID_FRAG,
  sacred: SACRED_FRAG,
  ethereal: ETHEREAL_FRAG,
  fractal: FRACTAL_FRAG,
  warp: WARP_FRAG,
};

const MODE_META: { mode: VisualizerMode; label: string; icon: typeof Eye }[] = [
  { mode: "mandala", label: "Mandala", icon: Eye },
  { mode: "cosmos", label: "Cosmos", icon: Orbit },
  { mode: "neon", label: "Neon", icon: Zap },
  { mode: "liquid", label: "Liquid", icon: Droplets },
  { mode: "sacred", label: "Sacred", icon: Diamond },
  { mode: "ethereal", label: "Ethereal", icon: Sparkles },
  { mode: "fractal", label: "Fractal", icon: Flame },
  { mode: "warp", label: "Warp", icon: Waves },
];

function ShaderVisualizer({
  analyser,
  dataArray,
  fragShader,
}: {
  analyser: AnalyserNode;
  dataArray: Uint8Array<ArrayBuffer>;
  fragShader: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl");
    if (!gl) return;

    const program = createShaderProgram(gl, fragShader);
    if (!program) return;

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

    const posLoc = gl.getAttribLocation(program, "a_position");
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(program, "u_time");
    const uRes = gl.getUniformLocation(program, "u_resolution");
    const uBass = gl.getUniformLocation(program, "u_bass");
    const uMid = gl.getUniformLocation(program, "u_mid");
    const uTreble = gl.getUniformLocation(program, "u_treble");
    const uAmplitude = gl.getUniformLocation(program, "u_amplitude");

    let animId: number;
    const startTime = performance.now();

    function render() {
      if (!canvas || !gl) return;
      canvas.width = canvas.clientWidth * devicePixelRatio;
      canvas.height = canvas.clientHeight * devicePixelRatio;
      gl.viewport(0, 0, canvas.width, canvas.height);

      const time = (performance.now() - startTime) / 1000;

      // Still read audio to keep analyser flowing, but don't pass meaningful values
      analyser.getByteFrequencyData(dataArray);

      gl.useProgram(program);
      gl.uniform1f(uTime, time);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uBass, 0.0);
      gl.uniform1f(uMid, 0.0);
      gl.uniform1f(uTreble, 0.0);
      gl.uniform1f(uAmplitude, 0.0);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      animId = requestAnimationFrame(render);
    }

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [analyser, dataArray, fragShader]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
    />
  );
}

export function Visualizer({ audioElement, onClose }: VisualizerProps) {
  const [mode, setMode] = useState<VisualizerMode>("mandala");
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [dataArray, setDataArray] = useState<Uint8Array<ArrayBuffer> | null>(null);

  useEffect(() => {
    if (!audioElement) return;

    const cached = audioNodeCache.get(audioElement);
    if (cached) {
      if (cached.ctx.state === "suspended") cached.ctx.resume();
      setAnalyser(cached.analyser);
      setDataArray(new Uint8Array(cached.analyser.frequencyBinCount));
      return;
    }

    const ctx = new AudioContext();
    const source = ctx.createMediaElementSource(audioElement);
    const analyserNode = ctx.createAnalyser();
    analyserNode.fftSize = 256;
    source.connect(analyserNode);
    analyserNode.connect(ctx.destination);

    audioNodeCache.set(audioElement, { ctx, analyser: analyserNode });
    setAnalyser(analyserNode);
    setDataArray(new Uint8Array(analyserNode.frequencyBinCount));
  }, [audioElement]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {analyser && dataArray && (
        <ShaderVisualizer
          analyser={analyser}
          dataArray={dataArray}
          fragShader={SHADERS[mode]}
        />
      )}

      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between p-4">
        <div className="flex flex-wrap gap-1.5">
          {MODE_META.map(({ mode: m, label, icon: Icon }) => (
            <Button
              key={m}
              variant={mode === m ? "default" : "outline"}
              size="sm"
              onClick={() => setMode(m)}
              className="bg-black/50 border-white/20 text-white hover:bg-white/20 text-xs px-2.5 h-7"
            >
              <Icon className="mr-1 h-3 w-3" />
              {label}
            </Button>
          ))}
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={onClose}
          className="bg-black/50 border-white/20 text-white hover:bg-white/20 ml-2 shrink-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

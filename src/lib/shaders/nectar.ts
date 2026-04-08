import { U, SMOOTH_NOISE, VISIONARY_PALETTE, ROT2, SDF_PRIMITIVES, SMIN } from "./shared";

export const FRAG =
  U +
  SMOOTH_NOISE +
  VISIONARY_PALETTE +
  ROT2 +
  SDF_PRIMITIVES +
  SMIN +
  `
// Nectar — viscous golden drops dripping with surface tension

float fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 3; i++) { v += a * snoise(p); p = r * p * 2.0; a *= 0.5; }
  return v;
}

// Drip shape — circle stretching into teardrop
float sdDrip(vec2 p, vec2 center, float radius, float stretch) {
  vec2 d = p - center;
  // Bottom circle
  float circle = sdCircle(d, radius);
  // Stretched tail upward
  float tail = sdBox(d + vec2(0.0, -stretch * 0.5), vec2(radius * 0.4, stretch * 0.5));
  // Blend smoothly
  return smin(circle, tail, radius * 0.8);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.08;
  float bass = u_bass * 0.25;
  float mid = u_mid * 0.2;
  float treble = u_treble * 0.12;

  // Dark warm background
  float bgTex = fbm3(uv * 2.0 + t * 0.03);
  vec3 color = palette(
    bgTex * 0.2 + 0.3,
    vec3(0.04, 0.02, 0.01),
    vec3(0.03, 0.02, 0.01),
    vec3(0.15, 0.1, 0.05),
    vec3(0.0, 0.02, 0.01)
  );

  // Source ledge at top — where drops form
  float ledge = smoothstep(0.02, -0.01, uv.y - 0.45 - sin(uv.x * 3.0 + t) * 0.02);
  vec3 ledgeColor = palette(
    uv.x * 0.3 + 0.5,
    vec3(0.15, 0.08, 0.03),
    vec3(0.1, 0.06, 0.03),
    vec3(0.3, 0.2, 0.1),
    vec3(0.0, 0.05, 0.02)
  );
  color = mix(color, ledgeColor, ledge * 0.5);

  // Pool at bottom — collected nectar
  float poolY = -0.35;
  float poolSurface = poolY + sin(uv.x * 6.0 + t * 1.5) * 0.008
                             + sin(uv.x * 12.0 - t * 2.0) * 0.003
                             + bass * 0.015;
  float pool = smoothstep(0.01, -0.02, uv.y - poolSurface);

  // Pool is thicker (brighter) at center
  float poolDepth = smoothstep(poolY, poolY - 0.2, uv.y);
  vec3 poolColor = palette(
    uv.x * 0.2 + poolDepth * 0.3 + t * 0.01 + u_amplitude * 0.1,
    vec3(0.5, 0.35, 0.08),
    vec3(0.35, 0.25, 0.06),
    vec3(0.8, 0.6, 0.15),
    vec3(0.05, 0.08, 0.0)
  );

  // Surface tension highlight on pool
  float surfaceHighlight = smoothstep(0.015, 0.0, abs(uv.y - poolSurface)) * pool;
  vec3 highlightColor = vec3(0.9, 0.7, 0.3);

  color = mix(color, poolColor, pool * 0.7);
  color += highlightColor * surfaceHighlight * 0.4;

  // 6 drips at various stages
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    vec2 h = hash2(vec2(fi * 3.7, fi * 11.3));

    // X position along ledge
    float xPos = -0.5 + fi * 0.18 + h.x * 0.08;

    // Drip cycle — slow formation then fall
    float cycle = fract(t * 0.2 + h.y);
    float forming = smoothstep(0.0, 0.6, cycle); // growing phase
    float falling = smoothstep(0.6, 1.0, cycle); // detach and fall

    // Y position — hangs from ledge then falls
    float yPos;
    if (cycle < 0.6) {
      // Forming — stretches down slowly
      yPos = 0.43 - forming * 0.15;
    } else {
      // Falling — accelerates down
      float fallT = (cycle - 0.6) / 0.4;
      yPos = 0.43 - 0.15 - fallT * fallT * 0.7;
    }

    vec2 center = vec2(xPos, yPos);
    float radius = 0.02 + forming * 0.015 + bass * 0.005;
    float stretch = forming * 0.06 * (1.0 - falling);

    float d = sdDrip(uv, center, radius, stretch);
    float body = smoothstep(0.005, -0.003, d);
    float edge = smoothstep(0.005, 0.0, abs(d));

    // Internal refraction-like highlight
    float highlight = smoothstep(0.02, 0.0, length(uv - center + vec2(0.005, 0.008)));

    // Golden amber color
    float colorT = fi * 0.1 + t * 0.015 + mid * 0.3;
    vec3 dropColor = palette(
      colorT,
      vec3(0.55, 0.38, 0.08),
      vec3(0.35, 0.25, 0.06),
      vec3(0.85, 0.65, 0.15),
      vec3(0.05, 0.08, 0.0)
    );

    vec3 dropHighlight = palette(
      colorT + 0.2,
      vec3(0.8, 0.6, 0.2),
      vec3(0.4, 0.3, 0.1),
      vec3(0.95, 0.8, 0.3),
      vec3(0.1, 0.1, 0.0)
    );

    // Fade away at pool level
    float vis = 1.0 - smoothstep(poolY + 0.05, poolY - 0.02, yPos);

    color += dropColor * body * 0.6 * vis;
    color += dropHighlight * highlight * body * 0.4 * vis;
    color += dropColor * edge * 0.2 * vis;

    // Impact ripples when hitting pool
    if (cycle > 0.85) {
      float rippleT = (cycle - 0.85) / 0.15;
      float rippleR = rippleT * 0.12;
      vec2 impactPos = vec2(xPos, poolSurface);
      float ripple = smoothstep(0.004, 0.0, abs(length(uv - impactPos) - rippleR));
      ripple *= (1.0 - rippleT); // fade
      color += highlightColor * ripple * 0.3;
    }
  }

  // Viscous threads connecting drips to ledge
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    vec2 h = hash2(vec2(fi * 5.3, fi * 7.7));
    float xPos = -0.4 + fi * 0.22 + h.x * 0.06;
    float cycle = fract(t * 0.2 + h.y);
    if (cycle < 0.65) {
      float threadBottom = 0.43 - cycle * 0.25;
      float threadD = abs(uv.x - xPos);
      float threadY = smoothstep(0.43, threadBottom, uv.y) * smoothstep(threadBottom - 0.01, threadBottom, uv.y);
      float thread = smoothstep(0.002, 0.0, threadD) * threadY;
      color += vec3(0.5, 0.35, 0.1) * thread * 0.3;
    }
  }

  // Vignette
  color *= smoothstep(1.4, 0.4, length(uv));
  gl_FragColor = vec4(color, 1.0);
}
`;

import { U, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG = U + VISIONARY_PALETTE + ROT2 + `
// Tangent line field creating envelope patterns
// Short tangent lines to a family of curves; envelope emerges as bright concentration

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.14;
  vec3 color = vec3(0.0);

  // Family of parabolas — tangent lines form an astroid-like envelope
  for (int i = 0; i < 60; i++) {
    float fi = float(i) / 60.0;
    float param = (fi - 0.5) * 3.0;

    // Point on the curve: y = param*x - param^2 (tangent to y=x^2/4, envelope)
    // We draw short line segments of this tangent line
    float slope = param;
    float intercept = -param * param * 0.25;
    float audioWarp = sin(t * 0.5 + fi * 6.28) * u_mid * 0.03;

    // Two endpoints of the tangent line segment
    float halfLen = 0.4 + u_bass * 0.05;
    float cx = param * 0.3 + audioWarp;
    float cy = slope * cx + intercept;
    vec2 dir = normalize(vec2(1.0, slope)) * halfLen;
    vec2 a = vec2(cx, cy) - dir;
    vec2 b = vec2(cx, cy) + dir;

    a = rot2(t * 0.2) * a;
    b = rot2(t * 0.2) * b;

    // Distance from uv to line segment ab
    vec2 pa = uv - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    float d = length(pa - ba * h);

    float glow = 0.0015 / (d + 0.001);
    float phase = fi + t * 0.15;
    vec3 c = palette(phase, vec3(0.5, 0.5, 0.5), vec3(0.5, 0.5, 0.5),
                      vec3(1.0, 0.8, 0.5), vec3(0.0, 0.1, 0.25));
    color += c * glow * 0.04;
  }

  // Second family — rotated 90 degrees for cross-hatched envelope
  for (int i = 0; i < 40; i++) {
    float fi = float(i) / 40.0;
    float param = (fi - 0.5) * 3.0;
    float slope = param;
    float intercept = -param * param * 0.25;
    float halfLen = 0.35;
    float cx = param * 0.25;
    float cy = slope * cx + intercept;
    vec2 dir = normalize(vec2(1.0, slope)) * halfLen;
    vec2 a = vec2(cx, cy) - dir;
    vec2 b = vec2(cx, cy) + dir;
    a = rot2(t * 0.2 + 1.5708) * a;
    b = rot2(t * 0.2 + 1.5708) * b;

    vec2 pa = uv - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    float d = length(pa - ba * h);
    float glow = 0.001 / (d + 0.001);
    float phase = fi + t * 0.15 + 0.5;
    vec3 c = palette(phase, vec3(0.5, 0.5, 0.5), vec3(0.5, 0.5, 0.3),
                      vec3(0.5, 1.0, 0.7), vec3(0.15, 0.2, 0.35));
    color += c * glow * 0.03;
  }

  // Vignette
  float vig = 1.0 - smoothstep(0.4, 1.4, length(uv));
  color *= vig;

  gl_FragColor = vec4(color, 1.0);
}
`;

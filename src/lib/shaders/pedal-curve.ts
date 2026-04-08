import { U, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG = U + VISIONARY_PALETTE + ROT2 + `
// Pedal curves orbiting an ellipse focus
// Foot-of-perpendicular from focus to tangent traces a curve, 80 points

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.16;
  vec3 color = vec3(0.0);

  float PI = 3.14159;

  // Draw ellipse
  float ea = 0.45 + u_bass * 0.03;
  float eb = 0.25 + u_mid * 0.02;
  for (int i = 0; i < 80; i++) {
    float fi = float(i) / 80.0;
    float theta = fi * 6.28318;
    vec2 ep = vec2(ea * cos(theta), eb * sin(theta));
    ep = rot2(t * 0.2) * ep;
    float d = length(uv - ep);
    float glow = 0.002 / (d + 0.001);
    color += vec3(0.3, 0.35, 0.5) * glow * 0.04;
  }

  // Focal distance
  float c_focal = sqrt(max(ea * ea - eb * eb, 0.0));

  // Draw pedal curves from 3 different focal positions
  for (int f = 0; f < 3; f++) {
    float ff = float(f);
    // Focus positions: right focus, left focus, center
    vec2 focus;
    if (f == 0) focus = vec2(c_focal, 0.0);
    else if (f == 1) focus = vec2(-c_focal, 0.0);
    else focus = vec2(0.0, 0.0);

    focus = rot2(t * 0.2) * focus;

    for (int i = 0; i < 80; i++) {
      float fi = float(i) / 80.0;
      float theta = fi * 6.28318;

      // Point on ellipse (before rotation)
      float ct = cos(theta), st = sin(theta);
      vec2 ep = vec2(ea * ct, eb * st);
      // Tangent vector (before rotation)
      vec2 tang = normalize(vec2(-ea * st, eb * ct));

      // Rotate both
      ep = rot2(t * 0.2) * ep;
      tang = rot2(t * 0.2) * tang;

      // Foot of perpendicular from focus to tangent line at ep
      // Project (focus - ep) onto tangent, then foot = ep + proj
      vec2 diff = focus - ep;
      float proj = dot(diff, tang);
      vec2 foot = ep + proj * tang;

      float d = length(uv - foot);
      float glow = 0.003 / (d + 0.001);
      float phase = fi + ff * 0.33 + t * 0.15;
      vec3 c = palette(phase, vec3(0.5, 0.5, 0.5), vec3(0.5, 0.5, 0.5),
                        vec3(1.0, 0.7, 0.4), vec3(0.0, 0.15, 0.2));
      color += c * glow * 0.06;
    }

    // Focus point glow
    float fd = length(uv - focus);
    float fGlow = 0.005 / (fd + 0.004);
    color += vec3(1.0, 0.9, 0.7) * fGlow * 0.15;
  }

  // Vignette
  float vig = 1.0 - smoothstep(0.4, 1.4, length(uv));
  color *= vig;

  gl_FragColor = vec4(color, 1.0);
}
`;

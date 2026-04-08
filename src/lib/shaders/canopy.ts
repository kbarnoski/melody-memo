import { U, SMOOTH_NOISE, VISIONARY_PALETTE, ROT2 } from "./shared";

export const FRAG =
  U +
  SMOOTH_NOISE +
  VISIONARY_PALETTE +
  ROT2 +
  `
// Canopy — overlapping leaf shapes with light filtering through

float fbm3(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 r = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 3; i++) { v += a * snoise(p); p = r * p * 2.0; a *= 0.5; }
  return v;
}

// Elliptical leaf shape with pointed tips
float leaf(vec2 uv, vec2 center, float angle, float size, float aspect) {
  vec2 d = uv - center;
  d = rot2(angle) * d;
  d.x /= aspect;
  // Pointed tip shape: elongated ellipse with sharpening at ends
  float base = length(d) / size;
  float tip = pow(abs(d.x / size), 0.6); // sharpen ends
  return smoothstep(1.0, 0.7, base + tip * 0.3);
}

// Leaf vein pattern
float vein(vec2 uv, vec2 center, float angle, float size) {
  vec2 d = uv - center;
  d = rot2(angle) * d;
  // Central vein
  float central = smoothstep(0.003, 0.0, abs(d.y)) * smoothstep(size, 0.0, abs(d.x));
  // Side veins
  float side = 0.0;
  for (int i = 1; i < 5; i++) {
    float fi = float(i);
    float xOff = fi * size * 0.2;
    vec2 vp = d - vec2(xOff, 0.0);
    float sv = smoothstep(0.004, 0.0, abs(vp.y - vp.x * 0.6));
    sv *= smoothstep(size * 0.5, 0.0, abs(vp.x));
    vp = d - vec2(-xOff, 0.0);
    float sv2 = smoothstep(0.004, 0.0, abs(vp.y + vp.x * 0.6));
    sv2 *= smoothstep(size * 0.5, 0.0, abs(vp.x));
    side += (sv + sv2) * (1.0 - fi * 0.2);
  }
  return central * 0.6 + side * 0.3;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  float t = u_time * 0.06;
  float bass = u_bass * 0.2;
  float mid = u_mid * 0.15;
  float treble = u_treble * 0.1;

  // Sky/light background — warm golden light filtering down
  float skyGrad = smoothstep(-0.8, 0.8, uv.y);
  vec3 color = mix(
    vec3(0.02, 0.04, 0.01),
    vec3(0.01, 0.02, 0.01),
    skyGrad
  );

  // Dappled light beams
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float beamX = sin(fi * 2.1 + t * 0.3) * 0.8;
    float beamWidth = 0.08 + 0.04 * sin(t * 0.5 + fi * 1.5);
    float beam = smoothstep(beamWidth, 0.0, abs(uv.x - beamX));
    beam *= smoothstep(-0.5, 0.3, uv.y); // beams come from above
    beam *= 0.5 + 0.5 * sin(t * 0.8 + fi * 3.0 + bass * 2.0);
    vec3 beamColor = palette(
      fi * 0.12 + t * 0.02 + treble,
      vec3(0.4, 0.45, 0.1),
      vec3(0.3, 0.3, 0.1),
      vec3(0.8, 0.9, 0.3),
      vec3(0.1, 0.15, 0.0)
    );
    color += beamColor * beam * 0.08;
  }

  // 8 overlapping leaf layers
  float totalLeafMask = 0.0;
  for (int i = 0; i < 8; i++) {
    float fi = float(i);
    vec2 h = hash2(vec2(fi * 3.7, fi * 11.3));

    // Leaf position — sway gently
    vec2 center = vec2(
      h.x * 1.6 - 0.8 + sin(t * 0.4 + fi * 1.7) * 0.08,
      h.y * 1.2 - 0.6 + sin(t * 0.3 + fi * 2.1) * 0.05
    );

    float angle = fi * 0.7 + sin(t * 0.2 + fi) * 0.15 + mid * 0.3;
    float size = 0.15 + h.x * 0.12 + bass * 0.03;
    float aspect = 1.8 + h.y * 0.6;

    float lf = leaf(uv, center, angle, size, aspect);
    float vn = vein(uv, center, angle, size);

    // Leaf color — green with variation
    float colorT = fi * 0.08 + t * 0.015 + u_amplitude * 0.1;
    vec3 leafColor = palette(
      colorT,
      vec3(0.1, 0.25, 0.05),
      vec3(0.1, 0.2, 0.05),
      vec3(0.3, 0.8, 0.2),
      vec3(0.05, 0.15, 0.0)
    );

    // Translucency — light through leaf
    float translucency = smoothstep(0.3, 0.8, lf) * 0.3;
    vec3 transColor = palette(
      colorT + 0.3,
      vec3(0.3, 0.5, 0.1),
      vec3(0.2, 0.3, 0.1),
      vec3(0.6, 0.9, 0.3),
      vec3(0.1, 0.2, 0.0)
    );

    // Darker veins
    vec3 veinColor = leafColor * 0.5;

    color += leafColor * lf * 0.2;
    color += transColor * translucency;
    color += veinColor * vn * lf * 0.15;

    totalLeafMask += lf;
  }

  // Where leaves overlap heavily, darken slightly for depth
  float overlap = smoothstep(1.5, 3.0, totalLeafMask);
  color *= 1.0 - overlap * 0.2;

  // Subtle fbm3 texture over everything — organic variation
  float tex = fbm3(uv * 4.0 + t * 0.1) * 0.5 + 0.5;
  color *= 0.9 + tex * 0.15;

  // Vignette
  color *= smoothstep(1.5, 0.5, length(uv));
  gl_FragColor = vec4(color, 1.0);
}
`;

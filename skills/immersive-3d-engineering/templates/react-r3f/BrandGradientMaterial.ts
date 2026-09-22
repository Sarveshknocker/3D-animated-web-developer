// Token-driven flowing gradient shader — reference for shader conventions
// (brand colors as uniforms, uMotion factor for reduced motion / pause, pointer influence).
import { Color, ShaderMaterial, Vector2 } from 'three';
import { readToken } from './webgl';

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision mediump float;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uMotion;   // 0 = frozen (reduced motion / paused), 1 = full
  uniform vec2 uPointer;   // -1..1
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uColorC;

  // 2D simplex noise (Ashima Arts, MIT)
  vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m; m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g; g.x = a0.x * x0.x + h.x * x0.y; g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  void main() {
    float t = uTime * 0.08 * uMotion;
    vec2 uv = vUv + uPointer * 0.03;
    float n1 = snoise(uv * 1.6 + vec2(t, -t));
    float n2 = snoise(uv * 2.4 - vec2(t * 0.7, t * 1.3) + n1 * 0.4);
    vec3 col = mix(uColorA, uColorB, smoothstep(-0.6, 0.6, n1));
    col = mix(col, uColorC, smoothstep(0.1, 0.9, n2) * 0.6);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

export function createBrandGradientMaterial(tokens = ['--brand-500', '--brand-300', '--accent-500']) {
  const [a, b, c] = tokens.map((t, i) => new Color(readToken(t, ['#3b5bfd', '#9fb4ff', '#ff6b9a'][i])));
  return new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime: { value: 0 },
      uMotion: { value: 1 },
      uPointer: { value: new Vector2() },
      uColorA: { value: a },
      uColorB: { value: b },
      uColorC: { value: c },
    },
  });
}

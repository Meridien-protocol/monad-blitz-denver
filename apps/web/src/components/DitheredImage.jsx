import { useRef, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree, useLoader } from '@react-three/fiber';
import * as THREE from 'three';

const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = `
precision highp float;

uniform sampler2D uTexture;
uniform float uTime;
uniform float uDistortion;
uniform vec3 uTint;
uniform float uTintStrength;
uniform float uColorNum;
uniform float uPixelSize;
uniform vec2 uResolution;

varying vec2 vUv;

// 4x4 Bayer dither computed via formula (no arrays needed, GLSL 1.00 safe)
float bayer4x4(vec2 pos) {
  vec2 p = floor(mod(pos, 4.0));
  float x = p.x;
  float y = p.y;
  // M(i,j) = bit-reverse interleave of (i XOR j, i)
  // For 4x4: simplified formula
  float v = mod(x + y * 2.0, 4.0);
  float u = mod(x * 2.0 + y, 4.0);
  return (v * 4.0 + u) / 16.0;
}

// Better: use a standard 4x4 Bayer via conditional (small, reliable)
float bayer(vec2 pos) {
  vec2 p = floor(mod(pos, 4.0));
  float i = p.x + p.y * 4.0;

  // Unrolled 4x4 Bayer matrix lookup
  if (i < 1.0) return 0.0 / 16.0;
  if (i < 2.0) return 8.0 / 16.0;
  if (i < 3.0) return 2.0 / 16.0;
  if (i < 4.0) return 10.0 / 16.0;
  if (i < 5.0) return 12.0 / 16.0;
  if (i < 6.0) return 4.0 / 16.0;
  if (i < 7.0) return 14.0 / 16.0;
  if (i < 8.0) return 6.0 / 16.0;
  if (i < 9.0) return 3.0 / 16.0;
  if (i < 10.0) return 11.0 / 16.0;
  if (i < 11.0) return 1.0 / 16.0;
  if (i < 12.0) return 9.0 / 16.0;
  if (i < 13.0) return 15.0 / 16.0;
  if (i < 14.0) return 7.0 / 16.0;
  if (i < 15.0) return 13.0 / 16.0;
  return 5.0 / 16.0;
}

vec3 dither(vec2 fragCoord, vec3 color) {
  vec2 scaledCoord = floor(fragCoord / uPixelSize);
  float threshold = bayer(scaledCoord) - 0.25;
  float s = 1.0 / (uColorNum - 1.0);
  color += threshold * s;
  color = clamp(color - 0.08, 0.0, 1.0);
  return floor(color * (uColorNum - 1.0) + 0.5) / (uColorNum - 1.0);
}

void main() {
  // Pixelate UV
  vec2 pixelUv = uPixelSize / uResolution;
  vec2 uv = pixelUv * floor(vUv / pixelUv);

  // Subtle wave distortion
  float wave1 = sin(uv.y * 12.0 + uTime * 0.4) * uDistortion;
  float wave2 = cos(uv.x * 10.0 + uTime * 0.3) * uDistortion * 0.7;
  uv += vec2(wave1, wave2);
  uv = clamp(uv, 0.0, 1.0);

  vec4 color = texture2D(uTexture, uv);

  // Warm tint
  color.rgb = mix(color.rgb, color.rgb * uTint, uTintStrength);

  // Bayer dithering
  vec2 fc = vUv * uResolution;
  color.rgb = dither(fc, color.rgb);

  gl_FragColor = color;
}
`;

function ImagePlane({ src, distortion, tint, tintStrength, colorNum, pixelSize, focusX, focusY }) {
  const mesh = useRef(null);
  const { viewport, size, gl } = useThree();
  const texture = useLoader(THREE.TextureLoader, src);

  const uniforms = useMemo(() => ({
    uTexture: { value: texture },
    uTime: { value: 0 },
    uDistortion: { value: distortion },
    uTint: { value: new THREE.Color(...tint) },
    uTintStrength: { value: tintStrength },
    uColorNum: { value: colorNum },
    uPixelSize: { value: pixelSize },
    uResolution: { value: new THREE.Vector2(size.width, size.height) },
  }), [texture]);

  useFrame(({ clock }) => {
    uniforms.uTime.value = clock.getElapsedTime();
    const dpr = gl.getPixelRatio();
    uniforms.uResolution.value.set(size.width * dpr, size.height * dpr);
  });

  const imageAspect = texture.image ? texture.image.width / texture.image.height : 16 / 9;
  const viewportAspect = viewport.width / viewport.height;

  let pw, ph, posX = 0, posY = 0;
  if (viewportAspect > imageAspect) {
    pw = viewport.width;
    ph = viewport.width / imageAspect;
    const overflowY = ph - viewport.height;
    posY = Math.max(-overflowY / 2, Math.min(overflowY / 2, (focusY - 0.5) * ph));
  } else {
    ph = viewport.height;
    pw = viewport.height * imageAspect;
    const overflowX = pw - viewport.width;
    posX = Math.max(-overflowX / 2, Math.min(overflowX / 2, (0.5 - focusX) * pw));
  }

  return (
    <mesh ref={mesh} scale={[pw, ph, 1]} position={[posX, posY, 0]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  );
}

export default function DitheredImage({
  src = '/revolution.png',
  colorNum = 4,
  pixelSize = 2,
  distortion = 0.003,
  tint = [1.2, 1.0, 0.8],
  tintStrength = 0.3,
  focusX = 0.5,
  focusY = 0.5,
}) {
  return (
    <Canvas
      camera={{ position: [0, 0, 6] }}
      dpr={1}
      gl={{ antialias: false }}
      style={{ width: '100%', height: '100%', display: 'block' }}
    >
      <Suspense fallback={null}>
        <ImagePlane
          src={src}
          distortion={distortion}
          tint={tint}
          tintStrength={tintStrength}
          colorNum={colorNum}
          pixelSize={pixelSize}
          focusX={focusX}
          focusY={focusY}
        />
      </Suspense>
    </Canvas>
  );
}

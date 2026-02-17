"use client";

import {
  forwardRef,
  useRef,
  useMemo,
  useState,
  useCallback,
  type ButtonHTMLAttributes,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// CVA
// ---------------------------------------------------------------------------

const buttonVariants = cva(
  [
    "relative inline-flex items-center justify-center rounded font-sans",
    "font-bold uppercase tracking-wider overflow-hidden transition-all",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
    "focus-visible:ring-offset-meridian-bg disabled:opacity-40 disabled:cursor-not-allowed",
    "select-none",
  ].join(" "),
  {
    variants: {
      variant: {
        gold: "text-meridian-bg drop-shadow-[0_1px_1px_rgba(212,168,83,0.3)] focus-visible:ring-meridian-gold",
        yes: "text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] focus-visible:ring-yes",
        no: "text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] focus-visible:ring-no",
        neutral: "text-neutral-200 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] focus-visible:ring-neutral-500",
      },
      size: {
        sm: "px-3 py-1.5 text-[10px] tracking-[0.2em]",
        md: "px-4 py-2.5 text-xs tracking-[0.25em]",
        lg: "px-6 py-3 text-sm tracking-[0.3em]",
      },
    },
    defaultVariants: {
      variant: "gold",
      size: "md",
    },
  },
);

// ---------------------------------------------------------------------------
// Colour map (RGB 0-1)
// ---------------------------------------------------------------------------

const VARIANT_COLORS: Record<string, [number, number, number]> = {
  gold: [0.831, 0.659, 0.325],
  yes: [0.545, 0.667, 0.431],
  no: [0.769, 0.376, 0.29],
  neutral: [0.235, 0.235, 0.29],
};

const BG_COLOR: [number, number, number] = [0.039, 0.039, 0.059]; // #0A0A0F

// ---------------------------------------------------------------------------
// Shaders
// ---------------------------------------------------------------------------

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragmentShader = /* glsl */ `
precision highp float;

uniform vec3 uColor;
uniform vec3 uBgColor;
uniform float uTime;
uniform float uHover;
uniform float uColorNum;
uniform float uPixelSize;
uniform vec2 uResolution;

varying vec2 vUv;

// 4x4 Bayer matrix lookup (identical to DitheredImage.jsx)
float bayer(vec2 pos) {
  vec2 p = floor(mod(pos, 4.0));
  float i = p.x + p.y * 4.0;

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
  color += threshold * s * 0.6;
  color = clamp(color - 0.03, 0.0, 1.0);
  return floor(color * (uColorNum - 1.0) + 0.5) / (uColorNum - 1.0);
}

void main() {
  // Pixelate UV
  vec2 pixelUv = uPixelSize / uResolution;
  vec2 uv = pixelUv * floor(vUv / pixelUv);

  // Subtle diagonal gradient (mostly variant color, slight darkening at edges)
  float gradientPos = uv.x * 0.7 + uv.y * 0.3;
  float edge = 0.75 + gradientPos * 0.25; // range 0.75 - 1.0

  // Hover brightness boost
  float brightness = edge
    + uHover * 0.15
    + sin(uTime * 3.0 + uv.x * 6.0) * 0.06 * uHover;

  // Base color is mostly the variant, with a slight dark-edge vignette
  vec3 col = uColor * brightness;

  // Bayer dithering (subtle texture, not dominant)
  vec2 fc = vUv * uResolution;
  col = dither(fc, col);

  gl_FragColor = vec4(col, 1.0);
}
`;

// ---------------------------------------------------------------------------
// Inner Three.js plane (runs inside <Canvas>)
// ---------------------------------------------------------------------------

interface ButtonPlaneProps {
  variantColor: [number, number, number];
  colorNum: number;
  pixelSize: number;
  hovered: boolean;
}

function ButtonPlane({
  variantColor,
  colorNum,
  pixelSize,
  hovered,
}: ButtonPlaneProps) {
  const mesh = useRef<THREE.Mesh>(null);
  const { viewport, size, gl, invalidate } = useThree();

  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(...variantColor) },
      uBgColor: { value: new THREE.Color(...BG_COLOR) },
      uTime: { value: 0 },
      uHover: { value: 0 },
      uColorNum: { value: colorNum },
      uPixelSize: { value: pixelSize },
      uResolution: { value: new THREE.Vector2(size.width, size.height) },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Keep static uniforms in sync with props
  const prevColor = useRef(variantColor);
  if (
    variantColor[0] !== prevColor.current[0] ||
    variantColor[1] !== prevColor.current[1] ||
    variantColor[2] !== prevColor.current[2]
  ) {
    uniforms.uColor.value.set(...variantColor);
    prevColor.current = variantColor;
    invalidate();
  }
  if (uniforms.uColorNum.value !== colorNum) {
    uniforms.uColorNum.value = colorNum;
    invalidate();
  }
  if (uniforms.uPixelSize.value !== pixelSize) {
    uniforms.uPixelSize.value = pixelSize;
    invalidate();
  }

  useFrame(({ clock }) => {
    const dpr = gl.getPixelRatio();
    uniforms.uResolution.value.set(size.width * dpr, size.height * dpr);

    // Lerp hover uniform
    const target = hovered ? 1 : 0;
    const current = uniforms.uHover.value;
    const next = THREE.MathUtils.lerp(current, target, 0.12);
    uniforms.uHover.value = next;

    // Only advance time while hovering (or transitioning out)
    if (next > 0.01) {
      uniforms.uTime.value = clock.getElapsedTime();
      invalidate();
    }
  });

  return (
    <mesh ref={mesh} scale={[viewport.width, viewport.height, 1]}>
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

export interface DitheredButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  colorNum?: number;
  pixelSize?: number;
}

const DitheredButton = forwardRef<HTMLButtonElement, DitheredButtonProps>(
  (
    {
      className,
      variant = "gold",
      size = "md",
      loading = false,
      colorNum = 5,
      pixelSize = 2,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const [hovered, setHovered] = useState(false);
    const isDisabled = disabled || loading;

    const variantColor = VARIANT_COLORS[variant ?? "gold"];

    const handleMouseEnter = useCallback(() => {
      if (!isDisabled) setHovered(true);
    }, [isDisabled]);

    const handleMouseLeave = useCallback(() => {
      setHovered(false);
    }, []);

    return (
      <button
        ref={ref}
        type="button"
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        {/* WebGL dithered background */}
        <span className="absolute inset-0" aria-hidden="true">
          <Canvas
            camera={{ position: [0, 0, 6] }}
            dpr={1}
            gl={{ antialias: false, alpha: false }}
            frameloop="demand"
            style={{ width: "100%", height: "100%", display: "block" }}
          >
            <ButtonPlane
              variantColor={variantColor}
              colorNum={colorNum}
              pixelSize={pixelSize}
              hovered={hovered}
            />
          </Canvas>
        </span>

        {/* Text content */}
        <span className="relative z-10">
          {loading ? (
            <span className="inline-flex items-center gap-0.5">
              <span className="animate-pulse">...</span>
            </span>
          ) : (
            children
          )}
        </span>
      </button>
    );
  },
);

DitheredButton.displayName = "DitheredButton";

export { DitheredButton, buttonVariants };

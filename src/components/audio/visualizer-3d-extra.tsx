"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import type { AnalyserLike } from "@/lib/audio/audio-engine";

// ─── Audio data hook (self-contained copy — avoids coupling to main file internals) ───

interface AudioData {
  bass: number;
  mid: number;
  treble: number;
  amplitude: number;
}

function useAudioData(
  _analyser: AnalyserLike,
  _dataArray: Uint8Array<ArrayBuffer>
): React.MutableRefObject<AudioData> {
  const ref = useRef<AudioData>({ bass: 0, mid: 0, treble: 0, amplitude: 0 });

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    const s = ref.current;
    s.bass = 0.3 + 0.12 * Math.sin(time * 0.13);
    s.mid = 0.25 + 0.1 * Math.sin(time * 0.17 + 1.0);
    s.treble = 0.2 + 0.08 * Math.sin(time * 0.23 + 2.0);
    s.amplitude = 0.28 + 0.1 * Math.sin(time * 0.11 + 0.5);
  });

  return ref;
}

// Props type shared by all scenes
interface SceneProps {
  analyser: AnalyserLike;
  dataArray: Uint8Array<ArrayBuffer>;
}

// ─── 1. Wave scene — 3D ocean surface ───

export function WaveScene({ analyser, dataArray }: SceneProps) {
  const audio = useAudioData(analyser, dataArray);
  const meshRef = useRef<THREE.Mesh>(null);
  const geoRef = useRef<THREE.PlaneGeometry>(null);

  const SEG = 128;

  // Store original positions
  const basePositions = useMemo(() => {
    const geo = new THREE.PlaneGeometry(16, 16, SEG, SEG);
    return new Float32Array(geo.attributes.position.array);
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const a = audio.current;

    if (!geoRef.current) return;
    const positions = geoRef.current.attributes.position.array as Float32Array;
    const colors = geoRef.current.attributes.color?.array as Float32Array | undefined;

    // Create color attribute if needed
    if (!geoRef.current.attributes.color) {
      const colorArr = new Float32Array(positions.length);
      geoRef.current.setAttribute("color", new THREE.BufferAttribute(colorArr, 3));
    }
    const colorArray = (geoRef.current.attributes.color.array as Float32Array);

    const vertCount = (SEG + 1) * (SEG + 1);
    for (let i = 0; i < vertCount; i++) {
      const bx = basePositions[i * 3];
      const by = basePositions[i * 3 + 1];

      // Layer multiple sine waves for ocean surface
      const wave1 = Math.sin(bx * 0.4 + t * 0.6) * 0.6;
      const wave2 = Math.sin(by * 0.3 + t * 0.45) * 0.4;
      const wave3 = Math.sin(bx * 0.8 - t * 0.7 + by * 0.5) * 0.25;
      const wave4 = Math.sin(bx * 1.5 + by * 1.2 + t * 1.0) * 0.1;

      // Subtle audio influence on wave height
      const audioMod = 1.0 + a.bass * 0.15 + a.mid * 0.08;
      const height = (wave1 + wave2 + wave3 + wave4) * audioMod;

      positions[i * 3 + 2] = height;

      // Color: deeper blue in troughs, white foam on crests
      const normalized = (height + 1.5) / 3.0; // roughly 0-1
      const foaminess = Math.max(0, (normalized - 0.6) * 2.5);
      colorArray[i * 3] = 0.02 + foaminess * 0.9;     // R
      colorArray[i * 3 + 1] = 0.08 + normalized * 0.25 + foaminess * 0.85; // G
      colorArray[i * 3 + 2] = 0.25 + normalized * 0.35 + foaminess * 0.6;  // B
    }

    geoRef.current.attributes.position.needsUpdate = true;
    geoRef.current.attributes.color.needsUpdate = true;
    geoRef.current.computeVertexNormals();
  });

  return (
    <>
      <ambientLight intensity={0.15} />
      <directionalLight position={[5, 1.5, 3]} intensity={0.8} color="#ffe8cc" />
      <directionalLight position={[-3, 0.5, -2]} intensity={0.3} color="#4488ff" />
      <mesh ref={meshRef} rotation={[-Math.PI / 2.5, 0, 0]} position={[0, -1, 0]}>
        <planeGeometry ref={geoRef} args={[16, 16, SEG, SEG]} />
        <meshStandardMaterial
          vertexColors
          roughness={0.3}
          metalness={0.1}
          side={THREE.DoubleSide}
        />
      </mesh>
      <EffectComposer>
        <Bloom luminanceThreshold={0.6} luminanceSmoothing={0.9} intensity={0.8} />
      </EffectComposer>
    </>
  );
}

// ─── 2. Seabed scene — underwater floor with marine snow and plants ───

export function SeabedScene({ analyser, dataArray }: SceneProps) {
  const audio = useAudioData(analyser, dataArray);
  const terrainRef = useRef<THREE.Mesh>(null);
  const terrainGeoRef = useRef<THREE.PlaneGeometry>(null);
  const snowRef = useRef<THREE.Points>(null);
  const plantsRef = useRef<THREE.Group>(null);

  const TERRAIN_SEG = 64;
  const SNOW_COUNT = 1500;
  const PLANT_COUNT = 20;

  // Generate terrain heights
  const terrainHeights = useMemo(() => {
    const heights = new Float32Array((TERRAIN_SEG + 1) * (TERRAIN_SEG + 1));
    for (let j = 0; j <= TERRAIN_SEG; j++) {
      for (let i = 0; i <= TERRAIN_SEG; i++) {
        const x = (i / TERRAIN_SEG - 0.5) * 10;
        const z = (j / TERRAIN_SEG - 0.5) * 10;
        heights[j * (TERRAIN_SEG + 1) + i] =
          Math.sin(x * 0.5) * 0.4 +
          Math.sin(z * 0.7 + 1.0) * 0.3 +
          Math.sin(x * 1.3 + z * 0.9) * 0.15;
      }
    }
    return heights;
  }, []);

  // Marine snow particles
  const snowPositions = useMemo(() => {
    const pos = new Float32Array(SNOW_COUNT * 3);
    for (let i = 0; i < SNOW_COUNT; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 12;
      pos[i * 3 + 1] = Math.random() * 6 - 1;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 12;
    }
    return pos;
  }, []);

  // Plant data
  const plantData = useMemo(() => {
    return Array.from({ length: PLANT_COUNT }, () => ({
      x: (Math.random() - 0.5) * 8,
      z: (Math.random() - 0.5) * 8,
      height: 0.5 + Math.random() * 1.2,
      phase: Math.random() * Math.PI * 2,
      swaySpeed: 0.3 + Math.random() * 0.4,
    }));
  }, []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const a = audio.current;

    // Animate terrain slightly
    if (terrainGeoRef.current) {
      const pos = terrainGeoRef.current.attributes.position.array as Float32Array;
      const count = (TERRAIN_SEG + 1) * (TERRAIN_SEG + 1);
      for (let i = 0; i < count; i++) {
        pos[i * 3 + 2] = terrainHeights[i] + Math.sin(t * 0.2 + i * 0.01) * 0.05;
      }
      terrainGeoRef.current.attributes.position.needsUpdate = true;
      terrainGeoRef.current.computeVertexNormals();
    }

    // Marine snow — slow drift
    if (snowRef.current) {
      const pos = snowRef.current.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < SNOW_COUNT; i++) {
        pos[i * 3 + 1] -= 0.003 + Math.sin(t * 0.1 + i) * 0.001;
        pos[i * 3] += Math.sin(t * 0.15 + i * 0.3) * 0.002;
        // Reset particles that fall too low
        if (pos[i * 3 + 1] < -1.5) {
          pos[i * 3 + 1] = 5;
        }
      }
      snowRef.current.geometry.attributes.position.needsUpdate = true;
    }

    // Sway plants
    if (plantsRef.current) {
      plantsRef.current.children.forEach((child, i) => {
        if (i >= plantData.length) return;
        const pd = plantData[i];
        const sway = Math.sin(t * pd.swaySpeed + pd.phase) * 0.15;
        const audioCurrent = a.mid * 0.05;
        child.rotation.z = sway + audioCurrent;
        child.rotation.x = Math.sin(t * pd.swaySpeed * 0.7 + pd.phase + 1) * 0.08;
      });
    }
  });

  return (
    <>
      {/* Atmospheric lighting */}
      <ambientLight intensity={0.12} color="#1a3a3a" />
      <directionalLight position={[2, 8, 1]} intensity={0.3} color="#88ccdd" />
      <pointLight position={[0, 3, 0]} intensity={0.2} color="#44aaaa" />

      {/* Fog for underwater feel */}
      <fog attach="fog" args={["#0a1a1a", 3, 14]} />

      {/* Terrain */}
      <mesh ref={terrainRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.5, 0]}>
        <planeGeometry ref={terrainGeoRef} args={[10, 10, TERRAIN_SEG, TERRAIN_SEG]} />
        <meshStandardMaterial color="#1a3328" roughness={0.9} />
      </mesh>

      {/* Marine snow */}
      <points ref={snowRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[snowPositions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.025}
          color="#aaddcc"
          transparent
          opacity={0.4}
          depthWrite={false}
        />
      </points>

      {/* Sea plants */}
      <group ref={plantsRef}>
        {plantData.map((pd, i) => (
          <mesh key={i} position={[pd.x, -2.3 + pd.height * 0.5, pd.z]}>
            <cylinderGeometry args={[0.005, 0.02, pd.height, 4]} />
            <meshBasicMaterial color={i % 3 === 0 ? "#33cc88" : "#22aa77"} transparent opacity={0.7} />
          </mesh>
        ))}
      </group>

      {/* Bioluminescent accent spots */}
      <pointLight position={[-2, -1.5, 1]} intensity={0.15} color="#ff8844" distance={3} />
      <pointLight position={[1.5, -1, -1.5]} intensity={0.1} color="#44ffaa" distance={2.5} />

      <EffectComposer>
        <Bloom luminanceThreshold={0.3} luminanceSmoothing={0.9} intensity={1.2} />
      </EffectComposer>
    </>
  );
}

// ─── 3. Cage scene — nested wireframe platonic solids ───

export function CageScene({ analyser, dataArray }: SceneProps) {
  const audio = useAudioData(analyser, dataArray);
  const meshRefs = useRef<THREE.Mesh[]>([]);

  // Outer to inner: icosahedron, dodecahedron, cube, tetrahedron
  const cages = useMemo(() => [
    { type: "icosahedron" as const, scale: 2.2, rotAxis: new THREE.Vector3(0, 1, 0), speed: 0.06 },
    { type: "dodecahedron" as const, scale: 1.6, rotAxis: new THREE.Vector3(1, 0, 0.3).normalize(), speed: -0.08 },
    { type: "box" as const, scale: 1.1, rotAxis: new THREE.Vector3(0.3, 1, 0.5).normalize(), speed: 0.1 },
    { type: "tetrahedron" as const, scale: 0.65, rotAxis: new THREE.Vector3(0.5, 0.3, 1).normalize(), speed: -0.13 },
  ], []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const a = audio.current;

    meshRefs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const cage = cages[i];

      // Rotate on its own axis
      mesh.rotateOnWorldAxis(cage.rotAxis, cage.speed * 0.016); // per-frame

      // Subtle audio breathing on scale
      const breathe = 1.0 + Math.sin(t * 0.3 + i * 1.2) * 0.03 + a.amplitude * 0.04;
      mesh.scale.setScalar(cage.scale * breathe);

      // Color: cool blue-white with subtle shift
      const mat = mesh.material as THREE.MeshBasicMaterial;
      const brightness = 0.25 + a.amplitude * 0.15 + Math.sin(t * 0.4 + i * 0.8) * 0.05;
      const hue = 0.58 + i * 0.03 + Math.sin(t * 0.05) * 0.02;
      mat.color.setHSL(hue, 0.3, brightness);
    });
  });

  return (
    <>
      {cages.map((cage, i) => (
        <mesh key={i} ref={(el) => { if (el) meshRefs.current[i] = el; }}>
          {cage.type === "icosahedron" && <icosahedronGeometry args={[1, 0]} />}
          {cage.type === "dodecahedron" && <dodecahedronGeometry args={[1, 0]} />}
          {cage.type === "box" && <boxGeometry args={[1.4, 1.4, 1.4]} />}
          {cage.type === "tetrahedron" && <tetrahedronGeometry args={[1, 0]} />}
          <meshBasicMaterial
            wireframe
            transparent
            opacity={0.6}
            depthWrite={false}
          />
        </mesh>
      ))}
      <EffectComposer>
        <Bloom luminanceThreshold={0.1} luminanceSmoothing={0.9} intensity={2.5} />
      </EffectComposer>
    </>
  );
}

